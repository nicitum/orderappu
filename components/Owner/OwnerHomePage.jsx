import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  Image,
  ScrollView,
  Alert,
  ActivityIndicator,
  TouchableOpacity,
  Animated,
} from "react-native";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import { checkTokenAndRedirect } from "../../services/auth";
import { jwtDecode } from 'jwt-decode';
import { ipAddress } from "../../services/urls";
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { Button } from 'react-native-paper';
import { useFontScale } from '../../App';
// import TestNotification from '../TestNotification';

const COLORS = {
  primary: '#003366',
  secondary: '#004d99',
  accent: '#0066cc',
  background: '#f5f7fa',
  surface: '#ffffff',
  text: {
    primary: '#1a1a1a',
    secondary: '#666666',
    light: '#ffffff',
  },
  success: '#4caf50',
  warning: '#ff9800',
  error: '#f44336',
};

const OwnerHomePage = () => {
  const { getScaledSize } = useFontScale();
  const [userDetails, setUserDetails] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigation = useNavigation();

  // Fetch user details from API
  const userDetailsData1 = useCallback(async () => {
    try {
      const token = await checkTokenAndRedirect(navigation);
      const response = await fetch(`http://${ipAddress}:8091/userDetails`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });
      const userGetResponse = await response.json();
      if (!response.ok || !userGetResponse.status) {
        const message = userGetResponse.message || "Something went wrong";
        Alert.alert("Failed", message);
        setIsLoading(false);
        setError(message);
        return null;
      }

      const decodedToken = jwtDecode(token);
      const userDetails = {
        customerName: userGetResponse.user.name,
        customerID: userGetResponse.user.customer_id,
        route: userGetResponse.user.route,
        role: decodedToken.role,
      };

      return userDetails;
    } catch (err) {
      console.error("User details fetch error:", err);
      setIsLoading(false);
      setError("An error occurred while fetching user details.");
      Alert.alert("Error", "An error occurred. Please try again.");
      return null;
    }
  }, [navigation]);

  // Fetch data and update state
  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    const userData = await userDetailsData1();
    if (userData) {
      setUserDetails(userData);
    }
    setIsLoading(false);
  }, [userDetailsData1]);

  useFocusEffect(
    useCallback(() => {
      const fetchDataAsync = async () => await fetchData();
      fetchDataAsync();
    }, [fetchData])
  );

  const { customerName, role } = userDetails || {};

  return (
    <View style={styles.mainContainer}>
      {/* Enhanced Header */}
      <Animated.View style={styles.header}>
        <View style={styles.headerContent}>
          <Image source={require("../../assets/logo.jpg")} style={styles.logo} resizeMode="contain" />
          <View style={styles.headerTextContainer}>
            <Text style={[styles.headerTitle, { fontSize: getScaledSize(24) }]}>Order Appu</Text>
            <Text style={[styles.headerSubtitle, { fontSize: getScaledSize(14) }]}>Owner's Dashboard</Text>
          </View>
        </View>
      </Animated.View>

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={[styles.loadingText, { fontSize: getScaledSize(16) }]}>Loading dashboard data...</Text>
        </View>
      ) : error ? (
        <View style={styles.errorContainer}>
          <MaterialCommunityIcons name="alert-circle-outline" size={48} color={COLORS.error} />
          <Text style={[styles.errorText, { fontSize: getScaledSize(16) }]}>Error: {error}</Text>
          <Button
            mode="contained"
            onPress={fetchData}
            style={styles.retryButton}
            labelStyle={[styles.retryButtonText, { fontSize: getScaledSize(14) }]}
          >
            Retry
          </Button>
        </View>
      ) : (
        <ScrollView style={styles.scrollContent}>
          {/* Welcome Section */}
          <View style={styles.welcomeSection}>
            <Text style={[styles.welcomeText, { fontSize: getScaledSize(20) }]}>
              Welcome back, {customerName}!
            </Text>
            <Text style={[styles.roleText, { fontSize: getScaledSize(14) }]}>
              Role: {role}
            </Text>
          </View>

          {/* Test Notification Section - Commented out as requested */}
          {/* 
          <View style={styles.testSection}>
            <Text style={[styles.sectionTitle, { fontSize: getScaledSize(18) }]}>
              Push Notification Test
            </Text>
            <Text style={[styles.sectionDescription, { fontSize: getScaledSize(14) }]}>
              Test the push notification system to ensure it's working properly
            </Text>
            <TestNotification />
          </View>
          */}
        </ScrollView>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  mainContainer: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    backgroundColor: COLORS.primary,
    paddingVertical: 20,
    paddingHorizontal: 16,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logo: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: COLORS.surface,
  },
  headerTextContainer: {
    marginLeft: 12,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.text.light,
  },
  headerSubtitle: {
    fontSize: 14,
    color: COLORS.text.light,
    opacity: 0.8,
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
    color: COLORS.primary,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 16,
    color: COLORS.error,
    textAlign: 'center',
    marginTop: 12,
  },
  retryButton: {
    marginTop: 16,
    backgroundColor: COLORS.primary,
  },
  retryButtonText: {
    color: COLORS.text.light,
    fontWeight: '500',
  },
  scrollContent: {
    padding: 16,
  },
  welcomeSection: {
    backgroundColor: COLORS.surface,
    padding: 20,
    borderRadius: 12,
    marginBottom: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  welcomeText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.text.primary,
    marginBottom: 4,
  },
  roleText: {
    fontSize: 14,
    color: COLORS.text.secondary,
    fontWeight: '500',
  },
  // testSection: {
  //   backgroundColor: COLORS.surface,
  //   padding: 20,
  //   borderRadius: 12,
  //   marginBottom: 16,
  //   elevation: 2,
  //   shadowColor: '#000',
  //   shadowOffset: { width: 0, height: 1 },
  //   shadowOpacity: 0.1,
  //   shadowRadius: 2,
  // },
  // sectionTitle: {
  //   fontSize: 18,
  //   fontWeight: 'bold',
  //   color: COLORS.text.primary,
  //   marginBottom: 8,
  // },
  // sectionDescription: {
  //   fontSize: 14,
  //   color: COLORS.text.secondary,
  //   marginBottom: 16,
  //   lineHeight: 20,
  // },
});

export default OwnerHomePage;