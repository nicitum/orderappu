import { ipAddress } from '../../../services/urls';
import { LICENSE_NO } from '../../config'; // Import the license number
import AsyncStorage from '@react-native-async-storage/async-storage';
import { jwtDecode } from 'jwt-decode';
import { checkTokenAndRedirect } from '../../../services/auth';

/**
 * Load cart from AsyncStorage
 * This function loads the cart items and customer data from storage
 * and updates the state using the provided setter functions
 */
export const loadCartFromStorage = async (setCartItems, setSelectedCustomer, console) => {
  try {
    const savedCart = await AsyncStorage.getItem('ownerCart');
    const savedCustomer = await AsyncStorage.getItem('ownerCartCustomer');
    
    if (savedCart) {
      setCartItems(JSON.parse(savedCart));
    }
    
    if (savedCustomer) {
      setSelectedCustomer(JSON.parse(savedCustomer));
    }
  } catch (error) {
    console.error('Error loading owner cart from storage:', error);
  }
};

/**
 * Save cart to AsyncStorage
 */
export const saveCartToStorage = async (cartItems, console) => {
  try {
    await AsyncStorage.setItem('ownerCart', JSON.stringify(cartItems));
  } catch (error) {
    console.error('Error saving owner cart to storage:', error);
  }
};

/**
 * Load products from API
 */
export const loadProducts = async (setProducts, setFilteredProducts, setBrands, setCategories, setLoading, navigation, Alert, console) => {
  setLoading(true);
  try {
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
      
      // Extract unique brands and categories from enabled products only
      const uniqueBrands = ['All', ...new Set(enabledProducts.map(p => p.brand))];
      const uniqueCategories = ['All', ...new Set(enabledProducts.map(p => p.category))];
      
      setProducts(enabledProducts);
      setFilteredProducts(enabledProducts);
      setBrands(uniqueBrands);
      setCategories(uniqueCategories);
    } else {
      throw new Error('Failed to load products');
    }
  } catch (error) {
    console.error('Error loading products:', error);
    Alert.alert('Error', 'Failed to load products');
  } finally {
    setLoading(false);
  }
};

/**
 * Place order API call
 */
export const placeOrder = async (
  cartItems,
  selectedCustomer,
  selectedDueDate,
  getOrderType,
  setIsPlacingOrder,
  clearCart,
  navigation,
  Toast,
  console
) => {
  console.log('Place order called with:', { cartItems, selectedCustomer, selectedDueDate });
  
  if (cartItems.length === 0) {
    Toast.show({ type: 'error', text1: 'Error', text2: 'Please add products to the order' });
    return;
  }
  if (!selectedCustomer) {
    Toast.show({ type: 'error', text1: 'Error', text2: 'No customer selected' });
    return;
  }
  
  // Check if customer_id exists
  if (!selectedCustomer.customer_id) {
    console.error('Customer ID missing:', selectedCustomer);
    Toast.show({ type: 'error', text1: 'Error', text2: 'Customer ID is missing' });
    return;
  }
  
  setIsPlacingOrder(true);
  try {
    const token = await AsyncStorage.getItem('userAuthToken');
    if (!token) throw new Error('No auth token found');

    // Prepare products for API
    const productsPayload = cartItems.map((item) => ({
      product_id: item.product_id || item.id,
      quantity: item.quantity || 1,
      price: item.price,
      name: item.name,
      category: item.category || '',
      gst_rate: item.gst_rate || 0
    }));

    // Get order type
    const orderType = getOrderType();
    
    // Log the request data
    const requestData = {
      customer_id: selectedCustomer.customer_id,
      order_type: orderType,
      products: productsPayload,
      entered_by: jwtDecode(token).username,
      due_on: selectedDueDate.toISOString().split('T')[0]
    };
    
    console.log('Sending order request:', requestData);

    // Call /on-behalf-2 API for fresh orders
    const res = await fetch(`http://${ipAddress}:8091/on-behalf-2`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestData),
    });

    const data = await res.json();
    console.log('Order API response:', res.status, data);
    
    // Check for successful response - handle different success formats
    // The API might return success as a message instead of a success property
    const isSuccessful = res.ok && (
      data.success === true || 
      data.status === 'success' || 
      (data.message && data.message.toLowerCase().includes('success')) ||
      (data.message && data.message.toLowerCase().includes('placed'))
    );
    
    if (isSuccessful) {
      Toast.show({ type: 'success', text1: 'Order Placed', text2: 'Owner custom order placed successfully!' });
      clearCart();
      navigation.goBack();
    } else {
      // Handle different error formats
      const errorMessage = data.message || data.error || 'Failed to place order';
      throw new Error(errorMessage);
    }
  } catch (err) {
    console.error('Order placement error:', err);
    // Even if there's an error, if it contains "success" in the message, treat it as success
    if (err.message && err.message.toLowerCase().includes('success')) {
      Toast.show({ type: 'success', text1: 'Order Placed', text2: 'Owner custom order placed successfully!' });
      clearCart();
      navigation.goBack();
    } else {
      Toast.show({ type: 'error', text1: 'Order Failed', text2: err.message || 'An unexpected error occurred' });
    }
  } finally {
    setIsPlacingOrder(false);
  }
};

/**
 * Fetch client status for due date configuration
 */
export const fetchClientStatus = async (setDefaultDueOn, setMaxDueOn, setSelectedDueDate, console) => {
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
        
        setDefaultDueOn(newDefaultDueOn);
        setMaxDueOn(newMaxDueOn);
        
        // Update selected due date based on default_due_on
        const newDefaultDate = new Date();
        if (newDefaultDueOn > 0) {
          newDefaultDate.setDate(newDefaultDate.getDate() + newDefaultDueOn);
        }
        console.log('Setting selectedDueDate to:', newDefaultDate);
        setSelectedDueDate(newDefaultDate);
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