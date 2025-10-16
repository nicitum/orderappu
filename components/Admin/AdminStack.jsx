import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import TransactionsAdmin from './TransactionsAdmin';
import PlaceOrderAdmin from './PlaceOrderAdmin';

import AdminOrderHistory from './AdminOrderHistory';
import AdminCartPage from './AdminCartPage';
import OrderAcceptAdmin from './OrderAcceptAdmin';
import AdminOrderStatus from './AdminOrderStatus';
import AdminOrderUpdate from './AdminOrderUpdate';
import { InvoiceDirect } from './Invoice'; // Import the InvoiceDirect component
// InvoiceSummary import removed since it's now accessed through Reports section

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
 
      <Stack.Screen name="AdminOrderHistory" component={AdminOrderHistory} />
      <Stack.Screen name="AdminCartPage" component={AdminCartPage} />
      <Stack.Screen name="OrderAcceptAdmin" component={OrderAcceptAdmin} />
      <Stack.Screen name="AdminOrderStatus" component={AdminOrderStatus} />
      <Stack.Screen name="AdminOrderUpdate" component={AdminOrderUpdate} />
      <Stack.Screen name="InvoiceDirect" component={InvoiceDirect} />
      {/* InvoiceSummary screen removed since it's now accessed through Reports section */}
    </Stack.Navigator>
  );
};

export default AdminStack;