import React, { useState, useEffect, useRef } from 'react';
import { 
  View, 
  Text, 
  TextInput, 
  FlatList, 
  StyleSheet, 
  TouchableOpacity, 
  ActivityIndicator, 
  Alert, 
  SafeAreaView,
  StatusBar,
  ScrollView,
  Platform,
  Modal,
  Image,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { useNavigation } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Toast from 'react-native-toast-message';
import { jwtDecode } from 'jwt-decode';
import Icon from 'react-native-vector-icons/MaterialIcons';
import SearchProductModal_1 from './searchProductModal_1';
import moment from 'moment';
import { useFontScale } from '../../App';

// Import utilities from the new oupdateutils folder
import { 
  COLORS, 
  formatCurrency, 
  formatDate, 
  styles,
  fetchUserPermissions,
  fetchAdminOrders,
  fetchOrderProducts,
  updateOrder,
  deleteProductItem,
  deleteOrder,
  addProductToOrder,
  fetchAllProductsForImages,
  fetchCustomerName,
  getApprovalStatusColor,
  getApprovalStatusText,
  calculateTotalAmount,
  isOrderEditable,
  filterOrders,
  OrderItem,
  ProductItem
} from './oupdateutils';

const AdminOrderUpdate = () => {
  const { getScaledSize } = useFontScale();
  const navigation = useNavigation();
  const [orders, setOrders] = useState([]);
  const [selectedOrderId, setSelectedOrderId] = useState(null);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteLoadingIndex, setDeleteLoadingIndex] = useState(null);
  const [orderDeleteLoading, setOrderDeleteLoading] = useState(false);
  const [orderDeleteLoadingId, setOrderDeleteLoadingId] = useState(null);
  const [selectedOrderCustomerId, setSelectedOrderCustomerId] = useState(null);
  const [allowProductEdit, setAllowProductEdit] = useState(false);
  const [allowCancelOrder, setAllowCancelOrder] = useState(false);
  // Store all products for image lookup
  const [allProducts, setAllProducts] = useState([]);
  // Customer names state
  const [customerNames, setCustomerNames] = useState({});
  // Cancelled filter state
  const [cancelledFilter, setCancelledFilter] = useState('All'); // 'All', 'Yes', 'No'

  // Add refs for scroll and order details
  const scrollViewRef = useRef(null);
  const orderDetailsRef = useRef(null);

  // Edit modal states (following AdminCartPage pattern)
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editProduct, setEditProduct] = useState(null);
  const [editPrice, setEditPrice] = useState('');
  const [editQty, setEditQty] = useState('1');
  const [editError, setEditError] = useState(null);

  useEffect(() => {
    fetchAdminOrdersData();
    fetchUserPermissionsData();
    fetchAllProductsForImagesData();
  }, []);

  // Fetch customer names when orders change
  useEffect(() => {
    const fetchCustomerNames = async () => {
      console.log('=== FETCHING CUSTOMER NAMES ===');
      console.log('Orders:', orders.length);
      console.log('Current customerNames:', customerNames);
      if (orders.length > 0) {
        for (const order of orders) {
          console.log(`Processing order ${order.id}, customer_id: ${order.customer_id}`);
          if (order.customer_id && !customerNames[order.customer_id]) {
            console.log(`Fetching name for customer_id: ${order.customer_id}`);
            await getCustomerName(order.customer_id);
          }
        }
      }
      console.log('=== CUSTOMER NAMES FETCH COMPLETE ===');
    };
    
    fetchCustomerNames();
  }, [orders]);

  // Scroll to order details when selectedOrderId changes
  useEffect(() => {
    if (selectedOrderId && orderDetailsRef.current && scrollViewRef.current) {
      setTimeout(() => {
        orderDetailsRef.current.measureLayout(
          scrollViewRef.current.getInnerViewNode(),
          (x, y) => {
            scrollViewRef.current.scrollTo({ y: y - 16, animated: true });
          }
        );
      }, 300); // Delay to ensure layout is ready
    }
  }, [selectedOrderId]);

  const fetchUserPermissionsData = async () => {
    try {
      const permissions = await fetchUserPermissions(navigation);
      setAllowProductEdit(permissions.allowProductEdit);
      setAllowCancelOrder(permissions.allowCancelOrder);
    } catch (error) {
      console.error('Error fetching user details:', error);
      setAllowProductEdit(false);
      setAllowCancelOrder(false);
    }
  };

  const fetchAdminOrdersData = async () => {
    setLoading(true);
    setError(null);
    try {
      const ordersData = await fetchAdminOrders();
      setOrders(ordersData);
    } catch (fetchOrdersError) {
      const errorMessage = fetchOrdersError.message || "Failed to fetch admin orders.";
      setError(errorMessage);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: errorMessage
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchOrderProductsData = async (orderIdToFetch) => {
    setLoading(true);
    setError(null);
    try {
      const productsData = await fetchOrderProducts(orderIdToFetch);
      setProducts(productsData);
      setSelectedOrderId(orderIdToFetch);
      
      const selectedOrder = orders.find(order => order.id === orderIdToFetch);
      if (selectedOrder) {
        setSelectedOrderCustomerId(selectedOrder.customer_id);
      }
    } catch (error) {
      setError(error.message || "Failed to fetch order products.");
      Toast.show({ 
        type: 'error', 
        text1: 'Error', 
        text2: error.message || "Failed to fetch order products." 
      });
      setProducts([]);
      setSelectedOrderId(null);
      setSelectedOrderCustomerId(null);
    } finally {
      setLoading(false);
    }
  };

  const handleEditProduct = (item) => {
    // Find the full product info from allProducts
    const fullProduct = allProducts.find(p => p.id === item.product_id || p.id === item.id);
    setEditProduct({
      ...item,
      min_selling_price: fullProduct?.min_selling_price ?? fullProduct?.minSellingPrice ?? 0,
      discountPrice: fullProduct?.discountPrice ?? fullProduct?.selling_price ?? fullProduct?.price ?? 0,
    });
    setEditPrice(item.price.toString());
    setEditQty(item.quantity.toString());
    setEditError(null);
    setEditModalVisible(true);
  };

  const saveEditProduct = () => {
    if (!editProduct) return;

    const newQty = parseInt(editQty);
    if (isNaN(newQty) || newQty <= 0) {
      setEditError('Please enter a valid quantity');
      return;
    }

    let finalPrice = editProduct.price;
    if (allowProductEdit) {
      const parsedPrice = parseFloat(editPrice);
      const minPrice = editProduct.min_selling_price !== undefined ? editProduct.min_selling_price : 0;
      const maxPrice = editProduct.discountPrice !== undefined ? editProduct.discountPrice : (editProduct.price !== undefined ? editProduct.price : 0);

      if (isNaN(parsedPrice) || parsedPrice < minPrice || parsedPrice > maxPrice) {
        setEditError(`Price must be between ₹${minPrice} and ₹${maxPrice}`);
        return;
      }
      finalPrice = parsedPrice;
    }

    // Update local state only
    setProducts(prevProducts =>
      prevProducts.map(product =>
        product.product_id === editProduct.product_id
          ? { ...product, price: finalPrice, quantity: newQty }
          : product
      )
    );

    // Close modal and reset state
    setEditModalVisible(false);
    setEditProduct(null);
    setEditPrice('');
    setEditQty('1');
    setEditError(null);

    Toast.show({
      type: 'success',
      text1: 'Product Updated Locally',
      text2: 'Press "Update Order" to save changes.',
    });
  };

  const handleUpdateOrder = async () => {
    if (!selectedOrderId || products.length === 0) {
      Toast.show({
        type: 'error',
        text1: 'Cannot Update',
        text2: 'No order or products to update.',
      });
      return;
    }

    setLoading(true);
    try {
      const token = await AsyncStorage.getItem('userAuthToken');
      if (!token) throw new Error('Authentication token not found.');

      const decodedToken = jwtDecode(token);
      const alteredBy = decodedToken.username;

      const response = await updateOrder(selectedOrderId, products, alteredBy);

      Toast.show({
        type: 'success',
        text1: 'Order Updated Successfully',
        text2: `Order #${selectedOrderId} has been updated.`,
      });
      // Optionally, refresh data
      fetchOrderProductsData(selectedOrderId);
      fetchAdminOrdersData(); // To update total amount in the list
    } catch (error) {
      console.error('Error updating order:', error);
      Toast.show({
        type: 'error',
        text1: 'Update Failed',
        text2: error.message || 'An unknown error occurred.',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteProductItem = async (indexToDelete) => {
    const productToDelete = products[indexToDelete];
    if (!productToDelete || !productToDelete.order_id) {
      Toast.show({ 
        type: 'error', 
        text1: 'Error', 
        text2: "Could not delete product item. Order Product ID missing." 
      });
      return;
    }

    setDeleteLoading(true);
    setDeleteLoadingIndex(indexToDelete);
    setError(null);

    try {
      const deleteData = await deleteProductItem(productToDelete);

      // Do NOT cancel the order if last product is deleted. Just update products state.
      const updatedProducts = products.filter((_, index) => index !== indexToDelete);
      setProducts(updatedProducts);
      
      Toast.show({
        type: 'success',
        text1: 'Product Deleted',
        text2: "Product item deleted successfully from order."
      });

    } catch (deleteError) {
      setError(deleteError.message || "Failed to delete order product.");
      Toast.show({ 
        type: 'error', 
        text1: 'Error', 
        text2: deleteError.message || "Failed to delete product item." 
      });
    } finally {
      setDeleteLoading(false);
      setDeleteLoadingIndex(null);
    }
  };

  const handleDeleteOrder = async (orderIdToDelete) => {
    setOrderDeleteLoading(true);
    setOrderDeleteLoadingId(orderIdToDelete);
    setError(null);

    try {
      const deleteOrderData = await deleteOrder(orderIdToDelete);
      
      setSelectedOrderId(null);
      setProducts([]);
      await fetchAdminOrdersData();

      Toast.show({
        type: "success",
        text1: "Order Cancelled",
        text2: deleteOrderData.message || `Order ID ${orderIdToDelete} cancelled successfully.`,
      });
    } catch (error) {
      setError(error.message || "Failed to cancel order.");
      Toast.show({
        type: "error",
        text1: "Error",
        text2: error.message || "Failed to cancel the order.",
      });
    } finally {
      setOrderDeleteLoading(false);
      setOrderDeleteLoadingId(null);
    }
  };

  const confirmCancelOrder = (orderId) => {
    Alert.alert(
      'Cancel Order',
      'Do you really want to cancel this order?',
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Yes',
          style: 'default',
          onPress: () =>
            Alert.alert(
              'Confirm Cancel',
              'This action cannot be undone. Proceed?',
              [
                { text: 'No', style: 'cancel' },
                { text: 'Yes', style: 'destructive', onPress: () => handleDeleteOrder(orderId) },
              ]
            ),
        },
      ]
    );
  };

  const handleAddProductToOrder = async (productToAdd) => {
    if (!selectedOrderId) return Alert.alert("Error", "Please select an order.");
    if (products.some(p => p.product_id === productToAdd.id)) {
      Toast.show({ 
        type: 'info', 
        text1: 'Product Already Added', 
        text2: 'Update quantity instead.' 
      });
      setShowSearchModal(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const addProductData = await addProductToOrder(selectedOrderId, productToAdd, orders);
      
      Toast.show({ 
        type: 'success', 
        text1: 'Product Added', 
        text2: `${productToAdd.name} added with price ₹${productToAdd.price}.` 
      });
      fetchOrderProductsData(selectedOrderId);
      setShowSearchModal(false);
    } catch (error) {
      setError(error.message || "Failed to add product.");
      Toast.show({ 
        type: 'error', 
        text1: 'Error', 
        text2: error.message 
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchAllProductsForImagesData = async () => {
    try {
      const data = await fetchAllProductsForImages();
      setAllProducts(data);
    } catch (error) {
      setAllProducts([]);
    }
  };

  // Function to fetch customer name by customer ID
  const fetchCustomerNameData = async (customerId) => {
    try {
      console.log(`Fetching customer name for ID: ${customerId}`);
      const customerName = await fetchCustomerName(customerId);
      console.log(`Customer name response for ID ${customerId}:`, customerName);
      return customerName;
    } catch (error) {
      console.error(`Error fetching customer name for ID ${customerId}:`, error);
      return null;
    }
  };

  // Simple function to get customer name and cache it
  const getCustomerName = async (customerId) => {
    if (customerNames[customerId]) {
      return customerNames[customerId];
    }
    
    const name = await fetchCustomerNameData(customerId);
    if (name) {
      setCustomerNames(prev => ({ ...prev, [customerId]: name }));
    }
    return name;
  };

  const renderOrderItem = ({ item }) => (
    <OrderItem
      item={item}
      selectedOrderId={selectedOrderId}
      customerNames={customerNames}
      orderDeleteLoading={orderDeleteLoading}
      orderDeleteLoadingId={orderDeleteLoadingId}
      allowCancelOrder={allowCancelOrder}
      getScaledSize={getScaledSize}
      onSelectOrder={(orderId) => {
        if (orderId === null) {
          setSelectedOrderId(null);
          setProducts([]);
          setSelectedOrderCustomerId(null);
        } else {
          fetchOrderProductsData(orderId);
        }
      }}
      onCancelOrder={confirmCancelOrder}
    />
  );

  const renderProductItem = ({ item, index }) => (
    <ProductItem
      item={item}
      index={index}
      allProducts={allProducts}
      deleteLoading={deleteLoading}
      deleteLoadingIndex={deleteLoadingIndex}
      isOrderEditable={isOrderEditable(orders.find(order => order.id === selectedOrderId))}
      allowProductEdit={allowProductEdit}
      selectedOrder={orders.find(order => order.id === selectedOrderId)}
      getScaledSize={getScaledSize}
      onEditProduct={handleEditProduct}
      onDeleteProduct={handleDeleteProductItem}
    />
  );

  const selectedOrder = orders.find((order) => order.id === selectedOrderId);
  const totalAmount = calculateTotalAmount(products);

  // Filtered orders based on cancelled state
  const filteredOrders = filterOrders(orders, cancelledFilter);

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
        <Text style={[styles.headerTitle, { fontSize: getScaledSize(18) }]}>Update Orders</Text>
        <TouchableOpacity
          style={styles.refreshButton}
          onPress={fetchAdminOrdersData}
        >
          <Icon name="refresh" size={24} color={COLORS.primary} />
        </TouchableOpacity>
      </View>
      {/* Cancelled filter dropdown */}
      <View style={styles.cancelledFilterContainer}>
        <Text style={[styles.cancelledFilterLabel, { fontSize: getScaledSize(14) }]}>Show Cancelled:</Text>
        <Picker
          selectedValue={cancelledFilter}
          style={styles.cancelledFilterPicker}
          onValueChange={(value) => setCancelledFilter(value)}
          mode="dropdown"
        >
          <Picker.Item label="All" value="All" />
          <Picker.Item label="Yes" value="Yes" />
          <Picker.Item label="No" value="No" />
        </Picker>
      </View>

      {loading && !selectedOrderId && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={[styles.loadingText, { fontSize: getScaledSize(16) }]}>Loading your orders...</Text>
        </View>
      )}

      {error && (
        <View style={styles.errorContainer}>
          <Icon name="error-outline" size={24} color={COLORS.text.light} />
          <Text style={[styles.errorText, { fontSize: getScaledSize(14) }]}>{error}</Text>
        </View>
      )}

      <ScrollView 
        style={styles.scrollContainer}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        ref={scrollViewRef}
      >
        <View style={styles.ordersContainer}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { fontSize: getScaledSize(18) }]}>Today's Orders</Text>
            <View style={styles.orderCountBadge}>
              <Text style={[styles.orderCountText, { fontSize: getScaledSize(14) }]}>
                {orders.length} order{orders.length !== 1 ? "s" : ""}
              </Text>
            </View>
          </View>

          {orders.length === 0 && !loading ? (
            <View style={styles.emptyContainer}>
              <Icon name="shopping-basket" size={48} color={COLORS.text.tertiary} />
              <Text style={[styles.emptyText, { fontSize: getScaledSize(18) }]}>No orders for today</Text>
              <Text style={[styles.emptySubtext, { fontSize: getScaledSize(14) }]}>Your orders will appear here</Text>
            </View>
          ) : (
            <FlatList
              data={filteredOrders}
              keyExtractor={(item) => item.id.toString()}
              renderItem={renderOrderItem}
              scrollEnabled={false}
              contentContainerStyle={styles.orderList}
              ItemSeparatorComponent={() => <View style={styles.orderSeparator} />}
            />
          )}
        </View>
        {/* Order details/products section anchor for scroll */}
        {selectedOrderId && selectedOrder && (
          <View ref={orderDetailsRef} />
        )}
        {selectedOrderId && selectedOrder && (
          <View style={styles.editContainer}>
            {/* Order Status Banner */}
            {!isOrderEditable(selectedOrder) && (
              <View style={[styles.orderStatusBanner, { backgroundColor: COLORS.success + '15' }]}>
                <Icon 
                  name="lock" 
                  size={16} 
                  color={COLORS.success} 
                />
                <Text style={[styles.orderStatusBannerText, { color: COLORS.success, fontSize: getScaledSize(14) }]}>
                  Order cannot be edited
                </Text>
              </View>
            )}

            <View style={styles.orderDetailsCard}>
              <View style={styles.orderDetailRow}>
                <View style={styles.orderDetailItem}>
                  <Icon name="calendar-today" size={16} color={COLORS.text.secondary} />
                  <Text style={[styles.orderDetailText, { fontSize: getScaledSize(12) }]}>
                    {formatDate(selectedOrder.placed_on)}
                  </Text>
                </View>
              </View>
            </View>

            <View style={styles.editHeader}>
              <Text style={[styles.sectionTitle, { fontSize: getScaledSize(18) }]}>Edit Order #{selectedOrderId}</Text>
              <TouchableOpacity
                style={[
                  styles.addProductButton,
                  (!isOrderEditable(selectedOrder) || (selectedOrder && (selectedOrder.approve_status === 'Accepted' || selectedOrder.approve_status === 'Rejected' || selectedOrder.approve_status === 'Altered'))) && styles.disabledButton
                ]}
                onPress={() => setShowSearchModal(true)}
                disabled={!isOrderEditable(selectedOrder) || (selectedOrder && (selectedOrder.approve_status === 'Accepted' || selectedOrder.approve_status === 'Rejected' || selectedOrder.approve_status === 'Altered'))}
              >
                <Icon name="add" size={20} color={COLORS.text.light} />
                <Text style={[styles.addProductButtonText, { fontSize: getScaledSize(14) }]}>Add Product</Text>
              </TouchableOpacity>
            </View>

            {products.length === 0 ? (
              <View style={styles.emptyProductsContainer}>
                <Icon name="box-open" size={48} color={COLORS.text.tertiary} />
                <Text style={[styles.emptyProductsText, { fontSize: getScaledSize(16) }]}>No products in this order</Text>
                <TouchableOpacity
                  style={[
                    styles.addProductsButton,
                    (!isOrderEditable(selectedOrder)) && styles.disabledButton
                  ]}
                  onPress={() => setShowSearchModal(true)}
                  disabled={!isOrderEditable(selectedOrder)}
                >
                  <Text style={[styles.addProductsButtonText, { fontSize: getScaledSize(14) }]}>Add Products</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <>
                <FlatList
                  data={products}
                  keyExtractor={(_, index) => index.toString()}
                  renderItem={renderProductItem}
                  scrollEnabled={false}
                  contentContainerStyle={styles.productList}
                  ItemSeparatorComponent={() => <View style={styles.productSeparator} />}
                />
                <View style={styles.summaryContainer}>
                  <View style={styles.summaryRow}>
                    <Text style={[styles.summaryLabel, { fontSize: getScaledSize(14) }]}>Items:</Text>
                    <Text style={[styles.summaryValue, { fontSize: getScaledSize(14) }]}>
                      {products.length} item{products.length !== 1 ? "s" : ""}
                    </Text>
                  </View>
                  <View style={styles.summaryRow}>
                    <Text style={[styles.summaryLabel, { fontSize: getScaledSize(14) }]}>Total Amount:</Text>
                    <Text style={[styles.summaryAmount, { fontSize: getScaledSize(18) }]}>
                      {formatCurrency(totalAmount)}
                    </Text>
                  </View>
                </View>
              </>
            )}

            <View style={styles.footer}>
              <TouchableOpacity
                style={[
                  styles.updateButton,
                  (!isOrderEditable(selectedOrder) || (selectedOrder && (selectedOrder.approve_status === 'Accepted' || selectedOrder.approve_status === 'Rejected' || selectedOrder.approve_status === 'Altered'))) && styles.disabledButton
                ]}
                onPress={handleUpdateOrder}
                disabled={loading || !isOrderEditable(selectedOrder) || (selectedOrder && (selectedOrder.approve_status === 'Accepted' || selectedOrder.approve_status === 'Rejected' || selectedOrder.approve_status === 'Altered'))}
              >
                <Text style={[styles.updateButtonText, { fontSize: getScaledSize(16) }]}>
                  Update Order
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </ScrollView>

      {/* Edit Product Modal */}
      <Modal
        visible={editModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setEditModalVisible(false)}
      >
        <View style={styles.modalBackground}>
          <View style={styles.editModalContainer}>
            <View style={styles.editModalHeader}>
              <Text style={[styles.editModalTitle, { fontSize: getScaledSize(18) }]}>Edit Product</Text>
              <TouchableOpacity
                style={styles.modalCloseButton}
                onPress={() => setEditModalVisible(false)}
              >
                <Icon name="close" size={20} color={COLORS.text.primary} />
              </TouchableOpacity>
            </View>
            
            {editProduct && (
              <View style={styles.editModalContent}>
                <Text style={[styles.editItemName, { fontSize: getScaledSize(16) }]}>{editProduct.name}</Text>
                
                <View style={styles.editInputRow}>
                  <View style={styles.editInputContainer}>
                    <Text style={[styles.editInputLabel, { fontSize: getScaledSize(14) }]}>Price (₹)</Text>
                    <TextInput
                      style={[styles.editTextInput, !allowProductEdit && styles.disabledInput]}
                      value={editPrice}
                      onChangeText={allowProductEdit ? setEditPrice : undefined}
                      placeholder="Price"
                      keyboardType="numeric"
                      placeholderTextColor={COLORS.text.tertiary}
                      editable={allowProductEdit}
                    />
                    {editProduct && allowProductEdit && (
                      <Text style={[styles.priceRangeText, { fontSize: getScaledSize(12) }]}>
                        Range: ₹{editProduct.min_selling_price || 0} - ₹{editProduct.discountPrice || editProduct.price || 0}
                      </Text>
                    )}
                    {!allowProductEdit && (
                      <Text style={[styles.disabledPriceText, { fontSize: getScaledSize(12) }]}>
                        Price editing disabled
                      </Text>
                    )}
                  </View>
                  
                  <View style={styles.editInputContainer}>
                    <Text style={[styles.editInputLabel, { fontSize: getScaledSize(14) }]}>Quantity</Text>
                    <TextInput
                      style={styles.editTextInput}
                      value={editQty}
                      onChangeText={setEditQty}
                      placeholder="Qty"
                      keyboardType="numeric"
                      placeholderTextColor={COLORS.text.tertiary}
                    />
                  </View>
                </View>
                
                {editError && (
                  <Text style={[styles.errorText, { fontSize: getScaledSize(14) }]}>{editError}</Text>
                )}
                
                <View style={styles.editModalButtons}>
                  <TouchableOpacity
                    style={styles.editCancelButton}
                    onPress={() => setEditModalVisible(false)}
                  >
                    <Text style={[styles.editCancelText, { fontSize: getScaledSize(16) }]}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.editSaveButton}
                    onPress={saveEditProduct}
                  >
                    <Text style={[styles.editSaveText, { fontSize: getScaledSize(16) }]}>Save</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        </View>
      </Modal>

      <Toast />
      <SearchProductModal_1
        isVisible={showSearchModal}
        onClose={() => setShowSearchModal(false)}
        onAddProduct={handleAddProductToOrder}
        allowProductEdit={true}
      />
    </SafeAreaView>
  );
};

export default AdminOrderUpdate;