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
    Modal,
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
    const [fromDate, setFromDate] = useState(new Date());
    const [toDate, setToDate] = useState(new Date());
    const [isFromPickerVisible, setFromPickerVisible] = useState(false);
    const [isToPickerVisible, setToPickerVisible] = useState(false);
    const [customerNames, setCustomerNames] = useState({});
    const [allProductsData, setAllProductsData] = useState([]);
    const [showFilterModal, setShowFilterModal] = useState(false);
    const [selectedFilters, setSelectedFilters] = useState({
      delivery: 'All',
      cancelled: 'All',
      acceptance: 'All'
    });

    // New state for due date picker in reorder
    const [showDueDateModal, setShowDueDateModal] = useState(false);
    const [selectedDueDate, setSelectedDueDate] = useState(() => {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        return tomorrow;
    });
    const [isDatePickerVisible, setIsDatePickerVisible] = useState(false);
    const [pendingReorderOrderId, setPendingReorderOrderId] = useState(null);
    const [pendingReorderProducts, setPendingReorderProducts] = useState([]);

    // New state for API-based due date configuration
    const [defaultDueOn, setDefaultDueOn] = useState(1);
    const [maxDueOn, setMaxDueOn] = useState(30);

    // Get navigation parameters
    const expandedOrderId = route?.params?.expandedOrderId;
    const initialSelectedDate = route?.params?.selectedDate;

    // Monitor state changes for debugging
    useEffect(() => {
        console.log('State changed - defaultDueOn:', defaultDueOn, 'maxDueOn:', maxDueOn);
    }, [defaultDueOn, maxDueOn]);

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

    const showFromPicker = () => setFromPickerVisible(true);
    const hideFromPicker = () => setFromPickerVisible(false);
    const showToPicker = () => setToPickerVisible(true);
    const hideToPicker = () => setToPickerVisible(false);

    const handleConfirmFrom = (date) => {
        hideFromPicker();
        const normalized = new Date(date.getFullYear(), date.getMonth(), date.getDate());
        setFromDate(normalized);
        if (normalized > toDate) setToDate(normalized);
    };

    const handleConfirmTo = (date) => {
        hideToPicker();
        const normalized = new Date(date.getFullYear(), date.getMonth(), date.getDate());
        const newToDate = normalized < fromDate ? fromDate : normalized;
        setToDate(newToDate);
    };

    const getFilteredOrders = () => {
      return orders.filter(order => {
        // Delivery filter
        if (selectedFilters.delivery !== 'All' && order.delivery_status !== selectedFilters.delivery) {
          return false;
        }
        
        // Cancelled filter
        if (selectedFilters.cancelled !== 'All') {
          const isCancelled = order.cancelled === 'Yes';
          if (selectedFilters.cancelled === 'Cancelled' && !isCancelled) {
            return false;
          }
          if (selectedFilters.cancelled === 'Active' && isCancelled) {
            return false;
          }
        }
        
        // Acceptance filter
        if (selectedFilters.acceptance !== 'All') {
          if (selectedFilters.acceptance === 'Accepted' && order.approve_status !== 'Accepted') {
            return false;
          }
          if (selectedFilters.acceptance === 'Rejected' && order.approve_status !== 'Rejected') {
            return false;
          }
          if (selectedFilters.acceptance === 'Pending' && order.approve_status !== 'Pending' && order.approve_status !== null && order.approve_status !== undefined) {
            return false;
          }
        }
        
        return true;
      });
    };

    const handleFilterChange = (filterType, value) => {
      setSelectedFilters(prev => ({
        ...prev,
        [filterType]: value
      }));
    };

    const clearAllFilters = () => {
      setSelectedFilters({
        delivery: 'All',
        cancelled: 'All',
        acceptance: 'All'
      });
    };

    const getActiveFiltersCount = () => {
      return Object.values(selectedFilters).filter(value => value !== 'All').length;
    };

    const fetchOrders = useCallback(async (customFromDate = null, customToDate = null) => {
        setLoading(true);
        try {
            const token = await AsyncStorage.getItem("userAuthToken");
            const decodedToken = jwtDecode(token);
            const adminId = decodedToken.id1;

            const from = moment(customFromDate || fromDate).format("YYYY-MM-DD");
            const to = moment(customToDate || toDate).format("YYYY-MM-DD");

            const baseUrl = `http://${ipAddress}:8091/get-admin-orders/${adminId}`;
            const url = `${baseUrl}?from=${from}&to=${to}`;

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
    }, [expandedOrderId]); // Remove date dependencies

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

    // Fetch client status for due date configuration
    const fetchClientStatus = async () => {
        try {
            console.log('Fetching client status...');
            const response = await fetch(`http://147.93.110.150:3001/api/client_status/APPU0009`, {
                method: 'GET',
                headers: {
                    'Cache-Control': 'no-cache',
                    'Pragma': 'no-cache'
                }
            });

            console.log('Response status:', response.status);
            if (response.ok) {
                const responseData = await response.json();
                console.log('API Response data:', responseData);
                
                // Extract data from the nested structure
                const data = responseData.data && responseData.data[0];
                console.log('Extracted client data:', data);
                
                if (data) {
                    // Update due date configuration based on API response
                    const newDefaultDueOn = data.default_due_on || 1;
                    const newMaxDueOn = data.max_due_on || 30;
                    
                    console.log('Setting defaultDueOn to:', newDefaultDueOn);
                    console.log('Setting maxDueOn to:', newMaxDueOn);
                    
                    setDefaultDueOn(newDefaultDueOn);
                    setMaxDueOn(newMaxDueOn);
                    
                    // Update selected due date based on default_due_on
                    const newDefaultDate = new Date();
                    if (newDefaultDueOn > 0) {
                        newDefaultDate.setDate(newDefaultDate.getDate() + newDefaultDueOn);
                    }
                    console.log('Setting selectedDueDate to:', newDefaultDate);
                    setSelectedDueDate(newDefaultDate);
                } else {
                    console.log('No client data found in response');
                }
            } else {
                console.log('API response not ok:', response.status);
            }
        } catch (error) {
            console.error('Error fetching client status:', error);
            // Keep default values if API fails
        }
    };

    // Function to fetch customer name by customer ID
    const fetchCustomerName = async (customerId) => {
        try {
            console.log(`Fetching customer name for ID: ${customerId}`);
            const token = await AsyncStorage.getItem("userAuthToken");
            const response = await fetch(`http://${ipAddress}:8091/fetch-names?customer_id=${customerId}`, {
                headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "application/json",
                },
            });

            if (!response.ok) {
                console.error(`Failed to fetch customer name for ID ${customerId}, Status: ${response.status}`);
                return null;
            }

            const data = await response.json();
            console.log(`Customer name response for ID ${customerId}:`, data);
            
            // Check different possible response formats
            const customerName = data.username || data.name || data.customer_name || data.customerName || data.Name || data.NAME;
            console.log(`Extracted customer name for ID ${customerId}:`, customerName);
            return customerName;
        } catch (error) {
            console.error(`Error fetching customer name for ID ${customerId}:`, error);
            return null;
        }
    };

    // Simple function to get customer name and cache it
    const getCustomerName = async (customerId) => {
        if (customerNames[customerId]) {
            return customerNames[customerId];
        }
        
        const name = await fetchCustomerName(customerId);
        return name;
    };

    useFocusEffect(
        useCallback(() => {
            let isMounted = true;
            
            const initializeData = async () => {
                if (initialSelectedDate) {
                    const d = new Date(initialSelectedDate);
                    setFromDate(d);
                    setToDate(d);
                }

                if (isMounted) {
                    await fetchAllProducts();
                    await fetchClientStatus(); // Fetch due date configuration
                    // Only fetch orders if we don't have any yet
                    if (orders.length === 0) {
                        await fetchOrders(fromDate, toDate);
                    }
                }

                // Set expanded order if provided from navigation
                if (expandedOrderId && isMounted) {
                    setExpandedOrderDetailsId(expandedOrderId);
                }
            };
            
            initializeData();
            
            return () => {
                isMounted = false;
            };
        }, [fetchAllProducts, expandedOrderId, initialSelectedDate, orders.length])
    );

    // Fetch customer names when orders change
    useEffect(() => {
        let isMounted = true;
        let isExecuting = false;
        
        const fetchCustomerNames = async () => {
            if (isExecuting) return; // Prevent multiple executions
            isExecuting = true;
            
            console.log('=== FETCHING CUSTOMER NAMES ===');
            console.log('Orders:', orders.length);
            console.log('Current customerNames keys:', Object.keys(customerNames));
            
            if (orders.length > 0 && isMounted) {
                const customerIdsToFetch = [];
                for (const order of orders) {
                    console.log(`Processing order ${order.id}, customer_id: ${order.customer_id}`);
                    if (order.customer_id && !customerNames[order.customer_id]) {
                        customerIdsToFetch.push(order.customer_id);
                    }
                }
                
                console.log('Customer IDs to fetch:', customerIdsToFetch);
                
                // Fetch all customer names at once and batch update state
                const newCustomerNames = {};
                for (const customerId of customerIdsToFetch) {
                    if (isMounted) {
                        console.log(`Fetching name for customer_id: ${customerId}`);
                        const name = await getCustomerName(customerId);
                        if (name) {
                            newCustomerNames[customerId] = name;
                        }
                    }
                }
                
                // Batch update customer names state
                if (isMounted && Object.keys(newCustomerNames).length > 0) {
                    console.log('Updating customer names with:', newCustomerNames);
                    setCustomerNames(prev => ({ ...prev, ...newCustomerNames }));
                }
            }
            console.log('=== CUSTOMER NAMES FETCH COMPLETE ===');
            isExecuting = false;
        };
        
        fetchCustomerNames();
        
        return () => {
            isMounted = false;
        };
    }, [orders]); // Only depend on orders, not customerNames

    // Refetch orders when dates change (but not on initial load)
    useEffect(() => {
        // Only refetch if we have orders (meaning initial load is complete)
        if (orders.length > 0) {
            fetchOrders(fromDate, toDate);
        }
    }, [fromDate, toDate]);

    // Initial fetch of orders
    useEffect(() => {
        fetchOrders(fromDate, toDate);
    }, []); // Empty dependency array - only run once on mount

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

    const showDatePicker = () => setIsDatePickerVisible(true);
    const hideDatePicker = () => setIsDatePickerVisible(false);

    const handleConfirmDate = (date) => {
        hideDatePicker();
        setSelectedDueDate(date);
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
                            onPress: () => {
                                // Set pending reorder data and show due date modal
                                setPendingReorderOrderId(orderId);
                                setPendingReorderProducts(products);
                                // Reset due date based on API default_due_on value
                                const newDefaultDate = new Date();
                                if (defaultDueOn > 0) {
                                    newDefaultDate.setDate(newDefaultDate.getDate() + defaultDueOn);
                                }
                                setSelectedDueDate(newDefaultDate);
                                setShowDueDateModal(true);
                            }
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

    const handleConfirmDueDate = () => {
        // Close modal and proceed with reorder
        setShowDueDateModal(false);
        if (pendingReorderOrderId && pendingReorderProducts.length > 0) {
            handleConfirmReorder(pendingReorderOrderId, pendingReorderProducts);
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

            // Call on-behalf-2 API for fresh orders with due_on parameter
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
                    entered_by: jwtDecode(token).username,
                    due_on: moment(selectedDueDate).format('YYYY-MM-DD') // Add due_on parameter
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
                text2: `Order has been successfully reordered with ${productsPayload.length} products for delivery on ${moment(selectedDueDate).format('DD MMM, YYYY')}`
            });
            console.log('DEBUG: Success toast should have been shown');

            // Refresh the orders list to show the new reorder
            console.log('DEBUG: About to refresh orders');
            await fetchOrders();
            console.log('DEBUG: Orders refreshed');

            // Reset pending reorder data
            setPendingReorderOrderId(null);
            setPendingReorderProducts([]);
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
        switch (status?.toLowerCase()) {
            case "delivered":
                return "#4CAF50";
            case "out for delivery":
                return "#2196F3";
            case "processing":
                return "#FF9800";
            case "objection":
                return "#F44336";
            case "pending":
                return "#9E9E9E";
            default:
                return "#9E9E9E";
        }
    };

    const getConsolidatedStatus = (order) => {
      if (order.cancelled === 'Yes') {
        return { text: 'CANCELLED', color: '#DC2626' };
      }
      switch (order.approve_status?.toLowerCase()) {
        case 'rejected':
          return { text: 'REJECTED', color: '#DC2626' };
        case 'approved': // Covers 'approved' from backend
        case 'accepted': // Covers potential frontend states
          return { text: 'ACCEPTED', color: '#10B981' };
        case 'pending':
        default:
          return { text: 'PENDING', color: '#F59E0B' };
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
               <View style={styles.headerLeft}>
                 <View style={{ flexDirection: 'row', gap: 8 }}>
                   <TouchableOpacity 
                       style={styles.dateFilterButton} 
                       onPress={showFromPicker}
                       activeOpacity={0.7}
                   >
                       <Ionicons name="calendar" size={18} color="#fff" />
                       <Text style={styles.dateFilterText}>
                           {moment(fromDate).format('MMM D, YYYY')}
                       </Text>
                   </TouchableOpacity>
                   <TouchableOpacity 
                       style={styles.dateFilterButton} 
                       onPress={showToPicker}
                       activeOpacity={0.7}
                   >
                       <Ionicons name="calendar" size={18} color="#fff" />
                       <Text style={styles.dateFilterText}>
                           {moment(toDate).format('MMM D, YYYY')}
                       </Text>
                   </TouchableOpacity>
                 </View>
                </View>

                <View style={styles.headerRight}>
                  <TouchableOpacity
                    style={styles.filterButton}
                    onPress={() => setShowFilterModal(true)}
                    activeOpacity={0.7}
                  >
                    <MaterialIcons name="filter-list" size={20} color="#fff" />
                    {getActiveFiltersCount() > 0 && (
                      <View style={styles.filterBadge}>
                        <Text style={styles.filterBadgeText}>{getActiveFiltersCount()}</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                </View>
            </View>

            <DateTimePickerModal
                isVisible={isFromPickerVisible}
                mode="date"
                onConfirm={handleConfirmFrom}
                onCancel={hideFromPicker}
                date={fromDate}
            />
            <DateTimePickerModal
                isVisible={isToPickerVisible}
                mode="date"
                onConfirm={handleConfirmTo}
                onCancel={hideToPicker}
                date={toDate}
            />

            {/* Filter Modal */}
            <Modal
              visible={showFilterModal}
              transparent
              animationType="slide"
              onRequestClose={() => setShowFilterModal(false)}
            >
              <View style={styles.modalOverlay}>
                <View style={styles.filterModal}>
                  <View style={styles.filterModalHeader}>
                    <Text style={styles.filterModalTitle}>Filter Orders</Text>
                    <TouchableOpacity
                      onPress={() => setShowFilterModal(false)}
                      style={styles.closeButton}
                    >
                      <MaterialIcons name="close" size={24} color="#003366" />
                    </TouchableOpacity>
                  </View>

                  <ScrollView 
              style={styles.filterContent}
              showsVerticalScrollIndicator={true}
              nestedScrollEnabled={true}
            >
                                       {/* Delivery Filter */}
                   <View style={styles.filterSection}>
                     <Text style={styles.filterSectionTitle}>Delivery Status</Text>
                     <View style={styles.filterOptionsRow}>
                       {['All', 'pending', 'delivered', 'out for delivery', 'processing', 'objection'].map(status => (
                         <TouchableOpacity
                           key={status}
                           style={[
                             styles.filterOption,
                             selectedFilters.delivery === status && styles.filterOptionSelected
                           ]}
                           onPress={() => handleFilterChange('delivery', status)}
                         >
                           <Text style={[
                             styles.filterOptionText,
                             selectedFilters.delivery === status && styles.filterOptionTextSelected
                           ]}>
                             {status.toUpperCase()}
                           </Text>
                         </TouchableOpacity>
                       ))}
                     </View>
                   </View>

                                       {/* Acceptance Filter */}
                   <View style={styles.filterSection}>
                     <Text style={styles.filterSectionTitle}>Acceptance Status</Text>
                     <View style={styles.filterOptionsRow}>
                       {['All', 'Accepted', 'Rejected', 'Pending'].map(status => (
                         <TouchableOpacity
                           key={status}
                           style={[
                             styles.filterOption,
                             selectedFilters.acceptance === status && styles.filterOptionSelected
                           ]}
                           onPress={() => handleFilterChange('acceptance', status)}
                         >
                           <Text style={[
                             styles.filterOptionText,
                             selectedFilters.acceptance === status && styles.filterOptionTextSelected
                           ]}>
                             {status}
                           </Text>
                         </TouchableOpacity>
                       ))}
                     </View>
                   </View>

                   {/* Cancelled Filter */}
                   <View style={styles.filterSection}>
                     <Text style={styles.filterSectionTitle}>Order Status</Text>
                     <View style={styles.filterOptionsRow}>
                       {['All', 'Active', 'Cancelled'].map(status => (
                         <TouchableOpacity
                           key={status}
                           style={[
                             styles.filterOption,
                             selectedFilters.cancelled === status && styles.filterOptionSelected
                           ]}
                           onPress={() => handleFilterChange('cancelled', status)}
                         >
                           <Text style={[
                             styles.filterOptionText,
                             selectedFilters.cancelled === status && styles.filterOptionTextSelected
                           ]}>
                             {status}
                           </Text>
                         </TouchableOpacity>
                       ))}
                     </View>
                   </View>
                  </ScrollView>

                  <View style={styles.filterModalFooter}>
                    <TouchableOpacity
                      style={styles.clearFiltersButton}
                      onPress={clearAllFilters}
                    >
                      <Text style={styles.clearFiltersText}>Clear All Filters</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.applyFiltersButton}
                      onPress={() => setShowFilterModal(false)}
                    >
                      <Text style={styles.applyFiltersText}>Apply Filters</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            </Modal>

            {/* Due Date Modal for Reorder */}
            <Modal
                visible={showDueDateModal}
                transparent={true}
                animationType="slide"
                onRequestClose={() => setShowDueDateModal(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.dueDateModal}>
                        <View style={styles.dueDateModalHeader}>
                            <Text style={styles.dueDateModalTitle}>Select Due Date</Text>
                            <TouchableOpacity
                                onPress={() => setShowDueDateModal(false)}
                                style={styles.closeDueDateButton}
                            >
                                <MaterialIcons name="close" size={24} color="#003366" />
                            </TouchableOpacity>
                        </View>
                        
                        <View style={styles.dueDateContent}>
                            <Text style={styles.dueDateLabel}>
                                When should this reorder be delivered?
                            </Text>
                            
                            <TouchableOpacity
                                style={styles.datePickerButton}
                                onPress={showDatePicker}
                            >
                                <MaterialIcons name="calendar-today" size={20} color="#003366" />
                                <Text style={styles.datePickerButtonText}>
                                    {moment(selectedDueDate).format('DD MMM, YYYY')}
                                </Text>
                                <MaterialIcons name="keyboard-arrow-down" size={20} color="#003366" />
                            </TouchableOpacity>
                            
                            <Text style={styles.dueDateNote}>
                                Note: This date will be used by our delivery team to schedule the reorder delivery.
                            </Text>
                        </View>
                        
                        <View style={styles.dueDateModalFooter}>
                            <TouchableOpacity
                                style={styles.cancelDueDateButton}
                                onPress={() => setShowDueDateModal(false)}
                            >
                                <Text style={styles.cancelDueDateButtonText}>Cancel</Text>
                            </TouchableOpacity>
                            
                            <TouchableOpacity
                                style={styles.confirmDueDateButton}
                                onPress={handleConfirmDueDate}
                            >
                                <Text style={styles.confirmDueDateButtonText}>Confirm & Place Reorder</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* Date Picker Modal */}
            <DateTimePickerModal
                isVisible={isDatePickerVisible}
                mode="date"
                onConfirm={handleConfirmDate}
                onCancel={hideDatePicker}
                date={selectedDueDate}
                minimumDate={new Date()} // Can't select past dates
                maximumDate={(() => {
                    // Calculate maximum selectable date based on max_due_on
                    console.log('Calculating maximumDate, maxDueOn =', maxDueOn);
                    if (maxDueOn === 0) {
                        console.log('maxDueOn is 0, returning today only');
                        return new Date(); // Only today if max_due_on is 0
                    }
                    const maxDate = new Date();
                    // If max_due_on is 2, we want: today + tomorrow = 2 days total
                    // So we add (maxDueOn - 1) to get exactly maxDueOn days including today
                    maxDate.setDate(maxDate.getDate() + (maxDueOn - 1));
                    console.log('maxDueOn is', maxDueOn, ', setting max date to:', maxDate, '(allowing exactly', maxDueOn, 'days including today)');
                    return maxDate;
                })()}
            />

            <ScrollView contentContainerStyle={styles.scrollContainer}>
                {orders.length === 0 ? (
                    <View style={styles.emptyState}>
                        <Ionicons name="receipt-outline" size={60} color="#003366" />
                        <Text style={styles.emptyStateText}>No orders found for selected date</Text>
                    </View>
                ) : (
                    getFilteredOrders().map((order) => (
                        <View key={order.id} style={styles.orderCard}>
                            <View style={styles.orderHeader}>
                                <View>
                                    <Text style={styles.orderId}>Order #{order.id}</Text>
                                    <Text style={styles.orderCustomer}>
                                        {customerNames[order.customer_id] ? 
                                            customerNames[order.customer_id] : 
                                            `Loading... (ID: ${order.customer_id})`
                                        }
                                    </Text>
                                    <Text style={styles.orderDate}>
                                        {moment.unix(order.placed_on).format('MMM D, YYYY [at] h:mm A')}
                                    </Text>
                                    {order.entered_by && (
                    <Text style={styles.orderEnteredBy}>Entered By: {order.entered_by}</Text>
                  )}
                  {order.altered_by && (
                    <Text style={styles.orderEnteredBy}>Altered By: {order.altered_by}</Text>
                  )}
                                </View>
                                <View style={styles.statusContainer}>
                                    {/* Consolidated Status */}
                                    <View style={styles.statusRow}>
                                        <Text style={styles.statusLabel}>Status:</Text>
                                        <Text style={[styles.statusValue, { color: getConsolidatedStatus(order).color }]}>
                                            {getConsolidatedStatus(order).text}
                                        </Text>
                                    </View>
                                </View>
                            </View>

                            <View style={styles.orderSummary}>
                                <Text style={styles.orderTotal}>₹{order.total_amount ?? order.amount ?? 0}</Text>
                                <View style={styles.deliveryStatusContainer}>
                                    <Text style={styles.deliveryStatusLabel}>Delivery:</Text>
                                    <Text style={[styles.deliveryStatusValue, { color: getStatusColor(order.delivery_status) }]}>
                                        {(order.delivery_status || 'pending').toUpperCase()}
                                    </Text>
                                    <Text style={styles.deliveryDueDateLabel}>
                                        Delivery Due On: {moment.unix(order.due_on).format('MMM D, YYYY')}
                                    </Text>
                                </View>
                            </View>

                            <View style={styles.orderFooter}>
                                {/* Left side - Reorder Button */}
                                <TouchableOpacity
                                    style={styles.reorderButton}
                                    onPress={() => handleReorder(order.id)}
                                    activeOpacity={0.7}
                                >
                                    <MaterialIcons name="replay" size={16} color="#10B981" />
                                    <Text style={styles.reorderButtonText}>Reorder</Text>
                                </TouchableOpacity>

                                {/* Right side - Details button */}
                                <View style={styles.rightButtonsContainer}>
                                    <TouchableOpacity
                                        onPress={() => handleOrderDetailsPress(order.id)}
                                        style={styles.detailsButton}
                                        activeOpacity={0.7}
                                    >
                                        <Text style={styles.detailsButtonText}>
                                            {expandedOrderDetailsId === order.id ? 'HIDE DETAILS' : 'VIEW DETAILS'}
                                        </Text>
                                        <Ionicons
                                            name={expandedOrderDetailsId === order.id ? 'chevron-up' : 'chevron-down'}
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
        padding: 5,
        paddingBottom: 5,
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    headerLeft: {
      flex: 1,
    },
    headerRight: {
      alignItems: 'flex-end',
    },
    dateFilterButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
        paddingVertical: 6,
        paddingHorizontal: 8,
        borderRadius: 16,
        maxWidth: 120,
    },
    dateFilterText: {
        color: '#fff',
        marginLeft: 4,
        fontSize: 12,
        fontWeight: '500',
    },
    filterButton: {
      backgroundColor: "rgba(255, 255, 255, 0.2)",
      padding: 8,
      borderRadius: 20,
      position: 'relative',
    },
    filterBadge: {
      position: 'absolute',
      top: -5,
      right: -5,
      backgroundColor: '#DC2626',
      borderRadius: 10,
      width: 20,
      height: 20,
      justifyContent: 'center',
      alignItems: 'center',
    },
    filterBadgeText: {
      color: '#fff',
      fontSize: 10,
      fontWeight: '600',
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      justifyContent: 'flex-end',
    },
      filterModal: {
    backgroundColor: '#fff',
    borderRadius: 20,
    width: '95%',
    maxHeight: '85%',
    minHeight: 500,
  },
    filterModalHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: 20,
      borderBottomWidth: 1,
      borderBottomColor: '#E5E7EB',
    },
    filterModalTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: '#003366',
    },
    closeButton: {
      padding: 5,
    },
      filterContent: {
    padding: 20,
    paddingBottom: 120,
    maxHeight: 400,
  },
    filterSection: {
      marginBottom: 25,
    },
    filterOptionsRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    filterSectionTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: '#003366',
      marginBottom: 12,
    },
    filterOption: {
      paddingVertical: 10,
      paddingHorizontal: 14,
      borderRadius: 8,
      backgroundColor: '#F9FAFB',
      minWidth: 80,
      alignItems: 'center',
    },
    filterOptionSelected: {
      backgroundColor: '#003366',
    },
    filterOptionText: {
      fontSize: 14,
      color: '#374151',
    },
    filterOptionTextSelected: {
      color: '#fff',
      fontWeight: '600',
    },
      filterModalFooter: {
    flexDirection: 'row',
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    gap: 12,
    backgroundColor: '#fff',
  },
    clearFiltersButton: {
      flex: 1,
      paddingVertical: 12,
      paddingHorizontal: 16,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: '#DC2626',
      alignItems: 'center',
    },
    clearFiltersText: {
      color: '#DC2626',
      fontWeight: '600',
    },
    applyFiltersButton: {
      flex: 1,
      paddingVertical: 12,
      paddingHorizontal: 16,
      borderRadius: 8,
      backgroundColor: '#003366',
      alignItems: 'center',
    },
    applyFiltersText: {
      color: '#fff',
      fontWeight: '600',
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
    orderEnteredBy: {
        fontSize: 12,
        color: '#003366',
        fontWeight: 'bold',
        marginTop: 2,
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
        paddingHorizontal: 15,
        paddingBottom: 12,
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
    rightButtonsContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 16,
    },
    statusContainer: {
        alignItems: 'flex-end',
    },
    statusRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 2,
    },
    statusLabel: {
        fontSize: 10,
        color: '#666',
        marginRight: 4,
    },
    statusValue: {
        fontSize: 10,
        fontWeight: '600',
    },
    deliveryStatusContainer: {
        alignItems: 'flex-end',
    },
    deliveryStatusLabel: {
        fontSize: 12,
        color: '#666',
        marginBottom: 2,
    },
    deliveryStatusValue: {
        fontSize: 12,
        fontWeight: '600',
    },
    deliveryDueDateLabel: {
        fontSize: 13,
        color: '#003366',
        marginTop: 6,
        fontWeight: '700',
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

    // New styles for due date modal
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    dueDateModal: {
        backgroundColor: '#fff',
        borderRadius: 20,
        width: '90%',
        maxWidth: 400,
        elevation: 5,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
    },
    dueDateModalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 20,
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
    },
    dueDateModalTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#003366',
    },
    closeDueDateButton: {
        padding: 5,
    },
    dueDateContent: {
        padding: 20,
    },
    dueDateLabel: {
        fontSize: 16,
        color: '#4B5563',
        marginBottom: 20,
        textAlign: 'center',
        lineHeight: 22,
    },
    datePickerButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#F3F4F6',
        paddingVertical: 16,
        paddingHorizontal: 20,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#E5E7EB',
        marginBottom: 16,
    },
    datePickerButtonText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#111827',
        flex: 1,
        textAlign: 'center',
    },
    dueDateNote: {
        fontSize: 14,
        color: '#9CA3AF',
        textAlign: 'center',
        lineHeight: 20,
        fontStyle: 'italic',
    },
    dueDateModalFooter: {
        flexDirection: 'row',
        padding: 20,
        borderTopWidth: 1,
        borderTopColor: '#E5E7EB',
        gap: 12,
    },
    cancelDueDateButton: {
        flex: 1,
        paddingVertical: 14,
        paddingHorizontal: 16,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#E5E7EB',
        alignItems: 'center',
        backgroundColor: '#fff',
    },
    cancelDueDateButtonText: {
        color: '#4B5563',
        fontWeight: '600',
        fontSize: 16,
    },
    confirmDueDateButton: {
        flex: 1,
        paddingVertical: 14,
        paddingHorizontal: 16,
        borderRadius: 12,
        backgroundColor: '#003366',
        alignItems: 'center',
    },
    confirmDueDateButtonText: {
        color: '#fff',
        fontWeight: '600',
        fontSize: 16,
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