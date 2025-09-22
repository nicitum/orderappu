import React, { useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import PasswordChangeModal from "./Profile/PasswordChangeModal";
import MaterialIcons from "react-native-vector-icons/MaterialIcons";
import { useFontScale } from '../App';

const PasswordChangeButton = () => {
  const { getScaledSize } = useFontScale();
  const [isPasswordModalVisible, setPasswordModalVisible] = useState(false);

  // Password Change Modal handler
  const handlePasswordChange = () => {
    setPasswordModalVisible(true);
  };

  return (
    <>
      <TouchableOpacity
        style={styles.passwordChangeButton}
        onPress={handlePasswordChange}
        activeOpacity={0.7}
      >
        <MaterialIcons name="lock-outline" size={24} color="#FFFFFF" />
        <Text style={[styles.passwordChangeButtonText, { fontSize: getScaledSize(16) }]}>Change Password</Text>
      </TouchableOpacity>

      <PasswordChangeModal
        isVisible={isPasswordModalVisible}
        onClose={() => setPasswordModalVisible(false)}
      />
    </>
  );
};

const styles = StyleSheet.create({
  passwordChangeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: "#003366",
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    marginHorizontal: 5,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  passwordChangeButtonText: {
    color: "#FFFFFF",
    fontWeight: "600",
    marginLeft: 8,
  },
});

export default PasswordChangeButton;
