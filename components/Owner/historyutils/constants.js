// Color palette
export const COLORS = {
  primary: "#003366",
  primaryLight: "#004488",
  primaryDark: "#002244",
  secondary: "#10B981",
  accent: "#F59E0B",
  success: "#10B981",
  error: "#DC2626",
  warning: "#F59E0B",
  info: "#2196F3",
  background: "#f5f7fa",
  surface: "#FFFFFF",
  text: {
    primary: "#003366",
    secondary: "#666666",
    tertiary: "#9E9E9E",
    light: "#FFFFFF",
  },
  border: "#E5E7EB",
  divider: "#f0f0f0",
  card: {
    background: "#FFFFFF",
    shadow: "rgba(0, 0, 0, 0.1)",
  },
};

// Status colors
export const getStatusColor = (status) => {
  switch (status?.toLowerCase()) {
    case "delivered":
      return "#4CAF50";
    case "shipped":
      return "#2196F3";
    case "processing":
      return "#FF9800";
    case "cancelled":
      return "#F44336";
    case "out for delivery":
      return "#2196F3";
    case "objection":
      return "#F59E0B";
    default:
      return "#9E9E9E";
  }
};

export const getAcceptanceStatusColor = (status) => {
  switch (status?.toLowerCase()) {
    case 'approved': return '#10B981';
    case 'pending': return '#F59E0B';
    case 'rejected': return '#DC2626';
    default: return '#6B7280';
  }
};

export const getCancellationStatusColor = (cancelled) => {
  return cancelled === 'Yes' ? '#DC2626' : '#10B981';
};

export const getConsolidatedStatus = (order) => {
  if (order.cancelled === 'Yes') {
    return { text: 'CANCELLED', color: '#DC2626' };
  }
  switch (order.approve_status?.toLowerCase()) {
    case 'rejected':
      return { text: 'REJECTED', color: '#DC2626' };
    case 'accepted':
      return { text: 'ACCEPTED', color: '#10B981' };
    case 'pending':
    default:
      return { text: 'PENDING', color: '#F59E0B' };
  }
};