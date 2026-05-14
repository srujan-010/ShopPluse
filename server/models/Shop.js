const mongoose = require('mongoose');

const shopSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Please add a shop name'],
        trim: true
    },
    type: {
        type: String,
        required: [true, 'Please add a shop type']
    },
    location: {
        type: String,
        required: [true, 'Please add a location']
    },
    contactNumber: {
        type: String,
        required: [true, 'Please add a contact number']
    },
    ownerName: String,
    whatsappNumber: String,
    logo: String,
    invoicePrefix: {
        type: String,
        default: 'INV'
    },
    currency: {
        type: String,
        default: '₹'
    },
    gstNumber: String,
    email: String,
    footerMessage: {
        type: String,
        default: 'Thank you! Visit again.'
    },
    upiId: String,
    invoiceCounter: {
        type: Number,
        default: 1000
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

module.exports = mongoose.model('Shop', shopSchema);
