import React, { useState, useEffect } from 'react';
import { Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ipAddress } from '../../../services/urls';
import { LICENSE_NO } from '../../config';
import Share from 'react-native-share';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { jwtDecode } from 'jwt-decode';

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
        
        // Decode JWT token to get current admin ID
        const decodedToken = jwtDecode(authToken);
        const currentAdminId = decodedToken.id1; // Using id1 as the admin ID as per user instruction
        
        const response = await fetch(`http://${ipAddress}:8091/assigned-users/${currentAdminId}`, {
            headers: {
                "Authorization": `Bearer ${authToken}`,
                "Content-Type": "application/json",
            },
        });

        if (!response.ok) {
            throw new Error(`Failed to fetch assigned users. Status: ${response.status}`);
        }

        const responseData = await response.json();
        if (responseData.success) {
            // Assuming the API returns assignedUsers array directly
            const filteredData = responseData.assignedUsers || [];
            return { success: true, data: filteredData };
        } else {
            throw new Error(responseData.message || "Failed to fetch assigned users.");
        }
    } catch (err) {
        console.error("Error fetching assigned users:", err);
        return { success: false, error: err.message || "Error fetching assigned users. Please try again." };
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
    const clientStatusResponse = await fetch(`http://147.93.110.150:3001/api/client_status/${LICENSE_NO}`, {
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

    // Return the complete client data instead of just invPrefix and gstMethod
    const clientData = clientStatusData.data[0];
    
    console.log('Complete Client Data from API:', clientData);
    return { success: true, data: clientData };
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
            
            // Generate unique sequential number without date
            const sequentialNumber = await generateUniqueSequentialNumber(invPrefix);
            
            // Format: PREFIX-D-001 (no date concatenation)
            const invoiceNumber = `${invPrefix}-D-${sequentialNumber}`;
            
            console.log('Generated invoice number with default prefix:', invoiceNumber);
            return { success: true, data: invoiceNumber };
        }

        // Extract invPrefix from the complete client data
        const invPrefix = clientStatusResult.data.inv_prefix || "INV";
        
        // Generate unique sequential number without date
        const sequentialNumber = await generateUniqueSequentialNumber(invPrefix);
        
        // Format: PREFIX-D-001 (no date concatenation)
        const invoiceNumber = `${invPrefix}-D-${sequentialNumber}`;
        
        console.log('Generated invoice number:', invoiceNumber);
        return { success: true, data: invoiceNumber };
    } catch (error) {
        console.error('Error generating invoice number:', error);
        return { success: false, error: error.message };
    }
};

// Generate unique sequential number for invoice
const generateUniqueSequentialNumber = async (prefix) => {
    try {
        const authToken = await getToken();
        
        // Call API to get the next sequential number without date dependency
        const response = await fetch(`http://${ipAddress}:8091/get_next_invoice_number?prefix=${encodeURIComponent(prefix)}`, {
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
            return await generateLocalSequentialNumber(prefix);
        }
    } catch (error) {
        console.error('Error generating sequential number:', error);
        // Fallback: use local storage-based sequential number
        return await generateLocalSequentialNumber(prefix);
    }
};

// Generate sequential number using local storage (fallback method)
const generateLocalSequentialNumber = async (prefix) => {
    try {
        const storageKey = `invoice_counter_${prefix}`;
        
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
        
        // Decode the JWT token to get the username (billed_by)
        const decodedToken = JSON.parse(atob(authToken.split('.')[1]));
        const billedBy = decodedToken.username;
        
        // Calculate round off value (difference between invoice_amount and rounded amount)
        const totalAmount = parseFloat(invoiceData.totalAmount);
        const roundedAmount = Math.round(totalAmount);
        const roundOff = parseFloat((roundedAmount - totalAmount).toFixed(2));
        
        // Prepare adjustments array with roundOff
        const adjustments = [
            {
                roundOff: roundOff
            }
        ];
        
        const requestBody = {
            invoice_number: invoiceData.invoiceNumber,
            products: invoiceData.products,
            invoice_amount: totalAmount,
            customer_name: invoiceData.customerName || null,
            customer_phone: invoiceData.customerPhone || null,
            customer_id: invoiceData.customerId || null,
            route: invoiceData.customerRoute || null,
            billed_by: billedBy,
            collections: invoiceData.collections || null,
            adjustments: adjustments,
            placed_on: Math.floor(Date.now() / 1000), // Add placed_on timestamp
            summary: invoiceData.summary || null // Use the summary from invoiceData or null if not provided
        };

        console.log('Creating direct invoice with collections data:', JSON.stringify(requestBody, null, 2));

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
            console.log('Invoice created successfully:', JSON.stringify(data, null, 2));
            return { success: true, data: data };
        } else {
            throw new Error(data.message || 'Failed to create invoice');
        }
    } catch (error) {
        console.error('Error creating direct invoice:', error);
        return { success: false, error: error.message };
    }
};

