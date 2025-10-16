import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import OwnerHomePage from './OwnerHomePage';
import ProductList from './ProductList';
import TransactionsOwner from './TransactionsOwner';
import OrderAcceptOwner from './OrderAcceptOwner';
import InvoiceDisplay from './InvoiceDisplay';
import OrderHistoryOwner from './OrderHistoryOwner';
import ReportsOwner from './ReportsOwner';
import InvoiceSA from './InvoiceSA';
import OwnerCartPage from './OwnerCartPage';
import PlaceOrderOwner from './PlaceOrderOwner';
import OwnerOrderUpdate from './OwnerOrderUpdate.jsx';
import InvoiceDirect from './Invoice/InvoiceDirect';
// Removed WalkIn import

const Stack = createStackNavigator();

const OwnerStack = () => (
  <Stack.Navigator screenOptions={{ headerShown: false }}>
    <Stack.Screen name="OwnerHomePage" component={OwnerHomePage} />
    <Stack.Screen name="ProductList" component={ProductList} />
    <Stack.Screen name="TransactionsOwner" component={TransactionsOwner} />
    <Stack.Screen name="OrderAcceptOwner" component={OrderAcceptOwner} />
    <Stack.Screen name="InvoiceDisplay" component={InvoiceDisplay} />
    <Stack.Screen name="OrderHistoryOwner" component={OrderHistoryOwner} />
    <Stack.Screen name="ReportsOwner" component={ReportsOwner} />
    <Stack.Screen name="InvoiceSA" component={InvoiceSA} />
    <Stack.Screen name="OwnerCartPage" component={OwnerCartPage} />
    <Stack.Screen name="PlaceOrderOwner" component={PlaceOrderOwner} />
    <Stack.Screen name="OwnerOrderUpdate" component={OwnerOrderUpdate} />
    <Stack.Screen name="InvoiceDirect" component={InvoiceDirect} />
    {/* Removed WalkIn screen */}
  </Stack.Navigator>
);

export default OwnerStack; 