import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import Catalogue from './Catalogue';
import Cart from './Cart';
import Home from './Home';

const Stack = createStackNavigator();

const CatalogueStack = () => {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="CataloguePage" component={Catalogue} />
      <Stack.Screen name="Cart" component={Cart} />
      <Stack.Screen name="Home" component={Home} />
    </Stack.Navigator>
  );
};

export default CatalogueStack; 