import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  SafeAreaView,
  StatusBar,
  Alert,
  Modal,
  TextInput,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useNavigation, useFocusEffect, useRoute } from '@react-navigation/native';
import DateTimePickerModal from 'react-native-modal-datetime-picker';
import moment from 'moment';
import Toast from 'react-native-toast-message';
import SearchProductModal_1 from './searchProductModal_1.jsx';
import { useFontScale } from '../../App';
import { ipAddress } from '../../services/urls';

// Import helpers
import { COLORS } from './cartutils/constants';
import { formatCurrency, getOrderType, generateInitialDueDate, calculateMaxDate } from './cartutils/utils';
import { CartManager } from './cartutils/cartHelpers';
import { AdminCartAPI, ProductFilter } from './cartutils/apiHelpers';
import { adminCartStyles as styles } from './cartutils/styles';

const AdminCartPage = () => {
  const { getScaledSize } = useFontScale();
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

  // New state for due date picker
  const [showDueDateModal, setShowDueDateModal] = useState(false);
  const [selectedDueDate, setSelectedDueDate] = useState(() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow;
  });
  const [isDatePickerVisible, setIsDatePickerVisible] = useState(false);

  // New state for API-based due date configuration
  const [defaultDueOn, setDefaultDueOn] = useState(1);
  const [maxDueOn, setMaxDueOn] = useState(30);

  // Load cart from storage on mount
  useEffect(() => {
    const initializeCart = async () => {
      const { cartItems: savedCartItems, customer: savedCustomer } = await CartManager.loadCartFromStorage();
      setCartItems(savedCartItems);
      if (savedCustomer && !selectedCustomer) {
        setSelectedCustomer(savedCustomer);
      }
    };
    
    initializeCart();
    fetchUserPermissions();
    fetchClientStatus();
  }, []);

  // Monitor state changes for debugging
  useEffect(() => {
    console.log('State changed - defaultDueOn:', defaultDueOn, 'maxDueOn:', maxDueOn);
  }, [defaultDueOn, maxDueOn]);

  // Save cart to storage whenever it changes
  useEffect(() => {
    CartManager.saveCartToStorage(cartItems);
  }, [cartItems]);

  useEffect(() => {
    if (route.params?.customer) {
      setSelectedCustomer(route.params.customer);
    }
    if (route.params?.products) {
      // Add all products from the order to cart
      route.params.products.forEach(product => {
        setCartItems(prevItems => CartManager.addToCart(prevItems, {
          product_id: product.product_id,
          id: product.product_id,
          name: product.name,
          price: product.price,
          quantity: product.quantity,
          image: product.image || null,
          category: product.category || '',
          gst_rate: product.gst_rate || 0
        }));
      });
    }
  }, [route.params]);

  const fetchUserPermissions = async () => {
    const { allowProductEdit } = await AdminCartAPI.fetchUserPermissions(navigation);
    setAllowProductEdit(allowProductEdit);
  };

  const fetchClientStatus = useCallback(async () => {
    const { defaultDueOn: newDefaultDueOn, maxDueOn: newMaxDueOn } = await AdminCartAPI.fetchClientStatus();
    setDefaultDueOn(newDefaultDueOn);
    setMaxDueOn(newMaxDueOn);
    
    // Update selected due date based on default_due_on
    const newDefaultDate = generateInitialDueDate(newDefaultDueOn);
    setSelectedDueDate(newDefaultDate);
  }, []);

  const addToCart = (product) => {
    setCartItems(prevItems => CartManager.addToCart(prevItems, product));
  };

  const removeFromCart = (productId) => {
    setCartItems(prevItems => CartManager.removeFromCart(prevItems, productId));
  };

  const updateQuantity = (productId, quantity) => {
    setCartItems(prevItems => CartManager.updateQuantity(prevItems, productId, quantity));
  };

  const clearCart = () => {
    setCartItems(CartManager.clearCart());
    setSelectedCustomer(null);
  };

  const getCartTotal = () => {
    return CartManager.getCartTotal(cartItems);
  };

  const saveEditCartItem = () => {
    if (!editCartProduct) return;
    
    const newPrice = parseFloat(editCartPrice);
    const newQty = parseInt(editCartQty);
    
    // Validate using helper
    const errors = CartManager.validateEditCartItem(
      editCartProduct, 
      newPrice, 
      newQty, 
      allowProductEdit, 
      products
    );
    
    if (errors.length > 0) {
      setEditCartError(errors[0]);
      return;
    }
    
    // If price editing is disabled, keep the original price
    const finalPrice = allowProductEdit ? newPrice : editCartProduct.price;
    
    setCartItems(prevItems => CartManager.updateCartItem(prevItems, editCartProduct.product_id, finalPrice, newQty));
    
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
      const { products: loadedProducts, brands: loadedBrands, categories: loadedCategories } = await AdminCartAPI.loadProducts(navigation);
      setProducts(loadedProducts);
      setFilteredProducts(loadedProducts);
      setBrands(loadedBrands);
      setCategories(loadedCategories);
    } catch (error) {
      console.error('Error loading products:', error);
      Alert.alert('Error', 'Failed to load products');
    } finally {
      setLoading(false);
    }
  };

  const showDatePicker = () => {
    setIsDatePickerVisible(true);
  };

  const hideDatePicker = () => {
    setIsDatePickerVisible(false);
  };

  const handleConfirmDate = (date) => {
    hideDatePicker();
    setSelectedDueDate(date);
  };

  const handlePlaceOrderClick = () => {
    // Reset due date based on API default_due_on value
    const newDefaultDate = generateInitialDueDate(defaultDueOn);
    setSelectedDueDate(newDefaultDate);
    setShowDueDateModal(true);
  };

  const handleConfirmDueDate = () => {
    setShowDueDateModal(false);
    placeOrder();
  };

  const placeOrder = async () => {
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
      await AdminCartAPI.placeOrder(cartItems, selectedCustomer, selectedDueDate, navigation);
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
    const filtered = ProductFilter.filterProducts(products, text, brand, category);
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
            <Text style={[styles.cartItemName, { fontSize: getScaledSize(16) }]} numberOfLines={2}>{item.name}</Text>
            <Text style={[styles.cartItemPrice, { fontSize: getScaledSize(14) }]}>{formatCurrency(item.price || 0)} x {item.quantity || 1} = {formatCurrency(itemTotal)}</Text>
            {item.size && <Text style={[styles.cartItemVolume, { fontSize: getScaledSize(12) }]}>{item.size}</Text>}
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
              <Text style={[styles.editButtonText, { fontSize: getScaledSize(12) }]}>Edit</Text>
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
              <Text style={[styles.quantityText, { fontSize: getScaledSize(14) }]}>{item.quantity || 1}</Text>
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
    
    // Check if product is inactive
    const isInactive = item.enable_product === "Inactive";

    return (
      <TouchableOpacity
        style={[
          styles.productCard, 
          isInCart && styles.productCardInCart,
          isInactive && styles.inactiveProductCard
        ]}
        onPress={() => {
          // Don't allow adding inactive products to cart
          if (isInactive) return;
          addToCart({ ...item, product_id: item.id, quantity: 1 });
        }}
        activeOpacity={0.7}
        disabled={isInactive}
      >
        <View style={styles.productImageContainer}>
          {imageUri ? (
            <Image
              source={{ uri: imageUri }}
              style={[
                styles.productImage,
                isInactive && styles.inactiveProductImage
              ]}
              resizeMode="contain"
            />
          ) : (
            <View style={styles.noImageContainer}>
              <Icon name="image-not-supported" size={32} color="#CCC" />
            </View>
          )}
        </View>
        
        <View style={styles.productDetails}>
          <Text style={[
            styles.productName,
            isInactive && styles.inactiveProductText
          ]} numberOfLines={2}>{item.name}</Text>
          <Text style={[
            styles.productPrice,
            isInactive && styles.inactiveProductText
          ]}>₹{item.price}</Text>
          {item.size && (
            <Text style={[
              styles.productVolume,
              isInactive && styles.inactiveProductText
            ]}>{item.size}</Text>
          )}
          {isInactive ? (
            <View style={styles.inactiveIndicator}>
              <Icon name="block" size={16} color="#999999" />
              <Text style={[styles.inactiveText, { fontSize: getScaledSize(10) }]}>UNAVAILABLE</Text>
            </View>
          ) : isInCart && (
            <View style={styles.inCartIndicator}>
              <Icon name="check-circle" size={16} color={COLORS.success} />
              <Text style={[styles.inCartText, { fontSize: getScaledSize(10) }]}>In Cart</Text>
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
          <Text style={[styles.loadingText, { fontSize: getScaledSize(16) }]}>Loading products...</Text>
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
        <Text style={[styles.headerTitle, { fontSize: getScaledSize(18) }]}>Admin Cart</Text>
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
          <Text style={[styles.customerLabel, { fontSize: getScaledSize(14) }]}>Order for:</Text>
          <Text style={[styles.customerName, { fontSize: getScaledSize(16) }]}>{selectedCustomer.username || selectedCustomer.name}</Text>
          <Text style={[styles.customerId, { fontSize: getScaledSize(12) }]}>ID: {selectedCustomer.cust_id}</Text>
        </View>
      )}

      {/* Cart Items */}
      {cartItems.length > 0 ? (
        <View style={styles.cartSection}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { fontSize: getScaledSize(16) }]}>Cart Items ({cartItems.length})</Text>
            {/* Grand total styled like CartCustomer */}
            <View style={styles.totalContainer}>
              <Text style={[styles.totalLabel, { fontSize: getScaledSize(14) }]}>Total Amount:</Text>
              <Text style={[styles.totalAmount, { fontSize: getScaledSize(18) }]}>{formatCurrency(getCartTotal())}</Text>
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
            onPress={handlePlaceOrderClick}
            disabled={isPlacingOrder}
          >
            {isPlacingOrder ? (
              <ActivityIndicator size="small" color="#FFF" />
            ) : (
              <>
                <Icon name="shopping-cart-checkout" size={20} color="#FFF" />
                <Text style={[styles.placeOrderText, { fontSize: getScaledSize(16) }]}>Place Order</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.emptyCartContainer}>
          <Icon name="shopping-cart-outlined" size={64} color={COLORS.text.tertiary} />
          <Text style={[styles.emptyCartTitle, { fontSize: getScaledSize(20) }]}>Your cart is empty</Text>
          <Text style={[styles.emptyCartSubtitle, { fontSize: getScaledSize(14) }]}>Add products to get started</Text>
          
          <TouchableOpacity
            style={styles.addProductsButton}
            onPress={() => setShowSearchModal(true)}
          >
            <Icon name="add" size={20} color="#FFF" />
            <Text style={[styles.addProductsText, { fontSize: getScaledSize(14) }]}>Add Products</Text>
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
          // Use the quantity provided by the modal, fallback to 1 if not present
          addToCart({ ...product, product_id: product.id, quantity: product.quantity ?? 1 });
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
              <Text style={[styles.editModalTitle, { fontSize: getScaledSize(18) }]}>Edit Item</Text>
              <TouchableOpacity
                style={styles.modalCloseButton}
                onPress={() => setEditCartModalVisible(false)}
              >
                <Icon name="close" size={20} color={COLORS.text.primary} />
              </TouchableOpacity>
            </View>
            
            {editCartProduct && (
              <View style={styles.editModalContent}>
                <Text style={[styles.editItemName, { fontSize: getScaledSize(16) }]}>{editCartProduct.name}</Text>
                
                <View style={styles.editInputRow}>
                  <View style={styles.editInputContainer}>
                    <Text style={[styles.editInputLabel, { fontSize: getScaledSize(12) }]}>Price (₹)</Text>
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
                        <Text style={[styles.priceRangeText, { fontSize: getScaledSize(11) }]}>
                          Range: ₹{minPrice} - ₹{maxPrice}
                        </Text>
                      );
                    })()}
                    {!allowProductEdit && (
                      <Text style={[styles.disabledPriceText, { fontSize: getScaledSize(11) }]}>
                        Price editing disabled
                      </Text>
                    )}
                  </View>
                  
                  <View style={styles.editInputContainer}>
                    <Text style={[styles.editInputLabel, { fontSize: getScaledSize(12) }]}>Quantity</Text>
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
                  <Text style={[styles.errorText, { fontSize: getScaledSize(14) }]}>{editCartError}</Text>
                )}
                
                <View style={styles.editModalButtons}>
                  <TouchableOpacity
                    style={styles.editCancelButton}
                    onPress={() => setEditCartModalVisible(false)}
                  >
                    <Text style={[styles.editCancelText, { fontSize: getScaledSize(14) }]}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.editSaveButton}
                    onPress={saveEditCartItem}
                  >
                    <Text style={[styles.editSaveText, { fontSize: getScaledSize(14) }]}>Save</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        </View>
      </Modal>

      {/* Due Date Modal */}
      <Modal
        visible={showDueDateModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowDueDateModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.dueDateModal}>
            <View style={styles.dueDateModalHeader}>
              <Text style={[styles.dueDateModalTitle, { fontSize: getScaledSize(18) }]}>Select Due Date</Text>
              <TouchableOpacity
                onPress={() => setShowDueDateModal(false)}
                style={styles.closeDueDateButton}
              >
                <Icon name="close" size={24} color={COLORS.text.primary} />
              </TouchableOpacity>
            </View>
            
            <View style={styles.dueDateContent}>
              <Text style={[styles.dueDateLabel, { fontSize: getScaledSize(14) }]}>
                When should this order be delivered to {selectedCustomer?.username || selectedCustomer?.name}?
              </Text>
              
              <TouchableOpacity
                style={styles.datePickerButton}
                onPress={showDatePicker}
              >
                <Icon name="calendar-today" size={20} color={COLORS.primary} />
                <Text style={[styles.datePickerButtonText, { fontSize: getScaledSize(16) }]}>
                  {moment(selectedDueDate).format('DD MMM, YYYY')}
                </Text>
                <Icon name="keyboard-arrow-down" size={20} color={COLORS.primary} />
              </TouchableOpacity>
              
              <Text style={[styles.dueDateNote, { fontSize: getScaledSize(12) }]}>
                Note: This date will be used by our delivery team to schedule the order delivery.
              </Text>
            </View>
            
            <View style={styles.dueDateModalFooter}>
              <TouchableOpacity
                style={styles.cancelDueDateButton}
                onPress={() => setShowDueDateModal(false)}
              >
                <Text style={[styles.cancelDueDateButtonText, { fontSize: getScaledSize(14) }]}>Cancel</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={styles.confirmDueDateButton}
                onPress={handleConfirmDueDate}
              >
                <Text style={[styles.confirmDueDateButtonText, { fontSize: getScaledSize(14) }]}>Confirm & Place Order</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Date Picker Modal */}
      <DateTimePickerModal
        isVisible={isDatePickerVisible}
        mode="date"
        onConfirm={handleConfirmDate}
        onCancel={hideDatePicker}
        date={selectedDueDate}
        minimumDate={new Date()} // Can't select past dates
        maximumDate={(() => {
          // Calculate maximum selectable date based on max_due_on
          console.log('Calculating maximumDate, maxDueOn =', maxDueOn);
          if (maxDueOn === 0) {
            console.log('maxDueOn is 0, returning today only');
            return new Date(); // Only today if max_due_on is 0
          }
          const maxDate = new Date();
          // If max_due_on is 2, we want: today + tomorrow = 2 days total
          // So we add (maxDueOn - 1) to get exactly maxDueOn days including today
          maxDate.setDate(maxDate.getDate() + (maxDueOn - 1));
          console.log('maxDueOn is', maxDueOn, ', setting max date to:', maxDate, '(allowing exactly', maxDueOn, 'days including today)');
          return maxDate;
        })()}
      />
    </SafeAreaView>
  );
};

export default AdminCartPage; 