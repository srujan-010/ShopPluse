const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
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

function assert(condition, message, detail = '') {
    if (!condition) {
        console.error(`❌ FAIL: ${message}`, detail);
        throw new Error(`Assertion failed: ${message}`);
    } else {
        console.log(`✅ PASS: ${message}`);
    }
}

async function testEndpoints() {
    console.log('🚀 Testing Expiry Alert HTTP Endpoints...\n');

    await mongoose.connect(process.env.MONGODB_URI);

    try {
        let user = await User.findOne({ email: 'owner@shoppulse.com' }) || await User.findOne();
        assert(user, 'Found user');

        const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '1h' });

        let shop = await Shop.findOne({ name: '[EXP-TEST] Endpoint Shop' });
        if (!shop) {
            shop = await Shop.create({
                name: '[EXP-TEST] Endpoint Shop',
                type: 'Retail',
                location: 'Market Street',
                contactNumber: '9988776655',
                owner: user._id
            });
        }

        // Clean previous
        await Product.deleteMany({ name: { $regex: /^\[EXP-EP-TEST\]/ } });

        const now = new Date();
        const addDays = (n) => {
            const d = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12, 0, 0);
            d.setDate(d.getDate() + n);
            return d;
        };

        await Product.create([
            {
                name: '[EXP-EP-TEST] Urea 45kg',
                category: 'Fertilizers',
                quantity: 20,
                unit: 'Bags',
                buyPrice: 266,
                sellPrice: 300,
                expiryDate: addDays(4), // Critical
                batchNumber: 'UREA-B1',
                shop: shop._id,
                owner: user._id
            },
            {
                name: '[EXP-EP-TEST] DAP 50kg',
                category: 'Fertilizers',
                quantity: 15,
                unit: 'Bags',
                buyPrice: 1350,
                sellPrice: 1400,
                expiryDate: addDays(12), // Warning
                batchNumber: 'DAP-B2',
                shop: shop._id,
                owner: user._id
            },
            {
                name: '[EXP-EP-TEST] Roundup Herbicide',
                category: 'Herbicides',
                quantity: 8,
                unit: 'Liters',
                buyPrice: 450,
                sellPrice: 550,
                expiryDate: addDays(30), // Attention
                shop: shop._id,
                owner: user._id
            },
            {
                name: '[EXP-EP-TEST] Expired Fungicide',
                category: 'Pesticides',
                quantity: 5,
                unit: 'Packets',
                buyPrice: 120,
                sellPrice: 180,
                expiryDate: addDays(-2), // Expired
                shop: shop._id,
                owner: user._id
            }
        ]);

        console.log('Created test products for HTTP endpoints test.\n');

        // 1. Test /api/products/expiry-alerts
        console.log('👉 [Endpoint Test 1] GET /api/products/expiry-alerts');
        const alertHttp = await fetch(`http://localhost:5005/api/products/expiry-alerts?shop=${shop._id}&days=45`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        assert(alertHttp.status === 200, 'HTTP 200 OK from /api/products/expiry-alerts');
        const alertRes = await alertHttp.json();
        const alertData = alertRes.data;

        assert(alertData.summary.expiringSoonCount === 3, `Summary has 3 expiring soon (Got: ${alertData.summary.expiringSoonCount})`);
        assert(alertData.summary.expiredCount === 1, `Summary has 1 expired (Got: ${alertData.summary.expiredCount})`);
        assert(alertData.summary.nearestExpiryDays === 4, `Nearest expiry is 4 days (Got: ${alertData.summary.nearestExpiryDays})`);
        assert(alertData.summary.urgency === 'critical', `Urgency is critical (Got: ${alertData.summary.urgency})`);

        assert(alertData.expiringSoon.length === 3, '3 items in expiringSoon array');
        assert(alertData.expiringSoon[0].daysRemaining === 4, '1st expiring item is 4 days away');
        assert(alertData.expiringSoon[1].daysRemaining === 12, '2nd expiring item is 12 days away');
        assert(alertData.expiringSoon[2].daysRemaining === 30, '3rd expiring item is 30 days away');
        assert(alertData.expired.length === 1, '1 item in expired array');
        assert(alertData.expired[0].daysRemaining === -2, 'Expired item is -2 days');

        // 2. Test /api/sales/stats (Dashboard pendingMetrics integration)
        console.log('\n👉 [Endpoint Test 2] GET /api/sales/stats');
        const statsHttp = await fetch(`http://localhost:5005/api/sales/stats?shop=${shop._id}`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        assert(statsHttp.status === 200, 'HTTP 200 OK from /api/sales/stats');
        const statsRes = await statsHttp.json();
        const statsData = statsRes.data;
        const pendingExpiry = statsData.pendingMetrics.expiryAlerts;

        assert(pendingExpiry, 'stats.pendingMetrics.expiryAlerts exists');
        assert(pendingExpiry.expiringSoonCount === 3, `pendingMetrics.expiryAlerts.expiringSoonCount is 3 (Got: ${pendingExpiry.expiringSoonCount})`);
        assert(pendingExpiry.expiredCount === 1, `pendingMetrics.expiryAlerts.expiredCount is 1 (Got: ${pendingExpiry.expiredCount})`);
        assert(pendingExpiry.nearestExpiryDays === 4, `pendingMetrics.expiryAlerts.nearestExpiryDays is 4 (Got: ${pendingExpiry.nearestExpiryDays})`);
        assert(pendingExpiry.urgency === 'critical', `pendingMetrics.expiryAlerts.urgency is critical (Got: ${pendingExpiry.urgency})`);

        console.log('\n🎉 ALL ENDPOINT INTEGRATION CHECKS PASSED!\n');
    } finally {
        await Product.deleteMany({ name: { $regex: /^\[EXP-EP-TEST\]/ } });
        await Shop.deleteMany({ name: { $regex: /^\[EXP-TEST\]/ } });
        await mongoose.disconnect();
        console.log('Cleaned up endpoint test data.');
    }
}

testEndpoints().catch(err => {
    console.error('Endpoint Test Failed:', err.response?.data || err.message);
    process.exit(1);
});
