import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    SafeAreaView,
    StatusBar,
    FlatList,
    TouchableOpacity,
    ActivityIndicator,
    Alert,
    ScrollView,
    RefreshControl,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ipAddress } from '../../../services/urls';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { useNavigation } from '@react-navigation/native';
import { jwtDecode } from 'jwt-decode';
import DateTimePicker from '@react-native-community/datetimepicker';
import { COLORS } from './InvoiceDirectComponents';
import { useFontScale } from '../../../App';

// Helper to get token
const getToken = async () => {
    const token = await AsyncStorage.getItem("userAuthToken");
    if (!token) throw new Error("Authentication token not found");
    return token;
};

// Fetch invoices by date range with optional billed_by filter
export const fetchInvoicesByDateRange = async (fromDate, toDate, billedBy = null) => {
    try {
        const authToken = await getToken();
        
        // Use the new API endpoint
        let url = `http://${ipAddress}:8091/fetch_direct_invoice?from=${fromDate}&to=${toDate}`;
        
        // Add billed_by parameter if provided
        if (billedBy) {
            url += `&billed_by=${encodeURIComponent(billedBy)}`;
        }
        
        console.log('Fetching invoices from:', url);
        
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json',
            },
        });

        // Check if response is OK before trying to parse JSON
        if (!response.ok) {
            const errorText = await response.text();
            console.error('API Error Response:', errorText);
            
            // Check if it's a 404 error (endpoint not found)
            if (response.status === 404) {
                throw new Error('API endpoint not found. This feature may not be implemented on the server yet.');
            }
            
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        // Check content type before parsing
        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
            const errorText = await response.text();
            console.error('Non-JSON Response:', errorText);
            
            // If it looks like HTML, it's likely an error page
            if (errorText.startsWith('<')) {
                throw new Error('Server returned an HTML error page. This feature may not be implemented on the server yet.');
            }
            
            throw new Error('Invalid response format from server');
        }

        const data = await response.json();

        if (data.success) {
            return { success: true, data: data.data };
        } else {
            throw new Error(data.message || 'Failed to fetch invoices');
        }
    } catch (error) {
        console.error('Error fetching invoices:', error);
        return { success: false, error: error.message };
    }
};

// Fetch invoices by billed_by and date range
export const fetchInvoicesByBilledBy = async (billedBy, fromDate, toDate) => {
    try {
        const authToken = await getToken();
        
        const url = `http://${ipAddress}:8091/fetch_direct_invoice_billed_by?billed_by=${encodeURIComponent(billedBy)}&from=${fromDate}&to=${toDate}`;
        
        console.log('Fetching invoices from:', url);
        
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json',
            },
        });

        // Check if response is OK before trying to parse JSON
        if (!response.ok) {
            const errorText = await response.text();
            console.error('API Error Response:', errorText);
            
            // Check if it's a 404 error (endpoint not found)
            if (response.status === 404) {
                throw new Error('API endpoint not found. This feature may not be implemented on the server yet.');
            }
            
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        // Check content type before parsing
        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
            const errorText = await response.text();
            console.error('Non-JSON Response:', errorText);
            
            // If it looks like HTML, it's likely an error page
            if (errorText.startsWith('<')) {
                throw new Error('Server returned an HTML error page. This feature may not be implemented on the server yet.');
            }
            
            throw new Error('Invalid response format from server');
        }

        const data = await response.json();

        if (data.success) {
            return { success: true, data: data.data };
        } else {
            throw new Error(data.message || 'Failed to fetch invoices');
        }
    } catch (error) {
        console.error('Error fetching invoices:', error);
        return { success: false, error: error.message };
    }
};

