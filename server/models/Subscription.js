const mongoose = require('mongoose');

const subscriptionSchema = new mongoose.Schema({
    shop: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Shop',
        required: true
    },
    planType: {
        type: String,
        enum: ['Trial', 'Monthly', 'Yearly', 'Lifetime'],
        default: 'Trial'
    },
    isLifetime: {
        type: Boolean,
        default: false
    },
    planStartDate: {
        type: Date,
        default: Date.now
    },
    planEndDate: {
        type: Date
    },
    subscriptionStatus: {
        type: String,
        enum: ['Active', 'Expired', 'Cancelled'],
        default: 'Active'
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('Subscription', subscriptionSchema);
