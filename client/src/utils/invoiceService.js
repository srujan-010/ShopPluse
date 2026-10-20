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
 * Retrieve registered fertilizer licences for a fertilizer shop
 */
export const getShopFertilizerLicenses = (shop) => {
    if (!shop) return [];
    const shopType = (shop.type || '').toLowerCase();
    const isFertilizer = shopType === 'fertilizers' || shopType.includes('fertilizer');
    if (!isFertilizer) return [];

    let licenses = [];
    if (Array.isArray(shop.fertilizerLicenses) && shop.fertilizerLicenses.length > 0) {
        licenses = shop.fertilizerLicenses
            .filter(l => l && l.licenseType && l.licenseNumber && String(l.licenseNumber).trim().length > 0)
            .map(l => ({
                type: String(l.licenseType).trim().toUpperCase(),
                number: String(l.licenseNumber).trim()
            }));
    } else if (shop.fertilizerLicense && typeof shop.fertilizerLicense === 'string' && shop.fertilizerLicense.trim()) {
        const str = shop.fertilizerLicense.trim();
        let type = 'LAID';
        if (str.startsWith('LAFD')) type = 'LAFD';
        else if (str.startsWith('LASD')) type = 'LASD';
        licenses = [{ type, number: str }];
    }

    const allowed = ['LAID', 'LAFD', 'LASD'];
    const valid = licenses.filter(l => allowed.includes(l.type));
    const seen = new Set();
    const unique = [];
    for (const l of valid) {
        if (!seen.has(l.type)) {
            seen.add(l.type);
            unique.push(l);
        }
    }
    return unique;
};

/**
 * Format registered fertilizer licences into compact header string
 * e.g. "Lic No.: LCFRD122022547GDCD | Lic No.: LCID0820260041GDC"
 */
