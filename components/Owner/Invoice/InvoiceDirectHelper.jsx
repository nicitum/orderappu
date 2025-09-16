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

// Fetch client status to get invoice prefix and gst method
export const fetchClientStatus = async () => {
    try {
        console.log('=== FETCHING CLIENT STATUS FOR INVOICE PREFIX AND GST METHOD ===');
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
        const gstMethod = clientStatusData.data[0].gst_method || "Inclusive GST"; // Default to inclusive
        
        console.log('GST Method from API:', gstMethod);
        return { success: true, data: { invPrefix, gstMethod } };
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
            customer_name: invoiceData.customerName || null,
            customer_phone: invoiceData.customerPhone || null
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

// Generate PDF from invoice data (redesigned for professional, clean, readable layout)
export const generateInvoicePDF = async (invoiceData, customerData = null) => {
    try {
        console.log('Generating PDF for invoice:', invoiceData.invoice_info.invoice_number);
        
        // Fetch client status to get GST method
        const clientStatusResult = await fetchClientStatus();
        let gstMethod = "Inclusive GST"; // Default to inclusive
        if (clientStatusResult.success) {
            gstMethod = clientStatusResult.data.gstMethod;
        }
        console.log('Using GST Method:', gstMethod);
        
        const pdfDoc = await PDFDocument.create();
        const page = pdfDoc.addPage([595.28, 841.89]); // A4 size
        const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
        const helveticaBoldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
        const primaryColor = rgb(0.1, 0.3, 0.5); // Softer blue
        const textColor = rgb(0.1, 0.1, 0.1); // Dark gray
        const secondaryColor = rgb(0.5, 0.5, 0.5); // Medium gray
        const backgroundColor = rgb(0.98, 0.98, 0.98); // Light gray

        const invoiceInfo = invoiceData.invoice_info;
        const products = invoiceData.products;

        // Calculate totals based on GST method
        let subTotal = 0;
        let totalTaxableValue = 0;
        let totalGstAmount = 0;
        
        const isInclusive = gstMethod === "Inclusive GST";
        
        if (isInclusive) {
            products.forEach(item => {
                const priceIncludingGst = parseFloat(item.item_total);
                const gstRate = parseFloat(item.gst_rate || 0);
                const taxableValue = gstRate > 0 ? priceIncludingGst / (1 + gstRate / 100) : priceIncludingGst;
                const gstAmount = priceIncludingGst - taxableValue;
                
                item.calculated_taxable_value = taxableValue.toFixed(2);
                item.calculated_gst_amount = gstAmount.toFixed(2);
                
                totalTaxableValue += taxableValue;
                totalGstAmount += gstAmount;
            });
            subTotal = totalTaxableValue;
        } else {
            subTotal = products.reduce((acc, item) => acc + parseFloat(item.item_total), 0);
            totalGstAmount = products.reduce((acc, item) => {
                const gstRate = parseFloat(item.gst_rate || 0);
                const itemTotal = parseFloat(item.item_total);
                const gstAmount = itemTotal * (gstRate / 100);
                
                item.calculated_taxable_value = item.item_total;
                item.calculated_gst_amount = gstAmount.toFixed(2);
                
                return acc + gstAmount;
            }, 0);
            totalTaxableValue = subTotal;
        }
        
        const cgstAmount = (totalGstAmount / 2).toFixed(2);
        const sgstAmount = (totalGstAmount / 2).toFixed(2);
        const grandTotal = (totalTaxableValue + totalGstAmount).toFixed(2);
        
        subTotal = subTotal.toFixed(2);
        totalTaxableValue = totalTaxableValue.toFixed(2);
        totalGstAmount = totalGstAmount.toFixed(2);
        
        // Header - Clean and minimal
        page.drawText("TAX INVOICE", { x: 50, y: 790, size: 24, font: helveticaBoldFont, color: primaryColor });
        
        // GST Invoice Type - Small and subtle
        const gstTypeText = isInclusive ? "(Inclusive GST)" : "(Exclusive GST)";
        page.drawText(gstTypeText, { x: 50, y: 770, size: 10, font: helveticaFont, color: secondaryColor });
        
        // Company and Customer Info - Side by side with more space
        page.drawText("From:", { x: 50, y: 740, size: 12, font: helveticaBoldFont, color: textColor });
        page.drawText("Order Appu", { x: 50, y: 720, size: 14, font: helveticaFont, color: textColor });
        page.drawText("Bangalore - 560068", { x: 50, y: 705, size: 10, font: helveticaFont, color: secondaryColor });
        page.drawText("GST: 29XXXXX1234Z1Z5", { x: 50, y: 690, size: 10, font: helveticaFont, color: secondaryColor });
        
        page.drawText("To:", { x: 300, y: 740, size: 12, font: helveticaBoldFont, color: textColor });
        if (customerData) {
            page.drawText(customerData.username || "Customer", { x: 300, y: 720, size: 14, font: helveticaFont, color: textColor });
            const address = customerData.route || customerData.delivery_address || "";
            page.drawText(address, { x: 300, y: 705, size: 10, font: helveticaFont, color: secondaryColor, maxWidth: 250 });
            if (customerData.phone) {
                page.drawText(`Phone: ${customerData.phone}`, { x: 300, y: 690, size: 10, font: helveticaFont, color: secondaryColor });
            }
        } else {
            page.drawText("Walk-in Customer", { x: 300, y: 720, size: 14, font: helveticaFont, color: textColor });
        }
        
        // Invoice Details - Grid layout for clarity
        page.drawLine({ start: { x: 50, y: 670 }, end: { x: 545, y: 670 }, thickness: 0.5, color: secondaryColor });
        page.drawText("Invoice Details", { x: 50, y: 650, size: 14, font: helveticaBoldFont, color: primaryColor });
        
        page.drawText("Invoice No:", { x: 50, y: 630, size: 10, font: helveticaBoldFont, color: textColor });
        page.drawText(invoiceInfo.invoice_number, { x: 130, y: 630, size: 10, font: helveticaFont, color: textColor });
        
        page.drawText("Date:", { x: 300, y: 630, size: 10, font: helveticaBoldFont, color: textColor });
        page.drawText(new Date(invoiceInfo.created_at).toLocaleDateString(), { x: 350, y: 630, size: 10, font: helveticaFont, color: textColor });
        
        page.drawText("GST Method:", { x: 50, y: 610, size: 10, font: helveticaBoldFont, color: textColor });
        page.drawText(isInclusive ? "Inclusive" : "Exclusive", { x: 130, y: 610, size: 10, font: helveticaFont, color: textColor });
        
        page.drawText("Total Items:", { x: 300, y: 610, size: 10, font: helveticaBoldFont, color: textColor });
        page.drawText(invoiceInfo.total_items.toString(), { x: 380, y: 610, size: 10, font: helveticaFont, color: textColor });
        
        // Order Items Table - Wider columns, larger fonts, more spacing
        page.drawLine({ start: { x: 50, y: 590 }, end: { x: 545, y: 590 }, thickness: 0.5, color: secondaryColor });
        page.drawText("Items", { x: 50, y: 570, size: 14, font: helveticaBoldFont, color: primaryColor });
        
        // Table headers with cleaner layout (removed GST Amt column)
        const headers = ["#", "Description", "Qty", "Rate", "Taxable", "GST%", "Total"];
        const headerPositions = [55, 85, 280, 320, 370, 430, 480];
        const columnWidths = [25, 190, 35, 45, 55, 45, 50];
        
        page.drawRectangle({ x: 50, y: 545, width: 495, height: 20, color: backgroundColor });
        headers.forEach((header, index) => {
            page.drawText(header, { x: headerPositions[index], y: 550, size: 9, font: helveticaBoldFont, color: textColor });
        });
        
        // Table rows with alternating colors and more vertical space
        let itemY = 530;
        const rowHeight = 25; // Increased for readability
        products.forEach((item, index) => {
            const rowColor = index % 2 === 0 ? rgb(1, 1, 1) : backgroundColor;
            page.drawRectangle({ x: 50, y: itemY - rowHeight + 5, width: 495, height: rowHeight, color: rowColor });
            
            page.drawText(`${index + 1}`, { x: 55, y: itemY, size: 10, font: helveticaFont, color: textColor });
            
            const itemName = item.name.length > 28 ? item.name.substring(0, 25) + '...' : item.name;
            page.drawText(itemName, { x: 85, y: itemY, size: 10, font: helveticaFont, color: textColor });
            
            page.drawText(`${item.quantity}`, { x: 285, y: itemY, size: 10, font: helveticaFont, color: textColor });
            page.drawText(`${parseFloat(item.price).toFixed(2)}`, { x: 325, y: itemY, size: 10, font: helveticaFont, color: textColor });
            page.drawText(`${parseFloat(item.calculated_taxable_value).toFixed(2)}`, { x: 375, y: itemY, size: 10, font: helveticaFont, color: textColor });
            page.drawText(`${item.gst_rate || 0}%`, { x: 435, y: itemY, size: 10, font: helveticaFont, color: textColor });
            page.drawText(`${parseFloat(item.item_total).toFixed(2)}`, { x: 485, y: itemY, size: 10, font: helveticaFont, color: textColor });
            
            itemY -= rowHeight;
        });
        
        // Table borders - Light lines for separation
        page.drawLine({ start: { x: 50, y: 565 }, end: { x: 545, y: 565 }, thickness: 1, color: secondaryColor });
        page.drawLine({ start: { x: 50, y: itemY + 5 }, end: { x: 545, y: itemY + 5 }, thickness: 1, color: secondaryColor });
        
        // Add vertical column separators for professional look (updated for 7 columns)
        const separatorPositions = [75, 275, 315, 365, 425, 475];
        separatorPositions.forEach(x => {
            page.drawLine({ 
                start: { x: x, y: 565 }, 
                end: { x: x, y: itemY + 5 }, 
                thickness: 0.3, 
                color: rgb(0.7, 0.7, 0.7) 
            });
        });
        
        // Totals - Aligned to right, clean box with GST details
        const totalsY = itemY - 10;
        page.drawRectangle({ x: 350, y: totalsY - 120, width: 195, height: 120, color: backgroundColor });
        
        let currentTotalsY = totalsY - 20;
        const totalsSpacing = 15;
        
        page.drawText("Subtotal (Rs.):", { x: 360, y: currentTotalsY, size: 10, font: helveticaBoldFont, color: textColor });
        page.drawText(subTotal, { x: 480, y: currentTotalsY, size: 10, font: helveticaFont, color: textColor });
        currentTotalsY -= totalsSpacing;
        
        page.drawText("Taxable Value (Rs.):", { x: 360, y: currentTotalsY, size: 10, font: helveticaBoldFont, color: textColor });
        page.drawText(totalTaxableValue, { x: 480, y: currentTotalsY, size: 10, font: helveticaFont, color: textColor });
        currentTotalsY -= totalsSpacing;
        
        page.drawText("GST Amount (Rs.):", { x: 360, y: currentTotalsY, size: 10, font: helveticaBoldFont, color: textColor });
        page.drawText(totalGstAmount, { x: 480, y: currentTotalsY, size: 10, font: helveticaFont, color: textColor });
        currentTotalsY -= totalsSpacing;
        
        page.drawText("CGST (Rs.):", { x: 360, y: currentTotalsY, size: 10, font: helveticaBoldFont, color: textColor });
        page.drawText(cgstAmount, { x: 480, y: currentTotalsY, size: 10, font: helveticaFont, color: textColor });
        currentTotalsY -= totalsSpacing;
        
        page.drawText("SGST (Rs.):", { x: 360, y: currentTotalsY, size: 10, font: helveticaBoldFont, color: textColor });
        page.drawText(sgstAmount, { x: 480, y: currentTotalsY, size: 10, font: helveticaFont, color: textColor });
        currentTotalsY -= totalsSpacing;
        
        page.drawLine({ start: { x: 360, y: currentTotalsY + 5 }, end: { x: 535, y: currentTotalsY + 5 }, thickness: 0.5, color: secondaryColor });
        page.drawText("Grand Total (Rs.):", { x: 360, y: currentTotalsY - 10, size: 12, font: helveticaBoldFont, color: primaryColor });
        page.drawText(grandTotal, { x: 480, y: currentTotalsY - 10, size: 12, font: helveticaBoldFont, color: primaryColor });
        
        // Amount in Words - Full width, subtle background
        const wordsY = currentTotalsY - 40;
        page.drawRectangle({ x: 50, y: wordsY - 25, width: 495, height: 30, color: backgroundColor });
        page.drawText("Amount in Words:", { x: 55, y: wordsY - 10, size: 10, font: helveticaBoldFont, color: textColor });
        const amountInWords = numberToWords(parseFloat(grandTotal));
        page.drawText(amountInWords, { x: 150, y: wordsY - 10, size: 10, font: helveticaFont, color: textColor, maxWidth: 390 });
        
        // Declaration and Terms - Spaced out
        const footerY = wordsY - 60;
        page.drawText("Declaration:", { x: 50, y: footerY, size: 12, font: helveticaBoldFont, color: primaryColor });
        page.drawText("We certify that the goods mentioned are of the specified quality.", { x: 50, y: footerY - 15, size: 10, font: helveticaFont, color: textColor });
        
        page.drawText("Terms & Conditions:", { x: 50, y: footerY - 40, size: 12, font: helveticaBoldFont, color: primaryColor });
        page.drawText("- Payment due within 30 days.", { x: 50, y: footerY - 55, size: 10, font: helveticaFont, color: textColor });
        page.drawText("- Disputes subject to Bangalore jurisdiction.", { x: 50, y: footerY - 70, size: 10, font: helveticaFont, color: textColor });
        
        // Footer - Clean thank you and contact
        page.drawLine({ start: { x: 50, y: 50 }, end: { x: 545, y: 50 }, thickness: 0.5, color: secondaryColor });
        page.drawText("Thank you for your business!", { x: 50, y: 30, size: 12, font: helveticaBoldFont, color: primaryColor });
        page.drawText("Contact: support@orderappu.com", { x: 50, y: 15, size: 10, font: helveticaFont, color: secondaryColor });
        
        page.drawText("Authorized Signature", { x: 400, y: 30, size: 10, font: helveticaBoldFont, color: textColor });

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