import React, { useState, useEffect, useCallback } from "react";
import { View, Text, Button, Platform, ScrollView, StyleSheet, Alert, PermissionsAndroid, Linking, ToastAndroid } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import axios from "axios";
import RNFS from "react-native-fs";
import Share from "react-native-share";
import { Checkbox } from "react-native-paper";
import DateTimePickerModal from "react-native-modal-datetime-picker";
import moment from "moment";
import MaterialIcons from "react-native-vector-icons/MaterialIcons";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

// Helper to convert Uint8Array to base64 (for RNFS)
function uint8ToBase64(uint8) {
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
}


// Helper function to convert number to words
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

  let result = "";
  const rupeesPart = rupeesToWords(rupees);
  const paisePart = paiseToWords(paise);

  if (rupeesPart) result += `${rupeesPart} Rupees`;
  if (paisePart) result += `${rupeesPart ? " and " : ""}${paisePart} Paise`;
  result += " Only";

  return result.trim() || "Zero Rupees Only";
};

import { ipAddress } from "../../services/urls"; // Replace with your actual IP address

const InvoiceSA = ({ navigation }) => {
  const [orders, setOrders] = useState([]);
  const [assignedUsers, setAssignedUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isDatePickerVisible, setDatePickerVisibility] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectAllChecked, setSelectAllChecked] = useState(false);
  const [selectedOrderIds, setSelectedOrderIds] = useState([]);

  // Fetch assigned users
  const fetchAssignedUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const token = await AsyncStorage.getItem("userAuthToken");
      if (!token) throw new Error("Authentication token not found. Please log in.");

      const response = await axios.get(`http://${ipAddress}:8091/allUsers/`, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      const responseJson = response.data;
      if (responseJson && responseJson.data && Array.isArray(responseJson.data)) {
        const filteredUsers = responseJson.data.filter((user) => user.role === "user");
        setAssignedUsers(filteredUsers);
      } else {
        setAssignedUsers([]);
        setError("No users found.");
      }
    } catch (fetchError) {
      const errorMessage = fetchError.message || "Failed to fetch users.";
      setError(errorMessage);
      Alert.alert("Fetch Error", errorMessage);
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch orders for a specific date
  const fetchOrders = useCallback(
    async (date) => {
      try {
        setLoading(true);
        setError(null);
        const token = await AsyncStorage.getItem("userAuthToken");
        if (!token) throw new Error("Authentication token not found. Please log in.");

        const dateFormatted = moment(date).format("YYYY-MM-DD");
        const response = await axios.get(`http://${ipAddress}:8091/get-orders-sa?date=${dateFormatted}`, {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        });

        if (!response.data || !response.data.status) {
          throw new Error(response.data?.message || "No valid data received from server");
        }

        const fetchedOrders = response.data.orders || [];
        console.log("Fetched orders for date", dateFormatted, ":", fetchedOrders);
        setOrders(fetchedOrders);
        setSelectAllChecked(false);
        setSelectedOrderIds([]);
        await fetchAssignedUsers();
      } catch (error) {
        const errorMessage = error.response?.data?.message || error.message || "Failed to fetch orders";
        setError(errorMessage);
        Alert.alert("Fetch Error", errorMessage);
        console.error("Error fetching orders:", error);
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

  // Generate PDF using pdf-lib
  const generatePDF = async (order, invoiceProducts) => {
    try {
      const pdfDoc = await PDFDocument.create();
      const page = pdfDoc.addPage([595.28, 841.89]); // A4 size
      const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const helveticaBoldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
      const primaryColor = rgb(0, 0.2, 0.4);
      const textColor = rgb(0, 0, 0);
      const secondaryColor = rgb(0.4, 0.4, 0.4);

      const customer = assignedUsers.find((user) => user.customer_id === order.customer_id) || {
        name: "Unknown",
        phone: "N/A",
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

      // Header
      page.drawRectangle({ x: 0, y: 780, width: 595.28, height: 60, color: primaryColor });
      page.drawText("INVOICE", { x: 250, y: 805, size: 28, font: helveticaBoldFont, color: rgb(1, 1, 1) });
      page.drawText("Order Appu", { x: 50, y: 750, size: 18, font: helveticaBoldFont, color: primaryColor });
      page.drawText("Bangalore - 560068", { x: 50, y: 730, size: 10, font: helveticaFont, color: secondaryColor });

      // Invoice Details
      page.drawText("Invoice Details", { x: 50, y: 680, size: 14, font: helveticaBoldFont, color: primaryColor });
      page.drawLine({ start: { x: 50, y: 675 }, end: { x: 545, y: 675 }, thickness: 1, color: primaryColor });
      let detailsY = 655;
      const lineHeight = 20;

      page.drawText("Invoice No:", { x: 50, y: detailsY, size: 10, font: helveticaBoldFont, color: textColor });
      page.drawText(invoiceNumber, { x: 150, y: detailsY, size: 10, font: helveticaFont, color: textColor });
      detailsY -= lineHeight;
      page.drawText("Date:", { x: 50, y: detailsY, size: 10, font: helveticaBoldFont, color: textColor });
      page.drawText(moment.unix(order.placed_on).format("DD MMM YYYY"), { x: 150, y: detailsY, size: 10, font: helveticaFont, color: textColor });
      detailsY -= lineHeight;
      page.drawText("Order ID:", { x: 50, y: detailsY, size: 10, font: helveticaBoldFont, color: textColor });
      page.drawText(`${order.id}`, { x: 150, y: detailsY, size: 10, font: helveticaFont, color: textColor });

      // Customer Details
      page.drawText("Customer Details", { x: 50, y: 590, size: 14, font: helveticaBoldFont, color: primaryColor });
      page.drawLine({ start: { x: 50, y: 585 }, end: { x: 545, y: 585 }, thickness: 1, color: primaryColor });
      page.drawText(`Customer Name: ${customer.name}`, { x: 50, y: 565, size: 10, font: helveticaFont, color: textColor });
      page.drawText(`Phone: ${customer.phone}`, { x: 50, y: 550, size: 10, font: helveticaFont, color: textColor });
      page.drawText(`Address: ${customer.delivery_address}`, { x: 50, y: 535, size: 10, font: helveticaFont, color: textColor });

      // Order Items Table
      page.drawText("Order Items", { x: 50, y: 505, size: 14, font: helveticaBoldFont, color: primaryColor });
      page.drawRectangle({ x: 50, y: 475, width: 495, height: 25, color: rgb(0.9, 0.9, 0.9) });
      const headers = ["S.No", "Item Name", "HSN", "Qty", "UOM", "Rate", "Value"];
      const headerPositions = [50, 80, 250, 350, 400, 450, 500];
      headers.forEach((header, index) => {
        page.drawText(header, { x: headerPositions[index], y: 485, size: 10, font: helveticaBoldFont, color: textColor });
      });

      let itemY = 465;
      invoiceProducts.forEach((item, index) => {
        if (index % 2 === 0) {
          page.drawRectangle({ x: 50, y: itemY - 15, width: 495, height: 20, color: rgb(0.95, 0.95, 0.95) });
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

      // Totals
      page.drawLine({ start: { x: 350, y: itemY }, end: { x: 545, y: itemY }, thickness: 1, color: primaryColor });
      itemY -= 20;
      page.drawText("Subtotal:", { x: 350, y: itemY, size: 10, font: helveticaBoldFont, color: textColor });
      page.drawText(`Rs. ${subTotal}`, { x: 500, y: itemY, size: 10, font: helveticaFont, color: textColor });
      itemY -= 20;
      page.drawText("CGST:", { x: 350, y: itemY, size: 10, font: helveticaBoldFont, color: textColor });
      page.drawText(`Rs. ${cgstAmount}`, { x: 500, y: itemY, size: 10, font: helveticaFont, color: textColor });
      itemY -= 20;
      page.drawText("SGST:", { x: 350, y: itemY, size: 10, font: helveticaBoldFont, color: textColor });
      page.drawText(`Rs. ${sgstAmount}`, { x: 500, y: itemY, size: 10, font: helveticaFont, color: textColor });
      itemY -= 20;
      page.drawText("Total:", { x: 350, y: itemY, size: 12, font: helveticaBoldFont, color: primaryColor });
      page.drawText(`Rs. ${grandTotal}`, { x: 500, y: itemY, size: 12, font: helveticaBoldFont, color: primaryColor });

      // Amount in Words
      itemY -= 30;
      page.drawText("Amount in words:", { x: 50, y: itemY, size: 10, font: helveticaBoldFont, color: textColor });
      page.drawText(numberToWords(parseFloat(grandTotal)), { x: 150, y: itemY, size: 10, font: helveticaFont, color: textColor });

      // Certification
      itemY -= 30;
      page.drawText("We hereby certify that its products mentioned in the said", { x: 50, y: itemY, size: 10, font: helveticaFont, color: textColor });
      itemY -= 15;
      page.drawText("invoices are warranted to be of the nature and quality", { x: 50, y: itemY, size: 10, font: helveticaFont, color: textColor });
      itemY -= 15;
      page.drawText("which they are purported to be.", { x: 50, y: itemY, size: 10, font: helveticaFont, color: textColor });

      // Footer
      const footerY = 100;
      page.drawLine({ start: { x: 50, y: footerY + 20 }, end: { x: 545, y: footerY + 20 }, thickness: 1, color: primaryColor });
      page.drawText("Thank you for your business!", { x: 230, y: footerY, size: 12, font: helveticaBoldFont, color: primaryColor });
      page.drawText("Payment is due within 30 days. Please make checks payable to OrderAppu.", { x: 120, y: footerY - 20, size: 10, font: helveticaFont, color: secondaryColor });
      page.drawText("Authorized Signatory", { x: 400, y: footerY - 40, size: 10, font: helveticaBoldFont, color: textColor });

      // Save PDF
      const pdfBytes = await pdfDoc.save();
      
      // Generate filename
      const fileName = `Invoice_${invoiceNumber}.pdf`;
      
      // Save to Downloads using our helper function that works on all Android versions
      const pdfPath = await savePDFToDownloads(pdfBytes, fileName);
      if (!pdfPath) {
        return null; // Failed to save
      }

      // No automatic sharing - just notify the user where the file was saved
      if (Platform.OS === "android") {
        ToastAndroid.show(`Invoice saved to Downloads as ${fileName}`, ToastAndroid.LONG);
      } else {
        // For iOS, we might still need sharing since files are saved to app directory
        await Share.open({
          url: pdfPath,
          type: "application/pdf",
          title: fileName,
          subject: `Invoice ${invoiceNumber}`,
          failOnCancel: false,
        });
      }

      // Post to API
      await postInvoiceToAPI(order.id, invoiceNumber, order.placed_on);
      return pdfPath;
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
        const orderProducts = await fetchOrderProducts(order.id);
        const invoiceProducts = orderProducts
          .map((op, index) => {
            const priceIncludingGst = parseFloat(op.price);
            const gstRate = parseFloat(op.gst_rate || 0);
            const basePrice = gstRate > 0 ? priceIncludingGst / (1 + gstRate / 100) : priceIncludingGst;
            const value = op.quantity * basePrice;
            const gstAmount = value * (gstRate / 100);
            return {
              serialNumber: index + 1,
              name: op.name,
              hsn_code: op.hsn_code || "N/A",
              quantity: op.quantity,
              uom: "Pkts",
              rate: basePrice.toFixed(2),
              value: value.toFixed(2),
              gstAmount: gstAmount.toFixed(2),
            };
          })
          .filter(Boolean);

        if (invoiceProducts.length === 0) {
          Alert.alert("Error", "No products found for this order.");
          return;
        }

        const pdfPath = await generatePDF(order, invoiceProducts);
        Alert.alert("Success", `Invoice for Order #${order.id} generated successfully!`);
        console.log("PDF saved at:", pdfPath);
      } catch (error) {
        console.error("Error generating invoice:", error);
        Alert.alert("Error", "Failed to generate invoice.");
      } finally {
        setLoading(false);
      }
    },
    [fetchOrderProducts, assignedUsers]
  );

  // Generate bulk invoices
  const generateBulkInvoices = useCallback(async () => {
    const ordersToProcess = selectAllChecked ? orders : orders.filter((order) => selectedOrderIds.includes(order.id));
    if (ordersToProcess.length === 0) {
      Alert.alert("Info", "No orders selected.");
      return;
    }
    
    // No need to check permissions up front - our savePDFToDownloads function handles that per Android version

    setLoading(true);
    let successCount = 0;
    let errorCount = 0;
    let savedPaths = [];

    for (const order of ordersToProcess) {
      try {
        // For bulk operations, we don't want to show an alert for each invoice
        const orderProducts = await fetchOrderProducts(order.id);
        const invoiceProducts = orderProducts
          .map((op, index) => {
            const priceIncludingGst = parseFloat(op.price);
            const gstRate = parseFloat(op.gst_rate || 0);
            const basePrice = gstRate > 0 ? priceIncludingGst / (1 + gstRate / 100) : priceIncludingGst;
            const value = op.quantity * basePrice;
            const gstAmount = value * (gstRate / 100);
            return {
              serialNumber: index + 1,
              name: op.name,
              hsn_code: op.hsn_code || "N/A",
              quantity: op.quantity,
              uom: "Pkts",
              rate: basePrice.toFixed(2),
              value: value.toFixed(2),
              gstAmount: gstAmount.toFixed(2),
            };
          })
          .filter(Boolean);

        if (invoiceProducts.length === 0) {
          throw new Error("No products found for this order.");
        }

        const pdfPath = await generatePDF(order, invoiceProducts);
        if (pdfPath) {
          savedPaths.push(pdfPath);
          successCount++;
          
          // Post to API silently
          try {
            await postInvoiceToAPI(order.id, pdfPath.split('/').pop().replace('Invoice_', '').replace('.pdf', ''), order.placed_on);
          } catch (apiError) {
            console.error(`API error for order ${order.id}:`, apiError);
          }
        }
      } catch (error) {
        console.error(`Error generating invoice for order ${order.id}:`, error);
        errorCount++;
      }
    }

    // After all invoices are generated, show a summary alert
    Alert.alert(
      "Bulk Invoice Generation",
      `Successfully generated ${successCount} invoice(s) to your Downloads folder.${errorCount > 0 ? ` Failed to generate ${errorCount} invoice(s).` : ""}`
    );
    setLoading(false);
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
    setSelectedOrderIds((prev) =>
      prev.includes(orderId) ? prev.filter((id) => id !== orderId) : [...prev, orderId]
    );
  }, []);

  const handleSelectAllCheckboxChange = useCallback(() => {
    setSelectAllChecked((prev) => !prev);
    setSelectedOrderIds(!selectAllChecked ? orders.map((order) => order.id) : []);
  }, [selectAllChecked, orders]);

  // Initial fetch
  useEffect(() => {
    fetchOrders(selectedDate);
  }, [fetchOrders, selectedDate]);

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.headerTitle}>Invoice Generation</Text>
        <View style={styles.headerActions}>
          <Button color="#003366" title={`Date: ${selectedDate.toISOString().split("T")[0]}`} onPress={showDatePicker} />
          <DateTimePickerModal
            isVisible={isDatePickerVisible}
            mode="date"
            onConfirm={handleConfirmDate}
            onCancel={hideDatePicker}
            date={selectedDate}
          />
        </View>
      </View>
      <View style={styles.selectAllContainer}>
        <Text style={styles.selectAllText}>Select All</Text>
        <Checkbox status={selectAllChecked ? "checked" : "unchecked"} onPress={handleSelectAllCheckboxChange} color="#003366" />
      </View>
      <ScrollView style={styles.ordersContainer} contentContainerStyle={styles.ordersContent}>
        {loading && <Text style={styles.loadingText}>Loading Orders...</Text>}
        {error && <Text style={styles.errorText}>Error: {error}</Text>}
        {!loading && !error && orders.length > 0 ? (
          orders.map((order) => (
            <View key={order.id} style={styles.orderCard}>
              {!selectAllChecked && (
                <Checkbox
                  status={selectedOrderIds.includes(order.id) ? "checked" : "unchecked"}
                  onPress={() => handleOrderCheckboxChange(order.id)}
                  color="#003366"
                />
              )}
              <View style={styles.orderDetails}>
                <View style={styles.orderRow}>
                  <MaterialIcons name="receipt" size={20} color="#003366" />
                  <Text style={styles.orderId}>Order ID: {order.id}</Text>
                </View>
                <View style={styles.orderRow}>
                  <MaterialIcons name="person" size={18} color="#666" />
                  <Text style={styles.orderLabel}>Customer ID:</Text>
                  <Text style={styles.orderValue}>{order.customer_id}</Text>
                </View>
                <View style={styles.orderRow}>
                  <MaterialIcons name="event" size={18} color="#666" />
                  <Text style={styles.orderLabel}>Placed On:</Text>
                  <Text style={styles.orderValue}>{moment.unix(order.placed_on).format("DD MMM YYYY")}</Text>
                </View>
              </View>
              <Button color="#003366" title="Generate Invoice" onPress={() => generateInvoice(order)} />
            </View>
          ))
        ) : !loading && !error ? (
          <Text style={styles.noOrdersText}>No orders found for selected date.</Text>
        ) : null}
      </ScrollView>
      {!loading && orders.length > 0 && (
        <Button
          title="Generate Selected Invoices"
          onPress={generateBulkInvoices}
          color="#003366"
          disabled={selectAllChecked ? false : selectedOrderIds.length === 0}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: "#f5f7fa",
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
    paddingBottom: 10,
    borderBottomWidth: 2,
    borderBottomColor: "#003366",
  },
  headerTitle: {
    color: "#003366",
    fontSize: 22,
    fontWeight: "bold",
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  selectAllContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    padding: 10,
    borderRadius: 8,
    elevation: 2,
    shadowColor: "#003366",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    marginBottom: 10,
  },
  selectAllText: {
    color: "#003366",
    fontWeight: "600",
    fontSize: 16,
    marginRight: 8,
  },
  ordersContainer: {
    backgroundColor: "#f5f7fa",
    borderRadius: 10,
    padding: 2,
    marginBottom: 20,
  },
  ordersContent: {
    paddingBottom: 20,
  },
  orderCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 18,
    marginBottom: 16,
    elevation: 2,
    shadowColor: "#003366",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
  },
  orderDetails: {
    flex: 1,
    marginLeft: 10,
  },
  orderRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 6,
  },
  orderId: {
    fontSize: 16,
    color: "#003366",
    fontWeight: "bold",
    marginLeft: 8,
  },
  orderLabel: {
    fontSize: 15,
    color: "#6B7280",
    marginLeft: 8,
    fontWeight: "500",
  },
  orderValue: {
    fontSize: 15,
    color: "#1F2937",
    marginLeft: 4,
    fontWeight: "500",
  },
  loadingText: {
    color: "#003366",
    fontSize: 16,
    textAlign: "center",
    marginVertical: 20,
  },
  errorText: {
    color: "#DC2626",
    fontSize: 16,
    textAlign: "center",
    marginVertical: 20,
  },
  noOrdersText: {
    color: "#6B7280",
    fontSize: 16,
    textAlign: "center",
    marginVertical: 20,
  },
});

export default InvoiceSA;