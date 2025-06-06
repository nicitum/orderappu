import AsyncStorage from "@react-native-async-storage/async-storage"
import { useState, useCallback, useEffect } from "react"
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
import { ipAddress } from "../../services/urls"
import { useNavigation, useFocusEffect } from "@react-navigation/native"
import { checkTokenAndRedirect } from "../../services/auth"
import { jwtDecode } from "jwt-decode"
import { Linking } from "react-native"

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

const HomePage = () => {
  const [isLoading, setIsLoading] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [userDetails, setUserDetails] = useState(null)
  const [lastOrderDetails, setLastOrderDetails] = useState(null)
  const [lastOrderItems, setLastOrderItems] = useState([])
  const [allProductsData, setAllProductsData] = useState([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [scrollY] = useState(new Animated.Value(0));
  const navigation = useNavigation();
  const [repeatOrderModalVisible, setRepeatOrderModalVisible] = useState(false);
  const [isPlacingRepeatOrder, setIsPlacingRepeatOrder] = useState(false);
  const [randomProducts, setRandomProducts] = useState([]);
  const [isProductModalVisible, setIsProductModalVisible] = useState(false);
  const [selectedProductForModal, setSelectedProductForModal] = useState(null);

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

  const renderFeaturedProductItem = ({ item }) => (
    <TouchableOpacity
      style={styles.productCard}
      onPress={() => {
        if (item && item.id) {
          setSelectedProductForModal(item);
          setIsProductModalVisible(true);
        } else {
          console.warn("Attempted to open modal with invalid product item:", item);
          Alert.alert("Product Error", "Could not display product details.");
        }
      }}
    >
      {item.image ? (
        <Image
          source={{ uri: `http://${ipAddress}:8091/images/products/${item.image}` }}
          style={styles.productImage}
          resizeMode="contain"
          onError={(e) => console.warn('Image load error for product ID:', item.id, item.image, e.nativeEvent.error)}
        />
      ) : (
        <View style={[styles.productImage, styles.productImagePlaceholder]} >
          <MaterialIcons name="image-not-supported" size={40} color={COLORS.text.tertiary} />
        </View>
      )}
      <View style={styles.productInfo}>
        <Text style={styles.productName} numberOfLines={2}>{item.name || "Product Name Unavailable"}</Text>
        <Text style={styles.productPrice}>{formatCurrency(item.price !== undefined ? item.price : 0)}</Text>
      </View>
    </TouchableOpacity>
  );

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
         Alert.alert("Failed", userGetResponse.message || "Failed to fetch user details");
      } else {
         console.error("Failed to fetch user details: No response");
         Alert.alert("Error", "An error occurred while fetching user details.");
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
      Alert.alert("Error", "An error occurred. Please try again.")
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

  useFocusEffect(
    useCallback(() => {
      const fetchDataAsync = async () => await fetchData();
      fetchDataAsync(); // Fetch all necessary data when screen is focused
      checkUserRole();
      const backHandler = BackHandler.addEventListener("hardwareBackPress", handleBackButton);
      return () => backHandler.remove();
    }, [fetchData, handleBackButton])
  );

  const handleRepeatOrderCheckout = async () => {
    if (!lastOrderDetails || !lastOrderItems || lastOrderItems.length === 0) {
      Alert.alert("Error", "No items in the last order to repeat.");
      return;
    }

    setIsPlacingRepeatOrder(true);
    try {
      const userAuthToken = await checkTokenAndRedirect(navigation);
      if (!userAuthToken) {
        setIsPlacingRepeatOrder(false);
        return;
      }

      const decodedToken = jwtDecode(userAuthToken);
      const localCustomerId = decodedToken.id;

      const now = new Date();
      const currentOrderType = now.getHours() < 12 ? "AM" : "PM"; 
      const orderDate = now.toISOString();

      const orderData = {
        customer_id: localCustomerId,
        orderDate: orderDate,
        orderType: currentOrderType,
        products: lastOrderItems.map(item => ({
          product_id: item.product_id,
          quantity: item.quantity,
          price: parseFloat(item.price || 0)
        })),
        total_amount: parseFloat(lastOrderDetails.totalAmount || 0),
        payment_method: "cod", 
        status: "pending"
      };

      const response = await fetch(`http://${ipAddress}:8091/place`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${userAuthToken}`,
        },
        body: JSON.stringify(orderData),
      });

      const responseData = await response.json();

      if (response.ok) {
        Alert.alert("Success", responseData.message || "Your repeat order has been placed successfully!");
        setRepeatOrderModalVisible(false);
        fetchData(); 
      } else {
        Alert.alert("Error", responseData.message || "Could not place the repeat order. Please try again.");
      }
    } catch (error) {
      console.error("Error placing repeat order:", error);
      Alert.alert("Error", "An unexpected error occurred while placing your repeat order.");
    } finally {
      setIsPlacingRepeatOrder(false);
    }
  };

  const { customerName } = userDetails || {}
  const { lastIndentDate, totalAmount, orderType: lastOrderType } = lastOrderDetails || {}; 
  const totalQuantity = lastOrderItems?.reduce((total, item) => total + (parseInt(item.quantity) || 0), 0) || 0;

  const headerHeight = scrollY.interpolate({
    inputRange: [0, 100],
    outputRange: [160, 80],
    extrapolate: 'clamp'
  })

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar backgroundColor={COLORS.primary} barStyle="light-content" />

      {/* Animated Header */}
      <Animated.View style={[styles.header, { height: headerHeight }]}>
        <View style={styles.headerTop}>
          <Image source={require("../../assets/logo.jpg")} style={styles.logo} resizeMode="contain" />
          <Text style={styles.headerTitle}>{isAdmin ? "Admin Dashboard" : "Customer Dashboard"}</Text>
          <TouchableOpacity style={styles.refreshButton} onPress={onRefresh}>
            <MaterialIcons name="refresh" size={24} color={COLORS.text.light} />
          </TouchableOpacity>
        </View>
        {userDetails && (
          <View style={styles.headerBottom}>
            <Text style={styles.welcomeText}>Welcome back,</Text>
            <Text style={styles.userName}>{customerName || "User"}</Text>
          </View>
        )}
      </Animated.View>

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
            <Text style={styles.loadingText}>Loading your dashboard...</Text>
          </View>
        ) : (
          <View style={styles.content}>
            {/* Featured Products Section */}
            {randomProducts.length > 0 && (
              <View style={styles.featuredProductsContainer}>
                <Text style={styles.featuredProductsTitle}>Quick Picks</Text>
                <FlatList
                  data={randomProducts}
                  renderItem={renderFeaturedProductItem}
                  keyExtractor={(item, index) => item.id ? item.id.toString() : `random-${index}`}
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ paddingHorizontal: 16 }}
                />
                <TouchableOpacity
                  style={styles.seeMoreButton}
                  onPress={() => navigation.navigate('Catalogue')}
                >
                  <Text style={styles.seeMoreButtonText}>See More Products</Text>
                  <MaterialIcons name="arrow-forward" size={20} color={COLORS.text.light} style={{ marginLeft: 8 }} />
                </TouchableOpacity>
              </View>
            )}

            {/* Order History Section */}
            {!isAdmin && (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>Order History</Text>
                  <TouchableOpacity 
                    style={styles.viewAllButton}
                    onPress={() => navigation.navigate("OrdersPage")}
                  >
                    <Text style={styles.viewAllText}>View All</Text>
                    <MaterialIcons name="chevron-right" size={20} color={COLORS.primary} />
                  </TouchableOpacity>
                </View>

                {lastOrderDetails ? (
                  <View style={styles.orderCard}>
                    <View style={styles.orderHeader}>
                      <View style={styles.orderType}>
                        <MaterialIcons 
                          name={lastOrderType === "AM" ? "wb-sunny" : "nights-stay"} 
                          size={20} 
                          color={COLORS.text.light} 
                        />
                        <Text style={styles.orderTypeText}>{lastOrderType} Shift</Text>
                      </View>
                      <Text style={styles.orderDate}>{formatDate(lastIndentDate)}</Text>
                    </View>

                    <View style={styles.orderBody}>
                      <View style={styles.orderSummary}>
                        <View style={styles.orderInfo}>
                          <Text style={styles.orderInfoLabel}>Total Items</Text>
                          <Text style={styles.orderInfoValue}>{totalQuantity}</Text>
                        </View>
                        <View style={styles.orderInfo}>
                          <Text style={styles.orderInfoLabel}>Total Amount</Text>
                          <Text style={styles.orderInfoValue}>{formatCurrency(totalAmount || 0)}</Text>
                        </View>
                      </View>

                      {lastOrderItems && lastOrderItems.length > 0 && (
                        <View style={styles.orderItems}>
                          <Text style={styles.orderItemsTitle}>Order Details</Text>
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
                                <Text style={styles.itemName} numberOfLines={2}>{item.name || 'Product Name'}</Text>
                                <View style={styles.itemDetails}>
                                  <Text style={styles.itemQuantity}>Qty: {item.quantity}</Text>
                                  <Text style={styles.itemUnitPrice}>{formatCurrency(parseFloat(item.price || 0))} each</Text>
                                </View>
                              </View>
                              <Text style={styles.itemPrice}>{formatCurrency(parseFloat(item.price || 0) * item.quantity)}</Text>
                            </View>
                          ))}
                        </View>
                     )}
                    </View>
                  </View>
                ) : (
                  <View style={styles.emptyState}>
                    <MaterialIcons name="history" size={48} color={COLORS.text.tertiary} />
                    <Text style={styles.emptyStateText}>No orders yet</Text>
                    <Text style={styles.emptyStateSubtext}>Your order history will appear here</Text>
                  </View>
                )}
              </View>
            )}

            {/* Repeat Last Order Button */}
            {!isAdmin && lastOrderDetails && (
              <TouchableOpacity
                style={styles.repeatOrderButton}
                onPress={() => setRepeatOrderModalVisible(true)}
                disabled={!lastOrderItems || lastOrderItems.length === 0}
              >
                <MaterialIcons name="repeat" size={20} color={COLORS.text.light} />
                <Text style={styles.repeatOrderButtonText}>Repeat Recent Order</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </ScrollView>

      {/* Product Detail Modal */}
      {selectedProductForModal && (
        <Modal
          animationType="slide"
          transparent={true}
          visible={isProductModalVisible}
          onRequestClose={() => setIsProductModalVisible(false)}
        >
          <View style={styles.centeredModalOverlay}>
            <View style={styles.productDetailModalContent}>
              <View style={styles.productDetailModalHeader}>
                <Text style={styles.productDetailModalTitle}>{selectedProductForModal.name}</Text>
                <TouchableOpacity onPress={() => setIsProductModalVisible(false)} style={styles.modalCloseButton}>
                  <MaterialIcons name="close" size={24} color={COLORS.text.primary} />
                </TouchableOpacity>
              </View>
              {selectedProductForModal.image ? (
                <Image 
                  source={{ uri: `http://${ipAddress}:8091/images/products/${selectedProductForModal.image}` }} 
                  style={styles.productDetailModalImage} 
                  resizeMode="contain" 
                  onError={(e) => console.warn('Modal image load error:', selectedProductForModal.image, e.nativeEvent.error)}
                />
              ) : (
                <View style={[styles.productDetailModalImage, styles.productDetailModalImagePlaceholder]}>
                  <MaterialIcons name="image-not-supported" size={60} color={COLORS.text.tertiary} />
                </View>
              )}
              <View style={styles.productDetailModalInfoContainer}>
                <Text style={styles.productDetailModalPrice}>{formatCurrency(selectedProductForModal.price !== undefined ? selectedProductForModal.price : 0)}</Text>
                {selectedProductForModal.size && <Text style={styles.productDetailModalDescription}>Size: {selectedProductForModal.size}</Text>}
              </View>
            </View>
          </View>
        </Modal>
      )}

      {/* Repeat Order Modal */}
      {lastOrderDetails && (
        <Modal
          animationType="slide"
          transparent={true}
          visible={repeatOrderModalVisible}
          onRequestClose={() => {
            if (!isPlacingRepeatOrder) {
              setRepeatOrderModalVisible(false);
            }
          }}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.cartModalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Confirm Repeat Order</Text>
                <TouchableOpacity 
                  onPress={() => setRepeatOrderModalVisible(false)} 
                  style={styles.modalCloseButton}
                  disabled={isPlacingRepeatOrder}
                >
                  <MaterialIcons name="close" size={24} color={COLORS.text.primary} />
                </TouchableOpacity>
              </View>

              <ScrollView contentContainerStyle={styles.cartItemsContainer}>
                {lastOrderItems && lastOrderItems.length > 0 ? (
                  lastOrderItems.map((item, index) => (
                    <View key={index} style={styles.cartItem}>
                      {item.image ? (
                        <Image 
                          source={{ uri: `http://${ipAddress}:8091/images/products/${item.image}` }} 
                          style={styles.cartItemImage} 
                          resizeMode="cover" 
                          onError={(e) => console.warn('Cart image load error:', item.image, e.nativeEvent.error)}
                        />
                      ) : (
                        <View style={styles.cartItemImagePlaceholder}>
                          <MaterialIcons name="image-not-supported" size={30} color={COLORS.text.secondary} />
                        </View>
                      )}
                      <View style={styles.cartItemDetails}>
                        <Text style={styles.cartItemName} numberOfLines={2}>{item.name || 'Product Name'}</Text>
                        <View style={styles.cartItemSubtext}>
                          <Text style={styles.cartItemQuantity}>Qty: {item.quantity}</Text>
                          <Text style={styles.cartItemUnitPrice}>{formatCurrency(parseFloat(item.price || 0))} each</Text>
                        </View>
                      </View>
                      <Text style={styles.cartItemPrice}>{formatCurrency(parseFloat(item.price || 0) * item.quantity)}</Text>
                    </View>
                  ))
                ) : (
                  <Text style={styles.emptyCartText}>No items in the last order to repeat.</Text>
                )}
              </ScrollView>

              {lastOrderItems && lastOrderItems.length > 0 && (
                <View style={styles.cartFooter}>
                  <View style={styles.cartTotalContainer}>
                    <Text style={styles.cartTotalLabel}>Total Amount:</Text>
                    <Text style={styles.cartTotalPrice}>{formatCurrency(parseFloat(lastOrderDetails.totalAmount || 0))}</Text>
                  </View>
                  <TouchableOpacity
                    style={[
                      styles.checkoutButton,
                      (isPlacingRepeatOrder) && styles.disabledButton,
                    ]}
                    onPress={handleRepeatOrderCheckout}
                    disabled={isPlacingRepeatOrder}
                  >
                    {isPlacingRepeatOrder ? (
                      <ActivityIndicator color={COLORS.text.light} size="small" />
                    ) : (
                      <Text style={styles.checkoutButtonText}>Place Repeat Order</Text>
                    )}
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </View>
        </Modal>
      )}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.primary,
  },
  header: {
    backgroundColor: COLORS.primary,
    paddingTop: Platform.OS === 'ios' ? 0 : StatusBar.currentHeight,
  },
  headerTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerBottom: {
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  logo: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: COLORS.text.light,
    flex: 1,
    marginLeft: 12,
  },
  welcomeText: {
    fontSize: 16,
    color: COLORS.text.light,
    opacity: 0.9,
  },
  userName: {
    fontSize: 24,
    fontWeight: "700",
    color: COLORS.text.light,
    marginTop: 4,
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
    fontSize: 18,
    fontWeight: "700",
    color: COLORS.text.primary,
    marginBottom: 16,
  },
  viewAllButton: {
    flexDirection: "row",
    alignItems: "center",
  },
  viewAllText: {
    fontSize: 14,
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
    fontSize: 14,
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
  orderItems: {
    marginTop: 8,
  },
  orderItemsTitle: {
    fontSize: 16,
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
    fontSize: 14,
    color: COLORS.text.primary,
    fontWeight: '500',
  },
  itemQuantity: {
    fontSize: 14,
    color: COLORS.text.secondary,
    marginLeft: 8,
  },
  itemUnitPrice: {
    fontSize: 12,
    color: COLORS.text.secondary,
    marginLeft: 8,
  },
  itemPrice: {
    fontSize: 14,
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
    fontSize: 16,
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
    fontSize: 18,
    fontWeight: "600",
    color: COLORS.text.primary,
    marginTop: 16,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: COLORS.text.secondary,
    textAlign: "center",
    marginTop: 8,
  },
  repeatOrderButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.primary,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 25,
    marginTop: 10,
    marginBottom: 16,
    alignSelf: 'center',
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 4,
  },
  repeatOrderButtonText: {
    color: COLORS.text.light,
    fontSize: 16,
    fontWeight: "600",
    marginLeft: 8,
  },
  centeredModalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
  },
  cartModalContent: {
    width: '100%',
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 16,
    maxHeight: "80%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingBottom: 12,
    marginBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: COLORS.text.primary,
  },
  modalCloseButton: {
    padding: 4,
  },
  cartItemsContainer: {
    paddingBottom: 16,
  },
  productDetailModalContent: {
    width: '90%',
    maxWidth: 400,
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  productDetailModalHeader: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  productDetailModalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.text.primary,
    flex: 1,
    marginRight: 8,
  },
  productDetailModalImage: {
    width: '80%',
    aspectRatio: 1,
    borderRadius: 12,
    marginBottom: 20,
    backgroundColor: COLORS.divider,
  },
  productDetailModalImagePlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  productDetailModalInfoContainer: {
    alignItems: 'center',
    marginBottom: 24,
    width: '100%',
  },
  productDetailModalPrice: {
    fontSize: 22,
    fontWeight: 'bold',
    color: COLORS.accent,
    marginBottom: 8,
  },
  productDetailModalDescription: {
    fontSize: 16,
    color: COLORS.text.secondary,
    textAlign: 'center',
    marginBottom: 4,
  },
  emptyCartText: {
    textAlign: 'center',
    fontSize: 16,
    color: COLORS.text.secondary,
    paddingVertical: 20,
  },
  cartItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  cartItemImage: {
    width: 50,
    height: 50,
    borderRadius: 4,
    marginRight: 10,
  },
  cartItemImagePlaceholder: {
    width: 50,
    height: 50,
    borderRadius: 4,
    marginRight: 10,
    backgroundColor: COLORS.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cartItemDetails: {
    flex: 1,
    marginRight: 8,
  },
  cartItemName: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.text.primary,
  },
  cartItemSubtext: {
    fontSize: 14,
    color: COLORS.text.secondary,
    marginTop: 4,
  },
  cartItemPrice: {
    fontSize: 16,
    fontWeight: "bold",
    color: COLORS.text.primary,
  },
  cartFooter: {
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingTop: 16,
    marginTop: 8,
  },
  cartTotalContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  cartTotalLabel: {
    fontSize: 18,
    fontWeight: "500",
    color: COLORS.text.secondary,
  },
  cartTotalPrice: {
    fontSize: 20,
    fontWeight: "bold",
    color: COLORS.text.primary,
  },
  checkoutButton: {
    backgroundColor: COLORS.primary,
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  checkoutButtonText: {
    color: COLORS.text.light,
    fontSize: 16,
    fontWeight: "bold",
  },
  disabledButton: {
    backgroundColor: COLORS.neutralLight,
    opacity: 0.7,
  },
  featuredProductsContainer: {
    marginTop: 24,
  },
  featuredProductsTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.text.primary,
    marginBottom: 16,
    paddingHorizontal: 16,
  },
  productCard: {
    backgroundColor: COLORS.card.background,
    borderRadius: 12,
    marginRight: 16,
    width: Dimensions.get('window').width / 2.2,
    shadowColor: COLORS.card.shadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
    overflow: 'hidden',
  },
  productImage: {
    width: '100%',
    height: 130,
  },
  productImagePlaceholder: {
    width: '100%',
    height: 130,
    backgroundColor: COLORS.divider,
    justifyContent: 'center',
    alignItems: 'center',
  },
  productInfo: {
    padding: 12,
    flexGrow: 1,
    justifyContent: 'space-between',
  },
  productName: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.text.primary,
    marginBottom: 4,
    minHeight: 36,
  },
  productPrice: {
    fontSize: 14,
    color: COLORS.accent,
    fontWeight: 'bold',
    marginTop: 4,
  },
  seeMoreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 25,
    marginTop: 24,
    marginBottom: 16,
    alignSelf: 'center',
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 4,
  },
  seeMoreButtonText: {
    color: COLORS.text.light,
    fontSize: 16,
    fontWeight: 'bold',
  },
})

export default HomePage