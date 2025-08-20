import React, { useEffect, useState } from "react";
import {
    View,
    Text,
    StyleSheet,
    ActivityIndicator,
    TouchableOpacity,
    Alert,
    ScrollView,
    RefreshControl,
    Platform,
    Linking,
} from "react-native";
import { Checkbox, Card, Button, Searchbar } from "react-native-paper";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { jwtDecode } from 'jwt-decode';
import { ipAddress } from "../../services/urls";
import { useNavigation } from "@react-navigation/native";
import moment from 'moment';
import Toast from "react-native-toast-message";
import { useFocusEffect } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { Animated } from 'react-native';
import { Picker } from '@react-native-picker/picker';

// Color Constants
const COLORS = {
    primary: '#003366', // Deep Blue
    primaryLight: '#004488',
    primaryDark: '#002244',
    secondary: '#10B981', // Emerald
    accent: '#F59E0B', // Amber
    success: '#059669', // Green
    error: '#DC2626', // Red
    warning: '#D97706', // Yellow
    background: '#F3F4F6', // Light Gray
    surface: '#FFFFFF', // White
    text: {
        primary: '#111827', // Almost Black
        secondary: '#4B5563', // Gray
        tertiary: '#9CA3AF', // Light Gray
        light: '#FFFFFF', // White
    },
    border: '#E5E7EB',
    divider: '#F3F4F6',
    card: {
        background: '#FFFFFF',
        shadow: 'rgba(0, 0, 0, 0.1)',
    },
};

// Button style for compact/small look (outside StyleSheet)
const smallButtonStyle = {
    minHeight: 32,
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: 8,
    marginBottom: 4,
};
const smallLabelStyle = {
    fontSize: 13,
    fontWeight: '500',
};

