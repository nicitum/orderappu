import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import TransactionsAdmin from './TransactionsAdmin';
import PlaceOrderAdmin from './PlaceOrderAdmin';
import InvoiceAdmin from './InvoiceAdmin';
import AdminOrderHistory from './AdminOrderHistory';
import AdminCartPage from './AdminCartPage';
import OrderAcceptAdmin from './OrderAcceptAdmin';
import AdminOrderStatus from './AdminOrderStatus';

const Stack = createStackNavigator();

const AdminStack = () => {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
      }}
    >
      <Stack.Screen name="TransactionsAdmin" component={TransactionsAdmin} />
      <Stack.Screen name="PlaceOrderAdmin" component={PlaceOrderAdmin} />
      <Stack.Screen name="InvoicePage" component={InvoiceAdmin} />
      <Stack.Screen name="AdminOrderHistory" component={AdminOrderHistory} />
      <Stack.Screen name="AdminCartPage" component={AdminCartPage} />
      <Stack.Screen name="OrderAcceptAdmin" component={OrderAcceptAdmin} />
      <Stack.Screen name="AdminOrderStatus" component={AdminOrderStatus} />
    </Stack.Navigator>
  );
};

export default AdminStack; 