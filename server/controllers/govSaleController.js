const GovernmentSale = require('../models/GovernmentSale');
const Product = require('../models/Product');
const mongoose = require('mongoose');

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
        'piece-dozen': 1/12,
        'dozen-piece': 12
    };
    return table[key] || 1;
};

// @desc    Get all government sales for owner or shop
// @route   GET /api/gov-sales
// @access  Private
exports.getGovSales = async (req, res) => {
    try {
        let query = {};
        if (req.query.shop) {
            query.shop = req.query.shop;
        } else {
            query.owner = req.user.id;
        }
        const sales = await GovernmentSale.find(query)
            .populate('shop', 'name location contactNumber gstNumber email')
            .populate('items.product', 'name category isGstApplicable gstRate gstPricingMode gst governmentPrice sellPrice unit')
            .sort('-date');

        const resolvedSales = sales.map(sale => {
            const s = sale.toObject ? sale.toObject() : { ...sale };
            // If already has valid persisted tax breakdown, return as-is
            if ((s.taxableAmount !== undefined && s.taxableAmount > 0) || (s.totalGst !== undefined && s.totalGst > 0)) {
                return s;
            }

            // Safe fallback calculation from item governmentPrice and product tax config
            let calcTaxable = 0;
            let calcGst = 0;
            let calcCgst = 0;
            let calcSgst = 0;
            let calcIgst = 0;

            (s.items || []).forEach(item => {
                const qty = Number(item.soldQtyEntered || item.quantity || 0);
                const rate = Number(item.governmentPrice || item.pricePerBaseUnit || 0);
                const base = qty * rate;
                const prod = item.product || {};

                const isTax = Boolean(
                    item.isGstApplicable !== undefined ? item.isGstApplicable :
                    (prod.isGstApplicable !== undefined ? prod.isGstApplicable :
                    (Number(item.gstRate || prod.gstRate || prod.gst || 0) > 0))
                );

                const ratePct = isTax ? Number(item.gstRate || prod.gstRate || prod.gst || 0) : 0;
                const mode = item.gstPricingMode || prod.gstPricingMode || 'inclusive';

                if (isTax && ratePct > 0) {
                    if (mode === 'exclusive') {
                        const taxVal = base;
                        const gstAmt = parseFloat((taxVal * (ratePct / 100)).toFixed(2));
                        const cgst = parseFloat((gstAmt / 2).toFixed(2));
                        const sgst = parseFloat((gstAmt - cgst).toFixed(2));
                        calcTaxable += taxVal;
                        calcGst += gstAmt;
                        calcCgst += cgst;
                        calcSgst += sgst;
                    } else {
                        const taxVal = parseFloat((base / (1 + ratePct / 100)).toFixed(2));
                        const gstAmt = parseFloat((base - taxVal).toFixed(2));
                        const cgst = parseFloat((gstAmt / 2).toFixed(2));
                        const sgst = parseFloat((gstAmt - cgst).toFixed(2));
                        calcTaxable += taxVal;
                        calcGst += gstAmt;
                        calcCgst += cgst;
                        calcSgst += sgst;
                    }
                } else {
                    calcTaxable += base;
                }
            });

            s.taxableAmount = parseFloat(calcTaxable.toFixed(2));
            s.totalGst = parseFloat(calcGst.toFixed(2));
            s.cgstTotal = parseFloat(calcCgst.toFixed(2));
            s.sgstTotal = parseFloat(calcSgst.toFixed(2));
            s.igstTotal = 0;
            return s;
        });

        res.status(200).json({ success: true, data: resolvedSales });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};



// @desc    Get dashboard stats for government
// @route   GET /api/gov-sales/stats
// @access  Private
exports.getGovStats = async (req, res) => {
    try {
        const ownerId = req.user._id;
        const { shop: shopId } = req.query;
        let match = { owner: ownerId };

        if (shopId) {
            match.shop = new mongoose.Types.ObjectId(shopId);
        }

        // Today's range
        const now = new Date();
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
        
        const todayMatch = { ...match, date: { $gte: startOfToday, $lte: endOfToday } };

        const totalSales = await GovernmentSale.aggregate([
            { $match: todayMatch },
            { $group: { _id: null, total: { $sum: '$totalAmount' } } }
        ]);

        const totalOrders = await GovernmentSale.countDocuments(todayMatch);

        const recentSales = await GovernmentSale.find(match)
            .sort('-date')
            .limit(10)
            .select('totalAmount date paymentMethod customerName items invoiceNumber');

        res.status(200).json({
            success: true,
            data: {
                totalSales: totalSales[0]?.total || 0,
                totalOrders,
                recentSales
            }
        });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};

// @desc    Get single government sale
// @route   GET /api/gov-sales/:id
// @access  Private
exports.getGovSaleById = async (req, res) => {
    try {
        const { id } = req.params;
        
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ success: false, message: 'Invalid sale ID format' });
        }

        const sale = await GovernmentSale.findOne({ _id: id, owner: req.user.id })
            .populate('shop', 'name location contactNumber email gstNumber upiId footerMessage address')
            .populate('items.product', 'name category isGstApplicable gstRate gstPricingMode gst governmentPrice sellPrice unit');
            
        if (!sale) {
            return res.status(404).json({ success: false, message: 'Government Sale not found' });
        }

        res.status(200).json({ success: true, data: sale });
    } catch (error) {
        console.error('Error fetching government sale details:', error);
        res.status(500).json({ success: false, message: 'Internal server error while fetching sale details' });
    }
};

