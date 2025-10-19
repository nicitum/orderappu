import { fetchClientStatus } from './InvoiceDirectHelper';
import * as InvoiceDirectHelper from './InvoiceDirectHelper';
import { LICENSE_NO } from '../../../config';

// Test function to verify import
const testImport = () => {
  console.log('InvoiceDirectHelper keys:', Object.keys(InvoiceDirectHelper));
  console.log('fetchClientStatus exists:', typeof InvoiceDirectHelper.fetchClientStatus);
};

/**
 * Generate and print POS receipt for 2-inch thermal printer
 * @param {Object} invoiceData - The invoice data to print
 * @param {Object} customerData - Customer information (optional)
 * @param {string} deviceId - The connected Bluetooth device ID
 * @param {Object} RNBluetoothClassic - The RNBluetoothClassic instance
 */
export const printInvoicePOSPDF = async (invoiceData, customerData, deviceId, RNBluetoothClassic) => {
  try {
    console.log('Starting POS print with data:', { invoiceData, customerData, deviceId });
    
    // Debug: Log the collections data
    console.log('Collections data in print function:', invoiceData.collections);
    
    if (!deviceId) {
      throw new Error('No printer connected');
    }

    // Handle different possible data structures more gracefully
    let invoiceInfo = {};
    let products = [];
    
    // Try to extract invoice info and products from different possible structures
    if (invoiceData.invoice_info && invoiceData.products) {
      // Standard structure
      invoiceInfo = invoiceData.invoice_info;
      products = invoiceData.products;
    } else if (invoiceData.invoice && invoiceData.items) {
      // Alternative structure with invoice and items
      invoiceInfo = {
        invoice_number: invoiceData.invoice.invoice_number,
        invoice_amount: invoiceData.invoice.invoice_amount,
        total_items: invoiceData.items.length,
        created_at: invoiceData.invoice.created_at
      };
      products = invoiceData.items;
    } else if (invoiceData.data) {
      // Data wrapped in data property
      if (invoiceData.data.invoice_info && invoiceData.data.products) {
        invoiceInfo = invoiceData.data.invoice_info;
        products = invoiceData.data.products;
      } else if (invoiceData.data.invoice && invoiceData.data.items) {
        invoiceInfo = {
          invoice_number: invoiceData.data.invoice.invoice_number,
          invoice_amount: invoiceData.data.invoice.invoice_amount,
          total_items: invoiceData.data.items.length,
          created_at: invoiceData.data.invoice.created_at
        };
        products = invoiceData.data.items;
      }
    } else {
      // Try to extract directly from root if possible
      invoiceInfo = {
        invoice_number: invoiceData.invoice_number || invoiceData.invoice?.invoice_number || 'N/A',
        invoice_amount: invoiceData.invoice_amount || invoiceData.invoice?.invoice_amount || '0',
        total_items: (invoiceData.items?.length || invoiceData.products?.length || 0),
        created_at: invoiceData.created_at || invoiceData.invoice?.created_at || null
      };
      products = invoiceData.items || invoiceData.products || [];
    }

    // Validate that we have the required data
    if (!invoiceInfo.invoice_number || products.length === 0) {
      throw new Error('Invalid invoice data structure');
    }

    // Check if device is still connected before printing
    try {
      const connectedDevices = await RNBluetoothClassic.getConnectedDevices();
      const isDeviceConnected = connectedDevices.some(device => device.id === deviceId);
      
      if (!isDeviceConnected) {
        throw new Error('Printer is no longer connected. Please reconnect and try again.');
      }
    } catch (connectionError) {
      console.log('Connection check failed:', connectionError);
      throw new Error('Unable to verify printer connection: ' + connectionError.message);
    }

    // Fetch client status to get business information and GST method
    console.log('About to call fetchClientStatus');
    console.log('InvoiceDirectHelper:', InvoiceDirectHelper);
    // Run test import
    testImport();
    const fetchClientStatus = InvoiceDirectHelper.fetchClientStatus;
    console.log('fetchClientStatus function:', fetchClientStatus);
    const clientStatusResult = await fetchClientStatus();
    console.log('clientStatusResult:', clientStatusResult);
    let clientData = {};
    let gstMethod = "Inclusive GST"; // Default to inclusive
    if (clientStatusResult.success) {
      clientData = clientStatusResult.data;
      gstMethod = clientData.gst_method || "Inclusive GST";
    }

    console.log('Client Data:', clientData);
    console.log('GST Method:', gstMethod);

    // Calculate totals based on GST method
    let subTotal = 0;
    let totalTaxableValue = 0;
    let totalGstAmount = 0;
    let gstRatePercentage = 0; // To store the actual GST rate for display
    
    const isInclusive = gstMethod === "Inclusive GST";
    
    if (isInclusive) {
      products.forEach(item => {
        // Fix: Calculate item total as quantity * price if item_total is not provided
        const itemTotal = parseFloat(item.item_total) || (parseFloat(item.quantity) * parseFloat(item.price));
        const gstRate = parseFloat(item.gst_rate || 0);
        const taxableValue = gstRate > 0 ? itemTotal / (1 + gstRate / 100) : itemTotal;
        const gstAmount = itemTotal - taxableValue;
        
        item.calculated_taxable_value = taxableValue.toFixed(2);
        item.calculated_gst_amount = gstAmount.toFixed(2);
        
        totalTaxableValue += taxableValue;
        totalGstAmount += gstAmount;
        
        // Use the first item's GST rate for display (assuming uniform rate)
        if (gstRate > 0 && gstRatePercentage === 0) {
          gstRatePercentage = gstRate;
        }
      });
      subTotal = totalTaxableValue;
    } else {
      products.forEach(item => {
        // Fix: Calculate item total as quantity * price if item_total is noFt provided
        const itemTotal = parseFloat(item.item_total) || (parseFloat(item.quantity) * parseFloat(item.price));
        const gstRate = parseFloat(item.gst_rate || 0);
        const gstAmount = itemTotal * (gstRate / 100);
        
        item.calculated_taxable_value = itemTotal.toFixed(2);
        item.calculated_gst_amount = gstAmount.toFixed(2);
        
        subTotal += itemTotal;
        totalGstAmount += gstAmount;
        
        // Use the first item's GST rate for display (assuming uniform rate)
        if (gstRate > 0 && gstRatePercentage === 0) {
          gstRatePercentage = gstRate;
        }
      });
      totalTaxableValue = subTotal;
    }
    
    const cgstAmount = (totalGstAmount / 2).toFixed(2);
    const sgstAmount = (totalGstAmount / 2).toFixed(2);
    const grandTotal = (totalTaxableValue + totalGstAmount).toFixed(2);
    
    subTotal = subTotal.toFixed(2);
    totalTaxableValue = totalTaxableValue.toFixed(2);
    totalGstAmount = totalGstAmount.toFixed(2);

    // Constants for layout
    const LINE_WIDTH = 32;
    const DIVIDER = '-'.repeat(LINE_WIDTH);

    // Helper functions
    const alignRight = (label, value) => {
      const paddingLength = LINE_WIDTH - label.length - value.length;
      return `${label}${' '.repeat(paddingLength >= 0 ? paddingLength : 0)}${value}`;
    };

    const centerText = (text) => {
      const padding = Math.floor((LINE_WIDTH - text.length) / 2);
      return ' '.repeat(padding) + text;
    };

    const wrapText = (text, width = LINE_WIDTH) => {
      const lines = [];
      while (text.length > width) {
        let breakIndex = text.lastIndexOf(' ', width);
        if (breakIndex === -1) breakIndex = width;
        lines.push(text.substring(0, breakIndex).trim());
        text = text.substring(breakIndex).trim();
      }
      if (text) lines.push(text);
      return lines;
    };

    // Generate ESC/POS commands for printing
    const printCommands = [];

    // Initialize printer
    printCommands.push('\x1B\x40'); // Initialize printer
    
    // Header - Center aligned
    printCommands.push('\x1B\x61\x01'); // Center align
    printCommands.push('\x1B\x21\x10'); // Double height
    // Use client data instead of hardcoded values
    printCommands.push((clientData.client_name || 'Appu OMS').toUpperCase() + '\n');
    printCommands.push('\x1B\x21\x00'); // Normal size
    printCommands.push((clientData.client_address || 'BANGALORE - 560068') + '\n');
    if (clientData.gst_no) {
      printCommands.push('GST: ' + clientData.gst_no + '\n');
    }
    if (clientData.phone) {
      printCommands.push('Contact: ' + clientData.phone + '\n');
    }
    printCommands.push(DIVIDER + '\n');
    
    // Invoice info - Left aligned
    printCommands.push('\x1B\x61\x00'); // Left align
    
    // Fix date formatting - handle both string and Unix timestamp formats
    let invoiceDate = 'N/A';
    let invoiceTime = 'N/A';
    const createdAt = invoiceInfo.created_at;
    
    if (createdAt) {
      // Handle Unix timestamp (in seconds or milliseconds)
      if (typeof createdAt === 'number') {
        const timestamp = createdAt > 10000000000 ? createdAt : createdAt * 1000;
        const dateObj = new Date(timestamp);
        if (dateObj.getFullYear() > 1970) {
          invoiceDate = dateObj.toLocaleDateString();
          invoiceTime = dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        }
      } 
      // Handle ISO string format
      else if (typeof createdAt === 'string') {
        const dateObj = new Date(createdAt);
        if (dateObj.getFullYear() > 1970) {
          invoiceDate = dateObj.toLocaleDateString();
          invoiceTime = dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        }
      }
    }
    
    printCommands.push(alignRight('Invoice: ', invoiceInfo.invoice_number) + '\n');
    printCommands.push(alignRight('Date: ', invoiceDate) + '\n');
    printCommands.push(alignRight('Time: ', invoiceTime) + '\n');
    
    // Customer info
    if (customerData) {
      printCommands.push(alignRight('Customer: ', customerData.username || 'N/A') + '\n');
      if (customerData.phone) {
        printCommands.push(alignRight('Phone: ', customerData.phone) + '\n');
      }
    } else {
      printCommands.push('Customer: Walk-in Customer\n');
    }
    
    printCommands.push(DIVIDER + '\n');
    
    // Items header - Center bold
    printCommands.push('\x1B\x61\x01'); // Center align
    printCommands.push('\x1B\x21\x08'); // Bold text
    printCommands.push(centerText('ITEMS') + '\n');
    printCommands.push('\x1B\x21\x00'); // Normal text
    printCommands.push('\x1B\x61\x00'); // Left align
    printCommands.push(DIVIDER + '\n');
    
    // Items
    products.forEach((item) => {
      // Item name wrapped to lines (up to 4 lines max, but dynamic)
      let itemName = item.name || 'Item';
      const nameLines = wrapText(itemName, LINE_WIDTH);
      nameLines.forEach(line => printCommands.push(line + '\n'));
      
      // Details in brackets, compact format on multiple lines if needed
      const hsnCode = item.hsn_code || 'N/A';
      const gstRate = parseFloat(item.gst_rate || 0).toFixed(2);
      const quantity = item.quantity.toString();
      const price = parseFloat(item.price || 0).toFixed(2);
      
      printCommands.push(` [HSN: ${hsnCode}] [GST: ${gstRate}%]\n`);
      printCommands.push(` [Qty: ${quantity}] [Price: Rs. ${price}]\n`);
      
      // Amount right aligned - Fix: Calculate amount as quantity * price
      const amount = parseFloat(item.item_total) || (parseFloat(item.quantity) * parseFloat(item.price));
      printCommands.push(alignRight(' Amount: ', `Rs. ${amount.toFixed(2)}`) + '\n');
      
      // Show discount if applicable
      if (item.discount && parseFloat(item.discount) > 0) {
        const discount = parseFloat(item.discount).toFixed(2);
        printCommands.push(alignRight(' Discount: ', `-Rs. ${discount}`) + '\n');
      }
      
      // Separator between items
      printCommands.push('\n');
    });
    
    printCommands.push(DIVIDER + '\n');
    
    // Totals - Right aligned amounts
    printCommands.push(alignRight(`GST (${isInclusive ? 'Incl' : 'Excl'}): `, `Rs. ${totalGstAmount}`) + '\n');
    printCommands.push(alignRight('Subtotal: ', `Rs. ${subTotal}`) + '\n');
    printCommands.push('\x1B\x21\x08'); // Bold text
    printCommands.push(alignRight('TOTAL: ', `Rs. ${grandTotal}`) + '\n');
    printCommands.push('\x1B\x21\x00'); // Normal text
    
    // Amount in words - wrapped if long
    const amountInWords = numberToWords(parseFloat(grandTotal));
    const wordsLines = wrapText(amountInWords, LINE_WIDTH - 14); // Account for "Amt in words: " prefix adjustment
    printCommands.push('Amt in words:\n');
    wordsLines.forEach(line => printCommands.push(' ' + line + '\n'));
    
    printCommands.push(DIVIDER + '\n');
    
    // GST details
    const gstRateDisplay = gstRatePercentage > 0 ? (gstRatePercentage / 2).toFixed(2) : '0.00';
    printCommands.push(alignRight(`CGST (${gstRateDisplay}%): `, `Rs. ${cgstAmount}`) + '\n');
    printCommands.push(alignRight(`SGST (${gstRateDisplay}%): `, `Rs. ${sgstAmount}`) + '\n');
    printCommands.push(DIVIDER + '\n');
    
    // Collection details with bank account information
    printCommands.push('\x1B\x21\x08'); // Bold text
    printCommands.push(centerText('PAYMENT DETAILS') + '\n');
    printCommands.push('\x1B\x21\x00'); // Normal text
    printCommands.push('\x1B\x61\x00'); // Left align
    
    // Add collections breakdown (assuming collections is always an object; handle NULL as no collections)
    const collections = invoiceData.collections || {};
    
    if (Object.keys(collections).length > 0) {
      if (collections.cash && parseFloat(collections.cash) > 0) {
        printCommands.push(alignRight('Cash: ', `Rs. ${parseFloat(collections.cash).toFixed(2)}`) + '\n');
      }
      
      if (collections.credit && parseFloat(collections.credit) > 0) {
        printCommands.push(alignRight('Credit: ', `Rs. ${parseFloat(collections.credit).toFixed(2)}`) + '\n');
      }
      
      if (collections.upi && parseFloat(collections.upi) > 0) {
        printCommands.push(alignRight('UPI: ', `Rs. ${parseFloat(collections.upi).toFixed(2)}`) + '\n');
        // Add UPI bank account details if available (fetch from JSON)
        if (collections.upi_account_details) {
          const upiAccount = collections.upi_account_details;
          printCommands.push(alignRight('  Acct: ', upiAccount.name || 'N/A') + '\n');
          const acctNum = upiAccount.number ? `****${upiAccount.number.slice(-4)}` : 'N/A';
          printCommands.push(alignRight('  A/c#: ', acctNum) + '\n');
          printCommands.push(alignRight('  IFSC: ', upiAccount.ifsc || 'N/A') + '\n');
        }
      }
      
      if (collections.cheque && parseFloat(collections.cheque) > 0) {
        printCommands.push(alignRight('Cheque: ', `Rs. ${parseFloat(collections.cheque).toFixed(2)}`) + '\n');
        // Add Cheque bank account details if available (fetch from JSON)
        if (collections.cheque_account_details) {
          const chequeAccount = collections.cheque_account_details;
          printCommands.push(alignRight('  Acct: ', chequeAccount.name || 'N/A') + '\n');
          const acctNum = chequeAccount.number ? `****${chequeAccount.number.slice(-4)}` : 'N/A';
          printCommands.push(alignRight('  A/c#: ', acctNum) + '\n');
          printCommands.push(alignRight('  IFSC: ', chequeAccount.ifsc || 'N/A') + '\n');
        }
      }
      
      // Show tendered amount and balance if applicable
      if (collections.tendered && parseFloat(collections.tendered) > 0) {
        printCommands.push(alignRight('Tendered: ', `Rs. ${parseFloat(collections.tendered).toFixed(2)}`) + '\n');
      }
      
      if (collections.balance && parseFloat(collections.balance) !== 0) {
        const balance = parseFloat(collections.balance).toFixed(2);
        if (parseFloat(balance) > 0) {
          printCommands.push(alignRight('Balance: ', `Rs. ${balance}`) + '\n');
        }
      }
    } else {
      // Default collection options if no specific collections data
      printCommands.push('1. Cash\n');
      printCommands.push('2. Credit/Debit Card\n');
      printCommands.push('3. UPI Payment\n');
      printCommands.push('4. Digital Wallet\n');
    }
    
    printCommands.push(DIVIDER + '\n');
    
    // Footer - Center aligned
    printCommands.push('\x1B\x61\x01'); // Center align
    printCommands.push('\x1B\x21\x08'); // Bold text
    printCommands.push('THANK YOU FOR VISITING!\n');
    printCommands.push('\x1B\x21\x00'); // Normal text
    printCommands.push('Have a great day!\n');
    printCommands.push('\n\n\n');
    
    // Cut paper
    printCommands.push('\x1D\x56\x00'); // Cut paper
    
    // Send all commands to printer with better error handling
    const printData = printCommands.join('');
    console.log('Sending print data to device:', printData);
    
    try {
      // Send data in smaller chunks to avoid buffer overflow
      const chunkSize = 100;
      for (let i = 0; i < printData.length; i += chunkSize) {
        const chunk = printData.substring(i, i + chunkSize);
        await RNBluetoothClassic.writeToDevice(deviceId, chunk);
        
        // Small delay between chunks to avoid overwhelming the printer
        await new Promise(resolve => setTimeout(resolve, 10));
      }
      
      console.log('Successfully sent print data to device');
      return { success: true, message: 'Invoice printed successfully' };
    } catch (printError) {
      console.error('Failed to send print data to device:', printError);
      
      // Check if device is still connected after error
      try {
        const connectedDevices = await RNBluetoothClassic.getConnectedDevices();
        const isDeviceConnected = connectedDevices.some(device => device.id === deviceId);
        
        if (!isDeviceConnected) {
          throw new Error('Printer disconnected during printing. Please reconnect and try again.');
        }
      } catch (connectionCheckError) {
        console.log('Connection check after print error failed:', connectionCheckError);
        throw new Error('Printer connection lost during printing: ' + printError.message);
      }
      
      throw new Error(`Failed to print: ${printError.message}`);
    }
  } catch (error) {
    console.error('Error printing invoice:', error);
    return { success: false, error: error.message, details: error };
  }
};

