import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import TransactionsAdmin from './TransactionsAdmin';
import PlaceIndent from '../IndentPage/PlaceIndent';
import InvoicePage from './Invoice';
import AdminOrderHistory from '../Profile/AdminOrderHistory';
import AdminCartPage from '../Profile/AdminCartPage';

const Stack = createStackNavigator();

const AdminStack = () => {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
      }}
    >
      <Stack.Screen name="TransactionsAdmin" component={TransactionsAdmin} />
      <Stack.Screen name="PlaceIndent" component={PlaceIndent} />
      <Stack.Screen name="InvoicePage" component={InvoicePage} />
      <Stack.Screen name="AdminOrderHistory" component={AdminOrderHistory} />
      <Stack.Screen name="AdminCartPage" component={AdminCartPage} />
    </Stack.Navigator>
  );
};

export default AdminStack; 