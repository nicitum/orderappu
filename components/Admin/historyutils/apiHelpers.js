import AsyncStorage from '@react-native-async-storage/async-storage';
import { jwtDecode } from "jwt-decode";
import axios from "axios";
import { ipAddress } from "../../services/urls";
import moment from 'moment';

// Fetch orders for admin within date range
export const fetchAdminOrders = async (fromDate, toDate) => {
    try {
        const token = await AsyncStorage.getItem("userAuthToken");
        const decodedToken = jwtDecode(token);
        const adminId = decodedToken.id1;

        const from = moment(fromDate).format("YYYY-MM-DD");
        const to = moment(toDate).format("YYYY-MM-DD");

        const baseUrl = `http://${ipAddress}:8091/get-admin-orders/${adminId}`;
        const url = `${baseUrl}?from=${from}&to=${to}`;

        const headers = {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
        };

        console.log("FETCH ADMIN ORDERS - Request URL:", url);
        console.log("FETCH ADMIN ORDERS - Request Headers:", headers);

        const ordersResponse = await fetch(url, { headers });

        console.log("FETCH ADMIN ORDERS - Response Status:", ordersResponse.status);
        console.log("FETCH ADMIN ORDERS - Response Status Text:", ordersResponse.statusText);

        if (!ordersResponse.ok) {
            const errorText = await ordersResponse.text();
            const message = `Failed to fetch admin orders. Status: ${ordersResponse.status}, Text: ${errorText}`;
            console.error("FETCH ADMIN ORDERS - Error Response Text:", errorText);
            throw new Error(message);
        }

        const ordersData = await ordersResponse.json();
        console.log("FETCH ADMIN ORDERS - Response Data:", ordersData);
        return ordersData.orders || [];
    } catch (fetchOrdersError) {
        console.error("FETCH ADMIN ORDERS - Fetch Error:", fetchOrdersError);
        throw new Error(fetchOrdersError.message || "Failed to fetch admin orders.");
    }
};

// Fetch all products for images
export const fetchAllProducts = async () => {
    try {
        const token = await AsyncStorage.getItem("userAuthToken");
        if (!token) {
            throw new Error("Authentication token missing");
        }
        const response = await fetch(`http://${ipAddress}:8091/products`, {
            headers: { Authorization: `Bearer ${token}` },
        });
        
        if (!response.ok) {
            throw new Error("Failed to fetch products");
        }
        
        const data = await response.json();
        return data;
    } catch (error) {
        console.error("Error fetching all products:", error);
        throw error;
    }
};

// Fetch client status for due date configuration
export const fetchClientStatus = async () => {
    try {
        console.log('Fetching client status...');
        const response = await fetch(`http://147.93.110.150:3001/api/client_status/APPU0009`, {
            method: 'GET',
            headers: {
                'Cache-Control': 'no-cache',
                'Pragma': 'no-cache'
            }
        });

        console.log('Response status:', response.status);
        if (response.ok) {
            const responseData = await response.json();
            console.log('API Response data:', responseData);
            
            // Extract data from the nested structure
            const data = responseData.data && responseData.data[0];
            console.log('Extracted client data:', data);
            
            if (data) {
                // Return due date configuration based on API response
                return {
                    defaultDueOn: data.default_due_on || 1,
                    maxDueOn: data.max_due_on || 30
                };
            }
        }
        // Return default values if API fails
        return { defaultDueOn: 1, maxDueOn: 30 };
    } catch (error) {
        console.error('Error fetching client status:', error);
        // Return default values if API fails
        return { defaultDueOn: 1, maxDueOn: 30 };
    }
};

// Fetch customer name by customer ID
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

// Fetch order products by order ID
export const fetchOrderProducts = async (orderId) => {
    try {
        const token = await AsyncStorage.getItem("userAuthToken");
        if (!token) {
            throw new Error("No authorization token found.");
        }

        const response = await axios.get(
            `http://${ipAddress}:8091/order-products?orderId=${orderId}`,
            { headers: { Authorization: `Bearer ${token}` } }
        );
        return response.data;
    } catch (error) {
        console.error("Error fetching order products:", error);
        throw error;
    }
};

// Place reorder with due date
export const placeReorder = async (orderId, products, customerId, orderType, selectedDueDate) => {
    try {
        const token = await AsyncStorage.getItem("userAuthToken");
        if (!token) {
            throw new Error("Authentication token missing");
        }

        // Prepare products for on-behalf-2 API
        const productsPayload = products.map((product) => ({
            product_id: product.product_id,
            quantity: product.quantity,
            price: product.price,
            name: product.name,
            category: product.category || '',
            gst_rate: product.gst_rate || 0
        }));

        // Call on-behalf-2 API for fresh orders with due_on parameter
        const response = await fetch(`http://${ipAddress}:8091/on-behalf-2`, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                customer_id: customerId,
                order_type: orderType || 'AM',
                products: productsPayload,
                entered_by: jwtDecode(token).username,
                due_on: moment(selectedDueDate).format('YYYY-MM-DD') // Add due_on parameter
            }),
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message || 'Failed to place reorder');
        }

        return data;
    } catch (error) {
        console.error('Error placing reorder:', error);
        throw error;
    }
};