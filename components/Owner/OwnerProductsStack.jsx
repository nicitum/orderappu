import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import ProductList from './ProductList';

const Stack = createStackNavigator();

const OwnerProductsStack = () => (
  <Stack.Navigator screenOptions={{ headerShown: false }}>
    <Stack.Screen name="ProductList" component={ProductList} />
  </Stack.Navigator>
);

export default OwnerProductsStack; 