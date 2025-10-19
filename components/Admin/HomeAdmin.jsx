import AsyncStorage from "@react-native-async-storage/async-storage";
import { useState, useCallback, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  Image,
  Dimensions,
  SafeAreaView,
  Platform,
  Animated,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import MaterialIcons from "react-native-vector-icons/MaterialIcons";
import { ipAddress } from '../../services/urls';
import { LICENSE_NO } from '../config';
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import { jwtDecode } from "jwt-decode";
import { useFontScale } from '../../App';

const COLORS = {
  primary: "#003366",
  primaryLight: "#004488",
  primaryDark: "#002244",
  secondary: "#10B981",
  accent: "#F59E0B",
  success: "#059669",
  error: "#DC2626",
  warning: "#D97706",
  background: "#F3F4F6",
  surface: "#FFFFFF",
  text: {
    primary: "#111827",
    secondary: "#4B5563",
    tertiary: "#9CA3AF",
    light: "#FFFFFF",
  },
  border: "#E5E7EB",
  divider: "#F3F4F6",
  card: {
    background: "#FFFFFF",
    shadow: "rgba(0, 0, 0, 0.1)",
  },
};

const HomeAdmin = () => {
  const { getScaledSize } = useFontScale();
  const [adminName, setAdminName] = useState("");
  const [adminRole, setAdminRole] = useState("");
  const [advertisements, setAdvertisements] = useState([]);
  const [advTimer, setAdvTimer] = useState(5);
  const [currentIndex, setCurrentIndex] = useState(0);
  const scrollViewRef = useRef(null);
  const { width: viewportWidth } = Dimensions.get('window');
  const ITEM_WIDTH = viewportWidth - 32;
  const [isLoading, setIsLoading] = useState(false);
  const navigation = useNavigation();
  const scrollX = useRef(new Animated.Value(0)).current;

  // Fetch admin name from JWT token only
  const getAdminName = async () => {
    try {
      const token = await AsyncStorage.getItem("userAuthToken");
      if (!token) {
        setAdminName("Admin");
        setAdminRole("Admin");
        return;
      }
      const decoded = jwtDecode(token);
      setAdminName(decoded.username || "Admin");
      setAdminRole(decoded.sub_role || "Admin");
    } catch (error) {
      console.error("Error decoding token:", error);
      setAdminName("Admin");
      setAdminRole("Admin");
    }
  };

  useEffect(() => {
    getAdminName();
  }, []);

  // Fetch advertisements
  const fetchAdvertisements = useCallback(async () => {
    try {
      setIsLoading(true);
      const token = await AsyncStorage.getItem("userAuthToken");
      if (!token) return;
      const response = await fetch(`http://${ipAddress}:8091/advertisement-crud`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ operation: 'read' })
      });
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.data) {
          const validAds = data.data.filter(ad => ad.image && ad.status === 'active');
          setAdvertisements(validAds);
        }
      }
    } catch (error) {
      // Optionally handle error
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Fetch adv_timer
  const fetchClientStatus = async () => {
    try {
      const response = await fetch(`http://147.93.110.150:3001/api/client_status/${LICENSE_NO}`, {
        method: 'GET',
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      });
      const data = await response.json();
      if (data.success && data.data && data.data.length > 0) {
        const advTimerValue = parseInt(data.data[0].adv_timer);
        if (!isNaN(advTimerValue) && advTimerValue > 0) {
          setAdvTimer(advTimerValue);
        }
      }
    } catch {}
  };

  useEffect(() => {
    fetchClientStatus();
    fetchAdvertisements();
  }, [fetchAdvertisements]);

  useFocusEffect(
    useCallback(() => {
      fetchClientStatus();
      fetchAdvertisements();
    }, [fetchAdvertisements])
  );

  // Auto-scroll carousel
  useEffect(() => {
    if (advertisements.length <= 1 || !advTimer) return;
    const timer = setInterval(() => {
      const nextIndex = (currentIndex + 1) % advertisements.length;
      scrollViewRef.current?.scrollTo({ x: nextIndex * ITEM_WIDTH, animated: true });
      setCurrentIndex(nextIndex);
    }, advTimer * 1000);
    return () => clearInterval(timer);
  }, [currentIndex, advertisements.length, ITEM_WIDTH, advTimer]);

  const onScroll = Animated.event(
    [{ nativeEvent: { contentOffset: { x: scrollX } } }],
    { useNativeDriver: false }
  );

  const onScrollEnd = (e) => {
    const offsetX = e.nativeEvent.contentOffset.x;
    const newIndex = Math.round(offsetX / ITEM_WIDTH);
    setCurrentIndex(newIndex);
  };

  // Add refresh handler
  const handleRefresh = async () => {
    setIsLoading(true);
    await Promise.all([fetchClientStatus(), fetchAdvertisements(), getAdminName()]);
    setIsLoading(false);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar backgroundColor={COLORS.primary} barStyle="light-content" />
      <View style={[styles.simpleHeaderContainer, Platform.OS === 'android' ? { paddingTop: StatusBar.currentHeight || 24 } : {}]}>
        <Image source={require("../../assets/logo.jpg")} style={styles.simpleHeaderLogo} resizeMode="contain" />
        <View style={styles.simpleHeaderTextContainer}>
          <Text style={[styles.simpleHeaderMainTitle, { fontSize: getScaledSize(16) }]}>User Dashboard</Text>
          <Text style={[styles.simpleHeaderUserName, { fontSize: getScaledSize(13) }]}>Name:- {adminName || "Admin"}</Text>
          <Text style={[styles.simpleHeaderRole, { fontSize: getScaledSize(11) }]}>Role :- {adminRole || "Admin"}</Text>
        </View>
        <TouchableOpacity style={styles.refreshButton} onPress={handleRefresh}>
          <MaterialIcons name="refresh" size={24} color={COLORS.text.light} />
        </TouchableOpacity>
      </View>
      <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={COLORS.primary} />
            <Text style={[styles.loadingText, { fontSize: getScaledSize(16) }]}>Loading advertisements...</Text>
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
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

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
  simpleHeaderRole: {
    color: COLORS.text.light,
    marginTop: 1,
    opacity: 0.8,
    fontStyle: 'italic',
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
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    color: COLORS.text.primary,
    marginTop: 16,
  },
  carouselContainer: {
    marginBottom: 16,
    borderRadius: 16,
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
    flexGrow: 1,
    alignItems: 'center',
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
    backgroundColor: COLORS.background,
  },
  refreshButton: {
    padding: 6,
    marginLeft: 8,
  },
});

export default HomeAdmin; 