// Get acceptance status color
export const getAcceptanceStatusColor = (status) => {
  switch (status?.toLowerCase()) {
    case 'approved': return '#10B981';
    case 'pending': return '#F59E0B';
    case 'rejected': return '#DC2626';
    default: return '#6B7280';
  }
};

// Get cancellation status color
export const getCancellationStatusColor = (cancelled) => {
  return cancelled === 'Yes' ? '#DC2626' : '#10B981';
};

// Get acceptance status text
export const getAcceptanceStatusText = (status) => {
  if (!status) return 'PENDING';
  return status.toUpperCase();
};

// Get cancellation status text
export const getCancellationStatusText = (cancelled) => {
  return cancelled === 'Yes' ? 'CANCELLED' : 'ACTIVE';
};

// Get order status message for better UX
export const getOrderStatusMessage = (order) => {
  if (!order) return "Select an order to edit";
  if (order.cancelled === 'Yes') return "Order Cancelled";
  if (order.approve_status === 'Rejected') return "Order Rejected";
  if (order.loading_slip === "Yes") return "Order Processed";
  // Use actual backend status
  if (order.approve_status) return `Order ${order.approve_status}`;
  if (order.delivery_status) return `Order ${order.delivery_status}`;
  return "Update Order";
};

// Get order status color for visual feedback
export const getOrderStatusColor = (order) => {
  if (!order) return "#4B5563";
  if (order.cancelled === 'Yes' || order.approve_status === 'Rejected') return '#DC2626';
  if (order.loading_slip === "Yes") return '#059669';
  // Color based on actual status
  if (order.approve_status === 'Accepted' || order.approve_status === 'Approved' || order.delivery_status === 'Delivered') return '#059669';
  if (order.approve_status === 'Altered') return '#1E40AF'; // Deep blue for Altered
  if (order.delivery_status === 'Processing') return '#F59E0B';
  if (order.approve_status === 'Pending' || order.delivery_status === 'Pending') return '#F59E0B';
  return '#003366';
};

// Get single status text - Priority: Cancelled > Rejected > Pending
export const getOrderStatusText = (order) => {
  if (order.cancelled === 'Yes') return 'CANCELLED';
  if (order.approve_status === 'Rejected') return 'REJECTED';
  // Use actual backend status values
  if (order.approve_status) return order.approve_status.toUpperCase();
  if (order.delivery_status) return order.delivery_status.toUpperCase();
  return 'PENDING';
};

// Get appropriate icon for order status
export const getOrderStatusIcon = (order) => {
  if (order.cancelled === 'Yes') return 'cancel';
  if (order.approve_status === 'Rejected') return 'block';
  if (order.loading_slip === "Yes") return 'check-circle';
  // Icon based on actual status
  if (order.approve_status === 'Approved' || order.delivery_status === 'Delivered') return 'check-circle';
  if (order.approve_status === 'Altered' || order.delivery_status === 'Processing') return 'pending';
  if (order.approve_status === 'Pending' || order.delivery_status === 'Pending') return 'schedule';
  return 'info';
};

// Helper functions for approval status display
export const getApprovalStatusIcon = (approveStatus) => {
  if (!approveStatus || approveStatus === 'null' || approveStatus === 'Null' || approveStatus === 'NULL') return 'schedule';
  if (approveStatus === 'Accepted' || approveStatus === 'Approved') return 'check-circle';
  if (approveStatus === 'Rejected') return 'block';
  if (approveStatus === 'Altered') return 'edit';
  if (approveStatus === 'Pending' || approveStatus === 'pending' || approveStatus === 'Pendign') return 'schedule';
  return 'info';
};

export const getApprovalStatusColor = (approveStatus) => {
  if (!approveStatus || approveStatus === 'null' || approveStatus === 'Null' || approveStatus === 'NULL') return '#F59E0B';
  if (approveStatus === 'Accepted' || approveStatus === 'Approved') return '#059669';
  if (approveStatus === 'Rejected') return '#DC2626';
  if (approveStatus === 'Altered') return '#003366';
  if (approveStatus === 'Pending' || approveStatus === 'pending' || approveStatus === 'Pendign') return '#F59E0B';
  return '#4B5563';
};

export const getApprovalStatusText = (approveStatus) => {
  if (!approveStatus || approveStatus === 'null' || approveStatus === 'Null' || approveStatus === 'NULL') return 'PENDING';
  if (approveStatus === 'Accepted' || approveStatus === 'Approved') return 'ACCEPTED';
  if (approveStatus === 'Rejected') return 'REJECTED';
  if (approveStatus === 'Altered') return 'ALTERED';
  if (approveStatus === 'Pending' || approveStatus === 'pending' || approveStatus === 'Pendign') return 'PENDING';
  return 'UNKNOWN';
};

// Calculate total amount
export const calculateTotalAmount = (products) => {
  return products.reduce((sum, product) => {
    return sum + (product.quantity * product.price);
  }, 0);
};

// Check if order is editable
export const isOrderEditable = (selectedOrder) => {
  return selectedOrder && 
    selectedOrder.cancelled !== 'Yes' && 
    selectedOrder.approve_status !== 'Rejected' &&
    selectedOrder.approve_status !== 'Accepted' &&  // Don't allow editing if accepted
    selectedOrder.approve_status !== 'Altered' &&   // Don't allow editing if altered
    selectedOrder.loading_slip !== "Yes";
};

// Filter orders based on cancelled state
export const filterOrders = (orders, cancelledFilter) => {
  if (cancelledFilter === 'All') return orders;
  if (cancelledFilter === 'Yes') return orders.filter(order => order.cancelled === 'Yes');
  if (cancelledFilter === 'No') return orders.filter(order => order.cancelled !== 'Yes');
  return orders;
};