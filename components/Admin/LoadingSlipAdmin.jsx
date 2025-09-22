import React, { useState, useEffect, useCallback } from "react";
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    ActivityIndicator,
    TouchableOpacity,
    Alert,
    Platform,
    PermissionsAndroid,
    ToastAndroid,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { jwtDecode } from "jwt-decode";
import { ipAddress } from "../../services/urls";
import { useNavigation } from "@react-navigation/native";
import Ionicons from 'react-native-vector-icons/Ionicons';
import moment from 'moment';
import { Picker } from '@react-native-picker/picker';
import * as XLSX from 'xlsx';
import RNFS from 'react-native-fs';
import Share from 'react-native-share';
import { useFontScale } from '../../App';

// Helper function to convert Uint8Array to base64
const uint8ToBase64 = (uint8) => {
    if (!uint8 || !uint8.length) {
        throw new Error('Invalid data provided');
    }
    let binary = '';
    for (let i = 0; i < uint8.length; i++) {
        binary += String.fromCharCode(uint8[i]);
    }
    if (typeof global !== 'undefined' && global.btoa) {
        return global.btoa(binary);
    } else if (typeof btoa !== 'undefined') {
        return btoa(binary);
    } else {
        throw new Error('No base64 encoding function available');
    }
};

// Helper function to save file to downloads (works on all Android versions)
const saveFileToDownloads = async (fileData, fileName, mimeType) => {
    try {
        // For Android 10+ (API 29+)
        if (Platform.OS === 'android' && Platform.Version >= 29) {
            const filePath = `${RNFS.DownloadDirectoryPath}/${fileName}`;
            await RNFS.writeFile(filePath, fileData, 'base64');
            ToastAndroid.show(`File saved to Downloads as ${fileName}`, ToastAndroid.LONG);
            return filePath;
        } 
        // For older Android versions
        else if (Platform.OS === 'android') {
            const granted = await PermissionsAndroid.request(
                PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE,
                {
                    title: "Storage Permission",
                    message: "App needs access to storage to save files",
                    buttonPositive: "OK"
                }
            );
            
            if (granted === PermissionsAndroid.RESULTS.GRANTED) {
                const filePath = `${RNFS.DownloadDirectoryPath}/${fileName}`;
                await RNFS.writeFile(filePath, fileData, 'base64');
                ToastAndroid.show(`File saved to Downloads as ${fileName}`, ToastAndroid.LONG);
                return filePath;
            } else {
                Alert.alert("Permission Denied", "Cannot save file without storage permission");
                return null;
            }
        } 
        // For iOS
        else {
            const filePath = `${RNFS.DocumentDirectoryPath}/${fileName}`;
            await RNFS.writeFile(filePath, fileData, 'base64');
            return filePath;
        }
    } catch (error) {
        console.error("Error saving file:", error);
        Alert.alert("Error", `Failed to save file: ${error.message}`);
        return null;
    }
};

