import React from "react";
import { ScrollView, StyleSheet, View, Text, TouchableOpacity } from "react-native";
import OrderCard from "./orderCard";
import Toast from "react-native-toast-message";
import MaterialIcons from "react-native-vector-icons/MaterialIcons";

const showToast = (message, type = "info") => {
  Toast.show({
    type,
    text1: type === "info" ? "Order Information" : "Time Restriction",
    text2: message,
    position: "top",
    visibilityTime: 3000,
    autoHide: true,
    topOffset: 50,
    props: {
      text2Style: { flexWrap: "wrap", width: "100%" },
    },
  });
};

const OrdersList = ({ orders, selectedDate, navigation }) => {
  const handleOrderClick = async (order) => {
    try {
      if (order) {
        navigation.navigate("UpdateOrdersPage", { order, selectedDate });
        showToast(`Navigating to update existing order.`);
        return;
      }
    } catch (error) {
      console.error("Error navigating to update order:", error);
      showToast("Could not process request. Please try again later.", "error");
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Today's Orders</Text>
        <View style={styles.dateContainer}>
          <MaterialIcons name="event" size={20} color="#003366" />
          <Text style={styles.dateText}>
            {new Date(selectedDate).toLocaleDateString('en-US', {
              weekday: 'long',
              month: 'long',
              day: 'numeric',
              year: 'numeric'
            })}
          </Text>
        </View>
      </View>

      <ScrollView
        style={styles.scrollContainer}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {orders.map((order, index) => (
          <OrderCard
            key={order.id || index}
            order={order}
            selectedDate={selectedDate}
            onOrderClick={() => handleOrderClick(order)}
          />
        ))}
        {orders.length === 0 && (
          <View style={styles.noOrdersContainer}>
            <MaterialIcons name="shopping-basket" size={48} color="#ccc" />
            <Text style={styles.noOrdersText}>No orders placed for this date</Text>
          </View>
        )}
      </ScrollView>
      <Toast />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f7fa",
  },
  header: {
    backgroundColor: "#ffffff",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#003366",
    marginBottom: 8,
  },
  dateContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f0f4f8",
    padding: 8,
    borderRadius: 8,
  },
  dateText: {
    fontSize: 16,
    color: "#003366",
    marginLeft: 8,
    fontWeight: "500",
  },
  scrollContainer: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  noOrdersContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    backgroundColor: '#fff',
    borderRadius: 12,
    margin: 16,
  },
  noOrdersText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  }
});

export default OrdersList;