import { StyleSheet } from "react-native";

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f5f7fa',
    },
    header: {
        backgroundColor: '#003366',
        padding: 5,
        paddingBottom: 5,
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    headerLeft: {
      flex: 1,
    },
    headerRight: {
      alignItems: 'flex-end',
    },
    dateFilterButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
        paddingVertical: 6,
        paddingHorizontal: 8,
        borderRadius: 16,
        maxWidth: 120,
    },
    dateFilterText: {
        color: '#fff',
        marginLeft: 4,
        fontWeight: '500',
    },
    filterButton: {
      backgroundColor: "rgba(255, 255, 255, 0.2)",
      padding: 8,
      borderRadius: 20,
      position: 'relative',
    },
    filterBadge: {
      position: 'absolute',
      top: -5,
      right: -5,
      backgroundColor: '#DC2626',
      borderRadius: 10,
      width: 20,
      height: 20,
      justifyContent: 'center',
      alignItems: 'center',
    },
    filterBadgeText: {
      color: '#fff',
      fontWeight: '600',
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      justifyContent: 'flex-end',
    },
      filterModal: {
    backgroundColor: '#fff',
    borderRadius: 20,
    width: '95%',
    maxHeight: '85%',
    minHeight: 500,
  },
    filterModalHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: 20,
      borderBottomWidth: 1,
      borderBottomColor: '#E5E7EB',
    },
    filterModalTitle: {
      fontWeight: '600',
      color: '#003366',
    },
    closeButton: {
      padding: 5,
    },
      filterContent: {
    padding: 20,
    paddingBottom: 120,
    maxHeight: 400,
  },
    filterSection: {
      marginBottom: 25,
    },
    filterOptionsRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    filterSectionTitle: {
      fontWeight: '600',
      color: '#003366',
      marginBottom: 12,
    },
    filterOption: {
      paddingVertical: 10,
      paddingHorizontal: 14,
      borderRadius: 8,
      backgroundColor: '#F9FAFB',
      minWidth: 80,
      alignItems: 'center',
    },
    filterOptionSelected: {
      backgroundColor: '#003366',
    },
    filterOptionText: {
      color: '#374151',
    },
    filterOptionTextSelected: {
      color: '#fff',
      fontWeight: '600',
    },
      filterModalFooter: {
    flexDirection: 'row',
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    gap: 12,
    backgroundColor: '#fff',
  },
    clearFiltersButton: {
      flex: 1,
      paddingVertical: 12,
      paddingHorizontal: 16,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: '#DC2626',
      alignItems: 'center',
    },
    clearFiltersText: {
      color: '#DC2626',
      fontWeight: '600',
    },
    applyFiltersButton: {
      flex: 1,
      paddingVertical: 12,
      paddingHorizontal: 16,
      borderRadius: 8,
      backgroundColor: '#003366',
      alignItems: 'center',
    },
    applyFiltersText: {
      color: '#fff',
      fontWeight: '600',
    },

    loadingContainer: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: '#f5f7fa',
    },
    scrollContainer: {
        padding: 15,
        paddingBottom: 25,
    },
    emptyState: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 80,
    },
    emptyStateText: {
        marginTop: 15,
        color: '#003366',
        opacity: 0.7,
    },
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
    orderStatus: {
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
        color: '#fff',
        fontWeight: '600',
        alignSelf: 'flex-start',
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
    orderType: {
        color: '#666',
        fontStyle: 'italic',
    },
    orderFooter: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 15,
        paddingBottom: 12,
    },
    deliveryStatus: {
        color: '#666',
    },
    orderActions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    rightButtonsContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 16,
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
    detailsButton: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    detailsButtonText: {
        color: '#003366',
        fontWeight: '600',
        marginRight: 5,
    },

    // New styles for due date modal
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    dueDateModal: {
        backgroundColor: '#fff',
        borderRadius: 20,
        width: '90%',
        maxWidth: 400,
        elevation: 5,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
    },
    dueDateModalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 20,
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
    },
    dueDateModalTitle: {
        fontWeight: 'bold',
        color: '#003366',
    },
    closeDueDateButton: {
        padding: 5,
    },
    dueDateContent: {
        padding: 20,
    },
    dueDateLabel: {
        color: '#4B5563',
        marginBottom: 20,
        textAlign: 'center',
        lineHeight: 22,
    },
    datePickerButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#F3F4F6',
        paddingVertical: 16,
        paddingHorizontal: 20,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#E5E7EB',
        marginBottom: 16,
    },
    datePickerButtonText: {
        fontWeight: '600',
        color: '#111827',
        flex: 1,
        textAlign: 'center',
    },
    dueDateNote: {
        color: '#9CA3AF',
        textAlign: 'center',
        lineHeight: 20,
        fontStyle: 'italic',
    },
    dueDateModalFooter: {
        flexDirection: 'row',
        padding: 20,
        borderTopWidth: 1,
        borderTopColor: '#E5E7EB',
        gap: 12,
    },
    cancelDueDateButton: {
        flex: 1,
        paddingVertical: 14,
        paddingHorizontal: 16,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#E5E7EB',
        alignItems: 'center',
        backgroundColor: '#fff',
    },
    cancelDueDateButtonText: {
        color: '#4B5563',
        fontWeight: '600',
    },
    confirmDueDateButton: {
        flex: 1,
        paddingVertical: 14,
        paddingHorizontal: 16,
        borderRadius: 12,
        backgroundColor: '#003366',
        alignItems: 'center',
    },
    confirmDueDateButtonText: {
        color: '#fff',
        fontWeight: '600',
    },
});

