const mongoose = require('mongoose');

const deviceLogsSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    shop: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Shop'
    },
    deviceName: {
        type: String,
        default: 'Unknown Device'
    },
    browser: {
        type: String,
        default: 'Unknown Browser'
    },
    os: {
        type: String,
        default: 'Unknown OS'
    },
    appVersion: {
        type: String,
        default: 'v1.0.0'
    },
    ipAddress: {
        type: String,
        default: '127.0.0.1'
    },
    lastLogin: {
        type: Date,
        default: Date.now
    },
    lastSync: {
        type: Date,
        default: Date.now
    },
    offlineUsageCount: {
        type: Number,
        default: 0
    }
});

module.exports = mongoose.model('DeviceLogs', deviceLogsSchema);