// @desc    Create new government sale and update stock
// @route   POST /api/gov-sales
// @access  Private
exports.createGovSale = async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const { 
            shop, 
            linkedSaleId, 
            customerName, 
            customerMobile, 
            customerAadhaar, 
            items, 
            totalAmount, 
            paymentMethod, 
            isInspectionCopy, 
            date 
        } = req.body;
        const ownerId = req.user.id;
        const Shop = require('../models/Shop');
        const shopRecord = await Shop.findById(shop).session(session);
        if (!shopRecord) {
            await session.abortTransaction();
            session.endSession();
            return res.status(404).json({ success: false, message: 'Shop not found.' });
        }
        if (shopRecord.type !== 'Fertilizers') {
            await session.abortTransaction();
            session.endSession();
            return res.status(400).json({ success: false, message: 'Government sales are only available for Fertilizer Shops.' });
        }
        const resolvedOwner = shopRecord.owner || ownerId;

        // Validation: Aadhaar 12-digit numeric check if provided
        if (customerAadhaar) {
            const aadhaarRegex = /^\d{12}$/;
            if (!aadhaarRegex.test(customerAadhaar.toString().trim())) {
                await session.abortTransaction();
                session.endSession();
                return res.status(400).json({ success: false, message: 'Aadhaar Card number must be exactly 12 digits.' });
            }
        }

        // Generate custom invoice number
        const invoiceCount = await GovernmentSale.countDocuments({ shop });
        const invoiceNumber = `GOV-INV-${1000 + invoiceCount}`;

        // Verify products and calculate base unit values and GST
        const preparedItems = [];
        let totalTaxableAmount = 0;
        let totalGstAmount = 0;
        let totalCgst = 0;
        let totalSgst = 0;
        let finalPayableAmount = 0;

        for (const item of items) {
            const product = await Product.findById(item.product).session(session);
            if (!product) {
                await session.abortTransaction();
                session.endSession();
                return res.status(404).json({ success: false, message: `Product ${item.productName || item.product} not found.` });
            }

            // CRITICAL: Strict Government Price validation.
            // Never fall back silently to regular selling price.
            if (product.governmentPrice === undefined || product.governmentPrice === null || Number(product.governmentPrice) <= 0) {
                await session.abortTransaction();
                session.endSession();
                return res.status(400).json({ 
                    success: false, 
                    message: `Product "${product.name}" does not have a configured Government Price. Please set a valid Government Price in Inventory before completing this government sale.` 
                });
            }

            // Use strictly the product's saved Government Price as the unit rate
            const govPrice = Number(product.governmentPrice);
            const rateCharged = govPrice;

            // Unit Conversion
            const multiplier = getConversionMultiplier(item.soldUnit || item.unit, product.unit) || 1;
            const soldQtyBaseUnit = item.soldQtyEntered * multiplier;
            const unitRate = parseFloat((govPrice * multiplier).toFixed(4));
            const baseLineAmount = parseFloat((item.soldQtyEntered * unitRate).toFixed(2));

            // Tax configuration
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
            if (!isGstApplicable) gstRate = 0;

            const gstPricingMode = item.gstPricingMode || product.gstPricingMode || 'inclusive';

            let itemTaxable = 0;
            let itemGst = 0;
            let itemCgst = 0;
            let itemSgst = 0;
            let itemLineTotal = 0;

            if (isGstApplicable && gstRate > 0) {
                if (gstPricingMode === 'exclusive') {
                    itemTaxable = baseLineAmount;
                    itemGst = parseFloat((itemTaxable * (gstRate / 100)).toFixed(2));
                    itemCgst = parseFloat((itemGst / 2).toFixed(2));
                    itemSgst = parseFloat((itemGst - itemCgst).toFixed(2));
                    itemLineTotal = parseFloat((itemTaxable + itemGst).toFixed(2));
                } else {
                    itemTaxable = parseFloat((baseLineAmount / (1 + gstRate / 100)).toFixed(2));
                    itemGst = parseFloat((baseLineAmount - itemTaxable).toFixed(2));
                    itemCgst = parseFloat((itemGst / 2).toFixed(2));
                    itemSgst = parseFloat((itemGst - itemCgst).toFixed(2));
                    itemLineTotal = baseLineAmount;
                }
            } else {
                itemTaxable = baseLineAmount;
                itemGst = 0;
                itemCgst = 0;
                itemSgst = 0;
                itemLineTotal = baseLineAmount;
            }

            totalTaxableAmount += itemTaxable;
            totalGstAmount += itemGst;
            totalCgst += itemCgst;
            totalSgst += itemSgst;
            finalPayableAmount += itemLineTotal;

            preparedItems.push({
                product: product._id,
                productName: product.name,
                soldQtyEntered: item.soldQtyEntered,
                soldUnit: item.soldUnit || item.unit || product.unit || 'Piece',
                soldQtyBaseUnit,
                pricePerBaseUnit: govPrice,
                governmentPrice: govPrice,
                totalPrice: itemLineTotal,
                returnedQty: 0,
                remainingQty: item.soldQtyEntered,
                // Tax snapshot
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

            // Deduct stock in inventory
            product.quantity = parseFloat((product.quantity - soldQtyBaseUnit).toFixed(3));
            if (product.quantity < 0) {
                product.quantity = 0; 
            }
            await product.save({ session });

            // Create InventoryHistory entry
            const InventoryHistory = mongoose.model('InventoryHistory');
            await InventoryHistory.create([{
                productId: product._id,
                productName: product.name,
                actionType: 'STOCK_SOLD',
                quantity: soldQtyBaseUnit,
                unit: product.unit || 'Piece',
                previousStock: product.quantity + soldQtyBaseUnit,
                newStock: product.quantity,
                referenceId: invoiceNumber,
                notes: `Sold via Government POS (Gov Bill #${invoiceNumber})`,
                shop,
                owner: resolvedOwner,
                createdAt: date || new Date()
            }], { session });
        }

        totalTaxableAmount = parseFloat(totalTaxableAmount.toFixed(2));
        totalGstAmount = parseFloat(totalGstAmount.toFixed(2));
        totalCgst = parseFloat(totalCgst.toFixed(2));
        totalSgst = parseFloat(totalSgst.toFixed(2));
        finalPayableAmount = parseFloat(finalPayableAmount.toFixed(2));

        // Subtotal calculated strictly from government unit rate * quantity
        const subtotalCalculated = parseFloat(preparedItems.reduce((s, it) => s + (it.soldQtyEntered * it.pricePerBaseUnit), 0).toFixed(2));

        // Payment status & Khata split
        const { paidAmount: reqPaid } = req.body;
        let paidAmount = finalPayableAmount;
        let remainingAmount = 0;
        let paymentStatus = 'Paid';

        if (paymentMethod === 'Khata') {
            const paid = Number(reqPaid) || 0;
            paidAmount = paid;
            remainingAmount = parseFloat(Math.max(0, finalPayableAmount - paid).toFixed(2));
            if (remainingAmount === 0) {
                paymentStatus = 'Paid';
            } else if (paidAmount > 0) {
                paymentStatus = 'Partial';
            } else {
                paymentStatus = 'Unpaid';
            }

            // Update customer's Khata account if due balance exists
            if (customerMobile && remainingAmount > 0) {
                const Khata = require('../models/Khata');
                let khataRecord = await Khata.findOne({ shop, mobile: customerMobile.trim() }).session(session);
                if (!khataRecord) {
                    khataRecord = new Khata({
                        shop,
                        owner: resolvedOwner,
                        customerName: customerName || 'Walk-in Customer',
                        mobile: customerMobile.trim(),
                        outstandingDue: 0,
                        transactions: []
                    });
                }
                khataRecord.outstandingDue = parseFloat((khataRecord.outstandingDue + remainingAmount).toFixed(2));
                khataRecord.transactions.push({
                    type: 'due',
                    amount: remainingAmount,
                    date: date || new Date(),
                    note: `Government Sale recorded (Bill #${invoiceNumber})`,
                    saleId: null,
                    isPOSSale: true,
                    paymentMethod: 'Khata',
                    items: preparedItems.map(it => ({
                        productName: it.productName,
                        quantity: it.soldQtyEntered,
                        unit: it.soldUnit,
                        price: it.governmentPrice
                    }))
                });
                await khataRecord.save({ session });
            }
        }

        const govSale = new GovernmentSale({
            shop,
            linkedSaleId: linkedSaleId || null,
            invoiceNumber,
            customerName: customerName || 'Walk-in Customer',
            customerMobile: customerMobile || '',
            customerAadhaar: customerAadhaar || '',
            items: preparedItems,
            subtotal: subtotalCalculated,
            taxableAmount: totalTaxableAmount,
            totalGst: totalGstAmount,
            cgstTotal: totalCgst,
            sgstTotal: totalSgst,
            igstTotal: 0,
            isGstInvoice: totalGstAmount > 0,
            totalAmount: finalPayableAmount,
            paymentMethod,
            paidAmount,
            remainingAmount,
            paymentStatus,
            isInspectionCopy: isInspectionCopy !== undefined ? isInspectionCopy : true,
            date: date || new Date(),
            owner: resolvedOwner
        });

        await govSale.save({ session });

        await session.commitTransaction();
        session.endSession();

        res.status(201).json({ success: true, data: govSale });
    } catch (error) {
        await session.abortTransaction();
        session.endSession();
        console.error('Error creating gov sale:', error);
        res.status(400).json({ success: false, message: error.message });
    }
};

