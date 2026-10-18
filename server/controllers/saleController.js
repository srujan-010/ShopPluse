const Sale = require('../models/Sale');
const Product = require('../models/Product');
const Purchase = require('../models/Purchase');
const Khata = require('../models/Khata');
const GovernmentSale = require('../models/GovernmentSale');
const InventoryHistory = require('../models/InventoryHistory');
const ReturnRecord = require('../models/ReturnRecord');
const ExchangeRecord = require('../models/ExchangeRecord');
const Shop = require('../models/Shop');
const mongoose = require('mongoose');
const { processExpiryAlerts } = require('../utils/expiryHelper');

const normalizeUnit = (u) => {
    if (!u) return '';
    const s = u.toLowerCase().trim();
    if (s === 'pieces' || s === 'pcs' || s === 'pc') return 'piece';
    if (s === 'grams' || s === 'g') return 'gram';
    if (s === 'kilograms' || s === 'kgs') return 'kg';
    if (s === 'liters' || s === 'litres' || s === 'l') return 'liter';
    if (s === 'milliliters' || s === 'mls') return 'ml';
    if (s === 'meters' || s === 'm') return 'meter';
    if (s === 'centimeters') return 'cm';
    if (s === 'dozens') return 'dozen';
    return s;
};

const getConversionMultiplier = (fromUnit, toUnit) => {
    if (!fromUnit || !toUnit) return 1;
    const u1 = normalizeUnit(fromUnit);
    const u2 = normalizeUnit(toUnit);
    if (u1 === u2) return 1;
    const key = `${u1}-${u2}`;
    const table = {
        'gram-kg': 0.001,
        'kg-gram': 1000,
        'ml-liter': 0.001,
        'liter-ml': 1000,
        'cm-meter': 0.01,
        'meter-cm': 100,
        'inch-feet': 1/12,
        'feet-inch': 12,
        'piece-dozen': 1/12,
        'dozen-piece': 12
    };
    return table[key];
};

// Helper to resolve payment status, paidAmount, and remainingAmount accurately
const resolvePaymentInfo = (tx, khataCustomerMap) => {
    const total = Number(tx.totalAmount !== undefined ? tx.totalAmount : (tx.totalPrice || 0));
    const method = (tx.paymentMethod || tx.paymentMode || 'Cash').toUpperCase();

    // 1. CASH / UPI: always fully paid unless explicitly recorded otherwise
    if (method === 'CASH' || method === 'UPI') {
        const paid = (tx.paidAmount !== undefined && tx.paidAmount !== null) ? Number(tx.paidAmount) : total;
        const due = (tx.remainingAmount !== undefined && tx.remainingAmount !== null) ? Number(tx.remainingAmount) : Math.max(0, total - paid);
        const status = tx.paymentStatus || (due === 0 ? 'Paid' : (paid > 0 ? 'Partial' : 'Unpaid'));
        return { paidAmount: paid, remainingAmount: due, paymentStatus: status };
    }

    // 2. KHATA:
    if (method === 'KHATA') {
        let khata = null;
        if (khataCustomerMap) {
            if (tx.customerMobile) {
                khata = khataCustomerMap.get(tx.customerMobile.toString().trim());
            }
            if (!khata && tx.customerName) {
                khata = khataCustomerMap.get(tx.customerName.toString().toLowerCase().trim());
            }
        }

        // If customer has 0 outstanding due in Khata (all cleared!) and has payment records
        if (khata && Number(khata.outstandingDue) === 0 && (khata.transactions || []).some(t => t.type === 'payment')) {
            return { paidAmount: total, remainingAmount: 0, paymentStatus: 'Paid' };
        }

        // Check if tx already has persisted paidAmount & remainingAmount
        if (tx.paidAmount !== undefined && tx.paidAmount !== null && tx.remainingAmount !== undefined && tx.remainingAmount !== null) {
            const paid = Number(tx.paidAmount);
            const due = Number(tx.remainingAmount);
            const status = tx.paymentStatus || (due === 0 ? 'Paid' : (paid > 0 ? 'Partial' : 'Unpaid'));
            return { paidAmount: paid, remainingAmount: due, paymentStatus: status };
        }

        // If tx is linked to a specific Khata due entry
        if (khata && Array.isArray(khata.transactions)) {
            const saleIdStr = tx._id?.toString();
            const matchedTx = saleIdStr ? khata.transactions.find(t => t.saleId && t.saleId.toString() === saleIdStr) : null;
            if (matchedTx) {
                let remainingPayments = khata.transactions
                    .filter(t => t.type === 'payment')
                    .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);

                const dues = khata.transactions.filter(t => t.type === 'due');
                for (const d of dues) {
                    const dAmt = Number(d.amount) || 0;
                    const paidForDue = Math.min(dAmt, remainingPayments);
                    remainingPayments = Math.max(0, remainingPayments - paidForDue);
                    if (d.saleId && d.saleId.toString() === saleIdStr) {
                        const dueForThis = parseFloat((dAmt - paidForDue).toFixed(2));
                        const status = dueForThis === 0 ? 'Paid' : (paidForDue > 0 ? 'Partial' : 'Unpaid');
                        return { paidAmount: paidForDue, remainingAmount: dueForThis, paymentStatus: status };
                    }
                }
            }
        }

        // Fallback for Khata where no payment was recorded or customer has outstanding debt
        return { paidAmount: 0, remainingAmount: total, paymentStatus: 'Unpaid' };
    }

    // Other methods / fallback
    const paid = (tx.paidAmount !== undefined && tx.paidAmount !== null) ? Number(tx.paidAmount) : total;
    const due = (tx.remainingAmount !== undefined && tx.remainingAmount !== null) ? Number(tx.remainingAmount) : Math.max(0, total - paid);
    return {
        paidAmount: paid,
        remainingAmount: due,
        paymentStatus: tx.paymentStatus || (due === 0 ? 'Paid' : (paid > 0 ? 'Partial' : 'Unpaid'))
    };
};

