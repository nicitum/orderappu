import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import HomeCustomer from './HomeCustomer';
import CatalogueStack from './CatalogueStack';
import TransactionCustomer from './TransactionCustomer';
import ReportsCustomerStack from './ReportsCustomerStack';
import ProfileStack from '../Profile/ProfileStack';
import CartCustomer from './CartCustomer';
import OrdersHistory from './OrdersHistory';

const Stack = createStackNavigator();

const CustomerStack = () => (
  <Stack.Navigator screenOptions={{ headerShown: false }} initialRouteName="HomeCustomer">
    <Stack.Screen name="HomeCustomer" component={HomeCustomer} />
    <Stack.Screen name="CatalogueStack" component={CatalogueStack} />
    <Stack.Screen name="TransactionCustomer" component={TransactionCustomer} />
    <Stack.Screen name="ReportsCustomerStack" component={ReportsCustomerStack} />
    <Stack.Screen name="ProfileStack" component={ProfileStack} />
    <Stack.Screen name="CartCustomer" component={CartCustomer} />
    <Stack.Screen name="OrdersHistory" component={OrdersHistory} options={{ headerShown: true, title: 'Order History' }} />
  </Stack.Navigator>
);

export default CustomerStack; 