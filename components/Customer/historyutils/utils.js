import moment from 'moment';

// Get status color based on delivery status
export const getStatusColor = (status) => {
    switch (status?.toLowerCase()) {
        case "delivered":
            return "#4CAF50";
        case "out for delivery":
            return "#2196F3";
        case "processing":
            return "#FF9800";
        case "objection":
            return "#F44336";
        case "pending":
            return "#9E9E9E";
        default:
            return "#9E9E9E";
    }
};

// Get consolidated status for order
export const getConsolidatedStatus = (order) => {
  if (order.cancelled === 'Yes') {
    return { text: 'CANCELLED', color: '#DC2626' };
  }
  switch (order.approve_status?.toLowerCase()) {
    case 'rejected':
      return { text: 'REJECTED', color: '#DC2626' };
    case 'approved': // Covers 'approved' from backend
    case 'accepted': // Covers potential frontend states
      return { text: 'ACCEPTED', color: '#10B981' };
    case 'pending':
    default:
      return { text: 'PENDING', color: '#F59E0B' };
  }
};

// Filter orders based on selected filters
export const getFilteredOrders = (orders, selectedFilters) => {
  return orders.filter(order => {
    // Delivery filter
    if (selectedFilters.delivery !== 'All' && order.delivery_status !== selectedFilters.delivery) {
      return false;
    }
    
    // Cancelled filter
    if (selectedFilters.cancelled !== 'All') {
      const isCancelled = order.cancelled === 'Yes';
      if (selectedFilters.cancelled === 'Cancelled' && !isCancelled) {
        return false;
      }
      if (selectedFilters.cancelled === 'Active' && isCancelled) {
        return false;
      }
    }
    
    // Acceptance filter
    if (selectedFilters.acceptance !== 'All') {
      if (selectedFilters.acceptance === 'Accepted' && order.approve_status !== 'Accepted') {
        return false;
      }
      if (selectedFilters.acceptance === 'Rejected' && order.approve_status !== 'Rejected') {
        return false;
      }
      if (selectedFilters.acceptance === 'Pending' && order.approve_status !== 'Pending' && order.approve_status !== null && order.approve_status !== undefined) {
        return false;
      }
    }
    
    return true;
  });
};

// Get active filters count
export const getActiveFiltersCount = (selectedFilters) => {
  return Object.values(selectedFilters).filter(value => value !== 'All').length;
};

// Format date for display
export const formatDate = (date) => {
    return moment(date).format('MMM D, YYYY');
};

// Format date with time for display
export const formatDateTime = (timestamp) => {
    return moment.unix(timestamp).format('MMM D, YYYY [at] h:mm A');
};

// Format due date for display
export const formatDueDate = (timestamp) => {
    return moment.unix(timestamp).format('MMM D, YYYY');
};