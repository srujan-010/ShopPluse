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
    isGstApplicable: {
        type: Boolean,
        default: false
    },
    gstRate: {
        type: Number,
        default: 0,
        min: 0,
        max: 100
    },
    gstPricingMode: {
        type: String,
        enum: ['inclusive', 'exclusive'],
        default: 'inclusive'
    },
    expiryDate: Date,
    batchNumber: {
        type: String,
        trim: true
    },
    batches: [{
        batchNumber: {
            type: String,
            trim: true
        },
        quantity: {
            type: Number,
            default: 0,
            min: 0
        },
        expiryDate: Date,
        buyPrice: {
            type: Number,
            default: 0
        },
        sellPrice: {
            type: Number,
            default: 0
        }
    }],
    supplier: String,
    supplierPhone: {
        type: String,
        trim: true
    },
    billNo: {
        type: String,
        trim: true
    },
    purchaseDate: Date,
    entryType: {
        type: String,
        enum: ['Purchase', 'Opening Stock', 'Adjustment', 'Return Stock'],
        default: 'Purchase'
    },
    paymentMethod: {
        type: String,
        enum: ['Cash', 'Online', 'Credit', 'None', 'Bank', 'UPI', 'Bank Transfer'],
        default: 'Cash'
    },
    paymentStatus: {
        type: String,
        enum: ['Paid', 'Pending', 'Partial Paid', 'Direct Entry'],
        default: 'Paid'
    },
    amountPaid: {
        type: Number,
        default: 0,
        min: 0
    },
    isFullPaid: {
        type: Boolean,
        default: false
    },
    initialPurchaseId: {
        type: mongoose.Schema.ObjectId,
        ref: 'Purchase'
    },
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

productSchema.pre('save', function () {
    if (this.gstRate !== undefined) {
        this.gst = this.gstRate;
    } else if (this.gst !== undefined) {
        this.gstRate = this.gst;
    }
    if (this.isGstApplicable === undefined) {
        this.isGstApplicable = (this.gstRate || this.gst || 0) > 0;
    }
    if (!this.gstPricingMode) {
        this.gstPricingMode = 'inclusive';
    }
});

module.exports = mongoose.model('Product', productSchema);
