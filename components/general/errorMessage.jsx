import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { useFontScale } from '../../App';

const ErrorMessage = ({ message }) => {
  const { getScaledSize } = useFontScale();
  return (
    <View style={styles.errorContainer}>
      <Text style={[styles.errorText, { fontSize: getScaledSize(16) }]}>{message}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  errorContainer: {
    padding: 10,
    margin: 10,
    alignItems: "center",
  },
  errorText: {
    color: "red",
  },
});

export default ErrorMessage;
