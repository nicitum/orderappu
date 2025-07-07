import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import ReportsCustomer from './ReportsCustomer';
import CustomerInvoicePage from './CustomerInvoicePage';
import OrdersHistory from './OrdersHistory';
import CartCustomer from './CartCustomer';

const Stack = createStackNavigator();

const ReportsCustomerStack = () => (
  <Stack.Navigator screenOptions={{ headerShown: false }}>
    <Stack.Screen name="ReportsCustomer" component={ReportsCustomer} />
    <Stack.Screen name="CustomerInvoicePage" component={CustomerInvoicePage} />
    <Stack.Screen name="OrdersHistory" component={OrdersHistory} />
    <Stack.Screen name="CartCustomer" component={CartCustomer} />
  </Stack.Navigator>
);

export default ReportsCustomerStack; 