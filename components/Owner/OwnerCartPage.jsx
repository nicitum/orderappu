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
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Picker } from '@react-native-picker/picker';
import DateTimePickerModal from 'react-native-modal-datetime-picker';
import moment from 'moment';

import Toast from 'react-native-toast-message';
import SearchProductModal_1 from './searchProductModal_1.jsx';
import { useFontScale } from '../../App';

// Import from cartutils
import { COLORS, formatCurrency, styles } from './cartutils';
import { 
  loadCartFromStorage,
  saveCartToStorage,
  fetchUserPermissions,
  fetchClientStatus,
  loadProducts,
  placeOrder
} from './cartutils/apiHelpers';
import { 
  addToCart,
  removeFromCart,
  updateQuantity,
  saveEditCartItem,
  clearCart,
  getCartTotal,
  getCartItemCount,
  addOrderToCart,
  getOrderType,
  filterProducts,
  clearCartHandler,
  deleteCartItem,
  applyFilters,
  handlePlaceOrderClick,
  handleConfirmDueDate
} from './cartutils/utils';

const OwnerCartPage = () => {
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
  const [selectedDueDate, setSelectedDueDate] = useState(new Date());
  const [isDatePickerVisible, setIsDatePickerVisible] = useState(false);

  // New state for API-based due date configuration
  const [defaultDueOn, setDefaultDueOn] = useState(1);
  const [maxDueOn, setMaxDueOn] = useState(30);

  // Load cart from storage on mount
  useEffect(() => {
    loadCartFromStorage(setCartItems, setSelectedCustomer, console);
    fetchUserPermissions(setAllowProductEdit, navigation, console);
  }, []);

  // Monitor state changes for debugging
  useEffect(() => {
    console.log('State changed - defaultDueOn:', defaultDueOn, 'maxDueOn:', maxDueOn);
  }, [defaultDueOn, maxDueOn]);

  // Save cart to storage whenever it changes
  useEffect(() => {
    saveCartToStorage(cartItems, console);
  }, [cartItems]);

  useEffect(() => {
    if (route.params?.customer) {
      console.log('=== OWNER CART DEBUG ===');
      console.log('Route params customer:', route.params.customer);
      
      const customerData = {
        customer_id: route.params.customer.customer_id || route.params.customer.cust_id,
        name: route.params.customer.name || route.params.customer.customer_name || route.params.customer.username || ''
      };
      
      console.log('Processed customer data:', customerData);
      
      // Ensure we have a valid customer_id
      if (!customerData.customer_id) {
        console.warn('No customer ID found in route params');
        return;
      }
      
      // If name is empty or same as customer_id, use a fallback
      if (!customerData.name || customerData.name === customerData.customer_id.toString()) {
        customerData.name = `Customer ${customerData.customer_id}`;
        console.log('Applied fallback name:', customerData.name);
      }
      
      console.log('Final customer data:', customerData);
      setSelectedCustomer(customerData);
      
      // Save to AsyncStorage as well
      AsyncStorage.setItem('ownerCartCustomer', JSON.stringify(customerData));
    }
  }, [route.params]);

  // Load products on mount and focus
  useFocusEffect(
    useCallback(() => {
      loadProducts(setProducts, setFilteredProducts, setBrands, setCategories, setLoading, navigation, Alert, console);
      fetchClientStatus(setDefaultDueOn, setMaxDueOn, setSelectedDueDate, console); // Fetch due date configuration
    }, [])
  );

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

  const handlePlaceOrderClickWrapper = () => {
    handlePlaceOrderClick(defaultDueOn, setSelectedDueDate, setShowDueDateModal);
  };

  const handleConfirmDueDateWrapper = () => {
    // Close modal and proceed with order placement
    handleConfirmDueDate(setShowDueDateModal, placeOrderWrapper);
  };

  const placeOrderWrapper = async () => {
    await placeOrder(
      cartItems,
      selectedCustomer,
      selectedDueDate,
      getOrderType,
      setIsPlacingOrder,
      () => clearCart(setCartItems, setSelectedCustomer),
      navigation,
      Toast,
      console
    );
  };

  const filterProductsWrapper = (text, brand, category) => {
    filterProducts(text, brand, category, products, setFilteredProducts);
  };

  const renderCartItem = ({ item }) => {
    // Try to get image from products data first, then from item itself
    const productData = products.find(p => p.id === item.product_id || p.id === item.id);
    const imageUri = (productData?.image || item.image) ? 
      `http://${ipAddress}:8091/images/products/${productData?.image || item.image}` : null;
    // Use discountPrice if available, else price
    const displayPrice = item.discountPrice ?? item.price ?? 0;

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
            <Text style={styles.cartItemTotalLineBold}>₹{item.price} x {item.quantity || 1} = ₹{(item.quantity || 1) * item.price}</Text>
            <Text style={styles.cartItemPrice}>GST {item.gst_rate || 0}%</Text>
            {item.size && <Text style={styles.cartItemVolume}>{item.size}</Text>}
            <TouchableOpacity 
              style={styles.editButton}
              onPress={() => {
                setEditCartProduct(item);
                setEditCartPrice((item.discountPrice ?? item.price ?? 0).toString());
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
                onPress={() => updateQuantity(item.product_id, (item.quantity || 1) - 1, setCartItems, removeFromCart)}
              >
                <Icon name="remove" size={20} color="#FFF" />
              </TouchableOpacity>
              <Text style={styles.quantityText}>{item.quantity || 1}</Text>
              <TouchableOpacity
                style={styles.quantityButton}
                onPress={() => updateQuantity(item.product_id, (item.quantity || 1) + 1, setCartItems, removeFromCart)}
              >
                <Icon name="add" size={20} color="#FFF" />
              </TouchableOpacity>
            </View>
            
            <TouchableOpacity
              style={styles.removeButton}
              onPress={() => deleteCartItem(item.product_id, removeFromCart, setCartItems, Toast)}
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
    const displayPrice = item.discountPrice ?? item.price ?? 0;
    
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
          addToCart({ ...item, product_id: item.id, quantity: 1 }, setCartItems);
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
          ]}>₹{displayPrice}</Text>
          <Text style={[
            styles.productPrice,
            isInactive && styles.inactiveProductText
          ]}>GST {item.gst_rate || 0}%</Text>
          {item.size && (
            <Text style={[
              styles.productVolume,
              isInactive && styles.inactiveProductText
            ]}>{item.size}</Text>
          )}
          {isInactive ? (
            <View style={styles.inactiveIndicator}>
              <Icon name="block" size={16} color="#999999" />
              <Text style={styles.inactiveText}>UNAVAILABLE</Text>
            </View>
          ) : isInCart && (
            <View style={styles.inCartIndicator}>
              <Icon name="check-circle" size={16} color={COLORS.success} />
              <Text style={styles.inCartText}>In Cart</Text>
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  const clearCartHandlerWrapper = () => {
    clearCartHandler(() => clearCart(setCartItems, setSelectedCustomer), setCartItems, setSelectedCustomer, Toast);
  };

  const applyFiltersWrapper = (brand, category) => {
    applyFilters(brand, category, searchTerm, setSelectedBrand, setSelectedCategory, filterProductsWrapper);
  };

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
        <Text style={[styles.headerTitle, { fontSize: getScaledSize(18) }]}>Owner Cart</Text>
        <TouchableOpacity
          style={styles.clearButton}
          onPress={clearCartHandlerWrapper}
        >
          <Icon name="clear-all" size={24} color={COLORS.error} />
        </TouchableOpacity>
      </View>

      {/* Customer Info */}
      {selectedCustomer && (
        <View style={styles.customerInfo}>
          <Text style={[styles.customerLabel, { fontSize: getScaledSize(14) }]}>Order for:</Text>
          <Text style={[styles.customerName, { fontSize: getScaledSize(16) }]}>
            {selectedCustomer.name && selectedCustomer.name !== selectedCustomer.customer_id 
              ? selectedCustomer.name 
              : `Customer ${selectedCustomer.customer_id}`
            }
          </Text>
          <Text style={[styles.customerId, { fontSize: getScaledSize(12) }]}>ID: {selectedCustomer.customer_id}</Text>
        
        </View>
      )}

      {/* Cart Items */}
      {cartItems.length > 0 ? (
        <View style={styles.cartSection}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { fontSize: getScaledSize(18) }]}>Cart Items ({cartItems.length})</Text>
            <Text style={[styles.totalAmount, { fontSize: getScaledSize(16) }]}>Total: {formatCurrency(getCartTotal(cartItems))}</Text>
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
            onPress={handlePlaceOrderClickWrapper}
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
          <Text style={[styles.emptyCartTitle, { fontSize: getScaledSize(20) }]}>Your cart is empty</Text>
          <Text style={[styles.emptyCartSubtitle, { fontSize: getScaledSize(14) }]}>Add products to get started</Text>
          
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
          // Add to cart, then open edit modal for this product
          const newProduct = { ...product, product_id: product.id, quantity: 1 };
          addToCart(newProduct, setCartItems);
          setShowSearchModal(false);
          setTimeout(() => {
            setEditCartProduct(newProduct);
            setEditCartPrice(newProduct.price?.toString() || '');
            setEditCartQty('1');
            setEditCartModalVisible(true);
          }, 100);
        }}
        currentCustomerId={selectedCustomer?.customer_id}
        closeOnAdd={true}
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
                      style={styles.editTextInput}
                      value={editCartPrice}
                      onChangeText={setEditCartPrice}
                      placeholder="Price"
                      keyboardType="numeric"
                      placeholderTextColor={COLORS.text.tertiary}
                    />
                    {editCartProduct && (() => {
                      const fullProductData = products.find(p => p.id === editCartProduct.product_id || p.id === editCartProduct.id);
                      const minPrice = fullProductData?.min_selling_price || editCartProduct.min_selling_price || 0;
                      const maxPrice = fullProductData?.discountPrice || editCartProduct.discountPrice || editCartProduct.price || 0;
                      return (
                        <Text style={styles.priceRangeText}>
                          Range: ₹{minPrice} - ₹{maxPrice}
                        </Text>
                      );
                    })()}
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
                    onPress={() => saveEditCartItem(
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
                    )}
                  >
                    <Text style={styles.editSaveText}>Save</Text>
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
              <Text style={styles.dueDateModalTitle}>Select Due Date</Text>
              <TouchableOpacity
                onPress={() => setShowDueDateModal(false)}
                style={styles.closeDueDateButton}
              >
                <Icon name="close" size={24} color={COLORS.text.primary} />
              </TouchableOpacity>
            </View>
            
            <View style={styles.dueDateContent}>
              <Text style={styles.dueDateLabel}>
                When should this order be delivered to {selectedCustomer?.username || selectedCustomer?.name}?
              </Text>
              
              <TouchableOpacity
                style={styles.datePickerButton}
                onPress={showDatePicker}
              >
                <Icon name="calendar-today" size={20} color={COLORS.primary} />
                <Text style={styles.datePickerButtonText}>
                  {moment(selectedDueDate).format('DD MMM, YYYY')}
                </Text>
                <Icon name="keyboard-arrow-down" size={20} color={COLORS.primary} />
              </TouchableOpacity>
              
              <Text style={styles.dueDateNote}>
                Note: This date will be used by our delivery team to schedule the order delivery.
              </Text>
            </View>
            
            <View style={styles.dueDateModalFooter}>
              <TouchableOpacity
                style={styles.cancelDueDateButton}
                onPress={() => setShowDueDateModal(false)}
              >
                <Text style={styles.cancelDueDateButtonText}>Cancel</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={styles.confirmDueDateButton}
                onPress={handleConfirmDueDateWrapper}
              >
                <Text style={styles.confirmDueDateButtonText}>Confirm & Place Order</Text>
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

export default OwnerCartPage;