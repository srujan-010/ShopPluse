const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');
const dns = require('dns');

dotenv.config({ path: path.join(__dirname, '.env') });

const User = require('./models/User');
const Shop = require('./models/Shop');
const Sale = require('./models/Sale');
const Khata = require('./models/Khata');
const Product = require('./models/Product');
const saleController = require('./controllers/saleController');

async function runTests() {
    console.log('========================================================================');
    console.log(' 🚀 ShopPulse — Khata Customer Selection in Sale Edit Verification Test');
    console.log('========================================================================\n');

    try {
        dns.setServers(['8.8.8.8', '1.1.1.1']);
    } catch (e) {}

    await mongoose.connect(process.env.MONGODB_URI);

    const testShop1 = await Shop.findOne({ isGovernmentShop: { $ne: true } });
    if (!testShop1) {
        console.error('❌ No test shop found in database');
        process.exit(1);
    }

    const testUser = await User.findById(testShop1.owner);
    console.log(`✅ Using Shop: "${testShop1.name}" (${testShop1._id}) owned by User (${testUser.name})`);

    // Create a second shop owned by someone else (or dummy shop) to test shop validation
    let testShop2 = await Shop.findOne({ _id: { $ne: testShop1._id } });
    if (!testShop2) {
        testShop2 = await Shop.create({
            name: 'Other Shop For Test',
            owner: new mongoose.Types.ObjectId(),
            location: 'Other Place',
            type: 'Retail'
        });
    }

    let createdSaleIds = [];
    let createdKhataIds = [];

    const mockReq = (params, body, user) => ({
        params,
        body,
        user: user || { id: testUser._id.toString(), role: testUser.role || 'retailer' }
    });

    const mockRes = () => {
        const res = {};
        res.statusCode = 200;
        res.status = function(code) {
            this.statusCode = code;
            return this;
        };
        res.json = function(data) {
            this.data = data;
            return this;
        };
        return res;
    };

    try {
        // Create Khata Customer A and Khata Customer B for Shop 1
        const customerA = await Khata.create({
            shop: testShop1._id,
            owner: testUser._id,
            customerName: 'Khata Cust Alpha',
            mobile: '9888111111',
            outstandingDue: 0,
            transactions: []
        });
        createdKhataIds.push(customerA._id);

        const customerB = await Khata.create({
            shop: testShop1._id,
            owner: testUser._id,
            customerName: 'Khata Cust Beta',
            mobile: '9888222222',
            outstandingDue: 0,
            transactions: []
        });
        createdKhataIds.push(customerB._id);

        // Create Khata Customer from Shop 2 (Foreign Customer)
        const foreignCustomer = await Khata.create({
            shop: testShop2._id,
            owner: testShop2.owner,
            customerName: 'Foreign Customer',
            mobile: '9888333333',
            outstandingDue: 0,
            transactions: []
        });
        createdKhataIds.push(foreignCustomer._id);

        // -------------------------------------------------------------
        // TEST 1: Switch Cash -> Khata by selecting existing Customer A
        // -------------------------------------------------------------
        console.log('👉 [Test 1] Change Cash Sale to Khata with explicit Customer A selection...');
        const sale1 = await Sale.create({
            shop: testShop1._id,
            owner: testUser._id,
            invoiceNumber: 'INV-TEST-KHATA-1',
            customerName: 'Walk-in Customer',
            customerMobile: '',
            paymentMethod: 'Cash',
            paidAmount: 800,
            remainingAmount: 800, // Unpaid balance
            paymentStatus: 'Unpaid',
            totalAmount: 800,
            subtotal: 800,
            totalProfit: 120,
            items: [{
                product: new mongoose.Types.ObjectId(),
                productName: 'Fertilizer Bag',
                soldQtyEntered: 2,
                soldUnit: 'Bags',
                price: 400,
                quantity: 2,
                totalPrice: 800,
                profit: 120
            }]
        });
        createdSaleIds.push(sale1._id);

        let req1 = mockReq({ id: sale1._id.toString() }, {
            customerName: 'Khata Cust Alpha',
            customerMobile: '9888111111',
            paymentMethod: 'Khata',
            khataCustomerId: customerA._id.toString()
        });
        let res1 = mockRes();
        await saleController.updateSaleCustomer(req1, res1);

        if (res1.statusCode !== 200) {
            throw new Error(`Test 1 Failed: HTTP ${res1.statusCode}: ${res1.data?.message}`);
        }

        const updatedSale1 = await Sale.findById(sale1._id);
        const updatedCustA1 = await Khata.findById(customerA._id);

        if (updatedSale1.paymentMethod !== 'Khata' || updatedSale1.khataId?.toString() !== customerA._id.toString()) {
            throw new Error(`Test 1 Failed: Sale khataId not set correctly. Got: ${updatedSale1.khataId}`);
        }
        if (updatedCustA1.outstandingDue !== 800 || updatedCustA1.transactions.length !== 1) {
            throw new Error(`Test 1 Failed: Cust A outstandingDue expected 800, got ${updatedCustA1.outstandingDue}`);
        }
        console.log('  ✅ PASS: Cash → Khata linked sale to Customer A, set sale.khataId, and posted ₹800 due!');

        // -------------------------------------------------------------
        // TEST 2: Reassign Sale from Customer A to Customer B
        // -------------------------------------------------------------
        console.log('\n👉 [Test 2] Reassign Sale from Customer A to Customer B...');
        let req2 = mockReq({ id: sale1._id.toString() }, {
            customerName: 'Khata Cust Beta',
            customerMobile: '9888222222',
            paymentMethod: 'Khata',
            khataCustomerId: customerB._id.toString()
        });
        let res2 = mockRes();
        await saleController.updateSaleCustomer(req2, res2);

        if (res2.statusCode !== 200) {
            throw new Error(`Test 2 Failed: HTTP ${res2.statusCode}: ${res2.data?.message}`);
        }

        const updatedSale2 = await Sale.findById(sale1._id);
        const updatedCustA2 = await Khata.findById(customerA._id);
        const updatedCustB2 = await Khata.findById(customerB._id);

        if (updatedCustA2.outstandingDue !== 0 || updatedCustA2.transactions.length !== 0) {
            throw new Error(`Test 2 Failed: Customer A ledger entry was not reversed! Due: ${updatedCustA2.outstandingDue}`);
        }
        if (updatedCustB2.outstandingDue !== 800 || updatedCustB2.transactions.length !== 1) {
            throw new Error(`Test 2 Failed: Customer B ledger entry not created! Due: ${updatedCustB2.outstandingDue}`);
        }
        if (updatedSale2.khataId?.toString() !== customerB._id.toString()) {
            throw new Error(`Test 2 Failed: Sale khataId did not update to Customer B! Got: ${updatedSale2.khataId}`);
        }
        console.log('  ✅ PASS: Reassigned sale from Customer A → B; Customer A reversed to 0, Customer B credited ₹800!');

        // -------------------------------------------------------------
        // TEST 3: Repeated Save Idempotency (prevent duplicate transactions)
        // -------------------------------------------------------------
        console.log('\n👉 [Test 3] Repeated Save Idempotency check on Customer B...');
        let req3 = mockReq({ id: sale1._id.toString() }, {
            customerName: 'Khata Cust Beta',
            customerMobile: '9888222222',
            paymentMethod: 'Khata',
            khataCustomerId: customerB._id.toString()
        });
        let res3 = mockRes();
        await saleController.updateSaleCustomer(req3, res3);

        const updatedCustB3 = await Khata.findById(customerB._id);
        if (updatedCustB3.transactions.length !== 1 || updatedCustB3.outstandingDue !== 800) {
            throw new Error(`Test 3 Failed: Duplicate ledger entries created! Length: ${updatedCustB3.transactions.length}, Due: ${updatedCustB3.outstandingDue}`);
        }
        console.log('  ✅ PASS: Repeated save does not create duplicate entries or inflate balance!');

        // -------------------------------------------------------------
        // TEST 4: Add New Khata Customer option
        // -------------------------------------------------------------
        console.log('\n👉 [Test 4] Switch Cash Sale to Khata using "Add New Khata Customer"...');
        const sale4 = await Sale.create({
            shop: testShop1._id,
            owner: testUser._id,
            invoiceNumber: 'INV-TEST-KHATA-4',
            customerName: 'Walk-in Customer',
            paymentMethod: 'UPI',
            paidAmount: 0,
            remainingAmount: 1250,
            paymentStatus: 'Unpaid',
            totalAmount: 1250,
            subtotal: 1250,
            totalProfit: 200,
            items: [{
                product: new mongoose.Types.ObjectId(),
                productName: 'Organic Seeds',
                soldQtyEntered: 5,
                soldUnit: 'Packets',
                price: 250,
                quantity: 5,
                totalPrice: 1250,
                profit: 200
            }]
        });
        createdSaleIds.push(sale4._id);

        let req4 = mockReq({ id: sale4._id.toString() }, {
            customerName: 'Brand New Farmer',
            customerMobile: '9888444444',
            paymentMethod: 'Khata',
            isNewKhataCustomer: true
        });
        let res4 = mockRes();
        await saleController.updateSaleCustomer(req4, res4);

        if (res4.statusCode !== 200) {
            throw new Error(`Test 4 Failed: HTTP ${res4.statusCode}: ${res4.data?.message}`);
        }

        const newCustomer = await Khata.findOne({ shop: testShop1._id, mobile: '9888444444' });
        if (!newCustomer) {
            throw new Error('Test 4 Failed: New Khata customer account was not created in database');
        }
        createdKhataIds.push(newCustomer._id);

        if (newCustomer.customerName !== 'Brand New Farmer' || newCustomer.outstandingDue !== 1250) {
            throw new Error(`Test 4 Failed: New Khata account details wrong. Due: ${newCustomer.outstandingDue}`);
        }

        const updatedSale4 = await Sale.findById(sale4._id);
        if (updatedSale4.khataId?.toString() !== newCustomer._id.toString()) {
            throw new Error(`Test 4 Failed: Sale was not linked to new Khata customer ID`);
        }
        console.log('  ✅ PASS: "Add New Khata Customer" created new Khata account and linked sale ID properly!');

        // -------------------------------------------------------------
        // TEST 5: Duplicate Prevention when "Add New" matches existing mobile
        // -------------------------------------------------------------
        console.log('\n👉 [Test 5] "Add New" with mobile that already exists reuses existing account...');
        const sale5 = await Sale.create({
            shop: testShop1._id,
            owner: testUser._id,
            invoiceNumber: 'INV-TEST-KHATA-5',
            customerName: 'Walk-in',
            paymentMethod: 'Cash',
            paidAmount: 0,
            remainingAmount: 300,
            paymentStatus: 'Unpaid',
            totalAmount: 300,
            subtotal: 300,
            totalProfit: 50,
            items: []
        });
        createdSaleIds.push(sale5._id);

        let req5 = mockReq({ id: sale5._id.toString() }, {
            customerName: 'Khata Cust Beta Renamed',
            customerMobile: '9888222222', // Customer B's existing mobile
            paymentMethod: 'Khata',
            isNewKhataCustomer: true
        });
        let res5 = mockRes();
        await saleController.updateSaleCustomer(req5, res5);

        const allWithMobB = await Khata.find({ shop: testShop1._id, mobile: '9888222222' });
        if (allWithMobB.length !== 1) {
            throw new Error(`Test 5 Failed: Created duplicate Khata account! Found: ${allWithMobB.length}`);
        }
        console.log('  ✅ PASS: Reused existing Khata account and prevented duplicate customer creation!');

        // -------------------------------------------------------------
        // TEST 6: Validate Selected Account Belongs to Active Shop
        // -------------------------------------------------------------
        console.log('\n👉 [Test 6] Security Check: Reject Khata customer from another shop...');
        let req6 = mockReq({ id: sale1._id.toString() }, {
            customerName: 'Foreign Customer',
            customerMobile: '9888333333',
            paymentMethod: 'Khata',
            khataCustomerId: foreignCustomer._id.toString()
        });
        let res6 = mockRes();
        await saleController.updateSaleCustomer(req6, res6);

        if (res6.statusCode !== 403) {
            throw new Error(`Test 6 Failed: Expected 403 Forbidden for cross-shop Khata selection, got ${res6.statusCode}`);
        }
        console.log('  ✅ PASS: Cross-shop customer selection properly blocked with 403 Forbidden!');

        // -------------------------------------------------------------
        // TEST 7: Require explicit customer selection when switching to Khata
        // -------------------------------------------------------------
        console.log('\n👉 [Test 7] Require explicit Khata customer selection when switching from Cash...');
        const sale7 = await Sale.create({
            shop: testShop1._id,
            owner: testUser._id,
            invoiceNumber: 'INV-TEST-KHATA-7',
            customerName: 'Walk-in',
            paymentMethod: 'Cash',
            paidAmount: 500,
            remainingAmount: 500,
            paymentStatus: 'Unpaid',
            totalAmount: 500,
            subtotal: 500,
            totalProfit: 50,
            items: []
        });
        createdSaleIds.push(sale7._id);

        let req7 = mockReq({ id: sale7._id.toString() }, {
            customerName: 'Walk-in',
            paymentMethod: 'Khata'
            // No khataCustomerId, no isNewKhataCustomer
        });
        let res7 = mockRes();
        await saleController.updateSaleCustomer(req7, res7);

        if (res7.statusCode !== 400) {
            throw new Error(`Test 7 Failed: Expected 400 Bad Request, got ${res7.statusCode}`);
        }
        console.log('  ✅ PASS: Missing Khata customer selection correctly rejected with 400 Bad Request!');

        // -------------------------------------------------------------
        // TEST 8: Reversing Khata to Cash
        // -------------------------------------------------------------
        console.log('\n👉 [Test 8] Reversing Khata back to Cash safely clears ledger...');
        let req8 = mockReq({ id: sale1._id.toString() }, {
            customerName: 'Khata Cust Beta',
            customerMobile: '9888222222',
            paymentMethod: 'Cash'
        });
        let res8 = mockRes();
        await saleController.updateSaleCustomer(req8, res8);

        const updatedCustB8 = await Khata.findById(customerB._id);
        const updatedSale8 = await Sale.findById(sale1._id);

        const hasSale1InB = updatedCustB8.transactions.some(t => t.saleId?.toString() === sale1._id.toString());
        if (hasSale1InB) {
            throw new Error('Test 8 Failed: Sale 1 was not removed from Customer B transactions!');
        }
        if (updatedSale8.paymentMethod !== 'Cash' || updatedSale8.khataId !== null) {
            throw new Error('Test 8 Failed: Sale paymentMethod not Cash or khataId not cleared!');
        }
        console.log('  ✅ PASS: Khata → Cash safely reversed ledger entry and unlinked sale.khataId!');

    } finally {
        // Cleanup test data
        await Sale.deleteMany({ _id: { $in: createdSaleIds } });
        await Khata.deleteMany({ _id: { $in: createdKhataIds } });
        console.log('\n🧹 Cleaned up test data.');
        await mongoose.disconnect();
    }

    console.log('========================================================================');
    console.log(' 🎉 ALL KHATA CUSTOMER SELECTION TESTS PASSED WITH 100% SUCCESS!');
    console.log('========================================================================\n');
}

runTests().catch(err => {
    console.error('Test execution failed:', err);
    process.exit(1);
});
