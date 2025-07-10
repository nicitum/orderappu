import React, { useEffect, useState, useCallback } from "react";
import {
    View,
    Text,
    ActivityIndicator,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
    Alert,
    Platform,
} from "react-native";
import { ipAddress } from "../../services/urls";
import { useNavigation } from "@react-navigation/native";
import { jwtDecode } from "jwt-decode";
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import moment from 'moment';
import DateTimePickerModal from 'react-native-modal-datetime-picker';

import Ionicons from 'react-native-vector-icons/Ionicons';

const OwnerOrderStatus = () => {
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const navigation = useNavigation();
    const [isDatePickerVisible, setDatePickerVisibility] = useState(false);
    const [selectedDate, setSelectedDate] = useState(new Date());
    const [customerNames, setCustomerNames] = useState({});
    const [error, setError] = useState(null);

    const showDatePicker = () => {
        setDatePickerVisibility(true);
    };

    const hideDatePicker = () => {
        setDatePickerVisibility(false);
    };

    const handleConfirm = (date) => {
        hideDatePicker();
        setSelectedDate(date);
        fetchOrders(date);
    };

    const fetchOrders = useCallback(async (dateFilter) => {
        setLoading(true);
        setError(null);
        try {
            const token = await AsyncStorage.getItem("userAuthToken");
            if (!token) {
                throw new Error("Authentication token missing");
            }

            // Format the dateFilter as YYYY-MM-DD if provided, otherwise use today's date
            const formattedDate = dateFilter ? moment(dateFilter).format("YYYY-MM-DD") : moment().format("YYYY-MM-DD");

            // Use get-orders-sa API for Owner
            const url = `http://${ipAddress}:8091/get-orders-sa?date=${formattedDate}`;

            const headers = {
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json",
            };

            console.log("FETCH OWNER ORDERS - Request URL:", url);

            const ordersResponse = await fetch(url, { headers });

            if (!ordersResponse.ok) {
                const errorText = await ordersResponse.text();
                const message = `Failed to fetch owner orders. Status: ${ordersResponse.status}, Text: ${errorText}`;
                throw new Error(message);
            }

            const ordersData = await ordersResponse.json();
            const fetchedOrders = ordersData.orders || [];

            setOrders(fetchedOrders);
            console.log('Fetched owner orders:', fetchedOrders);

            // Fetch customer names for all orders
            if (fetchedOrders.length > 0) {
                fetchCustomerNamesForOrders(fetchedOrders);
            }

        } catch (fetchOrdersError) {
            console.error("FETCH OWNER ORDERS - Fetch Error:", fetchOrdersError);
            setError(fetchOrdersError.message || "Failed to fetch owner orders.");
            setOrders([]);
        } finally {
            setLoading(false);
        }
    }, []);

    // Function to fetch customer name by customer ID
    const fetchCustomerName = async (customerId) => {
        try {
            const token = await AsyncStorage.getItem("userAuthToken");
            const response = await fetch(`http://${ipAddress}:8091/fetch-names?customer_id=${customerId}`, {
                headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "application/json",
                },
            });

            if (!response.ok) {
                console.error(`Failed to fetch customer name for ID ${customerId}`);
                return null;
            }

            const data = await response.json();
            return data.name;
        } catch (error) {
            console.error(`Error fetching customer name for ID ${customerId}:`, error);
            return null;
        }
    };

    // Function to fetch customer names for all orders
    const fetchCustomerNamesForOrders = async (ordersList) => {
        try {
            // Get unique customer IDs
            const uniqueCustomerIds = [...new Set(
                ordersList
                    .map(order => order.customer_id)
                    .filter(id => id)
            )];

            if (uniqueCustomerIds.length === 0) {
                return;
            }

            const token = await AsyncStorage.getItem("userAuthToken");
            if (!token) {
                return;
            }

            // Fetch customer names for each unique customer ID
            const customerNamesMap = {};
            for (const customerId of uniqueCustomerIds) {
                const customerName = await fetchCustomerName(customerId);
                if (customerName) {
                    customerNamesMap[customerId] = customerName;
                }
            }

            setCustomerNames(customerNamesMap);
        } catch (error) {
            console.error("Error fetching customer names:", error);
        }
    };

    const getStatusColor = (status) => {
        switch (status?.toLowerCase()) {
            case 'accepted': return '#10B981';
            case 'approved': return '#10B981';
            case 'pending': return '#FF9800';
            case 'rejected': return '#F44336';
            case 'delivered': return '#2196F3';
            case 'cancelled': return '#9E9E9E';
            case 'processing': return '#3B82F6';
            case 'shipped': return '#8B5CF6';
            default: return '#003366';
        }
    };

    const getStatusText = (status) => {
        if (!status) return 'PENDING';
        return status.toUpperCase();
    };

    const getYesNoColor = (value) => {
        return value === "Yes" ? '#10B981' : '#F44336';
    };

    const getYesNoText = (value) => {
        return value === "Yes" ? 'YES' : 'NO';
    };

    const handleOrderCardPress = (order) => {
        try {
            // Validate order data
            if (!order || !order.id) {
                console.error('Invalid order data:', order);
                return;
            }

            // Create date safely
            let selectedDate = new Date();
            if (order.placed_on) {
                try {
                    selectedDate = moment.unix(order.placed_on).toDate();
                } catch (dateError) {
                    console.error('Date parsing error:', dateError);
                    selectedDate = new Date();
                }
            }

            console.log('Navigating to OrderHistoryOwner with params:', {
                expandedOrderId: order.id,
                selectedDate: selectedDate
            });

            // Navigate to OrderHistoryOwner with the specific order expanded
            navigation.navigate('OrderHistoryOwner', {
                expandedOrderId: order.id,
                selectedDate: selectedDate
            });
        } catch (error) {
            console.error('Navigation error:', error);
            // Try alternative navigation methods
            try {
                navigation.push('OrderHistoryOwner');
            } catch (pushError) {
                console.error('Push navigation also failed:', pushError);
                // Last resort: try to go back and navigate
                navigation.goBack();
            }
        }
    };

    useFocusEffect(
        useCallback(() => {
            fetchOrders(selectedDate);
        }, [fetchOrders])
    );

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
                <Text style={styles.headerTitle}>Order Status</Text>
                <View style={styles.headerActions}>
                    <TouchableOpacity 
                        style={styles.dateFilterButton} 
                        onPress={showDatePicker}
                        activeOpacity={0.7}
                    >
                        <Ionicons name="calendar" size={18} color="#fff" />
                        <Text style={styles.dateFilterText}>
                            {moment(selectedDate).format('MMM D, YYYY')}
                        </Text>
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

            {error && (
                <View style={styles.errorContainer}>
                    <Text style={styles.errorText}>{error}</Text>
                </View>
            )}

            <ScrollView contentContainerStyle={styles.scrollContainer}>
                {orders.length === 0 ? (
                    <View style={styles.emptyState}>
                        <Ionicons name="receipt-outline" size={60} color="#003366" />
                        <Text style={styles.emptyStateText}>No orders found for selected date</Text>
                    </View>
                ) : (
                    orders.map((order) => (
                        <TouchableOpacity 
                            key={order.id} 
                            style={styles.orderCard}
                            onPress={() => handleOrderCardPress(order)}
                            activeOpacity={0.7}
                        >
                            <View style={styles.orderHeader}>
                                <View>
                                    <Text style={styles.orderId}>Order #{order.id}</Text>
                                    <Text style={styles.orderCustomer}>
                                        Customer: {customerNames[order.customer_id] || `ID: ${order.customer_id}`}
                                    </Text>
                                    <Text style={styles.customerId}>Customer ID: {order.customer_id}</Text>
                                </View>
                                <View style={styles.orderCardRight}>
                                    <Text style={styles.orderTotal}>₹{order.total_amount}</Text>
                                    <View style={styles.orderCardIcon}>
                                        <Ionicons name="chevron-forward" size={20} color="#003366" />
                                    </View>
                                </View>
                            </View>

                            <View style={styles.statusContainer}>
                                <View style={styles.statusRow}>
                                    <Text style={styles.statusLabel}>Approval Status:</Text>
                                    <Text style={[
                                        styles.statusValue, 
                                        { color: getStatusColor(order.approve_status) }
                                    ]}>
                                        {getStatusText(order.approve_status)}
                                    </Text>
                                </View>

                                <View style={styles.statusRow}>
                                    <Text style={styles.statusLabel}>Delivery Status:</Text>
                                    <Text style={[
                                        styles.statusValue, 
                                        { color: getStatusColor(order.delivery_status) }
                                    ]}>
                                        {getStatusText(order.delivery_status)}
                                    </Text>
                                </View>

                                <View style={styles.statusRow}>
                                    <Text style={styles.statusLabel}>Cancelled:</Text>
                                    <Text style={[
                                        styles.statusValue, 
                                        { color: getYesNoColor(order.cancelled) }
                                    ]}>
                                        {getYesNoText(order.cancelled)}
                                    </Text>
                                </View>

                                <View style={styles.statusRow}>
                                    <Text style={styles.statusLabel}>Loading Slip:</Text>
                                    <Text style={[
                                        styles.statusValue, 
                                        { color: getYesNoColor(order.loading_slip) }
                                    ]}>
                                        {getYesNoText(order.loading_slip)}
                                    </Text>
                                </View>
                            </View>
                        </TouchableOpacity>
                    ))
                )}
            </ScrollView>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f5f7fa',
    },
    header: {
        backgroundColor: '#003366',
        padding: 20,
        paddingBottom: 15,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    headerTitle: {
        color: '#fff',
        fontSize: 22,
        fontWeight: '600',
        marginBottom: 15,
    },
    headerActions: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    dateFilterButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderRadius: 20,
    },
    dateFilterText: {
        color: '#fff',
        marginLeft: 8,
        fontSize: 14,
    },
    errorContainer: {
        backgroundColor: '#FEE2E2',
        padding: 15,
        margin: 15,
        borderRadius: 8,
        borderLeftWidth: 4,
        borderLeftColor: '#F44336',
    },
    errorText: {
        color: '#DC2626',
        fontSize: 14,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: '#f5f7fa',
    },
    scrollContainer: {
        padding: 15,
        paddingBottom: 25,
    },
    emptyState: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 80,
    },
    emptyStateText: {
        marginTop: 15,
        fontSize: 16,
        color: '#003366',
        opacity: 0.7,
    },
    orderCard: {
        backgroundColor: '#fff',
        borderRadius: 10,
        marginBottom: 15,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 2,
        overflow: 'hidden',
    },
    orderHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 15,
        borderBottomWidth: 1,
        borderBottomColor: '#f0f0f0',
    },
    orderId: {
        fontSize: 16,
        fontWeight: '600',
        color: '#003366',
    },
    orderCustomer: {
        fontSize: 13,
        color: '#666',
        marginTop: 3,
    },
    customerId: {
        fontSize: 12,
        color: '#999',
        marginTop: 2,
    },
    statusContainer: {
        padding: 15,
    },
    statusRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 8,
        borderBottomWidth: 1,
        borderBottomColor: '#f5f5f5',
    },
    statusLabel: {
        fontSize: 14,
        fontWeight: '500',
        color: '#333',
    },
    statusValue: {
        fontSize: 14,
        fontWeight: '600',
    },
    orderCardIcon: {
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 4,
    },
    orderCardRight: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    orderTotal: {
        fontSize: 18,
        fontWeight: '700',
        color: '#003366',
        marginBottom: 2,
    },
});

export default OwnerOrderStatus; 