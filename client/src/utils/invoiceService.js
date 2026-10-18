import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import api from '../services/api.js';
import { resolveBillTaxDetails } from './gstService.js';

const PRIMARY_COLOR = [7, 27, 68];   // Deep Business Navy #071B44
const ACCENT_COLOR = [30, 107, 255];  // Premium Blue #1E6BFF
const TEXT_COLOR = [30, 41, 59];      // Slate 800
const MUTED_COLOR = [100, 116, 139];  // Slate 500
const BORDER_COLOR = [226, 232, 240]; // Slate 200

/**
 * Format currency string
 */
const fmtCur = (val) => {
    const num = Number(val) || 0;
    return `Rs. ${num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

/**
 * Draw Middle Cut Line Divider between Slot 1 and Slot 2
 */
const drawCutLine = (doc) => {
    const cutY = 148.5; // Exactly center of 297mm A4 height
    const leftMargin = 10;
    const rightMargin = 200;
    const centerX = 105;

    doc.setDrawColor(156, 163, 175); // Slate 400
    doc.setLineWidth(0.3);
    doc.setLineDashPattern([2, 2], 0);
    doc.line(leftMargin, cutY, rightMargin, cutY);
    doc.setLineDashPattern([], 0); // Reset dash

    // Centered scissors badge
    doc.setFont("helvetica", "bold");
    doc.setFontSize(6.5);
    doc.setTextColor(100, 116, 139);
    doc.text("- - - - - - - - - - - - - - - - - - - - - - Cut Along This Line (Half-A4) - - - - - - - - - - - - - - - - - - - - - -", centerX, cutY - 1, { align: 'center' });
};

/**
 * Render a single compact invoice into a Half-A4 slot (approx 138mm height)
 */
const renderBillSlot = (doc, bill, shop, type = 'SALE', startY = 6, slotIndex = 1, options = {}) => {
    if (!bill) return { finalY: startY, overflow: false };

    const slotMaxY = slotIndex === 1 ? 144 : 290;
    const pageW = 210;
    const leftMargin = 10;
    const rightMargin = 200;
    const contentW = rightMargin - leftMargin; // 190mm
    const centerX = 105;

    // 1. Accent top bar
    doc.setFillColor(...ACCENT_COLOR);
    doc.rect(leftMargin, startY, contentW, 1.2, 'F');

    // 2. Header Section
    let currentY = startY + 4.5;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(...PRIMARY_COLOR);
    const effectiveShop = (bill?.shop && typeof bill.shop === 'object' && bill.shop.name) ? bill.shop : shop;
    const shopName = (effectiveShop?.name || 'ShopPulse Business').toUpperCase();
    doc.text(shopName, centerX, currentY, { align: 'center' });

    currentY += 3.8;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.5);
    doc.setTextColor(...MUTED_COLOR);
    const address = effectiveShop?.location || 'India';
    doc.text(address, centerX, currentY, { align: 'center' });

    currentY += 3.2;
    const contactGst = `Phone: ${effectiveShop?.contactNumber || 'XXXXXXXXXX'}  |  GSTIN: ${effectiveShop?.gstNumber || 'N/A'}`;
    doc.text(contactGst, centerX, currentY, { align: 'center' });

    currentY += 2.8;
    doc.setDrawColor(...BORDER_COLOR);
    doc.setLineWidth(0.3);
    doc.line(leftMargin, currentY, rightMargin, currentY);

    const taxDetails = resolveBillTaxDetails(bill, type, effectiveShop, options?.products || []);
    const {
        isGovBill,
        isTaxableInvoice,
        hasIgst,
        subtotal,
        discount,
        taxableAmount,
        totalGst,
        cgstTotal,
        sgstTotal,
        igstTotal,
        grandTotal,
        items: displayItems
    } = taxDetails;

    // 3. Info Grid
    currentY += 3.2;
    const infoStartY = currentY;

    // Left Column: Bill Details
    doc.setFontSize(6.5);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...MUTED_COLOR);
    let billLabel = isTaxableInvoice ? 'TAX INVOICE DETAILS' : 'INVOICE DETAILS';
    if (type === 'PURCHASE') billLabel = 'SUPPLIER BILL';
    if (type === 'RETURN') billLabel = 'RETURN RECEIPT';
    if (type === 'EXCHANGE') billLabel = 'EXCHANGE RECEIPT';
    doc.text(billLabel, leftMargin, currentY);

    currentY += 3.2;
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...TEXT_COLOR);
    const invoiceNum = bill.invoiceNumber || (bill._id ? bill._id.slice(-6).toUpperCase() : 'N/A');
    doc.text(`Bill No: `, leftMargin, currentY);
    doc.setFont("helvetica", "bold");
    doc.text(`#${invoiceNum}`, leftMargin + 13, currentY);

    currentY += 3;
    doc.setFont("helvetica", "normal");
    doc.text(`Date: `, leftMargin, currentY);
    const billDate = bill.date ? new Date(bill.date) : new Date();
    const dateFormatted = `${billDate.toLocaleDateString('en-IN')} ${billDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    doc.text(dateFormatted, leftMargin + 13, currentY);

    currentY += 3;
    doc.text(`Payment: `, leftMargin, currentY);
    doc.setFont("helvetica", "bold");
    const payMode = (bill.paymentMethod || 'CASH').toUpperCase();
    doc.setTextColor(...PRIMARY_COLOR);
    doc.text(payMode, leftMargin + 13, currentY);

    // Right Column: Customer Details
    let rightY = infoStartY;
    doc.setFontSize(6.5);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...MUTED_COLOR);
    let partyHeader = type === 'PURCHASE' ? 'SUPPLIER DETAILS' : 'CUSTOMER DETAILS';
    const rightColX = 115;
    doc.text(partyHeader, rightColX, rightY);

    rightY += 3.2;
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...TEXT_COLOR);
    const partyName = type === 'PURCHASE' ? (bill.supplierName || 'Supplier') : (bill.customerName || 'Walk-in Customer');
    doc.text(partyName, rightColX, rightY);

    rightY += 3;
    doc.setFont("helvetica", "normal");
    const partyPhone = type === 'PURCHASE' ? bill.supplierPhone : (bill.customerMobile || bill.customerPhone);
    if (partyPhone) {
        doc.text(`Mobile: ${partyPhone}`, rightColX, rightY);
        rightY += 3;
    }
    if (bill.customerAadhaar) {
        doc.text(`Aadhaar: ${bill.customerAadhaar}`, rightColX, rightY);
        rightY += 3;
    }
    if ((type === 'RETURN' || type === 'EXCHANGE') && bill.originalSaleInvoice) {
        doc.text(`Linked Bill: #${bill.originalSaleInvoice}`, rightColX, rightY);
        rightY += 3;
    }

    currentY = Math.max(currentY, rightY) + 2.5;

    // 4. Items Table
    const tableHeaders = isTaxableInvoice
        ? ["Sl", "Product Description", "Qty", isGovBill ? "GST Price" : "Rate", "Taxable", "GST", "Amount"]
        : ["Sl", "Product Description", "Qty", isGovBill ? "GST Price" : "Rate", "Amount"];
    const tableRows = [];

    displayItems.forEach((item, idx) => {
        let desc = item.productName || 'Item';
        if (item.returnedQty && item.returnedQty > 0) {
            desc += ` (Sold: ${item.soldQtyEntered || item.quantity}, Ret: ${item.returnedQty})`;
        }

        if (isTaxableInvoice) {
            const mode = item.gstPricingMode ? ` (${item.gstPricingMode === 'exclusive' ? 'Excl' : 'Incl'})` : '';
            if (item.isTaxable && item.gstRate > 0) {
                desc += mode;
            }

            const gstCell = item.isTaxable && item.gstRate > 0 
                ? `${fmtCur(item.gstAmount)} (${item.gstRate}%)` 
                : fmtCur(0);

            tableRows.push([
                idx + 1,
                desc,
                `${item.qty} ${item.unit}`,
                fmtCur(item.appliedRate),
                fmtCur(item.taxableValue),
                gstCell,
                fmtCur(item.lineTotal)
            ]);
        } else {
            tableRows.push([
                idx + 1,
                desc,
                `${item.qty} ${item.unit}`,
                fmtCur(item.appliedRate),
                fmtCur(item.lineTotal)
            ]);
        }
    });

    const colStyles = isTaxableInvoice ? {
        0: { halign: 'center', cellWidth: 7 },
        1: { halign: 'left', cellWidth: 55 },
        2: { halign: 'center', cellWidth: 20 },
        3: { halign: 'right', cellWidth: 26 },
        4: { halign: 'right', cellWidth: 26 },
        5: { halign: 'right', cellWidth: 28 },
        6: { halign: 'right', cellWidth: 28 }
    } : {
        0: { halign: 'center', cellWidth: 8 },
        1: { halign: 'left', cellWidth: 86 },
        2: { halign: 'center', cellWidth: 26 },
        3: { halign: 'right', cellWidth: 32 },
        4: { halign: 'right', cellWidth: 38 }
    };

    autoTable(doc, {
        head: [tableHeaders],
        body: tableRows,
        startY: currentY,
        theme: 'grid',
        headStyles: {
            fillColor: PRIMARY_COLOR,
            textColor: [255, 255, 255],
            fontStyle: 'bold',
            fontSize: isTaxableInvoice ? 6.5 : 7,
            cellPadding: 1.1,
            halign: 'center'
        },
        columnStyles: colStyles,
        bodyStyles: {
            fontSize: isTaxableInvoice ? 6.2 : 6.8,
            textColor: TEXT_COLOR,
            cellPadding: 0.9,
            overflow: 'linebreak'
        },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        margin: { left: leftMargin, right: pageW - rightMargin }
    });

    let tableFinalY = doc.lastAutoTable?.finalY || currentY + 15;

    // 5. Summary & Totals
    const summaryX = 132;
    let sumY = tableFinalY + 2.5;

    // Right side: Financials
    doc.setFontSize(6.8);
    doc.setTextColor(...MUTED_COLOR);
    doc.text("Subtotal:", summaryX, sumY);
    doc.setTextColor(...TEXT_COLOR);
    doc.text(fmtCur(subtotal), rightMargin, sumY, { align: 'right' });

    if (discount > 0) {
        sumY += 3.0;
        doc.setTextColor(...MUTED_COLOR);
        doc.text("Discount:", summaryX, sumY);
        doc.setTextColor(22, 163, 74); // Green
        doc.text(`- ${fmtCur(discount)}`, rightMargin, sumY, { align: 'right' });
    }

    if (isTaxableInvoice) {
        sumY += 2.8;
        doc.setFontSize(6.2);
        doc.setTextColor(...MUTED_COLOR);
        doc.text("Taxable Value:", summaryX, sumY);
        doc.setTextColor(...TEXT_COLOR);
        doc.text(fmtCur(taxableAmount), rightMargin, sumY, { align: 'right' });

        if (hasIgst) {
            sumY += 2.6;
            doc.setTextColor(...MUTED_COLOR);
            doc.text("IGST:", summaryX, sumY);
            doc.setTextColor(...TEXT_COLOR);
            doc.text(fmtCur(igstTotal), rightMargin, sumY, { align: 'right' });
        } else {
            sumY += 2.6;
            doc.setTextColor(...MUTED_COLOR);
            doc.text("CGST:", summaryX, sumY);
            doc.setTextColor(...TEXT_COLOR);
            doc.text(fmtCur(cgstTotal), rightMargin, sumY, { align: 'right' });

            sumY += 2.6;
            doc.setTextColor(...MUTED_COLOR);
            doc.text("SGST:", summaryX, sumY);
            doc.setTextColor(...TEXT_COLOR);
            doc.text(fmtCur(sgstTotal), rightMargin, sumY, { align: 'right' });
        }

        sumY += 2.6;
        doc.setTextColor(...MUTED_COLOR);
        doc.text("Total GST:", summaryX, sumY);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(...ACCENT_COLOR);
        doc.text(fmtCur(totalGst), rightMargin, sumY, { align: 'right' });
        doc.setFont("helvetica", "normal");
    }

    // Grand Total Box
    sumY += 3.8;
    doc.setFillColor(...PRIMARY_COLOR);
    doc.rect(summaryX - 4, sumY - 2.8, (rightMargin - summaryX) + 4, 5, 'F');
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(255, 255, 255);
    doc.text("GRAND TOTAL:", summaryX - 1, sumY + 0.8);
    doc.text(fmtCur(grandTotal), rightMargin - 1, sumY + 0.8, { align: 'right' });

    // 6. Footer Section
    let footerY = sumY + 5.5;
    doc.setDrawColor(...BORDER_COLOR);
    doc.setLineWidth(0.2);
    doc.line(leftMargin, footerY, rightMargin, footerY);

    footerY += 2.8;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(6.5);
    doc.setTextColor(...PRIMARY_COLOR);
    doc.text("Thank you for your business!", centerX, footerY, { align: 'center' });

    footerY += 2.6;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(5.5);
    doc.setTextColor(...MUTED_COLOR);
    doc.text("Generated by ShopPulse POS — A4 Half-Sheet Eco Saver", centerX, footerY, { align: 'center' });

    return { finalY: footerY, overflow: footerY > slotMaxY };
};

