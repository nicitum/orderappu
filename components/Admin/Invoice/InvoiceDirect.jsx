import React, { useEffect, useState, useCallback } from 'react';
import {
    View,
    Text,
    ActivityIndicator,
    Alert,
    TouchableOpacity,
    FlatList,
    TextInput,
    Animated,
    SafeAreaView,
    StatusBar,
    Image,
    Modal,
    ScrollView,
    Platform,
    ToastAndroid,
    PermissionsAndroid,
    Linking,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import Toast from 'react-native-toast-message';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ipAddress } from '../../../services/urls';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { useNavigation } from '@react-navigation/native';
import RNFS from 'react-native-fs';
import Share from 'react-native-share';
import RNBluetoothClassic from 'react-native-bluetooth-classic';
import {
    fetchAllUsers,
    fetchCustomerData,
    generateInvoiceNumber,
    createDirectInvoice,
    generateDirectInvoice,
    generateInvoicePDF,
    shareInvoicePDF,
    filterUsers,
    calculateTotalAmount,
    calculateGSTAwareTotal,
    updateProductQuantity,
    fetchClientStatus,
    fetchGeneralLedgers
} from './InvoiceDirectHelper';
import { printInvoicePOSPDF } from './invoicePOSPrintUtils';
import SearchProductModal_1 from '../searchProductModal_1';
import {
    COLORS,
    SelectedProductItem,
    UserCard,
    LoadingComponent,
    ErrorComponent,
    NoDataComponent,
    InvoiceNumberDisplay,
    TotalAmountDisplay,
    GSTAwareTotalDisplay,
    CreateButton,
    styles as invoiceDirectStyles
} from './InvoiceDirectComponents';

import { useFontScale } from '../../../App';

// Helper to convert Uint8Array to base64 (for RNFS)
function uint8ToBase64(uint8) {
    let binary = '';
    for (let i = 0; i < uint8.length; i++) {
        binary += String.fromCharCode(uint8[i]);
    }
    if (typeof global !== 'undefined' && global.btoa) {
        return global.btoa(binary);
    } else if (typeof btoa !== 'undefined') {
        return btoa(binary);
    } else {
        throw new Error('No base64 encoding function available');
    }
}

// Parse bank account data - handles both string and object formats
const parseBankAccountData = (bankAccountData) => {
    // Handle null, undefined, empty string, or 'null' string
    if (!bankAccountData || bankAccountData === 'null' || bankAccountData === '[]') {
        return {};
    }
    
    try {
        // If it's already an object, use it as is
        if (typeof bankAccountData === 'object' && !Array.isArray(bankAccountData)) {
            return bankAccountData;
        } 
        // If it's a string, parse it
        else if (typeof bankAccountData === 'string') {
            return JSON.parse(bankAccountData);
        }
        // For any other case, keep it as is
        else {
            return bankAccountData;
        }
    } catch (parseError) {
        console.warn('Failed to parse bank_accounts data:', parseError);
        // If parsing fails, keep the original data
        return bankAccountData;
    }
};

// Helper function to check and request storage permissions
const checkStoragePermissions = async () => {
    if (Platform.OS !== 'android') {
        return true; // iOS doesn't need explicit storage permissions for app documents
    }

    try {
        // For Android 13+ (API 33+), we don't need WRITE_EXTERNAL_STORAGE
        if (Platform.Version >= 33) {
            return true;
        }
        
        // For Android 10-12 (API 29-32), check if we have permission
        if (Platform.Version >= 29) {
            // Check if we already have permission
            const hasPermission = await PermissionsAndroid.check(
                PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE
            );
            
            if (hasPermission) {
                return true;
            }
            
            // Request permission
            const granted = await PermissionsAndroid.request(
                PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE,
                {
                    title: "Storage Permission Required",
                    message: "This app needs access to storage to save PDF files to your Downloads folder.",
                    buttonNeutral: "Ask Me Later",
                    buttonNegative: "Cancel",
                    buttonPositive: "OK",
                }
            );
            
            return granted === PermissionsAndroid.RESULTS.GRANTED;
        }
        
        // For older Android versions (below API 29)
        const hasPermission = await PermissionsAndroid.check(
            PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE
        );
        
        if (hasPermission) {
            return true;
        }
        
        const granted = await PermissionsAndroid.request(
            PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE,
            {
                title: "Storage Permission Required",
                message: "This app needs access to storage to save PDF files.",
                buttonNeutral: "Ask Me Later",
                buttonNegative: "Cancel",
                buttonPositive: "OK",
            }
        );
        
        return granted === PermissionsAndroid.RESULTS.GRANTED;
        
    } catch (error) {
        console.warn('Permission check failed:', error);
        return false;
    }
};

// Helper function to save PDF to downloads (improved with better error handling)
const savePDFToDownloads = async (pdfBytes, fileName) => {
    try {
        console.log('Starting PDF save process...');
        console.log('Platform:', Platform.OS, 'Version:', Platform.Version);
        console.log('DownloadDirectoryPath:', RNFS.DownloadDirectoryPath);
        
        if (Platform.OS === 'android') {
            // Check and request permissions first
            const hasPermission = await checkStoragePermissions();
            
            if (!hasPermission) {
                Alert.alert(
                    "Permission Required", 
                    "Storage permission is required to save PDF files. Please grant permission in app settings.",
                    [
                        { text: "Cancel", style: "cancel" },
                        { text: "Open Settings", onPress: () => Linking.openSettings() }
                    ]
                );
                return null;
            }
            
            // Ensure Downloads directory exists
            const downloadDir = RNFS.DownloadDirectoryPath;
            const dirExists = await RNFS.exists(downloadDir);
            
            if (!dirExists) {
                console.log('Downloads directory does not exist, creating...');
                await RNFS.mkdir(downloadDir);
            }
            
            // Create full file path
            const filePath = `${downloadDir}/${fileName}`;
            console.log('Saving to path:', filePath);
            
            // Check if file already exists and create unique name if needed
            let finalPath = filePath;
            let counter = 1;
            while (await RNFS.exists(finalPath)) {
                const nameWithoutExt = fileName.replace('.pdf', '');
                finalPath = `${downloadDir}/${nameWithoutExt}_${counter}.pdf`;
                counter++;
            }
            
            // Convert Uint8Array to base64
            const base64Data = uint8ToBase64(pdfBytes);
            
            // Write file
            await RNFS.writeFile(finalPath, base64Data, 'base64');
            
            // Verify file was created
            const fileExists = await RNFS.exists(finalPath);
            if (!fileExists) {
                throw new Error('File was not created successfully');
            }
            
            const finalFileName = finalPath.split('/').pop();
            ToastAndroid.show(`PDF saved to Downloads as ${finalFileName}`, ToastAndroid.LONG);
            console.log('PDF saved successfully to:', finalPath);
            
            return finalPath;
        } else {
            // iOS - save to Documents directory
            const documentsDir = RNFS.DocumentDirectoryPath;
            const filePath = `${documentsDir}/${fileName}`;
            
            const base64Data = uint8ToBase64(pdfBytes);
            await RNFS.writeFile(filePath, base64Data, 'base64');
            
            Alert.alert("Success", `PDF saved to Documents as ${fileName}`);
            return filePath;
        }
        
    } catch (error) {
        console.error("Error saving PDF:", error);
        
        let errorMessage = "Failed to save PDF";
        
        if (error.code === 'ENOENT') {
            errorMessage = "Directory not found. Please try again.";
        } else if (error.code === 'EACCES') {
            errorMessage = "Permission denied. Please check app permissions in settings.";
        } else if (error.message.includes('Permission')) {
            errorMessage = "Storage permission required. Please grant permission and try again.";
        } else {
            errorMessage = `Save failed: ${error.message}`;
        }
        
        Alert.alert("Error", errorMessage, [
            { text: "OK" },
            { text: "Open Settings", onPress: () => Linking.openSettings() }
        ]);
        
        return null;
    }
};

