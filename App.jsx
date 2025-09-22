import React, { createContext, useContext, useState, useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import LoginPage from './components/LoginPage';
import TabNavigator from './components/TabNavigator';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NotificationService from './services/NotificationService';
import { Alert, Platform } from 'react-native';

const Stack = createNativeStackNavigator();

// Font Context
const FontContext = createContext();

// Font Provider Component
const FontProvider = ({ children }) => {
  const [fontScale, setFontScale] = useState(1.0);
  const [fontSize, setFontSize] = useState('medium');

  // Font scale mapping
  const fontScales = {
    'small': 0.85,
    'medium': 1.0,
    'large': 1.15,
    'extra-large': 1.3
  };

  // Load font settings on app start
  useEffect(() => {
    loadFontSettings();
  }, []);

  const loadFontSettings = async () => {
    try {
      const savedFontSize = await AsyncStorage.getItem('app_font_size');
      if (savedFontSize && fontScales[savedFontSize]) {
        setFontSize(savedFontSize);
        setFontScale(fontScales[savedFontSize]);
      }
    } catch (error) {
      console.error('Error loading font settings:', error);
    }
  };

  const updateFontSize = async (newFontSize) => {
    try {
      if (fontScales[newFontSize]) {
        setFontSize(newFontSize);
        setFontScale(fontScales[newFontSize]);
        await AsyncStorage.setItem('app_font_size', newFontSize);
      }
    } catch (error) {
      console.error('Error saving font settings:', error);
    }
  };

  const getScaledSize = (baseSize) => {
    return Math.round(baseSize * fontScale);
  };

  const value = {
    fontScale,
    fontSize,
    fontScales,
    updateFontSize,
    getScaledSize,
  };

  return (
    <FontContext.Provider value={value}>
      {children}
    </FontContext.Provider>
  );
};

// Custom hook to use font context
export const useFontScale = () => {
  const context = useContext(FontContext);
  if (!context) {
    throw new Error('useFontScale must be used within a FontProvider');
  }
  return context;
};

function App() {
  // Request notification permission and initialize handlers when app starts
  useEffect(() => {
    const initializeNotifications = async () => {
      try {
        console.log('App started - initializing notifications...');
        
        // Small delay to ensure app is ready
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Request notification permission
        console.log('Requesting notification permission on app start...');
        const permissionGranted = await NotificationService.requestNotificationPermission();
        
        console.log('Notification permission result:', permissionGranted);
        
        if (permissionGranted) {
          console.log('Notification permission granted, initializing handlers');
          // Initialize notification service
          NotificationService.initializeNotificationHandlers();
          
          // Try to get FCM token
          const token = await NotificationService.getFCMToken();
          if (token) {
            console.log('FCM token obtained successfully on app start');
            
            // Get customerId from AsyncStorage and register token
            const customerId = await AsyncStorage.getItem('customerId');
            if (customerId) {
              const success = await NotificationService.sendTokenToBackend(token, customerId);
              if (success) {
                console.log('FCM token registered successfully on app start for customer:', customerId);
              } else {
                console.error('Failed to register FCM token on app start for customer:', customerId);
              }
            } else {
              console.log('No customerId found in AsyncStorage on app start');
            }
          } else {
            console.log('Failed to obtain FCM token on app start');
          }
        } else {
          console.log('Notification permission denied on app start');
          // Still initialize handlers as we might be able to receive notifications
          NotificationService.initializeNotificationHandlers();
          
          // Show alert to user on Android 13+ if permission was denied
          if (Platform.OS === 'android' && Platform.Version >= 33) {
            Alert.alert(
              'Notification Permission Needed',
              'Please enable notifications in Settings to receive important updates.',
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Open Settings',
                  onPress: () => {
                    // This would require linking to settings, but for now just inform
                    console.log('User needs to manually enable notifications in settings');
                  }
                }
              ]
            );
          }
        }
      } catch (error) {
        console.error('Error initializing notifications on app start:', error);
        // Still initialize handlers as fallback
        try {
          NotificationService.initializeNotificationHandlers();
        } catch (handlerError) {
          console.error('Error initializing notification handlers:', handlerError);
        }
      }
    };
    
    initializeNotifications();
    
    // Cleanup function
    return () => {
      try {
        NotificationService.cleanup();
      } catch (error) {
        console.error('Error cleaning up notification service:', error);
      }
    };
  }, []);

  return (
    <FontProvider>
      <SafeAreaProvider>
        <NavigationContainer>
          <Stack.Navigator screenOptions={{ headerShown: false }}>
            <Stack.Screen name="Login" component={LoginPage} />
            <Stack.Screen name="TabNavigator" component={TabNavigator} />
          </Stack.Navigator>
        </NavigationContainer>
        <Toast />
      </SafeAreaProvider>
    </FontProvider>
  );
}

export default App;