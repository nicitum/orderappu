import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import Catalogue from './Catalogue';
import CartCustomer from './CartCustomer';

const Stack = createStackNavigator();

const CatalogueStack = () => (
  <Stack.Navigator screenOptions={{ headerShown: false }}>
    <Stack.Screen name="CatalogueMain" component={Catalogue} />
    <Stack.Screen name="CartCustomer" component={CartCustomer} />
  </Stack.Navigator>
);

export default CatalogueStack; 