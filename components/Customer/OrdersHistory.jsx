import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  ActivityIndicator,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  Image,
  Modal,
} from "react-native";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import DateTimePickerModal from "react-native-modal-datetime-picker";
import Ionicons from 'react-native-vector-icons/Ionicons';
import MaterialIcons from "react-native-vector-icons/MaterialIcons";

import Toast from 'react-native-toast-message';
import { useFontScale } from '../../App';

// Import utilities from historyutils
import { 
  styles as historyStyles, 
  detailStyles,
  fetchCustomerOrders,
  fetchAllProducts,
  fetchClientStatus,
  fetchOrderProducts,
  cancelOrder,
  placeReorder,
  getFilteredOrders,
  getActiveFiltersCount,
  formatDate,
  OrderItem,
  ProductItem
} from './historyutils';

// Import ipAddress from urls
import { ipAddress } from "../../services/urls";

const OrdersHistory = () => {
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
  const [allProductsData, setAllProductsData] = useState([]);
  const [cancelLoading, setCancelLoading] = useState(false);
  const [cancelLoadingId, setCancelLoadingId] = useState(null);
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
  const [defaultDueOn, setDefaultDueOn] = useState(1);
  const [maxDueOn, setMaxDueOn] = useState(30);
  const [currentReorderOrder, setCurrentReorderOrder] = useState(null);

  const showFromPicker = () => setFromPickerVisible(true);
  const hideFromPicker = () => setFromPickerVisible(false);
  const showToPicker = () => setToPickerVisible(true);
  const hideToPicker = () => setToPickerVisible(false);

  // Due date picker functions
  const showDatePicker = () => setIsDatePickerVisible(true);
  const hideDatePicker = () => setIsDatePickerVisible(false);

  const handleConfirmDate = (date) => {
    hideDatePicker();
    setSelectedDueDate(date);
  };

  const handleConfirmFrom = (date) => {
    hideFromPicker();
    const normalized = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    setFromDate(normalized);
    // Ensure toDate is not earlier than fromDate
    if (normalized > toDate) {
      setToDate(normalized);
    }
  };

  const handleConfirmTo = (date) => {
    hideToPicker();
    const normalized = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    // Ensure toDate >= fromDate
    if (normalized < fromDate) {
      setToDate(fromDate);
    } else {
      setToDate(normalized);
    }
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

  const handleCancelOrder = async (order) => {
    // Check if order can be cancelled
    if (order.delivery_status === 'delivered' || order.delivery_status === 'shipped') {
      Toast.show({
        type: 'error',
        text1: 'Cannot Cancel',
        text2: 'This order cannot be cancelled as it has already been shipped or delivered.'
      });
      return;
    }

    Alert.alert(
      'Cancel Order',
      `Are you sure you want to cancel Order #${order.id}? This action cannot be undone.`,
      [
        {
          text: 'No, Keep Order',
          style: 'cancel'
        },
        {
          text: 'Yes, Cancel Order',
          style: 'destructive',
          onPress: async () => {
            setCancelLoading(true);
            setCancelLoadingId(order.id);
            
            try {
              const data = await cancelOrder(order.id);
              
              // Update the orders list to reflect the cancellation
              setOrders(prevOrders => 
                prevOrders.map(o => 
                  o.id === order.id ? { ...o, cancelled: 'Yes' } : o
                )
              );

              Toast.show({
                type: 'success',
                text1: 'Order Cancelled',
                text2: `Order #${order.id} has been successfully cancelled.`
              });
            } catch (error) {
              console.error("Error cancelling order:", error);
              Toast.show({
                type: 'error',
                text1: 'Cancellation Failed',
                text2: error.message || 'Failed to cancel the order. Please try again.'
              });
            } finally {
              setCancelLoading(false);
              setCancelLoadingId(null);
            }
          }
        }
      ]
    );
  };

  const handleOrderDetailsPress = async (orderId) => {
    if (expandedOrderDetailsId === orderId) {
      setExpandedOrderDetailsId(null);
    } else {
      setExpandedOrderDetailsId(orderId);
      if (!orderDetails[orderId]) {
        try {
          const products = await fetchOrderProducts(orderId);
          setOrderDetails(prevDetails => ({ ...prevDetails, [orderId]: products }));
        } catch (error) {
          console.error("Error fetching order products:", error);
          Toast.show({
            type: 'error',
            text1: 'Error',
            text2: 'Failed to fetch order details. Please try again.'
          });
        }
      }
    }
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

  // Fetch orders when component mounts or dates change
  useEffect(() => {
    const fetchOrders = async () => {
      setLoading(true);
      try {
        const fetchedOrders = await fetchCustomerOrders(fromDate, toDate);
        setOrders(fetchedOrders);
      } catch (error) {
        console.error("Error fetching orders:", error);
        Toast.show({
          type: 'error',
          text1: 'Error',
          text2: error.message || 'Failed to fetch orders. Please try again.'
        });
        setOrders([]); // Set empty array on error
      } finally {
        setLoading(false);
      }
    };

    fetchOrders();
  }, [fromDate, toDate]);

  // Fetch all products for images when component mounts
  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const products = await fetchAllProducts();
        setAllProductsData(products);
      } catch (error) {
        console.error("Error fetching products:", error);
      }
    };

    fetchProducts();
  }, []);

  // Fetch client status for due date configuration
  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const config = await fetchClientStatus();
        setDefaultDueOn(config.defaultDueOn);
        setMaxDueOn(config.maxDueOn);
      } catch (error) {
        console.error("Error fetching client status:", error);
      }
    };

    fetchStatus();
  }, []);

  const handleReorder = async (order) => {
    try {
      const products = await fetchOrderProducts(order.id);
      if (products && products.length > 0) {
        // Set current reorder order and show due date modal
        setCurrentReorderOrder({ ...order, products });
        // Reset due date based on API default_due_on value
        const newDefaultDate = new Date();
        if (defaultDueOn > 0) {
          newDefaultDate.setDate(newDefaultDate.getDate() + defaultDueOn);
        }
        setSelectedDueDate(newDefaultDate);
        setShowDueDateModal(true);
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

  const handleConfirmDueDate = async () => {
    if (!currentReorderOrder) return;
    
    try {
      // Close modal and proceed with reorder
      setShowDueDateModal(false);
      
      // Place reorder using the api helper
      const data = await placeReorder(
        currentReorderOrder.id, 
        currentReorderOrder.products, 
        currentReorderOrder.customer_id, 
        currentReorderOrder.order_type || 'AM', 
        selectedDueDate
      );

      Toast.show({
        type: 'success',
        text1: 'Reorder Placed',
        text2: `Order has been successfully reordered with ${currentReorderOrder.products.length} products for delivery on ${formatDate(selectedDueDate)}`
      });

      // Refresh the orders list to show the new reorder
      const fetchedOrders = await fetchCustomerOrders(fromDate, toDate);
      setOrders(fetchedOrders);

      // Reset reorder state
      setCurrentReorderOrder(null);
    } catch (error) {
      console.error('Error placing reorder:', error);
      Toast.show({
        type: 'error',
        text1: 'Reorder Failed',
        text2: error.message || 'Failed to place reorder'
      });
    }
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
        <Text style={[historyStyles.headerTitle, { fontSize: getScaledSize(18) }]}>Order History</Text>
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

            <ScrollView style={historyStyles.filterContent}>
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
        {getFilteredOrders(orders, selectedFilters).length === 0 ? (
          <View style={historyStyles.emptyState}>
            <Ionicons name="receipt-outline" size={60} color="#003366" />
            <Text style={[historyStyles.emptyStateText, { fontSize: getScaledSize(16) }]}>No orders found for selected date</Text>
          </View>
        ) : (
          getFilteredOrders(orders, selectedFilters).map((order) => (
            <View key={order.id}>
              <OrderItem 
                order={order}
                expandedOrderDetailsId={expandedOrderDetailsId}
                handleOrderDetailsPress={handleOrderDetailsPress}
                handleReorder={handleReorder}
                handleCancelOrder={handleCancelOrder}
                getScaledSize={getScaledSize}
              />
              {renderOrderDetails(order.id)}
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
};

export default OrdersHistory;