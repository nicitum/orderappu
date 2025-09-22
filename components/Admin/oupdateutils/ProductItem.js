import React from 'react';
import { 
  View, 
  Text, 
  TouchableOpacity, 
  ActivityIndicator,
  Image
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { formatCurrency } from './constants';
import styles from './styles';
import { ipAddress } from '../../../services/urls';

const ProductItem = ({ 
  item, 
  index, 
  allProducts, 
  deleteLoading, 
  deleteLoadingIndex, 
  isOrderEditable, 
  allowProductEdit,
  selectedOrder,
  getScaledSize,
  onEditProduct,
  onDeleteProduct
}) => {
  const prodMeta = allProducts.find(p => p.id === item.product_id || p.id === item.id);
  const imageName = item.image || prodMeta?.image;
  const imageUri = imageName ? `http://${ipAddress}:8091/images/products/${imageName}` : null;
  const itemTotal = (item.price || 0) * (item.quantity || 1);

  const canEditThisOrder = isOrderEditable && allowProductEdit;
  const isOrderRestricted = selectedOrder && (selectedOrder.approve_status === 'Accepted' || selectedOrder.approve_status === 'Rejected' || selectedOrder.approve_status === 'Altered');

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
          <Text style={[styles.productName, isOrderRestricted && styles.restrictedProductText, { fontSize: getScaledSize(16) }]} numberOfLines={2}>{item.name}</Text>
          <Text style={[styles.productPrice, isOrderRestricted && styles.restrictedProductText, { fontSize: getScaledSize(14) }]}>{formatCurrency(item.price || 0)} x {item.quantity || 1} = {formatCurrency(itemTotal)}</Text>
          {item.category && <Text style={[styles.productCategory, isOrderRestricted && styles.restrictedProductText, { fontSize: getScaledSize(12) }]}>{item.category}</Text>}
          <TouchableOpacity 
            style={[styles.editButton, (!canEditThisOrder || isOrderRestricted) && styles.disabledEditButton]}
            onPress={() => onEditProduct(item)}
            disabled={!canEditThisOrder || isOrderRestricted}
          >
            <Icon name="edit" size={16} color={canEditThisOrder && !isOrderRestricted ? '#003366' : '#9CA3AF'} />
            <Text style={[styles.editButtonText, (!canEditThisOrder || isOrderRestricted) && styles.disabledEditButtonText, { fontSize: getScaledSize(12) }]}>Edit</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.productActions}>
          <TouchableOpacity
            style={[
              styles.deleteButton,
              (!isOrderEditable || isOrderRestricted) && styles.disabledDeleteButton
            ]}
            onPress={() => onDeleteProduct(index)}
            disabled={deleteLoading || !isOrderEditable || isOrderRestricted}
          >
            {deleteLoading && deleteLoadingIndex === index ? (
              <ActivityIndicator size="small" color="#DC2626" />
            ) : (
              <Icon
                name="delete"
                size={20}
                color={(!isOrderEditable || isOrderRestricted) ? '#9CA3AF' : '#DC2626'}
              />
            )}
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

export default ProductItem;