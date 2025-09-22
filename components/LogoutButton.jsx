import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useNavigation } from "@react-navigation/native";
import MaterialIcons from "react-native-vector-icons/MaterialIcons";
import { jwtDecode } from "jwt-decode";
import { ipAddress } from "../services/urls";
import { useFontScale } from '../App';

const LogOutButton = () => {
  const navigation = useNavigation();
  const { getScaledSize } = useFontScale();

  const handleLogout = async () => {
    try {
      // Get the token before removing it
      const token = await AsyncStorage.getItem("userAuthToken");
      
      if (token) {
        try {
          // Decode token to get customer_id
          const decodedToken = jwtDecode(token);
          const customer_id = decodedToken.id;
          
          if (customer_id) {
            // Call logout API to clear user_token from database
            const response = await fetch(`http://${ipAddress}:8091/logout`, {
              method: "POST",
              headers: {
                "Authorization": `Bearer ${token}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                customer_id: customer_id,
              }),
            });
            
            if (!response.ok) {
              console.warn("Logout API failed:", response.status);
              // Continue with local logout even if API fails
            } else {
              const data = await response.json();
              console.log("Logout API success:", data.message);
            }
          }
        } catch (apiError) {
          console.warn("Error calling logout API:", apiError);
          // Continue with local logout even if API fails
        }
      }
      
      // Remove the token from AsyncStorage
      await AsyncStorage.removeItem("userAuthToken");

      // Navigate to Login screen after logout
      navigation.replace("Login"); // This ensures that the user cannot go back to the previous screen
    } catch (error) {
      console.error("Error during logout:", error);
      // Even if there's an error, try to navigate to login
      navigation.replace("Login");
    }
  };

  return (
    <TouchableOpacity 
      style={styles.logoutButton} 
      onPress={handleLogout}
      activeOpacity={0.7}
    >
      <MaterialIcons name="logout" size={24} color="#FFFFFF" />
      <Text style={[styles.logoutButtonText, { fontSize: getScaledSize(16) }]}>Logout</Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  logoutButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: "#E74C3C",
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
  logoutButtonText: {
    color: "#FFFFFF",
    fontWeight: "600",
    marginLeft: 8,
  },
});

export default LogOutButton;