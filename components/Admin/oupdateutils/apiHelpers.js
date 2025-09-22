import AsyncStorage from '@react-native-async-storage/async-storage';
import { jwtDecode } from 'jwt-decode';
import axios from 'axios';
import moment from 'moment';
import { ipAddress } from '../../../services/urls';
import { checkTokenAndRedirect } from '../../../services/auth';

// Fetch user permissions
export const fetchUserPermissions = async (navigation) => {
  try {
    const token = await checkTokenAndRedirect(navigation);
    if (!token) return { allowProductEdit: false, allowCancelOrder: false };

    const response = await fetch(`http://${ipAddress}:8091/userDetails`, {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      }
    });

    if (response.ok) {
      const data = await response.json();
      const user = data.user;
      return {
        allowProductEdit: user.allow_product_edit === 'Yes',
        allowCancelOrder: user.allow_cancel_order === 'Yes'
      };
    } else {
      return { allowProductEdit: false, allowCancelOrder: false };
    }
  } catch (error) {
    console.error('Error fetching user details:', error);
    return { allowProductEdit: false, allowCancelOrder: false };
  }
};

// Fetch admin orders
export const fetchAdminOrders = async () => {
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

    return ordersData.orders;
  } catch (fetchOrdersError) {
    const errorMessage = fetchOrdersError.message || "Failed to fetch admin orders.";
    throw new Error(errorMessage);
  }
};

// Fetch order products
export const fetchOrderProducts = async (orderIdToFetch) => {
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
        return [];
      }
    }

    const productsData = await productsResponse.json();
    return productsData;
  } catch (error) {
    throw new Error(error.message || "Failed to fetch order products.");
  }
};

// Update order
export const updateOrder = async (selectedOrderId, products, alteredBy) => {
  try {
    const token = await AsyncStorage.getItem('userAuthToken');
    if (!token) throw new Error('Authentication token not found.');

    const productsToUpdate = products.map(p => ({
      order_id: selectedOrderId,
      product_id: p.product_id,
      name: p.name,
      category: p.category,
      price: p.price,
      quantity: p.quantity,
      gst_rate: p.gst_rate,
    }));

    const totalAmount = productsToUpdate.reduce((sum, p) => sum + p.price * p.quantity, 0);

    const response = await axios.post(`http://${ipAddress}:8091/order_update`, {
      orderId: selectedOrderId,
      products: productsToUpdate,
      total_amount: totalAmount,
      totalAmount: totalAmount,
      altered_by: alteredBy,
    }, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (response.data.success) {
      return response.data;
    } else {
      throw new Error(response.data.message || 'Failed to update order.');
    }
  } catch (error) {
    throw new Error(error.response?.data?.message || error.message || 'An unknown error occurred.');
  }
};

// Delete product item from order
export const deleteProductItem = async (productToDelete) => {
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
    return deleteData;
  } catch (deleteError) {
    throw new Error(deleteError.message || "Failed to delete order product.");
  }
};

// Delete/cancel order
export const deleteOrder = async (orderIdToDelete) => {
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

    return deleteOrderData;
  } catch (error) {
    throw new Error(error.message || "Failed to cancel order.");
  }
};

// Add product to order
export const addProductToOrder = async (selectedOrderId, productToAdd, orders) => {
  try {
    const token = await AsyncStorage.getItem("userAuthToken");
    const orderToCheck = orders.find(order => order.id === selectedOrderId);
    if (!orderToCheck) {
      throw new Error("The selected order no longer exists. Please select or create a new order.");
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
      return addProductData;
    } else {
      throw new Error(addProductData.message || "Failed to add product.");
    }
  } catch (error) {
    throw new Error(error.message || "Failed to add product.");
  }
};

// Fetch all products for images
export const fetchAllProductsForImages = async () => {
  try {
    const token = await AsyncStorage.getItem("userAuthToken");
    if (!token) return [];

    const response = await fetch(`http://${ipAddress}:8091/products`, {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) return [];

    const data = await response.json();
    return data;
  } catch (error) {
    return [];
  }
};

// Fetch customer name by customer ID
export const fetchCustomerName = async (customerId) => {
  try {
    const token = await AsyncStorage.getItem("userAuthToken");
    const response = await fetch(`http://${ipAddress}:8091/fetch-names?customer_id=${customerId}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    // Check different possible response formats
    const customerName = data.username || data.name || data.customer_name || data.customerName || data.Name || data.NAME;
    return customerName;
  } catch (error) {
    return null;
  }
};