import messaging from '@react-native-firebase/messaging';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert, Platform } from 'react-native';
import { ipAddress } from './urls'; // Import ipAddress from urls service
import PushNotification from 'react-native-push-notification';

// For Android 13+ notification permission
let PermissionsAndroid = null;
if (Platform.OS === 'android') {
  PermissionsAndroid = require('react-native').PermissionsAndroid;
}

class NotificationService {
  constructor() {
    this.onMessageListener = null;
    this.onTokenRefreshListener = null;
    this.handlersInitialized = false;
    this.initializePushNotification();
  }

  // Initialize push notification
  initializePushNotification() {
    PushNotification.configure({
      // Called when Token is generated (iOS and Android)
      onRegister: function (token) {
        console.log('TOKEN:', token);
      },

      // Called when a remote is received or opened/clicked
      onNotification: function (notification) {
        console.log('NOTIFICATION:', notification);
      },

      // Should the initial notification be popped automatically
      popInitialNotification: true,

      // Permissions
      requestPermissions: Platform.OS === 'ios',
    });

    // Create default channel for Android
    if (Platform.OS === 'android') {
      PushNotification.createChannel(
        {
          channelId: 'default-channel',
          channelName: 'Default Channel',
          channelDescription: 'A default channel for notifications',
          playSound: true,
          soundName: 'default',
          importance: 4,
          vibrate: true,
        },
        (created) => console.log(`createChannel returned '${created}'`)
      );
    }
  }

  // Display local notification (simple version)
  displayLocalNotification(title, body, data = {}) {
    console.log('Displaying local notification:', { title, body, data });
    
    PushNotification.localNotification({
      channelId: 'default-channel',
      title: title,
      message: body,
      playSound: true,
      soundName: 'default',
      importance: 'high',
      priority: 'high',
      vibrate: true,
      vibration: 300,
      userInfo: data,
    });
  }

  // Request notification permission
  async requestNotificationPermission() {
    try {
      console.log('Requesting notification permission...');
      
      // For Android 13+
      if (Platform.OS === 'android' && Platform.Version >= 33) {
        console.log('Requesting Android 13+ POST_NOTIFICATIONS permission...');
        if (PermissionsAndroid) {
          const result = await PermissionsAndroid.request(
            PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS
          );
          
          if (result === PermissionsAndroid.RESULTS.GRANTED) {
            console.log('POST_NOTIFICATIONS permission granted');
            // Now request Firebase messaging permission
            try {
              await messaging().requestPermission();
              console.log('Firebase messaging permission granted');
              return true;
            } catch (firebaseError) {
              console.log('Firebase messaging permission error:', firebaseError);
              // Even if Firebase permission fails, we might still get tokens
              return true;
            }
          } else {
            console.log('POST_NOTIFICATIONS permission denied:', result);
            return false;
          }
        }
      }
      // For iOS
      else if (Platform.OS === 'ios') {
        console.log('Requesting iOS notification permission...');
        const authStatus = await messaging().requestPermission();
        const enabled = authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
                       authStatus === messaging.AuthorizationStatus.PROVISIONAL;
        console.log('iOS notification permission status:', authStatus);
        return enabled;
      }
      // For older Android versions
      else {
        console.log('Requesting older Android notification permission...');
        try {
          await messaging().requestPermission();
          console.log('Older Android notification permission granted');
          return true;
        } catch (error) {
          console.log('Older Android notification permission error:', error);
          // On older Android, permissions are usually auto-granted
          return true;
        }
      }
    } catch (error) {
      console.error('Error requesting notification permission:', error);
      // Fallback - try to get token anyway
      return Platform.OS === 'android';
    }
  }

  // Get FCM token
  async getFCMToken() {
    try {
      console.log('Getting FCM token...');
      
      // First request permission
      const hasPermission = await this.requestNotificationPermission();
      if (!hasPermission) {
        console.log('Notification permission not granted, but trying to get token anyway...');
      }

      // Get the token
      const token = await messaging().getToken();
      console.log('FCM Token obtained:', token);
      
      if (token) {
        // Store token locally
        await AsyncStorage.setItem('fcmToken', token);
        console.log('FCM token stored locally');
        return token;
      } else {
        console.log('No FCM token received');
        return null;
      }
    } catch (error) {
      console.error('Error getting FCM token:', error);
      return null;
    }
  }

