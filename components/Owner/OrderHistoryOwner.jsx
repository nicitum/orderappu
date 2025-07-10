import React, { useEffect, useState, useCallback, useMemo } from "react";
import {
    View,
    Text,
    ActivityIndicator,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
    Alert,
    Platform,
    ToastAndroid,
    Image,
} from "react-native";
import axios from "axios";
import { ipAddress } from "../../services/urls";
import { checkTokenAndRedirect } from "../../services/auth";
import { useNavigation } from "@react-navigation/native";
import { jwtDecode } from "jwt-decode";
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import moment from 'moment';
import DateTimePickerModal from 'react-native-modal-datetime-picker';
import Ionicons from 'react-native-vector-icons/Ionicons';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import Toast from 'react-native-toast-message';

const OrderHistoryOwner = ({ route }) => {
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const navigation = useNavigation();
    const [expandedOrderDetailsId, setExpandedOrderDetailsId] = useState(null);
    const [orderDetails, setOrderDetails] = useState({});
    const [isDatePickerVisible, setDatePickerVisibility] = useState(false);
    const [selectedDate, setSelectedDate] = useState(new Date());
    const [allProductsData, setAllProductsData] = useState([]);
    const [customerNames, setCustomerNames] = useState({});

    // Get navigation parameters
    const expandedOrderId = route?.params?.expandedOrderId;
    const selectedDateString = route?.params?.selectedDate;
    
    // Convert string back to Date object if present - use useMemo to prevent infinite loops
    const initialSelectedDate = useMemo(() => {
        return selectedDateString ? new Date(selectedDateString) : null;
    }, [selectedDateString]);

    const showDatePicker = () => {
        setDatePickerVisibility(true);
    };

    const hideDatePicker = () => {
        setDatePickerVisibility(false);
    };

    const handleConfirm = (date) => {
        hideDatePicker();
        setSelectedDate(date);
        fetchOrders(date);
    };

    const fetchOrders = useCallback(async (dateFilter) => {
        setLoading(true);
      
        try {
            const token = await AsyncStorage.getItem("userAuthToken");
            if (!token) throw new Error("No authentication token found");

    
            // Format the dateFilter as YYYY-MM-DD if provided, otherwise use today's date
            const formattedDate = dateFilter ? moment(dateFilter).format("YYYY-MM-DD") : moment().format("YYYY-MM-DD");
    
            // Construct the URL with the date query parameter
            const url = `http://${ipAddress}:8091/get-orders-sa/?date=${formattedDate}`;
    
            const response = await axios.get(url, {
                headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "application/json"
                }
            });
            console.log("FETCH ADMIN ORDERS - Response Data:", response.data);
    
            if (!response.data || !response.data.status) {
                throw new Error(response.data?.message || "No valid data received from server");
            }
    
            const fetchedOrders = response.data.orders;
            console.log("Fetched orders:", fetchedOrders);
    
            setOrders(fetchedOrders);

            // If we have an expanded order ID and the order exists in the fetched orders,
            // fetch its details automatically
            if (expandedOrderId && fetchedOrders.some(order => order.id === expandedOrderId)) {
                const products = await fetchOrderProducts(expandedOrderId);
                setOrderDetails((prevDetails) => ({ ...prevDetails, [expandedOrderId]: products }));
            }
    
        } catch (error) {
            const errorMessage = error.response?.data?.message ||
                error.message ||
                "Failed to fetch admin orders";
            
            console.error("FETCH ADMIN ORDERS - Error:", error);
        } finally {
            setLoading(false);
        }
    }, [expandedOrderId]);

    const fetchAllProducts = useCallback(async () => {
        try {
            const token = await AsyncStorage.getItem("userAuthToken");
            if (!token) throw new Error("Authentication token missing");
            const response = await fetch(`http://${ipAddress}:8091/products`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            if (!response.ok) throw new Error("Failed to fetch products");
            const data = await response.json();
            setAllProductsData(data);
        } catch (error) {
            console.error("Error fetching all products:", error);
        }
    }, []);

    // Function to fetch customer name by customer ID (fallback)
    const fetchCustomerName = async (customerId) => {
        try {
            const token = await AsyncStorage.getItem("userAuthToken");
            const response = await fetch(`http://${ipAddress}:8091/fetch-names?customer_id=${customerId}`, {
                headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "application/json",
                },
            });
            if (!response.ok) {
                console.error(`Failed to fetch customer name for ID ${customerId}`);
                return null;
            }
            const data = await response.json();
            return data.name;
        } catch (error) {
            console.error(`Error fetching customer name for ID ${customerId}:`, error);
            return null;
        }
    };

    // Fetch customer names for all orders
    const fetchCustomerNamesForOrders = async (ordersList) => {
        try {
            // Get unique customer IDs
            const uniqueCustomerIds = [...new Set(
                ordersList
                    .map(order => order.customer_id)
                    .filter(id => id)
            )];
            if (uniqueCustomerIds.length === 0) return;
            const token = await AsyncStorage.getItem("userAuthToken");
            if (!token) return;
            // Try bulk API first
            const customerIdsParam = uniqueCustomerIds.join(',');
            const response = await fetch(`http://${ipAddress}:8091/fetch-names-bulk?customer_ids=${customerIdsParam}`, {
                headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "application/json",
                },
            });
            if (response.ok) {
                const data = await response.json();
                if (data.names) {
                    setCustomerNames(prev => ({ ...prev, ...data.names }));
                }
            } else {
                // Fallback to individual calls
                const names = {};
                for (const customerId of uniqueCustomerIds) {
                    const name = await fetchCustomerName(customerId);
                    if (name) {
                        names[customerId] = name;
                    }
                }
                setCustomerNames(prev => ({ ...prev, ...names }));
            }
        } catch (error) {
            console.error('Error fetching customer names:', error);
        }
    };

    useFocusEffect(
        useCallback(() => {
            console.log('useFocusEffect triggered with expandedOrderId:', expandedOrderId, 'initialSelectedDate:', initialSelectedDate);
            
            // Set initial date if provided from navigation
            if (initialSelectedDate) {
                setSelectedDate(initialSelectedDate);
            }
            
            fetchAllProducts();
            fetchOrders(initialSelectedDate || new Date());
            
            // Set expanded order if provided from navigation
            if (expandedOrderId) {
                console.log('Setting expanded order to:', expandedOrderId);
                setExpandedOrderDetailsId(expandedOrderId);
            }
            
            return () => {};
        }, [fetchOrders, fetchAllProducts, expandedOrderId, initialSelectedDate])
    );

    useEffect(() => {
        if (orders && orders.length > 0) {
            fetchCustomerNamesForOrders(orders);
        }
    }, [orders]);

    const allProductsMap = React.useMemo(() => {
        const map = new Map();
        (allProductsData || []).forEach(p => map.set(p.id, p));
        return map;
    }, [allProductsData]);

    const fetchOrderProducts = async (orderId) => {
        try {
            const token = await checkTokenAndRedirect(navigation);
            if (!token) throw new Error("No authorization token found.");

            const response = await axios.get(
                `http://${ipAddress}:8091/order-products?orderId=${orderId}`,
                { headers: { Authorization: `Bearer ${token}` } }
            );
            return response.data;
        } catch (error) {
            console.error("Error fetching order products:", error);
            Alert.alert("Error", "Failed to fetch order details.");
            return [];
        }
    };

    const handleOrderDetailsPress = async (orderId) => {
        console.log('Toggling order details for order:', orderId, 'Current expanded:', expandedOrderDetailsId);
        
        if (expandedOrderDetailsId === orderId) {
            setExpandedOrderDetailsId(null);
        } else {
            setExpandedOrderDetailsId(orderId);
            if (!orderDetails[orderId]) {
                console.log('Fetching products for order:', orderId);
                const products = await fetchOrderProducts(orderId);
                setOrderDetails((prevDetails) => ({ ...prevDetails, [orderId]: products }));
            }
        }
    };

    const handleReorder = async (orderId) => {
        try {
            const products = await fetchOrderProducts(orderId);
            if (products && products.length > 0) {
                const order = orders.find(o => o.id === orderId);
                if (!order) {
                    ToastAndroid.show('Order not found', ToastAndroid.SHORT);
                    return;
                }
                Alert.alert(
                    'Reorder Options',
                    'Choose how you want to reorder this order:',
                    [
                        { text: 'Cancel', style: 'cancel' },
                        { text: 'Confirm Reorder', onPress: () => handleConfirmReorder(orderId, products) },
                        { text: 'Edit and Reorder', onPress: () => handleEditAndReorder(products, order) },
                    ]
                );
            } else {
                ToastAndroid.show('No products found in this order', ToastAndroid.SHORT);
            }
        } catch (error) {
            console.error('Error adding order to cart:', error);
            ToastAndroid.show('Failed to add order to cart', ToastAndroid.SHORT);
        }
    };

    const handleConfirmReorder = async (orderId, products) => {
        try {
            const order = orders.find(o => o.id === orderId);
            if (!order) {
                Toast.show({ type: 'error', text1: 'Order not found' });
                return;
            }
            const token = await AsyncStorage.getItem("userAuthToken");
            if (!token) {
                Toast.show({ type: 'error', text1: 'Authentication token missing' });
                return;
            }
            const productsPayload = products.map((product) => ({
                product_id: product.product_id,
                quantity: product.quantity,
                price: product.price,
                name: product.name,
                category: product.category || '',
                gst_rate: product.gst_rate || 0
            }));
            const response = await fetch(`http://${ipAddress}:8091/on-behalf-2`, {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    customer_id: order.customer_id,
                    order_type: order.order_type || 'AM',
                    products: productsPayload,
                }),
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.message || 'Failed to place reorder');
            Toast.show({ type: 'success', text1: 'Reorder placed successfully' });
            await fetchOrders(selectedDate);
        } catch (error) {
            console.error('Error placing reorder:', error);
            Toast.show({ type: 'error', text1: error.message || 'Failed to place reorder' });
        }
    };

    const handleEditAndReorder = (products, order) => {
        // Store products and customer in AsyncStorage for cart page
        const customerInfo = {
            customer_id: order.customer_id,
            name: customerNames[order.customer_id] || `Customer ${order.customer_id}`
        };
        const cartData = {
            customer: customerInfo,
            products: products.map(product => ({
                product_id: product.product_id,
                id: product.product_id,
                name: product.name,
                price: product.price,
                quantity: product.quantity,
                image: product.image || null,
                category: product.category || '',
                gst_rate: product.gst_rate || 0
            }))
        };
        AsyncStorage.setItem('ownerCart', JSON.stringify(cartData.products));
        AsyncStorage.setItem('ownerCartCustomer', JSON.stringify(customerInfo));
        navigation.navigate('OwnerCartPage', { customer: customerInfo, products: products });
    };

    const renderOrderDetails = (orderId) => {
        const products = orderDetails[orderId];
        console.log('Rendering details for order:', orderId, 'Expanded:', expandedOrderDetailsId, 'Products:', products);
        
        if (expandedOrderDetailsId !== orderId || !products) {
            return null;
        }
        
        return (
            <View style={detailStyles.orderDetailsContainer}>
                <View style={detailStyles.headerRow}>
                    <View style={detailStyles.imageHeader}>
                        <Text style={detailStyles.headerCell}></Text>
                    </View>
                    <View style={detailStyles.productNameHeader}>
                        <Text style={detailStyles.headerCell}>Product</Text>
                    </View>
                    <View style={detailStyles.qtyHeader}>
                        <Text style={detailStyles.headerCell}>Qty</Text>
                    </View>
                    <View style={detailStyles.priceHeader}>
                        <Text style={detailStyles.headerCell}>Price</Text>
                    </View>
                </View>
                {products.length > 0 ? (
                    products.map((product, index) => {
                        const prodData = allProductsMap.get(product.product_id);
                        const imageUrl = prodData && prodData.image ? `http://${ipAddress}:8091/images/products/${prodData.image}` : null;
                        return (
                            <View key={`${orderId}-${product.product_id}-${index}`} style={detailStyles.productRow}>
                                <View style={detailStyles.imageColumn}>
                                    <View style={detailStyles.productImageBox}>
                                        {imageUrl ? (
                                            <Image
                                                source={{ uri: imageUrl }}
                                                style={detailStyles.productImage}
                                                resizeMode="contain"
                                                onError={(e) => console.log('Order item image load error:', e.nativeEvent.error, prodData?.image)}
                                            />
                                        ) : (
                                            <View style={detailStyles.productImagePlaceholder}>
                                                <MaterialIcons name="image-not-supported" size={24} color="#9E9E9E" />
                                            </View>
                                        )}
                                    </View>
                                </View>
                                <View style={detailStyles.productNameColumn}>
                                    <Text 
                                        style={detailStyles.productNameText}
                                        numberOfLines={2}
                                        ellipsizeMode="tail"
                                    >
                                        {product.name || (prodData?.name || 'Product Name')}
                                    </Text>
                                </View>
                                <View style={detailStyles.qtyColumn}>
                                    <Text style={detailStyles.qtyText}>{product.quantity}</Text>
                                </View>
                                <View style={detailStyles.priceColumn}>
                                    <Text style={detailStyles.priceText}>₹{product.price}</Text>
                                </View>
                            </View>
                        );
                    })
                ) : (
                    <Text style={detailStyles.noProductsText}>No products found.</Text>
                )}
            </View>
        );
    };

    const getStatusColor = (status) => {
        if (!status) return '#9E9E9E'; // Default color for null/undefined status
        
        switch (status.toLowerCase()) {
            case 'approved': return '#4CAF50';
            case 'pending': return '#FF9800';
            case 'rejected': return '#F44336';
            case 'delivered': return '#2196F3';
            case 'cancelled': return '#9E9E9E';
            default: return '#003366';
        }
    };

    if (loading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#003366" />
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.headerTitle}>Order History</Text>
                <View style={styles.headerActions}>
                    <TouchableOpacity 
                        style={styles.dateFilterButton} 
                        onPress={showDatePicker}
                        activeOpacity={0.7}
                    >
                        <MaterialIcons name="calendar-today" size={18} color="#fff" />
                        <Text style={styles.dateFilterText}>
                            {moment(selectedDate).format('MMM D, YYYY')}
                        </Text>
                    </TouchableOpacity>
                </View>
            </View>

            <DateTimePickerModal
                isVisible={isDatePickerVisible}
                mode="date"
                onConfirm={handleConfirm}
                onCancel={hideDatePicker}
                date={selectedDate}
            />

            <ScrollView contentContainerStyle={styles.scrollContainer}>
                {orders.length === 0 ? (
                    <View style={styles.emptyState}>
                        <MaterialIcons name="receipt" size={60} color="#003366" />
                        <Text style={styles.emptyStateText}>No orders found for selected date</Text>
                    </View>
                ) : (
                    orders.map((order) => (
                        <View key={order.id} style={styles.orderCard}>
                            <View style={styles.orderHeader}>
                                <View>
                                    <Text style={styles.orderId}>Order #{order.id}</Text>
                                    <Text style={styles.orderCustomer}>Customer: {customerNames[order.customer_id] || `ID: ${order.customer_id}`}</Text>
                                    <Text style={styles.orderDate}>
                                        {moment.unix(order.placed_on).format('MMM D, YYYY [at] h:mm A')}
                                    </Text>
                                </View>
                                <Text style={[styles.orderStatus, { backgroundColor: getStatusColor(order.approve_status) }]}> 
                                    {(order.approve_status || 'pending').toUpperCase()}
                                </Text>
                            </View>

                            <View style={styles.orderSummary}>
                                <Text style={styles.orderTotal}>₹{order.total_amount}</Text>
                                <Text style={styles.orderType}>{order.order_type}</Text>
                            </View>

                            <View style={styles.orderFooter}>
                                <Text style={styles.deliveryStatus}>
                                    Delivery: <Text style={{ color: getStatusColor(order.delivery_status) }}>
                                        {(order.delivery_status || 'pending').toUpperCase()}
                                    </Text>
                                </Text>
                                <View style={styles.orderActions}>
                                    <TouchableOpacity 
                                        onPress={() => handleReorder(order.id)}
                                        style={styles.reorderButton}
                                        activeOpacity={0.7}
                                    >
                                        <MaterialIcons name="replay" size={16} color="#10B981" />
                                        <Text style={styles.reorderButtonText}>Reorder</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity 
                                        onPress={() => handleOrderDetailsPress(order.id)}
                                        style={styles.detailsButton}
                                        activeOpacity={0.7}
                                    >
                                        <Text style={styles.detailsButtonText}>
                                            {expandedOrderDetailsId === order.id ? 'HIDE DETAILS' : 'VIEW DETAILS'}
                                        </Text>
                                        <MaterialIcons 
                                            name={expandedOrderDetailsId === order.id ? "expand-less" : "expand-more"} 
                                            size={16} 
                                            color="#003366" 
                                        />
                                    </TouchableOpacity>
                                </View>
                            </View>

                            {renderOrderDetails(order.id)}
                        </View>
                    ))
                )}
            </ScrollView>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f5f7fa',
    },
    header: {
        backgroundColor: '#003366',
        padding: 20,
        paddingBottom: 15,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    headerTitle: {
        color: '#fff',
        fontSize: 22,
        fontWeight: '600',
        marginBottom: 15,
    },
    headerActions: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    dateFilterButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderRadius: 20,
    },
    dateFilterText: {
        color: '#fff',
        marginLeft: 8,
        fontSize: 14,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: '#f5f7fa',
    },
    scrollContainer: {
        padding: 15,
        paddingBottom: 25,
    },
    emptyState: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 80,
    },
    emptyStateText: {
        marginTop: 15,
        fontSize: 16,
        color: '#003366',
        opacity: 0.7,
    },
    orderCard: {
        backgroundColor: '#fff',
        borderRadius: 10,
        marginBottom: 15,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 2,
        overflow: 'hidden',
    },
    orderHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        padding: 15,
        borderBottomWidth: 1,
        borderBottomColor: '#f0f0f0',
    },
    orderId: {
        fontSize: 16,
        fontWeight: '600',
        color: '#003366',
    },
    orderCustomer: {
        fontSize: 13,
        color: '#666',
        marginTop: 3,
    },
    orderDate: {
        fontSize: 12,
        color: '#666',
        marginTop: 3,
    },
    orderStatus: {
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
        color: '#fff',
        fontSize: 12,
        fontWeight: '600',
        alignSelf: 'flex-start',
    },
    orderSummary: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 15,
        paddingBottom: 10,
    },
    orderTotal: {
        fontSize: 18,
        fontWeight: '700',
        color: '#003366',
    },
    orderType: {
        fontSize: 14,
        color: '#666',
        fontStyle: 'italic',
    },
    orderFooter: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 15,
        paddingTop: 0,
    },
    deliveryStatus: {
        fontSize: 13,
        color: '#666',
    },
    detailsButton: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    detailsButtonText: {
        color: '#003366',
        fontWeight: '600',
        marginRight: 5,
        fontSize: 14,
    },
    orderActions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    reorderButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F0FDF4',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#10B981',
    },
    reorderButtonText: {
        color: '#10B981',
        fontWeight: '600',
        marginLeft: 4,
        fontSize: 12,
    },
});