/**
 * Standard Full-Page A4 Invoice (Full-page PDF layout)
 */
const renderFullPageBill = (doc, bill, shop, type = 'SALE', options = {}) => {
    const pageW = 210;
    const leftMargin = 14;
    const rightMargin = 196;
    const centerX = 105;

    doc.setFillColor(...ACCENT_COLOR);
    doc.rect(0, 0, pageW, 3, 'F');

    let currentY = 16;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.setTextColor(...PRIMARY_COLOR);
    const effectiveShop = (bill?.shop && typeof bill.shop === 'object' && bill.shop.name) ? bill.shop : shop;
    doc.text((effectiveShop?.name || 'ShopPulse Business').toUpperCase(), centerX, currentY, { align: 'center' });

    currentY += 5;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(...MUTED_COLOR);
    doc.text(effectiveShop?.location || 'India', centerX, currentY, { align: 'center' });

    currentY += 4.5;
    doc.text(`Phone: ${effectiveShop?.contactNumber || 'XXXXXXXXXX'}  |  GSTIN: ${effectiveShop?.gstNumber || 'N/A'}`, centerX, currentY, { align: 'center' });

    currentY += 5;
    doc.setDrawColor(...BORDER_COLOR);
    doc.setLineWidth(0.4);
    doc.line(leftMargin, currentY, rightMargin, currentY);

    const fullTaxDetails = resolveBillTaxDetails(bill, type, effectiveShop, options?.products || []);
    const isTaxableInvoice = fullTaxDetails.isTaxableInvoice;
    const isGovBill = fullTaxDetails.isGovBill;
    const displayItems = fullTaxDetails.items;
    const {
        hasIgst,
        subtotal,
        discount,
        taxableAmount,
        totalGst,
        cgstTotal,
        sgstTotal,
        igstTotal,
        grandTotal
    } = fullTaxDetails;

    // Meta Section
    currentY += 6;
    const metaStartY = currentY;

    // Left
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...PRIMARY_COLOR);
    doc.text(isTaxableInvoice ? 'TAX INVOICE' : 'BILL OF SUPPLY', leftMargin, currentY);

    currentY += 4;
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...TEXT_COLOR);
    const invoiceNum = bill.invoiceNumber || (bill._id ? bill._id.slice(-6).toUpperCase() : 'N/A');
    doc.text(`Invoice No: #${invoiceNum}`, leftMargin, currentY);

    currentY += 4;
    const billDate = bill.date ? new Date(bill.date) : new Date();
    doc.text(`Date: ${billDate.toLocaleDateString('en-IN')} ${billDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`, leftMargin, currentY);

    currentY += 4;
    doc.text(`Payment Mode: ${(bill.paymentMethod || 'CASH').toUpperCase()}`, leftMargin, currentY);

    // Right
    let rightY = metaStartY;
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...PRIMARY_COLOR);
    doc.text('CUSTOMER DETAILS', 125, rightY);

    rightY += 4;
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...TEXT_COLOR);
    const partyName = type === 'PURCHASE' ? (bill.supplierName || 'Supplier') : (bill.customerName || 'Walk-in Customer');
    doc.text(`Name: ${partyName}`, 125, rightY);

    const partyPhone = type === 'PURCHASE' ? bill.supplierPhone : (bill.customerMobile || bill.customerPhone);
    if (partyPhone) {
        rightY += 4;
        doc.text(`Mobile: ${partyPhone}`, 125, rightY);
    }
    if (bill.customerAadhaar) {
        rightY += 4;
        doc.text(`Aadhaar: ${bill.customerAadhaar}`, 125, rightY);
    }

    currentY = Math.max(currentY, rightY) + 5;

    const tableHeaders = isTaxableInvoice
        ? ["Sl", "Product Description", "Qty", isGovBill ? "GST Price" : "Rate", "Taxable Value", "GST Rate", "GST Amount", "Amount"]
        : ["Sl", "Product Description", "Qty", isGovBill ? "GST Price" : "Rate", "Amount"];

    const tableRows = displayItems.map((item, idx) => {
        let desc = item.productName || 'Item';
        if (item.returnedQty && item.returnedQty > 0) {
            desc += `\n(Sold: ${item.soldQtyEntered || item.quantity}, Ret: ${item.returnedQty})`;
        }

        if (isTaxableInvoice) {
            const mode = item.gstPricingMode ? ` (${item.gstPricingMode === 'exclusive' ? 'Excl' : 'Incl'})` : '';

            return [
                idx + 1,
                desc + (item.isTaxable && item.gstRate > 0 ? mode : ''),
                `${item.qty} ${item.unit}`,
                fmtCur(item.appliedRate),
                fmtCur(item.taxableValue),
                item.isTaxable && item.gstRate > 0 ? `${item.gstRate}%` : '0%',
                fmtCur(item.gstAmount),
                fmtCur(item.lineTotal)
            ];
        } else {
            return [
                idx + 1,
                desc,
                `${item.qty} ${item.unit}`,
                fmtCur(item.appliedRate),
                fmtCur(item.lineTotal)
            ];
        }
    });

    const colStyles = isTaxableInvoice ? {
        0: { halign: 'center', cellWidth: 8 },
        1: { halign: 'left', cellWidth: 46 },
        2: { halign: 'center', cellWidth: 18 },
        3: { halign: 'right', cellWidth: 20 },
        4: { halign: 'right', cellWidth: 24 },
        5: { halign: 'center', cellWidth: 18 },
        6: { halign: 'right', cellWidth: 22 },
        7: { halign: 'right', cellWidth: 26 }
    } : {
        0: { halign: 'center', cellWidth: 10 },
        1: { halign: 'left' },
        2: { halign: 'center', cellWidth: 25 },
        3: { halign: 'right', cellWidth: 35 },
        4: { halign: 'right', cellWidth: 35 }
    };

    autoTable(doc, {
        head: [tableHeaders],
        body: tableRows,
        startY: currentY,
        theme: 'grid',
        headStyles: { fillColor: PRIMARY_COLOR, textColor: 255, fontStyle: 'bold', fontSize: 8, cellPadding: 2, halign: 'center' },
        columnStyles: colStyles,
        bodyStyles: { fontSize: 7.8, textColor: TEXT_COLOR, cellPadding: 1.6 },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        margin: { left: leftMargin, right: pageW - rightMargin }
    });

    let finalY = (doc.lastAutoTable?.finalY || currentY + 30) + 6;
    const summaryX = 125;

    doc.setFontSize(9);
    doc.setTextColor(...MUTED_COLOR);
    doc.text("Subtotal:", summaryX, finalY);
    doc.setTextColor(...TEXT_COLOR);
    doc.text(fmtCur(subtotal), rightMargin, finalY, { align: 'right' });

    if (discount > 0) {
        finalY += 5;
        doc.setTextColor(...MUTED_COLOR);
        doc.text("Discount:", summaryX, finalY);
        doc.setTextColor(22, 163, 74);
        doc.text(`- ${fmtCur(discount)}`, rightMargin, finalY, { align: 'right' });
    }

    if (isTaxableInvoice) {
        const taxableTotal = bill.taxableAmount !== undefined ? bill.taxableAmount : (grandTotal - (bill.totalGst || 0));

        finalY += 4.5;
        doc.text("Taxable Value:", summaryX, finalY);
        doc.text(fmtCur(taxableTotal), rightMargin, finalY, { align: 'right' });

        if (hasIgst) {
            finalY += 4.5;
            doc.text("IGST:", summaryX, finalY);
            doc.text(fmtCur(igstTotal), rightMargin, finalY, { align: 'right' });
        } else {
            finalY += 4.5;
            doc.text("CGST:", summaryX, finalY);
            doc.text(fmtCur(cgstTotal), rightMargin, finalY, { align: 'right' });

            finalY += 4.5;
            doc.text("SGST:", summaryX, finalY);
            doc.text(fmtCur(sgstTotal), rightMargin, finalY, { align: 'right' });
        }

        finalY += 4.5;
        doc.text("Total GST:", summaryX, finalY);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(...ACCENT_COLOR);
        doc.text(fmtCur(totalGst), rightMargin, finalY, { align: 'right' });
        doc.setFont("helvetica", "normal");
        doc.setTextColor(...MUTED_COLOR);
    }

    finalY += 6;
    doc.setFillColor(...PRIMARY_COLOR);
    doc.rect(summaryX - 5, finalY - 4, (rightMargin - summaryX) + 5, 8, 'F');
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(255, 255, 255);
    doc.text("GRAND TOTAL:", summaryX, finalY + 1.5);
    doc.text(fmtCur(grandTotal), rightMargin - 2, finalY + 1.5, { align: 'right' });

    // Footer at bottom
    doc.setDrawColor(...BORDER_COLOR);
    doc.line(leftMargin, 268, rightMargin, 268);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(...PRIMARY_COLOR);
    doc.text("Thank you for your business!", centerX, 275, { align: 'center' });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(...MUTED_COLOR);
    doc.text("Generated by ShopPulse POS — Full A4", centerX, 281, { align: 'center' });
};

