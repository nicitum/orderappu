import React, { useState, useEffect } from 'react';
import { Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ipAddress } from '../../../services/urls';
import Share from 'react-native-share';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

// Helper to get token
const getToken = async () => {
    const token = await AsyncStorage.getItem("userAuthToken");
    if (!token) throw new Error("Authentication token not found");
    return token;
};

// Fetch all users
export const fetchAllUsers = async () => {
    try {
        const authToken = await getToken();
        const url = `http://${ipAddress}:8091/allUsers/`;
        
        const response = await fetch(url, {
            headers: {
                Authorization: `Bearer ${authToken}`,
                "Content-Type": "application/json",
            },
        });

        if (!response.ok) {
            throw new Error(`Failed to fetch users: ${response.status}`);
        }

        const data = await response.json();
        const filteredData = data.data.filter(user => user.role === "user") || [];
        return { success: true, data: filteredData };
    } catch (err) {
        console.error("Error fetching users:", err);
        return { success: false, error: err.message };
    }
};

// Fetch customer data by customer_id
export const fetchCustomerData = async (customerId) => {
    try {
        const authToken = await getToken();
        const url = `http://${ipAddress}:8091/fetch_customer_data?customer_id=${encodeURIComponent(customerId)}`;
        
        const response = await fetch(url, {
            headers: {
                Authorization: `Bearer ${authToken}`,
                "Content-Type": "application/json",
            },
        });

        if (!response.ok) {
            throw new Error(`Failed to fetch customer data: ${response.status}`);
        }

        const data = await response.json();
        
        if (data.success) {
            return { success: true, data: data.data };
        } else {
            throw new Error(data.message || 'Failed to fetch customer data');
        }
    } catch (err) {
        console.error("Error fetching customer data:", err);
        return { success: false, error: err.message };
    }
};

// Fetch products
export const fetchProducts = async () => {
    try {
        console.log("Fetching products from:", `http://${ipAddress}:8091/products`);
        
        const response = await fetch(`http://${ipAddress}:8091/products`);
        const data = await response.json();
        console.log("API response status:", response.status);
        console.log("API response data length:", data.length);
        console.log("Sample product data:", data[0]);
        console.log("Sample product brand:", data[0]?.brand);
        console.log("Sample product category:", data[0]?.category);
        
        if (response.ok) {
            // Filter by enable_product - only show products with enable_product = "Yes"
            const enabledProducts = data.filter(p => {
                const enableStatus = p.enable_product;
                return enableStatus === "Yes" || enableStatus === "yes" || enableStatus === true || enableStatus === 1;
            });
            
            // If no enabled products found, show all products for debugging
            const productsToShow = enabledProducts.length > 0 ? enabledProducts : data;
            if (enabledProducts.length === 0) {
                console.log("No enabled products found, showing all products for debugging");
            }
            
            return { success: true, data: productsToShow };
        } else {
            console.log("API returned error status:", response.status);
            return { success: false, error: `Failed to fetch products. Status: ${response.status}` };
        }
    } catch (error) {
        console.error("Error fetching products:", error);
        return { success: false, error: `An error occurred while fetching products: ${error.message}` };
    }
};

// Fetch client status to get invoice prefix
export const fetchClientStatus = async () => {
    try {
        console.log('=== FETCHING CLIENT STATUS FOR INVOICE PREFIX ===');
        const clientStatusResponse = await fetch(`http://147.93.110.150:3001/api/client_status/APPU0009`, {
            method: "GET",
            headers: { "Content-Type": "application/json" }
        });
        
        const clientStatusData = await clientStatusResponse.json();
        console.log('=== CLIENT STATUS RESPONSE FOR INVOICE ===');
        console.log('Full Response:', JSON.stringify(clientStatusData, null, 2));
        
        if (!clientStatusResponse.ok || !clientStatusData.success) {
            console.error('Client status check failed:', clientStatusData);
            return { success: false, error: "Failed to load client information" };
        }

        if (!clientStatusData.data.length || clientStatusData.data[0].status !== "Active") {
            console.warn('Client status inactive:', clientStatusData.data[0]);
            return { success: false, error: "Client account is inactive" };
        }

        const invPrefix = clientStatusData.data[0].inv_prefix || "INV";
        return { success: true, data: { invPrefix } };
    } catch (error) {
        console.error("Error fetching client status:", error);
        return { success: false, error: `An error occurred while fetching client status: ${error.message}` };
    }
};

