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
    Modal,
} from "react-native";
import { ipAddress } from "../../services/urls";
import { useNavigation } from "@react-navigation/native";
import { jwtDecode } from "jwt-decode";
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import moment from 'moment';
import DateTimePickerModal from 'react-native-modal-datetime-picker';
import MaterialIcons from "react-native-vector-icons/MaterialIcons";

import Ionicons from 'react-native-vector-icons/Ionicons';

const OwnerOrderStatus = () => {
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const navigation = useNavigation();
    const [isDatePickerVisible, setDatePickerVisibility] = useState(false);
    const [selectedDate, setSelectedDate] = useState(new Date());
    const [customerNames, setCustomerNames] = useState({});
    const [error, setError] = useState(null);
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

    const getFilteredOrders = () => {
        return orders.filter(order => {
            // Delivery filter
            if (selectedFilters.delivery !== 'All' && order.delivery_status !== selectedFilters.delivery) {
                return false;
            }
            
            // Cancelled filter
            if (selectedFilters.cancelled !== 'All') {
                // Handle different possible values for cancelled status
                const isCancelled = order.cancelled === 'Yes' || order.cancelled === 'yes' || order.cancelled === true;
                const isActive = order.cancelled === 'No' || order.cancelled === 'no' || order.cancelled === false || order.cancelled === null || order.cancelled === undefined;
                
                if (selectedFilters.cancelled === 'Cancelled' && !isCancelled) {
                    return false;
                }
                if (selectedFilters.cancelled === 'Active' && !isActive) {
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
                <View style={styles.headerLeft}>
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
                    getFilteredOrders().map((order) => (
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
                                        {customerNames[order.customer_id] ? 
                                            customerNames[order.customer_id] : 
                                            `Loading... (ID: ${order.customer_id})`
                                        }
                                    </Text>
                                   
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
    // Filter styles
    headerLeft: {
        flex: 1,
    },
    headerRight: {
        alignItems: 'flex-end',
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
});

export default OwnerOrderStatus; 