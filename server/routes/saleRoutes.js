const express = require('express');
const { getSales, createSale, getStats, getReports, getSalesHistory, getAggregatedSummaries, getSaleById, processReturn, processExchange } = require('../controllers/saleController');
const { protect } = require('../middleware/auth');

const router = express.Router();

router.use(protect);

// Dynamic transactional data must never be cached or return 304
router.use((req, res, next) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.setHeader('Surrogate-Control', 'no-store');
    next();
});

router.get('/stats', getStats);
router.get('/reports', getReports);
router.get('/history', getSalesHistory);
router.get('/summaries', getAggregatedSummaries);

router.post('/:id/return', processReturn);
router.post('/:id/exchange', processExchange);

router.route('/:id')
    .get(getSaleById);

router.route('/')
    .get(getSales)
    .post(createSale);

module.exports = router;
