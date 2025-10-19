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
import { useFontScale } from '../../App';

// Import from historyutils
import { 
  COLORS, 
  getStatusColor, 
  getAcceptanceStatusColor, 
  getCancellationStatusColor, 
  getConsolidatedStatus,
  styles,
  detailStyles,
  ProductItem
} from './historyutils';
import { 
  fetchOrders,
  fetchAllProducts,
  fetchClientStatus,
  fetchCustomerName,
  fetchOrderProducts,
  handleConfirmReorder
} from './historyutils/apiHelpers';
import { 
  handleOrderDetailsPress,
  handleReorder,
  handleEditAndReorder,
  getCustomerName,
  getFilteredOrders,
  handleFilterChange,
  clearAllFilters,
  getActiveFiltersCount,
  handleConfirmDueDate,
  handleConfirmFrom,
  handleConfirmTo
} from './historyutils/utils';

const OrderHistoryOwner = ({ route }) => {
  const { getScaledSize } = useFontScale();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigation = useNavigation();
  const [expandedOrderDetailsId, setExpandedOrderDetailsId] = useState(null);
  const [orderDetails, setOrderDetails] = useState({});
  const [isDatePickerVisible, setDatePickerVisibility] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [fromDate, setFromDate] = useState(new Date());
  const [toDate, setToDate] = useState(new Date());
  const [isFromPickerVisible, setFromPickerVisible] = useState(false);
  const [isToPickerVisible, setToPickerVisible] = useState(false);
  const [allProductsData, setAllProductsData] = useState([]);
  const [customerNames, setCustomerNames] = useState({});
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
  const [isReorderDatePickerVisible, setIsReorderDatePickerVisible] = useState(false);
  const [pendingReorderOrderId, setPendingReorderOrderId] = useState(null);
  const [pendingReorderProducts, setPendingReorderProducts] = useState([]);

  // New state for API-based due date configuration
  const [defaultDueOn, setDefaultDueOn] = useState(1);
  const [maxDueOn, setMaxDueOn] = useState(30);

  // Get navigation parameters
  const expandedOrderId = route?.params?.expandedOrderId;
  const selectedDateString = route?.params?.selectedDate;
  
  // Convert string back to Date object if present - use useMemo to prevent infinite loops
  const initialSelectedDate = useMemo(() => {
      return selectedDateString ? new Date(selectedDateString) : null;
  }, [selectedDateString]);

  // Monitor state changes for debugging
  useEffect(() => {
      console.log('State changed - defaultDueOn:', defaultDueOn, 'maxDueOn:', maxDueOn);
  }, [defaultDueOn, maxDueOn]);

  const showDatePicker = () => {
      setDatePickerVisibility(true);
  };

  const hideDatePicker = () => {
      setDatePickerVisibility(false);
  };

  const handleConfirm = (date) => {
      hideDatePicker();
      setSelectedDate(date);
      // fetchOrders(date);
  };

  const showFromPicker = () => setFromPickerVisible(true);
  const hideFromPicker = () => setFromPickerVisible(false);
  const showToPicker = () => setToPickerVisible(true);
  const hideToPicker = () => setToPickerVisible(false);

  const showReorderDatePicker = () => {
      setIsReorderDatePickerVisible(true);
  };

  const hideReorderDatePicker = () => {
      setIsReorderDatePickerVisible(false);
  };

  const handleConfirmDate = (date) => {
      hideDatePicker();
      setSelectedDueDate(date);
  };

  const handleFilterChangeWrapper = (filterType, value) => {
    handleFilterChange(filterType, value, setSelectedFilters);
  };

  const clearAllFiltersWrapper = () => {
    clearAllFilters(setSelectedFilters);
  };

  const getActiveFiltersCountWrapper = () => {
    return getActiveFiltersCount(selectedFilters);
  };

  const fetchOrdersWrapper = useCallback(async (dateFilter) => {
      await fetchOrders(
          dateFilter ? dateFilter : fromDate, 
          dateFilter ? dateFilter : toDate, 
          expandedOrderId, 
          setOrders, 
          setOrderDetails, 
          setLoading
      );
  }, [expandedOrderId, fromDate, toDate]);

  const fetchAllProductsWrapper = useCallback(async () => {
      await fetchAllProducts(setAllProductsData); // Remove console parameter
  }, []);

  // Fetch client status for due date configuration
  const fetchClientStatusWrapper = async () => {
      await fetchClientStatus(setDefaultDueOn, setMaxDueOn, setSelectedDueDate); // Remove console parameter
  };

  // Function to fetch customer name by customer ID (fallback)
  const fetchCustomerNameWrapper = async (customerId) => {
      return await fetchCustomerName(customerId); // Remove console parameter
  };

  // Simple function to get customer name and cache it
  const getCustomerNameWrapper = async (customerId) => {
      return await getCustomerName(customerId, customerNames, setCustomerNames, fetchCustomerNameWrapper, console);
  };

  useFocusEffect(
      useCallback(() => {
          console.log('useFocusEffect triggered with expandedOrderId:', expandedOrderId, 'initialSelectedDate:', initialSelectedDate);
          
          // Set initial date if provided from navigation
          if (initialSelectedDate) {
              setSelectedDate(initialSelectedDate);
              setFromDate(initialSelectedDate);
              setToDate(initialSelectedDate);
          }
          
          fetchAllProductsWrapper();
          fetchOrdersWrapper(initialSelectedDate || null); // Pass null to use date range
          
          // Set expanded order if provided from navigation
          if (expandedOrderId) {
              console.log('Setting expanded order to:', expandedOrderId);
              setExpandedOrderDetailsId(expandedOrderId);
          }
          
          return () => {};
      }, [fetchOrdersWrapper, fetchAllProductsWrapper, expandedOrderId, initialSelectedDate])
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
                      await getCustomerNameWrapper(order.customer_id);
                  }
              }
          }
          console.log('=== CUSTOMER NAMES FETCH COMPLETE ===');
      };
      
      fetchCustomerNames();
  }, [orders]);

  // Auto-fetch orders when date range changes
  useEffect(() => {
      if (!initialSelectedDate) { // Only auto-fetch if not using single date from navigation
          fetchOrdersWrapper();
      }
  }, [fromDate, toDate, fetchOrdersWrapper]);

  const allProductsMap = React.useMemo(() => {
      const map = new Map();
      (allProductsData || []).forEach(p => map.set(p.id, p));
      return map;
  }, [allProductsData]);

  const fetchOrderProductsWrapper = async (orderId) => {
      return await fetchOrderProducts(orderId); // Remove console parameter
  };

  const handleOrderDetailsPressWrapper = async (orderId) => {
      await handleOrderDetailsPress(
          orderId, 
          expandedOrderDetailsId, 
          setExpandedOrderDetailsId, 
          orderDetails, 
          fetchOrderProductsWrapper, 
          setOrderDetails,
          console
      );
  };

  const handleReorderWrapper = async (orderId) => {
      await handleReorder(
          orderId,
          orders,
          fetchOrderProductsWrapper,
          setPendingReorderOrderId,
          setPendingReorderProducts,
          setShowDueDateModal,
          setSelectedDueDate,
          defaultDueOn,
          handleEditAndReorderWrapper,
          Toast,
          console
      );
  };

  const handleEditAndReorderWrapper = (products, order) => {
      handleEditAndReorder(products, order, customerNames, navigation, console);
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
                      <Text style={[detailStyles.headerCell, { fontSize: getScaledSize(13) }]}></Text>
                  </View>
                  <View style={detailStyles.productNameHeader}>
                      <Text style={[detailStyles.headerCell, { fontSize: getScaledSize(13) }]}>Product</Text>
                  </View>
                  <View style={detailStyles.qtyHeader}>
                      <Text style={[detailStyles.headerCell, { fontSize: getScaledSize(13) }]}>Qty</Text>
                  </View>
                  <View style={detailStyles.priceHeader}>
                      <Text style={[detailStyles.headerCell, { fontSize: getScaledSize(13) }]}>Price</Text>
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

  const getFilteredOrdersWrapper = () => {
    return getFilteredOrders(orders, selectedFilters);
  };

  const handleConfirmDueDateWrapper = () => {
      // Close modal and proceed with reorder
      handleConfirmDueDate(setShowDueDateModal, handleConfirmReorderWrapperFunction);
  };

  const handleConfirmReorderWrapperFunction = async () => {
      if (pendingReorderOrderId && pendingReorderProducts.length > 0) {
          await handleConfirmReorder(
              pendingReorderOrderId,
              pendingReorderProducts,
              orders,
              selectedDueDate,
              navigation,
              Toast,
              setPendingReorderOrderId,
              setPendingReorderProducts,
              fetchOrdersWrapper,
              console
          );
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
                          <Text style={[styles.dateFilterText, { fontSize: getScaledSize(12) }]}>
                              {moment(fromDate).format("MMM D, YYYY")}
                          </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                          style={styles.dateFilterButton}
                          onPress={showToPicker}
                          activeOpacity={0.7}
                      >
                          <Ionicons name="calendar" size={18} color="#fff" />
                          <Text style={[styles.dateFilterText, { fontSize: getScaledSize(12) }]}>
                              {moment(toDate).format("MMM D, YYYY")}
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
                  {getActiveFiltersCountWrapper() > 0 && (
                    <View style={styles.filterBadge}>
                      <Text style={styles.filterBadgeText}>{getActiveFiltersCountWrapper()}</Text>
                    </View>
                  )}
                </TouchableOpacity>
              </View>
          </View>

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
                          <Text style={[styles.dueDateModalTitle, { fontSize: getScaledSize(18) }]}>Select Due Date</Text>
                          <TouchableOpacity
                              onPress={() => setShowDueDateModal(false)}
                              style={styles.closeDueDateButton}
                          >
                              <MaterialIcons name="close" size={24} color="#003366" />
                          </TouchableOpacity>
                      </View>
                      
                      <View style={styles.dueDateContent}>
                          <Text style={[styles.dueDateLabel, { fontSize: getScaledSize(16) }]}>
                              When should this reorder be delivered?
                          </Text>
                          
                          <TouchableOpacity
                              style={styles.datePickerButton}
                              onPress={showReorderDatePicker}
                          >
                              <MaterialIcons name="calendar-today" size={20} color="#003366" />
                              <Text style={[styles.datePickerButtonText, { fontSize: getScaledSize(16) }]}>
                                  {moment(selectedDueDate).format('DD MMM, YYYY')}
                              </Text>
                              <MaterialIcons name="keyboard-arrow-down" size={20} color="#003366" />
                          </TouchableOpacity>
                          
                          <Text style={[styles.dueDateNote, { fontSize: getScaledSize(14) }]}>
                              Note: This date will be used by our delivery team to schedule the reorder delivery.
                          </Text>
                      </View>
                      
                      <View style={styles.dueDateModalFooter}>
                          <TouchableOpacity
                              style={styles.cancelDueDateButton}
                              onPress={() => setShowDueDateModal(false)}
                          >
                              <Text style={[styles.cancelDueDateButtonText, { fontSize: getScaledSize(16) }]}>Cancel</Text>
                          </TouchableOpacity>
                          
                          <TouchableOpacity
                              style={styles.confirmDueDateButton}
                              onPress={handleConfirmDueDateWrapper}
                          >
                              <Text style={[styles.confirmDueDateButtonText, { fontSize: getScaledSize(16) }]}>Confirm & Place Reorder</Text>
                          </TouchableOpacity>
                      </View>
                  </View>
              </View>
          </Modal>

          {/* Date Picker Modal for Reorder */}
          <DateTimePickerModal
              isVisible={isReorderDatePickerVisible}
              mode="date"
              onConfirm={handleConfirmDate}
              onCancel={hideReorderDatePicker}
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

          {/* Date Range Pickers */}
          <DateTimePickerModal
              isVisible={isFromPickerVisible}
              mode="date"
              onConfirm={(date) => handleConfirmFrom(date, hideFromPicker, setFromDate, toDate, setToDate)}
              onCancel={hideFromPicker}
              date={fromDate}
          />
          <DateTimePickerModal
              isVisible={isToPickerVisible}
              mode="date"
              onConfirm={(date) => handleConfirmTo(date, hideToPicker, setToDate, fromDate)}
              onCancel={hideToPicker}
              date={toDate}
              minimumDate={fromDate} // Can't select date earlier than fromDate
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
                  <Text style={[styles.filterModalTitle, { fontSize: getScaledSize(18) }]}>Filter Orders</Text>
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
                    <Text style={[styles.filterSectionTitle, { fontSize: getScaledSize(16) }]}>Delivery Status</Text>
                    <View style={styles.filterOptionsRow}>
                      {['All', 'pending', 'delivered', 'out for delivery', 'processing', 'objection'].map(status => (
                        <TouchableOpacity
                          key={status}
                          style={[
                            styles.filterOption,
                            selectedFilters.delivery === status && styles.filterOptionSelected
                          ]}
                          onPress={() => handleFilterChangeWrapper('delivery', status)}
                        >
                          <Text style={[
                            styles.filterOptionText,
                            { fontSize: getScaledSize(14) },
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
                    <Text style={[styles.filterSectionTitle, { fontSize: getScaledSize(16) }]}>Acceptance Status</Text>
                    <View style={styles.filterOptionsRow}>
                      {['All', 'Accepted', 'Rejected', 'Pending'].map(status => (
                        <TouchableOpacity
                          key={status}
                          style={[
                            styles.filterOption,
                            selectedFilters.acceptance === status && styles.filterOptionSelected
                          ]}
                          onPress={() => handleFilterChangeWrapper('acceptance', status)}
                        >
                          <Text style={[
                            styles.filterOptionText,
                            { fontSize: getScaledSize(14) },
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
                    <Text style={[styles.filterSectionTitle, { fontSize: getScaledSize(16) }]}>Order Status</Text>
                    <View style={styles.filterOptionsRow}>
                      {['All', 'Active', 'Cancelled'].map(status => (
                        <TouchableOpacity
                          key={status}
                          style={[
                            styles.filterOption,
                            selectedFilters.cancelled === status && styles.filterOptionSelected
                          ]}
                          onPress={() => handleFilterChangeWrapper('cancelled', status)}
                        >
                          <Text style={[
                            styles.filterOptionText,
                            { fontSize: getScaledSize(14) },
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
                    onPress={clearAllFiltersWrapper}
                  >
                    <Text style={[styles.clearFiltersText, { fontSize: getScaledSize(14) }]}>Clear All Filters</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.applyFiltersButton}
                    onPress={() => setShowFilterModal(false)}
                  >
                    <Text style={[styles.applyFiltersText, { fontSize: getScaledSize(14) }]}>Apply Filters</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </Modal>

          <ScrollView contentContainerStyle={styles.scrollContainer}>
              {orders.length === 0 ? (
                  <View style={styles.emptyState}>
                      <MaterialIcons name="receipt" size={60} color="#003366" />
                      <Text style={[styles.emptyStateText, { fontSize: getScaledSize(16) }]}>No orders found for selected date</Text>
                  </View>
              ) : (
                  getFilteredOrdersWrapper().map((order) => (
                      <View key={order.id} style={styles.orderCard}>
                          <View style={styles.orderHeader}>
                              <View>
                                  <Text style={[styles.orderId, { fontSize: getScaledSize(16) }]}>Order #{order.id}</Text>
                                  <Text style={[styles.orderCustomer, { fontSize: getScaledSize(13) }]}>
                                      {customerNames[order.customer_id] ? 
                                          customerNames[order.customer_id] : 
                                          `Loading... (ID: ${order.customer_id})`
                                      }
                                  </Text>
                                  <Text style={[styles.orderDate, { fontSize: getScaledSize(12) }]}>
                                      {moment.unix(order.placed_on).format('MMM D, YYYY [at] h:mm A')}
                                  </Text>
                                  {order.entered_by && (
                                      <Text style={[styles.orderEnteredBy, { fontSize: getScaledSize(12) }]}>Entered By: {order.entered_by}</Text>
                                  )}
                                  {order.altered_by && (
                                      <Text style={[styles.orderEnteredBy, { fontSize: getScaledSize(12) }]}>Altered By: {order.altered_by}</Text>
                                  )}
                              </View>
                              <View style={styles.statusContainer}>
                                {/* Consolidated Status */}
                                <View style={styles.statusRow}>
                                  <Text style={[styles.statusLabel, { fontSize: getScaledSize(10) }]}>Status:</Text>
                                  <Text style={[styles.statusValue, { fontSize: getScaledSize(10), color: getConsolidatedStatus(order).color }]}>
                                    {getConsolidatedStatus(order).text}
                                  </Text>
                                </View>
                              </View>
                          </View>

                          <View style={styles.orderSummary}>
                              <Text style={[styles.orderTotal, { fontSize: getScaledSize(18) }]}>₹{order.total_amount}</Text>
                              <View style={styles.deliveryStatusContainer}>
                                <Text style={[styles.deliveryStatusLabel, { fontSize: getScaledSize(12) }]}>Delivery:</Text>
                                <Text style={[styles.deliveryStatusValue, { fontSize: getScaledSize(12), color: getStatusColor(order.delivery_status) }]}>
                                  {(order.delivery_status || 'pending').toUpperCase()}
                                </Text>
                                <Text style={[styles.deliveryDueDateLabel, { fontSize: getScaledSize(13) }]}>
                                  Delivery Due On: {moment.unix(order.due_on).format('MMM D, YYYY')}
                                </Text>
                              </View>
                          </View>

                          <View style={styles.orderFooter}>
                              {/* Left side - Reorder Button */}
                              <TouchableOpacity
                                  style={styles.reorderButton}
                                  onPress={() => handleReorderWrapper(order.id)}
                                  activeOpacity={0.7}
                              >
                                  <MaterialIcons name="replay" size={16} color="#10B981" />
                                  <Text style={[styles.reorderButtonText, { fontSize: getScaledSize(12) }]}>Reorder</Text>
                              </TouchableOpacity>

                              {/* Right side - Details button */}
                              <View style={styles.rightButtonsContainer}>
                                  <TouchableOpacity 
                                      onPress={() => handleOrderDetailsPressWrapper(order.id)}
                                      style={styles.detailsButton}
                                      activeOpacity={0.7}
                                  >
                                      <Text style={[styles.detailsButtonText, { fontSize: getScaledSize(14) }]}>
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

export default OrderHistoryOwner;