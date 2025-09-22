import { Alert } from 'react-native';
import Toast from 'react-native-toast-message';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Add to cart
 */
export const addToCart = (product, setCartItems) => {
  setCartItems(prevItems => {
    const existingItem = prevItems.find(item => item.product_id === product.product_id);
    
    if (existingItem) {
      // Update quantity if product already exists
      return prevItems.map(item =>
        item.product_id === product.product_id
          ? { ...item, quantity: item.quantity + (product.quantity || 1) }
          : item
      );
    } else {
      // Add new product
      return [...prevItems, { ...product, quantity: product.quantity || 1 }];
    }
  });
};

/**
 * Remove from cart
 */
export const removeFromCart = (productId, setCartItems) => {
  setCartItems(prevItems => prevItems.filter(item => item.product_id !== productId));
};

/**
 * Update quantity
 */
export const updateQuantity = (productId, quantity, setCartItems, removeFromCart) => {
  if (quantity <= 0) {
    removeFromCart(productId, setCartItems);
    return;
  }
  
  setCartItems(prevItems =>
    prevItems.map(item =>
      item.product_id === productId
        ? { ...item, quantity }
        : item
    )
  );
};

/**
 * Save edit cart item
 */
export const saveEditCartItem = (
  editCartProduct, 
  editCartPrice, 
  editCartQty, 
  products, 
  setCartItems, 
  setEditCartModalVisible, 
  setEditCartProduct, 
  setEditCartPrice, 
  setEditCartQty, 
  setEditCartError,
  Toast
) => {
  if (!editCartProduct) return;
  const newPrice = parseFloat(editCartPrice);
  const newQty = parseInt(editCartQty);
  // Get the full product data from products array to get correct price range
  const fullProductData = products.find(p => p.id === editCartProduct.product_id || p.id === editCartProduct.id);
  const minPrice = fullProductData?.min_selling_price || editCartProduct.min_selling_price || 0;
  const maxPrice = fullProductData?.discountPrice || editCartProduct.discountPrice || editCartProduct.price || 0;
  if (isNaN(newPrice) || newPrice <= 0) {
    setEditCartError('Please enter a valid price');
    return;
  }
  if (newPrice < minPrice || newPrice > maxPrice) {
    setEditCartError(`Price must be between ₹${minPrice} and ₹${maxPrice}`);
    return;
  }
  if (isNaN(newQty) || newQty <= 0) {
    setEditCartError('Please enter a valid quantity');
    return;
  }
  setCartItems(prevItems =>
    prevItems.map(item =>
      item.product_id === editCartProduct.product_id
        ? { ...item, price: newPrice, quantity: newQty }
        : item
    )
  );
  setEditCartModalVisible(false);
  setEditCartProduct(null);
  setEditCartPrice('');
  setEditCartQty('1');
  setEditCartError(null);
  Toast.show({
    type: 'success',
    text1: 'Item Updated',
    text2: 'Cart item has been updated successfully'
  });
};

/**
 * Clear cart
 */
export const clearCart = (setCartItems, setSelectedCustomer) => {
  setCartItems([]);
  setSelectedCustomer(null);
};

/**
 * Get cart total
 */
export const getCartTotal = (cartItems) => {
  return cartItems.reduce((total, item) => total + (item.price * item.quantity), 0);
};

/**
 * Get cart item count
 */
export const getCartItemCount = (cartItems) => {
  return cartItems.reduce((count, item) => count + item.quantity, 0);
};

/**
 * Add order to cart
 */
export const addOrderToCart = (orderProducts, addToCart) => {
  // Add all products from an order to the cart
  orderProducts.forEach(product => {
    addToCart(product);
  });
};

/**
 * Get order type
 */
export const getOrderType = () => {
  const now = new Date();
  const hour = now.getHours();
  return hour < 12 ? 'AM' : 'PM';
};

/**
 * Filter products
 */
export const filterProducts = (text, brand, category, products, setFilteredProducts) => {
  let filtered = products;
  
  if (text) {
    filtered = filtered.filter(product =>
      product.name.toLowerCase().includes(text.toLowerCase()) ||
      product.brand?.toLowerCase().includes(text.toLowerCase()) ||
      product.category?.toLowerCase().includes(text.toLowerCase())
    );
  }
  
  if (brand && brand !== 'All') {
    filtered = filtered.filter(product => product.brand === brand);
  }
  
  if (category && category !== 'All') {
    filtered = filtered.filter(product => product.category === category);
  }
  
  setFilteredProducts(filtered);
};

/**
 * Clear cart handler
 */
export const clearCartHandler = (clearCart, setCartItems, setSelectedCustomer, Toast) => {
  Alert.alert(
    'Clear Cart',
    'Are you sure you want to clear all items from the cart?',
    [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear',
        style: 'destructive',
        onPress: () => {
          clearCart(setCartItems, setSelectedCustomer);
          Toast.show({
            type: 'success',
            text1: 'Cart Cleared',
            text2: 'All items have been removed from the cart'
          });
        }
      }
    ]
  );
};

/**
 * Delete cart item
 */
export const deleteCartItem = (productId, removeFromCart, setCartItems, Toast) => {
  Alert.alert(
    'Remove Item',
    'Are you sure you want to remove this item from the cart?',
    [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () => {
          removeFromCart(productId, setCartItems);
          Toast.show({
            type: 'success',
            text1: 'Item Removed',
            text2: 'Item has been removed from the cart'
          });
        }
      }
    ]
  );
};

/**
 * Apply filters
 */
export const applyFilters = (brand, category, searchTerm, setSelectedBrand, setSelectedCategory, filterProducts) => {
  setSelectedBrand(brand);
  setSelectedCategory(category);
  filterProducts(searchTerm, brand, category);
};

/**
 * Handle place order click
 */
export const handlePlaceOrderClick = (defaultDueOn, setSelectedDueDate, setShowDueDateModal) => {
  // Reset due date based on API default_due_on value
  const newDefaultDate = new Date();
  if (defaultDueOn > 0) {
    newDefaultDate.setDate(newDefaultDate.getDate() + defaultDueOn);
  }
  setSelectedDueDate(newDefaultDate);
  // Show due date modal first
  setShowDueDateModal(true);
};

/**
 * Handle confirm due date
 */
export const handleConfirmDueDate = (setShowDueDateModal, placeOrderFunction) => {
  // Close modal and proceed with order placement
  setShowDueDateModal(false);
  placeOrderFunction();
};