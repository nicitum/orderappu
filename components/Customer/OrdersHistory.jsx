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
import axios from "axios";
import { ipAddress } from "../../services/urls";
import { checkTokenAndRedirect } from "../../services/auth";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import moment from "moment";
import DateTimePickerModal from "react-native-modal-datetime-picker";
import Ionicons from 'react-native-vector-icons/Ionicons';
import MaterialIcons from "react-native-vector-icons/MaterialIcons";
import AsyncStorage from '@react-native-async-storage/async-storage';
import { jwtDecode } from "jwt-decode";
import Toast from 'react-native-toast-message';

const OrdersHistory = () => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigation = useNavigation();
  const [expandedOrderDetailsId, setExpandedOrderDetailsId] = useState(null);
  const [orderDetails, setOrderDetails] = useState({});
  const [isDatePickerVisible, setDatePickerVisibility] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [allProductsData, setAllProductsData] = useState([]);
  const [cancelLoading, setCancelLoading] = useState(false);
  const [cancelLoadingId, setCancelLoadingId] = useState(null);
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [selectedFilters, setSelectedFilters] = useState({
    delivery: 'All',
    cancelled: 'All',
    acceptance: 'All'
  });

  const showDatePicker = () => {
    setDatePickerVisibility(true);
  };

  const hideDatePicker = () => {
    setDatePickerVisibility(false);
  };

  const handleConfirm = (date) => {
    hideDatePicker();
    setSelectedDate(date);
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
              const token = await AsyncStorage.getItem("userAuthToken");
              if (!token) throw new Error('No authentication token found');

              const response = await fetch(
                `http://${ipAddress}:8091/cancel_order/${order.id}`,
                {
                  method: 'POST',
                  headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "application/json",
                  }
                }
              );

              if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Failed to cancel order. Status: ${response.status}, Text: ${errorText}`);
              }

              const data = await response.json();
              if (!data.success) {
                throw new Error(data.message || "Failed to cancel the order.");
              }

              Toast.show({
                type: 'success',
                text1: 'Order Cancelled',
                text2: data.message || `Order #${order.id} has been cancelled successfully.`
              });

              // Refresh orders list
              await fetchOrders();
            } catch (error) {
              console.error('Error cancelling order:', error);
              Toast.show({
                type: 'error',
                text1: 'Cancel Failed',
                text2: error.message || 'Failed to cancel the order.'
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

  const canCancelOrder = (order) => {
    // Don't allow cancellation if order is already cancelled
    if (order.cancelled === 'Yes') {
      return false;
    }
    // Don't allow cancellation if order is delivered or shipped
    if (order.delivery_status === 'delivered' || order.delivery_status === 'shipped') {
      return false;
    }
    // Only allow cancellation if acceptance status is Pending (not Accepted or Rejected)
    if (order.approve_status === 'Accepted' || order.approve_status === 'Rejected') {
      return false;
    }
    // Allow cancellation only when acceptance status is Pending or null/undefined
    return true;
  };

  const fetchAllProducts = useCallback(async () => {
    try {
      const token = await AsyncStorage.getItem("userAuthToken");
      if (!token) {
          throw new Error("Authentication token missing");
      }
      const response = await axios.get(`http://${ipAddress}:8091/products`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.data) {
        setAllProductsData(response.data);
      }
    } catch (error) {
      console.error("Error fetching all products:", error);
    }
  }, []);

  const fetchOrders = useCallback(async () => {
    try {
      setLoading(true);
      const token = await AsyncStorage.getItem("userAuthToken");
        if (!token) {
            throw new Error("Authentication token missing");
        }

        const decodedToken = jwtDecode(token);
        const custId = decodedToken.id;

      // Assuming customer_id is available; replace with actual logic to get customer_id
     
      
      // Replace with logic to get customer_id (e.g., from token or user context)

      const formattedDate = moment(selectedDate).format("YYYY-MM-DD");
      const response = await axios.get(
        `http://${ipAddress}:8091/get-orders/${custId}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
          params: {
            date: formattedDate,
          },
        }
      );

      if (response.data.status) {
        setOrders(response.data.orders);
      } else {
        throw new Error(response.data.message || "Failed to fetch orders");
      }
    } catch (error) {
      console.error("Error fetching order history:", error);
      Alert.alert("Error", "Failed to fetch orders. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [navigation, selectedDate]);

  useFocusEffect(
    useCallback(() => {
      fetchAllProducts();
      fetchOrders();
    }, [fetchOrders, fetchAllProducts])
  );

  const fetchOrderProducts = async (orderId) => {
    try {
      const token = await checkTokenAndRedirect(navigation);
      if (!token) throw new Error("No authorization token found.");

      const response = await axios.get(
        `http://${ipAddress}:8091/order-products`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
          params: {
            orderId: orderId,
          },
        }
      );
      return response.data;
    } catch (error) {
      console.error("Error fetching order products:", error);
      Alert.alert("Error", "Failed to fetch order details.");
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
        setOrderDetails((prevDetails) => ({
          ...prevDetails,
          [orderId]: products,
        }));
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
        <Text style={detailStyles.orderDetailsTitle}>Order Items</Text>
        <View style={detailStyles.headerRow}>
          <Text style={[detailStyles.headerCell, detailStyles.imageHeader]}></Text>
          <Text style={[detailStyles.headerCell, detailStyles.productNameHeader]}>Product</Text>
          <Text style={[detailStyles.headerCell, detailStyles.qtyHeaderFixed]}>Qty</Text>
          <Text style={[detailStyles.headerCell, detailStyles.priceHeaderFixed]}>Price</Text>
        </View>
        {products.length > 0 ? (
          products.map((product, index) => {
            const prodData = allProductsMap.get(product.product_id);
            const imageUrl = prodData && prodData.image ? `http://${ipAddress}:8091/images/products/${prodData.image}` : null;
            return (
              <View
                key={`${orderId}-${product.product_id || index}`}
                style={detailStyles.productRow}
              >
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
                <Text style={[detailStyles.productCell, detailStyles.productNameCell]}>{product.name || (prodData?.name || 'Product Name')}</Text>
                <Text style={[detailStyles.productCell, detailStyles.qtyCellFixed]}>{product.quantity || 0}</Text>
                <Text style={[detailStyles.productCell, detailStyles.priceCellFixed]}>₹{product.price !== undefined ? product.price : 0}</Text>
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

  const handleReorder = async (order) => {
    Alert.alert(
      'Reorder Options',
      'Choose how you want to reorder this order:',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Confirm Reorder',
          onPress: async () => {
            try {
              const token = await AsyncStorage.getItem('userAuthToken');
              if (!token) throw new Error('No authentication token found');
              // Prepare products payload
              const products = await fetchOrderProducts(order.id);
              if (!products || products.length === 0) throw new Error('No products found in this order');
              // Build products array for /place
              const orderItems = products.map(p => ({
                product_id: p.product_id,
                quantity: p.quantity,
                price: Number(p.price) || 0
              }));
              // Get orderType (AM/PM)
              const getOrderType = () => {
                const currentHour = new Date().getHours();
                return currentHour < 12 ? 'AM' : 'PM';
              };
              // Calculate total_amount
              const total_amount = orderItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
              const orderData = {
                products: orderItems,
                orderType: getOrderType(),
                orderDate: new Date().toISOString(),
                total_amount
              };
              const response = await fetch(`http://${ipAddress}:8091/place`, {
                method: 'POST',
                headers: {
                  Authorization: `Bearer ${token}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify(orderData),
              });
              const data = await response.json();
              if (!response.ok) {
                throw new Error(data.message || 'Failed to place reorder');
              }
              Toast.show({ type: 'success', text1: 'Reorder Placed', text2: 'Order placed successfully!' });
              fetchOrders();
            } catch (error) {
              Toast.show({ type: 'error', text1: 'Reorder Failed', text2: error.message });
            }
          },
        },
        {
          text: 'Edit and Reorder',
          onPress: async () => {
            try {
              const products = await fetchOrderProducts(order.id);
              if (!products || products.length === 0) throw new Error('No products found in this order');
              const allProductsMap = new Map(allProductsData.map(p => [p.id, p]));
              // Build cartItems and catalogueCart
              const cartItems = {};
              const catalogueCart = {};
              products.forEach(p => {
                const fullProduct = allProductsMap.get(p.product_id);
                if (fullProduct) {
                  cartItems[p.product_id] = {
                    ...fullProduct,
                    id: p.product_id,
                    quantity: p.quantity,
                  };
                  catalogueCart[p.product_id] = p.quantity;
                }
              });
              await AsyncStorage.setItem('cartItems', JSON.stringify(cartItems));
              await AsyncStorage.setItem('catalogueCart', JSON.stringify(catalogueCart));
              navigation.navigate('CartCustomer');
            } catch (error) {
              Toast.show({ type: 'error', text1: 'Edit & Reorder Failed', text2: error.message });
            }
          },
        },
      ]
    );
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
              {moment(selectedDate).format("MMM D, YYYY")}
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
            <Ionicons name="receipt-outline" size={60} color="#003366" />
            <Text style={styles.emptyStateText}>
              No orders found for selected date
            </Text>
          </View>
        ) : (
          getFilteredOrders().map((order) => (
            <View key={order.id} style={styles.orderCard}>
              <View style={styles.orderHeader}>
                <View>
                  <Text style={styles.orderId}>Order #{order.id}</Text>
                  <Text style={styles.orderDate}>{moment.unix(order.placed_on).format('MMM D, YYYY [at] h:mm A')}</Text>
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

              {/* Product preview images removed. Only show images in expanded details. */}

              <View style={styles.orderFooter}>
                {/* Left side - Reorder Button */}
                <TouchableOpacity
                  style={styles.reorderButton}
                  onPress={() => handleReorder(order)}
                  activeOpacity={0.7}
                >
                  <MaterialIcons name="replay" size={16} color="#10B981" />
                  <Text style={styles.reorderButtonText}>Reorder</Text>
                </TouchableOpacity>

                {/* Right side - Cancel and Details buttons */}
                <View style={styles.rightButtonsContainer}>
                  {/* Cancel Order Button - Only show if order can be cancelled */}
                  {canCancelOrder(order) && (
                    <TouchableOpacity
                      style={styles.cancelButton}
                      onPress={() => handleCancelOrder(order)}
                      activeOpacity={0.7}
                      disabled={cancelLoading && cancelLoadingId === order.id}
                    >
                      {cancelLoading && cancelLoadingId === order.id ? (
                        <ActivityIndicator size="small" color="#DC2626" />
                      ) : (
                        <>
                          <MaterialIcons name="cancel" size={16} color="#DC2626" />
                          <Text style={styles.cancelButtonText}>Cancel</Text>
                        </>
                      )}
                    </TouchableOpacity>
                  )}

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
    backgroundColor: "#f5f7fa",
  },
  header: {
    backgroundColor: "#003366",
    padding: 5,
    paddingBottom: 5,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    shadowColor: "#000",
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
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 16,
    maxWidth: 120,
  },
  dateFilterText: {
    color: "#fff",
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
    backgroundColor: "#f5f7fa",
  },
  scrollContainer: {
    padding: 15,
    paddingBottom: 25,
  },
  emptyState: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 80,
  },
  emptyStateText: {
    marginTop: 15,
    fontSize: 16,
    color: "#003366",
    opacity: 0.7,
  },
  orderCard: {
    backgroundColor: "#fff",
    borderRadius: 10,
    marginBottom: 15,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
    overflow: "hidden",
  },
  orderHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  orderId: {
    fontSize: 16,
    fontWeight: "600",
    color: "#003366",
  },
  orderDate: {
    fontSize: 13,
    color: "#666",
    marginTop: 3,
  },
  orderStatus: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    color: "#fff",
    fontSize: 12,
    fontWeight: "600",
    alignSelf: "flex-start",
  },
  orderSummary: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 15,
  },
  orderTotal: {
    fontSize: 18,
    fontWeight: "700",
    color: "#003366",
  },
  orderType: {
    fontSize: 12,
    color: "#666",
  },
  detailsButton: {
    flexDirection: "row",
    alignItems: "center",
  },
  detailsButtonText: {
    color: "#003366",
    fontWeight: "600",
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
  productPreviewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 15,
    paddingBottom: 8,
    gap: 12,
  },
  productPreviewItem: {
    alignItems: 'center',
    marginRight: 12,
  },
  productPreviewImage: {
    width: 36,
    height: 36,
    borderRadius: 6,
    backgroundColor: '#F5F5F5',
    marginBottom: 2,
  },
  productPreviewImagePlaceholder: {
    width: 36,
    height: 36,
    borderRadius: 6,
    backgroundColor: '#e0e0e0',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 2,
  },
  productPreviewName: {
    fontSize: 11,
    color: '#555',
    maxWidth: 60,
    textAlign: 'center',
  },
  productPreviewMore: {
    fontSize: 12,
    color: '#003366',
    fontWeight: '600',
  },
  productPreviewEmpty: {
    fontSize: 12,
    color: '#999',
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
  cancelButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#DC2626',
  },
  cancelButtonText: {
    color: '#DC2626',
    fontWeight: '600',
    marginLeft: 4,
    fontSize: 12,
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
});

const detailStyles = StyleSheet.create({
  orderDetailsContainer: {
    backgroundColor: "#f9fafc",
    padding: 15,
    borderTopWidth: 1,
    borderTopColor: "#f0f0f0",
  },
  orderDetailsTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: "#003366",
    marginBottom: 15,
  },
  headerRow: {
    flexDirection: "row",
    paddingBottom: 8,
    marginBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
    alignItems: 'center',
  },
  headerCell: {
    fontSize: 12,
    fontWeight: "600",
    color: "#003366",
    flex: 1,
    textAlign: 'left',
  },
  imageHeader: {
    width: 50 + 12,
    flexBasis: 62,
  },
  productNameHeader: {
    flex: 2.2,
  },
  productRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  productImageBox: { width: 44, height: 44, borderRadius: 8, backgroundColor: '#F5F5F5', justifyContent: 'center', alignItems: 'center', marginRight: 12, overflow: 'hidden' },
  productImage: { width: 40, height: 40, borderRadius: 6 },
  productImagePlaceholder: { width: 40, height: 40, borderRadius: 6, backgroundColor: '#e0e0e0', justifyContent: 'center', alignItems: 'center' },
  productCell: {
    fontSize: 14,
    color: "#555",
    flex: 1,
  },
  noProductsText: {
    fontSize: 14,
    color: "#777",
  },
  productNameCell: {
    flex: 2.2,
    fontWeight: '500',
  },
  qtyHeader: { flex: 0.8, textAlign: 'right' },
  priceHeader: { flex: 1, textAlign: 'right' },
  qtyCell: { flex: 0.8, textAlign: 'right' },
  priceCell: { flex: 1, textAlign: 'right' },
  qtyHeaderFixed: { flex: 0.8, textAlign: 'right' },
  priceHeaderFixed: { flex: 1, textAlign: 'right' },
  qtyCellFixed: { flex: 0.8, textAlign: 'right' },
  priceCellFixed: { flex: 1, textAlign: 'right' },
});

export default OrdersHistory;