// Generate unique invoice number with sequential number
export const generateInvoiceNumber = async () => {
    try {
        // Fetch client status to get invoice prefix
        const clientStatusResult = await fetchClientStatus();
        if (!clientStatusResult.success) {
            // Use default prefix if client status fails
            console.warn('Client status failed, using default prefix INV');
            const invPrefix = "INV";
            
            // Get today's date in YYYY-MM-DD format
            const today = new Date();
            const year = today.getFullYear();
            const month = (today.getMonth() + 1).toString().padStart(2, '0');
            const day = today.getDate().toString().padStart(2, '0');
            const dateString = `${year}-${month}-${day}`;
            
            // Generate unique sequential number
            const sequentialNumber = await generateUniqueSequentialNumber(invPrefix, dateString);
            
            // Format: PREFIX-D-YYYY-MM-DD-001
            const invoiceNumber = `${invPrefix}-D-${dateString}-${sequentialNumber}`;
            
            console.log('Generated invoice number with default prefix:', invoiceNumber);
            return { success: true, data: invoiceNumber };
        }

        const { invPrefix } = clientStatusResult.data;
        
        // Get today's date in YYYY-MM-DD format
        const today = new Date();
        const year = today.getFullYear();
        const month = (today.getMonth() + 1).toString().padStart(2, '0');
        const day = today.getDate().toString().padStart(2, '0');
        const dateString = `${year}-${month}-${day}`;
        
        // Generate unique sequential number
        const sequentialNumber = await generateUniqueSequentialNumber(invPrefix, dateString);
        
        // Format: PREFIX-D-YYYY-MM-DD-001
        const invoiceNumber = `${invPrefix}-D-${dateString}-${sequentialNumber}`;
        
        console.log('Generated invoice number:', invoiceNumber);
        return { success: true, data: invoiceNumber };
    } catch (error) {
        console.error('Error generating invoice number:', error);
        return { success: false, error: error.message };
    }
};

// Generate unique sequential number for invoice
const generateUniqueSequentialNumber = async (prefix, dateString) => {
    try {
        const authToken = await getToken();
        
        // Call API to get the next sequential number for today's date
        const response = await fetch(`http://${ipAddress}:8091/get_next_invoice_number?prefix=${encodeURIComponent(prefix)}&date=${encodeURIComponent(dateString)}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json',
            },
        });

        const data = await response.json();

        if (response.ok && data.success) {
            // Format the number with leading zeros (001, 002, etc.)
            const sequentialNumber = data.next_number.toString().padStart(3, '0');
            console.log('Generated sequential number from API:', sequentialNumber);
            return sequentialNumber;
        } else {
            // Fallback: use local storage-based sequential number
            console.warn('Failed to get sequential number from API, using local storage fallback');
            return await generateLocalSequentialNumber(prefix, dateString);
        }
    } catch (error) {
        console.error('Error generating sequential number:', error);
        // Fallback: use local storage-based sequential number
        return await generateLocalSequentialNumber(prefix, dateString);
    }
};

// Generate sequential number using local storage (fallback method)
const generateLocalSequentialNumber = async (prefix, dateString) => {
    try {
        const storageKey = `invoice_counter_${prefix}_${dateString}`;
        
        // Get current counter from AsyncStorage
        const currentCounter = await AsyncStorage.getItem(storageKey);
        let nextNumber = 1;
        
        if (currentCounter) {
            nextNumber = parseInt(currentCounter) + 1;
        }
        
        // Update the counter in AsyncStorage
        await AsyncStorage.setItem(storageKey, nextNumber.toString());
        
        // Format the number with leading zeros (001, 002, etc.)
        const sequentialNumber = nextNumber.toString().padStart(3, '0');
        console.log('Generated local sequential number:', sequentialNumber);
        return sequentialNumber;
        
    } catch (error) {
        console.error('Error generating local sequential number:', error);
        // Final fallback: generate a random number
        const fallbackNumber = Math.floor(Math.random() * 999) + 1;
        return fallbackNumber.toString().padStart(3, '0');
    }
};

// Create direct invoice
export const createDirectInvoice = async (invoiceData) => {
    try {
        const authToken = await getToken();
        
        const requestBody = {
            invoice_number: invoiceData.invoiceNumber,
            products: invoiceData.products,
            invoice_amount: invoiceData.totalAmount,
            customer_name: invoiceData.customerName || null
        };

        console.log('Creating direct invoice:', requestBody);

        const response = await fetch(`http://${ipAddress}:8091/invoice_direct`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestBody)
        });

        const data = await response.json();

        if (response.ok && data.success) {
            return { success: true, data: data };
        } else {
            throw new Error(data.message || 'Failed to create invoice');
        }
    } catch (error) {
        console.error('Error creating direct invoice:', error);
        return { success: false, error: error.message };
    }
};

