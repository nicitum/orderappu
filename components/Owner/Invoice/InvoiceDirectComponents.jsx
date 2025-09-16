import React from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    Image,
    TextInput,
    ActivityIndicator,
    StyleSheet,
} from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { ipAddress } from '../../../services/urls';

// COLORS constant
export const COLORS = {
  primary: "#003366",
  primaryLight: "#004488",
  primaryDark: "#002244",
  secondary: "#10B981",
  accent: "#F59E0B",
  success: "#059669",
  error: "#DC2626",
  warning: "#D97706",
  background: "#F8FAFC",
  surface: "#FFFFFF",
  text: {
    primary: "#1F2937",
    secondary: "#6B7280",
    tertiary: "#9CA3AF",
    light: "#FFFFFF",
  },
  border: "#E5E7EB",
  divider: "#F3F4F6",
  card: {
    background: "#FFFFFF",
    shadow: "rgba(0, 0, 0, 0.08)",
  },
};

// Render product item component
export const ProductItem = ({ 
    item, 
    isSelected, 
    onPress, 
    styles 
}) => {
    const imageUri = `http://${ipAddress}:8091/images/products/${item.image}`;

    return (
        <TouchableOpacity
            style={[styles.productCard, isSelected && styles.selectedProductCard]}
            onPress={onPress}
            activeOpacity={0.7}
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
                        <MaterialIcons name="image-not-supported" size={40} color="#CCC" />
                    </View>
                )}
                {isSelected && (
                    <View style={styles.selectedOverlay}>
                        <MaterialIcons name="check-circle" size={24} color={COLORS.success} />
                    </View>
                )}
            </View>
            <View style={styles.productInfo}>
                <Text style={styles.productName} numberOfLines={2}>{item.name}</Text>
                <Text style={styles.productDetails}>
                    {item.category || 'No Category'} • {item.brand || 'No Brand'}
                </Text>
                <Text style={styles.productPrice}>Rs.{item.discountPrice}</Text>
            </View>
        </TouchableOpacity>
    );
};

// Render selected product item component
export const SelectedProductItem = ({ 
    item, 
    onQuantityChange, 
    styles 
}) => {
    return (
        <View style={styles.selectedProductItem}>
            <View style={styles.selectedProductInfo}>
                <Text style={styles.selectedProductName}>{item.name}</Text>
                <Text style={styles.selectedProductPrice}>Rs.{item.price}</Text>
            </View>
            <View style={styles.quantityContainer}>
                <TouchableOpacity
                    style={styles.quantityButton}
                    onPress={() => onQuantityChange(item.product_id, item.quantity - 1)}
                >
                    <MaterialIcons name="remove" size={16} color={COLORS.primary} />
                </TouchableOpacity>
                <TextInput
                    style={styles.quantityInput}
                    value={item.quantity.toString()}
                    onChangeText={(text) => onQuantityChange(item.product_id, parseInt(text) || 0)}
                    keyboardType="numeric"
                />
                <TouchableOpacity
                    style={styles.quantityButton}
                    onPress={() => onQuantityChange(item.product_id, item.quantity + 1)}
                >
                    <MaterialIcons name="add" size={16} color={COLORS.primary} />
                </TouchableOpacity>
            </View>
        </View>
    );
};

// Render user card component
export const UserCard = ({ 
    item, 
    onPress, 
    styles 
}) => {
    return (
        <TouchableOpacity
            style={styles.userCard}
            onPress={onPress}
            activeOpacity={0.7}
        >
            <View style={styles.userCardContent}>
                <View style={styles.userIconContainer}>
                    <MaterialIcons name="person" size={24} color={COLORS.primary} />
                </View>
                <View style={styles.userInfo}>
                    <Text style={styles.userName}>
                        {item.username || `Customer ${item.customer_id}`}
                    </Text>
                    <Text style={styles.userId}>
                        ID: {item.customer_id}
                    </Text>
                </View>
                <MaterialIcons name="arrow-forward-ios" size={16} color={COLORS.text.secondary} />
            </View>
        </TouchableOpacity>
    );
};

// Loading component
export const LoadingComponent = ({ text, styles }) => (
    <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>{text}</Text>
    </View>
);

// Error component
export const ErrorComponent = ({ error, onRetry, styles }) => (
    <View style={styles.errorContainer}>
        <MaterialIcons name="error-outline" size={48} color={COLORS.error} />
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity 
            style={styles.retryButton}
            onPress={onRetry}
        >
            <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
    </View>
);

// No data component
export const NoDataComponent = ({ message, styles }) => (
    <View style={styles.noDataContainer}>
        <MaterialIcons name="person-search" size={48} color={COLORS.text.tertiary} />
        <Text style={styles.noDataText}>{message}</Text>
    </View>
);

