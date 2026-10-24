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
const Khata = require('./models/Khata');
const Sale = require('./models/Sale');
const GovernmentSale = require('./models/GovernmentSale');
const { updateKhataCustomer } = require('./controllers/khataController');

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
    console.log(' 🚀 ShopPulse — Edit Customer Details in Khata Book Verification Suite');
    console.log('========================================================================\n');

    await mongoose.connect(process.env.MONGODB_URI);

    const shop = await Shop.findOne();
    if (!shop) {
        console.error('❌ No shop found in database.');
        process.exit(1);
    }
    const user = await User.findById(shop.owner);
    console.log(`✅ Using Shop: "${shop.name}" (${shop._id}) owned by User (${user?.name || user?._id})\n`);

    // Clean up any old test khata records
    await Khata.deleteMany({ mobile: { $in: ['9999900001', '9999900002', '9999900003'] } });
    await Sale.deleteMany({ customerMobile: { $in: ['9999900001', '9999900002', '9999900003'] } });

    // Step 1: Create Test Customer A
    console.log('👉 [Test 1] Create Khata customer with outstanding due and 2 transactions...');
    const testDate1 = new Date('2026-10-15T10:00:00Z');
    const testDate2 = new Date('2026-10-18T14:30:00Z');

    const customerA = await Khata.create({
        shop: shop._id,
        owner: user._id,
        customerName: 'Anil Kumar',
        mobile: '9999900001',
        outstandingDue: 3500,
        transactions: [
            {
                type: 'due',
                amount: 5000,
                date: testDate1,
                note: 'Initial credit purchase of seeds and fertilizer'
            },
            {
                type: 'payment',
                amount: 1500,
                date: testDate2,
                note: 'Cash payment received'
            }
        ]
    });

    // Create a linked Sale for Customer A
    const linkedSale = await Sale.create({
        shop: shop._id,
        owner: user._id,
        invoiceNumber: 'INV-TEST-001',
        customerName: 'Anil Kumar',
        customerMobile: '9999900001',
        paymentMethod: 'Khata',
        totalAmount: 5000,
        totalProfit: 800,
        paidAmount: 0,
        remainingAmount: 5000,
        items: []
    });

    // Link saleId to transaction 1
    customerA.transactions[0].saleId = linkedSale._id;
    await customerA.save();

    console.log(`  ✅ Customer A created: ID ${customerA._id}, Due ₹${customerA.outstandingDue}, Txns: ${customerA.transactions.length}`);

    // Step 2: Create Customer B in same shop
    console.log('\n👉 [Test 2] Create Khata customer B in same shop to test uniqueness...');
    const customerB = await Khata.create({
        shop: shop._id,
        owner: user._id,
        customerName: 'Suresh Reddy',
        mobile: '9999900002',
        outstandingDue: 1200,
        transactions: []
    });
    console.log(`  ✅ Customer B created: ID ${customerB._id}, Mobile ${customerB.mobile}`);

    // Step 3: Successfully edit Customer A details (name and mobile)
    console.log('\n👉 [Test 3] Edit Customer A name and mobile number...');
    const mock3 = createMockReqRes(
        { id: customerA._id.toString() },
        { customerName: 'Anil Kumar Sharma', mobile: '9999900003' },
        { id: user._id.toString(), role: user.role }
    );

    await updateKhataCustomer(mock3.req, mock3.res);

    assert.strictEqual(mock3.getStatus(), 200, 'Status should be 200 OK');
    const res3Data = mock3.getData();
    assert.strictEqual(res3Data.success, true, 'Response success should be true');
    assert.strictEqual(res3Data.data.customerName, 'Anil Kumar Sharma', 'Name should be updated');
    assert.strictEqual(res3Data.data.mobile, '9999900003', 'Mobile should be updated');

    // Verify transaction history & balance preservation
    assert.strictEqual(res3Data.data.outstandingDue, 3500, 'Outstanding balance must remain exactly 3500');
    assert.strictEqual(res3Data.data.transactions.length, 2, 'Must still have exactly 2 transactions');
    assert.strictEqual(res3Data.data.transactions[0].type, 'due', 'Transaction 0 type preserved');
    assert.strictEqual(res3Data.data.transactions[0].amount, 5000, 'Transaction 0 amount preserved');
    assert.strictEqual(res3Data.data.transactions[1].type, 'payment', 'Transaction 1 type preserved');
    assert.strictEqual(res3Data.data.transactions[1].amount, 1500, 'Transaction 1 amount preserved');
    console.log('  ✅ PASS: Customer details updated and balance/transactions 100% preserved!');

    // Step 4: Verify linked historical sales update
    console.log('\n👉 [Test 4] Verify historical sale reference update...');
    const updatedSale = await Sale.findById(linkedSale._id);
    assert.strictEqual(updatedSale.customerName, 'Anil Kumar Sharma', 'Sale customerName updated');
    assert.strictEqual(updatedSale.customerMobile, '9999900003', 'Sale customerMobile updated');
    assert.strictEqual(updatedSale.totalAmount, 5000, 'Sale amount completely untouched');
    console.log('  ✅ PASS: Linked sale references updated without modifying transaction amounts!');

    // Step 5: Prevent duplicate mobile number in the same shop
    console.log('\n👉 [Test 5] Test duplicate mobile number warning/protection...');
    const mock5 = createMockReqRes(
        { id: customerA._id.toString() },
        { customerName: 'Anil Kumar Sharma', mobile: '9999900002' }, // matches Customer B
        { id: user._id.toString(), role: user.role }
    );

    await updateKhataCustomer(mock5.req, mock5.res);

    assert.strictEqual(mock5.getStatus(), 400, 'Should return 400 Bad Request');
    assert.strictEqual(mock5.getData().success, false, 'Should be unsuccessful');
    assert(mock5.getData().message.includes('already associated with another customer'), 'Message should warn about duplicate mobile');
    assert(mock5.getData().message.includes('Suresh Reddy'), 'Message should identify existing customer');
    console.log(`  ✅ PASS: Duplicate blocked with informative warning: "${mock5.getData().message}"`);

    // Step 6: Updating same customer with same mobile and new name should succeed
    console.log('\n👉 [Test 6] Editing name while keeping same mobile number...');
    const mock6 = createMockReqRes(
        { id: customerA._id.toString() },
        { customerName: 'Anil K. Sharma', mobile: '9999900003' }, // same mobile as customer A currently has
        { id: user._id.toString(), role: user.role }
    );

    await updateKhataCustomer(mock6.req, mock6.res);
    assert.strictEqual(mock6.getStatus(), 200, 'Should return 200 OK when retaining own mobile number');
    assert.strictEqual(mock6.getData().data.customerName, 'Anil K. Sharma', 'Name updated successfully');
    console.log('  ✅ PASS: Updating name with same mobile number succeeds without self-collision!');

    // Step 7: Validation errors for missing/invalid input
    console.log('\n👉 [Test 7] Validation tests (empty name, invalid mobile format)...');
    
    // 7a: Empty name
    const mock7a = createMockReqRes(
        { id: customerA._id.toString() },
        { customerName: '   ', mobile: '9999900003' },
        { id: user._id.toString(), role: user.role }
    );
    await updateKhataCustomer(mock7a.req, mock7a.res);
    assert.strictEqual(mock7a.getStatus(), 400, 'Empty name should return 400');
    assert(mock7a.getData().message.includes('Customer name is required'), 'Name required error message');
    console.log('  ✅ PASS: Empty name rejected');

    // 7b: Invalid mobile length (< 10 digits)
    const mock7b = createMockReqRes(
        { id: customerA._id.toString() },
        { customerName: 'Anil Kumar', mobile: '98765' },
        { id: user._id.toString(), role: user.role }
    );
    await updateKhataCustomer(mock7b.req, mock7b.res);
    assert.strictEqual(mock7b.getStatus(), 400, 'Short mobile should return 400');
    assert(mock7b.getData().message.includes('10-digit'), '10-digit mobile error message');
    console.log('  ✅ PASS: Short mobile number (< 10 digits) rejected');

    // Step 8: Authorization check: Unauthorized user cannot edit customer
    console.log('\n👉 [Test 8] Shop authorization security check...');
    const foreignUserId = new mongoose.Types.ObjectId();
    const mock8 = createMockReqRes(
        { id: customerA._id.toString() },
        { customerName: 'Hacked Name', mobile: '9999900003' },
        { id: foreignUserId.toString(), role: 'user' }
    );
    await updateKhataCustomer(mock8.req, mock8.res);
    assert.strictEqual(mock8.getStatus(), 403, 'Unauthorized user should return 403');
    assert(mock8.getData().message.includes('Not authorized'), 'Not authorized error message');
    console.log('  ✅ PASS: Unauthorized user rejected with 403 Forbidden');

    // Step 9: Re-fetch customer A from database to verify persistence across sessions
    console.log('\n👉 [Test 9] Database persistence check across independent query...');
    const persistentCustomer = await Khata.findById(customerA._id);
    assert.strictEqual(persistentCustomer.customerName, 'Anil K. Sharma', 'Name persisted in DB');
    assert.strictEqual(persistentCustomer.mobile, '9999900003', 'Mobile persisted in DB');
    assert.strictEqual(persistentCustomer.outstandingDue, 3500, 'Due persisted unchanged');
    assert.strictEqual(persistentCustomer.transactions.length, 2, 'Transactions persisted unchanged');
    console.log('  ✅ PASS: Re-queried DB record confirms changes are fully persisted!');

    // Cleanup
    await Khata.deleteMany({ _id: { $in: [customerA._id, customerB._id] } });
    await Sale.deleteMany({ _id: linkedSale._id });
    console.log('\n🧹 Test data cleaned up.');

    console.log('\n========================================================================');
    console.log(' 🎉 ALL EDIT KHATA CUSTOMER TESTS PASSED WITH 100% SUCCESS!');
    console.log('========================================================================\n');

    process.exit(0);
}

run().catch(err => {
    console.error('❌ Verification failed:', err);
    process.exit(1);
});
