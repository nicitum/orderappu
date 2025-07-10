import React, { useEffect, useState, useCallback } from "react";
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
import MaterialIcons from "react-native-vector-icons/MaterialIcons";
import Toast from 'react-native-toast-message';

const AdminOrderHistory = ({ route }) => {
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const navigation = useNavigation();
    const [expandedOrderDetailsId, setExpandedOrderDetailsId] = useState(null);
    const [orderDetails, setOrderDetails] = useState({});
    const [isDatePickerVisible, setDatePickerVisibility] = useState(false);
    const [selectedDate, setSelectedDate] = useState(new Date());
    const [customerNames, setCustomerNames] = useState({});
    const [allProductsData, setAllProductsData] = useState([]);
    const [loadingCustomerNames, setLoadingCustomerNames] = useState(false);

    // Get navigation parameters
    const expandedOrderId = route?.params?.expandedOrderId;
    const initialSelectedDate = route?.params?.selectedDate;

    // Cart functions (local implementation)
    const addOrderToCart = (orderProducts) => {
        // This will be handled by AdminCartPage when navigating
        console.log('Adding order to cart:', orderProducts);
    };

    const clearCart = () => {
        // This will be handled by AdminCartPage
        console.log('Clearing cart');
    };

    const setSelectedCustomer = (customer) => {
        // This will be handled by AdminCartPage
        console.log('Setting selected customer:', customer);
    };

    const addToCart = (product) => {
        // This will be handled by AdminCartPage
        console.log('Adding to cart:', product);
    };

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
            const decodedToken = jwtDecode(token);
            const adminId = decodedToken.id1;

            // Format the dateFilter as YYYY-MM-DD if provided, otherwise use today's date
            const formattedDate = dateFilter ? moment(dateFilter).format("YYYY-MM-DD") : moment().format("YYYY-MM-DD");

            // Construct the URL with the date query parameter
            const baseUrl = `http://${ipAddress}:8091/get-admin-orders/${adminId}`;
            const url = `${baseUrl}?date=${formattedDate}`;

            const headers = {
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json",
            };

            console.log("FETCH ADMIN ORDERS - Request URL:", url);
            console.log("FETCH ADMIN ORDERS - Request Headers:", headers);

            const ordersResponse = await fetch(url, { headers });

            console.log("FETCH ADMIN ORDERS - Response Status:", ordersResponse.status);
            console.log("FETCH ADMIN ORDERS - Response Status Text:", ordersResponse.statusText);

            if (!ordersResponse.ok) {
                const errorText = await ordersResponse.text();
                const message = `Failed to fetch admin orders. Status: ${ordersResponse.status}, Text: ${errorText}`;
                console.error("FETCH ADMIN ORDERS - Error Response Text:", errorText);
                throw new Error(message);
            }

            const ordersData = await ordersResponse.json();
            console.log("FETCH ADMIN ORDERS - Response Data:", ordersData);
            const fetchedOrders = ordersData.orders || [];

            // Set the orders directly since filtering is done on the backend
            setOrders(fetchedOrders);
            console.log('Fetched orders:', fetchedOrders);

            // Fetch customer names for all orders (non-blocking)
            if (fetchedOrders.length > 0) {
                fetchCustomerNamesForOrders(fetchedOrders);
            }

            // If we have an expanded order ID and the order exists in the fetched orders,
            // fetch its details automatically
            if (expandedOrderId && fetchedOrders.some(order => order.id === expandedOrderId)) {
                const products = await fetchOrderProducts(expandedOrderId);
                setOrderDetails((prevDetails) => ({ ...prevDetails, [expandedOrderId]: products }));
            }

        } catch (fetchOrdersError) {
            console.error("FETCH ADMIN ORDERS - Fetch Error:", fetchOrdersError);
            Alert.alert("Error", fetchOrdersError.message || "Failed to fetch admin orders.");
            setOrders([]); // Set empty array on error
        } finally {
            setLoading(false);
        }
    }, [expandedOrderId]);

    // Function to fetch all products for images
    const fetchAllProducts = useCallback(async () => {
        try {
            const token = await AsyncStorage.getItem("userAuthToken");
            if (!token) {
                throw new Error("Authentication token missing");
            }
            const response = await fetch(`http://${ipAddress}:8091/products`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            
            if (!response.ok) {
                throw new Error("Failed to fetch products");
            }
            
            const data = await response.json();
            setAllProductsData(data);
        } catch (error) {
            console.error("Error fetching all products:", error);
        }
    }, []);

    // Function to fetch customer name by customer ID
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

    // Function to fetch customer names for all orders
    const fetchCustomerNamesForOrders = async (ordersList) => {
        try {
            setLoadingCustomerNames(true);
            
            // Get unique customer IDs
            const uniqueCustomerIds = [...new Set(
                ordersList
                    .map(order => order.customer_id)
                    .filter(id => id)
            )];

            if (uniqueCustomerIds.length === 0) {
                setLoadingCustomerNames(false);
                return;
            }

            const token = await AsyncStorage.getItem("userAuthToken");
            if (!token) {
                setLoadingCustomerNames(false);
                return;
            }

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
        } finally {
            setLoadingCustomerNames(false);
        }
    };

    useFocusEffect(
        useCallback(() => {
            // Set initial date if provided from navigation
            if (initialSelectedDate) {
                setSelectedDate(initialSelectedDate);
            }
            
            fetchAllProducts(); // Fetch all products for images
            fetchOrders(initialSelectedDate || new Date()); // Fetch orders for the specified date
            
            // Set expanded order if provided from navigation
            if (expandedOrderId) {
                setExpandedOrderDetailsId(expandedOrderId);
            }
            
            return () => {};
        }, [fetchOrders, fetchAllProducts, expandedOrderId, initialSelectedDate])
    );

    const fetchOrderProducts = async (orderId) => {
        try {
            const token = await AsyncStorage.getItem("userAuthToken");
            if (!token) {
                throw new Error("No authorization token found.");
            }

            const response = await axios.get(
                `http://${ipAddress}:8091/order-products?orderId=${orderId}`,
                { headers: { Authorization: `Bearer ${token}` } }
            );
            return response.data;
        } catch (error) {
            console.error("Error fetching order products:", error);
            Toast.show({
                type: 'error',
                text1: 'Error',
                text2: 'Failed to fetch order details'
            });
            return [];
        }
    };

    const handleOrderDetailsPress = async (orderId) => {
        if (expandedOrderDetailsId === orderId) {
            setExpandedOrderDetailsId(null);
        } else {
            setExpandedOrderDetailsId(orderId);
            if (!orderDetails[orderId]) {
                const products = await fetchOrderProducts(orderId);
                setOrderDetails((prevDetails) => ({ ...prevDetails, [orderId]: products }));
            }
        }
    };

    const handleReorder = async (orderId) => {
        try {
            const products = await fetchOrderProducts(orderId);
            if (products && products.length > 0) {
                // Find the order object for this orderId
                const order = orders.find(o => o.id === orderId);
                if (!order) {
                    Toast.show({
                        type: 'error',
                        text1: 'Error',
                        text2: 'Order not found'
                    });
                    return;
                }
                
                // Show popup with 2 options
                Alert.alert(
                    'Reorder Options',
                    'Choose how you want to reorder this order:',
                    [
                        {
                            text: 'Cancel',
                            style: 'cancel'
                        },
                        {
                            text: 'Confirm Reorder',
                            onPress: () => handleConfirmReorder(orderId, products)
                        },
                        {
                            text: 'Edit and Reorder',
                            onPress: () => handleEditAndReorder(products, order)
                        }
                    ]
                );
            } else {
                Toast.show({
                    type: 'error',
                    text1: 'Error',
                    text2: 'No products found in this order'
                });
            }
        } catch (error) {
            console.error('Error adding order to cart:', error);
            Toast.show({
                type: 'error',
                text1: 'Error',
                text2: 'Failed to add order to cart'
            });
        }
    };

    const handleConfirmReorder = async (orderId, products) => {
        try {
            console.log('DEBUG: handleConfirmReorder called with orderId:', orderId, 'products:', products);
            
            // Get the order details to get customer_id
            const order = orders.find(o => o.id === orderId);
            if (!order) {
                console.log('DEBUG: Order not found for ID:', orderId);
                Toast.show({
                    type: 'error',
                    text1: 'Error',
                    text2: 'Order not found'
                });
                return;
            }

            console.log('DEBUG: Found order:', order);

            const token = await AsyncStorage.getItem("userAuthToken");
            if (!token) {
                console.log('DEBUG: No auth token found');
                Toast.show({
                    type: 'error',
                    text1: 'Error',
                    text2: 'Authentication token missing'
                });
                return;
            }

            // Prepare products for on-behalf-2 API
            const productsPayload = products.map((product) => ({
                product_id: product.product_id,
                quantity: product.quantity,
                price: product.price,
                name: product.name,
                category: product.category || '',
                gst_rate: product.gst_rate || 0
            }));

            console.log('DEBUG: Products payload:', productsPayload);

            // Call on-behalf-2 API for fresh orders
            const response = await fetch(`http://${ipAddress}:8091/on-behalf-2`, {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    customer_id: order.customer_id,
                    order_type: order.order_type || 'AM', // Use the original order type or default to AM
                    products: productsPayload,
                }),
            });

            console.log('DEBUG: API response status:', response.status);
            const data = await response.json();
            console.log('DEBUG: API response data:', data);

            if (!response.ok) {
                throw new Error(data.message || 'Failed to place reorder');
            }

            console.log('DEBUG: About to show success toast');
            Toast.show({
                type: 'success',
                text1: 'Reorder Placed',
                text2: `Order has been successfully reordered with ${productsPayload.length} products`
            });
            console.log('DEBUG: Success toast should have been shown');

            // Refresh the orders list to show the new reorder
            console.log('DEBUG: About to refresh orders');
            await fetchOrders(selectedDate);
            console.log('DEBUG: Orders refreshed');
        } catch (error) {
            console.error('DEBUG: Error placing reorder:', error);
            Toast.show({
                type: 'error',
                text1: 'Reorder Failed',
                text2: error.message || 'Failed to place reorder'
            });
        }
    };

    const handleEditAndReorder = (products, order) => {
        // Navigate to AdminCartPage with customer info and products
        const customerInfo = {
            cust_id: order.customer_id,
            name: customerNames[order.customer_id] || `Customer ${order.customer_id}`
        };
        
        // Store the products in AsyncStorage for AdminCartPage to load
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
        
        AsyncStorage.setItem('adminCart', JSON.stringify(cartData.products));
        AsyncStorage.setItem('adminCartCustomer', JSON.stringify(customerInfo));
        
        navigation.navigate('AdminCartPage', { 
            customer: customerInfo,
            products: products 
        });
    };

    const renderOrderDetails = (orderId) => {
        const products = orderDetails[orderId];
        const allProductsMap = new Map(allProductsData.map(p => [p.id, p]));
        if (!expandedOrderDetailsId || expandedOrderDetailsId !== orderId || !products) {
            return null;
        }

        return (
            <View style={detailStyles.orderDetailsContainer}>
                <Text style={detailStyles.orderDetailsTitle}>Order Items</Text>

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
               
                <View style={styles.headerActions}>
                    <TouchableOpacity 
                        style={styles.dateFilterButton} 
                        onPress={showDatePicker}
                        activeOpacity={0.7}
                    >
                        <Ionicons name="calendar" size={18} color="#fff" />
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
                        <Ionicons name="receipt-outline" size={60} color="#003366" />
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
                                        <Ionicons 
                                            name={expandedOrderDetailsId === order.id ? "chevron-up" : "chevron-down"} 
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
});

const detailStyles = StyleSheet.create({
    orderDetailsContainer: {
        backgroundColor: '#f9fafc',
        padding: 15,
        borderTopWidth: 1,
        borderTopColor: '#f0f0f0',
    },
    orderDetailsTitle: {
        fontSize: 15,
        fontWeight: '600',
        color: '#003366',
        marginBottom: 15,
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

export default AdminOrderHistory;