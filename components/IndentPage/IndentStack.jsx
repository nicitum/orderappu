import React from "react";
import { createStackNavigator } from "@react-navigation/stack";
import IndentPage from "./indent"
import PlaceOrderPage from "./placeOrder";
import UpdateOrdersU from "./UpdateOrdersU";
import PlaceIndent from "./PlaceIndent";

const Stack = createStackNavigator();

const IndentStack = () => {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false, // You can change this if you want a header
      }}
    >
      {/* Main Indent page */}
      <Stack.Screen name="IndentPage" component={IndentPage} />

      {/* Order details page */}
      <Stack.Screen name="PlaceOrderPage" component={PlaceOrderPage} />

      <Stack.Screen name="UpdateOrdersPage" component={UpdateOrdersU} />

      {/* Admin Place Order page */}
      <Stack.Screen name="PlaceIndent" component={PlaceIndent} />
    </Stack.Navigator>
  );
};

export default IndentStack;
