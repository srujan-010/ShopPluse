const mongoose = require('mongoose');

const saleSchema = new mongoose.Schema({
    shop: {
        type: mongoose.Schema.ObjectId,
        ref: 'Shop',
        required: true
    },
    invoiceNumber: String,
    customerName: String,
    customerMobile: String,
    items: [{
        product: {
            type: mongoose.Schema.ObjectId,
            ref: 'Product',
            required: true
        },
        productName: String,
        soldQtyEntered: Number,
        soldUnit: String,
        soldQtyBaseUnit: Number,
        pricePerBaseUnit: Number,
        totalPrice: Number,
        // Legacy fields
        quantity: {
            type: Number,
            required: true
        },
        unit: String,
        multiplier: Number,
        price: Number,
        profit: Number
    }],
    totalAmount: {
        type: Number,
        required: true
    },
    totalProfit: {
        type: Number,
        required: true
    },
    paymentMethod: {
        type: String,
        required: true,
        enum: ['Cash', 'UPI', 'Khata']
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
});

module.exports = mongoose.model('Sale', saleSchema);