  // Send token to backend
  async sendTokenToBackend(token, customerId) {
    try {
      console.log('Sending FCM token to backend...', { 
        token: token ? token.substring(0, 20) + '...' : 'null', 
        customerId,
        url: `http://${ipAddress}:8091/register-token`
      });

      // Validate inputs before sending
      if (!token || !customerId) {
        console.error('Missing required parameters:', { token: !!token, customerId: !!customerId });
        return false;
      }
      
      const requestBody = {
        customerId: customerId,
        token: token,
        platform: Platform.OS
      };
      
      console.log('Request body:', requestBody);
      
      const response = await fetch(`http://${ipAddress}:8091/register-token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      console.log('Backend response status:', response.status);

      // Get response text first
      const responseText = await response.text();
      console.log('Raw response:', responseText);

      // Check if response is OK
      if (!response.ok) {
        console.error(`Server returned non-OK status: ${response.status}`, responseText);
        return false;
      }

      // Try to parse JSON
      let data;
      try {
        data = JSON.parse(responseText);
      } catch (parseError) {
        console.error('Failed to parse response as JSON:', parseError);
        console.log('Response text:', responseText);
        return false;
      }
      
      console.log('Token registration response:', data);
      
      if (data.success) {
        console.log('FCM token registered successfully with backend');
        return true;
      } else {
        console.error('Backend returned success=false:', data.message);
        return false;
      }
    } catch (error) {
      console.error('Error sending token to backend:', error);
      return false;
    }
  }

  // Initialize notification handlers
  initializeNotificationHandlers() {
    if (this.handlersInitialized) {
      console.log('Notification handlers already initialized, skipping...');
      return;
    }
    
    console.log('Initializing notification handlers...');
    
    // Handle foreground notifications
    this.onMessageListener = messaging().onMessage(async remoteMessage => {
      console.log('Foreground notification received:', remoteMessage);
      
      if (remoteMessage.notification) {
        console.log('Notification details:', {
          title: remoteMessage.notification.title,
          body: remoteMessage.notification.body,
          data: remoteMessage.data
        });
        
        // We don't need to display a local notification
        // Firebase will handle the notification display
        console.log('Foreground notification handled by Firebase');
      }
    });

    // Handle notification tap when app is in background/quit
    messaging().onNotificationOpenedApp(remoteMessage => {
      console.log('Notification caused app to open from background state:', remoteMessage);
      // Handle notification tap here
    });

    // Check whether an initial notification is available
    messaging()
      .getInitialNotification()
      .then(remoteMessage => {
        if (remoteMessage) {
          console.log('Notification caused app to open from quit state:', remoteMessage);
          // Handle notification tap here
        }
      });

    // Handle token refresh
    this.onTokenRefreshListener = messaging().onTokenRefresh(async token => {
      console.log('FCM token refreshed:', token);
      
      // Store new token
      await AsyncStorage.setItem('fcmToken', token);
      
      // Send new token to backend
      const customerId = await AsyncStorage.getItem('customerId');
      if (customerId) {
        await this.sendTokenToBackend(token, customerId);
      }
    });
    
    this.handlersInitialized = true;
    console.log('Notification handlers initialized successfully');
  }

  // Initialize the service
  async initialize(customerId) {
    try {
      console.log('Initializing NotificationService for customer:', customerId);
      
      // Initialize notification handlers
      this.initializeNotificationHandlers();
      
      // Get FCM token
      const token = await this.getFCMToken();
      
      if (token && customerId) {
        // Send token to backend
        const success = await this.sendTokenToBackend(token, customerId);
        if (success) {
          console.log('NotificationService initialized successfully');
          return true;
        } else {
          console.log('Failed to register token with backend, but service initialized');
          return true; // Still return true as local notifications will work
        }
      } else {
        console.log('No token or customerId available');
        return false;
      }
    } catch (error) {
      console.error('Error initializing NotificationService:', error);
      return false;
    }
  }

  // Cleanup
  cleanup() {
    if (this.onMessageListener) {
      this.onMessageListener();
      this.onMessageListener = null;
    }
    if (this.onTokenRefreshListener) {
      this.onTokenRefreshListener();
      this.onTokenRefreshListener = null;
    }
    this.handlersInitialized = false;
    console.log('Notification handlers cleaned up');
  }
}

export default new NotificationService();