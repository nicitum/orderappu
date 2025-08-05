import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import ReportsOwner from './ReportsOwner';
import InvoiceSA from './InvoiceSA';
import OrderHistoryOwner from './OrderHistoryOwner';
import OwnerCartPage from './OwnerCartPage';
import OwnerOrderStatus from './OwnerOrderStatus';


const Stack = createStackNavigator();

const ReportsOwnerStack = () => (
  <Stack.Navigator 
    screenOptions={{ headerShown: false }}
    initialRouteName="ReportsOwner"
  >
    <Stack.Screen name="ReportsOwner" component={ReportsOwner} />
    <Stack.Screen name="InvoiceSA" component={InvoiceSA} />
    <Stack.Screen name="OrderHistoryOwner" component={OrderHistoryOwner} />
    <Stack.Screen name="OwnerCartPage" component={OwnerCartPage} />
    <Stack.Screen name="OwnerOrderStatus" component={OwnerOrderStatus} />

  </Stack.Navigator>
);

export default ReportsOwnerStack; 