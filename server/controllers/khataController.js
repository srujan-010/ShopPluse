const Khata = require('../models/Khata');
const mongoose = require('mongoose');

// @desc    Get all Khata customers for a shop
// @route   GET /api/khata?shopId=...
// @access  Private
exports.getKhataCustomers = async (req, res) => {
    try {
        const { shopId } = req.query;
        if (!shopId || !mongoose.Types.ObjectId.isValid(shopId)) {
            return res.status(400).json({ success: false, message: 'Provide a valid shopId' });
        }

        const khataRecords = await Khata.find({ shop: shopId, owner: req.user.id }).sort({ updatedAt: -1 });
        res.status(200).json({ success: true, data: khataRecords });
    } catch (error) {
        console.error('Error in getKhataCustomers:', error);
        res.status(500).json({ success: false, message: 'Server Error while fetching Khata records' });
    }
};

// @desc    Get full transaction history for single Khata customer
// @route   GET /api/khata/:id
// @access  Private
exports.getKhataDetails = async (req, res) => {
    try {
        const khataRecord = await Khata.findOne({ _id: req.params.id, owner: req.user.id });
        if (!khataRecord) {
            return res.status(404).json({ success: false, message: 'Khata record not found' });
        }
        res.status(200).json({ success: true, data: khataRecord });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};

// @desc    Receive payment against Khata outstanding
// @route   POST /api/khata/:id/pay
// @access  Private
exports.receiveKhataPayment = async (req, res) => {
    try {
        const { amount, note } = req.body;
        if (!amount || amount <= 0) {
            return res.status(400).json({ success: false, message: 'Provide a valid payment amount' });
        }

        const khataRecord = await Khata.findOne({ _id: req.params.id, owner: req.user.id });
        if (!khataRecord) {
            return res.status(404).json({ success: false, message: 'Khata record not found' });
        }

        khataRecord.outstandingDue = parseFloat((khataRecord.outstandingDue - amount).toFixed(2));
        khataRecord.lastPaymentDate = new Date();
        khataRecord.transactions.push({
            type: 'payment',
            amount: parseFloat(amount),
            date: new Date(),
            note: note || 'Khata Payment Received'
        });

        await khataRecord.save();
        res.status(200).json({ success: true, data: khataRecord });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};

// @desc    Record direct due sale into Khata
// @route   POST /api/khata/sale
// @access  Private
exports.addKhataSale = async (req, res) => {
    try {
        const { shopId, customerName, mobile, amount, note } = req.body;
        if (!shopId || !customerName || !mobile) {
            return res.status(400).json({ success: false, message: 'Provide shopId, customerName, and mobile number' });
        }

        let khataRecord = await Khata.findOne({ shop: shopId, mobile: mobile.trim(), owner: req.user.id });

        if (!khataRecord) {
            khataRecord = new Khata({
                shop: shopId,
                owner: req.user.id,
                customerName: customerName.trim(),
                mobile: mobile.trim(),
                outstandingDue: 0,
                transactions: []
            });
        }

        if (amount && parseFloat(amount) > 0) {
            khataRecord.outstandingDue = parseFloat((khataRecord.outstandingDue + parseFloat(amount)).toFixed(2));
            khataRecord.transactions.push({
                type: 'due',
                amount: parseFloat(amount),
                date: new Date(),
                note: note || 'Direct Khata Entry'
            });
        }

        await khataRecord.save();
        res.status(200).json({ success: true, data: khataRecord });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};
