import AsyncStorage from '@react-native-async-storage/async-storage';

// Cart management helpers
export class CartManager {
  // Load cart from AsyncStorage
  static async loadCartFromStorage() {
    try {
      const savedCart = await AsyncStorage.getItem('adminCart');
      const savedCustomer = await AsyncStorage.getItem('adminCartCustomer');
      
      return {
        cartItems: savedCart ? JSON.parse(savedCart) : [],
        customer: savedCustomer ? JSON.parse(savedCustomer) : null
      };
    } catch (error) {
      console.error('Error loading admin cart:', error);
      return { cartItems: [], customer: null };
    }
  }

  // Save cart to AsyncStorage
  static async saveCartToStorage(cartItems) {
    try {
      await AsyncStorage.setItem('adminCart', JSON.stringify(cartItems));
    } catch (error) {
      console.error('Error saving admin cart:', error);
    }
  }

  // Save customer to AsyncStorage
  static async saveCustomerToStorage(customer) {
    try {
      await AsyncStorage.setItem('adminCartCustomer', JSON.stringify(customer));
    } catch (error) {
      console.error('Error saving admin cart customer:', error);
    }
  }

  // Add product to cart
  static addToCart(cartItems, product) {
    const existingItem = cartItems.find(item => item.product_id === product.product_id);
    
    if (existingItem) {
      // Update quantity if product already exists
      return cartItems.map(item =>
        item.product_id === product.product_id
          ? { ...item, quantity: item.quantity + (product.quantity || 1) }
          : item
      );
    } else {
      // Add new product
      return [...cartItems, { ...product, quantity: product.quantity || 1 }];
    }
  }

  // Remove product from cart
  static removeFromCart(cartItems, productId) {
    return cartItems.filter(item => item.product_id !== productId);
  }

  // Update product quantity in cart
  static updateQuantity(cartItems, productId, quantity) {
    if (quantity <= 0) {
      return CartManager.removeFromCart(cartItems, productId);
    }
    
    return cartItems.map(item =>
      item.product_id === productId
        ? { ...item, quantity }
        : item
    );
  }

  // Update product price and quantity in cart
  static updateCartItem(cartItems, productId, price, quantity) {
    return cartItems.map(item =>
      item.product_id === productId
        ? { ...item, price, quantity }
        : item
    );
  }

  // Calculate cart total
  static getCartTotal(cartItems) {
    return cartItems.reduce((total, item) => total + (item.price * item.quantity), 0);
  }

  // Calculate total item count
  static getCartItemCount(cartItems) {
    return cartItems.reduce((count, item) => count + item.quantity, 0);
  }

  // Clear cart
  static clearCart() {
    return [];
  }

  // Validate edit cart item
  static validateEditCartItem(product, newPrice, newQty, allowProductEdit, products) {
    const errors = [];

    // Validate price if editing is allowed
    if (allowProductEdit) {
      const fullProductData = products.find(p => p.id === product.product_id || p.id === product.id);
      const minPrice = fullProductData?.min_selling_price || product.min_selling_price || 0;
      const maxPrice = fullProductData?.discountPrice || product.discountPrice || product.price || 0;
      
      if (isNaN(newPrice) || newPrice <= 0) {
        errors.push('Please enter a valid price');
      } else if (newPrice < minPrice || newPrice > maxPrice) {
        errors.push(`Price must be between ₹${minPrice} and ₹${maxPrice}`);
      }
    }
    
    // Validate quantity
    if (isNaN(newQty) || newQty <= 0) {
      errors.push('Please enter a valid quantity');
    }
    
    return errors;
  }
}