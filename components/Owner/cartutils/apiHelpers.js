import { ipAddress } from '../../../services/urls.js';
import { checkTokenAndRedirect } from '../../services/auth.js';
import { jwtDecode } from 'jwt-decode';
import AsyncStorage from '@react-native-async-storage/async-storage';
import moment from 'moment';

/**
 * Load cart from storage
 */
export const loadCartFromStorage = async (setCartItems, setSelectedCustomer, console) => {
  try {
    const savedCart = await AsyncStorage.getItem('ownerCart');
    if (savedCart) {
      setCartItems(JSON.parse(savedCart));
    }
    
    // Load customer from storage
    const savedCustomer = await AsyncStorage.getItem('ownerCartCustomer');
    if (savedCustomer) {
      const parsedCustomer = JSON.parse(savedCustomer);
      // Apply the same fallback logic for saved customers
      if (!parsedCustomer.name || parsedCustomer.name === parsedCustomer.customer_id.toString()) {
        parsedCustomer.name = `Customer ${parsedCustomer.customer_id}`;
        console.log('Applied fallback name from storage:', parsedCustomer.name);
      }
      setSelectedCustomer(parsedCustomer);
    }
  } catch (error) {
    console.error('Error loading owner cart:', error);
  }
};

/**
 * Save cart to storage
 */
export const saveCartToStorage = async (cartItems, console) => {
  try {
    await AsyncStorage.setItem('ownerCart', JSON.stringify(cartItems));
  } catch (error) {
    console.error('Error saving owner cart:', error);
  }
};

/**
 * Fetch user permissions
 */
export const fetchUserPermissions = async (setAllowProductEdit, navigation, console) => {
  try {
    const token = await checkTokenAndRedirect(navigation);
    if (!token) return;

    const response = await fetch(`http://${ipAddress}:8091/userDetails`, {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      }
    });

    if (response.ok) {
      const data = await response.json();
      const user = data.user;
      
      // Set allowProductEdit based on userDetails API response
      setAllowProductEdit(user.allow_product_edit === 'Yes');
    } else {
      setAllowProductEdit(false);
    }
  } catch (error) {
    console.error('Error fetching user details:', error);
    // Default to false if API fails
    setAllowProductEdit(false);
  }
};

/**
 * Fetch client status for due date configuration
 */
export const fetchClientStatus = async (setDefaultDueOn, setMaxDueOn, setSelectedDueDate, console) => {
  try {
    console.log('Fetching client status...');
    const response = await fetch(`http://147.93.110.150:3001/api/client_status/APPU0009`, {
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

/**
 * Load products
 */
export const loadProducts = async (setProducts, setFilteredProducts, setBrands, setCategories, setLoading, navigation, Alert, console) => {
  setLoading(true);
  try {
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
    console.error('Error loading products:', error);
    Alert.alert('Error', 'Failed to load products');
  } finally {
    setLoading(false);
  }
};

/**
 * Place order
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
  if (cartItems.length === 0) {
    Toast.show({ type: 'error', text1: 'Error', text2: 'Please add products to the order' });
    return;
  }
  if (!selectedCustomer) {
    Toast.show({ type: 'error', text1: 'Error', text2: 'No customer selected' });
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
    // Call /on-behalf-2 API for fresh orders
    const res = await fetch(`http://${ipAddress}:8091/on-behalf-2`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        customer_id: selectedCustomer.customer_id,
        order_type: getOrderType(),
        products: productsPayload,
        entered_by: jwtDecode(token).username,
        due_on: moment(selectedDueDate).format('YYYY-MM-DD') // Add due_on parameter
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to place custom order.');
    Toast.show({ type: 'success', text1: 'Order Placed', text2: 'Owner custom order placed successfully!' });
    clearCart();
    navigation.goBack();
  } catch (err) {
    Toast.show({ type: 'error', text1: 'Order Failed', text2: err.message });
  } finally {
    setIsPlacingOrder(false);
  }
};