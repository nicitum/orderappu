import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Alert,
  PermissionsAndroid,
  Platform,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import RNBluetoothClassic, {
  BluetoothDevice,
} from 'react-native-bluetooth-classic';

const BluetoothPrinter = () => {
  const [pairedDevices, setPairedDevices] = useState([]);
  const [connectedDevice, setConnectedDevice] = useState(null);
  const [isScanning, setIsScanning] = useState(false);

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
    } catch (error) {
      console.log('Error getting paired devices:', error);
      Alert.alert('Error', 'Failed to get paired devices');
    }
  };

  // Connect to a Bluetooth device
  const connectToDevice = async (device) => {
    try {
      // Disconnect from any currently connected device
      if (connectedDevice) {
        await RNBluetoothClassic.disconnectFromDevice(connectedDevice.id);
      }
      
      // Connect to the new device
      const connection = await RNBluetoothClassic.connectToDevice(device.id, {
        DELIMITER: '\n', // Set delimiter if needed
      });
      
      setConnectedDevice(device);
      Alert.alert('Success', `Connected to ${device.name}`);
    } catch (error) {
      console.log('Connection error:', error);
      Alert.alert('Error', `Failed to connect to ${device.name}: ${error.message}`);
    }
  };

  // Disconnect from the current device
  const disconnectDevice = async () => {
    try {
      if (connectedDevice) {
        await RNBluetoothClassic.disconnectFromDevice(connectedDevice.id);
        setConnectedDevice(null);
        Alert.alert('Disconnected', 'Printer disconnected successfully');
      }
    } catch (error) {
      console.log('Disconnection error:', error);
      Alert.alert('Error', 'Failed to disconnect');
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

  // Print invoice function for POS receipts
  // Scan for new devices
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
      await getPairedDevices();
      
      // Check for already connected devices
      const connectedDevices = await RNBluetoothClassic.getConnectedDevices();
      if (connectedDevices.length > 0) {
        // If we don't have a connected device set, or if it's different from the first connected device
        if (!connectedDevice || connectedDevice.id !== connectedDevices[0].id) {
          // Set the first connected device as the active device
          setConnectedDevice(connectedDevices[0]);
        }
      } else if (connectedDevice) {
        // If no devices are connected but we thought one was, clear the state
        setConnectedDevice(null);
      }
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
      onPress={() => connectToDevice(item)}>
      <Text style={styles.deviceName}>{item.name}</Text>
      <Text style={styles.deviceAddress}>{item.address || item.id}</Text>
      <Text style={styles.deviceStatus}>
        {connectedDevice && connectedDevice.id === item.id ? '● Connected' : '○ Disconnected'}
      </Text>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Bluetooth Printer Setup</Text>
      
      <View style={styles.statusContainer}>
        <Text style={styles.statusLabel}>Connection Status:</Text>
        <Text style={[styles.statusValue, connectedDevice ? styles.connected : styles.disconnected]}>
          {connectedDevice ? `Connected to ${connectedDevice.name}` : 'Not Connected'}
        </Text>
      </View>
      
      <View style={styles.buttonContainer}>
        <TouchableOpacity style={styles.button} onPress={scanForDevices} disabled={isScanning}>
          <Text style={styles.buttonText}>
            {isScanning ? 'Scanning...' : 'Scan for Devices'}
          </Text>
        </TouchableOpacity>
        
        {connectedDevice && (
          <TouchableOpacity style={[styles.button, styles.disconnectButton]} onPress={disconnectDevice}>
            <Text style={styles.buttonText}>Disconnect</Text>
          </TouchableOpacity>
        )}
        
        <TouchableOpacity 
          style={[styles.button, styles.testButton]} 
          onPress={testPrint}
          disabled={!connectedDevice}>
          <Text style={styles.buttonText}>Test Print</Text>
        </TouchableOpacity>

        {/* Alternative print button */}
        <TouchableOpacity 
          style={[styles.button, styles.bufferButton]} 
          onPress={testPrintWithBuffer}
          disabled={!connectedDevice}>
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
  statusValue: {
    fontSize: 16,
    marginTop: 5,
    fontWeight: '500',
  },
  connected: {
    color: '#4CAF50',
  },
  disconnected: {
    color: '#F44336',
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
  emptyMessage: {
    textAlign: 'center',
    color: '#666',
    fontSize: 16,
    marginTop: 20,
  },
});

export default BluetoothPrinter;