const OrderAcceptAdmin = () => {
    const [assignedUsers, setAssignedUsers] = useState([]);
    const [adminOrders, setAdminOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [adminId, setAdminId] = useState(null);
    const navigation = useNavigation();
    const [selectedOrderIds, setSelectedOrderIds] = useState({});
    const [selectAllOrders, setSelectAllOrders] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [filteredUsers, setFilteredUsers] = useState([]);
    const [selectedRoute, setSelectedRoute] = useState('All');
    // Get unique routes from assignedUsers
    const uniqueRoutes = ['All', ...Array.from(new Set(assignedUsers.map(u => u.route)))];
    const scrollY = new Animated.Value(0);

    // Header animation values
    const headerHeight = scrollY.interpolate({
        inputRange: [0, 100],
        outputRange: [120, 80],
        extrapolate: 'clamp',
    });

    const headerOpacity = scrollY.interpolate({
        inputRange: [0, 100],
        outputRange: [1, 0.8],
        extrapolate: 'clamp',
    });

    useFocusEffect(
        React.useCallback(() => {
            console.log('Admin page focused - refreshing data...');
            fetchInitialData();
            return () => {
                setAdminOrders([]);
                setAssignedUsers([]);
            };
        }, [])
    );

    // Additional refresh when adminId changes
    useEffect(() => {
        if (adminId) {
            console.log('Admin ID changed - refreshing orders...');
            const refreshOrders = async () => {
                const userAuthToken = await AsyncStorage.getItem("userAuthToken");
                if (userAuthToken) {
                    await fetchAdminOrders(adminId, userAuthToken);
                }
            };
            refreshOrders();
        }
    }, [adminId]);

    useEffect(() => {
        if (selectAllOrders) {
            let allOrderIds = {};
            adminOrders.forEach(order => allOrderIds[order.id] = true);
            setSelectedOrderIds(allOrderIds);
        } else {
            setSelectedOrderIds({});
        }
    }, [selectAllOrders, adminOrders]);

    useEffect(() => {
        let filtered = assignedUsers;
        if (searchQuery) {
            filtered = filtered.filter(user =>
                user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                user.route.toLowerCase().includes(searchQuery.toLowerCase())
            );
        }
        if (selectedRoute && selectedRoute !== 'All') {
            filtered = filtered.filter(user => user.route === selectedRoute);
        }
        setFilteredUsers(filtered);
    }, [searchQuery, assignedUsers, selectedRoute]);

    // Filter assigned users to only those who have at least one order today
    const usersWithOrdersToday = filteredUsers.filter(user =>
        adminOrders.some(order => order.customer_id === user.cust_id)
    );
    const displayedUsers = usersWithOrdersToday;

    const fetchInitialData = async () => {
        setLoading(true);
        setError(null);
        try {
            const userAuthToken = await AsyncStorage.getItem("userAuthToken");
            if (!userAuthToken) {
                setError("User authentication token not found.");
                return;
            }

            const decodedToken = jwtDecode(userAuthToken);
            const currentAdminId = decodedToken.id1;
            setAdminId(currentAdminId);

            await Promise.all([
                fetchAssignedUsers(currentAdminId, userAuthToken),
                fetchAdminOrders(currentAdminId, userAuthToken)
            ]);

            setSelectedOrderIds({});
            setSelectAllOrders(false);

        } catch (err) {
            console.error("Error initializing data:", err);
            setError("Error loading data. Please try again.");
            Toast.show({
                type: 'error',
                text1: 'Data Loading Error',
                text2: 'Error loading data. Please try again.'
            });
        } finally {
            setLoading(false);
        }
    };

    const onRefresh = React.useCallback(() => {
        setRefreshing(true);
        fetchInitialData().finally(() => setRefreshing(false));
    }, []);

    const fetchAssignedUsers = async (currentAdminId, userAuthToken) => {
        try {
            const response = await fetch(`http://${ipAddress}:8091/assigned-users/${currentAdminId}`, {
                headers: {
                    "Authorization": `Bearer ${userAuthToken}`,
                    "Content-Type": "application/json",
                },
            });

            if (!response.ok) {
                throw new Error(`Failed to fetch assigned users. Status: ${response.status}`);
            }

            const responseData = await response.json();
            if (responseData.success) {
                setAssignedUsers(responseData.assignedUsers);
                setFilteredUsers(responseData.assignedUsers);
            } else {
                setError(responseData.message || "Failed to fetch assigned users.");
            }
        } catch (err) {
            console.error("Error fetching assigned users:", err);
            setError("Error fetching assigned users. Please try again.");
        }
    };

    const fetchAdminOrders = async (currentAdminId, userAuthToken) => {
        const today = moment().format('YYYY-MM-DD');
        const apiUrl = `http://${ipAddress}:8091/get-admin-orders/${currentAdminId}?date=${today}`;

        try {
            console.log(`Fetching admin orders for date: ${today}, admin ID: ${currentAdminId}`);
            const response = await fetch(apiUrl, {
                headers: {
                    "Authorization": `Bearer ${userAuthToken}`,
                    "Content-Type": "application/json",
                },
            });

            if (!response.ok) {
                throw new Error(`Failed to fetch admin orders. Status: ${response.status}`);
            }

            const responseData = await response.json();
            if (responseData.success) {
                console.log(`Received ${responseData.orders?.length || 0} orders from backend`);
                console.log('Order statuses:', responseData.orders?.map(o => ({ id: o.id, status: o.approve_status })));
                setAdminOrders(responseData.orders || []);
            } else {
                setError(responseData.message || "Failed to fetch admin orders.");
            }
        } catch (err) {
            console.error("Error fetching admin orders:", err);
            setError("Error fetching admin orders. Please try again.");
        }
    };

    const updateOrderStatusInState = (orderId, status) => {
        const updatedOrders = adminOrders.map(order => {
            if (order.id === orderId) {
                return { ...order, approve_status: status };
            }
            return order;
        });
        setAdminOrders(updatedOrders);
    };

    const handleCheckboxChange = (orderId, isSelected) => {
        setSelectedOrderIds(prevSelectedOrderIds => {
            const updatedSelectedOrderIds = { ...prevSelectedOrderIds };
            if (isSelected) {
                updatedSelectedOrderIds[orderId] = true;
            } else {
                delete updatedSelectedOrderIds[orderId];
            }
            return updatedSelectedOrderIds;
        });
    };

    // Check if order can be accepted
    const canAcceptOrder = (order) => {
        // Can accept if status is Pending, null, or Altered
        const status = order.approve_status;
        console.log(`Order ${order.id} status: "${status}" (type: ${typeof status})`);
        const canAccept = status === 'Pending' || status === null || status === 'null' || status === 'Altered';
        console.log(`Can accept order ${order.id}: ${canAccept}`);
        return canAccept;
    };

    // Check if order can be rejected
    const canRejectOrder = (order) => {
        // Can reject if status is Pending, null, or Altered
        const status = order.approve_status;
        console.log(`Order ${order.id} status: "${status}" (type: ${typeof status})`);
        const canReject = status === 'Pending' || status === null || status === 'null' || status === 'Altered';
        console.log(`Can reject order ${order.id}: ${canReject}`);
        return canReject;
    };

    // Get orders that can be accepted
    const getAcceptableOrders = () => {
        return adminOrders.filter(order => canAcceptOrder(order));
    };

    // Get orders that can be rejected
    const getRejectableOrders = () => {
        return adminOrders.filter(order => canRejectOrder(order));
    };

    const handleOrderCardPress = (order) => {
        // Navigate to AdminOrderHistory with the specific order expanded
        navigation.navigate('AdminOrderHistory', {
            expandedOrderId: order.id,
            selectedDate: moment.unix(order.placed_on).toDate()
        });
    };

    // Bulk approve selected orders with confirmation
    const handleBulkApprove = async () => {
        const orderIdsToApprove = Object.keys(selectedOrderIds);
        if (orderIdsToApprove.length === 0) {
            Alert.alert("No Orders Selected", "Please select orders to approve.");
            return;
        }

        // Filter orders that can be accepted
        const acceptableOrders = orderIdsToApprove.filter(orderId => {
            const order = adminOrders.find(o => o.id === orderId);
            return order && canAcceptOrder(order);
        });

        if (acceptableOrders.length === 0) {
            Alert.alert(
                "Cannot Accept Orders",
                "Selected orders are already accepted or rejected and cannot be modified.",
                [{ text: "OK", style: "default" }]
            );
            return;
        }

        const nonAcceptableOrders = orderIdsToApprove.filter(orderId => {
            const order = adminOrders.find(o => o.id === orderId);
            return order && !canAcceptOrder(order);
        });

        // Show alert for non-acceptable orders
        if (nonAcceptableOrders.length > 0) {
            Alert.alert(
                "Some Orders Cannot Be Accepted",
                `${nonAcceptableOrders.length} orders are already accepted/rejected and will be skipped.`,
                [{ text: "OK", style: "default" }]
            );
        }

        let alertMessage = 'Are you sure you want to accept the selected orders?';
        if (nonAcceptableOrders.length > 0) {
            alertMessage = `Some selected orders cannot be accepted (already accepted/rejected). Only ${acceptableOrders.length} orders will be accepted. Continue?`;
        }

        Alert.alert(
            'Accept Selected Orders',
            alertMessage,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Accept',
                    style: 'default',
                    onPress: () =>
                        Alert.alert(
                            'Confirm Accept',
                            'Do you really want to accept these orders?',
                            [
                                { text: 'No', style: 'cancel' },
                                { text: 'Yes', style: 'default', onPress: async () => {
                                    setLoading(true);
                                    setError(null);
                                    try {
                                        const userAuthToken = await AsyncStorage.getItem("userAuthToken");
                                        let successCount = 0;
                                        for (const orderId of acceptableOrders) {
                                            const response = await fetch(`http://${ipAddress}:8091/update-order-status`, {
                                                method: 'POST',
                                                headers: {
                                                    "Authorization": `Bearer ${userAuthToken}`,
                                                    "Content-Type": "application/json",
                                                },
                                                body: JSON.stringify({ id: orderId, approve_status: 'Accepted' })
                                            });
                                            if (!response.ok) {
                                                console.error(`HTTP Error approving order ID ${orderId}. Status: ${response.status}`);
                                                continue;
                                            }
                                            const responseData = await response.json();
                                            if (responseData.success) {
                                                updateOrderStatusInState(orderId, 'Accepted');
                                                successCount++;
                                            }
                                        }
                                        Toast.show({
                                            type: 'success',
                                            text1: 'Orders Accepted',
                                            text2: 'Selected orders accepted successfully'
                                        });
                                        setSelectedOrderIds({});
                                        setSelectAllOrders(false);
                                        await fetchAdminOrders(adminId, userAuthToken);
                                    } catch (err) {
                                        Toast.show({ type: 'error', text1: 'Error', text2: 'Failed to approve selected orders. Please try again.' });
                                        setError("Failed to approve selected orders. Please try again.");
                                    } finally {
                                        setLoading(false);
                                    }
                                } }
                            ]
                        ),
                }
            ]
        );
    };

    // Bulk reject selected orders
    const handleBulkReject = async () => {
        const orderIdsToReject = Object.keys(selectedOrderIds);
        if (orderIdsToReject.length === 0) {
            Alert.alert("No Orders Selected", "Please select orders to reject.");
            return;
        }

        // Filter orders that can be rejected
        const rejectableOrders = orderIdsToReject.filter(orderId => {
            const order = adminOrders.find(o => o.id === orderId);
            return order && canRejectOrder(order);
        });

        if (rejectableOrders.length === 0) {
            Alert.alert(
                "Cannot Reject Orders",
                "Selected orders are already accepted or rejected and cannot be modified.",
                [{ text: "OK", style: "default" }]
            );
            return;
        }

        const nonRejectableOrders = orderIdsToReject.filter(orderId => {
            const order = adminOrders.find(o => o.id === orderId);
            return order && !canRejectOrder(order);
        });

        // Show alert for non-rejectable orders
        if (nonRejectableOrders.length > 0) {
            Alert.alert(
                "Some Orders Cannot Be Rejected",
                `${nonRejectableOrders.length} orders are already accepted/rejected and will be skipped.`,
                [{ text: "OK", style: "default" }]
            );
        }

        let alertMessage = 'Are you sure you want to reject the selected orders?';
        if (nonRejectableOrders.length > 0) {
            alertMessage = `Some selected orders cannot be rejected (already accepted/rejected). Only ${rejectableOrders.length} orders will be rejected. Continue?`;
        }

        Alert.alert(
            'Reject Selected Orders',
            alertMessage,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Reject',
                    style: 'destructive',
                    onPress: () =>
                        Alert.alert(
                            'Confirm Reject',
                            'Do you really want to reject these orders?',
                            [
                                { text: 'No', style: 'cancel' },
                                { text: 'Yes', style: 'destructive', onPress: async () => {
                                    setLoading(true);
                                    setError(null);
                                    try {
                                        const userAuthToken = await AsyncStorage.getItem("userAuthToken");
                                        let successCount = 0;
                                        for (const orderId of rejectableOrders) {
                                            const response = await fetch(`http://${ipAddress}:8091/update-order-status`, {
                                                method: 'POST',
                                                headers: {
                                                    "Authorization": `Bearer ${userAuthToken}`,
                                                    "Content-Type": "application/json",
                                                },
                                                body: JSON.stringify({ id: orderId, approve_status: 'Rejected' })
                                            });
                                            if (!response.ok) {
                                                console.error(`HTTP Error rejecting order ID ${orderId}. Status: ${response.status}`);
                                                continue;
                                            }
                                            const responseData = await response.json();
                                            if (responseData.success) {
                                                updateOrderStatusInState(orderId, 'Rejected');
                                                successCount++;
                                            }
                                        }
                                        Toast.show({
                                            type: 'success',
                                            text1: 'Orders Rejected',
                                            text2: 'Selected orders rejected successfully'
                                        });
                                        setSelectedOrderIds({});
                                        setSelectAllOrders(false);
                                        await fetchAdminOrders(adminId, userAuthToken);
                                    } catch (err) {
                                        Toast.show({ type: 'error', text1: 'Error', text2: 'Failed to reject selected orders. Please try again.' });
                                        setError("Failed to reject selected orders. Please try again.");
                                    } finally {
                                        setLoading(false);
                                    }
                                } }
                            ]
                        ),
                }
            ]
        );
    };

    const renderUserOrderItem = ({ item }) => {
        const today = moment();
        const userOrdersToday = adminOrders.filter(order => 
            order.customer_id === item.cust_id && 
            moment.unix(order.placed_on).isSame(today, 'day')
        );

        // Helper for Google Maps link
        const openAddressInMaps = async (address) => {
            if (!address) return;
            if (/^https?:\/\//i.test(address)) {
                // If address is a URL (short link or Google Maps link), open it directly
                await Linking.openURL(address);
            } else {
                // Otherwise, use the address in a Google Maps search URL
                const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
                // Try to open in Chrome if available (Android), else fallback
                const chromeUrl = `googlechrome://navigate?url=${encodeURIComponent(url)}`;
                try {
                    const supported = await Linking.canOpenURL(chromeUrl);
                    if (supported) {
                        await Linking.openURL(chromeUrl);
                    } else {
                        await Linking.openURL(url);
                    }
                } catch (e) {
                    await Linking.openURL(url);
                }
            }
        };

        return (
            <Card style={styles.userCard} key={item.cust_id}>
                <Card.Content>
                    <View style={styles.userHeader}>
                        <View style={styles.userAvatar}>
                            <Icon name="account-circle" size={32} color={COLORS.primary} />
                        </View>
                        <View style={styles.userInfo}>
                            <Text style={styles.userName}>{item.username}</Text>
                            {/* Route and Phone side by side */}
                            <View style={styles.userMetaRowHorizontal}>
                                <Text style={styles.userMetaText}>{item.route || 'N/A'}</Text>
                                <TouchableOpacity
                                    style={[styles.userMetaRowSingle, { marginLeft: 60 }]}
                                    onPress={() => item.phone && Linking.openURL(`tel:${item.phone}`)}
                                    disabled={!item.phone}
                                >
                                    <Icon name="phone" size={15} color={COLORS.primary} />
                                    <Text style={styles.clickableMetaText}>{item.phone || 'N/A'}</Text>
                                </TouchableOpacity>
                            </View>
                            {/* Delivery Address below */}
                            <TouchableOpacity
                                style={styles.userMetaRowSingle}
                                onPress={() => openAddressInMaps(item.delivery_address)}
                                disabled={!item.delivery_address}
                            >
                                <Icon name="map-marker" size={15} color={COLORS.primary} />
                                <Text style={[styles.clickableMetaText, { maxWidth: undefined }]} numberOfLines={2} ellipsizeMode="tail">{item.delivery_address || 'No address'}</Text>
                            </TouchableOpacity>
                        </View>
                    </View>

                    <View style={styles.ordersContainer}>
                        {userOrdersToday.length > 0 ? (
                            userOrdersToday.map(order => (
                                <Card key={order.id} style={styles.orderCard}>
                                    <Card.Content>
                                        <TouchableOpacity 
                                            style={styles.orderCardTouchable}
                                            onPress={() => handleOrderCardPress(order)}
                                            activeOpacity={0.7}
                                        >
                                            <View style={styles.orderRow}>
                                                <Checkbox
                                                    status={!!selectedOrderIds[order.id] ? 'checked' : 'unchecked'}
                                                    onPress={() => handleCheckboxChange(order.id, !selectedOrderIds[order.id])}
                                                    color={COLORS.primary}
                                                    disabled={!canAcceptOrder(order) && !canRejectOrder(order)}
                                                />
                                                <View style={styles.orderDetails}>
                                                    <View style={styles.orderMeta}>
                                                        <Text style={styles.orderLabel}>Order ID:</Text>
                                                        <Text style={styles.orderValue}>{order.id}</Text>
                                                    </View>
                                                    <View style={styles.orderMeta}>
                                                        <Text style={styles.orderLabel}>Date:</Text>
                                                        <Text style={styles.orderValue}>{moment.unix(order.placed_on).format('DD MMM, YYYY')}</Text>
                                                    </View>
                                                    <View style={styles.orderMeta}>
                                                        <Text style={styles.orderLabel}>Order Value:</Text>
                                                        <Text style={styles.orderValue}>{order.total_amount}</Text>
                                                    </View>
                                                </View>
                                                <View style={styles.orderStatus}>
                                                    {order.altered === 'Yes' ? (
                                                        <View style={[styles.statusBadge, styles.alteredBadge]}>
                                                            <Icon name="pencil" size={14} color={COLORS.primary} />
                                                            <Text style={styles.alteredStatus}>Altered</Text>
                                                        </View>
                                                    ) : order.approve_status === 'Altered' ? (
                                                        <View style={[styles.statusBadge, styles.alteredBadge]}>
                                                            <Icon name="pencil" size={14} color={COLORS.primary} />
                                                            <Text style={styles.alteredStatus}>Altered</Text>
                                                        </View>
                                                    ) : (
                                                        <View style={[
                                                            styles.statusBadge,
                                                            order.approve_status === 'Accepted' ? styles.acceptedBadge : order.approve_status === 'Rejected' ? styles.pendingBadge : styles.pendingBadge
                                                        ]}>
                                                            <Icon 
                                                                name={order.approve_status === 'Accepted' ? 'check-circle' : order.approve_status === 'Rejected' ? 'close-circle' : 'clock-outline'} 
                                                                size={14} 
                                                                color={order.approve_status === 'Accepted' ? COLORS.success : order.approve_status === 'Rejected' ? COLORS.error : COLORS.warning} 
                                                            />
                                                            <Text style={[
                                                                styles.statusText,
                                                                order.approve_status === 'Accepted' ? styles.acceptedStatus : order.approve_status === 'Rejected' ? { color: COLORS.error } : styles.pendingStatus
                                                            ]}>
                                                                {order.approve_status === 'Accepted' ? 'Accepted' : order.approve_status === 'Rejected' ? 'Rejected' : 'Pending'}
                                                            </Text>
                                                        </View>
                                                    )}
                                                </View>
                                                <View style={styles.orderCardIcon}>
                                                    <Icon name="chevron-right" size={20} color={COLORS.primary} />
                                                </View>
                                            </View>
                                        </TouchableOpacity>
                                    </Card.Content>
                                </Card>
                            ))
                        ) : (
                            <Card style={styles.noOrdersCard}>
                                <Card.Content>
                                    <Text style={styles.noOrdersText}>No orders for today</Text>
                                </Card.Content>
                            </Card>
                        )}
                    </View>
                </Card.Content>
            </Card>
        );
    };

    const renderContent = () => {
        return (
            <View style={styles.contentContainer}>
                <Card style={styles.bulkActionsCard}>
                    <Card.Content>
                        <View style={styles.bulkActionsContainer}>
                            <View style={styles.selectAllContainer}>
                                <Checkbox
                                    status={selectAllOrders ? 'checked' : 'unchecked'}
                                    onPress={() => setSelectAllOrders(!selectAllOrders)}
                                    color={COLORS.primary}
                                />
                                <Text style={styles.selectAllText}>Select All Orders</Text>
                            </View>
                        </View>
                        <View style={styles.bulkActionsButtonRow}>
                            <Button
                                mode="contained"
                                compact={true}
                                onPress={() => {
                                    const acceptableCount = getAcceptableOrders().length;
                                    if (acceptableCount === 0) {
                                        Alert.alert(
                                            "Cannot Accept Orders",
                                            "Selected orders are already accepted or rejected and cannot be modified.",
                                            [{ text: "OK", style: "default" }]
                                        );
                                        return;
                                    }
                                    handleBulkApprove();
                                }}
                                style={[styles.bulkApproveButton, smallButtonStyle]}
                                labelStyle={[styles.bulkApproveButtonLabel, smallLabelStyle]}
                                disabled={Object.keys(selectedOrderIds).length === 0}
                                icon="check-circle"
                            >
                                Accept Selected
                            </Button>
                            <Button
                                mode="contained"
                                compact={true}
                                onPress={() => {
                                    const rejectableCount = getRejectableOrders().length;
                                    if (rejectableCount === 0) {
                                        Alert.alert(
                                            "Cannot Reject Orders",
                                            "Selected orders are already accepted or rejected and cannot be modified.",
                                            [{ text: "OK", style: "default" }]
                                        );
                                        return;
                                    }
                                    handleBulkReject();
                                }}
                                style={[styles.bulkRejectButton, smallButtonStyle]}
                                labelStyle={[styles.bulkRejectButtonLabel, smallLabelStyle]}
                                disabled={Object.keys(selectedOrderIds).length === 0}
                                icon="close-circle"
                            >
                                Reject Selected
                            </Button>
                        </View>
                    </Card.Content>
                </Card>

                <Searchbar
                    placeholder="Search users..."
                    onChangeText={setSearchQuery}
                    value={searchQuery}
                    style={styles.searchBar}
                    iconColor={COLORS.primary}
                    inputStyle={styles.searchInput}
                />
                
                {/* Manual Refresh Button */}
                <View style={styles.refreshButtonContainer}>
                    <Button
                        mode="outlined"
                        compact={true}
                        onPress={() => {
                            console.log('Manual refresh triggered');
                            fetchInitialData();
                        }}
                        style={styles.refreshButton}
                        labelStyle={styles.refreshButtonLabel}
                        icon="refresh"
                    >
                        Refresh Orders
                    </Button>
                </View>
                
                {/* Route Filter Dropdown */}
                <View style={styles.routeFilterContainer}>
                    <Picker
                        selectedValue={selectedRoute}
                        onValueChange={setSelectedRoute}
                        style={styles.routePicker}
                        dropdownIconColor={COLORS.primary}
                    >
                        {uniqueRoutes.map((route, idx) => (
                            <Picker.Item key={idx} label={route} value={route} />
                        ))}
                    </Picker>
                </View>

                <ScrollView 
                    style={styles.usersScrollView}
                    refreshControl={
                        <RefreshControl
                            refreshing={refreshing}
                            onRefresh={onRefresh}
                            colors={[COLORS.primary]}
                            tintColor={COLORS.primary}
                        />
                    }
                    onScroll={Animated.event(
                        [{ nativeEvent: { contentOffset: { y: scrollY } } }],
                        { useNativeDriver: false }
                    )}
                    scrollEventThrottle={16}
                >
                    {displayedUsers.length > 0 ? (
                        displayedUsers.map(user => renderUserOrderItem({ item: user }))
                    ) : (
                        <Card style={styles.emptyCard}>
                            <Card.Content style={styles.emptyContent}>
                                <Icon name="account-question" size={48} color={COLORS.primary} />
                                <Text style={styles.emptyText}>No users found</Text>
                                <Text style={styles.emptySubtext}>
                                    {searchQuery ? 'Try a different search term' : 'No customers with orders today'}
                                </Text>
                            </Card.Content>
                        </Card>
                    )}
                </ScrollView>
            </View>
        );
    };

    return (
        <View style={styles.container}>
           

            {loading ? (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={COLORS.primary} />
                    <Text style={styles.loadingText}>Loading user data...</Text>
                </View>
            ) : error ? (
                <Card style={styles.errorCard}>
                    <Card.Content>
                        <View style={styles.errorContent}>
                            <Icon name="alert-circle" size={24} color={COLORS.error} />
                            <Text style={styles.errorText}>{error}</Text>
                        </View>
                    </Card.Content>
                </Card>
            ) : (
                renderContent()
            )}
            
            {/* Toast Component */}
            <Toast />
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.background,
    },
    header: {
        backgroundColor: COLORS.primary,
        padding: 16,
        paddingTop: Platform.OS === 'ios' ? 40 : 16,
        borderBottomLeftRadius: 16,
        borderBottomRightRadius: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
        elevation: 5,
    },
    headerContent: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    headerTitle: {
        fontSize: 24,
        fontWeight: '600',
        color: COLORS.text.light,
        marginLeft: 12,
    },
    contentContainer: {
        flex: 1,
        padding: 16,
    },
    searchBar: {
        marginBottom: 16,
        backgroundColor: COLORS.surface,
        borderRadius: 8,
        elevation: 2,
    },
    searchInput: {
        color: COLORS.text.primary,
    },
    bulkActionsCard: {
        backgroundColor: COLORS.surface,
        borderRadius: 10,
        marginBottom: 4,
        elevation: 1,
        paddingVertical: 1,
        paddingHorizontal: 4,
    },
    bulkActionsContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 0,
        paddingHorizontal: 0,
    },
    selectAllContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 0,
        paddingVertical: 0,
    },
    selectAllText: {
        marginLeft: 4,
        fontSize: 13,
        color: COLORS.primary,
        fontWeight: '500',
    },
    bulkApproveButton: {
        backgroundColor: COLORS.primary,
        borderRadius: 8,
        minHeight: 26,
        paddingVertical: 0,
        paddingHorizontal: 6,
        marginBottom: 2,
        width: 130,
        alignSelf: 'center',
    },
    bulkApproveButtonLabel: {
        color: COLORS.text.light,
        fontWeight: '500',
        fontSize: 12,
    },
    bulkRejectButton: {
        backgroundColor: COLORS.error,
        borderRadius: 8,
        minHeight: 26,
        paddingVertical: 0,
        paddingHorizontal: 6,
        width: 130,
        alignSelf: 'center',
    },
    bulkRejectButtonLabel: {
        color: COLORS.text.light,
        fontWeight: '500',
        fontSize: 12,
    },
    usersScrollView: {
        flex: 1,
    },
    userCard: {
        backgroundColor: COLORS.surface,
        borderRadius: 12,
        marginBottom: 16,
        elevation: 2,
    },
    userHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 16,
    },
    userAvatar: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: COLORS.background,
        justifyContent: 'center',
        alignItems: 'center',
    },
    userInfo: {
        marginLeft: 12,
        flex: 1,
    },
    userName: {
        fontSize: 18,
        fontWeight: '600',
        color: COLORS.text.primary,
    },
    userMeta: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 4,
    },
    userRoute: {
        fontSize: 14,
        color: COLORS.text.secondary,
        marginLeft: 4,
    },
    ordersContainer: {
        marginTop: 8,
    },
    orderTypeSection: {
        marginBottom: 16,
    },
    orderTypeHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
    },
    orderTypeTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: COLORS.text.primary,
        marginLeft: 8,
    },
    orderCountBadge: {
        backgroundColor: COLORS.background,
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 12,
        marginLeft: 8,
    },
    orderCountText: {
        fontSize: 12,
        color: COLORS.text.secondary,
        fontWeight: '500',
    },
    orderCard: {
        backgroundColor: COLORS.background,
        borderRadius: 8,
        marginBottom: 8,
    },
    noOrdersCard: {
        backgroundColor: COLORS.background,
        borderRadius: 8,
    },
    orderRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    orderDetails: {
        flex: 1,
        marginLeft: 8,
    },
    orderMeta: {
        flexDirection: 'row',
        marginBottom: 4,
    },
    orderLabel: {
        fontSize: 14,
        color: COLORS.text.secondary,
        width: 70,
    },
    orderValue: {
        fontSize: 14,
        color: COLORS.text.primary,
        fontWeight: '500',
    },
    orderStatus: {
        marginLeft: 8,
    },
    statusBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 12,
    },
    pendingBadge: {
        backgroundColor: '#FEF3C7',
    },
    acceptedBadge: {
        backgroundColor: '#D1FAE5',
    },
    alteredBadge: {
        backgroundColor: '#DBEAFE',
    },
    statusText: {
        fontSize: 12,
        fontWeight: '500',
        marginLeft: 4,
    },
    pendingStatus: {
        color: COLORS.warning,
    },
    acceptedStatus: {
        color: COLORS.success,
    },
    alteredStatus: {
        color: COLORS.primary,
    },
    noOrdersText: {
        fontSize: 14,
        color: COLORS.text.secondary,
        fontStyle: 'italic',
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingText: {
        marginTop: 16,
        fontSize: 16,
        color: COLORS.primary,
    },
    errorCard: {
        backgroundColor: '#FEE2E2',
        margin: 16,
        borderLeftWidth: 4,
        borderLeftColor: COLORS.error,
    },
    errorContent: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    errorText: {
        color: COLORS.error,
        marginLeft: 8,
        fontSize: 16,
    },
    emptyCard: {
        backgroundColor: COLORS.surface,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        elevation: 2,
    },
    emptyContent: {
        alignItems: 'center',
    },
    emptyText: {
        fontSize: 18,
        fontWeight: '600',
        color: COLORS.text.primary,
        marginTop: 16,
        textAlign: 'center',
    },
    emptySubtext: {
        fontSize: 14,
        color: COLORS.text.secondary,
        marginTop: 8,
        textAlign: 'center',
    },
    bulkActionsButtonRow: {
        flexDirection: 'row',
        gap: 8,
        marginTop: 2,
        marginBottom: 0,
        justifyContent: 'center',
    },
    routeFilterContainer: {
        marginTop: 2,
        marginBottom: 6,
        backgroundColor: COLORS.surface,
        borderRadius: 6,
        borderWidth: 1,
        borderColor: COLORS.border,
        paddingHorizontal: 0,
        width: 120,
        alignSelf: 'flex-start',
        minHeight: 35,
    },
    routePicker: {
        height: 50,
        color: COLORS.text.primary,
        fontSize: 13,
    },
    userMetaRow: {
        flexDirection: 'row',
        alignItems: 'center',
        flexWrap: 'wrap',
        marginTop: 2,
        marginBottom: 2,
        gap: 10,
    },
    userMetaItem: {
        flexDirection: 'row',
        alignItems: 'center',
        marginRight: 10,
    },
    userMetaText: {
        fontSize: 13,
        color: COLORS.text.secondary,
        marginLeft: 3,
        maxWidth: 90,
    },
    userMetaRowSingle: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 2,
        marginBottom: 2,
    },
    clickableMetaText: {
        fontSize: 13,
        color: COLORS.primary,
        marginLeft: 3,
        maxWidth: 90,
        fontWeight: 'bold',
        textDecorationLine: 'underline',
    },
    userMetaRowHorizontal: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 2,
        marginBottom: 2,
    },
    orderCardTouchable: {
        flex: 1,
    },
    orderCardIcon: {
        marginLeft: 8,
        justifyContent: 'center',
        alignItems: 'center',
    },
    refreshButtonContainer: {
        marginBottom: 16,
        alignItems: 'center',
    },
    refreshButton: {
        borderColor: COLORS.primary,
        borderWidth: 1,
        borderRadius: 8,
        minHeight: 36,
        paddingHorizontal: 16,
    },
    refreshButtonLabel: {
        color: COLORS.primary,
        fontSize: 14,
        fontWeight: '500',
    },
});

export default OrderAcceptAdmin;