const mongoose = require('mongoose');

const subscriptionHistorySchema = new mongoose.Schema({
    shop: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Shop',
        required: true
    },
    planType: {
        type: String,
        required: true,
        enum: ['Trial', 'Yearly', 'Lifetime', 'Monthly', 'Franchise', 'Enterprise', 'Multi-branch']
    },
    previousPlanType: {
        type: String
    },
    amountPaid: {
        type: Number,
        default: 0
    },
    paymentMode: {
        type: String,
        default: 'None'
    },
    paymentDate: {
        type: Date,
        default: Date.now
    },
    renewalType: {
        type: String,
        enum: ['New', 'Renew', 'Extend', 'Convert', 'Suspend', 'Activate'],
        required: true
    },
    invoiceNumber: {
        type: String
    },
    startDate: {
        type: Date,
        required: true
    },
    endDate: {
        type: Date
    },
    performedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    timestamp: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('SubscriptionHistory', subscriptionHistorySchema);
