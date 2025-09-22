import { Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Handle increase quantity for a product
 */
export const handleIncreaseQuantity = (productId, setCart) => {
  setCart(prevCart => ({
    ...prevCart,
    [productId]: (prevCart[productId] || 0) + 1
  }));
};

/**
 * Handle decrease quantity for a product
 */
export const handleDecreaseQuantity = (productId, setCart) => {
  setCart(prevCart => {
    const currentQuantity = prevCart[productId] || 0;
    if (currentQuantity <= 1) return prevCart;
    return {
      ...prevCart,
      [productId]: currentQuantity - 1
    };
  });
};

/**
 * Handle quantity change for a product
 */
export const handleQuantityChange = (productId, newQuantity, setCart) => {
  // Allow empty string or any input during editing
  if (newQuantity === '') {
    setCart(prevCart => ({
      ...prevCart,
      [productId]: 0
    }));
    return;
  }

  // Convert to number and allow any value during editing, including 0
  const quantity = parseInt(newQuantity);
  if (isNaN(quantity)) {
    return;
  }

  setCart(prevCart => ({
    ...prevCart,
    [productId]: quantity
  }));
};

/**
 * Handle quantity blur for a product
 */
export const handleQuantityBlur = (productId, value, setCart) => {
  // On blur, if empty or invalid or 0, revert to the previous value or set to 1 if none exists
  const quantity = parseInt(value);
  if (isNaN(quantity) || quantity < 1) {
    setCart(prevCart => ({
      ...prevCart,
      [productId]: prevCart[productId] || 1
    }));
  }
};

/**
 * Clear cart function
 */
export const clearCart = (setCart, setCartProducts) => {
  Alert.alert(
    'Clear Cart',
    'Are you sure you want to remove all items from your cart?',
    [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear', 
        style: 'destructive',
        onPress: () => {
          setCart({});
          AsyncStorage.removeItem('catalogueCart');
          AsyncStorage.removeItem('cartItems');
          setCartProducts([]);
        }
      }
    ]
  );
};

/**
 * Delete cart item function
 */
export const deleteCartItem = async (productId, cart, setCart, setCartProducts) => {
  Alert.alert(
    'Remove Item',
    'Are you sure you want to remove this item from your cart?',
    [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove', 
        style: 'destructive',
        onPress: async () => {
          // Compute and persist updated cart synchronously
          const currentCart = { ...cart };
          delete currentCart[productId];
          setCart(currentCart);
          await AsyncStorage.setItem('catalogueCart', JSON.stringify(currentCart));
          // Call removeCartItemMeta function
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
        }
      }
    ]
  );
};

/**
 * Apply filters function
 */
export const applyFilters = (brand, category, searchTerm, products, setFilteredProducts) => {
  let filtered = products;
  if (brand !== 'All') {
    filtered = filtered.filter(p => p.brand === brand);
  }
  if (category !== 'All') {
    filtered = filtered.filter(p => p.category === category);
  }
  if (searchTerm) {
    filtered = filtered.filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase()));
  }
  setFilteredProducts(filtered);
};

/**
 * Handle place order click function
 */
export const handlePlaceOrderClick = (defaultDueOn, setSelectedDueDate, setShowDueDateModal, console) => {
  console.log('handlePlaceOrderClick called');
  console.log('Current defaultDueOn value:', defaultDueOn);
  
  // Reset due date based on API default_due_on value
  const newDefaultDate = new Date();
  if (defaultDueOn > 0) {
    newDefaultDate.setDate(newDefaultDate.getDate() + defaultDueOn);
    console.log('Setting due date to:', newDefaultDate, '(+', defaultDueOn, 'days)');
  } else {
    console.log('defaultDueOn is 0, keeping today as due date');
  }
  setSelectedDueDate(newDefaultDate);
  // Show due date modal first
  setShowDueDateModal(true);
};

/**
 * Handle confirm due date function
 */
export const handleConfirmDueDate = (setShowDueDateModal, placeOrderFunction) => {
  // Close modal and proceed with order placement
  setShowDueDateModal(false);
  placeOrderFunction();
};