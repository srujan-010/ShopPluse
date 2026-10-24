const mongoose = require('mongoose');
const dotenv = require('dotenv');
const dns = require('dns');
const path = require('path');
const assert = require('assert');

try {
    dns.setServers(['8.8.8.8', '1.1.1.1']);
} catch (e) {}

dotenv.config({ path: path.join(__dirname, '.env') });

const User = require('./models/User');
const Shop = require('./models/Shop');
const Sale = require('./models/Sale');
const Product = require('./models/Product');
const Khata = require('./models/Khata');
const GovernmentSale = require('./models/GovernmentSale');
const { updateSaleCustomer } = require('./controllers/saleController');

// Mock Express req & res
function createMockReqRes(params = {}, body = {}, user = {}) {
    const req = {
        params,
        body,
        user
    };
    let statusCode = 200;
    let responseData = null;

    const res = {
        status(code) {
            statusCode = code;
            return res;
        },
        json(data) {
            responseData = data;
            return res;
        }
    };

    return {
        req,
        res,
        getStatus: () => statusCode,
        getData: () => responseData
    };
}

async function run() {
    console.log('========================================================================');
    console.log(' 🚀 ShopPulse — Edit Customer Details from Sales Ledger Test Suite');
    console.log('========================================================================\n');

    await mongoose.connect(process.env.MONGODB_URI);

    const shop = await Shop.findOne();
    if (!shop) {
        console.error('❌ No shop found in database.');
        process.exit(1);
    }
    const ownerUser = await User.findById(shop.owner);
    const mockOwner = { id: ownerUser._id.toString(), role: ownerUser.role };
    const mockUnauthorized = { id: new mongoose.Types.ObjectId().toString(), role: 'retailer' };

    console.log(`✅ Using Shop: "${shop.name}" (${shop._id}) owned by User (${ownerUser.name})\n`);

    // Pick or create a product to ensure items array is realistic
    let product = await Product.findOne({ shop: shop._id });
    if (!product) {
        product = await Product.create({
            shop: shop._id,
            owner: ownerUser._id,
            name: 'Test Fertilizer Brand A',
            category: 'Fertilizers',
            quantity: 100,
            unit: 'Bag',
            buyPrice: 200,
            sellPrice: 250
        });
    }

    const testItem = {
        product: product._id,
        productName: product.name,
        soldQtyEntered: 2,
        soldUnit: 'Bag',
        soldQtyBaseUnit: 2,
        pricePerBaseUnit: 250,
        totalPrice: 500,
        quantity: 2,
        price: 250,
        profit: 100,
        taxableValue: 476.19,
        gstAmount: 23.81,
        cgst: 11.905,
        sgst: 11.905,
        lineTotal: 500
    };

    // Track IDs to clean up
    const salesToCleanup = [];
    const khataToCleanup = [];

    try {
        // ---------------------------------------------------------------------
        // Test 1: Sale recorded as Walk-in Customer (Cash Sale)
        // ---------------------------------------------------------------------
        console.log('👉 [Test 1] Create Walk-in Cash Sale and edit customer details...');
        const walkinSale = await Sale.create({
            shop: shop._id,
            owner: ownerUser._id,
            invoiceNumber: 'INV-TEST-WALKIN-01',
            customerName: 'Walk-in Customer',
            customerMobile: '',
            items: [testItem],
            totalAmount: 500,
            subtotal: 500,
            taxableAmount: 476.19,
            totalGst: 23.81,
            cgstTotal: 11.905,
            sgstTotal: 11.905,
            totalProfit: 100,
            paidAmount: 500,
            remainingAmount: 0,
            paymentStatus: 'Paid',
            paymentMethod: 'Cash',
            date: new Date('2026-10-20T10:30:00Z')
        });
        salesToCleanup.push(walkinSale._id);

        const initialKhataCount = await Khata.countDocuments({ shop: shop._id });

        // Update Walk-in customer to actual name and mobile
        const { req: req1, res: res1, getStatus: getStatus1, getData: getData1 } = createMockReqRes(
            { id: walkinSale._id.toString() },
            { customerName: 'Ramesh Sharma', customerMobile: '9876543210' },
            mockOwner
        );
        await updateSaleCustomer(req1, res1);

        assert.strictEqual(getStatus1(), 200, 'Expected 200 OK');
        assert.strictEqual(getData1().success, true);
        assert.strictEqual(getData1().data.customerName, 'Ramesh Sharma');
        assert.strictEqual(getData1().data.customerMobile, '9876543210');

        // Verify NO Khata account was created for Walk-in sale
        const postKhataCount = await Khata.countDocuments({ shop: shop._id });
        assert.strictEqual(postKhataCount, initialKhataCount, 'No new Khata account should be created for walk-in cash sale');

        // Verify financial records & invoice number are strictly preserved
        const freshWalkinSale = await Sale.findById(walkinSale._id);
        assert.strictEqual(freshWalkinSale.customerName, 'Ramesh Sharma');
        assert.strictEqual(freshWalkinSale.customerMobile, '9876543210');
        assert.strictEqual(freshWalkinSale.invoiceNumber, 'INV-TEST-WALKIN-01');
        assert.strictEqual(freshWalkinSale.totalAmount, 500);
        assert.strictEqual(freshWalkinSale.paidAmount, 500);
        assert.strictEqual(freshWalkinSale.remainingAmount, 0);
        assert.strictEqual(freshWalkinSale.paymentStatus, 'Paid');
        assert.strictEqual(freshWalkinSale.paymentMethod, 'Cash');
        assert.strictEqual(freshWalkinSale.totalProfit, 100);
        assert.strictEqual(freshWalkinSale.items.length, 1);
        assert.strictEqual(freshWalkinSale.date.toISOString(), walkinSale.date.toISOString());
        console.log('  ✅ PASS: Walk-in sale customer details updated without creating Khata account or modifying financials!');

        // ---------------------------------------------------------------------
        // Test 2: Sale with a customer name but no mobile number (blank allowed)
        // ---------------------------------------------------------------------
        console.log('\n👉 [Test 2] Edit customer name with blank/empty mobile number...');
        const { req: req2, res: res2, getStatus: getStatus2, getData: getData2 } = createMockReqRes(
            { id: walkinSale._id.toString() },
            { customerName: 'Ramesh Sharma (Farmer)', customerMobile: '' },
            mockOwner
        );
        await updateSaleCustomer(req2, res2);

        assert.strictEqual(getStatus2(), 200);
        assert.strictEqual(getData2().data.customerName, 'Ramesh Sharma (Farmer)');
        assert.strictEqual(getData2().data.customerMobile, '');

        const freshSale2 = await Sale.findById(walkinSale._id);
        assert.strictEqual(freshSale2.customerName, 'Ramesh Sharma (Farmer)');
        assert.strictEqual(freshSale2.customerMobile, '');
        assert.strictEqual(freshSale2.totalAmount, 500);
        console.log('  ✅ PASS: Updating customer name with blank mobile accepted and saved!');

        // ---------------------------------------------------------------------
        // Test 3: Sale linked to an existing Khata customer
        // ---------------------------------------------------------------------
        console.log('\n👉 [Test 3] Sale linked to existing Khata customer...');
        const khataCustomer = await Khata.create({
            shop: shop._id,
            owner: ownerUser._id,
            customerName: 'Anil Kumar Original',
            mobile: '9888800001',
            outstandingDue: 1500,
            transactions: [
                {
                    type: 'due',
                    amount: 1500,
                    date: new Date('2026-10-15T09:00:00Z'),
                    note: 'POS Bill #INV-KHATA-01',
                    paymentMethod: 'Khata',
                    isPOSSale: true
                }
            ]
        });
        khataToCleanup.push(khataCustomer._id);

        const khataSale = await Sale.create({
            shop: shop._id,
            owner: ownerUser._id,
            invoiceNumber: 'INV-KHATA-01',
            customerName: 'Anil Kumar Original',
            customerMobile: '9888800001',
            items: [testItem],
            totalAmount: 1500,
            subtotal: 1500,
            paidAmount: 0,
            remainingAmount: 1500,
            paymentStatus: 'Unpaid',
            paymentMethod: 'Khata',
            totalProfit: 300,
            date: new Date('2026-10-15T09:00:00Z')
        });
        salesToCleanup.push(khataSale._id);

        // Link the transaction to the sale
        khataCustomer.transactions[0].saleId = khataSale._id;
        await khataCustomer.save();

        // Edit customer details on this Khata sale
        const { req: req3, res: res3, getStatus: getStatus3, getData: getData3 } = createMockReqRes(
            { id: khataSale._id.toString() },
            { customerName: 'Anil Kumar Reddy', customerMobile: '9888800009' },
            mockOwner
        );
        await updateSaleCustomer(req3, res3);

        assert.strictEqual(getStatus3(), 200);
        assert.strictEqual(getData3().data.customerName, 'Anil Kumar Reddy');
        assert.strictEqual(getData3().data.customerMobile, '9888800009');

        // Verify linked Khata customer record is updated
        const freshKhata = await Khata.findById(khataCustomer._id);
        assert.strictEqual(freshKhata.customerName, 'Anil Kumar Reddy');
        assert.strictEqual(freshKhata.mobile, '9888800009');

        // Strictly verify Khata outstandingDue and transactions are UNCHANGED
        assert.strictEqual(freshKhata.outstandingDue, 1500, 'Khata balance must remain untouched');
        assert.strictEqual(freshKhata.transactions.length, 1, 'Transaction count must remain untouched');
        assert.strictEqual(freshKhata.transactions[0].amount, 1500, 'Transaction amount must remain untouched');
        assert.strictEqual(freshKhata.transactions[0].saleId.toString(), khataSale._id.toString(), 'Sale link must remain intact');
        console.log('  ✅ PASS: Linked Khata customer updated; balance & transaction history 100% preserved!');

        // ---------------------------------------------------------------------
        // Test 4: Duplicate mobile number collision prevention in same shop
        // ---------------------------------------------------------------------
        console.log('\n👉 [Test 4] Duplicate mobile number collision prevention for Khata...');
        const otherKhataCustomer = await Khata.create({
            shop: shop._id,
            owner: ownerUser._id,
            customerName: 'Srinivas Goud',
            mobile: '9888800055',
            outstandingDue: 200,
            transactions: []
        });
        khataToCleanup.push(otherKhataCustomer._id);

        // Attempt to update khataSale mobile to 9888800055 (belongs to Srinivas Goud)
        const { req: req4, res: res4, getStatus: getStatus4, getData: getData4 } = createMockReqRes(
            { id: khataSale._id.toString() },
            { customerName: 'Anil Kumar Reddy', customerMobile: '9888800055' },
            mockOwner
        );
        await updateSaleCustomer(req4, res4);

        assert.strictEqual(getStatus4(), 400, 'Should reject duplicate mobile number in same shop');
        assert.strictEqual(getData4().success, false);
        assert(getData4().message.includes('Srinivas Goud'), 'Warning message should name the conflicting customer');
        console.log(`  ✅ PASS: Duplicate mobile blocked with warning: "${getData4().message}"`);

        // ---------------------------------------------------------------------
        // Test 5: Validation tests (empty name, invalid mobile format)
        // ---------------------------------------------------------------------
        console.log('\n👉 [Test 5] Validation tests...');
        // Empty name
        const { req: reqVal1, res: resVal1, getStatus: getStatusVal1, getData: getDataVal1 } = createMockReqRes(
            { id: walkinSale._id.toString() },
            { customerName: '   ', customerMobile: '9876543210' },
            mockOwner
        );
        await updateSaleCustomer(reqVal1, resVal1);
        assert.strictEqual(getStatusVal1(), 400);
        assert.strictEqual(getDataVal1().message, 'Customer name is required');
        console.log('  ✅ PASS: Empty customer name rejected with 400');

        // Invalid mobile length
        const { req: reqVal2, res: resVal2, getStatus: getStatusVal2, getData: getDataVal2 } = createMockReqRes(
            { id: walkinSale._id.toString() },
            { customerName: 'Valid Name', customerMobile: '12345' },
            mockOwner
        );
        await updateSaleCustomer(reqVal2, resVal2);
        assert.strictEqual(getStatusVal2(), 400);
        assert(getDataVal2().message.includes('10-digit'));
        console.log('  ✅ PASS: Invalid mobile number format rejected with 400');

        // ---------------------------------------------------------------------
        // Test 6: Authorization Security Check
        // ---------------------------------------------------------------------
        console.log('\n👉 [Test 6] Shop authorization check...');
        const { req: reqAuth, res: resAuth, getStatus: getStatusAuth } = createMockReqRes(
            { id: walkinSale._id.toString() },
            { customerName: 'Hacker Name', customerMobile: '9999999999' },
            mockUnauthorized
        );
        await updateSaleCustomer(reqAuth, resAuth);
        assert.strictEqual(getStatusAuth(), 403, 'Unauthorized user must be rejected with 403');
        console.log('  ✅ PASS: Unauthorized user rejected with 403 Forbidden');

        // ---------------------------------------------------------------------
        // Test 7: Persistence check across independent database query
        // ---------------------------------------------------------------------
        console.log('\n👉 [Test 7] Database persistence check across independent query...');
        const reloadedSale = await Sale.findById(walkinSale._id).lean();
        assert.strictEqual(reloadedSale.customerName, 'Ramesh Sharma (Farmer)');
        assert.strictEqual(reloadedSale.totalAmount, 500);
        console.log('  ✅ PASS: Re-queried database confirms all updates permanently persisted!');

    } finally {
        // Cleanup test artifacts
        if (salesToCleanup.length > 0) {
            await Sale.deleteMany({ _id: { $in: salesToCleanup } });
        }
        if (khataToCleanup.length > 0) {
            await Khata.deleteMany({ _id: { $in: khataToCleanup } });
        }
        console.log('\n🧹 Test data cleaned up.');
    }

    console.log('========================================================================');
    console.log(' 🎉 ALL EDIT SALE CUSTOMER TESTS PASSED WITH 100% SUCCESS!');
    console.log('========================================================================\n');
    process.exit(0);
}

run().catch(err => {
    console.error('❌ Test suite failed:', err);
    process.exit(1);
});
