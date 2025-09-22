import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, Modal, Alert, ScrollView, Image, TextInput, Linking, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { jwtDecode } from 'jwt-decode';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { ipAddress } from '../../services/urls.js';

import Toast from 'react-native-toast-message';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Picker } from '@react-native-picker/picker';
import { useFocusEffect } from '@react-navigation/native';
import { useNavigation } from '@react-navigation/native';
import { useFontScale } from '../../App';

const PlaceOrderAdmin = () => {
  const { getScaledSize } = useFontScale();
  const [assignedUsers, setAssignedUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [error, setError] = useState(null);
  const [loadingOrder, setLoadingOrder] = useState(false);
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [orderType, setOrderType] = useState('AM'); // Default order type
  const [totalAmount, setTotalAmount] = useState(0);
  const [customerSearchQuery, setCustomerSearchQuery] = useState('');
  const [filteredCustomers, setFilteredCustomers] = useState([]);
  const [selectedRoute, setSelectedRoute] = useState('ALL');
  const [availableRoutes, setAvailableRoutes] = useState([]);
  const navigation = useNavigation();





  // Extract unique routes whenever assignedUsers changes
  useEffect(() => {
    const routes = Array.from(new Set(assignedUsers.map(u => u.route).filter(Boolean)));
    setAvailableRoutes(routes);
  }, [assignedUsers]);

  // Filter customers based on search query and selected route
  useEffect(() => {
    let filtered = assignedUsers;
    if (selectedRoute !== 'ALL') {
      filtered = filtered.filter(customer => customer.route === selectedRoute);
    }
    if (customerSearchQuery.trim() !== '') {
      filtered = filtered.filter(customer =>
        customer.name.toLowerCase().includes(customerSearchQuery.toLowerCase()) ||
        customer.cust_id.toString().includes(customerSearchQuery)
      );
    }
    setFilteredCustomers(filtered);
  }, [customerSearchQuery, assignedUsers, selectedRoute]);

  // Move fetchAssignedUsers to a function
  const fetchAssignedUsers = useCallback(async () => {
    setLoadingUsers(true);
    setError(null);
    try {
      const token = await AsyncStorage.getItem('userAuthToken');
      if (!token) throw new Error('No auth token found');
      const decoded = jwtDecode(token);
      const adminId = decoded.id1;
      const response = await fetch(`http://${ipAddress}:8091/assigned-users/${adminId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        }
      });
      if (!response.ok) throw new Error('Failed to fetch assigned users');
      const responseData = await response.json();
      if (responseData.success) {
        setAssignedUsers(responseData.assignedUsers);
      } else {
        throw new Error(responseData.message || 'Failed to fetch assigned users');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoadingUsers(false);
    }
  }, [ipAddress]);

  // Use useFocusEffect to refresh data when page is focused
  useFocusEffect(
    useCallback(() => {
      fetchAssignedUsers();
    }, [fetchAssignedUsers])
  );

  // Handle phone call
  const handlePhoneCall = (phoneNumber) => {
    if (phoneNumber) {
      const phoneUrl = `tel:${phoneNumber}`;
      Linking.canOpenURL(phoneUrl).then(supported => {
        if (supported) {
          return Linking.openURL(phoneUrl);
        } else {
          Toast.show({
            type: 'error',
            text1: 'Error',
            text2: 'Cannot make phone calls on this device'
          });
        }
      }).catch(err => {
        Toast.show({
          type: 'error',
          text1: 'Error',
          text2: 'Failed to open phone app'
        });
      });
    } else {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'No phone number available'
      });
    }
  };





  // When a customer is selected, go directly to cart
  const handleSelectCustomer = async (item) => {
    navigation.navigate('AdminCartPage', { customer: item });
  };





  if (loadingUsers) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#003366" />
        <Text style={{ fontSize: getScaledSize(16) }}>Loading users...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
     

      <View style={styles.customerListContainer}>
          {/* Route Filter Dropdown */}
          <View style={styles.routeFilterContainer}>
            <Picker
              selectedValue={selectedRoute}
              onValueChange={setSelectedRoute}
              style={styles.routePicker}
              itemStyle={styles.routePickerItem}
              mode="dropdown"
            >
              <Picker.Item label="All Routes" value="ALL" />
              {availableRoutes.map(route => (
                <Picker.Item key={route} label={route} value={route} />
              ))}
            </Picker>
          </View>

          {/* Search Bar */}
          <View style={styles.searchContainer}>
            <View style={styles.searchInputContainer}>
              <Icon name="search" size={20} color="#666" style={styles.searchIcon} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search customers by name or ID..."
                placeholderTextColor="#999"
                value={customerSearchQuery}
                onChangeText={setCustomerSearchQuery}
                autoCapitalize="none"
                autoCorrect={false}
              />
              {customerSearchQuery.length > 0 && (
                <TouchableOpacity
                  style={styles.clearButton}
                  onPress={() => setCustomerSearchQuery('')}
                >
                  <Icon name="close" size={18} color="#666" />
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* Customer Count */}
          <View style={styles.customerCountContainer}>
            <Text style={[styles.customerCountText, { fontSize: getScaledSize(14) }]}>
              {filteredCustomers.length} of {assignedUsers.length} customers
            </Text>
          </View>

          <FlatList
            data={filteredCustomers}
            keyExtractor={(item, idx) => (item.customer_id ? item.customer_id.toString() : `user-${idx}`)}
            contentContainerStyle={styles.listContainer}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.userCard}
                onPress={() => handleSelectCustomer(item)}
                activeOpacity={0.85}
              >
                <View style={styles.userCardContentColumn}>
                  {/* Name and ID */}
                  <View style={styles.customerNameBlock}>
                    <Text style={[styles.userName, { fontSize: getScaledSize(17) }]}>{item.username}</Text>
                    <Text style={[styles.userId, { fontSize: getScaledSize(12) }]}>ID: {item.cust_id}</Text>
                  </View>
                  {/* Info Row */}
                  <View style={styles.infoRow}>
                    <View style={styles.infoSectionNew}>
                      <Text style={[styles.infoLabelNew, { fontSize: getScaledSize(11) }]}>Route</Text>
                      <Text style={[styles.infoValueNew, { fontSize: getScaledSize(14) }]}>{item.route || 'N/A'}</Text>
                    </View>
                    <View style={styles.infoSectionNew}>
                      <Text style={[styles.infoLabelNew, { fontSize: getScaledSize(11) }]}>Zip Code</Text>
                      <Text style={[styles.infoValueNew, { fontSize: getScaledSize(14) }]}>{item.zip_code || 'N/A'}</Text>
                    </View>
                    <View style={styles.infoSectionNew}>
                      <Text style={[styles.infoLabelNew, { fontSize: getScaledSize(11) }]}>Phone</Text>
                      <TouchableOpacity
                        style={styles.phoneIconButton}
                        onPress={() => handlePhoneCall(item.phone)}
                        activeOpacity={0.7}
                      >
                        <Icon name="phone" size={18} color="#fff" />
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
                <Icon name="chevron-right" size={24} color="#003366" style={styles.chevronIconNew} />
              </TouchableOpacity>
            )}
            ListEmptyComponent={() => (
              <View style={styles.emptySearchContainer}>
                <Icon name="search-off" size={48} color="#ccc" />
                <Text style={[styles.emptySearchText, { fontSize: getScaledSize(18) }]}>No customers found</Text>
                <Text style={[styles.emptySearchSubtext, { fontSize: getScaledSize(14) }]}>
                  Try adjusting your search terms
                </Text>
              </View>
            )}
          />
        </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { 
    flex: 1, 
    backgroundColor: '#f8f9fa' 
  },
 
  listContainer: { 
    padding: 16 
  },
  userCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    paddingVertical: 18,
    paddingHorizontal: 18,
    marginBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
  },
  userCardContentColumn: {
    flex: 1,
    flexDirection: 'column',
    justifyContent: 'center',
  },
  customerNameBlock: {
    marginBottom: 8,
  },
  userName: {
    fontWeight: '700',
    color: '#003366',
    marginBottom: 2,
  },
  userId: {
    color: '#666',
    fontWeight: '500',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 0,
  },
  infoSectionNew: {
    flex: 1,
    alignItems: 'center',
    marginRight: 0,
    minWidth: 0,
  },
  infoLabelNew: {
    color: '#888',
    fontWeight: '500',
    marginBottom: 1,
  },
  infoValueNew: {
    color: '#222',
    fontWeight: '600',
  },
  phoneContainerNew: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f8ff',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#003366',
    minWidth: 90,
  },
  phoneNumberNew: {
    fontSize: 14,
    color: '#003366',
    fontWeight: '600',
    marginLeft: 6,
  },
  chevronIconNew: {
    marginLeft: 10,
    alignSelf: 'center',
  },
  centered: { 
    flex: 1, 
    justifyContent: 'center', 
    alignItems: 'center' 
  },
  errorText: { 
    color: '#dc3545', 
    textAlign: 'center' 
  },

  customerListContainer: {
    flex: 1
  },
  searchContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee'
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#e9ecef'
  },
  searchIcon: {
    marginRight: 8
  },
  searchInput: {
    flex: 1,
    paddingVertical: 12,
    color: '#333'
  },
  clearButton: {
    padding: 4,
    marginLeft: 8
  },
  customerCountContainer: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#f8f9fa'
  },
  customerCountText: {
    color: '#666',
    fontStyle: 'italic'
  },
  emptySearchContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40
  },
  emptySearchText: {
    fontWeight: '600',
    color: '#333',
    marginTop: 12
  },
  emptySearchSubtext: {
    color: '#666',
    marginTop: 4
  },
  routeFilterContainer: {
    width: '100%',
    alignItems: 'flex-start',
    paddingTop: 10,
    paddingBottom: Platform.OS === 'ios' ? 0 : 2,
    backgroundColor: '#fff',
  },
  routePicker: {
    width: 180,
    maxWidth: 220,
    minWidth: 120,
    backgroundColor: '#f8f9fa',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    color: '#003366',
    marginLeft: 4,
    marginBottom: 2,
  },
  routePickerItem: {
    color: '#003366',
  },
  phoneIconButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#003366', // deep blue for call
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.10,
    shadowRadius: 2,
  },
});

export default PlaceOrderAdmin;