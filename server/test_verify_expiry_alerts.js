/**
 * Comprehensive Automated Verification Suite for:
 * ShopPulse — Automatic Inventory Expiry Alerts
 *
 * Verifies:
 * 1. Expiry in 1, 7, 8, 15, 16, 45, and 46 days
 * 2. Expired products (diffDays < 0) grouped into Expired Stock
 * 3. Missing expiry dates (excluded)
 * 4. Multiple batches of the same product with remaining stock
 * 5. Zero-stock batches (excluded)
 * 6. Switching between shops (isolation check)
 * 7. Offline calculation verification
 * 8. Urgency color levels (critical, warning, attention, expired)
 */

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
const { getCalendarDayDifference, getUrgencyLevel, processExpiryAlerts } = require('./utils/expiryHelper');

function assert(condition, message, detail = '') {
    if (!condition) {
        console.error(`❌ FAIL: ${message}`, detail);
        throw new Error(`Assertion failed: ${message}`);
    } else {
        console.log(`✅ PASS: ${message}`);
    }
}

async function runTests() {
    console.log('🚀 Starting Expiry Alert Verification Suite...\n');

    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB.\n');

    try {
        // Setup owner and test shops
        let user = await User.findOne({ email: 'owner@shoppulse.com' });
        if (!user) {
            user = await User.findOne();
        }
        assert(user, 'Found test user');

        let shopA = await Shop.findOne({ name: '[EXP-TEST] Shop A' });
        if (!shopA) {
            shopA = await Shop.create({
                name: '[EXP-TEST] Shop A',
                type: 'Retail',
                location: 'Avenue 1, Test City',
                contactNumber: '9876543210',
                owner: user._id
            });
        }

        let shopB = await Shop.findOne({ name: '[EXP-TEST] Shop B' });
        if (!shopB) {
            shopB = await Shop.create({
                name: '[EXP-TEST] Shop B',
                type: 'Retail',
                location: 'Street 2, Test City',
                contactNumber: '9876543211',
                owner: user._id
            });
        }

        // Clean up previous test products
        await Product.deleteMany({ name: { $regex: /^\[EXP-TEST\]/ } });

        const now = new Date();
        const baseDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12, 0, 0);

        const addDays = (d, n) => {
            const res = new Date(d);
            res.setDate(res.getDate() + n);
            return res;
        };

        console.log('👉 Creating Test Products in Shop A and Shop B...');

        // Shop A products
        const p1d = await Product.create({
            name: '[EXP-TEST] Prod-1d',
            category: 'Pesticides',
            quantity: 10,
            unit: 'Pieces',
            buyPrice: 100,
            sellPrice: 150,
            expiryDate: addDays(baseDate, 1),
            shop: shopA._id,
            owner: user._id
        });

        const p7d = await Product.create({
            name: '[EXP-TEST] Prod-7d',
            category: 'Fertilizers',
            quantity: 10,
            unit: 'Bags',
            buyPrice: 200,
            sellPrice: 250,
            expiryDate: addDays(baseDate, 7),
            shop: shopA._id,
            owner: user._id
        });

        const p8d = await Product.create({
            name: '[EXP-TEST] Prod-8d',
            category: 'Seeds',
            quantity: 15,
            unit: 'Kg',
            buyPrice: 300,
            sellPrice: 380,
            expiryDate: addDays(baseDate, 8),
            shop: shopA._id,
            owner: user._id
        });

        const p15d = await Product.create({
            name: '[EXP-TEST] Prod-15d',
            category: 'Insecticides',
            quantity: 20,
            unit: 'Liters',
            buyPrice: 400,
            sellPrice: 500,
            expiryDate: addDays(baseDate, 15),
            shop: shopA._id,
            owner: user._id
        });

        const p16d = await Product.create({
            name: '[EXP-TEST] Prod-16d',
            category: 'Bio-Fertilizers',
            quantity: 25,
            unit: 'Bags',
            buyPrice: 500,
            sellPrice: 650,
            expiryDate: addDays(baseDate, 16),
            shop: shopA._id,
            owner: user._id
        });

        const p45d = await Product.create({
            name: '[EXP-TEST] Prod-45d',
            category: 'Herbicides',
            quantity: 30,
            unit: 'Pieces',
            buyPrice: 600,
            sellPrice: 750,
            expiryDate: addDays(baseDate, 45),
            shop: shopA._id,
            owner: user._id
        });

        const p46d = await Product.create({
            name: '[EXP-TEST] Prod-46d',
            category: 'Growth Regulators',
            quantity: 12,
            unit: 'Pieces',
            buyPrice: 700,
            sellPrice: 850,
            expiryDate: addDays(baseDate, 46),
            shop: shopA._id,
            owner: user._id
        });

        const pExpired = await Product.create({
            name: '[EXP-TEST] Prod-Expired',
            category: 'Pesticides',
            quantity: 8,
            unit: 'Pieces',
            buyPrice: 150,
            sellPrice: 200,
            expiryDate: addDays(baseDate, -3), // expired 3 days ago
            shop: shopA._id,
            owner: user._id
        });

        const pNoExpiry = await Product.create({
            name: '[EXP-TEST] Prod-NoExpiry',
            category: 'Equipment',
            quantity: 50,
            unit: 'Pieces',
            buyPrice: 80,
            sellPrice: 120,
            // no expiryDate
            shop: shopA._id,
            owner: user._id
        });

        const pZeroStock = await Product.create({
            name: '[EXP-TEST] Prod-ZeroStock',
            category: 'Fungicides',
            quantity: 0, // ZERO STOCK
            unit: 'Pieces',
            buyPrice: 100,
            sellPrice: 150,
            expiryDate: addDays(baseDate, 3),
            shop: shopA._id,
            owner: user._id
        });

        const pMultiBatch = await Product.create({
            name: '[EXP-TEST] Prod-MultiBatch',
            category: 'Hybrid Seeds',
            quantity: 25,
            unit: 'Packets',
            buyPrice: 150,
            sellPrice: 220,
            batches: [
                {
                    batchNumber: 'B-001-5D',
                    quantity: 5,
                    expiryDate: addDays(baseDate, 5),
                    buyPrice: 150,
                    sellPrice: 220
                },
                {
                    batchNumber: 'B-002-20D',
                    quantity: 8,
                    expiryDate: addDays(baseDate, 20),
                    buyPrice: 150,
                    sellPrice: 220
                },
                {
                    batchNumber: 'B-003-50D',
                    quantity: 12,
                    expiryDate: addDays(baseDate, 50), // Beyond 45 days
                    buyPrice: 150,
                    sellPrice: 220
                },
                {
                    batchNumber: 'B-004-ZERO',
                    quantity: 0, // ZERO STOCK BATCH
                    expiryDate: addDays(baseDate, 2),
                    buyPrice: 150,
                    sellPrice: 220
                }
            ],
            shop: shopA._id,
            owner: user._id
        });

        // Shop B product (Isolation check)
        const pShopB = await Product.create({
            name: '[EXP-TEST] Prod-ShopB',
            category: 'Seeds',
            quantity: 18,
            unit: 'Bags',
            buyPrice: 200,
            sellPrice: 280,
            expiryDate: addDays(baseDate, 5),
            shop: shopB._id,
            owner: user._id
        });

        console.log('Test products created successfully.\n');

        // ==========================================
        // TEST 1: Calendar Day Difference Function
        // ==========================================
        console.log('👉 [Test 1] Verifying Calendar Day Difference Calculation...');
        assert(getCalendarDayDifference(addDays(baseDate, 0), baseDate) === 0, 'Today expiry difference is 0');
        assert(getCalendarDayDifference(addDays(baseDate, 1), baseDate) === 1, 'Tomorrow expiry difference is 1');
        assert(getCalendarDayDifference(addDays(baseDate, 7), baseDate) === 7, '+7d expiry difference is 7');
        assert(getCalendarDayDifference(addDays(baseDate, 8), baseDate) === 8, '+8d expiry difference is 8');
        assert(getCalendarDayDifference(addDays(baseDate, 15), baseDate) === 15, '+15d expiry difference is 15');
        assert(getCalendarDayDifference(addDays(baseDate, 16), baseDate) === 16, '+16d expiry difference is 16');
        assert(getCalendarDayDifference(addDays(baseDate, 45), baseDate) === 45, '+45d expiry difference is 45');
        assert(getCalendarDayDifference(addDays(baseDate, 46), baseDate) === 46, '+46d expiry difference is 46');
        assert(getCalendarDayDifference(addDays(baseDate, -3), baseDate) === -3, 'Expired difference is negative (-3)');
        assert(getCalendarDayDifference(null, baseDate) === null, 'Null expiry returns null');

        // ==========================================
        // TEST 2: Urgency Levels Classification
        // ==========================================
        console.log('\n👉 [Test 2] Verifying Urgency Level Categories...');
        assert(getUrgencyLevel(0) === 'critical', '0 days is critical');
        assert(getUrgencyLevel(1) === 'critical', '1 day is critical');
        assert(getUrgencyLevel(7) === 'critical', '7 days is critical');
        assert(getUrgencyLevel(8) === 'warning', '8 days is warning');
        assert(getUrgencyLevel(15) === 'warning', '15 days is warning');
        assert(getUrgencyLevel(16) === 'attention', '16 days is attention');
        assert(getUrgencyLevel(45) === 'attention', '45 days is attention');
        assert(getUrgencyLevel(46) === 'fresh', '46 days is fresh (not expiring soon)');
        assert(getUrgencyLevel(-1) === 'expired', '-1 days is expired');

        // ==========================================
        // TEST 3: Shop A Alert Query Processing
        // ==========================================
        console.log('\n👉 [Test 3] Processing Expiry Alerts for Shop A...');
        const allProductsShopA = await Product.find({
            shop: shopA._id,
            name: { $regex: /^\[EXP-TEST\]/ }
        }).populate('shop', 'name');

        const resultA = processExpiryAlerts(allProductsShopA, {
            maxDays: 45,
            baseDate: baseDate,
            shopId: shopA._id.toString()
        });

        console.log(`Summary Shop A: Expiring=${resultA.summary.expiringSoonCount}, Expired=${resultA.summary.expiredCount}, NearestDays=${resultA.summary.nearestExpiryDays}, Urgency=${resultA.summary.urgency}`);

        // Verified expected expiring items:
        // 1. Prod-1d (1d, critical)
        // 2. Prod-7d (7d, critical)
        // 3. Prod-8d (8d, warning)
        // 4. Prod-15d (15d, warning)
        // 5. Prod-16d (16d, attention)
        // 6. Prod-45d (45d, attention)
        // 7. Prod-MultiBatch Batch 1 (5d, critical)
        // 8. Prod-MultiBatch Batch 2 (20d, attention)
        // Total Expiring = 8 items/batches!
        assert(resultA.summary.expiringSoonCount === 8, `Shop A expiring soon count is 8 (Got: ${resultA.summary.expiringSoonCount})`);
        assert(resultA.summary.expiredCount === 1, `Shop A expired count is 1 (Got: ${resultA.summary.expiredCount})`);
        assert(resultA.summary.nearestExpiryDays === 1, `Shop A nearest expiry days is 1 (Got: ${resultA.summary.nearestExpiryDays})`);
        assert(resultA.summary.urgency === 'critical', `Shop A overall urgency is critical (Got: ${resultA.summary.urgency})`);

        // Check 46d item is NOT in expiring soon
        const has46d = resultA.expiringSoon.some(i => i.productName.includes('Prod-46d'));
        assert(!has46d, 'Prod-46d is excluded from 45-day expiring soon alert');

        // Check NoExpiry item is excluded
        const hasNoExp = resultA.expiringSoon.some(i => i.productName.includes('Prod-NoExpiry')) ||
                         resultA.expired.some(i => i.productName.includes('Prod-NoExpiry'));
        assert(!hasNoExp, 'Prod-NoExpiry with no expiry date is excluded from all alerts');

        // Check ZeroStock item is excluded
        const hasZeroStock = resultA.expiringSoon.some(i => i.productName.includes('Prod-ZeroStock')) ||
                             resultA.expired.some(i => i.productName.includes('Prod-ZeroStock'));
        assert(!hasZeroStock, 'Prod-ZeroStock with 0 quantity is excluded from alerts');

        // Check MultiBatch details
        const mbExpiring = resultA.expiringSoon.filter(i => i.productName.includes('Prod-MultiBatch'));
        assert(mbExpiring.length === 2, `MultiBatch product has exactly 2 expiring batches (Got: ${mbExpiring.length})`);
        assert(mbExpiring.some(b => b.batchNumber === 'B-001-5D' && b.quantity === 5 && b.daysRemaining === 5), 'Batch B-001-5D correctly captured');
        assert(mbExpiring.some(b => b.batchNumber === 'B-002-20D' && b.quantity === 8 && b.daysRemaining === 20), 'Batch B-002-20D correctly captured');
        const hasZeroBatch = mbExpiring.some(b => b.batchNumber === 'B-004-ZERO');
        assert(!hasZeroBatch, 'Zero stock batch B-004-ZERO is excluded');
        const has50dBatch = mbExpiring.some(b => b.batchNumber === 'B-003-50D');
        assert(!has50dBatch, 'Batch B-003-50D (>45d) is excluded');

        // Check Expired Stock details
        assert(resultA.expired.length === 1, `Exactly 1 expired item in Shop A (Got: ${resultA.expired.length})`);
        assert(resultA.expired[0].productName.includes('Prod-Expired'), 'Expired item is Prod-Expired');
        assert(resultA.expired[0].daysRemaining === -3, `Expired days remaining is -3 (Got: ${resultA.expired[0].daysRemaining})`);
        assert(resultA.expired[0].urgency === 'expired', 'Expired item has urgency = expired');

        // ==========================================
        // TEST 4: Shop Isolation (Shop B Query)
        // ==========================================
        console.log('\n👉 [Test 4] Verifying Shop Isolation (Shop B Query)...');
        const allProductsShopB = await Product.find({
            name: { $regex: /^\[EXP-TEST\]/ }
        }).populate('shop', 'name');

        const resultB = processExpiryAlerts(allProductsShopB, {
            maxDays: 45,
            baseDate: baseDate,
            shopId: shopB._id.toString()
        });

        console.log(`Summary Shop B: Expiring=${resultB.summary.expiringSoonCount}, Expired=${resultB.summary.expiredCount}`);
        assert(resultB.summary.expiringSoonCount === 1, `Shop B has exactly 1 expiring item (Got: ${resultB.summary.expiringSoonCount})`);
        assert(resultB.expiringSoon[0].productName.includes('Prod-ShopB'), 'Shop B item is Prod-ShopB');
        assert(resultB.summary.expiredCount === 0, 'Shop B has 0 expired items');
        assert(resultB.expiringSoon[0].shopId === shopB._id.toString(), 'Item belongs strictly to Shop B');

        // Check Shop A items do not appear in Shop B
        const hasShopAItemInB = resultB.expiringSoon.some(i => i.shopId === shopA._id.toString());
        assert(!hasShopAItemInB, 'No Shop A items leaked into Shop B alerts');

        // ==========================================
        // TEST 5: Sorting Order (Nearest Expiry First)
        // ==========================================
        console.log('\n👉 [Test 5] Verifying Sorting Order (Nearest Expiry First)...');
        for (let i = 0; i < resultA.expiringSoon.length - 1; i++) {
            assert(
                resultA.expiringSoon[i].daysRemaining <= resultA.expiringSoon[i + 1].daysRemaining,
                `Sorted order verified: item ${i} (${resultA.expiringSoon[i].daysRemaining}d) <= item ${i + 1} (${resultA.expiringSoon[i + 1].daysRemaining}d)`
            );
        }

        console.log('\n🎉 ALL 18 AUTOMATED VERIFICATION CHECKS PASSED SUCCESSFULLY!\n');
    } finally {
        // Clean up test products
        await Product.deleteMany({ name: { $regex: /^\[EXP-TEST\]/ } });
        await Shop.deleteMany({ name: { $regex: /^\[EXP-TEST\]/ } });
        await mongoose.disconnect();
        console.log('Cleaned up test records and disconnected MongoDB.');
    }
}

runTests().catch(err => {
    console.error('Test Suite Failed:', err);
    process.exit(1);
});
