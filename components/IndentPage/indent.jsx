import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { useNavigation } from "@react-navigation/native";
import moment from "moment";
import MaterialIcons from "react-native-vector-icons/MaterialIcons";
import RefreshButton from "../general/RefreshButton";

const IndentPage = () => {
  const navigation = useNavigation();
  const today = moment().format("YYYY-MM-DD");

  const navigateToPlaceOrder = (orderType) => {
    navigation.navigate("PlaceOrderPage", { 
      selectedDate: today,
      orderType 
    });
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <MaterialIcons name="shopping-cart" size={24} color="#FFFFFF" />
          <Text style={styles.headerText}>Place Order</Text>
        </View>
        <RefreshButton onRefresh={() => {}} />
      </View>

      <View style={styles.content}>
        <View style={styles.orderOptionsContainer}>
          <Text style={styles.orderOptionsTitle}>Place New Order</Text>
          <Text style={styles.orderOptionsSubtitle}>
            Date: {moment(today).format("DD MMM YYYY")}
          </Text>
          
          <TouchableOpacity
            style={styles.orderButton}
            onPress={() => navigateToPlaceOrder('fresh')}
          >
            <View style={styles.orderButtonContent}>
              <MaterialIcons name="add-shopping-cart" size={24} color="#FFFFFF" />
              <View style={styles.orderButtonTextContainer}>
                <Text style={styles.orderButtonTitle}>Fresh Order</Text>
                <Text style={styles.orderButtonSubtitle}>Start a new order for today</Text>
              </View>
              <MaterialIcons name="chevron-right" size={24} color="#FFFFFF" />
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.orderButton, styles.recentOrderButton]}
            onPress={() => navigateToPlaceOrder('recent')}
          >
            <View style={styles.orderButtonContent}>
              <MaterialIcons name="history" size={24} color="#FFFFFF" />
              <View style={styles.orderButtonTextContainer}>
                <Text style={styles.orderButtonTitle}>Recent Order</Text>
                <Text style={styles.orderButtonSubtitle}>Place order based on recent order</Text>
              </View>
              <MaterialIcons name="chevron-right" size={24} color="#FFFFFF" />
            </View>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F7F8FA"
  },
  header: {
    backgroundColor: "#003366",
    paddingHorizontal: 20,
    paddingVertical: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center"
  },
  headerContent: {
    flexDirection: "row",
    alignItems: "center"
  },
  headerText: {
    fontSize: 20,
    fontWeight: "600",
    color: "#FFFFFF",
    marginLeft: 12
  },
  content: {
    flex: 1,
    padding: 16,
    justifyContent: "center"
  },
  orderOptionsContainer: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 16
  },
  orderOptionsTitle: {
    fontSize: 24,
    fontWeight: "600",
    color: "#003366",
    marginBottom: 8
  },
  orderOptionsSubtitle: {
    fontSize: 16,
    color: "#666666",
    marginBottom: 24
  },
  orderButton: {
    backgroundColor: "#003366",
    borderRadius: 12,
    marginBottom: 16,
    overflow: "hidden"
  },
  recentOrderButton: {
    backgroundColor: "#1a4971"
  },
  orderButtonContent: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16
  },
  orderButtonTextContainer: {
    flex: 1,
    marginLeft: 12
  },
  orderButtonTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#FFFFFF"
  },
  orderButtonSubtitle: {
    fontSize: 12,
    color: "#FFFFFF",
    opacity: 0.8,
    marginTop: 4
  }
});

export default IndentPage;