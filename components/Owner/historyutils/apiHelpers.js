import axios from "axios";
import { ipAddress } from "../../../services/urls";
import { checkTokenAndRedirect } from "../../services/auth";
import { jwtDecode } from "jwt-decode";
import AsyncStorage from '@react-native-async-storage/async-storage';
import moment from 'moment';
import { LICENSE_NO } from '../../config'; // Import the license number

/**
 * Fetch orders for owner within date range
 * Since there's no range endpoint, we'll fetch orders for each date in the range
 */
export const fetchOrders = async (fromDate, toDate, expandedOrderId, setOrders, setOrderDetails, setLoading, console) => {
    setLoading(true);
    try {
        const token = await AsyncStorage.getItem("userAuthToken");
        if (!token) {
            throw new Error("Authentication token missing");
        }

        // Generate all dates in the range
        const dates = [];
        const currentDate = moment(fromDate);
        const endDate = moment(toDate);
        
        while (currentDate <= endDate) {
            dates.push(currentDate.format("YYYY-MM-DD"));
            currentDate.add(1, 'day');
        }

        // Fetch orders for each date
        const allOrders = [];
        const headers = {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
        };

        for (const date of dates) {
            try {
                const url = `http://${ipAddress}:8091/get-orders-sa?date=${date}`;
                console.log("FETCH OWNER ORDERS - Request URL:", url);
                
                const ordersResponse = await fetch(url, { headers });
                
                if (ordersResponse.ok) {
                    const ordersData = await ordersResponse.json();
                    if (ordersData.orders && Array.isArray(ordersData.orders)) {
                        allOrders.push(...ordersData.orders);
                    }
                } else {
                    console.warn(`Failed to fetch orders for date ${date}:`, ordersResponse.status);
                }
            } catch (dateError) {
                console.error(`Error fetching orders for date ${date}:`, dateError);
            }
        }

        // Remove duplicates based on order ID
        const uniqueOrders = Array.from(new Map(allOrders.map(order => [order.id, order])).values());
        
        // Sort by placed_on timestamp descending (newest first)
        uniqueOrders.sort((a, b) => b.placed_on - a.placed_on);
        
        setOrders(uniqueOrders);
        
        // If there's an expanded order ID, fetch its details
        if (expandedOrderId && uniqueOrders.some(order => order.id === expandedOrderId)) {
            try {
                const orderDetailsResponse = await fetch(
                    `http://${ipAddress}:8091/order-products?orderId=${expandedOrderId}`,
                    { headers: { Authorization: `Bearer ${token}` } }
                );
                if (orderDetailsResponse.ok) {
                    const detailsData = await orderDetailsResponse.json();
                    setOrderDetails(prev => ({ ...prev, [expandedOrderId]: detailsData }));
                }
            } catch (detailsError) {
                console.error("Error fetching order details:", detailsError);
            }
        }
        
        console.log('Fetched owner orders:', uniqueOrders);
    } catch (fetchOrdersError) {
        console.error("FETCH OWNER ORDERS - Fetch Error:", fetchOrdersError);
        throw new Error(fetchOrdersError.message || "Failed to fetch owner orders.");
    } finally {
        setLoading(false);
    }
};

/**
 * Fetch all products for images
 */
export const fetchAllProducts = async (setAllProductsData, console) => {
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
        setAllProductsData(data);
    } catch (error) {
        console.error("Error fetching all products:", error);
        throw error;
    }
};

/**
 * Fetch client status for due date configuration
 */
