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

        const Subscription = require('../models/Subscription');

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

            // Fetch active Subscription details
            let sub = await Subscription.findOne({ shop: shop._id });
            if (!sub) {
                // Auto create Trial subscription if none exists
                sub = await Subscription.create({
                    shop: shop._id,
                    planType: 'Trial',
                    planEndDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)
                });
            }

            return {
                ...shop,
                subscription: sub,
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

// @desc    Export all shop data
// @route   GET /api/shops/:id/export
// @access  Private
exports.exportShopData = async (req, res) => {
    try {
        const shop = await Shop.findById(req.params.id);

        if (!shop) {
            return res.status(404).json({ success: false, message: 'Shop not found' });
        }

        // Make sure user is owner
        if (shop.owner.toString() !== req.user.id) {
            return res.status(401).json({ success: false, message: 'Not authorized' });
        }

        const Product = require('../models/Product');
        const Sale = require('../models/Sale');
        const Khata = require('../models/Khata');
        const Purchase = require('../models/Purchase');

        const products = await Product.find({ shop: shop._id });
        const sales = await Sale.find({ shop: shop._id });
        const khata = await Khata.find({ shop: shop._id });
        const purchases = await Purchase.find({ shop: shop._id });

        res.status(200).json({
            success: true,
            data: {
                shopName: shop.name,
                exportedAt: new Date(),
                products,
                sales,
                khata,
                purchases
            }
        });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};
