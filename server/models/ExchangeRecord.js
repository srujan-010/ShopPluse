const mongoose = require('mongoose');

const exchangeRecordSchema = new mongoose.Schema({
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
    returnedItems: [{
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
    replacementItems: [{
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
    totalReturnedValue: {
        type: Number,
        required: true
    },
    totalReplacementValue: {
        type: Number,
        required: true
    },
    balanceDifference: {
        type: Number,
        required: true
    },
    paymentMethod: {
        type: String,
        required: true,
        enum: ['Cash', 'UPI', 'Khata']
    },
    totalProfit: {
        type: Number,
        required: true,
        default: 0
    },
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

module.exports = mongoose.model('ExchangeRecord', exchangeRecordSchema);