const detailStyles = StyleSheet.create({
    orderDetailsContainer: {
        backgroundColor: '#f9fafc',
        padding: 15,
        borderTopWidth: 1,
        borderTopColor: '#f0f0f0',
    },
    orderDetailsTitle: {
        fontWeight: '600',
        color: '#003366',
        marginBottom: 15,
    },
    headerRow: {
        flexDirection: 'row',
        paddingBottom: 12,
        marginBottom: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#e0e0e0',
        alignItems: 'center',
    },
    headerCell: {
        fontWeight: '600',
        color: '#003366',
        textAlign: 'left',
    },
    imageHeader: {
        width: 56,
        alignItems: 'center',
    },
    productNameHeader: {
        flex: 2,
        paddingHorizontal: 8,
    },
    qtyHeader: {
        width: 60,
        alignItems: 'center',
    },
    priceHeader: {
        width: 80,
        alignItems: 'flex-end',
    },
    productRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#f0f0f0',
        minHeight: 60,
    },
    imageColumn: {
        width: 56,
        alignItems: 'center',
    },
    productNameColumn: {
        flex: 2,
        paddingHorizontal: 8,
        justifyContent: 'center',
    },
    qtyColumn: {
        width: 60,
        alignItems: 'center',
    },
    priceColumn: {
        width: 80,
        alignItems: 'flex-end',
    },
    productImageBox: { 
        width: 44, 
        height: 44, 
        borderRadius: 8, 
        backgroundColor: '#F5F5F5', 
        justifyContent: 'center', 
        alignItems: 'center', 
        overflow: 'hidden' 
    },
    productImage: { 
        width: 40, 
        height: 40, 
        borderRadius: 6 
    },
    productImagePlaceholder: { 
        width: 40, 
        height: 40, 
        borderRadius: 6, 
        backgroundColor: '#e0e0e0', 
        justifyContent: 'center', 
        alignItems: 'center' 
    },
    productNameText: {
        color: '#333',
        fontWeight: '500',
        lineHeight: 18,
    },
    qtyText: {
        color: '#555',
        fontWeight: '500',
    },
    priceText: {
        color: '#003366',
        fontWeight: '600',
    },
    noProductsText: {
        color: '#777',
        textAlign: 'center',
        marginTop: 10,
    }
});

export default styles;
export { detailStyles };