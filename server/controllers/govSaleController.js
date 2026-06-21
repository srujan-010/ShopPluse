const GovernmentSale = require('../models/GovernmentSale');
const Product = require('../models/Product');
const mongoose = require('mongoose');

const getConversionMultiplier = (fromUnit, toUnit) => {
    if (!fromUnit || !toUnit) return 1;
    if (fromUnit.toLowerCase() === toUnit.toLowerCase()) return 1;
    const key = `${fromUnit.toLowerCase()}-${toUnit.toLowerCase()}`;
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

// @desc    Get all government sales for owner
// @route   GET /api/gov-sales
// @access  Private
exports.getGovSales = async (req, res) => {
    try {
        let query = { owner: req.user.id };
        if (req.query.shop) {
            query.shop = req.query.shop;
        }
        const sales = await GovernmentSale.find(query)
            .populate('shop', 'name')
            .sort('-date');
        res.status(200).json({ success: true, data: sales });
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
            .populate('shop', 'name');
            
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

        // Validation: Aadhaar 12-digit numeric check if provided
        if (customerAadhaar) {
            const aadhaarRegex = /^\d{12}$/;
            if (!aadhaarRegex.test(customerAadhaar.toString().trim())) {
                return res.status(400).json({ success: false, message: 'Aadhaar Card number must be exactly 12 digits.' });
            }
        }

        // Generate custom invoice number
        const invoiceCount = await GovernmentSale.countDocuments({ shop });
        const invoiceNumber = `GOV-INV-${1000 + invoiceCount}`;

        // Verify products and calculate base unit values
        const preparedItems = [];
        for (const item of items) {
            const product = await Product.findById(item.product).session(session);
            if (!product) {
                return res.status(404).json({ success: false, message: `Product ${item.productName || item.product} not found.` });
            }

            // Price Ceilings Check
            const govPrice = product.governmentPrice || product.sellPrice;
            const rateCharged = item.pricePerBaseUnit || item.governmentPrice || item.price || 0;
            if (rateCharged > govPrice) {
                return res.status(400).json({ 
                    success: false, 
                    message: `Price for ${product.name} (₹${rateCharged}) exceeds the government price ceiling of ₹${govPrice}.` 
                });
            }

            // Unit Conversion
            const multiplier = getConversionMultiplier(item.soldUnit || item.unit, product.unit) || 1;
            const soldQtyBaseUnit = item.soldQtyEntered * multiplier;

            preparedItems.push({
                product: product._id,
                productName: product.name,
                soldQtyEntered: item.soldQtyEntered,
                soldUnit: item.soldUnit || item.unit || product.unit || 'Piece',
                soldQtyBaseUnit,
                pricePerBaseUnit: rateCharged,
                governmentPrice: govPrice,
                totalPrice: item.soldQtyEntered * rateCharged,
                returnedQty: 0,
                remainingQty: item.soldQtyEntered
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
                owner: ownerId,
                createdAt: date || new Date()
            }], { session });
        }

        const govSale = new GovernmentSale({
            shop,
            linkedSaleId: linkedSaleId || null,
            invoiceNumber,
            customerName: customerName || 'Walk-in Customer',
            customerMobile: customerMobile || '',
            customerAadhaar: customerAadhaar || '',
            items: preparedItems,
            totalAmount,
            paymentMethod,
            isInspectionCopy: isInspectionCopy !== undefined ? isInspectionCopy : true,
            date: date || new Date(),
            owner: ownerId
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
