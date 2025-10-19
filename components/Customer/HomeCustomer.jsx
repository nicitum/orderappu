import AsyncStorage from "@react-native-async-storage/async-storage"
import { useState, useCallback, useEffect, useRef } from "react"
import {
  BackHandler,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ScrollView,
  ActivityIndicator,
  Modal,
  TextInput,
  StatusBar,
  Image,
  Dimensions,
  SafeAreaView,
  RefreshControl,
  Platform,
  Animated,
  FlatList,
} from "react-native"
import MaterialIcons from "react-native-vector-icons/MaterialIcons"
import { ipAddress } from '../../services/urls';
import { LICENSE_NO } from '../config'; // Import the license number
import { useNavigation, useFocusEffect } from "@react-navigation/native"
import { checkTokenAndRedirect } from "../../services/auth"
import { jwtDecode } from "jwt-decode"
import { Linking } from "react-native"
import { useFontScale } from '../../App';

// Modern Color Palette
const COLORS = {
  primary: "#003366", // Deep Blue
  primaryLight: "#004488", // Lighter Blue
  primaryDark: "#002244", // Darker Blue
  secondary: "#10B981", // Emerald
  accent: "#F59E0B", // Amber
  success: "#059669", // Green
  error: "#DC2626", // Red
  warning: "#D97706", // Yellow
  background: "#F3F4F6", // Light Gray
  surface: "#FFFFFF", // White
  text: {
    primary: "#111827", // Almost Black
    secondary: "#4B5563", // Gray
    tertiary: "#9CA3AF", // Light Gray
    light: "#FFFFFF", // White
  },
  border: "#E5E7EB",
  divider: "#F3F4F6",
  card: {
    background: "#FFFFFF",
    shadow: "rgba(0, 0, 0, 0.1)",
  },
}

// Format currency
const formatCurrency = (amount) => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  }).format(amount);
}

// Format date
const formatDate = (epochTime) => {
  if (!epochTime) return "N/A"
  const date = new Date(epochTime * 1000)
  return date.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  })
}

