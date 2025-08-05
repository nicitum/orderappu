import React, { useState, useEffect, useRef } from 'react';
import { 
  View, 
  Text, 
  TextInput, 
  FlatList, 
  StyleSheet, 
  TouchableOpacity, 
  ActivityIndicator, 
  Alert, 
  SafeAreaView,
  StatusBar,
  ScrollView,
  Platform,
  Modal,
  Image,

} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { useNavigation } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Toast from 'react-native-toast-message';
import { jwtDecode } from 'jwt-decode';
import Icon from 'react-native-vector-icons/MaterialIcons';
import SearchProductModal_1 from './searchProductModal_1';
import moment from 'moment';
import { checkTokenAndRedirect } from '../../services/auth';
import { ipAddress } from '../../services/urls';
import axios from 'axios';

// Clean Color Palette
const COLORS = {
  primary: "#003366",
  primaryLight: "#004488",
  primaryDark: "#002244",
  secondary: "#10B981",
  accent: "#F59E0B",
  success: "#059669",
  error: "#DC2626",
  warning: "#D97706",
  background: "#F3F4F6",
  surface: "#FFFFFF",
  text: {
    primary: "#111827",
    secondary: "#4B5563",
    tertiary: "#9CA3AF",
    light: "#FFFFFF",
  },
  border: "#E5E7EB",
  divider: "#F3F4F6",
  card: {
    background: "#FFFFFF",
    shadow: "rgba(0, 0, 0, 0.1)",
  },
};

// Format currency
const formatCurrency = (amount) => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  }).format(amount);
};

// Format date
const formatDate = (epochTime) => {
  if (!epochTime) return "N/A";
  const date = new Date(epochTime * 1000);
  return date.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
};

