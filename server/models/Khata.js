const mongoose = require('mongoose');

const khataSchema = new mongoose.Schema({
    shop: {
        type: mongoose.Schema.ObjectId,
        ref: 'Shop',
        required: true
    },
    owner: {
        type: mongoose.Schema.ObjectId,
        ref: 'User',
        required: true
    },
    customerName: {
        type: String,
        required: true,
        trim: true
    },
    mobile: {
        type: String,
        required: true,
        trim: true
    },
    outstandingDue: {
        type: Number,
        default: 0
    },
    lastPaymentDate: {
        type: Date
    },
    dueDate: {
        type: Date
    },
    transactions: [{
        type: {
            type: String,
            enum: ['due', 'payment'],
            required: true
        },
        amount: {
            type: Number,
            required: true
        },
        date: {
            type: Date,
            default: Date.now
        },
        note: String,
        saleId: {
            type: mongoose.Schema.ObjectId,
            ref: 'Sale'
        },
        paymentMethod: String,
        isPOSSale: {
            type: Boolean,
            default: false
        },
        items: [{
            productName: String,
            quantity: Number,
            unit: String,
            price: Number
        }]
    }]
}, {
    timestamps: true
});

// Compound index to ensure customer mobile uniqueness per shop
khataSchema.index({ shop: 1, mobile: 1 }, { unique: true });

module.exports = mongoose.model('Khata', khataSchema);
