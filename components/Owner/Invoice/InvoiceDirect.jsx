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
    updateProductQuantity,
    fetchClientStatus
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
    CreateButton,
    styles
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

    // Fade-in animation for search bar
    useEffect(() => {
        Animated.timing(fadeAnim, {
            toValue: 1,
            duration: 500,
            useNativeDriver: true,
        }).start();
    }, []);

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
            } else {
                console.warn('Failed to fetch customer data:', result.error);
                setCustomerData(null);
            }
        } catch (error) {
            console.error('Error fetching customer data:', error);
            setCustomerData(null);
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

        try {
            setIsCreatingInvoice(true);
            
            // Calculate total amount
            const totalAmount = calculateTotalAmount(selectedProducts);

            const invoiceData = {
                invoiceNumber: invoiceNumber.trim(),
                products: selectedProducts,
                totalAmount: totalAmount,
                customerName: selectedUser?.username || `Customer ${selectedUser?.customer_id}`,
                customerPhone: customerData?.phone || 'N/A',
                customerId: selectedUser?.customer_id || null  // Add missing customer_id
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
                         const pdfResult = await generateInvoicePDF(retrieveResult.data, customerData);
                        
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
                const pdfResult = await generateInvoicePDF(result.data, customerDataForPDF);
                
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
                const binaryString = atob(generatedPDFData.pdfBytes);
                uint8Array = new Uint8Array(binaryString.length);
                for (let i = 0; i < binaryString.length; i++) {
                    uint8Array[i] = binaryString.charCodeAt(i);
                }
                console.log('PDF converted to Uint8Array, size:', uint8Array.length);
            } catch (conversionError) {
                console.error('Error converting PDF data:', conversionError);
                throw new Error('Failed to process PDF data');
            }
            
            const filePath = await savePDFToDownloads(uint8Array, generatedPDFData.fileName);
            
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
            
            // Print the invoice directly
            const result = await printInvoicePOSPDF(retrievedInvoice, customerData, deviceId, RNBluetoothClassic);
            
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
                styles={styles}
                getScaledSize={getScaledSize}
            />
        );
    };

    useEffect(() => {
        loadAllUsers();
        loadGSTMethod();
    }, [loadAllUsers, loadGSTMethod]);

    return (
        <SafeAreaView style={styles.safeArea}>
            <StatusBar backgroundColor={COLORS.primary} barStyle="light-content" />
            
            {/* Header */}
            <View style={styles.header}>
                 <TouchableOpacity 
                     onPress={retrievedInvoice && generatedPDFData ? cancelPDFHandler :
                              showInvoiceRetrieval ? handleBackFromRetrieval :
                              showInvoiceCreation ? () => setShowInvoiceCreation(false) : 
                              selectedUser ? handleBackToUsers :
                              showExistingCustomers ? () => setShowExistingCustomers(false) :
                              () => navigation.goBack()}
                     style={styles.backButton}
                 >
                    <MaterialIcons name="arrow-back" size={24} color={COLORS.text.light} />
                </TouchableOpacity>
                <View style={styles.headerContent}>
                     <Text style={[styles.headerTitle, { fontSize: getScaledSize(20) }]}> 
                         {retrievedInvoice && generatedPDFData ? 'Invoice PDF Ready' :
                          showInvoiceRetrieval ? 'Retrieve Invoice' :
                          showInvoiceCreation ? 'Create Invoice' : 
                          selectedUser ? 'Select Products' : 
                          showExistingCustomers ? 'Existing Customers' : 'Direct Invoice'}
                     </Text>
                     <Text style={[styles.headerSubtitle, { fontSize: getScaledSize(14) }]}> 
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
                        style={styles.createInvoiceButton}
                    >
                        <MaterialIcons name="search" size={20} color={COLORS.text.light} />
                    </TouchableOpacity>
                )}
                 {selectedUser && !showInvoiceCreation && (
                     <View style={{ flexDirection: 'row', gap: 10 }}>
                         <TouchableOpacity 
                             onPress={() => setShowSearchModal(true)}
                             style={styles.createInvoiceButton}
                         >
                             <MaterialIcons name="add" size={20} color={COLORS.text.light} />
                         </TouchableOpacity>
                         {selectedProducts.length > 0 && (
                             <TouchableOpacity 
                                 onPress={() => setShowInvoiceCreation(true)}
                                 style={styles.createInvoiceButton}
                             >
                                 <MaterialIcons name="receipt" size={20} color={COLORS.text.light} />
                             </TouchableOpacity>
                         )}
                     </View>
                 )}
            </View>

            {/* Content */}
            <View style={styles.container}>
                {retrievedInvoice && generatedPDFData ? (
                    // PDF Ready View (after invoice creation)
                    <View style={styles.content}>
                        <View style={styles.card}>
                            <Text style={[styles.title, { fontSize: getScaledSize(24) }]}>Invoice PDF Generated</Text>
                            
                            {/* Invoice Info */}
                            <View style={styles.invoiceInfoContainer}>
                                <Text style={[styles.invoiceInfoText, { fontSize: getScaledSize(15) }]}> 
                                    <Text style={[styles.invoiceInfoLabel, { fontSize: getScaledSize(15) }]}>Invoice Number: </Text>
                                    {retrievedInvoice.invoice_info.invoice_number}
                                </Text>
                                <Text style={[styles.invoiceInfoText, { fontSize: getScaledSize(15) }]}> 
                                    <Text style={[styles.invoiceInfoLabel, { fontSize: getScaledSize(15) }]}>Amount: </Text>
                                    Rs {retrievedInvoice.invoice_info.invoice_amount}
                                </Text>
                                <Text style={[styles.invoiceInfoText, { fontSize: getScaledSize(15) }]}> 
                                    <Text style={[styles.invoiceInfoLabel, { fontSize: getScaledSize(15) }]}>Total Items: </Text>
                                    {retrievedInvoice.invoice_info.total_items}
                                </Text>
                                <Text style={[styles.invoiceInfoText, { fontSize: getScaledSize(15) }]}> 
                                    <Text style={[styles.invoiceInfoLabel, { fontSize: getScaledSize(15) }]}>Created: </Text>
                                    {new Date(retrievedInvoice.invoice_info.created_at).toLocaleDateString()}
                                </Text>
                            </View>

                            {/* Action Buttons */}
                            <View style={styles.pdfActionButtons}>
                                <TouchableOpacity
                                    style={[styles.shareButton, isSharingPDF && styles.shareButtonDisabled]}
                                    onPress={downloadPDFHandler}
                                    disabled={isSharingPDF}
                                    activeOpacity={0.8}
                                >
                                    {isSharingPDF ? (
                                        <ActivityIndicator color={COLORS.text.light} size="small" />
                                    ) : (
                                        <MaterialIcons name="file-download" size={24} color={COLORS.text.light} />
                                    )}
                                    <Text style={[styles.shareButtonText, { fontSize: getScaledSize(16) }]}> 
                                        {isSharingPDF ? 'Downloading...' : 'Download PDF'}
                                    </Text>
                                </TouchableOpacity>

                                <TouchableOpacity
                                    style={[styles.shareButton, isSharingPDF && styles.shareButtonDisabled]}
                                    onPress={sharePDFHandler}
                                    disabled={isSharingPDF}
                                    activeOpacity={0.8}
                                >
                                    {isSharingPDF ? (
                                        <ActivityIndicator color={COLORS.text.light} size="small" />
                                    ) : (
                                        <MaterialIcons name="ios-share" size={24} color={COLORS.text.light} />
                                    )}
                                    <Text style={[styles.shareButtonText, { fontSize: getScaledSize(16) }]}> 
                                        {isSharingPDF ? 'Sharing...' : 'Share Invoice'}
                                    </Text>
                                </TouchableOpacity>

                                <TouchableOpacity
                                    style={[styles.shareButton, isSharingPDF && styles.shareButtonDisabled]}
                                    onPress={printPOSPDFHandler}
                                    disabled={isSharingPDF}
                                    activeOpacity={0.8}
                                >
                                    {isSharingPDF ? (
                                        <ActivityIndicator color={COLORS.text.light} size="small" />
                                    ) : (
                                        <MaterialIcons name="print" size={24} color={COLORS.text.light} />
                                    )}
                                    <Text style={[styles.shareButtonText, { fontSize: getScaledSize(16) }]}> 
                                        {isSharingPDF ? 'Printing...' : 'Print Receipt'}
                                    </Text>
                                </TouchableOpacity>

                                <TouchableOpacity
                                    style={styles.cancelButton}
                                    onPress={cancelPDFHandler}
                                    activeOpacity={0.8}
                                >
                                    <MaterialIcons name="arrow-back" size={24} color={COLORS.text.light} />
                                    <Text style={[styles.cancelButtonText, { fontSize: getScaledSize(16) }]}>Back to Menu</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </View>
                ) : showInvoiceRetrieval ? (
                    // Invoice Retrieval View
                    <View style={styles.content}>
                        <View style={styles.card}>
                            <Text style={[styles.title, { fontSize: getScaledSize(24) }]}>Retrieve Invoice</Text>
                            
                            {/* Invoice Number Input */}
                            <View style={styles.inputContainer}>
                                <Text style={[styles.inputLabel, { fontSize: getScaledSize(16) }]}>Invoice Number</Text>
                                <TextInput
                                    style={styles.textInput}
                                    placeholder="Enter invoice number..."
                                    value={searchInvoiceNumber}
                                    onChangeText={setSearchInvoiceNumber}
                                    placeholderTextColor={COLORS.text.secondary}
                                />
                            </View>

                            {/* Generate Button */}
                            <TouchableOpacity
                                style={[styles.createButton, (isGeneratingInvoice || isGeneratingPDF) && styles.createButtonDisabled]}
                                onPress={generateInvoiceHandler}
                                disabled={isGeneratingInvoice || isGeneratingPDF}
                            >
                                {(isGeneratingInvoice || isGeneratingPDF) ? (
                                    <ActivityIndicator color={COLORS.text.light} size="small" />
                                ) : (
                                    <MaterialIcons name="picture-as-pdf" size={20} color={COLORS.text.light} />
                                )}
                                <Text style={[styles.createButtonText, { fontSize: getScaledSize(16) }]}>                                    {isGeneratingInvoice ? 'Retrieving Invoice...' : 
                                     isGeneratingPDF ? 'Generating PDF...' : 'Generate Invoice PDF'}
                                </Text>
                            </TouchableOpacity>

                            {/* Retrieved Invoice Display */}
                            {retrievedInvoice && (
                                <View style={styles.retrievedInvoiceContainer}>
                                    <Text style={[styles.sectionTitle, { fontSize: getScaledSize(18) }]}>Invoice Details</Text>
                                    
                                    {/* Invoice Info */}
                                    <View style={styles.invoiceInfoContainer}>
                                        <Text style={[styles.invoiceInfoText, { fontSize: getScaledSize(15) }]}>                                            <Text style={[styles.invoiceInfoLabel, { fontSize: getScaledSize(15) }]}>Invoice Number: </Text>
                                            {retrievedInvoice.invoice_info.invoice_number}
                                        </Text>
                                        <Text style={[styles.invoiceInfoText, { fontSize: getScaledSize(15) }]}>                                            <Text style={[styles.invoiceInfoLabel, { fontSize: getScaledSize(15) }]}>Amount: </Text>
                                            Rs {retrievedInvoice.invoice_info.invoice_amount}
                                        </Text>
                                        <Text style={[styles.invoiceInfoText, { fontSize: getScaledSize(15) }]}>                                            <Text style={[styles.invoiceInfoLabel, { fontSize: getScaledSize(15) }]}>Total Items: </Text>
                                            {retrievedInvoice.invoice_info.total_items}
                                        </Text>
                                        <Text style={[styles.invoiceInfoText, { fontSize: getScaledSize(15) }]}>                                            <Text style={[styles.invoiceInfoLabel, { fontSize: getScaledSize(15) }]}>Created: </Text>
                                            {new Date(retrievedInvoice.invoice_info.created_at).toLocaleDateString()}
                                        </Text>
                                    </View>

                                    {/* Products List */}
                                    <View style={styles.productsContainer}>
                                        <Text style={[styles.sectionTitle, { fontSize: getScaledSize(18) }]}>Products ({retrievedInvoice.products.length})</Text>
                                        <FlatList
                                            data={retrievedInvoice.products}
                                            renderItem={({ item }) => (
                                                <View style={styles.retrievedProductItem}>
                                                    <Text style={[styles.retrievedProductName, { fontSize: getScaledSize(14) }]}>{item.name}</Text>
                                                    <Text style={[styles.retrievedProductDetails, { fontSize: getScaledSize(12) }]}> 
                                                        Qty: {item.quantity} × Rs {item.price} = Rs {item.item_total}
                                                    </Text>
                                                    {item.approved_qty !== item.quantity && (
                                                        <Text style={[styles.retrievedProductApproved, { fontSize: getScaledSize(12) }]}> 
                                                            Approved: {item.approved_qty} × Rs {item.approved_price} = Rs {item.approved_item_total}
                                                        </Text>
                                                    )}
                                                </View>
                                            )}
                                            keyExtractor={(item, index) => index.toString()}
                                            showsVerticalScrollIndicator={false}
                                            style={styles.retrievedProductsList}
                                        />
                                    </View>

                                    {/* Share and Download PDF Buttons */}
                                    {generatedPDFData && (
                                        <View style={styles.pdfActionButtons}>
                                            <TouchableOpacity
                                                style={[styles.shareButton, isSharingPDF && styles.shareButtonDisabled]}
                                                onPress={downloadPDFHandler}
                                                disabled={isSharingPDF}
                                                activeOpacity={0.8}
                                            >
                                                {isSharingPDF ? (
                                                    <ActivityIndicator color={COLORS.text.light} size="small" />
                                                ) : (
                                                    <MaterialIcons name="file-download" size={24} color={COLORS.text.light} />
                                                )}
                                                <Text style={[styles.shareButtonText, { fontSize: getScaledSize(16) }]}> 
                                                    {isSharingPDF ? 'Downloading...' : 'Download PDF'}
                                                </Text>
                                            </TouchableOpacity>

                                            <TouchableOpacity
                                                style={[styles.shareButton, isSharingPDF && styles.shareButtonDisabled]}
                                                onPress={sharePDFHandler}
                                                disabled={isSharingPDF}
                                                activeOpacity={0.8}
                                            >
                                                {isSharingPDF ? (
                                                    <ActivityIndicator color={COLORS.text.light} size="small" />
                                                ) : (
                                                    <MaterialIcons name="ios-share" size={24} color={COLORS.text.light} />
                                                )}
                                                <Text style={[styles.shareButtonText, { fontSize: getScaledSize(16) }]}> 
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
                    <View style={styles.content}>
                        <View style={styles.card}>
                            <Text style={[styles.title, { fontSize: getScaledSize(24) }]}>Select a Customer</Text>
                            <Animated.View style={[styles.searchContainer, { opacity: fadeAnim }]}> 
                                <MaterialIcons name="search" size={22} color={COLORS.primary} style={{ marginRight: 8 }} />
                                <TextInput
                                    style={styles.searchInput}
                                    placeholder="Search customers by name..."
                                    value={searchQuery}
                                    onChangeText={handleSearch}
                                    placeholderTextColor={COLORS.text.secondary}
                                />
                            </Animated.View>
                            
                            {loading ? (
                                <LoadingComponent text="Loading customers..." styles={styles} />
                            ) : error ? (
                                <ErrorComponent error={error} onRetry={loadAllUsers} styles={styles} />
                            ) : filteredUsers.length === 0 ? (
                                <NoDataComponent 
                                    message={searchQuery ? 'No customers found matching your search.' : 'No customers found.'} 
                                    styles={styles} 
                                />
                            ) : (
                                <FlatList
                                    data={filteredUsers}
                                    keyExtractor={(item) => item.customer_id.toString()}
                                    renderItem={({ item }) => (
                                        <UserCard
                                            item={item}
                                            onPress={() => handleUserSelect(item)}
                                            styles={styles}
                                            getScaledSize={getScaledSize}
                                        />
                                    )}
                                    showsVerticalScrollIndicator={false}
                                    style={styles.flatListStyle}
                                />
                            )}
                        </View>
                    </View>
                ) : showInvoiceCreation ? (
                     // Invoice Creation View - Scrollable
                     <View style={styles.container}>
                         <ScrollView 
                             style={styles.scrollView}
                             contentContainerStyle={styles.scrollContent}
                             showsVerticalScrollIndicator={true}
                         >
                             <View style={styles.content}>
                                 <View style={styles.card}>
                                     <Text style={[styles.title, { fontSize: getScaledSize(24) }]}>Create Direct Invoice</Text>
                                     
                                     {/* Invoice Number Display */}
                                     <InvoiceNumberDisplay
                                         invoiceNumber={invoiceNumber}
                                         styles={styles}
                                         getScaledSize={getScaledSize}
                                     />

                                     {/* Add More Products Button */}
                                     <TouchableOpacity 
                                         style={styles.addProductButton}
                                         onPress={() => setShowSearchModal(true)}
                                     >
                                         <MaterialIcons name="add" size={24} color={COLORS.text.light} />
                                         <Text style={[styles.addProductButtonText, { fontSize: getScaledSize(16) }]}>Add More Products</Text>
                                     </TouchableOpacity>

                                     {/* Selected Products */}
                                     <View style={styles.selectedProductsContainer}>
                                         <Text style={[styles.sectionTitle, { fontSize: getScaledSize(18) }]}>Selected Products ({selectedProducts.length})</Text>
                                         {selectedProducts.map((item, index) => (
                                             <SelectedProductItem
                                                 key={item.product_id.toString()}
                                                 item={item}
                                                 onQuantityChange={updateProductQuantityHandler}
                                                 styles={styles}
                                                 getScaledSize={getScaledSize}
                                             />
                                         ))}
                                     </View>

                                     {/* Total Amount */}
                                     <TotalAmountDisplay
                                         totalAmount={calculateTotalAmount(selectedProducts)}
                                         styles={styles}
                                         getScaledSize={getScaledSize}
                                     />
                                 </View>
                             </View>
                         </ScrollView>
                         
                         {/* Fixed Create Invoice Button */}
                         <View style={styles.fixedButtonContainer}>
                             <CreateButton
                                 onPress={createDirectInvoiceHandler}
                                 isLoading={isCreatingInvoice}
                                 styles={styles}
                                 getScaledSize={getScaledSize}
                             />
                         </View>
                     </View>
                 ) : (
                     // Customer Type Selection View
                     <View style={styles.content}>
                         <View style={styles.card}>
                             <Text style={[styles.title, { fontSize: getScaledSize(24) }]}>Invoice Options</Text>
                             <Text style={[styles.subtitle, { fontSize: getScaledSize(16) }]}>Choose how you want to create the invoice</Text>
                             
                             {/* Existing Customers Option */}
                             <TouchableOpacity 
                                 style={styles.optionButton}
                                 onPress={() => setShowExistingCustomers(true)}
                                 activeOpacity={0.8}
                             >
                                 <View style={styles.optionIconContainer}>
                                     <MaterialIcons name="people" size={24} color={COLORS.primary} />
                                 </View>
                                 <View style={styles.optionContent}>
                                     <Text style={[styles.optionTitle, { fontSize: getScaledSize(16) }]}>Existing Customers</Text>
                                     <Text style={[styles.optionDescription, { fontSize: getScaledSize(13) }]}>Select from registered customers</Text>
                                 </View>
                                 <MaterialIcons name="arrow-forward-ios" size={16} color={COLORS.text.secondary} />
                             </TouchableOpacity>
                             
                             {/* Walk-In Customer Option */}
                             <TouchableOpacity 
                                 style={styles.optionButton}
                                 onPress={() => navigation.navigate('WalkIn')}
                                 activeOpacity={0.8}
                             >
                                 <View style={styles.optionIconContainer}>
                                     <MaterialIcons name="person-add" size={24} color={COLORS.primary} />
                                 </View>
                                 <View style={styles.optionContent}>
                                     <Text style={[styles.optionTitle, { fontSize: getScaledSize(16) }]}>Walk-In Customer</Text>
                                     <Text style={[styles.optionDescription, { fontSize: getScaledSize(13) }]}>Create invoice for new walk-in customer</Text>
                                 </View>
                                 <MaterialIcons name="arrow-forward-ios" size={16} color={COLORS.text.secondary} />
                             </TouchableOpacity>
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