const LoadingSlipAdmin = () => {
    const { getScaledSize } = useFontScale();
    const [users, setUsers] = useState([]);
    const [adminOrders, setAdminOrders] = useState([]);
    const [adminUsersWithOrdersToday, setAdminUsersWithOrdersToday] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedRoute, setSelectedRoute] = useState('');
    const [routes, setRoutes] = useState([]);
    const navigation = useNavigation();

    // Fetch assigned users (admin's customers)
    const fetchAssignedUsers = useCallback(async (adminId, token) => {
        try {
            const response = await fetch(`http://${ipAddress}:8091/assigned-users/${adminId}`, {
                headers: {
                    "Authorization": `Bearer ${token}`,
                    "Content-Type": "application/json",
                },
            });
            if (!response.ok) throw new Error('Failed to fetch assigned users');
            const data = await response.json();
            setUsers(data.assignedUsers || []);
            // Extract unique routes
            const uniqueRoutes = Array.from(new Set((data.assignedUsers || []).map(u => u.route).filter(Boolean)));
            setRoutes(uniqueRoutes);
            setSelectedRoute(uniqueRoutes[0] || '');
        } catch (e) {
            setUsers([]);
            setRoutes([]);
            setSelectedRoute('');
        }
    }, []);

    // Fetch admin orders for today
    const fetchAdminOrders = useCallback(async (adminId, token) => {
        try {
            const today = moment().format("YYYY-MM-DD");
            const response = await fetch(`http://${ipAddress}:8091/get-admin-orders/${adminId}?date=${today}`, {
                headers: {
                    "Authorization": `Bearer ${token}`,
                    "Content-Type": "application/json"
                }
            });
            if (!response.ok) throw new Error('Failed to fetch orders');
            const data = await response.json();
            setAdminOrders(data.orders || []);
        } catch (e) {
            setAdminOrders([]);
        }
    }, []);

    // Load data on mount
    useEffect(() => {
        const loadData = async () => {
            setLoading(true);
            try {
                const token = await AsyncStorage.getItem("userAuthToken");
                if (!token) throw new Error("No token");
                const decoded = jwtDecode(token);
                const adminId = decoded.id1;
                await fetchAssignedUsers(adminId, token);
                await fetchAdminOrders(adminId, token);
            } catch (e) {
                setUsers([]);
                setAdminOrders([]);
            } finally {
                setLoading(false);
            }
        };
        loadData();
    }, [fetchAssignedUsers, fetchAdminOrders]);

    // Filter users with orders for today and selected route
    useEffect(() => {
        if (users.length && adminOrders.length && selectedRoute) {
            const filtered = users.filter(user =>
                user.route === selectedRoute &&
                adminOrders.some(order => order.customer_id === user.cust_id)
            );
            setAdminUsersWithOrdersToday(filtered);
        } else {
            setAdminUsersWithOrdersToday([]);
        }
    }, [users, adminOrders, selectedRoute]);

    // Excel export logic (minimal, follows Owner)
    const exportExcel = async () => {
        if (!selectedRoute) {
            Alert.alert('Select Route', 'Please select a route to export.');
            return;
        }

        setLoading(true);
        try {
            const usersForRoute = users.filter(u => u.route === selectedRoute);
            if (!usersForRoute.length) {
                Alert.alert('No Users', 'No users found for this route.');
                return;
            }

            // Create Excel workbook
            const wb = XLSX.utils.book_new();
            const wsData = [
                [`Loading Slip - Route ${selectedRoute}`],
                [],
                ["Name", "Order ID"],
                ...usersForRoute.map(user => {
                    const order = adminOrders.find(o => o.customer_id === user.cust_id);
                    return [user.name, order?.id || 'N/A'];
                })
            ];

            const ws = XLSX.utils.aoa_to_sheet(wsData);
            XLSX.utils.book_append_sheet(wb, ws, 'LoadingSlip');

            // Convert to base64
            const wbout = XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });
            const fileName = `LoadingSlip-Route-${selectedRoute}-${moment().format('YYYYMMDD_HHmmss')}.xlsx`;
            const mimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

            // Save file
            const filePath = await saveFileToDownloads(wbout, fileName, mimeType);
            if (filePath) {
                if (Platform.OS === 'ios') {
                    Alert.alert('Success', `File saved to Files app as ${fileName}`);
                }
                // On Android, Toast is already shown in saveFileToDownloads
            }
        } catch (error) {
            console.error('Error exporting excel:', error);
            Alert.alert('Error', 'Failed to generate or save the loading slip.');
        } finally {
            setLoading(false);
        }
    };

    // Render a single row
    const renderItem = ({ item, index }) => {
        const orderForUser = adminOrders.find(order =>
            order.customer_id === item.cust_id
        );
        const amount = (() => {
            const amt = orderForUser?.amount;
            if (typeof amt === 'number') return amt.toFixed(2);
            if (typeof amt === 'string') {
                const parsed = parseFloat(amt);
                return isNaN(parsed) ? '0.00' : parsed.toFixed(2);
            }
            return '0.00';
        })();
        return (
            <View style={styles.dataRow}>
                <Text style={[styles.dataCell, { flex: 1.1, fontSize: getScaledSize(14) }]}>{item?.name || 'N/A'}</Text>
                <Text style={[styles.dataCell, { flex: 1.6, fontSize: getScaledSize(14) }]}>{item?.route || 'N/A'}</Text>
                <Text style={[styles.dataCell, { flex: 1.5, fontSize: getScaledSize(14) }]}>{orderForUser?.id || 'N/A'}</Text>
                <Text style={[styles.dataCell, { flex: 2.1, fontSize: getScaledSize(14) }]}><Text>₹</Text><Text>{amount}</Text></Text>
                <Text style={[styles.dataCell, { flex: 1.5, fontSize: getScaledSize(14) }]}>{orderForUser?.approve_status || 'N/A'}</Text>
            </View>
        );
    };

    return (
        <View style={styles.container}>
            <View style={styles.filterContainer}>
                <Text style={[styles.filterLabel, { fontSize: getScaledSize(16) }]}>Select Route:</Text>
                <View style={{ flex: 1, marginLeft: 10, backgroundColor: '#fff', borderRadius: 8 }}>
                    <Picker
                        selectedValue={selectedRoute}
                        onValueChange={setSelectedRoute}
                        style={{ height: 40 }}
                    >
                        {routes.map(route => (
                            <Picker.Item key={route} label={route} value={route} />
                        ))}
                    </Picker>
                </View>
                <TouchableOpacity
                    style={{ marginLeft: 10, backgroundColor: '#003366', padding: 10, borderRadius: 8 }}
                    onPress={exportExcel}
                >
                    <Text style={[{ color: '#fff', fontWeight: 'bold' }, { fontSize: getScaledSize(14) }]}>Export Excel</Text>
                </TouchableOpacity>
            </View>
            <View style={styles.columnHeader}>
                <Text style={[styles.columnHeaderText, { flex: 1.1, fontSize: getScaledSize(15) }]}>Name</Text>
                <Text style={[styles.columnHeaderText, { flex: 1.6, fontSize: getScaledSize(15) }]}>Route</Text>
                <Text style={[styles.columnHeaderText, { flex: 1.5, fontSize: getScaledSize(15) }]}>Order ID</Text>
                <Text style={[styles.columnHeaderText, { flex: 2.1, fontSize: getScaledSize(15) }]}>Amount</Text>
                <Text style={[styles.columnHeaderText, { flex: 1.5, fontSize: getScaledSize(15) }]}>Approval</Text>
            </View>
            {loading ? (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#003366" />
                    <Text style={[styles.loadingText, { fontSize: getScaledSize(16) }]}>Loading orders...</Text>
                </View>
            ) : (
                <FlatList
                    data={adminUsersWithOrdersToday}
                    renderItem={renderItem}
                    keyExtractor={(item, index) => item?.cust_id?.toString() || index.toString()}
                    ListEmptyComponent={() => (
                        <View style={styles.emptyListContainer}>
                            <Ionicons name="alert-circle-outline" size={40} color="#6B7280" />
                            <Text style={[styles.emptyListText, { fontSize: getScaledSize(16) }]}>No orders for this route.</Text>
                        </View>
                    )}
                />
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#E6E9EF',
        padding: 16,
    },
    filterContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: 16,
        backgroundColor: '#FFFFFF',
        borderRadius: 8,
        marginBottom: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 2,
    },
    filterLabel: {
        fontWeight: '600',
        color: '#003366',
        marginRight: 16,
    },
    toggleContainer: {
        flexDirection: 'row',
        flex: 0.4,
        borderRadius: 8,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: '#004d99',
    },
    toggleButton: {
        flex: 1,
        paddingVertical: 10,
        backgroundColor: '#FFFFFF',
        alignItems: 'center',
        justifyContent: 'center',
    },
    toggleButtonActive: {
        backgroundColor: '#003366',
    },
    toggleText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#003366',
    },
    toggleTextActive: {
        color: '#FFFFFF',
    },
    columnHeader: {
        flexDirection: 'row',
        paddingVertical: 12,
        paddingHorizontal: 16,
        backgroundColor: '#003366',
        borderRadius: 8,
        marginBottom: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 2,
    },
    columnHeaderText: {
        fontWeight: '700',
        color: '#FFFFFF',
        textAlign: 'center',
    },
    dataRow: {
        flexDirection: 'row',
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#D6DEEB',
    },
    dataCell: {
        fontWeight: '500',
        color: '#1F2937',
        textAlign: 'center',
    },
    emptyListContainer: {
        alignItems: 'center',
        marginTop: 32,
    },
    emptyListText: {
        fontWeight: '500',
        color: '#6B7280',
        textAlign: 'center',
        marginTop: 8,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    loadingText: {
        marginTop: 12,
        fontWeight: '600',
        color: '#003366',
    },
});

export default LoadingSlipAdmin;
