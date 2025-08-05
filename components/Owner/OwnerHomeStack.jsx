import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import OwnerHomePage from './OwnerHomePage';

const Stack = createStackNavigator();

const OwnerHomeStack = () => (
  <Stack.Navigator screenOptions={{ headerShown: false }}>
    <Stack.Screen name="OwnerHomePage" component={OwnerHomePage} />
  </Stack.Navigator>
);

export default OwnerHomeStack; 