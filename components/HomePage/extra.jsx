import React from 'react';
import { TouchableOpacity, Text, Alert } from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Repeat Order Button and Logic (moved from Home.jsx for reference)
export const RepeatOrderButton = ({ lastOrderDetails, lastOrderItems, navigation, styles, COLORS }) => {
  const handleRepeatOrder = async () => {
    if (!lastOrderDetails || !lastOrderItems || lastOrderItems.length === 0) {
      Alert.alert('Error', 'No items in the last order to repeat.');
      return;
    }
    try {
      const cartItems = {};
      lastOrderItems.forEach(item => {
        cartItems[item.product_id] = item.quantity;
      });
      await AsyncStorage.setItem('catalogueCart', JSON.stringify(cartItems));
      navigation.navigate('Cart');
    } catch (error) {
      console.error('Error preparing repeat order:', error);
      Alert.alert('Error', 'Failed to prepare repeat order');
    }
  };

  return (
    <TouchableOpacity
      style={styles.repeatOrderButton}
      onPress={handleRepeatOrder}
      disabled={!lastOrderItems || lastOrderItems.length === 0}
    >
      <MaterialIcons name="repeat" size={20} color={COLORS.text.light} />
      <Text style={styles.repeatOrderButtonText}>Repeat Recent Order</Text>
    </TouchableOpacity>
  );
};

// Styles for Repeat Order Button (for reference)
export const repeatOrderButtonStyles = {
  repeatOrderButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#003366',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 25,
    marginTop: 10,
    marginBottom: 16,
    alignSelf: 'center',
    shadowColor: '#003366',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 4,
  },
  repeatOrderButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
}; 