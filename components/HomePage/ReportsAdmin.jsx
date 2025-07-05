import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView, StatusBar, Platform } from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
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
  background: "#F3F4F6",
  surface: "#FFFFFF",
  text: {
    primary: "#111827",
    secondary: "#4B5563",
    tertiary: "#9CA3AF",
    light: "#FFFFFF",
  },
  border: "#E5E7EB",
  divider: "#F3F4F6",
  card: {
    background: "#FFFFFF",
    shadow: "rgba(0, 0, 0, 0.1)",
  },
};

const ReportsAdmin = () => {
  const navigation = useNavigation();

  const handleOrderHistory = () => {
    navigation.navigate('AdminOrderHistory');
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar backgroundColor={COLORS.primary} barStyle="light-content" />
      <View style={[styles.header, Platform.OS === 'android' ? { paddingTop: StatusBar.currentHeight || 24 } : {}]}>
        <Text style={styles.headerTitle}>Reports</Text>
      </View>
      
      <View style={styles.container}>
        <View style={styles.optionsContainer}>
          <TouchableOpacity style={styles.optionCard} onPress={handleOrderHistory}>
            <View style={styles.optionIcon}>
              <MaterialIcons name="history" size={32} color={COLORS.primary} />
            </View>
            <Text style={styles.optionTitle}>Order History</Text>
            <Text style={styles.optionSubtitle}>View all order history and reports</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.optionCard}>
            <View style={styles.optionIcon}>
              <MaterialIcons name="analytics" size={32} color={COLORS.primary} />
            </View>
            <Text style={styles.optionTitle}>Sales Analytics</Text>
            <Text style={styles.optionSubtitle}>Coming Soon</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.optionCard}>
            <View style={styles.optionIcon}>
              <MaterialIcons name="assessment" size={32} color={COLORS.primary} />
            </View>
            <Text style={styles.optionTitle}>Performance Reports</Text>
            <Text style={styles.optionSubtitle}>Coming Soon</Text>
          </TouchableOpacity>
        </View>
      </View>
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
    paddingHorizontal: 16,
    paddingVertical: 16,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.text.light,
  },
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    padding: 16,
  },
  optionsContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  optionCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 24,
    marginBottom: 16,
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: COLORS.card.shadow,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  optionIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  optionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.text.primary,
    marginBottom: 8,
  },
  optionSubtitle: {
    fontSize: 14,
    color: COLORS.text.secondary,
    textAlign: 'center',
  },
});

export default ReportsAdmin; 