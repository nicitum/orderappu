import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Platform,
  PermissionsAndroid,
} from 'react-native';
import Geolocation from '@react-native-community/geolocation';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { jwtDecode } from 'jwt-decode';
import { ipAddress } from '../../services/urls';

const OrderTrackingCustomerScreen = () => {
  const [isUpdating, setIsUpdating] = useState(false);

  const requestLocationPermission = async () => {
    if (Platform.OS === 'ios') {
      Geolocation.requestAuthorization();
      return true;
    }

    try {
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        {
          title: "Location Permission",
          message: "This app needs access to your location to update your position.",
          buttonNeutral: "Ask Me Later",
          buttonNegative: "Cancel",
          buttonPositive: "OK"
        }
      );
      return granted === PermissionsAndroid.RESULTS.GRANTED;
    } catch (err) {
      console.warn(err);
      return false;
    }
  };

  const updateLocation = async () => {
    try {
      // 1. Get permission
      const hasPermission = await requestLocationPermission();
      if (!hasPermission) {
        Alert.alert('Error', 'Location permission is required to update your location');
        return;
      }

      setIsUpdating(true);

      // 2. Get location
      Geolocation.getCurrentPosition(
        async (position) => {
          const { latitude, longitude } = position.coords;
          
          // Validate coordinates
          if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
            Alert.alert('Error', 'Invalid location coordinates received');
            return;
          }

          // 3. Get user token and ID
          const token = await AsyncStorage.getItem('userAuthToken');
          if (!token) {
            Alert.alert('Error', 'Authentication token not found');
            return;
          }

          const { id: customer_id } = jwtDecode(token);
          if (!customer_id) {
            Alert.alert('Error', 'Customer ID not found in token');
            return;
          }

          // 4. Call API
          const response = await fetch(`http://${ipAddress}:8091/update-user-location`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
              customer_id,
              latitude,
              longitude
            })
          });

          // Log the raw response for debugging
          const responseText = await response.text();
          console.log('API Response:', responseText);

          let data;
          try {
            data = JSON.parse(responseText);
          } catch (parseError) {
            console.error('Failed to parse API response:', parseError);
            console.error('Raw response:', responseText);
            throw new Error('Invalid response from server');
          }

          if (!response.ok) {
            throw new Error(data.message || 'Failed to update location');
          }

          if (data.success) {
            Alert.alert('Success', 'Location updated successfully');
          } else {
            Alert.alert('Error', data.message || 'Failed to update location');
          }
        },
        (error) => {
          console.error('Location error:', error);
          let message = 'Failed to get your location';
          if (error && error.message && error.message.includes('No location provider available')) {
            message = 'No location provider available. Please enable location services on your device.';
          }
          Alert.alert('Error', message);
        },
        { 
          enableHighAccuracy: true,
          timeout: 15000,
          maximumAge: 10000
        }
      );
    } catch (err) {
      console.error('Location update error:', err);
      Alert.alert('Error', err.message || 'Failed to update location');
    } finally {
      setIsUpdating(false);
    }
  };

  // Ask permission on load
  useEffect(() => {
    requestLocationPermission();
  }, []);

  return (
    <View style={styles.container}>
      <TouchableOpacity 
        style={[styles.button, isUpdating && styles.buttonDisabled]} 
        onPress={updateLocation}
        disabled={isUpdating}
      >
        <Text style={styles.buttonText}>
          {isUpdating ? 'Updating...' : 'Update Location'}
        </Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  button: {
    backgroundColor: '#007AFF',
    padding: 15,
    borderRadius: 8,
    width: '80%',
  },
  buttonDisabled: {
    backgroundColor: '#999',
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
  }
});

export default OrderTrackingCustomerScreen;