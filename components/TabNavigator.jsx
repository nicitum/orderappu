import React, { useEffect, useState } from "react";
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useNavigation } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { jwtDecode } from 'jwt-decode';
import { LICENSE_NO } from './config'; // Import the license number
import MaterialCommunityIcons from "react-native-vector-icons/MaterialCommunityIcons";
import { View, Text, StyleSheet } from "react-native";
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFontScale } from '../App';

import CustomerStack from './Customer/CustomerStack';
import CatalogueStack from './Customer/CatalogueStack';
import ReportsCustomerStack from './Customer/ReportsCustomerStack';
import AdminStack from './Admin/AdminStack';
import ReportsStack from './Admin/ReportsStack';
import ProfileStack from "./Profile/ProfileStack";

import TransactionCustomer from './Customer/TransactionCustomer';



import OwnerStack from './Owner/OwnerStack';
import HomeAdmin from './Admin/HomeAdmin';
import ProductsComponent from './Owner/ProductList';
import OwnerHomeStack from './Owner/OwnerHomeStack';
import OwnerProductsStack from './Owner/OwnerProductsStack';
import TransactionsOwnerStack from './Owner/TransactionsOwnerStack';
import ReportsOwnerStack from './Owner/ReportsOwnerStack';

const Tab = createBottomTabNavigator();

