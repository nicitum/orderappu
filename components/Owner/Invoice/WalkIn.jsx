import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    SafeAreaView,
    StatusBar,
    Alert,
    ActivityIndicator,
    FlatList,
    ScrollView,
    Platform,
    ToastAndroid,
    PermissionsAndroid,
} from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { useNavigation } from '@react-navigation/native';
import RNFS from 'react-native-fs';
import Share from 'react-native-share';
import SearchProductModal_1 from '../searchProductModal_1';
import {
    generateInvoiceNumber,
    createDirectInvoice,
    generateDirectInvoice,
    generateInvoicePDF,
    shareInvoicePDF,
    calculateTotalAmount,
    updateProductQuantity,
    fetchClientStatus
} from './InvoiceDirectHelper';
import {
    COLORS,
    SelectedProductItem,
    LoadingComponent,
    ErrorComponent,
    NoDataComponent,
    InvoiceNumberDisplay,
    TotalAmountDisplay,
    CreateButton,
    styles
} from './InvoiceDirectComponents';
import Toast from 'react-native-toast-message';
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

// Helper function to save PDF to downloads (works on all Android versions)
const savePDFToDownloads = async (pdfBytes, fileName) => {
    try {
        // For Android 10+ (API 29+), we use scoped storage approach
        if (Platform.OS === 'android' && Platform.Version >= 29) {
            // On Android 10+, we can write to Download directory without permissions
            const filePath = `${RNFS.DownloadDirectoryPath}/${fileName}`;
            const base64Data = uint8ToBase64(pdfBytes);
            await RNFS.writeFile(filePath, base64Data, 'base64');
            
            ToastAndroid.show(`PDF saved to Downloads as ${fileName}`, ToastAndroid.LONG);
            return filePath;
        } 
        // For older Android versions, we need explicit permissions
        else if (Platform.OS === 'android') {
            // Request storage permissions
            const granted = await PermissionsAndroid.request(
                PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE,
                {
                    title: "Storage Permission",
                    message: "App needs access to storage to save PDFs",
                    buttonPositive: "OK"
                }
            );
            
            if (granted === PermissionsAndroid.RESULTS.GRANTED) {
                const filePath = `${RNFS.DownloadDirectoryPath}/${fileName}`;
                const base64Data = uint8ToBase64(pdfBytes);
                await RNFS.writeFile(filePath, base64Data, 'base64');
                
                ToastAndroid.show(`PDF saved to Downloads as ${fileName}`, ToastAndroid.LONG);
                return filePath;
            } else {
                Alert.alert("Permission Denied", "Cannot save PDF without storage permission");
                return null;
            }
        } 
        // For iOS
        else {
            const filePath = `${RNFS.DocumentDirectoryPath}/${fileName}`;
            const base64Data = uint8ToBase64(pdfBytes);
            await RNFS.writeFile(filePath, base64Data, 'base64');
            return filePath;
        }
    } catch (error) {
        console.error("Error saving PDF:", error);
        Alert.alert("Error", `Failed to save PDF: ${error.message}`);
        return null;
    }
};

