const express = require('express');
const { getShops, createShop, updateShop, deleteShop, exportShopData } = require('../controllers/shopController');
const { protect } = require('../middleware/auth');

const router = express.Router();

router.use(protect);

router.route('/')
    .get(getShops)
    .post(createShop);

router.route('/:id')
    .put(updateShop)
    .delete(deleteShop);

router.get('/:id/export', exportShopData);

module.exports = router;
