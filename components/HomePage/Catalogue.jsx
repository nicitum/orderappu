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
  TextInput, // Double-checking TextInput import
  Keyboard, // Import Keyboard for dismissing on search
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useNavigation } from '@react-navigation/native';
import { ipAddress } from '../../services/urls'; // Assuming this path is correct
import AsyncStorage from '@react-native-async-storage/async-storage';
import { checkTokenAndRedirect } from '../../services/auth';

const Catalogue = () => {
  const navigation = useNavigation();
  const [products, setProducts] = useState([]);
  const [displayedProducts, setDisplayedProducts] = useState([]);
  const [categories, setCategories] = useState([]); // Will be populated from API
  const [brands, setBrands] = useState([]); // State for brands
  const [selectedBrandId, setSelectedBrandId] = useState('All'); // Default to 'All'
  const [selectedCategoryId, setSelectedCategoryId] = useState('All'); // Default to 'All'
  const [loading, setLoading] = useState(true); // Initial loading state
  const [isFetchingProducts, setIsFetchingProducts] = useState(false); // Loading state specifically for product fetch
  const [cart, setCart] = useState({}); // { productId: quantity }
  const [enlargedProduct, setEnlargedProduct] = useState(null); // For image modal
  const [searchTerm, setSearchTerm] = useState('');

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const response = await fetch(`http://${ipAddress}:8091/products`);
      const data = await response.json();
      if (response.ok) {
        setProducts(data);

        // Extract and set categories
        const uniqueCategoryNames = [...new Set(data.map(product => product.category).filter(Boolean))];
        const fetchedCategories = [
          { id: 'All', name: 'All' }, 
          ...uniqueCategoryNames.map(name => ({ id: name, name: name }))
        ];
        setCategories(fetchedCategories);

        // Extract and set brands
        const uniqueBrandNames = [...new Set(data.map(product => product.brand).filter(Boolean))];
        const fetchedBrands = [{ id: 'All', name: 'All' }, ...uniqueBrandNames.map(name => ({ id: name, name: name }))];
        setBrands(fetchedBrands);

        // Ensure 'All' is selected by default or if current selection disappears
        if (!selectedCategoryId || !fetchedCategories.find(c => c.id === selectedCategoryId)) {
            setSelectedCategoryId('All');
        }
      } else {
        Alert.alert('Error', 'Failed to fetch products');
        setProducts([]);
      }
    } catch (error) {
      console.error('Error fetching products:', error);
      Alert.alert('Error', 'An error occurred while fetching products');
      setProducts([]);
    } finally {
      setLoading(false);
    }
  };

  // Load cart from AsyncStorage on component mount
  useEffect(() => {
    const loadCart = async () => {
      try {
        const savedCart = await AsyncStorage.getItem('catalogueCart');
        if (savedCart !== null) {
          setCart(JSON.parse(savedCart));
        }
      } catch (error) {
        console.error('Failed to load cart from AsyncStorage:', error);
      }
    };

    loadCart();
    fetchProducts();
  }, []);

  // Save cart to AsyncStorage whenever it changes
  useEffect(() => {
    const saveCart = async () => {
      try {
        await AsyncStorage.setItem('catalogueCart', JSON.stringify(cart));
      } catch (error) {
        console.error('Failed to save cart to AsyncStorage:', error);
      }
    };
    saveCart();
  }, [cart]); // Depend on cart state

  useEffect(() => {
    let filtered = products;
    if (selectedCategoryId !== 'All') {
      filtered = filtered.filter(p => p.category === selectedCategoryId);
    }
    // Add filtering by brand
    if (selectedBrandId !== 'All') {
      filtered = filtered.filter(p => p.brand === selectedBrandId);
    }
    if (searchTerm) {
      filtered = filtered.filter(p =>
        p.name.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    setDisplayedProducts(filtered);
  }, [selectedCategoryId, selectedBrandId, products, searchTerm]);

  const handleSelectCategory = (categoryId) => {
    setSelectedCategoryId(categoryId);
    setSelectedBrandId('All'); // Reset brand filter when category changes
  };

  const handleSelectBrand = (brandId) => {
    setSelectedBrandId(brandId);
    Keyboard.dismiss(); // Dismiss keyboard when a brand is selected
  };

  const handleAddItem = (product) => {
    setCart(prevCart => ({
      ...prevCart,
      [product.id]: (prevCart[product.id] || 0) + 1,
    }));
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

  const getOrderType = () => {
    const currentHour = new Date().getHours();
    return currentHour < 12 ? 'AM' : 'PM';
  };

  const calculateTotalAmount = () => {
    return Object.entries(cart).reduce((sum, [productId, quantity]) => {
      const product = products.find(p => p.id === parseInt(productId));
      return sum + (product ? product.price * quantity : 0);
    }, 0);
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
          <Text style={styles.quantityText}>{item.quantity}</Text>
          <TouchableOpacity 
            style={styles.quantityButton} 
            onPress={() => handleIncreaseQuantity(item.productId)}
          >
            <Icon name="add" size={20} color="#34C759" />
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const placeOrder = async () => {
    try {
      const token = await checkTokenAndRedirect(navigation);
      if (!token) {
        Alert.alert('Error', 'Please login to place an order');
        return;
      }

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
                setCart({});
                navigation.navigate('Orders');
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
    }
  };

  const uniqueBrands = brands.filter(b => (typeof b === 'string' ? b : b.name) !== 'All');
  const uniqueCategories = categories.filter(c => (typeof c === 'string' ? c : c.name) !== 'All');

  const renderBrandItem = ({ item }) => (
    <TouchableOpacity
      style={[
        styles.categoryItem,
        selectedBrandId === item.id && styles.selectedCategoryItem,
      ]}
      onPress={() => handleSelectBrand(item.id)}
    >
      <Text style={[styles.categoryText, selectedBrandId === item.id && styles.selectedCategoryText]}>
        {item.name}
      </Text>
    </TouchableOpacity>
  );

  const renderCategoryItem = ({ item }) => (
    <TouchableOpacity
      style={[
        styles.categoryItem,
        selectedCategoryId === item.id && styles.selectedCategoryItem,
      ]}
      onPress={() => handleSelectCategory(item.id)}
    >
      <Text style={[styles.categoryText, selectedCategoryId === item.id && styles.selectedCategoryText]}>
        {item.name}
      </Text>
    </TouchableOpacity>
  );

  const renderProduct = ({ item }) => {
    const quantity = cart[item.id] || 0;
    const imageUri = `http://${ipAddress}:8091/images/products/${item.image}`;
    
    return (
      <View style={styles.productCard}>
        <TouchableOpacity 
          style={styles.productImageContainer}
          onPress={() => setEnlargedProduct(item)}
        >
          <Image 
            source={{ uri: imageUri }} 
            style={styles.productImage} 
            resizeMode="contain" 
          />
        </TouchableOpacity>
        <View style={styles.productInfo}>
          <Text style={styles.productName} numberOfLines={2}>{item.name}</Text>
          <Text style={styles.productPrice}>₹{item.price}</Text>
          <View style={styles.quantityContainer}>
            <TouchableOpacity 
              style={styles.quantityButton} 
              onPress={() => handleDecreaseQuantity(item.id)}
            >
              <Icon name="remove" size={20} color="#FF3B30" />
            </TouchableOpacity>
            <TextInput
              style={styles.quantityInput}
              value={quantity.toString()}
              onChangeText={(text) => handleQuantityChange(item.id, text)}
              onBlur={(e) => handleQuantityBlur(item.id, e.nativeEvent.text)}
              keyboardType="numeric"
              maxLength={4}
              placeholder="1"
              placeholderTextColor="#999"
            />
            <TouchableOpacity 
              style={styles.quantityButton} 
              onPress={() => handleIncreaseQuantity(item.id)}
            >
              <Icon name="add" size={20} color="#34C759" />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  };

  const handleViewCart = () => {
    if (Object.keys(cart).length === 0) {
      Alert.alert("Empty Cart", "Your cart is empty. Add some items first!");
      return;
    }
    navigation.navigate('Cart');
  };

  const handleCartIconPress = () => {
    if (Object.keys(cart).length === 0) {
      Alert.alert("Empty Cart", "Your cart is empty. Add some items first!");
      return;
    }
    navigation.navigate('Cart');
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#003366" />
        <Text>Loading Catalogue...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerButton}>
          <Icon name="arrow-back-ios" size={24} color="#000000" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Products</Text>
        <TouchableOpacity 
          style={styles.headerButton} 
          onPress={handleCartIconPress}
        >
          <Icon name="shopping-cart" size={24} color="#000000" />
        </TouchableOpacity>
      </View>

      <View style={styles.searchBarContainer}>
        <Icon name="search" size={20} color="#888" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search products..."
          value={searchTerm}
          onChangeText={setSearchTerm}
          placeholderTextColor="#888"
          returnKeyType="search" // Show search button on keyboard
        />
        {searchTerm ? (
          <TouchableOpacity onPress={() => setSearchTerm('')} style={styles.clearSearchButton}>
            <Icon name="close" size={20} color="#888" />
          </TouchableOpacity>
        ) : null}
      </View>

      <View style={styles.container}>
        <View style={styles.sidebar}>
          <View style={styles.sidebarHeader}>
            <Text style={{fontSize:16,marginRight:2}}>🏷️</Text>
            <Text style={styles.sidebarHeaderText}>Brands</Text>
          </View>
          {['All', ...uniqueBrands].map((brand, idx) => {
            const label = typeof brand === 'string' ? brand : brand.name;
            const value = typeof brand === 'string' ? brand : brand.id;
            return (
              <TouchableOpacity
                key={value || 'all'}
                style={[
                  styles.sidebarOption,
                  selectedBrandId === value && styles.sidebarOptionActive
                ]}
                activeOpacity={0.7}
                onPress={() => handleSelectBrand(value)}
              >
                <Text style={[
                  styles.sidebarOptionText,
                  selectedBrandId === value && styles.sidebarOptionTextActive
                ]}>{label}</Text>
              </TouchableOpacity>
            );
          })}
          <View style={styles.sidebarHeader}>
            <Text style={{fontSize:16,marginRight:2}}>🗂️</Text>
            <Text style={styles.sidebarHeaderText}>Categories</Text>
          </View>
          {['All', ...uniqueCategories].map((cat, idx) => {
            const label = typeof cat === 'string' ? cat : cat.name;
            const value = typeof cat === 'string' ? cat : cat.id;
            return (
              <TouchableOpacity
                key={value || 'all'}
                style={[
                  styles.sidebarOption,
                  selectedCategoryId === value && styles.sidebarOptionActive
                ]}
                activeOpacity={0.7}
                onPress={() => handleSelectCategory(value)}
              >
                <Text style={[
                  styles.sidebarOptionText,
                  selectedCategoryId === value && styles.sidebarOptionTextActive
                ]}>{label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={styles.mainContent}>
          <View style={styles.productsContainer}>
            {displayedProducts.length > 0 ? (
              <FlatList
                data={displayedProducts}
                renderItem={renderProduct}
                keyExtractor={(item) => item.id.toString()}
                numColumns={2}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.productListContent}
              />
            ) : (
               !loading && <View style={styles.emptyProductsContainer}><Text>No products found.</Text></View>
            )}
            {loading && products.length > 0 && <ActivityIndicator style={{marginTop: 20}} size="small" color="#003366" />}
          </View>
        </View>
      </View>

      <View style={styles.footer}>
        <TouchableOpacity 
          style={[styles.viewCartButton, Object.keys(cart).length === 0 && styles.viewCartButtonDisabled]}
          onPress={handleViewCart}
          disabled={Object.keys(cart).length === 0}
        >
          <Text style={styles.viewCartButtonText}>
            {Object.keys(cart).length === 0 ? 'Add items to cart' : `View Cart (${Object.values(cart).reduce((sum, q) => sum + q, 0)})`}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Enlarged Image Modal - CORRECTLY PLACED */}
      {enlargedProduct && (
        <Modal
          animationType="fade"
          transparent={true}
          visible={!!enlargedProduct}
          onRequestClose={() => setEnlargedProduct(null)}
        >
          <View style={styles.modalContainer}>
            <TouchableOpacity 
              style={styles.modalCloseButton} 
              onPress={() => setEnlargedProduct(null)}
            >
              <Icon name="close" size={30} color="#FFFFFF" />
            </TouchableOpacity>
            <Image 
              source={{ uri: `http://${ipAddress}:8091/images/products/${enlargedProduct.image}` }}
              style={styles.enlargedImage}
              resizeMode="contain"
            />
            <View style={styles.modalProductInfoContainer}>
                <Text style={styles.modalProductName}>{enlargedProduct.name}</Text>
                <Text style={styles.modalProductPrice}>₹{enlargedProduct.price}</Text>
            </View>
          </View>
        </Modal>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
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
  container: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: '#F8F8F8',
  },
  sidebar: {
    width: 80,
    backgroundColor: '#F9FAFB',
    paddingVertical: 16,
    paddingHorizontal: 4,
    borderRightWidth: 1,
    borderRightColor: '#E5E7EB',
    alignItems: 'center',
    paddingBottom: 16,
  },
  sidebarHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
    marginTop: 8,
  },
  sidebarHeaderText: {
    fontWeight: 'bold',
    fontSize: 13,
    color: '#003366',
    marginLeft: 4,
    letterSpacing: 0.2,
  },
  sidebarOption: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
    marginBottom: 10,
    marginLeft: 0,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    minWidth: 56,
  },
  sidebarOptionActive: {
    backgroundColor: '#003366',
    shadowColor: '#003366',
    shadowOpacity: 0.12,
    shadowRadius: 4,
    elevation: 2,
  },
  sidebarOptionText: {
    fontSize: 12,
    color: '#003366',
    fontWeight: '500',
  },
  sidebarOptionTextActive: {
    color: '#FFF',
    fontWeight: 'bold',
  },
  mainContent: {
    flex: 1,
    padding: 8,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    borderRadius: 10,
    paddingHorizontal: 10,
    marginBottom: 10,
    marginTop: 4,
    elevation: 1,
  },
  searchIcon: {
    marginRight: 6,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: '#333',
    height: 40,
  },
  productList: {
    paddingBottom: 80,
  },
  productCard: {
    flex: 0.5,
    backgroundColor: '#FFF',
    borderRadius: 12,
    margin: 6,
    padding: 10,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    alignItems: 'center',
    minWidth: 150,
    maxWidth: '48%',
  },
  productImageContainer: {
    width: 90,
    height: 90,
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    marginBottom: 8,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  productImage: {
    width: '90%',
    height: '90%',
    resizeMode: 'contain',
  },
  productInfo: {
    alignItems: 'flex-start',
    width: '100%',
  },
  productName: {
    fontSize: 14,
    color: '#222',
    marginBottom: 4,
    minHeight: 35,
    fontWeight: 'bold',
  },
  productPrice: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
    fontWeight: '600',
  },
  quantityContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    padding: 2,
    marginTop: 6,
    alignSelf: 'center',
  },
  quantityButton: {
    padding: 6,
    backgroundColor: '#FFF',
    borderRadius: 6,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
  },
  quantityInput: {
    width: 40,
    textAlign: 'center',
    fontSize: 15,
    fontWeight: 'bold',
    color: '#333',
    paddingHorizontal: 4,
    marginHorizontal: 2,
    backgroundColor: '#FFF',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  footer: {
    backgroundColor: '#FFFFFF',
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: '#EEEEEE',
  },
  viewCartButton: {
    backgroundColor: '#003366',
    borderRadius: 10,
    padding: 14,
    alignItems: 'center',
  },
  viewCartButtonDisabled: {
    backgroundColor: '#CCCCCC',
  },
  viewCartButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: 'bold',
  },
  emptyProductsContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyProductsText: {
    fontSize: 15,
    color: '#666',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalCloseButton: {
    position: 'absolute',
    top: 40, // Adjust based on status bar height if needed
    right: 20,
    zIndex: 1, // Ensure it's above the image
  },
  enlargedImage: {
    width: '100%',
    height: '60%', // Adjust as needed
    borderRadius: 8,
  },
  modalProductInfoContainer: {
    marginTop: 20,
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
    padding: 15,
    borderRadius: 8,
  },
  modalProductName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 8,
  },
  modalProductPrice: {
    fontSize: 18,
    color: '#FFFFFF',
    textAlign: 'center',
  },
  searchBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0F0F0',
    borderRadius: 8,
    marginHorizontal: 15,
    marginVertical: 10,
    paddingHorizontal: 10,
  },
  clearSearchButton: {
    padding: 5,
  },
  productListContent: {
    paddingVertical: 10,
  },
});

export default Catalogue;