/**
 * Convert number to words for Indian currency format
 * @param {number} num - The number to convert
 * @returns {string} - The number in words
 */
const numberToWords = (num) => {
  const units = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine"];
  const teens = ["Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
  const tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

  if (num === 0) return "Zero Rupees Only";

  const rupees = Math.floor(num);
  const paise = Math.round((num - rupees) * 100);

  const convertToWords = (n) => {
    if (n === 0) return "";
    if (n < 10) return units[n];
    if (n < 20) return teens[n - 10];
    if (n < 100) {
      const ten = Math.floor(n / 10);
      const unit = n % 10;
      return tens[ten] + (unit > 0 ? " " + units[unit] : "");
    }
    if (n < 1000) {
      const hundred = Math.floor(n / 100);
      const remainder = n % 100;
      return units[hundred] + " Hundred" + (remainder > 0 ? " " + convertToWords(remainder) : "");
    }
    
    // Indian numbering system
    if (n < 100000) {
      const thousand = Math.floor(n / 1000);
      const remainder = n % 1000;
      return convertToWords(thousand) + " Thousand" + (remainder > 0 ? " " + convertToWords(remainder) : "");
    }
    if (n < 10000000) {
      const lakh = Math.floor(n / 100000);
      const remainder = n % 100000;
      return convertToWords(lakh) + " Lakh" + (remainder > 0 ? " " + convertToWords(remainder) : "");
    }
    
    const crore = Math.floor(n / 10000000);
    const remainder = n % 10000000;
    return convertToWords(crore) + " Crore" + (remainder > 0 ? " " + convertToWords(remainder) : "");
  };

  let result = convertToWords(rupees) + " Rupees";
  if (paise > 0) {
    result += " and " + convertToWords(paise) + " Paise";
  }
  result += " Only";

  return result;
};