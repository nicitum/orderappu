import React from 'react';
import { View, TouchableOpacity, Text, StyleSheet, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ipAddress } from '../services/urls';
import NotificationService from '../services/NotificationService';

const TestNotification = () => {
  const sendTestNotification = async () => {
    try {
      const customerId = await AsyncStorage.getItem('customerId');
      
      if (!customerId) {
        Alert.alert('Error', 'Please login first');
        return;
      }

      const response = await fetch(`http://${ipAddress}:8091/send-notification`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          targetUserId: customerId,
          title: 'Test Notification',
          body: 'This is a test push notification to verify the system is working!',
          data: {
            type: 'test',
            timestamp: new Date().toISOString()
          }
        }),
      });

      const result = await response.json();
      console.log('Test notification result:', result);
      
      if (result.success) {
        // Remove success alert to prevent duplicate notifications
        console.log('Test notification sent successfully');
      } else {
        Alert.alert('Error', result.message || 'Failed to send notification');
      }
    } catch (error) {
      console.error('Error sending test notification:', error);
      Alert.alert('Error', 'Failed to send test notification');
    }
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.button} onPress={sendTestNotification}>
        <Text style={styles.buttonText}>Send Test Notification</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 10,
    alignItems: 'center',
  },
  button: {
    backgroundColor: '#007bff',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    marginVertical: 5,
    minWidth: 200,
    alignItems: 'center',
  },
  localButton: {
    backgroundColor: '#28a745',
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default TestNotification;