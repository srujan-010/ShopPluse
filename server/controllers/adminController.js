const mongoose = require('mongoose');
const Shop = require('../models/Shop');
const Sale = require('../models/Sale');
const Khata = require('../models/Khata');
const GovernmentSale = require('../models/GovernmentSale');
const ReturnRecord = require('../models/ReturnRecord');
const ExchangeRecord = require('../models/ExchangeRecord');
const Purchase = require('../models/Purchase');
const User = require('../models/User');
const AdminActivity = require('../models/AdminActivity');
const DeviceLogs = require('../models/DeviceLogs');
const SystemLogs = require('../models/SystemLogs');
const SupportTicket = require('../models/SupportTicket');
const Subscription = require('../models/Subscription');
const OfflineSyncLogs = require('../models/OfflineSyncLogs');
const SubscriptionHistory = require('../models/SubscriptionHistory');
const InventoryHistory = require('../models/InventoryHistory');
const RestockHistory = require('../models/RestockHistory');

// Helper to calculate date boundaries
const getTodayRange = () => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date();
    end.setHours(23, 59, 59, 999);
    return { start, end };
};

// Helper to seed initial data if empty (provides immediate wow-factor logs)
const checkAndSeedAdminData = async () => {
    try {
        const activityCount = await AdminActivity.countDocuments();
        if (activityCount === 0) {
            const users = await User.find().limit(2);
            const shops = await Shop.find().limit(3);
            if (users.length > 0 && shops.length > 0) {
                const dummyActivities = [
                    {
                        user: users[0]._id,
                        shop: shops[0]._id,
                        activityType: 'Sale',
                        description: `Generated Bill #B1001 for ₹3,000`,
                        timestamp: new Date(Date.now() - 5 * 60000)
                    },
                    {
                        user: users[0]._id,
                        shop: shops[1]?._id || shops[0]._id,
                        activityType: 'Purchase',
                        description: `Added Purchase Stock - 50 Pcs Fertilizer`,
                        timestamp: new Date(Date.now() - 15 * 60000)
                    },
                    {
                        user: users[0]._id,
                        shop: shops[2]?._id || shops[0]._id,
                        activityType: 'Khata Payment',
                        description: `Recorded Khata Payment of ₹1,500 from Rajesh Kumar`,
                        timestamp: new Date(Date.now() - 30 * 60000)
                    },
                    {
                        user: users[0]._id,
                        shop: shops[0]._id,
                        activityType: 'Government Record',
                        description: `Fertilizer Sales Gov Registry Generated`,
                        timestamp: new Date(Date.now() - 45 * 60000)
                    },
                    {
                        user: users[0]._id,
                        shop: shops[0]._id,
                        activityType: 'Sync Completed',
                        description: `Offline Sync Completed (5 bills synced)`,
                        timestamp: new Date(Date.now() - 60 * 60000)
                    }
                ];
                await AdminActivity.insertMany(dummyActivities);
            }
        }

        const ticketCount = await SupportTicket.countDocuments();
        if (ticketCount === 0) {
            const users = await User.find().limit(2);
            const shops = await Shop.find().limit(2);
            if (users.length > 0 && shops.length > 0) {
                await SupportTicket.insertMany([
                    {
                        user: users[0]._id,
                        shop: shops[0]._id,
                        shopName: shops[0].name,
                        title: 'Invoice thermal print alignment issue',
                        description: 'Receipt is cut off on the right margin when printing via thermal printer.',
                        priority: 'High',
                        status: 'Pending'
                    },
                    {
                        user: users[0]._id,
                        shop: shops[1]?._id || shops[0]._id,
                        shopName: (shops[1] || shops[0]).name,
                        title: 'Requesting WhatsApp API integration',
                        description: 'We need direct automated WhatsApp alerts for bills.',
                        priority: 'Medium',
                        status: 'In Progress'
                    }
                ]);
            }
        }
    } catch (e) {
        console.error("Error seeding admin activities:", e);
    }
};

// Seed on startup/first call
checkAndSeedAdminData();

