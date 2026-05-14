const express = require('express');
const router = express.Router();
const { getPurchases, getPurchase, createPurchase, addPurchasePayment } = require('../controllers/purchaseController');
const { protect } = require('../middleware/auth');

// All routes are protected
router.use(protect);

router.route('/')
    .get(getPurchases)
    .post(createPurchase);

router.route('/:id')
    .get(getPurchase);

router.route('/:id/payment')
    .post(addPurchasePayment);

module.exports = router;
