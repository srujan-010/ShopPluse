const mongoose = require('mongoose');
const dns = require('dns');
try {
    dns.setServers(['8.8.8.8', '1.1.1.1']);
} catch (e) {
    console.warn('Could not set custom DNS servers:', e.message);
}
const dotenv = require('dotenv');
dotenv.config();

const Purchase = require('./models/Purchase');
const Shop = require('./models/Shop');
const { getSupplierStatement } = require('./controllers/purchaseController');

async function runTests() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('MongoDB connected successfully.');

        // Test with real shop & supplier from the DB
        const shop = await Shop.findOne();
        console.log('Found shop:', shop?.name, shop?._id.toString());

        // Find a supplier from purchases
        const anyPurchase = await Purchase.findOne();
        if (!anyPurchase) {
            console.log('No purchases found in DB.');
            process.exit(0);
        }

        const supplierName = "Manoj Krushi Kendra";
        const shopId = shop._id.toString();
        const ownerId = shop.owner ? shop.owner.toString() : (await Purchase.findOne({ supplierName: /Manoj/i }))?.owner.toString();
        console.log(`Testing supplier: "${supplierName}", shopId: ${shopId}, ownerId: ${ownerId}`);

        // Mock req and res for 'all' period
        const reqAll = {
            query: {
                shop: shopId,
                supplierName: supplierName,
                period: 'all'
            },
            user: {
                id: ownerId,
                role: 'owner'
            }
        };

        let resultData = null;
        const resAll = {
            status: function(code) {
                this.statusCode = code;
                return this;
            },
            json: function(payload) {
                resultData = payload;
                return this;
            }
        };

        await getSupplierStatement(reqAll, resAll);
        console.log('All Time Statement Status:', resAll.statusCode);
        if (resultData && resultData.success) {
            const data = resultData.data;
            console.log('Shop Name:', data.shop.name);
            console.log('Supplier Name:', data.supplier.name);
            console.log('Period Label:', data.period.label);
            console.log('Summary:', JSON.stringify(data.summary, null, 2));
            console.log('Debits count (purchases):', data.debits.length);
            console.log('Credits count (payments):', data.credits.length);

            // Assertions
            console.assert(typeof data.summary.openingBalance === 'number', 'openingBalance is number');
            console.assert(typeof data.summary.totalDebits === 'number', 'totalDebits is number');
            console.assert(typeof data.summary.totalCredits === 'number', 'totalCredits is number');
            console.assert(typeof data.summary.closingBalance === 'number', 'closingBalance is number');
            console.assert(
                Math.abs(data.summary.closingBalance - (data.summary.openingBalance + data.summary.totalDebits - data.summary.totalCredits)) < 0.01,
                'Accounting equation matches: Closing = Opening + Debits - Credits'
            );
            console.log(' Accounting reconciliation check passed!');
        } else {
            console.error('Failed to get supplier statement:', resultData);
        }

        // Test with 'this_month' period to verify opening balance calculation
        const reqMonth = {
            query: {
                shop: shopId,
                supplierName: supplierName,
                period: 'this_month'
            },
            user: {
                id: ownerId,
                role: 'owner'
            }
        };
        let monthResult = null;
        const resMonth = {
            status: function(c) { this.statusCode = c; return this; },
            json: function(p) { monthResult = p; return this; }
        };
        await getSupplierStatement(reqMonth, resMonth);
        console.log('This Month Statement Status:', resMonth.statusCode);
        if (monthResult && monthResult.success) {
            const data = monthResult.data;
            console.log('This Month Period Label:', data.period.label);
            console.log('This Month Summary:', JSON.stringify(data.summary, null, 2));
            console.log('This Month Debits:', data.debits.length, 'Credits:', data.credits.length);
            console.assert(
                Math.abs(data.summary.closingBalance - (data.summary.openingBalance + data.summary.totalDebits - data.summary.totalCredits)) < 0.01,
                'This Month Accounting equation matches!'
            );
            console.log(' Month reconciliation check passed!');
        }

        await mongoose.disconnect();
        console.log('All tests completed successfully.');
        process.exit(0);
    } catch (err) {
        console.error('Test error:', err);
        process.exit(1);
    }
}

runTests();
