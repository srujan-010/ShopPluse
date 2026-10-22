/**
 * ShopPulse — Unified GST Calculation & Tax Distribution Service
 * (Updated: Half A4 & Gov Sales Support)
 * 
 * Reusable for:
 * - Regular retail sales
 * - Government sales (applied unit rate = government price)
 * - View Bill modals
 * - PDF generation (Half-A4, 2-on-1, and full-page fallback)
 * - Printed invoices
 * - Bill sharing (WhatsApp / Web Share)
 */

/**
 * Format currency in Indian Rupees
 */
export const fmtCur = (val) => {
    const n = Number(val) || 0;
    return `₹${n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

/**
 * Calculate GST for a single line item based on its applied unit price,
 * quantity, and tax configuration.
 * 
 * @param {Object} params
 * @param {number} params.unitPrice Applied unit price (gov price for gov sales, retail price for retail)
 * @param {number} params.quantity Quantity in entered units
 * @param {boolean} params.isGstApplicable Whether GST applies to this item
 * @param {number} params.gstRate Tax rate percentage (e.g. 5, 12, 18, 28)
 * @param {string} params.gstPricingMode 'inclusive' | 'exclusive'
 * @param {number} [params.discount] Optional line-level discount
 * @returns {Object} Tax distribution breakdown
 */
export const calculateLineItemGst = ({
    unitPrice = 0,
    quantity = 0,
    isGstApplicable = false,
    gstRate = 0,
    gstPricingMode = 'inclusive',
    discount = 0
}) => {
    const qty = Number(quantity) || 0;
    const rate = Number(unitPrice) || 0;
    const rawLineBase = parseFloat((qty * rate).toFixed(2));
    const disc = Number(discount) || 0;
    const netBase = Math.max(0, parseFloat((rawLineBase - disc).toFixed(2)));

    const isTax = Boolean(isGstApplicable && Number(gstRate) > 0);
    const ratePct = isTax ? Number(gstRate) : 0;
    const mode = gstPricingMode === 'exclusive' ? 'exclusive' : 'inclusive';

    let taxableValue = 0;
    let gstAmount = 0;
    let cgst = 0;
    let sgst = 0;
    let lineTotal = 0;

    if (isTax && ratePct > 0) {
        if (mode === 'exclusive') {
            // GST Exclusive: unit rate is base taxable; tax is added
            taxableValue = netBase;
            gstAmount = parseFloat((taxableValue * (ratePct / 100)).toFixed(2));
            cgst = parseFloat((gstAmount / 2).toFixed(2));
            sgst = parseFloat((gstAmount - cgst).toFixed(2));
            lineTotal = parseFloat((taxableValue + gstAmount).toFixed(2));
        } else {
            // GST Inclusive: unit rate includes tax; extract taxable and tax
            taxableValue = parseFloat((netBase / (1 + (ratePct / 100))).toFixed(2));
            gstAmount = parseFloat((netBase - taxableValue).toFixed(2));
            cgst = parseFloat((gstAmount / 2).toFixed(2));
            sgst = parseFloat((gstAmount - cgst).toFixed(2));
            lineTotal = netBase;
        }
    } else {
        // GST Disabled or 0%
        taxableValue = netBase;
        gstAmount = 0;
        cgst = 0;
        sgst = 0;
        lineTotal = netBase;
    }

    const unitTaxable = qty > 0 ? parseFloat((taxableValue / qty).toFixed(4)) : 0;
    const unitGst = qty > 0 ? parseFloat((gstAmount / qty).toFixed(4)) : 0;

    return {
        unitPrice: rate,
        quantity: qty,
        rawLineBase,
        taxableValue,
        gstAmount,
        cgst,
        sgst,
        igst: 0,
        lineTotal,
        unitTaxable,
        unitGst,
        isTaxable: isTax,
        gstRate: ratePct,
        gstPricingMode: mode
    };
};

/**
 * Resolve full bill tax details for any transaction (retail or government sale).
 * - Honors existing valid non-zero snapshots (does not modify completed historical records).
 * - For records without pre-saved tax snapshots, reads product configuration and
 *   calculates GST using the applied government price.
 * 
 * @param {Object} bill The sale / government sale document
 * @param {string} type Transaction type ('SALE', 'GOV_SALE', 'PURCHASE')
 * @param {Object} [shop] Shop details
 * @param {Array} [products] Available products in shop for tax config lookup
 * @returns {Object} Complete unified tax distribution
 */
export const resolveBillTaxDetails = (bill, type = 'SALE', shop = null, products = []) => {
    if (!bill) {
        return {
            isGovBill: false,
            isTaxableInvoice: false,
            hasIgst: false,
            subtotal: 0,
            discount: 0,
            taxableAmount: 0,
            totalGst: 0,
            cgstTotal: 0,
            sgstTotal: 0,
            igstTotal: 0,
            grandTotal: 0,
            items: [],
            effectiveItems: []
        };
    }

    const isGovBill = type === 'GOV_SALE' || 
                      bill.type === 'GOV_SALE' || 
                      Boolean(bill.isInspectionCopy) || 
                      (bill.invoiceNumber && bill.invoiceNumber.startsWith('GOV-'));

    const rawItems = bill.items || [];
    const effectiveItems = rawItems.filter(item => {
        if (bill.type === 'SALE' && item.remainingQty !== undefined && !isNaN(item.remainingQty)) {
            return item.remainingQty > 0;
        }
        return true;
    });

    const discount = Number(bill.discount || bill.discountAmount || 0);
    const grandTotalFromDoc = Number(bill.totalAmount || bill.totalPrice || 0);

    let aggSubtotal = 0;
    let aggTaxable = 0;
    let aggGst = 0;
    let aggLineTotal = 0;
    let anyTaxableItem = false;

    const resolvedItems = effectiveItems.map((item, idx) => {
        const qty = (item.remainingQty !== undefined && !isNaN(item.remainingQty))
            ? Number(item.remainingQty)
            : Number(item.soldQtyEntered || item.quantity || 0);
        const unit = item.soldUnit || item.unit || 'Pc';

        // Applied unit rate: for government sales, strictly use government price
        const appliedRate = isGovBill
            ? Number(item.governmentPrice || item.pricePerBaseUnit || 0)
            : Number(item.pricePerBaseUnit !== undefined && item.pricePerBaseUnit !== null ? item.pricePerBaseUnit : (item.price || item.purchaseRate || 0));

        // Product tax config lookup (from populated item.product or products array)
        const productObj = (typeof item.product === 'object' && item.product) 
            ? item.product 
            : (Array.isArray(products) ? products.find(p => p._id === item.product) : null);

        let isGstApplicable = false;
        if (item.isGstApplicable !== undefined) {
            isGstApplicable = Boolean(item.isGstApplicable);
        } else if (productObj?.isGstApplicable !== undefined) {
            isGstApplicable = Boolean(productObj.isGstApplicable);
        } else {
            isGstApplicable = (Number(item.gstRate || item.gst || productObj?.gstRate || productObj?.gst || 0) > 0);
        }

        let gstRate = 0;
        if (item.gstRate !== undefined && Number(item.gstRate) > 0) {
            gstRate = Number(item.gstRate);
        } else if (productObj?.gstRate !== undefined && Number(productObj.gstRate) > 0) {
            gstRate = Number(productObj.gstRate);
        } else if (item.gst !== undefined && Number(item.gst) > 0) {
            gstRate = Number(item.gst);
        } else if (productObj?.gst !== undefined && Number(productObj.gst) > 0) {
            gstRate = Number(productObj.gst);
        }
        if (!isGstApplicable) gstRate = 0;

        const gstPricingMode = item.gstPricingMode || productObj?.gstPricingMode || 'inclusive';

        // Check if item already has a valid, non-zero persisted tax snapshot
        const hasValidSnapshot = (
            item.taxableValue !== undefined && 
            Number(item.taxableValue) > 0 && 
            item.gstAmount !== undefined && 
            Number(item.gstAmount) > 0
        );

        let calc;
        if (hasValidSnapshot) {
            // Preserve the historical snapshot exactly
            const taxableVal = Number(item.taxableValue);
            const gstAmt = Number(item.gstAmount);
            const cgst = item.cgst !== undefined ? Number(item.cgst) : parseFloat((gstAmt / 2).toFixed(2));
            const sgst = item.sgst !== undefined ? Number(item.sgst) : parseFloat((gstAmt - cgst).toFixed(2));
            const lineTot = item.lineTotal !== undefined ? Number(item.lineTotal) : (item.totalPrice !== undefined ? Number(item.totalPrice) : (qty * appliedRate));

            calc = {
                unitPrice: appliedRate,
                quantity: qty,
                rawLineBase: parseFloat((qty * appliedRate).toFixed(2)),
                taxableValue: taxableVal,
                gstAmount: gstAmt,
                cgst,
                sgst,
                igst: Number(item.igst || 0),
                lineTotal: lineTot,
                unitTaxable: qty > 0 ? parseFloat((taxableVal / qty).toFixed(4)) : 0,
                unitGst: qty > 0 ? parseFloat((gstAmt / qty).toFixed(4)) : 0,
                isTaxable: isGstApplicable && gstRate > 0,
                gstRate,
                gstPricingMode
            };
        } else {
            // Calculate tax distribution from the applied government unit price
            calc = calculateLineItemGst({
                unitPrice: appliedRate,
                quantity: qty,
                isGstApplicable,
                gstRate,
                gstPricingMode
            });
        }

        aggSubtotal += calc.rawLineBase;
        aggTaxable += calc.taxableValue;
        aggGst += calc.gstAmount;
        aggLineTotal += calc.lineTotal;
        if (calc.isTaxable) anyTaxableItem = true;

        return {
            ...item,
            productName: item.productName || productObj?.name || 'Item',
            appliedRate,
            qty,
            unit,
            ...calc
        };
    });

    aggSubtotal = parseFloat(aggSubtotal.toFixed(2));
    aggTaxable = parseFloat(aggTaxable.toFixed(2));
    aggGst = parseFloat(aggGst.toFixed(2));
    aggLineTotal = parseFloat(aggLineTotal.toFixed(2));

    const isTaxableInvoice = Boolean(
        anyTaxableItem ||
        (bill.totalGst !== undefined && Number(bill.totalGst) > 0) ||
        bill.isGstInvoice
    );

    const hasIgst = Boolean(bill.igstTotal && Number(bill.igstTotal) > 0);
    const igstTotal = hasIgst ? (Number(bill.igstTotal) || aggGst) : 0;

    // Use persisted document-level totals if non-zero, otherwise calculated aggregate
    const taxableAmount = (bill.taxableAmount !== undefined && Number(bill.taxableAmount) > 0)
        ? Number(bill.taxableAmount)
        : (isTaxableInvoice ? aggTaxable : aggSubtotal);

    const totalGst = (bill.totalGst !== undefined && Number(bill.totalGst) > 0)
        ? Number(bill.totalGst)
        : (isTaxableInvoice ? aggGst : 0);

    const cgstTotal = hasIgst 
        ? 0 
        : ((bill.cgstTotal !== undefined && Number(bill.cgstTotal) > 0) 
            ? Number(bill.cgstTotal) 
            : parseFloat((totalGst / 2).toFixed(2)));

    const sgstTotal = hasIgst 
        ? 0 
        : ((bill.sgstTotal !== undefined && Number(bill.sgstTotal) > 0) 
            ? Number(bill.sgstTotal) 
            : parseFloat((totalGst - cgstTotal).toFixed(2)));

    const subtotal = (bill.subtotal !== undefined && Number(bill.subtotal) > 0)
        ? Number(bill.subtotal)
        : (aggSubtotal > 0 ? aggSubtotal : (grandTotalFromDoc > 0 ? (grandTotalFromDoc + discount) : aggLineTotal));
    const grandTotal = grandTotalFromDoc > 0 ? grandTotalFromDoc : Math.max(0, aggLineTotal - discount);
    return {
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
        items: resolvedItems
    };
};

/**
 * Extract and validate the government/special selling price for a product.
 * Returns the positive number (> 0) if valid, or null if 0, null, undefined, empty, missing, or non-positive.
 * 
 * @param {Object} product
 * @returns {number|null}
 */
export const getProductGovPrice = (product) => {
    if (!product || typeof product !== 'object') return null;
    const raw = product.governmentPrice !== undefined && product.governmentPrice !== null && product.governmentPrice !== ''
        ? product.governmentPrice
        : (product.govPrice !== undefined && product.govPrice !== null && product.govPrice !== '' ? product.govPrice : null);

    if (raw === null || raw === undefined || raw === '') return null;
    const num = Number(raw);
    return !isNaN(num) && num > 0 ? num : null;
};

/**
 * Determine whether a product is eligible for the current POS sale mode.
 * - In GST Sale (Special Price) mode: only products with a valid government price > 0 are eligible (regardless of category).
 * - In Regular Retail Sale mode: all products remain eligible according to standard retail rules.
 * 
 * @param {Object} product
 * @param {boolean} isGovSaleMode
 * @returns {boolean}
 */
export const isProductEligibleForSaleMode = (product, isGovSaleMode = false) => {
    if (!product) return false;
    if (isGovSaleMode) {
        return getProductGovPrice(product) !== null;
    }
    return true;
};

export default {
    fmtCur,
    calculateLineItemGst,
    resolveBillTaxDetails,
    getProductGovPrice,
    isProductEligibleForSaleMode
};

