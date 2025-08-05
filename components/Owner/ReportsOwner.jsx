import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView, StatusBar, Platform, ScrollView } from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useNavigation } from '@react-navigation/native';

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

const ReportsOwner = () => {
  const navigation = useNavigation();

  const handleOrderHistory = () => {
    navigation.navigate('OrderHistoryOwner');
  };

  const handleSalesAnalytics = () => {
    // TODO: Implement Sales Analytics
    console.log('Sales Analytics coming soon');
  };

  const handleOrderStatus = () => {
    navigation.navigate('OwnerOrderStatus');
  };


  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar backgroundColor={COLORS.primary} barStyle="light-content" />
      
      
      
      {/* Content */}
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.content}>
          
          {/* Order History Card */}
          <TouchableOpacity style={styles.card} onPress={handleOrderHistory} activeOpacity={0.8}>
            <View style={styles.cardHeader}>
              <View style={[styles.iconContainer, { backgroundColor: '#FEF3C7' }]}>
                <MaterialIcons name="history" size={24} color="#F59E0B" />
              </View>
            </View>
            <Text style={styles.cardTitle}>Order History</Text>
            <Text style={styles.cardSubtitle}>View all order history and reports</Text>
            <View style={styles.cardFooter}>
              <Text style={styles.cardAction}>View history</Text>
              <Ionicons name="arrow-forward" size={16} color={COLORS.text.secondary} />
            </View>
          </TouchableOpacity>

          {/* Order Status Card */}
          <TouchableOpacity style={styles.card} onPress={handleOrderStatus} activeOpacity={0.8}>
            <View style={styles.cardHeader}>
              <View style={[styles.iconContainer, { backgroundColor: '#DBEAFE' }]}>
                <MaterialIcons name="assessment" size={24} color="#3B82F6" />
              </View>
            </View>
            <Text style={styles.cardTitle}>Order Status</Text>
            <Text style={styles.cardSubtitle}>Track order approval and delivery status</Text>
            <View style={styles.cardFooter}>
              <Text style={styles.cardAction}>View status</Text>
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
    fontSize: 24,
    fontWeight: '700',
    color: COLORS.text.light,
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
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
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.text.primary,
    marginBottom: 4,
  },
  cardSubtitle: {
    fontSize: 12,
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
    fontSize: 12,
    fontWeight: '500',
    color: COLORS.text.secondary,
  },
});

export default ReportsOwner; 