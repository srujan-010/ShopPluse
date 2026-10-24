const Khata = require('../models/Khata');
const Shop = require('../models/Shop');
const Sale = require('../models/Sale');
const GovernmentSale = require('../models/GovernmentSale');
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

        const khataRecords = await Khata.find({ shop: shopId }).sort({ updatedAt: -1 });
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
        const khataRecord = await Khata.findOne({ _id: req.params.id });
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

// @desc    Update existing Khata customer's name and mobile number
// @route   PUT /api/khata/:id
// @access  Private
exports.updateKhataCustomer = async (req, res) => {
    try {
        const { id } = req.params;
        if (!id || !mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ success: false, message: 'Invalid customer account ID' });
        }

        let { customerName, mobile } = req.body;

        if (!customerName || typeof customerName !== 'string' || !customerName.trim()) {
            return res.status(400).json({ success: false, message: 'Customer name is required' });
        }
        customerName = customerName.trim();

        if (!mobile || typeof mobile !== 'string' || !mobile.trim()) {
            return res.status(400).json({ success: false, message: 'Mobile number is required' });
        }
        const cleanMobile = mobile.replace(/\D/g, '').slice(-10);
        if (cleanMobile.length !== 10) {
            return res.status(400).json({ success: false, message: 'Please enter a valid 10-digit Indian mobile number' });
        }

        const khataRecord = await Khata.findById(id);
        if (!khataRecord) {
            return res.status(404).json({ success: false, message: 'Khata customer account not found' });
        }

        // Shop-level access verification
        const shop = await Shop.findById(khataRecord.shop);
        if (!shop) {
            return res.status(404).json({ success: false, message: 'Associated shop not found' });
        }

        const isOwner = shop.owner.toString() === req.user.id || (khataRecord.owner && khataRecord.owner.toString() === req.user.id);
        const isAdmin = req.user.role === 'admin';
        if (!isOwner && !isAdmin) {
            return res.status(403).json({ success: false, message: 'Not authorized to edit customer details for this shop' });
        }

        // Warn/prevent if the new mobile number is already associated with another customer in the same shop
        const oldMobile = khataRecord.mobile;
        if (cleanMobile !== oldMobile) {
            const duplicate = await Khata.findOne({
                shop: khataRecord.shop,
                mobile: cleanMobile,
                _id: { $ne: khataRecord._id }
            });
            if (duplicate) {
                return res.status(400).json({
                    success: false,
                    message: `Mobile number ${cleanMobile} is already associated with another customer (${duplicate.customerName}) in this shop`
                });
            }
        }

        // Update ONLY name and mobile - strictly preserving outstanding balance and complete transaction history
        khataRecord.customerName = customerName;
        khataRecord.mobile = cleanMobile;
        await khataRecord.save();

        // Update customer references in linked historical sales without altering transaction amounts or dates
        try {
            const linkedSaleIds = (khataRecord.transactions || []).map(t => t.saleId).filter(Boolean);
            const saleFilter = {
                $or: [
                    { _id: { $in: linkedSaleIds } },
                    { shop: khataRecord.shop, customerMobile: oldMobile }
                ]
            };
            await Sale.updateMany(saleFilter, {
                $set: {
                    customerName: customerName,
                    customerMobile: cleanMobile
                }
            });

            await GovernmentSale.updateMany(
                { shop: khataRecord.shop, customerMobile: oldMobile },
                {
                    $set: {
                        customerName: customerName,
                        customerMobile: cleanMobile
                    }
                }
            );
        } catch (linkErr) {
            console.warn('Could not update customer references on historical sales:', linkErr.message);
        }

        res.status(200).json({
            success: true,
            message: 'Customer details updated successfully',
            data: khataRecord
        });
    } catch (error) {
        if (error.code === 11000) {
            return res.status(400).json({
                success: false,
                message: 'This mobile number is already associated with another customer in this shop'
            });
        }
        console.error('Error in updateKhataCustomer:', error);
        res.status(500).json({ success: false, message: error.message || 'Server error while updating customer details' });
    }
};

