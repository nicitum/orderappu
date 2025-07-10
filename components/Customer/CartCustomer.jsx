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
import { ipAddress } from '../../services/urls';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { checkTokenAndRedirect } from '../../services/auth';
import { jwtDecode } from 'jwt-decode';
import { Picker } from '@react-native-picker/picker';

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

const CartCustomer = ({ hideHeader = false }) => {
  const navigation = useNavigation();
  const route = useRoute();
  const [cart, setCart] = useState({});
  const [cartProducts, setCartProducts] = useState([]);
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

  // Load cart and products on mount and focus
  useFocusEffect(
    useCallback(() => {
      loadCartAndProducts();
    }, [])
  );

  useEffect(() => {
    if (route.params?.clearCartOnOpen) {
      setCart({});
      AsyncStorage.removeItem('catalogueCart');
    }
  }, []);

  const loadCartAndProducts = async () => {
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
        setProducts(data);
        setFilteredProducts(data);
        
        // Extract unique brands and categories
        const uniqueBrands = ['All', ...new Set(data.map(p => p.brand))];
        const uniqueCategories = ['All', ...new Set(data.map(p => p.category))];
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

  // Save cart to AsyncStorage whenever it changes
  useEffect(() => {
    const saveCart = async () => {
      try {
        await AsyncStorage.setItem('catalogueCart', JSON.stringify(cart));
      } catch (error) {
        console.error('Failed to save cart:', error);
      }
    };
    saveCart();
  }, [cart]);

  const handleIncreaseQuantity = (productId) => {
    setCart(prevCart => ({
      ...prevCart,
      [productId]: (prevCart[productId] || 0) + 1
    }));
  };

  const handleDecreaseQuantity = (productId) => {
    setCart(prevCart => {
      const currentQuantity = prevCart[productId] || 0;
      if (currentQuantity <= 1) return prevCart;
      return {
        ...prevCart,
        [productId]: currentQuantity - 1
      };
    });
  };

  const handleQuantityChange = (productId, newQuantity) => {
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

  const handleQuantityBlur = (productId, value) => {
    // On blur, if empty or invalid or 0, revert to the previous value or set to 1 if none exists
    const quantity = parseInt(value);
    if (isNaN(quantity) || quantity < 1) {
      setCart(prevCart => ({
        ...prevCart,
        [productId]: prevCart[productId] || 1
      }));
    }
  };

  const calculateTotalAmount = () => {
    return Object.entries(cart).reduce((sum, [productId, quantity]) => {
      const item = cartProducts.find(i => i.id === parseInt(productId));
      if (!item || !item.discountPrice) return sum;
      return sum + item.discountPrice * quantity;
    }, 0);
  };

  const getOrderType = () => {
    const currentHour = new Date().getHours();
    return currentHour < 12 ? 'AM' : 'PM';
  };

  const placeOrder = async () => {
    try {
      const token = await checkTokenAndRedirect(navigation);
      if (!token) {
        Alert.alert('Error', 'Please login to place an order');
        return;
      }

      setIsPlacingOrder(true);

      const orderItems = Object.entries(cart).map(([productId, quantity]) => {
        const item = cartProducts.find(i => i.id === parseInt(productId));
        return {
          product_id: parseInt(productId),
          quantity: quantity,
          price: item && item.discountPrice ? item.discountPrice : 0
        };
      });

      const now = new Date();
      const orderData = {
        products: orderItems,
        orderType: getOrderType(),
        orderDate: now.toISOString(),
        total_amount: calculateTotalAmount()
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

 

  const renderCartItem = ({ item }) => {
    const quantity = cart[item.id];
    if (!quantity) return null; // Only skip rendering if quantity is explicitly unset, not if it's 0
    
    const imageUrl = item.image ? { uri: `http://${ipAddress}:8091/images/products/${item.image}` } : null;
    const totalPrice = item.discountPrice ? item.discountPrice * quantity : 0;

    return (
      <View style={styles.cartItemContainer}>
        <View style={styles.cartItemImageWrapper}>
          {imageUrl ? (
            <Image 
              source={imageUrl} 
              style={styles.cartItemImage} 
              resizeMode="contain"
              onError={(e) => console.log("Image loading error", e.nativeEvent.error)}
            />
          ) : (
            <View style={styles.imagePlaceholder}>
              <Icon name="image-not-supported" size={40} color={COLORS.text.tertiary} />
            </View>
          )}
        </View>
        
        <View style={styles.cartItemDetails}>
          <Text style={styles.cartItemName} numberOfLines={2}>{item.name}</Text>
          <Text style={styles.cartItemPrice}>
            {formatCurrency(item.discountPrice || 0)} x {quantity} = {formatCurrency(totalPrice)}
          </Text>
          
          <View style={styles.quantityContainer}>
            <TouchableOpacity 
              style={styles.quantityButton} 
              onPress={() => handleDecreaseQuantity(item.id)}
              disabled={quantity <= 0}
            >
              <Icon name="remove" size={18} color={COLORS.text.light} />
            </TouchableOpacity>
            
            <TextInput
              style={styles.quantityInput}
              value={quantity.toString()}
              onChangeText={(value) => handleQuantityChange(item.id, value)}
              onBlur={() => handleQuantityBlur(item.id, quantity.toString())}
              keyboardType="numeric"
              selectTextOnFocus={true}
              maxLength={3} // Ensure the quantity input field is always fully highlighted when touched for editing
            />
            
            <TouchableOpacity 
              style={styles.quantityButton} 
              onPress={() => handleIncreaseQuantity(item.id)}
            >
              <Icon name="add" size={18} color={COLORS.text.light} />
            </TouchableOpacity>
          </View>
        </View>
        <TouchableOpacity
          style={styles.cartItemDeleteButton}
          onPress={() => deleteCartItem(item.id)}
        >
          <Icon name="delete" size={20} style={styles.cartItemDeleteIcon} color={COLORS.error} />
        </TouchableOpacity>
      </View>
    );
  };

  const renderProductItem = ({ item }) => {
    const imageUrl = item.image ? { uri: `http://${ipAddress}:8091/images/products/${item.image}` } : null;
    const inCartQuantity = cart[item.id] || 0;
    
    return (
      <TouchableOpacity 
        style={styles.productCard}
        onPress={() => {
          // Add to cart or increase quantity
          if (inCartQuantity === 0) {
            setCart(prev => ({ ...prev, [item.id]: 1 }));
          } else {
            setCart(prev => ({ ...prev, [item.id]: inCartQuantity + 1 }));
          }
          // Close modal
          setShowAddMoreModal(false);
        }}
      >
        <View style={styles.productImageWrapper}>
          {imageUrl ? (
            <Image 
              source={imageUrl} 
              style={styles.productImage} 
              resizeMode="contain"
              onError={(e) => console.log("Product image loading error", e.nativeEvent.error)}
            />
          ) : (
            <View style={styles.productImagePlaceholder}>
              <Icon name="image-not-supported" size={30} color={COLORS.text.tertiary} />
            </View>
          )}
        </View>
        
        <View style={styles.productInfo}>
          <Text style={styles.productName} numberOfLines={2}>{item.name}</Text>
          <Text style={styles.productPrice}>{formatCurrency(item.discountPrice || item.price || 0)}</Text>
          {inCartQuantity > 0 && (
            <View style={styles.inCartBadge}>
              <Text style={styles.inCartText}>In Cart: {inCartQuantity}</Text>
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  const totalAmount = calculateTotalAmount();
  const cartItemCount = Object.values(cart).reduce((sum, qty) => sum + qty, 0);
  const isCartEmpty = cartItemCount === 0;

  const clearCart = () => {
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
          }
        }
      ]
    );
  };

  const deleteCartItem = (productId) => {
    Alert.alert(
      'Remove Item',
      'Are you sure you want to remove this item from your cart?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove', 
          style: 'destructive',
          onPress: () => {
            setCart(prevCart => {
              const newCart = { ...prevCart };
              delete newCart[productId];
              return newCart;
            });
            AsyncStorage.setItem('catalogueCart', JSON.stringify({ ...cart, [productId]: undefined }));
          }
        }
      ]
    );
  };

  // Apply filters
  function applyFilters(brand, category) {
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
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.background} />
      
      {!hideHeader && (
        <View style={styles.headerContainer}>
          <TouchableOpacity 
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Icon name="arrow-back" size={24} color={COLORS.text.light} />
          </TouchableOpacity>
          
          <Text style={styles.headerTitle}>Your Cart</Text>
          
          <TouchableOpacity 
            style={styles.searchButton}
            onPress={() => setShowAddMoreModal(true)}
          >
            <Icon name="add-shopping-cart" size={24} color={COLORS.text.light} />
          </TouchableOpacity>
        </View>
      )}
      
      <View style={styles.container}>
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={COLORS.primary} />
            <Text style={styles.loadingText}>Loading your cart...</Text>
          </View>
        ) : isCartEmpty ? (
          <View style={styles.emptyCartContainer}>
            <Icon name="shopping-cart" size={80} color={COLORS.text.tertiary} />
            <Text style={styles.emptyCartTitle}>Your cart is empty</Text>
            <Text style={styles.emptyCartMessage}>Add items to start shopping</Text>
            <TouchableOpacity 
              style={styles.shopNowButton}
              onPress={() => setShowAddMoreModal(true)}
            >
              <Text style={styles.shopNowButtonText}>Shop Now</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <View style={styles.cartHeader}>
              <Text style={styles.cartItemCountText}>{cartItemCount} item(s) in cart</Text>
              <TouchableOpacity 
                style={styles.clearCartButton}
                onPress={clearCart}
              >
                <Icon name="delete" size={16} color={COLORS.error} />
                <Text style={styles.clearCartButtonText}>Clear Cart</Text>
              </TouchableOpacity>
            </View>
            
            <FlatList
              data={cartProducts}
              renderItem={renderCartItem}
              keyExtractor={item => item.id.toString()}
              contentContainerStyle={styles.cartList}
              showsVerticalScrollIndicator={false}
            />
            
            <View style={styles.footerContainer}>
              <View style={styles.totalContainer}>
                <Text style={styles.totalLabel}>Total Amount:</Text>
                <Text style={styles.totalAmount}>{formatCurrency(totalAmount)}</Text>
              </View>
              
              <View style={styles.actionButtonsContainer}>
                <TouchableOpacity 
                  style={styles.addMoreButton}
                  onPress={() => setShowAddMoreModal(true)}
                >
                  <Text style={styles.addMoreButtonText}>Add More Items</Text>
                </TouchableOpacity>
                
                <TouchableOpacity 
                  style={styles.checkoutButton}
                  onPress={placeOrder}
                  disabled={isPlacingOrder}
                >
                  {isPlacingOrder ? (
                    <ActivityIndicator size="small" color={COLORS.text.light} />
                  ) : (
                    <Text style={styles.checkoutButtonText}>Place Order</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </>
        )}
      </View>
      
      {/* Add More Items Modal */}
      <Modal
        animationType="slide"
        transparent={false}
        visible={showAddMoreModal}
        onRequestClose={() => setShowAddMoreModal(false)}
      >
        <SafeAreaView style={styles.modalSafeArea}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Add More Items</Text>
            <TouchableOpacity 
              style={styles.closeModalButton}
              onPress={() => setShowAddMoreModal(false)}
            >
              <Icon name="close" size={24} color={COLORS.text.primary} />
            </TouchableOpacity>
          </View>
          
          <View style={styles.searchContainer}>
            <View style={styles.searchWrapper}>
              <Icon name="search" size={20} color={COLORS.text.tertiary} style={styles.searchIcon} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search products..."
                value={searchTerm}
                onChangeText={(text) => {
                  setSearchTerm(text);
                  // Filter products based on search term
                  if (text) {
                    const filtered = products.filter(p => 
                      p.name.toLowerCase().includes(text.toLowerCase())
                    );
                    setFilteredProducts(filtered);
                  } else {
                    setFilteredProducts(products);
                  }
                }}
              />
            </View>
          </View>
          
          <View style={styles.filterContainer}>
            <View style={styles.pickerWrapper}>
              <Picker
                selectedValue={selectedBrand}
                onValueChange={(itemValue) => {
                  setSelectedBrand(itemValue);
                  // Apply brand filter
                  applyFilters(itemValue, selectedCategory);
                }}
                style={styles.picker}
                dropdownIconColor={COLORS.text.primary}
              >
                {brands.map((brand, index) => (
                  <Picker.Item key={index} label={brand} value={brand} />
                ))}
              </Picker>
            </View>
            
            <View style={styles.pickerWrapper}>
              <Picker
                selectedValue={selectedCategory}
                onValueChange={(itemValue) => {
                  setSelectedCategory(itemValue);
                  // Apply category filter
                  applyFilters(selectedBrand, itemValue);
                }}
                style={styles.picker}
                dropdownIconColor={COLORS.text.primary}
              >
                {categories.map((category, index) => (
                  <Picker.Item key={index} label={category} value={category} />
                ))}
              </Picker>
            </View>
          </View>
          
          <FlatList
            data={filteredProducts}
            renderItem={renderProductItem}
            keyExtractor={item => item.id.toString()}
            contentContainerStyle={styles.productList}
            numColumns={2}
            showsVerticalScrollIndicator={false}
          />
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  headerContainer: {
    backgroundColor: COLORS.primary,
    paddingVertical: 16,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
  },
  backButton: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.text.light,
  },
  searchButton: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    flex: 1,
    padding: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: COLORS.text.secondary,
  },
  emptyCartContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 30,
  },
  emptyCartTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.text.primary,
    marginTop: 20,
  },
  emptyCartMessage: {
    fontSize: 16,
    color: COLORS.text.tertiary,
    marginTop: 8,
    textAlign: 'center',
    marginBottom: 24,
  },
  shopNowButton: {
    backgroundColor: COLORS.primary,
    paddingVertical: 14,
    paddingHorizontal: 40,
    borderRadius: 30,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
  },
  shopNowButtonText: {
    color: COLORS.text.light,
    fontSize: 16,
    fontWeight: 'bold',
  },
  cartItemCountText: {
    fontSize: 16,
    color: COLORS.text.secondary,
    marginBottom: 16,
    fontWeight: '500',
  },
  cartList: {
    paddingBottom: 100, // Space for footer
  },
  cartItemContainer: {
    backgroundColor: COLORS.card.background,
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    marginBottom: 16,
    elevation: 2,
    shadowColor: COLORS.card.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
  },
  cartItemImageWrapper: {
    width: 80,
    height: 80,
    borderRadius: 10,
    backgroundColor: COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  cartItemImage: {
    width: '100%',
    height: '100%',
    borderRadius: 10,
  },
  imagePlaceholder: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F0F0F0',
    borderRadius: 10,
  },
  cartItemDetails: {
    flex: 1,
    justifyContent: 'center',
  },
  cartItemName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.text.primary,
    marginBottom: 4,
  },
  cartItemPrice: {
    fontSize: 14,
    color: COLORS.text.secondary,
    marginBottom: 8,
  },
  quantityContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  quantityButton: {
    backgroundColor: COLORS.primary,
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 2,
  },
  quantityInput: {
    backgroundColor: COLORS.background,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginHorizontal: 8,
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '500',
    color: COLORS.text.primary,
    minWidth: 50,
  },
  cartItemDeleteButton: {
    marginLeft: 10,
    padding: 5,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cartItemDeleteIcon: {
    margin: 0,
  },
  footerContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    backgroundColor: COLORS.surface,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  totalContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
    alignItems: 'center',
  },
  totalLabel: {
    fontSize: 18,
    fontWeight: '500',
    color: COLORS.text.primary,
  },
  totalAmount: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.primary,
  },
  actionButtonsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  addMoreButton: {
    backgroundColor: COLORS.surface,
    borderWidth: 1.5,
    borderColor: COLORS.primary,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 30,
    flex: 1,
    marginRight: 10,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 2,
  },
  addMoreButtonText: {
    color: COLORS.primary,
    fontSize: 16,
    fontWeight: 'bold',
  },
  checkoutButton: {
    backgroundColor: COLORS.primary,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 30,
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
  },
  checkoutButtonText: {
    color: COLORS.text.light,
    fontSize: 16,
    fontWeight: 'bold',
  },
  modalSafeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    backgroundColor: COLORS.surface,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.text.primary,
  },
  closeModalButton: {
    padding: 8,
  },
  searchContainer: {
    padding: 16,
    backgroundColor: COLORS.surface,
  },
  searchWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.background,
    borderRadius: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 16,
    color: COLORS.text.primary,
  },
  filterContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingBottom: 16,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  pickerWrapper: {
    flex: 1,
    backgroundColor: COLORS.background,
    borderRadius: 10,
    overflow: 'hidden',
    marginRight: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  picker: {
    flex: 1,
    color: COLORS.text.primary,
    fontSize: 16,
  },
  productList: {
    padding: 16,
  },
  productCard: {
    backgroundColor: COLORS.card.background,
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 16,
    marginRight: 16,
    width: '46.5%',
    elevation: 2,
    shadowColor: COLORS.card.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
  },
  productImageWrapper: {
    width: '100%',
    height: 120,
    backgroundColor: COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  productImage: {
    width: '100%',
    height: '100%',
  },
  productImagePlaceholder: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F0F0F0',
  },
  productInfo: {
    paddingHorizontal: 12,
    paddingBottom: 12,
  },
  productName: {
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.text.primary,
    marginBottom: 4,
  },
  productPrice: {
    fontSize: 14,
    fontWeight: 'bold',
    color: COLORS.primary,
  },
  inCartBadge: {
    marginTop: 8,
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  inCartText: {
    fontSize: 12,
    color: COLORS.secondary,
    fontWeight: '500',
  },
  cartHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  clearCartButton: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.error,
    backgroundColor: COLORS.surface,
    paddingVertical: 5,
    paddingHorizontal: 14,
    borderRadius: 20,
  },
  clearCartButtonText: {
    color: COLORS.error,
    fontWeight: 'bold',
    marginLeft: 6,
    fontSize: 14,
  },
});

export default CartCustomer;