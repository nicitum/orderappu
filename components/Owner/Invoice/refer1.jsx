// Generate POS PDF from order data (3-inch width receipt for POS printers)
import { getLicenseNo } from '../../utils/licenseUtils';

export const generateOrderPOSPDF = async (orderData, customerData = null, clientData = null) => {
  try {

    // Dynamically import pdf-lib only when needed
    const { PDFDocument, StandardFonts, rgb } = await import('pdf-lib');

    // Use passed clientData or fetch client status to get GST method and client information
    let gstMethod = "Inclusive GST"; // Default to inclusive
    let clientInfo = clientData; // Use passed clientData
    if (!clientInfo) {
      try {
        const licenseNo = getLicenseNo();
        const response = await fetch(`http://147.93.110.150:3001/api/client_status/${licenseNo}`);
        const clientStatusResult = await response.json();
        if (clientStatusResult.success && clientStatusResult.data) {
          clientInfo = Array.isArray(clientStatusResult.data) ? clientStatusResult.data[0] : clientStatusResult.data;
          gstMethod = clientInfo.gst_method || "Inclusive GST";
        }
      } catch (error) {
        console.warn('Failed to fetch client status, using default GST method:', error);
      }
    } else {
      gstMethod = clientInfo.gst_method || "Inclusive GST";
    }



    const pdfDoc = await PDFDocument.create();
    // 3-inch width = 226 points (exact), variable height
    const pageWidth = 226;
    const margin = 8;
    const contentWidth = pageWidth - (margin * 2);
    
    let page = pdfDoc.addPage([pageWidth, 800]);
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    // Extract order info and products
    const orderInfo = orderData.order || orderData;
    const products = orderData.items || orderData.products || [];
    const adjustments = orderInfo.adjustments || orderData.adjustments || { additions: [], deductions: [] };

    // Calculate totals based on GST method
    let subTotal = 0;
    let totalTaxableValue = 0;
    let totalGstAmount = 0;
    let totalAdjustments = 0;
    let adjustmentsGstAmount = 0;

    const isInclusive = gstMethod === "Inclusive GST";

    // Pre-calculate all item values and store raw taxable values for incl_assess calculation
    const productsWithCalculations = products.map(item => {
      const qty = item.approved_qty !== undefined ? item.approved_qty : item.quantity;
      const price = item.approved_price !== undefined ? item.approved_price : item.price;
      const priceIncludingGst = parseFloat(qty * price);
      const gstRate = parseFloat(item.gst_rate || 0);
      
      let taxableValue, gstAmount;
      
      if (isInclusive) {
        taxableValue = gstRate > 0 ? priceIncludingGst / (1 + gstRate / 100) : priceIncludingGst;
        gstAmount = priceIncludingGst - taxableValue;
      } else {
        taxableValue = priceIncludingGst;
        gstAmount = taxableValue * (gstRate / 100);
      }

      return {
        ...item,
        calculated_taxable_value: taxableValue.toFixed(2),
        calculated_gst_amount: gstAmount.toFixed(2),
        raw_taxable_value: taxableValue // Store raw value for incl_assess calculation
      };
    });

    // Calculate totals
    if (isInclusive) {
      productsWithCalculations.forEach(item => {
        totalTaxableValue += parseFloat(item.calculated_taxable_value);
        totalGstAmount += parseFloat(item.calculated_gst_amount);
      });
      subTotal = totalTaxableValue;
    } else {
      productsWithCalculations.forEach(item => {
        subTotal += parseFloat(item.calculated_taxable_value);
        totalGstAmount += parseFloat(item.calculated_gst_amount);
      });
      totalTaxableValue = subTotal;
    }

    // Calculate adjustments with GST
    const adjustmentsWithCalculations = [];
    
    // Process additions
    adjustments.additions?.forEach((adjustment, index) => {
      const value = parseFloat(adjustment.value || 0);
      const gstRate = parseFloat(adjustment.gst_rate || 0);
      
      let taxableValue, gstAmount;
      
      if (isInclusive) {
        taxableValue = gstRate > 0 ? value / (1 + gstRate / 100) : value;
        gstAmount = value - taxableValue;
      } else {
        taxableValue = value;
        gstAmount = taxableValue * (gstRate / 100);
      }
      
      adjustmentsWithCalculations.push({
        ...adjustment,
        id: `addition-${index}`,
        type: 'addition',
        calculated_taxable_value: taxableValue.toFixed(2),
        calculated_gst_amount: gstAmount.toFixed(2),
        final_total: value.toFixed(2)
      });
      
      totalAdjustments += value;
      adjustmentsGstAmount += gstAmount;
    });
    
    // Process deductions
    adjustments.deductions?.forEach((adjustment, index) => {
      const value = parseFloat(adjustment.value || 0);
      const gstRate = parseFloat(adjustment.gst_rate || 0);
      
      let taxableValue, gstAmount;
      
      if (isInclusive) {
        taxableValue = gstRate > 0 ? value / (1 + gstRate / 100) : value;
        gstAmount = value - taxableValue;
      } else {
        taxableValue = value;
        gstAmount = taxableValue * (gstRate / 100);
      }
      
      adjustmentsWithCalculations.push({
        ...adjustment,
        id: `deduction-${index}`,
        type: 'deduction',
        calculated_taxable_value: taxableValue.toFixed(2),
        calculated_gst_amount: gstAmount.toFixed(2),
        final_total: value.toFixed(2)
      });
      
      totalAdjustments -= value;
      adjustmentsGstAmount -= gstAmount;
    });

    // Handle incl_assess adjustments
    // Check if any adjustments have incl_assess = "Yes" in the order data
    let inclAssessAdditions = 0;
    let inclAssessDeductions = 0;
    
    // Check if the orderData contains incl_assess information in the summary
    if (orderData.summary?.adjustments) {
      // Process additions with incl_assess
      orderData.summary.adjustments.additions?.forEach(addition => {
        if (addition.incl_assess === "Yes") {
          const value = parseFloat(addition.value || 0);
          let additionValue;
          if (addition.mode === 'percentage') {
            additionValue = (subTotal * value) / 100;
          } else {
            additionValue = value;
          }
          inclAssessAdditions += additionValue;
        }
      });
      
      // Process deductions with incl_assess
      orderData.summary.adjustments.deductions?.forEach(deduction => {
        if (deduction.incl_assess === "Yes") {
          const value = parseFloat(deduction.value || 0);
          let deductionValue;
          if (deduction.mode === 'percentage') {
            deductionValue = (subTotal * value) / 100;
          } else {
            deductionValue = value;
          }
          inclAssessDeductions += deductionValue;
        }
      });
    }

    // Apply incl_assess adjustments if any
    if ((inclAssessAdditions > 0 || inclAssessDeductions > 0) && totalTaxableValue > 0) {
      // Calculate the net incl_assess adjustment
      const netInclAssessAdjustment = inclAssessAdditions - inclAssessDeductions;
      
      // Distribute the adjustment proportionally to each item based on taxable value
      productsWithCalculations.forEach(item => {
        const itemProportion = parseFloat(item.raw_taxable_value) / totalTaxableValue;
        const itemAdjustment = netInclAssessAdjustment * itemProportion;
        
        // Adjust the item's taxable value and GST amount
        const originalTaxableValue = parseFloat(item.raw_taxable_value);
        const adjustedTaxableValue = originalTaxableValue + itemAdjustment;
        const gstRate = parseFloat(item.gst_rate || 0);
        
        let newGstAmount;
        if (isInclusive) {
          // For inclusive GST, the final price remains the same, so we recalculate GST
          const priceIncludingGst = parseFloat(item.final_total);
          newGstAmount = priceIncludingGst - adjustedTaxableValue;
        } else {
          // For exclusive GST, we calculate GST on the adjusted taxable value
          newGstAmount = adjustedTaxableValue * (gstRate / 100);
        }
        
        // Update the item with adjusted values (keeping higher precision during calculation)
        item.calculated_taxable_value = adjustedTaxableValue.toFixed(2);
        item.calculated_gst_amount = newGstAmount.toFixed(2);
      });
      
      // Recalculate totals with adjusted values using higher precision
      let newTotalTaxableValue = 0;
      let newTotalGstAmount = 0;
      productsWithCalculations.forEach(item => {
        newTotalTaxableValue += parseFloat(item.calculated_taxable_value);
        newTotalGstAmount += parseFloat(item.calculated_gst_amount);
      });
      
      // Update the totals
      totalTaxableValue = newTotalTaxableValue;
      totalGstAmount = newTotalGstAmount;
    }

    // Calculate final totals
    const totalValueWithAdjustments = subTotal + totalAdjustments;
    const totalGstWithAdjustments = totalGstAmount + adjustmentsGstAmount;
    
    // Check if client and customer states match to determine GST type
    const clientState = clientInfo?.state || '';
    const customerState = (customerData && customerData.data && customerData.data.state) || '';
    const useIGST = clientState !== '' && customerState !== '' && clientState !== customerState;
    
    let igstAmount = 0;
    let cgstAmount = 0;
    let sgstAmount = 0;
    
    if (useIGST) {
      // Use IGST when states don't match
      igstAmount = totalGstWithAdjustments;
    } else {
      // Use CGST/SGST when states match or when either state is not available
      cgstAmount = totalGstWithAdjustments / 2;
      sgstAmount = totalGstWithAdjustments / 2;
    }
    
    const orderDiscountAmount = parseFloat(orderData.discountAmount) || 0;
    const grandTotal = totalValueWithAdjustments + totalGstWithAdjustments - orderDiscountAmount;

    subTotal = subTotal;
    totalTaxableValue = totalValueWithAdjustments;
    totalGstAmount = totalGstWithAdjustments;
    totalAdjustments = totalAdjustments;
    adjustmentsGstAmount = adjustmentsGstAmount;

    const formattedSubTotal = subTotal.toFixed(2);
    const formattedTaxableValue = totalTaxableValue.toFixed(2);
    const formattedGstAmount = totalGstAmount.toFixed(2);
    const formattedTotalAdjustments = totalAdjustments.toFixed(2);
    const formattedAdjustmentsGst = adjustmentsGstAmount.toFixed(2);
    const formattedIgstAmount = igstAmount.toFixed(2);
    const formattedCgstAmount = cgstAmount.toFixed(2);
    const formattedSgstAmount = sgstAmount.toFixed(2);
    const formattedGrandTotal = grandTotal.toFixed(2);

    // Starting Y position
    let yPosition = 780;

    // Helper function to draw centered text
    const drawCenteredText = (text, y, size = 9, isBold = false, currentPage = page) => {
      const textWidth = (isBold ? boldFont : font).widthOfTextAtSize(text, size);
      const x = (pageWidth - textWidth) / 2;
      currentPage.drawText(text, { 
        x, 
        y, 
        size, 
        font: isBold ? boldFont : font,
        color: rgb(0, 0, 0)
      });
      return y - (size + 4);
    };

    // Helper function to draw left-aligned text
    const drawLeftText = (text, y, size = 9, isBold = false, currentPage = page) => {
      currentPage.drawText(text, { 
        x: margin, 
        y, 
        size, 
        font: isBold ? boldFont : font,
        color: rgb(0, 0, 0)
      });
      return y - (size + 4);
    };

    // NEW Helper function to draw label: value pairs (value appears right after colon)
    const drawLabelValue = (label, value, y, size = 8, currentPage = page) => {
      const labelWithColon = label + " ";
      const labelWidth = font.widthOfTextAtSize(labelWithColon, size);
      
      // Draw label
      currentPage.drawText(labelWithColon, { 
        x: margin, 
        y, 
        size, 
        font: font,
        color: rgb(0, 0, 0)
      });
      
      // Draw value immediately after label
      currentPage.drawText(value, { 
        x: margin + labelWidth, 
        y, 
        size, 
        font: font,
        color: rgb(0, 0, 0)
      });
      
      return y - (size + 4);
    };

    // Helper function to draw text with both left and right parts (for totals)
    const drawLeftRightText = (leftText, rightText, y, leftSize = 9, rightSize = 9, leftBold = false, rightBold = false, currentPage = page) => {
      // Draw left text
      currentPage.drawText(leftText, { 
        x: margin, 
        y, 
        size: leftSize, 
        font: leftBold ? boldFont : font,
        color: rgb(0, 0, 0)
      });
      
      // Draw right text
      const rightTextWidth = (rightBold ? boldFont : font).widthOfTextAtSize(rightText, rightSize);
      const rightX = pageWidth - margin - rightTextWidth;
      currentPage.drawText(rightText, { 
        x: rightX, 
        y, 
        size: rightSize, 
        font: rightBold ? boldFont : font,
        color: rgb(0, 0, 0)
      });
      
      return y - Math.max(leftSize, rightSize) - 4;
    };

    // Helper function to draw dashed line
    const drawDashedLine = (y, currentPage = page) => {
      const dashLength = 3;
      const gapLength = 2;
      let x = margin;
      
      while (x < pageWidth - margin) {
        const endX = Math.min(x + dashLength, pageWidth - margin);
        currentPage.drawLine({
          start: { x, y },
          end: { x: endX, y },
          thickness: 0.5,
          color: rgb(0, 0, 0)
        });
        x += dashLength + gapLength;
      }
      return y - 6;
    };

    // Helper to check if new page is needed
    const checkNewPage = (requiredSpace) => {
      if (yPosition < requiredSpace) {
        page = pdfDoc.addPage([pageWidth, 800]);
        yPosition = 780;
        return page;
      }
      return page;
    };

    // ===== HEADER SECTION =====
    yPosition = drawCenteredText(clientInfo?.client_name || "Order Appu", yPosition, 11, true);
    yPosition = drawCenteredText(clientInfo?.client_address || "Bangalore - 560068", yPosition, 8);
    
    // Add state field for client data
    if (clientInfo?.state) {
      yPosition = drawCenteredText(clientInfo.state, yPosition, 8);
    }
    
    // Use gst_no from client data or fallback to hardcoded value
    const gstinText = clientInfo?.gst_no ? `GST: ${clientInfo.gst_no}` : "GST: 29XXXXX1234Z1Z5";
    yPosition = drawCenteredText(gstinText, yPosition, 8);
    
    if (clientInfo?.phone) {
      yPosition = drawCenteredText(`Phone: ${clientInfo.phone}`, yPosition, 8);
    }
    
    if (clientInfo?.email) {
      yPosition = drawCenteredText(`Email: ${clientInfo.email}`, yPosition, 8);
    }
    
    yPosition -= 4;
    yPosition = drawDashedLine(yPosition);
    yPosition -= 2;

    // ===== DATE & TIME SECTION (Value immediately after colon) =====
    const now = new Date();
    const timeString = now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
    const dateString = now.toLocaleDateString('en-IN');
    
    yPosition = drawLabelValue("Date:", dateString, yPosition, 8);
    yPosition = drawLabelValue("Time:", timeString, yPosition, 8);
    
    // Order Number
    yPosition = drawLabelValue("Order No:", orderInfo.id || 'N/A', yPosition, 8);
    
    // Customer name
    let customerName = "Walk-in Customer";
    if (customerData && customerData.data) {
      customerName = customerData.data.username || "Customer";
    } else if (orderData.customerName) {
      customerName = orderData.customerName;
    } else if (orderData.customer_name) {
      customerName = orderData.customer_name;
    }
    yPosition = drawLabelValue("Customer:", customerName, yPosition, 8);
    
    // Add customer state if available
    if (customerData && customerData.data && customerData.data.state) {
      yPosition = drawLabelValue("State:", customerData.data.state, yPosition, 8);
    }
    
    yPosition -= 2;
    yPosition = drawDashedLine(yPosition);
    yPosition -= 4;

    // ===== ITEMS HEADER =====
    yPosition = drawLeftText("ITEM DETAILS", yPosition, 8, true);
    yPosition -= 2;
    yPosition = drawDashedLine(yPosition);
    yPosition -= 4;

    // ===== ITEMS LIST =====
    productsWithCalculations.forEach((item, index) => {

      page = checkNewPage(80);

      const qty = item.approved_qty !== undefined ? item.approved_qty : item.quantity;
      const price = item.approved_price !== undefined ? item.approved_price : item.price;
      const gstRate = parseFloat(item.gst_rate || 0);
      const hsnCode = item.hsn_code || 'N/A';

      // Use the adjusted calculated values
      const calculatedTaxableValue = parseFloat(item.calculated_taxable_value);
      const calculatedGstAmount = parseFloat(item.calculated_gst_amount);
      
      let baseAmount, gstAmount, itemTotal;
      let rateExclGst, rateInclGst;
      
      if (isInclusive) {
        // Inclusive GST - GST is included in the price
        itemTotal = parseFloat(item.final_total);
        rateInclGst = parseFloat(price);
        baseAmount = calculatedTaxableValue;
        gstAmount = calculatedGstAmount;
        rateExclGst = qty > 0 ? baseAmount / qty : 0;
      } else {
        // Exclusive GST - GST is added on top
        baseAmount = calculatedTaxableValue;
        gstAmount = calculatedGstAmount;
        itemTotal = baseAmount + gstAmount;
        rateExclGst = qty > 0 ? baseAmount / qty : 0;
        rateInclGst = qty > 0 ? itemTotal / qty : 0;
      }

      // ===== LINE 1: ITEM NAME (Bold, full width) =====
      const itemName = item.name || item.product_name || 'Item';
      const words = itemName.split(' ');
      let currentLine = '';
      const maxWidth = contentWidth - 4;
      
      for (let i = 0; i < words.length; i++) {
        const testLine = currentLine + (currentLine ? ' ' : '') + words[i];
        const testWidth = boldFont.widthOfTextAtSize(testLine, 9);
        
        if (testWidth > maxWidth && currentLine) {
          page.drawText(currentLine, { 
            x: margin, 
            y: yPosition, 
            size: 9, 
            font: boldFont,
            color: rgb(0, 0, 0)
          });
          yPosition -= 12;
          page = checkNewPage(70);
          currentLine = words[i];
        } else {
          currentLine = testLine;
        }
      }
      
      if (currentLine) {
        page.drawText(currentLine, { 
          x: margin, 
          y: yPosition, 
          size: 9, 
          font: boldFont,
          color: rgb(0, 0, 0)
        });
        yPosition -= 11;
      }

      // ===== LINE 2: HSN CODE and GST RATE =====
      page = checkNewPage(60);
      const hsnGstLine = `HSN: ${hsnCode}  |  GST: ${gstRate.toFixed(2)}%`;
      page.drawText(hsnGstLine, { 
        x: margin, 
        y: yPosition, 
        size: 7, 
        font: font,
        color: rgb(0, 0, 0)
      });
      yPosition -= 10;

      // ===== LINE 3: QTY, RATE, AMOUNT =====
      page = checkNewPage(50);
      
      // Qty
      page.drawText("Qty:", { 
        x: margin, 
        y: yPosition, 
        size: 7, 
        font: font,
        color: rgb(0, 0, 0)
      });
      page.drawText(qty.toString(), { 
        x: margin + 20, 
        y: yPosition, 
        size: 7, 
        font: font,
        color: rgb(0, 0, 0)
      });
      
      // Rate (Incl. GST) for Inclusive method or Rate (Excl. GST) for Exclusive method
      if (isInclusive) {
        page.drawText("Rate (Incl):", { 
          x: margin + 45, 
          y: yPosition, 
          size: 7, 
          font: font,
          color: rgb(0, 0, 0)
        });
        const rateText = rateInclGst.toFixed(2);
        page.drawText(rateText, { 
          x: margin + 90, 
          y: yPosition, 
          size: 7, 
          font: font,
          color: rgb(0, 0, 0)
        });
        
        // Amount (right-aligned)
        const amountText = `Rs. ${baseAmount.toFixed(2)}`;
        const amtWidth = font.widthOfTextAtSize(amountText, 8);
        page.drawText(amountText, { 
          x: pageWidth - margin - amtWidth, 
          y: yPosition, 
          size: 8, 
          font: boldFont,
          color: rgb(0, 0, 0)
        });
      } else {
        page.drawText("Rate (Excl):", { 
          x: margin + 45, 
          y: yPosition, 
          size: 7, 
          font: font,
          color: rgb(0, 0, 0)
        });
        const rateText = rateExclGst.toFixed(2);
        page.drawText(rateText, { 
          x: margin + 90, 
          y: yPosition, 
          size: 7, 
          font: font,
          color: rgb(0, 0, 0)
        });
        
        // Amount (right-aligned)
        const amountText = `Rs. ${baseAmount.toFixed(2)}`;
        const amtWidth = font.widthOfTextAtSize(amountText, 8);
        page.drawText(amountText, { 
          x: pageWidth - margin - amtWidth, 
          y: yPosition, 
          size: 8, 
          font: boldFont,
          color: rgb(0, 0, 0)
        });
      }
      
      yPosition -= 10;
      
      // For Inclusive method, also show Rate (Excl. GST) on next line
      if (isInclusive) {
        page = checkNewPage(40);
        page.drawText("Rate (Excl):", { 
          x: margin + 45, 
          y: yPosition, 
          size: 7, 
          font: font,
          color: rgb(0, 0, 0)
        });
        const rateText = rateExclGst.toFixed(2);
        page.drawText(rateText, { 
          x: margin + 90, 
          y: yPosition, 
          size: 7, 
          font: font,
          color: rgb(0, 0, 0)
        });
        yPosition -= 10;
      }

      // Gap between items
      yPosition -= 2;
    });

    yPosition -= 2;
    yPosition = drawDashedLine(yPosition);
    yPosition -= 4;

    // ===== TOTALS SECTION =====
    page = checkNewPage(150);  // Increased space needed
    
    yPosition = drawLeftRightText("Subtotal:", `Rs. ${subTotal}`, yPosition, 9, 9);
    
    // Add adjustments details
    if (adjustmentsWithCalculations && adjustmentsWithCalculations.length > 0) {
      adjustmentsWithCalculations.forEach((adjustment) => {
        const adjustmentText = `${adjustment.type === 'addition' ? '+' : '-'} ${adjustment.name}`;
        yPosition = drawLeftRightText(adjustmentText, `Rs. ${adjustment.final_total}`, yPosition, 8, 8);
        
        // If adjustment has GST, show it on the next line
        if (parseFloat(adjustment.gst_rate || 0) > 0) {
          page = checkNewPage(30);
          const gstText = `  (GST ${parseFloat(adjustment.gst_rate).toFixed(2)}%: Rs. ${parseFloat(adjustment.calculated_gst_amount).toFixed(2)})`;
          yPosition = drawLeftText(gstText, yPosition, 7);
        }
      });
    }
    
    if (orderDiscountAmount > 0) {
      yPosition = drawLeftRightText("Discount:", `-Rs. ${orderDiscountAmount.toFixed(2)}`, yPosition, 9, 9);
    }
    
    // Always show GST breakdown (even if 0)
    yPosition = drawLeftRightText("Taxable Value:", `Rs. ${totalTaxableValue}`, yPosition, 8, 8);
    
    // Display IGST or CGST/SGST based on state comparison
    if (useIGST) {
      yPosition = drawLeftRightText("IGST:", `Rs. ${igstAmount}`, yPosition, 8, 8);
    } else {
      yPosition = drawLeftRightText("CGST:", `Rs. ${cgstAmount}`, yPosition, 8, 8);
      yPosition = drawLeftRightText("SGST:", `Rs. ${sgstAmount}`, yPosition, 8, 8);
    }
    
    yPosition -= 2;
    yPosition = drawDashedLine(yPosition);
    yPosition -= 4;
    
    // Grand Total
    yPosition = drawLeftRightText("TOTAL:", `Rs. ${grandTotal}`, yPosition, 10, 10, true, true);
    
    yPosition -= 4;
    yPosition = drawDashedLine(yPosition);
    yPosition -= 6;

    // ===== AMOUNT IN WORDS =====
    page = checkNewPage(60);
    
    const amountInWords = numberToWords(parseFloat(grandTotal));
    yPosition = drawLeftText("Amount in Words:", yPosition, 8, true);
    
    // Word wrap for amount in words
    const words = amountInWords.split(" ");
    let line = "";
    const maxLineWidth = contentWidth - 4;
    
    for (const word of words) {
      const testLine = line + word + " ";
      const testWidth = font.widthOfTextAtSize(testLine, 8);
      
      if (testWidth > maxLineWidth && line.length > 0) {
        page = checkNewPage(20);
        page.drawText(line.trim(), { x: margin + 2, y: yPosition, size: 8, font: font, color: rgb(0, 0, 0) });
        yPosition -= 11;
        line = word + " ";
      } else {
        line = testLine;
      }
    }
    
    if (line.trim().length > 0) {
      page = checkNewPage(20);
      page.drawText(line.trim(), { x: margin + 2, y: yPosition, size: 8, font: font, color: rgb(0, 0, 0) });
      yPosition -= 14;
    }

    // ===== FOOTER =====
    page = checkNewPage(50);
    
    yPosition = drawDashedLine(yPosition);
    yPosition -= 4;
    yPosition = drawCenteredText("Thank you for your business!", yPosition, 9);
    yPosition = drawCenteredText("Visit Again", yPosition, 8);
    yPosition -= 4;
    yPosition = drawDashedLine(yPosition);

    // Generate PDF bytes
    const pdfBytes = await pdfDoc.save();

    // Generate filename
    const orderNumber = orderInfo.id || 'order';
    const fileName = `POS_Order_${orderNumber.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`;


    return { success: true, pdfBytes, fileName };

  } catch (error) {
    console.error('Error generating POS PDF:', error);
    return { success: false, error: error.message };
  }
};

// Helper function to convert number to words
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

// Download POS PDF function
export const downloadOrderPOSPDF = async (orderData, customerData = null, clientData = null) => {
  try {
    const result = await generateOrderPOSPDF(orderData, customerData, clientData);
    
    if (result.success) {
      const blob = new Blob([result.pdfBytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      
      const link = document.createElement('a');
      link.href = url;
      link.download = result.fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      URL.revokeObjectURL(url);
      
      return { success: true, message: 'POS PDF downloaded successfully' };
    } else {
      console.error('Failed to generate POS PDF:', result.error);
      return { success: false, error: result.error };
    }
  } catch (error) {
    console.error('Error downloading POS PDF:', error);
    return { success: false, error: error.message };
  }
};
