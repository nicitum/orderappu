import { ipAddress } from '../../../services/urls';
import { LICENSE_NO } from '../../config'; // Import the license number
import AsyncStorage from '@react-native-async-storage/async-storage';
import { checkTokenAndRedirect } from '../../../services/auth';
import { jwtDecode } from 'jwt-decode';
import moment from 'moment';

export class CartAPI {
  // Fetch user permissions
  static async fetchUserPermissions(navigation) {
    try {
      const token = await checkTokenAndRedirect(navigation);
      if (!token) return { allowProductEdit: false };

      const response = await fetch(`http://${ipAddress}:8091/userDetails`, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        }
      });

      if (response.ok) {
        const data = await response.json();
        const user = data.user;
        return { allowProductEdit: user.allow_product_edit === 'Yes' };
      } else {
        return { allowProductEdit: false };
      }
    } catch (error) {
      console.error('Error fetching user details:', error);
      return { allowProductEdit: false };
    }
  }

  // Fetch client status for due date configuration
  static async fetchClientStatus() {
    try {
      console.log('Fetching client status...');
      const response = await fetch(`http://147.93.110.150:3001/api/client_status/${LICENSE_NO}`, {
        method: 'GET',
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      });

      console.log('Response status:', response.status);
      if (response.ok) {
        const responseData = await response.json();
        console.log('API Response data:', responseData);
        
        // Extract data from the nested structure
        const data = responseData.data && responseData.data[0];
        console.log('Extracted client data:', data);
        
        if (data) {
          // Update due date configuration based on API response
          const newDefaultDueOn = data.default_due_on || 1;
          const newMaxDueOn = data.max_due_on || 30;
          
          console.log('Setting defaultDueOn to:', newDefaultDueOn);
          console.log('Setting maxDueOn to:', newMaxDueOn);
          
          return {
            defaultDueOn: newDefaultDueOn,
            maxDueOn: newMaxDueOn
          };
        } else {
          console.log('No client data found in response');
          return { defaultDueOn: 1, maxDueOn: 30 };
        }
      } else {
        console.log('API response not ok:', response.status);
        return { defaultDueOn: 1, maxDueOn: 30 };
      }
    } catch (error) {
      console.error('Error fetching client status:', error);
      return { defaultDueOn: 1, maxDueOn: 30 };
    }
  }

  // Load products from API
  static async loadProducts(navigation) {
    try {
      const token = await checkTokenAndRedirect(navigation);
      if (!token) return { products: [], brands: ['All'], categories: ['All'] };

      const response = await fetch(`http://${ipAddress}:8091/products`, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        }
      });

      if (response.ok) {
        const data = await response.json();
        
        // Filter by enable_product - handle new backend values
        // "Mask" = don't display at all, "Inactive" = display but grayed out, "None" = display normally
        const enabledProducts = data.filter(p => p.enable_product !== "Mask");
        
        // Extract unique brands and categories from enabled products only
        const uniqueBrands = ['All', ...new Set(enabledProducts.map(p => p.brand))];
        const uniqueCategories = ['All', ...new Set(enabledProducts.map(p => p.category))];
        
        return {
          products: enabledProducts,
          brands: uniqueBrands,
          categories: uniqueCategories
        };
      } else {
        throw new Error('Failed to load products');
      }
    } catch (error) {
      console.error('Error loading products:', error);
      throw error;
    }
  }

  // Place order API call
  static async placeOrder(cartItems, selectedCustomer, selectedDueDate, navigation) {
    try {
      const token = await AsyncStorage.getItem('userAuthToken');
      if (!token) throw new Error('No auth token found');

      // Prepare products for API
      const productsPayload = cartItems.map((item) => ({
        product_id: item.product_id || item.id,
        quantity: item.quantity || 1,
        price: item.price,
        name: item.name,
        category: item.category || '',
        gst_rate: item.gst_rate || 0
      }));

      // Get order type
      const now = new Date();
      const hour = now.getHours();
      const orderType = hour < 12 ? 'AM' : 'PM';

      // Call /on-behalf-2 API for fresh orders
      const res = await fetch(`http://${ipAddress}:8091/on-behalf-2`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          customer_id: selectedCustomer.cust_id,
          order_type: orderType,
          products: productsPayload,
          entered_by: jwtDecode(token).username,
          due_on: moment(selectedDueDate).format('YYYY-MM-DD')
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to place custom order.');

      return { success: true, data };
    } catch (error) {
      console.error('Error placing order:', error);
      throw error;
    }
  }
}

// Product filtering helpers
export class ProductFilter {
  // Filter products by search term, brand, and category
  static filterProducts(products, searchTerm, brand, category) {
    let filtered = products;
    
    if (searchTerm) {
      filtered = filtered.filter(product =>
        product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        product.brand?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        product.category?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    
    if (brand && brand !== 'All') {
      filtered = filtered.filter(product => product.brand === brand);
    }
    
    if (category && category !== 'All') {
      filtered = filtered.filter(product => product.category === category);
    }
    
    return filtered;
  }
}