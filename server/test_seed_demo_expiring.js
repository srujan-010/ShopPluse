const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');
const dns = require('dns');

try {
    dns.setServers(['8.8.8.8', '1.1.1.1']);
} catch (e) {}

dotenv.config({ path: path.join(__dirname, '.env') });

const User = require('./models/User');
const Shop = require('./models/Shop');
const Product = require('./models/Product');

async function seed() {
    await mongoose.connect(process.env.MONGODB_URI);
    const shopId = '6ad1d099d5145eba50c13795';
    const shop = await Shop.findById(shopId);
    if (!shop) {
        console.error('Shop not found');
        process.exit(1);
    }
    const user = await User.findById(shop.owner);

    // Clean previous demo
    await Product.deleteMany({ name: { $regex: /^\[DEMO\]/ } });

    const now = new Date();
    const addDays = (n) => {
        const d = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12, 0, 0);
        d.setDate(d.getDate() + n);
        return d;
    };

    await Product.create([
        {
            name: '[DEMO] Bio-Pesticide 1L',
            category: 'Pesticides',
            brand: 'AgroCare',
            sku: 'BIO-101',
            quantity: 12,
            unit: 'Liters',
            buyPrice: 350,
            sellPrice: 480,
            batchNumber: 'BIO-4421',
            expiryDate: addDays(4), // Critical (0-7d)
            shop: shop._id,
            owner: user._id
        },
        {
            name: '[DEMO] Urea Fertilizer 50kg',
            category: 'Fertilizers',
            brand: 'KisanGold',
            sku: 'UREA-50',
            quantity: 25,
            unit: 'Bags',
            buyPrice: 266,
            sellPrice: 300,
            batchNumber: 'UREA-901',
            expiryDate: addDays(12), // Warning (8-15d)
            shop: shop._id,
            owner: user._id
        },
        {
            name: '[DEMO] Hybrid Cotton Seeds',
            category: 'Seeds',
            brand: 'Mahyco',
            sku: 'HCS-COTTON',
            quantity: 40,
            unit: 'Packets',
            buyPrice: 650,
            sellPrice: 820,
            batchNumber: 'HCS-202',
            expiryDate: addDays(30), // Attention (16-45d)
            shop: shop._id,
            owner: user._id
        },
        {
            name: '[DEMO] Neem Fungicide 500g',
            category: 'Pesticides',
            brand: 'EcoShield',
            sku: 'NF-500',
            quantity: 6,
            unit: 'Pieces',
            buyPrice: 180,
            sellPrice: 240,
            batchNumber: 'NF-EXPIRED',
            expiryDate: addDays(-5), // Expired Stock
            shop: shop._id,
            owner: user._id
        }
    ]);

    console.log('Successfully seeded 4 demo expiring products in shop', shopId);
    await mongoose.disconnect();
}

seed().catch(err => {
    console.error(err);
    process.exit(1);
});