export const formatFertilizerLicensesText = (shop) => {
    const licenses = getShopFertilizerLicenses(shop);
    if (!licenses || licenses.length === 0) return '';
    return licenses.map(l => `Lic No.: ${l.number}`).join(' | ');
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
    const effectiveShop = {
        ...(shop || {}),
        ...((bill?.shop && typeof bill.shop === 'object') ? bill.shop : {})
    };
    if ((!effectiveShop.fertilizerLicenses || effectiveShop.fertilizerLicenses.length === 0) && shop?.fertilizerLicenses) {
        effectiveShop.fertilizerLicenses = shop.fertilizerLicenses;
    }
    if (!effectiveShop.type && shop?.type) {
        effectiveShop.type = shop.type;
    }
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

    const licText = formatFertilizerLicensesText(effectiveShop);
    if (licText) {
        currentY += 2.8;
        doc.setFont("helvetica", "bold");
        doc.setFontSize(6.2);
        doc.setTextColor(...PRIMARY_COLOR);
        doc.text(licText, centerX, currentY, { align: 'center' });
    }

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

    // 6. Professional Signature Section (Half-A4)
    // Left: Buyer's Signature, Blank Space, Customer / Buyer
    // Right: For [Shop Name], Blank Space, Authorized Signatory
    const sigColWidth = 54;
    const leftColX1 = leftMargin + 2;
    const leftColX2 = leftColX1 + sigColWidth;
    const leftColCenter = (leftColX1 + leftColX2) / 2;

    const rightColX2 = rightMargin - 2;
    const rightColX1 = rightColX2 - sigColWidth;
    const rightColCenter = (rightColX1 + rightColX2) / 2;

    // Fixed anchor at bottom of slot, right above footer
    const footerLineY = slotMaxY - 6.8;
    const sigLineY = footerLineY - 4.5;

    // Wrap shop name cleanly across lines without ellipses
    const rawShopName = effectiveShop?.name || 'ShopPulse Business';
    const forShopText = `For ${rawShopName}`;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(6.8);
    doc.setTextColor(...PRIMARY_COLOR);
    const shopLines = doc.splitTextToSize(forShopText, sigColWidth);
    const shopLineSpacing = 2.8;

    // Blank signing space (default 9.5mm, adjusted safely if bill has many rows)
    let blankSpace = 9.5;
    let topLabelsBottomY = sigLineY - blankSpace;
    const topShopY = topLabelsBottomY - ((shopLines.length - 1) * shopLineSpacing);
    if (sumY + 4.5 > topShopY) {
        blankSpace = Math.max(sigLineY - (sumY + 4.5 + ((shopLines.length - 1) * shopLineSpacing)), 5.5);
        topLabelsBottomY = sigLineY - blankSpace;
    }

    // Left Side: Buyer's Signature
    doc.setFont("helvetica", "bold");
    doc.setFontSize(6.8);
    doc.setTextColor(...PRIMARY_COLOR);
    doc.text("Buyer's Signature", leftColCenter, topLabelsBottomY, { align: 'center' });

    // Right Side: For [Shop Name] (multi-line cleanly wrapped)
    const shopStartY = topLabelsBottomY - ((shopLines.length - 1) * shopLineSpacing);
    shopLines.forEach((line, idx) => {
        doc.text(line, rightColCenter, shopStartY + (idx * shopLineSpacing), { align: 'center' });
    });

    // Thin signature lines at exact same vertical level
    doc.setDrawColor(148, 163, 184); // Slate 400 thin signature line
    doc.setLineWidth(0.25);
    doc.line(leftColX1, sigLineY, leftColX2, sigLineY);
    doc.line(rightColX1, sigLineY, rightColX2, sigLineY);

    // Role subtitles at exact same vertical level
    doc.setFont("helvetica", "normal");
    doc.setFontSize(5.8);
    doc.setTextColor(...MUTED_COLOR);
    doc.text("Customer / Buyer", leftColCenter, sigLineY + 2.8, { align: 'center' });

    doc.setFont("helvetica", "bold");
    doc.setTextColor(...PRIMARY_COLOR);
    doc.text("Authorized Signatory", rightColCenter, sigLineY + 2.8, { align: 'center' });

    // 7. Footer Section anchored cleanly below signature section
    doc.setDrawColor(...BORDER_COLOR);
    doc.setLineWidth(0.2);
    doc.line(leftMargin, footerLineY, rightMargin, footerLineY);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(6.2);
    doc.setTextColor(...PRIMARY_COLOR);
    doc.text("Thank you for your business!", centerX, footerLineY + 2.5, { align: 'center' });

    doc.setFont("helvetica", "normal");
    doc.setFontSize(5.2);
    doc.setTextColor(...MUTED_COLOR);
    doc.text("Generated by ShopPulse POS — A4 Half-Sheet Eco Saver", centerX, footerLineY + 5.0, { align: 'center' });

    const finalFooterY = footerLineY + 5.5;
    return { finalY: finalFooterY, overflow: finalFooterY > slotMaxY };
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
    const effectiveShop = {
        ...(shop || {}),
        ...((bill?.shop && typeof bill.shop === 'object') ? bill.shop : {})
    };
    if ((!effectiveShop.fertilizerLicenses || effectiveShop.fertilizerLicenses.length === 0) && shop?.fertilizerLicenses) {
        effectiveShop.fertilizerLicenses = shop.fertilizerLicenses;
    }
    if (!effectiveShop.type && shop?.type) {
        effectiveShop.type = shop.type;
    }
    doc.text((effectiveShop?.name || 'ShopPulse Business').toUpperCase(), centerX, currentY, { align: 'center' });

    currentY += 5;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(...MUTED_COLOR);
    doc.text(effectiveShop?.location || 'India', centerX, currentY, { align: 'center' });

    currentY += 4.5;
    doc.text(`Phone: ${effectiveShop?.contactNumber || 'XXXXXXXXXX'}  |  GSTIN: ${effectiveShop?.gstNumber || 'N/A'}`, centerX, currentY, { align: 'center' });

    const fullLicText = formatFertilizerLicensesText(effectiveShop);
    if (fullLicText) {
        currentY += 4.2;
        doc.setFont("helvetica", "bold");
        doc.setFontSize(7.8);
        doc.setTextColor(...PRIMARY_COLOR);
        doc.text(fullLicText, centerX, currentY, { align: 'center' });
    }

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

    // Professional Signature Section (Full A4)
    // Left: Buyer's Signature, Blank Space, Customer / Buyer
    // Right: For [Shop Name], Blank Space, Authorized Signatory
    const sigColWidth = 70;
    const leftColX1 = leftMargin + 4;
    const leftColX2 = leftColX1 + sigColWidth;
    const leftColCenter = (leftColX1 + leftColX2) / 2;

    const rightColX2 = rightMargin - 4;
    const rightColX1 = rightColX2 - sigColWidth;
    const rightColCenter = (rightColX1 + rightColX2) / 2;

    // Anchor footer cleanly at bottom of full sheet
    const footerLineY = 272;
    const sigLineY = footerLineY - 10; // 262mm

    // Wrap shop name cleanly across lines without ellipses
    const rawShopName = effectiveShop?.name || 'ShopPulse Business';
    const forShopText = `For ${rawShopName}`;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.5);
    doc.setTextColor(...PRIMARY_COLOR);
    const shopLines = doc.splitTextToSize(forShopText, sigColWidth);
    const shopLineSpacing = 4.2;

    // Blank signing space (generous 18mm, safely adjusted if multi-item table runs long)
    let blankSpace = 18;
    let topLabelsBottomY = sigLineY - blankSpace;
    const topShopY = topLabelsBottomY - ((shopLines.length - 1) * shopLineSpacing);

    if (finalY + 12 > topShopY) {
        if (finalY + 36 > 275) {
            doc.addPage();
            finalY = 20;
        } else {
            blankSpace = Math.max(sigLineY - (finalY + 12 + ((shopLines.length - 1) * shopLineSpacing)), 10);
            topLabelsBottomY = sigLineY - blankSpace;
        }
    }

    // Left Side: Buyer's Signature
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.5);
    doc.setTextColor(...PRIMARY_COLOR);
    doc.text("Buyer's Signature", leftColCenter, topLabelsBottomY, { align: 'center' });

    // Right Side: For [Shop Name] (multi-line cleanly wrapped)
    const shopStartY = topLabelsBottomY - ((shopLines.length - 1) * shopLineSpacing);
    shopLines.forEach((line, idx) => {
        doc.text(line, rightColCenter, shopStartY + (idx * shopLineSpacing), { align: 'center' });
    });

    // Thin signature lines at exact same vertical level
    doc.setDrawColor(148, 163, 184); // Slate 400 thin signature line
    doc.setLineWidth(0.3);
    doc.line(leftColX1, sigLineY, leftColX2, sigLineY);
    doc.line(rightColX1, sigLineY, rightColX2, sigLineY);

    // Role subtitles at exact same vertical level
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...MUTED_COLOR);
    doc.text("Customer / Buyer", leftColCenter, sigLineY + 4.5, { align: 'center' });

    doc.setFont("helvetica", "bold");
    doc.setTextColor(...PRIMARY_COLOR);
    doc.text("Authorized Signatory", rightColCenter, sigLineY + 4.5, { align: 'center' });

    // Footer at bottom of sheet
    doc.setDrawColor(...BORDER_COLOR);
    doc.setLineWidth(0.2);
    doc.line(leftMargin, footerLineY, rightMargin, footerLineY);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(...PRIMARY_COLOR);
    doc.text("Thank you for your business!", centerX, footerLineY + 5.5, { align: 'center' });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(...MUTED_COLOR);
    doc.text("Generated by ShopPulse POS — Full A4", centerX, footerLineY + 10.5, { align: 'center' });
};

