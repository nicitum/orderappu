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
  Dimensions,
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
import { COLORS, formatCurrency } from './cartutils';
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

// Get screen dimensions
const { width, height } = Dimensions.get('window');
const isTablet = width >= 768;

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

  // New modern cart item component
  const renderModernCartItem = ({ item }) => {
    const quantity = cart[item.id];
    if (!quantity) return null;
    
    const imageUrl = item.image ? { uri: `http://${ipAddress}:8091/images/products/${item.image}` } : null;
    const discountPrice = Number(item.discountPrice) || 0;
    const price = Number(item.price) || 0;
    const totalPrice = discountPrice * quantity;
    const savings = (price - discountPrice) * quantity;

    return (
      <View style={modernStyles.cartItemCard}>
        {/* Product Image */}
        <View style={modernStyles.cartItemImageContainer}>
          {imageUrl ? (
            <Image 
              source={imageUrl} 
              style={modernStyles.cartItemImage} 
              resizeMode="cover"
            />
          ) : (
            <View style={modernStyles.imagePlaceholder}>
              <Icon name="image-not-supported" size={30} color={COLORS.text.tertiary} />
            </View>
          )}
        </View>

        {/* Product Details */}
        <View style={modernStyles.cartItemDetails}>
          <Text style={[modernStyles.cartItemName, { fontSize: getScaledSize(16) }]} numberOfLines={2}>
            {item.name}
          </Text>
          
          {/* Price Information */}
          <View style={modernStyles.priceContainer}>
            <Text style={[modernStyles.currentPrice, { fontSize: getScaledSize(16) }]}>
              {formatCurrency(discountPrice)}
            </Text>
            {price > discountPrice && (
              <Text style={[modernStyles.originalPrice, { fontSize: getScaledSize(12) }]}>
                {formatCurrency(price)}
              </Text>
            )}
          </View>
          
          {/* Savings Badge */}
          {savings > 0 && (
            <View style={modernStyles.savingsBadge}>
              <Text style={modernStyles.savingsText}>
                Save {formatCurrency(savings)}
              </Text>
            </View>
          )}
          
          {/* Quantity Controls */}
          <View style={modernStyles.quantityControls}>
            <TouchableOpacity 
              style={modernStyles.quantityButton}
              onPress={() => handleDecreaseQuantity(item.id, setCart)}
              disabled={quantity <= 1}
            >
              <Icon name="remove" size={20} color={quantity <= 1 ? COLORS.text.tertiary : COLORS.primary} />
            </TouchableOpacity>
            
            <View style={modernStyles.quantityDisplay}>
              <Text style={[modernStyles.quantityText, { fontSize: getScaledSize(16) }]}>
                {quantity}
              </Text>
            </View>
            
            <TouchableOpacity 
              style={modernStyles.quantityButton}
              onPress={() => handleIncreaseQuantity(item.id, setCart)}
            >
              <Icon name="add" size={20} color={COLORS.primary} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Right Side - Total & Delete */}
        <View style={modernStyles.cartItemActions}>
          <Text style={[modernStyles.itemTotal, { fontSize: getScaledSize(16) }]}>
            {formatCurrency(totalPrice)}
          </Text>
          <TouchableOpacity
            style={modernStyles.deleteButton}
            onPress={() => deleteCartItem(item.id, cart, setCart, setCartProducts)}
          >
            <Icon name="delete-outline" size={24} color={COLORS.error} />
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  // New modern product item for add more modal
  const renderModernProductItem = ({ item }) => {
    const imageUrl = item.image ? { uri: `http://${ipAddress}:8091/images/products/${item.image}` } : null;
    const inCartQuantity = cart[item.id] || 0;
    const isInactive = item.enable_product === "Inactive";
    
    return (
      <TouchableOpacity 
        style={[
          modernStyles.productCard,
          isInactive && modernStyles.inactiveProductCard
        ]}
        onPress={() => {
          if (isInactive) return;
          
          if (inCartQuantity === 0) {
            setCart(prev => ({ ...prev, [item.id]: 1 }));
          } else {
            setCart(prev => ({ ...prev, [item.id]: inCartQuantity + 1 }));
          }
          upsertCartItemMeta(item, setCartProducts, AsyncStorage, console);
          setShowAddMoreModal(false);
        }}
        disabled={isInactive}
      >
        <View style={modernStyles.productImageWrapper}>
          {imageUrl ? (
            <Image 
              source={imageUrl} 
              style={[
                modernStyles.productImage,
                isInactive && modernStyles.inactiveProductImage
              ]} 
              resizeMode="cover"
            />
          ) : (
            <View style={modernStyles.productImagePlaceholder}>
              <Icon name="image-not-supported" size={24} color={COLORS.text.tertiary} />
            </View>
          )}
        </View>
        
        <View style={modernStyles.productInfo}>
          <Text style={[
            modernStyles.productName,
            isInactive && modernStyles.inactiveProductText,
            { fontSize: getScaledSize(14) }
          ]} numberOfLines={2}>
            {item.name}
          </Text>
          
          <View style={modernStyles.productPriceContainer}>
            <Text style={[
              modernStyles.productPrice,
              isInactive && modernStyles.inactiveProductText,
              { fontSize: getScaledSize(15) }
            ]}>
              {formatCurrency(item.discountPrice || item.price || 0)}
            </Text>
            
            {item.price && item.discountPrice && item.price > item.discountPrice && (
              <Text style={[
                modernStyles.originalPriceSmall,
                { fontSize: getScaledSize(12) }
              ]}>
                {formatCurrency(item.price)}
              </Text>
            )}
          </View>
          
          {isInactive ? (
            <View style={modernStyles.inactiveBadge}>
              <Text style={[modernStyles.inactiveBadgeText, { fontSize: getScaledSize(11) }]}>
                UNAVAILABLE
              </Text>
            </View>
          ) : inCartQuantity > 0 && (
            <View style={modernStyles.inCartBadge}>
              <Icon name="check" size={12} color={COLORS.secondary} />
              <Text style={[modernStyles.inCartText, { fontSize: getScaledSize(11) }]}>
                In Cart: {inCartQuantity}
              </Text>
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  // Calculate cart totals
  const totalItems = Object.values(cart).reduce((sum, qty) => sum + (qty || 0), 0);
  const totalAmount = calculateTotalAmount(cart, cartProducts);

  if (loading) {
    return (
      <SafeAreaView style={modernStyles.safeArea}>
        <View style={modernStyles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={[modernStyles.loadingText, { fontSize: getScaledSize(16) }]}>
            Loading your cart...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const cartItems = Object.entries(cart)
    .map(([id, quantity]) => {
      const product = cartProducts.find(p => p.id === parseInt(id));
      return product ? { ...product, id: parseInt(id) } : null;
    })
    .filter(Boolean);

  if (cartItems.length === 0) {
    return (
      <SafeAreaView style={modernStyles.safeArea}>
        <View style={modernStyles.emptyCartContainer}>
          <Icon name="shopping-cart" size={80} color={COLORS.text.tertiary} />
          <Text style={[modernStyles.emptyCartTitle, { fontSize: getScaledSize(22) }]}>
            Your cart is empty
          </Text>
          <Text style={[modernStyles.emptyCartMessage, { fontSize: getScaledSize(16) }]}>
            Add some products to your cart and they will appear here
          </Text>
          <TouchableOpacity 
            style={modernStyles.shopNowButton}
            onPress={() => setShowAddMoreModal(true)}
          >
            <Text style={[modernStyles.shopNowButtonText, { fontSize: getScaledSize(16) }]}>
              Browse Products
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={modernStyles.safeArea}>
      <StatusBar backgroundColor={COLORS.primary} barStyle="light-content" />
      
      {/* Header */}
      {!hideHeader && (
        <View style={modernStyles.header}>
          <TouchableOpacity 
            style={modernStyles.headerButton}
            onPress={() => navigation.goBack()}
          >
            <Icon name="arrow-back" size={24} color={COLORS.text.light} />
          </TouchableOpacity>
          
          <View style={modernStyles.headerTitleContainer}>
            <Text style={[modernStyles.headerTitle, { fontSize: getScaledSize(18) }]}>
              Shopping Cart
            </Text>
            <Text style={[modernStyles.headerSubtitle, { fontSize: getScaledSize(14) }]}>
              {totalItems} item{totalItems !== 1 ? 's' : ''}
            </Text>
          </View>
          
          <TouchableOpacity 
            style={modernStyles.headerButton}
            onPress={() => clearCart(setCart, setCartProducts)}
          >
            <Icon name="delete" size={24} color={COLORS.text.light} />
          </TouchableOpacity>
        </View>
      )}

      {/* Cart Items */}
      <FlatList
        data={cartItems}
        renderItem={renderModernCartItem}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={modernStyles.cartList}
        showsVerticalScrollIndicator={false}
        ListFooterComponent={
          <View style={modernStyles.cartSummary}>
            <View style={modernStyles.summaryRow}>
              <Text style={[modernStyles.summaryLabel, { fontSize: getScaledSize(16) }]}>
                Subtotal
              </Text>
              <Text style={[modernStyles.summaryValue, { fontSize: getScaledSize(16) }]}>
                {formatCurrency(totalAmount)}
              </Text>
            </View>
            
            <View style={modernStyles.summaryRow}>
              <Text style={[modernStyles.summaryLabel, { fontSize: getScaledSize(16) }]}>
                GST
              </Text>
              <Text style={[modernStyles.summaryValue, { fontSize: getScaledSize(16) }]}>
                {formatCurrency(0)}
              </Text>
            </View>
            
            <View style={modernStyles.totalRow}>
              <Text style={[modernStyles.totalLabel, { fontSize: getScaledSize(18) }]}>
                Total
              </Text>
              <Text style={[modernStyles.totalValue, { fontSize: getScaledSize(18) }]}>
                {formatCurrency(totalAmount)}
              </Text>
            </View>
          </View>
        }
      />

      {/* Footer - Action Buttons */}
      <View style={modernStyles.footer}>
        <TouchableOpacity 
          style={modernStyles.addButton}
          onPress={() => setShowAddMoreModal(true)}
        >
          <Icon name="add-shopping-cart" size={20} color={COLORS.primary} />
          <Text style={[modernStyles.addButtonText, { fontSize: getScaledSize(16) }]}>
            Add More
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={modernStyles.checkoutButton}
          onPress={handlePlaceOrderClickWrapper}
          disabled={isPlacingOrder}
        >
          {isPlacingOrder ? (
            <ActivityIndicator size="small" color={COLORS.text.light} />
          ) : (
            <Text style={[modernStyles.checkoutButtonText, { fontSize: getScaledSize(16) }]}>
              Place Order • {formatCurrency(totalAmount)}
            </Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Add More Products Modal */}
      <Modal
        visible={showAddMoreModal}
        animationType="slide"
        onRequestClose={() => setShowAddMoreModal(false)}
      >
        <SafeAreaView style={modernStyles.modalSafeArea}>
          {/* Modal Header */}
          <View style={modernStyles.modalHeader}>
            <TouchableOpacity 
              style={modernStyles.closeModalButton}
              onPress={() => setShowAddMoreModal(false)}
            >
              <Icon name="close" size={24} color={COLORS.text.primary} />
            </TouchableOpacity>
            <Text style={[modernStyles.modalTitle, { fontSize: getScaledSize(18) }]}>
              Add Products
            </Text>
            <View style={{ width: 24 }} /> {/* Spacer for alignment */}
          </View>

          {/* Search and Filters */}
          <View style={modernStyles.searchContainer}>
            <View style={modernStyles.searchWrapper}>
              <Icon name="search" size={20} color={COLORS.text.tertiary} style={modernStyles.searchIcon} />
              <TextInput
                style={[modernStyles.searchInput, { fontSize: getScaledSize(16) }]}
                placeholder="Search products..."
                value={searchTerm}
                onChangeText={setSearchTerm}
                placeholderTextColor={COLORS.text.tertiary}
              />
            </View>
            
            <View style={modernStyles.filterContainer}>
              <View style={modernStyles.pickerWrapper}>
                <Picker
                  selectedValue={selectedBrand}
                  style={modernStyles.picker}
                  onValueChange={setSelectedBrand}
                  dropdownIconColor={COLORS.text.tertiary}
                >
                  {brands.map(brand => (
                    <Picker.Item key={brand} label={brand} value={brand} color={COLORS.text.primary} />
                  ))}
                </Picker>
              </View>
              
              <View style={modernStyles.pickerWrapper}>
                <Picker
                  selectedValue={selectedCategory}
                  style={modernStyles.picker}
                  onValueChange={setSelectedCategory}
                  dropdownIconColor={COLORS.text.tertiary}
                >
                  {categories.map(category => (
                    <Picker.Item key={category} label={category} value={category} color={COLORS.text.primary} />
                  ))}
                </Picker>
              </View>
            </View>
          </View>

          {/* Product List */}
          <FlatList
            data={filteredProducts}
            renderItem={renderModernProductItem}
            keyExtractor={(item) => item.id.toString()}
            contentContainerStyle={modernStyles.productList}
            numColumns={isTablet ? 3 : 2}
            showsVerticalScrollIndicator={false}
            columnWrapperStyle={isTablet ? modernStyles.columnWrapper : undefined}
          />
        </SafeAreaView>
      </Modal>

      {/* Due Date Selection Modal */}
      <Modal
        visible={showDueDateModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowDueDateModal(false)}
      >
        <View style={modernStyles.modalOverlay}>
          <View style={modernStyles.dueDateModal}>
            <View style={modernStyles.dueDateModalHeader}>
              <Text style={[modernStyles.dueDateModalTitle, { fontSize: getScaledSize(18) }]}>
                Select Due Date
              </Text>
              <TouchableOpacity 
                style={modernStyles.closeDueDateButton}
                onPress={() => setShowDueDateModal(false)}
              >
                <Icon name="close" size={24} color={COLORS.text.tertiary} />
              </TouchableOpacity>
            </View>
            
            <View style={modernStyles.dueDateContent}>
              <Text style={[modernStyles.dueDateLabel, { fontSize: getScaledSize(15) }]}>
                Choose when you would like to receive your order
              </Text>
              
              <TouchableOpacity 
                style={modernStyles.datePickerButton}
                onPress={showDatePicker}
              >
                <Icon name="calendar-today" size={20} color={COLORS.primary} />
                <Text style={[modernStyles.datePickerButtonText, { fontSize: getScaledSize(16) }]}>
                  {moment(selectedDueDate).format('ddd, MMM D, YYYY')}
                </Text>
                <Icon name="arrow-drop-down" size={24} color={COLORS.text.tertiary} />
              </TouchableOpacity>
              
              <Text style={[modernStyles.dueDateNote, { fontSize: getScaledSize(13) }]}>
                Orders are typically delivered within 1-2 business days
              </Text>
            </View>
            
            <View style={modernStyles.dueDateModalFooter}>
              <TouchableOpacity 
                style={modernStyles.cancelDueDateButton}
                onPress={() => setShowDueDateModal(false)}
              >
                <Text style={[modernStyles.cancelDueDateButtonText, { fontSize: getScaledSize(16) }]}>
                  Cancel
                </Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={modernStyles.confirmDueDateButton}
                onPress={handleConfirmDueDateWrapper}
              >
                <Text style={[modernStyles.confirmDueDateButtonText, { fontSize: getScaledSize(16) }]}>
                  Confirm
                </Text>
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
        minimumDate={new Date()}
        maximumDate={new Date(new Date().setDate(new Date().getDate() + maxDueOn))}
      />
    </SafeAreaView>
  );
};

// Modern Styles
const modernStyles = StyleSheet.create({
  safeArea: {
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
    color: COLORS.text.secondary,
  },
  emptyCartContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyCartTitle: {
    fontWeight: '700',
    color: COLORS.text.primary,
    marginTop: 24,
    marginBottom: 8,
  },
  emptyCartMessage: {
    color: COLORS.text.tertiary,
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 24,
  },
  shopNowButton: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 12,
    elevation: 3,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
  },
  shopNowButtonText: {
    color: COLORS.text.light,
    fontWeight: '600',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.primary,
    paddingHorizontal: 16,
    paddingVertical: 12,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
  },
  headerButton: {
    padding: 8,
    borderRadius: 20,
  },
  headerTitleContainer: {
    alignItems: 'center',
  },
  headerTitle: {
    fontWeight: '700',
    color: COLORS.text.light,
  },
  headerSubtitle: {
    color: 'rgba(255,255,255,0.8)',
    marginTop: 2,
  },
  cartList: {
    padding: 16,
    paddingBottom: 100,
  },
  cartItemCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    flexDirection: 'row',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  cartItemImageContainer: {
    width: 80,
    height: 80,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: COLORS.background,
  },
  cartItemImage: {
    width: '100%',
    height: '100%',
  },
  imagePlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F0F0F0',
  },
  cartItemDetails: {
    flex: 1,
    marginLeft: 16,
    justifyContent: 'space-between',
  },
  cartItemName: {
    fontWeight: '600',
    color: COLORS.text.primary,
    marginBottom: 4,
  },
  priceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  currentPrice: {
    fontWeight: '700',
    color: COLORS.primary,
    marginRight: 8,
  },
  originalPrice: {
    color: COLORS.text.tertiary,
    textDecorationLine: 'line-through',
  },
  savingsBadge: {
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    alignSelf: 'flex-start',
    marginBottom: 8,
  },
  savingsText: {
    color: COLORS.secondary,
    fontWeight: '600',
    fontSize: 12,
  },
  quantityControls: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  quantityButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  quantityDisplay: {
    marginHorizontal: 12,
    minWidth: 30,
    alignItems: 'center',
  },
  quantityText: {
    fontWeight: '600',
    color: COLORS.text.primary,
  },
  cartItemActions: {
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingLeft: 16,
  },
  itemTotal: {
    fontWeight: '700',
    color: COLORS.text.primary,
  },
  deleteButton: {
    padding: 8,
    borderRadius: 16,
  },
  cartSummary: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 20,
    marginTop: 8,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  summaryLabel: {
    color: COLORS.text.secondary,
  },
  summaryValue: {
    color: COLORS.text.primary,
    fontWeight: '500',
  },
  totalLabel: {
    fontWeight: '700',
    color: COLORS.text.primary,
  },
  totalValue: {
    fontWeight: '700',
    color: COLORS.primary,
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    backgroundColor: COLORS.surface,
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
  },
  addButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.background,
    paddingVertical: 16,
    borderRadius: 12,
    marginRight: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  addButtonText: {
    color: COLORS.primary,
    fontWeight: '600',
    marginLeft: 8,
  },
  checkoutButton: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary,
    paddingVertical: 16,
    borderRadius: 12,
    elevation: 3,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
  },
  checkoutButtonText: {
    color: COLORS.text.light,
    fontWeight: '600',
  },
  modalSafeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.surface,
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  closeModalButton: {
    padding: 4,
  },
  modalTitle: {
    fontWeight: '700',
    color: COLORS.text.primary,
  },
  searchContainer: {
    backgroundColor: COLORS.surface,
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  searchWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.background,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 16,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    color: COLORS.text.primary,
  },
  filterContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  pickerWrapper: {
    flex: 1,
    backgroundColor: COLORS.background,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  picker: {
    color: COLORS.text.primary,
  },
  productList: {
    padding: 16,
    paddingBottom: 32,
  },
  columnWrapper: {
    justifyContent: 'space-between',
  },
  productCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  productImageWrapper: {
    width: '100%',
    height: 140,
    backgroundColor: COLORS.background,
  },
  productImage: {
    width: '100%',
    height: '100%',
  },
  productImagePlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F0F0F0',
  },
  productInfo: {
    padding: 12,
  },
  productName: {
    fontWeight: '600',
    color: COLORS.text.primary,
    marginBottom: 8,
  },
  productPriceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  productPrice: {
    fontWeight: '700',
    color: COLORS.primary,
    marginRight: 8,
  },
  originalPriceSmall: {
    color: COLORS.text.tertiary,
    textDecorationLine: 'line-through',
  },
  inCartBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  inCartText: {
    color: COLORS.secondary,
    fontWeight: '500',
    marginLeft: 4,
  },
  inactiveProductCard: {
    opacity: 0.6,
  },
  inactiveProductImage: {
    opacity: 0.5,
  },
  inactiveProductText: {
    color: COLORS.text.tertiary,
  },
  inactiveBadge: {
    backgroundColor: COLORS.background,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  inactiveBadgeText: {
    color: COLORS.text.tertiary,
    fontWeight: '500',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  dueDateModal: {
    backgroundColor: COLORS.surface,
    borderRadius: 20,
    width: '100%',
    maxWidth: 400,
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  dueDateModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  dueDateModalTitle: {
    fontWeight: '700',
    color: COLORS.text.primary,
  },
  closeDueDateButton: {
    padding: 4,
  },
  dueDateContent: {
    padding: 24,
  },
  dueDateLabel: {
    color: COLORS.text.secondary,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 22,
  },
  datePickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.background,
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  datePickerButtonText: {
    flex: 1,
    fontWeight: '600',
    color: COLORS.text.primary,
    textAlign: 'center',
  },
  dueDateNote: {
    color: COLORS.text.tertiary,
    textAlign: 'center',
    marginTop: 20,
    lineHeight: 20,
  },
  dueDateModalFooter: {
    flexDirection: 'row',
    padding: 20,
    gap: 12,
  },
  cancelDueDateButton: {
    flex: 1,
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    backgroundColor: COLORS.surface,
  },
  cancelDueDateButtonText: {
    color: COLORS.text.secondary,
    fontWeight: '600',
  },
  confirmDueDateButton: {
    flex: 1,
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    elevation: 2,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  confirmDueDateButtonText: {
    color: COLORS.text.light,
    fontWeight: '600',
  },
});

export default CartCustomer;