const InvoiceSummary = () => {
    const navigation = useNavigation();
    const { getScaledSize } = useFontScale();
    const [expandedInvoice, setExpandedInvoice] = useState(null); // Track expanded invoice
    const [loading, setLoading] = useState(false);
    const [invoices, setInvoices] = useState([]);
    const [refreshing, setRefreshing] = useState(false);
    const [billedBy, setBilledBy] = useState('');
    // Set default date range to last 7 days
    const getDefaultFromDate = () => {
        const date = new Date();
        date.setDate(date.getDate() - 7);
        return date;
    };
    
    const [fromDate, setFromDate] = useState(getDefaultFromDate());
    const [toDate, setToDate] = useState(new Date());
    const [showFromDatePicker, setShowFromDatePicker] = useState(false);
    const [showToDatePicker, setShowToDatePicker] = useState(false);

    // Get billed_by from JWT token
    const getBilledByFromToken = useCallback(async () => {
        try {
            const userAuthToken = await AsyncStorage.getItem("userAuthToken");

            if (!userAuthToken) {
                throw new Error("User authentication token not found.");
            }

            const decodedToken = jwtDecode(userAuthToken);
            const currentAdminId = decodedToken.username || '';
            setBilledBy(currentAdminId);
            return currentAdminId;
        } catch (error) {
            console.error('Error decoding token:', error);
            Alert.alert('Error', `Failed to decode user token: ${error.message}`);
            return '';
        }
    }, []);

    // Load invoices
    const loadInvoices = useCallback(async (refresh = false) => {
        if (refresh) {
            setRefreshing(true);
        } else {
            setLoading(true);
        }

        try {
            // For date range, we want to include the entire day
            // So for 'from' date, we use the start of the day (00:00:00)
            // And for 'to' date, we use the end of the day (23:59:59)
            const fromDateStart = new Date(fromDate);
            fromDateStart.setHours(0, 0, 0, 0);
            
            const toDateEnd = new Date(toDate);
            toDateEnd.setHours(23, 59, 59, 999);
            
            const fromTimestamp = Math.floor(fromDateStart.getTime() / 1000);
            const toTimestamp = Math.floor(toDateEnd.getTime() / 1000);
            
            // Get billed_by from token
            const billedByUsername = await getBilledByFromToken();
            
            // Use the new fetch function with billed_by filter
            const result = await fetchInvoicesByDateRange(fromTimestamp, toTimestamp, billedByUsername);
            
            if (result.success) {
                setInvoices(result.data);
            } else {
                Alert.alert('Error', result.error);
            }
        } catch (error) {
            console.error('Error loading invoices:', error);
            Alert.alert('Error', `Failed to load invoices: ${error.message}`);
        } finally {
            if (refresh) {
                setRefreshing(false);
            } else {
                setLoading(false);
            }
        }
    }, [fromDate, toDate, getBilledByFromToken]);

    // Initial load
    useEffect(() => {
        // Load invoices after a short delay to ensure component is mounted
        const timer = setTimeout(() => {
            loadInvoices();
        }, 100);
        
        return () => clearTimeout(timer);
    }, [loadInvoices]);

    // Handle date changes
    const onChangeFromDate = (event, selectedDate) => {
        setShowFromDatePicker(false);
        if (selectedDate) {
            setFromDate(selectedDate);
        }
    };

    const onChangeToDate = (event, selectedDate) => {
        setShowToDatePicker(false);
        if (selectedDate) {
            setToDate(selectedDate);
        }
    };

    // Format date for display
    const formatDate = (date) => {
        return date.toLocaleDateString();
    };

    // Format currency
    const formatCurrency = (amount) => {
        return `₹${parseFloat(amount || 0).toFixed(2)}`;
    };

    // Format payment methods from collections
    const formatPaymentMethods = (collections) => {
        if (!collections) return 'N/A';
        
        const methods = [];
        if (collections.upi > 0) methods.push(`UPI: ₹${collections.upi}`);
        if (collections.cash > 0) methods.push(`Cash: ₹${collections.cash}`);
        if (collections.cheque > 0) methods.push(`Cheque: ₹${collections.cheque}`);
        if (collections.credit > 0) methods.push(`Credit: ₹${collections.credit}`);
        
        return methods.length > 0 ? methods.join(', ') : 'N/A';
    };

    // Get total collected amount from collections
    const getTotalCollected = (collections) => {
        if (!collections) return 0;
        
        return (parseFloat(collections.upi || 0) + 
                parseFloat(collections.cash || 0) + 
                parseFloat(collections.cheque || 0) + 
                parseFloat(collections.credit || 0));
    };

    // Get balance information
    const getBalanceInfo = (collections) => {
        if (!collections) return '';
        
        const balance = parseFloat(collections.balance || 0);
        if (balance > 0) {
            return `Change: ₹${balance.toFixed(2)}`;
        } else if (balance < 0) {
            return `Due: ₹${Math.abs(balance).toFixed(2)}`;
        }
        return 'Exact payment';
    };

    // Format collections summary
    const formatCollectionsSummary = (collections) => {
        if (!collections) return 'N/A';
        
        const totalCollected = getTotalCollected(collections);
        const balanceInfo = getBalanceInfo(collections);
        
        return `Collected: ₹${totalCollected.toFixed(2)} (${balanceInfo})`;
    };

    // Format tendered amount
    const formatTendered = (collections) => {
        if (!collections || collections.tendered === undefined) return 'N/A';
        return `Tendered: ₹${collections.tendered}`;
    };

    // Format timestamp to readable date
    const formatTimestamp = (timestamp) => {
        if (!timestamp) return 'N/A';
        return new Date(timestamp * 1000).toLocaleDateString();
    };

    // Format timestamp to readable date and time
    const formatTimestampWithTime = (timestamp) => {
        if (!timestamp) return 'N/A';
        return new Date(timestamp * 1000).toLocaleString();
    };

    // Render invoice item
    // Toggle invoice expansion
    const toggleInvoiceExpansion = (invoiceNumber) => {
        setExpandedInvoice(expandedInvoice === invoiceNumber ? null : invoiceNumber);
    };

    // Render invoice item
    const renderInvoiceItem = ({ item }) => {
        const isExpanded = expandedInvoice === item.invoice_number;
        
        return (
            <TouchableOpacity 
                style={styles.invoiceItem}
                onPress={() => toggleInvoiceExpansion(item.invoice_number)}
            >
                <View style={styles.invoiceHeader}>
                    <Text style={[styles.invoiceNumber, { fontSize: getScaledSize(16) }]}>{item.invoice_number}</Text>
                    <Text style={[styles.invoiceDate, { fontSize: getScaledSize(14) }]}>
                        {formatTimestamp(item.created_at)}
                    </Text>
                </View>
                <View style={styles.invoiceDetails}>
                    <Text style={[styles.customerName, { fontSize: getScaledSize(15) }]}>{item.customer_name || 'N/A'}</Text>
                    <Text style={[styles.invoiceAmount, { fontSize: getScaledSize(16) }]}>{formatCurrency(item.invoice_amount)}</Text>
                </View>
                <Text style={[styles.billedByCollapsed, { fontSize: getScaledSize(13) }]}>Billed by: {item.billed_by || 'N/A'}</Text>
                
                {/* Show only basic info when collapsed */}
                {!isExpanded && (
                    <Text style={[styles.collapsedInfo, { fontSize: getScaledSize(13) }]}>Tap to expand details</Text>
                )}
                
                {/* Show full details when expanded */}
                {isExpanded && (
                    <>
                        {item.route ? (
                            <Text style={[styles.route, { fontSize: getScaledSize(13) }]}>Route: {item.route}</Text>
                        ) : null}
                        <Text style={[styles.paymentMethods, { fontSize: getScaledSize(12) }]}>Payment: {formatPaymentMethods(item.collections)}</Text>
                        <Text style={[styles.collectionsSummary, { fontSize: getScaledSize(12) }]}>{formatCollectionsSummary(item.collections)}</Text>
                        <Text style={[styles.tenderedAmount, { fontSize: getScaledSize(12) }]}>{formatTendered(item.collections)}</Text>
                        <Text style={[styles.billedBy, { fontSize: getScaledSize(12) }]}>Billed by: {item.billed_by}</Text>
                        
                        {/* Order Products Section */}
                        {item.order_products && item.order_products.length > 0 && (
                            <View style={styles.productsContainer}>
                                <Text style={[styles.productsTitle, { fontSize: getScaledSize(14) }]}>Products:</Text>
                                <View style={styles.productHeaderRow}>
                                    <Text style={[styles.productHeaderCell, { fontSize: getScaledSize(12) }]}>Item</Text>
                                    <Text style={[styles.productHeaderCell, { fontSize: getScaledSize(12) }]}>Rate</Text>
                                    <Text style={[styles.productHeaderCell, { fontSize: getScaledSize(12) }]}>Qty</Text>
                                    <Text style={[styles.productHeaderCell, { fontSize: getScaledSize(12) }]}>Amount</Text>
                                </View>
                                {item.order_products.map((product, index) => {
                                    // Use approved values if available, otherwise use regular values
                                    const price = product.approved_price || product.price || 0;
                                    const quantity = product.approved_qty || product.quantity || 0;
                                    const amount = price * quantity;
                                    
                                    return (
                                        <View key={index} style={styles.productRow}>
                                            <Text style={[styles.productCell, { fontSize: getScaledSize(12) }]}>{product.name}</Text>
                                            <Text style={[styles.productCell, { fontSize: getScaledSize(12) }]}>{formatCurrency(price)}</Text>
                                            <Text style={[styles.productCell, { fontSize: getScaledSize(12) }]}>{quantity}</Text>
                                            <Text style={[styles.productCell, { fontSize: getScaledSize(12) }]}>{formatCurrency(amount)}</Text>
                                        </View>
                                    );
                                })}
                                {/* Grand Total */}
                                <View style={styles.grandTotalRow}>
                                    <Text style={[styles.grandTotalLabel, { fontSize: getScaledSize(13) }]}>Grand Total:</Text>
                                    <Text style={[styles.grandTotalAmount, { fontSize: getScaledSize(13) }]}>{formatCurrency(item.invoice_amount)}</Text>
                                </View>
                            </View>
                        )}
                        
                        <View style={styles.expandIndicator}>
                            <Text style={[styles.tapToCollapse, { fontSize: getScaledSize(12) }]}>Tap to collapse</Text>
                        </View>
                    </>
                )}
            </TouchableOpacity>
        );
    };

    return (
        <SafeAreaView style={styles.safeArea}>
            <StatusBar backgroundColor={COLORS.primary} barStyle="light-content" />
            
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity 
                    onPress={() => navigation.goBack()}
                    style={styles.backButton}
                >
                    <MaterialIcons name="arrow-back" size={24} color={COLORS.text.light} />
                </TouchableOpacity>
                <View style={styles.headerContent}>
                    <Text style={[styles.headerTitle, { fontSize: getScaledSize(24) }]}>Invoice Summary</Text>
                    <Text style={[styles.headerSubtitle, { fontSize: getScaledSize(14) }]}>View invoices billed by you within a date range</Text>
                </View>
            </View>

            {/* Filters */}
            <View style={styles.filterContainer}>
                <Text style={[styles.filterTitle, { fontSize: getScaledSize(18) }]}>Filter by Date Range (Last 7 days by default)</Text>
                
                <View style={styles.dateFilterContainer}>
                    <View style={styles.datePickerContainer}>
                        <Text style={[styles.dateLabel, { fontSize: getScaledSize(14) }]}>From:</Text>
                        <TouchableOpacity 
                            style={styles.dateButton}
                            onPress={() => setShowFromDatePicker(true)}
                        >
                            <Text style={[styles.dateText, { fontSize: getScaledSize(16) }]}>{formatDate(fromDate)}</Text>
                        </TouchableOpacity>
                    </View>
                    
                    <View style={styles.datePickerContainer}>
                        <Text style={[styles.dateLabel, { fontSize: getScaledSize(14) }]}>To:</Text>
                        <TouchableOpacity 
                            style={styles.dateButton}
                            onPress={() => setShowToDatePicker(true)}
                        >
                            <Text style={[styles.dateText, { fontSize: getScaledSize(16) }]}>{formatDate(toDate)}</Text>
                        </TouchableOpacity>
                    </View>
                </View>
                
                <TouchableOpacity 
                    style={styles.refreshButton}
                    onPress={() => loadInvoices()}
                    disabled={loading}
                >
                    {loading ? (
                        <ActivityIndicator color={COLORS.text.light} size="small" />
                    ) : (
                        <MaterialIcons name="refresh" size={20} color={COLORS.text.light} />
                    )}
                    <Text style={[styles.refreshButtonText, { fontSize: getScaledSize(16) }]}>Refresh</Text>
                </TouchableOpacity>
            </View>

            {/* Date Pickers */}
            {showFromDatePicker && (
                <DateTimePicker
                    value={fromDate}
                    mode="date"
                    display="default"
                    onChange={onChangeFromDate}
                    maximumDate={new Date()}
                />
            )}
            
            {showToDatePicker && (
                <DateTimePicker
                    value={toDate}
                    mode="date"
                    display="default"
                    onChange={onChangeToDate}
                    maximumDate={new Date()}
                />
            )}

            {/* Invoice List */}
            <View style={styles.container}>
                {loading && invoices.length === 0 ? (
                    <View style={styles.loadingContainer}>
                        <ActivityIndicator size="large" color={COLORS.primary} />
                        <Text style={[styles.loadingText, { fontSize: getScaledSize(16) }]}>Loading invoices...</Text>
                    </View>
                ) : (
                    <FlatList
                        data={invoices}
                        keyExtractor={(item) => item.invoice_number}
                        renderItem={renderInvoiceItem}
                        refreshControl={
                            <RefreshControl
                                refreshing={refreshing}
                                onRefresh={() => loadInvoices(true)}
                                colors={[COLORS.primary]}
                            />
                        }
                        ListEmptyComponent={
                            <View style={styles.emptyContainer}>
                                <MaterialIcons name="receipt" size={48} color={COLORS.text.tertiary} />
                                <Text style={[styles.emptyText, { fontSize: getScaledSize(18) }]}>No invoices found</Text>
                                <Text style={[styles.emptySubText, { fontSize: getScaledSize(14) }]}>Try adjusting your date range</Text>
                                <Text style={[styles.emptySubText, { fontSize: getScaledSize(14), marginTop: 10, fontStyle: 'italic' }]}>Note: This feature requires backend API support</Text>
                                <Text style={[styles.emptySubText, { fontSize: getScaledSize(14), marginTop: 5, fontStyle: 'italic' }]}>If you continue to see this error, contact your system administrator</Text>
                            </View>
                        }
                        contentContainerStyle={invoices.length === 0 ? styles.listEmpty : null}
                    />
                )}
            </View>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
        backgroundColor: COLORS.primary,
    },
    header: {
        backgroundColor: COLORS.primary,
        paddingHorizontal: 20,
        paddingVertical: 20,
        flexDirection: 'row',
        alignItems: 'center',
    },
    backButton: {
        marginRight: 15,
        padding: 5,
    },
    headerContent: {
        flex: 1,
    },
    headerTitle: {
        fontSize: 24,
        fontWeight: '700',
        color: COLORS.text.light,
        marginBottom: 4,
    },
    headerSubtitle: {
        fontSize: 14,
        color: 'rgba(255, 255, 255, 0.8)',
        fontWeight: '400',
    },
    filterContainer: {
        backgroundColor: COLORS.surface,
        padding: 20,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.border,
    },
    filterTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: COLORS.text.primary,
        marginBottom: 15,
    },
    dateFilterContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 15,
    },
    datePickerContainer: {
        flex: 1,
        marginRight: 10,
    },
    dateLabel: {
        fontSize: 14,
        color: COLORS.text.secondary,
        marginBottom: 5,
        fontWeight: '500',
    },
    dateButton: {
        backgroundColor: COLORS.background,
        borderWidth: 1,
        borderColor: COLORS.border,
        borderRadius: 8,
        padding: 12,
        alignItems: 'center',
    },
    dateText: {
        fontSize: 16,
        color: COLORS.text.primary,
        fontWeight: '500',
    },
    refreshButton: {
        backgroundColor: COLORS.primary,
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 12,
        borderRadius: 8,
    },
    refreshButtonText: {
        color: COLORS.text.light,
        fontSize: 16,
        fontWeight: '600',
        marginLeft: 8,
    },
    container: {
        flex: 1,
        backgroundColor: COLORS.background,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 40,
    },
    loadingText: {
        marginTop: 15,
        fontSize: 16,
        color: COLORS.text.secondary,
        fontWeight: '500',
    },
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 40,
    },
    emptyText: {
        fontSize: 18,
        color: COLORS.text.secondary,
        textAlign: 'center',
        marginTop: 15,
        fontWeight: '600',
    },
    emptySubText: {
        fontSize: 14,
        color: COLORS.text.tertiary,
        textAlign: 'center',
        marginTop: 8,
    },
    listEmpty: {
        flex: 1,
    },
    invoiceItem: {
        backgroundColor: COLORS.surface,
        borderRadius: 12,
        padding: 16,
        marginHorizontal: 20,
        marginVertical: 8,
        borderWidth: 1,
        borderColor: COLORS.border,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 1,
    },
    invoiceHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 8,
    },
    invoiceNumber: {
        fontSize: 16,
        fontWeight: '700',
        color: COLORS.primary,
    },
    invoiceDate: {
        fontSize: 14,
        color: COLORS.text.secondary,
    },
    invoiceDetails: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 8,
    },
    customerName: {
        fontSize: 15,
        fontWeight: '600',
        color: COLORS.text.primary,
        flex: 1,
    },
    invoiceAmount: {
        fontSize: 16,
        fontWeight: '700',
        color: COLORS.primary,
    },
    route: {
        fontSize: 13,
        color: COLORS.text.secondary,
        fontStyle: 'italic',
    },
    paymentMethods: {
        fontSize: 12,
        color: COLORS.text.secondary,
        marginTop: 4,
    },
    billedBy: {
        fontSize: 12,
        color: COLORS.text.secondary,
        marginTop: 2,
    },
    collectionsSummary: {
        fontSize: 12,
        color: COLORS.text.secondary,
        marginTop: 2,
        fontStyle: 'italic',
    },
    tenderedAmount: {
        fontSize: 12,
        color: COLORS.text.secondary,
        marginTop: 1,
    },
    collapsedInfo: {
        fontSize: 13,
        color: COLORS.text.secondary,
        fontStyle: 'italic',
        textAlign: 'center',
        marginTop: 5,
    },
    expandIndicator: {
        alignItems: 'center',
        marginTop: 8,
        paddingTop: 8,
        borderTopWidth: 1,
        borderTopColor: COLORS.border,
    },
    tapToCollapse: {
        fontSize: 12,
        color: COLORS.text.secondary,
        fontStyle: 'italic',
    },
    
    // Add style for collapsed billed by display
    billedByCollapsed: {
        fontSize: 13,
        color: COLORS.text.secondary,
        fontStyle: 'italic',
        marginTop: 2,
    },
    
    // Add these new styles for product display
    productsContainer: {
        marginTop: 10,
        paddingTop: 10,
        borderTopWidth: 1,
        borderTopColor: COLORS.border,
    },
    productsTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: COLORS.text.primary,
        marginBottom: 8,
    },
    productHeaderRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        borderBottomWidth: 1,
        borderBottomColor: COLORS.border,
        paddingBottom: 5,
        marginBottom: 5,
    },
    productHeaderCell: {
        flex: 1,
        fontWeight: '600',
        color: COLORS.text.primary,
        textAlign: 'center',
    },
    productRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingVertical: 4,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.border,
    },
    productCell: {
        flex: 1,
        color: COLORS.text.secondary,
        textAlign: 'center',
    },
    grandTotalRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: 10,
        paddingTop: 10,
        borderTopWidth: 1,
        borderTopColor: COLORS.border,
    },
    grandTotalLabel: {
        fontSize: 13,
        fontWeight: '700',
        color: COLORS.text.primary,
    },
    grandTotalAmount: {
        fontSize: 13,
        fontWeight: '700',
        color: COLORS.primary,
    },
});

export default InvoiceSummary;