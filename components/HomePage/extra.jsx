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
  Keyboard,
  Dimensions
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useNavigation } from '@react-navigation/native';
import { ipAddress } from '../../services/urls';
import AsyncStorage from '@react-native-async-storage/async-storage';


const formatCurrency = (amount) => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  }).format(amount);
}

const Catalogue = () => {
  const navigation = useNavigation();
  const [products, setProducts] = useState([]);
  const [displayedProducts, setDisplayedProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [brands, setBrands] = useState([]);
  const [selectedBrandId, setSelectedBrandId] = useState('All');
  const [selectedCategoryId, setSelectedCategoryId] = useState('All');
  const [loading, setLoading] = useState(true);
  const [cart, setCart] = useState({});
  const [cartItems, setCartItems] = useState({});
  const [enlargedProduct, setEnlargedProduct] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [isSearchModalVisible, setIsSearchModalVisible] = useState(false);

  const fetchBrands = async () => {
    try {
      const response = await fetch(`http://${ipAddress}:8091/brand-crud`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ operation: 'read' }),
      });
      const data = await response.json();
      if (response.ok && data.success) {
        const fetchedBrands = [{ id: 'All', name: 'All', image: '' }, ...data.data];
        setBrands(fetchedBrands);
        if (!selectedBrandId || !fetchedBrands.find(b => b.id === selectedBrandId)) {
          setSelectedBrandId('All');
        }
      } else {
        Alert.alert('Error', data.message || 'Failed to fetch brands');
        setBrands([]);
      }
    } catch (error) {
      console.error('Error fetching brands:', error);
      Alert.alert('Error', 'An error occurred while fetching brands');
      setBrands([]);
    }
  };

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const response = await fetch(`http://${ipAddress}:8091/products`);
      const data = await response.json();
      if (response.ok) {
        setProducts(data);
        const uniqueCategoryNames = [...new Set(data.map(product => product.category).filter(Boolean))];
        const fetchedCategories = [
          { id: 'All', name: 'All' },
          ...uniqueCategoryNames.map(name => ({ id: name, name: name }))
        ];
        setCategories(fetchedCategories);

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

  useEffect(() => {
    const loadAndFetchData = async () => {
      setLoading(true);
      try {
        const savedCart = await AsyncStorage.getItem('catalogueCart');
        if (savedCart !== null) {
          setCart(JSON.parse(savedCart));
        }
        const savedCartItems = await AsyncStorage.getItem('cartItems');
        if (savedCartItems !== null) {
          setCartItems(JSON.parse(savedCartItems));
        }
        await Promise.all([fetchBrands(), fetchProducts()]);
      } catch (error) {
        console.error('Initial data fetch error:', error);
      } finally {
        setLoading(false);
      }
    };
    loadAndFetchData();
  }, []);

  useEffect(() => {
    const saveCart = async () => {
      try {
        await AsyncStorage.setItem('catalogueCart', JSON.stringify(cart));
      } catch (error) {
        console.error('Failed to save cart to AsyncStorage:', error);
      }
    };
    saveCart();
  }, [cart]);

  useEffect(() => {
    const saveCartItems = async () => {
      try {
        await AsyncStorage.setItem('cartItems', JSON.stringify(cartItems));
      } catch (error) {
        console.error('Failed to save cart items to AsyncStorage:', error);
      }
    };
    saveCartItems();
  }, [cartItems]);

  useEffect(() => {
    let filtered = products;
    if (selectedCategoryId !== 'All') {
      filtered = filtered.filter(p => p.category === selectedCategoryId);
    }
    if (selectedBrandId !== 'All') {
      filtered = filtered.filter(p => p.brand === brands.find(b => b.id === selectedBrandId)?.name);
    }
    if (searchTerm) {
      filtered = filtered.filter(p =>
        p.name.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    setDisplayedProducts(filtered);
  }, [selectedCategoryId, selectedBrandId, products, searchTerm, brands]);

  const handleSelectCategory = (categoryId) => {
    setSelectedCategoryId(categoryId);
    setSelectedBrandId('All');
  };

  const handleSelectBrand = (brandId) => {
    setSelectedBrandId(brandId);
    Keyboard.dismiss();
  };

  const handleAddItem = async (item) => {
    const updatedCart = { ...cart };
    updatedCart[item.id] = (updatedCart[item.id] || 0) + 1;
    setCart(updatedCart);
    await AsyncStorage.setItem('catalogueCart', JSON.stringify(updatedCart));
    // Update cart items with discount price
    const updatedCartItems = { ...cartItems, [item.id]: { ...item, price: item.discountPrice || item.price } };
    setCartItems(updatedCartItems);
    await AsyncStorage.setItem('cartItems', JSON.stringify(updatedCartItems));
    console.log(`Added ${item.name} to cart`);
  };

  const handleQuantityChange = (productId, newQuantity) => {
    if (newQuantity === '') {
      setCart(prevCart => ({
        ...prevCart,
        [productId]: 0
      }));
      return;
    }
    const quantity = parseInt(newQuantity);
    if (isNaN(quantity) || quantity < 1) {
      return;
    }
    setCart(prevCart => ({
      ...prevCart,
      [productId]: quantity
    }));
  };

  const handleQuantityBlur = (productId, value) => {
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
      if (currentQuantity <= 1) {
        const newCart = { ...prevCart };
        delete newCart[productId];
        return newCart;
      }
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
      const product = cartItems[productId];
      return sum + (product ? product.price * quantity : 0);
    }, 0);
  };

  const placeOrder = async () => {
    try {
      const token = await checkTokenAndRedirect(navigation);
      if (!token) {
        Alert.alert('Error', 'Please login to place an order');
        return;
      }

      const orderItems = Object.entries(cart).map(([productId, quantity]) => {
        const product = cartItems[productId];
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
                setCartItems({});
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


  const renderBrandItem = ({ item }) => {
    const isAllBrand = item.id === 'All';
    const imageSource = !isAllBrand && item.image
      ? { uri: `http://${ipAddress}:8091/images/brands/${item.image}` }
      : null;

    return (
      <TouchableOpacity
        style={[
          styles.sidebarOption,
          selectedBrandId === item.id && styles.sidebarOptionActive,
        ]}
        onPress={() => handleSelectBrand(item.id)}
      >
        {imageSource ? (
          <Image
            source={imageSource}
            style={styles.sidebarOptionImage}
            resizeMode="contain"
          />
        ) : (
          <View style={styles.sidebarImagePlaceholder}>
            <Icon name={isAllBrand ? 'apps' : 'image-not-supported'} size={30} color="#003366" />
          </View>
        )}
        <Text style={[styles.sidebarOptionText, selectedBrandId === item.id && styles.sidebarOptionTextActive]} numberOfLines={2}>
          {item.name}
        </Text>
      </TouchableOpacity>
    );
  };

  const renderCategoryItem = ({ item }) => (
    <TouchableOpacity
      style={[
        styles.categoryItem,
        selectedCategoryId === item.id && styles.selectedCategoryItem,
      ]}
      onPress={() => handleSelectCategory(item.id)}
    >
      <Text style={[
        styles.categoryText,
        selectedCategoryId === item.id && styles.selectedCategoryText
      ]}>{item.name}</Text>
    </TouchableOpacity>
  );

  const renderProduct = ({ item }) => {
    const quantityInCart = cart[item.id] || 0;
    const imageUri = `http://${ipAddress}:8091/images/products/${item.image}`;

    return (
      <View style={styles.productCardContainer}>
        <View style={styles.productCardContent}>
          <TouchableOpacity
            style={styles.productImageWrapper}
            onPress={() => setEnlargedProduct(item)}
          >
            <Image
              source={{ uri: imageUri }}
              style={styles.productImageLarge}
              resizeMode="contain"
              onError={(e) => console.warn('Product image load error:', item.image, e.nativeEvent.error)}
            />
          </TouchableOpacity>
          <View style={styles.productDetailsRight}>
            {item.offers ? <Text style={styles.productOfferText}>{item.offers}</Text> : null}
            <Text style={styles.productNameLarge} numberOfLines={2}>{item.name}</Text>
            {item.size ? <Text style={styles.productVolume}>{item.size}</Text> : null}
            
            <View style={styles.priceContainer}>
              {item.price && (
                <Text style={styles.originalPrice}>{formatCurrency(item.price)}</Text>
              )}
              {item.discountPrice && (
                <Text style={styles.currentPrice}>{formatCurrency(item.discountPrice)}</Text>
              )}
            </View>

            {quantityInCart === 0 ? (
              <TouchableOpacity
                style={styles.addButton}
                onPress={() => handleAddItem(item)}
              >
                <Text style={styles.addButtonText}>ADD</Text>
              </TouchableOpacity>
            ) : (
              <View style={styles.quantityControlsContainer}>
                <TouchableOpacity
                  style={styles.quantityButton}
                  onPress={() => handleDecreaseQuantity(item.id)}
                >
                  <Icon name="remove" size={20} color="#FFF" />
                </TouchableOpacity>
                <Text style={styles.quantityDisplay}>{quantityInCart}</Text>
                <TouchableOpacity
                  style={styles.quantityButton}
                  onPress={() => handleIncreaseQuantity(item.id)}
                >
                  <Icon name="add" size={20} color="#FFF" />
                </TouchableOpacity>
              </View>
            )}
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

  const today = new Date();
  const deliveryDate = new Date(today);
  deliveryDate.setDate(today.getDate() + 1);
  const formattedDeliveryDate = deliveryDate.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'long' });

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      
      <View style={styles.topHeader}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBackBtn}>
          <Icon name="arrow-back" size={24} color="#000" />
        </TouchableOpacity>
      </View>

      <View style={styles.mainContainer}>
        <View style={styles.sidebar}>
          <View style={styles.sidebarHeader}>
            <Text style={styles.sidebarHeaderText}>Brands</Text>
          </View>
          <FlatList
            data={brands}
            renderItem={renderBrandItem}
            keyExtractor={item => item.id.toString()}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.sidebarListContent}
          />
          <View style={[styles.sidebarHeader, { marginTop: 20 }]}>
            <Text style={styles.sidebarHeaderText}>Categories</Text>
          </View>
          <FlatList
            data={categories} 
            renderItem={renderCategoryItem}
            keyExtractor={item => item.id.toString()}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.sidebarListContent}
          />
        </View>

        <View style={styles.mainContent}>
          {displayedProducts.length > 0 ? (
            <FlatList
              data={displayedProducts}
              renderItem={renderProduct}
              keyExtractor={(item) => item.id.toString()}
              numColumns={1}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.productListContent}
            />
          ) : (
             !loading && <View style={styles.emptyProductsContainer}><Text style={styles.emptyProductsText}>No products found.</Text></View>
          )}
          {loading && products.length > 0 && <ActivityIndicator style={{marginTop: 20}} size="small" color="#003366" />}
        </View>
      </View>

      <TouchableOpacity
        style={styles.floatingSearchButton}
        onPress={() => setIsSearchModalVisible(true)}
      >
        <Icon name="search" size={24} color="#FFFFFF" />
        <Text style={styles.floatingSearchButtonText}>Search</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.floatingCartButton}
        onPress={handleCartIconPress}
      >
        <Icon name="shopping-cart" size={24} color="#FFFFFF" />
        {Object.keys(cart).length > 0 && (
          <View style={styles.cartBadge}>
            <Text style={styles.cartBadgeText}>{Object.values(cart).reduce((sum, q) => sum + q, 0)}</Text>
          </View>
        )}
      </TouchableOpacity>

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
                <Text style={styles.modalProductPrice}>{formatCurrency(enlargedProduct.price)}</Text>
                {enlargedProduct.offer > 0 && (
                  <Text style={styles.modalProductOffer}>{enlargedProduct.offer}% OFF</Text>
                )}
            </View>
          </View>
        </Modal>
      )}

      <Modal
        animationType="slide"
        transparent={false}
        visible={isSearchModalVisible}
        onRequestClose={() => setIsSearchModalVisible(false)}
      >
        <SafeAreaView style={styles.searchModalSafeArea}>
          <View style={styles.searchModalHeader}>
            <TouchableOpacity onPress={() => setIsSearchModalVisible(false)} style={styles.searchModalCloseButton}>
              <Icon name="arrow-back" size={24} color="#000" />
            </TouchableOpacity>
            <TextInput
              style={styles.searchModalInput}
              placeholder="Search products..."
              value={searchTerm}
              onChangeText={setSearchTerm}
              placeholderTextColor="#888"
              autoFocus={true}
              returnKeyType="search"
              onSubmitEditing={() => {
                Keyboard.dismiss();
                setIsSearchModalVisible(false);
              }}
            />
            {searchTerm.length > 0 && (
              <TouchableOpacity onPress={() => setSearchTerm('')} style={styles.searchModalClearButton}>
                <Icon name="close" size={20} color="#888" />
              </TouchableOpacity>
            )}
          </View>
          <FlatList
            data={displayedProducts}
            renderItem={renderProduct}
            keyExtractor={(item) => item.id.toString()}
            numColumns={1}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.productListContent}
            ListEmptyComponent={!loading && searchTerm.length > 0 && <View style={styles.emptyProductsContainer}><Text style={styles.emptyProductsText}>No matching products found.</Text></View>}
          />
          {loading && products.length > 0 && searchTerm.length > 0 && <ActivityIndicator style={{marginTop: 20}} size="small" color="#003366" />}
        </SafeAreaView>
      </Modal>
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
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 15,
    paddingVertical: 10,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  headerBackBtn: {
    padding: 5,
    marginRight: 10,
  },
  mainContainer: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: '#F8F8F8',
  },
  sidebar: {
    width: 80,
    backgroundColor: '#F9FAFB',
    paddingVertical: 10,
    borderRightWidth: 1,
    borderRightColor: '#E5E7EB',
    alignItems: 'center',
  },
  sidebarListContent: {
    paddingBottom: 20,
  },
  sidebarHeader: {
    width: '100%',
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 5,
  },
  sidebarHeaderText: {
    fontWeight: 'bold',
    fontSize: 14,
    color: '#003366',
  },
  sidebarOption: {
    width: '90%',
    paddingVertical: 8,
    borderRadius: 8,
    marginBottom: 8,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sidebarOptionActive: {
    backgroundColor: '#E0F2F7',
    borderWidth: 1,
    borderColor: '#003366',
  },
  sidebarOptionImage: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginBottom: 5,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  sidebarImagePlaceholder: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginBottom: 5,
    backgroundColor: '#F0F0F0',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  sidebarOptionText: {
    fontSize: 11,
    color: '#003366',
    fontWeight: '500',
    textAlign: 'center',
  },
  sidebarOptionTextActive: {
    color: '#003366',
    fontWeight: 'bold',
  },
  mainContent: {
    flex: 1,
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  productListContent: {
    paddingBottom: 20,
  },
  productCardContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    marginVertical: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
    overflow: 'hidden',
    flex: 1,
    marginHorizontal: 8,
  },
  productCardContent: {
    flexDirection: 'row',
    padding: 12,
    alignItems: 'center',
  },
  productImageWrapper: {
    width: 120,
    height: 120,
    borderRadius: 8,
    marginRight: 12,
    backgroundColor: '#F8F8F8',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  productImageLarge: {
    width: '95%',
    height: '95%',
    resizeMode: 'contain',
  },
  productDetailsRight: {
    flex: 1,
    justifyContent: 'space-between',
    minHeight: 120, // Ensure consistent height to prevent shifting
  },
  offerTagText: {
    fontSize: 12,
    color: '#059669',
    fontWeight: 'bold',
    marginBottom: 4,
  },
  productOfferText: {
    color: '#059669',
    fontWeight: 'bold',
    fontSize: 13,
    marginBottom: 4,
  },
  productNameLarge: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 4,
  },
  productVolume: {
    fontSize: 13,
    color: '#666666',
    marginBottom: 8,
  },
  priceContainer: {
    flexDirection: 'column',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  originalPrice: {
    fontSize: 14,
    color: '#999999',
    textDecorationLine: 'line-through',
    marginBottom: 2,
  },
  currentPrice: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#003366',
  },
  addButton: {
    backgroundColor: '#003366',
    paddingVertical: 8,
    paddingHorizontal: 20,
    borderRadius: 5,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-end',
    minWidth: 100, // Increased width to match quantity controls
    height: 36, // Fixed height to match quantity controls
  },
  addButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: 'bold',
  },
  quantityControlsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-end',
    minWidth: 100, // Match add button width
    height: 36, // Fixed height to match add button
  },
  quantityButton: {
    backgroundColor: '#003366',
    padding: 6,
    borderRadius: 4,
    marginHorizontal: 4,
  },
  quantityDisplay: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333333',
    minWidth: 20,
    textAlign: 'center',
  },
  offerTag: {
    position: 'absolute',
    top: 0,
    left: 0,
    backgroundColor: '#10B981',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderTopLeftRadius: 12,
    borderBottomRightRadius: 12,
    zIndex: 1,
    paddingHorizontal: 15,
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottomOfferText: {
    color: '#059669',
    fontSize: 14,
    fontWeight: 'bold',
  },
  floatingSearchButton: {
    position: 'absolute',
    bottom: 20,
    alignSelf: 'center',
    flexDirection: 'row',
    backgroundColor: '#333333',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 8,
  },
  floatingSearchButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  floatingCartButton: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    backgroundColor: '#003366',
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 8,
    zIndex: 1000,
  },
  cartBadge: {
    position: 'absolute',
    top: -5,
    right: -5,
    backgroundColor: '#FF3B30',
    borderRadius: 10,
    width: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cartBadgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
  searchModalSafeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  searchModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  searchModalCloseButton: {
    padding: 5,
    marginRight: 10,
  },
  searchModalInput: {
    flex: 1,
    fontSize: 16,
    color: '#333',
    height: 40,
    backgroundColor: '#F0F0F0',
    borderRadius: 8,
    paddingHorizontal: 15,
  },
  searchModalClearButton: {
    padding: 5,
    marginLeft: 10,
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
    textAlign: 'center',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalCloseButton: {
    position: 'absolute',
    top: 50,
    right: 20,
    zIndex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 20,
    padding: 5,
  },
  enlargedImage: {
    width: '90%',
    height: '60%',
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
  },
  modalProductInfoContainer: {
    backgroundColor: 'rgba(0,0,0,0.5)',
    padding: 15,
    borderRadius: 10,
    marginTop: 10,
    alignItems: 'center',
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
  modalProductOffer: {
    fontSize: 16,
    color: '#34C759',
    textAlign: 'center',
  },
  categoryItem: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
    marginBottom: 10,
    marginLeft: 0,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    minWidth: 56,
  },
  selectedCategoryItem: {
    backgroundColor: '#003366',
    shadowColor: '#003366',
    shadowOpacity: 0.12,
    shadowRadius: 4,
    elevation: 2,
  },
  categoryText: {
    fontSize: 12,
    color: '#003366',
    fontWeight: '500',
  },
  selectedCategoryText: {
    color: '#FFF',
    fontWeight: 'bold',
  },
});

export default Catalogue;