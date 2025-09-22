// Colors used in the AdminOrderHistory component
export const COLORS = {
  primary: '#003366',
  secondary: '#10B981',
  background: '#f5f7fa',
  surface: '#FFFFFF',
  text: {
    primary: '#003366',
    secondary: '#666666',
    tertiary: '#9CA3AF',
    light: '#FFFFFF',
  },
  status: {
    delivered: '#4CAF50',
    outForDelivery: '#2196F3',
    processing: '#FF9800',
    objection: '#F44336',
    pending: '#9E9E9E',
    cancelled: '#DC2626',
    accepted: '#10B981',
    rejected: '#DC2626',
  },
  border: '#f0f0f0',
  shadow: '#000000',
};

// Status mappings
export const STATUS_MAPPINGS = {
  delivery: {
    'delivered': 'Delivered',
    'out for delivery': 'Out for Delivery',
    'processing': 'Processing',
    'objection': 'Objection',
    'pending': 'Pending'
  },
  acceptance: {
    'accepted': 'Accepted',
    'rejected': 'Rejected',
    'pending': 'Pending'
  },
  order: {
    'active': 'Active',
    'cancelled': 'Cancelled'
  }
};

// Default configuration
export const DEFAULT_CONFIG = {
  defaultDueOn: 1,
  maxDueOn: 30
};