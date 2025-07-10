import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  SafeAreaView,
  StatusBar,
  Alert,
  Modal,
  TextInput,
  ScrollView,
  Platform,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useNavigation, useFocusEffect, useRoute } from '@react-navigation/native';
import { ipAddress } from '../../services/urls.js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { checkTokenAndRedirect } from '../../services/auth.js';
import { jwtDecode } from 'jwt-decode';
import { Picker } from '@react-native-picker/picker';

import Toast from 'react-native-toast-message';
import SearchProductModal_1 from './searchProductModal_1.jsx';

// Modern Color Palette
const COLORS = {
  primary: "#003366",
  primaryLight: "#004488",
  primaryDark: "#002244",
  secondary: "#10B981",
  accent: "#F59E0B",
  success: "#059669",
  error: "#DC2626",
  warning: "#D97706",
  background: "#F3F4F6",
  surface: "#FFFFFF",
  text: {
    primary: "#111827",
    secondary: "#4B5563",
    tertiary: "#9CA3AF",
    light: "#FFFFFF",
  },
  border: "#E5E7EB",
  divider: "#F3F4F6",
  card: {
    background: "#FFFFFF",
    shadow: "rgba(0, 0, 0, 0.1)",
  },
};

// Format currency
const formatCurrency = (amount) => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  }).format(amount);
};

