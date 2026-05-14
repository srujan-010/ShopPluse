const express = require('express');
const { 
    getKhataCustomers, 
    getKhataDetails, 
    receiveKhataPayment,
    addKhataSale
} = require('../controllers/khataController');
const { protect } = require('../middleware/auth');

const router = express.Router();

router.use(protect);

router.get('/', getKhataCustomers);
router.get('/:id', getKhataDetails);
router.post('/:id/pay', receiveKhataPayment);
router.post('/sale', addKhataSale);

module.exports = router;
