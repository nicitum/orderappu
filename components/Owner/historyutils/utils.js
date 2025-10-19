import { Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Toast from 'react-native-toast-message';
import moment from 'moment';

/**
 * Handle order details press
 */
export const handleOrderDetailsPress = async (orderId, expandedOrderDetailsId, setExpandedOrderDetailsId, orderDetails, fetchOrderProducts, setOrderDetails, console) => {
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

/**
 * Handle reorder
 */
export const handleReorder = async (orderId, orders, fetchOrderProducts, setPendingReorderOrderId, setPendingReorderProducts, setShowDueDateModal, setSelectedDueDate, defaultDueOn, handleEditAndReorder, Toast, console) => {
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

/**
 * Handle edit and reorder
 */
export const handleEditAndReorder = (products, order, customerNames, navigation, console) => {
    // Get customer name with fallback
    const customerName = customerNames[order.customer_id];
    const displayName = customerName && customerName !== order.customer_id.toString() 
        ? customerName 
        : `Customer ${order.customer_id}`;
    
    // Store products and customer in AsyncStorage for cart page
    const customerInfo = {
        customer_id: order.customer_id,
        name: displayName,
        username: customerName || displayName // Include username as fallback
    };
    
    // Debug logging
    console.log('=== EDIT AND REORDER DEBUG ===');
    console.log('Order customer_id:', order.customer_id);
    console.log('Customer names from state:', customerNames);
    console.log('Customer name for this ID:', customerName);
    console.log('Final display name:', displayName);
    console.log('Final customer info:', customerInfo);
    console.log('=== END DEBUG ===');
    
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

/**
 * Get customer name and cache it
 */
export const getCustomerName = async (customerId, customerNames, setCustomerNames, fetchCustomerName, console) => {
    if (customerNames[customerId]) {
        return customerNames[customerId];
    }
    
    const name = await fetchCustomerName(customerId);
    if (name) {
        setCustomerNames(prev => ({ ...prev, [customerId]: name }));
    }
    return name;
};

/**
 * Get filtered orders based on selected filters
 */
export const getFilteredOrders = (orders, selectedFilters) => {
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

/**
 * Handle filter change
 */
export const handleFilterChange = (filterType, value, setSelectedFilters) => {
  setSelectedFilters(prev => ({
    ...prev,
    [filterType]: value
  }));
};

/**
 * Clear all filters
 */
export const clearAllFilters = (setSelectedFilters) => {
  setSelectedFilters({
    delivery: 'All',
    cancelled: 'All',
    acceptance: 'All'
  });
};

/**
 * Get active filters count
 */
export const getActiveFiltersCount = (selectedFilters) => {
  return Object.values(selectedFilters).filter(value => value !== 'All').length;
};

/**
 * Handle confirm due date
 */
export const handleConfirmDueDate = (setShowDueDateModal, handleConfirmReorderFunction) => {
    // Close modal and proceed with reorder
    setShowDueDateModal(false);
    handleConfirmReorderFunction();
};

/**
 * Handle date confirmations
 */
export const handleConfirmFrom = (date, hideFromPicker, setFromDate, toDate, setToDate) => {
    hideFromPicker();
    const normalized = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    setFromDate(normalized);
    // Ensure toDate is not earlier than fromDate
    if (normalized > toDate) {
        setToDate(normalized);
    }
};

export const handleConfirmTo = (date, hideToPicker, setToDate, fromDate) => {
    hideToPicker();
    const normalized = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    // Ensure toDate >= fromDate
    if (normalized < fromDate) {
        setToDate(fromDate);
    } else {
        setToDate(normalized);
    }
};