// @desc    Audit historical government sales for retail price discrepancies
// @route   GET /api/gov-sales/discrepancies
// @access  Private
exports.getDiscrepancies = async (req, res) => {
    try {
        const { shop: shopId } = req.query;
        let query = {};
        if (shopId) {
            query.shop = shopId;
        } else {
            query.owner = req.user.id;
        }

        const sales = await GovernmentSale.find(query).lean();
        const affected = [];

        for (const s of sales) {
            let hasDiscrepancy = false;
            let details = [];
            let recalculatedTotal = 0;

            if (s.items && s.items.length > 0) {
                for (const it of s.items) {
                    const govPrice = Number(it.governmentPrice);
                    const appliedPrice = Number(it.pricePerBaseUnit);
                    const expectedLineTotal = parseFloat((it.soldQtyEntered * govPrice).toFixed(2));
                    
                    if (govPrice > 0 && appliedPrice > 0 && appliedPrice !== govPrice) {
                        hasDiscrepancy = true;
                        details.push({
                            productName: it.productName,
                            storedRate: appliedPrice,
                            persistedGovPrice: govPrice,
                            quantity: it.soldQtyEntered,
                            unit: it.soldUnit || 'Piece',
                            storedLineTotal: it.totalPrice,
                            expectedLineTotal,
                            difference: parseFloat((it.totalPrice - expectedLineTotal).toFixed(2))
                        });
                    }
                    recalculatedTotal += (govPrice > 0 ? expectedLineTotal : (it.totalPrice || 0));
                }
            }

            if (hasDiscrepancy) {
                recalculatedTotal = parseFloat(recalculatedTotal.toFixed(2));
                affected.push({
                    _id: s._id,
                    invoiceNumber: s.invoiceNumber,
                    date: s.date,
                    customerName: s.customerName,
                    customerMobile: s.customerMobile,
                    storedTotalAmount: s.totalAmount,
                    recalculatedTotalAmount: recalculatedTotal,
                    netDifference: parseFloat((s.totalAmount - recalculatedTotal).toFixed(2)),
                    items: details
                });
            }
        }

        res.status(200).json({
            success: true,
            count: affected.length,
            data: affected
        });
    } catch (error) {
        console.error('Error fetching government sale discrepancies:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Perform safe, authorized correction on historical government sales with audit trail
// @route   POST /api/gov-sales/correct-historical
// @access  Private
exports.correctHistorical = async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const { authorize, reason, saleIds } = req.body;
        if (!authorize) {
            return res.status(403).json({ 
                success: false, 
                message: 'Authorization required. Please confirm authorization to perform historical rate correction.' 
            });
        }

        let query = { owner: req.user.id };
        if (saleIds && Array.isArray(saleIds) && saleIds.length > 0) {
            query._id = { $in: saleIds };
        } else if (req.query.shop) {
            query.shop = req.query.shop;
        }

        const sales = await GovernmentSale.find(query).session(session);
        const corrected = [];

        for (const sale of sales) {
            let modified = false;
            let previousSnapshot = {
                totalAmount: sale.totalAmount,
                subtotal: sale.subtotal,
                items: sale.items.map(it => ({
                    productName: it.productName,
                    pricePerBaseUnit: it.pricePerBaseUnit,
                    governmentPrice: it.governmentPrice,
                    totalPrice: it.totalPrice
                }))
            };

            let newTotal = 0;
            let newSubtotal = 0;

            for (const it of sale.items) {
                const govRate = Number(it.governmentPrice);
                if (govRate > 0 && it.pricePerBaseUnit !== govRate) {
                    it.pricePerBaseUnit = govRate;
                    const lineAmount = parseFloat((it.soldQtyEntered * govRate).toFixed(2));
                    it.totalPrice = lineAmount;
                    it.lineTotal = lineAmount;
                    if (it.taxableValue !== undefined) it.taxableValue = lineAmount;
                    modified = true;
                }
                newTotal += (it.totalPrice || 0);
                newSubtotal += (it.totalPrice || 0);
            }

            if (modified) {
                sale.totalAmount = parseFloat(newTotal.toFixed(2));
                sale.subtotal = parseFloat(newSubtotal.toFixed(2));
                if (sale.paymentMethod !== 'Khata' || sale.paidAmount >= sale.totalAmount) {
                    sale.paidAmount = sale.totalAmount;
                    sale.remainingAmount = 0;
                    sale.paymentStatus = 'Paid';
                }
                await sale.save({ session });

                corrected.push({
                    saleId: sale._id,
                    invoiceNumber: sale.invoiceNumber,
                    previousTotal: previousSnapshot.totalAmount,
                    correctedTotal: sale.totalAmount,
                    authorizedBy: req.user.id,
                    reason: reason || 'Reconciled retail rate with persisted government price',
                    correctedAt: new Date()
                });
            }
        }

        await session.commitTransaction();
        session.endSession();

        res.status(200).json({
            success: true,
            message: `Successfully corrected ${corrected.length} historical government sale records.`,
            count: corrected.length,
            data: corrected
        });
    } catch (error) {
        await session.abortTransaction();
        session.endSession();
        console.error('Error correcting historical gov sales:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};
