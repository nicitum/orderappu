import React, { useState, useEffect, useCallback } from "react";
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    Alert,
    ActivityIndicator,
    Platform,
    TouchableOpacity,
    PermissionsAndroid,
    Linking
} from "react-native";
import { ToastAndroid } from "react-native";
import { Picker } from '@react-native-picker/picker';
import AsyncStorage from "@react-native-async-storage/async-storage";
import { jwtDecode } from "jwt-decode";
import { ipAddress } from "../../services/urls";
import { useNavigation } from "@react-navigation/native";
import { checkTokenAndRedirect } from "../../services/auth";
import moment from 'moment';
import * as XLSX from 'xlsx';
import RNFS from 'react-native-fs';
import Share from 'react-native-share';
import Ionicons from 'react-native-vector-icons/Ionicons';

const LOADING_SLIP_DIR_URI_KEY = 'loadingSlipDirectoryUri';

const LoadingSlipPage = () => {
    const [assignedUsers, setAssignedUsers] = useState([]);
    const [adminOrders, setAdminOrders] = useState([]);
    const [adminUsersWithOrdersToday, setAdminUsersWithOrdersToday] = useState([]);
    const [adminId, setAdminId] = useState(null);
    const [error, setError] = useState(null);
    const [loading, setLoading] = useState(true);
    const [orderTypeFilter, setOrderTypeFilter] = useState('AM');
    const navigation = useNavigation();
    const [products, setProducts] = useState([]);
    const [selectedOrderId, setSelectedOrderId] = useState(null);
    const [isOrderUpdated, setIsOrderUpdated] = useState(false);
    const [savedDirectoryUri, setSavedDirectoryUri] = useState(null);

    useEffect(() => {
        const loadSavedState = async () => {
            try {
                const storedUri = await AsyncStorage.getItem(LOADING_SLIP_DIR_URI_KEY);
                if (storedUri) {
                    setSavedDirectoryUri(storedUri);
                    console.log("Loaded savedDirectoryUri from AsyncStorage:", storedUri);
                }
            } catch (e) {
                console.error("Error loading state from AsyncStorage:", e);
            }
        };
        loadSavedState();
    }, []);

    const fetchAssignedUsers = useCallback(async (currentAdminId, userAuthToken) => {
        try {
            const response = await fetch(`http://${ipAddress}:8091/assigned-users/${currentAdminId}`, {
                headers: {
                    "Authorization": `Bearer ${userAuthToken}`,
                    "Content-Type": "application/json",
                },
            });

            if (!response.ok) throw new Error(`Failed to fetch assigned users. Status: ${response.status}`);

            const responseData = await response.json();
            if (responseData.success) {
                setAssignedUsers(responseData.assignedUsers);
                setError(null);
            } else {
                setError("Failed to fetch assigned users.");
            }
        } catch (err) {
            setError("Error fetching assigned users. Please try again.");
        } finally {
            setLoading(false);
        }
    }, []);

    const fetchAdminOrders = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const token = await AsyncStorage.getItem("userAuthToken");
            if (!token) throw new Error("User authentication token not found.");

            const decodedToken = jwtDecode(token);
            const adminId = decodedToken.id1;
            setAdminId(adminId);

            // Format today's date for the query parameter
            const todayFormatted = moment().format("YYYY-MM-DD");

            // Fetch orders with date filter
            const response = await fetch(`http://${ipAddress}:8091/get-admin-orders/${adminId}?date=${todayFormatted}`, {
                headers: {
                    "Authorization": `Bearer ${token}`,
                    "Content-Type": "application/json"
                }
            });
            console.log("response", response);

            // Check response status
            if (!response.ok) throw new Error(`Failed to fetch orders. Status: ${response.status}`);

    

            const ordersData = await response.json();
            console.log("ordersData", ordersData.orders);

            const nonCancelledOrders = ordersData.orders
                .filter(order => order.cancelled !== 'Yes' && order.approve_status === 'Accepted')
                .map(order => ({
                    ...order,
                    amount: order.amount ? parseFloat(order.amount) : 0
                }));
            setAdminOrders(nonCancelledOrders);
            console.log("Fetched admin orders:", nonCancelledOrders);
        } catch (err) {
            setError(err.message || "Failed to fetch admin orders.");
            Alert.alert("Error", "Failed to fetch admin orders. Please try again.");
        } finally {
            setLoading(false);
        }
    }, []);

    const save = async (uri, filename, mimetype, reportType) => {
        if (Platform.OS === "android") {
            try {
                let directoryUriToUse = await AsyncStorage.getItem(LOADING_SLIP_DIR_URI_KEY);
                if (!directoryUriToUse) {
                    // For Android, we'll use the Downloads directory
                    directoryUriToUse = RNFS.DownloadDirectoryPath;
                    await AsyncStorage.setItem(LOADING_SLIP_DIR_URI_KEY, directoryUriToUse);
                }

                const filePath = `${directoryUriToUse}/${filename}`;
                await RNFS.copyFile(uri, filePath);
                if (Platform.OS === 'android') {
                    ToastAndroid.show(`${reportType} Saved Successfully!`, ToastAndroid.SHORT);
                } else {
                    Alert.alert('Success', `${reportType} Saved Successfully!`);
                }
            } catch (error) {
                console.error("Error saving file:", error);
                // If saving fails, try sharing
                try {
                    await Share.open({
                        url: uri,
                        type: mimetype,
                        title: `Share ${reportType}`
                    });
                    Alert.alert("Success", `${reportType} Shared Successfully!`);
                } catch (shareError) {
                    console.error("Error sharing file:", shareError);
                    Alert.alert("Error", `Failed to save or share ${reportType}.`);
                }
            }
        } else {
            try {
                await Share.open({
                    url: uri,
                    type: mimetype,
                    title: `Share ${reportType}`
                });
                Alert.alert("Success", `${reportType} Shared Successfully!`);
            } catch (error) {
                console.error("Error sharing file:", error);
                Alert.alert("Error", `Failed to share ${reportType}.`);
            }
        }
    };

    const generateExcelReport = async (productsData, reportType, routeName = '') => {
        if (!productsData || (Array.isArray(productsData) && productsData.length === 0) || (typeof productsData === 'object' && productsData.productList.length === 0)) {
            Alert.alert("No Products", "No products to include in the loading slip.");
            return;
        }

        setLoading(true);
        try {
            const wb = XLSX.utils.book_new();
    
            let wsData;
            let filename;

            if (reportType === 'Loading Slip') {
                const { productList, brandTotals } = productsData;
                let totalQuantity = 0;
                let totalBaseUnitQuantity = 0;
                let totalCrates = 0;

                productList.forEach(product => {
                    totalQuantity += product.quantity;
                    totalBaseUnitQuantity += parseFloat(product.baseUnitQuantity);
                    totalCrates += product.crates;
                });

                wsData = [
                    [`${reportType} - Route ${routeName}`],
                    [],
                    ["Products", "Quantity in base units (eaches)", "Quantity in base units (kgs/lts)", "Crates"],
                    ...productList.map(product => [
                        product.name,
                        product.quantity,
                        product.baseUnitQuantity,
                        product.crates
                    ]),
                    ["Totals", totalQuantity.toFixed(2), totalBaseUnitQuantity.toFixed(2), totalCrates],
                    [], // Add some space
                    ["Brand", "Total Crates"],
                    ...brandTotals.map(brandTotal => [brandTotal.brand, brandTotal.totalCrates])
                ];
                filename = `${reportType.replace(/\s/g, '')}-Route-${routeName}.xlsx`;
            } else {
                // Keep the existing logic for other report types if needed
                let totalQuantity = 0;
                let totalBaseUnitQuantity = 0;
                let totalCrates = 0;

                productsData.forEach(product => {
                    totalQuantity += product.quantity;
                    totalBaseUnitQuantity += parseFloat(product.baseUnitQuantity);
                    totalCrates += product.crates;
                });

                wsData = [
                    [`${reportType} - Route ${routeName}`],
                    [],
                    ["Products", "Quantity in base units (eaches)", "Quantity in base units (kgs/lts)", "Crates"],
                    ...productsData.map(product => [
                        product.name,
                        product.quantity,
                        product.baseUnitQuantity,
                        product.crates
                    ]),
                    ["Totals", totalQuantity.toFixed(2), totalBaseUnitQuantity.toFixed(2), totalCrates]
                ];
                filename = `${reportType.replace(/\s/g, '')}-Route-${routeName}.xlsx`;
            }

            const ws = XLSX.utils.aoa_to_sheet(wsData);
            XLSX.utils.book_append_sheet(wb, ws, `${reportType} Data`);

            const wbout = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
            const base64Workbook = XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });

            const mimetype = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

            if (Platform.OS === 'web') {
                const blob = new Blob([wbout], { type: mimetype });
                const url = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.download = filename;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                URL.revokeObjectURL(url);
                if (Platform.OS === 'web') {
                    Alert.alert('Success', `${reportType} Generated Successfully! File downloaded in your browser.`);
                }
            } else {
                const fileDir = RNFS.CachesDirectoryPath;
                const fileUri = `${fileDir}/${filename}`;

                await RNFS.writeFile(fileUri, base64Workbook, 'base64');

                if (Platform.OS === 'android') {
                    save(fileUri, filename, mimetype, reportType);
                } else {
                    try {
                        await Share.open({
                            url: fileUri,
                            type: mimetype,
                            title: `${reportType} Report`
                        });
                        if (Platform.OS !== 'android') {
                            Alert.alert('Success', `${reportType} Generated and Shared Successfully!`);
                        }
                    } catch (shareError) {
                        console.error("Sharing Error:", shareError);
                        if (Platform.OS === 'android') {
                            ToastAndroid.show(`Sharing ${reportType} Failed.`, ToastAndroid.SHORT);
                        } else {
                            Alert.alert("Sharing Failed", `Error occurred while trying to share the ${reportType.toLowerCase()}.`);
                        }
                        setError("Error sharing file.");
                    }
                }
            }
        } catch (e) {
            console.error("Excel Generation Error:", e);
            if (Platform.OS === 'android') {
                ToastAndroid.show(`Failed to generate ${reportType}.`, ToastAndroid.SHORT);
            } else {
                Alert.alert("Generation Failed", `Error generating Excel ${reportType.toLowerCase()}.`);
            }
            setError("Error generating Excel file.");
        } finally {
            setLoading(false);
        }
    };

    const generateDeliveryExcelReport = async (usersForRoute, routeName) => {
        const reportType = 'Delivery Slip';
        setLoading(true);
        try {
            const wb = XLSX.utils.book_new();
            const deliverySlipData = await createDeliverySlipDataForExcelForRoute(usersForRoute);

            // Modify headers to include newline characters (assuming headers are in deliverySlipData[3])
            deliverySlipData[3] = deliverySlipData[3].map(header => {
                if (typeof header === 'string' && header.includes(' ')) {
                    // Split by space and join with newline
                    return header.split(' ').join('\n');
                }
                return header;
            });

            const ws = XLSX.utils.aoa_to_sheet(deliverySlipData);

            // Set column widths
            if (!ws['!cols']) ws['!cols'] = [];
            ws['!cols'][0] = { wch: 30 }; // First column width
            for (let i = 1; i < deliverySlipData[3].length; i++) {
                ws['!cols'][i] = { wch: 15 }; // Increased width to accommodate wrapped text
                const cellRef = XLSX.utils.encode_cell({ r: 3, c: i });
                if (!ws[cellRef]) continue;
                ws[cellRef].s = {
                    alignment: {
                        vertical: 'center',
                        horizontal: 'center',
                        wrapText: true, // Enable text wrapping
                        textRotation: 90 // Keep rotated text
                    },
                    font: {
                        bold: true
                    }
                };
            }

            // Style the first header cell (Items header)
            const itemsHeaderRef = XLSX.utils.encode_cell({ r: 3, c: 0 });
            if (ws[itemsHeaderRef]) {
                ws[itemsHeaderRef].s = {
                    alignment: {
                        vertical: 'center',
                        horizontal: 'center',
                        wrapText: true // Enable text wrapping
                    },
                    font: {
                        bold: true
                    }
                };
            }

            // Adjust row height for the header row to fit wrapped text
            if (!ws['!rows']) ws['!rows'] = [];
            ws['!rows'][3] = { hpt: 60 };
            XLSX.utils.book_append_sheet(wb, ws, `${reportType}`);

            const wbout = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
            const base64Workbook = XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });

            const filename = `${reportType.replace(/\s/g, '')}-Route-${routeName}.xlsx`;
            const mimetype = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

            if (Platform.OS === 'web') {
                const blob = new Blob([wbout], { type: mimetype });
                const url = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.download = filename;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                URL.revokeObjectURL(url);
                if (Platform.OS === 'web') {
                    Alert.alert('Success', `${reportType} Generated Successfully! File downloaded in your browser.`);
                }
            } else {
                const fileDir = RNFS.CachesDirectoryPath;
                const fileUri = `${fileDir}/${filename}`;

                await RNFS.writeFile(fileUri, base64Workbook, 'base64');

                console.log(`${reportType} File written to documentDirectory:`, fileUri);

                if (Platform.OS === 'android') {
                    save(fileUri, filename, mimetype, reportType);
                } else {
                    try {
                        await Share.open({
                            url: fileUri,
                            type: mimetype,
                            title: `${reportType} Report`
                        });
                        if (Platform.OS !== 'android') {
                            Alert.alert('Success', `${reportType} Generated and Shared Successfully!`);
                        }
                    } catch (shareError) {
                        console.error(`${reportType} Sharing Error:`, shareError);
                        if (Platform.OS === 'android') {
                            ToastAndroid.show(`Sharing ${reportType} Failed.`, ToastAndroid.SHORT);
                        } else {
                            Alert.alert("Sharing Failed", `Error occurred while trying to share the ${reportType.toLowerCase()}.`);
                        }
                        setError("Error sharing delivery slip file.");
                    }
                }
            }
        } catch (e) {
            console.error(`${reportType} Excel Generation Error:`, e);
            if (Platform.OS === 'android') {
                ToastAndroid.show(`Failed to generate ${reportType}.`, ToastAndroid.SHORT);
            } else {
                Alert.alert("Generation Failed", `Error generating Excel ${reportType.toLowerCase()}.`);
            }
            setError("Error generating delivery slip Excel file.");
        } finally {
            setLoading(false);
        }
    };

    const createDeliverySlipDataForExcelForRoute = async (usersForRoute) => {
        const orderMap = new Map();
        const allProducts = new Set();
        const unitRegex = /(\d+\.?\d*)\s*(ML|LTR|KG|GRMS|G|GM|ML)/i;

        usersForRoute.forEach(user => {
            const order = adminOrders.find(ord => ord.customer_id === user.cust_id && ord.order_type === orderTypeFilter);
            if (order) {
                orderMap.set(user.customer_id, { 
                    name: user.name, 
                    orderId: order.id, 
                    products: [], 
                    route: user.route,
                    productCrates: {}
                });
            }
        });

        for (const customerId of orderMap.keys()) {
            const orderData = orderMap.get(customerId);
            try {
                const token = await AsyncStorage.getItem("userAuthToken");
                const url = `http://${ipAddress}:8091/order-products?orderId=${orderData.orderId}`;
                const headers = { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" };
                const productsResponse = await fetch(url, { headers });
                if (!productsResponse.ok) continue;
                const productsData = await productsResponse.json();
                
                productsData.forEach(product => {
                    const match = product.name.match(unitRegex);
                    let quantityValue = match ? parseFloat(match[1]) : 1;
                    let unit = match ? match[2].toLowerCase() : 'unit';
                    if (unit === 'grms' || unit === 'g' || unit === 'gm') unit = 'gm';
                    else if (unit === 'ltr') unit = 'ltr';
                    else if (unit === 'kg') unit = 'kg';
                    else if (unit === 'ml') unit = 'ml';

                    let baseUnitQuantity = 0;
                    if (unit === 'ml') baseUnitQuantity = (quantityValue * product.quantity) / 1000;
                    else if (unit === 'gm') baseUnitQuantity = (quantityValue * product.quantity) / 1000;
                    else if (unit === 'ltr') baseUnitQuantity = quantityValue * product.quantity;
                    else if (unit === 'kg') baseUnitQuantity = quantityValue * product.quantity;
                    else baseUnitQuantity = product.quantity;

                    const crates = Math.floor(baseUnitQuantity / 12);
                    
                    orderData.products.push(product);
                    orderData.productCrates[product.name] = crates;
                    allProducts.add(product.name);
                });
            } catch (fetchError) {
                console.error("Error fetching order products:", fetchError);
            }
        }

        const productList = Array.from(allProducts);
        console.log("Product List:", productList);
        
        const formatVerticalHeader = (text) => {
           return text
        };

        const excelData = [
            ["Delivery Slip"], 
            [`Route: ${usersForRoute[0]?.route || ''}`],
            [],
            ["Items", ...usersForRoute.map(u => formatVerticalHeader(u.name)), formatVerticalHeader("Total Crates")]
        ];

        productList.forEach(productName => {
            const productRow = [productName];
            let totalCratesForProduct = 0;
            
            usersForRoute.forEach(user => {
                const orderData = orderMap.get(user.cust_id);
                const quantity = orderData?.products?.find(p => p.name === productName)?.quantity || 0;
                productRow.push(quantity);
                
                totalCratesForProduct += orderData?.productCrates[productName] || 0;
            });
            
            productRow.push(totalCratesForProduct);
            excelData.push(productRow);
        });

        const totalsRow = ["Totals"];
        let grandTotalQuantity = 0;
        let grandTotalCrates = 0;
        
        usersForRoute.forEach(user => {
            const orderData = orderMap.get(user.customer_id);
            const customerTotal = orderData?.products?.reduce((sum, product) => sum + product.quantity, 0) || 0;
            totalsRow.push(customerTotal);
            grandTotalQuantity += customerTotal;
        });
        
        grandTotalCrates = usersForRoute.reduce((total, user) => {
            const orderData = orderMap.get(user.customer_id);
            return total + Object.values(orderData?.productCrates || {}).reduce((sum, crates) => sum + crates, 0);
        }, 0);
        
        totalsRow.push(grandTotalCrates);
        excelData.push(totalsRow);

        const customerIdRow = ["Customer ID", ...usersForRoute.map(u => u.cust_id || ""), ""];
        excelData.push(customerIdRow);

        return excelData;
    };

    const createLoadingSlipDataForExcelForRoute = async (usersForRoute) => {
        const consolidatedProducts = new Map();
        const unitRegex = /(\d+\.?\d*)\s*(ML|LTR|KG|GRMS|G|GM|ML)/i;
    
        // Process each user's orders
        for (const user of usersForRoute) {
            const order = adminOrders.find(ord => ord.customer_id === user.cust_id && ord.order_type === orderTypeFilter);
            if (order) {
                try {
                    const token = await AsyncStorage.getItem("userAuthToken");
                    const url = `http://${ipAddress}:8091/order-products?orderId=${order.id}`;
                    const headers = { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" };
                    const productsResponse = await fetch(url, { headers });
                    if (!productsResponse.ok) {
                        console.error(`Failed to fetch products for order ID ${order.id}. Status: ${productsResponse.status}`);
                        continue;
                    }
                    const productsData = await productsResponse.json();
                    productsData.forEach(product => {
                        // Extract quantity and unit
                        const match = product.name.match(unitRegex);
                        let quantityValue = 0;
                        let unit = '';
    
                        if (match) {
                            quantityValue = parseFloat(match[1]);
                            unit = match[2].toLowerCase();
                            if (unit === 'grms' || unit === 'g' || unit === 'gm') unit = 'gm';
                            else if (unit === 'ltr') unit = 'ltr';
                            else if (unit === 'kg') unit = 'kg';
                            else if (unit === 'ml') unit = 'ml';
                        } else {
                            quantityValue = 1;
                            unit = 'unit';
                        }
    
                        // Calculate base unit quantity
                        let baseUnitQuantity = 0;
                        if (unit === 'ml') baseUnitQuantity = (quantityValue * product.quantity) / 1000;
                        else if (unit === 'gm') baseUnitQuantity = (quantityValue * product.quantity) / 1000;
                        else if (unit === 'ltr') baseUnitQuantity = quantityValue * product.quantity;
                        else if (unit === 'kg') baseUnitQuantity = quantityValue * product.quantity;
                        else baseUnitQuantity = product.quantity;
    
                        // Calculate crates
                        const crates = Math.floor(baseUnitQuantity / 12);
    
                        // Consolidate product data
                        const currentProductInfo = consolidatedProducts.get(product.name);
                        if (currentProductInfo) {
                            consolidatedProducts.set(product.name, {
                                totalQuantity: currentProductInfo.totalQuantity + product.quantity,
                                category: currentProductInfo.category,
                                totalBaseUnitQuantity: currentProductInfo.totalBaseUnitQuantity + baseUnitQuantity,
                                totalCrates: currentProductInfo.totalCrates + crates,
                            });
                        } else {
                            consolidatedProducts.set(product.name, {
                                totalQuantity: product.quantity,
                                category: product.category || 'Unknown',
                                totalBaseUnitQuantity: baseUnitQuantity,
                                totalCrates: crates,
                            });
                        }
                    });
                } catch (fetchError) {
                    console.error("Error fetching order products:", fetchError);
                }
            }
        }
    
        // Prepare product list for Excel
        const productListForExcel = Array.from(consolidatedProducts.entries()).map(([productName, productInfo]) => ({
            name: productName,
            quantity: productInfo.totalQuantity,
            category: productInfo.category,
            baseUnitQuantity: productInfo.totalBaseUnitQuantity.toFixed(2),
            crates: productInfo.totalCrates
        }));
    
        // Calculate brand-wise total crates
        const brandTotalsMap = new Map();
        for (const [productName, productInfo] of consolidatedProducts.entries()) {
            const brand = productName.split(' ')[0].toUpperCase(); // Extract brand as first word
            const currentTotal = brandTotalsMap.get(brand) || 0;
            brandTotalsMap.set(brand, currentTotal + productInfo.totalCrates);
        }
        const brandTotals = Array.from(brandTotalsMap, ([brand, totalCrates]) => ({ brand, totalCrates }));
    
        // Return both product list and brand totals
        return {
            productList: productListForExcel,
            brandTotals: brandTotals
        };
    };

    const groupUsersByRoute = (usersWithOrders) => {
        const routesMap = new Map();
        usersWithOrders.forEach(user => {
            const route = user.route || 'Unrouted';
            if (!routesMap.has(route)) {
                routesMap.set(route, []);
            }
            routesMap.get(route).push(user);
        });
        return routesMap;
    };

    useEffect(() => {
        const loadData = async () => {
            setLoading(true);
            setError(null);
            try {
                const userAuthToken = await checkTokenAndRedirect(navigation);
                if (!userAuthToken) {
                    setError("User authentication token not found.");
                    setLoading(false);
                    return;
                }

                const decodedToken = jwtDecode(userAuthToken);
                const currentAdminId = decodedToken.id1;
                setAdminId(currentAdminId);

                await Promise.all([
                    fetchAssignedUsers(currentAdminId, userAuthToken),
                    fetchAdminOrders()
                ]);
            } catch (err) {
                setError("Failed to load data. Please try again.");
            } finally {
                setLoading(false);
            }
        };

        loadData();
    }, [navigation, fetchAssignedUsers, fetchAdminOrders]);

    useEffect(() => {
        if (assignedUsers.length && adminOrders.length) {
            const usersWithOrders = assignedUsers.filter(user =>
                adminOrders.some(order =>
                    order.customer_id === user.cust_id && order.order_type === orderTypeFilter
                )
            );
            setAdminUsersWithOrdersToday(usersWithOrders);
        }
    }, [assignedUsers, adminOrders, orderTypeFilter]);

    useEffect(() => {
        navigation.setOptions({
            headerRight: () => (
                <View style={{ flexDirection: 'row' }}>
                    <TouchableOpacity
                        style={{
                            marginRight: 10,
                            padding: 10,
                            borderRadius: 8,
                            backgroundColor: '#003366'
                        }}
                        onPress={async () => {
                            if (adminUsersWithOrdersToday.length > 0) {
                                const routesMap = groupUsersByRoute(adminUsersWithOrdersToday);
                                for (const [routeName, usersForRoute] of routesMap.entries()) {
                                    const loadingSlipDataForRoute = await createLoadingSlipDataForExcelForRoute(usersForRoute);
                                    await generateExcelReport(loadingSlipDataForRoute, 'Loading Slip', routeName);

                                    // Update loading slip status for each order in the route
                                    for (const user of usersForRoute) {
                                        const order = adminOrders.find(ord => ord.customer_id === user.cust_id && ord.order_type === orderTypeFilter);
                                        if (order) {
                                            try {
                                                const token = await AsyncStorage.getItem("userAuthToken");
                                                const response = await fetch(`http://${ipAddress}:8091/update-loading-slip-status`, {
                                                    method: 'POST',
                                                    headers: {
                                                        "Authorization": `Bearer ${token}`,
                                                        "Content-Type": "application/json",
                                                    },
                                                    body: JSON.stringify({ orderId: order.id })
                                                });

                                                if (!response.ok) {
                                                    console.error(`Failed to update loading slip status for order ${order.id}. Status: ${response.status}`);
                                                    Alert.alert("Error", `Failed to update loading slip status for order ${order.id}`);
                                                    continue;
                                                }

                                                const responseData = await response.json();
                                                console.log(`Loading slip status updated for order ${order.id}:`, responseData.message);
                                            } catch (error) {
                                                console.error("Error updating loading slip status:", error);
                                                Alert.alert("Error", "Failed to update loading slip status due to a network or server error.");
                                            }
                                        }
                                    }
                                }
                                Alert.alert("Slips Generated", "Loading Slips generated and statuses updated for each route.");
                            } else {
                                Alert.alert("No Orders", "No orders available to generate loading slips for the current filter.");
                            }
                        }}
                    >
                        <Text style={{ fontWeight: 'bold', color: '#fff' }}>Generate Loading Slip</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={{
                            marginRight: 15,
                            padding: 10,
                            borderRadius: 8,
                            backgroundColor: '#003366'
                        }}
                        onPress={async () => {
                            if (adminUsersWithOrdersToday.length > 0) {
                                const routesMap = groupUsersByRoute(adminUsersWithOrdersToday);
                                for (const [routeName, usersForRoute] of routesMap.entries()) {
                                    generateDeliveryExcelReport(usersForRoute, routeName);
                                }
                                Alert.alert("Slips Generated", "Delivery Slips generated for each route.");
                            } else {
                                Alert.alert("No Orders", "No orders available to generate delivery slips for the current filter.");
                            }
                        }}
                    >
                        <Text style={{ fontWeight: 'bold', color: '#fff' }}>Generate Delivery Slip</Text>
                    </TouchableOpacity>
                </View>
            ),
        });
    }, [navigation, adminOrders, adminUsersWithOrdersToday, orderTypeFilter]);
   
    // Render individual order row
  const RenderOrderItem = ({ item, index }) => {
   
    const orderForUser = adminOrders.find(order => order.customer_id === item.cust_id);
    const amount = typeof orderForUser?.amount === 'number' ? orderForUser.amount.toFixed(2) : '0.00';

    return (
      <View style={[styles.dataRow, { backgroundColor: index % 2 === 0 ? '#FFFFFF' : '#F9FAFB' }]}>
        <Text style={[styles.dataCell, { flex: 1.1 }]} accessibilityLabel={`Name: ${item?.name || 'N/A'}`}>
          {item?.name || 'N/A'}
        </Text>
        <Text style={[styles.dataCell, { flex: 1.6 }]} accessibilityLabel={`Route: ${item?.route || 'N/A'}`}>
          {item?.route || 'N/A'}
        </Text>
        <Text style={[styles.dataCell, { flex: 1.5 }]} accessibilityLabel={`Order ID: ${orderForUser?.id || 'N/A'}`}>
          {orderForUser?.id || 'N/A'}
        </Text>
        <Text
          style={[styles.dataCell, { flex: 2.1 }]}
          accessibilityLabel={`Amount: ₹${amount}`}
        >
          ₹{amount}
        </Text>
        <Text
          style={[styles.dataCell, { flex: 1.5 }]}
          accessibilityLabel={`Approval: ${orderForUser?.approve_status || 'N/A'}`}
        >
          {orderForUser?.approve_status || 'N/A'}
        </Text>
      </View>
    );
  };

  // Toggle order type (AM/PM)
  const toggleOrderType = (type) => {
    setOrderTypeFilter(type);
  };

  return (
    <View style={styles.container}>
      {/* Filter Toggle Buttons */}
      <View style={styles.filterContainer}>
        <Text style={styles.filterLabel}>Filter Order Type:</Text>
        <View style={styles.toggleContainer}>
          <TouchableOpacity
            style={[styles.toggleButton, orderTypeFilter === 'AM' && styles.toggleButtonActive]}
            onPress={() => toggleOrderType('AM')}
            accessible
            accessibilityLabel="Filter by AM orders"
          >
            <Text style={[styles.toggleText, orderTypeFilter === 'AM' && styles.toggleTextActive]}>AM</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.toggleButton, orderTypeFilter === 'PM' && styles.toggleButtonActive]}
            onPress={() => toggleOrderType('PM')}
            accessible
            accessibilityLabel="Filter by PM orders"
          >
            <Text style={[styles.toggleText, orderTypeFilter === 'PM' && styles.toggleTextActive]}>PM</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Column Headers */}
      <View style={styles.columnHeader}>
        <Text style={[styles.columnHeaderText, { flex: 1.1 }]}>Name</Text>
        <Text style={[styles.columnHeaderText, { flex: 1.6 }]}>Route</Text>
        <Text style={[styles.columnHeaderText, { flex: 1.5 }]}>Order ID</Text>
        <Text style={[styles.columnHeaderText, { flex: 2.1 }]}>Amount</Text>
        <Text style={[styles.columnHeaderText, { flex: 1.5 }]}>Approval</Text>
      </View>

      {/* Order List */}
      {loading && !adminUsersWithOrdersToday.length ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#FFFFFF" />
          <Text style={styles.loadingText}>Loading orders...</Text>
        </View>
      ) : (
        <FlatList
          data={adminUsersWithOrdersToday}
          renderItem={({ item, index }) => <RenderOrderItem item={item} index={index} />}
          keyExtractor={(item) => item.cust_id.toString()}
          ListEmptyComponent={() => (
            <View style={styles.emptyListContainer}>
              <Ionicons name="alert-circle-outline" size={40} color="#6B7280" />
              <Text style={styles.emptyListText}>No {orderTypeFilter} orders today.</Text>
            </View>
          )}
        />
      )}

      {/* Loading Overlay for Generating Slip */}
      {loading && adminUsersWithOrdersToday.length > 0 && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#FFFFFF" />
          <Text style={styles.loadingText}>Generating Slip...</Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#E6E9EF', // Light blue-gray background
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
    fontSize: 16,
    fontWeight: '600',
    color: '#003366', // Deep blue
    marginRight: 16,
  },
  toggleContainer: {
    flexDirection: 'row',
    flex: 0.4,
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#004d99', // Accent blue
  },
  toggleButton: {
    flex: 1,
    paddingVertical: 10,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  toggleButtonActive: {
    backgroundColor: '#003366', // Deep blue when active
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
    backgroundColor: '#003366', // Deep blue header
    borderRadius: 8,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  columnHeaderText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF', // White text on deep blue
    textAlign: 'center',
  },
  dataRow: {
    flexDirection: 'row',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#D6DEEB', // Light blue-gray border
  },
  dataCell: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1F2937', // Dark gray for readability
    textAlign: 'center',
  },
  emptyListContainer: {
    alignItems: 'center',
    marginTop: 32,
  },
  emptyListText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#6B7280', // Muted gray
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
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF', // White on overlay
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 51, 102, 0.7)', // Deep blue tint
  },
});
export default LoadingSlipPage;