// Generate/Retrieve direct invoice by invoice number with proper collections data fetching
export const generateDirectInvoice = async (invoiceNumber) => {
    try {
        const authToken = await getToken();
        
        console.log('Generating direct invoice for:', invoiceNumber);

        // Use the fetch_di_summary endpoint to get complete invoice data with collections
        const response = await fetch(`http://${ipAddress}:8091/fetch_di_summary?invoice_number=${encodeURIComponent(invoiceNumber)}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json',
            },
        });

        const data = await response.json();

        if (response.ok && data.success) {
            // The data from fetch_di_summary already has properly processed collections
            // No need for additional processing
            console.log('Fetched invoice data with collections:', JSON.stringify(data.data, null, 2));
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

// Process bank account data - handles both string and object formats
const processBankAccountData = (record) => {
    if (!record || !record.bank_accounts) {
        console.log('No bank account data found for record:', record?.id);
        return record;
    }
    
    let bankAccountsData = null;
    try {
        console.log('Processing bank account data for record:', record.id, 'Raw data:', record.bank_accounts);
        
        // If it's already an object, use it as is
        if (typeof record.bank_accounts === 'object' && !Array.isArray(record.bank_accounts)) {
            bankAccountsData = record.bank_accounts;
            console.log('Bank account data is already an object:', bankAccountsData);
        } 
        // If it's an array, use the first element
        else if (Array.isArray(record.bank_accounts) && record.bank_accounts.length > 0) {
            bankAccountsData = record.bank_accounts[0];
            console.log('Bank account data is an array, using first element:', bankAccountsData);
        }
        // If it's a string, parse it
        else if (typeof record.bank_accounts === 'string') {
            const parsed = JSON.parse(record.bank_accounts);
            console.log('Parsed bank account data from string:', parsed);
            // If it's an array, use the first element
            if (Array.isArray(parsed) && parsed.length > 0) {
                bankAccountsData = parsed[0];
                console.log('Parsed data is an array, using first element:', bankAccountsData);
            }
            // If it's an object, use it as is
            else if (typeof parsed === 'object' && !Array.isArray(parsed)) {
                bankAccountsData = parsed;
                console.log('Parsed data is an object:', bankAccountsData);
            }
            // For any other case, keep the parsed data
            else {
                bankAccountsData = parsed;
                console.log('Parsed data is of other type:', bankAccountsData);
            }
        }
        // For any other case, keep it as is
        else {
            bankAccountsData = record.bank_accounts;
            console.log('Bank account data is of other type:', bankAccountsData);
        }
    } catch (parseError) {
        console.warn('Failed to parse bank_accounts data:', parseError);
        // If parsing fails, keep the original data
        bankAccountsData = record.bank_accounts;
    }
    
    const result = {
        ...record,
        bank_accounts: bankAccountsData
    };
    
    console.log('Processed bank account data for record:', record.id, 'Result:', result);
    return result;
};

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
        console.log('Generating PDF with invoice data:', JSON.stringify(invoiceData, null, 2));
        console.log('Customer data:', JSON.stringify(customerData, null, 2));
        
        // Fetch client status to get GST method
        const clientStatusResult = await fetchClientStatus();
        let gstMethod = "Inclusive GST"; // Default to inclusive
        if (clientStatusResult.success) {
            // Fix: Use the correct property name from the client data
            gstMethod = clientStatusResult.data.gst_method || clientStatusResult.data.gstMethod || "Inclusive GST";
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

        // Handle different possible structures for invoice data
        // More robust handling of different data structures
        let invoiceInfo = {};
        let products = [];
        let invoiceNumber = 'invoice';
        
        // Try to extract invoice info from different possible structures
        // The API returns data in the format: { invoice: {...}, items: [...] }
        if (invoiceData.invoice && invoiceData.items) {
            // New structure from fetch_di_summary API
            invoiceInfo = invoiceData.invoice;
            products = invoiceData.items || [];
            invoiceNumber = invoiceInfo.invoice_number || 'invoice';
        } else if (invoiceData.invoice_info) {
            invoiceInfo = invoiceData.invoice_info;
            products = invoiceData.products || [];
            invoiceNumber = invoiceInfo.invoice_number || invoiceData.invoice_number || 'invoice';
        } else if (invoiceData.data) {
            if (invoiceData.data.invoice_info) {
                invoiceInfo = invoiceData.data.invoice_info;
                products = invoiceData.data.products || [];
                invoiceNumber = invoiceInfo.invoice_number || invoiceData.data.invoice_number || 'invoice';
            } else {
                // Flat structure in data
                invoiceInfo = invoiceData.data;
                products = invoiceData.data.products || [];
                invoiceNumber = invoiceData.data.invoice_number || 'invoice';
            }
        } else {
            // Direct structure
            invoiceInfo = invoiceData;
            products = invoiceData.products || [];
            invoiceNumber = invoiceData.invoice_number || 'invoice';
        }
        
        // Ensure we have a valid invoice number
        if (!invoiceNumber || invoiceNumber === 'undefined') {
            invoiceNumber = 'invoice';
        }
        
        // Debug logging to see what data we're working with
        console.log('Extracted invoiceInfo:', JSON.stringify(invoiceInfo, null, 2));
        console.log('Extracted products:', JSON.stringify(products, null, 2));
        console.log('Extracted invoiceNumber:', invoiceNumber);

        // Normalize product data structure for PDF generation
        const normalizedProducts = products.map(item => {
          // Handle different possible product structures
          const qty = parseFloat(item.quantity || item.qty || item.approved_qty || 0);
          const price = parseFloat(item.price || item.rate || item.unit_price || item.approved_price || 0);
          
          // Calculate initial item total as Qty * Price (this will be adjusted later for inclusive GST)
          const itemTotal = qty * price;
          
          return {
            id: item.id || item.product_id || null,
            name: item.name || item.product_name || 'Unknown Product',
            quantity: qty,
            price: price,
            item_total: itemTotal.toFixed(2), // Initial item total
            gst_rate: parseFloat(item.gst_rate || item.gst || 0),
            hsn_code: item.hsn_code || item.hsn || null,
            category: item.category || null,
            brand: item.brand || null
          };
        });
        
        // Calculate totals based on GST method
        let subTotal = 0;
        let totalTaxableValue = 0;
        let totalGstAmount = 0;
        let cgstAmount = 0;
        let sgstAmount = 0;
        let grandTotal = 0;
        
        const isInclusive = gstMethod === "Inclusive GST";
        
       // FIXED CODE for Inclusive GST calculation:
        if (isInclusive) {
        normalizedProducts.forEach(item => {
            const qty = parseFloat(item.quantity || 0);
            const price = parseFloat(item.price || 0); // This is 56.00 (GST inclusive price)
            const gstRate = parseFloat(item.gst_rate || 0); // This is 5%
            
            // For inclusive GST, the price already includes GST
            const priceIncludingGst = qty * price; // This is 56.00 (Rate * Qty)
            const taxableValue = gstRate > 0 ? priceIncludingGst / (1 + gstRate / 100) : priceIncludingGst; // This is 53.33
            const gstAmount = priceIncludingGst - taxableValue; // This is 2.67
            
            // FIX: Item total should be the taxable value, not the GST-inclusive amount
            item.calculated_taxable_value = taxableValue.toFixed(2);
            item.calculated_gst_amount = gstAmount.toFixed(2);
            item.item_total = taxableValue.toFixed(2); // CHANGED: This should be 53.33, not 56.00
            
            totalTaxableValue += taxableValue;
            totalGstAmount += gstAmount;
        });
        subTotal = totalTaxableValue;

        } else {
          // For exclusive GST, we calculate GST on top of the base price
          normalizedProducts.forEach(item => {
            const qty = parseFloat(item.quantity || 0);
            const price = parseFloat(item.price || 0);
            const gstRate = parseFloat(item.gst_rate || 0);
            
            const taxableValue = qty * price; // Base amount without GST (Rate * Qty)
            const gstAmount = taxableValue * (gstRate / 100);
            const priceIncludingGst = taxableValue + gstAmount; // Total including GST
            
            item.calculated_taxable_value = taxableValue.toFixed(2);
            item.calculated_gst_amount = gstAmount.toFixed(2);
            item.item_total = taxableValue.toFixed(2); // FIX: For exclusive GST, item total should be just Rate * Qty
            
            totalTaxableValue += taxableValue;
            totalGstAmount += gstAmount;
          });
          subTotal = totalTaxableValue;
        }
        
        cgstAmount = (parseFloat(totalGstAmount) / 2).toFixed(2);
        sgstAmount = (parseFloat(totalGstAmount) / 2).toFixed(2);
        grandTotal = (parseFloat(totalTaxableValue) + parseFloat(totalGstAmount)).toFixed(2);
        
        subTotal = parseFloat(subTotal).toFixed(2);
        totalTaxableValue = parseFloat(totalTaxableValue).toFixed(2);
        totalGstAmount = parseFloat(totalGstAmount).toFixed(2);
        
        // Header - Clean and minimal
        page.drawText("TAX INVOICE", { x: 50, y: 790, size: 24, font: helveticaBoldFont, color: primaryColor });
        
        // GST Invoice Type - Small and subtle
        const gstTypeText = isInclusive ? "(Inclusive GST)" : "(Exclusive GST)";
        page.drawText(gstTypeText, { x: 50, y: 770, size: 10, font: helveticaFont, color: secondaryColor });
        
        // Company and Customer Info - Side by side with more space
        page.drawText("Invoice From:", { x: 50, y: 740, size: 12, font: helveticaBoldFont, color: textColor });
        page.drawText("Appu OMS", { x: 50, y: 720, size: 14, font: helveticaFont, color: textColor });
        page.drawText("Bangalore - 560068", { x: 50, y: 705, size: 10, font: helveticaFont, color: secondaryColor });
        page.drawText("GST: 29XXXXX1234Z1Z5", { x: 50, y: 690, size: 10, font: helveticaFont, color: secondaryColor });
        
        page.drawText("Invoice To:", { x: 300, y: 740, size: 12, font: helveticaBoldFont, color: textColor });
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
        page.drawText(invoiceNumber || 'N/A', { x: 130, y: 630, size: 10, font: helveticaFont, color: textColor });
        
        page.drawText("Date:", { x: 300, y: 630, size: 10, font: helveticaBoldFont, color: textColor });
        page.drawText(
            invoiceInfo.created_at 
                ? new Date(invoiceInfo.created_at).toLocaleDateString() 
                : new Date().toLocaleDateString(), 
            { x: 350, y: 630, size: 10, font: helveticaFont, color: textColor }
        );
        
        page.drawText("GST Method:", { x: 50, y: 610, size: 10, font: helveticaBoldFont, color: textColor });
        page.drawText(isInclusive ? "Inclusive" : "Exclusive", { x: 130, y: 610, size: 10, font: helveticaFont, color: textColor });
        
        page.drawText("Total Items:", { x: 300, y: 610, size: 10, font: helveticaBoldFont, color: textColor });
        page.drawText((invoiceInfo.total_items || normalizedProducts.length || 'N/A').toString(), { x: 380, y: 610, size: 10, font: helveticaFont, color: textColor });
        
        // Order Items Table - Wider columns, larger fonts, more spacing
        page.drawLine({ start: { x: 50, y: 590 }, end: { x: 545, y: 590 }, thickness: 0.5, color: secondaryColor });
        page.drawText("Items", { x: 50, y: 570, size: 14, font: helveticaBoldFont, color: primaryColor });
        
        // Table headers with cleaner layout (different columns based on GST method)
        let headers, headerPositions, columnWidths;
        
        if (isInclusive) {
            // For inclusive GST, show Taxable column
            headers = ["#", "Description", "Qty", "Rate", "Taxable", "GST%", "Total"];
            headerPositions = [55, 85, 280, 320, 370, 430, 480];
            columnWidths = [25, 190, 35, 45, 55, 45, 50];
        } else {
            // For exclusive GST, don't show Taxable column
            headers = ["#", "Description", "Qty", "Rate", "GST%", "Total"];
            headerPositions = [55, 85, 280, 320, 430, 480];
            columnWidths = [25, 190, 35, 45, 45, 50];
        }
        
        page.drawRectangle({ x: 50, y: 545, width: 495, height: 20, color: backgroundColor });
        headers.forEach((header, index) => {
            page.drawText(header, { x: headerPositions[index], y: 550, size: 9, font: helveticaBoldFont, color: textColor });
        });
        
        // Table rows with alternating colors and more vertical space
        let itemY = 530;
        const baseRowHeight = 25; // Base height for single line items
        
        normalizedProducts.forEach((item, index) => {
            // Calculate row height based on item name length
            const itemName = item.name || 'Unknown Item';
            const maxLineLength = 28;
            let lineCount = 1;
            
            if (itemName.length > maxLineLength) {
                const words = itemName.split(' ');
                let lines = [];
                let currentLine = '';
                
                words.forEach(word => {
                    if ((currentLine + word).length <= maxLineLength) {
                        currentLine += (currentLine ? ' ' : '') + word;
                    } else {
                        if (currentLine) {
                            lines.push(currentLine);
                            currentLine = word;
                        } else {
                            // Handle case where a single word is longer than maxLineLength
                            while (word.length > maxLineLength) {
                                lines.push(word.substring(0, maxLineLength));
                                word = word.substring(maxLineLength);
                            }
                            currentLine = word;
                        }
                    }
                });
                
                if (currentLine) {
                    lines.push(currentLine);
                }
                
                lineCount = lines.length;
            }
            
            const rowHeight = Math.max(baseRowHeight, lineCount * 12); // 12 points per line
            
            const rowColor = index % 2 === 0 ? rgb(1, 1, 1) : backgroundColor;
            page.drawRectangle({ x: 50, y: itemY - rowHeight + 5, width: 495, height: rowHeight, color: rowColor });
            
            page.drawText(`${index + 1}`, { x: 55, y: itemY, size: 10, font: helveticaFont, color: textColor });
            
            // Handle long item names by splitting them into multiple lines if needed
            if (itemName.length > maxLineLength) {
                // Split the item name into multiple lines
                const words = itemName.split(' ');
                let lines = [];
                let currentLine = '';
                
                words.forEach(word => {
                    if ((currentLine + word).length <= maxLineLength) {
                        currentLine += (currentLine ? ' ' : '') + word;
                    } else {
                        if (currentLine) {
                            lines.push(currentLine);
                            currentLine = word;
                        } else {
                            // Handle case where a single word is longer than maxLineLength
                            while (word.length > maxLineLength) {
                                lines.push(word.substring(0, maxLineLength));
                                word = word.substring(maxLineLength);
                            }
                            currentLine = word;
                        }
                    }
                });
                
                if (currentLine) {
                    lines.push(currentLine);
                }
                
                // Draw each line of the item name
                const lineHeight = 12;
                lines.forEach((line, lineIndex) => {
                    page.drawText(line, { 
                        x: 85, 
                        y: itemY - (lineIndex * lineHeight), 
                        size: 10, 
                        font: helveticaFont, 
                        color: textColor 
                    });
                });
                
                // Adjust the Y position for other fields in this row to align with the first line
                const otherFieldsY = itemY - ((lineCount - 1) * lineHeight / 2);
                
                // For Inclusive GST method in table display:
                if (isInclusive) {
                page.drawText(`${item.quantity || 0}`, { x: 285, y: otherFieldsY, size: 10, font: helveticaFont, color: textColor });
                page.drawText(`${parseFloat(item.price || 0).toFixed(2)}`, { x: 325, y: otherFieldsY, size: 10, font: helveticaFont, color: textColor }); // Show 56.00 as Rate
                page.drawText(`${parseFloat(item.calculated_taxable_value || 0).toFixed(2)}`, { x: 375, y: otherFieldsY, size: 10, font: helveticaFont, color: textColor }); // Show 53.33 as Taxable
                page.drawText(`${item.gst_rate || 0}%`, { x: 435, y: otherFieldsY, size: 10, font: helveticaFont, color: textColor });
                page.drawText(`${parseFloat(item.item_total || 0).toFixed(2)}`, { x: 485, y: otherFieldsY, size: 10, font: helveticaFont, color: textColor }); // This should now show 53.33
                } else {
                    // For exclusive GST method
                    page.drawText(`${item.quantity || 0}`, { x: 285, y: otherFieldsY, size: 10, font: helveticaFont, color: textColor });
                    page.drawText(`${parseFloat(item.price || 0).toFixed(2)}`, { x: 325, y: otherFieldsY, size: 10, font: helveticaFont, color: textColor });
                    page.drawText(`${item.gst_rate || 0}%`, { x: 435, y: otherFieldsY, size: 10, font: helveticaFont, color: textColor });
                    page.drawText(`${parseFloat(item.item_total || 0).toFixed(2)}`, { x: 485, y: otherFieldsY, size: 10, font: helveticaFont, color: textColor });
                }
            } else {
                page.drawText(itemName, { x: 85, y: itemY, size: 10, font: helveticaFont, color: textColor });
                
                if (isInclusive) {
                    // For inclusive GST method
                    page.drawText(`${item.quantity || 0}`, { x: 285, y: itemY, size: 10, font: helveticaFont, color: textColor });
                    page.drawText(`${parseFloat(item.price || 0).toFixed(2)}`, { x: 325, y: itemY, size: 10, font: helveticaFont, color: textColor });
                    page.drawText(`${parseFloat(item.calculated_taxable_value || 0).toFixed(2)}`, { x: 375, y: itemY, size: 10, font: helveticaFont, color: textColor });
                    page.drawText(`${item.gst_rate || 0}%`, { x: 435, y: itemY, size: 10, font: helveticaFont, color: textColor });
                    page.drawText(`${parseFloat(item.item_total || 0).toFixed(2)}`, { x: 485, y: itemY, size: 10, font: helveticaFont, color: textColor });
                } else {
                    // For exclusive GST method
                    page.drawText(`${item.quantity || 0}`, { x: 285, y: itemY, size: 10, font: helveticaFont, color: textColor });
                    page.drawText(`${parseFloat(item.price || 0).toFixed(2)}`, { x: 325, y: itemY, size: 10, font: helveticaFont, color: textColor });
                    page.drawText(`${item.gst_rate || 0}%`, { x: 435, y: itemY, size: 10, font: helveticaFont, color: textColor });
                    page.drawText(`${parseFloat(item.item_total || 0).toFixed(2)}`, { x: 485, y: itemY, size: 10, font: helveticaFont, color: textColor });
                }
            }
            
            itemY -= rowHeight;
        });
        
        // Table borders - Light lines for separation
        page.drawLine({ start: { x: 50, y: 565 }, end: { x: 545, y: 565 }, thickness: 1, color: secondaryColor });
        page.drawLine({ start: { x: 50, y: itemY + 5 }, end: { x: 545, y: itemY + 5 }, thickness: 1, color: secondaryColor });
        
        // Add vertical column separators for professional look (different separators based on GST method)
        let separatorPositions;
        if (isInclusive) {
            // For inclusive GST (7 columns)
            separatorPositions = [75, 275, 315, 365, 425, 475];
        } else {
            // For exclusive GST (6 columns)
            separatorPositions = [75, 275, 315, 425, 475];
        }
        
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
        page.drawRectangle({ x: 350, y: totalsY - 135, width: 195, height: 135, color: backgroundColor });
        
        let currentTotalsY = totalsY - 20;
        const totalsSpacing = 15;
        
        // Extract roundOff from adjustments if available
        let roundOffAmount = "0.00";
        if (invoiceInfo.adjustments) {
            try {
                const adjustments = typeof invoiceInfo.adjustments === 'string' 
                    ? JSON.parse(invoiceInfo.adjustments) 
                    : invoiceInfo.adjustments;
                
                if (Array.isArray(adjustments) && adjustments.length > 0) {
                    const roundOffAdjustment = adjustments.find(adj => adj.roundOff !== undefined);
                    if (roundOffAdjustment) {
                        roundOffAmount = parseFloat(roundOffAdjustment.roundOff).toFixed(2);
                    }
                }
            } catch (e) {
                console.warn("Failed to parse adjustments for roundOff:", e);
            }
        }
        
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
        
        // Add Round Off amount
        page.drawText("Round Off (Rs.):", { x: 360, y: currentTotalsY, size: 10, font: helveticaBoldFont, color: textColor });
        page.drawText(roundOffAmount, { x: 480, y: currentTotalsY, size: 10, font: helveticaFont, color: textColor });
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
        
        // Generate filename with proper null check
        const fileName = `Invoice_${invoiceNumber.toString().replace(/[^a-zA-Z0-9]/g, '_')}.pdf`;
        
        // Convert to base64 for sharing
        const base64PDF = uint8ToBase64(pdfBytes);
        
        console.log('PDF generated successfully for sharing');
        return { success: true, pdfBytes: base64PDF, fileName };
        
    } catch (error) {
        console.error('Error generating PDF:', error);
        return { success: false, error: error.message };
    }
};

// Share PDF file directly from base64 data with improved error handling
export const shareInvoicePDF = async (base64PDF, fileName) => {
    try {
        console.log('Sharing PDF directly:', fileName);
        
        // Validate inputs
        if (!base64PDF || !fileName) {
            throw new Error('Invalid PDF data or filename');
        }
        
        const shareOptions = {
            title: 'Share Invoice',
            message: `Invoice: ${fileName}`,
            url: `data:application/pdf;base64,${base64PDF}`,
            type: 'application/pdf',
            subject: `Invoice - ${fileName}`, // Add subject for email sharing
        };
        
        const result = await Share.open(shareOptions);
        console.log('PDF shared successfully:', result);
        return { success: true, result };
        
    } catch (error) {
        console.error('Error sharing PDF:', error);
        
        // Handle user cancellation gracefully
        if (error.message === 'User did not share' || 
            error.message.includes('cancelled') ||
            error.message.includes('Cancel')) {
            return { success: true, cancelled: true };
        }
        
        return { success: false, error: error.message };
    }
};

// Fetch general ledgers (bank accounts) by under_group
export const fetchGeneralLedgers = async (params = {}) => {
    try {
        const authToken = await getToken();
        const { under_group = 'Bank Accounts' } = params;
        
        // For GET requests, we need to pass parameters as query string
        const queryParams = new URLSearchParams({ under_group }).toString();
        const url = `http://${ipAddress}:8091/general_ledger?${queryParams}`;
        
        console.log('Fetching general ledgers from:', url);
        
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                Authorization: `Bearer ${authToken}`,
                "Content-Type": "application/json",
            },
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Failed to fetch general ledgers. Status:', response.status, 'Response:', errorText);
            throw new Error(`Failed to fetch general ledgers: ${response.status} - ${errorText}`);
        }

        const data = await response.json();
        console.log('Raw general ledgers response:', data);
        
        // Process bank_accounts data for all records
        let processedData = [];
        if (Array.isArray(data.data)) {
            console.log('Processing array of bank account records, count:', data.data.length);
            processedData = data.data.map(processBankAccountData);
        } else if (data.data) {
            console.log('Processing single bank account record');
            processedData = [processBankAccountData(data.data)];
        }
            
        console.log('Processed bank accounts data:', processedData);
        return { success: true, data: processedData || [] };
    } catch (err) {
        console.error("Error fetching general ledgers:", err);
        return { success: false, error: err.message };
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

// Calculate total amount for selected products (before GST adjustments)
// This is what gets sent to the backend
export const calculateTotalAmount = (selectedProducts) => {
    return selectedProducts.reduce((sum, product) => {
        const price = parseFloat(product.price) || 0;
        const quantity = parseInt(product.quantity) || 0;
        return sum + (price * quantity);
    }, 0);
};

// Calculate GST-aware total for display purposes
// This is what gets shown to the user in the UI
export const calculateGSTAwareTotal = async (selectedProducts) => {
    try {
        // Fetch client status to get GST method
        const clientStatusResult = await fetchClientStatus();
        let gstMethod = "Inclusive GST"; // Default to inclusive
        if (clientStatusResult.success) {
            gstMethod = clientStatusResult.data.gst_method || clientStatusResult.data.gstMethod || "Inclusive GST";
        }
        
        const isInclusive = gstMethod === "Inclusive GST";
        let totalTaxableValue = 0;
        let totalGstAmount = 0;
        
        if (isInclusive) {
            // For inclusive GST, the price already includes GST
            selectedProducts.forEach(item => {
                const qty = parseFloat(item.quantity || 0);
                const price = parseFloat(item.price || 0); // This is the GST-inclusive price
                const gstRate = parseFloat(item.gst_rate || 0);
                
                // For inclusive GST, the price already includes GST
                const priceIncludingGst = qty * price; // This is the total (Rate * Qty)
                const taxableValue = gstRate > 0 ? priceIncludingGst / (1 + gstRate / 100) : priceIncludingGst;
                const gstAmount = priceIncludingGst - taxableValue;
                
                totalTaxableValue += taxableValue;
                totalGstAmount += gstAmount;
            });
        } else {
            // For exclusive GST, we calculate GST on top of the base price
            selectedProducts.forEach(item => {
                const qty = parseFloat(item.quantity || 0);
                const price = parseFloat(item.price || 0);
                const gstRate = parseFloat(item.gst_rate || 0);
                
                const taxableValue = qty * price; // Base amount without GST (Rate * Qty)
                const gstAmount = taxableValue * (gstRate / 100);
                
                totalTaxableValue += taxableValue;
                totalGstAmount += gstAmount;
            });
        }
        
        const grandTotal = totalTaxableValue + totalGstAmount;
        const cgstAmount = totalGstAmount / 2;
        const sgstAmount = totalGstAmount / 2;
        
        return {
            subtotal: parseFloat(totalTaxableValue).toFixed(2),
            gstAmount: parseFloat(totalGstAmount).toFixed(2),
            cgstAmount: parseFloat(cgstAmount).toFixed(2),
            sgstAmount: parseFloat(sgstAmount).toFixed(2),
            grandTotal: parseFloat(grandTotal).toFixed(2),
            gstMethod: gstMethod
        };
    } catch (error) {
        console.error('Error calculating GST-aware total:', error);
        // Fallback to simple calculation
        const simpleTotal = selectedProducts.reduce((sum, product) => {
            const price = parseFloat(product.price) || 0;
            const quantity = parseInt(product.quantity) || 0;
            return sum + (price * quantity);
        }, 0);
        
        return {
            subtotal: parseFloat(simpleTotal).toFixed(2),
            gstAmount: "0.00",
            cgstAmount: "0.00",
            sgstAmount: "0.00",
            grandTotal: parseFloat(simpleTotal).toFixed(2),
            gstMethod: "Inclusive GST"
        };
    }
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