// Helper function to generate summary data in the required JSON format
const generateInvoiceSummary = (products, gstMethod, clientState, customerState) => {
  try {
    // Calculate item-level details
    const items = products.map(product => {
      const quantity = parseFloat(product.quantity || 0);
      const rate = parseFloat(product.price || 0);
      const gstRate = parseFloat(product.gst_rate || 0);
      
      let amount, taxableValue, gstAmount, lineTotal;
      
      if (gstMethod === "Inclusive GST") {
        // For inclusive GST, the rate already includes GST
        lineTotal = quantity * rate; // This is the total including GST
        taxableValue = gstRate > 0 ? lineTotal / (1 + gstRate / 100) : lineTotal;
        gstAmount = lineTotal - taxableValue;
        amount = taxableValue; // Base amount without GST
      } else {
        // For exclusive GST, we calculate GST on top of the base price
        amount = quantity * rate; // Base amount without GST
        gstAmount = amount * (gstRate / 100);
        lineTotal = amount + gstAmount; // Total including GST
        taxableValue = amount; // Same as amount for exclusive GST
      }
      
      // Calculate CGST, SGST, IGST
      // Use IGST when client state is NOT equal to customer state, otherwise split into CGST/SGST
      const useIgst = clientState !== customerState;
      let cgstAmount = 0, sgstAmount = 0, igstAmount = 0;
      
      if (useIgst) {
        igstAmount = gstAmount;
      } else {
        cgstAmount = gstAmount / 2;
        sgstAmount = gstAmount / 2;
      }
      
      return {
        rate: rate,
        unit: "Pcs",
        brand: product.brand || "",
        amount: parseFloat(amount.toFixed(2)),
        category: product.category || "",
        gst_rate: gstRate,
        hsn_code: product.hsn_code || "",
        quantity: quantity,
        gst_amount: parseFloat(gstAmount.toFixed(2)),
        line_total: parseFloat(lineTotal.toFixed(2)),
        product_id: product.product_id,
        cgst_amount: parseFloat(cgstAmount.toFixed(2)),
        gst_percent: gstRate,
        igst_amount: parseFloat(igstAmount.toFixed(2)),
        sgst_amount: parseFloat(sgstAmount.toFixed(2)),
        product_code: product.product_code || "",
        product_name: product.name || "",
        taxable_rate: parseFloat(taxableValue.toFixed(2)),
        taxable_value: parseFloat(taxableValue.toFixed(2))
      };
    });
    
    // Calculate totals
    const subtotal = items.reduce((sum, item) => sum + item.amount, 0);
    const totalGst = items.reduce((sum, item) => sum + item.gst_amount, 0);
    const totalCgst = items.reduce((sum, item) => sum + item.cgst_amount, 0);
    const totalSgst = items.reduce((sum, item) => sum + item.sgst_amount, 0);
    const totalIgst = items.reduce((sum, item) => sum + item.igst_amount, 0);
    const totalTaxableValue = items.reduce((sum, item) => sum + item.taxable_value, 0);
    const grandTotal = subtotal + totalGst;
    const totalGstRate = items.reduce((sum, item) => sum + item.gst_rate, 0);
    // Use IGST when client state is NOT equal to customer state, otherwise split into CGST/SGST
    const useIgst = clientState !== customerState;
    
    const summaryData = {
      items: items,
      totals: {
        subtotal: parseFloat(subtotal.toFixed(2)),
        use_igst: useIgst,
        total_gst: parseFloat(totalGst.toFixed(2)),
        gst_method: gstMethod,
        total_cgst: parseFloat(totalCgst.toFixed(2)),
        total_igst: parseFloat(totalIgst.toFixed(2)),
        total_sgst: parseFloat(totalSgst.toFixed(2)),
        grand_total: parseFloat(grandTotal.toFixed(2)),
        total_gst_rate: totalGstRate,
        total_taxable_value: parseFloat(totalTaxableValue.toFixed(2))
      },
      gst_method: gstMethod,
      client_state: clientState,
      customer_state: customerState
    };
    
    return summaryData;
  } catch (error) {
    console.error('Error generating invoice summary:', error);
    return null;
  }
};

