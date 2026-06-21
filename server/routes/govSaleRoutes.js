const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { 
    getGovSales, 
    getGovStats, 
    getGovSaleById,
    createGovSale
} = require('../controllers/govSaleController');

router.use(protect);

router.route('/')
    .get(getGovSales)
    .post(createGovSale);

router.route('/stats')
    .get(getGovStats);

router.route('/:id')
    .get(getGovSaleById);

module.exports = router;
