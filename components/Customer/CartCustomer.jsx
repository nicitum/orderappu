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
import { Picker } from '@react-native-picker/picker';
import DateTimePickerModal from 'react-native-modal-datetime-picker';
import moment from 'moment';
import { useFontScale } from '../../App';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Import from services
import { ipAddress } from '../../services/urls';
import { checkTokenAndRedirect } from '../../services/auth';

// Import from cartutils
import { COLORS, formatCurrency, styles } from './cartutils';
import { 
  fetchClientStatus,
  loadCartAndProducts,
  upsertCartItemMeta,
  placeOrder,
  getOrderType,
  calculateTotalAmount
} from './cartutils/apiHelpers';
import { 
  handleIncreaseQuantity,
  handleDecreaseQuantity,
  handleQuantityChange,
  handleQuantityBlur,
  clearCart,
  deleteCartItem,
  applyFilters,
  handlePlaceOrderClick,
  handleConfirmDueDate
} from './cartutils/utils';

const CartCustomer = ({ hideHeader = false }) => {
  const { getScaledSize } = useFontScale();
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

  // Fetch client status for due date configuration
  useFocusEffect(
    useCallback(() => {
      loadCartAndProducts(setCart, setCartProducts, setProducts, setFilteredProducts, setBrands, setCategories, setLoading, navigation, Alert, console);
      fetchClientStatus(setDefaultDueOn, setMaxDueOn, console); // Fetch due date configuration
    }, [])
  );

  // Monitor state changes for debugging
  useEffect(() => {
    console.log('State changed - defaultDueOn:', defaultDueOn, 'maxDueOn:', maxDueOn);
  }, [defaultDueOn, maxDueOn]);

  useEffect(() => {
    if (route.params?.clearCartOnOpen) {
      setCart({});
      AsyncStorage.removeItem('catalogueCart');
    }
  }, []);

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
    handlePlaceOrderClick(defaultDueOn, setSelectedDueDate, setShowDueDateModal, console);
  };

  const handleConfirmDueDateWrapper = () => {
    // Close modal and proceed with order placement
    handleConfirmDueDate(setShowDueDateModal, placeOrderWrapper);
  };

  const placeOrderWrapper = async () => {
    await placeOrder(cart, cartProducts, selectedDueDate, navigation, setIsPlacingOrder, setCart, Alert, console);
  };

  const renderCartItem = ({ item }) => {
    const quantity = cart[item.id];
    if (!quantity) return null; // Only skip rendering if quantity is explicitly unset, not if it's 0
    
    const imageUrl = item.image ? { uri: `http://${ipAddress}:8091/images/products/${item.image}` } : null;
    // Remove GST calculation: just use discountPrice and price as-is
    const discountPrice = Number(item.discountPrice) || 0;
    const price = Number(item.price) || 0;
    const totalPrice = discountPrice * quantity;

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
          <Text style={[styles.cartItemName, { fontSize: getScaledSize(16) }]} numberOfLines={2}>{item.name}</Text>
          {/* Show MRP scratched, then Selling Price, no GST calculation */}
          {item.price ? (
            <Text style={[styles.originalPrice, { fontSize: getScaledSize(12) }]}>{formatCurrency(price)}</Text>
          ) : null}
          <Text style={[styles.cartItemPrice, { fontSize: getScaledSize(14) }]}>
            {formatCurrency(discountPrice)} x {quantity} = {formatCurrency(totalPrice)}
          </Text>
          <View style={styles.quantityContainer}>
            <TouchableOpacity 
              style={styles.quantityButton} 
              onPress={() => handleDecreaseQuantity(item.id, setCart)}
              disabled={quantity <= 0}
            >
              <Icon name="remove" size={18} color={COLORS.text.light} />
            </TouchableOpacity>
            <TextInput
              style={styles.quantityInput}
              value={quantity.toString()}
              onChangeText={(value) => handleQuantityChange(item.id, value, setCart)}
              onBlur={() => handleQuantityBlur(item.id, quantity.toString(), setCart)}
              keyboardType="numeric"
              selectTextOnFocus={true}
              maxLength={3}
            />
            <TouchableOpacity 
              style={styles.quantityButton} 
              onPress={() => handleIncreaseQuantity(item.id, setCart)}
            >
              <Icon name="add" size={18} color={COLORS.text.light} />
            </TouchableOpacity>
          </View>
        </View>
        <TouchableOpacity
          style={styles.cartItemDeleteButton}
          onPress={() => deleteCartItem(item.id, cart, setCart, setCartProducts)}
        >
          <Icon name="delete" size={20} style={styles.cartItemDeleteIcon} color={COLORS.error} />
        </TouchableOpacity>
      </View>
    );
  };

  const renderProductItem = ({ item }) => {
    const imageUrl = item.image ? { uri: `http://${ipAddress}:8091/images/products/${item.image}` } : null;
    const inCartQuantity = cart[item.id] || 0;
    
    // Check if product is inactive
    const isInactive = item.enable_product === "Inactive";
    
    return (
      <TouchableOpacity 
        style={[
          styles.productCard,
          isInactive && styles.inactiveProductCard
        ]}
        onPress={() => {
          // Don't allow adding inactive products to cart
          if (isInactive) return;
          
          // Add to cart or increase quantity
          if (inCartQuantity === 0) {
            setCart(prev => ({ ...prev, [item.id]: 1 }));
          } else {
            setCart(prev => ({ ...prev, [item.id]: inCartQuantity + 1 }));
          }
          // Ensure product metadata is saved so totals and rendering work
          upsertCartItemMeta(item, setCartProducts, AsyncStorage, console);
          // Close modal
          setShowAddMoreModal(false);
        }}
        disabled={isInactive}
      >
        <View style={styles.productImageWrapper}>
          {imageUrl ? (
            <Image 
              source={imageUrl} 
              style={[
                styles.productImage,
                isInactive && styles.inactiveProductImage
              ]} 
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
          <Text style={[
            styles.productName,
            isInactive && styles.inactiveProductText,
            { fontSize: getScaledSize(14) }
          ]} numberOfLines={2}>{item.name}</Text>
          <Text style={[
            styles.productPrice,
            isInactive && styles.inactiveProductText,
            { fontSize: getScaledSize(14) }
          ]}>{formatCurrency(item.discountPrice || item.price || 0)}</Text>
          {isInactive ? (
            <View style={styles.inactiveBadge}>
              <Text style={[styles.inactiveBadgeText, { fontSize: getScaledSize(12) }]}>UNAVAILABLE</Text>
            </View>
          ) : inCartQuantity > 0 && (
            <View style={styles.inCartBadge}>
              <Text style={[styles.inCartText, { fontSize: getScaledSize(12) }]}>In Cart: {inCartQuantity}</Text>
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  const totalAmount = calculateTotalAmount(cart, cartProducts);
  const cartItemCount = Object.values(cart).reduce((sum, qty) => sum + qty, 0);
  const isCartEmpty = cartItemCount === 0;

  const clearCartWrapper = () => {
    clearCart(setCart, setCartProducts);
  };

  // Apply filters
  const applyFiltersWrapper = (brand, category) => {
    applyFilters(brand, category, searchTerm, products, setFilteredProducts);
  };

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
          
          <Text style={[styles.headerTitle, { fontSize: getScaledSize(20) }]}>Your Cart</Text>
          
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
            <Text style={[styles.loadingText, { fontSize: getScaledSize(16) }]}>Loading your cart...</Text>
          </View>
        ) : isCartEmpty ? (
          <View style={styles.emptyCartContainer}>
            <Icon name="shopping-cart" size={80} color={COLORS.text.tertiary} />
            <Text style={[styles.emptyCartTitle, { fontSize: getScaledSize(20) }]}>Your cart is empty</Text>
            <Text style={[styles.emptyCartMessage, { fontSize: getScaledSize(16) }]}>Add items to start shopping</Text>
            <TouchableOpacity 
              style={styles.shopNowButton}
              onPress={() => setShowAddMoreModal(true)}
            >
              <Text style={[styles.shopNowButtonText, { fontSize: getScaledSize(16) }]}>Shop Now</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <View style={styles.cartHeader}>
              <Text style={[styles.cartItemCountText, { fontSize: getScaledSize(16) }]}>{cartItemCount} item(s) in cart</Text>
              <TouchableOpacity 
                style={styles.clearCartButton}
                onPress={clearCartWrapper}
              >
                <Icon name="delete" size={16} color={COLORS.error} />
                <Text style={[styles.clearCartButtonText, { fontSize: getScaledSize(14) }]}>Clear Cart</Text>
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
                <Text style={[styles.totalLabel, { fontSize: getScaledSize(18) }]}>Total Amount (incl. GST):</Text>
                <Text style={[styles.totalAmount, { fontSize: getScaledSize(20) }]}>{formatCurrency(totalAmount)}</Text>
              </View>
              
              <View style={styles.actionButtonsContainer}>
                <TouchableOpacity 
                  style={styles.addMoreButton}
                  onPress={() => setShowAddMoreModal(true)}
                >
                  <Text style={[styles.addMoreButtonText, { fontSize: getScaledSize(16) }]}>Add More Items</Text>
                </TouchableOpacity>
                
                <TouchableOpacity 
                  style={styles.checkoutButton}
                  onPress={handlePlaceOrderClickWrapper}
                  disabled={isPlacingOrder}
                >
                  {isPlacingOrder ? (
                    <ActivityIndicator size="small" color={COLORS.text.light} />
                  ) : (
                    <Text style={[styles.checkoutButtonText, { fontSize: getScaledSize(16) }]}>Place Order</Text>
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
            <Text style={[styles.modalTitle, { fontSize: getScaledSize(18) }]}>Add More Items</Text>
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
                  applyFiltersWrapper(itemValue, selectedCategory);
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
                  applyFiltersWrapper(selectedBrand, itemValue);
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
              <Text style={[styles.dueDateLabel, { fontSize: getScaledSize(16) }]}>
                When would you like this order to be delivered?
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
              
              <Text style={[styles.dueDateNote, { fontSize: getScaledSize(14) }]}>
                Note: This date will be used by our delivery team to schedule your order delivery.
              </Text>
            </View>
            
            <View style={styles.dueDateModalFooter}>
              <TouchableOpacity
                style={styles.cancelDueDateButton}
                onPress={() => setShowDueDateModal(false)}
              >
                <Text style={[styles.cancelDueDateButtonText, { fontSize: getScaledSize(16) }]}>Cancel</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={styles.confirmDueDateButton}
                onPress={handleConfirmDueDateWrapper}
              >
                <Text style={[styles.confirmDueDateButtonText, { fontSize: getScaledSize(16) }]}>Confirm & Place Order</Text>
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

export default CartCustomer;