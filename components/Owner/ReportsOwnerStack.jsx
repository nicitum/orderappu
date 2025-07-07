import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import ReportsOwner from './ReportsOwner';
import InvoiceSA from './InvoiceSA';
import OrderHistoryOwner from './OrderHistoryOwner';
import OwnerCartPage from './OwnerCartPage';


const Stack = createStackNavigator();

const ReportsOwnerStack = () => (
  <Stack.Navigator screenOptions={{ headerShown: false }}>
    <Stack.Screen name="ReportsOwner" component={ReportsOwner} />
    <Stack.Screen name="InvoiceSA" component={InvoiceSA} />
    <Stack.Screen name="OrderHistoryOwner" component={OrderHistoryOwner} />
    <Stack.Screen name="OwnerCartPage" component={OwnerCartPage} />
  </Stack.Navigator>
);

export default ReportsOwnerStack; 