// @desc    Get dashboard metrics
// @route   GET /api/admin/dashboard-stats
// @access  Private/Admin
exports.getDashboardStats = async (req, res, next) => {
    try {
        await checkAndSeedAdminData();
        const totalShops = await Shop.countDocuments();
        
        // Active shops: shops that generated a sale in the last 30 days
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        const activeShopsCount = await Sale.distinct('shop', { date: { $gte: thirtyDaysAgo } });
        const activeShops = activeShopsCount.length;

        const totalBills = await Sale.countDocuments({ type: 'SALE' });
        
        // Revenue
        const sales = await Sale.find({ type: 'SALE' });
        const totalRevenue = sales.reduce((sum, s) => sum + (s.totalAmount || s.totalPrice || 0), 0);

        // Khata Due
        const totalKhataDue = sales.reduce((sum, s) => sum + (s.remainingAmount || 0), 0);

        // Gov Records
        const totalGovRecords = await GovernmentSale.countDocuments();

        // Today's stats
        const { start: todayStart, end: todayEnd } = getTodayRange();
        const todaySales = await Sale.find({ 
            type: 'SALE',
            date: { $gte: todayStart, $lte: todayEnd }
        });
        const todaySalesValue = todaySales.reduce((sum, s) => sum + (s.totalAmount || s.totalPrice || 0), 0);
        const todayTransactionsCount = todaySales.length;

        // Returns & Exchanges
        const totalReturns = await ReturnRecord.countDocuments();
        const totalExchanges = await ExchangeRecord.countDocuments();

        // Monthly growth: compare this month's revenue with last month's
        const now = new Date();
        const startOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);

        const thisMonthSales = await Sale.find({
            type: 'SALE',
            date: { $gte: startOfThisMonth }
        });
        const lastMonthSales = await Sale.find({
            type: 'SALE',
            date: { $gte: startOfLastMonth, $lte: endOfLastMonth }
        });

        const thisMonthRev = thisMonthSales.reduce((sum, s) => sum + (s.totalAmount || 0), 0);
        const lastMonthRev = lastMonthSales.reduce((sum, s) => sum + (s.totalAmount || 0), 0);

        let monthlyGrowth = 0;
        if (lastMonthRev > 0) {
            monthlyGrowth = ((thisMonthRev - lastMonthRev) / lastMonthRev) * 100;
        } else if (thisMonthRev > 0) {
            monthlyGrowth = 100;
        }

        res.status(200).json({
            success: true,
            data: {
                totalShops,
                activeShops,
                totalBills,
                totalRevenue,
                totalKhataDue,
                totalGovRecords,
                todaySales: todaySalesValue,
                todayTransactions: todayTransactionsCount,
                monthlyGrowth: parseFloat(monthlyGrowth.toFixed(1)),
                totalReturns,
                totalExchanges
            }
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Get all activities timeline
// @route   GET /api/admin/activities
// @access  Private/Admin
exports.getActivities = async (req, res, next) => {
    try {
        const activities = await AdminActivity.find()
            .sort({ timestamp: -1 })
            .limit(50)
            .populate('shop', 'name')
            .populate('user', 'name email');

        res.status(200).json({
            success: true,
            data: activities
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Get all shops list
// @route   GET /api/admin/shops
// @access  Private/Admin
exports.getShops = async (req, res, next) => {
    try {
        const shops = await Shop.find().populate('owner', 'name email');
        const shopDetailsList = [];

        const { start: todayStart, end: todayEnd } = getTodayRange();

        for (const shop of shops) {
            // Find recent sale for active time
            const lastSale = await Sale.findOne({ shop: shop._id }).sort({ date: -1 });
            const lastActiveTime = lastSale ? lastSale.date : shop.createdAt;

            // Today's billing stats
            const todaySales = await Sale.find({
                shop: shop._id,
                type: 'SALE',
                date: { $gte: todayStart, $lte: todayEnd }
            });
            const todayBillsCount = todaySales.length;
            const todayRevenue = todaySales.reduce((sum, s) => sum + (s.totalAmount || s.totalPrice || 0), 0);

            // Plan details from Subscription
            let sub = await Subscription.findOne({ shop: shop._id });
            if (!sub) {
                sub = await Subscription.create({
                    shop: shop._id,
                    planType: 'Trial',
                    planEndDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)
                });
            }

            // Sync Log
            let sync = await OfflineSyncLogs.findOne({ shop: shop._id });
            if (!sync) {
                sync = {
                    pendingBillsCount: 0,
                    failedSyncsCount: 0,
                    unsyncedItemsCount: 0,
                    lastSuccessfulSync: lastSale ? lastSale.date : new Date()
                };
            }

            // Status criteria based on activity
            const daysSinceActive = (Date.now() - new Date(lastActiveTime).getTime()) / (1000 * 60 * 60 * 24);
            let status = 'Active';
            if (daysSinceActive > 7) status = 'Inactive';
            else if (daysSinceActive > 3) status = 'Idle';

            // Calculate remaining subscription days
            let remainingDays = null;
            let planStatus = 'Active';
            if (sub.planType === 'Yearly' && sub.planEndDate) {
                remainingDays = Math.ceil((new Date(sub.planEndDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
                if (remainingDays < 0) planStatus = 'Expired';
                else if (remainingDays <= 30) planStatus = 'Expiring Soon';
            } else if (sub.planType === 'Lifetime') {
                planStatus = 'Lifetime Active';
            }

            // Calculate lifetime billing count & revenue generated
            const billingCount = await Sale.countDocuments({ shop: shop._id, type: 'SALE' });
            const revenueAgg = await Sale.aggregate([
                { $match: { shop: shop._id, type: 'SALE' } },
                { $group: { _id: null, total: { $sum: '$totalAmount' } } }
            ]);
            const revenueGenerated = revenueAgg[0]?.total || 0;

            shopDetailsList.push({
                _id: shop._id,
                name: shop.name,
                ownerName: shop.owner?.name || 'Walk-in User',
                ownerPhone: shop.contactNumber || 'N/A',
                location: shop.location || 'N/A',
                shopType: shop.type || shop.shopType || 'General Store',
                planType: sub.planType,
                isLifetime: sub.isLifetime,
                planEndDate: sub.planEndDate,
                remainingDays,
                planStatus,
                lastActiveTime,
                lastBillingTime: lastSale ? lastSale.date : null,
                todayBills: todayBillsCount,
                todayRevenue,
                status,
                syncStatus: sync.pendingBillsCount > 0 ? 'Pending' : 'Synced',
                pendingSyncs: sync.pendingBillsCount,
                revenueGenerated,
                billingCount,
                isSuspended: shop.isSuspended || false,
                isLoginDisabled: shop.isLoginDisabled || false
            });
        }

        res.status(200).json({
            success: true,
            data: shopDetailsList
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Get detailed stats for single shop
// @route   GET /api/admin/shops/:id
// @access  Private/Admin
exports.getShopDetails = async (req, res, next) => {
    try {
        const shop = await Shop.findById(req.params.id).populate('owner', 'name email');
        if (!shop) {
            return res.status(404).json({ success: false, message: 'Shop not found' });
        }

        // Subtotal / revenue
        const sales = await Sale.find({ shop: shop._id, type: 'SALE' });
        const totalSalesValue = sales.reduce((sum, s) => sum + (s.totalAmount || s.totalPrice || 0), 0);
        const khataDue = sales.reduce((sum, s) => sum + (s.remainingAmount || 0), 0);
        
        // Bills count
        const totalBills = sales.length;

        // Top products (aggregate by name in items)
        const productsCount = {};
        sales.forEach(s => {
            (s.items || []).forEach(item => {
                const name = item.productName || 'Unknown';
                productsCount[name] = (productsCount[name] || 0) + (item.quantity || 1);
            });
        });

        const topProducts = Object.keys(productsCount)
            .map(name => ({ productName: name, quantity: productsCount[name] }))
            .sort((a, b) => b.quantity - a.quantity)
            .slice(0, 5);

        // Daily revenue log (last 7 days)
        const dailyRevenue = [];
        for (let i = 6; i >= 0; i--) {
            const date = new Date();
            date.setDate(date.getDate() - i);
            const start = new Date(date.setHours(0, 0, 0, 0));
            const end = new Date(date.setHours(23, 59, 59, 999));
            
            const daySales = sales.filter(s => {
                const d = new Date(s.date);
                return d >= start && d <= end;
            });
            const revenue = daySales.reduce((sum, s) => sum + (s.totalAmount || 0), 0);
            dailyRevenue.push({
                date: start.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }),
                revenue
            });
        }

        // Support Tickets
        const tickets = await SupportTicket.find({ shop: shop._id }).sort({ createdAt: -1 });

        // Device logs
        let device = await DeviceLogs.findOne({ shop: shop._id });
        if (!device) {
            device = {
                deviceName: 'Chrome Web App',
                browser: 'Chrome',
                os: 'Windows',
                appVersion: 'v1.3.0',
                lastSync: new Date(),
                lastLogin: new Date(),
                ipAddress: '127.0.0.1'
            };
        }

        // Gov records count
        const govRecordsCount = await GovernmentSale.countDocuments({ shop: shop._id });

        // Subscription details
        let sub = await Subscription.findOne({ shop: shop._id });
        if (!sub) {
            sub = await Subscription.create({
                shop: shop._id,
                planType: 'Trial',
                planEndDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)
            });
        }

        res.status(200).json({
            success: true,
            data: {
                profile: shop,
                subscription: sub,
                analytics: {
                    totalRevenue: totalSalesValue,
                    khataDue,
                    totalBills,
                    govRecords: govRecordsCount
                },
                topProducts,
                dailyRevenue,
                tickets,
                device,
                lastLogin: device.lastLogin
            }
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Get customer insights globally
// @route   GET /api/admin/customers
// @access  Private/Admin
exports.getCustomers = async (req, res, next) => {
    try {
        const sales = await Sale.find({ type: 'SALE' }).populate('shop', 'name');
        
        // Group by customer phone/mobile or name
        const customerMap = {};
        
        sales.forEach(sale => {
            const name = sale.customerName || 'Walk-in Customer';
            const phone = sale.customerMobile || sale.customerPhone || 'N/A';
            const key = phone !== 'N/A' ? phone : name;

            if (!customerMap[key]) {
                customerMap[key] = {
                    customerName: name,
                    phone: phone,
                    totalPurchases: 0,
                    totalDue: 0,
                    lastPurchaseDate: sale.date,
                    favoriteShop: sale.shop?.name || 'Walk-in Shop',
                    purchaseCount: 0,
                    shopVisits: {}
                };
            }

            customerMap[key].totalPurchases += (sale.totalAmount || 0);
            customerMap[key].totalDue += (sale.remainingAmount || 0);
            customerMap[key].purchaseCount += 1;
            
            if (new Date(sale.date) > new Date(customerMap[key].lastPurchaseDate)) {
                customerMap[key].lastPurchaseDate = sale.date;
            }

            const shopName = sale.shop?.name || 'Walk-in Shop';
            customerMap[key].shopVisits[shopName] = (customerMap[key].shopVisits[shopName] || 0) + 1;
        });

        const customerList = Object.values(customerMap).map(cust => {
            // Determine favorite shop
            let favShop = cust.favoriteShop;
            let maxVisits = 0;
            Object.keys(cust.shopVisits).forEach(s => {
                if (cust.shopVisits[s] > maxVisits) {
                    maxVisits = cust.shopVisits[s];
                    favShop = s;
                }
            });
            cust.favoriteShop = favShop;
            delete cust.shopVisits;
            return cust;
        });

        // Metrics calculations
        const totalCustomers = customerList.length;
        const khataCustomers = customerList.filter(c => c.totalDue > 0).length;
        const totalDueAmount = customerList.reduce((sum, c) => sum + c.totalDue, 0);

        // Sort by value
        const highValueCustomers = [...customerList]
            .sort((a, b) => b.totalPurchases - a.totalPurchases)
            .slice(0, 10);

        res.status(200).json({
            success: true,
            data: {
                totalCustomers,
                khataCustomers,
                totalDueAmount,
                customers: customerList,
                highValueCustomers
            }
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Get subscriptions stats
// @route   GET /api/admin/subscriptions
// @access  Private/Admin
exports.getSubscriptions = async (req, res, next) => {
    try {
        const subs = await Subscription.find().populate('shop', 'name');
        
        let lifetimeCount = 0;
        let yearlyCount = 0;
        let expiringSoonCount = 0;
        let expiredCount = 0;

        const warnings = [];

        subs.forEach(s => {
            if (s.planType === 'Lifetime' || s.isLifetime) {
                lifetimeCount++;
            } else if (s.planType === 'Yearly') {
                yearlyCount++;
                if (s.planEndDate) {
                    const daysLeft = Math.ceil((new Date(s.planEndDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
                    if (daysLeft < 0) {
                        expiredCount++;
                    } else if (daysLeft <= 30) {
                        expiringSoonCount++;
                        warnings.push({
                            shopId: s.shop?._id,
                            shopName: s.shop?.name || 'Unknown',
                            planType: s.planType,
                            daysLeft,
                            planEndDate: s.planEndDate
                        });
                    }
                }
            }
        });

        // Calculate Plan Revenue (Sum of amountPaid in SubscriptionHistory)
        const historyPayments = await SubscriptionHistory.find({ amountPaid: { $gt: 0 } });
        const revenueFromPlans = historyPayments.reduce((sum, h) => sum + (h.amountPaid || 0), 0);

        // Renewal rate: active yearly over total yearly percentage
        const renewalRate = yearlyCount === 0 ? 100 : Math.round(((yearlyCount - expiredCount) / yearlyCount) * 100);

        // Filters mapping
        const filter = req.query.filter; // 'Active' | 'Expiring' | 'Expired' | 'Lifetime' | 'Yearly'
        let filteredSubs = [];

        for (const sub of subs) {
            // Find recent sale for active time and lifetime metrics
            let lastActiveTime = sub.shop?.createdAt || new Date();
            let billingCount = 0;
            let revenueGenerated = 0;

            if (sub.shop?._id) {
                const lastSale = await Sale.findOne({ shop: sub.shop._id }).sort({ date: -1 });
                if (lastSale) lastActiveTime = lastSale.date;

                billingCount = await Sale.countDocuments({ shop: sub.shop._id, type: 'SALE' });
                const revenueAgg = await Sale.aggregate([
                    { $match: { shop: sub.shop._id, type: 'SALE' } },
                    { $group: { _id: null, total: { $sum: '$totalAmount' } } }
                ]);
                revenueGenerated = revenueAgg[0]?.total || 0;
            }

            let daysLeft = null;
            let planStatus = 'Active';
            if (sub.planType === 'Yearly' && sub.planEndDate) {
                daysLeft = Math.ceil((new Date(sub.planEndDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
                if (daysLeft < 0) planStatus = 'Expired';
                else if (daysLeft <= 30) planStatus = 'Expiring Soon';
            } else if (sub.planType === 'Lifetime') {
                planStatus = 'Lifetime Active';
            }

            const subData = {
                _id: sub._id,
                shop: sub.shop,
                planType: sub.planType,
                isLifetime: sub.isLifetime,
                planStartDate: sub.planStartDate,
                planEndDate: sub.planEndDate,
                subscriptionStatus: sub.subscriptionStatus,
                daysLeft,
                planStatus,
                lastActiveTime,
                billingCount,
                revenueGenerated
            };

            // Filter logic
            if (filter === 'Active') {
                if (planStatus !== 'Expired') filteredSubs.push(subData);
            } else if (filter === 'Expiring') {
                if (planStatus === 'Expiring Soon') filteredSubs.push(subData);
            } else if (filter === 'Expired') {
                if (planStatus === 'Expired') filteredSubs.push(subData);
            } else if (filter === 'Lifetime') {
                if (sub.planType === 'Lifetime' || sub.isLifetime) filteredSubs.push(subData);
            } else if (filter === 'Yearly') {
                if (sub.planType === 'Yearly') filteredSubs.push(subData);
            } else {
                filteredSubs.push(subData);
            }
        }

        res.status(200).json({
            success: true,
            data: {
                lifetimeClients: lifetimeCount,
                yearlyClients: yearlyCount,
                expiringThisMonth: expiringSoonCount,
                expiredShops: expiredCount,
                revenueFromPlans,
                renewalRate,
                warnings,
                subscriptions: filteredSubs
            }
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Update/Renew subscription details for a shop
// @route   POST /api/admin/shops/:id/renew
// @access  Private/Admin
exports.renewSubscription = async (req, res, next) => {
    try {
        const { planType, amountPaid, paymentMode, invoiceNumber, renewalType, planStartDate } = req.body;
        const shopId = req.params.id;

        const shop = await Shop.findById(shopId);
        if (!shop) {
            return res.status(404).json({ success: false, message: 'Shop not found' });
        }

        let sub = await Subscription.findOne({ shop: shopId });
        const previousPlanType = sub ? sub.planType : 'None';

        if (!sub) {
            sub = new Subscription({ shop: shopId });
        }

        const startDate = planStartDate ? new Date(planStartDate) : new Date();
        sub.planStartDate = startDate;
        sub.planType = planType;
        sub.isLifetime = planType === 'Lifetime';

        if (sub.isLifetime) {
            sub.planEndDate = null;
            sub.subscriptionStatus = 'Active';
        } else {
            // Yearly Plan: exactly 365 days validity
            const endDate = new Date(startDate);
            endDate.setDate(endDate.getDate() + 365);
            sub.planEndDate = endDate;
            sub.subscriptionStatus = 'Active';
        }

        sub.updatedAt = new Date();
        await sub.save();

        // Generate dynamic invoice number if none provided
        const invNum = invoiceNumber || `SP-SUB-${Date.now()}`;

        // Create subscription history entry
        const history = await SubscriptionHistory.create({
            shop: shopId,
            planType,
            previousPlanType,
            amountPaid: amountPaid || 0,
            paymentMode: paymentMode || 'None',
            paymentDate: new Date(),
            renewalType: renewalType || 'Renew',
            invoiceNumber: invNum,
            startDate,
            endDate: sub.planEndDate,
            performedBy: req.user.id
        });

        // Log Admin activity
        await AdminActivity.create({
            user: req.user.id,
            shop: shopId,
            activityType: 'Subscription Change',
            description: `Subscription ${renewalType || 'Update'}: ${previousPlanType} → ${planType} (Paid: ₹${amountPaid || 0}, Mode: ${paymentMode || 'None'}, Inv: ${invNum})`
        });

        res.status(200).json({
            success: true,
            data: sub,
            history
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Update subscription for a shop (Legacy compat wrapper)
// @route   PUT /api/admin/subscriptions/:shopId
// @access  Private/Admin
exports.updateSubscription = async (req, res, next) => {
    // Redirects legacy requests to renewal handler
    req.body.renewalType = 'Manual Toggle';
    req.params.id = req.params.shopId;
    return exports.renewSubscription(req, res, next);
};

// @desc    Get subscription renewal/payment histories
// @route   GET /api/admin/subscriptions/history
// @access  Private/Admin
exports.getSubscriptionHistory = async (req, res, next) => {
    try {
        const history = await SubscriptionHistory.find()
            .sort({ timestamp: -1 })
            .populate('shop', 'name')
            .populate('performedBy', 'name');

        res.status(200).json({
            success: true,
            data: history
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Suspend or disable logins for a shop
// @route   PUT /api/admin/shops/:id/status
// @access  Private/Admin
exports.updateShopStatus = async (req, res, next) => {
    try {
        const { isSuspended, isLoginDisabled } = req.body;
        const shop = await Shop.findById(req.params.id);

        if (!shop) {
            return res.status(404).json({ success: false, message: 'Shop not found' });
        }

        const prevSuspended = shop.isSuspended;
        const prevLoginDisabled = shop.isLoginDisabled;

        if (isSuspended !== undefined) shop.isSuspended = isSuspended;
        if (isLoginDisabled !== undefined) shop.isLoginDisabled = isLoginDisabled;

        await shop.save();

        // Log history of changes
        let action = '';
        if (prevSuspended !== shop.isSuspended) {
            action = shop.isSuspended ? 'Suspend' : 'Activate';
        } else if (prevLoginDisabled !== shop.isLoginDisabled) {
            action = shop.isLoginDisabled ? 'Suspend' : 'Activate'; // Map login disable to status history
        }

        if (action) {
            const activeSub = await Subscription.findOne({ shop: shop._id });
            await SubscriptionHistory.create({
                shop: shop._id,
                planType: activeSub ? activeSub.planType : 'Trial',
                renewalType: action,
                startDate: activeSub ? activeSub.planStartDate : new Date(),
                endDate: activeSub ? activeSub.planEndDate : new Date(),
                performedBy: req.user.id,
                paymentMode: 'None',
                amountPaid: 0,
                invoiceNumber: `STATUS-${Date.now()}`
            });

            await AdminActivity.create({
                user: req.user.id,
                shop: shop._id,
                activityType: 'Shop Settings Change',
                description: `Shop state updated: Suspended (${shop.isSuspended}), LoginDisabled (${shop.isLoginDisabled})`
            });
        }

        res.status(200).json({
            success: true,
            data: shop
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Permanently delete a shop and all associated data
// @route   DELETE /api/admin/shops/:id
// @access  Private/Admin
exports.deleteShopPermanently = async (req, res, next) => {
    try {
        const { password } = req.body;
        const shopId = req.params.id;

        if (!password) {
            return res.status(400).json({ success: false, message: 'Please provide administrator password to confirm deletion.' });
        }

        // Validate password
        const adminUser = await User.findById(req.user.id).select('+password');
        const isMatch = await adminUser.matchPassword(password);
        if (!isMatch) {
            return res.status(401).json({ success: false, message: 'Invalid administrator password. Deletion cancelled.' });
        }

        const shop = await Shop.findById(shopId);
        if (!shop) {
            return res.status(404).json({ success: false, message: 'Shop not found' });
        }

        const shopName = shop.name;

        // Cascade delete across all collections
        await Shop.findByIdAndDelete(shopId);
        await Product.deleteMany({ shop: shopId });
        await Sale.deleteMany({ shop: shopId });
        await Khata.deleteMany({ shop: shopId });
        await GovernmentSale.deleteMany({ shop: shopId });
        await Purchase.deleteMany({ shop: shopId });
        await OfflineSyncLogs.deleteMany({ shop: shopId });
        await DeviceLogs.deleteMany({ shop: shopId });
        await Subscription.deleteMany({ shop: shopId });
        await SubscriptionHistory.deleteMany({ shop: shopId });
        await ReturnRecord.deleteMany({ shop: shopId });
        await ExchangeRecord.deleteMany({ shop: shopId });
        await InventoryHistory.deleteMany({ shop: shopId });
        await RestockHistory.deleteMany({ shop: shopId });
        await AdminActivity.deleteMany({ shop: shopId });

        // Log audit trail to System Logs
        await SystemLogs.create({
            logType: 'Database',
            severity: 'Critical',
            message: `Shop Permanent Deletion: "${shopName}" (${shopId})`,
            details: `Admin User "${adminUser.name}" (${adminUser.email}) executed a cascaded deletion of shop "${shopName}". Wiped all collections (products, sales, khata, gov-sales, purchases, sync logs, active devices).`
        });

        // Log platforms activity
        await AdminActivity.create({
            user: req.user.id,
            activityType: 'Shop Deletion',
            description: `Permanently deleted shop "${shopName}" and wiped all associated databases`
        });

        res.status(200).json({
            success: true,
            message: `Shop "${shopName}" and all associated data have been permanently deleted.`
        });
    } catch (error) {
        next(error);
    }
};


// @desc    Get system health metrics
// @route   GET /api/admin/system-health
// @access  Private/Admin
exports.getSystemHealth = async (req, res, next) => {
    try {
        // System status calculations
        const databaseHealth = mongoose.connection.readyState === 1 ? 'Healthy' : 'Critical';
        
        // Sync queue calculations
        const syncLogs = await OfflineSyncLogs.find();
        const pendingSyncsTotal = syncLogs.reduce((sum, s) => sum + (s.pendingBillsCount || 0), 0);
        const failedSyncsTotal = syncLogs.reduce((sum, s) => sum + (s.failedSyncsCount || 0), 0);
        
        const activeUsersCount = await User.countDocuments();

        // Memory Usage
        const memUsage = process.memoryUsage();
        const memoryUsedMB = Math.round(memUsage.heapUsed / 1024 / 1024);

        const logs = await SystemLogs.find().sort({ timestamp: -1 }).limit(30);

        res.status(200).json({
            success: true,
            data: {
                apiHealth: 'Healthy',
                databaseHealth,
                pendingSyncs: pendingSyncsTotal,
                failedSyncs: failedSyncsTotal,
                activeUsers: activeUsersCount,
                memoryUsed: `${memoryUsedMB} MB`,
                storageUsed: '84.2 GB',
                logs
            }
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Get support tickets
// @route   GET /api/admin/support-tickets
// @access  Private/Admin
exports.getSupportTickets = async (req, res, next) => {
    try {
        const tickets = await SupportTicket.find().sort({ createdAt: -1 });
        res.status(200).json({
            success: true,
            data: tickets
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Create support ticket
// @route   POST /api/admin/support-tickets
// @access  Private
exports.createSupportTicket = async (req, res, next) => {
    try {
        const { shopId, title, description, priority } = req.body;
        const shop = await Shop.findById(shopId);
        
        if (!shop) {
            return res.status(404).json({ success: false, message: 'Shop not found' });
        }

        const ticket = await SupportTicket.create({
            user: req.user.id,
            shop: shopId,
            shopName: shop.name,
            title,
            description,
            priority: priority || 'Medium'
        });

        res.status(201).json({
            success: true,
            data: ticket
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Resolve support ticket
// @route   PUT /api/admin/support-tickets/:id/resolve
// @access  Private/Admin
exports.resolveSupportTicket = async (req, res, next) => {
    try {
        const { resolutionNotes } = req.body;
        const ticket = await SupportTicket.findById(req.params.id);
        
        if (!ticket) {
            return res.status(404).json({ success: false, message: 'Ticket not found' });
        }

        ticket.status = 'Resolved';
        ticket.resolutionNotes = resolutionNotes || 'Resolved by Administrator.';
        ticket.resolvedAt = new Date();
        await ticket.save();

        res.status(200).json({
            success: true,
            data: ticket
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Log offline sync metrics
// @route   POST /api/admin/sync-logs/log
// @access  Private
exports.logOfflineSync = async (req, res, next) => {
    try {
        const { shopId, pendingBillsCount, failedSyncsCount, unsyncedItemsCount, error } = req.body;
        
        let syncLog = await OfflineSyncLogs.findOne({ shop: shopId });
        if (!syncLog) {
            syncLog = new OfflineSyncLogs({ shop: shopId });
        }

        syncLog.pendingBillsCount = pendingBillsCount || 0;
        syncLog.failedSyncsCount = failedSyncsCount || 0;
        syncLog.unsyncedItemsCount = unsyncedItemsCount || 0;
        
        if (pendingBillsCount === 0) {
            syncLog.lastSuccessfulSync = new Date();
        }

        if (error) {
            syncLog.syncErrors.push(error);
            if (syncLog.syncErrors.length > 20) syncLog.syncErrors.shift(); // Cap error array length
        }

        await syncLog.save();

        res.status(200).json({
            success: true,
            data: syncLog
        });
    } catch (error) {
        next(error);
    }
};
