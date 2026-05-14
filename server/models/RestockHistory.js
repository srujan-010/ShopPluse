const mongoose = require('mongoose');

const restockHistorySchema = new mongoose.Schema({
    product: {
        type: mongoose.Schema.ObjectId,
        ref: 'Product',
        required: true
    },
    productName: {
        type: String,
        required: true
    },
    quantityAdded: {
        type: Number,
        required: true
    },
    supplier: {
        type: String,
        default: 'Unknown'
    },
    purchasePrice: {
        type: Number,
        default: 0
    },
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
    date: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('RestockHistory', restockHistorySchema);
