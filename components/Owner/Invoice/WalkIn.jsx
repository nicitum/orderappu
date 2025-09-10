import React, { useState } from 'react';
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
} from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { useNavigation } from '@react-navigation/native';
import SearchProductModal_1 from '../searchProductModal_1';
import {
    generateInvoiceNumber,
    createDirectInvoice,
    generateDirectInvoice,
    generateInvoicePDF,
    shareInvoicePDF,
    calculateTotalAmount,
    updateProductQuantity
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

const WalkIn = () => {
    const navigation = useNavigation();
    
    // Customer name state
    const [customerName, setCustomerName] = useState('');
    
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

        try {
            setIsCreatingInvoice(true);
            
            // Calculate total amount
            const totalAmount = calculateTotalAmount(selectedProducts);

            const invoiceData = {
                invoiceNumber: invoiceNumber.trim(),
                products: selectedProducts,
                totalAmount: totalAmount,
                customerName: customerName.trim() // Add customer name for walk-in
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
                            customer_name: customerName.trim()
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
                        
                        // Step 2: Generate PDF
                        const pdfResult = await generateInvoicePDF(retrieveResult.data);
                        
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
    };

    // Render selected product item for invoice creation
    const renderSelectedProduct = ({ item }) => {
        return (
            <SelectedProductItem
                item={item}
                onQuantityChange={updateProductQuantityHandler}
                styles={styles}
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
                    <Text style={styles.headerTitle}>
                        {retrievedInvoice && generatedPDFData ? 'Invoice PDF Ready' :
                         showInvoiceCreation ? 'Create Invoice' : 
                         'Walk-In Customer'}
                    </Text>
                    <Text style={styles.headerSubtitle}>
                        {retrievedInvoice && generatedPDFData ? 'Share or cancel to continue' :
                         showInvoiceCreation ? `Invoice for ${customerName}` :
                         'Enter customer name to create invoice'
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
                            <Text style={styles.title}>Invoice PDF Generated</Text>
                            
                            {/* Invoice Info */}
                            <View style={styles.invoiceInfoContainer}>
                                <Text style={styles.invoiceInfoText}>
                                    <Text style={styles.invoiceInfoLabel}>Invoice Number: </Text>
                                    {retrievedInvoice.invoice_info.invoice_number}
                                </Text>
                                <Text style={styles.invoiceInfoText}>
                                    <Text style={styles.invoiceInfoLabel}>Customer: </Text>
                                    {customerName}
                                </Text>
                                <Text style={styles.invoiceInfoText}>
                                    <Text style={styles.invoiceInfoLabel}>Amount: </Text>
                                    Rs {retrievedInvoice.invoice_info.invoice_amount}
                                </Text>
                                <Text style={styles.invoiceInfoText}>
                                    <Text style={styles.invoiceInfoLabel}>Total Items: </Text>
                                    {retrievedInvoice.invoice_info.total_items}
                                </Text>
                                <Text style={styles.invoiceInfoText}>
                                    <Text style={styles.invoiceInfoLabel}>Created: </Text>
                                    {new Date(retrievedInvoice.invoice_info.created_at).toLocaleDateString()}
                                </Text>
                            </View>

                            {/* Action Buttons */}
                            <View style={styles.pdfActionButtons}>
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
                                    <Text style={styles.shareButtonText}>
                                        {isSharingPDF ? 'Sharing...' : 'Share Invoice'}
                                    </Text>
                                </TouchableOpacity>

                                <TouchableOpacity
                                    style={styles.cancelButton}
                                    onPress={cancelPDFHandler}
                                    activeOpacity={0.8}
                                >
                                    <MaterialIcons name="arrow-back" size={24} color={COLORS.text.light} />
                                    <Text style={styles.cancelButtonText}>Back to Menu</Text>
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
                                    <Text style={styles.title}>Create Direct Invoice</Text>
                                    
                                    {/* Customer Name Display */}
                                    <View style={styles.customerInfoContainer}>
                                        <Text style={styles.customerInfoLabel}>Customer Name:</Text>
                                        <Text style={styles.customerInfoText}>{customerName}</Text>
                                    </View>
                                    
                                    {/* Invoice Number Display */}
                                    <InvoiceNumberDisplay
                                        invoiceNumber={invoiceNumber}
                                        styles={styles}
                                    />

                                    {/* Add More Products Button */}
                                    <TouchableOpacity 
                                        style={styles.addProductButton}
                                        onPress={() => setShowSearchModal(true)}
                                    >
                                        <MaterialIcons name="add" size={24} color={COLORS.text.light} />
                                        <Text style={styles.addProductButtonText}>Add More Products</Text>
                                    </TouchableOpacity>

                                    {/* Selected Products */}
                                    <View style={styles.selectedProductsContainer}>
                                        <Text style={styles.sectionTitle}>Selected Products ({selectedProducts.length})</Text>
                                        {selectedProducts.map((item, index) => (
                                            <SelectedProductItem
                                                key={item.product_id.toString()}
                                                item={item}
                                                onQuantityChange={updateProductQuantityHandler}
                                                styles={styles}
                                            />
                                        ))}
                                    </View>

                                    {/* Total Amount */}
                                    <TotalAmountDisplay
                                        totalAmount={calculateTotalAmount(selectedProducts)}
                                        styles={styles}
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
                            />
                        </View>
                    </View>
                ) : (
                    // Customer Name Input View
                    <View style={styles.content}>
                        <View style={styles.card}>
                            <Text style={styles.title}>Walk-In Customer</Text>
                            <Text style={styles.subtitle}>
                                Enter customer name to create invoice
                            </Text>
                            
                            {/* Customer Name Input */}
                            <View style={styles.inputContainer}>
                                <Text style={styles.inputLabel}>Customer Name</Text>
                                <TextInput
                                    style={styles.textInput}
                                    placeholder="Enter customer name..."
                                    value={customerName}
                                    onChangeText={setCustomerName}
                                    placeholderTextColor={COLORS.text.secondary}
                                />
                            </View>
                            
                            <TouchableOpacity 
                                style={[styles.addProductButton, !customerName.trim() && styles.addProductButtonDisabled]}
                                onPress={() => {
                                    if (customerName.trim()) {
                                        setShowSearchModal(true);
                                    } else {
                                        Toast.show({
                                            type: 'error',
                                            text1: 'Customer Name Required',
                                            text2: 'Please enter customer name first'
                                        });
                                    }
                                }}
                                disabled={!customerName.trim()}
                            >
                                <MaterialIcons name="add" size={24} color={COLORS.text.light} />
                                <Text style={styles.addProductButtonText}>Add Products</Text>
                            </TouchableOpacity>
                            
                            {selectedProducts.length > 0 && (
                                <View style={styles.selectedProductsContainer}>
                                    <Text style={styles.sectionTitle}>Selected Products ({selectedProducts.length})</Text>
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
