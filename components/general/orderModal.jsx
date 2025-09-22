import React from "react";
import { Modal, View, Text, TouchableOpacity, StyleSheet } from "react-native";
import Icon from "react-native-vector-icons/MaterialIcons";
import { useFontScale } from '../../App';

const OrderModal = ({ isVisible, onClose, onSelect, onEdit }) => {
  const { getScaledSize } = useFontScale();
  return (
    <Modal visible={isVisible} animationType="slide" transparent={true}>
      <View style={styles.modalBackground}>
        <View style={styles.modalContainer}>
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Icon name="close" size={24} color="#003366" />
          </TouchableOpacity>

          <Text style={[styles.modalTitle, { fontSize: getScaledSize(22) }]}>Your Order</Text>

          <View style={styles.buttonRow}>
            <TouchableOpacity style={styles.button} onPress={onSelect}>
              <Text style={[styles.buttonText, { fontSize: getScaledSize(16) }]}>Select</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.button} onPress={onEdit}>
              <Text style={[styles.buttonText, { fontSize: getScaledSize(16) }]}>Edit</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalBackground: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  modalContainer: {
    width: 300,
    padding: 20,
    backgroundColor: "#fff",
    borderRadius: 15,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  modalTitle: {
    fontWeight: "600",
    marginBottom: 20,
    color: "#003366",
    textAlign: "center",
  },
  closeButton: {
    position: "absolute",
    top: 15,
    right: 15,
    padding: 5,
  },
  buttonRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: "100%",
    marginTop: 10,
  },
  button: {
    backgroundColor: "#003366",
    borderRadius: 10,
    padding: 12,
    width: "45%",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 3,
  },
  buttonText: {
    color: "#fff",
    fontWeight: "600",
  },
});

export default OrderModal;
