const Sale = require('../models/Sale');
const Product = require('../models/Product');
const Purchase = require('../models/Purchase');
const Khata = require('../models/Khata');
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
        'cm-meter': 0.01,
        'meter-cm': 100,
        'inch-feet': 1/12,
        'feet-inch': 12,
        'piece-dozen': 1/12,
        'dozen-piece': 12
    };
    return table[key];
};

// @desc    Get all sales for owner
// @route   GET /api/sales
// @access  Private
exports.getSales = async (req, res) => {
    try {
        let query = { owner: req.user.id };
        if (req.query.shop) {
            query.shop = req.query.shop;
        }
        const sales = await Sale.find(query)
            .populate('shop', 'name')
            .sort('-date');
        res.status(200).json({ success: true, data: sales });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};

// @desc    Create new sale (Cart System)
// @route   POST /api/sales
// @access  Private
exports.createSale = async (req, res) => {
    try {
        const { shop, items, paymentMethod, date, customerName, customerMobile } = req.body;
        const ownerId = req.user.id;

        let totalAmount = 0;
        let totalProfit = 0;
        const processedItems = [];

        // Process each item in the cart
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
            const totalPrice = parseFloat((convertedQuantityInBaseUnit * sellPricePerBaseUnit).toFixed(2));
            
            const buyPricePerBaseUnit = product.buyPrice || 0;
            const itemProfit = parseFloat((totalPrice - (convertedQuantityInBaseUnit * buyPricePerBaseUnit)).toFixed(2));

            totalAmount += totalPrice;
            totalProfit += itemProfit;

            processedItems.push({
                product: product._id,
                productName: product.name,
                soldQtyEntered: enteredQuantity,
                soldUnit: sellingUnit,
                soldQtyBaseUnit: convertedQuantityInBaseUnit,
                pricePerBaseUnit: sellPricePerBaseUnit,
                totalPrice: totalPrice,
                
                // Legacy compatibility
                quantity: enteredQuantity,
                unit: sellingUnit,
                multiplier: multiplier,
                price: parseFloat((totalPrice / enteredQuantity).toFixed(2)) || sellPricePerBaseUnit,
                profit: itemProfit
            });

            // Update Stock with floating point safety
            product.quantity = Math.max(0, parseFloat((product.quantity - convertedQuantityInBaseUnit).toFixed(3)));
            await product.save();
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
            totalAmount,
            totalProfit,
            paymentMethod,
            date: date || new Date(),
            owner: ownerId
        });

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
            
            khataRecord.outstandingDue += totalAmount;
            khataRecord.transactions.push({
                type: 'due',
                amount: totalAmount,
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
            
            await khataRecord.save();
        }

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
        let match = { owner: ownerId };

        if (shopId) {
            match.shop = new mongoose.Types.ObjectId(shopId);
        }

        // Today's range
        const now = new Date();
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
        
        const todayMatch = { ...match, date: { $gte: startOfToday, $lte: endOfToday } };

        const totalSales = await Sale.aggregate([
            { $match: todayMatch },
            { $group: { _id: null, total: { $sum: { $ifNull: ['$totalAmount', '$salesAmount'] } } } }
        ]);

        const totalProfit = await Sale.aggregate([
            { $match: todayMatch },
            { $group: { _id: null, total: { $sum: { $ifNull: ['$totalProfit', '$profit'] } } } }
        ]);

        const totalOrders = await Sale.countDocuments(todayMatch);

        // Payment Breakdown for Today
        const paymentBreakdown = await Sale.aggregate([
            { $match: todayMatch },
            { $group: { _id: '$paymentMethod', amount: { $sum: { $ifNull: ['$totalAmount', '$salesAmount'] } } } }
        ]);

        const breakdown = {
            Cash: 0,
            UPI: 0,
            Khata: 0,
            Total: 0
        };

        paymentBreakdown.forEach(item => {
            if (breakdown.hasOwnProperty(item._id)) {
                breakdown[item._id] = item.amount;
            }
            breakdown.Total += item.amount;
        });

        // Pending Metrics
        const supplierDues = await Purchase.aggregate([
            { $match: match },
            { $group: { _id: null, total: { $sum: '$dueAmount' } } }
        ]);

        const customerCredits = await Khata.aggregate([
            { $match: match },
            { $group: { _id: null, total: { $sum: '$outstandingDue' } } }
        ]);

        // Combined Recent Activity (Sales, Payments, Stock)
        const recentSales = await Sale.find(match)
            .sort('-date')
            .limit(10)
            .select('totalAmount salesAmount date paymentMethod customerName items');

        // Low Stock Count
        const lowStockCount = await Product.countDocuments({ 
            ...match, 
            $expr: { $lte: ["$quantity", { $ifNull: ["$minStock", 10] }] } 
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

        res.status(200).json({
            success: true,
            data: {
                totalSales: totalSales[0]?.total || 0,
                totalProfit: totalProfit[0]?.total || 0,
                totalOrders,
                totalItems: inventoryStats[0]?.totalItems || 0,
                totalStockValue: inventoryStats[0]?.totalStockValue || 0,
                paymentBreakdown: breakdown,
                pendingMetrics: {
                    supplierDues: supplierDues[0]?.total || 0,
                    customerCredits: customerCredits[0]?.total || 0,
                    lowStockCount
                },
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

        const salesByShop = await Sale.aggregate([
            { $match: match },
            {
                $group: {
                    _id: '$shop',
                    totalSales: { $sum: { $ifNull: ['$totalAmount', '$salesAmount'] } },
                    totalProfit: { $sum: { $ifNull: ['$totalProfit', '$profit'] } }
                }
            },
            {
                $lookup: {
                    from: 'shops',
                    localField: '_id',
                    foreignField: '_id',
                    as: 'shopDetails'
                }
            },
            { $unwind: '$shopDetails' },
            {
                $project: {
                    shopName: '$shopDetails.name',
                    totalSales: 1,
                    totalProfit: 1
                }
            }
        ]);

        // Best Selling Products (Requires unwinding items)
        const bestSelling = await Sale.aggregate([
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
                                quantity: "$quantity",
                                price: "$salesAmount"
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
                    totalSold: { $sum: '$items.quantity' },
                    totalSales: { $sum: { $multiply: ['$items.price', '$items.quantity'] } }
                }
            },
            { $sort: { totalSold: -1 } },
            { $limit: 5 }
        ]);

        const sixMonthsAgo = new Date();
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
        const profitSummary = await Sale.aggregate([
            { $match: { ...match, date: { $gte: sixMonthsAgo } } },
            {
                $group: {
                    _id: {
                        month: { $month: '$date' },
                        year: { $year: '$date' }
                    },
                    profit: { $sum: { $ifNull: ['$totalProfit', '$profit'] } },
                    sales: { $sum: { $ifNull: ['$totalAmount', '$salesAmount'] } }
                }
            },
            { $sort: { '_id.year': 1, '_id.month': 1 } }
        ]);

        res.status(200).json({
            success: true,
            data: {
                salesByShop,
                bestSelling,
                profitSummary
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

        const history = await Sale.aggregate([
            { $match: match },
            {
                $group: {
                    _id: groupBy,
                    totalSales: { $sum: { $ifNull: ['$totalAmount', '$salesAmount'] } },
                    totalProfit: { $sum: { $ifNull: ['$totalProfit', '$profit'] } },
                    count: { $sum: 1 }
                }
            },
            { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1, '_id.hour': 1 } }
        ]);

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

            const agg = await Sale.aggregate([
                { $match: query },
                {
                    $group: {
                        _id: null,
                        totalSales: { $sum: { $ifNull: ['$totalAmount', '$salesAmount'] } },
                        totalProfit: { $sum: { $ifNull: ['$totalProfit', '$profit'] } },
                        orders: { $sum: 1 }
                    }
                }
            ]);
            return agg[0] || { totalSales: 0, totalProfit: 0, orders: 0 };
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
        
        // Validate ID format to prevent CastError
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ success: false, message: 'Invalid sale ID format' });
        }

        const sale = await Sale.findOne({ _id: id, owner: req.user.id })
            .populate('shop', 'name');
            
        if (!sale) {
            return res.status(404).json({ success: false, message: 'Sale not found' });
        }

        res.status(200).json({ success: true, data: sale });
    } catch (error) {
        console.error('Error fetching sale details:', error);
        res.status(500).json({ success: false, message: 'Internal server error while fetching sale details' });
    }
};
