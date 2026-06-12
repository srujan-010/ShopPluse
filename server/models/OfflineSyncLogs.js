const mongoose = require('mongoose');

const offlineSyncLogsSchema = new mongoose.Schema({
    shop: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Shop',
        required: true
    },
    pendingBillsCount: {
        type: Number,
        default: 0
    },
    failedSyncsCount: {
        type: Number,
        default: 0
    },
    unsyncedItemsCount: {
        type: Number,
        default: 0
    },
    lastSuccessfulSync: {
        type: Date
    },
    syncErrors: [
        {
            type: String
        }
    ],
    timestamp: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('OfflineSyncLogs', offlineSyncLogsSchema);
