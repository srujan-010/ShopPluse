const Purchase = require('../models/Purchase');
const Product = require('../models/Product');
const RestockHistory = require('../models/RestockHistory');
const InventoryHistory = require('../models/InventoryHistory');
const mongoose = require('mongoose');

// @desc    Get all purchases for owner/shop
// @route   GET /api/purchases
// @access  Private
exports.getPurchases = async (req, res) => {
    try {
        let query = {};
        if (req.query.shop) {
            query.shop = req.query.shop;
        } else {
            query.owner = req.user.id;
        }
        const purchases = await Purchase.find(query)
            .populate('shop', 'name')
            .sort('-date');
        res.status(200).json({ success: true, data: purchases });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};

// @desc    Get single purchase
// @route   GET /api/purchases/:id
// @access  Private
exports.getPurchase = async (req, res) => {
    try {
        const purchase = await Purchase.findOne({ _id: req.params.id, owner: req.user.id })
            .populate('shop', 'name');
        
        if (!purchase) {
            return res.status(404).json({ success: false, message: 'Purchase not found' });
        }

        res.status(200).json({ success: true, data: purchase });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};

// @desc    Create new purchase and update stock
// @route   POST /api/purchases
// @access  Private
exports.createPurchase = async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const { shop, billNo, supplierName, items, totalAmount, totalItems, paymentStatus, paymentMethod, dueAmount, date } = req.body;
        const ownerId = req.user.id;

        // 1. Create the purchase record
        const purchase = new Purchase({
            shop,
            billNo,
            supplierName,
            items,
            totalAmount,
            totalItems,
            paymentStatus,
            paymentMethod,
            dueAmount: dueAmount || 0,
            date: date || new Date(),
            owner: ownerId,
            addedBy: ownerId
        });

        await purchase.save({ session });

        // 2. Update stock and create history for each item
        for (const item of items) {
            if (item.product) {
                const product = await Product.findById(item.product).session(session);
                if (product) {
                    // Update quantity
                    product.quantity = parseFloat((product.quantity + item.quantity).toFixed(3));
                    // Update buy price (optional, but good for reporting)
                    product.buyPrice = item.purchaseRate;
                    // Update supplier name if provided
                    if (supplierName) product.supplier = supplierName;
                    
                    await product.save({ session });

                    // Create Restock History entry
                    await RestockHistory.create([{
                        product: product._id,
                        productName: product.name,
                        quantityAdded: item.quantity,
                        supplier: supplierName || 'Unknown',
                        purchasePrice: item.purchaseRate,
                        shop,
                        owner: ownerId,
                        date: date || new Date()
                    }], { session });

                    // Create Inventory History entry
                    await InventoryHistory.create([{
                        productId: product._id,
                        productName: product.name,
                        actionType: 'PURCHASE_ENTRY',
                        quantity: item.quantity,
                        unit: product.unit || 'Piece',
                        previousStock: product.quantity - item.quantity,
                        newStock: product.quantity,
                        source: supplierName || 'Unknown',
                        referenceId: billNo,
                        notes: `Added ${item.quantity} ${product.unit || 'Piece'} from Purchase Bill`,
                        shop,
                        owner: ownerId
                    }], { session });
                }
            }
        }

        await session.commitTransaction();
        session.endSession();

        res.status(201).json({ success: true, data: purchase });
    } catch (error) {
        await session.abortTransaction();
        session.endSession();
        res.status(400).json({ success: false, message: error.message });
    }
};
// @desc    Add payment to purchase
// @route   POST /api/purchases/:id/payment
// @access  Private
exports.addPurchasePayment = async (req, res) => {
    try {
        const { amount, mode, note, remark } = req.body;
        const purchase = await Purchase.findById(req.params.id);

        if (!purchase) {
            return res.status(404).json({ success: false, message: 'Purchase not found' });
        }

        // Do not treat Credit as an actual outgoing payment
        if (mode === 'Credit') {
            return res.status(400).json({ 
                success: false, 
                message: 'Credit cannot be recorded as an outgoing settlement. Please select Cash, Online / UPI, or Bank Transfer.' 
            });
        }

        const paidVal = parseFloat(amount || 0);
        if (isNaN(paidVal) || paidVal <= 0) {
            return res.status(400).json({ success: false, message: 'Payment amount must be greater than zero.' });
        }

        purchase.paidAmount = parseFloat(((purchase.paidAmount || 0) + paidVal).toFixed(2));
        purchase.dueAmount = Math.max(0, parseFloat((purchase.totalAmount - purchase.paidAmount).toFixed(2)));

        if (purchase.paidAmount >= purchase.totalAmount) {
            purchase.paymentStatus = 'Paid';
        } else if (purchase.paidAmount > 0) {
            purchase.paymentStatus = 'Partial Paid';
        } else {
            purchase.paymentStatus = 'Pending';
        }

        const sanitizedRemark = (remark !== undefined ? remark : (note !== undefined ? note : '')).toString().trim();

        purchase.paymentHistory.push({
            amount: paidVal,
            mode: mode || 'Cash',
            note: sanitizedRemark,
            remark: sanitizedRemark,
            paidAt: new Date()
        });

        await purchase.save();

        res.status(200).json({ success: true, data: purchase });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};

// @desc    Get complete Supplier Account Statement / Ledger
// @route   GET /api/purchases/supplier-statement
// @access  Private
exports.getSupplierStatement = async (req, res) => {
    try {
        const { shop: shopId, supplierName, period, startDate: qStartDate, endDate: qEndDate } = req.query;

        if (!shopId || !supplierName) {
            return res.status(400).json({ success: false, message: 'Shop ID and Supplier Name are required.' });
        }

        const Shop = require('../models/Shop');
        const shopRecord = await Shop.findById(shopId);

        // Fetch all purchases for this supplier in this shop
        // Case-insensitive regex match on supplierName
        const escapedSupplier = supplierName.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const query = {
            shop: shopId,
            supplierName: { $regex: new RegExp(`^${escapedSupplier}$`, 'i') }
        };

        const allPurchases = await Purchase.find(query).sort('date');

        // Extract contact info if any purchase has supplierPhone
        const matchedPhone = allPurchases.find(p => p.supplierPhone)?.supplierPhone || '';

        // Calculate statement period date range
        const now = new Date();
        let startDate = null;
        let endDate = null;
        let periodLabel = 'All Time';

        const filterType = period || (qStartDate && qEndDate ? 'custom' : 'this_financial_year');

        if (filterType === 'today') {
            startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
            endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
            periodLabel = `Today (${startDate.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })})`;
        } else if (filterType === 'this_month') {
            startDate = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
            endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
            periodLabel = startDate.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
        } else if (filterType === 'this_financial_year' || filterType === 'this_year') {
            const startYear = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
            startDate = new Date(startYear, 3, 1, 0, 0, 0, 0); // 1st April
            endDate = new Date(startYear + 1, 2, 31, 23, 59, 59, 999); // 31st March
            periodLabel = `FY ${startYear}-${String(startYear + 1).slice(-2)} (01 Apr ${startYear} to 31 Mar ${startYear + 1})`;
        } else if (filterType === 'custom' && (qStartDate || qEndDate)) {
            startDate = qStartDate ? new Date(qStartDate) : new Date(0);
            if (qStartDate) startDate.setHours(0, 0, 0, 0);
            endDate = qEndDate ? new Date(qEndDate) : new Date();
            if (qEndDate) endDate.setHours(23, 59, 59, 999);
            periodLabel = `${startDate.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })} to ${endDate.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}`;
        } else {
            // All Time
            startDate = new Date(0);
            endDate = new Date(now.getFullYear() + 1, 11, 31, 23, 59, 59, 999);
            periodLabel = 'Complete Ledger (All Time)';
        }

        // Build complete lists of purchases and payments
        let priorPurchasesTotal = 0;
        let priorPaymentsTotal = 0;

        const debits = [];   // Purchases in period
        const credits = [];  // Payments in period

        for (const p of allPurchases) {
            const pDate = new Date(p.date || p.createdAt);

            // Purchase entry
            const itemsSummary = (p.items || []).map(it => `${it.productName || 'Item'} (${it.quantity} ${it.unit || 'Pc'})`).join(', ') || 'Stock Purchase';
            const categories = [...new Set((p.items || []).map(it => it.category).filter(Boolean))].join(', ') || 'Purchases';

            const purchaseAmount = Number(p.totalAmount || 0);

            if (pDate < startDate) {
                priorPurchasesTotal += purchaseAmount;
            } else if (pDate <= endDate) {
                debits.push({
                    id: p._id,
                    date: pDate,
                    billNo: p.billNo || '-',
                    description: itemsSummary,
                    category: categories,
                    notes: p.notes || '',
                    items: p.items || [],
                    amount: purchaseAmount,
                    paymentStatus: p.paymentStatus
                });
            }

            // Payments linked to this purchase
            if (p.paymentHistory && p.paymentHistory.length > 0) {
                for (const ph of p.paymentHistory) {
                    // Do not treat Credit as an actual outgoing payment
                    if (ph.mode === 'Credit') continue;

                    const payDate = new Date(ph.paidAt || ph.date || p.date);
                    const payAmount = Number(ph.amount || 0);

                    if (payDate < startDate) {
                        priorPaymentsTotal += payAmount;
                    } else if (payDate <= endDate) {
                        const savedRemark = ph.remark !== undefined ? ph.remark : (ph.note !== undefined ? ph.note : '');
                        credits.push({
                            id: ph._id || `${p._id}-${payDate.getTime()}`,
                            purchaseId: p._id,
                            billNo: p.billNo,
                            date: payDate,
                            amount: payAmount,
                            paymentMethod: ph.mode || p.paymentMethod || 'Cash',
                            reference: ph.reference || ph.chequeNo || '',
                            bank: ph.bank || '',
                            remark: savedRemark,
                            notes: savedRemark || (p.billNo ? `Payment towards Bill #${p.billNo}` : 'Supplier Payment')
                        });
                    }
                }
            } else if (Number(p.paidAmount || p.amountPaid || 0) > 0 && p.paymentMethod !== 'Credit') {
                // Initial payment without explicit paymentHistory entry
                const payDate = pDate;
                const payAmount = Number(p.paidAmount || p.amountPaid || 0);

                if (payDate < startDate) {
                    priorPaymentsTotal += payAmount;
                } else if (payDate <= endDate) {
                    credits.push({
                        id: `${p._id}-init`,
                        purchaseId: p._id,
                        billNo: p.billNo,
                        date: payDate,
                        amount: payAmount,
                        paymentMethod: p.paymentMethod || 'Cash',
                        reference: '',
                        bank: '',
                        remark: '',
                        notes: `Initial payment at purchase (Bill #${p.billNo})`
                    });
                }
            }
        }

        // Sort chronologically (ascending)
        debits.sort((a, b) => new Date(a.date) - new Date(b.date));
        credits.sort((a, b) => new Date(a.date) - new Date(b.date));

        const openingBalance = parseFloat((priorPurchasesTotal - priorPaymentsTotal).toFixed(2));
        const totalDebits = parseFloat(debits.reduce((sum, d) => sum + d.amount, 0).toFixed(2));
        const totalCredits = parseFloat(credits.reduce((sum, c) => sum + c.amount, 0).toFixed(2));

        const closingBalance = parseFloat((openingBalance + totalDebits - totalCredits).toFixed(2));

        const openingBalanceType = openingBalance > 0 ? 'payable' : (openingBalance < 0 ? 'advance' : 'settled');
        const closingBalanceType = closingBalance > 0 ? 'payable' : (closingBalance < 0 ? 'advance' : 'settled');

        const balanceStatusLabel = closingBalance > 0
            ? 'Net Payable to Supplier'
            : (closingBalance < 0 ? 'Advance / Credit Balance' : 'Settled / Nil');

        res.status(200).json({
            success: true,
            data: {
                shop: {
                    id: shopRecord?._id || shopId,
                    name: shopRecord?.name || 'ShopPulse Business',
                    location: shopRecord?.location || '',
                    contactNumber: shopRecord?.contactNumber || '',
                    gstNumber: shopRecord?.gstNumber || '',
                    email: shopRecord?.email || ''
                },
                supplier: {
                    name: supplierName.trim(),
                    phone: matchedPhone,
                    location: ''
                },
                period: {
                    filterType,
                    label: periodLabel,
                    startDate,
                    endDate
                },
                summary: {
                    openingBalance,
                    openingBalanceType,
                    totalDebits,      // Total purchases
                    totalCredits,     // Total payments
                    closingBalance,
                    closingBalanceType,
                    balanceStatusLabel
                },
                debits,  // Chronological purchases
                credits  // Chronological payments
            }
        });
    } catch (error) {
        console.error('Error generating supplier statement:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};
