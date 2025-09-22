import React from "react";
import { View, Text, TouchableOpacity, Image } from "react-native";
import Ionicons from 'react-native-vector-icons/Ionicons';
import MaterialIcons from "react-native-vector-icons/MaterialIcons";
import { getConsolidatedStatus, getStatusColor, formatDateTime, formatDueDate } from './utils';

const OrderItem = ({ 
  order, 
  customerNames, 
  expandedOrderDetailsId, 
  handleOrderDetailsPress, 
  handleReorder,
  getScaledSize,
  ipAddress
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
    orderCustomer: {
        color: '#666',
        marginTop: 3,
    },
    orderDate: {
        color: '#666',
        marginTop: 3,
    },
    orderEnteredBy: {
        color: '#003366',
        fontWeight: 'bold',
        marginTop: 2,
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
        paddingBottom: 10,
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
        paddingBottom: 12,
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
          <Text style={[styles.orderCustomer, { fontSize: getScaledSize(13) }]}>
            {customerNames[order.customer_id] ? 
              customerNames[order.customer_id] : 
              `Loading... (ID: ${order.customer_id})`
            }
          </Text>
          <Text style={[styles.orderDate, { fontSize: getScaledSize(12) }]}>
            {formatDateTime(order.placed_on)}
          </Text>
          {order.entered_by && (
            <Text style={[styles.orderEnteredBy, { fontSize: getScaledSize(11) }]}>Entered By: {order.entered_by}</Text>
          )}
          {order.altered_by && (
            <Text style={[styles.orderEnteredBy, { fontSize: getScaledSize(11) }]}>Altered By: {order.altered_by}</Text>
          )}
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
        {/* Left side - Reorder Button */}
        <TouchableOpacity
          style={styles.reorderButton}
          onPress={() => handleReorder(order.id)}
          activeOpacity={0.7}
        >
          <MaterialIcons name="replay" size={16} color="#10B981" />
          <Text style={[styles.reorderButtonText, { fontSize: getScaledSize(12) }]}>Reorder</Text>
        </TouchableOpacity>

        {/* Right side - Details button */}
        <View style={styles.rightButtonsContainer}>
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