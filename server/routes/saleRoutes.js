const express = require('express');
const { getSales, createSale, getStats, getReports, getSalesHistory, getAggregatedSummaries, getSaleById } = require('../controllers/saleController');
const { protect } = require('../middleware/auth');

const router = express.Router();

router.use(protect);

router.get('/stats', getStats);
router.get('/reports', getReports);
router.get('/history', getSalesHistory);
router.get('/summaries', getAggregatedSummaries);

router.route('/:id')
    .get(getSaleById);

router.route('/')
    .get(getSales)
    .post(createSale);

module.exports = router;