// @desc    Get all sales for owner or shop
// @route   GET /api/sales
// @access  Private
exports.getSales = async (req, res) => {
    try {
        let query = {};
        if (req.query.shop) {
            query.shop = req.query.shop;
        } else {
            query.owner = req.user.id;
        }
        
        const [sales, returns, exchanges, govSales, khataRecords] = await Promise.all([
            Sale.find(query).populate('shop', 'name').lean(),
            ReturnRecord.find(query).populate('shop', 'name').lean(),
            ExchangeRecord.find(query).populate('shop', 'name').lean(),
            GovernmentSale.find(query).populate('shop', 'name').populate('items.product', 'name category isGstApplicable gstRate gstPricingMode gst governmentPrice sellPrice unit').lean(),
            Khata.find(query).lean()
        ]);

        const khataCustomerMap = new Map();
        (khataRecords || []).forEach(k => {
            if (k.mobile) khataCustomerMap.set(k.mobile.trim(), k);
            if (k.customerName) khataCustomerMap.set(k.customerName.toLowerCase().trim(), k);
        });

        sales.forEach(s => {
            s.type = 'SALE';
            const payInfo = resolvePaymentInfo(s, khataCustomerMap);
            s.paidAmount = payInfo.paidAmount;
            s.remainingAmount = payInfo.remainingAmount;
            s.paymentStatus = payInfo.paymentStatus;
        });

        returns.forEach(r => {
            r.type = 'RETURN';
            r.totalAmount = -r.totalRefundAmount; // Displayed as negative in sales list
            r.paymentMethod = r.refundMethod || 'Cash';
            r.paidAmount = r.totalRefundAmount || 0;
            r.remainingAmount = 0;
            r.paymentStatus = 'Refunded';
        });

        exchanges.forEach(e => {
            e.type = 'EXCHANGE';
            e.totalAmount = e.balanceDifference || 0;
            if (e.balanceDifference > 0) {
                if ((e.paymentMethod || '').toUpperCase() === 'KHATA') {
                    e.paidAmount = 0;
                    e.remainingAmount = e.balanceDifference;
                    e.paymentStatus = 'Unpaid';
                } else {
                    e.paidAmount = e.balanceDifference;
                    e.remainingAmount = 0;
                    e.paymentStatus = 'Paid';
                }
            } else if (e.balanceDifference < 0) {
                e.paidAmount = Math.abs(e.balanceDifference);
                e.remainingAmount = 0;
                e.paymentStatus = 'Refunded';
            } else {
                e.paidAmount = 0;
                e.remainingAmount = 0;
                e.paymentStatus = 'Paid';
            }
            // For detail modal compatibility, combine returned and replacement items
            e.items = [
                ...(e.returnedItems || []).map(item => ({ 
                    ...item, 
                    soldQtyEntered: item.quantity,
                    soldUnit: item.unit,
                    totalPrice: item.totalPrice,
                    isReturnedInExchange: true 
                })),
                ...(e.replacementItems || []).map(item => ({
                    ...item,
                    soldQtyEntered: item.quantity,
                    soldUnit: item.unit,
                    totalPrice: item.totalPrice
                }))
            ];
        });

        // Filter government sales so that auto-generated ones linked to an existing sale are not duplicated
        const existingSaleIds = new Set(sales.map(s => s._id.toString()));
        const unlinkedGovSales = (govSales || []).filter(g => !g.linkedSaleId || !existingSaleIds.has(g.linkedSaleId.toString()));

        unlinkedGovSales.forEach(g => {
            g.type = 'GOV_SALE';
            g.totalProfit = g.totalProfit || 0;
            const payInfo = resolvePaymentInfo(g, khataCustomerMap);
            g.paidAmount = payInfo.paidAmount;
            g.remainingAmount = payInfo.remainingAmount;
            g.paymentStatus = payInfo.paymentStatus;
        });

        const allTransactions = [...sales, ...returns, ...exchanges, ...unlinkedGovSales].sort((a, b) => new Date(b.date) - new Date(a.date));

        res.status(200).json({ success: true, data: allTransactions });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};

// @desc    Create new sale (Cart System)
// @route   POST /api/sales
// @access  Private
exports.createSale = async (req, res) => {
    try {
        const { shop, items, paymentMethod, date, customerName, customerMobile, discountType, discountValue, paidAmount } = req.body;
        const ownerId = req.user.id;

        // Pass 1: Validate stock, convert units, and compute base line amounts
        const preliminaryItems = [];
        let rawSubtotal = 0;

        for (const item of items) {
            const product = await Product.findById(item.product);
            if (!product) continue;

            const enteredQuantity = item.quantity;
            const sellingUnit = item.unit || product.unit;
            const baseUnit = product.unit;

            if (enteredQuantity <= 0) {
                return res.status(400).json({ success: false, message: `Invalid quantity for ${product.name}.` });
            }

            const multiplier = getConversionMultiplier(sellingUnit, baseUnit);
            if (multiplier === undefined) {
                 return res.status(400).json({ success: false, message: `Incompatible units for ${product.name}: cannot convert ${sellingUnit} to ${baseUnit}.` });
            }

            const convertedQuantityInBaseUnit = enteredQuantity * multiplier;

            // Strict Stock Validation
            if (product.quantity < convertedQuantityInBaseUnit) {
                return res.status(400).json({ success: false, message: `Insufficient stock for ${product.name}. Required: ${convertedQuantityInBaseUnit} ${baseUnit}, Available: ${product.quantity} ${baseUnit}` });
            }

            const sellPricePerBaseUnit = product.sellPrice;
            const unitPrice = parseFloat((sellPricePerBaseUnit * multiplier).toFixed(2));
            const baseLineAmount = parseFloat((convertedQuantityInBaseUnit * sellPricePerBaseUnit).toFixed(2));

            // Tax configuration: use item-level snapshot if provided, else product setting with legacy fallback
            let isGstApplicable = false;
            if (item.isGstApplicable !== undefined) {
                isGstApplicable = Boolean(item.isGstApplicable);
            } else if (product.isGstApplicable !== undefined) {
                isGstApplicable = Boolean(product.isGstApplicable);
            } else {
                isGstApplicable = (product.gst || 0) > 0;
            }

            let gstRate = 0;
            if (item.gstRate !== undefined) {
                gstRate = Number(item.gstRate) || 0;
            } else if (product.gstRate !== undefined) {
                gstRate = Number(product.gstRate) || 0;
            } else {
                gstRate = Number(product.gst || 0);
            }
            if (!isGstApplicable) {
                gstRate = 0;
            }

            const gstPricingMode = item.gstPricingMode || product.gstPricingMode || 'inclusive';

            rawSubtotal += baseLineAmount;

            preliminaryItems.push({
                product,
                enteredQuantity,
                sellingUnit,
                baseUnit,
                multiplier,
                convertedQuantityInBaseUnit,
                sellPricePerBaseUnit,
                unitPrice,
                baseLineAmount,
                isGstApplicable,
                gstRate,
                gstPricingMode,
                buyPricePerBaseUnit: product.buyPrice || 0
            });
        }

        rawSubtotal = parseFloat(rawSubtotal.toFixed(2));

        // --- DISCOUNT CALCULATION & VALIDATIONS ---
        let calculatedDiscountAmount = 0;
        if (discountType === 'flat') {
            calculatedDiscountAmount = Math.min(rawSubtotal, Number(discountValue) || 0);
        } else if (discountType === 'percentage') {
            const pct = Number(discountValue) || 0;
            calculatedDiscountAmount = Math.min(rawSubtotal, parseFloat(((rawSubtotal * pct) / 100).toFixed(2)));
        }

        // Validations
        if (Number(discountValue) < 0) {
            return res.status(400).json({ success: false, message: 'Discount value cannot be negative.' });
        }
        if (calculatedDiscountAmount > rawSubtotal) {
            return res.status(400).json({ success: false, message: 'Discount cannot exceed subtotal.' });
        }

        // Pass 2: Allocate discount proportionally & compute GST and line totals
        let accumulatedItemDiscount = 0;
        const processedItems = [];
        let totalTaxableAmount = 0;
        let totalGstAmount = 0;
        let totalCgst = 0;
        let totalSgst = 0;
        let finalPayableAmount = 0;
        let totalProfitAmount = 0;

        for (let i = 0; i < preliminaryItems.length; i++) {
            const pItem = preliminaryItems[i];
            const isLast = (i === preliminaryItems.length - 1);

            let itemDiscount = 0;
            if (calculatedDiscountAmount > 0 && rawSubtotal > 0) {
                if (isLast) {
                    itemDiscount = parseFloat((calculatedDiscountAmount - accumulatedItemDiscount).toFixed(2));
                } else {
                    itemDiscount = parseFloat(((pItem.baseLineAmount / rawSubtotal) * calculatedDiscountAmount).toFixed(2));
                    accumulatedItemDiscount += itemDiscount;
                }
            }

            let itemTaxable = 0;
            let itemGst = 0;
            let itemCgst = 0;
            let itemSgst = 0;
            let itemLineTotal = 0;

            if (pItem.isGstApplicable && pItem.gstRate > 0) {
                if (pItem.gstPricingMode === 'exclusive') {
                    // GST Exclusive: selling price does not include GST
                    // Taxable value = discounted base amount
                    // GST = taxable value * (rate / 100)
                    // Line total = taxable value + GST
                    itemTaxable = Math.max(0, parseFloat((pItem.baseLineAmount - itemDiscount).toFixed(2)));
                    itemGst = parseFloat((itemTaxable * (pItem.gstRate / 100)).toFixed(2));
                    itemCgst = parseFloat((itemGst / 2).toFixed(2));
                    itemSgst = parseFloat((itemGst - itemCgst).toFixed(2));
                    itemLineTotal = parseFloat((itemTaxable + itemGst).toFixed(2));
                } else {
                    // GST Inclusive: selling price already includes GST
                    // Gross line total = discounted base amount
                    // Taxable value = gross line total / (1 + rate / 100)
                    // GST = gross line total - taxable value
                    const netGross = Math.max(0, parseFloat((pItem.baseLineAmount - itemDiscount).toFixed(2)));
                    itemTaxable = parseFloat((netGross / (1 + (pItem.gstRate / 100))).toFixed(2));
                    itemGst = parseFloat((netGross - itemTaxable).toFixed(2));
                    itemCgst = parseFloat((itemGst / 2).toFixed(2));
                    itemSgst = parseFloat((itemGst - itemCgst).toFixed(2));
                    itemLineTotal = netGross;
                }
            } else {
                // GST Disabled or 0%
                itemTaxable = Math.max(0, parseFloat((pItem.baseLineAmount - itemDiscount).toFixed(2)));
                itemGst = 0;
                itemCgst = 0;
                itemSgst = 0;
                itemLineTotal = itemTaxable;
            }

            const costOfGoods = pItem.convertedQuantityInBaseUnit * pItem.buyPricePerBaseUnit;
            const itemProfit = parseFloat((itemTaxable - costOfGoods).toFixed(2));

            totalTaxableAmount += itemTaxable;
            totalGstAmount += itemGst;
            totalCgst += itemCgst;
            totalSgst += itemSgst;
            finalPayableAmount += itemLineTotal;
            totalProfitAmount += itemProfit;

            // Deduct stock safely
            const product = pItem.product;
            const previousStock = product.quantity;
            product.quantity = Math.max(0, parseFloat((product.quantity - pItem.convertedQuantityInBaseUnit).toFixed(3)));
            await product.save();

            processedItems.push({
                product: product._id,
                productName: product.name,
                soldQtyEntered: pItem.enteredQuantity,
                soldUnit: pItem.sellingUnit,
                soldQtyBaseUnit: pItem.convertedQuantityInBaseUnit,
                pricePerBaseUnit: pItem.sellPricePerBaseUnit,
                totalPrice: itemLineTotal,

                // Legacy compatibility fields
                quantity: pItem.enteredQuantity,
                unit: pItem.sellingUnit,
                multiplier: pItem.multiplier,
                price: parseFloat((itemLineTotal / pItem.enteredQuantity).toFixed(2)) || pItem.sellPricePerBaseUnit,
                profit: itemProfit,

                // Tax snapshot
                isGstApplicable: pItem.isGstApplicable,
                gstRate: pItem.gstRate,
                gstPricingMode: pItem.gstPricingMode,
                taxableValue: itemTaxable,
                gstAmount: itemGst,
                cgst: itemCgst,
                sgst: itemSgst,
                igst: 0,
                lineTotal: itemLineTotal,

                // For history tracking
                previousStock: previousStock,
                newStock: product.quantity
            });
        }

        totalTaxableAmount = parseFloat(totalTaxableAmount.toFixed(2));
        totalGstAmount = parseFloat(totalGstAmount.toFixed(2));
        totalCgst = parseFloat(totalCgst.toFixed(2));
        totalSgst = parseFloat(totalSgst.toFixed(2));
        finalPayableAmount = parseFloat(finalPayableAmount.toFixed(2));
        totalProfitAmount = parseFloat(totalProfitAmount.toFixed(2));

        let finalPaidAmount = finalPayableAmount;
        let finalRemainingAmount = 0;
        let finalPaymentStatus = 'Paid';

        if (paymentMethod === 'Khata') {
            const paidAmountVal = typeof paidAmount !== 'undefined' ? Number(paidAmount) : 0;
            if (paidAmountVal < 0) {
                return res.status(400).json({ success: false, message: 'Paid amount cannot be negative.' });
            }
            if (paidAmountVal > finalPayableAmount + 0.01) {
                return res.status(400).json({ success: false, message: 'Paid amount cannot exceed final amount.' });
            }
            finalPaidAmount = paidAmountVal;
            finalRemainingAmount = parseFloat((finalPayableAmount - paidAmountVal).toFixed(2));
            
            if (finalRemainingAmount === 0) {
                finalPaymentStatus = 'Paid';
            } else if (finalPaidAmount > 0) {
                finalPaymentStatus = 'Partial';
            } else {
                finalPaymentStatus = 'Unpaid';
            }
        }

        const Shop = require('../models/Shop');
        const shopRecord = await Shop.findById(shop);
        let invoiceNumber = `INV-${Math.floor(100000 + Math.random() * 900000)}`;

        if (shopRecord) {
            const prefix = shopRecord.invoicePrefix || 'INV';
            const counter = shopRecord.invoiceCounter || 1000;
            invoiceNumber = `${prefix}-${counter}`;
            shopRecord.invoiceCounter = counter + 1;
            await shopRecord.save();
        }

        const sale = await Sale.create({
            shop,
            invoiceNumber,
            customerName: customerName || 'Walk-in Customer',
            customerMobile: customerMobile || '',
            items: processedItems,
            subtotal: rawSubtotal,
            taxableAmount: totalTaxableAmount,
            totalGst: totalGstAmount,
            cgstTotal: totalCgst,
            sgstTotal: totalSgst,
            igstTotal: 0,
            isGstInvoice: totalGstAmount > 0,
            totalAmount: finalPayableAmount,
            totalProfit: totalProfitAmount,
            discountType: discountType || 'none',
            discountValue: Number(discountValue) || 0,
            discountAmount: calculatedDiscountAmount,
            discount: calculatedDiscountAmount, // Legacy compatibility
            paidAmount: finalPaidAmount,
            remainingAmount: finalRemainingAmount,
            paymentStatus: finalPaymentStatus,
            paymentMethod,
            date: date || new Date(),
            owner: shopRecord?.owner || ownerId
        });

        // --- Log Inventory History for Normal Sale ---
        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date();
        endOfDay.setHours(23, 59, 59, 999);

        for (const item of processedItems) {
            const existingSummary = await InventoryHistory.findOne({
                productId: item.product,
                actionType: 'STOCK_SOLD',
                owner: ownerId,
                createdAt: { $gte: startOfDay, $lte: endOfDay }
            });

            if (existingSummary) {
                existingSummary.quantity += item.soldQtyBaseUnit;
                existingSummary.newStock = item.newStock; // Keep absolute latest stock
                existingSummary.notes = `Sold ${existingSummary.quantity} ${existingSummary.unit || 'Piece'}`;
                await existingSummary.save();
            } else {
                await InventoryHistory.create({
                    productId: item.product,
                    productName: item.productName,
                    actionType: 'STOCK_SOLD',
                    quantity: item.soldQtyBaseUnit,
                    unit: 'Piece',
                    previousStock: item.previousStock, // First sale of the day dictates starting stock
                    newStock: item.newStock,
                    source: 'Daily Summary',
                    referenceId: '',
                    notes: `Sold ${item.soldQtyBaseUnit} Piece`,
                    shop,
                    owner: ownerId
                });
            }
        }

        // If Khata, create/update Khata record
        if (paymentMethod === 'Khata' && customerMobile) {
            const Khata = require('../models/Khata');
            let khataRecord = await Khata.findOne({ shop, mobile: customerMobile.trim() });
            
            if (!khataRecord) {
                khataRecord = new Khata({
                    shop,
                    owner: ownerId,
                    customerName: customerName || 'Walk-in Customer',
                    mobile: customerMobile.trim(),
                    outstandingDue: 0,
                    transactions: []
                });
            }
            
            if (finalRemainingAmount > 0) {
                khataRecord.outstandingDue += finalRemainingAmount;
                khataRecord.transactions.push({
                    type: 'due',
                    amount: finalRemainingAmount,
                    date: date || new Date(),
                    note: `Sale recorded via POS (Bill #${sale._id.toString().slice(-6).toUpperCase()})`,
                    saleId: sale._id,
                    isPOSSale: true,
                    paymentMethod: 'Khata',
                    items: processedItems.map(item => ({
                        productName: item.productName,
                        quantity: item.soldQtyEntered,
                        unit: item.soldUnit,
                        price: item.pricePerBaseUnit || item.price
                    }))
                });
            }
            
            await khataRecord.save();
        }

        // --- AUTO-GENERATE GOVERNMENT RECORD ---
        if (shopRecord && shopRecord.type === 'Fertilizers') {
            let totalGovernmentAmount = 0;
            let totalGovTaxableAmount = 0;
            let totalGovGstAmount = 0;
            let totalGovCgst = 0;
            let totalGovSgst = 0;
            const govItems = [];

            for (const item of items) {
                const product = await Product.findById(item.product);
                if (!product) continue;

                if (product.governmentPrice !== undefined && product.governmentPrice !== null && Number(product.governmentPrice) > 0) {
                    const enteredQuantity = item.quantity;
                    const sellingUnit = item.unit || product.unit;
                    const baseUnit = product.unit;

                    const multiplier = getConversionMultiplier(sellingUnit, baseUnit);
                    if (multiplier === undefined) continue;

                    const convertedQuantityInBaseUnit = enteredQuantity * multiplier;
                    const govPricePerBaseUnit = Number(product.governmentPrice);
                    const rawLineBase = parseFloat((convertedQuantityInBaseUnit * govPricePerBaseUnit).toFixed(2));

                    let isGstApplicable = false;
                    if (product.isGstApplicable !== undefined) {
                        isGstApplicable = Boolean(product.isGstApplicable);
                    } else {
                        isGstApplicable = (product.gstRate || product.gst || 0) > 0;
                    }

                    let gstRate = 0;
                    if (product.gstRate !== undefined) {
                        gstRate = Number(product.gstRate) || 0;
                    } else {
                        gstRate = Number(product.gst || 0);
                    }
                    if (!isGstApplicable) gstRate = 0;

                    const gstPricingMode = product.gstPricingMode || 'inclusive';

                    let itemTaxable = 0;
                    let itemGst = 0;
                    let itemCgst = 0;
                    let itemSgst = 0;
                    let itemLineTotal = 0;

                    if (isGstApplicable && gstRate > 0) {
                        if (gstPricingMode === 'exclusive') {
                            itemTaxable = rawLineBase;
                            itemGst = parseFloat((itemTaxable * (gstRate / 100)).toFixed(2));
                            itemCgst = parseFloat((itemGst / 2).toFixed(2));
                            itemSgst = parseFloat((itemGst - itemCgst).toFixed(2));
                            itemLineTotal = parseFloat((itemTaxable + itemGst).toFixed(2));
                        } else {
                            itemTaxable = parseFloat((rawLineBase / (1 + (gstRate / 100))).toFixed(2));
                            itemGst = parseFloat((rawLineBase - itemTaxable).toFixed(2));
                            itemCgst = parseFloat((itemGst / 2).toFixed(2));
                            itemSgst = parseFloat((itemGst - itemCgst).toFixed(2));
                            itemLineTotal = rawLineBase;
                        }
                    } else {
                        itemTaxable = rawLineBase;
                        itemGst = 0;
                        itemCgst = 0;
                        itemSgst = 0;
                        itemLineTotal = rawLineBase;
                    }

                    totalGovTaxableAmount += itemTaxable;
                    totalGovGstAmount += itemGst;
                    totalGovCgst += itemCgst;
                    totalGovSgst += itemSgst;
                    totalGovernmentAmount += itemLineTotal;

                    govItems.push({
                        product: product._id,
                        productName: product.name,
                        soldQtyEntered: enteredQuantity,
                        soldUnit: sellingUnit,
                        soldQtyBaseUnit: convertedQuantityInBaseUnit,
                        pricePerBaseUnit: govPricePerBaseUnit,
                        governmentPrice: govPricePerBaseUnit,
                        totalPrice: itemLineTotal,
                        returnedQty: 0,
                        remainingQty: enteredQuantity,
                        isGstApplicable,
                        gstRate,
                        gstPricingMode,
                        taxableValue: itemTaxable,
                        gstAmount: itemGst,
                        cgst: itemCgst,
                        sgst: itemSgst,
                        igst: 0,
                        lineTotal: itemLineTotal
                    });
                }
            }

            if (govItems.length > 0) {
                let govInvoiceNumber = `GOV-${Math.floor(100000 + Math.random() * 900000)}`;
                if (shopRecord) {
                    const prefix = (shopRecord.invoicePrefix || 'LK') + 'G'; // 'LKG' for Gov
                    const counter = shopRecord.govInvoiceCounter || 1000;
                    govInvoiceNumber = `${prefix}-${counter}`;
                    shopRecord.govInvoiceCounter = counter + 1;
                    await shopRecord.save();
                }

                const subtotalCalculated = parseFloat(govItems.reduce((s, it) => s + (it.soldQtyEntered * it.governmentPrice), 0).toFixed(2));
                totalGovTaxableAmount = parseFloat(totalGovTaxableAmount.toFixed(2));
                totalGovGstAmount = parseFloat(totalGovGstAmount.toFixed(2));
                totalGovCgst = parseFloat(totalGovCgst.toFixed(2));
                totalGovSgst = parseFloat(totalGovSgst.toFixed(2));
                totalGovernmentAmount = parseFloat(totalGovernmentAmount.toFixed(2));

                let govPaidAmount = totalGovernmentAmount;
                let govRemainingAmount = 0;
                let govPaymentStatus = 'Paid';

                if (paymentMethod === 'Khata') {
                    const paid = Number(paidAmount) || 0;
                    govPaidAmount = Math.min(totalGovernmentAmount, paid);
                    govRemainingAmount = parseFloat(Math.max(0, totalGovernmentAmount - govPaidAmount).toFixed(2));
                    govPaymentStatus = req.body.paymentStatus || (govRemainingAmount === 0 ? 'Paid' : (govPaidAmount > 0 ? 'Partial' : 'Unpaid'));
                }

                await GovernmentSale.create({
                    shop,
                    linkedSaleId: sale._id,
                    invoiceNumber: govInvoiceNumber,
                    customerName: customerName || 'Walk-in Customer',
                    customerMobile: customerMobile || '',
                    items: govItems,
                    subtotal: subtotalCalculated,
                    taxableAmount: totalGovTaxableAmount,
                    totalGst: totalGovGstAmount,
                    cgstTotal: totalGovCgst,
                    sgstTotal: totalGovSgst,
                    igstTotal: 0,
                    isGstInvoice: totalGovGstAmount > 0,
                    totalAmount: totalGovernmentAmount,
                    paymentMethod,
                    paidAmount: govPaidAmount,
                    remainingAmount: govRemainingAmount,
                    paymentStatus: govPaymentStatus,
                    date: date || new Date(),
                    owner: ownerId,
                    isInspectionCopy: true
                });
            }
        }
        // --- END AUTO-GENERATE GOVERNMENT RECORD ---

        res.status(201).json({ success: true, data: sale });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};

// @desc    Get dashboard stats
// @route   GET /api/sales/stats
// @access  Private
exports.getStats = async (req, res) => {
    try {
        const ownerId = req.user._id;
        const { shop: shopId } = req.query;
        let match = {};

        if (shopId) {
            match.shop = new mongoose.Types.ObjectId(shopId);
        } else {
            match.owner = new mongoose.Types.ObjectId(ownerId);
        }

        // Today's range
        const now = new Date();
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
        
        const todayMatch = { ...match, date: { $gte: startOfToday, $lte: endOfToday } };

        // Query sales, returns, exchanges, and unlinked government sales for today
        const [salesToday, returnsToday, exchangesToday, govSalesToday] = await Promise.all([
            Sale.aggregate([
                { $match: todayMatch },
                { $group: { _id: null, total: { $sum: '$totalAmount' }, profit: { $sum: '$totalProfit' } } }
            ]),
            ReturnRecord.aggregate([
                { $match: todayMatch },
                { $group: { _id: null, total: { $sum: '$totalRefundAmount' }, profit: { $sum: '$totalProfit' } } }
            ]),
            ExchangeRecord.aggregate([
                { $match: todayMatch },
                { $group: { _id: null, total: { $sum: '$balanceDifference' }, profit: { $sum: '$totalProfit' } } }
            ]),
            GovernmentSale.aggregate([
                { $match: { ...todayMatch, linkedSaleId: null } },
                { $group: { _id: null, total: { $sum: '$totalAmount' } } }
            ])
        ]);

        const netSalesToday = (salesToday[0]?.total || 0) - (returnsToday[0]?.total || 0) + (exchangesToday[0]?.total || 0) + (govSalesToday[0]?.total || 0);
        const netProfitToday = (salesToday[0]?.profit || 0) + (returnsToday[0]?.profit || 0) + (exchangesToday[0]?.profit || 0);
        const totalSaleOrders = await Sale.countDocuments(todayMatch);
        const totalGovOrders = await GovernmentSale.countDocuments({ ...todayMatch, linkedSaleId: null });
        const totalOrders = totalSaleOrders + totalGovOrders;

        // Payment Breakdown for Today (adjusting for returns, exchanges, and government sales)
        const [salesPaymentBreakdown, returnsPaymentBreakdown, exchangesPaymentBreakdown, govPaymentBreakdown] = await Promise.all([
            Sale.aggregate([
                { $match: todayMatch },
                { $group: { _id: '$paymentMethod', amount: { $sum: '$totalAmount' } } }
            ]),
            ReturnRecord.aggregate([
                { $match: todayMatch },
                { $group: { _id: '$refundMethod', amount: { $sum: '$totalRefundAmount' } } }
            ]),
            ExchangeRecord.aggregate([
                { $match: todayMatch },
                { $group: { _id: '$paymentMethod', amount: { $sum: '$balanceDifference' } } }
            ]),
            GovernmentSale.aggregate([
                { $match: { ...todayMatch, linkedSaleId: null } },
                { $group: { _id: '$paymentMethod', amount: { $sum: '$totalAmount' } } }
            ])
        ]);

        const breakdown = {
            Cash: 0,
            UPI: 0,
            Khata: 0,
            Total: 0
        };

        salesPaymentBreakdown.forEach(item => {
            if (breakdown.hasOwnProperty(item._id)) {
                breakdown[item._id] += item.amount;
            }
        });
        returnsPaymentBreakdown.forEach(item => {
            if (breakdown.hasOwnProperty(item._id)) {
                breakdown[item._id] -= item.amount; // Refund reduces the payment channel total
            }
        });
        exchangesPaymentBreakdown.forEach(item => {
            if (breakdown.hasOwnProperty(item._id)) {
                breakdown[item._id] += item.amount; // Exchange difference increases/decreases total
            }
        });
        govPaymentBreakdown.forEach(item => {
            if (breakdown.hasOwnProperty(item._id)) {
                breakdown[item._id] += item.amount;
            }
        });

        breakdown.Total = breakdown.Cash + breakdown.UPI + breakdown.Khata;

        // Pending Metrics
        const supplierDues = await Purchase.aggregate([
            { $match: match },
            { $group: { _id: null, total: { $sum: '$dueAmount' } } }
        ]);

        const customerCredits = await Khata.aggregate([
            { $match: match },
            { $group: { _id: null, total: { $sum: '$outstandingDue' } } }
        ]);

        // Combined Recent Activity (Sales, Returns, Exchanges)
        const [recentSalesList, recentReturnsList, recentExchangesList] = await Promise.all([
            Sale.find(match).sort('-date').limit(10).select('totalAmount date paymentMethod customerName items').lean(),
            ReturnRecord.find(match).sort('-date').limit(10).lean(),
            ExchangeRecord.find(match).sort('-date').limit(10).lean()
        ]);

        recentSalesList.forEach(s => s.type = 'SALE');
        recentReturnsList.forEach(r => {
            r.type = 'RETURN';
            r.totalAmount = -r.totalRefundAmount;
            r.paymentMethod = r.refundMethod;
        });
        recentExchangesList.forEach(e => {
            e.type = 'EXCHANGE';
            e.totalAmount = e.balanceDifference;
        });

        const recentSales = [...recentSalesList, ...recentReturnsList, ...recentExchangesList]
            .sort((a, b) => new Date(b.date) - new Date(a.date))
            .slice(0, 10);

        // Low Stock Count
        const lowStockCount = await Product.countDocuments({ 
            ...match, 
            $expr: { $lte: ["$quantity", { $ifNull: ["$lowStockLimit", 5] }] } 
        });

        // Total Items and Stock Value
        const inventoryStats = await Product.aggregate([
            { $match: match },
            { 
                $group: { 
                    _id: null, 
                    totalItems: { $sum: 1 },
                    totalStockValue: { 
                        $sum: { 
                            $multiply: [
                                { $ifNull: ['$quantity', 0] }, 
                                { $ifNull: ['$buyPrice', 0] }
                            ] 
                        } 
                    }
                } 
            }
        ]);

        // Expiry alerts calculation for pendingMetrics
        const candidateExpiryProducts = await Product.find({
            ...match,
            $or: [
                { expiryDate: { $exists: true, $ne: null } },
                { 'batches.0': { $exists: true } }
            ]
        }).select('name category brand sku barcode quantity unit expiryDate batchNumber batches shop');

        const expiryResult = processExpiryAlerts(candidateExpiryProducts, {
            maxDays: 45,
            baseDate: new Date(),
            shopId: shopId || null
        });

        res.status(200).json({
            success: true,
            data: {
                totalSales: netSalesToday,
                totalProfit: netProfitToday,
                totalOrders,
                totalItems: inventoryStats[0]?.totalItems || 0,
                totalStockValue: inventoryStats[0]?.totalStockValue || 0,
                paymentBreakdown: breakdown,
                pendingMetrics: {
                    supplierDues: supplierDues[0]?.total || 0,
                    customerCredits: customerCredits[0]?.total || 0,
                    lowStockCount,
                    expiryAlerts: expiryResult.summary
                },
                expiryAlerts: expiryResult.summary,
                recentSales,
                lowStockCount
            }
        });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};

// @desc    Get detailed reports
// @route   GET /api/sales/reports
// @access  Private
exports.getReports = async (req, res) => {
    try {
        const ownerId = req.user._id;
        const { shop: shopId } = req.query;
        let match = { owner: ownerId };

        if (shopId) {
            match.shop = new mongoose.Types.ObjectId(shopId);
        }

        const salesByShopData = await Sale.aggregate([
            { $match: match },
            { $group: { _id: '$shop', sales: { $sum: '$totalAmount' }, profit: { $sum: '$totalProfit' } } }
        ]);
        const returnsByShopData = await ReturnRecord.aggregate([
            { $match: match },
            { $group: { _id: '$shop', refunds: { $sum: '$totalRefundAmount' }, profit: { $sum: '$totalProfit' } } }
        ]);
        const exchangesByShopData = await ExchangeRecord.aggregate([
            { $match: match },
            { $group: { _id: '$shop', diff: { $sum: '$balanceDifference' }, profit: { $sum: '$totalProfit' } } }
        ]);

        const shopMap = {};
        salesByShopData.forEach(item => {
            if (item._id) {
                const id = item._id.toString();
                shopMap[id] = { totalSales: item.sales, totalProfit: item.profit };
            }
        });
        returnsByShopData.forEach(item => {
            if (item._id) {
                const id = item._id.toString();
                if (!shopMap[id]) shopMap[id] = { totalSales: 0, totalProfit: 0 };
                shopMap[id].totalSales -= item.refunds;
                shopMap[id].totalProfit += item.profit;
            }
        });
        exchangesByShopData.forEach(item => {
            if (item._id) {
                const id = item._id.toString();
                if (!shopMap[id]) shopMap[id] = { totalSales: 0, totalProfit: 0 };
                shopMap[id].totalSales += item.diff;
                shopMap[id].totalProfit += item.profit;
            }
        });

        const Shop = require('../models/Shop');
        const salesByShop = [];
        for (const [id, value] of Object.entries(shopMap)) {
            const shopDetails = await Shop.findById(id).select('name');
            if (shopDetails) {
                salesByShop.push({
                    _id: id,
                    shopName: shopDetails.name,
                    totalSales: value.totalSales,
                    totalProfit: value.totalProfit
                });
            }
        }

        // Best Selling Products (Requires unwinding items, adjusted for returns and exchanges)
        const [bestSellingSales, returnsItems, exchangesReturned, exchangesReplaced] = await Promise.all([
            Sale.aggregate([
                { $match: match },
                {
                    $project: {
                        items: {
                            $cond: {
                                if: { $isArray: "$items" },
                                then: "$items",
                                else: [{
                                    product: "$product",
                                    productName: "$productName",
                                    soldQtyBaseUnit: "$quantity",
                                    totalPrice: "$salesAmount"
                                }]
                            }
                        }
                    }
                },
                { $unwind: '$items' },
                {
                    $group: {
                        _id: '$items.product',
                        productName: { $first: '$items.productName' },
                        totalSold: { $sum: { $ifNull: ['$items.soldQtyBaseUnit', '$items.quantity'] } },
                        totalSales: { $sum: { $ifNull: ['$items.totalPrice', { $multiply: ['$items.price', '$items.quantity'] }] } }
                    }
                }
            ]),
            ReturnRecord.aggregate([
                { $match: match },
                { $unwind: '$items' },
                {
                    $group: {
                        _id: '$items.product',
                        productName: { $first: '$items.productName' },
                        totalReturned: { $sum: '$items.quantity' },
                        totalRefund: { $sum: '$items.totalPrice' }
                    }
                }
            ]),
            ExchangeRecord.aggregate([
                { $match: match },
                { $unwind: '$returnedItems' },
                {
                    $group: {
                        _id: '$returnedItems.product',
                        productName: { $first: '$returnedItems.productName' },
                        totalReturned: { $sum: '$returnedItems.quantity' },
                        totalRefund: { $sum: '$returnedItems.totalPrice' }
                    }
                }
            ]),
            ExchangeRecord.aggregate([
                { $match: match },
                { $unwind: '$replacementItems' },
                {
                    $group: {
                        _id: '$replacementItems.product',
                        productName: { $first: '$replacementItems.productName' },
                        totalReplaced: { $sum: '$replacementItems.quantity' },
                        totalReplacedSales: { $sum: '$replacementItems.totalPrice' }
                    }
                }
            ])
        ]);

        const productMap = {};

        bestSellingSales.forEach(item => {
            if (item._id) {
                const prodId = item._id.toString();
                productMap[prodId] = {
                    _id: item._id,
                    productName: item.productName || 'Unknown Product',
                    totalSold: item.totalSold || 0,
                    totalSales: item.totalSales || 0
                };
            }
        });

        const mergeReturns = (returnsList) => {
            returnsList.forEach(item => {
                if (item._id) {
                    const prodId = item._id.toString();
                    if (!productMap[prodId]) {
                        productMap[prodId] = {
                            _id: item._id,
                            productName: item.productName || 'Unknown Product',
                            totalSold: 0,
                            totalSales: 0
                        };
                    }
                    productMap[prodId].totalSold -= (item.totalReturned || 0);
                    productMap[prodId].totalSales -= (item.totalRefund || 0);
                }
            });
        };

        const mergeReplacements = (replacementsList) => {
            replacementsList.forEach(item => {
                if (item._id) {
                    const prodId = item._id.toString();
                    if (!productMap[prodId]) {
                        productMap[prodId] = {
                            _id: item._id,
                            productName: item.productName || 'Unknown Product',
                            totalSold: 0,
                            totalSales: 0
                        };
                    }
                    productMap[prodId].totalSold += (item.totalReplaced || 0);
                    productMap[prodId].totalSales += (item.totalReplacedSales || 0);
                }
            });
        };

        mergeReturns(returnsItems);
        mergeReturns(exchangesReturned);
        mergeReplacements(exchangesReplaced);

        const bestSelling = Object.values(productMap)
            .sort((a, b) => b.totalSold - a.totalSold)
            .slice(0, 5);

        const sixMonthsAgo = new Date();
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

        const [salesMonthly, returnsMonthly, exchangesMonthly] = await Promise.all([
            Sale.aggregate([
                { $match: { ...match, date: { $gte: sixMonthsAgo } } },
                { $group: { _id: { month: { $month: '$date' }, year: { $year: '$date' } }, sales: { $sum: '$totalAmount' }, profit: { $sum: '$totalProfit' } } }
            ]),
            ReturnRecord.aggregate([
                { $match: { ...match, date: { $gte: sixMonthsAgo } } },
                { $group: { _id: { month: { $month: '$date' }, year: { $year: '$date' } }, refunds: { $sum: '$totalRefundAmount' }, profit: { $sum: '$totalProfit' } } }
            ]),
            ExchangeRecord.aggregate([
                { $match: { ...match, date: { $gte: sixMonthsAgo } } },
                { $group: { _id: { month: { $month: '$date' }, year: { $year: '$date' } }, diff: { $sum: '$balanceDifference' }, profit: { $sum: '$totalProfit' } } }
            ])
        ]);

        const monthlyMap = {};
        salesMonthly.forEach(item => {
            const key = `${item._id.year}-${item._id.month}`;
            monthlyMap[key] = { year: item._id.year, month: item._id.month, sales: item.sales, profit: item.profit };
        });
        returnsMonthly.forEach(item => {
            const key = `${item._id.year}-${item._id.month}`;
            if (!monthlyMap[key]) monthlyMap[key] = { year: item._id.year, month: item._id.month, sales: 0, profit: 0 };
            monthlyMap[key].sales -= item.refunds;
            monthlyMap[key].profit += item.profit;
        });
        exchangesMonthly.forEach(item => {
            const key = `${item._id.year}-${item._id.month}`;
            if (!monthlyMap[key]) monthlyMap[key] = { year: item._id.year, month: item._id.month, sales: 0, profit: 0 };
            monthlyMap[key].sales += item.diff;
            monthlyMap[key].profit += item.profit;
        });

        const profitSummary = Object.values(monthlyMap)
            .sort((a, b) => a.year !== b.year ? a.year - b.year : a.month - b.month)
            .map(item => ({
                _id: { month: item.month, year: item.year },
                sales: item.sales,
                profit: item.profit
            }));

        // Fetch Returns / Exchanges Statistics
        const [returnsStats, exchangesStats] = await Promise.all([
            ReturnRecord.aggregate([
                { $match: match },
                { $group: { _id: null, totalRefunds: { $sum: '$totalRefundAmount' } } }
            ]),
            ExchangeRecord.aggregate([
                { $match: match },
                { $group: { _id: null, totalReplacementValue: { $sum: '$totalReplacementValue' } } }
            ])
        ]);

        const totalReturns = returnsStats[0]?.totalRefunds || 0;
        const returnLosses = totalReturns;
        const exchangeValue = exchangesStats[0]?.totalReplacementValue || 0;

        res.status(200).json({
            success: true,
            data: {
                salesByShop,
                bestSelling,
                profitSummary,
                totalReturns,
                exchangeValue,
                returnLosses
            }
        });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};

// @desc    Get sales history for charts
// @route   GET /api/sales/history
// @access  Private
exports.getSalesHistory = async (req, res) => {
    try {
        const { range, shop: shopId } = req.query;
        const ownerId = req.user._id;
        let startDate = new Date();
        let groupBy = {};

        switch (range) {
            case 'daily':
                startDate.setHours(0, 0, 0, 0);
                groupBy = { hour: { $hour: '$date' } };
                break;
            case 'weekly':
                startDate.setDate(startDate.getDate() - 7);
                groupBy = { day: { $dayOfWeek: '$date' } };
                break;
            case 'monthly':
                startDate.setMonth(startDate.getMonth() - 1);
                groupBy = { day: { $dayOfMonth: '$date' } };
                break;
            case '3months':
                startDate.setMonth(startDate.getMonth() - 3);
                groupBy = { month: { $month: '$date' }, year: { $year: '$date' } };
                break;
            case '6months':
                startDate.setMonth(startDate.getMonth() - 6);
                groupBy = { month: { $month: '$date' }, year: { $year: '$date' } };
                break;
            case '1year':
                startDate.setFullYear(startDate.getFullYear() - 1);
                groupBy = { month: { $month: '$date' }, year: { $year: '$date' } };
                break;
            default:
                startDate.setMonth(startDate.getMonth() - 1);
                groupBy = { day: { $dayOfMonth: '$date' } };
        }

        let match = { owner: ownerId, date: { $gte: startDate } };
        if (shopId) {
            match.shop = new mongoose.Types.ObjectId(shopId);
        }

        const [salesHistory, returnsHistory, exchangesHistory] = await Promise.all([
            Sale.aggregate([
                { $match: match },
                {
                    $group: {
                        _id: groupBy,
                        totalSales: { $sum: { $ifNull: ['$totalAmount', '$salesAmount'] } },
                        totalProfit: { $sum: { $ifNull: ['$totalProfit', '$profit'] } },
                        count: { $sum: 1 }
                    }
                }
            ]),
            ReturnRecord.aggregate([
                { $match: match },
                {
                    $group: {
                        _id: groupBy,
                        totalRefunds: { $sum: '$totalRefundAmount' },
                        totalProfitImpact: { $sum: { $ifNull: ['$totalProfit', 0] } }
                    }
                }
            ]),
            ExchangeRecord.aggregate([
                { $match: match },
                {
                    $group: {
                        _id: groupBy,
                        balanceDiff: { $sum: '$balanceDifference' },
                        totalProfitImpact: { $sum: { $ifNull: ['$totalProfit', 0] } }
                    }
                }
            ])
        ]);

        const getKey = (id) => {
            if (!id) return '';
            if (id.hour !== undefined) return `h-${id.hour}`;
            if (id.day !== undefined && id.month !== undefined && id.year !== undefined) return `d-${id.year}-${id.month}-${id.day}`;
            if (id.day !== undefined) return `d-${id.day}`;
            if (id.month !== undefined && id.year !== undefined) return `m-${id.year}-${id.month}`;
            if (id.month !== undefined) return `m-${id.month}`;
            return '';
        };

        const historyMap = {};

        salesHistory.forEach(item => {
            const key = getKey(item._id);
            historyMap[key] = {
                _id: item._id,
                totalSales: item.totalSales,
                totalProfit: item.totalProfit,
                count: item.count
            };
        });

        returnsHistory.forEach(item => {
            const key = getKey(item._id);
            if (!historyMap[key]) {
                historyMap[key] = {
                    _id: item._id,
                    totalSales: 0,
                    totalProfit: 0,
                    count: 0
                };
            }
            historyMap[key].totalSales -= item.totalRefunds;
            historyMap[key].totalProfit += item.totalProfitImpact;
        });

        exchangesHistory.forEach(item => {
            const key = getKey(item._id);
            if (!historyMap[key]) {
                historyMap[key] = {
                    _id: item._id,
                    totalSales: 0,
                    totalProfit: 0,
                    count: 0
                };
            }
            historyMap[key].totalSales += item.balanceDiff;
            historyMap[key].totalProfit += item.totalProfitImpact;
        });

        const history = Object.values(historyMap).sort((a, b) => {
            const yA = a._id.year || 0;
            const yB = b._id.year || 0;
            if (yA !== yB) return yA - yB;

            const mA = a._id.month || 0;
            const mB = b._id.month || 0;
            if (mA !== mB) return mA - mB;

            const dA = a._id.day || 0;
            const dB = b._id.day || 0;
            if (dA !== dB) return dA - dB;

            const hA = a._id.hour || 0;
            const hB = b._id.hour || 0;
            return hA - hB;
        });

        res.status(200).json({ success: true, data: history });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};

// @desc    Get summarized daily/weekly reports
// @route   GET /api/sales/summaries
// @access  Private
exports.getAggregatedSummaries = async (req, res) => {
    try {
        const ownerId = req.user._id;
        const { shop: shopId } = req.query;
        
        const now = new Date();
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
        
        const startOfYesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
        const endOfYesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 23, 59, 59);
        
        const startOfWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        const startOfMonth = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

        let match = { owner: ownerId };
        if (shopId) {
            match.shop = new mongoose.Types.ObjectId(shopId);
        }

        const runAggregation = async (start, end) => {
            const query = { ...match, date: { $gte: start } };
            if (end) query.date.$lte = end;

            const [salesAgg, returnsAgg, exchangesAgg] = await Promise.all([
                Sale.aggregate([
                    { $match: query },
                    {
                        $group: {
                            _id: null,
                            totalSales: { $sum: { $ifNull: ['$totalAmount', '$salesAmount'] } },
                            totalProfit: { $sum: { $ifNull: ['$totalProfit', '$profit'] } },
                            orders: { $sum: 1 }
                        }
                    }
                ]),
                ReturnRecord.aggregate([
                    { $match: query },
                    {
                        $group: {
                            _id: null,
                            totalRefunds: { $sum: '$totalRefundAmount' },
                            totalProfitImpact: { $sum: { $ifNull: ['$totalProfit', 0] } }
                        }
                    }
                ]),
                ExchangeRecord.aggregate([
                    { $match: query },
                    {
                        $group: {
                            _id: null,
                            balanceDiff: { $sum: '$balanceDifference' },
                            totalProfitImpact: { $sum: { $ifNull: ['$totalProfit', 0] } }
                        }
                    }
                ])
            ]);

            const sales = salesAgg[0] || { totalSales: 0, totalProfit: 0, orders: 0 };
            const returns = returnsAgg[0] || { totalRefunds: 0, totalProfitImpact: 0 };
            const exchanges = exchangesAgg[0] || { balanceDiff: 0, totalProfitImpact: 0 };

            return {
                totalSales: parseFloat((sales.totalSales - returns.totalRefunds + exchanges.balanceDiff).toFixed(2)),
                totalProfit: parseFloat((sales.totalProfit + returns.totalProfitImpact + exchanges.totalProfitImpact).toFixed(2)),
                orders: sales.orders
            };
        };

        const [today, yesterday, weekly, monthly] = await Promise.all([
            runAggregation(startOfToday, endOfToday),
            runAggregation(startOfYesterday, endOfYesterday),
            runAggregation(startOfWeek),
            runAggregation(startOfMonth)
        ]);

        res.status(200).json({
            success: true,
            data: { today, yesterday, weekly, monthly }
        });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};

// @desc    Get single sale
// @route   GET /api/sales/:id
// @access  Private
exports.getSaleById = async (req, res) => {
    try {
        const { id } = req.params;
        
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ success: false, message: 'Invalid sale ID format' });
        }

        // Try Sale first
        let transaction = await Sale.findById(id)
            .populate('shop', 'name location contactNumber email gstNumber upiId footerMessage address')
            .lean();
            
        if (transaction) {
            transaction.type = 'SALE';

            // Calculate already returned quantities
            const prevReturns = await ReturnRecord.find({ originalSale: id }).lean();
            const prevExchanges = await ExchangeRecord.find({ originalSale: id }).lean();

            const returnedQtyMap = {};
            let totalRefundAmount = 0;
            let totalReturnsProfitImpact = 0;

            prevReturns.forEach(ret => {
                totalRefundAmount += ret.totalRefundAmount;
                totalReturnsProfitImpact += (ret.totalProfit || 0);
                ret.items.forEach(item => {
                    const prodId = item.product ? item.product.toString() : '';
                    if (prodId) {
                        returnedQtyMap[prodId] = (returnedQtyMap[prodId] || 0) + item.quantity;
                    }
                });
            });

            let totalExchangeReturnedValue = 0;
            let totalExchangeProfitImpact = 0;
            let totalExchangesDiff = 0;

            prevExchanges.forEach(exc => {
                totalExchangeReturnedValue += exc.totalReturnedValue;
                totalExchangeProfitImpact += (exc.totalProfit || 0);
                totalExchangesDiff += exc.balanceDifference;
                exc.returnedItems.forEach(item => {
                    const prodId = item.product ? item.product.toString() : '';
                    if (prodId) {
                        returnedQtyMap[prodId] = (returnedQtyMap[prodId] || 0) + item.quantity;
                    }
                });
            });

            // Populate returnedQty and remainingQty per item
            transaction.items = (transaction.items || []).map(item => {
                const prodId = item.product ? item.product.toString() : '';
                const returnedBase = returnedQtyMap[prodId] || 0;
                const multiplier = item.multiplier || 1;
                const returnedQty = parseFloat((returnedBase / multiplier).toFixed(3));
                const enteredQty = item.soldQtyEntered !== undefined && item.soldQtyEntered !== null && !isNaN(item.soldQtyEntered)
                    ? Number(item.soldQtyEntered)
                    : Number(item.quantity || 0);
                const safeReturnedQty = isNaN(returnedQty) ? 0 : returnedQty;
                const remainingQty = parseFloat((enteredQty - safeReturnedQty).toFixed(3));

                return {
                    ...item,
                    soldQtyEntered: enteredQty,
                    returnedQty: safeReturnedQty,
                    exchangedQty: 0,
                    remainingQty: isNaN(remainingQty) ? enteredQty : Math.max(0, remainingQty)
                };
            });

            // Dynamic financial summary
            const originalSaleAmount = transaction.totalAmount || 0;
            const originalProfit = transaction.totalProfit || 0;
            const returnedAmount = totalRefundAmount + totalExchangeReturnedValue;
            const netSaleAmount = originalSaleAmount - totalRefundAmount + totalExchangesDiff;
            const netProfitAmount = originalProfit + totalReturnsProfitImpact + totalExchangeProfitImpact;

            transaction.financialSummary = {
                originalSaleAmount: parseFloat(originalSaleAmount.toFixed(2)),
                returnedAmount: parseFloat(returnedAmount.toFixed(2)),
                netSaleAmount: parseFloat(Math.max(0, netSaleAmount).toFixed(2)),
                netProfitAmount: parseFloat(netProfitAmount.toFixed(2))
            };

            return res.status(200).json({ success: true, data: transaction });
        }

        // Try ReturnRecord next
        transaction = await ReturnRecord.findById(id)
            .populate('shop', 'name location contactNumber email gstNumber upiId footerMessage address')
            .lean();
            
        if (transaction) {
            transaction.type = 'RETURN';
            transaction.totalAmount = -transaction.totalRefundAmount;
            transaction.paymentMethod = transaction.refundMethod;

            // Fetch original sale details
            const origSale = await Sale.findById(transaction.originalSale).lean();
            if (origSale) {
                transaction.originalSaleInvoice = origSale.invoiceNumber;
                
                // Fetch returns and exchanges up to this return date to show what was remaining at this point
                const prevReturns = await ReturnRecord.find({ 
                    originalSale: transaction.originalSale,
                    date: { $lte: transaction.date }
                }).lean();
                const prevExchanges = await ExchangeRecord.find({ 
                    originalSale: transaction.originalSale,
                    date: { $lte: transaction.date }
                }).lean();

                const returnedQtyMap = {};
                prevReturns.forEach(ret => {
                    ret.items.forEach(item => {
                        const prodId = item.product ? item.product.toString() : '';
                        if (prodId) {
                            returnedQtyMap[prodId] = (returnedQtyMap[prodId] || 0) + item.quantity;
                        }
                    });
                });
                prevExchanges.forEach(exc => {
                    exc.returnedItems.forEach(item => {
                        const prodId = item.product ? item.product.toString() : '';
                        if (prodId) {
                            returnedQtyMap[prodId] = (returnedQtyMap[prodId] || 0) + item.quantity;
                        }
                    });
                });

                transaction.remainingActiveItems = (origSale.items || []).map(item => {
                    const prodId = item.product ? item.product.toString() : '';
                    const returnedBase = returnedQtyMap[prodId] || 0;
                    const multiplier = item.multiplier || 1;
                    const returnedQty = parseFloat((returnedBase / multiplier).toFixed(3));
                    const enteredQty = item.soldQtyEntered !== undefined && item.soldQtyEntered !== null && !isNaN(item.soldQtyEntered)
                        ? Number(item.soldQtyEntered)
                        : Number(item.quantity || 0);
                    const safeReturnedQty = isNaN(returnedQty) ? 0 : returnedQty;
                    const remainingQty = parseFloat((enteredQty - safeReturnedQty).toFixed(3));

                    return {
                        productName: item.productName,
                        quantity: isNaN(remainingQty) ? enteredQty : Math.max(0, remainingQty),
                        unit: item.soldUnit || item.unit,
                        price: item.pricePerBaseUnit || item.price,
                        totalPrice: (isNaN(remainingQty) ? enteredQty : Math.max(0, remainingQty)) * (item.pricePerBaseUnit || item.price)
                    };
                }).filter(item => item.quantity > 0);
            }

            return res.status(200).json({ success: true, data: transaction });
        }

        // Try ExchangeRecord
        transaction = await ExchangeRecord.findById(id)
            .populate('shop', 'name location contactNumber email gstNumber upiId footerMessage address')
            .lean();
            
        if (transaction) {
            transaction.type = 'EXCHANGE';
            transaction.totalAmount = transaction.balanceDifference;
            
            // Standardize items for invoice preview compatibility
            transaction.items = [
                ...(transaction.returnedItems || []).map(item => ({ 
                    ...item, 
                    soldQtyEntered: item.quantity,
                    soldUnit: item.unit,
                    totalPrice: item.totalPrice,
                    isReturnedInExchange: true 
                })),
                ...(transaction.replacementItems || []).map(item => ({
                    ...item,
                    soldQtyEntered: item.quantity,
                    soldUnit: item.unit,
                    totalPrice: item.totalPrice
                }))
            ];

            const origSale = await Sale.findById(transaction.originalSale).lean();
            if (origSale) {
                transaction.originalSaleInvoice = origSale.invoiceNumber;

                // Fetch returns and exchanges up to this exchange date
                const prevReturns = await ReturnRecord.find({ 
                    originalSale: transaction.originalSale,
                    date: { $lte: transaction.date }
                }).lean();
                const prevExchanges = await ExchangeRecord.find({ 
                    originalSale: transaction.originalSale,
                    date: { $lte: transaction.date }
                }).lean();

                const returnedQtyMap = {};
                prevReturns.forEach(ret => {
                    ret.items.forEach(item => {
                        const prodId = item.product ? item.product.toString() : '';
                        if (prodId) {
                            returnedQtyMap[prodId] = (returnedQtyMap[prodId] || 0) + item.quantity;
                        }
                    });
                });
                prevExchanges.forEach(exc => {
                    exc.returnedItems.forEach(item => {
                        const prodId = item.product ? item.product.toString() : '';
                        if (prodId) {
                            returnedQtyMap[prodId] = (returnedQtyMap[prodId] || 0) + item.quantity;
                        }
                    });
                });

                transaction.remainingActiveItems = (origSale.items || []).map(item => {
                    const prodId = item.product ? item.product.toString() : '';
                    const returnedBase = returnedQtyMap[prodId] || 0;
                    const multiplier = item.multiplier || 1;
                    const returnedQty = parseFloat((returnedBase / multiplier).toFixed(3));
                    const enteredQty = item.soldQtyEntered !== undefined && item.soldQtyEntered !== null && !isNaN(item.soldQtyEntered)
                        ? Number(item.soldQtyEntered)
                        : Number(item.quantity || 0);
                    const safeReturnedQty = isNaN(returnedQty) ? 0 : returnedQty;
                    const remainingQty = parseFloat((enteredQty - safeReturnedQty).toFixed(3));

                    return {
                        productName: item.productName,
                        quantity: isNaN(remainingQty) ? enteredQty : Math.max(0, remainingQty),
                        unit: item.soldUnit || item.unit,
                        price: item.pricePerBaseUnit || item.price,
                        totalPrice: (isNaN(remainingQty) ? enteredQty : Math.max(0, remainingQty)) * (item.pricePerBaseUnit || item.price)
                    };
                }).filter(item => item.quantity > 0);
            }

            return res.status(200).json({ success: true, data: transaction });
        }

        // Try GovernmentSale
        transaction = await GovernmentSale.findById(id)
            .populate('shop', 'name location contactNumber email gstNumber upiId footerMessage address')
            .lean();

        if (transaction) {
            transaction.type = 'GOV_SALE';
            let khataCustomerMap = null;
            if (transaction.customerMobile || transaction.customerName) {
                const khata = await Khata.findOne({
                    shop: transaction.shop?._id || transaction.shop,
                    $or: [
                        { mobile: transaction.customerMobile || '' },
                        { customerName: transaction.customerName || '' }
                    ]
                }).lean();
                if (khata) {
                    khataCustomerMap = new Map();
                    if (khata.mobile) khataCustomerMap.set(khata.mobile.trim(), khata);
                    if (khata.customerName) khataCustomerMap.set(khata.customerName.toLowerCase().trim(), khata);
                }
            }
            const payInfo = resolvePaymentInfo(transaction, khataCustomerMap);
            transaction.paidAmount = payInfo.paidAmount;
            transaction.remainingAmount = payInfo.remainingAmount;
            transaction.paymentStatus = payInfo.paymentStatus;
            return res.status(200).json({ success: true, data: transaction });
        }

        return res.status(404).json({ success: false, message: 'Sale not found' });
    } catch (error) {
        console.error('Error fetching sale details:', error);
        res.status(500).json({ success: false, message: 'Internal server error while fetching sale details' });
    }
};


// @desc    Process a sale return (Partial/Full)
// @route   POST /api/sales/:id/return
// @access  Private
exports.processReturn = async (req, res) => {
    try {
        const { returnedItems, reason, refundMethod } = req.body;
        const ownerId = req.user.id;
        const saleId = req.params.id;

        const sale = await Sale.findOne({ _id: saleId, owner: ownerId });
        if (!sale) {
            return res.status(404).json({ success: false, message: 'Sale not found.' });
        }

        if (!returnedItems || returnedItems.length === 0) {
            return res.status(400).json({ success: false, message: 'No items specified for return.' });
        }

        // Calculate already returned quantities from ReturnRecord & ExchangeRecord
        const alreadyReturned = {};
        const prevReturns = await ReturnRecord.find({ originalSale: saleId });
        const prevExchanges = await ExchangeRecord.find({ originalSale: saleId });

        prevReturns.forEach(ret => {
            ret.items.forEach(item => {
                const prodId = item.product.toString();
                alreadyReturned[prodId] = (alreadyReturned[prodId] || 0) + item.quantity;
            });
        });
        prevExchanges.forEach(exc => {
            exc.returnedItems.forEach(item => {
                const prodId = item.product.toString();
                alreadyReturned[prodId] = (alreadyReturned[prodId] || 0) + item.quantity;
            });
        });

        let totalRefundAmount = 0;
        let totalProfitImpact = 0;
        const processedItems = [];

        // For daily inventory summaries
        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date();
        endOfDay.setHours(23, 59, 59, 999);

        // Process returned items
        for (const returnReq of returnedItems) {
            const saleItem = sale.items.find(item => item.product.toString() === returnReq.product);
            if (!saleItem) {
                return res.status(400).json({ success: false, message: `Product ${returnReq.productName || returnReq.product} is not part of the original sale.` });
            }

            const product = await Product.findById(returnReq.product);
            if (!product) {
                return res.status(400).json({ success: false, message: `Product ${returnReq.productName} not found in database.` });
            }

            const originalQtyBase = saleItem.soldQtyBaseUnit;
            const alreadyRetBase = alreadyReturned[returnReq.product] || 0;
            const remainingQtyBase = originalQtyBase - alreadyRetBase;

            // Conversion from entered return quantity to base unit
            const returnQtyEntered = Number(returnReq.quantity);
            if (returnQtyEntered <= 0) continue;

            const multiplier = saleItem.multiplier || 1;
            const returnQtyBase = returnQtyEntered * multiplier;

            if (parseFloat(returnQtyBase.toFixed(3)) > parseFloat(remainingQtyBase.toFixed(3)) + 0.001) {
                return res.status(400).json({ 
                    success: false, 
                    message: `Cannot return ${returnQtyEntered} ${saleItem.soldUnit || 'units'} of ${product.name}. Max returnable remaining: ${remainingQtyBase / multiplier} ${saleItem.soldUnit || 'units'}.` 
                });
            }

            // Calculations
            const ratePerBase = saleItem.pricePerBaseUnit || saleItem.price || product.sellPrice;
            const refundValue = parseFloat((returnQtyBase * ratePerBase).toFixed(2));
            const profitPerBase = (saleItem.profit || 0) / saleItem.soldQtyBaseUnit;
            const profitImpact = parseFloat((returnQtyBase * profitPerBase).toFixed(2));

            totalRefundAmount += refundValue;
            totalProfitImpact -= profitImpact; // negative value representing profit loss

            // Update Stock
            const previousStock = product.quantity;
            product.quantity = parseFloat((product.quantity + returnQtyBase).toFixed(3));
            await product.save();

            processedItems.push({
                product: product._id,
                productName: product.name,
                quantity: returnQtyBase, // stored in base units
                unit: product.unit || 'Piece',
                price: ratePerBase,
                totalPrice: refundValue
            });

            // Log Inventory History for return
            const existingSummary = await InventoryHistory.findOne({
                productId: product._id,
                actionType: 'STOCK_RETURNED',
                owner: ownerId,
                createdAt: { $gte: startOfDay, $lte: endOfDay }
            });

            if (existingSummary) {
                existingSummary.quantity += returnQtyBase;
                existingSummary.newStock = product.quantity;
                await existingSummary.save();
            } else {
                await InventoryHistory.create({
                    productId: product._id,
                    productName: product.name,
                    actionType: 'STOCK_RETURNED',
                    quantity: returnQtyBase,
                    unit: product.unit || 'Piece',
                    previousStock: previousStock,
                    newStock: product.quantity,
                    source: 'Daily Summary',
                    referenceId: sale.invoiceNumber,
                    notes: `Returned ${returnQtyBase} ${product.unit}`,
                    shop: sale.shop,
                    owner: ownerId
                });
            }
        }

        if (processedItems.length === 0) {
            return res.status(400).json({ success: false, message: 'No items with positive quantity specified for return.' });
        }

        // Adjust Khata Ledger if refundMethod is Khata
        if (refundMethod === 'Khata' && sale.customerMobile) {
            const customerMobile = sale.customerMobile.trim();
            let khataRecord = await Khata.findOne({ shop: sale.shop, mobile: customerMobile });
            if (khataRecord) {
                khataRecord.outstandingDue = Math.max(0, parseFloat((khataRecord.outstandingDue - totalRefundAmount).toFixed(2)));
                khataRecord.transactions.push({
                    type: 'payment',
                    amount: totalRefundAmount,
                    date: new Date(),
                    note: `Returned items from Bill #${sale.invoiceNumber || sale._id.toString().slice(-6).toUpperCase()}`
                });
                await khataRecord.save();
            }
        }

        // Adjust linked GovernmentSale if items contain fertilizer
        const govSale = await GovernmentSale.findOne({ linkedSaleId: saleId });
        if (govSale) {
            let updatedGovTotal = 0;
            let updatedGovTaxable = 0;
            let updatedGovGst = 0;
            let updatedGovCgst = 0;
            let updatedGovSgst = 0;
            const updatedGovItems = [];

            for (const govItem of govSale.items) {
                const returnedObj = processedItems.find(p => p.product.toString() === govItem.product.toString());
                const itemObj = govItem.toObject();
                if (returnedObj) {
                    const multiplier = getConversionMultiplier(govItem.soldUnit, 'Piece') || 1;
                    const returnedEntered = parseFloat((returnedObj.quantity / multiplier).toFixed(3));
                    
                    itemObj.returnedQty = parseFloat(((govItem.returnedQty || 0) + returnedEntered).toFixed(3));
                    itemObj.remainingQty = Math.max(0, parseFloat((govItem.soldQtyEntered - itemObj.returnedQty).toFixed(3)));
                    
                    // Recalculate tax and total for remaining quantity
                    const rawLineBase = parseFloat((itemObj.remainingQty * multiplier * govItem.governmentPrice).toFixed(2));
                    const isTax = Boolean(itemObj.isGstApplicable && itemObj.gstRate > 0);
                    if (isTax) {
                        if (itemObj.gstPricingMode === 'exclusive') {
                            itemObj.taxableValue = rawLineBase;
                            itemObj.gstAmount = parseFloat((rawLineBase * (itemObj.gstRate / 100)).toFixed(2));
                            itemObj.cgst = parseFloat((itemObj.gstAmount / 2).toFixed(2));
                            itemObj.sgst = parseFloat((itemObj.gstAmount - itemObj.cgst).toFixed(2));
                            itemObj.lineTotal = parseFloat((itemObj.taxableValue + itemObj.gstAmount).toFixed(2));
                        } else {
                            itemObj.taxableValue = parseFloat((rawLineBase / (1 + (itemObj.gstRate / 100))).toFixed(2));
                            itemObj.gstAmount = parseFloat((rawLineBase - itemObj.taxableValue).toFixed(2));
                            itemObj.cgst = parseFloat((itemObj.gstAmount / 2).toFixed(2));
                            itemObj.sgst = parseFloat((itemObj.gstAmount - itemObj.cgst).toFixed(2));
                            itemObj.lineTotal = rawLineBase;
                        }
                    } else {
                        itemObj.taxableValue = rawLineBase;
                        itemObj.gstAmount = 0;
                        itemObj.cgst = 0;
                        itemObj.sgst = 0;
                        itemObj.lineTotal = rawLineBase;
                    }
                    itemObj.totalPrice = itemObj.lineTotal;
                } else {
                    itemObj.returnedQty = govItem.returnedQty || 0;
                    itemObj.remainingQty = govItem.remainingQty !== undefined ? govItem.remainingQty : govItem.soldQtyEntered;
                }
                updatedGovItems.push(itemObj);
                updatedGovTaxable += (itemObj.taxableValue || 0);
                updatedGovGst += (itemObj.gstAmount || 0);
                updatedGovCgst += (itemObj.cgst || 0);
                updatedGovSgst += (itemObj.sgst || 0);
                updatedGovTotal += (itemObj.totalPrice || itemObj.lineTotal || 0);
            }

            govSale.items = updatedGovItems;
            govSale.taxableAmount = parseFloat(updatedGovTaxable.toFixed(2));
            govSale.totalGst = parseFloat(updatedGovGst.toFixed(2));
            govSale.cgstTotal = parseFloat(updatedGovCgst.toFixed(2));
            govSale.sgstTotal = parseFloat(updatedGovSgst.toFixed(2));
            govSale.isGstInvoice = updatedGovGst > 0;
            govSale.totalAmount = parseFloat(updatedGovTotal.toFixed(2));
            await govSale.save();
        }

        // Create ReturnRecord
        const invoiceNumber = `RET-${Math.floor(100000 + Math.random() * 900000)}`;
        const returnRecord = await ReturnRecord.create({
            shop: sale.shop,
            originalSale: saleId,
            invoiceNumber,
            customerName: sale.customerName,
            customerMobile: sale.customerMobile,
            items: processedItems,
            totalRefundAmount,
            refundMethod,
            reason: reason || 'Customer Return',
            totalProfit: totalProfitImpact,
            date: new Date(),
            owner: ownerId
        });

        res.status(201).json({ success: true, data: returnRecord });
    } catch (error) {
        console.error('Error processing return:', error);
        res.status(400).json({ success: false, message: error.message });
    }
};

// @desc    Process a sale exchange
// @route   POST /api/sales/:id/exchange
// @access  Private
exports.processExchange = async (req, res) => {
    try {
        const { returnedItems, replacementItems, paymentMethod } = req.body;
        const ownerId = req.user.id;
        const saleId = req.params.id;

        const sale = await Sale.findOne({ _id: saleId, owner: ownerId });
        if (!sale) {
            return res.status(404).json({ success: false, message: 'Sale not found.' });
        }

        if (!returnedItems || returnedItems.length === 0) {
            return res.status(400).json({ success: false, message: 'No returned items specified for exchange.' });
        }
        if (!replacementItems || replacementItems.length === 0) {
            return res.status(400).json({ success: false, message: 'No replacement items specified for exchange.' });
        }

        // Calculate already returned quantities
        const alreadyReturned = {};
        const prevReturns = await ReturnRecord.find({ originalSale: saleId });
        const prevExchanges = await ExchangeRecord.find({ originalSale: saleId });

        prevReturns.forEach(ret => {
            ret.items.forEach(item => {
                const prodId = item.product.toString();
                alreadyReturned[prodId] = (alreadyReturned[prodId] || 0) + item.quantity;
            });
        });
        prevExchanges.forEach(exc => {
            exc.returnedItems.forEach(item => {
                const prodId = item.product.toString();
                alreadyReturned[prodId] = (alreadyReturned[prodId] || 0) + item.quantity;
            });
        });

        // Validate and process returned items
        let totalReturnedValue = 0;
        let returnedProfitValue = 0;
        const processedReturnedItems = [];

        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date();
        endOfDay.setHours(23, 59, 59, 999);

        for (const retItem of returnedItems) {
            const saleItem = sale.items.find(item => item.product.toString() === retItem.product);
            if (!saleItem) {
                return res.status(400).json({ success: false, message: `Product ${retItem.productName} is not part of the original sale.` });
            }

            const product = await Product.findById(retItem.product);
            if (!product) {
                return res.status(400).json({ success: false, message: `Product ${retItem.productName} not found.` });
            }

            const originalQtyBase = saleItem.soldQtyBaseUnit;
            const alreadyRetBase = alreadyReturned[retItem.product] || 0;
            const remainingQtyBase = originalQtyBase - alreadyRetBase;

            const returnQtyEntered = Number(retItem.quantity);
            if (returnQtyEntered <= 0) continue;

            const multiplier = saleItem.multiplier || 1;
            const returnQtyBase = returnQtyEntered * multiplier;

            if (parseFloat(returnQtyBase.toFixed(3)) > parseFloat(remainingQtyBase.toFixed(3)) + 0.001) {
                return res.status(400).json({
                    success: false,
                    message: `Cannot return ${returnQtyEntered} of ${product.name}. Max returnable: ${remainingQtyBase / multiplier}.`
                });
            }

            const ratePerBase = saleItem.pricePerBaseUnit || saleItem.price || product.sellPrice;
            const refundValue = parseFloat((returnQtyBase * ratePerBase).toFixed(2));
            const profitPerBase = (saleItem.profit || 0) / saleItem.soldQtyBaseUnit;
            const profitImpact = parseFloat((returnQtyBase * profitPerBase).toFixed(2));

            totalReturnedValue += refundValue;
            returnedProfitValue += profitImpact;

            // Update Stock
            const previousStock = product.quantity;
            product.quantity = parseFloat((product.quantity + returnQtyBase).toFixed(3));
            await product.save();

            processedReturnedItems.push({
                product: product._id,
                productName: product.name,
                quantity: returnQtyBase,
                unit: product.unit || 'Piece',
                price: ratePerBase,
                totalPrice: refundValue
            });

            // Log Inventory History (daily summary)
            const existingSummary = await InventoryHistory.findOne({
                productId: product._id,
                actionType: 'STOCK_RETURNED',
                owner: ownerId,
                createdAt: { $gte: startOfDay, $lte: endOfDay }
            });

            if (existingSummary) {
                existingSummary.quantity += returnQtyBase;
                existingSummary.newStock = product.quantity;
                await existingSummary.save();
            } else {
                await InventoryHistory.create({
                    productId: product._id,
                    productName: product.name,
                    actionType: 'STOCK_RETURNED',
                    quantity: returnQtyBase,
                    unit: product.unit || 'Piece',
                    previousStock: previousStock,
                    newStock: product.quantity,
                    source: 'Daily Summary',
                    referenceId: sale.invoiceNumber,
                    shop: sale.shop,
                    owner: ownerId
                });
            }
        }

        // Process replacement items
        let totalReplacementValue = 0;
        let replacementProfitValue = 0;
        const processedReplacementItems = [];

        for (const repItem of replacementItems) {
            const product = await Product.findById(repItem.product);
            if (!product) {
                return res.status(400).json({ success: false, message: `Replacement product ${repItem.productName} not found.` });
            }

            const enteredQty = Number(repItem.quantity);
            if (enteredQty <= 0) continue;

            const repUnit = repItem.unit || product.unit;
            const multiplier = getConversionMultiplier(repUnit, product.unit) || 1;
            const qtyBase = enteredQty * multiplier;

            if (product.quantity < qtyBase) {
                return res.status(400).json({
                    success: false,
                    message: `Insufficient stock for replacement product ${product.name}. Available: ${product.quantity} ${product.unit}.`
                });
            }

            const sellPricePerBase = product.sellPrice;
            const totalPrice = parseFloat((qtyBase * sellPricePerBase).toFixed(2));
            const buyPricePerBase = product.buyPrice || 0;
            const profit = parseFloat((totalPrice - (qtyBase * buyPricePerBase)).toFixed(2));

            totalReplacementValue += totalPrice;
            replacementProfitValue += profit;

            // Update Stock
            const previousStock = product.quantity;
            product.quantity = Math.max(0, parseFloat((product.quantity - qtyBase).toFixed(3)));
            await product.save();

            processedReplacementItems.push({
                product: product._id,
                productName: product.name,
                quantity: qtyBase,
                unit: product.unit || 'Piece',
                price: sellPricePerBase,
                totalPrice: totalPrice
            });

            // Log Inventory History (daily summary)
            const existingSummary = await InventoryHistory.findOne({
                productId: product._id,
                actionType: 'STOCK_SOLD',
                owner: ownerId,
                createdAt: { $gte: startOfDay, $lte: endOfDay }
            });

            if (existingSummary) {
                existingSummary.quantity += qtyBase;
                existingSummary.newStock = product.quantity;
                await existingSummary.save();
            } else {
                await InventoryHistory.create({
                    productId: product._id,
                    productName: product.name,
                    actionType: 'STOCK_SOLD',
                    quantity: qtyBase,
                    unit: product.unit || 'Piece',
                    previousStock: previousStock,
                    newStock: product.quantity,
                    source: 'Daily Summary',
                    referenceId: sale.invoiceNumber,
                    shop: sale.shop,
                    owner: ownerId
                });
            }
        }

        const balanceDifference = parseFloat((totalReplacementValue - totalReturnedValue).toFixed(2));
        const totalProfitImpact = parseFloat((replacementProfitValue - returnedProfitValue).toFixed(2));

        // Adjust Khata Ledger if paymentMethod is Khata
        if (paymentMethod === 'Khata' && sale.customerMobile) {
            const customerMobile = sale.customerMobile.trim();
            let khataRecord = await Khata.findOne({ shop: sale.shop, mobile: customerMobile });
            if (khataRecord) {
                khataRecord.outstandingDue = parseFloat((khataRecord.outstandingDue + balanceDifference).toFixed(2));
                khataRecord.transactions.push({
                    type: balanceDifference > 0 ? 'due' : 'payment',
                    amount: Math.abs(balanceDifference),
                    date: new Date(),
                    note: `Exchanged items in Bill #${sale.invoiceNumber || sale._id.toString().slice(-6).toUpperCase()}`
                });
                await khataRecord.save();
            }
        }

        // Adjust linked GovernmentSale if items contain fertilizer
        const govSale = await GovernmentSale.findOne({ linkedSaleId: saleId });
        if (govSale) {
            let updatedGovTotal = 0;
            const updatedGovItems = [];

            // Process existing items (handling returns)
            for (const govItem of govSale.items) {
                const returnedObj = processedReturnedItems.find(p => p.product.toString() === govItem.product.toString());
                const itemObj = govItem.toObject();
                if (returnedObj) {
                    const multiplier = getConversionMultiplier(govItem.soldUnit, 'Piece') || 1;
                    const returnedEntered = parseFloat((returnedObj.quantity / multiplier).toFixed(3));
                    
                    itemObj.returnedQty = parseFloat(((govItem.returnedQty || 0) + returnedEntered).toFixed(3));
                    itemObj.remainingQty = Math.max(0, parseFloat((govItem.soldQtyEntered - itemObj.returnedQty).toFixed(3)));
                    itemObj.totalPrice = parseFloat((itemObj.remainingQty * multiplier * govItem.governmentPrice).toFixed(2));
                } else {
                    itemObj.returnedQty = govItem.returnedQty || 0;
                    itemObj.remainingQty = govItem.remainingQty !== undefined ? govItem.remainingQty : govItem.soldQtyEntered;
                }
                updatedGovItems.push(itemObj);
                updatedGovTotal += itemObj.totalPrice;
            }

            // Add replacement items with valid government price as new entries (keeping audit trail clear)
            for (const repItem of processedReplacementItems) {
                const product = await Product.findById(repItem.product);
                if (product && product.governmentPrice !== undefined && product.governmentPrice !== null && Number(product.governmentPrice) > 0) {
                    const govPrice = Number(product.governmentPrice);
                    const itemTotal = parseFloat((repItem.quantity * govPrice).toFixed(2));

                    updatedGovItems.push({
                        product: product._id,
                        productName: product.name,
                        soldQtyEntered: repItem.quantity,
                        soldUnit: product.unit || 'Piece',
                        soldQtyBaseUnit: repItem.quantity,
                        pricePerBaseUnit: govPrice,
                        totalPrice: itemTotal,
                        governmentPrice: govPrice,
                        returnedQty: 0,
                        remainingQty: repItem.quantity
                    });
                    updatedGovTotal += itemTotal;
                }
            }

            govSale.items = updatedGovItems;
            govSale.totalAmount = parseFloat(updatedGovTotal.toFixed(2));
            await govSale.save();
        }

        // Create ExchangeRecord
        const invoiceNumber = `EXC-${Math.floor(100000 + Math.random() * 900000)}`;
        const exchangeRecord = await ExchangeRecord.create({
            shop: sale.shop,
            originalSale: saleId,
            invoiceNumber,
            customerName: sale.customerName,
            customerMobile: sale.customerMobile,
            returnedItems: processedReturnedItems,
            replacementItems: processedReplacementItems,
            totalReturnedValue,
            totalReplacementValue,
            balanceDifference,
            paymentMethod,
            totalProfit: totalProfitImpact,
            date: new Date(),
            owner: ownerId
        });

        res.status(201).json({ success: true, data: exchangeRecord });
    } catch (error) {
        console.error('Error processing exchange:', error);
        res.status(400).json({ success: false, message: error.message });
    }
};
