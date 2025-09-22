import { Alert } from 'react-native';
import Toast from 'react-native-toast-message';

/**
 * Handle edit product
 */
export const handleEditProduct = (item, allProducts, setEditProduct, setEditPrice, setEditQty, setEditError, setEditModalVisible) => {
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

/**
 * Save edit product
 */
export const saveEditProduct = (editProduct, editPrice, editQty, setProducts, products, setEditModalVisible, setEditProduct, setEditPrice, setEditQty, setEditError, Toast) => {
  if (!editProduct) return;

  const newPrice = parseFloat(editPrice);
  const newQty = parseInt(editQty);
  const minPrice = editProduct.min_selling_price !== undefined ? editProduct.min_selling_price : 0;
  const maxPrice = editProduct.discountPrice !== undefined ? editProduct.discountPrice : (editProduct.price !== undefined ? editProduct.price : 0);

  if (isNaN(newPrice) || newPrice < minPrice || newPrice > maxPrice) {
      setEditError(`Price must be between ₹${minPrice} and ₹${maxPrice}`);
      return;
  }
  if (isNaN(newQty) || newQty <= 0) {
      setEditError('Please enter a valid quantity');
      return;
  }

  // Update local state only
  setProducts(prevProducts =>
      prevProducts.map(product =>
          product.product_id === editProduct.product_id
              ? { ...product, price: newPrice, quantity: newQty }
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
      text2: 'Press \"Update Order\" to save changes.',
  });
};

/**
 * Confirm cancel order
 */
export const confirmCancelOrder = (orderId, handleDeleteOrder) => {
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

/**
 * Get approval status color
 */
export const getApprovalStatusColor = (approveStatus, COLORS) => {
  if (!approveStatus || approveStatus === 'null' || approveStatus === 'Null' || approveStatus === 'NULL') return COLORS.warning;
  if (approveStatus === 'Accepted' || approveStatus === 'Approved') return COLORS.success;
  if (approveStatus === 'Rejected') return COLORS.error;
  if (approveStatus === 'Altered') return '#1E40AF'; // Deep blue for Altered
  if (approveStatus === 'Pending' || approveStatus === 'pending' || approveStatus === 'Pendign') return COLORS.accent;
  return COLORS.primary;
};

/**
 * Get approval status text
 */
export const getApprovalStatusText = (approveStatus) => {
  if (!approveStatus || approveStatus === 'null' || approveStatus === 'Null' || approveStatus === 'NULL') return 'PENDING';
  return approveStatus.toUpperCase();
};

/**
 * Get approval status icon
 */
export const getApprovalStatusIcon = (approveStatus) => {
  if (!approveStatus || approveStatus === 'null' || approveStatus === 'Null' || approveStatus === 'NULL') return 'schedule';
  if (approveStatus === 'Accepted' || approveStatus === 'Approved') return 'check-circle';
  if (approveStatus === 'Rejected') return 'block';
  if (approveStatus === 'Altered') return 'edit';
  if (approveStatus === 'Pending' || approveStatus === 'pending' || approveStatus === 'Pendign') return 'schedule';
  return 'info';
};

/**
 * Filter orders based on cancelled state
 */
export const filterOrders = (orders, cancelledFilter) => {
  return orders.filter(order => {
    if (cancelledFilter === 'All') return true;
    if (cancelledFilter === 'Yes') return order.cancelled === 'Yes';
    if (cancelledFilter === 'No') return order.cancelled !== 'Yes';
    return true;
  });
};

/**
 * Get customer name
 */
export const getCustomerName = async (customerId, customerNames, setCustomerNames, fetchCustomerName) => {
  if (customerNames[customerId]) {
    return customerNames[customerId];
  }
  
  const name = await fetchCustomerName(customerId);
  if (name) {
    setCustomerNames(prev => ({ ...prev, [customerId]: name }));
  }
  return name;
};