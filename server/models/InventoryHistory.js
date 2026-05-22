const mongoose = require('mongoose');

const inventoryHistorySchema = new mongoose.Schema({
    productId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Product',
        required: true
    },
    productName: {
        type: String,
        required: true
    },
    actionType: {
        type: String,
        enum: [
            'STOCK_ADDED',
            'STOCK_SOLD',
            'GOV_SALE',
            'STOCK_RETURNED',
            'STOCK_UPDATED',
            'STOCK_ADJUSTED',
            'PURCHASE_ENTRY',
            'DAMAGED_STOCK'
        ],
        required: true
    },
    quantity: {
        type: Number,
        required: true
    },
    unit: {
        type: String,
        default: 'Piece'
    },
    previousStock: {
        type: Number,
        required: true
    },
    newStock: {
        type: Number,
        required: true
    },
    source: {
        type: String // e.g., 'Prakash Traders', 'Raju', 'System'
    },
    referenceId: {
        type: String // e.g., Invoice Number, Bill Number
    },
    notes: {
        type: String
    },
    shop: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Shop',
        required: true
    },
    owner: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('InventoryHistory', inventoryHistorySchema);
