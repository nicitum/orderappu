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

          {/* Sales Analytics Card */}
          <TouchableOpacity style={styles.card} onPress={handleSalesAnalytics} activeOpacity={0.8}>
            <View style={styles.cardHeader}>
              <View style={[styles.iconContainer, { backgroundColor: '#F3E8FF' }]}>
                <MaterialIcons name="analytics" size={24} color="#8B5CF6" />
              </View>
            </View>
            <Text style={styles.cardTitle}>Sales Analytics</Text>
            <Text style={styles.cardSubtitle}>Detailed sales reports and insights</Text>
            <View style={styles.cardFooter}>
              <Text style={styles.cardAction}>Coming soon</Text>
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
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    ...Platform.select({
      ios: {
        shadowColor: COLORS.card.shadow,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.12,
        shadowRadius: 12,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  cardHeader: {
    marginBottom: 16,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.text.primary,
    marginBottom: 8,
  },
  cardSubtitle: {
    fontSize: 14,
    color: COLORS.text.secondary,
    lineHeight: 20,
    marginBottom: 16,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  cardAction: {
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.text.secondary,
  },
});

export default ReportsOwner; 