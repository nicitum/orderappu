import { ipAddress } from '../../../services/urls';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { jwtDecode } from 'jwt-decode';
import moment from 'moment';

/**
 * Fetch owner orders
 */
export const fetchOwnerOrders = async (setLoading, setError, setOrders, Toast) => {
  setLoading(true);
  setError(null);
  try {
    const token = await AsyncStorage.getItem("userAuthToken");
    if (!token) throw new Error("No authentication token found");

    const todayFormatted = moment().format("YYYY-MM-DD");
    const url = `http://${ipAddress}:8091/get-orders-sa?date=${todayFormatted}`;

    const headers = {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "application/json"
    };

    const ordersResponse = await fetch(url, { headers });

    if (!ordersResponse.ok) {
      const errorText = await ordersResponse.text();
      throw new Error(`Failed to fetch owner orders: ${ordersResponse.status}, ${errorText}`);
    }

    const ordersData = await ordersResponse.json();
    if (!ordersData.status) {
      throw new Error(ordersData.message || "Failed to fetch owner orders");
    }

    setOrders(ordersData.orders);
  } catch (fetchOrdersError) {
    const errorMessage = fetchOrdersError.message || "Failed to fetch owner orders.";
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

/**
 * Fetch order products
 */
export const fetchOrderProducts = async (orderIdToFetch, setLoading, setError, setProducts, setSelectedOrderId, setSelectedOrderCustomerId, orders, Toast) => {
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

/**
 * Delete order product
 */
export const deleteOrderProduct = async (productToDelete, setDeleteLoading, setDeleteLoadingIndex, indexToDelete, setError, setProducts, products, Toast) => {
  const orderProductIdToDelete = productToDelete.product_id;

  setDeleteLoading(true);
  setDeleteLoadingIndex(indexToDelete);
  setError(null);

  try {
    const token = await AsyncStorage.getItem("userAuthToken");

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

/**
 * Update order
 */
export const updateOrder = async (selectedOrderId, products, setLoading, setError, setOrders, setSelectedOrderId, setProducts, navigation, Toast) => {
  if (!selectedOrderId) {
    Toast.show({ type: 'error', text1: 'Error', text2: "Please select an order to update." });
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
    const decodedToken = jwtDecode(token);
    const requestBody = {
      orderId: selectedOrderId,
      products: productsToUpdate,
      totalAmount: calculatedTotalAmount,
      total_amount: calculatedTotalAmount,
      altered_by: decodedToken.username
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

    // Refresh orders
    const todayFormatted = moment().format("YYYY-MM-DD");
    const ordersUrl = `http://${ipAddress}:8091/get-orders-sa?date=${todayFormatted}`;
    const ordersHeaders = {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "application/json"
    };

    const ordersResponse = await fetch(ordersUrl, { headers });
    if (ordersResponse.ok) {
      const ordersData = await ordersResponse.json();
      if (ordersData.status) {
        setOrders(ordersData.orders);
      }
    }

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

/**
 * Delete order (cancel)
 */
export const deleteOrder = async (orderIdToDelete, setOrderDeleteLoading, setOrderDeleteLoadingId, setError, setSelectedOrderId, setProducts, setOrders, Toast) => {
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
    
    // Refresh orders
    const todayFormatted = moment().format("YYYY-MM-DD");
    const ordersUrl = `http://${ipAddress}:8091/get-orders-sa?date=${todayFormatted}`;
    const ordersHeaders = {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "application/json"
    };

    const ordersResponse = await fetch(ordersUrl, { headers });
    if (ordersResponse.ok) {
      const ordersData = await ordersResponse.json();
      if (ordersData.status) {
        setOrders(ordersData.orders);
      }
    }

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

/**
 * Add product to order
 */
export const addProductToOrder = async (productToAdd, selectedOrderId, products, setLoading, setError, setProducts, setSelectedOrderId, orders, setShowSearchModal, setOrders, Toast) => {
  if (!selectedOrderId) {
    Toast.show({ type: 'error', text1: 'Error', text2: "Please select an order." });
    return;
  }
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
      
      // Refresh orders
      const todayFormatted = moment().format("YYYY-MM-DD");
      const ordersUrl = `http://${ipAddress}:8091/get-orders-sa?date=${todayFormatted}`;
      const ordersHeaders = {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Accept: "application/json"
      };

      const ordersResponse = await fetch(ordersUrl, { headers });
      if (ordersResponse.ok) {
        const ordersData = await ordersResponse.json();
        if (ordersData.status) {
          setOrders(ordersData.orders);
        }
      }
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
      
      // Refresh order products
      const productsUrl = `http://${ipAddress}:8091/order-products?orderId=${selectedOrderId}`;
      const productsHeaders = {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
      };

      const productsResponse = await fetch(productsUrl, { headers });
      if (productsResponse.ok) {
        const productsData = await productsResponse.json();
        setProducts(productsData);
      }
      
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

/**
 * Fetch all products for images
 */
export const fetchAllProductsForImages = async (setAllProducts) => {
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

/**
 * Fetch customer name by customer ID
 */
export const fetchCustomerName = async (customerId) => {
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