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
import { useNavigation } from "@react-navigation/native";
import { useFocusEffect } from '@react-navigation/native';
import DateTimePickerModal from 'react-native-modal-datetime-picker';
import Ionicons from 'react-native-vector-icons/Ionicons';
import MaterialIcons from "react-native-vector-icons/MaterialIcons";
import Toast from 'react-native-toast-message';
import { useFontScale } from '../../App';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { jwtDecode } from "jwt-decode";
import moment from 'moment';

// Import utilities from historyutils
import { 
  COLORS, 
  styles as historyStyles, 
  detailStyles,
  fetchAdminOrders,
  fetchAllProducts,
  fetchClientStatus,
  fetchCustomerName,
  fetchOrderProducts,
  placeReorder,
  getFilteredOrders,
  getActiveFiltersCount,
  formatDate,
  OrderItem,
  ProductItem
} from './historyutils';

// Import ipAddress from urls
import { ipAddress } from "../../services/urls";

// Add missing imports from utils
import { formatDateTime, formatDueDate, getStatusColor, getConsolidatedStatus } from './historyutils/utils';

const AdminOrderHistory = ({ route }) => {
    const { getScaledSize } = useFontScale();
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

    // Fetch customer name and cache it
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
                    await fetchAllProducts().then(setAllProductsData).catch(console.error);
                    await fetchClientStatus().then(config => {
                        setDefaultDueOn(config.defaultDueOn);
                        setMaxDueOn(config.maxDueOn);
                    }).catch(console.error);
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
        }, [expandedOrderId, initialSelectedDate, orders.length])
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

    const fetchOrders = useCallback(async (customFromDate = null, customToDate = null) => {
        setLoading(true);
        try {
            const fetchedOrders = await fetchAdminOrders(customFromDate || fromDate, customToDate || toDate);
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

            try {
                // Place reorder using the api helper
                const data = await placeReorder(
                    orderId, 
                    products, 
                    order.customer_id, 
                    order.order_type || 'AM', 
                    selectedDueDate
                );

                console.log('DEBUG: About to show success toast');
                Toast.show({
                    type: 'success',
                    text1: 'Reorder Placed',
                    text2: `Order has been successfully reordered with ${products.length} products for delivery on ${formatDate(selectedDueDate)}`
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
                throw error;
            }
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
        
        // Note: This part should be handled by the actual navigation implementation
        // For now, we'll just show a message
        Toast.show({
            type: 'info',
            text1: 'Edit and Reorder',
            text2: 'This would navigate to AdminCartPage with the selected products'
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
                <Text style={[detailStyles.orderDetailsTitle, { fontSize: getScaledSize(16) }]}>Order Items</Text>

                <View style={detailStyles.headerRow}>
                    <View style={detailStyles.imageHeader}>
                        <Text style={[detailStyles.headerCell, { fontSize: getScaledSize(12) }]}></Text>
                    </View>
                    <View style={detailStyles.productNameHeader}>
                        <Text style={[detailStyles.headerCell, { fontSize: getScaledSize(12) }]}>Product</Text>
                    </View>
                    <View style={detailStyles.qtyHeader}>
                        <Text style={[detailStyles.headerCell, { fontSize: getScaledSize(12) }]}>Qty</Text>
                    </View>
                    <View style={detailStyles.priceHeader}>
                        <Text style={[detailStyles.headerCell, { fontSize: getScaledSize(12) }]}>Price</Text>
                    </View>
                </View>

                {products.length > 0 ? (
                    products.map((product, index) => {
                        const prodData = allProductsMap.get(product.product_id);
                        return (
                            <ProductItem 
                                key={`${orderId}-${product.product_id}-${index}`}
                                product={product}
                                prodData={prodData}
                                orderId={orderId}
                                index={index}
                                getScaledSize={getScaledSize}
                                ipAddress={ipAddress}
                            />
                        );
                    })
                ) : (
                    <Text style={[detailStyles.noProductsText, { fontSize: getScaledSize(14) }]}>No products found.</Text>
                )}
            </View>
        );
    };

    if (loading) {
        return (
            <View style={historyStyles.loadingContainer}>
                <ActivityIndicator size="large" color="#003366" />
            </View>
        );
    }

    return (
        <View style={historyStyles.container}>
            <View style={historyStyles.header}>
               <View style={historyStyles.headerLeft}>
                 <View style={{ flexDirection: 'row', gap: 8 }}>
                   <TouchableOpacity 
                       style={historyStyles.dateFilterButton} 
                       onPress={showFromPicker}
                       activeOpacity={0.7}
                   >
                       <Ionicons name="calendar" size={18} color="#fff" />
                       <Text style={[historyStyles.dateFilterText, { fontSize: getScaledSize(12) }]}>
                           {formatDate(fromDate)}
                       </Text>
                   </TouchableOpacity>
                   <TouchableOpacity 
                       style={historyStyles.dateFilterButton} 
                       onPress={showToPicker}
                       activeOpacity={0.7}
                   >
                       <Ionicons name="calendar" size={18} color="#fff" />
                       <Text style={[historyStyles.dateFilterText, { fontSize: getScaledSize(12) }]}>
                           {formatDate(toDate)}
                       </Text>
                   </TouchableOpacity>
                 </View>
                </View>

                <View style={historyStyles.headerRight}>
                  <TouchableOpacity
                    style={historyStyles.filterButton}
                    onPress={() => setShowFilterModal(true)}
                    activeOpacity={0.7}
                  >
                    <MaterialIcons name="filter-list" size={20} color="#fff" />
                    {getActiveFiltersCount(selectedFilters) > 0 && (
                      <View style={historyStyles.filterBadge}>
                        <Text style={[historyStyles.filterBadgeText, { fontSize: getScaledSize(10) }]}>{getActiveFiltersCount(selectedFilters)}</Text>
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
              <View style={historyStyles.modalOverlay}>
                <View style={historyStyles.filterModal}>
                  <View style={historyStyles.filterModalHeader}>
                    <Text style={[historyStyles.filterModalTitle, { fontSize: getScaledSize(18) }]}>Filter Orders</Text>
                    <TouchableOpacity
                      onPress={() => setShowFilterModal(false)}
                      style={historyStyles.closeButton}
                    >
                      <MaterialIcons name="close" size={24} color="#003366" />
                    </TouchableOpacity>
                  </View>

                  <ScrollView 
              style={historyStyles.filterContent}
              showsVerticalScrollIndicator={true}
              nestedScrollEnabled={true}
            >
                                       {/* Delivery Filter */}
                   <View style={historyStyles.filterSection}>
                     <Text style={[historyStyles.filterSectionTitle, { fontSize: getScaledSize(16) }]}>Delivery Status</Text>
                     <View style={historyStyles.filterOptionsRow}>
                       {['All', 'pending', 'delivered', 'out for delivery', 'processing', 'objection'].map(status => (
                         <TouchableOpacity
                           key={status}
                           style={[
                             historyStyles.filterOption,
                             selectedFilters.delivery === status && historyStyles.filterOptionSelected
                           ]}
                           onPress={() => handleFilterChange('delivery', status)}
                         >
                           <Text style={[
                             historyStyles.filterOptionText,
                             selectedFilters.delivery === status && historyStyles.filterOptionTextSelected,
                             { fontSize: getScaledSize(14) }
                           ]}>
                             {status.toUpperCase()}
                           </Text>
                         </TouchableOpacity>
                       ))}
                     </View>
                   </View>

                                       {/* Acceptance Filter */}
                   <View style={historyStyles.filterSection}>
                     <Text style={[historyStyles.filterSectionTitle, { fontSize: getScaledSize(16) }]}>Acceptance Status</Text>
                     <View style={historyStyles.filterOptionsRow}>
                       {['All', 'Accepted', 'Rejected', 'Pending'].map(status => (
                         <TouchableOpacity
                           key={status}
                           style={[
                             historyStyles.filterOption,
                             selectedFilters.acceptance === status && historyStyles.filterOptionSelected
                           ]}
                           onPress={() => handleFilterChange('acceptance', status)}
                         >
                           <Text style={[
                             historyStyles.filterOptionText,
                             selectedFilters.acceptance === status && historyStyles.filterOptionTextSelected,
                             { fontSize: getScaledSize(14) }
                           ]}>
                             {status}
                           </Text>
                         </TouchableOpacity>
                       ))}
                     </View>
                   </View>

                   {/* Cancelled Filter */}
                   <View style={historyStyles.filterSection}>
                     <Text style={[historyStyles.filterSectionTitle, { fontSize: getScaledSize(16) }]}>Order Status</Text>
                     <View style={historyStyles.filterOptionsRow}>
                       {['All', 'Active', 'Cancelled'].map(status => (
                         <TouchableOpacity
                           key={status}
                           style={[
                             historyStyles.filterOption,
                             selectedFilters.cancelled === status && historyStyles.filterOptionSelected
                           ]}
                           onPress={() => handleFilterChange('cancelled', status)}
                         >
                           <Text style={[
                             historyStyles.filterOptionText,
                             selectedFilters.cancelled === status && historyStyles.filterOptionTextSelected,
                             { fontSize: getScaledSize(14) }
                           ]}>
                             {status}
                           </Text>
                         </TouchableOpacity>
                       ))}
                     </View>
                   </View>
                  </ScrollView>

                  <View style={historyStyles.filterModalFooter}>
                    <TouchableOpacity
                      style={historyStyles.clearFiltersButton}
                      onPress={clearAllFilters}
                    >
                      <Text style={[historyStyles.clearFiltersText, { fontSize: getScaledSize(14) }]}>Clear All Filters</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={historyStyles.applyFiltersButton}
                      onPress={() => setShowFilterModal(false)}
                    >
                      <Text style={[historyStyles.applyFiltersText, { fontSize: getScaledSize(14) }]}>Apply Filters</Text>
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
                <View style={historyStyles.modalOverlay}>
                    <View style={historyStyles.dueDateModal}>
                        <View style={historyStyles.dueDateModalHeader}>
                            <Text style={[historyStyles.dueDateModalTitle, { fontSize: getScaledSize(18) }]}>Select Due Date</Text>
                            <TouchableOpacity
                                onPress={() => setShowDueDateModal(false)}
                                style={historyStyles.closeDueDateButton}
                            >
                                <MaterialIcons name="close" size={24} color="#003366" />
                            </TouchableOpacity>
                        </View>
                        
                        <View style={historyStyles.dueDateContent}>
                            <Text style={[historyStyles.dueDateLabel, { fontSize: getScaledSize(14) }]}>
                                When should this reorder be delivered?
                            </Text>
                            
                            <TouchableOpacity
                                style={historyStyles.datePickerButton}
                                onPress={showDatePicker}
                            >
                                <MaterialIcons name="calendar-today" size={20} color="#003366" />
                                <Text style={[historyStyles.datePickerButtonText, { fontSize: getScaledSize(16) }]}>
                                    {formatDate(selectedDueDate)}
                                </Text>
                                <MaterialIcons name="keyboard-arrow-down" size={20} color="#003366" />
                            </TouchableOpacity>
                            
                            <Text style={[historyStyles.dueDateNote, { fontSize: getScaledSize(12) }]}>
                                Note: This date will be used by our delivery team to schedule the reorder delivery.
                            </Text>
                        </View>
                        
                        <View style={historyStyles.dueDateModalFooter}>
                            <TouchableOpacity
                                style={historyStyles.cancelDueDateButton}
                                onPress={() => setShowDueDateModal(false)}
                            >
                                <Text style={[historyStyles.cancelDueDateButtonText, { fontSize: getScaledSize(14) }]}>Cancel</Text>
                            </TouchableOpacity>
                            
                            <TouchableOpacity
                                style={historyStyles.confirmDueDateButton}
                                onPress={handleConfirmDueDate}
                            >
                                <Text style={[historyStyles.confirmDueDateButtonText, { fontSize: getScaledSize(14) }]}>Confirm & Place Reorder</Text>
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

            <ScrollView contentContainerStyle={historyStyles.scrollContainer}>
                {orders.length === 0 ? (
                    <View style={historyStyles.emptyState}>
                        <Ionicons name="receipt-outline" size={60} color="#003366" />
                        <Text style={[historyStyles.emptyStateText, { fontSize: getScaledSize(16) }]}>No orders found for selected date</Text>
                    </View>
                ) : (
                    getFilteredOrders(orders, selectedFilters).map((order) => (
                        <View key={order.id}>
                            <OrderItem 
                                order={order}
                                customerNames={customerNames}
                                expandedOrderDetailsId={expandedOrderDetailsId}
                                handleOrderDetailsPress={handleOrderDetailsPress}
                                handleReorder={handleReorder}
                                getScaledSize={getScaledSize}
                                ipAddress={ipAddress}
                            />
                            {renderOrderDetails(order.id)}
                        </View>
                    ))
                )}
            </ScrollView>
        </View>
    );
};

export default AdminOrderHistory;