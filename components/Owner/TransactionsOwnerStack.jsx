import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import TransactionsOwner from './TransactionsOwner';
import OrderAcceptOwner from './OrderAcceptOwner';
import InvoiceOwner from './InvoiceSA';
import PlaceOrderOwner from './PlaceOrderOwner';
import OwnerCartPage from './OwnerCartPage';
import OrderHistoryOwner from './OrderHistoryOwner';
import OwnerOrderUpdate from './OwnerOrderUpdate.jsx';

const Stack = createStackNavigator();

const TransactionsOwnerStack = () => (
  <Stack.Navigator screenOptions={{ headerShown: false }}>
    <Stack.Screen name="TransactionsOwner" component={TransactionsOwner} />
    <Stack.Screen name="OrderAcceptOwner" component={OrderAcceptOwner} />
    <Stack.Screen name="InvoiceOwner" component={InvoiceOwner} />
    <Stack.Screen name="PlaceOrderOwner" component={PlaceOrderOwner} />
    <Stack.Screen name="OwnerCartPage" component={OwnerCartPage} />
    <Stack.Screen name="OrderHistoryOwner" component={OrderHistoryOwner} />
    <Stack.Screen name="OwnerOrderUpdate" component={OwnerOrderUpdate} />
  </Stack.Navigator>
);

export default TransactionsOwnerStack; 