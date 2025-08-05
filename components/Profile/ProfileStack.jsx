import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import ProfilePage from './profile';
import OrdersPage from './OrdersPage';
import DeliveryStatusUpdate from './DeliveryStatusUpdate';


import PlaceOrderAdmin from './PlaceOrderAdmin';


import DailyOrdersReport from './DailyOrdersReport';
import Remarks from './Remarks';

import AutoOrderUpdate from './AutoOrderUpdate';



import AutoOrderPage from './AutoOrderPage';


import OrderTrackingScreen from './OrderTrackingScreen';

import OrderTrackingCustomerScreen from './OrderTrackingCustomerScreen';
import CartCustomer from '../Customer/CartCustomer';
const Stack = createStackNavigator();

const ProfileStack = () => {
  return (
    <Stack.Navigator>
      <Stack.Screen 
        name="ProfilePage" 
        component={ProfilePage} 
        options={{ headerShown: false }} 
      />
      <Stack.Screen 
        name="Orders" 
        component={OrdersPage} 
        options={{ title: 'Order History' }} 
      />
      <Stack.Screen 
        name="DeliveryStatusUpdate" 
        component={DeliveryStatusUpdate} 
        options={{ title: 'Update Delivery Status' }} 
      />

     

     

   

      <Stack.Screen 
        name="PlaceOrderAdmin" 
        component={PlaceOrderAdmin} 
        options={{ title: 'Auto Order Manager' }} 
      />
      






      <Stack.Screen 
        name="DailyOrdersReport" 
        component={DailyOrdersReport} 
        options={{ title: 'DailyOrdersReport' }} 
        
      />


      
      <Stack.Screen 
        name="Remarks" 
        component={Remarks} 
        options={{ title: 'Remarks'}} 
        
      />

      

      

    

    


    


    
    <Stack.Screen 
        name="AutoOrderPage"
        component={AutoOrderPage}
        options={{ title: 'Auto Order Page' }} 
      />


      
      
      <Stack.Screen 
        name="AutoOrderUpdate"
        component={AutoOrderUpdate}
        options={{ title: 'Auto Order Update' }}
      />

      <Stack.Screen 
        name="OrderTrackingScreen"
        component={OrderTrackingScreen}
        options={{ title: 'Order Tracking' }}
      />


      <Stack.Screen 
        name="OrderTrackingCustomerScreen"
        component={OrderTrackingCustomerScreen}
        options={{ title: 'Order Tracking Customer' }}
      />

      <Stack.Screen
        name="CartCustomer"
        component={CartCustomer}
        options={{ headerShown: false }}
      />



  












    </Stack.Navigator>
      


      
    
  );
};

export default ProfileStack;
