const mongoose = require('mongoose');

const returnRecordSchema = new mongoose.Schema({
    shop: {
        type: mongoose.Schema.ObjectId,
        ref: 'Shop',
        required: true
    },
    originalSale: {
        type: mongoose.Schema.ObjectId,
        ref: 'Sale',
        required: true
    },
    invoiceNumber: {
        type: String,
        required: true
    },
    customerName: String,
    customerMobile: String,
    items: [{
        product: {
            type: mongoose.Schema.ObjectId,
            ref: 'Product',
            required: true
        },
        productName: String,
        quantity: {
            type: Number,
            required: true
        },
        unit: String,
        price: {
            type: Number,
            required: true
        },
        totalPrice: {
            type: Number,
            required: true
        }
    }],
    totalRefundAmount: {
        type: Number,
        required: true
    },
    refundMethod: {
        type: String,
        required: true,
        enum: ['Cash', 'UPI', 'Khata']
    },
    reason: String,
    date: {
        type: Date,
        default: Date.now
    },
    owner: {
        type: mongoose.Schema.ObjectId,
        ref: 'User',
        required: true
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('ReturnRecord', returnRecordSchema);
