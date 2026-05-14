const express = require('express');
const { getProducts, createProduct, updateProduct, deleteProduct, getProductRestockHistory, restockProduct } = require('../controllers/productController');
const { protect } = require('../middleware/auth');

const router = express.Router();

router.use(protect);

router.route('/')
    .get(getProducts)
    .post(createProduct);

router.route('/:id')
    .put(updateProduct)
    .delete(deleteProduct);

router.route('/:id/restock')
    .post(restockProduct);

router.get('/:id/restock-history', getProductRestockHistory);

module.exports = router;
