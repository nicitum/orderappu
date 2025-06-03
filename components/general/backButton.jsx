import React from "react";
import { TouchableOpacity, Text, StyleSheet } from "react-native";
import Icon from "react-native-vector-icons/MaterialIcons";

const BackButton = ({ navigation }) => (
  <TouchableOpacity
    style={styles.headerText}
    onPress={() => navigation.goBack()}
  >
    <Icon name="arrow-back" size={24} color="#003366" />
    <Text style={styles.backButtonText}>Back</Text>
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  headerText: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 30,
    paddingBottom: 10,
  },
  backButtonText: {
    color: "#003366",
    fontSize: 18,
    fontWeight: "600",
    marginLeft: 8,
  },
});

export default BackButton;
