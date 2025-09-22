import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView, StatusBar, Platform, ScrollView } from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useNavigation } from '@react-navigation/native';
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

const TransactionsOwner = () => {
  const { getScaledSize } = useFontScale();
  const navigation = useNavigation();

  const handlePlaceOrder = () => {
    navigation.navigate('PlaceOrderOwner');
  };

  const handleInvoice = () => {
    navigation.navigate('InvoiceOwner');
  };

  const handleOrderAcceptance = () => {
    navigation.navigate('OrderAcceptOwner');
  };

  const handleOrderUpdate = () => {
    navigation.navigate('OwnerOrderUpdate');
  };

  const handleInvoiceDirect = () => {
    navigation.navigate('InvoiceDirect');
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar backgroundColor={COLORS.primary} barStyle="light-content" />
      
     
      
      {/* Content */}
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.content}>
          
          {/* Order Acceptance Card */}
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

          {/* Place Order Card */}
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

          {/* Invoice Card */}
          <TouchableOpacity style={styles.card} onPress={handleInvoice} activeOpacity={0.8}>
            <View style={styles.cardHeader}>
              <View style={[styles.iconContainer, { backgroundColor: '#F0FDF4' }]}>
                <MaterialIcons name="receipt" size={24} color="#10B981" />
              </View>
            </View>
            <Text style={[styles.cardTitle, { fontSize: getScaledSize(15) }]}>Invoice Against Orders</Text>
            <Text style={[styles.cardSubtitle, { fontSize: getScaledSize(12) }]}>View and manage invoices</Text>
            <View style={styles.cardFooter}>
              <Text style={[styles.cardAction, { fontSize: getScaledSize(12) }]}>View all</Text>
              <Ionicons name="arrow-forward" size={16} color={COLORS.text.secondary} />
            </View>
          </TouchableOpacity>

          {/* Direct Invoice Card */}
          <TouchableOpacity style={styles.card} onPress={handleInvoiceDirect} activeOpacity={0.8}>
            <View style={styles.cardHeader}>
              <View style={[styles.iconContainer, { backgroundColor: '#FEF3C7' }]}>
                <MaterialIcons name="receipt-long" size={24} color="#F59E0B" />
              </View>
            </View>
            <Text style={[styles.cardTitle, { fontSize: getScaledSize(15) }]}>Direct Invoice</Text>
            <Text style={[styles.cardSubtitle, { fontSize: getScaledSize(12) }]}>Select customer for direct invoice access</Text>
            <View style={styles.cardFooter}>
              <Text style={[styles.cardAction, { fontSize: getScaledSize(12) }]}>Select customer</Text>
              <Ionicons name="arrow-forward" size={16} color={COLORS.text.secondary} />
            </View>
          </TouchableOpacity>

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
});

export default TransactionsOwner;