const TabNavigator = () => {
    const { getScaledSize } = useFontScale();
    const [isAdmin, setIsAdmin] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [isSuperAdmin, setIsSuperAdmin] = useState(false);
    const [isUser, setIsUser] = useState(false);
    const navigation = useNavigation();

    const checkClientStatus = async () => {
        try {
            const clientStatusResponse = await fetch(`http://147.93.110.150:3001/api/client_status/${LICENSE_NO}`, {
                method: "GET",
                headers: { "Content-Type": "application/json" }
            });
            
            const clientStatusData = await clientStatusResponse.json();
            
            if (clientStatusResponse.ok && clientStatusData.success && clientStatusData.data.length) {
                if (clientStatusData.data[0].status !== "Active") {
                    await AsyncStorage.removeItem("userAuthToken");
                    navigation.replace("Login");
                }
            } else {
                // API error: do NOT log out, maybe show a warning/toast
                // Optionally: set a state to show a warning in the UI
                console.warn("Could not verify client status, but not logging out.");
            }
        } catch (error) {
            // Network or other error: do NOT log out
            console.warn("Error checking client status, but not logging out:", error);
        }
    };

    useEffect(() => {
        // Check status when component mounts
        checkClientStatus();
        // Set up interval to check every 30 seconds
        const interval = setInterval(checkClientStatus, 30000);
        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        const checkUserRole = async () => {
            setIsLoading(true);
            const userAuthToken = await AsyncStorage.getItem("userAuthToken");

            if (userAuthToken) {
                try {
                    const decodedToken = jwtDecode(userAuthToken);
                    console.log("User role detected:", decodedToken.role);
                    if (decodedToken.role === "admin") {
                        setIsAdmin(true);
                        setIsSuperAdmin(false);
                        setIsUser(false);
                    } else if (decodedToken.role === "superadmin" || decodedToken.role === "owner") {
                        setIsAdmin(true);
                        setIsSuperAdmin(true);
                        setIsUser(false);
                    } else {
                        setIsAdmin(false);
                        setIsSuperAdmin(false);
                        setIsUser(true);
                    }
                } catch (error) {
                    console.error("Token verification error:", error);
                    setIsAdmin(false);
                    setIsSuperAdmin(false);
                    setIsUser(false);
                }
            } else {
                setIsAdmin(false);
                setIsSuperAdmin(false);
                setIsUser(false);
            }
            setIsLoading(false);
        };
        checkUserRole();
    }, []);

    if (isLoading) {
        return (
            <View style={styles.loadingContainer}>
                <Text style={[styles.loadingText, { fontSize: getScaledSize(16) }]}>Loading...</Text>
            </View>
        );
    }

    return (
        <SafeAreaView style={{ flex: 1 }} edges={["bottom"]}>
        <Tab.Navigator
            screenOptions={{
                headerShown: false,
                tabBarActiveTintColor: "#003366", // Deep blue theme
                tabBarInactiveTintColor: "#8A939C", // Softer gray for inactive
                tabBarStyle: styles.tabBar, // Custom tab bar style
                tabBarLabelStyle: styles.tabLabel, // Custom label style
            }}
        >
            {isSuperAdmin ? (
                <>
                    <Tab.Screen
                        name="Home"
                        component={OwnerHomeStack}
                        options={{
                            tabBarIcon: ({ color, size }) => (
                                <MaterialCommunityIcons name="home-outline" size={size} color={color} />
                            ),
                        }}
                    />
                    <Tab.Screen
                        name="Products"
                        component={OwnerProductsStack}
                        options={{
                            tabBarIcon: ({ color, size }) => (
                                <MaterialCommunityIcons name="view-grid-outline" size={size} color={color} />
                            ),
                            headerShown: true,
                            headerTitle: 'Products',
                        }}
                    />
                    <Tab.Screen
                        name="Transactions"
                        component={TransactionsOwnerStack}
                        options={{
                            tabBarIcon: ({ color, size }) => (
                                <MaterialCommunityIcons name="swap-horizontal" size={size} color={color} />
                            ),
                            headerShown: true,
                            headerTitle: 'Transactions',
                        }}
                    />
                    <Tab.Screen
                        name="Reports"
                        component={ReportsOwnerStack}
                        options={{
                            tabBarIcon: ({ color, size }) => (
                                <MaterialCommunityIcons name="chart-line" size={size} color={color} />
                            ),
                            headerShown: true,
                            headerTitle: 'Reports',
                        }}
                        listeners={({ navigation }) => ({
                            tabPress: (e) => {
                                // Reset the Reports stack to show ReportsOwner first
                                navigation.navigate('Reports', { screen: 'ReportsOwner' });
                            },
                        })}
                    />
                    <Tab.Screen
                        name="Profile"
                        component={ProfileStack}
                        options={{
                            tabBarIcon: ({ color, size }) => (
                                <MaterialCommunityIcons name="account-outline" size={size} color={color} />
                            ),
                            headerShown: true,
                            headerTitle: 'Profile',
                        }}
                    />
                </>
            ) : isAdmin ? (
                <>
                    <Tab.Screen
                        name="Home"
                        component={HomeAdmin}
                        options={{
                            tabBarIcon: ({ color, size }) => (
                                <MaterialCommunityIcons name="home-outline" size={size} color={color} />
                            ),
                        }}
                    />
                    <Tab.Screen
                        name="Transactions"
                        component={AdminStack}
                        options={{
                            tabBarIcon: ({ color, size }) => (
                                <MaterialCommunityIcons name="swap-horizontal" size={size} color={color} />
                            ),
                            headerShown: true,
                            headerTitle: 'Transactions',
                        }}
                    />
                    <Tab.Screen
                        name="Reports"
                        component={ReportsStack}
                        options={{
                            tabBarIcon: ({ color, size }) => (
                                <MaterialCommunityIcons name="chart-line" size={size} color={color} />
                            ),
                            headerShown: true,
                            headerTitle: 'Reports',
                        }}
                    />
                    <Tab.Screen
                        name="Profile"
                        component={ProfileStack}
                        options={{
                            tabBarIcon: ({ color, size }) => (
                                <MaterialCommunityIcons name="account-outline" size={size} color={color} />
                            ),
                            headerShown: true,
                            headerTitle: 'Profile',
                        }}
                    />
                </>
            ) : isUser ? (
                <>
                    <Tab.Screen
                        name="Home"
                        component={CustomerStack}
                        options={{
                            tabBarIcon: ({ color, size }) => (
                                <MaterialCommunityIcons name="home-outline" size={size} color={color} />
                            ),
                        }}
                    />
                    <Tab.Screen
                        name="Catalogue"
                        component={CatalogueStack}
                        options={{
                            tabBarIcon: ({ color, size }) => (
                                <MaterialCommunityIcons name="view-grid-outline" size={size} color={color} />
                            ),
                            headerShown: true,
                            headerTitle: 'Catalogue',
                        }}
                    />
                    <Tab.Screen
                        name="Transactions"
                        component={TransactionCustomer}
                        options={{
                            tabBarIcon: ({ color, size }) => (
                                <MaterialCommunityIcons name="swap-horizontal" size={size} color={color} />
                            ),
                            headerShown: true,
                            headerTitle: 'Transactions',
                        }}
                    />
                    <Tab.Screen
                        name="Reports"
                        component={ReportsCustomerStack}
                        options={{
                            tabBarIcon: ({ color, size }) => (
                                <MaterialCommunityIcons name="file-document-outline" size={size} color={color} />
                            ),
                            headerShown: true,
                            headerTitle: 'Reports',
                        }}
                    />
                    <Tab.Screen
                        name="Profile"
                        component={ProfileStack}
                        options={{
                            tabBarIcon: ({ color, size }) => (
                                <MaterialCommunityIcons name="account-outline" size={size} color={color} />
                            ),
                        }}
                    />
                </>
            ) : null}
        </Tab.Navigator>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    loadingContainer: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: "#F5F6F5", // Light neutral background
    },
    loadingText: {
        color: "#003366",
        fontWeight: "500",
    },
    tabBar: {
        backgroundColor: "#FFFFFF", // White background for a clean look
        borderTopWidth: 1,
        borderTopColor: "#E0E4E7", // Subtle border
        paddingVertical: 5,
        height: 60,
    },
    tabLabel: {
        fontWeight: "600",
        marginBottom: 5,
    },
    header: {
        backgroundColor: "#003366", // Deep blue header
    },
    headerTitle: {
        color: "#FFFFFF", // White text for contrast
        fontWeight: "600",
    },
});

export default TabNavigator;