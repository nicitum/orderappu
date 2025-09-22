import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import Ionicons from 'react-native-vector-icons/Ionicons';
import MaterialIcons from "react-native-vector-icons/MaterialIcons";
import { getConsolidatedStatus, getStatusColor, formatDateTime, formatDueDate } from './utils';

const OrderItem = ({ 
  order, 
  expandedOrderDetailsId, 
  handleOrderDetailsPress, 
  handleReorder,
  handleCancelOrder,
  getScaledSize
}) => {
  // Define the necessary styles directly in this component
  const styles = {
    orderCard: {
        backgroundColor: '#fff',
        borderRadius: 10,
        marginBottom: 15,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 2,
        overflow: 'hidden',
    },
    orderHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        padding: 15,
        borderBottomWidth: 1,
        borderBottomColor: '#f0f0f0',
    },
    orderId: {
        fontWeight: '600',
        color: '#003366',
    },
    orderDate: {
        color: '#666',
        marginTop: 3,
    },
    statusContainer: {
        alignItems: 'flex-end',
    },
    statusRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 2,
    },
    statusLabel: {
        color: '#666',
        marginRight: 4,
    },
    statusValue: {
        fontWeight: '600',
    },
    orderSummary: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 15,
    },
    orderTotal: {
        fontWeight: '700',
        color: '#003366',
    },
    deliveryStatusContainer: {
        alignItems: 'flex-end',
    },
    deliveryStatusLabel: {
        color: '#666',
        marginBottom: 2,
    },
    deliveryStatusValue: {
        fontWeight: '600',
    },
    deliveryDueDateLabel: {
        color: '#003366',
        marginTop: 6,
        fontWeight: '700',
    },
    orderFooter: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 15,
        paddingBottom: 15,
    },
    cancelButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FEF2F2',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#DC2626',
    },
    cancelButtonText: {
        color: '#DC2626',
        fontWeight: '600',
        marginLeft: 4,
    },
    reorderButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F0FDF4',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#10B981',
    },
    reorderButtonText: {
        color: '#10B981',
        fontWeight: '600',
        marginLeft: 4,
    },
    rightButtonsContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 16,
    },
    detailsButton: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    detailsButtonText: {
        color: '#003366',
        fontWeight: '600',
        marginRight: 5,
    },
  };

  return (
    <View key={order.id} style={styles.orderCard}>
      <View style={styles.orderHeader}>
        <View>
          <Text style={[styles.orderId, { fontSize: getScaledSize(16) }]}>Order #{order.id}</Text>
          <Text style={[styles.orderDate, { fontSize: getScaledSize(12) }]}>
            {formatDateTime(order.placed_on)}
          </Text>
        </View>
        <View style={styles.statusContainer}>
          {/* Consolidated Status */}
          <View style={styles.statusRow}>
            <Text style={[styles.statusLabel, { fontSize: getScaledSize(12) }]}>Status:</Text>
            <Text style={[styles.statusValue, { color: getConsolidatedStatus(order).color, fontSize: getScaledSize(12) }]}>
              {getConsolidatedStatus(order).text}
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.orderSummary}>
        <Text style={[styles.orderTotal, { fontSize: getScaledSize(18) }]}>₹{order.total_amount ?? order.amount ?? 0}</Text>
        <View style={styles.deliveryStatusContainer}>
          <Text style={[styles.deliveryStatusLabel, { fontSize: getScaledSize(12) }]}>Delivery:</Text>
          <Text style={[styles.deliveryStatusValue, { color: getStatusColor(order.delivery_status), fontSize: getScaledSize(12) }]}>
            {(order.delivery_status || 'pending').toUpperCase()}
          </Text>
          <Text style={[styles.deliveryDueDateLabel, { fontSize: getScaledSize(11) }]}>
            Delivery Due On: {formatDueDate(order.due_on)}
          </Text>
        </View>
      </View>

      <View style={styles.orderFooter}>
        {/* Left side - Cancel Button */}
        {order.cancelled !== 'Yes' && order.delivery_status !== 'delivered' && order.delivery_status !== 'shipped' && (
          <TouchableOpacity
            style={styles.cancelButton}
            onPress={() => handleCancelOrder(order)}
            activeOpacity={0.7}
          >
            <MaterialIcons name="cancel" size={16} color="#DC2626" />
            <Text style={[styles.cancelButtonText, { fontSize: getScaledSize(12) }]}>Cancel</Text>
          </TouchableOpacity>
        )}

        {/* Right side - Reorder and Details buttons */}
        <View style={styles.rightButtonsContainer}>
          <TouchableOpacity
            style={styles.reorderButton}
            onPress={() => handleReorder(order)}
            activeOpacity={0.7}
          >
            <MaterialIcons name="replay" size={16} color="#10B981" />
            <Text style={[styles.reorderButtonText, { fontSize: getScaledSize(12) }]}>Reorder</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            onPress={() => handleOrderDetailsPress(order.id)}
            style={styles.detailsButton}
            activeOpacity={0.7}
          >
            <Text style={[styles.detailsButtonText, { fontSize: getScaledSize(12) }]}>
              {expandedOrderDetailsId === order.id ? 'HIDE DETAILS' : 'VIEW DETAILS'}
            </Text>
            <Ionicons
              name={expandedOrderDetailsId === order.id ? 'chevron-up' : 'chevron-down'}
              size={16}
              color="#003366"
            />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

export default OrderItem;