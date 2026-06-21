const mongoose = require('mongoose');

const governmentSaleSchema = new mongoose.Schema({
    shop: {
        type: mongoose.Schema.ObjectId,
        ref: 'Shop',
        required: true
    },
    linkedSaleId: {
        type: mongoose.Schema.ObjectId,
        ref: 'Sale'
    },
    invoiceNumber: String,
    customerName: String,
    customerMobile: String,
    customerAadhaar: String,
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
        // Using governmentPrice to explicitly clarify the pricing model used
        governmentPrice: Number,
        returnedQty: {
            type: Number,
            default: 0
        },
        remainingQty: {
            type: Number,
            default: function() {
                return this.soldQtyEntered;
            }
        }
    }],
    totalAmount: {
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
    },
    isInspectionCopy: {
        type: Boolean,
        default: true
    }
});

module.exports = mongoose.model('GovernmentSale', governmentSaleSchema);
