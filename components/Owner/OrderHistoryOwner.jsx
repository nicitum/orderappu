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
    const [showFilterModal, setShowFilterModal] = useState(false);
    const [selectedFilters, setSelectedFilters] = useState({
      delivery: 'All',
      cancelled: 'All',
      acceptance: 'All'
    });

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
        if (name) {
            setCustomerNames(prev => ({ ...prev, [customerId]: name }));
        }
        return name;
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

    // Fetch customer names when orders change
    useEffect(() => {
        const fetchCustomerNames = async () => {
            console.log('=== FETCHING CUSTOMER NAMES ===');
            console.log('Orders:', orders.length);
            console.log('Current customerNames:', customerNames);
            if (orders.length > 0) {
                for (const order of orders) {
                    console.log(`Processing order ${order.id}, customer_id: ${order.customer_id}`);
                    if (order.customer_id && !customerNames[order.customer_id]) {
                        console.log(`Fetching name for customer_id: ${order.customer_id}`);
                        await getCustomerName(order.customer_id);
                    }
                }
            }
            console.log('=== CUSTOMER NAMES FETCH COMPLETE ===');
        };
        
        fetchCustomerNames();
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

    const getAcceptanceStatusColor = (status) => {
      switch (status?.toLowerCase()) {
        case 'approved': return '#10B981';
        case 'pending': return '#F59E0B';
        case 'rejected': return '#DC2626';
        default: return '#6B7280';
      }
    };

    const getCancellationStatusColor = (cancelled) => {
      return cancelled === 'Yes' ? '#DC2626' : '#10B981';
    };

    const getStatusColor = (status) => {
        switch (status?.toLowerCase()) {
          case "delivered":
            return "#4CAF50";
          case "shipped":
            return "#2196F3";
          case "processing":
            return "#FF9800";
          case "cancelled":
            return "#F44336";
          default:
            return "#9E9E9E";
        }
    };

    const getAcceptanceStatusText = (status) => {
      if (!status) return 'PENDING';
      return status.toUpperCase();
    };

    const getCancellationStatusText = (cancelled) => {
      return cancelled === 'Yes' ? 'CANCELLED' : 'ACTIVE';
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
                isVisible={isDatePickerVisible}
                mode="date"
                onConfirm={handleConfirm}
                onCancel={hideDatePicker}
                date={selectedDate}
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

                    {/* Acceptance Filter */}
                    <View style={styles.filterSection}>
                      <Text style={styles.filterSectionTitle}>Acceptance Status</Text>
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

                    {/* Cancelled Filter */}
                    <View style={styles.filterSection}>
                      <Text style={styles.filterSectionTitle}>Order Status</Text>
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

            <ScrollView contentContainerStyle={styles.scrollContainer}>
                {orders.length === 0 ? (
                    <View style={styles.emptyState}>
                        <MaterialIcons name="receipt" size={60} color="#003366" />
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
                                </View>
                                <View style={styles.statusContainer}>
                                  {/* Order Acceptance Status */}
                                  <View style={styles.statusRow}>
                                    <Text style={styles.statusLabel}>Acceptance:</Text>
                                    <Text style={[styles.statusValue, { color: getAcceptanceStatusColor(order.approve_status) }]}>
                                      {getAcceptanceStatusText(order.approve_status)}
                                    </Text>
                                  </View>
                                  
                                  {/* Cancellation Status */}
                                  <View style={styles.statusRow}>
                                    <Text style={styles.statusLabel}>Status:</Text>
                                    <Text style={[styles.statusValue, { color: getCancellationStatusColor(order.cancelled) }]}>
                                      {getCancellationStatusText(order.cancelled)}
                                    </Text>
                                  </View>
                                </View>
                            </View>

                            <View style={styles.orderSummary}>
                                <Text style={styles.orderTotal}>₹{order.total_amount}</Text>
                                <View style={styles.deliveryStatusContainer}>
                                  <Text style={styles.deliveryStatusLabel}>Delivery:</Text>
                                  <Text style={[styles.deliveryStatusValue, { color: getStatusColor(order.delivery_status) }]}>
                                    {(order.delivery_status || 'pending').toUpperCase()}
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
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      maxHeight: '80%',
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
    filterSectionTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: '#003366',
      marginBottom: 12,
    },
    filterOption: {
      paddingVertical: 12,
      paddingHorizontal: 16,
      borderRadius: 8,
      marginBottom: 8,
      backgroundColor: '#F9FAFB',
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
    orderSummary: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 15,
    },
    orderTotal: {
        fontSize: 18,
        fontWeight: '700',
        color: '#003366',
    },
    orderFooter: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 15,
        paddingBottom: 12,
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