// Generate/Retrieve direct invoice by invoice number
export const generateDirectInvoice = async (invoiceNumber) => {
    try {
        const authToken = await getToken();
        
        console.log('Generating direct invoice for:', invoiceNumber);

        const response = await fetch(`http://${ipAddress}:8091/generate_direct_invoice?invoice_number=${encodeURIComponent(invoiceNumber)}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json',
            },
        });

        const data = await response.json();

        if (response.ok && data.success) {
            return { success: true, data: data.data };
        } else {
            throw new Error(data.message || 'Failed to generate invoice');
        }
    } catch (error) {
        console.error('Error generating direct invoice:', error);
        return { success: false, error: error.message };
    }
};

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

// Helper function to convert number to words (from InvoiceSA.jsx)
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


// Generate PDF from invoice data (enhanced version based on InvoiceSA.jsx)
export const generateInvoicePDF = async (invoiceData, customerData = null) => {
    try {
        console.log('Generating PDF for invoice:', invoiceData.invoice_info.invoice_number);
        
        const pdfDoc = await PDFDocument.create();
        const page = pdfDoc.addPage([595.28, 841.89]); // A4 size
        const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
        const helveticaBoldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
        const primaryColor = rgb(0, 0.2, 0.4);
        const textColor = rgb(0, 0, 0);
        const secondaryColor = rgb(0.4, 0.4, 0.4);

        const invoiceInfo = invoiceData.invoice_info;
        const products = invoiceData.products;

        // Calculate totals
        const subTotal = products.reduce((acc, item) => acc + parseFloat(item.item_total), 0).toFixed(2);
        const totalGstAmount = products.reduce((acc, item) => {
            const gstRate = parseFloat(item.gst_rate || 0);
            const itemTotal = parseFloat(item.item_total);
            return acc + (itemTotal * (gstRate / 100));
        }, 0).toFixed(2);
        const cgstAmount = (parseFloat(totalGstAmount) / 2).toFixed(2);
        const sgstAmount = (parseFloat(totalGstAmount) / 2).toFixed(2);
        const grandTotal = (parseFloat(subTotal) + parseFloat(totalGstAmount)).toFixed(2);
        
        // Header
        page.drawRectangle({ x: 0, y: 780, width: 595.28, height: 60, color: primaryColor });
        page.drawText("INVOICE", { x: 250, y: 805, size: 28, font: helveticaBoldFont, color: rgb(1, 1, 1) });
        
        // Invoice From (Business Info)
        page.drawText("INVOICE FROM", { x: 50, y: 750, size: 12, font: helveticaBoldFont, color: primaryColor });
        page.drawText("Order Appu", { x: 50, y: 730, size: 14, font: helveticaBoldFont, color: textColor });
        page.drawText("Bangalore - 560068", { x: 50, y: 710, size: 10, font: helveticaFont, color: secondaryColor });
        
        // Invoice To (Customer Info)
        if (customerData) {
            page.drawText("INVOICE TO", { x: 300, y: 750, size: 12, font: helveticaBoldFont, color: primaryColor });
            page.drawText(customerData.username || "Customer", { x: 300, y: 730, size: 14, font: helveticaBoldFont, color: textColor });
            if (customerData.route) {
                page.drawText(customerData.route, { x: 300, y: 710, size: 10, font: helveticaFont, color: secondaryColor });
            }
            if (customerData.phone) {
                page.drawText(`Phone: ${customerData.phone}`, { x: 300, y: 690, size: 10, font: helveticaFont, color: secondaryColor });
            }
        }

        // Invoice Details
        page.drawText("Invoice Details", { x: 50, y: 650, size: 14, font: helveticaBoldFont, color: primaryColor });
        page.drawLine({ start: { x: 50, y: 645 }, end: { x: 545, y: 645 }, thickness: 1, color: primaryColor });
        let detailsY = 625;
        const lineHeight = 20;

        page.drawText("Invoice No:", { x: 50, y: detailsY, size: 10, font: helveticaBoldFont, color: textColor });
        page.drawText(invoiceInfo.invoice_number, { x: 150, y: detailsY, size: 10, font: helveticaFont, color: textColor });
        detailsY -= lineHeight;
        page.drawText("Date:", { x: 50, y: detailsY, size: 10, font: helveticaBoldFont, color: textColor });
        page.drawText(new Date(invoiceInfo.created_at).toLocaleDateString(), { x: 150, y: detailsY, size: 10, font: helveticaFont, color: textColor });
        detailsY -= lineHeight;
        page.drawText("Total Items:", { x: 50, y: detailsY, size: 10, font: helveticaBoldFont, color: textColor });
        page.drawText(invoiceInfo.total_items.toString(), { x: 150, y: detailsY, size: 10, font: helveticaFont, color: textColor });

        // Order Items Table
        page.drawText("Order Items", { x: 50, y: 475, size: 14, font: helveticaBoldFont, color: primaryColor });
        page.drawRectangle({ x: 50, y: 445, width: 495, height: 25, color: rgb(0.9, 0.9, 0.9) });
        const headers = ["S.No", "Item Name", "Qty", "UOM", "Rate", "Value", "GST Rate"];
        const headerPositions = [50, 80, 280, 320, 360, 400, 450];
        headers.forEach((header, index) => {
            page.drawText(header, { x: headerPositions[index], y: 455, size: 10, font: helveticaBoldFont, color: textColor });
        });

        let itemY = 435;
        products.forEach((item, index) => {
            if (index % 2 === 0) {
                page.drawRectangle({ x: 50, y: itemY - 15, width: 495, height: 20, color: rgb(0.95, 0.95, 0.95) });
            }
            page.drawText(`${index + 1}`, { x: 50, y: itemY, size: 10, font: helveticaFont, color: textColor });
            page.drawText(item.name, { x: 80, y: itemY, size: 10, font: helveticaFont, color: textColor });
            page.drawText(`${item.quantity}`, { x: 280, y: itemY, size: 10, font: helveticaFont, color: textColor });
            page.drawText("Pkts", { x: 320, y: itemY, size: 10, font: helveticaFont, color: textColor });
            page.drawText(`Rs. ${item.price}`, { x: 360, y: itemY, size: 10, font: helveticaFont, color: textColor });
            page.drawText(`Rs. ${item.item_total}`, { x: 400, y: itemY, size: 10, font: helveticaFont, color: textColor });
            page.drawText(`${item.gst_rate || 0}%`, { x: 450, y: itemY, size: 10, font: helveticaFont, color: textColor });
            itemY -= 20;
        });

        // Totals
        page.drawLine({ start: { x: 360, y: itemY }, end: { x: 545, y: itemY }, thickness: 1, color: primaryColor });
        itemY -= 20;
        page.drawText("Subtotal:", { x: 360, y: itemY, size: 10, font: helveticaBoldFont, color: textColor });
        page.drawText(`Rs. ${subTotal}`, { x: 450, y: itemY, size: 10, font: helveticaFont, color: textColor });
        itemY -= 20;
        page.drawText("CGST:", { x: 360, y: itemY, size: 10, font: helveticaBoldFont, color: textColor });
        page.drawText(`Rs. ${cgstAmount}`, { x: 450, y: itemY, size: 10, font: helveticaFont, color: textColor });
        itemY -= 20;
        page.drawText("SGST:", { x: 360, y: itemY, size: 10, font: helveticaBoldFont, color: textColor });
        page.drawText(`Rs. ${sgstAmount}`, { x: 450, y: itemY, size: 10, font: helveticaFont, color: textColor });
        itemY -= 20;
        page.drawText("Total:", { x: 360, y: itemY, size: 12, font: helveticaBoldFont, color: primaryColor });
        page.drawText(`Rs. ${grandTotal}`, { x: 450, y: itemY, size: 12, font: helveticaBoldFont, color: primaryColor });

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

        // Generate PDF bytes
        const pdfBytes = await pdfDoc.save();
        
        // Generate filename
        const fileName = `Invoice_${invoiceInfo.invoice_number.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`;
        
        // Convert to base64 for sharing
        const base64PDF = uint8ToBase64(pdfBytes);
        
        console.log('PDF generated successfully for sharing');
        return { success: true, pdfBytes: base64PDF, fileName };
        
    } catch (error) {
        console.error('Error generating PDF:', error);
        return { success: false, error: error.message };
    }
};

// Share PDF file directly from base64 data
export const shareInvoicePDF = async (base64PDF, fileName) => {
    try {
        console.log('Sharing PDF directly:', fileName);
        
        const shareOptions = {
            title: 'Share Invoice',
            message: `Invoice: ${fileName}`,
            url: `data:application/pdf;base64,${base64PDF}`,
            type: 'application/pdf',
        };
        
        const result = await Share.open(shareOptions);
        console.log('PDF shared successfully:', result);
        return { success: true, result };
        
    } catch (error) {
        console.error('Error sharing PDF:', error);
        if (error.message !== 'User did not share') {
            return { success: false, error: error.message };
        }
        return { success: true, cancelled: true };
    }
};

// Filter users based on search query
export const filterUsers = (users, searchQuery) => {
    if (!searchQuery.trim()) return users;
    
    return users.filter(user =>
        (user.username || `User ${user.customer_id}`)
            .toLowerCase()
            .includes(searchQuery.toLowerCase())
    );
};

// Filter products based on search and filters
export const filterProducts = (products, searchTerm, selectedCategory, selectedBrand) => {
    let filtered = products;
    
    if (searchTerm) {
        filtered = filtered.filter((product) =>
            product.name && product.name.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }
    if (selectedCategory && selectedCategory !== "All") {
        filtered = filtered.filter((product) => 
            product.category && product.category === selectedCategory
        );
    }
    if (selectedBrand && selectedBrand !== "All") {
        filtered = filtered.filter((product) => 
            product.brand && product.brand === selectedBrand
        );
    }
    
    return filtered;
};

// Extract unique brands and categories from products
export const extractProductFilters = (products) => {
    // Filter out null/undefined values and get unique brands and categories
    const brands = ["All", ...new Set(products
        .map((product) => product.brand)
        .filter(brand => brand && brand.trim() !== "")
    )];
    const categories = ["All", ...new Set(products
        .map((product) => product.category)
        .filter(category => category && category.trim() !== "")
    )];
    
    console.log('Extracted brands:', brands);
    console.log('Extracted categories:', categories);
    
    return { brands, categories };
};

// Calculate total amount for selected products
export const calculateTotalAmount = (selectedProducts) => {
    return selectedProducts.reduce((sum, product) => {
        return sum + (parseFloat(product.price) * parseInt(product.quantity));
    }, 0);
};

// Handle product selection
export const handleProductSelection = (product, selectedProducts) => {
    const existingIndex = selectedProducts.findIndex(p => p.product_id === product.id);
    if (existingIndex >= 0) {
        // Remove product if already selected
        return selectedProducts.filter(p => p.product_id !== product.id);
    } else {
        // Add product with default quantity 1
        return [...selectedProducts, {
            product_id: product.id,
            name: product.name,
            category: product.category,
            price: product.discountPrice || product.price,
            quantity: 1,
            gst_rate: product.gst_rate || 0
        }];
    }
};

// Update product quantity
export const updateProductQuantity = (productId, quantity, selectedProducts) => {
    if (quantity <= 0) {
        return selectedProducts.filter(p => p.product_id !== productId);
    } else {
        return selectedProducts.map(p => 
            p.product_id === productId ? { ...p, quantity: parseInt(quantity) } : p
        );
    }
};
