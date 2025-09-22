import React, { useState, useEffect, useRef } from 'react';
import { 
  View, 
  Text, 
  TextInput, 
  FlatList, 
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
import { useFontScale } from '../../App';
import { Picker } from '@react-native-picker/picker';
import { useNavigation } from '@react-navigation/native';

import Toast from 'react-native-toast-message';

import Icon from 'react-native-vector-icons/MaterialIcons';
import SearchProductModal_1 from './searchProductModal_1';

import { ipAddress } from '../../services/urls';

// Import from oupdateutils
import { COLORS, formatCurrency, formatDate } from './oupdateutils/constants';
import styles from './oupdateutils/styles';
import { 
  fetchOwnerOrders,
  fetchOrderProducts,
  deleteOrderProduct,
  updateOrder,
  deleteOrder,
  addProductToOrder,
  fetchAllProductsForImages,
  fetchCustomerName
} from './oupdateutils/apiHelpers';
import { 
  handleEditProduct,
  saveEditProduct,
  confirmCancelOrder,
  getApprovalStatusColor,
  getApprovalStatusText,
  getApprovalStatusIcon,
  getCustomerName
} from './oupdateutils/utils';

const OwnerOrderUpdate = () => {
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
    fetchOwnerOrders(setLoading, setError, setOrders, Toast);
    fetchAllProductsForImages(setAllProducts);
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
            await getCustomerName(order.customer_id, customerNames, setCustomerNames, fetchCustomerName);
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

  const handleSaveEditProduct = () => {
    saveEditProduct(
      editProduct,
      editPrice,
      editQty,
      setProducts,
      products,
      setEditModalVisible,
      setEditProduct,
      setEditPrice,
      setEditQty,
      setEditError,
      Toast
    );
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

    await deleteOrderProduct(
      productToDelete,
      setDeleteLoading,
      setDeleteLoadingIndex,
      indexToDelete,
      setError,
      setProducts,
      products,
      Toast
    );
  };

  const handleUpdateOrder = async () => {
    await updateOrder(
      selectedOrderId,
      products,
      setLoading,
      setError,
      setOrders,
      setSelectedOrderId,
      setProducts,
      navigation,
      Toast
    );
  };

  const handleDeleteOrder = async (orderIdToDelete) => {
    await deleteOrder(
      orderIdToDelete,
      setOrderDeleteLoading,
      setOrderDeleteLoadingId,
      setError,
      setSelectedOrderId,
      setProducts,
      setOrders,
      Toast
    );
  };

  const handleConfirmCancelOrder = (orderId) => {
    confirmCancelOrder(orderId, handleDeleteOrder);
  };

  const handleAddProductToOrder = async (productToAdd) => {
    await addProductToOrder(
      productToAdd,
      selectedOrderId,
      products,
      setLoading,
      setError,
      setProducts,
      setSelectedOrderId,
      orders,
      setShowSearchModal,
      setOrders,
      Toast
    );
  };

  const renderOrderItem = ({ item }) => (
    <TouchableOpacity
      style={[
        styles.orderCard,
        selectedOrderId === item.id && styles.selectedOrderCard
      ]}
      onPress={() => {
        if (selectedOrderId === item.id) {
          setSelectedOrderId(null);
          setProducts([]);
          setSelectedOrderCustomerId(null);
        } else {
          fetchOrderProducts(
            item.id,
            setLoading,
            setError,
            setProducts,
            setSelectedOrderId,
            setSelectedOrderCustomerId,
            orders,
            Toast
          );
        }
      }}
    >
      <View style={styles.orderCardContent}>
        <View style={styles.orderLeftSection}>
          <Text style={[styles.orderIdText, { fontSize: getScaledSize(16) }]}>#{item.id}</Text>
          <Text style={[styles.customerNameText, { fontSize: getScaledSize(12) }]}>
            {customerNames[item.customer_id] ? 
              customerNames[item.customer_id] : 
              `ID: ${item.customer_id}`
            }
          </Text>
        </View>
        <View style={styles.orderCenterSection}>
          <Text style={[styles.orderAmountText, { fontSize: getScaledSize(16) }]}>{formatCurrency(item.total_amount)}</Text>
          <View style={styles.statusContainer}>
            {item.cancelled === 'Yes' && (
              <Text style={[styles.cancelledStatusText, { fontSize: getScaledSize(10) }]}>Cancelled</Text>
            )}
            {item.loading_slip === "Yes" && (
              <Text style={[styles.processedStatusText, { fontSize: getScaledSize(10) }]}>Processed</Text>
            )}
            {/* Show approval status prominently */}
            {item.approve_status && item.approve_status !== 'null' && item.approve_status !== 'Null' && item.approve_status !== 'NULL' && (
              <Text style={[
                styles.approvalStatusText,
                { color: getApprovalStatusColor(item.approve_status, COLORS), fontSize: getScaledSize(10) }
              ]}>
                {getApprovalStatusText(item.approve_status)}
              </Text>
            )}
            {(!item.approve_status || item.approve_status === 'null' || item.approve_status === 'Null' || item.approve_status === 'NULL') && (
              <Text style={[styles.approvalStatusText, { color: COLORS.warning }]}>
                PENDING
              </Text>
            )}
          </View>
        </View>
        <TouchableOpacity
          style={[
            styles.cancelOrderButton,
            (item.loading_slip === "Yes" || item.cancelled === "Yes" || item.approve_status === "Rejected" || item.approve_status === "Accepted" || item.approve_status === "Altered") && styles.disabledCancelButton
          ]}
          onPress={() => handleConfirmCancelOrder(item.id)}
          disabled={
            orderDeleteLoading || 
            item.loading_slip === "Yes" || 
            item.cancelled === "Yes" || 
            item.approve_status === "Rejected" ||
            item.approve_status === "Accepted" ||
            item.approve_status === "Altered"
          }
        >
          {orderDeleteLoading && orderDeleteLoadingId === item.id ? (
            <ActivityIndicator size="small" color={COLORS.text.light} />
          ) : (
            <Icon name="cancel" size={16} color={COLORS.text.light} />
          )}
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );

  const renderProductItem = ({ item, index }) => {
    const selectedOrder = orders.find((order) => order.id === selectedOrderId);
    // Try to get image from item.image, or from allProducts (by product_id), fallback to placeholder
    let imageName = item.image;
    if (!imageName) {
      const prod = allProducts.find(p => p.id === item.product_id || p.id === item.id);
      imageName = prod?.image;
    }
    const imageUri = imageName ? `http://${ipAddress}:8091/images/products/${imageName}` : null;
    const itemTotal = (item.price || 0) * (item.quantity || 1);

    // Check if order is editable (not cancelled, not processed, not rejected, not accepted, not altered)
    const isOrderEditable = selectedOrder && 
      selectedOrder.cancelled !== 'Yes' && 
      selectedOrder.approve_status !== 'Rejected' &&
      selectedOrder.approve_status !== 'Accepted' &&  // Don't allow editing if accepted
      selectedOrder.approve_status !== 'Altered' &&   // Don't allow editing if altered
      selectedOrder.loading_slip !== "Yes";

    // Check if order is restricted (accepted, rejected, or altered)
    const isOrderRestricted = selectedOrder && (
      selectedOrder.approve_status === 'Accepted' || 
      selectedOrder.approve_status === 'Rejected' || 
      selectedOrder.approve_status === 'Altered'
    );

    return (
      <View style={[styles.productCard, isOrderRestricted && styles.restrictedProductCard]}>
        <View style={styles.productContent}>
          <View style={styles.productImageContainer}>
            {imageUri ? (
              <Image
                source={{ uri: imageUri }}
                style={[styles.productImage, isOrderRestricted && styles.restrictedProductImage]}
                resizeMode="cover"
                onError={() => console.warn(`Failed to load image for ${item.name}`)}
              />
            ) : (
              <View style={[styles.productImage, styles.noImageContainer, isOrderRestricted && styles.restrictedNoImageContainer]}>
                <Icon name="image-not-supported" size={24} color={isOrderRestricted ? "#999" : "#CCC"} />
              </View>
            )}
          </View>
          <View style={styles.productDetails}>
            <Text style={[styles.productName, isOrderRestricted && styles.restrictedProductText]} numberOfLines={2}>{item.name}</Text>
            <Text style={[styles.productPrice, isOrderRestricted && styles.restrictedProductText]}>{formatCurrency(item.price || 0)} x {item.quantity || 1} = {formatCurrency(itemTotal)}</Text>
            {item.category && <Text style={[styles.productCategory, isOrderRestricted && styles.restrictedProductText]}>{item.category}</Text>}
            <TouchableOpacity 
              style={[styles.editButton, (!isOrderEditable || isOrderRestricted) && styles.disabledEditButton]}
              onPress={() => handleEditProduct(item, allProducts, setEditProduct, setEditPrice, setEditQty, setEditError, setEditModalVisible)}
              disabled={!isOrderEditable || isOrderRestricted}
            >
              <Icon name="edit" size={16} color={isOrderEditable && !isOrderRestricted ? COLORS.primary : COLORS.text.tertiary} />
              <Text style={[styles.editButtonText, (!isOrderEditable || isOrderRestricted) && styles.disabledEditButtonText]}>Edit</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.productActions}>
            <TouchableOpacity
              style={[
                styles.deleteButton,
                (!isOrderEditable || isOrderRestricted) && styles.disabledDeleteButton
              ]}
              onPress={() => handleDeleteProductItem(index)}
              disabled={deleteLoading || !isOrderEditable || isOrderRestricted}
            >
              {deleteLoading && deleteLoadingIndex === index ? (
                <ActivityIndicator size="small" color={COLORS.error} />
              ) : (
                <Icon
                  name="delete"
                  size={20}
                  color={(!isOrderEditable || isOrderRestricted) ? COLORS.text.tertiary : COLORS.error}
                />
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  };

  const selectedOrder = orders.find((order) => order.id === selectedOrderId);
  const totalAmount = products.reduce((sum, product) => {
    return sum + (product.quantity * product.price);
  }, 0);

  // Check if order is editable (not cancelled, not processed, not rejected, not accepted, not altered)
  const isOrderEditable = selectedOrder && 
    selectedOrder.cancelled !== 'Yes' && 
    selectedOrder.approve_status !== 'Rejected' &&
    selectedOrder.approve_status !== 'Accepted' &&  // Don't allow editing if accepted
    selectedOrder.approve_status !== 'Altered' &&   // Don't allow editing if altered
    selectedOrder.loading_slip !== "Yes";

  // Check if order is restricted (accepted, rejected, or altered)
  const isOrderRestricted = selectedOrder && (
    selectedOrder.approve_status === 'Accepted' || 
    selectedOrder.approve_status === 'Rejected' || 
    selectedOrder.approve_status === 'Altered'
  );

  // Filtered orders based on cancelled state
  const filteredOrders = orders.filter(order => {
    if (cancelledFilter === 'All') return true;
    if (cancelledFilter === 'Yes') return order.cancelled === 'Yes';
    if (cancelledFilter === 'No') return order.cancelled !== 'Yes';
    return true;
  });

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
          onPress={() => fetchOwnerOrders(setLoading, setError, setOrders, Toast)}
        >
          <Icon name="refresh" size={24} color={COLORS.primary} />
        </TouchableOpacity>
      </View>
      {/* Cancelled filter dropdown */}
      <View style={styles.cancelledFilterContainer}>
        <Text style={styles.cancelledFilterLabel}>Show Cancelled:</Text>
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
            <View style={styles.orderDetailsCard}>
              <View style={styles.orderDetailRow}>
                <View style={styles.orderDetailItem}>
                  <Icon name="calendar-today" size={16} color={COLORS.text.secondary} />
                  <Text style={styles.orderDetailText}>
                    {formatDate(selectedOrder.placed_on)}
                  </Text>
                </View>
              </View>
              <View style={styles.orderStatusContainer}>
                <Icon 
                  name={selectedOrder.loading_slip === "Yes" ? "check-circle" : "pending"} 
                  size={16} 
                  color={selectedOrder.loading_slip === "Yes" ? COLORS.success : COLORS.warning} 
                />
                <Text style={[
                  styles.orderStatusText,
                  { color: selectedOrder.loading_slip === "Yes" ? COLORS.success : COLORS.warning }
                ]}>
                  {selectedOrder.loading_slip === "Yes" ? "Processed" : "Pending"}
                </Text>
              </View>
              {/* Show approval status */}
              {selectedOrder.approve_status && selectedOrder.approve_status !== 'null' && selectedOrder.approve_status !== 'Null' && selectedOrder.approve_status !== 'NULL' && (
                <View style={styles.orderStatusContainer}>
                  <Icon 
                    name={getApprovalStatusIcon(selectedOrder.approve_status)} 
                    size={16} 
                    color={getApprovalStatusColor(selectedOrder.approve_status, COLORS)} 
                  />
                  <Text style={[
                    styles.orderStatusText,
                    { color: getApprovalStatusColor(selectedOrder.approve_status, COLORS) }
                  ]}>
                    {getApprovalStatusText(selectedOrder.approve_status)}
                  </Text>
                </View>
              )}
            </View>

            <View style={styles.editHeader}>
              <Text style={styles.sectionTitle}>Edit Order #{selectedOrderId}</Text>
              <TouchableOpacity
                style={[
                  styles.addProductButton,
                  (!isOrderEditable || isOrderRestricted) && styles.disabledButton
                ]}
                onPress={() => setShowSearchModal(true)}
                disabled={!isOrderEditable || isOrderRestricted}
              >
                <Icon name="add" size={20} color={COLORS.text.light} />
                <Text style={styles.addProductButtonText}>Add Product</Text>
              </TouchableOpacity>
            </View>
            
            {/* Show restriction message */}
            {isOrderRestricted && (
              <View style={styles.restrictionMessageContainer}>
                <Icon name="info" size={16} color={COLORS.warning} />
                <Text style={styles.restrictionMessageText}>
                  This order cannot be modified (Status: {getApprovalStatusText(selectedOrder.approve_status)})
                </Text>
              </View>
            )}

            {products.length === 0 ? (
              <View style={styles.emptyProductsContainer}>
                <Icon name="box-open" size={48} color={COLORS.text.tertiary} />
                <Text style={styles.emptyProductsText}>No products in this order</Text>
                <TouchableOpacity
                  style={[
                    styles.addProductsButton,
                    (!isOrderEditable || isOrderRestricted) && styles.disabledButton
                  ]}
                  onPress={() => setShowSearchModal(true)}
                  disabled={!isOrderEditable || isOrderRestricted}
                >
                  <Text style={styles.addProductsButtonText}>Add Products</Text>
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
                    <Text style={styles.summaryLabel}>Items:</Text>
                    <Text style={styles.summaryValue}>
                      {products.length} item{products.length !== 1 ? "s" : ""}
                    </Text>
                  </View>
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Total Amount:</Text>
                    <Text style={styles.summaryAmount}>
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
                  (!isOrderEditable || isOrderRestricted) && styles.disabledButton
                ]}
                onPress={handleUpdateOrder}
                disabled={loading || !isOrderEditable || isOrderRestricted}
              >
                <Text style={styles.updateButtonText}>
                  {(!isOrderEditable || isOrderRestricted) ? "Order Not Editable" : "Update Order"}
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
              <Text style={styles.editModalTitle}>Edit Product</Text>
              <TouchableOpacity
                style={styles.modalCloseButton}
                onPress={() => setEditModalVisible(false)}
              >
                <Icon name="close" size={20} color={COLORS.text.primary} />
              </TouchableOpacity>
            </View>
            
            {editProduct && (
              <View style={styles.editModalContent}>
                <Text style={styles.editItemName}>{editProduct.name}</Text>
                
                <View style={styles.editInputRow}>
                  <View style={styles.editInputContainer}>
                    <Text style={styles.editInputLabel}>Price (₹)</Text>
                    <TextInput
                      style={styles.editTextInput}
                      value={editPrice}
                      onChangeText={setEditPrice}
                      placeholder="Price"
                      keyboardType="numeric"
                      placeholderTextColor={COLORS.text.tertiary}
                      editable={true}
                    />
                    {editProduct && (
                      <Text style={styles.priceRangeText}>
                        Allowed: ₹{editProduct.min_selling_price || 0} - ₹{editProduct.discountPrice || editProduct.price || 0}
                      </Text>
                    )}
                  </View>
                  
                  <View style={styles.editInputContainer}>
                    <Text style={styles.editInputLabel}>Quantity</Text>
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
                  <Text style={styles.errorText}>{editError}</Text>
                )}
                
                <View style={styles.editModalButtons}>
                  <TouchableOpacity
                    style={styles.editCancelButton}
                    onPress={() => setEditModalVisible(false)}
                  >
                    <Text style={styles.editCancelText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.editSaveButton}
                    onPress={handleSaveEditProduct}
                  >
                    <Text style={styles.editSaveText}>Save</Text>
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

export default OwnerOrderUpdate;