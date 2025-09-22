/**
 * @format
 */

import {AppRegistry} from 'react-native';
import messaging from '@react-native-firebase/messaging';
import PushNotification from 'react-native-push-notification';
import App from './App';
import {name as appName} from './app.json';

// Note: PushNotification configuration is handled in NotificationService
// to avoid duplicate configurations and conflicts

// Register background handler - MUST be done outside of any component
messaging().setBackgroundMessageHandler(async remoteMessage => {
  console.log('Message handled in the background!', remoteMessage);
  
  // For background messages, Firebase automatically displays the notification
  // We only need to handle data processing here, not display notifications
  // This prevents duplicate notifications
  
  if (remoteMessage.data) {
    console.log('Processing background message data:', remoteMessage.data);
    // Handle any data processing here if needed
  }
  
  console.log('Background message processed successfully');
});

AppRegistry.registerComponent(appName, () => App);