// Empty products component
export const EmptyProductsComponent = ({ styles }) => (
    <View style={styles.emptyContainer}>
        <MaterialIcons name="search-off" size={48} color="#CCC" />
        <Text style={styles.noProducts}>No products found</Text>
        <Text style={styles.emptySubText}>Try adjusting your search or filters</Text>
    </View>
);

// Search input component
export const SearchInput = ({ 
    placeholder, 
    value, 
    onChangeText, 
    styles, 
    searchIconStyle 
}) => (
    <View style={styles.searchContainer}>
        <MaterialIcons name="search" size={20} color="#666" style={searchIconStyle} />
        <TextInput
            style={styles.searchInput}
            placeholder={placeholder}
            placeholderTextColor="#666"
            value={value}
            onChangeText={onChangeText}
        />
    </View>
);

// Filter picker component
export const FilterPicker = ({ 
    label, 
    value, 
    icon, 
    styles 
}) => (
    <View style={styles.pickerContainer}>
        <Text style={styles.pickerLabel}>{label}</Text>
        <View style={styles.pickerWrapper}>
            <MaterialIcons name={icon} size={16} color={COLORS.primary} style={styles.pickerIcon} />
            <Text style={styles.pickerText}>{value}</Text>
        </View>
    </View>
);

// Invoice number display component
export const InvoiceNumberDisplay = ({ 
    invoiceNumber, 
    styles 
}) => (
    <View style={styles.inputContainer}>
        <Text style={styles.inputLabel}>Invoice Number</Text>
        <View style={styles.readOnlyInputContainer}>
            <Text style={styles.readOnlyInputText}>{invoiceNumber}</Text>
        </View>
    </View>
);

// Total amount display component
export const TotalAmountDisplay = ({ 
    totalAmount, 
    styles 
}) => (
    <View style={styles.totalContainer}>
        <Text style={styles.totalLabel}>Total Amount:</Text>
        <Text style={styles.totalAmount}>
            Rs.{totalAmount.toFixed(2)}
        </Text>
    </View>
);

// Create button component
export const CreateButton = ({ 
    onPress, 
    isLoading, 
    styles 
}) => (
    <TouchableOpacity
        style={[styles.createButton, isLoading && styles.createButtonDisabled]}
        onPress={onPress}
        disabled={isLoading}
    >
        {isLoading ? (
            <ActivityIndicator size="small" color={COLORS.text.light} />
        ) : (
            <>
                <MaterialIcons name="receipt" size={20} color={COLORS.text.light} />
                <Text style={styles.createButtonText}>Create Invoice</Text>
            </>
        )}
    </TouchableOpacity>
);