export const fetchClientStatus = async (setDefaultDueOn, setMaxDueOn, setSelectedDueDate, console) => {
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
                // Update due date configuration based on API response
                const newDefaultDueOn = data.default_due_on || 1;
                const newMaxDueOn = data.max_due_on || 30;
                
                console.log('Setting defaultDueOn to:', newDefaultDueOn);
                console.log('Setting maxDueOn to:', newMaxDueOn);
                
                setDefaultDueOn(newDefaultDueOn);
                setMaxDueOn(newMaxDueOn);
                
                // Update selected due date based on default_due_on
                const newDefaultDate = new Date();
                if (newDefaultDueOn > 0) {
                    newDefaultDate.setDate(newDefaultDate.getDate() + newDefaultDueOn);
                }
                console.log('Setting selectedDueDate to:', newDefaultDate);
                setSelectedDueDate(newDefaultDate);
            } else {
                console.log('No client data found in response');
            }
        } else {
            console.log('API response not ok:', response.status);
        }
    } catch (error) {
        console.error('Error fetching client status:', error);
        // Keep default values if API fails
    }
};

/**
 * Function to fetch customer name by customer ID (fallback)
 */
export const fetchCustomerName = async (customerId, console) => {
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

/**
 * Fetch order products from the API
 */
export const fetchOrderProducts = async (orderId, console) => {
    try {
        const token = await AsyncStorage.getItem("userAuthToken");
        if (!token) throw new Error("No authorization token found.");

        const response = await axios.get(
            `http://${ipAddress}:8091/order-products?orderId=${orderId}`,
            { headers: { Authorization: `Bearer ${token}` } }
        );
        return response.data;
    } catch (error) {
        console.error("Error fetching order products:", error);
        // Alert.alert("Error", "Failed to fetch order details.");
        return [];
    }
};

/**
 * Handle confirm reorder
 */
export const handleConfirmReorder = async (orderId, products, orders, selectedDueDate, navigation, Toast, setPendingReorderOrderId, setPendingReorderProducts, fetchOrders, console) => {
    try {
        console.log('DEBUG: handleConfirmReorder called with orderId:', orderId, 'products:', products);
        
        // Get the order details to get customer_id
        const order = orders.find(o => o.id === orderId);
        if (!order) {
            console.log('DEBUG: Order not found for ID:', orderId);
            Toast.show({
                type: 'error',
                text1: 'Error',
                text2: 'Order not found'
            });
            return;
        }

        console.log('DEBUG: Found order:', order);

        const token = await AsyncStorage.getItem("userAuthToken");
        if (!token) {
            console.log('DEBUG: No auth token found');
            Toast.show({
                type: 'error',
                text1: 'Error',
                text2: 'Authentication token missing'
            });
            return;
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

        console.log('DEBUG: Products payload:', productsPayload);

        // Call on-behalf-2 API for fresh orders with due_on parameter
        const response = await fetch(`http://${ipAddress}:8091/on-behalf-2`, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                customer_id: order.customer_id,
                order_type: order.order_type || 'AM',
                products: productsPayload,
                entered_by: jwtDecode(token).username,
                due_on: moment(selectedDueDate).format('YYYY-MM-DD') // Add due_on parameter
            }),
        });

        console.log('DEBUG: API response status:', response.status);
        const data = await response.json();
        console.log('DEBUG: API response data:', data);

        if (!response.ok) {
            throw new Error(data.message || 'Failed to place reorder');
        }

        console.log('DEBUG: About to show success toast');
        Toast.show({
            type: 'success',
            text1: 'Reorder Placed',
            text2: `Order has been successfully reordered with ${productsPayload.length} products for delivery on ${moment(selectedDueDate).format('DD MMM, YYYY')}`
        });
        console.log('DEBUG: Success toast should have been shown');

        // Refresh the orders list to show the new reorder
        console.log('DEBUG: About to refresh orders');
        await fetchOrders();
        console.log('DEBUG: Orders refreshed');

        // Reset pending reorder data
        setPendingReorderOrderId(null);
        setPendingReorderProducts([]);
    } catch (error) {
        console.error('DEBUG: Error placing reorder:', error);
        Toast.show({
            type: 'error',
            text1: 'Reorder Failed',
            text2: error.message || 'Failed to place reorder'
        });
    }
};