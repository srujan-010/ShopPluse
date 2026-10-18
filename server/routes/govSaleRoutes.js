const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { 
    getGovSales, 
    getGovStats, 
    getGovSaleById,
    createGovSale,
    getDiscrepancies,
    correctHistorical
} = require('../controllers/govSaleController');

router.use(protect);
router.use((req, res, next) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.setHeader('Surrogate-Control', 'no-store');
    next();
});

router.route('/')
    .get(getGovSales)
    .post(createGovSale);

router.route('/stats')
    .get(getGovStats);

router.route('/discrepancies')
    .get(getDiscrepancies);

router.route('/correct-historical')
    .post(correctHistorical);

router.route('/:id')
    .get(getGovSaleById);

module.exports = router;