// Export all styles
export const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
        backgroundColor: COLORS.primary,
    },
    header: {
        backgroundColor: COLORS.primary,
        paddingHorizontal: 20,
        paddingVertical: 20,
        flexDirection: 'row',
        alignItems: 'center',
    },
    backButton: {
        marginRight: 15,
        padding: 5,
    },
    headerContent: {
        flex: 1,
    },
    headerTitle: {
        fontSize: 24,
        fontWeight: '700',
        color: COLORS.text.light,
        marginBottom: 4,
    },
    headerSubtitle: {
        fontSize: 14,
        color: 'rgba(255, 255, 255, 0.8)',
        fontWeight: '400',
    },
    container: {
        flex: 1,
        backgroundColor: COLORS.background,
    },
    content: {
        padding: 20,
    },
    card: {
        backgroundColor: COLORS.surface,
        borderRadius: 16,
        padding: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.10,
        shadowRadius: 8,
        elevation: 4,
    },
    title: {
        fontSize: 26,
        fontWeight: '800',
        color: COLORS.primary,
        marginBottom: 24,
        textAlign: 'center',
        letterSpacing: 0.5,
    },
    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 20,
        backgroundColor: COLORS.background,
        borderRadius: 12,
        paddingHorizontal: 15,
        paddingVertical: 12,
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    searchInput: {
        fontSize: 16,
        color: COLORS.text.primary,
        flex: 1,
        paddingVertical: 4,
    },
    userCard: {
        backgroundColor: COLORS.surface,
        borderRadius: 12,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: COLORS.border,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 1,
    },
    userCardContent: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
    },
    userIconContainer: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: COLORS.background,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 15,
    },
    userInfo: {
        flex: 1,
    },
    userName: {
        fontSize: 17,
        fontWeight: '600',
        color: COLORS.text.primary,
        marginBottom: 4,
    },
    userId: {
        fontSize: 14,
        color: COLORS.text.secondary,
        fontWeight: '500',
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 40,
    },
    loadingText: {
        marginTop: 15,
        fontSize: 16,
        color: COLORS.text.secondary,
        fontWeight: '500',
    },
    errorContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 40,
    },
    errorText: {
        fontSize: 16,
        color: COLORS.error,
        textAlign: 'center',
        marginTop: 15,
        marginBottom: 20,
        fontWeight: '500',
    },
    retryButton: {
        backgroundColor: COLORS.primary,
        paddingHorizontal: 20,
        paddingVertical: 10,
        borderRadius: 8,
    },
    retryButtonText: {
        color: COLORS.text.light,
        fontSize: 14,
        fontWeight: '600',
    },
    noDataContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 40,
    },
    noDataText: {
        fontSize: 16,
        color: COLORS.text.secondary,
        textAlign: 'center',
        marginTop: 15,
        fontWeight: '500',
    },
    flatListStyle: {
        maxHeight: 400, // Limit the height to prevent overflow
    },
    // Product list styles
    searchIcon: {
        marginLeft: 16,
    },
    filterContainer: {
        flexDirection: "row",
        paddingHorizontal: 16,
        marginBottom: 16,
        gap: 12,
    },
    pickerContainer: {
        flex: 1,
        backgroundColor: COLORS.surface,
        borderRadius: 12,
        padding: 12,
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    pickerLabel: {
        fontSize: 12,
        color: COLORS.text.secondary,
        marginBottom: 4,
        fontWeight: '500',
    },
    pickerWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    pickerIcon: {
        marginRight: 6,
    },
    pickerText: {
        fontSize: 14,
        color: COLORS.text.primary,
        fontWeight: '500',
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
        backgroundColor: COLORS.surface,
        borderRadius: 12,
        width: "48%",
        marginBottom: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
        elevation: 2,
        overflow: 'hidden',
    },
    imageContainer: {
        width: "100%",
        height: 160,
        backgroundColor: COLORS.background,
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
        backgroundColor: COLORS.background,
    },
    productInfo: {
        padding: 12,
    },
    productName: {
        color: COLORS.text.primary,
        fontSize: 14,
        fontWeight: "600",
        marginBottom: 4,
        height: 40,
    },
    productDetails: {
        color: COLORS.text.secondary,
        fontSize: 12,
        marginBottom: 8,
    },
    productPrice: {
        color: COLORS.primary,
        fontSize: 16,
        fontWeight: "700",
    },
    emptyContainer: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        paddingTop: 48,
    },
    noProducts: {
        color: COLORS.text.secondary,
        fontSize: 16,
        marginTop: 12,
        fontWeight: "600",
    },
    emptySubText: {
        color: COLORS.text.tertiary,
        fontSize: 14,
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
    // Header button styles
    createInvoiceButton: {
        padding: 8,
        marginLeft: 10,
    },
    // Product selection styles
    selectedProductCard: {
        borderColor: COLORS.success,
        borderWidth: 2,
    },
    selectedOverlay: {
        position: 'absolute',
        top: 8,
        right: 8,
        backgroundColor: 'rgba(255, 255, 255, 0.9)',
        borderRadius: 12,
        padding: 2,
    },
    // Invoice creation styles
    inputContainer: {
        marginBottom: 20,
    },
    inputLabel: {
        fontSize: 16,
        fontWeight: '600',
        color: COLORS.text.primary,
        marginBottom: 8,
    },
    textInput: {
        borderWidth: 1,
        borderColor: COLORS.border,
        borderRadius: 8,
        padding: 12,
        fontSize: 16,
        color: COLORS.text.primary,
        backgroundColor: COLORS.surface,
    },
    readOnlyInputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderWidth: 1,
        borderColor: COLORS.border,
        borderRadius: 8,
        padding: 12,
        backgroundColor: COLORS.background,
    },
    readOnlyInputText: {
        fontSize: 16,
        color: COLORS.text.primary,
        fontWeight: '600',
        flex: 1,
    },
    selectedProductsContainer: {
        marginBottom: 20,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: COLORS.text.primary,
        marginBottom: 12,
    },
    selectedProductsList: {
        maxHeight: 200,
    },
    selectedProductItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: COLORS.background,
        padding: 12,
        borderRadius: 8,
        marginBottom: 8,
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    selectedProductInfo: {
        flex: 1,
    },
    selectedProductName: {
        fontSize: 14,
        fontWeight: '600',
        color: COLORS.text.primary,
        marginBottom: 4,
    },
    selectedProductPrice: {
        fontSize: 12,
        color: COLORS.text.secondary,
    },
    quantityContainer: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    quantityButton: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: COLORS.background,
        borderWidth: 1,
        borderColor: COLORS.border,
        justifyContent: 'center',
        alignItems: 'center',
    },
    quantityInput: {
        width: 50,
        height: 32,
        textAlign: 'center',
        fontSize: 14,
        fontWeight: '600',
        color: COLORS.text.primary,
        marginHorizontal: 8,
        borderWidth: 1,
        borderColor: COLORS.border,
        borderRadius: 4,
        backgroundColor: COLORS.surface,
    },
    totalContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: COLORS.background,
        padding: 16,
        borderRadius: 8,
        marginBottom: 20,
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    totalLabel: {
        fontSize: 18,
        fontWeight: '600',
        color: COLORS.text.primary,
    },
    totalAmount: {
        fontSize: 20,
        fontWeight: '700',
        color: COLORS.primary,
    },
    createButton: {
        backgroundColor: COLORS.primary,
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 16,
        borderRadius: 8,
        marginTop: 10,
    },
    createButtonDisabled: {
        backgroundColor: COLORS.text.tertiary,
    },
    createButtonText: {
        color: COLORS.text.light,
        fontSize: 16,
        fontWeight: '600',
        marginLeft: 8,
    },
    // Invoice retrieval styles
    retrievedInvoiceContainer: {
        marginTop: 20,
    },
    invoiceInfoContainer: {
        backgroundColor: COLORS.background,
        padding: 20,
        borderRadius: 12,
        marginBottom: 20,
        borderWidth: 1,
        borderColor: COLORS.border,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 2,
    },
    invoiceInfoText: {
        fontSize: 15,
        color: COLORS.text.primary,
        marginBottom: 10,
        fontWeight: '500',
        lineHeight: 22,
    },
    invoiceInfoLabel: {
        fontWeight: '700',
        color: COLORS.primary,
    },
    productsContainer: {
        marginTop: 16,
    },
    retrievedProductItem: {
        backgroundColor: COLORS.background,
        padding: 12,
        borderRadius: 8,
        marginBottom: 8,
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    retrievedProductName: {
        fontSize: 14,
        fontWeight: '600',
        color: COLORS.text.primary,
        marginBottom: 4,
    },
    retrievedProductDetails: {
        fontSize: 12,
        color: COLORS.text.secondary,
        marginBottom: 2,
    },
    retrievedProductApproved: {
        fontSize: 12,
        color: COLORS.success,
        fontWeight: '500',
    },
    retrievedProductsList: {
        maxHeight: 300,
    },
    // PDF action buttons styles
    pdfActionButtons: {
        flexDirection: 'column',
        marginTop: 24,
        gap: 12,
        paddingHorizontal: 4,
    },
    shareButton: {
        backgroundColor: COLORS.success,
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        paddingVertical: 16,
        paddingHorizontal: 24,
        borderRadius: 12,
        shadowColor: COLORS.success,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 6,
    },
    shareButtonDisabled: {
        backgroundColor: COLORS.text.tertiary,
        shadowOpacity: 0.1,
        elevation: 2,
    },
    shareButtonText: {
        color: COLORS.text.light,
        fontSize: 16,
        fontWeight: '700',
        marginLeft: 10,
        letterSpacing: 0.5,
    },
    cancelButton: {
        backgroundColor: COLORS.error,
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        paddingVertical: 16,
        paddingHorizontal: 24,
        borderRadius: 12,
        shadowColor: COLORS.error,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 6,
    },
    cancelButtonText: {
        color: COLORS.text.light,
        fontSize: 16,
        fontWeight: '700',
        marginLeft: 10,
        letterSpacing: 0.5,
    },
    addProductButton: {
        backgroundColor: COLORS.primary,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 16,
        paddingHorizontal: 24,
        borderRadius: 12,
        marginVertical: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    addProductButtonText: {
        color: COLORS.text.light,
        fontSize: 16,
        fontWeight: '700',
        marginLeft: 10,
        letterSpacing: 0.5,
    },
    addProductButtonDisabled: {
        backgroundColor: COLORS.text.secondary,
        opacity: 0.6,
    },
    customerInfoContainer: {
        backgroundColor: COLORS.background.light,
        padding: 16,
        borderRadius: 8,
        marginBottom: 16,
        borderLeftWidth: 4,
        borderLeftColor: COLORS.primary,
    },
    customerInfoLabel: {
        fontSize: 12,
        fontWeight: '600',
        color: COLORS.text.secondary,
        marginBottom: 4,
    },
    customerInfoText: {
        fontSize: 16,
        fontWeight: '700',
        color: COLORS.text.primary,
    },
    optionButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
        padding: 16,
        borderRadius: 8,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    optionIconContainer: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#FFFFFF',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
        borderWidth: 1,
        borderColor: COLORS.primary,
    },
    optionContent: {
        flex: 1,
    },
    optionTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: COLORS.primary,
        marginBottom: 2,
    },
    optionDescription: {
        fontSize: 13,
        color: COLORS.text.secondary,
        lineHeight: 18,
    },
    // Scrollable invoice creation styles
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        flexGrow: 1,
        paddingBottom: 20,
    },
    fixedButtonContainer: {
        backgroundColor: COLORS.surface,
        paddingHorizontal: 20,
        paddingVertical: 16,
        borderTopWidth: 1,
        borderTopColor: COLORS.border,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 5,
    },
});