const WalkIn = () => {
    const { getScaledSize } = useFontScale();
    const navigation = useNavigation();
    
    // Customer details state
    const [customerName, setCustomerName] = useState('');
    const [customerPhone, setCustomerPhone] = useState('');
    
    // Product and invoice states
    const [selectedProducts, setSelectedProducts] = useState([]);
    const [showSearchModal, setShowSearchModal] = useState(false);
    const [showInvoiceCreation, setShowInvoiceCreation] = useState(false);
    const [invoiceNumber, setInvoiceNumber] = useState('');
    const [isCreatingInvoice, setIsCreatingInvoice] = useState(false);
    
    // Invoice generation/retrieval states
    const [retrievedInvoice, setRetrievedInvoice] = useState(null);
    const [isGeneratingInvoice, setIsGeneratingInvoice] = useState(false);
    const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
    const [isSharingPDF, setIsSharingPDF] = useState(false);
    const [generatedPDFData, setGeneratedPDFData] = useState(null);
    const [gstMethod, setGstMethod] = useState('Inclusive GST'); // Default to inclusive

    // Load GST method from client status
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

    // Load GST method on component mount
    useEffect(() => {
        loadGSTMethod();
    }, [loadGSTMethod]);

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
                    return;
                }
            } catch (error) {
                console.error('Error generating invoice number:', error);
                Toast.show({
                    type: 'error',
                    text1: 'Error',
                    text2: 'Failed to generate invoice number'
                });
                return;
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

    // Create direct invoice with walk-in status
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

        if (!customerName.trim()) {
            Toast.show({
                type: 'error',
                text1: 'Error',
                text2: 'Customer name is required'
            });
            return;
        }

        if (!customerPhone.trim()) {
            Toast.show({
                type: 'error',
                text1: 'Error',
                text2: 'Customer phone is required'
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
                customerName: customerName.trim(), // Add customer name for walk-in
                customerPhone: customerPhone.trim() // Add customer phone for walk-in
            };

            const result = await createDirectInvoice(invoiceData);

            if (result.success) {
                // Call walk-in API to insert walk-in customer data
                try {
                    const walkInResponse = await fetch(`http://${require('../../../services/urls').ipAddress}:8091/walk_in`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                            customer_name: customerName.trim(),
                            customer_phone: customerPhone.trim(),
                            invoice_amount: totalAmount
                        })
                    });

                    const walkInData = await walkInResponse.json();
                    
                    if (walkInData.success) {
                        console.log('Walk-in customer data inserted successfully:', walkInData.data);
                    } else {
                        console.warn('Failed to insert walk-in customer data:', walkInData.message);
                    }
                } catch (walkInError) {
                    console.error('Error inserting walk-in customer data:', walkInError);
                }

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
                        
                        // Step 2: Generate PDF with walk-in customer data
                        const walkInCustomerData = {
                            username: customerName.trim(),
                            phone: customerPhone.trim(),
                            route: 'Walk-In Customer',
                            delivery_address: 'Walk-In Customer'
                        };
                        
                        const pdfResult = await generateInvoicePDF(retrieveResult.data, walkInCustomerData);
                        
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

    // Download PDF to device storage
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
            
            // Convert base64 back to Uint8Array for file saving
            const binaryString = atob(generatedPDFData.pdfBytes);
            const uint8Array = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) {
                uint8Array[i] = binaryString.charCodeAt(i);
            }
            
            const filePath = await savePDFToDownloads(uint8Array, generatedPDFData.fileName);
            
            if (filePath) {
                Toast.show({
                    type: 'success',
                    text1: 'Success',
                    text2: 'Invoice downloaded successfully!'
                });
            }
        } catch (error) {
            console.error('Error downloading PDF:', error);
            Toast.show({
                type: 'error',
                text1: 'Error',
                text2: error.message || 'Failed to download PDF'
            });
        } finally {
            setIsSharingPDF(false);
        }
    };

    // Cancel PDF view and go back to main screen
    const cancelPDFHandler = () => {
        setRetrievedInvoice(null);
        setGeneratedPDFData(null);
        setIsGeneratingPDF(false);
        setIsSharingPDF(false);
        
        // Go back to main screen
        setSelectedProducts([]);
        setShowInvoiceCreation(false);
        setInvoiceNumber('');
        setCustomerName('');
        setCustomerPhone('');
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

    return (
        <SafeAreaView style={styles.safeArea}>
            <StatusBar backgroundColor={COLORS.primary} barStyle="light-content" />
            
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity 
                    onPress={retrievedInvoice && generatedPDFData ? cancelPDFHandler :
                             showInvoiceCreation ? () => setShowInvoiceCreation(false) : 
                             () => navigation.goBack()}
                    style={styles.backButton}
                >
                    <MaterialIcons name="arrow-back" size={24} color={COLORS.text.light} />
                </TouchableOpacity>
                <View style={styles.headerContent}>
                    <Text style={[styles.headerTitle, { fontSize: getScaledSize(20) }]}>
                        {retrievedInvoice && generatedPDFData ? 'Invoice PDF Ready' :
                         showInvoiceCreation ? 'Create Invoice' : 
                         'Walk-In Customer'}
                    </Text>
                    <Text style={[styles.headerSubtitle, { fontSize: getScaledSize(14) }]}>
                        {retrievedInvoice && generatedPDFData ? 'Share or cancel to continue' :
                         showInvoiceCreation ? `Invoice for ${customerName} (${customerPhone})` :
                         'Enter customer details to create invoice'
                        }
                    </Text>
                </View>
                {!showInvoiceCreation && !(retrievedInvoice && generatedPDFData) && (
                    <TouchableOpacity 
                        onPress={() => {
                            if (selectedProducts.length > 0) {
                                setShowInvoiceCreation(true);
                            } else {
                                Toast.show({
                                    type: 'error',
                                    text1: 'No Products Selected',
                                    text2: 'Please select at least one product to create invoice'
                                });
                            }
                        }}
                        style={styles.createInvoiceButton}
                    >
                        <MaterialIcons name="receipt" size={20} color={COLORS.text.light} />
                    </TouchableOpacity>
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
                                    <Text style={[styles.invoiceInfoLabel, { fontSize: getScaledSize(15) }]}>Customer: </Text>
                                    {customerName}
                                </Text>
                                <Text style={[styles.invoiceInfoText, { fontSize: getScaledSize(15) }]}>
                                    <Text style={[styles.invoiceInfoLabel, { fontSize: getScaledSize(15) }]}>Phone: </Text>
                                    {customerPhone}
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
                                    
                                    {/* Customer Info Display */}
                                    <View style={styles.customerInfoContainer}>
                                        <Text style={[styles.customerInfoLabel, { fontSize: getScaledSize(12) }]}>Customer Name:</Text>
                                        <Text style={[styles.customerInfoText, { fontSize: getScaledSize(16) }]}>{customerName}</Text>
                                    </View>
                                    <View style={styles.customerInfoContainer}>
                                        <Text style={[styles.customerInfoLabel, { fontSize: getScaledSize(12) }]}>Customer Phone:</Text>
                                        <Text style={[styles.customerInfoText, { fontSize: getScaledSize(16) }]}>{customerPhone}</Text>
                                    </View>
                                    
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
                    // Customer Name Input View
                    <View style={styles.content}>
                        <View style={styles.card}>
                            <Text style={[styles.title, { fontSize: getScaledSize(24) }]}>Walk-In Customer</Text>
                            <Text style={[styles.subtitle, { fontSize: getScaledSize(16) }]}>
                                Enter customer name to create invoice
                            </Text>
                            
                            {/* Customer Name Input */}
                            <View style={styles.inputContainer}>
                                <Text style={[styles.inputLabel, { fontSize: getScaledSize(16) }]}>Customer Name</Text>
                                <TextInput
                                    style={[styles.textInput, { fontSize: getScaledSize(16) }]}
                                    placeholder="Enter customer name..."
                                    value={customerName}
                                    onChangeText={setCustomerName}
                                    placeholderTextColor={COLORS.text.secondary}
                                />
                            </View>
                            
                            {/* Customer Phone Input */}
                            <View style={styles.inputContainer}>
                                <Text style={[styles.inputLabel, { fontSize: getScaledSize(16) }]}>Customer Phone</Text>
                                <TextInput
                                    style={[styles.textInput, { fontSize: getScaledSize(16) }]}
                                    placeholder="Enter customer phone..."
                                    value={customerPhone}
                                    onChangeText={setCustomerPhone}
                                    placeholderTextColor={COLORS.text.secondary}
                                    keyboardType="phone-pad"
                                />
                            </View>
                            
                            <TouchableOpacity 
                                style={[styles.addProductButton, (!customerName.trim() || !customerPhone.trim()) && styles.addProductButtonDisabled]}
                                onPress={() => {
                                    if (customerName.trim() && customerPhone.trim()) {
                                        setShowSearchModal(true);
                                    } else {
                                        Toast.show({
                                            type: 'error',
                                            text1: 'Customer Details Required',
                                            text2: 'Please enter customer name and phone first'
                                        });
                                    }
                                }}
                                disabled={!customerName.trim() || !customerPhone.trim()}
                            >
                                <MaterialIcons name="add" size={24} color={COLORS.text.light} />
                                <Text style={[styles.addProductButtonText, { fontSize: getScaledSize(16) }]}>Add Products</Text>
                            </TouchableOpacity>
                            
                            {selectedProducts.length > 0 && (
                                <View style={styles.selectedProductsContainer}>
                                    <Text style={[styles.sectionTitle, { fontSize: getScaledSize(18) }]}>Selected Products ({selectedProducts.length})</Text>
                                    <FlatList
                                        data={selectedProducts}
                                        renderItem={renderSelectedProduct}
                                        keyExtractor={(item) => item.product_id.toString()}
                                        showsVerticalScrollIndicator={false}
                                        style={styles.selectedProductsList}
                                    />
                                </View>
                            )}
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
                currentCustomerId={null} // No customer ID for walk-in
                allowProductEdit={true}
            />
        </SafeAreaView>
    );
};

export default WalkIn;
