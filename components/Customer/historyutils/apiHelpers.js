import AsyncStorage from '@react-native-async-storage/async-storage';
import { jwtDecode } from "jwt-decode";
import axios from "axios";
import { ipAddress } from '../../../services/urls';
import { LICENSE_NO } from '../../config'; // Import the license number
import moment from 'moment';

// Fetch orders for customer within date range
export const fetchCustomerOrders = async (fromDate, toDate) => {
    try {
        const token = await AsyncStorage.getItem("userAuthToken");
        if (!token) {
            throw new Error("Authentication token not found. Please log in again.");
        }
        
        console.log("Retrieved token from storage:", token.substring(0, 50) + "..."); // Log first 50 chars of token
        
        let decodedToken;
        try {
            decodedToken = jwtDecode(token);
        } catch (decodeError) {
            console.error("Error decoding JWT token:", decodeError);
            throw new Error("Invalid authentication token. Please log in again.");
        }
        
        console.log("FULL DECODED TOKEN:", JSON.stringify(decodedToken, null, 2)); // Log the entire token for debugging
        
        // Use the correct customer ID from the token
        // Based on the logs, we need to use the "id" field which should contain the customer ID like "CMR0001"
        // If "id" is not available, fall back to "id1" but log a warning
        let customerId;
        if (decodedToken.id && typeof decodedToken.id === 'string' && decodedToken.id.startsWith('CMR')) {
            customerId = decodedToken.id;
        } else if (decodedToken.id) {
            // If id exists but doesn't start with CMR, use it but log a warning
            console.warn("Customer ID doesn't start with 'CMR', using as-is:", decodedToken.id);
            customerId = decodedToken.id;
        } else if (decodedToken.id1) {
            // Log a warning if we're using id1 as it might be the internal ID
            console.warn("Using id1 as customer ID. This might be incorrect:", decodedToken.id1);
            customerId = decodedToken.id1;
        } else {
            throw new Error("Unable to determine customer ID from token. Token structure: " + JSON.stringify(decodedToken));
        }

        console.log("Using customer ID:", customerId);

        // Convert dates to Unix timestamps (as required by the new API)
        // For the 'from' date, use the start of the day (00:00:00)
        const fromDateObj = new Date(fromDate);
        fromDateObj.setHours(0, 0, 0, 0);
        const fromTimestamp = Math.floor(fromDateObj.getTime() / 1000);
        
        // For the 'to' date, use the end of the day (23:59:59)
        const toDateObj = new Date(toDate);
        toDateObj.setHours(23, 59, 59, 999);
        const toTimestamp = Math.floor(toDateObj.getTime() / 1000);

        // Construct the URL with query parameters
        const baseUrl = `http://${ipAddress}:8091/get-customer-orders/${customerId}`;
        const url = `${baseUrl}?from=${fromTimestamp}&to=${toTimestamp}`;

        const headers = {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
        };

        console.log("FETCH CUSTOMER ORDERS - Request URL:", url);
        console.log("FETCH CUSTOMER ORDERS - Request Headers:", headers);
        console.log("FETCH CUSTOMER ORDERS - From Date:", fromDateObj, "Timestamp:", fromTimestamp);
        console.log("FETCH CUSTOMER ORDERS - To Date:", toDateObj, "Timestamp:", toTimestamp);

        const ordersResponse = await fetch(url, { headers });

        console.log("FETCH CUSTOMER ORDERS - Response Status:", ordersResponse.status);
        console.log("FETCH CUSTOMER ORDERS - Response Status Text:", ordersResponse.statusText);

        if (!ordersResponse.ok) {
            const errorText = await ordersResponse.text();
            const message = `Failed to fetch customer orders. Status: ${ordersResponse.status}, Text: ${errorText}`;
            console.error("FETCH CUSTOMER ORDERS - Error Response Text:", errorText);
            throw new Error(message);
        }

        const ordersData = await ordersResponse.json();
        console.log("FETCH CUSTOMER ORDERS - Response Data:", ordersData);
        
        // The new API returns orders WITHOUT order_products
        // So we just need to return the orders array
        if (ordersData && Array.isArray(ordersData.orders)) {
            return ordersData.orders;
        } else if (Array.isArray(ordersData)) {
            // Handle case where API directly returns an array of orders
            return ordersData;
        } else {
            console.warn("FETCH CUSTOMER ORDERS - Unexpected response format:", ordersData);
            return [];
        }
    } catch (fetchOrdersError) {
        console.error("FETCH CUSTOMER ORDERS - Fetch Error:", fetchOrdersError);
        throw new Error(fetchOrdersError.message || "Failed to fetch customer orders.");
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
        const response = await fetch(`http://147.93.110.150:3001/api/client_status/${LICENSE_NO}`, {
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

// Fetch order products by order ID
// This function is needed as the new API does NOT include order_products in the response
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
        
        // Log the response for debugging
        console.log("FETCH ORDER PRODUCTS - Response for order", orderId, ":", response.data);
        
        // Ensure we return an array
        if (Array.isArray(response.data)) {
            return response.data;
        } else if (response.data && Array.isArray(response.data.products)) {
            return response.data.products;
        } else {
            console.warn("FETCH ORDER PRODUCTS - Unexpected response format for order", orderId, ":", response.data);
            return [];
        }
    } catch (error) {
        console.error("Error fetching order products for order", orderId, ":", error);
        throw error;
    }
};

// Cancel order
export const cancelOrder = async (orderId) => {
    try {
        const token = await AsyncStorage.getItem("userAuthToken");
        if (!token) throw new Error('No authentication token found');

        const response = await fetch(
            `http://${ipAddress}:8091/cancel_order/${orderId}`,
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

        return data;
    } catch (error) {
        console.error("Error cancelling order:", error);
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