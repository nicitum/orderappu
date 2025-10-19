import React, { createContext, useContext, useState, useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import LoginPage from './components/LoginPage';
import TabNavigator from './components/TabNavigator';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NotificationService from './services/NotificationService';
import { 
  Alert, 
  Platform, 
  PermissionsAndroid, 
  Linking, 
  View, 
  Text, 
  Modal, 
  StyleSheet, 
  TouchableOpacity 
} from 'react-native';
import { LICENSE_NO } from './components/config';
import RNFS from 'react-native-fs';
import { ipAddress } from './services/urls';

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

// Function to fetch client status and check app_update response
const fetchClientStatus = async () => {
  try {
    console.log('Fetching client status...');
    const response = await fetch(`http://147.93.110.150:3001/api/client_status/${LICENSE_NO}`, {
      method: 'GET',
      headers: {
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache'
      }
    });

    console.log('Client status response status:', response.status);
    if (response.ok) {
      const responseData = await response.json();
      console.log('Client status API Response data:', responseData);
      
      // Extract data from the nested structure
      const data = responseData.data && responseData.data[0];
      console.log('Extracted client data:', data);
      
      if (data && data.app_update) {
        console.log('App update required:', data.app_update);
        // Check if we've already downloaded this version
        const lastDownloadedVersion = await AsyncStorage.getItem('last_downloaded_version');
        const currentAppVersion = data.app_version;
        
        console.log('Current app version from API:', currentAppVersion);
        console.log('Last downloaded version:', lastDownloadedVersion);
        
        // If we've already downloaded this version, don't require update
        if (lastDownloadedVersion && currentAppVersion && lastDownloadedVersion === currentAppVersion) {
          console.log('App version already downloaded, skipping update');
          return false;
        }
        
        // Return true if app_update is required, false otherwise
        return data.app_update === 'Yes';
      } else {
        console.log('No app_update field found in response');
        return false;
      }
    } else {
      console.log('Client status API response not ok:', response.status);
      return false;
    }
  } catch (error) {
    console.error('Error fetching client status:', error);
    return false;
  }
};

// Update Required Modal Component
const UpdateRequiredModal = ({ 
  visible, 
  onDownload, 
  isDownloading, 
  downloadProgress,
  downloadedFilePath 
}) => {
  const { getScaledSize } = useFontScale();
  
  return (
    <Modal
      animationType="slide"
      transparent={true}
      visible={visible}
      onRequestClose={() => {}}>
      <View style={styles.modalContainer}>
        <View style={styles.modalContent}>
          <Text style={[styles.modalTitle, { fontSize: getScaledSize(20) }]}>
            App Update Required
          </Text>
          
          {downloadedFilePath ? (
            <>
              <Text style={[styles.modalMessage, { fontSize: getScaledSize(16) }]}>
                APK downloaded successfully! Please check your device's download folder and install the APK manually.
              </Text>
            </>
          ) : isDownloading ? (
            <>
              <Text style={[styles.modalMessage, { fontSize: getScaledSize(16) }]}>
                Downloading update... Please wait.
              </Text>
              <View style={styles.progressContainer}>
                <Text style={[styles.progressText, { fontSize: getScaledSize(14) }]}>
                  {downloadProgress !== null ? `${downloadProgress}%` : 'Starting download...'}
                </Text>
                {downloadProgress !== null && (
                  <View style={styles.progressBarContainer}>
                    <View style={[styles.progressBar, { width: `${downloadProgress}%` }]} />
                  </View>
                )}
              </View>
            </>
          ) : (
            <>
              <Text style={[styles.modalMessage, { fontSize: getScaledSize(16) }]}>
                A new version of the app is available. Please download and install the latest version to continue using the app.
              </Text>
              <TouchableOpacity
                style={styles.downloadButton}
                onPress={onDownload}
                disabled={isDownloading}>
                <Text style={[styles.downloadButtonText, { fontSize: getScaledSize(16) }]}>
                  Download Latest Version
                </Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
};

// Function to install APK
const installAPK = async (filePath) => {
  try {
    console.log('Installing APK from:', filePath);
    
    // Check if file exists
    const fileExists = await RNFS.exists(filePath);
    if (!fileExists) {
      Alert.alert('Error', 'APK file not found. Please download again.');
      return;
    }

    // For Android, use Linking to open the APK file
    if (Platform.OS === 'android') {
      // Create a file:// URI for the APK
      const fileUri = `file://${filePath}`;
      
      // Try to open the APK with package installer
      const supported = await Linking.canOpenURL(fileUri);
      
      if (supported) {
        await Linking.openURL(fileUri);
      } else {
        // Fallback: try to open with content:// URI
        Alert.alert(
          'Install APK',
          'Please navigate to your Downloads folder and tap on the APK file to install it.',
          [
            {
              text: 'Open Downloads',
              onPress: () => openDownloadsFolder(filePath)
            },
            {
              text: 'OK',
              style: 'cancel'
            }
          ]
        );
      }
    }
  } catch (error) {
    console.error('Error installing APK:', error);
    Alert.alert(
      'Installation Failed',
      'Could not start installation. Please check your Downloads folder and manually install the APK.',
      [
        {
          text: 'Open Downloads',
          onPress: () => openDownloadsFolder(filePath)
        },
        {
          text: 'OK',
          style: 'cancel'
        }
      ]
    );
  }
};

// Function to open downloads folder
const openDownloadsFolder = async (filePath) => {
  try {
    if (Platform.OS === 'android') {
      // Try multiple approaches to open downloads folder
      
      // Approach 1: Direct file path
      const directoryPath = filePath.substring(0, filePath.lastIndexOf('/'));
      const fileUri = `file://${directoryPath}`;
      
      // Approach 2: Android downloads content URI
      const downloadsUri = 'content://downloads/public_downloads';
      
      // Approach 3: System downloads intent
      const systemDownloadsUri = 'content://com.android.externalstorage.documents/document/primary:Download';
      
      // Try each approach in sequence
      const urisToTry = [
        fileUri,
        downloadsUri,
        systemDownloadsUri
      ];
      
      for (const uri of urisToTry) {
        try {
          const supported = await Linking.canOpenURL(uri);
          if (supported) {
            await Linking.openURL(uri);
            console.log('Successfully opened folder with URI:', uri);
            return;
          }
        } catch (error) {
          console.log(`Failed to open with URI ${uri}:`, error);
          continue;
        }
      }
      
      // If all approaches fail, show manual guidance
      Alert.alert(
        'Open Downloads',
        'Please manually open your File Manager app and navigate to the Downloads folder to find the APK file.',
        [{ text: 'OK' }]
      );
    }
  } catch (error) {
    console.error('Error opening downloads folder:', error);
    Alert.alert(
      'Cannot Open Folder',
      'Please check your Downloads folder manually for the APK file.',
      [{ text: 'OK' }]
    );
  }
};

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 10,
    padding: 20,
    width: '80%',
    alignItems: 'center',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  modalTitle: {
    fontWeight: 'bold',
    marginBottom: 15,
    textAlign: 'center',
    color: '#333',
  },
  modalMessage: {
    textAlign: 'center',
    marginBottom: 20,
    color: '#666',
    lineHeight: 20,
  },
  downloadButton: {
    backgroundColor: '#007AFF',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 20,
    minWidth: 200,
  },
  downloadButtonText: {
    color: 'white',
    fontWeight: 'bold',
    textAlign: 'center',
  },
  buttonContainer: {
    flexDirection: 'column',
    width: '100%',
    gap: 10,
  },
  actionButton: {
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 20,
    minWidth: 200,
    alignItems: 'center',
  },
  installButton: {
    backgroundColor: '#34C759',
  },
  viewFolderButton: {
    backgroundColor: '#8E8E93',
  },
  actionButtonText: {
    color: 'white',
    fontWeight: 'bold',
    textAlign: 'center',
  },
  progressContainer: {
    width: '100%',
    alignItems: 'center',
  },
  progressText: {
    marginBottom: 10,
    textAlign: 'center',
    color: '#333',
  },
  progressBarContainer: {
    height: 10,
    width: '100%',
    backgroundColor: '#E0E0E0',
    borderRadius: 5,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#007AFF',
  },
});

function App() {
  const [updateRequired, setUpdateRequired] = useState(false);
  const [checkingUpdate, setCheckingUpdate] = useState(true);
  const [downloadProgress, setDownloadProgress] = useState(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadedFilePath, setDownloadedFilePath] = useState(null);

  // Function to download the latest APK
  const downloadLatestAPK = async () => {
    try {
      console.log('Starting APK download...');
      setIsDownloading(true);
      setDownloadProgress(0);
      setDownloadedFilePath(null);
      
      // URL for downloading the latest APK
      const downloadUrl = `http://${ipAddress}:8091/apk/download`;
      console.log('Download URL:', downloadUrl);
      
      // Validate IP address
      if (!ipAddress || ipAddress === "undefined") {
        throw new Error('Server configuration error. Please contact support.');
      }
      
      // Define the destination path for the downloaded APK
      // Use a clear filename with timestamp
      const apkFileName = `app-update-${Date.now()}.apk`;
      const destinationPath = `${RNFS.DownloadDirectoryPath}/${apkFileName}`;
      console.log('Destination path:', destinationPath);
      
      // Download the file
      const download = RNFS.downloadFile({
        fromUrl: downloadUrl,
        toFile: destinationPath,
        background: true,
        discretionary: true,
        progress: (res) => {
          if (res.contentLength > 0) {
            const progress = (res.bytesWritten / res.contentLength) * 100;
            console.log(`Download progress: ${progress.toFixed(2)}%`);
            setDownloadProgress(Math.round(progress));
          }
        },
        progressDivider: 1
      });
      
      const result = await download.promise;
      
      console.log('Download result:', result);
      
      if (result.statusCode === 200) {
        console.log('APK downloaded successfully to:', destinationPath);
        
        // Verify the file was actually downloaded
        const fileExists = await RNFS.exists(destinationPath);
        if (!fileExists) {
          throw new Error('Downloaded file not found');
        }
        
        // Get file info to verify size
        const fileInfo = await RNFS.stat(destinationPath);
        console.log('Downloaded file info:', fileInfo);
        
        // Save the downloaded version to prevent re-downloading
        try {
          const clientStatusResponse = await fetchClientStatus();
          // Assuming fetchClientStatus returns the full response, we need to extract app_version
          // This might need adjustment based on your actual API response structure
          const appVersion = clientStatusResponse?.app_version || 'unknown';
          await AsyncStorage.setItem('last_downloaded_version', appVersion);
        } catch (versionError) {
          console.error('Error saving version:', versionError);
        }
        
        // Set the downloaded file path for installation
        setDownloadedFilePath(destinationPath);
        setIsDownloading(false);
        setDownloadProgress(null);
        
        return true;
      } else {
        throw new Error(`Download failed with status code: ${result.statusCode}`);
      }
    } catch (error) {
      setIsDownloading(false);
      setDownloadProgress(null);
      setDownloadedFilePath(null);
      console.error('Error downloading APK:', error);
      Alert.alert(
        'Download Error', 
        `Failed to download update: ${error.message || 'Please check your connection and try again.'}`
      );
      return false;
    }
  };

  // Request Bluetooth permissions
  const requestBluetoothPermissionsOnStart = async () => {
    try {
      if (Platform.OS === 'android') {
        if (Platform.Version >= 31) {
          // Android 12+ (API 31)
          const permissions = [
            PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
            PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
          ];
          
          const result = await PermissionsAndroid.requestMultiple(permissions);
          console.log('Bluetooth permissions result:', result);
        } else {
          // Android 11 and below
          const granted = await PermissionsAndroid.request(
            PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
            {
              title: 'Location Permission',
              message: 'This app needs location permission to connect to Bluetooth devices',
              buttonNeutral: 'Ask Me Later',
              buttonNegative: 'Cancel',
              buttonPositive: 'OK',
            },
          );
          console.log('Location permission result:', granted);
        }
      }
    } catch (error) {
      console.error('Error requesting Bluetooth permissions:', error);
    }
  };

  // Initialize app
  useEffect(() => {
    const initializeApp = async () => {
      try {
        console.log('App started - initializing...');
        
        // Check for app updates first
        const isUpdateRequired = await fetchClientStatus();
        console.log('Is app update required?', isUpdateRequired);
        
        if (isUpdateRequired) {
          setUpdateRequired(true);
          setCheckingUpdate(false);
          return;
        }
        
        setCheckingUpdate(false);
        
        // Small delay to ensure app is ready
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Request notification permission
        console.log('Requesting notification permission...');
        const permissionGranted = await NotificationService.requestNotificationPermission();
        
        console.log('Notification permission result:', permissionGranted);
        
        if (permissionGranted) {
          console.log('Notification permission granted, initializing handlers');
          NotificationService.initializeNotificationHandlers();
          
          // Get and register FCM token
          const token = await NotificationService.getFCMToken();
          if (token) {
            console.log('FCM token obtained successfully');
            
            const customerId = await AsyncStorage.getItem('customerId');
            if (customerId) {
              const success = await NotificationService.sendTokenToBackend(token, customerId);
              if (success) {
                console.log('FCM token registered successfully for customer:', customerId);
              } else {
                console.error('Failed to register FCM token for customer:', customerId);
              }
            } else {
              console.log('No customerId found in storage');
            }
          } else {
            console.log('Failed to obtain FCM token');
          }
        } else {
          console.log('Notification permission denied');
          NotificationService.initializeNotificationHandlers();
          
          // Show guidance for Android 13+
          if (Platform.OS === 'android' && Platform.Version >= 33) {
            Alert.alert(
              'Notification Permission',
              'To receive important updates, please enable notifications in Settings.',
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Open Settings',
                  onPress: () => Linking.openSettings()
                }
              ]
            );
          }
        }
        
        // Request Bluetooth permissions
        await requestBluetoothPermissionsOnStart();
        
      } catch (error) {
        console.error('Error initializing app:', error);
        setCheckingUpdate(false);
        // Initialize notification handlers as fallback
        try {
          NotificationService.initializeNotificationHandlers();
        } catch (handlerError) {
          console.error('Error initializing notification handlers:', handlerError);
        }
      }
    };
    
    initializeApp();
    
    // Cleanup function
    return () => {
      try {
        NotificationService.cleanup();
      } catch (error) {
        console.error('Error cleaning up notification service:', error);
      }
    };
  }, []);

  // Handle download and install
  const handleDownload = async () => {
    try {
      const success = await downloadLatestAPK();
      if (success) {
        console.log('APK download process completed');
        // The modal will show installation options automatically
      }
    } catch (error) {
      console.error('Error handling download:', error);
      Alert.alert(
        'Download Failed', 
        'Unable to download the update. Please check your internet connection and try again.'
      );
    }
  };

  // Show update modal if update is required
  if (updateRequired) {
    return (
      <FontProvider>
        <SafeAreaProvider>
          <UpdateRequiredModal 
            visible={true} 
            onDownload={handleDownload} 
            isDownloading={isDownloading}
            downloadProgress={downloadProgress}
            downloadedFilePath={downloadedFilePath}
          />
          <Toast />
        </SafeAreaProvider>
      </FontProvider>
    );
  }

  // Show loading screen while checking for updates
  if (checkingUpdate) {
    return (
      <FontProvider>
        <SafeAreaProvider>
          <View style={styles.loadingContainer}>
            <Text style={styles.loadingText}>Checking for updates...</Text>
          </View>
          <Toast />
        </SafeAreaProvider>
      </FontProvider>
    );
  }

  // Main app
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

// Add loading styles
const extendedStyles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  loadingText: {
    fontSize: 16,
    color: '#666',
  },
});

// Merge styles
Object.assign(styles, extendedStyles);

export default App;