/**
 * Render Thermal 58 mm Receipt into custom dimensions PDF
 */
const renderThermal58PDF = (bill, shop, type = 'SALE', options = {}) => {
    const effectiveShop = {
        ...(shop || {}),
        ...((bill?.shop && typeof bill.shop === 'object') ? bill.shop : {})
    };
    if ((!effectiveShop.fertilizerLicenses || effectiveShop.fertilizerLicenses.length === 0) && shop?.fertilizerLicenses) {
        effectiveShop.fertilizerLicenses = shop.fertilizerLicenses;
    }
    if (!effectiveShop.type && shop?.type) {
        effectiveShop.type = shop.type;
    }
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

    const licText58 = formatFertilizerLicensesText(effectiveShop);
    if (licText58) {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(5.8);
        const licLines = doc.splitTextToSize(licText58, right - left);
        licLines.forEach(line => {
            doc.text(line, center, y, { align: 'center' });
            y += 2.6;
        });
        doc.setFont("helvetica", "normal");
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
    const effectiveShop = {
        ...(shop || {}),
        ...((bill?.shop && typeof bill.shop === 'object') ? bill.shop : {})
    };
    if ((!effectiveShop.fertilizerLicenses || effectiveShop.fertilizerLicenses.length === 0) && shop?.fertilizerLicenses) {
        effectiveShop.fertilizerLicenses = shop.fertilizerLicenses;
    }
    if (!effectiveShop.type && shop?.type) {
        effectiveShop.type = shop.type;
    }
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

    const licText80 = formatFertilizerLicensesText(effectiveShop);
    if (licText80) {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(6.8);
        const licLines = doc.splitTextToSize(licText80, right - left);
        licLines.forEach(line => {
            doc.text(line, center, y, { align: 'center' });
            y += 3.0;
        });
        doc.setFont("helvetica", "normal");
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

        // FORMAT 2: Half A4
        // Case A: Array of bills provided for batch printing
        if (Array.isArray(data)) {
            const bills = data.filter(Boolean);
            if (bills.length === 0) return new jsPDF({ format: 'a4', unit: 'mm' });

            // If only 1 bill in array and no second bill requested, generate single compact half-A4 PDF
            if (bills.length === 1 && !options.secondBill && !options.forceFullSheet) {
                const singleBill = bills[0];
                const items = singleBill?.items || [];
                if (items.length > 8 || options.forceFullPage) {
                    const doc = new jsPDF({ format: 'a4', unit: 'mm' });
                    renderFullPageBill(doc, singleBill, shop, singleBill.type || type, options);
                    return doc;
                }
                const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: [148.5, 210] });
                renderBillSlot(doc, singleBill, shop, singleBill.type || type, 5, 1, options);
                return doc;
            }

            // Batch printing 2 bills per A4 sheet with cut line
            const doc = new jsPDF({ format: 'a4', unit: 'mm' });
            let pageIndex = 0;
            for (let i = 0; i < bills.length; i += 2) {
                if (pageIndex > 0) doc.addPage();
                pageIndex++;

                const b1 = bills[i];
                const b2 = bills[i + 1];

                const b1Items = b1?.items || [];
                if (b1Items.length > 8 || options.forceFullPage) {
                    renderFullPageBill(doc, b1, shop, b1?.type || type, options);
                    if (b2) {
                        doc.addPage();
                        const b2Items = b2?.items || [];
                        if (b2Items.length > 8 || options.forceFullPage) {
                            renderFullPageBill(doc, b2, shop, b2?.type || type, options);
                        } else {
                            renderBillSlot(doc, b2, shop, b2?.type || type, 6, 1, options);
                            drawCutLine(doc);
                        }
                    }
                    continue;
                }

                renderBillSlot(doc, b1, shop, b1?.type || type, 6, 1, options);
                drawCutLine(doc);

                if (b2) {
                    const b2Items = b2?.items || [];
                    if (b2Items.length > 8 || options.forceFullPage) {
                        doc.addPage();
                        renderFullPageBill(doc, b2, shop, b2?.type || type, options);
                    } else {
                        renderBillSlot(doc, b2, shop, b2?.type || type, 153, 2, options);
                    }
                }
            }

            return doc;
        }

        // Case B: options.secondBill provided (explicitly 2 bills on 1 sheet with cut line)
        if (options.secondBill) {
            const doc = new jsPDF({ format: 'a4', unit: 'mm' });
            const b1 = data;
            const b2 = options.secondBill;
            const b1Items = b1?.items || [];
            const b2Items = b2?.items || [];

            if (b1Items.length > 8 || b2Items.length > 8 || options.forceFullPage) {
                renderFullPageBill(doc, b1, shop, b1?.type || type, options);
                doc.addPage();
                renderFullPageBill(doc, b2, shop, b2?.type || type, options);
                return doc;
            }

            renderBillSlot(doc, b1, shop, b1?.type || type, 6, 1, options);
            drawCutLine(doc);
            renderBillSlot(doc, b2, shop, b2?.type || type, 153, 2, options);
            return doc;
        }

        // Case C: Single bill provided in Half-A4 format
        // Generates ONLY the compact half-sheet invoice (210mm x 148.5mm landscape)
        // Contains ONLY the single occupied half-size invoice area.
        // Unused second half of A4 is omitted, cut line is removed, no blank pages added.
        const items = data?.items || [];
        if (items.length > 8 || options.forceFullPage) {
            const doc = new jsPDF({ format: 'a4', unit: 'mm' });
            renderFullPageBill(doc, data, shop, type, options);
            return doc;
        }

        const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: [148.5, 210] });
        renderBillSlot(doc, data, shop, type, 5, 1, options);
        return doc;
    },

    /**
     * Download Two Bills on One A4 Sheet PDF
     */
    downloadTwoBillsPDF: (bills, shop, type = 'SALE', options = {}) => {
        const doc = invoiceService.generateInvoicePDF(bills, shop, type, { ...options, format: 'half_a4' });
        const b1 = Array.isArray(bills) ? bills[0] : bills;
        const b2 = Array.isArray(bills) ? bills[1] : options.secondBill;
        const id1 = b1?.invoiceNumber || b1?._id?.slice(-6).toUpperCase() || '1';
        const id2 = b2?.invoiceNumber || b2?._id?.slice(-6).toUpperCase() || '2';
        const fileName = `TwoBills-${id1}-${id2}.pdf`;
        doc.save(fileName);
    },

    /**
     * Share Invoice via WhatsApp (PDF or Link) using retailer's saved default bill format
     * Verifies permanent invoice number, disallows temporary invoice numbers (INV-TEMP-*),
     * and utilizes Web Share API with file sharing or fallback to PDF download + wa.me chat.
     */
    shareInvoice: async (data, shop, type = 'SALE', options = {}) => {
        const targetBill = Array.isArray(data) ? data[0] : data;
        const activeFormat = options?.format || shop?.defaultPrintFormat || 'full_a4';
        const rawMobile = options?.mobile || options?.phone || targetBill?.customerMobile || '';
        const digits = String(rawMobile).replace(/\D/g, '');
        let targetMobile = '';
        if (digits.length === 10) targetMobile = `91${digits}`;
        else if (digits.length === 12 && digits.startsWith('91')) targetMobile = digits;
        else if (digits.length === 11 && digits.startsWith('0')) targetMobile = `91${digits.slice(1)}`;
        else if (digits.length >= 10 && digits.length <= 15) targetMobile = digits;

        // Verify permanent invoice number - reject temporary or missing invoices
        const invoiceNum = targetBill?.invoiceNumber;
        if (!invoiceNum || String(invoiceNum).startsWith('INV-TEMP') || String(invoiceNum).startsWith('TEMP')) {
            throw new Error('Cannot share bill: Permanent invoice number is not available yet.');
        }

        const shopName = shop?.name || 'ShopPulse Business';
        const fileName = `Invoice-${invoiceNum}.pdf`;
        const politeMessage = `Hello! Thank you for shopping at ${shopName}.\n\nPlease find your bill for Invoice #${invoiceNum}.\n\nThank you for your business!`;

        try {
            // Generate exact finalized invoice PDF using retailer's saved format
            const doc = invoiceService.generateInvoicePDF(data, shop, type, { ...options, format: activeFormat });
            const pdfBlob = doc.output('blob');
            const pdfFile = new File([pdfBlob], fileName, { type: 'application/pdf' });

            // 1. Try Web Share API (Mobile native file sharing)
            if (navigator.canShare && navigator.canShare({ files: [pdfFile] })) {
                try {
                    await navigator.share({
                        files: [pdfFile],
                        title: `Invoice #${invoiceNum} from ${shopName}`,
                        text: politeMessage
                    });
                    return { success: true, method: 'native', fileName, invoiceNum };
                } catch (shareErr) {
                    if (shareErr.name === 'AbortError') {
                        return { success: false, method: 'cancelled' };
                    }
                    console.warn('Native share failed or was cancelled, falling back to download + wa.me', shareErr);
                }
            }

            // 2. Fallback: Download the exact finalized invoice PDF
            doc.save(fileName);

            // 3. Open WhatsApp directed to customer's mobile number with prefilled message
            const waText = encodeURIComponent(politeMessage);
            const waUrl = targetMobile ? `https://wa.me/${targetMobile}?text=${waText}` : `https://wa.me/?text=${waText}`;
            window.open(waUrl, '_blank');
            return { success: true, method: 'link_with_pdf', fileName, invoiceNum };
        } catch (err) {
            console.error('Invoice sharing failed:', err);
            throw err;
        }
    },

    /**
     * Download Invoice PDF in specified or retailer's default format
     */
    downloadInvoice: (data, shop, type = 'SALE', options = {}) => {
        const activeFormat = options?.format || shop?.defaultPrintFormat || 'full_a4';
        const doc = invoiceService.generateInvoicePDF(data, shop, type, { ...options, format: activeFormat });
        let fileName = 'Invoice.pdf';
        if (Array.isArray(data)) {
            const ids = data.slice(0, 2).map(b => b?.invoiceNumber || b?._id?.slice(-6).toUpperCase()).join('-');
            fileName = `Invoices-${ids}.pdf`;
        } else if (options.secondBill) {
            const id1 = data?.invoiceNumber || data?._id?.slice(-6).toUpperCase() || 'A';
            const id2 = options.secondBill?.invoiceNumber || options.secondBill?._id?.slice(-6).toUpperCase() || 'B';
            fileName = `TwoBills-${id1}-${id2}.pdf`;
        } else if (data?.invoiceNumber) {
            fileName = `Invoice-${data.invoiceNumber}.pdf`;
        } else if (data?._id) {
            fileName = `Invoice-${data._id.slice(-6).toUpperCase()}.pdf`;
        }
        doc.save(fileName);
    }
};

export default invoiceService;
