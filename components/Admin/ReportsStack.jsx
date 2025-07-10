import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import ReportsAdmin from './ReportsAdmin';
import AdminOrderHistory from './AdminOrderHistory';
import AdminCartPage from './AdminCartPage';
import AdminOrderStatus from './AdminOrderStatus';



const Stack = createStackNavigator();

const ReportsStack = () => {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
      }}
    >
      <Stack.Screen name="ReportsAdmin" component={ReportsAdmin} />
      <Stack.Screen name="AdminOrderHistory" component={AdminOrderHistory} />
      <Stack.Screen name="AdminCartPage" component={AdminCartPage} />
      <Stack.Screen name="AdminOrderStatus" component={AdminOrderStatus} />
     


    </Stack.Navigator>
  );
};

export default ReportsStack; 