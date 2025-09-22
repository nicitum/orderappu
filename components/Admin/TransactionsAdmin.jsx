import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView, StatusBar, Platform, ScrollView } from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useNavigation } from '@react-navigation/native';
import { useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ipAddress } from '../../services/urls';
import { useFontScale } from '../../App';

const COLORS = {
  primary: "#003366",
  primaryLight: "#004488",
  primaryDark: "#002244",
  secondary: "#10B981",
  accent: "#F59E0B",
  success: "#059669",
  error: "#DC2626",
  warning: "#D97706",
  background: "#F8FAFC",
  surface: "#FFFFFF",
  text: {
    primary: "#1F2937",
    secondary: "#6B7280",
    tertiary: "#9CA3AF",
    light: "#FFFFFF",
  },
  border: "#E5E7EB",
  divider: "#F3F4F6",
  card: {
    background: "#FFFFFF",
    shadow: "rgba(0, 0, 0, 0.08)",
  },
};

const TransactionsAdmin = () => {
  const { getScaledSize } = useFontScale();
  const navigation = useNavigation();
  const [allowPlaceOrder, setAllowPlaceOrder] = useState(false);
  const [allowInvoicing, setAllowInvoicing] = useState(false);
  const [allowOrderAcceptance, setAllowOrderAcceptance] = useState(false);
  const [allowEditOrder, setAllowEditOrder] = useState(false);

  useFocusEffect(
    React.useCallback(() => {
      fetchUserPermissions();
    }, [])
  );

  const fetchUserPermissions = async () => {
    try {
      const token = await AsyncStorage.getItem('userAuthToken');
      if (!token) return;

      const response = await fetch(`http://${ipAddress}:8091/userDetails`, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        }
      });

      if (response.ok) {
        const data = await response.json();
        const user = data.user;
        
        // Set allowPlaceOrder based on userDetails API response
        setAllowPlaceOrder(user.allow_place_order === 'Yes');
        // Set allowInvoicing based on userDetails API response
        setAllowInvoicing(user.allow_invoicing === 'Yes');
        // Set allowOrderAcceptance based on userDetails API response
        setAllowOrderAcceptance(user.allow_order_acceptance === 'Yes');
        // Set allowEditOrder based on userDetails API response
        setAllowEditOrder(user.allow_edit_order === 'Yes');
      } else {
        setAllowPlaceOrder(false);
        setAllowInvoicing(false);
        setAllowOrderAcceptance(false);
        setAllowEditOrder(false);
      }
    } catch (error) {
      console.error('Error fetching user details:', error);
      // Default to false if API fails
      setAllowPlaceOrder(false);
      setAllowInvoicing(false);
      setAllowOrderAcceptance(false);
      setAllowEditOrder(false);
    }
  };

  const handlePlaceOrder = () => {
    navigation.navigate('PlaceOrderAdmin');
  };

  const handleInvoice = () => {
    navigation.navigate('InvoicePage');
  };

  const handleOrderAcceptance = () => {
    navigation.navigate('OrderAcceptAdmin');
  };

  const handleOrderUpdate = () => {
    navigation.navigate('AdminOrderUpdate');
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar backgroundColor={COLORS.primary} barStyle="light-content" />
      
     
      
      {/* Content */}
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.content}>
          
          {/* Check if any transaction options are enabled */}
          {!allowOrderAcceptance && !allowEditOrder && !allowPlaceOrder && !allowInvoicing ? (
            <View style={styles.noOptionsContainer}>
              <MaterialIcons name="block" size={60} color={COLORS.text.secondary} />
              <Text style={[styles.noOptionsTitle, { fontSize: getScaledSize(18) }]}>No Transaction Options Available</Text>
              <Text style={[styles.noOptionsSubtitle, { fontSize: getScaledSize(14) }]}>Please contact your Owner to get access to transaction features.</Text>
            </View>
          ) : (
            <>
          {/* Order Acceptance Card */}
          {allowOrderAcceptance && (
            <TouchableOpacity style={styles.card} onPress={handleOrderAcceptance} activeOpacity={0.8}>
              <View style={styles.cardHeader}>
                <View style={[styles.iconContainer, { backgroundColor: '#DBEAFE' }]}>
                  <MaterialIcons name="assignment-turned-in" size={24} color="#2563EB" />
                </View>
              </View>
              <Text style={[styles.cardTitle, { fontSize: getScaledSize(15) }]}>Order Acceptance</Text>
              <Text style={[styles.cardSubtitle, { fontSize: getScaledSize(12) }]}>View and manage order acceptance</Text>
              <View style={styles.cardFooter}>
                <Text style={[styles.cardAction, { fontSize: getScaledSize(12) }]}>Go to status</Text>
                <Ionicons name="arrow-forward" size={16} color={COLORS.text.secondary} />
              </View>
            </TouchableOpacity>
          )}

          {/* Order Update Card */}
          {allowEditOrder && (
            <TouchableOpacity style={styles.card} onPress={handleOrderUpdate} activeOpacity={0.8}>
              <View style={styles.cardHeader}>
                <View style={[styles.iconContainer, { backgroundColor: '#FEF3C7' }]}>
                  <MaterialIcons name="edit" size={24} color="#F59E0B" />
                </View>
              </View>
              <Text style={[styles.cardTitle, { fontSize: getScaledSize(15) }]}>Update Orders</Text>
              <Text style={[styles.cardSubtitle, { fontSize: getScaledSize(12) }]}>Edit and modify existing orders</Text>
              <View style={styles.cardFooter}>
                <Text style={[styles.cardAction, { fontSize: getScaledSize(12) }]}>Manage orders</Text>
                <Ionicons name="arrow-forward" size={16} color={COLORS.text.secondary} />
              </View>
            </TouchableOpacity>
          )}

          {/* Place Order Card - Only show if user has permission */}
          {allowPlaceOrder && (
            <TouchableOpacity style={styles.card} onPress={handlePlaceOrder} activeOpacity={0.8}>
              <View style={styles.cardHeader}>
                <View style={[styles.iconContainer, { backgroundColor: '#EFF6FF' }]}>
                  <MaterialIcons name="playlist-add" size={24} color="#3B82F6" />
                </View>
              </View>
              <Text style={[styles.cardTitle, { fontSize: getScaledSize(15) }]}>Place Order</Text>
              <Text style={[styles.cardSubtitle, { fontSize: getScaledSize(12) }]}>Create new orders for customers</Text>
              <View style={styles.cardFooter}>
                <Text style={[styles.cardAction, { fontSize: getScaledSize(12) }]}>Tap to start</Text>
                <Ionicons name="arrow-forward" size={16} color={COLORS.text.secondary} />
              </View>
            </TouchableOpacity>
          )}

          {/* Invoice Card */}
          {allowInvoicing && (
            <TouchableOpacity style={styles.card} onPress={handleInvoice} activeOpacity={0.8}>
              <View style={styles.cardHeader}>
                <View style={[styles.iconContainer, { backgroundColor: '#F0FDF4' }]}>
                  <MaterialIcons name="receipt" size={24} color="#10B981" />
                </View>
              </View>
              <Text style={[styles.cardTitle, { fontSize: getScaledSize(15) }]}>Invoices</Text>
              <Text style={[styles.cardSubtitle, { fontSize: getScaledSize(12) }]}>View and manage invoices</Text>
              <View style={styles.cardFooter}>
                <Text style={[styles.cardAction, { fontSize: getScaledSize(12) }]}>View all</Text>
                <Ionicons name="arrow-forward" size={16} color={COLORS.text.secondary} />
              </View>
            </TouchableOpacity>
          )}
            </>
          )}

        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.primary,
  },
  header: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 20,
    paddingVertical: 20,
  },
  headerContent: {
    alignItems: 'center',
  },
  headerTitle: {
    fontWeight: '700',
    color: COLORS.text.light,
    marginBottom: 4,
  },
  headerSubtitle: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontWeight: '400',
  },
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    padding: 20,
  },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
    ...Platform.select({
      ios: {
        shadowColor: COLORS.card.shadow,
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.06,
        shadowRadius: 6,
      },
      android: {
        elevation: 1,
      },
    }),
  },
  cardHeader: {
    marginBottom: 10,
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },

  cardTitle: {
    fontWeight: '600',
    color: COLORS.text.primary,
    marginBottom: 4,
  },
  cardSubtitle: {
    color: COLORS.text.secondary,
    lineHeight: 16,
    marginBottom: 10,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  cardAction: {
    fontWeight: '500',
    color: COLORS.text.secondary,
  },
  noOptionsContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  noOptionsTitle: {
    fontWeight: '600',
    color: COLORS.text.primary,
    marginTop: 20,
    marginBottom: 8,
    textAlign: 'center',
  },
  noOptionsSubtitle: {
    color: COLORS.text.secondary,
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 20,
  },
});

export default TransactionsAdmin; 