const mongoose = require('mongoose');

const purchaseSchema = new mongoose.Schema({
    shop: {
        type: mongoose.Schema.ObjectId,
        ref: 'Shop',
        required: true
    },
    billNo: {
        type: String,
        required: true
    },
    supplierName: {
        type: String,
        required: true,
        trim: true
    },
    items: [{
        product: {
            type: mongoose.Schema.ObjectId,
            ref: 'Product'
        },
        productName: String,
        quantity: {
            type: Number,
            required: true
        },
        unit: String,
        purchaseRate: {
            type: Number,
            required: true
        },
        itemTotal: {
            type: Number,
            required: true
        }
    }],
    totalAmount: {
        type: Number,
        required: true
    },
    totalItems: {
        type: Number,
        required: true
    },
    paymentStatus: {
        type: String,
        enum: ['Paid', 'Pending', 'Partial Paid', 'Direct Entry'],
        default: 'Paid'
    },
    paymentMethod: {
        type: String,
        enum: ['Cash', 'Online', 'Credit', 'None', 'Bank', 'UPI'],
        default: 'Cash'
    },
    paidAmount: {
        type: Number,
        default: 0
    },
    dueAmount: {
        type: Number,
        default: 0
    },
    supplierPhone: String,
    paymentHistory: [{
        amount: { type: Number, default: 0 },
        mode: { type: String, default: 'Cash' },
        note: { type: String },
        paidAt: { type: Date, default: Date.now }
    }],
    entryType: {
        type: String,
        enum: ['Purchase', 'Opening Stock', 'Adjustment', 'Return Stock'],
        default: 'Purchase'
    },
    notes: String,
    linkedProductId: {
        type: mongoose.Schema.ObjectId,
        ref: 'Product'
    },
    addedBy: {
        type: mongoose.Schema.ObjectId,
        ref: 'User'
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

module.exports = mongoose.model('Purchase', purchaseSchema);
