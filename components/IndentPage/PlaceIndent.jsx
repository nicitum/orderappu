import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, Modal, Alert, ScrollView, Image, TextInput } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { jwtDecode } from 'jwt-decode';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { ipAddress } from '../../services/urls';
import SearchProductModal from './nestedPage/searchProductModal';
import Toast from 'react-native-toast-message';
import { SafeAreaView } from 'react-native-safe-area-context';
import SearchProductModal_1 from './nestedPage/searchProductModal_1.jsx';

const PlaceIndent = () => {
  const [assignedUsers, setAssignedUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [error, setError] = useState(null);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [optionModalVisible, setOptionModalVisible] = useState(false);
  const [orderProducts, setOrderProducts] = useState([]);
  const [loadingOrder, setLoadingOrder] = useState(false);
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [placingOrder, setPlacingOrder] = useState(false);
  const [orderType, setOrderType] = useState('AM'); // Default order type
  const [totalAmount, setTotalAmount] = useState(0);
  const [editCartModalVisible, setEditCartModalVisible] = useState(false);
  const [editCartProduct, setEditCartProduct] = useState(null);
  const [editCartPrice, setEditCartPrice] = useState('');
  const [editCartQty, setEditCartQty] = useState('1');
  const [editCartError, setEditCartError] = useState(null);
  const [recentOrder, setRecentOrder] = useState(null);
  const [recentOrderLoading, setRecentOrderLoading] = useState(false);
  const [recentOrderError, setRecentOrderError] = useState(null);
  const [showRepeatRecentOrder, setShowRepeatRecentOrder] = useState(false);
  const [allowProductEdit, setAllowProductEdit] = useState(false);

  // Calculate total amount whenever products change
  useEffect(() => {
    const total = orderProducts.reduce((sum, product) => {
      return sum + (product.price * (product.quantity || 1));
    }, 0);
    setTotalAmount(total);
  }, [orderProducts]);

  // Fetch assigned users
  useEffect(() => {
    const fetchAssignedUsers = async () => {
      try {
        const token = await AsyncStorage.getItem('userAuthToken');
        if (!token) throw new Error('No auth token found');

        const decoded = jwtDecode(token);
        const adminId = decoded.id1;
        const response = await fetch(`http://${ipAddress}:8091/assigned-users/${adminId}`, {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          }
        });

        if (!response.ok) throw new Error('Failed to fetch assigned users');
        const responseData = await response.json();
        console.log(responseData);
        
        if (responseData.success) {
          setAssignedUsers(responseData.assignedUsers);
        } else {
          throw new Error(responseData.message || 'Failed to fetch assigned users');
        }
      } catch (err) {
        setError(err.message);
      } finally {
        setLoadingUsers(false);
      }
    };

    fetchAssignedUsers();
  }, []);

  // Handle both Repeat Recent Order and Place Fresh Order for admin using /on-behalf
  const handleAdminOrder = async () => {
    Alert.alert('DEBUG', `handleAdminOrder called!\nselectedCustomer: ${JSON.stringify(selectedCustomer, null, 2)}\norderType: ${orderType}`);
    Toast.show({ type: 'info', text1: 'DEBUG', text2: `handleAdminOrder called for ${selectedCustomer?.cust_id}` });
    if (!selectedCustomer) return;
    setLoadingOrder(true);
    try {
      const token = await AsyncStorage.getItem('userAuthToken');
      // Fetch most recent order for the selected customer
      const response = await fetch(`http://${ipAddress}:8091/most-recent-order/${selectedCustomer.cust_id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!response.ok) throw new Error('Failed to fetch recent order');
      const data = await response.json();
      if (!data.order || !data.order.id) throw new Error('No recent order found for this customer.');
      const referenceOrderId = data.order.id;
      // Call /on-behalf API
      const onBehalfRes = await fetch(`http://${ipAddress}:8091/on-behalf`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          customer_id: selectedCustomer.cust_id,
          order_type: orderType,
          reference_order_id: referenceOrderId,
        }),
      });
      const onBehalfData = await onBehalfRes.json();
      if (!onBehalfRes.ok) throw new Error(onBehalfData.message || 'Failed to place order on behalf.');
      Toast.show({ type: 'success', text1: 'Order Placed', text2: 'Admin order placed successfully!' });
      setShowSearchModal(false);
      setOrderProducts([]);
      setSelectedCustomer(null);
      setOptionModalVisible(false);
    } catch (err) {
      Toast.show({ type: 'error', text1: 'Order Failed', text2: err.message });
    } finally {
      setLoadingOrder(false);
    }
  };

  // Place order API call (fresh order for admin now supported via /on-behalf-2)
  const handlePlaceOrder = async () => {
    if (orderProducts.length === 0) {
      Toast.show({ type: 'error', text1: 'Error', text2: 'Please add products to the order' });
      return;
    }
    if (!selectedCustomer) {
      Toast.show({ type: 'error', text1: 'Error', text2: 'No customer selected' });
      return;
    }
    setPlacingOrder(true);
    try {
      const token = await AsyncStorage.getItem('userAuthToken');
      // Prepare products for API
      const productsPayload = orderProducts.map((item) => ({
        product_id: item.product_id || item.id,
        quantity: item.quantity || 1,
        price: item.price,
        name: item.name,
        category: item.category || '',
        gst_rate: item.gst_rate || 0
      }));
      // Call /on-behalf-2 API
      const res = await fetch(`http://${ipAddress}:8091/on-behalf-2`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          customer_id: selectedCustomer.cust_id,
          order_type: orderType,
          products: productsPayload,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to place custom order.');
      Toast.show({ type: 'success', text1: 'Order Placed', text2: 'Admin custom order placed successfully!' });
      setShowSearchModal(false);
      setOrderProducts([]);
      setSelectedCustomer(null);
      setOptionModalVisible(false);
    } catch (err) {
      Toast.show({ type: 'error', text1: 'Order Failed', text2: err.message });
    } finally {
      setPlacingOrder(false);
    }
  };

  // Handle product addition from search modal
  const handleAddProduct = (product) => {
    const existingProduct = orderProducts.find(p => p.product_id === product.id);
    const finalPrice = product.finalPrice !== undefined ? product.finalPrice : (product.price || 0);
    if (existingProduct) {
      setOrderProducts(prev => prev.map(p =>
        p.product_id === product.id
          ? { ...p, quantity: (p.quantity || 1) + 1, price: finalPrice }
          : p
      ));
      Toast.show({
        type: 'success',
        text1: 'Quantity Updated',
        text2: `Added one more ${product.name} to order`
      });
    } else {
      setOrderProducts(prev => [...prev, {
        ...product,
        product_id: product.id,
        quantity: 1,
        price: finalPrice,
        image: product.image
      }]);
      Toast.show({
        type: 'success',
        text1: 'Product Added',
        text2: `${product.name} added to order`
      });
    }
    // Don't close the modal automatically to allow adding more products
  };

  // Handle quantity change
  const handleQuantityChange = (productId, newQuantity) => {
    const quantity = parseInt(newQuantity);
    if (isNaN(quantity) || quantity < 1) return;

    setOrderProducts(prev => prev.map(product => 
      product.product_id === productId 
        ? { ...product, quantity } 
        : product
    ));
  };

  // Handle product removal
  const handleRemoveProduct = (productId) => {
    Alert.alert(
      'Remove Product',
      'Are you sure you want to remove this product?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => {
            setOrderProducts(prev => prev.filter(p => p.product_id !== productId));
            Toast.show({
              type: 'success',
              text1: 'Product removed',
              text2: 'Product has been removed from the order'
            });
          }
        }
      ]
    );
  };

  const handleStartEditCartProduct = (item) => {
    setEditCartProduct(item);
    setEditCartPrice((item.price || 0).toString());
    setEditCartQty((item.quantity || 1).toString());
    setEditCartModalVisible(true);
    setEditCartError(null);
  };

  const handleConfirmEditCartProduct = () => {
    const priceNum = parseFloat(editCartPrice);
    const qtyNum = parseInt(editCartQty);
    if (isNaN(priceNum) || priceNum < 0) {
      setEditCartError('Please enter a valid price');
      return;
    }
    if (isNaN(qtyNum) || qtyNum < 1) {
      setEditCartError('Please enter a valid quantity');
      return;
    }
    setOrderProducts(prev => prev.map(p =>
      p.product_id === editCartProduct.product_id
        ? { ...p, price: priceNum, quantity: qtyNum }
        : p
    ));
    setEditCartModalVisible(false);
    setEditCartProduct(null);
    setEditCartPrice('');
    setEditCartQty('1');
    setEditCartError(null);
  };

  // When a customer is selected, fetch allow_product_edit
  const handleSelectCustomer = async (item) => {
    setSelectedCustomer(item);
    setOptionModalVisible(true);
    setAllowProductEdit(false); // default to false while loading
    try {
      const token = await AsyncStorage.getItem('userAuthToken');
      if (!token) throw new Error('No auth token found');

      const decoded = jwtDecode(token);
      const adminId_1 = decoded.id;
      const res = await fetch(`http://${ipAddress}:8091/get-allow-product-edit?customer_id=${adminId_1}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setAllowProductEdit(data.allow_product_edit === 'Yes');
      } else {
        setAllowProductEdit(false);
      }
    } catch (e) {
      setAllowProductEdit(false);
    }
  };

  // Render product item
  const renderProduct = ({ item }) => {
    const imageUri = item.image ? `http://${ipAddress}:8091/images/products/${item.image}` : null;

    return (
      <View style={styles.productCard}>
        <View style={styles.productInfo}>
          <View style={styles.productImageAndDetails}>
            {imageUri ? (
              <Image
                source={{ uri: imageUri }}
                style={styles.productImage}
                resizeMode="contain"
                onError={(e) => console.warn('Product image load error:', item.image, e.nativeEvent.error)}
              />
            ) : (
              <View style={styles.noImageContainer}>
                <Icon name="image-not-supported" size={40} color="#CCC" />
              </View>
            )}
            <View style={styles.productDetails}>
              <Text style={styles.productName} numberOfLines={2}>{item.name}</Text>
              {item.size && <Text style={styles.productVolume}>{item.size}</Text>}
            </View>
          </View>
          <View style={styles.quantityContainer}>
            <TouchableOpacity
              style={styles.quantityButton}
              onPress={() => handleQuantityChange(item.product_id, (item.quantity || 1) - 1)}
            >
              <Icon name="remove" size={20} color="#FFF" />
            </TouchableOpacity>
            <Text style={styles.quantityText}>{item.quantity || 1}</Text>
            <TouchableOpacity
              style={styles.quantityButton}
              onPress={() => handleQuantityChange(item.product_id, (item.quantity || 1) + 1)}
            >
              <Icon name="add" size={20} color="#FFF" />
            </TouchableOpacity>
          </View>
        </View>
        <View style={{ alignItems: 'center', justifyContent: 'center' }}>
          <TouchableOpacity
            style={styles.removeButton}
            onPress={() => handleRemoveProduct(item.product_id)}
          >
            <Icon name="delete" size={24} color="#dc3545" />
          </TouchableOpacity>
          {allowProductEdit && (
            <TouchableOpacity
              style={{ marginTop: 6, paddingVertical: 4, paddingHorizontal: 12, borderRadius: 12, backgroundColor: '#e6f0ff', flexDirection: 'row', alignItems: 'center' }}
              onPress={() => handleStartEditCartProduct(item)}
              accessibilityLabel="Edit price and quantity"
            >
              <Icon name="edit" size={16} color="#003087" />
              <Text style={{ color: '#003087', fontSize: 12, marginLeft: 4 }}>Edit</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  // When admin clicks Place Fresh Order, just open the modal
  const handlePlaceFreshOrder = () => {
    setShowSearchModal(true);
    setOptionModalVisible(false);
  };

  if (loadingUsers) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#003366" />
        <Text>Loading users...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Text style={styles.headerText}>Place Order for Customer</Text>
      </View>

      {!selectedCustomer ? (
        <FlatList
          data={assignedUsers}
          keyExtractor={(item, idx) => (item.customer_id ? item.customer_id.toString() : `user-${idx}`)}
          contentContainerStyle={styles.listContainer}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.userCard}
              onPress={() => handleSelectCustomer(item)}
            >
              <View style={styles.userInfo}>
                <Text style={styles.userName}>{item.name}</Text>
                <Text style={styles.userId}>ID: {item.cust_id}</Text>
              </View>
              <Icon name="chevron-right" size={24} color="#003366" />
            </TouchableOpacity>
          )}
        />
      ) : (
        <View style={styles.orderContainer}>
          <View style={styles.customerHeader}>
            <Text style={styles.customerName}>Order for: {selectedCustomer.name}</Text>
            <TouchableOpacity
              style={styles.changeCustomerButton}
              onPress={() => {
                setSelectedCustomer(null);
                setOrderProducts([]);
                setShowRepeatRecentOrder(false);
              }}
            >
              <Text style={styles.changeCustomerText}>Change Customer</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.productListHeader}>
            <Text style={styles.productListTitle}>
              Products ({orderProducts.length})
            </Text>
            <TouchableOpacity
              style={styles.addProductButton}
              onPress={() => setShowSearchModal(true)}
            >
              <Icon name="add" size={20} color="#FFF" />
              <Text style={styles.addProductText}>Add Products</Text>
            </TouchableOpacity>
          </View>

          {orderProducts.length > 0 ? (
            <ScrollView style={styles.productList}>
              {orderProducts.map((product) => (
                <View key={product.product_id} style={styles.productCard}>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    {product.image && (
                      <Image
                        source={{ uri: `http://${ipAddress}:8091/images/products/${product.image}` }}
                        style={{ width: 60, height: 60, borderRadius: 8, marginRight: 12, backgroundColor: '#f0f0f0' }}
                        resizeMode="cover"
                      />
                    )}
                    <View style={styles.productInfo}>
                      <Text style={styles.productName}>{product.name}</Text>
                      <Text style={styles.productPrice}>₹{product.price}</Text>
                      <View style={styles.quantityContainer}>
                        <TouchableOpacity
                          style={styles.quantityButton}
                          onPress={() => handleQuantityChange(product.product_id, (product.quantity || 1) - 1)}
                        >
                          <Icon name="remove" size={20} color="#FFF" />
                        </TouchableOpacity>
                        <Text style={styles.quantityText}>{product.quantity || 1}</Text>
                        <TouchableOpacity
                          style={styles.quantityButton}
                          onPress={() => handleQuantityChange(product.product_id, (product.quantity || 1) + 1)}
                        >
                          <Icon name="add" size={20} color="#FFF" />
                        </TouchableOpacity>
                      </View>
                    </View>
                    <View style={{ alignItems: 'center', justifyContent: 'center' }}>
                      <TouchableOpacity
                        style={styles.removeButton}
                        onPress={() => handleRemoveProduct(product.product_id)}
                      >
                        <Icon name="delete" size={24} color="#dc3545" />
                      </TouchableOpacity>
                      {allowProductEdit && (
                        <TouchableOpacity
                          style={{ marginTop: 6, paddingVertical: 4, paddingHorizontal: 12, borderRadius: 12, backgroundColor: '#e6f0ff', flexDirection: 'row', alignItems: 'center' }}
                          onPress={() => handleStartEditCartProduct(product)}
                          accessibilityLabel="Edit price and quantity"
                        >
                          <Icon name="edit" size={16} color="#003087" />
                          <Text style={{ color: '#003087', fontSize: 12, marginLeft: 4 }}>Edit</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                </View>
              ))}
            </ScrollView>
          ) : (
            <View style={styles.emptyState}>
              <Icon name="shopping-cart" size={48} color="#ccc" />
              <Text style={styles.emptyStateText}>No products added</Text>
              <Text style={styles.emptyStateSubtext}>
                Click "Add Products" to start building your order
              </Text>
            </View>
          )}

          {selectedCustomer && showRepeatRecentOrder && (
            <View style={{ marginBottom: 16 }}>
              <Text style={{ fontSize: 16, fontWeight: 'bold', color: '#003087', marginBottom: 8 }}>Repeat Recent Order</Text>
              {recentOrderLoading ? (
                <ActivityIndicator size="small" color="#003087" />
              ) : recentOrderError ? (
                <Text style={{ color: '#d32f2f' }}>{recentOrderError}</Text>
              ) : recentOrder && recentOrder.products && recentOrder.products.length > 0 ? (
                <View style={{ backgroundColor: '#f8faff', borderRadius: 10, padding: 12, marginBottom: 8 }}>
                  {recentOrder.products.map((prod, idx) => (
                    <View key={prod.product_id || idx} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
                      {prod.image && (
                        <Image
                          source={{ uri: `http://${ipAddress}:8091/images/products/${prod.image}` }}
                          style={{ width: 40, height: 40, borderRadius: 6, marginRight: 10, backgroundColor: '#f0f0f0' }}
                          resizeMode="cover"
                        />
                      )}
                      <Text style={{ flex: 1 }}>{prod.name}</Text>
                      <Text style={{ marginLeft: 8 }}>Qty: {prod.quantity}</Text>
                      <Text style={{ marginLeft: 8 }}>₹{prod.price}</Text>
                    </View>
                  ))}
                  <TouchableOpacity
                    style={{ marginTop: 10, backgroundColor: '#003087', borderRadius: 8, paddingVertical: 8, alignItems: 'center' }}
                    onPress={() => {
                      // Add all recent order products to cart
                      setOrderProducts(recentOrder.products.map(prod => ({
                        ...prod,
                        product_id: prod.product_id || prod.id,
                        quantity: prod.quantity,
                        price: prod.price,
                        image: prod.image
                      })));
                      Toast.show({ type: 'success', text1: 'Cart Updated', text2: 'Recent order products added to cart' });
                      setShowRepeatRecentOrder(false);
                    }}
                  >
                    <Text style={{ color: '#fff', fontWeight: 'bold' }}>Add All to Cart</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <Text style={{ color: '#666' }}>No recent order found for this customer.</Text>
              )}
            </View>
          )}

          {orderProducts.length > 0 && (
            <View style={styles.footer}>
              <View style={styles.totalContainer}>
                <Text style={styles.totalLabel}>Total Amount:</Text>
                <Text style={styles.totalAmount}>₹{totalAmount.toFixed(2)}</Text>
              </View>
              <TouchableOpacity
                style={[styles.placeOrderButton, placingOrder && styles.placeOrderButtonDisabled]}
                onPress={handlePlaceOrder}
                disabled={placingOrder}
              >
                {placingOrder ? (
                  <ActivityIndicator color="#FFF" />
                ) : (
                  <>
                    <Icon name="shopping-cart" size={24} color="#FFF" style={styles.placeOrderIcon} />
                    <Text style={styles.placeOrderText}>Place Order</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          )}
        </View>
      )}

      {/* Option Modal */}
      <Modal
        visible={optionModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setOptionModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Select Order Type</Text>
            <TouchableOpacity
              style={styles.modalButton}
              onPress={async () => {
                setOptionModalVisible(false);
                setShowRepeatRecentOrder(true);
                setRecentOrderLoading(true);
                setRecentOrderError(null);
                try {
                  const token = await AsyncStorage.getItem('userAuthToken');
                  const response = await fetch(`http://${ipAddress}:8091/most-recent-order?customerId=${selectedCustomer.cust_id}`, {
                    headers: { Authorization: `Bearer ${token}` }
                  });
                  if (!response.ok) throw new Error('Failed to fetch recent order');
                  const data = await response.json();
                  if (!data.order || !data.order.id) throw new Error('No recent order found for this customer.');
                  const productsRes = await fetch(`http://${ipAddress}:8091/order-products?orderId=${data.order.id}`, {
                    headers: { Authorization: `Bearer ${token}` }
                  });
                  if (!productsRes.ok) throw new Error('Failed to fetch products for recent order');
                  const products = await productsRes.json();
                  data.order.products = products;
                  setRecentOrder(data.order);
                } catch (err) {
                  setRecentOrder(null);
                  setRecentOrderError(err.message);
                } finally {
                  setRecentOrderLoading(false);
                }
              }}
            >
              <Icon name="history" size={24} color="#003366" />
              <Text style={styles.modalButtonText}>Repeat Recent Order</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.modalButton}
              onPress={handlePlaceFreshOrder}
            >
              <Icon name="add-shopping-cart" size={24} color="#003366" />
              <Text style={styles.modalButtonText}>Place Fresh Order</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() => {
                setOptionModalVisible(false);
                setSelectedCustomer(null);
                setTimeout(() => {
                  setOptionModalVisible(false);
                }, 200);
              }}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Search Product Modal */}
      <SearchProductModal_1
        isVisible={showSearchModal}
        onClose={() => setShowSearchModal(false)}
        onAddProduct={(product) => {
          handleAddProduct(product);
          setShowSearchModal(false);
        }}
        currentCustomerId={selectedCustomer?.cust_id}
        closeOnAdd={true}
        allowProductEdit={allowProductEdit}
      />

      {/* Edit Cart Modal */}
      <Modal
        visible={editCartModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setEditCartModalVisible(false)}
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' }}>
          <View style={{ backgroundColor: '#fff', borderRadius: 20, padding: 28, width: 320, alignItems: 'center', elevation: 8 }}>
            <Text style={{ fontSize: 20, fontWeight: 'bold', marginBottom: 18, color: '#003087', letterSpacing: 0.5 }}>Edit Price & Quantity</Text>
            <Text style={{ fontSize: 15, color: '#003087', alignSelf: 'flex-start', marginTop: 8, marginBottom: 2 }}>Price (₹):</Text>
            <TextInput
              style={{ width: '100%', borderWidth: 1, borderColor: '#003087', borderRadius: 10, padding: 10, fontSize: 17, marginBottom: 10, color: '#222', backgroundColor: '#f8faff' }}
              keyboardType="numeric"
              value={editCartPrice}
              onChangeText={setEditCartPrice}
              placeholder="Enter price"
              placeholderTextColor="#bbb"
            />
            <Text style={{ fontSize: 15, color: '#003087', alignSelf: 'flex-start', marginTop: 8, marginBottom: 2 }}>Quantity:</Text>
            <TextInput
              style={{ width: '100%', borderWidth: 1, borderColor: '#003087', borderRadius: 10, padding: 10, fontSize: 17, marginBottom: 10, color: '#222', backgroundColor: '#f8faff' }}
              keyboardType="numeric"
              value={editCartQty}
              onChangeText={setEditCartQty}
              placeholder="Enter quantity"
              placeholderTextColor="#bbb"
            />
            {editCartError && <Text style={{ color: '#d32f2f', textAlign: 'center', marginVertical: 10, fontSize: 14 }}>{editCartError}</Text>}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', width: '100%', marginTop: 20 }}>
              <TouchableOpacity
                style={{ flex: 1, padding: 14, borderRadius: 10, alignItems: 'center', marginHorizontal: 8, backgroundColor: '#003087', elevation: 2 }}
                onPress={handleConfirmEditCartProduct}
              >
                <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 16, letterSpacing: 0.5 }}>Save</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={{ flex: 1, padding: 14, borderRadius: 10, alignItems: 'center', marginHorizontal: 8, backgroundColor: '#bbb', elevation: 1 }}
                onPress={() => setEditCartModalVisible(false)}
              >
                <Text style={{ color: '#222', fontSize: 16 }}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { 
    flex: 1, 
    backgroundColor: '#f8f9fa' 
  },
  header: { 
    backgroundColor: '#003366', 
    padding: 20, 
    paddingTop: 40, 
    borderBottomLeftRadius: 20, 
    borderBottomRightRadius: 20, 
    elevation: 5 
  },
  headerText: { 
    fontSize: 22, 
    fontWeight: '700', 
    color: '#fff', 
    textAlign: 'center' 
  },
  listContainer: { 
    padding: 16 
  },
  userCard: { 
    backgroundColor: '#fff', 
    borderRadius: 12, 
    padding: 16, 
    marginBottom: 12, 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'space-between', 
    elevation: 2 
  },
  userInfo: { 
    flexDirection: 'row', 
    alignItems: 'center' 
  },
  userName: { 
    fontSize: 16, 
    fontWeight: '600', 
    color: '#003366' 
  },
  userId: { 
    fontSize: 12, 
    color: '#666', 
    marginLeft: 8 
  },
  centered: { 
    flex: 1, 
    justifyContent: 'center', 
    alignItems: 'center' 
  },
  errorText: { 
    color: '#dc3545', 
    fontSize: 16, 
    textAlign: 'center' 
  },
  modalOverlay: { 
    flex: 1, 
    backgroundColor: 'rgba(0,0,0,0.3)', 
    justifyContent: 'center', 
    alignItems: 'center' 
  },
  modalCard: { 
    backgroundColor: '#fff', 
    borderRadius: 16, 
    padding: 24, 
    width: 300, 
    alignItems: 'center', 
    elevation: 5 
  },
  modalTitle: { 
    fontSize: 18, 
    fontWeight: 'bold', 
    marginBottom: 20, 
    color: '#003366' 
  },
  modalButton: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: '#f0f4f8', 
    borderRadius: 8, 
    padding: 12, 
    marginVertical: 8, 
    width: '100%' 
  },
  modalButtonText: { 
    fontSize: 16, 
    color: '#003366', 
    marginLeft: 12 
  },
  cancelButton: { 
    marginTop: 16 
  },
  cancelButtonText: { 
    color: '#dc3545', 
    fontSize: 16, 
    fontWeight: '600' 
  },
  orderContainer: {
    flex: 1,
    padding: 16
  },
  customerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16
  },
  customerName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#003366'
  },
  changeCustomerButton: {
    padding: 8
  },
  changeCustomerText: {
    color: '#003366',
    fontSize: 14,
    fontWeight: '500'
  },
  productListHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16
  },
  productListTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333'
  },
  addProductButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#003366',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8
  },
  addProductText: {
    color: '#fff',
    marginLeft: 4
  },
  productList: {
    flex: 1
  },
  productCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    marginVertical: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  productInfo: {
    flex: 1,
    flexDirection: 'column',
  },
  productImageAndDetails: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  productImage: {
    width: 80,
    height: 80,
    borderRadius: 8,
    marginRight: 12,
  },
  noImageContainer: {
    width: 80,
    height: 80,
    borderRadius: 8,
    backgroundColor: '#F5F5F5',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  productDetails: {
    flex: 1,
  },
  productName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  productVolume: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  priceContainer: {
    marginTop: 4,
  },
  currentPrice: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#003366',
  },
  quantityContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    marginTop: 8,
  },
  quantityButton: {
    backgroundColor: '#003366',
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  quantityText: {
    fontSize: 16,
    fontWeight: '500',
    marginHorizontal: 16,
    minWidth: 24,
    textAlign: 'center',
  },
  removeButton: {
    padding: 8,
    marginLeft: 8,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center'
  },
  emptyStateText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginTop: 12
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: '#666',
    marginTop: 4
  },
  footer: {
    backgroundColor: '#fff',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#eee'
  },
  totalContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12
  },
  totalLabel: {
    fontSize: 16,
    color: '#666'
  },
  totalAmount: {
    fontSize: 20,
    fontWeight: '600',
    color: '#003366'
  },
  placeOrderButton: {
    backgroundColor: '#003366',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12
  },
  placeOrderButtonDisabled: {
    opacity: 0.7
  },
  placeOrderIcon: {
    marginRight: 8
  },
  placeOrderText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600'
  }
});

export default PlaceIndent;