import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Alert,
  PermissionsAndroid,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import RNBluetoothClassic, {
  BluetoothDevice,
} from 'react-native-bluetooth-classic';

const BluetoothPrinter = () => {
  const [pairedDevices, setPairedDevices] = useState([]);
  const [connectedDevice, setConnectedDevice] = useState(null);
  const [isScanning, setIsScanning] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState('disconnected'); // disconnected, connecting, connected, checking
  const hasCheckedConnection = useRef(false); // Ref to ensure connection check runs only once

  // Request Bluetooth permissions based on Android version
  const requestBluetoothPermissions = async () => {
    if (Platform.OS === 'android') {
      if (Platform.Version >= 31) {
        // Android 12 (API 31) and above
        const result = await PermissionsAndroid.requestMultiple([
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
        ]);
        
        return (
          result[PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT] === PermissionsAndroid.RESULTS.GRANTED &&
          result[PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN] === PermissionsAndroid.RESULTS.GRANTED
        );
      } else {
        // Android 11 (API 30) and below
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
          {
            title: 'Bluetooth Permission',
            message: 'This app needs Bluetooth permission to connect to printers',
            buttonNeutral: 'Ask Me Later',
            buttonNegative: 'Cancel',
            buttonPositive: 'OK',
          },
        );
        return granted === PermissionsAndroid.RESULTS.GRANTED;
      }
    }
    return true; // For iOS, permissions are handled in Info.plist
  };

  // Check if Bluetooth is enabled and request enabling if not
  const checkBluetoothState = async () => {
    try {
      const isEnabled = await RNBluetoothClassic.isBluetoothEnabled();
      if (!isEnabled) {
        Alert.alert(
          'Bluetooth Disabled',
          'Please enable Bluetooth to connect to the printer',
          [
            {
              text: 'Cancel',
              style: 'cancel',
            },
            {
              text: 'Enable',
              onPress: async () => {
                try {
                  await RNBluetoothClassic.requestBluetoothEnabled();
                } catch (error) {
                  Alert.alert('Error', 'Failed to enable Bluetooth');
                }
              },
            },
          ],
        );
        return false;
      }
      return true;
    } catch (error) {
      console.log('Error checking Bluetooth state:', error);
      return false;
    }
  };

  // Get paired Bluetooth devices
  const getPairedDevices = async () => {
    try {
      const devices = await RNBluetoothClassic.getBondedDevices();
      setPairedDevices(devices);
      return devices;
    } catch (error) {
      console.log('Error getting paired devices:', error);
      Alert.alert('Error', 'Failed to get paired devices');
      return [];
    }
  };

  // Check if a device is currently connected
  const checkConnectedDevice = async () => {
    // Only run this check once
    if (hasCheckedConnection.current) {
      return;
    }
    
    hasCheckedConnection.current = true;
    setConnectionStatus('checking');
    
    try {
      const connectedDevices = await RNBluetoothClassic.getConnectedDevices();
      console.log('Connected devices:', connectedDevices);
      
      if (connectedDevices.length > 0) {
        setConnectedDevice(connectedDevices[0]);
        setConnectionStatus('connected');
      } else {
        setConnectedDevice(null);
        setConnectionStatus('disconnected');
      }
    } catch (error) {
      console.log('Error checking connected devices:', error);
      setConnectedDevice(null);
      setConnectionStatus('disconnected');
    }
  };

  // Connect to a Bluetooth device with better error handling
  const connectToDevice = async (device) => {
    if (isConnecting) return; // Prevent multiple simultaneous connections
    
    setIsConnecting(true);
    setConnectionStatus('connecting');
    
    try {
      // First check if we're already connected to this device
      if (connectedDevice && connectedDevice.id === device.id) {
        Alert.alert('Already Connected', `Already connected to ${device.name}`);
        setIsConnecting(false);
        setConnectionStatus('connected');
        return;
      }

      // Disconnect from any currently connected device
      if (connectedDevice) {
        try {
          await RNBluetoothClassic.disconnectFromDevice(connectedDevice.id);
        } catch (disconnectError) {
          console.log('Error disconnecting from previous device:', disconnectError);
        }
      }
      
      // Connect to the new device
      console.log('Connecting to device:', device.id);
      const connection = await RNBluetoothClassic.connectToDevice(device.id, {
        DELIMITER: '\n',
        SECURE_SOCKET: false, // Try insecure connection first
      });
      
      setConnectedDevice(device);
      setConnectionStatus('connected');
      Alert.alert('Success', `Connected to ${device.name}`);
    } catch (error) {
      console.log('Connection error:', error);
      
      // Try alternative connection method
      try {
        const connection = await RNBluetoothClassic.connectToDevice(device.id, {
          DELIMITER: '\n',
          SECURE_SOCKET: true, // Try secure connection
        });
        
        setConnectedDevice(device);
        setConnectionStatus('connected');
        Alert.alert('Success', `Connected to ${device.name}`);
      } catch (secondError) {
        console.log('Second connection attempt failed:', secondError);
        setConnectedDevice(null);
        setConnectionStatus('disconnected');
        Alert.alert('Error', `Failed to connect to ${device.name}: ${error.message || 'Connection failed'}`);
      }
    } finally {
      setIsConnecting(false);
    }
  };

  // Disconnect from the current device
  const disconnectDevice = async () => {
    if (!connectedDevice) return;
    
    setConnectionStatus('disconnecting');
    
    try {
      await RNBluetoothClassic.disconnectFromDevice(connectedDevice.id);
      setConnectedDevice(null);
      setConnectionStatus('disconnected');
      Alert.alert('Disconnected', 'Printer disconnected successfully');
    } catch (error) {
      console.log('Disconnection error:', error);
      // Even if we get an error, clear the state since the device is likely disconnected
      setConnectedDevice(null);
      setConnectionStatus('disconnected');
      Alert.alert('Info', 'Printer may already be disconnected');
    }
  };

  // Test connection to verify device is responsive
  const testConnection = async () => {
    if (!connectedDevice) {
      Alert.alert('Error', 'Please connect to a printer first');
      return;
    }

    try {
      // Send a simple command to test connection
      const deviceId = connectedDevice.id;
      
      // Send initialize command
      await RNBluetoothClassic.writeToDevice(deviceId, '\x1B\x40');
      
      // Send a simple text to verify response
      await RNBluetoothClassic.writeToDevice(deviceId, 'Connection Test\n');
      
      Alert.alert('Success', 'Printer is responsive and connected');
    } catch (error) {
      console.log('Connection test error:', error);
      Alert.alert('Error', 'Printer is not responding: ' + error.message);
      
      // Try to reconnect
      Alert.alert(
        'Reconnect?',
        'Would you like to try reconnecting to the printer?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Reconnect',
            onPress: () => connectToDevice(connectedDevice)
          }
        ]
      );
    }
  };

  // Test print function - FIXED VERSION
  const testPrint = async () => {
    if (!connectedDevice) {
      Alert.alert('Error', 'Please connect to a printer first');
      return;
    }

    try {
      // FIX: writeToDevice requires deviceId as first parameter
      const deviceId = connectedDevice.id;

      // Send ESC/POS commands for printing
      // Initialize printer
      await RNBluetoothClassic.writeToDevice(deviceId, '\x1B\x40');
      
      // Center align
      await RNBluetoothClassic.writeToDevice(deviceId, '\x1B\x61\x01');
      await RNBluetoothClassic.writeToDevice(deviceId, 'LOGON SYSTEMS\n');
      await RNBluetoothClassic.writeToDevice(deviceId, 'LS-P11 Thermal Printer\n');
      await RNBluetoothClassic.writeToDevice(deviceId, '--------------------------\n');
      
      // Left align
      await RNBluetoothClassic.writeToDevice(deviceId, '\x1B\x61\x00');
      await RNBluetoothClassic.writeToDevice(deviceId, '\n');
      await RNBluetoothClassic.writeToDevice(deviceId, 'Test Print Successful!\n');
      await RNBluetoothClassic.writeToDevice(deviceId, '\n');
      await RNBluetoothClassic.writeToDevice(deviceId, 'Item: React Native Book\n');
      await RNBluetoothClassic.writeToDevice(deviceId, 'Qty: 1\n');
      await RNBluetoothClassic.writeToDevice(deviceId, 'Price: $20.00\n');
      
      // Center align for barcode
      await RNBluetoothClassic.writeToDevice(deviceId, '\x1B\x61\x01');
      await RNBluetoothClassic.writeToDevice(deviceId, '\n');
      
      // Print barcode (Code128) - Simple text representation
      await RNBluetoothClassic.writeToDevice(deviceId, 'Barcode: 123456789\n');
      
      // Feed paper
      await RNBluetoothClassic.writeToDevice(deviceId, '\n\n\n\n\n');
      
      // Cut paper (if supported by your printer)
      // Note: Different printers use different cut commands
      await RNBluetoothClassic.writeToDevice(deviceId, '\x1D\x56\x00'); // Standard cut command
      
      Alert.alert('Success', 'Test print completed!');
    } catch (error) {
      console.log('Print error:', error);
      Alert.alert('Error', 'Failed to print: ' + error.message);
    }
  };

  // Alternative print function using Buffer (if string doesn't work)
  const testPrintWithBuffer = async () => {
    if (!connectedDevice) {
      Alert.alert('Error', 'Please connect to a printer first');
      return;
    }

    try {
      const deviceId = connectedDevice.id;
      
      // Create a buffer with all ESC/POS commands
      const printData = [
        '\x1B\x40', // Initialize
        '\x1B\x61\x01', // Center align
        'LOGON SYSTEMS\n',
        'LS-P11 Printer Test\n',
        '--------------------------\n',
        '\x1B\x61\x00', // Left align
        'Test Date: ' + new Date().toLocaleDateString() + '\n',
        'Item: React Native Thermal Print\n',
        'Status: SUCCESS\n\n\n\n',
        '\x1D\x56\x00' // Cut paper
      ].join('');

      // Convert to buffer and send
      const buffer = Buffer.from(printData, 'utf8');
      await RNBluetoothClassic.writeToDevice(deviceId, buffer);
      
      Alert.alert('Success', 'Test print completed!');
    } catch (error) {
      console.log('Buffer print error:', error);
      Alert.alert('Error', 'Failed to print with buffer: ' + error.message);
    }
  };

  // Scan for new devices with improved connection checking
  const scanForDevices = async () => {
    const hasPermission = await requestBluetoothPermissions();
    if (!hasPermission) {
      Alert.alert('Permission Denied', 'Bluetooth permissions are required to scan for devices');
      return;
    }

    const isBluetoothOn = await checkBluetoothState();
    if (!isBluetoothOn) return;

    setIsScanning(true);
    try {
      // Get paired devices first
      const devices = await getPairedDevices();
      
      // Check for already connected devices (but only once)
      await checkConnectedDevice();
    } catch (error) {
      console.log('Scan error:', error);
      Alert.alert('Error', 'Failed to scan for devices');
    } finally {
      setIsScanning(false);
    }
  };

  // Run on component focus
  useFocusEffect(
    React.useCallback(() => {
      scanForDevices();
    }, [])
  );

  // Render a device item
  const renderDeviceItem = ({ item }) => (
    <TouchableOpacity
      style={[
        styles.deviceItem,
        connectedDevice && connectedDevice.id === item.id && styles.connectedDevice
      ]}
      onPress={() => connectToDevice(item)}
      disabled={isConnecting || connectionStatus === 'connecting'}>
      <Text style={styles.deviceName}>{item.name}</Text>
      <Text style={styles.deviceAddress}>{item.address || item.id}</Text>
      <Text style={styles.deviceStatus}>
        {connectedDevice && connectedDevice.id === item.id ? '● Connected' : '○ Disconnected'}
      </Text>
      {(isConnecting || connectionStatus === 'connecting') && connectedDevice && connectedDevice.id === item.id && (
        <Text style={styles.connectingText}>Connecting...</Text>
      )}
    </TouchableOpacity>
  );

  // Get connection status text and color
  const getConnectionStatusInfo = () => {
    switch (connectionStatus) {
      case 'connecting':
        return { text: 'Connecting...', color: '#FF9800' };
      case 'connected':
        return { text: `Connected to ${connectedDevice?.name || 'Printer'}`, color: '#4CAF50' };
      case 'checking':
        return { text: 'Checking connection...', color: '#2196F3' };
      case 'disconnecting':
        return { text: 'Disconnecting...', color: '#FF9800' };
      default:
        return { text: 'Not Connected', color: '#F44336' };
    }
  };

  const statusInfo = getConnectionStatusInfo();

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Bluetooth Printer Setup</Text>
      
      <View style={styles.statusContainer}>
        <Text style={styles.statusLabel}>Connection Status:</Text>
        <View style={styles.statusContent}>
          {connectionStatus === 'checking' || connectionStatus === 'connecting' || connectionStatus === 'disconnecting' ? (
            <View style={styles.statusRow}>
              <ActivityIndicator size="small" color={statusInfo.color} />
              <Text style={[styles.statusValue, { color: statusInfo.color, marginLeft: 10 }]}>
                {statusInfo.text}
              </Text>
            </View>
          ) : (
            <Text style={[styles.statusValue, { color: statusInfo.color }]}>
              {statusInfo.text}
            </Text>
          )}
        </View>
      </View>
      
      <View style={styles.buttonContainer}>
        <TouchableOpacity 
          style={styles.button} 
          onPress={scanForDevices} 
          disabled={isScanning || isConnecting || connectionStatus === 'connecting'}>
          <Text style={styles.buttonText}>
            {isScanning ? 'Scanning...' : 'Scan for Devices'}
          </Text>
        </TouchableOpacity>
        
        {connectedDevice && (
          <TouchableOpacity 
            style={[styles.button, styles.disconnectButton]} 
            onPress={disconnectDevice} 
            disabled={isConnecting || connectionStatus === 'disconnecting'}>
            <Text style={styles.buttonText}>Disconnect</Text>
          </TouchableOpacity>
        )}
        
        <TouchableOpacity 
          style={[styles.button, styles.testButton]} 
          onPress={testPrint}
          disabled={!connectedDevice || isConnecting || connectionStatus !== 'connected'}>
          <Text style={styles.buttonText}>Test Print</Text>
        </TouchableOpacity>

        {/* Connection test button */}
        <TouchableOpacity 
          style={[styles.button, styles.connectionTestButton]} 
          onPress={testConnection}
          disabled={!connectedDevice || isConnecting || connectionStatus !== 'connected'}>
          <Text style={styles.buttonText}>Test Connection</Text>
        </TouchableOpacity>

        {/* Alternative print button */}
        <TouchableOpacity 
          style={[styles.button, styles.bufferButton]} 
          onPress={testPrintWithBuffer}
          disabled={!connectedDevice || isConnecting || connectionStatus !== 'connected'}>
          <Text style={styles.buttonText}>Test Print (Buffer)</Text>
        </TouchableOpacity>
      </View>
      
      <Text style={styles.sectionTitle}>Paired Devices</Text>
      <FlatList
        data={pairedDevices}
        keyExtractor={(item) => item.id}
        renderItem={renderDeviceItem}
        style={styles.deviceList}
        ListEmptyComponent={
          <Text style={styles.emptyMessage}>
            {isScanning ? 'Scanning for devices...' : 'No paired devices found. Please pair your printer in device settings first.'}
          </Text>
        }
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#f5f5f5',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 20,
    color: '#333',
  },
  statusContainer: {
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 8,
    marginBottom: 20,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  statusLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  statusContent: {
    marginTop: 5,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusValue: {
    fontSize: 16,
    fontWeight: '500',
  },
  buttonContainer: {
    flexDirection: 'column',
    marginBottom: 20,
  },
  button: {
    backgroundColor: '#2196F3',
    paddingVertical: 15,
    paddingHorizontal: 20,
    borderRadius: 8,
    marginBottom: 10,
    alignItems: 'center',
  },
  disconnectButton: {
    backgroundColor: '#F44336',
  },
  testButton: {
    backgroundColor: '#4CAF50',
  },
  connectionTestButton: {
    backgroundColor: '#9C27B0',
  },
  bufferButton: {
    backgroundColor: '#FF9800',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#333',
  },
  deviceList: {
    flex: 1,
  },
  deviceItem: {
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 8,
    marginBottom: 10,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  connectedDevice: {
    borderLeftWidth: 4,
    borderLeftColor: '#4CAF50',
  },
  deviceName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  deviceAddress: {
    fontSize: 14,
    color: '#666',
    marginTop: 3,
  },
  deviceStatus: {
    fontSize: 14,
    marginTop: 5,
    fontWeight: '500',
  },
  connectingText: {
    fontSize: 12,
    color: '#FF9800',
    marginTop: 3,
    fontStyle: 'italic',
  },
  emptyMessage: {
    textAlign: 'center',
    color: '#666',
    fontSize: 16,
    marginTop: 20,
  },
});

export default BluetoothPrinter;