/**
 * Render Thermal 58 mm Receipt into custom dimensions PDF
 */
const renderThermal58PDF = (bill, shop, type = 'SALE', options = {}) => {
    const effectiveShop = (bill?.shop && typeof bill.shop === 'object' && bill.shop.name) ? bill.shop : shop;
    const taxDetails = resolveBillTaxDetails(bill, type, effectiveShop, options?.products || []);
    const { items: displayItems, subtotal, discount, taxableAmount, totalGst, grandTotal, isTaxableInvoice } = taxDetails;

    // Dynamic height calculation: minimum 90mm or proportional to item count
    const rollHeight = Math.max(90, 65 + (displayItems.length * 8.5) + (isTaxableInvoice ? 25 : 10));
    const doc = new jsPDF({ unit: 'mm', format: [58, rollHeight] });

    const left = 3;
    const right = 55;
    const center = 29;

    let y = 6;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(0, 0, 0);
    doc.text((effectiveShop?.name || 'ShopPulse').toUpperCase(), center, y, { align: 'center' });

    y += 3.5;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6);
    if (effectiveShop?.location) {
        doc.text(effectiveShop.location, center, y, { align: 'center' });
        y += 2.8;
    }
    if (effectiveShop?.contactNumber) {
        doc.text(`Ph: ${effectiveShop.contactNumber}`, center, y, { align: 'center' });
        y += 2.8;
    }
    if (effectiveShop?.gstNumber) {
        doc.text(`GSTIN: ${effectiveShop.gstNumber}`, center, y, { align: 'center' });
        y += 2.8;
    }

    doc.setLineDashPattern([1, 1], 0);
    doc.line(left, y, right, y);
    doc.setLineDashPattern([], 0);
    y += 3;

    // Meta
    const invoiceNum = bill.invoiceNumber || (bill._id ? bill._id.slice(-6).toUpperCase() : 'N/A');
    const billDate = bill.date ? new Date(bill.date) : new Date();
    doc.setFontSize(6);
    doc.text(`Bill: #${invoiceNum}`, left, y);
    doc.text((bill.paymentMethod || 'CASH').toUpperCase(), right, y, { align: 'right' });
    y += 2.8;

    doc.text(`Date: ${billDate.toLocaleDateString('en-IN')}`, left, y);
    doc.text(billDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), right, y, { align: 'right' });
    y += 2.8;

    const partyName = type === 'PURCHASE' ? bill.supplierName : bill.customerName;
    if (partyName && partyName !== 'Walk-in Customer' && partyName !== 'Walk-in') {
        doc.text(`Cust: ${partyName}`, left, y);
        y += 2.8;
    }

    doc.setLineDashPattern([1, 1], 0);
    doc.line(left, y, right, y);
    doc.setLineDashPattern([], 0);
    y += 3;

    // Items Header
    doc.setFont("helvetica", "bold");
    doc.text("ITEM", left, y);
    doc.text("TOTAL", right, y, { align: 'right' });
    y += 2.5;

    doc.setFont("helvetica", "normal");
    displayItems.forEach((item, idx) => {
        const pName = `${idx + 1}. ${item.productName || 'Item'}`;
        const shortName = pName.length > 24 ? pName.slice(0, 23) + '..' : pName;
        doc.text(shortName, left, y);
        y += 2.6;

        const calcText = `${item.qty} ${item.unit} x ${fmtCur(item.appliedRate)}`;
        doc.text(calcText, left + 2, y);
        doc.setFont("helvetica", "bold");
        doc.text(fmtCur(item.lineTotal), right, y, { align: 'right' });
        doc.setFont("helvetica", "normal");
        y += 3;
    });

    doc.setLineDashPattern([1, 1], 0);
    doc.line(left, y, right, y);
    doc.setLineDashPattern([], 0);
    y += 3;

    // Summary
    doc.text("Subtotal:", left, y);
    doc.text(fmtCur(subtotal), right, y, { align: 'right' });
    y += 2.8;

    if (discount > 0) {
        doc.text("Discount:", left, y);
        doc.text(`- ${fmtCur(discount)}`, right, y, { align: 'right' });
        y += 2.8;
    }

    if (isTaxableInvoice && totalGst > 0) {
        doc.text("Taxable Value:", left, y);
        doc.text(fmtCur(taxableAmount), right, y, { align: 'right' });
        y += 2.8;

        doc.text("Total GST:", left, y);
        doc.text(fmtCur(totalGst), right, y, { align: 'right' });
        y += 2.8;
    }

    doc.setLineWidth(0.4);
    doc.line(left, y, right, y);
    y += 3.5;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.text("TOTAL:", left, y);
    doc.text(fmtCur(grandTotal), right, y, { align: 'right' });
    y += 5;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(6);
    doc.text("Thank You! Visit Again", center, y, { align: 'center' });
    y += 2.6;
    doc.text("ShopPulse POS • 58mm Thermal", center, y, { align: 'center' });

    return doc;
};

