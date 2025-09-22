import React, { useState, useEffect, useCallback } from "react";
import { View, Text, StyleSheet, ActivityIndicator, ScrollView, Platform, RefreshControl, Alert, Animated, PermissionsAndroid, ToastAndroid } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { jwtDecode } from "jwt-decode";
import axios from "axios";
import RNFS from "react-native-fs";
import Share from "react-native-share";
import DateTimePickerModal from "react-native-modal-datetime-picker";
import { Checkbox, Card, Button, FAB } from "react-native-paper";
import moment from "moment";
import Icon from "react-native-vector-icons/MaterialCommunityIcons";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { useFontScale } from '../../App';

// Color Constants
const COLORS = {
  primary: "#003366", // Deep Blue
  primaryLight: "#004488",
  primaryDark: "#002244",
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
};

// Replace with your actual IP address
import { ipAddress } from "../../services/urls";

const InvoiceAdmin = ({ navigation }) => {
  const { getScaledSize } = useFontScale();
  const [adminId, setAdminId] = useState(null);
  const [orders, setOrders] = useState([]);
  const [assignedUsers, setAssignedUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isDatePickerVisible, setDatePickerVisibility] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectAllChecked, setSelectAllChecked] = useState(false);
  const [selectedOrderIds, setSelectedOrderIds] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [generatingInvoice, setGeneratingInvoice] = useState(false);
  const scrollY = new Animated.Value(0);

  // Header animation values
  const headerHeight = scrollY.interpolate({
    inputRange: [0, 100],
    outputRange: [120, 80],
    extrapolate: "clamp",
  });

  const headerOpacity = scrollY.interpolate({
    inputRange: [0, 100],
    outputRange: [1, 0.8],
    extrapolate: "clamp",
  });

  // Number to Words Function
  const numberToWords = (num) => {
    const units = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine"];
    const teens = ["Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
    const tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];
    const thousands = ["", "Thousand", "Million", "Billion"];

    if (num === 0) return "Zero Rupees Only";

    const rupees = Math.floor(num);
    const paise = Math.round((num - rupees) * 100);

    const rupeesToWords = (num) => {
      if (num === 0) return "";
      let numStr = num.toString();
      let words = [];
      let chunkCount = 0;

      while (numStr.length > 0) {
        let chunk = parseInt(numStr.slice(-3)) || 0;
        numStr = numStr.slice(0, -3);

        if (chunk > 0) {
          let chunkWords = [];
          let hundreds = Math.floor(chunk / 100);
          let remainder = chunk % 100;

          if (hundreds > 0) {
            chunkWords.push(`${units[hundreds]} Hundred`);
          }

          if (remainder > 0) {
            if (remainder < 10) {
              chunkWords.push(units[remainder]);
            } else if (remainder < 20) {
              chunkWords.push(teens[remainder - 10]);
            } else {
              let ten = Math.floor(remainder / 10);
              let unit = remainder % 10;
              chunkWords.push(tens[ten] + (unit > 0 ? ` ${units[unit]}` : ""));
            }
          }

          if (chunkCount > 0) {
            chunkWords.push(thousands[chunkCount]);
          }
          words.unshift(chunkWords.join(" "));
        }
        chunkCount++;
      }
      return words.join(" ");
    };

    const paiseToWords = (num) => {
      if (num === 0) return "";
      if (num < 10) return units[num];
      if (num < 20) return teens[num - 10];
      let ten = Math.floor(num / 10);
      let unit = num % 10;
      return tens[ten] + (unit > 0 ? ` ${units[unit]}` : "");
    };

    const rupeesPart = rupeesToWords(rupees);
    const paisePart = paiseToWords(paise);

    let result = "";
    if (rupeesPart) result += `${rupeesPart} Rupees`;
    if (paisePart) result += `${rupeesPart ? " and " : ""}${paisePart} Paise`;
    result += " Only";

    return result.trim() || "Zero Rupees Only";
  };

  // Fetch assigned users
  const fetchAssignedUsers = useCallback(
    async (currentAdminId, userAuthToken) => {
      try {
        const response = await fetch(`http://${ipAddress}:8091/assigned-users/${currentAdminId}`, {
          headers: {
            Authorization: `Bearer ${userAuthToken}`,
            "Content-Type": "application/json",
          },
        });

        if (!response.ok) {
          throw new Error(`Failed to fetch assigned users. Status: ${response.status}`);
        }

        const responseData = await response.json();
        if (responseData.success) {
          setAssignedUsers(responseData.assignedUsers);
        } else {
          setError(responseData.message || "Failed to fetch assigned users.");
        }
      } catch (err) {
        console.error("Error fetching assigned users:", err);
        setError("Error fetching assigned users. Please try again.");
      }
    },
    []
  );

  // Fetch orders
  const fetchOrders = useCallback(
    async (dateFilter) => {
      setLoading(true);
      try {
        const token = await AsyncStorage.getItem("userAuthToken");
        const decodedToken = jwtDecode(token);
        const adminId = decodedToken.id1;
        setAdminId(adminId);

        const url = `http://${ipAddress}:8091/get-admin-orders/${adminId}`;
        const headers = {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        };

        const ordersResponse = await fetch(url, { headers });

        if (!ordersResponse.ok) {
          const errorText = await ordersResponse.text();
          throw new Error(`Failed to fetch admin orders. Status: ${ordersResponse.status}, Text: ${errorText}`);
        }

        const ordersData = await ordersResponse.json();
        let fetchedOrders = ordersData.orders;

        let filteredOrders = fetchedOrders;
        if (dateFilter) {
          const filterDateFormatted = moment(dateFilter).format("YYYY-MM-DD");
          filteredOrders = fetchedOrders.filter((order) => {
            if (!order.placed_on) return false;
            const parsedEpochSeconds = parseInt(order.placed_on, 10);
            const orderDateMoment = moment.unix(parsedEpochSeconds);
            return orderDateMoment.format("YYYY-MM-DD") === filterDateFormatted;
          });
        } else {
          const todayFormatted = moment().format("YYYY-MM-DD");
          filteredOrders = fetchedOrders.filter((order) => {
            if (!order.placed_on) return false;
            const parsedEpochSeconds = parseInt(order.placed_on, 10);
            const orderDateMoment = moment.unix(parsedEpochSeconds);
            return orderDateMoment.format("YYYY-MM-DD") === todayFormatted;
          });
        }

        setOrders(filteredOrders);
        setSelectAllChecked(false);
        setSelectedOrderIds([]);
        await fetchAssignedUsers(adminId, token);
      } catch (fetchOrdersError) {
        console.error("FETCH ADMIN ORDERS - Fetch Error:", fetchOrdersError);
        Alert.alert("Error", fetchOrdersError.message || "Failed to fetch admin orders.");
      } finally {
        setLoading(false);
      }
    },
    [fetchAssignedUsers]
  );

  // Fetch order products
  const fetchOrderProducts = useCallback(async (orderId) => {
    try {
      const token = await AsyncStorage.getItem("userAuthToken");
      if (!token) throw new Error("No authorization token found.");

      const response = await axios.get(`http://${ipAddress}:8091/order-products?orderId=${orderId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      return response.data;
    } catch (error) {
      console.error("Error fetching order products:", error);
      Alert.alert("Error", "Failed to fetch order details.");
      return [];
    }
  }, []);

  // Fetch products with customer-specific pricing
  const fetchProducts = useCallback(async (customerId) => {
    try {
      setLoading(true);
      const userAuthToken = await AsyncStorage.getItem("userAuthToken");

      const response = await axios.get(`http://${ipAddress}:8091/products`, {
        headers: {
          Authorization: `Bearer ${userAuthToken}`,
          "Content-Type": "application/json",
        },
      });
      const products = response.data;

      if (!customerId) {
        console.warn("No customer ID provided; using default product prices.");
        return products.map((product) => ({
          ...product,
          price: parseFloat(product.price || 0),
          gstRate: parseFloat(product.gst_rate || 0),
        }));
      }

      const productsWithPricesPromises = products.map(async (product) => {
        try {
          const priceResponse = await axios.get(`http://${ipAddress}:8091/customer-product-price`, {
            params: {
              product_id: product.id,
              customer_id: customerId,
            },
            headers: {
              Authorization: `Bearer ${userAuthToken}`,
            },
          });
          const basePrice = parseFloat(priceResponse.data.effectivePrice || product.price || 0);
          const gstRate = parseFloat(product.gst_rate || 0);
          const gstAmount = (basePrice * gstRate) / 100;
          const finalPrice = basePrice + gstAmount;

          return {
            ...product,
            price: basePrice,
            gstRate: gstRate,
            gstAmount: gstAmount,
            finalPrice: finalPrice,
          };
        } catch (priceError) {
          console.error(`Error fetching price for product ${product.id}:`, priceError);
          const basePrice = parseFloat(product.price || 0);
          const gstRate = parseFloat(product.gst_rate || 0);
          const gstAmount = (basePrice * gstRate) / 100;
          const finalPrice = basePrice + gstAmount;
          return {
            ...product,
            price: basePrice,
            gstRate: gstRate,
            gstAmount: gstAmount,
            finalPrice: finalPrice,
          };
        }
      });

      const productsWithPrices = await Promise.all(productsWithPricesPromises);
      return productsWithPrices;
    } catch (error) {
      console.error("Error fetching products:", error);
      Alert.alert("Error", "Failed to fetch products.");
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  // Helper function to convert Uint8Array to base64 (for React Native compatibility)
  const uint8ToBase64 = (uint8) => {
    if (!uint8 || !uint8.length) {
      throw new Error('Invalid PDF data provided');
    }
    let binary = '';
    for (let i = 0; i < uint8.length; i++) {
      binary += String.fromCharCode(uint8[i]);
    }
    if (typeof global !== 'undefined' && global.btoa) {
      return global.btoa(binary);
    } else if (typeof btoa !== 'undefined') {
      return btoa(binary);
    } else {
      throw new Error('No base64 encoding function available');
    }
  };

  // Helper function to save PDF to downloads (works on all Android versions)
  const savePDFToDownloads = async (pdfBytes, fileName) => {
    try {
      // For Android 10+ (API 29+), we use scoped storage approach
      if (Platform.OS === 'android' && Platform.Version >= 29) {
        // On Android 10+, we can write to Download directory without permissions
        const filePath = `${RNFS.DownloadDirectoryPath}/${fileName}`;
        const base64Data = uint8ToBase64(pdfBytes);
        await RNFS.writeFile(filePath, base64Data, 'base64');
        
        ToastAndroid.show(`PDF saved to Downloads as ${fileName}`, ToastAndroid.LONG);
        return filePath;
      } 
      // For older Android versions, we need explicit permissions
      else if (Platform.OS === 'android') {
        // Request storage permissions
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE,
          {
            title: "Storage Permission",
            message: "App needs access to storage to save PDFs",
            buttonPositive: "OK"
          }
        );
        
        if (granted === PermissionsAndroid.RESULTS.GRANTED) {
          const filePath = `${RNFS.DownloadDirectoryPath}/${fileName}`;
          const base64Data = uint8ToBase64(pdfBytes);
          await RNFS.writeFile(filePath, base64Data, 'base64');
          
          ToastAndroid.show(`PDF saved to Downloads as ${fileName}`, ToastAndroid.LONG);
          return filePath;
        } else {
          Alert.alert("Permission Denied", "Cannot save PDF without storage permission");
          return null;
        }
      } 
      // For iOS
      else {
        const filePath = `${RNFS.DocumentDirectoryPath}/${fileName}`;
        const base64Data = uint8ToBase64(pdfBytes);
        await RNFS.writeFile(filePath, base64Data, 'base64');
        return filePath;
      }
    } catch (error) {
      console.error("Error saving PDF:", error);
      Alert.alert("Error", `Failed to save PDF: ${error.message}`);
      return null;
    }
  };

  // Legacy save function for backward compatibility with other parts of the app
  const save = async (uri, filename, mimetype, reportType) => {
    if (Platform.OS === "android") {
      try {
        // Use the new savePDFToDownloads helper under the hood for Android
        if (uri.startsWith('file://')) {
          uri = uri.replace('file://', '');
        }
        const data = await RNFS.readFile(uri, 'base64');
        const bytes = new Uint8Array(data.length);
        for (let i = 0; i < data.length; i++) {
          bytes[i] = data.charCodeAt(i);
        }
        
        const filePath = await savePDFToDownloads(bytes, filename);
        if (!filePath) throw new Error('Failed to save file');
        
        return filePath;
      } catch (error) {
        console.error("Error saving file:", error);
        Alert.alert("Info", `Failed to save ${reportType}. Sharing instead.`);
        try {
          await Share.open({
            url: uri,
            type: mimetype,
            title: reportType,
          });
        } catch (shareError) {
          console.error("Error sharing file:", shareError);
          Alert.alert("Error", `Failed to save or share ${reportType}.`);
        }
      }
    } else {
      try {
        await Share.open({
          url: uri,
          type: mimetype,
          title: reportType,
        });
      } catch (error) {
        console.error("Error sharing file:", error);
        Alert.alert("Error", `Failed to share ${reportType}.`);
      }
    }
  };

  // Post invoice to API
  const postInvoiceToAPI = useCallback(async (orderId, invoiceId, orderPlacedOn) => {
    try {
      const token = await AsyncStorage.getItem("userAuthToken");
      const invoiceDate = moment().unix();

      const response = await axios.post(
        `http://${ipAddress}:8091/invoice`,
        {
          order_id: orderId,
          invoice_id: invoiceId,
          order_date: parseInt(orderPlacedOn),
          invoice_date: invoiceDate,
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );

      console.log("Invoice posted successfully:", response.data);
      return response.data;
    } catch (error) {
      console.error("Error posting invoice to API:", error.response?.data || error.message);
      throw new Error("Failed to save invoice data to server.");
    }
  }, []);

  // Generate PDF using pdf-lib
  const generatePDF = async (order, invoiceProducts, customer, invoiceNumber, subTotal, totalGstAmount, cgstAmount, sgstAmount, grandTotal, totalInWords) => {
    try {
      const pdfDoc = await PDFDocument.create();
      const page = pdfDoc.addPage([595.28, 841.89]); // A4 size
      const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const helveticaBoldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
      const primaryColor = rgb(0, 0.2, 0.4);
      const textColor = rgb(0, 0, 0);
      const secondaryColor = rgb(0.4, 0.4, 0.4);

      // Header
      page.drawRectangle({ x: 0, y: 780, width: 595.28, height: 60, color: primaryColor });
      page.drawText("Order Appu", { x: 250, y: 805, size: 28, font: helveticaBoldFont, color: rgb(1, 1, 1) });
      page.drawText("Bangalore - 560068", { x: 250, y: 785, size: 10, font: helveticaFont, color: rgb(1, 1, 1), opacity: 0.8 });

      // Customer and Invoice Information
      page.drawText("Customer Information", { x: 50, y: 740, size: 14, font: helveticaBoldFont, color: primaryColor });
      page.drawText(`Name: ${customer.name}`, { x: 50, y: 720, size: 10, font: helveticaBoldFont, color: textColor });
      page.drawText(`Phone: ${customer.phone}`, { x: 50, y: 705, size: 10, font: helveticaBoldFont, color: textColor });
      const addressLines = customer.delivery_address?.split(",").map((line) => line.trim()) || ["N/A"];
      let addressY = 690;
      addressLines.forEach((line) => {
        page.drawText(line, { x: 50, y: addressY, size: 10, font: helveticaFont, color: textColor });
        addressY -= 15;
      });

      page.drawText("Invoice No:", { x: 350, y: 740, size: 10, font: helveticaBoldFont, color: textColor });
      page.drawText(invoiceNumber, { x: 450, y: 740, size: 10, font: helveticaFont, color: textColor });
      page.drawText("Order ID:", { x: 350, y: 725, size: 10, font: helveticaBoldFont, color: textColor });
      page.drawText(`${order.id}`, { x: 450, y: 725, size: 10, font: helveticaFont, color: textColor });
      page.drawText("Date:", { x: 350, y: 710, size: 10, font: helveticaBoldFont, color: textColor });
      page.drawText(new Date().toLocaleDateString(), { x: 450, y: 710, size: 10, font: helveticaFont, color: textColor });

      // Products Table
      page.drawText("Order Items", { x: 50, y: addressY - 20, size: 14, font: helveticaBoldFont, color: primaryColor });
      page.drawRectangle({ x: 50, y: addressY - 45, width: 495, height: 25, color: rgb(0.95, 0.95, 0.95) });
      const headers = ["S.No", "Item Name", "HSN", "Qty", "UOM", "Rate", "Value"];
      const headerPositions = [50, 80, 250, 350, 400, 450, 500];
      headers.forEach((header, index) => {
        page.drawText(header, { x: headerPositions[index], y: addressY - 35, size: 10, font: helveticaBoldFont, color: textColor });
      });

      let itemY = addressY - 55;
      invoiceProducts.forEach((item, index) => {
        if (index % 2 === 0) {
          page.drawRectangle({ x: 50, y: itemY - 15, width: 495, height: 20, color: rgb(0.98, 0.98, 0.98) });
        }
        page.drawText(`${item.serialNumber}`, { x: 50, y: itemY, size: 10, font: helveticaFont, color: textColor });
        page.drawText(item.name, { x: 80, y: itemY, size: 10, font: helveticaFont, color: textColor });
        page.drawText(item.hsn_code || "N/A", { x: 250, y: itemY, size: 10, font: helveticaFont, color: textColor });
        page.drawText(`${item.quantity}`, { x: 350, y: itemY, size: 10, font: helveticaFont, color: textColor });
        page.drawText(item.uom, { x: 400, y: itemY, size: 10, font: helveticaFont, color: textColor });
        page.drawText(`Rs. ${item.rate}`, { x: 450, y: itemY, size: 10, font: helveticaFont, color: textColor });
        page.drawText(`Rs. ${item.value}`, { x: 500, y: itemY, size: 10, font: helveticaFont, color: textColor });
        itemY -= 20;
      });

      // Total and Certification Section
      page.drawLine({ start: { x: 50, y: itemY - 10 }, end: { x: 545, y: itemY - 10 }, thickness: 1, color: primaryColor });
      itemY -= 20;
      page.drawText("We hereby certify that its products mentioned in the said", { x: 50, y: itemY, size: 10, font: helveticaFont, color: textColor });
      itemY -= 15;
      page.drawText("invoices are warranted to be of the nature and quality", { x: 50, y: itemY, size: 10, font: helveticaFont, color: textColor });
      itemY -= 15;
      page.drawText("which they are purported to be.", { x: 50, y: itemY, size: 10, font: helveticaFont, color: textColor });
      itemY -= 30;
      page.drawText(`(${totalInWords})`, { x: 50, y: itemY, size: 12, font: helveticaBoldFont, color: textColor, opacity: 0.8 });

      page.drawText("Subtotal:", { x: 350, y: itemY + 60, size: 10, font: helveticaBoldFont, color: textColor });
      page.drawText(`Rs. ${subTotal}`, { x: 500, y: itemY + 60, size: 10, font: helveticaFont, color: textColor });
      page.drawText("CGST:", { x: 350, y: itemY + 45, size: 10, font: helveticaBoldFont, color: textColor });
      page.drawText(`Rs. ${cgstAmount}`, { x: 500, y: itemY + 45, size: 10, font: helveticaFont, color: textColor });
      page.drawText("SGST:", { x: 350, y: itemY + 30, size: 10, font: helveticaBoldFont, color: textColor });
      page.drawText(`Rs. ${sgstAmount}`, { x: 500, y: itemY + 30, size: 10, font: helveticaFont, color: textColor });
      page.drawText("Total:", { x: 350, y: itemY + 15, size: 12, font: helveticaBoldFont, color: primaryColor });
      page.drawText(`Rs. ${grandTotal}`, { x: 500, y: itemY + 15, size: 12, font: helveticaBoldFont, color: primaryColor });
      page.drawText("Order Appu", { x: 400, y: itemY - 10, size: 12, font: helveticaBoldFont, color: textColor });
      page.drawText("Authorized Signatory", { x: 400, y: itemY - 30, size: 10, font: helveticaBoldFont, color: textColor });

      // Save PDF
      const pdfBytes = await pdfDoc.save();
      const fileName = `invoice_${invoiceNumber}.pdf`;
      
      // Save directly to Downloads using our helper function
      const filePath = await savePDFToDownloads(pdfBytes, fileName);
      if (!filePath) {
        throw new Error('Failed to save PDF');
      }
      
      return { filePath, fileName };
    } catch (error) {
      console.error("Error generating PDF:", error);
      Alert.alert("Error", "Failed to generate invoice PDF");
      throw error;
    }
  };

  // Generate single invoice
  const generateInvoice = useCallback(
    async (order) => {
      setLoading(true);
      try {
        const orderId = order.id;
        const customerId = order.customer_id;
        const orderProducts = await fetchOrderProducts(orderId);
        const allProducts = await fetchProducts(customerId);

        const invoiceProducts = orderProducts
          .map((op, index) => {
            const product = allProducts.find((p) => p.id === op.product_id);
            if (!product) {
              console.error(`Product not found for productId: ${op.product_id}`);
              return null;
            }

            const basePrice = parseFloat(product.price);
            const gstRate = parseFloat(product.gstRate || 0);
            const value = (op.quantity * basePrice).toFixed(2);
            const gstAmount = (parseFloat(value) * (gstRate / 100)).toFixed(2);

            return {
              serialNumber: index + 1,
              name: product.name,
              hsn_code: product.hsn_code || "N/A",
              quantity: op.quantity,
              uom: "Pkts",
              rate: basePrice.toFixed(2),
              value: value,
              gstAmount: gstAmount,
            };
          })
          .filter(Boolean);

        if (invoiceProducts.length === 0) {
          Alert.alert("Error", "Could not generate invoice due to missing product information.");
          return;
        }

        const customer = assignedUsers.find((user) => user.customer_id === order.customer_id) || {
          name: "Unknown",
          phone: "N/A",
          customer_id: "N/A",
          delivery_address: "N/A",
        };

        const subTotal = invoiceProducts.reduce((acc, item) => acc + parseFloat(item.value), 0).toFixed(2);
        const totalGstAmount = invoiceProducts.reduce((acc, item) => acc + parseFloat(item.gstAmount), 0).toFixed(2);
        const cgstAmount = (parseFloat(totalGstAmount) / 2).toFixed(2);
        const sgstAmount = (parseFloat(totalGstAmount) / 2).toFixed(2);
        const grandTotal = (parseFloat(subTotal) + parseFloat(totalGstAmount)).toFixed(2);

        const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
        const randomNum = Math.floor(1000 + Math.random() * 9000);
        const invoiceNumber = `INV-${dateStr}-${randomNum}`;
        const totalInWords = numberToWords(parseFloat(grandTotal));

        const formattedSubTotal = `Rs. ${subTotal}`;
        const formattedTotalGstAmount = `Rs. ${totalGstAmount}`;
        const formattedCgstAmount = `Rs. ${cgstAmount}`;
        const formattedSgstAmount = `Rs. ${sgstAmount}`;
        const formattedGrandTotal = `Rs. ${grandTotal}`;

        try {
          const { filePath, fileName } = await generatePDF(
            order,
            invoiceProducts,
            customer,
            invoiceNumber,
            formattedSubTotal,
            formattedTotalGstAmount,
            formattedCgstAmount,
            formattedSgstAmount,
            formattedGrandTotal,
            totalInWords
          );
          
          // No need to call save() as the PDF is already saved to Downloads by generatePDF
          if (Platform.OS === "android") {
            ToastAndroid.show(`Invoice saved to Downloads as ${fileName}`, ToastAndroid.LONG);
          } else {
            // On iOS, we still need to share
            await Share.open({
              url: `file://${filePath}`,
              type: "application/pdf",
              title: fileName,
            });
          }
          // Invoice generation completed
        } catch (error) {
          console.error("Error creating invoice:", error);
          Alert.alert("Error", "Failed to create invoice.");
          // Error handling complete
        }
      } catch (error) {
        console.error("Error generating invoice:", error);
        Alert.alert("Error", "Failed to generate or save the invoice.");
      } finally {
        setLoading(false);
      }
    },
    [fetchOrderProducts, fetchProducts, assignedUsers]
  );

  // Generate bulk invoices
  const generateBulkInvoices = useCallback(async () => {
    const ordersToProcess = selectAllChecked ? orders : orders.filter((order) => selectedOrderIds.includes(order.id));
    if (ordersToProcess.length === 0) {
      Alert.alert("Alert", "No orders selected to generate invoices.");
      return;
    }

    setLoading(true);
    try {
      let successCount = 0;
      let errorCount = 0;

      for (const order of ordersToProcess) {
        try {
          await generateInvoice(order);
          successCount++;
        } catch (error) {
          console.error(`Error generating invoice for order ${order.id}:`, error);
          errorCount++;
        }
      }

      Alert.alert(
        "Bulk Invoice Generation",
        `Successfully generated ${successCount} invoice(s).${errorCount > 0 ? ` Failed to generate ${errorCount} invoice(s).` : ""}`
      );
    } catch (error) {
      console.error("Error generating bulk invoices:", error);
      Alert.alert("Error", "Failed to generate all invoices.");
    } finally {
      setLoading(false);
    }
  }, [orders, selectedOrderIds, selectAllChecked, generateInvoice]);

  // Date picker handlers
  const showDatePicker = () => setDatePickerVisibility(true);
  const hideDatePicker = () => setDatePickerVisibility(false);
  const handleConfirmDate = (date) => {
    setSelectedDate(date);
    fetchOrders(date);
    hideDatePicker();
  };

  // Checkbox handlers
  const handleOrderCheckboxChange = useCallback((orderId) => {
    setSelectedOrderIds((prevSelected) =>
      prevSelected.includes(orderId) ? prevSelected.filter((id) => id !== orderId) : [...prevSelected, orderId]
    );
  }, []);

  const handleSelectAllCheckboxChange = useCallback(() => {
    setSelectAllChecked((prev) => !prev);
    setSelectedOrderIds(!selectAllChecked ? orders.map((order) => order.id) : []);
  }, [selectAllChecked, orders]);

  // Refresh handler
  const onRefresh = React.useCallback(() => {
    setRefreshing(true);
    fetchOrders(selectedDate).finally(() => setRefreshing(false));
  }, [fetchOrders, selectedDate]);

  // Initial fetch
  useEffect(() => {
    fetchOrders(selectedDate);
  }, [fetchOrders, selectedDate]);

  const renderOrderCard = (order) => {
    const isSelected = selectedOrderIds.includes(order.id);
    const customer = assignedUsers.find((user) => user.customer_id === order.customer_id) || { name: "Unknown" };
    const orderDate = moment.unix(parseInt(order.placed_on)).format("DD MMM YYYY, hh:mm A");

    return (
      <Card key={order.id} style={[styles.orderCard, isSelected && styles.selectedCard]}>
        <Card.Content>
          <View style={styles.orderHeader}>
            <View style={styles.orderInfo}>
              <Text style={[styles.orderId, { fontSize: getScaledSize(16) }]}>Order #{order.id}</Text>
              <Text style={[styles.customerName, { fontSize: getScaledSize(14) }]}>{customer.name}</Text>
              <Text style={[styles.orderDate, { fontSize: getScaledSize(12) }]}>{orderDate}</Text>
            </View>
            {!selectAllChecked && (
              <Checkbox
                status={isSelected ? "checked" : "unchecked"}
                onPress={() => handleOrderCheckboxChange(order.id)}
                color={COLORS.primary}
              />
            )}
          </View>
          <View style={styles.orderActions}>
            <Button
              mode="contained"
              onPress={() => generateInvoice(order)}
              style={styles.generateButton}
              labelStyle={styles.buttonLabel}
              icon="file-document"
            >
              Generate Invoice
            </Button>
          </View>
        </Card.Content>
      </Card>
    );
  };

  const renderContent = () => {
    return (
      <View style={styles.contentContainer}>
        <Card style={styles.dateCard}>
          <Card.Content>
            <View style={styles.dateHeader}>
              <Icon name="calendar" size={24} color={COLORS.primary} />
              <Text style={[styles.dateText, { fontSize: getScaledSize(18) }]}>{moment(selectedDate).format("DD MMM YYYY")}</Text>
              <Button
                mode="outlined"
                onPress={showDatePicker}
                style={styles.dateButton}
                labelStyle={styles.dateButtonLabel}
              >
                Change Date
              </Button>
            </View>
          </Card.Content>
        </Card>

        <View style={styles.selectAllContainer}>
          <Checkbox
            status={selectAllChecked ? "checked" : "unchecked"}
            onPress={handleSelectAllCheckboxChange}
            color={COLORS.primary}
          />
          <Text style={[styles.selectAllText, { fontSize: getScaledSize(16) }]}>Select All Orders</Text>
        </View>

        <ScrollView
          style={styles.scrollView}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.primary]} tintColor={COLORS.primary} />
          }
          onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: false })}
          scrollEventThrottle={16}
        >
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={COLORS.primary} />
              <Text style={[styles.loadingText, { fontSize: getScaledSize(16) }]}>Loading orders...</Text>
            </View>
          ) : error ? (
            <Card style={styles.errorCard}>
              <Card.Content>
                <View style={styles.errorContent}>
                  <Icon name="alert-circle" size={24} color={COLORS.error} />
                  <Text style={[styles.errorText, { fontSize: getScaledSize(16) }]}>{error}</Text>
                </View>
              </Card.Content>
            </Card>
          ) : orders.length > 0 ? (
            orders.map((order) => renderOrderCard(order))
          ) : (
            <Card style={styles.emptyCard}>
              <Card.Content style={styles.emptyContent}>
                <Icon name="file-document-outline" size={48} color={COLORS.primary} />
                <Text style={[styles.emptyText, { fontSize: getScaledSize(18) }]}>No orders found</Text>
                <Text style={[styles.emptySubtext, { fontSize: getScaledSize(14) }]}>No orders available for the selected date</Text>
              </Card.Content>
            </Card>
          )}
        </ScrollView>

        {!loading && orders.length > 0 && (
          <FAB
            style={styles.fab}
            icon="file-multiple"
            label="Generate Selected"
            onPress={generateBulkInvoices}
            disabled={selectAllChecked ? false : selectedOrderIds.length === 0}
            color={COLORS.text.light}
            theme={{
              colors: {
                primary: COLORS.primary,
                accent: COLORS.text.light,
                text: COLORS.text.light,
              },
            }}
          />
        )}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.header, { height: headerHeight, opacity: headerOpacity }]}>
        <View style={styles.headerContent}>
          <Icon name="file-document" size={28} color={COLORS.text.light} />
          <Text style={[styles.headerTitle, { fontSize: getScaledSize(24) }]}>Invoice Management</Text>
        </View>
      </Animated.View>

      {renderContent()}

      <DateTimePickerModal
        isVisible={isDatePickerVisible}
        mode="date"
        onConfirm={handleConfirmDate}
        onCancel={hideDatePicker}
        date={selectedDate}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    backgroundColor: COLORS.primary,
    padding: 16,
    paddingTop: Platform.OS === "ios" ? 40 : 16,
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 5,
  },
  headerContent: {
    flexDirection: "row",
    alignItems: "center",
  },
  headerTitle: {
    fontWeight: "600",
    color: COLORS.text.light,
    marginLeft: 12,
  },
  contentContainer: {
    flex: 1,
    padding: 16,
  },
  dateCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    marginBottom: 16,
    elevation: 2,
  },
  dateHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  dateText: {
    fontWeight: "600",
    color: COLORS.text.primary,
  },
  dateButton: {
    borderColor: COLORS.primary,
  },
  dateButtonLabel: {
    color: COLORS.primary,
  },
  selectAllContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
    backgroundColor: COLORS.surface,
    padding: 12,
    borderRadius: 8,
    elevation: 2,
  },
  selectAllText: {
    marginLeft: 8,
    color: COLORS.text.primary,
    fontWeight: "500",
  },
  scrollView: {
    flex: 1,
  },
  orderCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    marginBottom: 16,
    elevation: 2,
  },
  selectedCard: {
    borderColor: COLORS.primary,
    borderWidth: 2,
  },
  orderHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 12,
  },
  orderInfo: {
    flex: 1,
  },
  orderId: {
    fontWeight: "600",
    color: COLORS.text.primary,
  },
  customerName: {
    color: COLORS.text.secondary,
    marginTop: 4,
  },
  orderDate: {
    color: COLORS.text.tertiary,
    marginTop: 2,
  },
  orderActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
  },
  generateButton: {
    backgroundColor: COLORS.primary,
  },
  buttonLabel: {
    color: COLORS.text.light,
    fontWeight: "500",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  loadingText: {
    marginTop: 16,
    color: COLORS.primary,
  },
  errorCard: {
    backgroundColor: "#FEE2E2",
    margin: 16,
    borderLeftWidth: 4,
    borderLeftColor: COLORS.error,
  },
  errorContent: {
    flexDirection: "row",
    alignItems: "center",
  },
  errorText: {
    color: COLORS.error,
    marginLeft: 8,
  },
  emptyCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    elevation: 2,
  },
  emptyContent: {
    alignItems: "center",
  },
  emptyText: {
    fontWeight: "600",
    color: COLORS.text.primary,
    marginTop: 16,
    textAlign: "center",
  },
  emptySubtext: {
    color: COLORS.text.secondary,
    marginTop: 8,
    textAlign: "center",
  },
  fab: {
    position: "absolute",
    margin: 16,
    right: 0,
    bottom: 0,
    backgroundColor: COLORS.primary,
    elevation: 4,
    shadowColor: COLORS.primaryDark,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
});

export default InvoiceAdmin;