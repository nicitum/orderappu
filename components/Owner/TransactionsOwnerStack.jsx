import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import TransactionsOwner from './TransactionsOwner';
import OrderAcceptSA from './OrderAcceptSA';
import InvoiceOwner from './InvoiceSA';

const Stack = createStackNavigator();

const TransactionsOwnerStack = () => (
  <Stack.Navigator screenOptions={{ headerShown: false }}>
    <Stack.Screen name="TransactionsOwner" component={TransactionsOwner} />
    <Stack.Screen name="OrderAcceptSA" component={OrderAcceptSA} />
    <Stack.Screen name="InvoiceOwner" component={InvoiceOwner} />
    
  </Stack.Navigator>
);

export default TransactionsOwnerStack; 