const HomeCustomer = () => {
  const { getScaledSize } = useFontScale();
  const [isLoading, setIsLoading] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [userDetails, setUserDetails] = useState(null)
  const [lastOrderDetails, setLastOrderDetails] = useState(null)
  const [lastOrderItems, setLastOrderItems] = useState([])
  const [allProductsData, setAllProductsData] = useState([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [scrollY] = useState(new Animated.Value(0));
  const navigation = useNavigation();
  const [randomProducts, setRandomProducts] = useState([]);
  const [advertisements, setAdvertisements] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [advTimer, setAdvTimer] = useState(null);
  const scrollX = useRef(new Animated.Value(0)).current;
  const scrollViewRef = useRef(null);
  const { width: viewportWidth } = Dimensions.get('window');
  const ITEM_WIDTH = viewportWidth - 32; // 16 padding on each side
  const CAROUSEL_INTERVAL = advTimer * 1000; // Convert seconds to milliseconds

  useEffect(() => {
    if (allProductsData && allProductsData.length > 0) {
      const shuffled = [...allProductsData].sort(() => 0.5 - Math.random());
      const selectedProducts = shuffled.slice(0, 4);
      const mappedRandomProducts = selectedProducts.map(product => ({
        ...product,
        image: product.image || '' // Ensure image is set from product.image
      }));
      setRandomProducts(mappedRandomProducts);
    } else {
      setRandomProducts([]);
    }
  }, [allProductsData]);

  // Fetch client status for adv_timer - Highest priority
  const fetchClientStatus = async () => {
    try {
      console.log('Fetching client status...'); // Debug log
      const response = await fetch(`http://147.93.110.150:3001/api/client_status/${LICENSE_NO}`, {
        method: 'GET',
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      });
      const data = await response.json();
      console.log('Raw API Response:', data); // Log raw response
      
      if (data.success && data.data && data.data.length > 0) {
        const advTimerValue = parseInt(data.data[0].adv_timer);
        console.log('Parsed adv_timer value:', advTimerValue); // Log parsed value
        
        if (!isNaN(advTimerValue) && advTimerValue > 0) {
          console.log('Setting timer to:', advTimerValue, 'seconds');
          setAdvTimer(advTimerValue);
        } else {
          console.error('Invalid adv_timer value received:', data.data[0].adv_timer);
        }
      } else {
        console.error('Invalid API response structure:', data);
      }
    } catch (error) {
      console.error('Error fetching client status:', error);
    }
  };

  // Call API immediately on mount
  useEffect(() => {
    fetchClientStatus();
  }, []);

  // Call API when returning to this screen
  useFocusEffect(
    useCallback(() => {
      console.log('Screen focused - refreshing timer');
      fetchClientStatus();
    }, [])
  );

  // Auto-scroll carousel - only start when we have a valid timer
  useEffect(() => {
    if (advertisements.length <= 1 || !advTimer) return; // Don't start if no timer
    
    console.log('Starting carousel with interval:', advTimer, 'seconds');
    
    const timer = setInterval(() => {
      const nextIndex = (currentIndex + 1) % advertisements.length;
      scrollViewRef.current?.scrollTo({ x: nextIndex * ITEM_WIDTH, animated: true });
      setCurrentIndex(nextIndex);
    }, advTimer * 1000);
    
    return () => {
      console.log('Clearing carousel interval');
      clearInterval(timer);
    };
  }, [currentIndex, advertisements.length, ITEM_WIDTH, advTimer]);

  const checkUserRole = async () => {
    setIsLoading(true)
    const userAuthToken = await AsyncStorage.getItem("userAuthToken")
    if (userAuthToken) {
      try {
        const decodedToken = jwtDecode(userAuthToken)
        setIsAdmin(decodedToken.role === "admin")
      } catch (error) {
        console.error("Token verification error:", error)
        setIsAdmin(false)
      }
    } else {
      setIsAdmin(false)
    }
    setIsLoading(false)
  }

  // Back button handler
  const handleBackButton = useCallback(() => {
    Alert.alert(
      "Exit App",
      "Do you want to exit?",
      [
        { text: "Cancel", onPress: () => null, style: "cancel" },
        { text: "Exit", onPress: () => BackHandler.exitApp() },
      ],
      { cancelable: false },
    )
    return true
  }, [])

  // Main function to fetch all necessary data
  const userDetailsData1 = useCallback(async () => {
    try {
      const token = await checkTokenAndRedirect(navigation)
      if (!token) {
        setIsLoading(false); // Set loading to false if no token
        return null; // Return null to indicate failure or no data
      }

      // Fetch data concurrently
      
      const [
        allProductsResponse,
        userResponse,
        recentOrderResponse,
      ] = await Promise.all([
        fetch(`http://${ipAddress}:8091/products`, { headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", } }),
        fetch(`http://${ipAddress}:8091/userDetails`, { method: "GET", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` } }),
        fetch(`http://${ipAddress}:8091/most-recent-order?customerId=${jwtDecode(token).id}`, { headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", } }),
      ]);

      // Process API responses
      const productsData = allProductsResponse.ok ? await allProductsResponse.json() : [];
      setAllProductsData(productsData); // Always set products data, even if empty on error

      const userGetResponse = userResponse.ok ? await userResponse.json() : null;
      const orderData = recentOrderResponse.ok ? await recentOrderResponse.json() : null;

      let userDetails = null;
      if (userGetResponse && userGetResponse.status) {
         userDetails = {
          customerName: userGetResponse.user.name,
          customerID: userGetResponse.user.customer_id,
          route: userGetResponse.user.route,
        };
        setUserDetails(userDetails);
      } else if (userGetResponse) {
         console.warn("Failed to fetch user details:", userGetResponse.message || "Unknown error");
         // Continue without showing alert - app should still function
      } else {
         console.error("Failed to fetch user details: No response");
         // Continue without showing alert - app should still function
      }

      let lastIndentDate = "", totalAmount = 0, orderType = "AM", items = []
      if (orderData && orderData.order) {
          lastIndentDate = orderData.order.placed_on || "";
          totalAmount = orderData.order.total_amount || 0;
          orderType = orderData.order.order_type || "AM";
          
          // Fetch order products - This still needs the order ID from the recent order response, so it's sequential
          const orderProductsResponse = await fetch(`http://${ipAddress}:8091/order-products?orderId=${orderData.order.id}`, {
              headers: {
                  Authorization: `Bearer ${token}`,
                  "Content-Type": "application/json",
              },
          });
          
          if (orderProductsResponse.ok) {
            items = await orderProductsResponse.json() || [];
            const mappedOrderItems = items.map(orderItem => {
              const productDetails = productsData.find(p => p.id === orderItem.product_id) || {};
              return {
                name: orderItem.name || productDetails.name || 'Product Name Not Found',
                price: (orderItem.price !== undefined && parseFloat(orderItem.price) > 0) 
                  ? parseFloat(orderItem.price) 
                  : (productDetails.price || 0),
                quantity: orderItem.quantity || 0,
                product_id: orderItem.product_id,
                image: orderItem.image || productDetails.image || '',
              };
            });
            items = mappedOrderItems;
          } else {
            console.warn('Failed to fetch order products:', orderProductsResponse.status);
          }
      }

      return { userDetails, latestOrder: { lastIndentDate, totalAmount, orderType, items } }
    } catch (err) {
      console.error("User details fetch error:", err)
      setIsLoading(false)
      // Log error but don't show alert - app should continue functioning
      return null;
    }
  }, [navigation])

  // Fetch data and update state
  const fetchData = useCallback(async () => {
    setIsLoading(true)
    const userDetailsData = await userDetailsData1()
    if (userDetailsData) {
      setUserDetails(userDetailsData.userDetails);
      if (userDetailsData.latestOrder) {
        setLastOrderDetails(userDetailsData.latestOrder);
        setLastOrderItems(userDetailsData.latestOrder.items || []);
      }
    }
    setIsLoading(false)
  }, [userDetailsData1]) // userDetailsData1 is now the main fetch logic

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    await fetchData()
    setRefreshing(false)
  }, [fetchData])

  // Fetch advertisements
  const fetchAdvertisements = useCallback(async () => {
    try {
      const token = await AsyncStorage.getItem("userAuthToken");
      if (!token) return;
      
      const response = await fetch(`http://${ipAddress}:8091/advertisement-crud`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          operation: 'read'
        })
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.data) {
          // Filter out ads without images and only show active ones
          const validAds = data.data.filter(ad => ad.image && ad.status === 'active');
          setAdvertisements(validAds);
          
          // Log image size recommendation
          if (validAds.length > 0) {
            console.log('Recommended image size for advertisements: 800x450px (16:9 aspect ratio)');
            console.log('This will ensure the best quality and proper display on all devices');
          }
        }
      }
    } catch (error) {
      console.error('Error fetching advertisements:', error);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      const fetchDataAsync = async () => {
        await fetchData();
        await fetchAdvertisements();
      };
      fetchDataAsync(); // Fetch all necessary data when screen is focused
      checkUserRole();
      const backHandler = BackHandler.addEventListener("hardwareBackPress", handleBackButton);
      return () => backHandler.remove();
    }, [fetchData, handleBackButton, fetchAdvertisements])
  );

  const { customerName } = userDetails || {}
  const { lastIndentDate, totalAmount, orderType: lastOrderType } = lastOrderDetails || {}; 
  const totalQuantity = lastOrderItems?.reduce((total, item) => total + (parseInt(item.quantity) || 0), 0) || 0;

  const headerHeight = scrollY.interpolate({
    inputRange: [0, 100],
    outputRange: [80, 56],
    extrapolate: 'clamp'
  })

  // Handle scroll event
  const onScroll = Animated.event(
    [{ nativeEvent: { contentOffset: { x: scrollX } } }],
    { useNativeDriver: false }
  );

  // Handle scroll end
  const onScrollEnd = (e) => {
    const offsetX = e.nativeEvent.contentOffset.x;
    const newIndex = Math.round(offsetX / ITEM_WIDTH);
    setCurrentIndex(newIndex);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar backgroundColor={COLORS.primary} barStyle="light-content" />
      <View style={[styles.simpleHeaderContainer, Platform.OS === 'android' ? { paddingTop: StatusBar.currentHeight || 24 } : {}]}>
        <Image source={require("../../assets/logo.jpg")} style={styles.simpleHeaderLogo} resizeMode="contain" />
        <View style={styles.simpleHeaderTextContainer}>
          <Text style={[styles.simpleHeaderMainTitle, { fontSize: getScaledSize(16) }]}>Customer Dashboard</Text>
          <Text style={[styles.simpleHeaderUserName, { fontSize: getScaledSize(13) }]}>{customerName || "User"}</Text>
        </View>
        <TouchableOpacity style={styles.refreshButton} onPress={onRefresh}>
          <MaterialIcons name="refresh" size={24} color={COLORS.text.light} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.contentContainer}
        refreshControl={
          <RefreshControl 
            refreshing={refreshing} 
            onRefresh={onRefresh} 
            colors={[COLORS.primary]}
            progressBackgroundColor={COLORS.surface}
          />
        }
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: false }
        )}
        scrollEventThrottle={16}
        bounces={false}
      >
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={COLORS.primary} />
            <Text style={[styles.loadingText, { fontSize: getScaledSize(16) }]}>Loading your dashboard...</Text>
          </View>
        ) : (
          <View style={styles.content}>
            {/* Advertisements Carousel */}
            {advertisements.length > 0 && (
              <View style={styles.section}>
                
                <View style={styles.carouselContainer}>
                  <Animated.ScrollView
                    ref={scrollViewRef}
                    horizontal
                    pagingEnabled
                    showsHorizontalScrollIndicator={false}
                    onScroll={onScroll}
                    onMomentumScrollEnd={onScrollEnd}
                    scrollEventThrottle={16}
                    contentContainerStyle={styles.scrollViewContent}
                  >
                    {advertisements.map((item, index) => (
                      <View key={index} style={[styles.carouselItem, { width: ITEM_WIDTH }]}>
                        <Image 
                          source={{ uri: `http://${ipAddress}:8091/images/advertisements/${item.image}` }}
                          style={styles.carouselImage}
                          resizeMode="cover"
                          onError={(e) => console.warn('Error loading ad image:', e.nativeEvent.error)}
                        />
                      </View>
                    ))}
                  </Animated.ScrollView>
                 
                </View>
              </View>
            )}

            {/* Order History Section */}
            {!isAdmin && (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Text style={[styles.sectionTitle, { fontSize: getScaledSize(18) }]}>Order History</Text>
                  <TouchableOpacity 
                    style={styles.viewAllButton}
                    onPress={() => navigation.navigate("OrdersHistory")}
                  >
                    <Text style={[styles.viewAllText, { fontSize: getScaledSize(14) }]}>View All</Text>
                    <MaterialIcons name="chevron-right" size={20} color={COLORS.primary} />
                  </TouchableOpacity>
                </View>
                {lastOrderDetails ? (
                  <View style={styles.orderCard}>
                    <View style={styles.orderHeader}>
                      
                      <Text style={[styles.orderDate, { fontSize: getScaledSize(14) }]}>{formatDate(lastIndentDate)}</Text>
                    </View>
                    <View style={styles.orderBody}>
                      <View style={styles.orderSummary}>
                        <View style={styles.orderInfo}>
                          <Text style={[styles.orderInfoLabel, { fontSize: getScaledSize(14) }]}>Total Items</Text>
                          <Text style={[styles.orderInfoValue, { fontSize: getScaledSize(14) }]}>{totalQuantity}</Text>
                        </View>
                        <View style={styles.orderInfo}>
                          <Text style={[styles.orderInfoLabel, { fontSize: getScaledSize(14) }]}>Total Amount</Text>
                          <Text style={[styles.orderInfoValue, { fontSize: getScaledSize(14) }]}>{formatCurrency(totalAmount || 0)}</Text>
                        </View>
                      </View>
                      {lastOrderItems && lastOrderItems.length > 0 && (
                        <View style={styles.orderItems}>
                          <Text style={[styles.orderItemsTitle, { fontSize: getScaledSize(14) }]}>Order Details</Text>
                          {lastOrderItems.map((item, index) => (
                            <View key={index} style={styles.orderItem}>
                              {item.image ? (
                                <Image 
                                  source={{ uri: `http://${ipAddress}:8091/images/products/${item.image}` }} 
                                  style={styles.orderItemImage} 
                                  resizeMode="cover" 
                                  onError={(e) => console.warn('Image load error:', item.image, e.nativeEvent.error)}
                                />
                              ) : (
                                <View style={styles.orderItemImagePlaceholder}>
                                  <MaterialIcons name="image-not-supported" size={24} color={COLORS.text.secondary} />
                                </View>
                              )}
                              <View style={styles.itemInfo}>
                                <Text style={[styles.itemName, { fontSize: getScaledSize(14) }]} numberOfLines={2}>{item.name || 'Product Name'}</Text>
                                <View style={styles.itemDetails}>
                                  <Text style={[styles.itemQuantity, { fontSize: getScaledSize(12) }]}>Qty: {item.quantity}</Text>
                                  <Text style={[styles.itemUnitPrice, { fontSize: getScaledSize(12) }]}>{formatCurrency(parseFloat(item.price || 0))} each</Text>
                                </View>
                              </View>
                              <Text style={[styles.itemPrice, { fontSize: getScaledSize(14) }]}>{formatCurrency(parseFloat(item.price || 0) * item.quantity)}</Text>
                            </View>
                          ))}
                        </View>
                     )}
                    </View>
                  </View>
                ) : (
                  <View style={styles.emptyState}>
                    <MaterialIcons name="history" size={48} color={COLORS.text.tertiary} />
                    <Text style={[styles.emptyStateText, { fontSize: getScaledSize(16) }]}>No orders yet</Text>
                    <Text style={[styles.emptyStateSubtext, { fontSize: getScaledSize(14) }]}>Your order history will appear here</Text>
                  </View>
                )}
              </View>
            )}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.primary,
  },
  simpleHeaderContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primary,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  simpleHeaderLogo: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
  },
  simpleHeaderTextContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  simpleHeaderMainTitle: {
    fontWeight: '600',
    color: COLORS.text.light,
  },
  simpleHeaderUserName: {
    color: COLORS.text.light,
    marginTop: 2,
  },
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  contentContainer: {
    paddingBottom: 24,
  },
  content: {
    padding: 16,
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  sectionTitle: {
    fontWeight: "700",
    color: COLORS.text.primary,
    marginBottom: 16,
  },
  viewAllButton: {
    flexDirection: "row",
    alignItems: "center",
  },
  viewAllText: {
    color: COLORS.primary,
    marginRight: 4,
  },
  orderCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    overflow: "hidden",
    ...Platform.select({
      ios: {
        shadowColor: COLORS.card.shadow,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  orderHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: COLORS.primary,
    padding: 16,
  },
  orderType: {
    flexDirection: "row",
    alignItems: "center",
  },
  orderTypeText: {
    color: COLORS.text.light,
    marginLeft: 8,
    fontWeight: "600",
  },
  orderDate: {
    color: COLORS.text.light,
  },
  orderBody: {
    padding: 16,
  },
  orderSummary: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  // Carousel Styles
  carouselContainer: {
    marginBottom: 16,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: COLORS.surface,
    ...Platform.select({
      ios: {
        shadowColor: COLORS.card.shadow,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  scrollViewContent: {
    alignItems: 'center',
  },
  carouselItem: {
    width: '100%',
    aspectRatio: 16/9, // Standard widescreen aspect ratio
  },
  carouselImage: {
    width: '100%',
    height: '100%',
    backgroundColor: COLORS.background,
  },
  orderItems: {
    marginTop: 8,
  },
  orderItemsTitle: {
    fontWeight: "600",
    color: COLORS.text.primary,
    marginBottom: 12,
  },
  orderItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  orderItemImage: {
    width: 50,
    height: 50,
    borderRadius: 8,
    marginRight: 12,
  },
  orderItemImagePlaceholder: {
    width: 50,
    height: 50,
    borderRadius: 8,
    marginRight: 12,
    backgroundColor: COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  itemInfo: {
    flex: 1,
    marginRight: 8,
  },
  itemDetails: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  itemName: {
    color: COLORS.text.primary,
    fontWeight: '500',
  },
  itemQuantity: {
    color: COLORS.text.secondary,
    marginLeft: 8,
  },
  itemUnitPrice: {
    color: COLORS.text.secondary,
    marginLeft: 8,
  },
  itemPrice: {
    fontWeight: "500",
    color: COLORS.text.primary,
    marginLeft: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    color: COLORS.text.primary,
    marginTop: 16,
  },
  emptyState: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 32,
    alignItems: "center",
    justifyContent: "center",
    ...Platform.select({
      ios: {
        shadowColor: COLORS.card.shadow,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  emptyStateText: {
    fontWeight: "600",
    color: COLORS.text.primary,
    marginTop: 16,
  },
  emptyStateSubtext: {
    color: COLORS.text.secondary,
    textAlign: "center",
    marginTop: 8,
  },
  refreshButton: {
    padding: 6,
    marginLeft: 8,
  },
  carouselContainer: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 16,
    ...Platform.select({
      ios: {
        shadowColor: COLORS.card.shadow,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  scrollViewContent: {
    flexGrow: 1,
  },
  carouselItem: {
    width: '100%',
    height: 100,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background,
  },
  carouselImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'contain',
  },
  pagination: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 12,
  },
  paginationDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.text.tertiary,
    marginHorizontal: 4,
  },
  paginationDotActive: {
    width: 20,
    backgroundColor: COLORS.primary,
  },
})

export default HomeCustomer;