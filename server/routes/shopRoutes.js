const express = require('express');
const { getShops, createShop, updateShop, deleteShop, exportShopData } = require('../controllers/shopController');
const { protect } = require('../middleware/auth');

const router = express.Router();

router.use(protect);
router.use((req, res, next) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.setHeader('Surrogate-Control', 'no-store');
    next();
});

router.route('/')
    .get(getShops)
    .post(createShop);

router.route('/:id')
    .put(updateShop)
    .delete(deleteShop);

router.get('/:id/export', exportShopData);

module.exports = router;
