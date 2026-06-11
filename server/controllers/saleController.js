const Sale = require('../models/Sale');
const Product = require('../models/Product');
const Purchase = require('../models/Purchase');
const Khata = require('../models/Khata');
const GovernmentSale = require('../models/GovernmentSale');
const InventoryHistory = require('../models/InventoryHistory');
const ReturnRecord = require('../models/ReturnRecord');
const ExchangeRecord = require('../models/ExchangeRecord');
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
        
        const [sales, returns, exchanges] = await Promise.all([
            Sale.find(query).populate('shop', 'name').lean(),
            ReturnRecord.find(query).populate('shop', 'name').lean(),
            ExchangeRecord.find(query).populate('shop', 'name').lean()
        ]);

        sales.forEach(s => {
            s.type = 'SALE';
        });

        returns.forEach(r => {
            r.type = 'RETURN';
            r.totalAmount = -r.totalRefundAmount; // Displayed as negative in sales list
            r.paymentMethod = r.refundMethod;
        });

        exchanges.forEach(e => {
            e.type = 'EXCHANGE';
            e.totalAmount = e.balanceDifference;
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

        const allTransactions = [...sales, ...returns, ...exchanges].sort((a, b) => new Date(b.date) - new Date(a.date));

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

            // Update Stock with floating point safety
            const previousStock = product.quantity;
            product.quantity = Math.max(0, parseFloat((product.quantity - convertedQuantityInBaseUnit).toFixed(3)));
            await product.save();

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
                profit: itemProfit,
                
                // For history tracking
                previousStock: previousStock,
                newStock: product.quantity
            });
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

        // --- AUTO-GENERATE GOVERNMENT RECORD ---
        let totalGovernmentAmount = 0;
        const govItems = [];

        for (const item of items) {
            const product = await Product.findById(item.product);
            if (!product) continue;

            if (product.category === 'Fertilizers' && product.governmentPrice && product.governmentPrice > 0) {
                const enteredQuantity = item.quantity;
                const sellingUnit = item.unit || product.unit;
                const baseUnit = product.unit;

                const multiplier = getConversionMultiplier(sellingUnit, baseUnit);
                if (multiplier === undefined) continue;

                const convertedQuantityInBaseUnit = enteredQuantity * multiplier;
                const govPricePerBaseUnit = product.governmentPrice;
                const totalItemGovAmount = parseFloat((convertedQuantityInBaseUnit * govPricePerBaseUnit).toFixed(2));

                totalGovernmentAmount += totalItemGovAmount;

                govItems.push({
                    product: product._id,
                    productName: product.name,
                    soldQtyEntered: enteredQuantity,
                    soldUnit: sellingUnit,
                    soldQtyBaseUnit: convertedQuantityInBaseUnit,
                    pricePerBaseUnit: govPricePerBaseUnit,
                    totalPrice: totalItemGovAmount,
                    governmentPrice: govPricePerBaseUnit
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

            await GovernmentSale.create({
                shop,
                linkedSaleId: sale._id,
                invoiceNumber: govInvoiceNumber,
                customerName: customerName || 'Walk-in Customer',
                customerMobile: customerMobile || '',
                items: govItems,
                totalAmount: totalGovernmentAmount,
                paymentMethod,
                date: date || new Date(),
                owner: ownerId,
                isInspectionCopy: true
            });


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
        let match = { owner: ownerId };

        if (shopId) {
            match.shop = new mongoose.Types.ObjectId(shopId);
        }

        // Today's range
        const now = new Date();
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
        
        const todayMatch = { ...match, date: { $gte: startOfToday, $lte: endOfToday } };

        // Query sales, returns, and exchanges for today
        const [salesToday, returnsToday, exchangesToday] = await Promise.all([
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
            ])
        ]);

        const netSalesToday = (salesToday[0]?.total || 0) - (returnsToday[0]?.total || 0) + (exchangesToday[0]?.total || 0);
        const netProfitToday = (salesToday[0]?.profit || 0) + (returnsToday[0]?.profit || 0) + (exchangesToday[0]?.profit || 0);
        const totalOrders = await Sale.countDocuments(todayMatch);

        // Payment Breakdown for Today (adjusting for returns and exchanges)
        const [salesPaymentBreakdown, returnsPaymentBreakdown, exchangesPaymentBreakdown] = await Promise.all([
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
        
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ success: false, message: 'Invalid sale ID format' });
        }

        // Try Sale first
        let transaction = await Sale.findOne({ _id: id, owner: req.user.id })
            .populate('shop', 'name')
            .lean();
            
        if (transaction) {
            transaction.type = 'SALE';

            // Calculate already returned quantities
            const prevReturns = await ReturnRecord.find({ originalSale: id }).lean();
            const prevExchanges = await ExchangeRecord.find({ originalSale: id }).lean();

            const returnedQtyMap = {};
            prevReturns.forEach(ret => {
                ret.items.forEach(item => {
                    const prodId = item.product.toString();
                    returnedQtyMap[prodId] = (returnedQtyMap[prodId] || 0) + item.quantity;
                });
            });
            prevExchanges.forEach(exc => {
                exc.returnedItems.forEach(item => {
                    const prodId = item.product.toString();
                    returnedQtyMap[prodId] = (returnedQtyMap[prodId] || 0) + item.quantity;
                });
            });

            // Populate returnedQty and remainingQty per item
            transaction.items = transaction.items.map(item => {
                const prodId = item.product.toString();
                const returnedBase = returnedQtyMap[prodId] || 0;
                const multiplier = item.multiplier || 1;
                const returnedQty = parseFloat((returnedBase / multiplier).toFixed(3));
                const remainingQty = parseFloat((item.soldQtyEntered - returnedQty).toFixed(3));

                return {
                    ...item,
                    returnedQty,
                    exchangedQty: 0,
                    remainingQty: Math.max(0, remainingQty)
                };
            });

            return res.status(200).json({ success: true, data: transaction });
        }

        // Try ReturnRecord next
        transaction = await ReturnRecord.findOne({ _id: id, owner: req.user.id })
            .populate('shop', 'name')
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
                        const prodId = item.product.toString();
                        returnedQtyMap[prodId] = (returnedQtyMap[prodId] || 0) + item.quantity;
                    });
                });
                prevExchanges.forEach(exc => {
                    exc.returnedItems.forEach(item => {
                        const prodId = item.product.toString();
                        returnedQtyMap[prodId] = (returnedQtyMap[prodId] || 0) + item.quantity;
                    });
                });

                transaction.remainingActiveItems = origSale.items.map(item => {
                    const prodId = item.product.toString();
                    const returnedBase = returnedQtyMap[prodId] || 0;
                    const multiplier = item.multiplier || 1;
                    const returnedQty = parseFloat((returnedBase / multiplier).toFixed(3));
                    const remainingQty = parseFloat((item.soldQtyEntered - returnedQty).toFixed(3));

                    return {
                        productName: item.productName,
                        quantity: Math.max(0, remainingQty),
                        unit: item.soldUnit || item.unit,
                        price: item.pricePerBaseUnit || item.price,
                        totalPrice: Math.max(0, remainingQty) * (item.pricePerBaseUnit || item.price)
                    };
                }).filter(item => item.quantity > 0);
            }

            return res.status(200).json({ success: true, data: transaction });
        }

        // Try ExchangeRecord
        transaction = await ExchangeRecord.findOne({ _id: id, owner: req.user.id })
            .populate('shop', 'name')
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
                        const prodId = item.product.toString();
                        returnedQtyMap[prodId] = (returnedQtyMap[prodId] || 0) + item.quantity;
                    });
                });
                prevExchanges.forEach(exc => {
                    exc.returnedItems.forEach(item => {
                        const prodId = item.product.toString();
                        returnedQtyMap[prodId] = (returnedQtyMap[prodId] || 0) + item.quantity;
                    });
                });

                transaction.remainingActiveItems = origSale.items.map(item => {
                    const prodId = item.product.toString();
                    const returnedBase = returnedQtyMap[prodId] || 0;
                    const multiplier = item.multiplier || 1;
                    const returnedQty = parseFloat((returnedBase / multiplier).toFixed(3));
                    const remainingQty = parseFloat((item.soldQtyEntered - returnedQty).toFixed(3));

                    return {
                        productName: item.productName,
                        quantity: Math.max(0, remainingQty),
                        unit: item.soldUnit || item.unit,
                        price: item.pricePerBaseUnit || item.price,
                        totalPrice: Math.max(0, remainingQty) * (item.pricePerBaseUnit || item.price)
                    };
                }).filter(item => item.quantity > 0);
            }

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
            const updatedGovItems = [];

            for (const govItem of govSale.items) {
                const returnedObj = processedItems.find(p => p.product.toString() === govItem.product.toString());
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

            govSale.items = updatedGovItems;
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

            // Add replacement fertilizer items as new entries (keeping audit trail clear)
            for (const repItem of processedReplacementItems) {
                const product = await Product.findById(repItem.product);
                if (product && product.category === 'Fertilizers' && product.governmentPrice > 0) {
                    const govPrice = product.governmentPrice;
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
