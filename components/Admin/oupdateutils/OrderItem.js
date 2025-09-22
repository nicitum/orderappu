import React from 'react';
import { 
  TouchableOpacity, 
  View, 
  Text, 
  ActivityIndicator 
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { formatCurrency } from './constants';
import { 
  getApprovalStatusColor, 
  getApprovalStatusText 
} from './utils';
import styles from './styles';

const OrderItem = ({ 
  item, 
  selectedOrderId, 
  customerNames, 
  orderDeleteLoading, 
  orderDeleteLoadingId, 
  allowCancelOrder,
  getScaledSize,
  onSelectOrder,
  onCancelOrder
}) => {
  const handleOrderPress = () => {
    if (selectedOrderId === item.id) {
      onSelectOrder(null);
    } else {
      onSelectOrder(item.id);
    }
  };

  const handleCancelOrder = () => {
    onCancelOrder(item.id);
  };

  return (
    <TouchableOpacity
      style={[
        styles.orderCard,
        selectedOrderId === item.id && styles.selectedOrderCard
      ]}
      onPress={handleOrderPress}
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
                { color: getApprovalStatusColor(item.approve_status), fontSize: getScaledSize(10) }
              ]}>
                {getApprovalStatusText(item.approve_status)}
              </Text>
            )}
            {(!item.approve_status || item.approve_status === 'null' || item.approve_status === 'Null' || item.approve_status === 'NULL') && (
              <Text style={[styles.approvalStatusText, { color: '#F59E0B', fontSize: getScaledSize(10) }]}>
                PENDING
              </Text>
            )}
          </View>
        </View>
        <TouchableOpacity
          style={[
            styles.cancelOrderButton,
            (item.loading_slip === "Yes" || item.cancelled === "Yes" || item.approve_status === "Rejected" || !allowCancelOrder) && styles.disabledCancelButton
          ]}
          onPress={handleCancelOrder}
          disabled={
            orderDeleteLoading ||
            item.loading_slip === "Yes" ||
            item.cancelled === "Yes" ||
            item.approve_status === "Rejected" ||
            !allowCancelOrder
          }
        >
          {orderDeleteLoading && orderDeleteLoadingId === item.id ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Icon name="cancel" size={16} color="#FFFFFF" />
          )}
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
};

export default OrderItem;