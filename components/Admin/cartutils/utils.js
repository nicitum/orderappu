// Format currency utility
export const formatCurrency = (amount) => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  }).format(amount);
};

// Get order type based on current time
export const getOrderType = () => {
  const now = new Date();
  const hour = now.getHours();
  return hour < 12 ? 'AM' : 'PM';
};

// Generate initial due date
export const generateInitialDueDate = (defaultDueOn = 1) => {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + defaultDueOn);
  return tomorrow;
};

// Calculate maximum selectable date for date picker
export const calculateMaxDate = (maxDueOn) => {
  console.log('Calculating maximumDate, maxDueOn =', maxDueOn);
  if (maxDueOn === 0) {
    console.log('maxDueOn is 0, returning today only');
    return new Date(); // Only today if max_due_on is 0
  }
  const maxDate = new Date();
  // If max_due_on is 2, we want: today + tomorrow = 2 days total
  // So we add (maxDueOn - 1) to get exactly maxDueOn days including today
  maxDate.setDate(maxDate.getDate() + (maxDueOn - 1));
  console.log('maxDueOn is', maxDueOn, ', setting max date to:', maxDate, '(allowing exactly', maxDueOn, 'days including today)');
  return maxDate;
};