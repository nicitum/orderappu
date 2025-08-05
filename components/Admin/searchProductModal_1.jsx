import React, { useState, useEffect, useMemo } from "react";
import {
  Modal,
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Image,
} from "react-native";
import axios from "axios";
import Ionicons from "react-native-vector-icons/Ionicons";
import { ipAddress } from "../../services/urls";
import { checkTokenAndRedirect } from "../../services/auth";
import { useNavigation } from "@react-navigation/native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { jwtDecode } from "jwt-decode";

const SearchProductModal_1 = ({ isVisible, onClose, onAddProduct, currentCustomerId, allowProductEdit }) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [allProducts, setAllProducts] = useState([]);
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [brands, setBrands] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState("");
  const [selectedBrand, setSelectedBrand] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editProduct, setEditProduct] = useState(null);
  const [editPrice, setEditPrice] = useState('');
  const [editQty, setEditQty] = useState('1');

  const navigation = useNavigation();
  const imageBaseUrl = `http://${ipAddress}:8091/images/products/`; // Base URL for images

  // Fetch products from API
  const fetchProducts = async () => {
    try {
      setLoading(true);
      setError(null);
      const userAuthToken = await checkTokenAndRedirect(navigation);

      const response = await axios.get(`http://${ipAddress}:8091/products`, {
        headers: {
          Authorization: `Bearer ${userAuthToken}`,
          "Content-Type": "application/json",
        },
      });

      // Filter by enable_product - only show products with enable_product = "Yes"
      const enabledProducts = response.data.filter(p => p.enable_product === "Yes");
      
      const fetchedProducts = enabledProducts.map((product) => ({
        ...product,
        imageUrl: product.image ? `${imageBaseUrl}${product.image}` : null, // Construct image URL
      }));
      setAllProducts(fetchedProducts);

      const productCategories = [...new Set(fetchedProducts.map((p) => p.category).filter(Boolean))];
      setCategories(productCategories);

      const productBrands = [...new Set(fetchedProducts.map((p) => p.brand).filter(Boolean))];
      setBrands(productBrands);
    } catch (fetchErr) {
      console.error("Error fetching products:", fetchErr);
      setError("Failed to fetch products. Please check your network and try again.");
      setProducts([]);
      setAllProducts([]);
    } finally {
      setLoading(false);
    }
  };

  // Filter products with memoization
  const filteredProducts = useMemo(() => {
    if (!allProducts || allProducts.length === 0) return [];

    let filtered = [...allProducts];

    if (selectedCategory) {
      filtered = filtered.filter(
        (product) => product.category?.toLowerCase() === selectedCategory.toLowerCase()
      );
    }

    if (selectedBrand) {
      filtered = filtered.filter((product) =>
        product.brand?.toLowerCase().includes(selectedBrand.toLowerCase())
      );
    }

    if (searchQuery.length > 2) {
      filtered = filtered.filter((product) =>
        product.name?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Use discountPrice if available, else price
    return filtered.map((product) => ({
      ...product,
      price: Number(product.discountPrice ?? product.price ?? 0),
      gstRate: Number(product.gst_rate || 0),
      discountPrice: Number(product.discountPrice ?? product.price ?? 0),
    }));
  }, [searchQuery, selectedCategory, selectedBrand, allProducts]);

  useEffect(() => {
    setProducts(filteredProducts);
  }, [filteredProducts]);

  useEffect(() => {
    if (isVisible) {
      fetchProducts();
    } else {
      setSearchQuery("");
      setSelectedCategory("");
      setSelectedBrand("");
      setProducts([]);
      setAllProducts([]);
      setError(null);
    }
  }, [isVisible]);

  // Clear all filters
  const clearFilters = () => {
    setSelectedCategory("");
    setSelectedBrand("");
    setSearchQuery("");
  };

  // When Add is clicked, only allow edit modal if allowProductEdit is true
  const handleStartEditProduct = (item) => {
    if (allowProductEdit) {
      setEditProduct(item);
      setEditPrice((item.discountPrice ?? item.price ?? 0).toString());
      setEditQty('1');
      setEditModalVisible(true);
    } else {
      // Directly add with default price/qty
      onAddProduct({
        ...item,
        price: item.discountPrice ?? item.price ?? 0,
        quantity: 1,
        min_selling_price: item.min_selling_price ?? item.minSellingPrice ?? 0,
        discountPrice: item.discountPrice ?? item.selling_price ?? item.price ?? 0,
      });
    }
  };

  // When confirm is clicked in edit modal
  const handleConfirmEditProduct = () => {
    const priceNum = parseFloat(editPrice);
    const qtyNum = parseInt(editQty);
    const minPrice = editProduct?.min_selling_price ?? editProduct?.minSellingPrice ?? 0;
    const maxPrice = editProduct?.discountPrice ?? editProduct?.selling_price ?? editProduct?.price ?? 0;
    if (isNaN(priceNum) || priceNum < 0) {
      setError('Please enter a valid price');
      return;
    }
    if (isNaN(qtyNum) || qtyNum < 1) {
      setError('Please enter a valid quantity');
      return;
    }
    if (priceNum < minPrice || priceNum > maxPrice) {
      setError(`Price must be between ₹${minPrice} and ₹${maxPrice}`);
      return;
    }
    onAddProduct({
      ...editProduct,
      price: priceNum,
      quantity: qtyNum,
      min_selling_price: minPrice,
      discountPrice: maxPrice,
    });
    setEditModalVisible(false);
    setEditProduct(null);
    setEditPrice('');
    setEditQty('1');
    setError(null);
  };

  // Render product item
  const renderProductItem = ({ item }) => {
    return (
      <View style={styles.productCard}>
        {item.imageUrl ? (
          <Image
            source={{ uri: item.imageUrl }}
            style={styles.productImage}
            resizeMode="cover"
            onError={() => console.warn(`Failed to load image for ${item.name}`)}
          />
        ) : (
          <View style={[styles.productImage, styles.placeholderImage]}>
            <Ionicons name="image-outline" size={30} color="#ccc" />
          </View>
        )}
        <View style={styles.productInfo}>
          <Text style={styles.productName} numberOfLines={1}>
            {item.name}
          </Text>
          <View style={styles.tagContainer}>
            {item.category && (
              <View style={styles.productTag}>
                <Text style={styles.productTagText}>{item.category}</Text>
              </View>
            )}
            {item.brand && (
              <View style={styles.productTag}>
                <Text style={styles.productTagText}>{item.brand}</Text>
              </View>
            )}
          </View>
          <Text style={styles.priceText}>
            ₹{typeof item.price === 'number' ? item.price.toFixed(2) : "N/A"}
          </Text>
          <Text style={styles.priceText}>
            GST {item.gstRate || 0}%
          </Text>
        </View>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => handleStartEditProduct(item)}
          disabled={!allowProductEdit && false} // always enabled, but disables edit modal
        >
          <Ionicons name="add" size={20} color="#fff" />
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <Modal
      visible={isVisible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.modalBackground}>
        <View style={styles.modalContainer}>
          {/* Header */}
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Add Products</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color="#fff" />
            </TouchableOpacity>
          </View>

          {/* Search Bar */}
          <View style={styles.searchContainer}>
            <Ionicons name="search" size={20} color="#003366" style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search products (min 3 chars)"
              placeholderTextColor="#999"
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity
                onPress={() => setSearchQuery("")}
                style={styles.clearSearchButton}
              >
                <Ionicons name="close-circle" size={20} color="#999" />
              </TouchableOpacity>
            )}
          </View>

          {/* Filters */}
          <View style={styles.filterSection}>
            <View style={styles.filterHeader}>
              <Text style={styles.filterTitle}>Categories</Text>
              {selectedCategory && (
                <TouchableOpacity onPress={() => setSelectedCategory("")}>
                  <Text style={styles.clearFilterText}>Clear</Text>
                </TouchableOpacity>
              )}
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {categories.map((category) => (
                <TouchableOpacity
                  key={category}
                  style={[
                    styles.filterButton,
                    selectedCategory === category && styles.selectedFilterButton,
                  ]}
                  onPress={() =>
                    setSelectedCategory(selectedCategory === category ? "" : category)
                  }
                >
                  <Text
                    style={[
                      styles.filterButtonText,
                      selectedCategory === category && styles.selectedFilterButtonText,
                    ]}
                  >
                    {category}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          <View style={styles.filterSection}>
            <View style={styles.filterHeader}>
              <Text style={styles.filterTitle}>Brands</Text>
              {selectedBrand && (
                <TouchableOpacity onPress={() => setSelectedBrand("")}>
                  <Text style={styles.clearFilterText}>Clear</Text>
                </TouchableOpacity>
              )}
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {brands.map((brand) => (
                <TouchableOpacity
                  key={brand}
                  style={[
                    styles.filterButton,
                    selectedBrand === brand && styles.selectedFilterButton,
                  ]}
                  onPress={() => setSelectedBrand(selectedBrand === brand ? "" : brand)}
                >
                  <Text
                    style={[
                      styles.filterButtonText,
                      selectedBrand === brand && styles.selectedFilterButtonText,
                    ]}
                  >
                    {brand}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {(selectedCategory || selectedBrand || searchQuery) && (
            <TouchableOpacity style={styles.clearAllButton} onPress={clearFilters}>
              <Text style={styles.clearAllButtonText}>Clear All Filters</Text>
            </TouchableOpacity>
          )}

          {/* Error Message */}
          {error && <Text style={styles.errorText}>{error}</Text>}

          {/* Product List */}
          <View style={styles.resultsContainer}>
            <Text style={styles.resultsCount}>
              {products.length} {products.length === 1 ? "Product" : "Products"} Found
            </Text>
            <FlatList
              data={products}
              renderItem={renderProductItem}
              keyExtractor={(item) => `${item.id}`}
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  <Ionicons name="search-outline" size={50} color="#ccc" />
                  <Text style={styles.emptyText}>
                    {searchQuery.length > 2
                      ? "No products found matching your criteria."
                      : "Please type at least 3 characters or select a category/brand."}
                  </Text>
                </View>
              }
              contentContainerStyle={{ paddingBottom: 20 }}
            />
          </View>

          {/* Loading Overlay for product fetch */}
          {loading && (
            <View style={styles.loadingOverlay}>
              <View style={styles.loaderContainer}>
                <ActivityIndicator size="large" color="#fff" />
                <Text style={styles.loadingText}>Loading products...</Text>
              </View>
            </View>
          )}
        </View>
      </View>
      {allowProductEdit && editModalVisible && (
        <Modal
          visible={editModalVisible}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setEditModalVisible(false)}
        >
          <View style={styles.editModalOverlay}>
            <View style={styles.editModalCard}>
              <Text style={styles.editModalTitle}>Edit Price & Quantity</Text>
              <Text style={styles.editModalLabel}>Price (₹):</Text>
              <TextInput
                style={styles.editModalInput}
                keyboardType="numeric"
                value={editPrice}
                onChangeText={setEditPrice}
              />
              {editProduct && (
                <Text style={{ color: '#888', fontSize: 13, alignSelf: 'flex-start', marginBottom: 2 }}>
                  Allowed: ₹{editProduct.min_selling_price ?? editProduct.minSellingPrice ?? 0} - ₹{editProduct.discountPrice ?? editProduct.selling_price ?? editProduct.price ?? 0}
                </Text>
              )}
              <Text style={styles.editModalLabel}>Quantity:</Text>
              <TextInput
                style={styles.editModalInput}
                keyboardType="numeric"
                value={editQty}
                onChangeText={setEditQty}
              />
              {error && <Text style={styles.errorText}>{error}</Text>}
              <View style={styles.editModalButtonRow}>
                <TouchableOpacity
                  style={[styles.editModalButton, { backgroundColor: '#003087' }]}
                  onPress={handleConfirmEditProduct}
                >
                  <Text style={{ color: '#fff', fontWeight: 'bold' }}>Add</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.editModalButton, { backgroundColor: '#bbb' }]}
                  onPress={() => setEditModalVisible(false)}
                >
                  <Text style={{ color: '#222' }}>Cancel</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalBackground: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "flex-end",
  },
  modalContainer: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    height: "90%",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 5,
  },
  modalHeader: {
    backgroundColor: "#003366",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  modalTitle: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "700",
  },
  closeButton: {
    padding: 5,
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f5f5f5",
    borderRadius: 12,
    margin: 16,
    paddingHorizontal: 12,
    elevation: 3,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  searchIcon: {
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    height: 48,
    fontSize: 16,
    color: "#333",
  },
  clearSearchButton: {
    padding: 5,
  },
  filterSection: {
    marginHorizontal: 16,
    marginBottom: 12,
  },
  filterHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  filterTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#003087",
  },
  clearFilterText: {
    color: "#007bff",
    fontSize: 14,
    fontWeight: "500",
  },
  filterButton: {
    backgroundColor: "#f5f5f5",
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    marginRight: 8,
    borderWidth: 1,
    borderColor: "#e0e0e0",
  },
  selectedFilterButton: {
    backgroundColor: "#003087",
    borderColor: "#003087",
  },
  filterButtonText: {
    fontSize: 14,
    color: "#555",
  },
  selectedFilterButtonText: {
    color: "#fff",
    fontWeight: "600",
  },
  clearAllButton: {
    backgroundColor: "#e6f0ff",
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 20,
    alignSelf: "center",
    marginBottom: 12,
  },
  clearAllButtonText: {
    color: "#003087",
    fontSize: 14,
    fontWeight: "600",
  },
  resultsContainer: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  resultsCount: {
    fontSize: 14,
    color: "#666",
    marginBottom: 12,
  },
  productCard: {
    flexDirection: "row",
    backgroundColor: "#fff",
    borderRadius: 12,
    marginBottom: 12,
    padding: 12,
    elevation: 3,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    alignItems: "center",
  },
  productImage: {
    width: 60,
    height: 60,
    borderRadius: 8,
    marginRight: 12,
  },
  placeholderImage: {
    backgroundColor: "#f0f0f0",
    justifyContent: "center",
    alignItems: "center",
  },
  productInfo: {
    flex: 1,
  },
  productName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#222",
    marginBottom: 6,
  },
  tagContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginBottom: 6,
  },
  productTag: {
    backgroundColor: "#e6f0ff",
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 12,
    marginRight: 6,
  },
  productTagText: {
    fontSize: 12,
    color: "#003087",
  },
  priceText: {
    color: "#003087",
    fontWeight: "700",
    fontSize: 16,
  },
  addButton: {
    backgroundColor: "#003087",
    padding: 10,
    borderRadius: 25,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1.5,
  },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    padding: 40,
  },
  emptyText: {
    textAlign: "center",
    marginTop: 12,
    fontSize: 14,
    color: "#888",
    lineHeight: 20,
  },
  errorText: {
    color: "#d32f2f",
    textAlign: "center",
    marginHorizontal: 16,
    marginVertical: 12,
    padding: 12,
    backgroundColor: "#ffebee",
    borderRadius: 8,
    fontSize: 14,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,51,102,0.8)",
    justifyContent: "center",
    alignItems: "center",
  },
  loaderContainer: {
    backgroundColor: "#fff",
    padding: 20,
    borderRadius: 12,
    alignItems: "center",
    elevation: 5,
  },
  loadingText: {
    color: "#003087",
    marginTop: 12,
    fontSize: 14,
    fontWeight: "500",
  },
  editModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  editModalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    width: '85%',
    maxWidth: 400,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    padding: 16,
  },
  editModalTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 16,
    textAlign: 'center',
  },
  editModalLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: '#4B5563',
    marginBottom: 4,
  },
  editModalInput: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 8,
    fontSize: 14,
    color: '#111827',
    marginBottom: 8,
  },
  editModalButtonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
  },
  editModalButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 6,
    alignItems: 'center',
    marginHorizontal: 6,
  },
});

export default SearchProductModal_1;