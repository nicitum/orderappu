import React, { useState } from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { ipAddress } from '../services/urls';
import { useFontScale } from '../App';

const FirstTimePasswordChangeModal = ({ isVisible, onClose, onSuccess, username, tempToken }) => {
  const { getScaledSize } = useFontScale();
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showOldPassword, setShowOldPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const validateNewPassword = (password) => {
    const hasMinLength = password.length >= 8;
    const hasUpperCase = /[A-Z]/.test(password);
    const hasLowerCase = /[a-z]/.test(password);
    const hasNumber = /[0-9]/.test(password);
    const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);

    if (!hasMinLength) {
      Alert.alert("Error", "Password must be at least 8 characters long.");
      return false;
    }
    if (!hasUpperCase) {
      Alert.alert("Error", "Password must contain at least one uppercase letter.");
      return false;
    }
    if (!hasLowerCase) {
      Alert.alert("Error", "Password must contain at least one lowercase letter.");
      return false;
    }
    if (!hasNumber) {
      Alert.alert("Error", "Password must contain at least one number.");
      return false;
    }
    if (!hasSpecialChar) {
      Alert.alert("Error", "Password must contain at least one special character (!@#$%^&*(),.?\":{}|<>).");
      return false;
    }
    return true;
  };

  const handlePasswordChange = async () => {
    if (!oldPassword || !newPassword || !confirmPassword) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    if (!validateNewPassword(newPassword)) {
      return;
    }

    if (newPassword !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match');
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch(`http://${ipAddress}:8091/changePass`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${tempToken}`,
        },
        body: JSON.stringify({
          oldPassword,
          newPassword,
        }),
      });

      const data = await response.json();
      
      if (response.ok && data.status) {
        Alert.alert('Success', 'Password changed successfully');
        onSuccess();
      } else {
        Alert.alert('Error', data.message || 'Failed to change password');
      }
    } catch (error) {
      console.error('Password change error:', error);
      Alert.alert('Error', 'Failed to change password. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal
      visible={isVisible}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.header}>
            <Text style={[styles.title, { fontSize: getScaledSize(20) }]}>Change Password</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Icon name="close" size={24} color="#666" />
            </TouchableOpacity>
          </View>

          <Text style={[styles.subtitle, { fontSize: getScaledSize(14) }]}>
            This is your first login. Please set a new password to continue.
          </Text>

          <View style={styles.inputContainer}>
            <Text style={[styles.label, { fontSize: getScaledSize(14) }]}>Current Password</Text>
            <View style={styles.passwordInput}>
              <TextInput
                style={[styles.input, { fontSize: getScaledSize(16) }]}
                placeholder="Enter current password"
                value={oldPassword}
                onChangeText={setOldPassword}
                secureTextEntry={!showOldPassword}
                placeholderTextColor="#999"
              />
              <TouchableOpacity
                onPress={() => setShowOldPassword(!showOldPassword)}
                style={styles.eyeButton}
              >
                <Icon
                  name={showOldPassword ? "visibility" : "visibility-off"}
                  size={20}
                  color="#666"
                />
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.inputContainer}>
            <Text style={[styles.label, { fontSize: getScaledSize(14) }]}>New Password</Text>
            <View style={styles.passwordInput}>
              <TextInput
                style={[styles.input, { fontSize: getScaledSize(16) }]}
                placeholder="Enter new password"
                value={newPassword}
                onChangeText={setNewPassword}
                secureTextEntry={!showNewPassword}
                placeholderTextColor="#999"
              />
              <TouchableOpacity
                onPress={() => setShowNewPassword(!showNewPassword)}
                style={styles.eyeButton}
              >
                <Icon
                  name={showNewPassword ? "visibility" : "visibility-off"}
                  size={20}
                  color="#666"
                />
              </TouchableOpacity>
            </View>
            <Text style={[styles.helperText, { fontSize: getScaledSize(12) }]}>
              Password must contain:{'\n'}
              - At least 8 characters{'\n'}
              - One uppercase letter{'\n'}
              - One lowercase letter{'\n'}
              - One number{'\n'}
              - One special character (!@#$%^&*(),.?":{'{}'}|{'<>'})
            </Text>
          </View>

          <View style={styles.inputContainer}>
            <Text style={[styles.label, { fontSize: getScaledSize(14) }]}>Confirm New Password</Text>
            <View style={styles.passwordInput}>
              <TextInput
                style={[styles.input, { fontSize: getScaledSize(16) }]}
                placeholder="Confirm new password"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry={!showConfirmPassword}
                placeholderTextColor="#999"
              />
              <TouchableOpacity
                onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                style={styles.eyeButton}
              >
                <Icon
                  name={showConfirmPassword ? "visibility" : "visibility-off"}
                  size={20}
                  color="#666"
                />
              </TouchableOpacity>
            </View>
          </View>

          <TouchableOpacity
            style={[styles.button, isLoading && styles.buttonDisabled]}
            onPress={handlePasswordChange}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={[styles.buttonText, { fontSize: getScaledSize(16) }]}>Change Password</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    width: '90%',
    maxWidth: 400,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontWeight: 'bold',
    color: '#333',
  },
  closeButton: {
    padding: 5,
  },
  subtitle: {
    color: '#666',
    marginBottom: 20,
    lineHeight: 20,
  },
  inputContainer: {
    marginBottom: 20,
  },
  label: {
    color: "#666666",
    marginBottom: 8,
  },
  passwordInput: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 12,
  },
  input: {
    flex: 1,
    height: 50,
  },
  eyeButton: {
    padding: 8,
  },
  helperText: {
    color: "#666666",
    marginTop: 4,
  },
  button: {
    backgroundColor: '#003366',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
});

export default FirstTimePasswordChangeModal; 