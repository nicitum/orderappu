import { ipAddress } from '../../../services/urls';
import { LICENSE_NO } from '../../config'; // Import the license number
import AsyncStorage from '@react-native-async-storage/async-storage';
import { checkTokenAndRedirect } from '../../../services/auth';
import { jwtDecode } from 'jwt-decode';
import moment from 'moment';

/**
 * Fetch client status for due date configuration
 */
export const fetchClientStatus = async (setdefaultDueOn, setMaxDueOn, console) => {
  try {
    console.log('Fetching client status...');
    const response = await fetch(`http://147.93.110.150:3001/api/client_status/${LICENSE_NO}`, {
      method: 'GET',
      headers: {
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache'
      }
    });

    console.log('Response status:', response.status);
    if (response.ok) {
      const responseData = await response.json();
      console.log('API Response data:', responseData);
      
      // Extract data from the nested structure
      const data = responseData.data && responseData.data[0];
      console.log('Extracted client data:', data);
      
      if (data) {
        // Update due date configuration based on API response
        const newDefaultDueOn = data.default_due_on || 1;
        const newMaxDueOn = data.max_due_on || 30;
        
        console.log('Setting defaultDueOn to:', newDefaultDueOn);
        console.log('Setting maxDueOn to:', newMaxDueOn);
        
        setdefaultDueOn(newDefaultDueOn);
        setMaxDueOn(newMaxDueOn);
      } else {
        console.log('No client data found in response');
      }
    } else {
      console.log('API response not ok:', response.status);
    }
  } catch (error) {
    console.error('Error fetching client status:', error);
    // Keep default values if API fails
  }
};

/**
 * Load cart and products on mount and focus
 */
export const loadCartAndProducts = async (setCart, setCartProducts, setProducts, setFilteredProducts, setBrands, setCategories, setLoading, navigation, Alert, console) => {
  setLoading(true);
  try {
    // Load cart from AsyncStorage
    const savedCart = await AsyncStorage.getItem('catalogueCart');
    const savedCartItems = await AsyncStorage.getItem('cartItems');
    if (savedCart) {
      setCart(JSON.parse(savedCart));
    }
    if (savedCartItems) {
      const items = Object.values(JSON.parse(savedCartItems));
      setCartProducts(items);
    } else {
      setCartProducts([]);
    }

    // Fetch products
    const token = await checkTokenAndRedirect(navigation);
    if (!token) return;

    const response = await fetch(`http://${ipAddress}:8091/products`, {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      }
    });

    if (response.ok) {
      const data = await response.json();
      
      // Filter by enable_product - handle new backend values
      // "Mask" = don't display at all, "Inactive" = display but grayed out, "None" = display normally
      const enabledProducts = data.filter(p => p.enable_product !== "Mask");
      
      setProducts(enabledProducts);
      setFilteredProducts(enabledProducts);
      
      // Extract unique brands and categories from enabled products only
      const uniqueBrands = ['All', ...new Set(enabledProducts.map(p => p.brand))];
      const uniqueCategories = ['All', ...new Set(enabledProducts.map(p => p.category))];
      setBrands(uniqueBrands);
      setCategories(uniqueCategories);
    }
  } catch (error) {
    console.error('Error loading cart and products:', error);
    Alert.alert('Error', 'Failed to load cart and products');
  } finally {
    setLoading(false);
  }
};

/**
 * Persist/merge product metadata for items added from this screen
 */
export const upsertCartItemMeta = async (product, setCartProducts, AsyncStorage, console) => {
  try {
    const saved = await AsyncStorage.getItem('cartItems');
    const existing = saved ? JSON.parse(saved) : {};
    const merged = {
      ...existing,
      [product.id]: { ...product, price: product.discountPrice || product.price }
    };
    await AsyncStorage.setItem('cartItems', JSON.stringify(merged));
    setCartProducts(Object.values(merged));
  } catch (e) {
    console.error('Failed to persist cart item meta:', e);
  }
};

/**
 * Remove product metadata when deleting a specific item
 */
export const removeCartItemMeta = async (productId, setCartProducts, AsyncStorage, console) => {
  try {
    const saved = await AsyncStorage.getItem('cartItems');
    if (!saved) return;
    const existing = JSON.parse(saved);
    delete existing[productId];
    await AsyncStorage.setItem('cartItems', JSON.stringify(existing));
    setCartProducts(Object.values(existing));
  } catch (e) {
    console.error('Failed to remove cart item meta:', e);
  }
};

/**
 * Place order API call
 */
export const placeOrder = async (cart, cartProducts, selectedDueDate, navigation, setIsPlacingOrder, setCart, Alert, console) => {
  try {
    const token = await checkTokenAndRedirect(navigation);
    if (!token) {
      Alert.alert('Error', 'Please login to place an order');
      return;
    }

    setIsPlacingOrder(true);

    const orderItems = Object.entries(cart).map(([productId, quantity]) => {
      const item = cartProducts.find(i => i.id === parseInt(productId));
      const discountPrice = Number(item.discountPrice) || 0;
      return {
        product_id: parseInt(productId),
        quantity: quantity,
        price: discountPrice
      };
    });

    const now = new Date();
    const orderData = {
      products: orderItems,
      orderType: getOrderType(),
      orderDate: now.toISOString(),
      total_amount: calculateTotalAmount(cart, cartProducts),
      entered_by: jwtDecode(token).username,
      due_on: moment(selectedDueDate).format('YYYY-MM-DD') // Add due_on parameter
    };

    const response = await fetch(`http://${ipAddress}:8091/place`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(orderData)
    });

    const data = await response.json();

    if (response.ok) {
      // Clear cart before navigating
      setCart({});
      await AsyncStorage.removeItem('catalogueCart');
      Alert.alert(
        'Success',
        'Order placed successfully!',
        [
          {
            text: 'OK',
            onPress: () => {
              navigation.navigate('Home');
            }
          }
        ]
      );
    } else {
      Alert.alert('Error', data.message || 'Failed to place order');
    }
  } catch (error) {
    console.error('Error placing order:', error);
    Alert.alert('Error', 'An error occurred while placing your order');
  } finally {
    setIsPlacingOrder(false);
  }
};

/**
 * Get order type based on current time
 */
export const getOrderType = () => {
  const currentHour = new Date().getHours();
  return currentHour < 12 ? 'AM' : 'PM';
};

/**
 * Calculate total amount for the cart
 */
export const calculateTotalAmount = (cart, cartProducts) => {
  return Object.entries(cart).reduce((sum, [productId, quantity]) => {
    const item = cartProducts.find(i => i.id === parseInt(productId));
    if (!item || !item.discountPrice) return sum;
    const discountPrice = Number(item.discountPrice) || 0;
    return sum + discountPrice * quantity;
  }, 0);
};