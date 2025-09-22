import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  Alert,
  Image,
  Modal,
  SafeAreaView,
  StatusBar,
  ActivityIndicator,
} from "react-native";
import { ipAddress } from "../../services/urls";
import Icon from "react-native-vector-icons/MaterialIcons";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import { Picker } from "@react-native-picker/picker";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { jwtDecode } from "jwt-decode";
import { useFontScale } from '../../App';

const ProductsComponent = () => {
  const { getScaledSize } = useFontScale();
  const [products, setProducts] = useState([]);
  const [filteredProducts, setFilteredProducts] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [selectedBrand, setSelectedBrand] = useState("");
  const [brands, setBrands] = useState([]);
  const [categories, setCategories] = useState([]);
  const [enlargedImage, setEnlargedImage] = useState(null);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState(null);
  const navigation = useNavigation();

  // Check user role on component mount
  useEffect(() => {
    const checkUserRole = async () => {
      try {
        const token = await AsyncStorage.getItem("userAuthToken");
        if (token) {
          const decoded = jwtDecode(token);
          setUserRole(decoded.role);
          console.log("User role in ProductList:", decoded.role);
        }
      } catch (error) {
        console.error("Error checking user role:", error);
      }
    };
    checkUserRole();
  }, []);

  // Always refresh products when focused (like Catalogue.jsx)
  useFocusEffect(
    React.useCallback(() => {
      fetchProducts();
    }, [])
  );

  const fetchProducts = async () => {
    try {
      setLoading(true);
      console.log("Fetching products from:", `http://${ipAddress}:8091/products`);
      
      // Test if API is reachable
      try {
        const testResponse = await fetch(`http://${ipAddress}:8091/`, { method: 'HEAD' });
        console.log("API reachability test:", testResponse.status);
      } catch (testError) {
        console.log("API reachability test failed:", testError.message);
      }
      
      const response = await fetch(`http://${ipAddress}:8091/products`);
      const data = await response.json();
      console.log("API response status:", response.status);
      console.log("API response data length:", data.length);
      console.log("Sample product data:", data[0]);
      
      if (response.ok) {
        // Filter by enable_product - only show products with enable_product = "Yes"
        // Handle cases where enable_product might be missing or have different values
        const enabledProducts = data.filter(p => {
          const enableStatus = p.enable_product;
          console.log(`Product ${p.name} (ID: ${p.id}) enable_product:`, enableStatus);
          return enableStatus === "Yes" || enableStatus === "yes" || enableStatus === true || enableStatus === 1;
        });
        console.log("Enabled products count:", enabledProducts.length);
        console.log("Sample enabled product:", enabledProducts[0]);
        
        // If no enabled products found, show all products for debugging
        const productsToShow = enabledProducts.length > 0 ? enabledProducts : data;
        if (enabledProducts.length === 0) {
          console.log("No enabled products found, showing all products for debugging");
        }
        
        setProducts(productsToShow);
        setFilteredProducts(productsToShow);
        
        // Extract unique brands and categories from products to show
        setBrands(["All", ...new Set(productsToShow.map((product) => product.brand))]);
        setCategories(["All", ...new Set(productsToShow.map((product) => product.category))]);
        
        // Set default selections
        if (!selectedCategory) setSelectedCategory("All");
        if (!selectedBrand) setSelectedBrand("All");
      } else {
        console.log("API returned error status:", response.status);
        console.log("API error response:", data);
        Alert.alert("Error", `Failed to fetch products. Status: ${response.status}`);
      }
    } catch (error) {
      console.error("Error fetching products:", error);
      Alert.alert("Error", `An error occurred while fetching products: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let filtered = products;
    
    if (searchTerm) {
      filtered = filtered.filter((product) =>
        product.name.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    if (selectedCategory && selectedCategory !== "All") {
      filtered = filtered.filter((product) => product.category === selectedCategory);
    }
    if (selectedBrand && selectedBrand !== "All") {
      filtered = filtered.filter((product) => product.brand === selectedBrand);
    }
    setFilteredProducts(filtered);
  }, [searchTerm, selectedCategory, selectedBrand, products]);

  const renderProduct = ({ item }) => {
    const imageUri = `http://${ipAddress}:8091/images/products/${item.image}`;

    return (
      <TouchableOpacity
        style={styles.productCard}
        onPress={() => item.image && setEnlargedImage(item.image)}
      >
        <View style={styles.imageContainer}>
          {item.image ? (
            <Image
              style={styles.productImage}
              source={{ uri: imageUri }}
              resizeMode="cover"
            />
          ) : (
            <View style={styles.noImageContainer}>
              <Icon name="image-not-supported" size={40} color="#CCC" />
            </View>
          )}
        </View>
        <View style={styles.productInfo}>
          <Text style={[styles.productName, { fontSize: getScaledSize(14) }]} numberOfLines={2}>{item.name}</Text>
          <Text style={[styles.productDetails, { fontSize: getScaledSize(12) }]}>{item.category} • {item.brand}</Text>
          <Text style={[styles.productPrice, { fontSize: getScaledSize(16) }]}>₹{item.price}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#003366" />
        <Text style={[styles.loadingText, { fontSize: getScaledSize(16) }]}>Loading products...</Text>
      </View>
    );
  }

  // Check if user has access to this component
  if (userRole && userRole !== "superadmin" && userRole !== "owner") {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar backgroundColor="#003366" barStyle="light-content" />
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Icon name="arrow-back" size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { fontSize: getScaledSize(20) }]}>Access Denied</Text>
        </View>
        <View style={styles.accessDeniedContainer}>
          <Icon name="block" size={64} color="#FF6B6B" />
          <Text style={[styles.accessDeniedTitle, { fontSize: getScaledSize(24) }]}>Access Denied</Text>
          <Text style={[styles.accessDeniedText, { fontSize: getScaledSize(16) }]}>
            You need superadmin or owner role to access this page.
          </Text>
          <Text style={[styles.accessDeniedText, { fontSize: getScaledSize(16) }]}>
            Your current role: {userRole}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar backgroundColor="#003366" barStyle="light-content" />
     
      
      <View style={styles.searchContainer}>
        <Icon name="search" size={20} color="#666" style={styles.searchIcon} />
        <TextInput
          style={[styles.searchInput, { fontSize: getScaledSize(16), padding: getScaledSize(12) }]}
          placeholder="Search products..."
          placeholderTextColor="#666"
          value={searchTerm}
          onChangeText={setSearchTerm}
        />
      </View>

      {/* Debug info */}
      <View style={styles.debugContainer}>
       
        <Text style={[styles.debugText, { fontSize: getScaledSize(14) }]}>Total Products: {products.length}</Text>
        <Text style={[styles.debugText, { fontSize: getScaledSize(14) }]}>Filtered Products: {filteredProducts.length}</Text>
        <Text style={[styles.debugText, { fontSize: getScaledSize(14) }]}>Categories: {categories.length - 1}</Text>
        <Text style={[styles.debugText, { fontSize: getScaledSize(14) }]}>Brands: {brands.length - 1}</Text>
      </View>

      <View style={styles.filterContainer}>
        <View style={styles.pickerContainer}>
          <Picker
            selectedValue={selectedCategory}
            style={[styles.picker, { height: getScaledSize(48) }]}
            dropdownIconColor="#003366"
            onValueChange={(itemValue) => setSelectedCategory(itemValue)}
          >
            {categories.map((category) => (
              <Picker.Item 
                key={category} 
                label={category} 
                value={category}
                color="#003366"
              />
            ))}
          </Picker>
        </View>
        <View style={styles.pickerContainer}>
          <Picker
            selectedValue={selectedBrand}
            style={[styles.picker, { height: getScaledSize(48) }]}
            dropdownIconColor="#003366"
            onValueChange={(itemValue) => setSelectedBrand(itemValue)}
          >
            {brands.map((brand) => (
              <Picker.Item 
                key={brand} 
                label={brand} 
                value={brand}
                color="#003366"
              />
            ))}
          </Picker>
        </View>
      </View>

      <FlatList
        data={filteredProducts}
        renderItem={renderProduct}
        keyExtractor={(item) => item.id.toString()}
        numColumns={2}
        columnWrapperStyle={styles.row}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContainer}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Icon name="search-off" size={48} color="#CCC" />
            <Text style={[styles.noProducts, { fontSize: getScaledSize(16) }]}>No products found</Text>
            <Text style={[styles.emptySubText, { fontSize: getScaledSize(14) }]}>Try adjusting your search or filters</Text>
          </View>
        }
      />

      <Modal
        visible={!!enlargedImage}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setEnlargedImage(null)}
      >
        <View style={styles.modalContainer}>
          <TouchableOpacity
            style={styles.closeButton}
            onPress={() => setEnlargedImage(null)}
          >
            <Icon name="close" size={24} color="#FFFFFF" />
          </TouchableOpacity>
          {enlargedImage && (
            <Image
              style={styles.enlargedImage}
              source={{ uri: `http://${ipAddress}:8091/images/products/${enlargedImage}` }}
              resizeMode="contain"
            />
          )}
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F5F7FA",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#F5F7FA",
  },
  loadingText: {
    marginTop: 12,
    color: "#666",
  },
  header: {
    backgroundColor: "#003366",
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  backButton: {
    padding: 8,
    marginRight: 16,
  },
  headerTitle: {
    color: "#FFFFFF",
    flex: 1,
    fontWeight: "600",
    textAlign: "center",
  },
  refreshButton: {
    padding: 8,
    marginLeft: 16,
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    margin: 16,
    marginTop: 20,
    borderRadius: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  searchIcon: {
    marginLeft: 16,
  },
  searchInput: {
    flex: 1,
    color: "#333",
  },
  filterContainer: {
    flexDirection: "row",
    paddingHorizontal: 16,
    marginBottom: 16,
    gap: 12,
  },
  pickerContainer: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    overflow: 'hidden',
  },
  picker: {
  },
  listContainer: {
    padding: 8,
    paddingBottom: 24,
  },
  row: {
    justifyContent: "space-between",
    paddingHorizontal: 8,
  },
  productCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    width: "48%",
    marginBottom: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    overflow: 'hidden',
  },
  imageContainer: {
    width: "100%",
    height: 160,
    backgroundColor: "#F5F7FA",
  },
  productImage: {
    width: "100%",
    height: "100%",
  },
  noImageContainer: {
    width: "100%",
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#F5F7FA",
  },
  productInfo: {
    padding: 12,
  },
  productName: {
    color: "#333333",
    fontWeight: "600",
    marginBottom: 4,
    height: 40,
  },
  productDetails: {
    color: "#666666",
    marginBottom: 8,
  },
  productPrice: {
    color: "#003366",
    fontWeight: "700",
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingTop: 48,
  },
  noProducts: {
    color: "#666666",
    marginTop: 12,
    fontWeight: "600",
  },
  emptySubText: {
    color: "#999999",
    marginTop: 8,
    textAlign: "center",
  },
  modalContainer: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.9)",
    justifyContent: "center",
    alignItems: "center",
  },
  enlargedImage: {
    width: "90%",
    height: "80%",
  },
  closeButton: {
    position: "absolute",
    top: 40,
    right: 20,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    padding: 8,
    borderRadius: 20,
  },
  debugContainer: {
    backgroundColor: "#FFFFFF",
    margin: 16,
    marginTop: 10,
    borderRadius: 12,
    padding: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  debugText: {
    color: "#333",
    marginBottom: 4,
  },
  accessDeniedContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
    backgroundColor: "#F5F7FA",
  },
  accessDeniedTitle: {
    fontWeight: "bold",
    color: "#FF6B6B",
    marginTop: 20,
    textAlign: "center",
  },
  accessDeniedText: {
    color: "#666",
    textAlign: "center",
    marginTop: 10,
  },
});

export default ProductsComponent;