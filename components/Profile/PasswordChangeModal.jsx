import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Modal,
  StyleSheet,
  Alert,
  ActivityIndicator,
  ToastAndroid,
  Platform,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import MaterialIcons from "react-native-vector-icons/MaterialIcons";
import axios from "axios";
import { ipAddress } from "../../services/urls";
import { checkTokenAndRedirect } from "../../services/auth";
import { useNavigation } from "@react-navigation/native";
import { useFontScale } from '../../App';

const PasswordChangeModal = ({ isVisible, onClose }) => {
  const { getScaledSize } = useFontScale();
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showOldPassword, setShowOldPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const navigation = useNavigation();

  const clearState = () => {
    setOldPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setShowOldPassword(false);
    setShowNewPassword(false);
    setShowConfirmPassword(false);
    setLoading(false);
  };

  // Clear state when modal closes
  useEffect(() => {
    if (!isVisible) {
      clearState();
    }
  }, [isVisible]);

  const showToast = (message) => {
    if (Platform.OS === 'android') {
      ToastAndroid.show(message, ToastAndroid.LONG);
    } else {
      Alert.alert('Success', message);
    }
  };

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
      Alert.alert("Error", "All fields are required.");
      return;
    }

    if (!validateNewPassword(newPassword)) {
      return;
    }

    if (newPassword !== confirmPassword) {
      Alert.alert("Error", "New password and confirm password do not match.");
      return;
    }

    try {
      setLoading(true);

      const userAuthToken = await checkTokenAndRedirect(navigation);
      if (!userAuthToken) {
        Alert.alert("Error", "User authentication token is missing.");
        return;
      }

      const response = await axios.post(
        `http://${ipAddress}:8091/changePass`,
        { oldPassword, newPassword },
        {
          headers: {
            Authorization: `Bearer ${userAuthToken}`,
          },
        }
      );

      if (response.data.status) {
        showToast("Password changed successfully");
        clearState(); // Clear state after successful password change
        onClose();
      } else {
        Alert.alert("Error", response.data.message || "Check your old password and try again!!!.");
      }
    } catch (error) {
      console.error("Error changing password:", error);
      Alert.alert("Error", "Check your old password and try again!!!");
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    clearState(); // Clear state when manually closing the modal
    onClose();
  };

  return (
    <Modal visible={isVisible} transparent animationType="fade">
      <View style={styles.modalContainer}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, { fontSize: getScaledSize(24) }]}>Change Password</Text>
            <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
              <MaterialIcons name="close" size={24} color="#666666" />
            </TouchableOpacity>
          </View>

          <View style={styles.inputContainer}>
            <Text style={[styles.label, { fontSize: getScaledSize(14) }]}>Current Password</Text>
            <View style={styles.passwordInput}>
              <TextInput
                style={[styles.input, { fontSize: getScaledSize(16) }]}
                placeholder="Enter current password"
                secureTextEntry={!showOldPassword}
                value={oldPassword}
                onChangeText={setOldPassword}
                placeholderTextColor="#999999"
              />
              <TouchableOpacity 
                onPress={() => setShowOldPassword(!showOldPassword)}
                style={styles.eyeIcon}
              >
                <MaterialIcons 
                  name={showOldPassword ? "visibility" : "visibility-off"} 
                  size={20} 
                  color="#666666" 
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
                secureTextEntry={!showNewPassword}
                value={newPassword}
                onChangeText={setNewPassword}
                placeholderTextColor="#999999"
              />
              <TouchableOpacity 
                onPress={() => setShowNewPassword(!showNewPassword)}
                style={styles.eyeIcon}
              >
                <MaterialIcons 
                  name={showNewPassword ? "visibility" : "visibility-off"} 
                  size={20} 
                  color="#666666" 
                />
              </TouchableOpacity>
            </View>
            <Text style={[styles.helperText, { fontSize: getScaledSize(12) }]}>
              Password must contain:{'\n'}
              - At least 8 characters{'\n'}
              - One uppercase letter{'\n'}
              - One lowercase letter{'\n'}
              - One number{'\n'}
              - One special character (!@#$%^&*(),.?":{'{'}|{'>'})
            </Text>
          </View>

          <View style={styles.inputContainer}>
            <Text style={[styles.label, { fontSize: getScaledSize(14) }]}>Confirm New Password</Text>
            <View style={styles.passwordInput}>
              <TextInput
                style={[styles.input, { fontSize: getScaledSize(16) }]}
                placeholder="Confirm new password"
                secureTextEntry={!showConfirmPassword}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                placeholderTextColor="#999999"
              />
              <TouchableOpacity 
                onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                style={styles.eyeIcon}
              >
                <MaterialIcons 
                  name={showConfirmPassword ? "visibility" : "visibility-off"} 
                  size={20} 
                  color="#666666" 
                />
              </TouchableOpacity>
            </View>
          </View>

          <TouchableOpacity
            style={[styles.submitButton, loading && styles.submitButtonDisabled]}
            onPress={handlePasswordChange}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <>
                <MaterialIcons name="lock" size={20} color="#FFFFFF" />
                <Text style={[styles.submitButtonText, { fontSize: getScaledSize(16) }]}>Update Password</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.5)",
  },
  modalContent: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    width: "90%",
    maxWidth: 400,
    padding: 24,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  modalTitle: {
    fontWeight: "600",
    color: "#003366",
  },
  closeButton: {
    padding: 8,
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
    borderColor: "#E0E0E0",
    borderRadius: 8,
    paddingHorizontal: 12,
  },
  input: {
    flex: 1,
    height: 48,
    color: "#333333",
  },
  eyeIcon: {
    padding: 8,
  },
  helperText: {
    color: "#666666",
    marginTop: 4,
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: "#003366",
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 16,
  },
  submitButtonDisabled: {
    opacity: 0.7,
  },
  submitButtonText: {
    color: "#FFFFFF",
    fontWeight: "600",
    marginLeft: 8,
  },
});

export default PasswordChangeModal;
