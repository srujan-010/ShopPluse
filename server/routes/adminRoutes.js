const express = require('express');
const router = express.Router();
const {
    getDashboardStats,
    getActivities,
    getShops,
    getShopDetails,
    getCustomers,
    getSubscriptions,
    updateSubscription,
    getSystemHealth,
    getSupportTickets,
    createSupportTicket,
    resolveSupportTicket,
    logOfflineSync,
    updateShopStatus,
    deleteShopPermanently,
    renewSubscription,
    getSubscriptionHistory
} = require('../controllers/adminController');
const { protect, authorize } = require('../middleware/auth');

// Protected routes (any logged-in shop user can post a support ticket or submit offline sync metrics)
router.use(protect);
router.post('/support-tickets', createSupportTicket);
router.post('/sync-logs/log', logOfflineSync);

// Super Admin Only routes
router.get('/dashboard-stats', protect, authorize('admin'), getDashboardStats);
router.get('/activities', protect, authorize('admin'), getActivities);
router.get('/shops', protect, authorize('admin'), getShops);
router.put('/shops/:id/status', protect, authorize('admin'), updateShopStatus);
router.delete('/shops/:id', protect, authorize('admin'), deleteShopPermanently);
router.post('/shops/:id/renew', protect, authorize('admin'), renewSubscription);
router.get('/shops/:id', protect, authorize('admin'), getShopDetails);
router.get('/customers', protect, authorize('admin'), getCustomers);
router.get('/subscriptions/history', protect, authorize('admin'), getSubscriptionHistory);
router.get('/subscriptions', protect, authorize('admin'), getSubscriptions);
router.put('/subscriptions/:shopId', protect, authorize('admin'), updateSubscription);
router.get('/system-health', protect, authorize('admin'), getSystemHealth);
router.get('/support-tickets', protect, authorize('admin'), getSupportTickets);
router.put('/support-tickets/:id/resolve', protect, authorize('admin'), resolveSupportTicket);

module.exports = router;
