import React from "react";
import { TouchableOpacity, StyleSheet } from "react-native";
import MaterialIcons from "react-native-vector-icons/MaterialIcons";

const RefreshButton = ({ onRefresh }) => {
  return (
    <TouchableOpacity 
      style={styles.refreshButton} 
      onPress={onRefresh}
      activeOpacity={0.7}
    >
      <MaterialIcons name="refresh" size={24} color="#003366" />
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  refreshButton: {
    padding: 12,
    backgroundColor: '#F5F7FA',
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
});

export default RefreshButton;
