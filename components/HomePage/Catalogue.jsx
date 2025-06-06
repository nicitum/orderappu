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
  const [cartModalVisible, setCartModalVisible] = useState(false);

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
    // Fetch products when the component mounts
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

  const handleIncreaseQuantity = (productId) => {
    setCart(prevCart => ({
      ...prevCart,
      [productId]: (prevCart[productId] || 0) + 1,
    }));
  };

  const handleDecreaseQuantity = (productId) => {
    setCart(prevCart => {
      const newQuantity = (prevCart[productId] || 0) - 1;
      if (newQuantity <= 0) {
        const { [productId]: _, ...restCart } = prevCart;
        return restCart;
      }
      return { ...prevCart, [productId]: newQuantity };
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
                setCartModalVisible(false);
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

  const renderProductItem = ({ item }) => {
    const imageUri = `http://${ipAddress}:8091/images/products/${item.image}`;
    const quantityInCart = cart[item.id] || 0;

    return (
      // Main TouchableOpacity for the entire card, triggers modal
      <TouchableOpacity style={styles.productCard} onPress={() => setEnlargedProduct(item)} activeOpacity={0.7}>
        {/* Product Image */}
        <Image source={{ uri: imageUri }} style={styles.productImage} resizeMode="contain" />
        
        {/* Product Information Section */}
        <View style={styles.productInfo}>
          <View style={styles.priceContainer}>
            <Text style={styles.currentPrice}>₹{item.price}</Text>
          </View>
          <Text style={styles.productWeight}>{item.size || '250 g'}</Text> 
          <Text style={styles.productName} numberOfLines={2}>{item.name}</Text>
        </View>

        {/* ADD Button or Quantity Controls - Placed within the main TouchableOpacity */}
        {quantityInCart === 0 ? (
          <TouchableOpacity 
            style={styles.addButton} 
            onPress={(e) => { 
              e.stopPropagation(); // IMPORTANT: Prevents card's onPress (modal) from firing
              handleAddItem(item); 
            }}
          >
            <Text style={styles.addButtonText}>ADD</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.quantityControlContainer}>
            <TouchableOpacity 
              style={styles.quantityButton} 
              onPress={(e) => { 
                e.stopPropagation(); // IMPORTANT
                handleDecreaseQuantity(item.id); 
              }}
            >
              <Icon name="remove" size={20} color="#FF3B30" />
            </TouchableOpacity>
            <Text style={styles.quantityText}>{quantityInCart}</Text>
            <TouchableOpacity 
              style={styles.quantityButton} 
              onPress={(e) => { 
                e.stopPropagation(); // IMPORTANT
                handleIncreaseQuantity(item.id); 
              }}
            >
              <Icon name="add" size={20} color="#34C759" />
            </TouchableOpacity>
          </View>
        )}
      </TouchableOpacity>
    );
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
        <TouchableOpacity style={styles.headerButton} onPress={() => console.log('Search icon in header pressed')}>
          
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

      <View style={styles.mainContainer}>
        <View style={styles.sidebar}>
          <Text style={styles.sidebarTitle}>Brands</Text>
          <FlatList
            data={brands}
            renderItem={renderBrandItem}
            keyExtractor={(item) => item.id.toString()}
            showsVerticalScrollIndicator={false}
          />
          <Text style={[styles.sidebarTitle, { marginTop: 20 }]}>Categories</Text>
          <FlatList
            data={categories}
            renderItem={renderCategoryItem}
            keyExtractor={(item) => item.id.toString()}
            showsVerticalScrollIndicator={false}
          />
        </View>

        <View style={styles.productsContainer}>
          {displayedProducts.length > 0 ? (
            <FlatList
              data={displayedProducts}
              renderItem={renderProductItem}
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

      <View style={styles.footer}>
        <TouchableOpacity 
          style={styles.viewCartButton}
          onPress={() => {
            const totalItems = Object.values(cart).reduce((sum, q) => sum + q, 0);
            if (totalItems === 0) {
              Alert.alert('Empty Cart', 'Please add items to your cart before proceeding.');
              return;
            }
            setCartModalVisible(true);
          }}
        >
          <Text style={styles.viewCartButtonText}>
            {Object.values(cart).reduce((sum, q) => sum + q, 0)} Items | View Cart
          </Text>
        </TouchableOpacity>
      </View>

      {/* Cart Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={cartModalVisible}
        onRequestClose={() => setCartModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.cartModalContent}>
            <View style={styles.cartModalHeader}>
              <Text style={styles.cartModalTitle}>Your Cart</Text>
              <TouchableOpacity 
                onPress={() => setCartModalVisible(false)}
                style={styles.closeButton}
              >
                <Icon name="close" size={24} color="#000" />
              </TouchableOpacity>
            </View>

            <FlatList
              data={Object.entries(cart).map(([productId, quantity]) => ({
                productId,
                quantity
              }))}
              renderItem={renderCartItem}
              keyExtractor={(item) => item.productId}
              contentContainerStyle={styles.cartItemsList}
            />

            <View style={styles.cartSummary}>
              <View style={styles.cartTotalRow}>
                <Text style={styles.cartTotalLabel}>Total Amount:</Text>
                <Text style={styles.cartTotalAmount}>₹{calculateTotalAmount()}</Text>
              </View>
              <View style={styles.cartTotalRow}>
                <Text style={styles.cartTotalLabel}>Order Type:</Text>
                <Text style={styles.cartTotalAmount}>{getOrderType()}</Text>
              </View>
              <TouchableOpacity 
                style={styles.checkoutButton}
                onPress={placeOrder}
              >
                <Text style={styles.checkoutButtonText}>Proceed to Checkout</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

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
  mainContainer: {
    flex: 1,
    flexDirection: 'row',
  },
  sidebar: {
    width: 100, // Adjust as needed
    backgroundColor: '#F5F5F5',
    paddingTop: 10,
  },
  sidebarTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#003366',
    paddingHorizontal: 10,
    marginBottom: 10,
  },
  categoryItem: {
    paddingVertical: 15,
    paddingHorizontal: 10,
    alignItems: 'center',
    marginBottom: 5,
  },
  selectedCategoryItem: {
    backgroundColor: '#003366', // Example selection color
    borderRadius: 8,
  },
  categoryText: {
    fontSize: 12,
    color: '#003366',
    marginTop: 4,
    textAlign: 'center',
  },
  selectedCategoryText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  productsContainer: {
    flex: 1,
    paddingHorizontal: 5,
  },
  productListContent: {
    paddingVertical: 10,
  },
  productCard: {
    flex: 0.5, // For 2 columns
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    margin: 5,
    padding: 10,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    alignItems: 'center', // Center content like image
  },
  productImage: {
    width: '100%',
    height: 120, // Adjust as needed
    marginBottom: 8,
    borderRadius: 4,
  },
  productInfo: {
    alignItems: 'flex-start',
    width: '100%',
  },
  priceContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 2,
  },
  currentPrice: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#000000',
  },
  originalPrice: {
    fontSize: 12,
    color: '#757575',
    textDecorationLine: 'line-through',
    marginLeft: 5,
  },
  productWeight: {
    fontSize: 12,
    color: '#757575',
    marginBottom: 2,
  },

  productName: {
    fontSize: 14,
    color: '#333333',
    marginBottom: 4,
    minHeight: 35, // To ensure consistent card height for 2 lines
  },
  productRating: {
    fontSize: 12,
    color: '#757575',
    // marginBottom: 8, // Removed to allow ADD button to be closer if no rating exists
  },
  addButton: {
    borderColor: '#FF3B30', // Zepto-like pink/red
    borderWidth: 1,
    borderRadius: 6,
    paddingVertical: 8,
    paddingHorizontal: 20,
    width: '80%',
    alignItems: 'center',
  },
  addButtonText: {
    color: '#FF3B30',
    fontWeight: 'bold',
    fontSize: 14,
  },
  quantityControlContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    borderColor: '#FF3B30',
    borderWidth: 1,
    borderRadius: 6,
    width: '80%',
    paddingVertical: 4, // Reduced padding for controls
  },
  quantityButton: {
    paddingHorizontal: 10, // Ample touch area
  },
  quantityText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FF3B30',
    minWidth: 20, // Ensure number doesn't jump around too much
    textAlign: 'center',
  },
  emptyProductsContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
  },
  footer: {
    padding: 15,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
    backgroundColor: '#FFFFFF',
  },
  viewCartButton: {
    backgroundColor: '#003366',
    paddingVertical: 15,
    borderRadius: 8,
    alignItems: 'center',
  },
  viewCartButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  cartModalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '80%',
  },
  cartModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  cartModalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#003366',
  },
  closeButton: {
    padding: 5,
  },
  cartItemsList: {
    paddingBottom: 20,
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
  },
  cartSummary: {
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
    paddingTop: 20,
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
    color: '#003366',
  },
  checkoutButton: {
    backgroundColor: '#FF3B30',
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
  // Search Bar Styles
  searchBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0F0F0',
    borderRadius: 8,
    marginHorizontal: 15,
    marginVertical: 10,
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
  // Modal Styles
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
});

export default Catalogue;
