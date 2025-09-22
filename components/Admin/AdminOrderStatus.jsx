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
import { useFontScale } from '../../App';

const AdminOrderStatus = () => {
    const { getScaledSize } = useFontScale();
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const navigation = useNavigation();
    const [fromDate, setFromDate] = useState(new Date());
    const [toDate, setToDate] = useState(new Date());
    const [isFromPickerVisible, setFromPickerVisible] = useState(false);
    const [isToPickerVisible, setToPickerVisible] = useState(false);
    const [customerNames, setCustomerNames] = useState({});
    const [error, setError] = useState(null);
    const [showFilterModal, setShowFilterModal] = useState(false);
    const [selectedFilters, setSelectedFilters] = useState({
        delivery: 'All',
        cancelled: 'All',
        acceptance: 'All'
    });

    const showFromPicker = () => setFromPickerVisible(true);
    const hideFromPicker = () => setFromPickerVisible(false);
    const showToPicker = () => setToPickerVisible(true);
    const hideToPicker = () => setToPickerVisible(false);

    const handleConfirmFrom = (date) => {
        hideFromPicker();
        const normalized = new Date(date.getFullYear(), date.getMonth(), date.getDate());
        setFromDate(normalized);
        if (normalized > toDate) setToDate(normalized);
        fetchOrders();
    };

    const handleConfirmTo = (date) => {
        hideToPicker();
        const normalized = new Date(date.getFullYear(), date.getMonth(), date.getDate());
        if (normalized < fromDate) setToDate(fromDate); else setToDate(normalized);
        fetchOrders();
    };

    const fetchOrders = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const token = await AsyncStorage.getItem("userAuthToken");
            const decodedToken = jwtDecode(token);
            const adminId = decodedToken.id1;

            const from = moment(fromDate).format("YYYY-MM-DD");
            const to = moment(toDate).format("YYYY-MM-DD");

            // Construct the URL with the date range query parameters
            const baseUrl = `http://${ipAddress}:8091/get-admin-orders/${adminId}`;
            const url = `${baseUrl}?from=${from}&to=${to}`;

            const headers = {
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json",
            };

            console.log("FETCH ADMIN ORDERS - Request URL:", url);

            const ordersResponse = await fetch(url, { headers });

            if (!ordersResponse.ok) {
                const errorText = await ordersResponse.text();
                const message = `Failed to fetch admin orders. Status: ${ordersResponse.status}, Text: ${errorText}`;
                throw new Error(message);
            }

            const ordersData = await ordersResponse.json();
            const fetchedOrders = ordersData.orders || [];

            setOrders(fetchedOrders);
            console.log('Fetched orders:', fetchedOrders);

        } catch (fetchOrdersError) {
            console.error("FETCH ADMIN ORDERS - Fetch Error:", fetchOrdersError);
            setError(fetchOrdersError.message || "Failed to fetch admin orders.");
            setOrders([]);
        } finally {
            setLoading(false);
        }
    }, [fromDate, toDate]);

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
        // Navigate to AdminOrderHistory with the specific order expanded
        navigation.navigate('AdminOrderHistory', {
            expandedOrderId: order.id,
            selectedDate: moment.unix(order.placed_on).toDate()
        });
    };

    useFocusEffect(
        useCallback(() => {
            fetchOrders();
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
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                        <TouchableOpacity 
                            style={styles.dateFilterButton} 
                            onPress={showFromPicker}
                            activeOpacity={0.7}
                        >
                            <Ionicons name="calendar" size={18} color="#fff" />
                            <Text style={[styles.dateFilterText, { fontSize: getScaledSize(12) }]}>
                                {moment(fromDate).format('MMM D, YYYY')}
                            </Text>
                        </TouchableOpacity>
                        <TouchableOpacity 
                            style={styles.dateFilterButton} 
                            onPress={showToPicker}
                            activeOpacity={0.7}
                        >
                            <Ionicons name="calendar" size={18} color="#fff" />
                            <Text style={[styles.dateFilterText, { fontSize: getScaledSize(12) }]}>
                                {moment(toDate).format('MMM D, YYYY')}
                            </Text>
                        </TouchableOpacity>
                    </View>
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
                isVisible={isFromPickerVisible}
                mode="date"
                onConfirm={handleConfirmFrom}
                onCancel={hideFromPicker}
                date={fromDate}
            />
            <DateTimePickerModal
                isVisible={isToPickerVisible}
                mode="date"
                onConfirm={handleConfirmTo}
                onCancel={hideToPicker}
                date={toDate}
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
                            <Text style={[styles.filterModalTitle, { fontSize: getScaledSize(18) }]}>Filter Orders</Text>
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
                                <Text style={[styles.filterSectionTitle, { fontSize: getScaledSize(16) }]}>Delivery Status</Text>
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
                                            selectedFilters.delivery === status && styles.filterOptionTextSelected,
                                            { fontSize: getScaledSize(14) }
                                        ]}>
                                            {status.toUpperCase()}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>

                            {/* Acceptance Filter */}
                            <View style={styles.filterSection}>
                                <Text style={[styles.filterSectionTitle, { fontSize: getScaledSize(16) }]}>Acceptance Status</Text>
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
                                            selectedFilters.acceptance === status && styles.filterOptionTextSelected,
                                            { fontSize: getScaledSize(14) }
                                        ]}>
                                            {status}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>

                            {/* Cancelled Filter */}
                            <View style={styles.filterSection}>
                                <Text style={[styles.filterSectionTitle, { fontSize: getScaledSize(16) }]}>Order Status</Text>
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
                                            selectedFilters.cancelled === status && styles.filterOptionTextSelected,
                                            { fontSize: getScaledSize(14) }
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
                                <Text style={[styles.clearFiltersText, { fontSize: getScaledSize(14) }]}>Clear All Filters</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={styles.applyFiltersButton}
                                onPress={() => setShowFilterModal(false)}
                            >
                                <Text style={[styles.applyFiltersText, { fontSize: getScaledSize(14) }]}>Apply Filters</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {error && (
                <View style={styles.errorContainer}>
                    <Text style={[styles.errorText, { fontSize: getScaledSize(14) }]}>{error}</Text>
                </View>
            )}

            <ScrollView contentContainerStyle={styles.scrollContainer}>
                {orders.length === 0 ? (
                    <View style={styles.emptyState}>
                        <Ionicons name="receipt-outline" size={60} color="#003366" />
                        <Text style={[styles.emptyStateText, { fontSize: getScaledSize(16) }]}>No orders found for selected date</Text>
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
                                    <Text style={[styles.orderId, { fontSize: getScaledSize(16) }]}>Order #{order.id}</Text>
                                    <Text style={[styles.orderCustomer, { fontSize: getScaledSize(13) }]}>
                                        {customerNames[order.customer_id] ? 
                                            customerNames[order.customer_id] : 
                                            `Loading... (ID: ${order.customer_id})`
                                        }
                                    </Text>

                                </View>
                                <View style={styles.orderCardRight}>
                                    <Text style={[styles.orderTotal, { fontSize: getScaledSize(18) }]}>₹{order.total_amount}</Text>
                                    <View style={styles.orderCardIcon}>
                                        <Ionicons name="chevron-forward" size={20} color="#003366" />
                                    </View>
                                </View>
                            </View>

                            <View style={styles.statusContainer}>
                                <View style={styles.statusRow}>
                                    <Text style={[styles.statusLabel, { fontSize: getScaledSize(14) }]}>Approval Status:</Text>
                                    <Text style={[
                                        styles.statusValue, 
                                        { color: getStatusColor(order.approve_status), fontSize: getScaledSize(14) }
                                    ]}>
                                        {getStatusText(order.approve_status)}
                                    </Text>
                                </View>

                                <View style={styles.statusRow}>
                                    <Text style={[styles.statusLabel, { fontSize: getScaledSize(14) }]}>Delivery Status:</Text>
                                    <Text style={[
                                        styles.statusValue, 
                                        { color: getStatusColor(order.delivery_status), fontSize: getScaledSize(14) }
                                    ]}>
                                        {getStatusText(order.delivery_status)}
                                    </Text>
                                </View>

                                <View style={styles.statusRow}>
                                    <Text style={[styles.statusLabel, { fontSize: getScaledSize(14) }]}>Cancelled:</Text>
                                    <Text style={[
                                        styles.statusValue, 
                                        { color: getYesNoColor(order.cancelled), fontSize: getScaledSize(14) }
                                    ]}>
                                        {getYesNoText(order.cancelled)}
                                    </Text>
                                </View>

                                <View style={styles.statusRow}>
                                    <Text style={[styles.statusLabel, { fontSize: getScaledSize(14) }]}>Loading Slip:</Text>
                                    <Text style={[
                                        styles.statusValue, 
                                        { color: getYesNoColor(order.loading_slip), fontSize: getScaledSize(14) }
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
        fontWeight: '600',
        color: '#003366',
    },
    orderCustomer: {
        color: '#666',
        marginTop: 3,
    },
    customerId: {
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
        fontWeight: '500',
        color: '#333',
    },
    statusValue: {
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

export default AdminOrderStatus; 