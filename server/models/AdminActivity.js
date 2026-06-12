const mongoose = require('mongoose');

const adminActivitySchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    shop: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Shop'
    },
    activityType: {
        type: String,
        enum: [
            'Sale',
            'Return',
            'Exchange',
            'Purchase',
            'Khata Payment',
            'Government Record',
            'Login',
            'Sync Completed',
            'Offline Sync Pending',
            'System Log',
            'Subscription Change'
        ],
        required: true
    },
    description: {
        type: String,
        required: true
    },
    timestamp: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('AdminActivity', adminActivitySchema);
