const mongoose = require('mongoose');

const idempotencyKeySchema = new mongoose.Schema({
    key: {
        type: String,
        required: true,
        unique: true,
        index: true
    },
    status: {
        type: String,
        required: true,
        enum: ['processing', 'completed'],
        default: 'processing'
    },
    responseStatus: {
        type: Number
    },
    responseBody: {
        type: mongoose.Schema.Types.Mixed
    },
    createdAt: {
        type: Date,
        default: Date.now,
        expires: 86400 // Expire after 24 hours automatically
    }
});

module.exports = mongoose.model('IdempotencyKey', idempotencyKeySchema);
