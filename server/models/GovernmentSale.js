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
        },
        // Tax snapshot fields
        isGstApplicable: {
            type: Boolean,
            default: false
        },
        gstRate: {
            type: Number,
            default: 0
        },
        gstPricingMode: {
            type: String,
            enum: ['inclusive', 'exclusive'],
            default: 'inclusive'
        },
        taxableValue: {
            type: Number,
            default: 0
        },
        gstAmount: {
            type: Number,
            default: 0
        },
        cgst: {
            type: Number,
            default: 0
        },
        sgst: {
            type: Number,
            default: 0
        },
        igst: {
            type: Number,
            default: 0
        },
        lineTotal: {
            type: Number,
            default: 0
        }
    }],
    subtotal: Number,
    taxableAmount: {
        type: Number,
        default: 0
    },
    totalGst: {
        type: Number,
        default: 0
    },
    cgstTotal: {
        type: Number,
        default: 0
    },
    sgstTotal: {
        type: Number,
        default: 0
    },
    igstTotal: {
        type: Number,
        default: 0
    },
    isGstInvoice: {
        type: Boolean,
        default: false
    },
    totalAmount: {
        type: Number,
        required: true
    },
    paymentMethod: {
        type: String,
        required: true,
        enum: ['Cash', 'UPI', 'Khata']
    },
    khataId: {
        type: mongoose.Schema.ObjectId,
        ref: 'Khata',
        default: null
    },
    paidAmount: {
        type: Number,
        default: 0
    },
    remainingAmount: {
        type: Number,
        default: 0
    },
    paymentStatus: {
        type: String,
        enum: ['Paid', 'Partial', 'Unpaid'],
        default: 'Paid'
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
}, { timestamps: true });

module.exports = mongoose.model('GovernmentSale', governmentSaleSchema);
