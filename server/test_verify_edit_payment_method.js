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
    console.log(' 🚀 ShopPulse — Edit Payment Method Verification Test Suite');
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

    let product = await Product.findOne({ shop: shop._id });
    if (!product) {
        product = await Product.create({
            shop: shop._id,
            owner: ownerUser._id,
            name: 'Sample Test Fertilizer',
            category: 'Fertilizers',
            quantity: 500,
            unit: 'Bag',
            buyPrice: 300,
            sellPrice: 400
        });
    }

    const testItem = {
        product: product._id,
        productName: product.name,
        soldQtyEntered: 1,
        soldUnit: 'Bag',
        soldQtyBaseUnit: 1,
        pricePerBaseUnit: 400,
        totalPrice: 400,
        quantity: 1,
        price: 400,
        profit: 100,
        taxableValue: 380.95,
        gstAmount: 19.05,
        cgst: 9.525,
        sgst: 9.525,
        lineTotal: 400
    };

    const salesToCleanup = [];
    const khataToCleanup = [];

    try {
        // ---------------------------------------------------------------------
        // Test 1: Cash → UPI Transition
        // ---------------------------------------------------------------------
        console.log('👉 [Test 1] Change Cash → UPI...');
        const saleCash = await Sale.create({
            shop: shop._id,
            owner: ownerUser._id,
            invoiceNumber: 'INV-TEST-C2U',
            customerName: 'Prakash Rao',
            customerMobile: '9111100001',
            items: [testItem],
            totalAmount: 400,
            subtotal: 400,
            taxableAmount: 380.95,
            totalGst: 19.05,
            paidAmount: 400,
            remainingAmount: 0,
            paymentStatus: 'Paid',
            paymentMethod: 'Cash',
            totalProfit: 100,
            date: new Date('2026-10-21T11:00:00Z')
        });
        salesToCleanup.push(saleCash._id);

        const { req: req1, res: res1, getStatus: s1, getData: d1 } = createMockReqRes(
            { id: saleCash._id.toString() },
            { customerName: 'Prakash Rao', customerMobile: '9111100001', paymentMethod: 'UPI' },
            mockOwner
        );
        await updateSaleCustomer(req1, res1);

        assert.strictEqual(s1(), 200, 'Expected 200 OK');
        assert.strictEqual(d1().data.paymentMethod, 'UPI');

        const reloaded1 = await Sale.findById(saleCash._id);
        assert.strictEqual(reloaded1.paymentMethod, 'UPI');
        assert.strictEqual(reloaded1.totalAmount, 400);
        assert.strictEqual(reloaded1.paidAmount, 400);
        assert.strictEqual(reloaded1.remainingAmount, 0);
        assert.strictEqual(reloaded1.paymentStatus, 'Paid');
        assert.strictEqual(reloaded1.invoiceNumber, 'INV-TEST-C2U');
        console.log('  ✅ PASS: Cash → UPI updated smoothly; all financial fields preserved!');

        // ---------------------------------------------------------------------
        // Test 2: UPI → Cash Transition
        // ---------------------------------------------------------------------
        console.log('\n👉 [Test 2] Change UPI → Cash...');
        const { req: req2, res: res2, getStatus: s2, getData: d2 } = createMockReqRes(
            { id: saleCash._id.toString() },
            { customerName: 'Prakash Rao', customerMobile: '9111100001', paymentMethod: 'Cash' },
            mockOwner
        );
        await updateSaleCustomer(req2, res2);

        assert.strictEqual(s2(), 200);
        assert.strictEqual(d2().data.paymentMethod, 'Cash');

        const reloaded2 = await Sale.findById(saleCash._id);
        assert.strictEqual(reloaded2.paymentMethod, 'Cash');
        assert.strictEqual(reloaded2.totalAmount, 400);
        assert.strictEqual(reloaded2.paidAmount, 400);
        assert.strictEqual(reloaded2.remainingAmount, 0);
        console.log('  ✅ PASS: UPI → Cash updated smoothly; all financial fields preserved!');

        // ---------------------------------------------------------------------
        // Test 3: Cash → Khata Transition (with remaining due)
        // ---------------------------------------------------------------------
        console.log('\n👉 [Test 3] Change Cash → Khata with outstanding due...');
        const saleDue = await Sale.create({
            shop: shop._id,
            owner: ownerUser._id,
            invoiceNumber: 'INV-TEST-C2K',
            customerName: 'Kishore Kumar',
            customerMobile: '9111100002',
            items: [testItem],
            totalAmount: 400,
            subtotal: 400,
            paidAmount: 0,
            remainingAmount: 400,
            paymentStatus: 'Unpaid',
            paymentMethod: 'Cash',
            totalProfit: 100,
            date: new Date('2026-10-21T12:00:00Z')
        });
        salesToCleanup.push(saleDue._id);

        const { req: req3, res: res3, getStatus: s3, getData: d3 } = createMockReqRes(
            { id: saleDue._id.toString() },
            { customerName: 'Kishore Kumar', customerMobile: '9111100002', paymentMethod: 'Khata', isNewKhataCustomer: true },
            mockOwner
        );
        await updateSaleCustomer(req3, res3);

        assert.strictEqual(s3(), 200);
        assert.strictEqual(d3().data.paymentMethod, 'Khata');

        // Verify Khata customer was created and ledger entry added
        const kRecord3 = await Khata.findOne({ shop: shop._id, mobile: '9111100002' });
        assert(kRecord3, 'Khata account should be created for credit sale');
        khataToCleanup.push(kRecord3._id);

        assert.strictEqual(kRecord3.outstandingDue, 400, 'Khata outstandingDue should match sale remainingAmount');
        assert.strictEqual(kRecord3.transactions.length, 1);
        assert.strictEqual(kRecord3.transactions[0].amount, 400);
        assert.strictEqual(kRecord3.transactions[0].saleId.toString(), saleDue._id.toString());
        console.log('  ✅ PASS: Cash → Khata created safe ledger entry in Khata with exact due amount!');

        // ---------------------------------------------------------------------
        // Test 4: Partially Paid Sale (Total: 1000, Paid: 400, Due: 600)
        // ---------------------------------------------------------------------
        console.log('\n👉 [Test 4] Partially Paid Sale (Total: 1000, Paid: 400, Due: 600)...');
        const partialSale = await Sale.create({
            shop: shop._id,
            owner: ownerUser._id,
            invoiceNumber: 'INV-TEST-PARTIAL',
            customerName: 'Venkat Rao',
            customerMobile: '9111100003',
            items: [testItem],
            totalAmount: 1000,
            subtotal: 1000,
            paidAmount: 400,
            remainingAmount: 600,
            paymentStatus: 'Partial',
            paymentMethod: 'Cash',
            totalProfit: 250,
            date: new Date('2026-10-21T14:00:00Z')
        });
        salesToCleanup.push(partialSale._id);

        // Change partial sale to Khata
        const { req: req4, res: res4, getStatus: s4, getData: d4 } = createMockReqRes(
            { id: partialSale._id.toString() },
            { customerName: 'Venkat Rao', customerMobile: '9111100003', paymentMethod: 'Khata', isNewKhataCustomer: true },
            mockOwner
        );
        await updateSaleCustomer(req4, res4);

        assert.strictEqual(s4(), 200);
        assert.strictEqual(d4().data.paymentMethod, 'Khata');

        const reloadedPartial = await Sale.findById(partialSale._id);
        assert.strictEqual(reloadedPartial.paymentMethod, 'Khata');
        assert.strictEqual(reloadedPartial.totalAmount, 1000);
        assert.strictEqual(reloadedPartial.paidAmount, 400, 'Paid amount of 400 must be preserved');
        assert.strictEqual(reloadedPartial.remainingAmount, 600, 'Remaining due of 600 must be preserved');
        assert.strictEqual(reloadedPartial.paymentStatus, 'Partial', 'Payment status Partial must be preserved');

        const kRecord4 = await Khata.findOne({ shop: shop._id, mobile: '9111100003' });
        assert(kRecord4, 'Khata account must be linked');
        khataToCleanup.push(kRecord4._id);
        assert.strictEqual(kRecord4.outstandingDue, 600, 'Khata balance should only reflect remaining due (600), NOT total (1000)');
        console.log('  ✅ PASS: Partial sale preserves paid history (400), due (600), and posts exact remaining due to Khata!');

        // ---------------------------------------------------------------------
        // Test 5: Fully Paid Sale (Total: 500, Paid: 500, Due: 0)
        // ---------------------------------------------------------------------
        console.log('\n👉 [Test 5] Fully Paid Sale (Total: 500, Paid: 500, Due: 0) changed to Khata...');
        const fullPaidSale = await Sale.create({
            shop: shop._id,
            owner: ownerUser._id,
            invoiceNumber: 'INV-TEST-FULLPAID',
            customerName: 'Madhav Goud',
            customerMobile: '9111100004',
            items: [testItem],
            totalAmount: 500,
            subtotal: 500,
            paidAmount: 500,
            remainingAmount: 0,
            paymentStatus: 'Paid',
            paymentMethod: 'Cash',
            totalProfit: 120,
            date: new Date('2026-10-21T15:00:00Z')
        });
        salesToCleanup.push(fullPaidSale._id);

        const { req: req5, res: res5, getStatus: s5, getData: d5 } = createMockReqRes(
            { id: fullPaidSale._id.toString() },
            { customerName: 'Madhav Goud', customerMobile: '9111100004', paymentMethod: 'Khata', isNewKhataCustomer: true },
            mockOwner
        );
        await updateSaleCustomer(req5, res5);

        assert.strictEqual(s5(), 200);
        const reloadedFull = await Sale.findById(fullPaidSale._id);
        assert.strictEqual(reloadedFull.paymentMethod, 'Khata');
        assert.strictEqual(reloadedFull.paidAmount, 500);
        assert.strictEqual(reloadedFull.remainingAmount, 0);
        assert.strictEqual(reloadedFull.paymentStatus, 'Paid');

        const kRecord5 = await Khata.findOne({ shop: shop._id, mobile: '9111100004' });
        assert(kRecord5, 'Khata record exists');
        khataToCleanup.push(kRecord5._id);
        assert.strictEqual(kRecord5.outstandingDue, 0, 'Outstanding due should remain 0 because sale was fully paid');
        console.log('  ✅ PASS: Fully paid sale remains fully paid (remainingAmount: 0), no false debt added to Khata!');

        // ---------------------------------------------------------------------
        // Test 6: Reversing Khata → Cash (Due ledger entry cleanly reversed)
        // ---------------------------------------------------------------------
        console.log('\n👉 [Test 6] Reversing Khata → Cash removes Khata due entry safely...');
        const { req: req6, res: res6, getStatus: s6, getData: d6 } = createMockReqRes(
            { id: saleDue._id.toString() },
            { customerName: 'Kishore Kumar', customerMobile: '9111100002', paymentMethod: 'Cash' },
            mockOwner
        );
        await updateSaleCustomer(req6, res6);

        assert.strictEqual(s6(), 200);
        const kRecord6 = await Khata.findOne({ shop: shop._id, mobile: '9111100002' });
        assert.strictEqual(kRecord6.outstandingDue, 0, 'Reversing Khata to Cash should reverse the due balance back to 0');
        assert.strictEqual(kRecord6.transactions.length, 0, 'Due transaction for this sale removed from Khata');
        console.log('  ✅ PASS: Changing Khata → Cash safely reversed ledger entry and reset Khata balance!');

        // ---------------------------------------------------------------------
        // Test 7: Mobile required when choosing Khata
        // ---------------------------------------------------------------------
        console.log('\n👉 [Test 7] Validation: Khata requires 10-digit mobile number...');
        const noMobileSale = await Sale.create({
            shop: shop._id,
            owner: ownerUser._id,
            invoiceNumber: 'INV-TEST-NOMOBILE',
            customerName: 'Anonymous Buyer',
            customerMobile: '',
            items: [testItem],
            totalAmount: 200,
            subtotal: 200,
            paidAmount: 200,
            remainingAmount: 0,
            paymentStatus: 'Paid',
            paymentMethod: 'Cash',
            totalProfit: 50
        });
        salesToCleanup.push(noMobileSale._id);

        const { req: req7, res: res7, getStatus: s7, getData: d7 } = createMockReqRes(
            { id: noMobileSale._id.toString() },
            { customerName: 'Anonymous Buyer', customerMobile: '', paymentMethod: 'Khata' },
            mockOwner
        );
        await updateSaleCustomer(req7, res7);
        assert.strictEqual(s7(), 400);
        assert(d7().message.includes('mobile number is required'));
        console.log('  ✅ PASS: Selecting Khata without mobile number properly rejected with 400');

        // ---------------------------------------------------------------------
        // Test 8: Shop authorization security
        // ---------------------------------------------------------------------
        console.log('\n👉 [Test 8] Shop authorization security check...');
        const { req: req8, res: res8, getStatus: s8 } = createMockReqRes(
            { id: saleCash._id.toString() },
            { customerName: 'Attacker', customerMobile: '9999999999', paymentMethod: 'UPI' },
            mockUnauthorized
        );
        await updateSaleCustomer(req8, res8);
        assert.strictEqual(s8(), 403, 'Unauthorized user must be rejected with 403 Forbidden');
        console.log('  ✅ PASS: Unauthorized retailer rejected with 403 Forbidden');

    } finally {
        if (salesToCleanup.length > 0) {
            await Sale.deleteMany({ _id: { $in: salesToCleanup } });
        }
        if (khataToCleanup.length > 0) {
            await Khata.deleteMany({ _id: { $in: khataToCleanup } });
        }
        console.log('\n🧹 Test data cleaned up.');
    }

    console.log('========================================================================');
    console.log(' 🎉 ALL EDIT PAYMENT METHOD TESTS PASSED WITH 100% SUCCESS!');
    console.log('========================================================================\n');
    process.exit(0);
}

run().catch(err => {
    console.error('❌ Test suite failed:', err);
    process.exit(1);
});
