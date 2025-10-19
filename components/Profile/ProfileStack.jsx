import { createStackNavigator } from '@react-navigation/stack';
import ProfilePage from './profile';
import OrdersPage from './OrdersPage';
import DeliveryStatusUpdate from './DeliveryStatusUpdate';
import PlaceOrderAdmin from './PlaceOrderAdmin';
import Remarks from './Remarks';
// Removed OrderTrackingScreen import
// Removed OrderTrackingCustomerScreen import
import CartCustomer from '../Customer/CartCustomer';
import Settings from './Settings';
import FontSettings from './FontSettings';
import BluetoothPrinter from './BluetoothPrinter'; // Added Bluetooth Printer

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
        name="Remarks" 
        component={Remarks} 
        options={{ title: 'Remarks'}} 
        
      />

      

      

    

    


      
  

      {/* Removed OrderTrackingScreen route */}
      {/* Removed OrderTrackingCustomerScreen route */}

      <Stack.Screen
        name="CartCustomer"
        component={CartCustomer}
        options={{ headerShown: false }}
      />
      
      <Stack.Screen
        name="Settings"
        component={Settings}
        options={{ headerShown: false }}
      />
      
      <Stack.Screen
        name="FontSettings"
        component={FontSettings}
        options={{ headerShown: false }}
      />
      
      <Stack.Screen
        name="BluetoothPrinter"
        component={BluetoothPrinter}
        options={{ title: 'Bluetooth Printer' }}
      />
    

    </Stack.Navigator>
  );
};

export default ProfileStack;