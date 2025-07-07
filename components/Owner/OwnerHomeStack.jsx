import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import AdminHomePage from './AdminHomePage';

const Stack = createStackNavigator();

const OwnerHomeStack = () => (
  <Stack.Navigator screenOptions={{ headerShown: false }}>
    <Stack.Screen name="AdminHomePage" component={AdminHomePage} />
  </Stack.Navigator>
);

export default OwnerHomeStack; 