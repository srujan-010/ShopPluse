const mongoose = require('mongoose');

const Shop = require('../models/Shop');
const Subscription = require('../models/Subscription');
const Product = require('../models/Product');
const Sale = require('../models/Sale');
const Khata = require('../models/Khata');
const Purchase = require('../models/Purchase');

module.exports = async (req, res, next) => {
    try {

        const path = req.originalUrl || "";

        // Skip middleware for these routes
        if (
            path.startsWith('/api/admin') ||
            path.startsWith('/admin') ||
            path.startsWith('/api/auth') ||
            path.startsWith('/auth') ||
            path.includes('/invoices/')
        ) {
            return next();
        }

        // Safe access
        const headers = req.headers || {};
        const query = req.query || {};
        const body = req.body || {};

        let shopId =
            headers['x-shop-id'] ||
            query.shop ||
            query.shopId ||
            body.shop ||
            body.shopId;

        // Try finding shop from URL params
        if (!shopId) {

            if (req.params?.shopId) {
                shopId = req.params.shopId;
            }

            else if (req.params?.id) {

                const url = path.toLowerCase();

                try {

                    if (url.includes('/products/')) {
                        const product = await Product.findById(req.params.id).select('shop');
                        shopId = product?.shop;
                    }

                    else if (url.includes('/sales/')) {
                        const sale = await Sale.findById(req.params.id).select('shop');
                        shopId = sale?.shop;
                    }

                    else if (url.includes('/khata/')) {
                        const khata = await Khata.findById(req.params.id).select('shop');
                        shopId = khata?.shop;
                    }

                    else if (url.includes('/purchases/')) {
                        const purchase = await Purchase.findById(req.params.id).select('shop');
                        shopId = purchase?.shop;
                    }

                    else if (url.includes('/shops/')) {
                        shopId = req.params.id;
                    }

                } catch (lookupError) {
                    console.error("Shop lookup failed:", lookupError.message);
                }
            }
        }

        // No shop context
        if (!shopId) {
            return next();
        }

        // Validate ObjectId
        if (!mongoose.Types.ObjectId.isValid(shopId)) {
            return next();
        }

        // Load shop
        const shop = await Shop.findById(shopId);

        if (!shop) {
            return next();
        }

        // Attach shop to request
        req.shop = shop;

        // =============================
        // LOGIN DISABLED
        // =============================
        if (shop.isLoginDisabled) {

            return res.status(403).json({
                success: false,
                code: "LOGIN_DISABLED",
                message:
                    "Access to this shop has been disabled by the administrator."
            });

        }

        // =============================
        // SHOP SUSPENDED
        // =============================
        if (shop.isSuspended) {

            // Allow GET requests
            if (req.method !== "GET") {

                return res.status(403).json({
                    success: false,
                    code: "SHOP_SUSPENDED",
                    message:
                        "This shop has been suspended. Only viewing data is allowed."
                });

            }

        }

        // =============================
        // SUBSCRIPTION CHECK
        // =============================
        const subscription = await Subscription.findOne({
            shop: shopId
        });

        if (
            subscription &&
            subscription.planType === "Yearly" &&
            subscription.planEndDate
        ) {

            const expired =
                new Date() > new Date(subscription.planEndDate);

            if (expired) {

                const renewalRoute =
                    path.includes('/renew') ||
                    path.includes('/subscription') ||
                    path.includes('/subscriptions');

                if (
                    req.method !== "GET" &&
                    !renewalRoute
                ) {

                    return res.status(403).json({
                        success: false,
                        code: "SUBSCRIPTION_EXPIRED",
                        message:
                            "Your yearly subscription has expired. Please renew to continue using ShopPulse."
                    });

                }

            }

        }

        return next();

    } catch (err) {

        console.error("shopStatusMiddleware Error:", err);

        return next(err);

    }
};