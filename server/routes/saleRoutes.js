const express = require('express');
const { getSales, createSale, getStats, getReports, getSalesHistory, getAggregatedSummaries, getSaleById, processReturn, processExchange } = require('../controllers/saleController');
const { protect } = require('../middleware/auth');

const router = express.Router();

router.use(protect);

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
