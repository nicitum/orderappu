import React, { useState, useRef, useEffect } from "react";
import { jwtDecode } from "jwt-decode";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Image,
  ActivityIndicator,
  Keyboard,
  Dimensions,
  Platform,
  StatusBar,
  ScrollView,
  KeyboardAvoidingView,
} from "react-native";
import Icon from "react-native-vector-icons/MaterialIcons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Toast from 'react-native-toast-message';
import { ipAddress } from "../services/urls";
import FirstTimePasswordChangeModal from "./FirstTimePasswordChangeModal";
import LoadingIndicator from "./general/Loader";
import ErrorMessage from "./general/errorMessage";
import { useNavigation } from '@react-navigation/native';
import { useFontScale } from '../App';
import NotificationService from '../services/NotificationService';
// Remove the test button import

const { width, height } = Dimensions.get('window');

const LoginPage = () => {
  const navigation = useNavigation();
  const { getScaledSize } = useFontScale();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [tempToken, setTempToken] = useState("");
  const [clientImage, setClientImage] = useState(null);
  const [error, setError] = useState("");
  const passwordInput = useRef();
  const [checkingSession, setCheckingSession] = useState(true);

  // Check for existing session on mount
  useEffect(() => {
    const checkSession = async () => {
      try {
        const [customerId, userAuthToken] = await AsyncStorage.multiGet(["customerId", "userAuthToken"]);
        if (customerId[1] && userAuthToken[1]) {
          // Notification service is already initialized in App.jsx
          navigation.reset({
            index: 0,
            routes: [{ name: 'TabNavigator' }],
          });
        }
      } catch (e) {
        console.error('Error checking session:', e);
      } finally {
        setCheckingSession(false);
      }
    };
    checkSession();
  }, []);

  useEffect(() => {
    const fetchClientImage = async () => {
      try {
        console.log('=== FETCHING CLIENT STATUS ON MOUNT ===');
        const clientStatusResponse = await fetch(`http://147.93.110.150:3001/api/client_status/APPU0009`, {
          method: "GET",
          headers: { "Content-Type": "application/json" }
        });
        
        const clientStatusData = await clientStatusResponse.json();
        console.log('=== CLIENT STATUS RESPONSE ON MOUNT ===');
        console.log('Full Response:', JSON.stringify(clientStatusData, null, 2));
        
        if (!clientStatusResponse.ok || !clientStatusData.success) {
          console.error('Client status check failed on mount:', clientStatusData);
          setError("Failed to load client information");
          return;
        }

        if (!clientStatusData.data.length || clientStatusData.data[0].status !== "Active") {
           console.warn('Client status inactive on mount:', clientStatusData.data[0]);
           setError("Client account is inactive");
        }

        const imageFileName = clientStatusData.data[0].image;
        console.log('=== IMAGE INFORMATION ON MOUNT ===');
        console.log('Image filename from API on mount:', imageFileName);
        
        if (imageFileName) {
          const imageUrl = `http://147.93.110.150:3001/api/client-image/${imageFileName}`;
          console.log('Setting client image URL on mount:', imageUrl);
          setClientImage(imageUrl);
        } else {
          console.warn('No image filename found in client status data on mount');
        }
      } catch (err) {
        console.error('=== ERROR FETCHING CLIENT IMAGE ON MOUNT ===');
        console.error('Error details:', err);
        setError("Failed to connect to server");
      }
    };

    fetchClientImage();
  }, []);

  const checkLoginCount = async (customer_id) => {
    try {
      const response = await fetch(
        `http://${ipAddress}:8091/login_counts?customer_id=${customer_id}`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      const data = await response.json();
      if (data.status && data.data.login_count === 1) {
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error checking login count:', error);
      return false;
    }
  };

  // Get FCM token and send to backend with customerId
  // Commented out FCM token registration as requested
  /*
  const handleFcmTokenRegistration = async (customerId) => {
    try {
      // Request permission first
      const permissionGranted = await NotificationService.requestNotificationPermission();
      
      if (permissionGranted) {
        // Get FCM token
        const token = await NotificationService.getFCMToken();
        
        if (token && customerId) { 
          // Send token and customerId to backend
          const success = await NotificationService.sendTokenToBackend(token, customerId);
          if (success) {
            console.log('FCM token registered successfully for customer:', customerId);
            return true;
          } else {
            console.error('Failed to register FCM token for customer:', customerId);
            return false;
          }
        } else {
          console.error('Missing token or customerId:', { token: !!token, customerId });
          return false;
        }
      } else {
        console.log('Notification permission not granted');
        return false;
      }
    } catch (error) {
      console.error('Error in FCM token registration:', error);
      return false;
    }
  };
  */

  const handleLogin = async () => {
    Keyboard.dismiss();
    setError("");
    
    if (!username || !password) {
      setError("Please fill both fields");
      return;
    }

    setIsLoading(true);
    try {
      console.log('=== STARTING LOGIN PROCESS ===');

      console.log('=== AUTHENTICATING USER ===');
      const response = await fetch(`http://${ipAddress}:8091/auth`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      const data = await response.json();
      console.log('=== AUTH RESPONSE ===');
      console.log('Auth Response:', JSON.stringify(data, null, 2));

      if (!response.ok) throw new Error(data.message || "Login failed");

      const decoded = jwtDecode(data.token);
      console.log('=== TOKEN DECODED ===');
      console.log('Decoded Token:', JSON.stringify(decoded, null, 2));
      
      const needsPasswordChange = await checkLoginCount(decoded.id);
      console.log('=== PASSWORD CHANGE CHECK ===');
      console.log('Needs password change:', needsPasswordChange);
      
      if (needsPasswordChange) {
        setTempToken(data.token);
        setShowPasswordModal(true);
      } else {
        // Save user data to AsyncStorage
        await AsyncStorage.multiSet([
          ["customerId", decoded.id],
          ["userAuthToken", data.token]
        ]);
        
        // Commented out FCM token registration as requested
        // const tokenRegistered = await handleFcmTokenRegistration(decoded.id);
        
        // if (tokenRegistered) {
            // Token registration completed
          
          // Show login success notification from backend
          // await showLoginSuccessNotification();
        // } else {
        //   console.warn('FCM token registration failed, skipping login notification');
        // }
        
        navigation.reset({
          index: 0,
          routes: [{ name: 'TabNavigator' }],
        });
      }
    } catch (err) {
      console.error('=== ERROR IN LOGIN PROCESS ===');
      console.error('Error details:', err);
      setError(err.message || "Login failed");
    } finally {
      setIsLoading(false);
      console.log('=== LOGIN PROCESS COMPLETED ===');
    }
  };

  // Show login success notification via backend
  // Commented out login success notification as requested
  /*
  const showLoginSuccessNotification = async () => {
    try {
      console.log('=== SENDING LOGIN SUCCESS NOTIFICATION ===');
      
      const customerId = await AsyncStorage.getItem('customerId');
      console.log('Customer ID for notification:', customerId);
      
      if (!customerId) {
        console.log('No customer ID found, skipping notification');
        return;
      }

      const notificationPayload = {
        targetUserId: customerId,  // Changed to match the expected format
        title: 'Login Successful',
        body: 'Happy Diwali In Advance . Welcome to our application.',
        data: {
          type: 'login_success',
          timestamp: new Date().toISOString()
        }
      };
      
      console.log('Notification payload:', JSON.stringify(notificationPayload, null, 2));
      console.log('Sending to URL:', `http://${ipAddress}:8091/send-notification`);

      const response = await fetch(`http://${ipAddress}:8091/send-notification`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(notificationPayload),
      });

      console.log('Backend response status:', response.status);
      
      if (response.ok) {
        const responseData = await response.text();
        console.log('Login success notification sent successfully. Response:', responseData);
      } else {
        const errorText = await response.text();
        console.log('Failed to send login success notification:', response.status, errorText);
      }
    } catch (error) {
      console.error('Error sending login success notification:', error);
      // Notification is optional, so we don't block the login flow
    }
  };
  */

  const handlePasswordChangeSuccess = async () => {
    setShowPasswordModal(false);
    try {
      const decoded = jwtDecode(tempToken);
      await AsyncStorage.multiSet([
        ["customerId", decoded.id],
        ["userAuthToken", tempToken]
      ]);
      
      // Commented out FCM token registration as requested
      // await handleFcmTokenRegistration(decoded.id);
      
      // Small delay to ensure token is registered before sending notification
      // await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Show login success notification from backend
      // await showLoginSuccessNotification();
      
      navigation.reset({
        index: 0,
        routes: [{ name: 'TabNavigator' }],
      });
    } catch (error) {
      console.error("Error saving token after password change:", error);
      setError("Failed to save authentication data");
    }
  };

  if (checkingSession) {
    return <LoadingIndicator />; // Or any loading spinner
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: '#FFFFFF' }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : StatusBar.currentHeight || 24}
    >
      <View style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="#003366" />
        
        <View style={styles.topLogoContainer}>
          <Image 
            source={require("../assets/logo.jpg")} 
            style={styles.topLogo} 
            resizeMode="contain"
          />
        </View>

        <ScrollView 
          contentContainerStyle={styles.scrollContent}
          style={{ backgroundColor: '#FFFFFF' }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          <View style={styles.header}>
            {clientImage && (
            <Image 
              source={{ uri: clientImage }} 
              style={styles.clientLogo} 
              resizeMode="contain"
              onError={(error) => {
                console.error('=== IMAGE LOADING ERROR ===');
                console.error('Error details:', error.nativeEvent.error);
                console.error('Image URL that failed:', clientImage);
              }}
              onLoad={() => {
                console.log('=== IMAGE LOADED SUCCESSFULLY ===');
                console.log('Image URL:', clientImage);
              }}
            />
            )}
            <Text style={[styles.tagline, { fontSize: getScaledSize(20) }]}>Streamline Your Business Orders</Text>
            <Text style={[styles.taglineSubtext, { fontSize: getScaledSize(14) }]}>Fast • Reliable • Efficient</Text>
            <Text style={[styles.welcomeText, { fontSize: getScaledSize(28) }]}>Welcome Back</Text>
            <Text style={[styles.subtitle, { fontSize: getScaledSize(16) }]}>Please sign in to continue</Text>
          </View>

          {error ? <ErrorMessage message={error} /> : null}

          <View style={styles.formContainer}>
            <View style={styles.inputContainer}>
              <Icon name="person" size={20} color="#666666" style={styles.inputIcon} />
              <TextInput
                style={[styles.input, { fontSize: getScaledSize(16) }]}
                placeholder="Username"
                placeholderTextColor="#999999"
                value={username}
                onChangeText={(text) => {
                  setUsername(text);
                  setError("");
                }}
                returnKeyType="next"
                onSubmitEditing={() => passwordInput.current.focus()}
                autoCapitalize="none"
              />
            </View>

            <View style={styles.inputContainer}>
              <Icon name="lock" size={20} color="#666666" style={styles.inputIcon} />
              <TextInput
                ref={passwordInput}
                style={[styles.input, { fontSize: getScaledSize(16) }]}
                placeholder="Password"
                placeholderTextColor="#999999"
                value={password}
                onChangeText={(text) => {
                  setPassword(text);
                  setError("");
                }}
                secureTextEntry={!isPasswordVisible}
                returnKeyType="done"
                onSubmitEditing={handleLogin}
              />
              <TouchableOpacity 
                onPress={() => setIsPasswordVisible(!isPasswordVisible)}
                style={styles.eyeButton}
              >
                <Icon 
                  name={isPasswordVisible ? "visibility" : "visibility-off"} 
                  size={20} 
                  color="#666666" 
                />
              </TouchableOpacity>
            </View>

            <TouchableOpacity 
              style={[styles.button, isLoading && styles.buttonDisabled]} 
              onPress={handleLogin}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <View style={styles.buttonContent}>
                  <Text style={[styles.buttonText, { fontSize: getScaledSize(16) }]}>SIGN IN</Text>
                  <Icon name="arrow-forward" size={20} color="#FFFFFF" />
                </View>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>

        <FirstTimePasswordChangeModal
          isVisible={showPasswordModal}
          onClose={() => setShowPasswordModal(false)}
          onSuccess={handlePasswordChangeSuccess}
          username={username}
          tempToken={tempToken}
        />
        
        {/* Toast Component */}
        <Toast />
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  scrollContent: {
    flexGrow: 1,
    backgroundColor: '#FFFFFF', // Ensure consistent white background
  },
  topLogoContainer: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 50 : 30,
    left: 20,
    zIndex: 1000,
  },
  topLogo: {
    width: 60,
    height: 60,
    borderRadius: 8,
  },
  header: {
    backgroundColor: '#FFFFFF',
    paddingTop: Platform.OS === 'ios' ? 100 : 80,
    paddingBottom: 30,
    alignItems: 'center',
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 5,
  },
  clientLogo: {
    width: width * 0.4,
    height: width * 0.4,
    marginBottom: 12,
    borderRadius: 8,
  },
  tagline: {
    fontWeight: '600',
    color: '#003366',
    marginBottom: 4,
    textAlign: 'center',
  },
  taglineSubtext: {
    color: '#003366',
    opacity: 0.8,
    marginBottom: 20,
    textAlign: 'center',
    letterSpacing: 1,
  },
  welcomeText: {
    fontWeight: 'bold',
    color: '#003366',
    marginBottom: 8,
  },
  subtitle: {
    color: '#666666',
    opacity: 0.8,
  },
  formContainer: {
    padding: 20,
    marginTop: 20,
    backgroundColor: '#FFFFFF', // Ensure white background
    flex: 1, // Take remaining space
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F7FA',
    borderRadius: 12,
    marginBottom: 20,
    paddingHorizontal: 15,
    height: 56,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    height: '100%',
    color: '#333333',
  },
  eyeButton: {
    padding: 8,
  },
  button: {
    backgroundColor: '#003366',
    borderRadius: 12,
    height: 56,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  buttonText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    marginRight: 8,
  },
});

export default LoginPage;