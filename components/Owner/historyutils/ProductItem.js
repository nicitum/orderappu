import React from "react";
import { View, Text, Image } from "react-native";
import MaterialIcons from "react-native-vector-icons/MaterialIcons";
import { detailStyles } from './styles';

const ProductItem = ({ 
  product, 
  prodData, 
  orderId, 
  index, 
  getScaledSize,
  ipAddress
}) => {
  const imageUrl = prodData && prodData.image ? `http://${ipAddress}:8091/images/products/${prodData.image}` : null;
  
  return (
    <View key={`${orderId}-${product.product_id}-${index}`} style={detailStyles.productRow}>
      <View style={detailStyles.imageColumn}>
        <View style={detailStyles.productImageBox}>
          {imageUrl ? (
            <Image
              source={{ uri: imageUrl }}
              style={detailStyles.productImage}
              resizeMode="contain"
              onError={(e) => console.log('Order item image load error:', e.nativeEvent.error, prodData?.image)}
            />
          ) : (
            <View style={detailStyles.productImagePlaceholder}>
              <MaterialIcons name="image-not-supported" size={24} color="#9E9E9E" />
            </View>
          )}
        </View>
      </View>
      <View style={detailStyles.productNameColumn}>
        <Text 
          style={[detailStyles.productNameText, { fontSize: getScaledSize(13) }]}
          numberOfLines={2}
          ellipsizeMode="tail"
        >
          {product.name || (prodData?.name || 'Product Name')}
        </Text>
      </View>
      <View style={detailStyles.qtyColumn}>
        <Text style={[detailStyles.qtyText, { fontSize: getScaledSize(13) }]}>{product.quantity}</Text>
      </View>
      <View style={detailStyles.priceColumn}>
        <Text style={[detailStyles.priceText, { fontSize: getScaledSize(13) }]}>₹{product.price}</Text>
      </View>
    </View>
  );
};

export default ProductItem;