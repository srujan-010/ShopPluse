const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Please add a product name'],
        trim: true
    },
    category: {
        type: String,
        required: [true, 'Please add a category']
    },
    brand: String,
    sku: String,
    barcode: String,
    productType: {
        type: String,
        enum: ['Piece', 'Measured'],
        default: 'Piece'
    },
    quantity: {
        type: Number,
        required: [true, 'Please add quantity'],
        default: 0,
        min: 0
    },
    unit: {
        type: String,
        default: 'Piece'
    },
    allowPartialSelling: {
        type: Boolean,
        default: false
    },
    allowedUnits: [{
        type: String
    }],
    buyPrice: {
        type: Number,
        default: 0,
        min: 0,
        max: 10000000
    },
    sellPrice: {
        type: Number,
        required: [true, 'Please add sell price'],
        min: 0,
        max: 10000000
    },
    governmentPrice: {
        type: Number,
        min: 0,
        max: 10000000
    },
    lowStockLimit: {
        type: Number,
        default: 5,
        min: 0
    },
    gst: {
        type: Number,
        default: 0,
        min: 0,
        max: 100
    },
    expiryDate: Date,
    supplier: String,
    notes: String,
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
    createdAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('Product', productSchema);