const detailStyles = StyleSheet.create({
    orderDetailsContainer: {
        backgroundColor: '#f9fafc',
        padding: 15,
        borderTopWidth: 1,
        borderTopColor: '#f0f0f0',
    },
    headerRow: {
        flexDirection: 'row',
        paddingBottom: 12,
        marginBottom: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#e0e0e0',
        alignItems: 'center',
    },
    headerCell: {
        fontSize: 13,
        fontWeight: '600',
        color: '#003366',
        textAlign: 'left',
    },
    imageHeader: {
        width: 56,
        alignItems: 'center',
    },
    productNameHeader: {
        flex: 2,
        paddingHorizontal: 8,
    },
    qtyHeader: {
        width: 60,
        alignItems: 'center',
    },
    priceHeader: {
        width: 80,
        alignItems: 'flex-end',
    },
    productRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#f0f0f0',
        minHeight: 60,
    },
    imageColumn: {
        width: 56,
        alignItems: 'center',
    },
    productNameColumn: {
        flex: 2,
        paddingHorizontal: 8,
        justifyContent: 'center',
    },
    qtyColumn: {
        width: 60,
        alignItems: 'center',
    },
    priceColumn: {
        width: 80,
        alignItems: 'flex-end',
    },
    productImageBox: { 
        width: 44, 
        height: 44, 
        borderRadius: 8, 
        backgroundColor: '#F5F5F5', 
        justifyContent: 'center', 
        alignItems: 'center', 
        overflow: 'hidden' 
    },
    productImage: { 
        width: 40, 
        height: 40, 
        borderRadius: 6 
    },
    productImagePlaceholder: { 
        width: 40, 
        height: 40, 
        borderRadius: 6, 
        backgroundColor: '#e0e0e0', 
        justifyContent: 'center', 
        alignItems: 'center' 
    },
    productNameText: {
        fontSize: 14,
        color: '#333',
        fontWeight: '500',
        lineHeight: 18,
    },
    qtyText: {
        fontSize: 14,
        color: '#555',
        fontWeight: '500',
    },
    priceText: {
        fontSize: 14,
        color: '#003366',
        fontWeight: '600',
    },
    noProductsText: {
        fontSize: 14,
        color: '#777',
        textAlign: 'center',
        marginTop: 10,
    }
});

export default OrderHistoryOwner;