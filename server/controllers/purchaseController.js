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
        let query = { owner: req.user.id };
        if (req.query.shop) {
            query.shop = req.query.shop;
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
        const { amount, mode, note } = req.body;
        const purchase = await Purchase.findOne({ _id: req.params.id, owner: req.user.id });

        if (!purchase) {
            return res.status(404).json({ success: false, message: 'Purchase not found' });
        }

        const paidVal = parseFloat(amount || 0);
        purchase.paidAmount = parseFloat(((purchase.paidAmount || 0) + paidVal).toFixed(2));
        purchase.dueAmount = Math.max(0, parseFloat((purchase.totalAmount - purchase.paidAmount).toFixed(2)));

        if (purchase.paidAmount >= purchase.totalAmount) {
            purchase.paymentStatus = 'Paid';
        } else if (purchase.paidAmount > 0) {
            purchase.paymentStatus = 'Partial Paid';
        } else {
            purchase.paymentStatus = 'Pending';
        }

        purchase.paymentHistory.push({
            amount: paidVal,
            mode: mode || 'Cash',
            note: note || '',
            paidAt: new Date()
        });

        await purchase.save();

        res.status(200).json({ success: true, data: purchase });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};
