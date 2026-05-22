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
        'cm-meter': 0.01,
        'meter-cm': 100,
        'piece-dozen': 1/12,
        'dozen-piece': 12
    };
    return table[key];
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
