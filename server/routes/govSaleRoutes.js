const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { 
    getGovSales, 
    getGovStats, 
    getGovSaleById 
} = require('../controllers/govSaleController');

router.use(protect);

router.route('/')
    .get(getGovSales);

router.route('/stats')
    .get(getGovStats);

router.route('/:id')
    .get(getGovSaleById);

module.exports = router;