const AdminCartPage = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isPlacingOrder, setIsPlacingOrder] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddMoreModal, setShowAddMoreModal] = useState(false);
  const [filteredProducts, setFilteredProducts] = useState([]);
  const [selectedBrand, setSelectedBrand] = useState('All');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [brands, setBrands] = useState(['All']);
  const [categories, setCategories] = useState(['All']);
  const [editCartModalVisible, setEditCartModalVisible] = useState(false);
  const [editCartProduct, setEditCartProduct] = useState(null);
  const [editCartPrice, setEditCartPrice] = useState('');
  const [editCartQty, setEditCartQty] = useState('1');
  const [editCartError, setEditCartError] = useState(null);
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [allowProductEdit, setAllowProductEdit] = useState(false);

  // Cart state
  const [cartItems, setCartItems] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState(null);

  // Load cart from storage on mount
  useEffect(() => {
    loadCartFromStorage();
    fetchUserPermissions();
  }, []);

  // Save cart to storage whenever it changes
  useEffect(() => {
    saveCartToStorage();
  }, [cartItems]);

  useEffect(() => {
    if (route.params?.customer) {
      setSelectedCustomer(route.params.customer);
    }
    if (route.params?.products) {
      // Add all products from the order to cart
      route.params.products.forEach(product => {
        addToCart({
          product_id: product.product_id,
          id: product.product_id,
          name: product.name,
          price: product.price,
          quantity: product.quantity,
          image: product.image || null,
          category: product.category || '',
          gst_rate: product.gst_rate || 0
        });
      });
    }
  }, [route.params]);

  const loadCartFromStorage = async () => {
    try {
      const savedCart = await AsyncStorage.getItem('adminCart');
      if (savedCart) {
        setCartItems(JSON.parse(savedCart));
      }
    } catch (error) {
      console.error('Error loading admin cart:', error);
    }
  };

  const saveCartToStorage = async () => {
    try {
      await AsyncStorage.setItem('adminCart', JSON.stringify(cartItems));
    } catch (error) {
      console.error('Error saving admin cart:', error);
    }
  };

  const fetchUserPermissions = async () => {
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

  const addToCart = (product) => {
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

  const removeFromCart = (productId) => {
    setCartItems(prevItems => prevItems.filter(item => item.product_id !== productId));
  };

  const updateQuantity = (productId, quantity) => {
    if (quantity <= 0) {
      removeFromCart(productId);
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

  const saveEditCartItem = () => {
    if (!editCartProduct) return;
    
    const newPrice = parseFloat(editCartPrice);
    const newQty = parseInt(editCartQty);
    
    // Only validate price if allowProductEdit is true
    if (allowProductEdit) {
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
    }
    
    if (isNaN(newQty) || newQty <= 0) {
      setEditCartError('Please enter a valid quantity');
      return;
    }
    
    // If price editing is disabled, keep the original price
    const finalPrice = allowProductEdit ? newPrice : editCartProduct.price;
    
    setCartItems(prevItems =>
      prevItems.map(item =>
        item.product_id === editCartProduct.product_id
          ? { ...item, price: finalPrice, quantity: newQty }
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

  const clearCart = () => {
    setCartItems([]);
    setSelectedCustomer(null);
  };

  const getCartTotal = () => {
    return cartItems.reduce((total, item) => total + (item.price * item.quantity), 0);
  };

  const getCartItemCount = () => {
    return cartItems.reduce((count, item) => count + item.quantity, 0);
  };

  const addOrderToCart = (orderProducts) => {
    // Add all products from an order to the cart
    orderProducts.forEach(product => {
      addToCart(product);
    });
  };

  // Load products on mount and focus
  useFocusEffect(
    useCallback(() => {
      loadProducts();
    }, [])
  );

  const loadProducts = async () => {
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
        setProducts(data);
        setFilteredProducts(data);
        
        // Extract unique brands and categories
        const uniqueBrands = ['All', ...new Set(data.map(p => p.brand))];
        const uniqueCategories = ['All', ...new Set(data.map(p => p.category))];
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

  const getOrderType = () => {
    const now = new Date();
    const hour = now.getHours();
    return hour < 12 ? 'AM' : 'PM';
  };

  const placeOrder = async () => {
    Toast.show({ type: 'info', text1: 'DEBUG', text2: 'PlaceOrder called' });
    console.log('DEBUG: placeOrder called', { cartItems, selectedCustomer, params: route.params });
    if (!selectedCustomer && route.params?.customer) {
      setSelectedCustomer(route.params.customer);
      Toast.show({ type: 'info', text1: 'DEBUG', text2: 'selectedCustomer set from params' });
      return; // Let the next button press work
    }
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
          customer_id: selectedCustomer.cust_id,
          order_type: getOrderType(),
          products: productsPayload,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to place custom order.');
      Toast.show({ type: 'success', text1: 'Order Placed', text2: 'Admin custom order placed successfully!' });
      clearCart();
      navigation.goBack();
    } catch (err) {
      Toast.show({ type: 'error', text1: 'Order Failed', text2: err.message });
    } finally {
      setIsPlacingOrder(false);
    }
  };

  const filterProducts = (text, brand, category) => {
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

  const renderCartItem = ({ item }) => {
    // Try to get image from products data first, then from item itself
    const productData = products.find(p => p.id === item.product_id || p.id === item.id);
    const imageUri = (productData?.image || item.image) ? 
      `http://${ipAddress}:8091/images/products/${productData?.image || item.image}` : null;
    const itemTotal = (item.price || 0) * (item.quantity || 1);

    return (
      <View style={styles.cartItemCard}>
        <View style={styles.cartItemContent}>
          <View style={styles.cartItemImageContainer}>
            {imageUri ? (
              <Image
                source={{ uri: imageUri }}
                style={styles.cartItemImage}
                resizeMode="contain"
              />
            ) : (
              <View style={styles.noImageContainer}>
                <Icon name="image-not-supported" size={24} color="#CCC" />
              </View>
            )}
          </View>
          
          <View style={styles.cartItemDetails}>
            <Text style={styles.cartItemName} numberOfLines={2}>{item.name}</Text>
            <Text style={styles.cartItemPrice}>{formatCurrency(item.price || 0)} x {item.quantity || 1} = {formatCurrency(itemTotal)}</Text>
            {item.size && <Text style={styles.cartItemVolume}>{item.size}</Text>}
            <TouchableOpacity 
              style={styles.editButton}
              onPress={() => {
                setEditCartProduct(item);
                // Get the full product data from products array to get correct price range
                const fullProductData = products.find(p => p.id === item.product_id || p.id === item.id);
                const currentPrice = item.price;
                const minPrice = fullProductData?.min_selling_price || item.min_selling_price || 0;
                const maxPrice = fullProductData?.discountPrice || item.discountPrice || item.price || 0;
                const validPrice = Math.max(minPrice, Math.min(currentPrice, maxPrice));
                setEditCartPrice(validPrice.toString());
                setEditCartQty(item.quantity.toString());
                setEditCartModalVisible(true);
              }}
            >
              <Icon name="edit" size={16} color={COLORS.primary} />
              <Text style={styles.editButtonText}>Edit</Text>
            </TouchableOpacity>
          </View>
          
          <View style={styles.cartItemActions}>
            <View style={styles.quantityContainer}>
              <TouchableOpacity
                style={styles.quantityButton}
                onPress={() => updateQuantity(item.product_id, (item.quantity || 1) - 1)}
              >
                <Icon name="remove" size={20} color="#FFF" />
              </TouchableOpacity>
              <Text style={styles.quantityText}>{item.quantity || 1}</Text>
              <TouchableOpacity
                style={styles.quantityButton}
                onPress={() => updateQuantity(item.product_id, (item.quantity || 1) + 1)}
              >
                <Icon name="add" size={20} color="#FFF" />
              </TouchableOpacity>
            </View>
            
            <TouchableOpacity
              style={styles.removeButton}
              onPress={() => deleteCartItem(item.product_id)}
            >
              <Icon name="delete" size={20} color="#DC2626" />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  };

  const renderProductItem = ({ item }) => {
    const imageUri = item.image ? `http://${ipAddress}:8091/images/products/${item.image}` : null;
    const isInCart = cartItems.some(cartItem => cartItem.product_id === item.id);

    return (
      <TouchableOpacity
        style={[styles.productCard, isInCart && styles.productCardInCart]}
        onPress={() => addToCart({ ...item, product_id: item.id, quantity: 1 })}
        activeOpacity={0.7}
      >
        <View style={styles.productImageContainer}>
          {imageUri ? (
            <Image
              source={{ uri: imageUri }}
              style={styles.productImage}
              resizeMode="contain"
            />
          ) : (
            <View style={styles.noImageContainer}>
              <Icon name="image-not-supported" size={32} color="#CCC" />
            </View>
          )}
        </View>
        
        <View style={styles.productDetails}>
          <Text style={styles.productName} numberOfLines={2}>{item.name}</Text>
          <Text style={styles.productPrice}>₹{item.price}</Text>
          {item.size && <Text style={styles.productVolume}>{item.size}</Text>}
          {isInCart && (
            <View style={styles.inCartIndicator}>
              <Icon name="check-circle" size={16} color={COLORS.success} />
              <Text style={styles.inCartText}>In Cart</Text>
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  const clearCartHandler = () => {
    Alert.alert(
      'Clear Cart',
      'Are you sure you want to clear all items from the cart?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: () => {
            clearCart();
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

  const deleteCartItem = (productId) => {
    Alert.alert(
      'Remove Item',
      'Are you sure you want to remove this item from the cart?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => {
            removeFromCart(productId);
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

  function applyFilters(brand, category) {
    setSelectedBrand(brand);
    setSelectedCategory(category);
    filterProducts(searchTerm, brand, category);
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor={COLORS.background} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Loading products...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.background} />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Icon name="arrow-back" size={24} color={COLORS.text.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Admin Cart</Text>
        <TouchableOpacity
          style={styles.clearButton}
          onPress={clearCartHandler}
        >
          <Icon name="clear-all" size={24} color={COLORS.error} />
        </TouchableOpacity>
      </View>

      {/* Customer Info */}
      {selectedCustomer && (
        <View style={styles.customerInfo}>
          <Text style={styles.customerLabel}>Order for:</Text>
          <Text style={styles.customerName}>{selectedCustomer.name}</Text>
          <Text style={styles.customerId}>ID: {selectedCustomer.cust_id}</Text>
        </View>
      )}

      {/* Cart Items */}
      {cartItems.length > 0 ? (
        <View style={styles.cartSection}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Cart Items ({cartItems.length})</Text>
            {/* Grand total styled like CartCustomer */}
            <View style={styles.totalContainer}>
              <Text style={styles.totalLabel}>Total Amount:</Text>
              <Text style={styles.totalAmount}>{formatCurrency(getCartTotal())}</Text>
            </View>
          </View>
          
          <FlatList
            data={cartItems}
            renderItem={renderCartItem}
            keyExtractor={(item) => item.product_id.toString()}
            style={styles.cartList}
            showsVerticalScrollIndicator={false}
          />
          
          <TouchableOpacity
            style={[styles.placeOrderButton, isPlacingOrder && styles.placeOrderButtonDisabled]}
            onPress={placeOrder}
            disabled={isPlacingOrder}
          >
            {isPlacingOrder ? (
              <ActivityIndicator size="small" color="#FFF" />
            ) : (
              <>
                <Icon name="shopping-cart-checkout" size={20} color="#FFF" />
                <Text style={styles.placeOrderText}>Place Order</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.emptyCartContainer}>
          <Icon name="shopping-cart-outlined" size={64} color={COLORS.text.tertiary} />
          <Text style={styles.emptyCartTitle}>Your cart is empty</Text>
          <Text style={styles.emptyCartSubtitle}>Add products to get started</Text>
          
          <TouchableOpacity
            style={styles.addProductsButton}
            onPress={() => setShowSearchModal(true)}
          >
            <Icon name="add" size={20} color="#FFF" />
            <Text style={styles.addProductsText}>Add Products</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Floating Add Products Button */}
      <TouchableOpacity
        style={styles.floatingAddButton}
        onPress={() => setShowSearchModal(true)}
      >
        <Icon name="add" size={24} color="#FFF" />
      </TouchableOpacity>

      {/* Search Product Modal */}
      <SearchProductModal_1
        isVisible={showSearchModal}
        onClose={() => setShowSearchModal(false)}
        onAddProduct={(product) => {
          addToCart({ ...product, product_id: product.id, quantity: 1 });
          setShowSearchModal(false);
          Toast.show({
            type: 'success',
            text1: 'Product Added',
            text2: `${product.name} added to cart`
          });
        }}
        currentCustomerId={selectedCustomer?.cust_id}
        closeOnAdd={true}
        allowProductEdit={allowProductEdit}
      />

      {/* Edit Cart Item Modal */}
      <Modal
        visible={editCartModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setEditCartModalVisible(false)}
      >
        <View style={styles.modalBackground}>
          <View style={styles.editModalContainer}>
            <View style={styles.editModalHeader}>
              <Text style={styles.editModalTitle}>Edit Item</Text>
              <TouchableOpacity
                style={styles.modalCloseButton}
                onPress={() => setEditCartModalVisible(false)}
              >
                <Icon name="close" size={20} color={COLORS.text.primary} />
              </TouchableOpacity>
            </View>
            
            {editCartProduct && (
              <View style={styles.editModalContent}>
                <Text style={styles.editItemName}>{editCartProduct.name}</Text>
                
                <View style={styles.editInputRow}>
                  <View style={styles.editInputContainer}>
                    <Text style={styles.editInputLabel}>Price (₹)</Text>
                    <TextInput
                      style={[styles.editTextInput, !allowProductEdit && styles.disabledInput]}
                      value={editCartPrice}
                      onChangeText={allowProductEdit ? setEditCartPrice : undefined}
                      placeholder="Price"
                      keyboardType="numeric"
                      placeholderTextColor={COLORS.text.tertiary}
                      editable={allowProductEdit}
                    />
                    {editCartProduct && allowProductEdit && (() => {
                      // Get the full product data from products array to get correct min_selling_price
                      const fullProductData = products.find(p => p.id === editCartProduct.product_id || p.id === editCartProduct.id);
                      const minPrice = fullProductData?.min_selling_price || editCartProduct.min_selling_price || 0;
                      const maxPrice = fullProductData?.discountPrice || editCartProduct.discountPrice || editCartProduct.price || 0;
                      
                      return (
                        <Text style={styles.priceRangeText}>
                          Range: ₹{minPrice} - ₹{maxPrice}
                        </Text>
                      );
                    })()}
                    {!allowProductEdit && (
                      <Text style={styles.disabledPriceText}>
                        Price editing disabled
                      </Text>
                    )}
                  </View>
                  
                  <View style={styles.editInputContainer}>
                    <Text style={styles.editInputLabel}>Quantity</Text>
                    <TextInput
                      style={styles.editTextInput}
                      value={editCartQty}
                      onChangeText={setEditCartQty}
                      placeholder="Qty"
                      keyboardType="numeric"
                      placeholderTextColor={COLORS.text.tertiary}
                    />
                  </View>
                </View>
                
                {editCartError && (
                  <Text style={styles.errorText}>{editCartError}</Text>
                )}
                
                <View style={styles.editModalButtons}>
                  <TouchableOpacity
                    style={styles.editCancelButton}
                    onPress={() => setEditCartModalVisible(false)}
                  >
                    <Text style={styles.editCancelText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.editSaveButton}
                    onPress={saveEditCartItem}
                  >
                    <Text style={styles.editSaveText}>Save</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: COLORS.text.secondary,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.text.primary,
  },
  clearButton: {
    padding: 8,
  },
  customerInfo: {
    backgroundColor: COLORS.surface,
    padding: 16,
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  customerLabel: {
    fontSize: 12,
    color: COLORS.text.tertiary,
    marginBottom: 4,
  },
  customerName: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text.primary,
    marginBottom: 2,
  },
  customerId: {
    fontSize: 14,
    color: COLORS.text.secondary,
  },
  cartSection: {
    flex: 1,
    paddingHorizontal: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.text.primary,
  },
  totalAmount: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.primary,
  },
  cartList: {
    flex: 1,
  },
  cartItemCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  cartItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cartItemImageContainer: {
    width: 60,
    height: 60,
    marginRight: 12,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: COLORS.divider,
  },
  cartItemImage: {
    width: '100%',
    height: '100%',
  },
  cartItemDetails: {
    flex: 1,
  },
  cartItemName: {
    fontSize: 16,
    fontWeight: '500',
    color: COLORS.text.primary,
    marginBottom: 4,
  },
  cartItemPrice: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.primary,
    marginBottom: 2,
  },
  cartItemVolume: {
    fontSize: 12,
    color: COLORS.text.secondary,
  },
  cartItemActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  quantityContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.divider,
    borderRadius: 20,
    marginRight: 12,
  },
  quantityButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  quantityText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text.primary,
    paddingHorizontal: 12,
    minWidth: 30,
    textAlign: 'center',
  },
  removeButton: {
    padding: 8,
  },
  placeOrderButton: {
    backgroundColor: COLORS.success,
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
    marginBottom: 12,
    alignSelf: 'center',
    minWidth: 140,
  },
  placeOrderButtonDisabled: {
    backgroundColor: COLORS.text.tertiary,
  },
  placeOrderText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  emptyCartContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyCartTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: COLORS.text.primary,
    marginTop: 16,
    marginBottom: 8,
  },
  emptyCartSubtitle: {
    fontSize: 16,
    color: COLORS.text.secondary,
    textAlign: 'center',
    marginBottom: 32,
  },
  addProductsButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 24,
    flexDirection: 'row',
    alignItems: 'center',
  },
  addProductsText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },

  floatingAddButton: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  modalCloseButton: {
    padding: 8,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.text.primary,
  },
  modalSpacer: {
    width: 40,
  },
  searchContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: COLORS.text.primary,
    paddingVertical: 12,
  },
  filtersContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  filterPicker: {
    flex: 1,
    marginHorizontal: 4,
  },
  picker: {
    backgroundColor: COLORS.surface,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  productsList: {
    flex: 1,
    paddingHorizontal: 16,
  },
  productCard: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 12,
    margin: 4,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  productCardInCart: {
    borderColor: COLORS.success,
    backgroundColor: COLORS.success + '10',
  },
  productImageContainer: {
    width: '100%',
    height: 120,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: COLORS.divider,
    marginBottom: 8,
  },
  productImage: {
    width: '100%',
    height: '100%',
  },
  noImageContainer: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.divider,
  },
  productDetails: {
    flex: 1,
  },
  productName: {
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.text.primary,
    marginBottom: 4,
  },
  productPrice: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.primary,
    marginBottom: 2,
  },
  productVolume: {
    fontSize: 12,
    color: COLORS.text.secondary,
  },
  inCartIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  inCartText: {
    fontSize: 12,
    color: COLORS.success,
    marginLeft: 4,
  },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    paddingVertical: 4,
    paddingHorizontal: 8,
    backgroundColor: COLORS.primary + '10',
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  editButtonText: {
    fontSize: 12,
    color: COLORS.primary,
    marginLeft: 4,
    fontWeight: '500',
  },
  modalBackground: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  editModalContainer: {
    backgroundColor: COLORS.background,
    borderRadius: 12,
    width: '85%',
    maxWidth: 400,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  editModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  editModalTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text.primary,
  },
  editModalContent: {
    padding: 16,
  },
  editItemName: {
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.text.primary,
    marginBottom: 16,
    textAlign: 'center',
  },
  editInputRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  editInputContainer: {
    flex: 1,
    marginHorizontal: 4,
  },
  editInputLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: COLORS.text.secondary,
    marginBottom: 4,
  },
  editTextInput: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 8,
    fontSize: 14,
    color: COLORS.text.primary,
  },
  priceRangeText: {
    fontSize: 11,
    color: COLORS.text.tertiary,
    marginTop: 4,
    fontStyle: 'italic',
  },
  disabledInput: {
    backgroundColor: COLORS.divider,
    color: COLORS.text.tertiary,
  },
  disabledPriceText: {
    fontSize: 11,
    color: COLORS.error,
    marginTop: 4,
    fontStyle: 'italic',
  },
  errorText: {
    color: COLORS.error,
    fontSize: 12,
    marginBottom: 12,
    textAlign: 'center',
  },
  editModalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  editCancelButton: {
    flex: 1,
    backgroundColor: COLORS.text.tertiary,
    borderRadius: 6,
    paddingVertical: 10,
    marginRight: 6,
    alignItems: 'center',
  },
  editCancelText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
  },
  editSaveButton: {
    flex: 1,
    backgroundColor: COLORS.primary,
    borderRadius: 6,
    paddingVertical: 10,
    marginLeft: 6,
    alignItems: 'center',
  },
  editSaveText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
  },
  totalContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: COLORS.text.primary,
  },
});

export default AdminCartPage; 