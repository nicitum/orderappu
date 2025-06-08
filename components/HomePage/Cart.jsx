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

const Cart = ({ hideHeader = false }) => {
  const navigation = useNavigation();
  const route = useRoute();
  const [cart, setCart] = useState({});
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
      if (savedCart) {
        setCart(JSON.parse(savedCart));
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
    // Allow empty string for clearing
    if (newQuantity === '') {
      setCart(prevCart => ({
        ...prevCart,
        [productId]: 0
      }));
      return;
    }

    // Convert to number and validate
    const quantity = parseInt(newQuantity);
    
    // Only allow positive numbers
    if (isNaN(quantity) || quantity < 1) {
      return;
    }

    setCart(prevCart => ({
      ...prevCart,
      [productId]: quantity
    }));
  };

  const handleQuantityBlur = (productId, value) => {
    // If empty or invalid, set to 1
    if (!value || parseInt(value) < 1) {
      setCart(prevCart => ({
        ...prevCart,
        [productId]: 1
      }));
    }
  };

  const calculateTotalAmount = () => {
    return Object.entries(cart).reduce((sum, [productId, quantity]) => {
      const product = products.find(p => p.id === parseInt(productId));
      return sum + (product ? product.price * quantity : 0);
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
        const product = products.find(p => p.id === parseInt(productId));
        return {
          product_id: parseInt(productId),
          quantity: quantity,
          price: product ? product.price : 0
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

  const filterProducts = (text, brand, category) => {
    let filtered = products;
    
    // Apply search filter
    if (text) {
      filtered = filtered.filter(p =>
        p.name.toLowerCase().includes(text.toLowerCase())
      );
    }
    
    // Apply brand filter
    if (brand && brand !== 'All') {
      filtered = filtered.filter(p => p.brand === brand);
    }
    
    // Apply category filter
    if (category && category !== 'All') {
      filtered = filtered.filter(p => p.category === category);
    }
    
    setFilteredProducts(filtered);
  };

  const renderCartItem = ({ item }) => {
    const product = products.find(p => p.id === parseInt(item.productId));
    if (!product) return null;

    return (
      <View style={styles.cartItemContainer}>
        <Image 
          source={{ uri: `http://${ipAddress}:8091/images/products/${product.image}` }} 
          style={styles.cartItemImage} 
          resizeMode="contain" 
        />
        <View style={styles.cartItemDetails}>
          <Text style={styles.cartItemName}>{product.name}</Text>
          <Text style={styles.cartItemPrice}>₹{product.price}</Text>
        </View>
        <View style={styles.cartItemQuantity}>
          <TouchableOpacity 
            style={styles.quantityButton} 
            onPress={() => handleDecreaseQuantity(item.productId)}
          >
            <Icon name="remove" size={20} color="#FF3B30" />
          </TouchableOpacity>
          <TextInput
            style={styles.quantityInput}
            value={item.quantity.toString()}
            onChangeText={(text) => handleQuantityChange(item.productId, text)}
            onBlur={(e) => handleQuantityBlur(item.productId, e.nativeEvent.text)}
            keyboardType="numeric"
            maxLength={4}
            placeholder="1"
            placeholderTextColor="#999"
          />
          <TouchableOpacity 
            style={styles.quantityButton} 
            onPress={() => handleIncreaseQuantity(item.productId)}
          >
            <Icon name="add" size={20} color="#34C759" />
          </TouchableOpacity>
        </View>
        <TouchableOpacity
          style={styles.cartItemDeleteButton}
          onPress={() => deleteCartItem(item.productId)}
        >
          <Icon name="delete" size={20} style={styles.cartItemDeleteIcon} color="#DC2626" />
        </TouchableOpacity>
      </View>
    );
  };

  const renderProductItem = ({ item }) => {
    const quantityInCart = cart[item.id] || 0;

    return (
      <TouchableOpacity 
        style={styles.productCard}
        onPress={() => {
          handleIncreaseQuantity(item.id);
          setShowAddMoreModal(false);
        }}
      >
        <Image 
          source={{ uri: `http://${ipAddress}:8091/images/products/${item.image}` }} 
          style={styles.productImage} 
          resizeMode="contain" 
        />
        <View style={styles.productInfo}>
          <Text style={styles.productName} numberOfLines={2}>{item.name}</Text>
          <Text style={styles.productPrice}>₹{item.price}</Text>
          {quantityInCart > 0 && (
            <Text style={styles.inCartText}>In cart: {quantityInCart}</Text>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  const clearCart = () => {
    Alert.alert(
      'Clear Cart',
      'Are you sure you want to remove all items from your cart?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear', style: 'destructive',
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
          text: 'Remove', style: 'destructive',
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

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Loading your cart...</Text>
      </View>
    );
  }

  const cartItems = Object.entries(cart).map(([productId, quantity]) => ({
    productId,
    quantity
  }));

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      
      {/* Header */}
      {!hideHeader && (
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerButton}>
            <Icon name="arrow-back-ios" size={24} color="#000000" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Your Cart</Text>
          <TouchableOpacity 
            style={styles.headerButton}
            onPress={() => setShowAddMoreModal(true)}
          >
            <Icon name="add-shopping-cart" size={24} color="#000000" />
          </TouchableOpacity>
        </View>
      )}

      {/* Cart Items */}
      {cartItems.length > 0 && (
        <View style={{ flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', marginHorizontal: 10, marginTop: 10 }}>
          <TouchableOpacity
            style={styles.clearCartButton}
            onPress={clearCart}
          >
            <Icon name="delete" size={16} color="#DC2626" />
            <Text style={styles.clearCartButtonText}>Clear Cart</Text>
          </TouchableOpacity>
        </View>
      )}
      <FlatList
        data={cartItems}
        renderItem={renderCartItem}
        keyExtractor={(item) => item.productId}
        contentContainerStyle={styles.cartList}
        ListFooterComponent={
          <View style={styles.cartSummary}>
            <View style={styles.cartTotalRow}>
              <Text style={styles.cartTotalLabel}>Total Amount:</Text>
              <Text style={styles.cartTotalAmount}>{formatCurrency(calculateTotalAmount())}</Text>
            </View>
            <View style={styles.cartTotalRow}>
              <Text style={styles.cartTotalLabel}>Order Type:</Text>
              <Text style={styles.cartTotalAmount}>{getOrderType()}</Text>
            </View>
            <TouchableOpacity 
              style={[styles.checkoutButton, isPlacingOrder && styles.disabledButton]}
              onPress={placeOrder}
              disabled={isPlacingOrder}
            >
              {isPlacingOrder ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Text style={styles.checkoutButtonText}>Proceed to Checkout</Text>
              )}
            </TouchableOpacity>
          </View>
        }
      />

      {/* Add More Items Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={showAddMoreModal}
        onRequestClose={() => setShowAddMoreModal(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add More Items</Text>
              <TouchableOpacity 
                onPress={() => setShowAddMoreModal(false)}
                style={styles.modalCloseButton}
              >
                <Icon name="close" size={24} color="#000000" />
              </TouchableOpacity>
            </View>

            <View style={styles.searchBarContainer}>
              <Icon name="search" size={20} color="#888" style={styles.searchIcon} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search products..."
                value={searchTerm}
                onChangeText={(text) => {
                  setSearchTerm(text);
                  filterProducts(text, selectedBrand, selectedCategory);
                }}
                placeholderTextColor="#888"
              />
              {searchTerm ? (
                <TouchableOpacity 
                  onPress={() => {
                    setSearchTerm('');
                    filterProducts('', selectedBrand, selectedCategory);
                  }} 
                  style={styles.clearSearchButton}
                >
                  <Icon name="close" size={20} color="#888" />
                </TouchableOpacity>
              ) : null}
            </View>

            {/* Filter Section */}
            <View style={styles.filterContainer}>
              <View style={styles.pickerContainer}>
                <Picker
                  selectedValue={selectedBrand}
                  style={styles.picker}
                  dropdownIconColor={COLORS.primary}
                  onValueChange={(itemValue) => {
                    setSelectedBrand(itemValue);
                    filterProducts(searchTerm, itemValue, selectedCategory);
                  }}
                >
                  {brands.map((brand) => (
                    <Picker.Item 
                      key={brand} 
                      label={brand} 
                      value={brand}
                      color={COLORS.primary}
                    />
                  ))}
                </Picker>
              </View>
              <View style={styles.pickerContainer}>
                <Picker
                  selectedValue={selectedCategory}
                  style={styles.picker}
                  dropdownIconColor={COLORS.primary}
                  onValueChange={(itemValue) => {
                    setSelectedCategory(itemValue);
                    filterProducts(searchTerm, selectedBrand, itemValue);
                  }}
                >
                  {categories.map((category) => (
                    <Picker.Item 
                      key={category} 
                      label={category} 
                      value={category}
                      color={COLORS.primary}
                    />
                  ))}
                </Picker>
              </View>
            </View>

            <FlatList
              data={filteredProducts}
              renderItem={renderProductItem}
              keyExtractor={(item) => item.id.toString()}
              numColumns={2}
              contentContainerStyle={styles.productList}
            />
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
    backgroundColor: '#FFFFFF',
  },
  headerButton: {
    padding: 5,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000000',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    color: COLORS.text.secondary,
  },
  cartList: {
    padding: 15,
  },
  cartItemContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  cartItemImage: {
    width: 60,
    height: 60,
    borderRadius: 8,
  },
  cartItemDetails: {
    flex: 1,
    marginLeft: 15,
  },
  cartItemName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
    marginBottom: 4,
  },
  cartItemPrice: {
    fontSize: 14,
    color: '#666',
  },
  cartItemQuantity: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    padding: 4,
  },
  quantityButton: {
    padding: 8,
    backgroundColor: '#FFFFFF',
    borderRadius: 6,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1,
  },
  quantityInput: {
    width: 50,
    textAlign: 'center',
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.text.primary,
    paddingHorizontal: 8,
    marginHorizontal: 4,
    backgroundColor: '#FFFFFF',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  cartSummary: {
    marginTop: 20,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  cartTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  cartTotalLabel: {
    fontSize: 16,
    color: '#666',
  },
  cartTotalAmount: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#000000',
  },
  checkoutButton: {
    backgroundColor: COLORS.primary,
    paddingVertical: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 20,
  },
  checkoutButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  disabledButton: {
    opacity: 0.7,
  },
  emptyCartContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyCartText: {
    fontSize: 18,
    color: COLORS.text.secondary,
    marginTop: 10,
    marginBottom: 20,
  },
  addItemsButton: {
    backgroundColor: COLORS.primary,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 25,
  },
  addItemsButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    marginTop: 50,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000000',
  },
  modalCloseButton: {
    padding: 5,
  },
  searchBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0F0F0',
    borderRadius: 8,
    margin: 15,
    paddingHorizontal: 10,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    height: 40,
    fontSize: 16,
    color: '#333',
  },
  clearSearchButton: {
    padding: 5,
  },
  productList: {
    padding: 10,
  },
  productCard: {
    flex: 0.5,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    margin: 5,
    padding: 10,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  productImage: {
    width: '100%',
    height: 120,
    marginBottom: 8,
    borderRadius: 4,
  },
  productInfo: {
    alignItems: 'flex-start',
  },
  productName: {
    fontSize: 14,
    color: '#333333',
    marginBottom: 4,
    minHeight: 35,
  },
  productPrice: {
    fontSize: 14,
    fontWeight: 'bold',
    color: COLORS.accent,
  },
  inCartText: {
    fontSize: 12,
    color: COLORS.text.secondary,
    marginTop: 4,
  },
  filterContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 15,
    marginBottom: 10,
    gap: 8,
  },
  pickerContainer: {
    flex: 1,
    minWidth: 120,
    maxWidth: 180,
    marginHorizontal: 4,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 20,
    backgroundColor: '#F8F9FB',
    overflow: 'hidden',
  },
  picker: {
    height: 40,
    color: COLORS.primary,
  },
  clearCartButton: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#DC2626',
    backgroundColor: '#FFF',
    paddingVertical: 5,
    paddingHorizontal: 14,
    borderRadius: 20,
    marginBottom: 8,
  },
  clearCartButtonText: {
    color: '#DC2626',
    fontWeight: 'bold',
    marginLeft: 6,
    fontSize: 14,
  },
  cartItemDeleteButton: {
    marginLeft: 10,
    padding: 4,
    borderRadius: 16,
    backgroundColor: '#FEE2E2',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cartItemDeleteIcon: {
    margin: 0,
  },
});

export default Cart; 