const AdminOrderUpdate = () => {
  const navigation = useNavigation();
  const [orders, setOrders] = useState([]);
  const [selectedOrderId, setSelectedOrderId] = useState(null);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteLoadingIndex, setDeleteLoadingIndex] = useState(null);
  const [orderDeleteLoading, setOrderDeleteLoading] = useState(false);
  const [orderDeleteLoadingId, setOrderDeleteLoadingId] = useState(null);
  const [selectedOrderCustomerId, setSelectedOrderCustomerId] = useState(null);
  const [allowProductEdit, setAllowProductEdit] = useState(false);
  const [allowCancelOrder, setAllowCancelOrder] = useState(false);
  // Store all products for image lookup
  const [allProducts, setAllProducts] = useState([]);
  // Customer names state
  const [customerNames, setCustomerNames] = useState({});
  // Cancelled filter state
  const [cancelledFilter, setCancelledFilter] = useState('All'); // 'All', 'Yes', 'No'

  // Add refs for scroll and order details
  const scrollViewRef = useRef(null);
  const orderDetailsRef = useRef(null);

  // Edit modal states (following AdminCartPage pattern)
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editProduct, setEditProduct] = useState(null);
  const [editPrice, setEditPrice] = useState('');
  const [editQty, setEditQty] = useState('1');
  const [editError, setEditError] = useState(null);

  useEffect(() => {
    fetchAdminOrders();
    fetchUserPermissions();
    fetchAllProductsForImages();
  }, []);

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

  // Scroll to order details when selectedOrderId changes
  useEffect(() => {
    if (selectedOrderId && orderDetailsRef.current && scrollViewRef.current) {
      setTimeout(() => {
        orderDetailsRef.current.measureLayout(
          scrollViewRef.current.getInnerViewNode(),
          (x, y) => {
            scrollViewRef.current.scrollTo({ y: y - 16, animated: true });
          }
        );
      }, 300); // Delay to ensure layout is ready
    }
  }, [selectedOrderId]);

  const fetchUserPermissions = async () => {
    try {
      const token = await checkTokenAndRedirect(navigation);
      if (!token) return;

      const response = await fetch(`http://${ipAddress}:8091/userDetails`, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        }
      });

      if (response.ok) {
        const data = await response.json();
        const user = data.user;
        setAllowProductEdit(user.allow_product_edit === 'Yes');
        setAllowCancelOrder(user.allow_cancel_order === 'Yes');
      } else {
        setAllowProductEdit(false);
        setAllowCancelOrder(false);
      }
    } catch (error) {
      console.error('Error fetching user details:', error);
      setAllowProductEdit(false);
      setAllowCancelOrder(false);
    }
  };

  const fetchAdminOrders = async () => {
    setLoading(true);
    setError(null);
    try {
      const token = await AsyncStorage.getItem("userAuthToken");
      if (!token) throw new Error("No authentication token found");

      const decodedToken = jwtDecode(token);
      const adminId = decodedToken.id1;

      const todayFormatted = moment().format("YYYY-MM-DD");
      const url = `http://${ipAddress}:8091/get-admin-orders/${adminId}?date=${todayFormatted}`;

      const headers = {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Accept: "application/json"
      };

      const ordersResponse = await fetch(url, { headers });

      if (!ordersResponse.ok) {
        const errorText = await ordersResponse.text();
        throw new Error(`Failed to fetch admin orders: ${ordersResponse.status}, ${errorText}`);
      }

      const ordersData = await ordersResponse.json();
      if (!ordersData.success) {
        throw new Error(ordersData.message || "Failed to fetch admin orders");
      }

      setOrders(ordersData.orders);
    } catch (fetchOrdersError) {
      const errorMessage = fetchOrdersError.message || "Failed to fetch admin orders.";
      setError(errorMessage);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: errorMessage
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchOrderProducts = async (orderIdToFetch) => {
    setLoading(true);
    setError(null);
    try {
      const token = await AsyncStorage.getItem("userAuthToken");
      const url = `http://${ipAddress}:8091/order-products?orderId=${orderIdToFetch}`;
      const headers = {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
      };

      const productsResponse = await fetch(url, { headers });

      if (!productsResponse.ok) {
        const errorText = await productsResponse.text();
        if (productsResponse.status !== 404) {
          throw new Error(`Failed to fetch order products. Status: ${productsResponse.status}, Text: ${errorText}`);
        } else {
          setProducts([]);
          setSelectedOrderId(orderIdToFetch);
          const selectedOrder = orders.find(order => order.id === orderIdToFetch);
          if (selectedOrder) {
            setSelectedOrderCustomerId(selectedOrder.customer_id);
          }
          return;
        }
      }

      const productsData = await productsResponse.json();
      setProducts(productsData);
      setSelectedOrderId(orderIdToFetch);
      
      const selectedOrder = orders.find(order => order.id === orderIdToFetch);
      if (selectedOrder) {
        setSelectedOrderCustomerId(selectedOrder.customer_id);
      }

    } catch (error) {
      setError(error.message || "Failed to fetch order products.");
      Toast.show({ 
        type: 'error', 
        text1: 'Error', 
        text2: error.message || "Failed to fetch order products." 
      });
      setProducts([]);
      setSelectedOrderId(null);
      setSelectedOrderCustomerId(null);
    } finally {
      setLoading(false);
    }
  };

  const handleEditProduct = (item) => {
    // Find the full product info from allProducts
    const fullProduct = allProducts.find(p => p.id === item.product_id || p.id === item.id);
    setEditProduct({
      ...item,
      min_selling_price: fullProduct?.min_selling_price ?? fullProduct?.minSellingPrice ?? 0,
      discountPrice: fullProduct?.discountPrice ?? fullProduct?.selling_price ?? fullProduct?.price ?? 0,
    });
    setEditPrice(item.price.toString());
    setEditQty(item.quantity.toString());
    setEditError(null);
    setEditModalVisible(true);
  };

  const saveEditProduct = async () => {
    if (!editProduct) return;
    
    const newPrice = parseFloat(editPrice);
    const newQty = parseInt(editQty);
    
    if (isNaN(newPrice) || newPrice <= 0) {
      setEditError('Please enter a valid price');
      return;
    }
    
    if (isNaN(newQty) || newQty <= 0) {
      setEditError('Please enter a valid quantity');
      return;
    }

    setLoading(true);
    try {
      const token = await AsyncStorage.getItem("userAuthToken");
      
      const url = `http://${ipAddress}:8091/order_update`;
      const headers = {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
      };
      
      const productsToUpdate = products.map(product => {
        if (product.product_id === editProduct.product_id) {
          return {
            order_id: selectedOrderId,
            product_id: product.product_id,
            name: product.name,
            category: product.category,
            price: newPrice,
            quantity: newQty,
            gst_rate: product.gst_rate
          };
        }
        return {
          order_id: selectedOrderId,
          product_id: product.product_id,
          name: product.name,
          category: product.category,
          price: product.price,
          quantity: product.quantity,
          gst_rate: product.gst_rate
        };
      });

      const calculatedTotalAmount = productsToUpdate.reduce((sum, product) => {
        return sum + (product.quantity * product.price);
      }, 0);

      const requestBody = {
        orderId: selectedOrderId,
        products: productsToUpdate,
        totalAmount: calculatedTotalAmount,
        total_amount: calculatedTotalAmount
      };

      const updateResponse = await fetch(url, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(requestBody)
      });

      if (!updateResponse.ok) {
        const errorText = await updateResponse.text();
        throw new Error(`Failed to update product. Status: ${updateResponse.status}, Text: ${errorText}`);
      }

      const updateData = await updateResponse.json();

      // Update local state
      setProducts(prevProducts => 
        prevProducts.map(product => 
          product.product_id === editProduct.product_id 
            ? { ...product, price: newPrice, quantity: newQty }
            : product
        )
      );

      setEditModalVisible(false);
      setEditProduct(null);
      setEditPrice('');
      setEditQty('1');
      setEditError(null);

      Toast.show({
        type: 'success',
        text1: 'Product Updated',
        text2: 'Product has been updated successfully'
      });

    } catch (error) {
      setEditError(error.message || "Failed to update product.");
      Toast.show({ 
        type: 'error', 
        text1: 'Error', 
        text2: error.message || "Failed to update product." 
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteProductItem = async (indexToDelete) => {
    const productToDelete = products[indexToDelete];
    if (!productToDelete || !productToDelete.order_id) {
      Toast.show({ 
        type: 'error', 
        text1: 'Error', 
        text2: "Could not delete product item. Order Product ID missing." 
      });
      return;
    }

    setDeleteLoading(true);
    setDeleteLoadingIndex(indexToDelete);
    setError(null);

    try {
      const token = await AsyncStorage.getItem("userAuthToken");
      const orderProductIdToDelete = productToDelete.product_id;

      const url = `http://${ipAddress}:8091/delete_order_product/${orderProductIdToDelete}`;
      const headers = {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
      };
      const deleteResponse = await fetch(url, {
        method: 'DELETE',
        headers: headers,
      });

      if (!deleteResponse.ok) {
        const errorText = await deleteResponse.text();
        throw new Error(`Failed to delete order product. Status: ${deleteResponse.status}, Text: ${errorText}`);
      }

      const deleteData = await deleteResponse.json();

      // Do NOT cancel the order if last product is deleted. Just update products state.
      const updatedProducts = products.filter((_, index) => index !== indexToDelete);
      setProducts(updatedProducts);
      
      Toast.show({
        type: 'success',
        text1: 'Product Deleted',
        text2: "Product item deleted successfully from order."
      });

    } catch (deleteError) {
      setError(deleteError.message || "Failed to delete order product.");
      Toast.show({ 
        type: 'error', 
        text1: 'Error', 
        text2: deleteError.message || "Failed to delete product item." 
      });
    } finally {
      setDeleteLoading(false);
      setDeleteLoadingIndex(null);
    }
  };

  const handleUpdateOrder = async () => {
    if (!selectedOrderId) {
      Alert.alert("Error", "Please select an order to update.");
      return;
    }
    setLoading(true);
    setError(null);

    try {
      const token = await AsyncStorage.getItem("userAuthToken");

      let calculatedTotalAmount = 0;
      const productsToUpdate = products.map(product => ({
        order_id: selectedOrderId,
        product_id: product.product_id,
        name: product.name,
        category: product.category,
        price: product.price,
        quantity: product.quantity,
        gst_rate: product.gst_rate
      }));

      productsToUpdate.forEach(product => {
        calculatedTotalAmount += product.quantity * product.price;
      });

      const url = `http://${ipAddress}:8091/order_update`;
      const headers = {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
      };
      const requestBody = {
        orderId: selectedOrderId,
        products: productsToUpdate,
        totalAmount: calculatedTotalAmount,
        total_amount: calculatedTotalAmount
      };

      const updateResponse = await fetch(url, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(requestBody)
      });

      if (!updateResponse.ok) {
        const errorText = await updateResponse.text();
        throw new Error(`Failed to update order. Status: ${updateResponse.status}, Text: ${errorText}`);
      }

      const updateData = await updateResponse.json();

      Toast.show({
        type: 'success',
        text1: 'Order Updated',
        text2: updateData.message || "Order updated successfully!"
      });

      await fetchAdminOrders();
      setSelectedOrderId(null);
      setProducts([]);

    } catch (error) {
      setError(error.message || "Failed to update order.");
      Toast.show({ 
        type: 'error', 
        text1: 'Error', 
        text2: error.message || "Failed to update order." 
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteOrder = async (orderIdToDelete) => {
    setOrderDeleteLoading(true);
    setOrderDeleteLoadingId(orderIdToDelete);
    setError(null);

    try {
      const token = await AsyncStorage.getItem("userAuthToken");
      const headers = {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      };

      const deleteOrderResponse = await fetch(
        `http://${ipAddress}:8091/cancel_order/${orderIdToDelete}`,
        { method: "POST", headers }
      );

      if (!deleteOrderResponse.ok) {
        const errorText = await deleteOrderResponse.text();
        throw new Error(`Failed to delete order. Status: ${deleteOrderResponse.status}, Text: ${errorText}`);
      }

      const deleteOrderData = await deleteOrderResponse.json();
      if (!deleteOrderData.success) {
        throw new Error(deleteOrderData.message || "Failed to cancel the order.");
      }

      setSelectedOrderId(null);
      setProducts([]);
      await fetchAdminOrders();

      Toast.show({
        type: "success",
        text1: "Order Cancelled",
        text2: deleteOrderData.message || `Order ID ${orderIdToDelete} cancelled successfully.`,
      });
    } catch (error) {
      setError(error.message || "Failed to cancel order.");
      Toast.show({
        type: "error",
        text1: "Error",
        text2: error.message || "Failed to cancel the order.",
      });
    } finally {
      setOrderDeleteLoading(false);
      setOrderDeleteLoadingId(null);
    }
  };

  const handleAddProductToOrder = async (productToAdd) => {
    if (!selectedOrderId) return Alert.alert("Error", "Please select an order.");
    if (products.some(p => p.product_id === productToAdd.id)) {
      Toast.show({ 
        type: 'info', 
        text1: 'Product Already Added', 
        text2: 'Update quantity instead.' 
      });
      setShowSearchModal(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const token = await AsyncStorage.getItem("userAuthToken");
      const orderToCheck = orders.find(order => order.id === selectedOrderId);
      if (!orderToCheck) {
        Toast.show({ 
          type: 'error', 
          text1: 'Order Not Found', 
          text2: "The selected order no longer exists. Please select or create a new order." 
        });
        setSelectedOrderId(null);
        setProducts([]);
        await fetchAdminOrders();
        return;
      }

      // Use price and quantity from modal/productToAdd
      const payload = {
        orderId: selectedOrderId,
        productId: productToAdd.id,
        quantity: productToAdd.quantity ?? 1,
        price: productToAdd.price,
        name: productToAdd.name,
        category: productToAdd.category,
        gst_rate: productToAdd.gst_rate !== undefined ? productToAdd.gst_rate : 0
      };

      const response = await fetch(`http://${ipAddress}:8091/add-product-to-order`, {
        method: 'POST',
        headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to add product: ${response.status}, ${errorText}`);
      }

      const addProductData = await response.json();
      if (addProductData.success) {
        Toast.show({ 
          type: 'success', 
          text1: 'Product Added', 
          text2: `${productToAdd.name} added with price ₹${productToAdd.price}.` 
        });
        fetchOrderProducts(selectedOrderId);
        setShowSearchModal(false);
      } else {
        throw new Error(addProductData.message || "Failed to add product.");
      }
    } catch (error) {
      setError(error.message || "Failed to add product.");
      Toast.show({ 
        type: 'error', 
        text1: 'Error', 
        text2: error.message 
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchAllProductsForImages = async () => {
    try {
      const token = await AsyncStorage.getItem("userAuthToken");
      if (!token) return;
      const response = await fetch(`http://${ipAddress}:8091/products`, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });
      if (!response.ok) return;
      const data = await response.json();
      setAllProducts(data);
    } catch (error) {
      setAllProducts([]);
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
    if (name) {
      setCustomerNames(prev => ({ ...prev, [customerId]: name }));
    }
    return name;
  };

  const renderOrderItem = ({ item }) => (
    <TouchableOpacity
      style={[
        styles.orderCard,
        selectedOrderId === item.id && styles.selectedOrderCard
      ]}
      onPress={() => {
        if (selectedOrderId === item.id) {
          setSelectedOrderId(null);
          setProducts([]);
          setSelectedOrderCustomerId(null);
        } else {
          fetchOrderProducts(item.id);
        }
      }}
    >
      <View style={styles.orderCardContent}>
        <View style={styles.orderLeftSection}>
          <Text style={styles.orderIdText}>#{item.id}</Text>
          <Text style={styles.customerNameText}>
            {customerNames[item.customer_id] ? 
              customerNames[item.customer_id] : 
              `ID: ${item.customer_id}`
            }
          </Text>
        </View>
        <View style={styles.orderCenterSection}>
          <Text style={styles.orderAmountText}>{formatCurrency(item.total_amount)}</Text>
          <View style={styles.statusContainer}>
            {item.cancelled === 'Yes' && (
              <Text style={styles.cancelledStatusText}>Cancelled</Text>
            )}
            {item.loading_slip === "Yes" && (
              <Text style={styles.processedStatusText}>Processed</Text>
            )}
            {item.approve_status === 'Rejected' && (
              <Text style={styles.rejectedStatusText}>Rejected</Text>
            )}
          </View>
        </View>
        {allowCancelOrder && (
          <TouchableOpacity
            style={[
              styles.cancelOrderButton,
              (item.loading_slip === "Yes" || item.cancelled === "Yes" || item.approve_status === "Rejected") && styles.disabledCancelButton
            ]}
            onPress={() => handleDeleteOrder(item.id)}
            disabled={orderDeleteLoading || item.loading_slip === "Yes" || item.cancelled === "Yes" || item.approve_status === "Rejected"}
          >
            {orderDeleteLoading && orderDeleteLoadingId === item.id ? (
              <ActivityIndicator size="small" color={COLORS.text.light} />
            ) : (
              <Icon name="cancel" size={16} color={COLORS.text.light} />
            )}
          </TouchableOpacity>
        )}
      </View>
    </TouchableOpacity>
  );

  const renderProductItem = ({ item, index }) => {
    // Try to get image from item.image, or from allProducts (by product_id), fallback to placeholder
    let imageName = item.image;
    if (!imageName) {
      const prod = allProducts.find(p => p.id === item.product_id || p.id === item.id);
      imageName = prod?.image;
    }
    const imageUri = imageName ? `http://${ipAddress}:8091/images/products/${imageName}` : null;
    const itemTotal = (item.price || 0) * (item.quantity || 1);

    return (
      <View style={styles.productCard}>
        <View style={styles.productContent}>
          <View style={styles.productImageContainer}>
            {imageUri ? (
              <Image
                source={{ uri: imageUri }}
                style={styles.productImage}
                resizeMode="cover"
                onError={() => console.warn(`Failed to load image for ${item.name}`)}
              />
            ) : (
              <View style={[styles.productImage, styles.noImageContainer]}>
                <Icon name="image-not-supported" size={24} color="#CCC" />
              </View>
            )}
          </View>
          <View style={styles.productDetails}>
            <Text style={styles.productName} numberOfLines={2}>{item.name}</Text>
            <Text style={styles.productPrice}>{formatCurrency(item.price || 0)} x {item.quantity || 1} = {formatCurrency(itemTotal)}</Text>
            {item.category && <Text style={styles.productCategory}>{item.category}</Text>}
            <TouchableOpacity 
              style={[styles.editButton, !isOrderEditable && styles.disabledEditButton]}
              onPress={() => handleEditProduct(item)}
              disabled={!isOrderEditable}
            >
              <Icon name="edit" size={16} color={isOrderEditable ? COLORS.primary : COLORS.text.tertiary} />
              <Text style={[styles.editButtonText, !isOrderEditable && styles.disabledEditButtonText]}>Edit</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.productActions}>
            <TouchableOpacity
              style={[
                styles.deleteButton,
                !isOrderEditable && styles.disabledDeleteButton
              ]}
              onPress={() => handleDeleteProductItem(index)}
              disabled={deleteLoading || !isOrderEditable}
            >
              {deleteLoading && deleteLoadingIndex === index ? (
                <ActivityIndicator size="small" color={COLORS.error} />
              ) : (
                <Icon
                  name="delete"
                  size={20}
                  color={!isOrderEditable ? COLORS.text.tertiary : COLORS.error}
                />
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  };

  const selectedOrder = orders.find((order) => order.id === selectedOrderId);
  const totalAmount = products.reduce((sum, product) => {
    return sum + (product.quantity * product.price);
  }, 0);

  // Centralized order editability check
  const isOrderEditable = selectedOrder && 
    selectedOrder.cancelled !== 'Yes' && 
    selectedOrder.approve_status !== 'Rejected' &&
    selectedOrder.loading_slip !== "Yes";

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

  const getAcceptanceStatusText = (status) => {
    if (!status) return 'PENDING';
    return status.toUpperCase();
  };

  const getCancellationStatusText = (cancelled) => {
    return cancelled === 'Yes' ? 'CANCELLED' : 'ACTIVE';
  };

  // Get order status message for better UX
  const getOrderStatusMessage = (order) => {
    if (!order) return "Select an order to edit";
    if (order.cancelled === 'Yes') return "Order Cancelled";
    if (order.approve_status === 'Rejected') return "Order Rejected";
    if (order.loading_slip === "Yes") return "Order Processed";
    // Use actual backend status
    if (order.approve_status) return `Order ${order.approve_status}`;
    if (order.delivery_status) return `Order ${order.delivery_status}`;
    return "Update Order";
  };

  // Get order status color for visual feedback
  const getOrderStatusColor = (order) => {
    if (!order) return COLORS.text.secondary;
    if (order.cancelled === 'Yes' || order.approve_status === 'Rejected') return COLORS.error;
    if (order.loading_slip === "Yes") return COLORS.success;
    // Color based on actual status
    if (order.approve_status === 'Accepted' || order.approve_status === 'Approved' || order.delivery_status === 'Delivered') return COLORS.success;
    if (order.approve_status === 'Altered') return '#1E40AF'; // Deep blue for Altered
    if (order.delivery_status === 'Processing') return COLORS.warning;
    if (order.approve_status === 'Pending' || order.delivery_status === 'Pending') return COLORS.accent;
    return COLORS.primary;
  };

  // Get single status text - Priority: Cancelled > Rejected > Pending
  const getOrderStatusText = (order) => {
    if (order.cancelled === 'Yes') return 'CANCELLED';
    if (order.approve_status === 'Rejected') return 'REJECTED';
    // Use actual backend status values
    if (order.approve_status) return order.approve_status.toUpperCase();
    if (order.delivery_status) return order.delivery_status.toUpperCase();
    return 'PENDING';
  };

  // Get appropriate icon for order status
  const getOrderStatusIcon = (order) => {
    if (order.cancelled === 'Yes') return 'cancel';
    if (order.approve_status === 'Rejected') return 'block';
    if (order.loading_slip === "Yes") return 'check-circle';
    // Icon based on actual status
    if (order.approve_status === 'Approved' || order.delivery_status === 'Delivered') return 'check-circle';
    if (order.approve_status === 'Altered' || order.delivery_status === 'Processing') return 'pending';
    if (order.approve_status === 'Pending' || order.delivery_status === 'Pending') return 'schedule';
    return 'info';
  };

  // Filtered orders based on cancelled state
  const filteredOrders = orders.filter(order => {
    if (cancelledFilter === 'All') return true;
    if (cancelledFilter === 'Yes') return order.cancelled === 'Yes';
    if (cancelledFilter === 'No') return order.cancelled !== 'Yes';
    return true;
  });

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.background} />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Icon name="arrow-back" size={24} color={COLORS.text.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Update Orders</Text>
        <TouchableOpacity
          style={styles.refreshButton}
          onPress={fetchAdminOrders}
        >
          <Icon name="refresh" size={24} color={COLORS.primary} />
        </TouchableOpacity>
      </View>
      {/* Cancelled filter dropdown */}
      <View style={styles.cancelledFilterContainer}>
        <Text style={styles.cancelledFilterLabel}>Show Cancelled:</Text>
        <Picker
          selectedValue={cancelledFilter}
          style={styles.cancelledFilterPicker}
          onValueChange={(value) => setCancelledFilter(value)}
          mode="dropdown"
        >
          <Picker.Item label="All" value="All" />
          <Picker.Item label="Yes" value="Yes" />
          <Picker.Item label="No" value="No" />
        </Picker>
      </View>

      {loading && !selectedOrderId && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Loading your orders...</Text>
        </View>
      )}

      {error && (
        <View style={styles.errorContainer}>
          <Icon name="error-outline" size={24} color={COLORS.text.light} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      <ScrollView 
        style={styles.scrollContainer}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        ref={scrollViewRef}
      >
        <View style={styles.ordersContainer}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Today's Orders</Text>
            <View style={styles.orderCountBadge}>
              <Text style={styles.orderCountText}>
                {orders.length} order{orders.length !== 1 ? "s" : ""}
              </Text>
            </View>
          </View>

          {orders.length === 0 && !loading ? (
            <View style={styles.emptyContainer}>
              <Icon name="shopping-basket" size={48} color={COLORS.text.tertiary} />
              <Text style={styles.emptyText}>No orders for today</Text>
              <Text style={styles.emptySubtext}>Your orders will appear here</Text>
            </View>
          ) : (
            <FlatList
              data={filteredOrders}
              keyExtractor={(item) => item.id.toString()}
              renderItem={renderOrderItem}
              scrollEnabled={false}
              contentContainerStyle={styles.orderList}
              ItemSeparatorComponent={() => <View style={styles.orderSeparator} />}
            />
          )}
        </View>
        {/* Order details/products section anchor for scroll */}
        {selectedOrderId && selectedOrder && (
          <View ref={orderDetailsRef} />
        )}
        {selectedOrderId && selectedOrder && (
          <View style={styles.editContainer}>
            {/* Order Status Banner */}
            {!isOrderEditable && (
              <View style={[styles.orderStatusBanner, { backgroundColor: getOrderStatusColor(selectedOrder) + '15' }]}>
                <Icon 
                  name={getOrderStatusIcon(selectedOrder)} 
                  size={16} 
                  color={getOrderStatusColor(selectedOrder)} 
                />
                <Text style={[styles.orderStatusBannerText, { color: getOrderStatusColor(selectedOrder) }]}>
                  {getOrderStatusMessage(selectedOrder)}
                </Text>
              </View>
            )}

            <View style={styles.orderDetailsCard}>
              <View style={styles.orderDetailRow}>
                <View style={styles.orderDetailItem}>
                  <Icon name="calendar-today" size={16} color={COLORS.text.secondary} />
                  <Text style={styles.orderDetailText}>
                    {formatDate(selectedOrder.placed_on)}
                  </Text>
                </View>
              </View>
              <View style={styles.orderStatusContainer}>
                <Icon 
                  name={selectedOrder.loading_slip === "Yes" ? "check-circle" : "pending"} 
                  size={16} 
                  color={selectedOrder.loading_slip === "Yes" ? COLORS.success : COLORS.warning} 
                />
                <Text style={[
                  styles.orderStatusText,
                  { color: selectedOrder.loading_slip === "Yes" ? COLORS.success : COLORS.warning }
                ]}>
                  {selectedOrder.loading_slip === "Yes" ? "Processed" : "Pending"}
                </Text>
              </View>
            </View>

            <View style={styles.editHeader}>
              <Text style={styles.sectionTitle}>Edit Order #{selectedOrderId}</Text>
              <TouchableOpacity
                style={[
                  styles.addProductButton,
                  (!isOrderEditable) && styles.disabledButton
                ]}
                onPress={() => setShowSearchModal(true)}
                disabled={!isOrderEditable}
              >
                <Icon name="add" size={20} color={COLORS.text.light} />
                <Text style={styles.addProductButtonText}>Add Product</Text>
              </TouchableOpacity>
            </View>

            {products.length === 0 ? (
              <View style={styles.emptyProductsContainer}>
                <Icon name="box-open" size={48} color={COLORS.text.tertiary} />
                <Text style={styles.emptyProductsText}>No products in this order</Text>
                <TouchableOpacity
                  style={[
                    styles.addProductsButton,
                    (!isOrderEditable) && styles.disabledButton
                  ]}
                  onPress={() => setShowSearchModal(true)}
                  disabled={!isOrderEditable}
                >
                  <Text style={styles.addProductsButtonText}>Add Products</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <>
                <FlatList
                  data={products}
                  keyExtractor={(_, index) => index.toString()}
                  renderItem={renderProductItem}
                  scrollEnabled={false}
                  contentContainerStyle={styles.productList}
                  ItemSeparatorComponent={() => <View style={styles.productSeparator} />}
                />
                <View style={styles.summaryContainer}>
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Items:</Text>
                    <Text style={styles.summaryValue}>
                      {products.length} item{products.length !== 1 ? "s" : ""}
                    </Text>
                  </View>
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Total Amount:</Text>
                    <Text style={styles.summaryAmount}>
                      {formatCurrency(totalAmount)}
                    </Text>
                  </View>
                </View>
              </>
            )}

            <View style={styles.footer}>
              <TouchableOpacity
                style={[
                  styles.updateButton,
                  (!isOrderEditable) && styles.disabledButton
                ]}
                onPress={handleUpdateOrder}
                disabled={loading || !isOrderEditable}
              >
                <Text style={styles.updateButtonText}>
                  {getOrderStatusMessage(selectedOrder)}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </ScrollView>

      {/* Edit Product Modal */}
      <Modal
        visible={editModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setEditModalVisible(false)}
      >
        <View style={styles.modalBackground}>
          <View style={styles.editModalContainer}>
            <View style={styles.editModalHeader}>
              <Text style={styles.editModalTitle}>Edit Product</Text>
              <TouchableOpacity
                style={styles.modalCloseButton}
                onPress={() => setEditModalVisible(false)}
              >
                <Icon name="close" size={20} color={COLORS.text.primary} />
              </TouchableOpacity>
            </View>
            
            {editProduct && (
              <View style={styles.editModalContent}>
                <Text style={styles.editItemName}>{editProduct.name}</Text>
                
                <View style={styles.editInputRow}>
                  <View style={styles.editInputContainer}>
                    <Text style={styles.editInputLabel}>Price (₹)</Text>
                    <TextInput
                      style={[styles.editTextInput, !allowProductEdit && styles.disabledInput]}
                      value={editPrice}
                      onChangeText={allowProductEdit ? setEditPrice : undefined}
                      placeholder="Price"
                      keyboardType="numeric"
                      placeholderTextColor={COLORS.text.tertiary}
                      editable={allowProductEdit}
                    />
                    {editProduct && allowProductEdit && (
                      <Text style={styles.priceRangeText}>
                        Range: ₹{editProduct.min_selling_price || 0} - ₹{editProduct.discountPrice || editProduct.price || 0}
                      </Text>
                    )}
                    {!allowProductEdit && (
                      <Text style={styles.disabledPriceText}>
                        Price editing disabled
                      </Text>
                    )}
                  </View>
                  
                  <View style={styles.editInputContainer}>
                    <Text style={styles.editInputLabel}>Quantity</Text>
                    <TextInput
                      style={styles.editTextInput}
                      value={editQty}
                      onChangeText={setEditQty}
                      placeholder="Qty"
                      keyboardType="numeric"
                      placeholderTextColor={COLORS.text.tertiary}
                    />
                  </View>
                </View>
                
                {editError && (
                  <Text style={styles.errorText}>{editError}</Text>
                )}
                
                <View style={styles.editModalButtons}>
                  <TouchableOpacity
                    style={styles.editCancelButton}
                    onPress={() => setEditModalVisible(false)}
                  >
                    <Text style={styles.editCancelText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.editSaveButton}
                    onPress={saveEditProduct}
                  >
                    <Text style={styles.editSaveText}>Save</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        </View>
      </Modal>

      <Toast />
      <SearchProductModal_1
        isVisible={showSearchModal}
        onClose={() => setShowSearchModal(false)}
        onAddProduct={handleAddProductToOrder}
        allowProductEdit={true}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.text.primary,
  },
  refreshButton: {
    padding: 8,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.9)",
  },
  loadingText: {
    fontSize: 16,
    color: COLORS.text.primary,
    marginTop: 16,
  },
  errorContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.error,
    padding: 12,
    margin: 16,
    borderRadius: 8,
  },
  errorText: {
    color: COLORS.text.light,
    marginLeft: 8,
    fontSize: 14,
  },
  scrollContainer: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 24,
  },
  ordersContainer: {
    padding: 16,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: COLORS.text.primary,
  },
  orderCountBadge: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  orderCountText: {
    color: COLORS.text.light,
    fontSize: 14,
    fontWeight: "600",
  },
  orderList: {
    paddingBottom: 12,
  },
  orderCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 8,
    padding: 12,
    marginVertical: 4,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 1,
    elevation: 1,
  },
  selectedOrderCard: {
    borderWidth: 2,
    borderColor: COLORS.primary,
    backgroundColor: "#F0F8FF",
    shadowColor: COLORS.primary,
    shadowOpacity: 0.2,
  },
  orderCardContent: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    height: 50,
  },
  orderLeftSection: {
    flex: 1,
  },
  orderCenterSection: {
    flex: 1,
    alignItems: "center",
  },
  customerNameText: {
    fontSize: 12,
    color: COLORS.text.secondary,
    marginTop: 2,
  },
  statusContainer: {
    marginTop: 2,
  },
  cancelledStatusText: {
    fontSize: 10,
    color: COLORS.error,
    fontWeight: "500",
  },
  processedStatusText: {
    fontSize: 10,
    color: COLORS.success,
    fontWeight: "500",
  },
  rejectedStatusText: {
    fontSize: 10,
    color: COLORS.error,
    fontWeight: "500",
  },
  orderInfo: {
    flex: 1,
    marginRight: 16,
  },
  orderHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  orderIdText: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.text.primary,
  },
  orderStatusContainer: {
    flexDirection: "row",
    gap: 8,
  },
  processedBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#E6FFED",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  processedText: {
    color: COLORS.success,
    fontSize: 11,
    fontWeight: "600",
    marginLeft: 4,
  },
  cancelledBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FEE2E2",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  cancelledText: {
    color: COLORS.error,
    fontSize: 11,
    fontWeight: "600",
    marginLeft: 4,
  },
  rejectedBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FEE2E2",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  rejectedText: {
    color: COLORS.error,
    fontSize: 11,
    fontWeight: "600",
    marginLeft: 4,
  },
  orderDetails: {
    flexDirection: "column",
    gap: 8,
  },
  orderDetail: {
    flexDirection: "row",
    alignItems: "center",
  },
  orderDetailText: {
    fontSize: 12,
    color: COLORS.text.secondary,
    marginLeft: 6,
  },
  orderActionsContainer: {
    alignItems: "flex-end",
    justifyContent: "space-between",
    height: "100%",
    minHeight: 50,
  },
  orderAmountText: {
    fontSize: 16,
    fontWeight: "600", 
    color: COLORS.primary,
  },
  cancelOrderButton: {
    backgroundColor: COLORS.warning,
    padding: 6,
    borderRadius: 6,
    width: 28,
    height: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  disabledCancelButton: {
    backgroundColor: COLORS.text.tertiary,
    shadowOpacity: 0,
    elevation: 0,
  },
  orderSeparator: {
    height: 1,
    backgroundColor: COLORS.divider,
    marginVertical: 8,
  },
  editContainer: {
    backgroundColor: COLORS.surface,
    padding: 16,
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  orderStatusBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  orderStatusBannerText: {
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
  },
  orderDetailsCard: {
    backgroundColor: COLORS.background,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  orderDetailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  orderDetailItem: {
    flexDirection: "row",
    alignItems: "center",
  },
  orderStatusContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 8,
  },
  orderStatusText: {
    fontSize: 14,
    fontWeight: "600",
    marginLeft: 6,
  },
  editHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  addProductButton: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    flexDirection: "row",
    alignItems: "center",
  },
  addProductButtonText: {
    color: COLORS.text.light,
    marginLeft: 6,
    fontSize: 14,
    fontWeight: "600",
  },
  disabledButton: {
    backgroundColor: COLORS.text.tertiary,
  },
  productCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  productContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  productImageContainer: {
    width: 60,
    height: 60,
    marginRight: 12,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: COLORS.divider,
  },
  productImage: {
    width: '100%',
    height: '100%',
  },
  noImageContainer: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  productDetails: {
    flex: 1,
  },
  productName: {
    fontSize: 16,
    fontWeight: '500',
    color: COLORS.text.primary,
    marginBottom: 4,
  },
  productPrice: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.primary,
    marginBottom: 2,
  },
  productCategory: {
    fontSize: 12,
    color: COLORS.text.secondary,
  },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  disabledEditButton: {
    opacity: 0.5,
  },
  editButtonText: {
    fontSize: 12,
    color: COLORS.primary,
    marginLeft: 4,
  },
  disabledEditButtonText: {
    color: COLORS.text.tertiary,
  },
  productActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  deleteButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FEE2E2',
    borderRadius: 8,
  },
  productSeparator: {
    height: 1,
    backgroundColor: COLORS.divider,
    marginVertical: 8,
  },
  summaryContainer: {
    backgroundColor: "#F8FAFC",
    borderRadius: 12,
    padding: 16,
    marginTop: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  summaryLabel: {
    fontSize: 14,
    color: COLORS.text.secondary,
    fontWeight: "500",
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.text.primary,
  },
  summaryAmount: {
    fontSize: 18,
    fontWeight: "700",
    color: COLORS.primary,
  },
  footer: {
    marginTop: 16,
  },
  updateButton: {
    backgroundColor: COLORS.primary,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
  },
  updateButtonText: {
    color: COLORS.text.light,
    fontSize: 16,
    fontWeight: "600",
  },
  emptyContainer: {
    justifyContent: "center",
    alignItems: "center",
    padding: 40,
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    marginTop: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: "600",
    color: COLORS.text.primary,
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: COLORS.text.secondary,
    marginTop: 8,
    textAlign: "center",
  },
  emptyProductsContainer: {
    justifyContent: "center",
    alignItems: "center",
    padding: 30,
    backgroundColor: COLORS.background,
    borderRadius: 12,
    marginVertical: 12,
  },
  emptyProductsText: {
    fontSize: 16,
    color: COLORS.text.secondary,
    marginVertical: 12,
  },
  addProductsButton: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    marginTop: 10,
  },
  addProductsButtonText: {
    color: COLORS.text.light,
    fontSize: 14,
    fontWeight: "600",
  },
  // Modal styles
  modalBackground: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  editModalContainer: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    width: '90%',
    maxWidth: 400,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  editModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  editModalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.text.primary,
  },
  modalCloseButton: {
    padding: 4,
  },
  editModalContent: {
    padding: 16,
  },
  editItemName: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text.primary,
    marginBottom: 16,
  },
  editInputRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  editInputContainer: {
    flex: 1,
  },
  editInputLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.text.primary,
    marginBottom: 6,
  },
  editTextInput: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: COLORS.surface,
    color: COLORS.text.primary,
  },
  disabledInput: {
    backgroundColor: COLORS.divider,
    color: COLORS.text.tertiary,
  },
  priceRangeText: {
    fontSize: 12,
    color: COLORS.text.secondary,
    marginTop: 4,
  },
  disabledPriceText: {
    fontSize: 12,
    color: COLORS.text.tertiary,
    marginTop: 4,
    fontStyle: 'italic',
  },
  editModalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  editCancelButton: {
    flex: 1,
    backgroundColor: COLORS.divider,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  editCancelText: {
    color: COLORS.text.primary,
    fontSize: 16,
    fontWeight: '600',
  },
  editSaveButton: {
    flex: 1,
    backgroundColor: COLORS.primary,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  editSaveText: {
    color: COLORS.text.light,
    fontSize: 16,
    fontWeight: '600',
  },
  cancelledBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginLeft: 8,
  },
  cancelledText: {
    color: COLORS.error,
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },
  cancelledStateContainer: {
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 4,
  },
  cancelledBadgeCentered: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  cancelledTextCentered: {
    color: COLORS.error,
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 6,
  },
  rejectedStateContainer: {
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 4,
  },
  rejectedBadgeCentered: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  rejectedTextCentered: {
    color: COLORS.error,
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 6,
  },
  cancelledFilterContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    justifyContent: 'space-between',
  },
  cancelledFilterLabel: {
    fontSize: 14,
    color: COLORS.text.primary,
    fontWeight: '500',
  },
  cancelledFilterPicker: {
    width: 100,
    height: 28,
    marginLeft: 8,
  },
});

export default AdminOrderUpdate;