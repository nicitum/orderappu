import { fetchClientStatus } from './InvoiceDirectHelper';

/**
 * Generate and print POS receipt for 2-inch thermal printer
 * @param {Object} invoiceData - The invoice data to print
 * @param {Object} customerData - Customer information (optional)
 * @param {string} deviceId - The connected Bluetooth device ID
 * @param {Object} RNBluetoothClassic - The RNBluetoothClassic instance
 */
export const printInvoicePOSPDF = async (invoiceData, customerData, deviceId, RNBluetoothClassic) => {
  try {
    if (!deviceId) {
      throw new Error('No printer connected');
    }

    if (!invoiceData || !invoiceData.invoice_info || !invoiceData.products) {
      throw new Error('Invalid invoice data');
    }

    // Fetch client status to get GST method
    const clientStatusResult = await fetchClientStatus();
    let gstMethod = "Inclusive GST"; // Default to inclusive
    if (clientStatusResult.success) {
      gstMethod = clientStatusResult.data.gstMethod;
    }

    // Calculate totals based on GST method
    let subTotal = 0;
    let totalTaxableValue = 0;
    let totalGstAmount = 0;
    
    const isInclusive = gstMethod === "Inclusive GST";
    const products = invoiceData.products;
    
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

    // Generate ESC/POS commands for printing
    const printCommands = [];

    // Initialize printer
    printCommands.push('\x1B\x40'); // Initialize printer
    
    // Header
    printCommands.push('\x1B\x61\x01'); // Center align
    printCommands.push('ORDER APPU\n');
    printCommands.push('BANGALORE - 560068\n');
    printCommands.push('GST: 29XXXXX1234Z1Z5\n');
    printCommands.push('--------------------------\n');
    
    // Invoice info
    printCommands.push('\x1B\x61\x00'); // Left align
    printCommands.push(`Invoice: ${invoiceData.invoice_info.invoice_number}\n`);
    printCommands.push(`Date: ${new Date(invoiceData.invoice_info.created_at).toLocaleDateString()}\n`);
    
    // Customer info
    if (customerData) {
      printCommands.push(`Customer: ${customerData.username || 'N/A'}\n`);
      if (customerData.phone) {
        printCommands.push(`Phone: ${customerData.phone}\n`);
      }
    } else {
      printCommands.push('Customer: Walk-in Customer\n');
    }
    
    printCommands.push('--------------------------\n');
    
    // Items header
    printCommands.push('\x1B\x21\x08'); // Bold text
    printCommands.push('ITEMS\n');
    printCommands.push('\x1B\x21\x00'); // Normal text
    printCommands.push('--------------------------\n');
    
    // Column headers
    printCommands.push('ITEM          QTY   AMT\n');
    printCommands.push('--------------------------\n');
    
    // Items
    products.forEach((item, index) => {
      // Item name (truncated to fit 2-inch printer)
      const itemName = item.name.length > 12 ? item.name.substring(0, 12) : item.name;
      const paddedItemName = itemName.padEnd(14, ' ');
      
      // Quantity (right aligned)
      const quantity = item.quantity.toString().padStart(3, ' ');
      
      // Amount (right aligned)
      const amount = parseFloat(item.item_total).toFixed(2).padStart(7, ' ');
      
      printCommands.push(`${paddedItemName}${quantity}${amount}\n`);
      
      // Show discount if applicable
      if (item.discount && parseFloat(item.discount) > 0) {
        const discount = parseFloat(item.discount).toFixed(2);
        printCommands.push(`  (Discount: ${discount})\n`);
      }
    });
    
    printCommands.push('--------------------------\n');
    
    // Totals
    printCommands.push('\x1B\x61\x02'); // Right align
    printCommands.push(`Subtotal:      ${subTotal}\n`);
    printCommands.push(`GST (${isInclusive ? 'Incl' : 'Excl'}):   ${totalGstAmount}\n`);
    printCommands.push('\x1B\x21\x08'); // Bold text
    printCommands.push(`TOTAL:         ${grandTotal}\n`);
    printCommands.push('\x1B\x21\x00'); // Normal text
    printCommands.push('\x1B\x61\x00'); // Left align
    
    printCommands.push('--------------------------\n');
    
    // GST details
    printCommands.push(`CGST: ${cgstAmount}  SGST: ${sgstAmount}\n`);
    printCommands.push('--------------------------\n');
    
    // Footer
    printCommands.push('\x1B\x61\x01'); // Center align
    printCommands.push('THANK YOU FOR VISITING!\n');
    printCommands.push('VISIT AGAIN\n');
    printCommands.push('\n\n');
    
    // Cut paper
    printCommands.push('\x1D\x56\x00'); // Cut paper
    
    // Send all commands to printer
    const printData = printCommands.join('');
    await RNBluetoothClassic.writeToDevice(deviceId, printData);
    
    return { success: true, message: 'Invoice printed successfully' };
  } catch (error) {
    console.error('Error printing invoice:', error);
    return { success: false, error: error.message };
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
  const thousands = ["", "Thousand", "Lakh", "Crore"];

  if (num === 0) return "Zero Rupees Only";

  const rupees = Math.floor(num);
  const paise = Math.round((num - rupees) * 100);

  const rupeesToWords = (num) => {
    if (num === 0) return "";
    
    let words = "";
    
    // Handle Crores
    const crores = Math.floor(num / 10000000);
    if (crores > 0) {
      words += `${rupeesToWords(crores)} Crore `;
      num %= 10000000;
    }
    
    // Handle Lakhs
    const lakhs = Math.floor(num / 100000);
    if (lakhs > 0) {
      words += `${rupeesToWords(lakhs)} Lakh `;
      num %= 100000;
    }
    
    // Handle Thousands
    const thousands = Math.floor(num / 1000);
    if (thousands > 0) {
      words += `${rupeesToWords(thousands)} Thousand `;
      num %= 1000;
    }
    
    // Handle Hundreds
    const hundreds = Math.floor(num / 100);
    if (hundreds > 0) {
      words += `${units[hundreds]} Hundred `;
      num %= 100;
    }
    
    // Handle tens and units
    if (num > 0) {
      if (num < 10) {
        words += units[num];
      } else if (num < 20) {
        words += teens[num - 10];
      } else {
        const ten = Math.floor(num / 10);
        const unit = num % 10;
        words += tens[ten];
        if (unit > 0) {
          words += ` ${units[unit]}`;
        }
      }
    }
    
    return words.trim();
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