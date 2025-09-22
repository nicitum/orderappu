import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useFontScale } from '../../App';

/**
 * Reusable pagination component for React Native
 * 
 * @param {Object} props
 * @param {number} props.currentPage - Current active page
 * @param {number} props.totalPages - Total number of pages
 * @param {number} props.totalItems - Total number of items across all pages
 * @param {function} props.onPageChange - Callback function when page changes (receives new page number)
 * @param {string} props.itemsLabel - Label to show for items count (e.g., "Orders", "Products")
 * @param {Object} [props.style] - Optional container style overrides
 * @param {string} [props.primaryColor] - Optional primary color for buttons (defaults to #003366)
 */
const Pagination = ({
  currentPage,
  totalPages,
  totalItems,
  onPageChange,
  itemsLabel = 'Items',
  style = {},
  primaryColor = '#003366'
}) => {
  const { getScaledSize } = useFontScale();
  const handleNextPage = () => {
    if (currentPage < totalPages) {
      onPageChange(currentPage + 1);
    }
  };

  const handlePrevPage = () => {
    if (currentPage > 1) {
      onPageChange(currentPage - 1);
    }
  };

  // Dynamically update button styles based on primaryColor
  const buttonStyle = {
    ...styles.paginationButton,
    backgroundColor: primaryColor,
  };

  return (
    <View style={[styles.paginationContainer, style]}>
      <TouchableOpacity 
        onPress={handlePrevPage} 
        disabled={currentPage === 1}
        style={[
          buttonStyle,
          currentPage === 1 && styles.paginationButtonDisabled
        ]}
      >
        <Icon name="chevron-left" size={24} color="#fff" />
        <Text style={[styles.paginationButtonText, { fontSize: getScaledSize(14) }]}>Previous</Text>
      </TouchableOpacity>
      
      <View style={styles.paginationInfo}>
        <Text style={[styles.paginationText, { fontSize: getScaledSize(14) }]}>
          Page {currentPage} of {totalPages}
        </Text>
        <Text style={[styles.totalText, { fontSize: getScaledSize(12) }]}>
          Total {itemsLabel}: {totalItems}
        </Text>
      </View>

      <TouchableOpacity 
        onPress={handleNextPage}
        disabled={currentPage === totalPages}
        style={[
          buttonStyle,
          currentPage === totalPages && styles.paginationButtonDisabled
        ]}
      >
        <Text style={[styles.paginationButtonText, { fontSize: getScaledSize(14) }]}>Next</Text>
        <Icon name="chevron-right" size={24} color="#fff" />
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  paginationContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 15,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 3,
  },
  paginationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    minWidth: 100,
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  paginationButtonDisabled: {
    backgroundColor: '#E0E0E0',
  },
  paginationButtonText: {
    color: '#fff',
    fontWeight: '600',
    marginHorizontal: 4,
  },
  paginationInfo: {
    alignItems: 'center',
  },
  paginationText: {
    color: '#003366',
    fontWeight: '500',
  },
  totalText: {
    color: '#666',
    marginTop: 4,
  }
});

export default Pagination;