/**
 * Render Thermal 80 mm Receipt into custom dimensions PDF
 */
const renderThermal80PDF = (bill, shop, type = 'SALE', options = {}) => {
    const effectiveShop = (bill?.shop && typeof bill.shop === 'object' && bill.shop.name) ? bill.shop : shop;
    const taxDetails = resolveBillTaxDetails(bill, type, effectiveShop, options?.products || []);
    const { items: displayItems, subtotal, discount, taxableAmount, totalGst, cgstTotal, sgstTotal, grandTotal, isTaxableInvoice } = taxDetails;

    // Dynamic height calculation: minimum 95mm or proportional to item count
    const rollHeight = Math.max(95, 75 + (displayItems.length * 8.5) + (isTaxableInvoice ? 25 : 10));
    const doc = new jsPDF({ unit: 'mm', format: [80, rollHeight] });

    const left = 4;
    const right = 76;
    const center = 40;

    let y = 6;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(0, 0, 0);
    doc.text((effectiveShop?.name || 'ShopPulse').toUpperCase(), center, y, { align: 'center' });

    y += 4;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    if (effectiveShop?.location) {
        doc.text(effectiveShop.location, center, y, { align: 'center' });
        y += 3.2;
    }
    const contactLine = [
        effectiveShop?.contactNumber ? `Ph: ${effectiveShop.contactNumber}` : '',
        effectiveShop?.gstNumber ? `GSTIN: ${effectiveShop.gstNumber}` : ''
    ].filter(Boolean).join(' | ');

    if (contactLine) {
        doc.text(contactLine, center, y, { align: 'center' });
        y += 3.2;
    }

    doc.setLineDashPattern([1.5, 1.5], 0);
    doc.line(left, y, right, y);
    doc.setLineDashPattern([], 0);
    y += 3.5;

    // Meta
    const invoiceNum = bill.invoiceNumber || (bill._id ? bill._id.slice(-6).toUpperCase() : 'N/A');
    const billDate = bill.date ? new Date(bill.date) : new Date();
    doc.setFontSize(7);
    doc.text(`Bill No: #${invoiceNum}`, left, y);
    doc.text(`Pay: ${(bill.paymentMethod || 'CASH').toUpperCase()}`, right, y, { align: 'right' });
    y += 3.2;

    doc.text(`Date: ${billDate.toLocaleDateString('en-IN')} ${billDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`, left, y);
    const partyName = type === 'PURCHASE' ? bill.supplierName : bill.customerName;
    if (partyName) {
        doc.text(`Cust: ${partyName}`, right, y, { align: 'right' });
    }
    y += 3.5;

    const tableHeaders = isTaxableInvoice
        ? ["Item", "Qty", "Rate", "GST", "Amount"]
        : ["Item", "Qty", "Rate", "Amount"];

    const tableRows = displayItems.map(item => {
        const pName = item.productName || 'Item';
        return isTaxableInvoice
            ? [pName, `${item.qty}`, fmtCur(item.appliedRate), fmtCur(item.gstAmount), fmtCur(item.lineTotal)]
            : [pName, `${item.qty}`, fmtCur(item.appliedRate), fmtCur(item.lineTotal)];
    });

    autoTable(doc, {
        head: [tableHeaders],
        body: tableRows,
        startY: y,
        theme: 'plain',
        headStyles: {
            fillColor: [240, 240, 240],
            textColor: [0, 0, 0],
            fontStyle: 'bold',
            fontSize: 6.8,
            cellPadding: 1,
            lineWidth: 0.1,
            lineColor: [200, 200, 200]
        },
        bodyStyles: {
            fontSize: 6.5,
            textColor: [0, 0, 0],
            cellPadding: 0.8
        },
        columnStyles: isTaxableInvoice ? {
            0: { halign: 'left', cellWidth: 28 },
            1: { halign: 'center', cellWidth: 9 },
            2: { halign: 'right', cellWidth: 12 },
            3: { halign: 'right', cellWidth: 11 },
            4: { halign: 'right', cellWidth: 12 }
        } : {
            0: { halign: 'left', cellWidth: 36 },
            1: { halign: 'center', cellWidth: 10 },
            2: { halign: 'right', cellWidth: 13 },
            3: { halign: 'right', cellWidth: 13 }
        },
        margin: { left, right: 80 - right }
    });

    let sumY = doc.lastAutoTable?.finalY || y + 15;
    sumY += 2;

    doc.setLineDashPattern([1.5, 1.5], 0);
    doc.line(left, sumY, right, sumY);
    doc.setLineDashPattern([], 0);
    sumY += 3.2;

    doc.setFontSize(7);
    doc.text("Subtotal:", 44, sumY);
    doc.text(fmtCur(subtotal), right, sumY, { align: 'right' });
    sumY += 3;

    if (discount > 0) {
        doc.text("Discount:", 44, sumY);
        doc.text(`- ${fmtCur(discount)}`, right, sumY, { align: 'right' });
        sumY += 3;
    }

    if (isTaxableInvoice && totalGst > 0) {
        doc.text("Taxable Value:", 44, sumY);
        doc.text(fmtCur(taxableAmount), right, sumY, { align: 'right' });
        sumY += 3;

        doc.text("CGST / SGST:", 44, sumY);
        doc.text(`${fmtCur(cgstTotal)} / ${fmtCur(sgstTotal)}`, right, sumY, { align: 'right' });
        sumY += 3;

        doc.text("Total GST:", 44, sumY);
        doc.text(fmtCur(totalGst), right, sumY, { align: 'right' });
        sumY += 3.5;
    }

    doc.setLineWidth(0.4);
    doc.line(left, sumY, right, sumY);
    sumY += 4;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.5);
    doc.text("GRAND TOTAL:", 40, sumY);
    doc.text(fmtCur(grandTotal), right, sumY, { align: 'right' });
    sumY += 6;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.5);
    doc.text("Thank You For Your Business!", center, sumY, { align: 'center' });
    sumY += 2.8;
    doc.text("ShopPulse POS • 80mm Thermal Receipt", center, sumY, { align: 'center' });

    return doc;
};

