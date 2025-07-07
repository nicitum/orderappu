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
} from "react-native";
import axios from "axios";
import { ipAddress } from "../../services/urls";
import { checkTokenAndRedirect } from "../../services/auth";
import { useNavigation } from "@react-navigation/native";
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

  useEffect(() => {
    fetchAllProducts();
    fetchOrders();
  }, [fetchOrders]);

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
          <Text style={detailStyles.headerCell}>Qty</Text>
          <Text style={detailStyles.headerCell}>Price</Text>
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
                <Text style={detailStyles.productCell}>{product.quantity || 0}</Text>
                <Text style={detailStyles.productCell}>₹{product.price !== undefined ? product.price : 0}</Text>
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
              const allProductsMap = new Map(allProductsData.map(p => [p.id, p]));
              const payload = {
                customer_id: order.customer_id,
                products: products.map(p => ({
                  product_id: p.product_id,
                  quantity: p.quantity,
                  price: p.price,
                  name: p.name,
                  category: p.category || '',
                  gst_rate: p.gst_rate || 0
                })),
              };
              console.log('REORDER /place payload:', payload);
              const response = await fetch(`http://${ipAddress}:8091/place`, {
                method: 'POST',
                headers: {
                  Authorization: `Bearer ${token}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload),
              });
              const data = await response.json();
              console.log('REORDER /place response:', data);
              if (!response.ok) {
                console.error('Reorder API error:', data);
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
              await AsyncStorage.setItem('cartItems', JSON.stringify(
                products.reduce((acc, p) => {
                  const fullProduct = allProductsMap.get(p.product_id);
                  if (fullProduct) {
                    acc[p.product_id] = {
                      ...fullProduct,
                      id: p.product_id,
                      quantity: p.quantity,
                    };
                  }
                  return acc;
                }, {})
              ));
              navigation.navigate('Cart');
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
            <Text style={styles.emptyStateText}>
              No orders found for selected date
            </Text>
          </View>
        ) : (
          orders.map((order) => (
            <View key={order.id} style={styles.orderCard}>
              <View style={styles.orderHeader}>
                <View>
                  <Text style={styles.orderId}>Order #{order.id}</Text>
                  <Text style={styles.orderDate}>{moment.unix(order.placed_on).format('MMM D, YYYY [at] h:mm A')}</Text>
                </View>
                <Text style={[styles.orderStatus, { backgroundColor: getStatusColor(order.delivery_status) }]}>
                  {(order.delivery_status || 'pending').toUpperCase()}
                </Text>
              </View>

              <View style={styles.orderSummary}>
                <Text style={styles.orderTotal}>₹{order.total_amount}</Text>
                <Text style={styles.orderType}>{order.order_type || ''}</Text>
              </View>

              <View style={styles.productPreviewRow}>
                {orderDetails[order.id] && orderDetails[order.id].length > 0 ? (
                  <>
                    {orderDetails[order.id].slice(0, 2).map((product, idx) => {
                      const prodData = allProductsData.find(p => p.id === product.product_id);
                      const imageUrl = prodData && prodData.image ? `http://${ipAddress}:8091/images/products/${prodData.image}` : null;
                      return (
                        <View key={product.product_id || idx} style={styles.productPreviewItem}>
                          {imageUrl ? (
                            <Image source={{ uri: imageUrl }} style={styles.productPreviewImage} resizeMode="contain" />
                          ) : (
                            <View style={styles.productPreviewImagePlaceholder}>
                              <MaterialIcons name="image-not-supported" size={24} color="#9E9E9E" />
                            </View>
                          )}
                          <Text style={styles.productPreviewName} numberOfLines={1}>{product.name || prodData?.name || 'Product'}</Text>
                        </View>
                      );
                    })}
                    {orderDetails[order.id].length > 2 && (
                      <Text style={styles.productPreviewMore}>+{orderDetails[order.id].length - 2} more</Text>
                    )}
                  </>
                ) : (
                  <Text style={styles.productPreviewEmpty}>No products</Text>
                )}
              </View>

              <View style={styles.orderFooter}>
                <TouchableOpacity
                  style={styles.reorderButton}
                  onPress={() => handleReorder(order)}
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
                    name={expandedOrderDetailsId === order.id ? 'chevron-up' : 'chevron-down'}
                    size={16}
                    color="#003366"
                  />
                </TouchableOpacity>
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
  dateFilterButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    paddingVertical: 8,
    paddingHorizontal: 12,
    trackColor: "#fff",
    borderRadius: 20,
  },
  dateFilterText: {
    color: "#fff",
    marginLeft: 8,
    fontSize: 14,
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
    marginTop: 12,
    alignSelf: 'flex-end',
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
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingHorizontal: 15,
    paddingBottom: 12,
    gap: 16,
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
    flex: 2,
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
    flex: 2,
    fontWeight: '500',
  },
});

export default OrdersHistory;