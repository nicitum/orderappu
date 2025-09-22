import messaging from '@react-native-firebase/messaging';

export const requestNotificationPermission = async () => {
  try {
    // For Android, permissions are automatically granted
    // For iOS, we need to request permission
    if (Platform.OS === 'ios') {
      // Request permission for iOS
      const authStatus = await messaging().requestPermission();
      const enabled =
        authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
        authStatus === messaging.AuthorizationStatus.PROVISIONAL;
      
      return enabled;
    } else {
      // For Android, check if we have permission
      const authStatus = await messaging().hasPermission();
      const enabled =
        authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
        authStatus === messaging.AuthorizationStatus.PROVISIONAL;
      
      // If we don't have permission, request it
      if (!enabled) {
        try {
          await messaging().requestPermission();
          const newAuthStatus = await messaging().hasPermission();
          return newAuthStatus === messaging.AuthorizationStatus.AUTHORIZED ||
                 newAuthStatus === messaging.AuthorizationStatus.PROVISIONAL;
        } catch (error) {
          console.log('Notification permission request failed:', error);
          return false;
        }
      }
      
      return enabled;
    }
  } catch (error) {
    console.error('Error requesting notification permission:', error);
    return false;
  }
};

export const getFcmToken = async () => {
  try {
    const token = await messaging().getToken();
    if (token) {
      console.log('FCM Token:', token);
      return token;
    }
    return null;
  } catch (error) {
    console.error('Error getting FCM token:', error);
    return null;
  }
};

// Add Platform import
import { Platform } from 'react-native';

export default {
  requestNotificationPermission,
  getFcmToken
};