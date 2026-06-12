const Shop = require('../models/Shop');
const Subscription = require('../models/Subscription');
const Product = require('../models/Product');
const Sale = require('../models/Sale');
const Khata = require('../models/Khata');
const Purchase = require('../models/Purchase');

module.exports = async (req, res, next) => {
    try {
        const path = req.originalUrl;
        
        // Skip check for admin, auth, and invoice rendering routes
        if (path.startsWith('/api/admin') || path.startsWith('/api/auth') || path.includes('/invoices/')) {
            return next();
        }

        // Try to locate shop ID from headers, query parameters, or request body
        let shopId = req.headers['x-shop-id'] || req.query.shop || req.query.shopId || req.body.shop || req.body.shopId;

        // If shopId is not found, try to infer it from URL params or db lookups
        if (!shopId) {
            const parts = path.split('?')[0].split('/');
            
            // Check if route is /api/shops/:id
            if (parts.includes('shops') && req.params.id) {
                shopId = req.params.id;
            } else if (parts.includes('products') && req.params.id) {
                // If it's a product update or delete, look up shop
                try {
                    const product = await Product.findById(req.params.id);
                    if (product) shopId = product.shop;
                } catch (e) {}
            } else if (parts.includes('sales') && req.params.id) {
                try {
                    const sale = await Sale.findById(req.params.id);
                    if (sale) shopId = sale.shop;
                } catch (e) {}
            } else if (parts.includes('khata') && req.params.id) {
                try {
                    const khata = await Khata.findById(req.params.id);
                    if (khata) shopId = khata.shop;
                } catch (e) {}
            } else if (parts.includes('purchases') && req.params.id) {
                try {
                    const purchase = await Purchase.findById(req.params.id);
                    if (purchase) shopId = purchase.shop;
                } catch (e) {}
            }
        }

        if (!shopId) {
            return next(); // Proceed if no shop context is detected
        }

        // Validate shop ID format
        if (!shopId.toString().match(/^[0-9a-fA-F]{24}$/)) {
            return next();
        }

        // Fetch Shop
        const shop = await Shop.findById(shopId);
        if (!shop) {
            return next();
        }

        // 1. Check if login is disabled for this shop
        if (shop.isLoginDisabled) {
            return res.status(403).json({
                success: false,
                isLoginDisabled: true,
                message: 'Access Denied: Logins and access to this shop have been disabled by the administrator.'
            });
        }

        // 2. Check if shop is suspended
        if (shop.isSuspended) {
            if (req.method !== 'GET') {
                return res.status(403).json({
                    success: false,
                    isSuspended: true,
                    message: 'Forbidden: Operations for this shop are suspended by the administrator.'
                });
            }
        }

        // 3. Check if subscription is expired (yearly plan expiry check)
        let sub = await Subscription.findOne({ shop: shopId });
        if (sub && sub.planType === 'Yearly' && sub.planEndDate) {
            const isExpired = new Date() > new Date(sub.planEndDate);
            if (isExpired) {
                // Allow GET (data viewing / exports)
                // Also allow admin actions or renewal calls (if any)
                const isRenewalPath = path.includes('/renew') || path.includes('/subscriptions');
                if (req.method !== 'GET' && !isRenewalPath) {
                    return res.status(403).json({
                        success: false,
                        isExpired: true,
                        message: 'Your yearly subscription has expired. Please renew to continue using ShopPulse.'
                    });
                }
            }
        }

        next();
    } catch (err) {
        console.error('Error in shopStatusMiddleware:', err);
        next();
    }
};
