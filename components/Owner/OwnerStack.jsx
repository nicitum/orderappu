import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import AdminHomePage from './AdminHomePage';
import ProductList from './ProductList';
import TransactionsOwner from './TransactionsOwner';
import OrderAcceptSA from './OrderAcceptSA';
import InvoiceDisplay from './InvoiceDisplay';
import OrderHistoryOwner from './OrderHistoryOwner';
import ReportsOwner from './ReportsOwner';
import InvoiceSA from './InvoiceSA';
import OwnerCartPage from './OwnerCartPage';

const Stack = createStackNavigator();

const OwnerStack = () => (
  <Stack.Navigator screenOptions={{ headerShown: false }}>
    <Stack.Screen name="AdminHomePage" component={AdminHomePage} />
    <Stack.Screen name="ProductList" component={ProductList} />
    <Stack.Screen name="TransactionsOwner" component={TransactionsOwner} />
    <Stack.Screen name="OrderAcceptSA" component={OrderAcceptSA} />
    <Stack.Screen name="InvoiceDisplay" component={InvoiceDisplay} />
    <Stack.Screen name="OrderHistoryOwner" component={OrderHistoryOwner} />
    <Stack.Screen name="ReportsOwner" component={ReportsOwner} />
    <Stack.Screen name="InvoiceSA" component={InvoiceSA} />
    <Stack.Screen name="OwnerCartPage" component={OwnerCartPage} />
  </Stack.Navigator>
);

export default OwnerStack; 