const InvoiceDirect = () => {
    const navigation = useNavigation();
    const { getScaledSize } = useFontScale();
    const [allUsers, setAllUsers] = useState([]);
    const [filteredUsers, setFilteredUsers] = useState([]);
    const [selectedUser, setSelectedUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const fadeAnim = useState(new Animated.Value(0))[0];
    
    // Product modal state
    const [showSearchModal, setShowSearchModal] = useState(false);
    const [showExistingCustomers, setShowExistingCustomers] = useState(false);
    
    // Invoice creation states
    const [selectedProducts, setSelectedProducts] = useState([]);
    const [showInvoiceCreation, setShowInvoiceCreation] = useState(false);
    const [invoiceNumber, setInvoiceNumber] = useState('');
    const [isCreatingInvoice, setIsCreatingInvoice] = useState(false);
    
    // Invoice generation/retrieval states
    const [showInvoiceRetrieval, setShowInvoiceRetrieval] = useState(false);
    const [retrievedInvoice, setRetrievedInvoice] = useState(null);
    const [isGeneratingInvoice, setIsGeneratingInvoice] = useState(false);
    const [searchInvoiceNumber, setSearchInvoiceNumber] = useState('');
    const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
    const [isSharingPDF, setIsSharingPDF] = useState(false);
    const [generatedPDFData, setGeneratedPDFData] = useState(null);
    const [customerData, setCustomerData] = useState(null);
    const [gstMethod, setGstMethod] = useState('Inclusive GST'); // Default to inclusive
    const [clientState, setClientState] = useState(''); // Initialize as empty, will be set from API
    const [customerState, setCustomerState] = useState(''); // Initialize as empty, will be set from API
    
    // Bank account and collections states
    const [bankAccounts, setBankAccounts] = useState([]);
    const [selectedUpiAccount, setSelectedUpiAccount] = useState('');
    const [selectedChequeAccount, setSelectedChequeAccount] = useState('');
    const [loadingBankAccounts, setLoadingBankAccounts] = useState(false);
    const [collections, setCollections] = useState({
        invoiceAmount: 0,
        credit: 0,
        upi: 0,
        cheque: 0,
        cash: 0,
        tendered: 0,
        balance: 0
    });
    const [gstTotals, setGstTotals] = useState({
        subtotal: '0.00',
        gstAmount: '0.00',
        cgstAmount: '0.00',
        sgstAmount: '0.00',
        igstAmount: '0.00',
        grandTotal: '0.00',
        gstMethod: 'Inclusive GST'
    });

    // Fade-in animation for search bar
    useEffect(() => {
        Animated.timing(fadeAnim, {
            toValue: 1,
            duration: 500,
            useNativeDriver: true,
        }).start();
    }, []);
    
    // Fetch bank accounts when component mounts
    useEffect(() => {
        const fetchBankAccounts = async () => {
            setLoadingBankAccounts(true);
            try {
                const response = await fetchGeneralLedgers({ under_group: 'Bank Accounts' });
                if (response.success) {
                    setBankAccounts(response.data || []);
                }
            } catch (error) {
                console.error('Error fetching bank accounts:', error);
                Alert.alert('Error', 'Failed to fetch bank accounts');
            } finally {
                setLoadingBankAccounts(false);
            }
        };

        fetchBankAccounts();
    }, []);

    // Load all users and client status when component mounts
    useEffect(() => {
        loadAllUsers();
        loadClientStatus();
    }, [loadAllUsers, loadClientStatus]);

    // Fetch all users
    const loadAllUsers = useCallback(async () => {
        try {
            setLoading(true);
            const result = await fetchAllUsers();
            
            if (result.success) {
                setAllUsers(result.data);
                setFilteredUsers(result.data);
                setError(null);
            } else {
                setError(result.error);
                setAllUsers([]);
                setFilteredUsers([]);
                Alert.alert("Error", `Failed to load users: ${result.error}`);
            }
        } catch (err) {
            console.error("Error loading users:", err);
            setError(err.message);
            setAllUsers([]);
            setFilteredUsers([]);
            Alert.alert("Error", `Failed to load users: ${err.message}`);
        } finally {
            setLoading(false);
        }
    }, []);

    // Fetch GST method from client status
    const loadGSTMethod = useCallback(async () => {
        try {
            const result = await fetchClientStatus();
            if (result.success) {
                setGstMethod(result.data.gstMethod || 'Inclusive GST');
                console.log('GST Method loaded:', result.data.gstMethod);
            } else {
                console.warn('Failed to fetch GST method, using default:', result.error);
                setGstMethod('Inclusive GST'); // Default to inclusive
            }
        } catch (error) {
            console.error('Error loading GST method:', error);
            setGstMethod('Inclusive GST'); // Default to inclusive
        }
    }, []);

    // Fetch client status to get GST method and client state
    const loadClientStatus = useCallback(async () => {
        try {
            const result = await fetchClientStatus();
            if (result.success) {
                setGstMethod(result.data.gst_method || 'Inclusive GST');
                setClientState(result.data.state || '');
                console.log('Client status loaded:', result.data);
            } else {
                console.warn('Failed to fetch client status, using defaults:', result.error);
                setGstMethod('Inclusive GST'); // Default to inclusive
                setClientState(''); // Empty default
            }
        } catch (error) {
            console.error('Error loading client status:', error);
            setGstMethod('Inclusive GST'); // Default to inclusive
            setClientState(''); // Empty default
        }
    }, []);

    // Filter users based on search query
    const handleSearch = (query) => {
        setSearchQuery(query);
        const filtered = filterUsers(allUsers, query);
        setFilteredUsers(filtered);
    };

    // Handle user selection - show product search modal
    const handleUserSelect = async (user) => {
        setSelectedUser(user);
        setShowExistingCustomers(false); // Hide customer list
        
        // Fetch customer data for PDF generation
        try {
            const result = await fetchCustomerData(user.customer_id);
            if (result.success) {
                setCustomerData(result.data);
                // Set customer state from the customer data
                setCustomerState(result.data.state || '');
            } else {
                console.warn('Failed to fetch customer data:', result.error);
                setCustomerData(null);
                setCustomerState(''); // Empty default
            }
        } catch (error) {
            console.error('Error fetching customer data:', error);
            setCustomerData(null);
            setCustomerState(''); // Empty default
        }
        
        setShowSearchModal(true);
    };

    // Handle back from products to user selection
    const handleBackToUsers = () => {
        setSelectedUser(null);
        setSelectedProducts([]);
        setShowInvoiceCreation(false);
        setInvoiceNumber('');
        setShowInvoiceRetrieval(false);
        setRetrievedInvoice(null);
        setSearchInvoiceNumber('');
        setCustomerData(null);
    };

    // Handle back from invoice retrieval
    const handleBackFromRetrieval = () => {
        setShowInvoiceRetrieval(false);
        setRetrievedInvoice(null);
        setSearchInvoiceNumber('');
        setGeneratedPDFData(null);
        setIsGeneratingPDF(false);
        setIsSharingPDF(false);
    };

    // Handle product addition from search modal
    const handleAddProduct = async (product) => {
        const existingIndex = selectedProducts.findIndex(p => p.product_id === product.id);
        if (existingIndex >= 0) {
            // Update quantity if product already exists
            setSelectedProducts(prev => 
                prev.map(p => 
                    p.product_id === product.id 
                        ? { ...p, quantity: p.quantity + (product.quantity || 1) }
                        : p
                )
            );
        } else {
            // Add new product
            setSelectedProducts(prev => [...prev, {
                product_id: product.id,
                name: product.name,
                category: product.category,
                price: product.price,
                quantity: product.quantity || 1,
                gst_rate: product.gst_rate || 0
            }]);
        }
        
        // Generate invoice number if not already generated
        if (!invoiceNumber) {
            try {
                const result = await generateInvoiceNumber();
                if (result.success) {
                    setInvoiceNumber(result.data);
                } else {
                    Toast.show({
                        type: 'error',
                        text1: 'Error',
                        text2: result.error
                    });
                    return; // Don't proceed if invoice number generation fails
                }
            } catch (error) {
                console.error('Error generating invoice number:', error);
                Toast.show({
                    type: 'error',
                    text1: 'Error',
                    text2: 'Failed to generate invoice number'
                });
                return; // Don't proceed if invoice number generation fails
            }
        }
        
        // Close the search modal and show invoice creation
        setShowSearchModal(false);
        setShowInvoiceCreation(true);
    };

    // Update product quantity
    const updateProductQuantityHandler = (productId, quantity) => {
        const updatedProducts = updateProductQuantity(productId, quantity, selectedProducts);
        setSelectedProducts(updatedProducts);
    };
    
    // Handle collections input changes
    const handleCollectionsChange = (field, value) => {
        // Allow empty values (for clearing) or positive numbers including 0
        let numValue;
        if (value === '' || value === null || value === undefined) {
            numValue = '';
        } else {
            const parsedValue = parseFloat(value);
            // Only allow positive numbers or 0
            if (!isNaN(parsedValue) && parsedValue >= 0) {
                numValue = parsedValue;
            } else {
                // If invalid input, keep the previous value
                return;
            }
        }
        
        setCollections(prev => {
            const updated = { ...prev, [field]: numValue };
            
            // Auto-calculate cash distribution based on other payment methods
            // Cash should be: invoiceAmount - (credit + upi + cheque)
            const totalOtherPayments = 
                parseFloat(updated.credit || 0) +
                parseFloat(updated.upi || 0) +
                parseFloat(updated.cheque || 0);
            
            const calculatedCash = Math.max(0, parseFloat(updated.invoiceAmount || 0) - totalOtherPayments);
            updated.cash = parseFloat(calculatedCash.toFixed(2));
            
            // Calculate balance: tendered amount - cash amount
            if (field === 'tendered' || field === 'cash') {
                const tenderedAmount = parseFloat(updated.tendered || 0);
                const cashAmount = parseFloat(updated.cash || 0);
                updated.balance = parseFloat((tenderedAmount - cashAmount).toFixed(2));
            } else {
                // For other fields, recalculate balance based on current tendered and cash values
                const tenderedAmount = parseFloat(updated.tendered || 0);
                const cashAmount = parseFloat(updated.cash || 0);
                updated.balance = parseFloat((tenderedAmount - cashAmount).toFixed(2));
            }
            
            return updated;
        });
    };
    
    // Validate collections
    const validateCollections = () => {
        // Handle empty values in collections by treating them as 0
        const totalPayments = 
            parseFloat(collections.credit || 0) +
            parseFloat(collections.upi || 0) +
            parseFloat(collections.cheque || 0) +
            parseFloat(collections.cash || 0);
        
        // Use GST-aware grand total for validation
        const invoiceAmount = parseFloat(gstTotals.grandTotal || 0);
        const tenderedAmount = parseFloat(collections.tendered || 0);
        
        // Check if total payments match invoice amount exactly
        if (Math.abs(totalPayments - invoiceAmount) > 0.01) {
            return `Total collected amount (₹${totalPayments.toFixed(2)}) must exactly match the invoice amount (₹${invoiceAmount.toFixed(2)})`;
        }
        // Check if tendered amount is greater than or equal to cash amount
        else if (tenderedAmount < parseFloat(collections.cash || 0)) {
            return `Tendered amount (₹${tenderedAmount.toFixed(2)}) must be greater than or equal to cash amount (₹${parseFloat(collections.cash || 0).toFixed(2)})`;
        }
        
        return null;
    };
    
    // Update collections and GST totals when selected products change
    useEffect(() => {
        const totalAmount = calculateTotalAmount(selectedProducts);
        setCollections(prev => {
            // When products change, update invoiceAmount and reset other payment methods
            // But keep cash equal to the new invoiceAmount initially
            const newInvoiceAmount = parseFloat(totalAmount) || 0;
            
            return {
                ...prev,
                invoiceAmount: newInvoiceAmount,
                cash: newInvoiceAmount, // Initially set cash equal to invoiceAmount
                credit: 0,
                upi: 0,
                cheque: 0,
                balance: 0
            };
        });
    }, [selectedProducts]);
    
    // Update collections invoiceAmount when GST totals change
    useEffect(() => {
        const newInvoiceAmount = parseFloat(gstTotals.grandTotal || 0);
        setCollections(prev => {
            // When GST totals change, update invoiceAmount
            // If no other payments are made, cash should equal the new invoiceAmount
            const totalOtherPayments = 
                parseFloat(prev.credit || 0) +
                parseFloat(prev.upi || 0) +
                parseFloat(prev.cheque || 0);
            
            const calculatedCash = Math.max(0, newInvoiceAmount - totalOtherPayments);
            
            return {
                ...prev,
                invoiceAmount: newInvoiceAmount,
                cash: calculatedCash
            };
        });
    }, [gstTotals]);
    
    // Calculate GST-aware totals when selected products change
    useEffect(() => {
        // Calculate GST-aware totals for display with IGST logic
        const calculateGSTAwareTotalWithIGST = async () => {
            try {
                // Fetch client status to get GST method
                const clientStatusResult = await fetchClientStatus();
                let gstMethod = "Inclusive GST"; // Default to inclusive
                if (clientStatusResult.success) {
                    gstMethod = clientStatusResult.data.gst_method || clientStatusResult.data.gstMethod || "Inclusive GST";
                }
                
                const isInclusive = gstMethod === "Inclusive GST";
                let totalTaxableValue = 0;
                let totalGstAmount = 0;
                
                if (isInclusive) {
                    // For inclusive GST, the price already includes GST
                    selectedProducts.forEach(item => {
                        const qty = parseFloat(item.quantity || 0);
                        const price = parseFloat(item.price || 0); // This is the GST-inclusive price
                        const gstRate = parseFloat(item.gst_rate || 0);
                        
                        // For inclusive GST, the price already includes GST
                        const priceIncludingGst = qty * price; // This is the total (Rate * Qty)
                        const taxableValue = gstRate > 0 ? priceIncludingGst / (1 + gstRate / 100) : priceIncludingGst;
                        const gstAmount = priceIncludingGst - taxableValue;
                        
                        totalTaxableValue += taxableValue;
                        totalGstAmount += gstAmount;
                    });
                } else {
                    // For exclusive GST, we calculate GST on top of the base price
                    selectedProducts.forEach(item => {
                        const qty = parseFloat(item.quantity || 0);
                        const price = parseFloat(item.price || 0);
                        const gstRate = parseFloat(item.gst_rate || 0);
                        
                        const taxableValue = qty * price; // Base amount without GST (Rate * Qty)
                        const gstAmount = taxableValue * (gstRate / 100);
                        
                        totalTaxableValue += taxableValue;
                        totalGstAmount += gstAmount;
                    });
                }
                
                const grandTotal = totalTaxableValue + totalGstAmount;
                
                // Determine if IGST should be used (when client state is NOT equal to customer state)
                const useIgst = clientState && customerState && clientState !== customerState;
                
                let cgstAmount = 0, sgstAmount = 0, igstAmount = 0;
                
                if (useIgst) {
                    // Use IGST for interstate transactions
                    igstAmount = totalGstAmount;
                } else {
                    // Split GST into CGST/SGST for intrastate transactions
                    cgstAmount = totalGstAmount / 2;
                    sgstAmount = totalGstAmount / 2;
                }
                
                return {
                    subtotal: parseFloat(totalTaxableValue).toFixed(2),
                    gstAmount: parseFloat(totalGstAmount).toFixed(2),
                    cgstAmount: parseFloat(cgstAmount).toFixed(2),
                    sgstAmount: parseFloat(sgstAmount).toFixed(2),
                    igstAmount: parseFloat(igstAmount).toFixed(2),
                    grandTotal: parseFloat(grandTotal).toFixed(2),
                    gstMethod: gstMethod
                };
            } catch (error) {
                console.error('Error calculating GST-aware total:', error);
                // Fallback to simple calculation
                const simpleTotal = selectedProducts.reduce((sum, product) => {
                    const price = parseFloat(product.price) || 0;
                    const quantity = parseInt(product.quantity) || 0;
                    return sum + (price * quantity);
                }, 0);
                
                return {
                    subtotal: parseFloat(simpleTotal).toFixed(2),
                    gstAmount: "0.00",
                    cgstAmount: "0.00",
                    sgstAmount: "0.00",
                    igstAmount: "0.00",
                    grandTotal: parseFloat(simpleTotal).toFixed(2),
                    gstMethod: "Inclusive GST"
                };
            }
        };
        
        // Calculate GST-aware totals for display
        calculateGSTAwareTotalWithIGST().then(totals => {
            setGstTotals(totals);
        }).catch(error => {
            console.error('Error calculating GST totals:', error);
            // Fallback to simple calculation
            const simpleTotal = calculateTotalAmount(selectedProducts);
            setGstTotals({
                subtotal: parseFloat(simpleTotal).toFixed(2),
                gstAmount: "0.00",
                cgstAmount: "0.00",
                sgstAmount: "0.00",
                igstAmount: "0.00",
                grandTotal: parseFloat(simpleTotal).toFixed(2),
                gstMethod: "Inclusive GST"
            });
        });
    }, [selectedProducts, clientState, customerState]);

    // Generate invoice number using API
    const generateInvoiceNumberHandler = async () => {
        try {
            const result = await generateInvoiceNumber();
            if (result.success) {
                setInvoiceNumber(result.data);
            } else {
                Toast.show({
                    type: 'error',
                    text1: 'Error',
                    text2: result.error
                });
            }
        } catch (error) {
            console.error('Error generating invoice number:', error);
            Toast.show({
                type: 'error',
                text1: 'Error',
                text2: 'Failed to generate invoice number'
            });
        }
    };

    // Create direct invoice
    const createDirectInvoiceHandler = async () => {
        if (!invoiceNumber.trim()) {
            Toast.show({
                type: 'error',
                text1: 'Error',
                text2: 'Invoice number is required'
            });
            return;
        }

        if (selectedProducts.length === 0) {
            Toast.show({
                type: 'error',
                text1: 'Error',
                text2: 'Please select at least one product'
            });
            return;
        }

        // Validate collections
        const collectionsError = validateCollections();
        if (collectionsError) {
            Toast.show({
                type: 'error',
                text1: 'Collections Error',
                text2: collectionsError
            });
            return;
        }

        try {
            setIsCreatingInvoice(true);
            
            // Use GST-aware grand total for the invoice
            const totalAmount = parseFloat(gstTotals.grandTotal || 0);

            // Prepare collections data with bank account information
            const collectionsData = {
                ...collections,
                invoice_id: invoiceNumber.trim(),
                upi_account_id: selectedUpiAccount || null,
                upi_account_details: selectedUpiAccount 
                    ? (() => {
                        const account = bankAccounts.find(acc => acc.id == selectedUpiAccount);
                        if (account) {
                            const bankDetails = parseBankAccountData(account.bank_accounts);
                            // Send simplified bank account information
                            return {
                                id: account.id,
                                name: bankDetails.account_holder_name,
                                number: bankDetails.account_number,
                                ifsc: bankDetails.ifsc_code
                            };
                        }
                        return null;
                    })()
                    : null,
                cheque_account_id: selectedChequeAccount || null,
                cheque_account_details: selectedChequeAccount 
                    ? (() => {
                        const account = bankAccounts.find(acc => acc.id == selectedChequeAccount);
                        if (account) {
                            const bankDetails = parseBankAccountData(account.bank_accounts);
                            // Send simplified bank account information
                            return {
                                id: account.id,
                                name: bankDetails.account_holder_name,
                                number: bankDetails.account_number,
                                ifsc: bankDetails.ifsc_code
                            };
                        }
                        return null;
                    })()
                    : null
            };

            const invoiceData = {
                invoiceNumber: invoiceNumber.trim(),
                products: selectedProducts,
                totalAmount: totalAmount,
                customerName: selectedUser?.username || `Customer ${selectedUser?.customer_id}`,
                customerPhone: customerData?.phone || 'N/A',
                customerId: selectedUser?.customer_id || null,  // Add missing customer_id
                customerRoute: customerData?.route || null,  // Add customer route
                collections: collectionsData,  // Add collections data
                placed_on: Math.floor(Date.now() / 1000), // Add placed_on timestamp
                summary: generateInvoiceSummary(
                    selectedProducts, 
                    gstMethod, // Use the fetched GST method
                    clientState || 'Karnataka', // Use the fetched client state or default to Karnataka
                    customerState || customerData?.state || clientState || 'Karnataka' // Use customer state or fallback to client state or default to Karnataka
                )
            };

            const result = await createDirectInvoice(invoiceData);

            if (result.success) {
                Toast.show({
                    type: 'success',
                    text1: 'Success',
                    text2: 'Direct invoice created successfully!'
                });
                
                // Automatically generate PDF after successful creation
                setIsGeneratingPDF(true);
                
                try {
                    // Step 1: Retrieve the created invoice data
                    const retrieveResult = await generateDirectInvoice(invoiceNumber.trim());
                    
                    if (retrieveResult.success) {
                        setRetrievedInvoice(retrieveResult.data);
                        
                         // Step 2: Generate PDF
                         const pdfResult = await generateInvoicePDF(retrieveResult.data, customerData || null);
                        
                        if (pdfResult.success) {
                            setGeneratedPDFData(pdfResult);
                            Toast.show({
                                type: 'success',
                                text1: 'PDF Generated',
                                text2: 'Invoice PDF is ready to share!'
                            });
                        } else {
                            throw new Error(pdfResult.error || 'Failed to generate PDF');
                        }
                    } else {
                        throw new Error(retrieveResult.error || 'Failed to retrieve created invoice');
                    }
                } catch (pdfError) {
                    console.error('Error generating PDF after creation:', pdfError);
                    Toast.show({
                        type: 'error',
                        text1: 'PDF Generation Failed',
                        text2: 'Invoice created but PDF generation failed'
                    });
                } finally {
                    setIsGeneratingPDF(false);
                }
                
                // Reset form but keep PDF view open
                setSelectedProducts([]);
                setShowInvoiceCreation(false);
                setInvoiceNumber('');
                
                // Reset collections
                setCollections({
                    invoiceAmount: 0,
                    credit: 0,
                    upi: 0,
                    cheque: 0,
                    cash: 0,
                    tendered: 0,
                    balance: 0
                });
                setSelectedUpiAccount('');
                setSelectedChequeAccount('');
                
            } else {
                throw new Error(result.error || 'Failed to create invoice');
            }
        } catch (error) {
            console.error('Error creating direct invoice:', error);
            Toast.show({
                type: 'error',
                text1: 'Error',
                text2: error.message || 'Failed to create invoice'
            });
        } finally {
            setIsCreatingInvoice(false);
        }
    };

    // Generate/Retrieve existing invoice and create PDF
    const generateInvoiceHandler = async () => {
        if (!searchInvoiceNumber.trim()) {
            Toast.show({
                type: 'error',
                text1: 'Error',
                text2: 'Invoice number is required'
            });
            return;
        }

        try {
            setIsGeneratingInvoice(true);
            
            // Step 1: Retrieve invoice data
            const result = await generateDirectInvoice(searchInvoiceNumber.trim());

            if (result.success) {
                setRetrievedInvoice(result.data);
                
                // Step 2: Try to fetch customer data if we have a customer_id
                let customerDataForPDF = null;
                if (selectedUser?.customer_id) {
                    try {
                        const customerResult = await fetchCustomerData(selectedUser.customer_id);
                        if (customerResult.success) {
                            customerDataForPDF = customerResult.data;
                        }
                    } catch (error) {
                        console.warn('Failed to fetch customer data for PDF:', error);
                    }
                }
                
                // Step 3: Generate PDF
                setIsGeneratingPDF(true);
                const pdfResult = await generateInvoicePDF(result.data, customerDataForPDF || null);
                
                if (pdfResult.success) {
                    setGeneratedPDFData(pdfResult);
                    Toast.show({
                        type: 'success',
                        text1: 'Success',
                        text2: 'Invoice PDF generated successfully!'
                    });
                } else {
                    throw new Error(pdfResult.error || 'Failed to generate PDF');
                }
            } else {
                throw new Error(result.error || 'Failed to retrieve invoice');
            }
        } catch (error) {
            console.error('Error generating invoice:', error);
            Toast.show({
                type: 'error',
                text1: 'Error',
                text2: error.message || 'Failed to generate invoice'
            });
        } finally {
            setIsGeneratingInvoice(false);
            setIsGeneratingPDF(false);
        }
    };

    // Share generated PDF
    const sharePDFHandler = async () => {
        if (!generatedPDFData) {
            Toast.show({
                type: 'error',
                text1: 'Error',
                text2: 'No PDF available to share'
            });
            return;
        }

        // Validate required properties before proceeding
        if (!generatedPDFData.pdfBytes || !generatedPDFData.fileName) {
            Toast.show({
                type: 'error',
                text1: 'Error',
                text2: 'PDF data is incomplete'
            });
            return;
        }

        try {
            setIsSharingPDF(true);
            const result = await shareInvoicePDF(generatedPDFData.pdfBytes, generatedPDFData.fileName);
            
            if (result.success && !result.cancelled) {
                Toast.show({
                    type: 'success',
                    text1: 'Success',
                    text2: 'Invoice shared successfully!'
                });
            }
        } catch (error) {
            console.error('Error sharing PDF:', error);
            Toast.show({
                type: 'error',
                text1: 'Error',
                text2: error.message || 'Failed to share PDF'
            });
        } finally {
            setIsSharingPDF(false);
        }
    };

    // Download PDF to device storage with improved error handling
    const downloadPDFHandler = async () => {
        if (!generatedPDFData) {
            Toast.show({
                type: 'error',
                text1: 'Error',
                text2: 'No PDF available to download'
            });
            return;
        }

        try {
            setIsSharingPDF(true); // Reuse loading state
            
            console.log('Starting PDF download process...');
            console.log('PDF data type:', typeof generatedPDFData.pdfBytes);
            
            // Validate PDF data
            if (!generatedPDFData.pdfBytes || !generatedPDFData.fileName) {
                throw new Error('Invalid PDF data');
            }
            
            // Convert base64 back to Uint8Array for file saving
            let uint8Array;
            try {
                // Add a check to ensure generatedPDFData.pdfBytes is a string before calling atob
                if (typeof generatedPDFData.pdfBytes !== 'string') {
                    throw new Error('PDF data is not in the expected format');
                }
                const binaryString = atob(generatedPDFData.pdfBytes);
                uint8Array = new Uint8Array(binaryString.length);
                for (let i = 0; i < binaryString.length; i++) {
                    uint8Array[i] = binaryString.charCodeAt(i);
                }
                console.log('PDF converted to Uint8Array, size:', uint8Array.length);
            } catch (conversionError) {
                console.error('Error converting PDF data:', conversionError);
                throw new Error('Failed to process PDF data: ' + conversionError.message);
            }
            
            const filePath = await savePDFToDownloads(uint8Array, generatedPDFData.fileName || 'invoice.pdf');
            
            if (filePath) {
                Toast.show({
                    type: 'success',
                    text1: 'Success',
                    text2: 'Invoice downloaded successfully!'
                });
                console.log('PDF downloaded successfully to:', filePath);
            } else {
                Toast.show({
                    type: 'error',
                    text1: 'Download Failed',
                    text2: 'Could not save PDF to device storage'
                });
            }
        } catch (error) {
            console.error('Error downloading PDF:', error);
            Toast.show({
                type: 'error',
                text1: 'Download Failed',
                text2: error.message || 'Failed to download PDF'
            });
        } finally {
            setIsSharingPDF(false);
        }
    };

    // Print POS receipt
    const printPOSPDFHandler = async () => {
        if (!retrievedInvoice) {
            Toast.show({
                type: 'error',
                text1: 'Error',
                text2: 'No invoice data available to print'
            });
            return;
        }

        try {
            setIsSharingPDF(true);
            
            // Check if Bluetooth is enabled
            const isBluetoothEnabled = await RNBluetoothClassic.isBluetoothEnabled();
            if (!isBluetoothEnabled) {
                Toast.show({
                    type: 'error',
                    text1: 'Bluetooth Disabled',
                    text2: 'Please enable Bluetooth to print receipts'
                });
                return;
            }
            
            // Get connected devices
            const connectedDevices = await RNBluetoothClassic.getConnectedDevices();
            if (connectedDevices.length === 0) {
                Toast.show({
                    type: 'error',
                    text1: 'No Printer Connected',
                    text2: 'Please connect to a Bluetooth printer first'
                });
                return;
            }
            
            // Use the first connected device
            const deviceId = connectedDevices[0].id;
            
            // Transform the retrievedInvoice data to match what printInvoicePOSPDF expects
            const transformedInvoiceData = {
                invoice_info: {
                    invoice_number: retrievedInvoice.invoice?.invoice_number || retrievedInvoice.invoice_info?.invoice_number || retrievedInvoice.invoice_number || 'N/A',
                    invoice_amount: retrievedInvoice.invoice?.invoice_amount || retrievedInvoice.invoice_info?.invoice_amount || retrievedInvoice.invoice_amount || '0',
                    total_items: retrievedInvoice.items?.length || retrievedInvoice.products?.length || retrievedInvoice.invoice_info?.total_items || 0,
                    created_at: retrievedInvoice.invoice?.created_at || retrievedInvoice.invoice_info?.created_at || retrievedInvoice.created_at || null
                },
                products: retrievedInvoice.items || retrievedInvoice.products || [],
                collections: retrievedInvoice.collections || retrievedInvoice.invoice?.collections || {}
            };
            
            // Print the invoice directly
            const result = await printInvoicePOSPDF(transformedInvoiceData, customerData, deviceId, RNBluetoothClassic);
            
            if (result.success) {
                Toast.show({
                    type: 'success',
                    text1: 'Print Success',
                    text2: 'Invoice printed successfully!'
                });
            } else {
                throw new Error(result.error || 'Failed to print invoice');
            }
        } catch (error) {
            console.error('Error printing POS receipt:', error);
            Toast.show({
                type: 'error',
                text1: 'Print Failed',
                text2: error.message || 'Failed to print receipt'
            });
        } finally {
            setIsSharingPDF(false);
        }
    };

    // Cancel PDF view and go back to main screen
    const cancelPDFHandler = () => {
        setRetrievedInvoice(null);
        setGeneratedPDFData(null);
        setSearchInvoiceNumber('');
        setIsGeneratingPDF(false);
        setIsSharingPDF(false);
        
        // Go back to main screen
        setSelectedUser(null);
        setSelectedProducts([]);
        setShowInvoiceCreation(false);
        setInvoiceNumber('');
        setCustomerData(null);
    };


    // Render selected product item for invoice creation
    const renderSelectedProduct = ({ item }) => {
        return (
            <SelectedProductItem
                item={item}
                onQuantityChange={updateProductQuantityHandler}
                styles={invoiceDirectStyles}
                getScaledSize={getScaledSize}
            />
        );
    };

    useEffect(() => {
        loadAllUsers();
        loadGSTMethod();
    }, [loadAllUsers, loadGSTMethod]);

    return (
        <SafeAreaView style={invoiceDirectStyles.safeArea}>
            <StatusBar backgroundColor={COLORS.primary} barStyle="light-content" />
            
            {/* Header */}
            <View style={invoiceDirectStyles.header}>
                 <TouchableOpacity 
                     onPress={retrievedInvoice && generatedPDFData ? cancelPDFHandler :
                              showInvoiceRetrieval ? handleBackFromRetrieval :
                              showInvoiceCreation ? () => setShowInvoiceCreation(false) : 
                              selectedUser ? handleBackToUsers :
                              showExistingCustomers ? () => setShowExistingCustomers(false) :
                              () => navigation.goBack()}
                     style={invoiceDirectStyles.backButton}
                 >
                    <MaterialIcons name="arrow-back" size={24} color={COLORS.text.light} />
                </TouchableOpacity>
                <View style={invoiceDirectStyles.headerContent}>
                     <Text style={[invoiceDirectStyles.headerTitle, { fontSize: getScaledSize(20) }]}> 
                         {retrievedInvoice && generatedPDFData ? 'Invoice PDF Ready' :
                          showInvoiceRetrieval ? 'Retrieve Invoice' :
                          showInvoiceCreation ? 'Create Invoice' : 
                          selectedUser ? 'Select Products' : 
                          showExistingCustomers ? 'Existing Customers' : 'Direct Invoice'}
                     </Text>
                     <Text style={[invoiceDirectStyles.headerSubtitle, { fontSize: getScaledSize(14) }]}> 
                         {retrievedInvoice && generatedPDFData ? 'Share or cancel to continue' :
                          showInvoiceRetrieval ? 'Enter invoice number to retrieve' :
                          showInvoiceCreation ? `Invoice for ${selectedUser?.username || `Customer ${selectedUser?.customer_id}`}` :
                          selectedUser 
                             ? `Select products for ${selectedUser?.username || `Customer ${selectedUser?.customer_id}`}`
                             : showExistingCustomers ? 'Select from registered customers' : 'Choose invoice type'
                         }
                     </Text>
                </View>
                 {!selectedUser && !showInvoiceRetrieval && !(retrievedInvoice && generatedPDFData) && !showExistingCustomers && (
                    <TouchableOpacity 
                        onPress={() => setShowInvoiceRetrieval(true)}
                        style={invoiceDirectStyles.createInvoiceButton}
                    >
                        <MaterialIcons name="search" size={20} color={COLORS.text.light} />
                    </TouchableOpacity>
                )}
                 {selectedUser && !showInvoiceCreation && (
                     <View style={{ flexDirection: 'row', gap: 10 }}>
                         <TouchableOpacity 
                             onPress={() => setShowSearchModal(true)}
                             style={invoiceDirectStyles.createInvoiceButton}
                         >
                             <MaterialIcons name="add" size={20} color={COLORS.text.light} />
                         </TouchableOpacity>
                         {selectedProducts.length > 0 && (
                             <TouchableOpacity 
                                 onPress={() => setShowInvoiceCreation(true)}
                                 style={invoiceDirectStyles.createInvoiceButton}
                             >
                                 <MaterialIcons name="receipt" size={20} color={COLORS.text.light} />
                             </TouchableOpacity>
                         )}
                     </View>
                 )}
            </View>

            {/* Content */}
            <View style={invoiceDirectStyles.container}>
                {retrievedInvoice && generatedPDFData ? (
                    // PDF Ready View (after invoice creation)
                    <View style={invoiceDirectStyles.content}>
                        <View style={invoiceDirectStyles.card}>
                            <Text style={[invoiceDirectStyles.title, { fontSize: getScaledSize(24) }]}>Invoice PDF Generated</Text>
                            
                            {/* Invoice Info */}
                            <View style={invoiceDirectStyles.invoiceInfoContainer}>
                                <Text style={[invoiceDirectStyles.invoiceInfoText, { fontSize: getScaledSize(15) }]}> 
                                    <Text style={[invoiceDirectStyles.invoiceInfoLabel, { fontSize: getScaledSize(15) }]}>Invoice Number: </Text>
                                    {retrievedInvoice.invoice?.invoice_number || retrievedInvoice.invoice_info?.invoice_number || retrievedInvoice.invoice_number || 'N/A'}
                                </Text>
                                <Text style={[invoiceDirectStyles.invoiceInfoText, { fontSize: getScaledSize(15) }]}> 
                                    <Text style={[invoiceDirectStyles.invoiceInfoLabel, { fontSize: getScaledSize(15) }]}>Amount: </Text>
                                    Rs {retrievedInvoice.invoice?.invoice_amount || retrievedInvoice.invoice_info?.invoice_amount || retrievedInvoice.invoice_amount || '0'}
                                </Text>
                                <Text style={[invoiceDirectStyles.invoiceInfoText, { fontSize: getScaledSize(15) }]}> 
                                    <Text style={[invoiceDirectStyles.invoiceInfoLabel, { fontSize: getScaledSize(15) }]}>Total Items: </Text>
                                    {retrievedInvoice.items?.length || retrievedInvoice.products?.length || retrievedInvoice.invoice_info?.total_items || 'N/A'}
                                </Text>
                                <Text style={[invoiceDirectStyles.invoiceInfoText, { fontSize: getScaledSize(15) }]}> 
                                    <Text style={[invoiceDirectStyles.invoiceInfoLabel, { fontSize: getScaledSize(15) }]}>Created: </Text>
                                    {retrievedInvoice.invoice?.created_at 
                                        ? new Date(retrievedInvoice.invoice.created_at * 1000).toLocaleDateString()
                                        : retrievedInvoice.invoice_info?.created_at
                                        ? new Date(retrievedInvoice.invoice_info.created_at * 1000).toLocaleDateString()
                                        : retrievedInvoice.created_at
                                        ? new Date(retrievedInvoice.created_at * 1000).toLocaleDateString()
                                        : 'N/A'
                                    }
                                </Text>
                            </View>

                            {/* Action Buttons */}
                            <View style={invoiceDirectStyles.pdfActionButtons}>
                                <TouchableOpacity
                                    style={[invoiceDirectStyles.shareButton, isSharingPDF && invoiceDirectStyles.shareButtonDisabled]}
                                    onPress={downloadPDFHandler}
                                    disabled={isSharingPDF}
                                    activeOpacity={0.8}
                                >
                                    {isSharingPDF ? (
                                        <ActivityIndicator color={COLORS.text.light} size="small" />
                                    ) : (
                                        <MaterialIcons name="file-download" size={24} color={COLORS.text.light} />
                                    )}
                                    <Text style={[invoiceDirectStyles.shareButtonText, { fontSize: getScaledSize(16) }]}> 
                                        {isSharingPDF ? 'Downloading...' : 'Download PDF'}
                                    </Text>
                                </TouchableOpacity>

                                <TouchableOpacity
                                    style={[invoiceDirectStyles.shareButton, isSharingPDF && invoiceDirectStyles.shareButtonDisabled]}
                                    onPress={sharePDFHandler}
                                    disabled={isSharingPDF}
                                    activeOpacity={0.8}
                                >
                                    {isSharingPDF ? (
                                        <ActivityIndicator color={COLORS.text.light} size="small" />
                                    ) : (
                                        <MaterialIcons name="ios-share" size={24} color={COLORS.text.light} />
                                    )}
                                    <Text style={[invoiceDirectStyles.shareButtonText, { fontSize: getScaledSize(16) }]}> 
                                        {isSharingPDF ? 'Sharing...' : 'Share Invoice'}
                                    </Text>
                                </TouchableOpacity>

                                <TouchableOpacity
                                    style={[invoiceDirectStyles.shareButton, isSharingPDF && invoiceDirectStyles.shareButtonDisabled]}
                                    onPress={printPOSPDFHandler}
                                    disabled={isSharingPDF}
                                    activeOpacity={0.8}
                                >
                                    {isSharingPDF ? (
                                        <ActivityIndicator color={COLORS.text.light} size="small" />
                                    ) : (
                                        <MaterialIcons name="print" size={24} color={COLORS.text.light} />
                                    )}
                                    <Text style={[invoiceDirectStyles.shareButtonText, { fontSize: getScaledSize(16) }]}> 
                                        {isSharingPDF ? 'Printing...' : 'Print Receipt'}
                                    </Text>
                                </TouchableOpacity>

                                <TouchableOpacity
                                    style={invoiceDirectStyles.cancelButton}
                                    onPress={cancelPDFHandler}
                                    activeOpacity={0.8}
                                >
                                    <MaterialIcons name="arrow-back" size={24} color={COLORS.text.light} />
                                    <Text style={[invoiceDirectStyles.cancelButtonText, { fontSize: getScaledSize(16) }]}>Back to Menu</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </View>
                ) : showInvoiceRetrieval ? (
                    // Invoice Retrieval View
                    <View style={invoiceDirectStyles.content}>
                        <View style={invoiceDirectStyles.card}>
                            <Text style={[invoiceDirectStyles.title, { fontSize: getScaledSize(24) }]}>Retrieve Invoice</Text>
                            
                            {/* Invoice Number Input */}
                            <View style={invoiceDirectStyles.inputContainer}>
                                <Text style={[invoiceDirectStyles.inputLabel, { fontSize: getScaledSize(16) }]}>Invoice Number</Text>
                                <TextInput
                                    style={invoiceDirectStyles.textInput}
                                    placeholder="Enter invoice number..."
                                    value={searchInvoiceNumber}
                                    onChangeText={setSearchInvoiceNumber}
                                    placeholderTextColor={COLORS.text.secondary}
                                />
                            </View>

                            {/* Generate Button */}
                            <TouchableOpacity
                                style={[invoiceDirectStyles.createButton, (isGeneratingInvoice || isGeneratingPDF) && invoiceDirectStyles.createButtonDisabled]}
                                onPress={generateInvoiceHandler}
                                disabled={isGeneratingInvoice || isGeneratingPDF}
                            >
                                {(isGeneratingInvoice || isGeneratingPDF) ? (
                                    <ActivityIndicator color={COLORS.text.light} size="small" />
                                ) : (
                                    <MaterialIcons name="picture-as-pdf" size={20} color={COLORS.text.light} />
                                )}
                                <Text style={[invoiceDirectStyles.createButtonText, { fontSize: getScaledSize(16) }]}>                                    {isGeneratingInvoice ? 'Retrieving Invoice...' : 
                                     isGeneratingPDF ? 'Generating PDF...' : 'Generate Invoice PDF'}
                                </Text>
                            </TouchableOpacity>

                            {/* Retrieved Invoice Display */}
                            {retrievedInvoice && (
                                <View style={invoiceDirectStyles.retrievedInvoiceContainer}>
                                    <Text style={[invoiceDirectStyles.sectionTitle, { fontSize: getScaledSize(18) }]}>Invoice Details</Text>
                                    
                                    {/* Invoice Info */}
                                    <View style={invoiceDirectStyles.invoiceInfoContainer}>
                                        <Text style={[invoiceDirectStyles.invoiceInfoText, { fontSize: getScaledSize(15) }]}>
                                            <Text style={[invoiceDirectStyles.invoiceInfoLabel, { fontSize: getScaledSize(15) }]}>Invoice Number: </Text>
                                            {retrievedInvoice.invoice_info.invoice_number}
                                        </Text>
                                        <Text style={[invoiceDirectStyles.invoiceInfoText, { fontSize: getScaledSize(15) }]}>
                                            <Text style={[invoiceDirectStyles.invoiceInfoLabel, { fontSize: getScaledSize(15) }]}>Amount: </Text>
                                            Rs {retrievedInvoice.invoice_info.invoice_amount}
                                        </Text>
                                        <Text style={[invoiceDirectStyles.invoiceInfoText, { fontSize: getScaledSize(15) }]}>
                                            <Text style={[invoiceDirectStyles.invoiceInfoLabel, { fontSize: getScaledSize(15) }]}>Total Items: </Text>
                                            {retrievedInvoice.invoice_info.total_items}
                                        </Text>
                                        <Text style={[invoiceDirectStyles.invoiceInfoText, { fontSize: getScaledSize(15) }]}>
                                            <Text style={[invoiceDirectStyles.invoiceInfoLabel, { fontSize: getScaledSize(15) }]}>Created: </Text>
                                            {new Date(retrievedInvoice.invoice_info.created_at).toLocaleDateString()}
                                        </Text>
                                    </View>

                                    {/* Products List */}
                                    <View style={invoiceDirectStyles.productsContainer}>
                                        <Text style={[invoiceDirectStyles.sectionTitle, { fontSize: getScaledSize(18) }]}>Products ({retrievedInvoice.items?.length || retrievedInvoice.products?.length || 0})</Text>
                                        <FlatList
                                            data={retrievedInvoice.items || retrievedInvoice.products || []}
                                            renderItem={({ item }) => (
                                                <View style={invoiceDirectStyles.retrievedProductItem}>
                                                    <Text style={[invoiceDirectStyles.retrievedProductName, { fontSize: getScaledSize(14) }]}>{item.name}</Text>
                                                    <Text style={[invoiceDirectStyles.retrievedProductDetails, { fontSize: getScaledSize(12) }]}> 
                                                        Qty: {item.quantity} × Rs {item.price} = Rs {item.item_total || (item.quantity * item.price)}
                                                    </Text>
                                                    {item.approved_qty !== item.quantity && (
                                                        <Text style={[invoiceDirectStyles.retrievedProductApproved, { fontSize: getScaledSize(12) }]}> 
                                                            Approved: {item.approved_qty} × Rs {item.approved_price} = Rs {item.approved_item_total || (item.approved_qty * item.approved_price)}
                                                        </Text>
                                                    )}
                                                </View>
                                            )}
                                            keyExtractor={(item, index) => index.toString()}
                                            showsVerticalScrollIndicator={false}
                                            style={invoiceDirectStyles.retrievedProductsList}
                                        />
                                    </View>

                                    {/* Share and Download PDF Buttons */}
                                    {generatedPDFData && (
                                        <View style={invoiceDirectStyles.pdfActionButtons}>
                                            <TouchableOpacity
                                                style={[invoiceDirectStyles.shareButton, isSharingPDF && invoiceDirectStyles.shareButtonDisabled]}
                                                onPress={downloadPDFHandler}
                                                disabled={isSharingPDF}
                                                activeOpacity={0.8}
                                            >
                                                {isSharingPDF ? (
                                                    <ActivityIndicator color={COLORS.text.light} size="small" />
                                                ) : (
                                                    <MaterialIcons name="file-download" size={24} color={COLORS.text.light} />
                                                )}
                                                <Text style={[invoiceDirectStyles.shareButtonText, { fontSize: getScaledSize(16) }]}> 
                                                    {isSharingPDF ? 'Downloading...' : 'Download PDF'}
                                                </Text>
                                            </TouchableOpacity>

                                            <TouchableOpacity
                                                style={[invoiceDirectStyles.shareButton, isSharingPDF && invoiceDirectStyles.shareButtonDisabled]}
                                                onPress={sharePDFHandler}
                                                disabled={isSharingPDF}
                                                activeOpacity={0.8}
                                            >
                                                {isSharingPDF ? (
                                                    <ActivityIndicator color={COLORS.text.light} size="small" />
                                                ) : (
                                                    <MaterialIcons name="ios-share" size={24} color={COLORS.text.light} />
                                                )}
                                                <Text style={[invoiceDirectStyles.shareButtonText, { fontSize: getScaledSize(16) }]}> 
                                                    {isSharingPDF ? 'Sharing...' : 'Share Invoice'}
                                                </Text>
                                            </TouchableOpacity>
                                        </View>
                                    )}
                                </View>
                            )}
                        </View>
                    </View>
                 ) : showExistingCustomers ? (
                    // Existing Customers View
                    <View style={invoiceDirectStyles.content}>
                        <View style={invoiceDirectStyles.card}>
                            <Text style={[invoiceDirectStyles.title, { fontSize: getScaledSize(24) }]}>Select a Customer</Text>
                            <Animated.View style={[invoiceDirectStyles.searchContainer, { opacity: fadeAnim }]}> 
                                <MaterialIcons name="search" size={22} color={COLORS.primary} style={{ marginRight: 8 }} />
                                <TextInput
                                    style={invoiceDirectStyles.searchInput}
                                    placeholder="Search customers by name..."
                                    value={searchQuery}
                                    onChangeText={handleSearch}
                                    placeholderTextColor={COLORS.text.secondary}
                                />
                            </Animated.View>
                            
                            {loading ? (
                                <LoadingComponent text="Loading customers..." styles={invoiceDirectStyles} />
                            ) : error ? (
                                <ErrorComponent error={error} onRetry={loadAllUsers} styles={invoiceDirectStyles} />
                            ) : filteredUsers.length === 0 ? (
                                <NoDataComponent 
                                    message={searchQuery ? 'No customers found matching your search.' : 'No customers found.'} 
                                    styles={invoiceDirectStyles} 
                                />
                            ) : (
                                <FlatList
                                    data={filteredUsers}
                                    keyExtractor={(item) => item.customer_id.toString()}
                                    renderItem={({ item }) => (
                                        <UserCard
                                            item={item}
                                            onPress={() => handleUserSelect(item)}
                                            styles={invoiceDirectStyles}
                                            getScaledSize={getScaledSize}
                                        />
                                    )}
                                    showsVerticalScrollIndicator={false}
                                    style={invoiceDirectStyles.flatListStyle}
                                />
                            )}
                        </View>
                    </View>
                ) : showInvoiceCreation ? (
                     // Invoice Creation View - Scrollable
                     <View style={invoiceDirectStyles.container}>
                         <ScrollView 
                             style={invoiceDirectStyles.scrollView}
                             contentContainerStyle={invoiceDirectStyles.scrollContent}
                             showsVerticalScrollIndicator={true}
                         >
                             <View style={invoiceDirectStyles.content}>
                                 <View style={invoiceDirectStyles.card}>
                                     <Text style={[invoiceDirectStyles.title, { fontSize: getScaledSize(24) }]}>Create Direct Invoice</Text>
                                     
                                     {/* Invoice Number Display */}
                                     <InvoiceNumberDisplay
                                         invoiceNumber={invoiceNumber}
                                         styles={invoiceDirectStyles}
                                         getScaledSize={getScaledSize}
                                     />

                                     {/* Add More Products Button */}
                                     <TouchableOpacity 
                                         style={invoiceDirectStyles.addProductButton}
                                         onPress={() => setShowSearchModal(true)}
                                     >
                                         <MaterialIcons name="add" size={24} color={COLORS.text.light} />
                                         <Text style={[invoiceDirectStyles.addProductButtonText, { fontSize: getScaledSize(16) }]}>Add More Products</Text>
                                     </TouchableOpacity>

                                     {/* Selected Products */}
                                     <View style={invoiceDirectStyles.selectedProductsContainer}>
                                         <Text style={[invoiceDirectStyles.sectionTitle, { fontSize: getScaledSize(18) }]}>Selected Products ({selectedProducts.length})</Text>
                                         {selectedProducts.map((item, index) => (
                                             <SelectedProductItem
                                                 key={item.product_id.toString()}
                                                 item={item}
                                                 onQuantityChange={updateProductQuantityHandler}
                                                 styles={invoiceDirectStyles}
                                                 getScaledSize={getScaledSize}
                                             />
                                         ))}
                                     </View>

                                     {/* Collections Section */}
                                     <View style={invoiceDirectStyles.selectedProductsContainer}>
                                        <Text style={[invoiceDirectStyles.sectionTitle, { fontSize: getScaledSize(18) }]}>Payment Collection</Text>
                                        
                                        {/* Invoice Amount */}
                                        <View style={[invoiceDirectStyles.inputContainer, { marginBottom: 10 }]}> 
                                            <Text style={[invoiceDirectStyles.inputLabel, { fontSize: getScaledSize(14) }]}>Invoice Amount</Text>
                                            <TextInput
                                                style={[invoiceDirectStyles.textInput, { fontSize: getScaledSize(16), backgroundColor: '#f0f0f0' }]}
                                                value={`₹${collections.invoiceAmount.toFixed(2)}`}
                                                editable={false}
                                            />
                                        </View>
                                        
                                        {/* Cash Tendered */}
                                        <View style={[invoiceDirectStyles.inputContainer, { marginBottom: 10 }]}> 
                                            <Text style={[invoiceDirectStyles.inputLabel, { fontSize: getScaledSize(14) }]}>Cash Tendered</Text>
                                            <TextInput
                                                style={[invoiceDirectStyles.textInput, { fontSize: getScaledSize(16) }]}
                                                placeholder="Enter cash tendered amount"
                                                value={collections.tendered === '' ? '' : collections.tendered.toString()}
                                                onChangeText={(value) => handleCollectionsChange('tendered', value)}
                                                keyboardType="numeric"
                                            />
                                        </View>
                                        
                                        {/* Payment Methods */}
                                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 }}>
                                            {/* UPI Payment */}
                                            <View style={{ flex: 0.48 }}>
                                                <Text style={[invoiceDirectStyles.inputLabel, { fontSize: getScaledSize(14) }]}>UPI</Text>
                                                <TextInput
                                                    style={[invoiceDirectStyles.textInput, { fontSize: getScaledSize(16) }]}
                                                    placeholder="UPI amount"
                                                    value={collections.upi === '' ? '' : collections.upi.toString()}
                                                    onChangeText={(value) => handleCollectionsChange('upi', value)}
                                                    keyboardType="numeric"
                                                />
                                                {collections.upi > 0 && (
                                                    <View style={{ marginTop: 5 }}>
                                                        <Text style={[invoiceDirectStyles.inputLabel, { fontSize: getScaledSize(12) }]}>Select UPI Account</Text>
                                                        <View style={{ borderWidth: 1, borderColor: COLORS.border, borderRadius: 5 }}>
                                                            <Picker
                                                                selectedValue={selectedUpiAccount}
                                                                onValueChange={(value) => setSelectedUpiAccount(value)}
                                                                style={{ height: 40 }}
                                                            >
                                                                <Picker.Item label="Select Account" value="" />
                                                                {bankAccounts
                                                                    .filter(account => {
                                                                        const bankDetails = parseBankAccountData(account.bank_accounts);
                                                                        return bankDetails && bankDetails.in_use === 'Yes';
                                                                    })
                                                                    .map((account) => {
                                                                        const bankDetails = parseBankAccountData(account.bank_accounts);
                                                                        return (
                                                                            <Picker.Item 
                                                                                key={account.id} 
                                                                                label={`${bankDetails.account_holder_name} (${bankDetails.account_number?.slice(-4)})`} 
                                                                                value={account.id} 
                                                                            />
                                                                        );
                                                                    })}
                                                            </Picker>
                                                        </View>
                                                    </View>
                                                )}
                                            </View>
                                            
                                            {/* Cheque Payment */}
                                            <View style={{ flex: 0.48 }}>
                                                <Text style={[invoiceDirectStyles.inputLabel, { fontSize: getScaledSize(14) }]}>Cheque</Text>
                                                <TextInput
                                                    style={[invoiceDirectStyles.textInput, { fontSize: getScaledSize(16) }]}
                                                    placeholder="Cheque amount"
                                                    value={collections.cheque === '' ? '' : collections.cheque.toString()}
                                                    onChangeText={(value) => handleCollectionsChange('cheque', value)}
                                                    keyboardType="numeric"
                                                />
                                                {collections.cheque > 0 && (
                                                    <View style={{ marginTop: 5 }}>
                                                        <Text style={[invoiceDirectStyles.inputLabel, { fontSize: getScaledSize(12) }]}>Select Cheque Account</Text>
                                                        <View style={{ borderWidth: 1, borderColor: COLORS.border, borderRadius: 5 }}>
                                                            <Picker
                                                                selectedValue={selectedChequeAccount}
                                                                onValueChange={(value) => setSelectedChequeAccount(value)}
                                                                style={{ height: 40 }}
                                                            >
                                                                <Picker.Item label="Select Account" value="" />
                                                                {bankAccounts
                                                                    .filter(account => {
                                                                        const bankDetails = parseBankAccountData(account.bank_accounts);
                                                                        return bankDetails && bankDetails.in_use === 'Yes';
                                                                    })
                                                                    .map((account) => {
                                                                        const bankDetails = parseBankAccountData(account.bank_accounts);
                                                                        return (
                                                                            <Picker.Item 
                                                                                key={account.id} 
                                                                                label={`${bankDetails.account_holder_name} (${bankDetails.account_number?.slice(-4)})`} 
                                                                                value={account.id} 
                                                                            />
                                                                        );
                                                                    })}
                                                            </Picker>
                                                        </View>
                                                    </View>
                                                )}
                                            </View>
                                        </View>
                                        
                                        {/* Cash (Auto-calculated) */}
                                        <View style={[invoiceDirectStyles.inputContainer, { marginBottom: 10 }]}> 
                                            <Text style={[invoiceDirectStyles.inputLabel, { fontSize: getScaledSize(14) }]}>Cash (Auto-calculated)</Text>
                                            <TextInput
                                                style={[invoiceDirectStyles.textInput, { fontSize: getScaledSize(16), backgroundColor: '#f0f0f0' }]}
                                                value={`₹${collections.cash.toFixed(2)}`}
                                                editable={false}
                                            />
                                        </View>
                                        
                                        {/* Balance */}
                                        <View style={[invoiceDirectStyles.inputContainer, { marginBottom: 10 }]}> 
                                            <Text style={[invoiceDirectStyles.inputLabel, { fontSize: getScaledSize(14) }]}>Balance</Text>
                                            <TextInput
                                                style={[invoiceDirectStyles.textInput, { 
                                                    fontSize: getScaledSize(16), 
                                                    backgroundColor: collections.balance < 0 ? '#ffebee' : '#f0f0f0',
                                                    color: collections.balance < 0 ? '#f44336' : '#000'
                                                }]}
                                                value={`₹${collections.balance.toFixed(2)}`}
                                                editable={false}
                                            />
                                        </View>
                                     </View>

                                     {/* GST-Aware Total Amount */}
                                     <GSTAwareTotalDisplay
                                         gstTotals={gstTotals}
                                         clientState={clientState}
                                         customerState={customerState}
                                         styles={invoiceDirectStyles}
                                         getScaledSize={getScaledSize}
                                     />
                                 </View>
                             </View>
                         </ScrollView>
                         
                         {/* Fixed Create Invoice Button */}
                         <View style={invoiceDirectStyles.fixedButtonContainer}>
                             <CreateButton
                                 onPress={createDirectInvoiceHandler}
                                 isLoading={isCreatingInvoice}
                                 styles={invoiceDirectStyles}
                                 getScaledSize={getScaledSize}
                             />
                         </View>
                     </View>
                 ) : (
                     // Customer Type Selection View
                     <View style={invoiceDirectStyles.content}>
                         <View style={invoiceDirectStyles.card}>
                             <Text style={[invoiceDirectStyles.title, { fontSize: getScaledSize(24) }]}>Invoice Options</Text>
                             <Text style={[invoiceDirectStyles.subtitle, { fontSize: getScaledSize(16) }]}>Choose how you want to create the invoice</Text>
                             
                             {/* Existing Customers Option */}
                             <TouchableOpacity 
                                 style={invoiceDirectStyles.optionButton}
                                 onPress={() => setShowExistingCustomers(true)}
                                 activeOpacity={0.8}
                             >
                                 <View style={invoiceDirectStyles.optionIconContainer}>
                                     <MaterialIcons name="people" size={24} color={COLORS.primary} />
                                 </View>
                                 <View style={invoiceDirectStyles.optionContent}>
                                     <Text style={[invoiceDirectStyles.optionTitle, { fontSize: getScaledSize(16) }]}>Existing Customers</Text>
                                     <Text style={[invoiceDirectStyles.optionDescription, { fontSize: getScaledSize(13) }]}>Select from registered customers</Text>
                                 </View>
                                 <MaterialIcons name="arrow-forward-ios" size={16} color={COLORS.text.secondary} />
                             </TouchableOpacity>
                             
                             {/* Walk-In Customer Option */}
                             {/* Removed Walk-In Customer option */}

                         </View>
                     </View>
                 )}
                </View>
            
            {/* Toast Component */}
            <Toast />
            
            {/* Search Product Modal */}
            <SearchProductModal_1
                isVisible={showSearchModal}
                onClose={() => setShowSearchModal(false)}
                onAddProduct={handleAddProduct}
                currentCustomerId={selectedUser?.customer_id}
                allowProductEdit={true}
            />
        </SafeAreaView>
    );
};


export default InvoiceDirect;
