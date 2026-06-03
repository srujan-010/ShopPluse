const Shop = require('../models/Shop');

// @desc    Get all shops for owner with performance metrics
// @route   GET /api/shops
// @access  Private
exports.getShops = async (req, res) => {
    try {
        const ownerId = req.user.id;
        const shops = await Shop.find({ owner: ownerId }).lean();
        
        const Sale = require('../models/Sale');
        const Product = require('../models/Product');
        
        const now = new Date();
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);

        const shopsWithStats = await Promise.all(shops.map(async (shop) => {
            // Today Sales
            const sales = await Sale.aggregate([
                { $match: { shop: shop._id, date: { $gte: startOfToday, $lte: endOfToday } } },
                { $group: { _id: null, total: { $sum: { $ifNull: ['$totalAmount', '$salesAmount'] } } } }
            ]);

            // Product Counts
            const productCount = await Product.countDocuments({ shop: shop._id });
            const lowStockCount = await Product.countDocuments({ 
                shop: shop._id, 
                $expr: { $lte: ["$quantity", { $ifNull: ["$lowStockLimit", 5] }] } 
            });

            return {
                ...shop,
                stats: {
                    todaySales: sales[0]?.total || 0,
                    productCount,
                    lowStockCount
                }
            };
        }));

        res.status(200).json({ success: true, data: shopsWithStats });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};

// @desc    Create new shop
// @route   POST /api/shops
// @access  Private
exports.createShop = async (req, res) => {
    try {
        req.body.owner = req.user.id;
        const shop = await Shop.create(req.body);
        res.status(201).json({ success: true, data: shop });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};

// @desc    Update shop
// @route   PUT /api/shops/:id
// @access  Private
exports.updateShop = async (req, res) => {
    try {
        let shop = await Shop.findById(req.params.id);

        if (!shop) {
            return res.status(404).json({ success: false, message: 'Shop not found' });
        }

        // Make sure user is owner
        if (shop.owner.toString() !== req.user.id) {
            return res.status(401).json({ success: false, message: 'Not authorized' });
        }

        shop = await Shop.findByIdAndUpdate(req.params.id, req.body, {
            new: true,
            runValidators: true
        });

        res.status(200).json({ success: true, data: shop });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};

// @desc    Delete shop
// @route   DELETE /api/shops/:id
// @access  Private
exports.deleteShop = async (req, res) => {
    try {
        const shop = await Shop.findById(req.params.id);

        if (!shop) {
            return res.status(404).json({ success: false, message: 'Shop not found' });
        }

        if (shop.owner.toString() !== req.user.id) {
            return res.status(401).json({ success: false, message: 'Not authorized' });
        }

        await shop.deleteOne();

        res.status(200).json({ success: true, data: {} });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};
