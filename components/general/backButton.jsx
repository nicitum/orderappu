import React from "react";
import { TouchableOpacity, Text, StyleSheet } from "react-native";
import Icon from "react-native-vector-icons/MaterialIcons";
import { useFontScale } from '../../App';

const BackButton = ({ navigation }) => {
  const { getScaledSize } = useFontScale();
  return (
    <TouchableOpacity
      style={styles.headerText}
      onPress={() => navigation.goBack()}
    >
      <Icon name="arrow-back" size={24} color="#003366" />
      <Text style={[styles.backButtonText, { fontSize: getScaledSize(18) }]}>Back</Text>
    </TouchableOpacity>
  );
};

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
    fontWeight: "600",
    marginLeft: 8,
  },
});

export default BackButton;