/**
 * Professional Invoice Service supporting all 4 Print Formats:
 * - full_a4: Single full-page A4 sheet
 * - half_a4: Compact 2-on-1 A4 sheet with cutting line
 * - thermal_58: 58mm narrow roll receipt
 * - thermal_80: 80mm wide roll receipt
 */
export const invoiceService = {
    /**
     * Generate an Invoice PDF in the requested or default print format
     */
    generateInvoicePDF: (data, shop, type = 'SALE', options = {}) => {
        // Resolve format: explicit options.format > shop.defaultPrintFormat > 'full_a4'
        const activeFormat = options?.format || shop?.defaultPrintFormat || 'full_a4';
        const targetBill = Array.isArray(data) ? data[0] : data;

        // FORMAT 3: Thermal 58 mm
        if (activeFormat === 'thermal_58') {
            return renderThermal58PDF(targetBill, shop, type, options);
        }

        // FORMAT 4: Thermal 80 mm
        if (activeFormat === 'thermal_80') {
            return renderThermal80PDF(targetBill, shop, type, options);
        }

        // FORMAT 1: Full A4
        if (activeFormat === 'full_a4') {
            const doc = new jsPDF({ format: 'a4', unit: 'mm' });
            if (Array.isArray(data)) {
                data.filter(Boolean).forEach((bill, idx) => {
                    if (idx > 0) doc.addPage();
                    renderFullPageBill(doc, bill, shop, bill.type || type, options);
                });
                return doc;
            }
            renderFullPageBill(doc, data, shop, type, options);
            return doc;
        }

        // FORMAT 2: Half A4 (2 bills per A4 sheet or single bill with cut line)
        const doc = new jsPDF({ format: 'a4', unit: 'mm' });

        // Case A: Array of bills provided for batch printing
        if (Array.isArray(data)) {
            const bills = data.filter(Boolean);
            if (bills.length === 0) return doc;

            let pageIndex = 0;
            for (let i = 0; i < bills.length; i += 2) {
                if (pageIndex > 0) doc.addPage();
                pageIndex++;

                const b1 = bills[i];
                const b2 = bills[i + 1];

                const b1Items = b1.items || [];
                if (b1Items.length > 8 || options.forceFullPage) {
                    renderFullPageBill(doc, b1, shop, b1.type || type, options);
                    if (b2) {
                        doc.addPage();
                        const b2Items = b2.items || [];
                        if (b2Items.length > 8 || options.forceFullPage) {
                            renderFullPageBill(doc, b2, shop, b2.type || type, options);
                        } else {
                            renderBillSlot(doc, b2, shop, b2.type || type, 6, 1, options);
                            drawCutLine(doc);
                        }
                    }
                    continue;
                }

                renderBillSlot(doc, b1, shop, b1.type || type, 6, 1, options);
                drawCutLine(doc);

                if (b2) {
                    const b2Items = b2.items || [];
                    if (b2Items.length > 8 || options.forceFullPage) {
                        doc.addPage();
                        renderFullPageBill(doc, b2, shop, b2.type || type, options);
                    } else {
                        renderBillSlot(doc, b2, shop, b2.type || type, 153, 2, options);
                    }
                }
            }

            return doc;
        }

        // Case B: options.secondBill provided (2 bills on 1 sheet)
        if (options.secondBill) {
            const b1 = data;
            const b2 = options.secondBill;
            const b1Items = b1.items || [];
            const b2Items = b2.items || [];

            if (b1Items.length > 8 || b2Items.length > 8 || options.forceFullPage) {
                renderFullPageBill(doc, b1, shop, b1.type || type, options);
                doc.addPage();
                renderFullPageBill(doc, b2, shop, b2.type || type, options);
                return doc;
            }

            renderBillSlot(doc, b1, shop, b1.type || type, 6, 1, options);
            drawCutLine(doc);
            renderBillSlot(doc, b2, shop, b2.type || type, 153, 2, options);
            return doc;
        }

        // Case C: Single bill provided
        const items = data?.items || [];
        if (items.length > 8 || options.forceFullPage) {
            renderFullPageBill(doc, data, shop, type, options);
            return doc;
        }

        // Standard Single Bill on Half-A4 (Top slot bill, dashed cut line, bottom slot blank)
        renderBillSlot(doc, data, shop, type, 6, 1, options);
        drawCutLine(doc);
        return doc;
    },

    /**
     * Download Two Bills on One A4 Sheet PDF
     */
    downloadTwoBillsPDF: (bills, shop, type = 'SALE', options = {}) => {
        const doc = invoiceService.generateInvoicePDF(bills, shop, type, { ...options, format: 'half_a4' });
        const b1 = Array.isArray(bills) ? bills[0] : bills;
        const b2 = Array.isArray(bills) ? bills[1] : options.secondBill;
        const id1 = b1?._id?.slice(-6).toUpperCase() || '1';
        const id2 = b2?._id?.slice(-6).toUpperCase() || '2';
        const fileName = `TwoBills-${id1}-${id2}.pdf`;
        doc.save(fileName);
    },

    /**
     * Share Invoice via WhatsApp (PDF or Link) in specified format
     */
    shareInvoice: async (data, shop, type = 'SALE', options = {}) => {
        try {
            const activeFormat = options?.format || shop?.defaultPrintFormat || 'full_a4';
            const targetBill = Array.isArray(data) ? data[0] : data;
            const doc = invoiceService.generateInvoicePDF(data, shop, type, { ...options, format: activeFormat });
            const billId = targetBill?._id?.slice(-6).toUpperCase() || 'BILL';
            const fileName = `Invoice-${billId}.pdf`;
            const pdfBlob = doc.output('blob');
            const pdfFile = new File([pdfBlob], fileName, { type: 'application/pdf' });

            // 1. Try Web Share API (Mobile native sharing)
            if (navigator.canShare && navigator.canShare({ files: [pdfFile] })) {
                await navigator.share({
                    files: [pdfFile],
                    title: `Invoice from ${shop?.name || 'ShopPulse'}`,
                    text: `Please find the invoice for Bill #${billId}`
                });
                return { success: true, method: 'native' };
            }

            // 2. Fallback: Upload and share link (Desktop/Older browsers)
            const reader = new FileReader();
            const pdfBase64 = await new Promise((resolve) => {
                reader.onloadend = () => resolve(reader.result);
                reader.readAsDataURL(pdfBlob);
            });

            const uploadRes = await api.post('/api/invoices/upload', {
                pdfBase64,
                filename: fileName
            });

            if (uploadRes.data.success) {
                const publicUrl = uploadRes.data.url;
                const taxDetails = resolveBillTaxDetails(targetBill, type, shop, options?.products || []);
                const {
                    isTaxableInvoice,
                    hasIgst,
                    taxableAmount,
                    totalGst,
                    cgstTotal,
                    sgstTotal,
                    igstTotal,
                    grandTotal
                } = taxDetails;

                const taxPart = isTaxableInvoice && totalGst > 0
                    ? `Taxable Value: ₹${Number(taxableAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}%0A` +
                      (hasIgst 
                        ? `IGST: ₹${Number(igstTotal).toLocaleString('en-IN', { minimumFractionDigits: 2 })}%0A`
                        : `CGST: ₹${Number(cgstTotal).toLocaleString('en-IN', { minimumFractionDigits: 2 })}%0A` +
                          `SGST: ₹${Number(sgstTotal).toLocaleString('en-IN', { minimumFractionDigits: 2 })}%0A`) +
                      `Total GST: ₹${Number(totalGst).toLocaleString('en-IN', { minimumFractionDigits: 2 })}%0A`
                    : '';

                const waText = encodeURIComponent(
                    `*${shop?.name || 'ShopPulse Business'}*%0A` +
                    `Invoice for Bill #${billId}%0A` +
                    `Payment Mode: ${(targetBill.paymentMethod || 'CASH').toUpperCase()}%0A` +
                    taxPart +
                    `Grand Total: ₹${Number(grandTotal || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}%0A%0A` +
                    `View Invoice PDF: ${publicUrl}%0A%0A` +
                    `Generated by ShopPulse.`
                );
                window.open(`https://wa.me/?text=${waText}`, '_blank');
                return { success: true, method: 'link' };
            }

            throw new Error('Upload failed');
        } catch (err) {
            console.error('Sharing failed:', err);
            const targetBill = Array.isArray(data) ? data[0] : data;
            const billId = targetBill?._id?.slice(-6).toUpperCase() || 'BILL';
            const taxDetails = resolveBillTaxDetails(targetBill, type, shop, options?.products || []);
            const {
                isTaxableInvoice,
                hasIgst,
                taxableAmount,
                totalGst,
                cgstTotal,
                sgstTotal,
                igstTotal,
                grandTotal
            } = taxDetails;

            const taxPart = isTaxableInvoice && totalGst > 0
                ? `Taxable Value: ₹${Number(taxableAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}%0A` +
                  (hasIgst 
                    ? `IGST: ₹${Number(igstTotal).toLocaleString('en-IN', { minimumFractionDigits: 2 })}%0A`
                    : `CGST: ₹${Number(cgstTotal).toLocaleString('en-IN', { minimumFractionDigits: 2 })}%0A` +
                      `SGST: ₹${Number(sgstTotal).toLocaleString('en-IN', { minimumFractionDigits: 2 })}%0A`) +
                  `Total GST: ₹${Number(totalGst).toLocaleString('en-IN', { minimumFractionDigits: 2 })}%0A`
                : '';

            const waText = encodeURIComponent(
                `*${shop?.name || 'ShopPulse Business'}*%0A` +
                `Invoice for Bill #${billId}%0A` +
                `Payment Mode: ${(targetBill?.paymentMethod || 'CASH').toUpperCase()}%0A` +
                taxPart +
                `Grand Total: ₹${Number(grandTotal || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}%0A%0A` +
                `Thank you for your business!`
            );
            window.open(`https://wa.me/?text=${waText}`, '_blank');
            return { success: false, method: 'text' };
        }
    },

    /**
     * Download Invoice PDF in specified format
     */
    downloadInvoice: (data, shop, type = 'SALE', options = {}) => {
        const activeFormat = options?.format || shop?.defaultPrintFormat || 'full_a4';
        const doc = invoiceService.generateInvoicePDF(data, shop, type, { ...options, format: activeFormat });
        let fileName = 'Invoice.pdf';
        if (Array.isArray(data)) {
            const ids = data.slice(0, 2).map(b => b?._id?.slice(-6).toUpperCase()).join('-');
            fileName = `Invoices-${ids}.pdf`;
        } else if (options.secondBill) {
            const id1 = data?._id?.slice(-6).toUpperCase() || 'A';
            const id2 = options.secondBill?._id?.slice(-6).toUpperCase() || 'B';
            fileName = `TwoBills-${id1}-${id2}.pdf`;
        } else if (data?._id) {
            fileName = `Invoice-${data._id.slice(-6).toUpperCase()}.pdf`;
        }
        doc.save(fileName);
    }
};

export default invoiceService;
