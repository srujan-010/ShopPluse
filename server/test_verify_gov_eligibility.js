/**
 * ShopPulse — Verification Suite: Government Sales Eligibility
 * 
 * Tests all required cases:
 * 1. Fertilizer Shop + Fertilizers category + government price > 0: eligible.
 * 2. Fertilizer Shop + a different category + government price > 0: eligible.
 * 3. Fertilizer Shop + any category + government price zero or null: ineligible.
 * 4. Non-fertilizer shop: government section remains hidden and government sales blocked.
 * 5. Government bill shows the configured government rate, not the normal selling rate.
 * 6. GST breakdown, totals, inventory deduction, and government ledger remain correct.
 * 7. Regular POS sales continue to use normal selling prices.
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
const Sale = require('./models/Sale');
const GovernmentSale = require('./models/GovernmentSale');
const InventoryHistory = require('./models/InventoryHistory');
const saleController = require('./controllers/saleController');
const govSaleController = require('./controllers/govSaleController');

function assert(condition, message) {
    if (!condition) {
        console.error(`❌ ASSERTION FAILED: ${message}`);
        throw new Error(message);
    }
    console.log(`  ✓ ${message}`);
}

function approxEqual(a, b, epsilon = 0.05) {
    return Math.abs(Number(a) - Number(b)) <= epsilon;
}

function mockResponse() {
    let resData = null;
    let resStatus = 200;
    const res = {
        status: (code) => {
            resStatus = code;
            return {
                json: (data) => {
                    resData = data;
                    return data;
                }
            };
        },
        json: (data) => {
            resData = data;
            return data;
        }
    };
    return { res, getStatus: () => resStatus, getData: () => resData };
}

async function run() {
    console.log('===============================================================');
    console.log('   ShopPulse Government Sales Eligibility Test Suite');
    console.log('===============================================================');

    const uri = process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://localhost:27017/shop_pulse';
    await mongoose.connect(uri);
    console.log('Connected to MongoDB.\n');

    // 1. Get or create test owner
    let owner = await User.findOne({ email: 'gov_eligibility_test@shoppulse.com' });
    if (!owner) {
        owner = await User.create({
            name: 'Gov Eligibility Tester',
            email: 'gov_eligibility_test@shoppulse.com',
            password: 'Password123!',
            phone: '9900112233',
            role: 'user'
        });
    }

    // 2. Create Fertilizer Shop
    let fertShop = await Shop.findOne({ name: 'Gov Test Fertilizer Shop', owner: owner._id });
    if (!fertShop) {
        fertShop = await Shop.create({
            name: 'Gov Test Fertilizer Shop',
            type: 'Fertilizers',
            location: 'Main Road, Agritown',
            contactNumber: '9876543210',
            owner: owner._id,
            invoicePrefix: 'FTEST',
            govInvoiceCounter: 1000
        });
    } else {
        fertShop.type = 'Fertilizers';
        await fertShop.save();
    }

    // 3. Create Non-Fertilizer Shop
    let nonFertShop = await Shop.findOne({ name: 'Gov Test Grocery Shop', owner: owner._id });
    if (!nonFertShop) {
        nonFertShop = await Shop.create({
            name: 'Gov Test Grocery Shop',
            type: 'Grocery',
            location: 'Market Square, Agritown',
            contactNumber: '9876543211',
            owner: owner._id,
            invoicePrefix: 'GTEST'
        });
    } else {
        nonFertShop.type = 'Grocery';
        await nonFertShop.save();
    }

    // 4. Create Test Products in Fertilizer Shop
    // Product 1: Category 'Fertilizers', Gov Price: ₹266, Sell Price: ₹350, Qty: 100
    let ureaProd = await Product.create({
        name: 'Test Urea Bio-Nitrogen',
        category: 'Fertilizers',
        unit: 'Bag',
        buyPrice: 200,
        sellPrice: 350,
        governmentPrice: 266,
        quantity: 100,
        isGstApplicable: true,
        gstRate: 5,
        gstPricingMode: 'inclusive',
        shop: fertShop._id,
        owner: owner._id
    });

    // Product 2: Category 'Seeds' (Different category), Gov Price: ₹150, Sell Price: ₹220, Qty: 50
    let seedProd = await Product.create({
        name: 'Test Hybrid Cotton Seeds',
        category: 'Seeds',
        unit: 'Packet',
        buyPrice: 120,
        sellPrice: 220,
        governmentPrice: 150,
        quantity: 50,
        isGstApplicable: true,
        gstRate: 5,
        gstPricingMode: 'inclusive',
        shop: fertShop._id,
        owner: owner._id
    });

    // Product 3: Category 'Pesticides' (Different category), Gov Price: ₹0, Sell Price: ₹450, Qty: 30
    let pestProd = await Product.create({
        name: 'Test Neem Pest Shield',
        category: 'Pesticides',
        unit: 'Bottle',
        buyPrice: 300,
        sellPrice: 450,
        governmentPrice: 0,
        quantity: 30,
        isGstApplicable: false,
        shop: fertShop._id,
        owner: owner._id
    });

    // Product 4: Category 'Fertilizers' (Fertilizer category), Gov Price: null/missing, Sell Price: ₹500, Qty: 20
    let fertNoGovPrice = await Product.create({
        name: 'Test Premium Organic Manure',
        category: 'Fertilizers',
        unit: 'Bag',
        buyPrice: 350,
        sellPrice: 500,
        governmentPrice: null,
        quantity: 20,
        isGstApplicable: false,
        shop: fertShop._id,
        owner: owner._id
    });

    // Product 5: Product in Non-Fertilizer Shop
    let groceryProd = await Product.create({
        name: 'Test Basmati Rice',
        category: 'Grains',
        unit: 'Bag',
        buyPrice: 800,
        sellPrice: 1100,
        governmentPrice: 900,
        quantity: 40,
        isGstApplicable: false,
        shop: nonFertShop._id,
        owner: owner._id
    });

    try {
        console.log('--- TEST CASE 1: Fertilizer Shop + Fertilizers Category + Gov Price > 0 (Urea ₹266) ---');
        {
            // Direct Government Sale creation
            const { res, getStatus, getData } = mockResponse();
            await govSaleController.createGovSale({
                user: { id: owner._id },
                body: {
                    shop: fertShop._id,
                    customerName: 'Kisan Kumar',
                    customerMobile: '9876540001',
                    paymentMethod: 'Cash',
                    items: [{
                        product: ureaProd._id,
                        soldQtyEntered: 2,
                        soldUnit: 'Bag'
                    }]
                }
            }, res);

            assert(getStatus() === 201, `Status is 201 Created (got ${getStatus()})`);
            const saleData = getData().data;
            assert(saleData.items.length === 1, 'Sale has 1 item');
            assert(saleData.items[0].governmentPrice === 266, `Configured gov rate ₹266 persisted (got ${saleData.items[0].governmentPrice})`);
            assert(saleData.items[0].pricePerBaseUnit === 266, `Unit rate is ₹266 (got ${saleData.items[0].pricePerBaseUnit})`);
            assert(approxEqual(saleData.totalAmount, 532), `Total amount is ₹532 (got ${saleData.totalAmount})`);
            assert(saleData.invoiceNumber.startsWith('GOV-INV-'), `Invoice starts with GOV-INV- (got ${saleData.invoiceNumber})`);

            // Verify stock deduction
            const updatedUrea = await Product.findById(ureaProd._id);
            assert(updatedUrea.quantity === 98, `Urea stock reduced from 100 to 98 (got ${updatedUrea.quantity})`);
        }

        console.log('\n--- TEST CASE 2: Fertilizer Shop + Different Category + Gov Price > 0 (Cotton Seeds ₹150) ---');
        {
            // Direct Government Sale creation for non-fertilizer category product with gov price > 0
            const { res, getStatus, getData } = mockResponse();
            await govSaleController.createGovSale({
                user: { id: owner._id },
                body: {
                    shop: fertShop._id,
                    customerName: 'Suresh Patel',
                    customerMobile: '9876540002',
                    paymentMethod: 'UPI',
                    items: [{
                        product: seedProd._id,
                        soldQtyEntered: 3,
                        soldUnit: 'Packet'
                    }]
                }
            }, res);

            assert(getStatus() === 201, `Seeds product with Gov Price > 0 is ELIGIBLE: Status 201 Created (got ${getStatus()})`);
            const saleData = getData().data;
            assert(saleData.items[0].productName === 'Test Hybrid Cotton Seeds', `Item name matches: ${saleData.items[0].productName}`);
            assert(saleData.items[0].governmentPrice === 150, `Configured gov rate ₹150 used (got ${saleData.items[0].governmentPrice})`);
            assert(approxEqual(saleData.totalAmount, 450), `Total is 3 × ₹150 = ₹450 (got ${saleData.totalAmount})`);

            // Verify stock deduction
            const updatedSeed = await Product.findById(seedProd._id);
            assert(updatedSeed.quantity === 47, `Seed stock reduced from 50 to 47 (got ${updatedSeed.quantity})`);

            // Verify Stock History entry
            const history = await InventoryHistory.findOne({ productId: seedProd._id, referenceId: saleData.invoiceNumber });
            assert(Boolean(history), 'InventoryHistory logged for government sale of seeds');
            assert(history.actionType === 'STOCK_SOLD', 'Action type is STOCK_SOLD');
        }

        console.log('\n--- TEST CASE 3: Fertilizer Shop + Any Category + Gov Price 0 or Missing (Ineligible) ---');
        {
            // 3A: Product with governmentPrice == 0
            const { res: resA, getStatus: getStatusA, getData: getDataA } = mockResponse();
            await govSaleController.createGovSale({
                user: { id: owner._id },
                body: {
                    shop: fertShop._id,
                    customerName: 'Rajesh Singh',
                    customerMobile: '9876540003',
                    paymentMethod: 'Cash',
                    items: [{
                        product: pestProd._id,
                        soldQtyEntered: 1,
                        soldUnit: 'Bottle'
                    }]
                }
            }, resA);

            assert(getStatusA() === 400, `Pesticides with govPrice=0 rejected with 400 (got ${getStatusA()})`);
            assert(getDataA().message.includes('Government Price'), `Error message mentions Government Price: "${getDataA().message}"`);

            // 3B: Product with governmentPrice == null / missing
            const { res: resB, getStatus: getStatusB, getData: getDataB } = mockResponse();
            await govSaleController.createGovSale({
                user: { id: owner._id },
                body: {
                    shop: fertShop._id,
                    customerName: 'Rajesh Singh',
                    customerMobile: '9876540003',
                    paymentMethod: 'Cash',
                    items: [{
                        product: fertNoGovPrice._id,
                        soldQtyEntered: 1,
                        soldUnit: 'Bag'
                    }]
                }
            }, resB);

            assert(getStatusB() === 400, `Fertilizers category with govPrice=null rejected with 400 (got ${getStatusB()})`);
            assert(getDataB().message.includes('Government Price'), `Error message mentions Government Price: "${getDataB().message}"`);
        }

        console.log('\n--- TEST CASE 4: Non-Fertilizer Shop Blocked from Government Sales ---');
        {
            const { res, getStatus, getData } = mockResponse();
            await govSaleController.createGovSale({
                user: { id: owner._id },
                body: {
                    shop: nonFertShop._id,
                    customerName: 'Grocery Buyer',
                    customerMobile: '9876540004',
                    paymentMethod: 'Cash',
                    items: [{
                        product: groceryProd._id,
                        soldQtyEntered: 1,
                        soldUnit: 'Bag'
                    }]
                }
            }, res);

            assert(getStatus() === 400, `Non-fertilizer shop rejected with 400 (got ${getStatus()})`);
            assert(getData().message.includes('Fertilizer Shops'), `Message specifies Fertilizer Shops requirement: "${getData().message}"`);

            // Check auto-generation on normal retail sale in non-fertilizer shop
            const { res: resSale, getStatus: getStatusSale, getData: getDataSale } = mockResponse();
            await saleController.createSale({
                user: { id: owner._id },
                body: {
                    shop: nonFertShop._id,
                    customerName: 'Walk-in Grocery',
                    customerMobile: '9876540005',
                    paymentMethod: 'Cash',
                    items: [{
                        product: groceryProd._id,
                        quantity: 1,
                        unit: 'Bag'
                    }]
                }
            }, resSale);

            assert(getStatusSale() === 201, 'Normal sale created in grocery shop');
            const createdSaleId = getDataSale().data._id;
            const linkedGovSale = await GovernmentSale.findOne({ linkedSaleId: createdSaleId });
            assert(linkedGovSale === null, 'No GovernmentSale auto-generated for non-fertilizer shop sale');
        }

        console.log('\n--- TEST CASE 5: Government Bill Shows Configured Gov Rate, Never Normal Selling Rate ---');
        {
            // Seed product: Gov Price ₹150, Sell Price ₹220
            const { res, getStatus, getData } = mockResponse();
            await govSaleController.createGovSale({
                user: { id: owner._id },
                body: {
                    shop: fertShop._id,
                    customerName: 'Mahesh Farmer',
                    customerMobile: '9876540006',
                    paymentMethod: 'Cash',
                    items: [{
                        product: seedProd._id,
                        soldQtyEntered: 2,
                        soldUnit: 'Packet'
                    }]
                }
            }, res);

            assert(getStatus() === 201, 'Gov sale created');
            const sale = getData().data;
            const item = sale.items[0];
            assert(item.governmentPrice === 150, `Item governmentPrice is ₹150 (got ${item.governmentPrice})`);
            assert(item.pricePerBaseUnit === 150, `Item pricePerBaseUnit is ₹150 (got ${item.pricePerBaseUnit})`);
            assert(item.pricePerBaseUnit !== seedProd.sellPrice, `Rate is NOT retail rate ₹${seedProd.sellPrice}`);
            assert(approxEqual(item.totalPrice, 300), `Line total is ₹300 (got ${item.totalPrice})`);
            assert(approxEqual(sale.totalAmount, 300), `Bill total is ₹300 (got ${sale.totalAmount})`);
        }

        console.log('\n--- TEST CASE 6: GST Breakdown, Totals, Inventory Deduction & Gov Ledger Integrity ---');
        {
            // Urea: Gov Price ₹266, 5% GST Inclusive
            // 4 bags = ₹1,064.00
            // Taxable: 1064 / 1.05 = ₹1,013.33
            // GST: ₹50.67 (CGST: ₹25.33, SGST: ₹25.34)
            const { res, getStatus, getData } = mockResponse();
            await govSaleController.createGovSale({
                user: { id: owner._id },
                body: {
                    shop: fertShop._id,
                    customerName: 'Anand Kumar',
                    customerMobile: '9876540007',
                    paymentMethod: 'Cash',
                    items: [{
                        product: ureaProd._id,
                        soldQtyEntered: 4,
                        soldUnit: 'Bag'
                    }]
                }
            }, res);

            assert(getStatus() === 201, 'Gov sale created');
            const sale = getData().data;
            assert(approxEqual(sale.totalAmount, 1064.00), `Total amount is ₹1,064.00 (got ${sale.totalAmount})`);
            assert(approxEqual(sale.taxableAmount, 1013.33), `Taxable amount is ₹1,013.33 (got ${sale.taxableAmount})`);
            assert(approxEqual(sale.totalGst, 50.67), `Total GST is ₹50.67 (got ${sale.totalGst})`);
            assert(approxEqual(sale.cgstTotal, 25.33) || approxEqual(sale.cgstTotal, 25.34), `CGST is ~₹25.33 (got ${sale.cgstTotal})`);
            assert(approxEqual(sale.sgstTotal, 25.34) || approxEqual(sale.sgstTotal, 25.33), `SGST is ~₹25.34 (got ${sale.sgstTotal})`);

            // Check stock deduction
            const currentUrea = await Product.findById(ureaProd._id);
            assert(currentUrea.quantity === 94, `Urea stock reduced from 98 to 94 (got ${currentUrea.quantity})`);

            // Check ledger fetch (getGovSales)
            const { res: resLedger, getStatus: getStatusLedger, getData: getDataLedger } = mockResponse();
            await govSaleController.getGovSales({
                user: { id: owner._id },
                query: { shop: fertShop._id.toString() }
            }, resLedger);

            assert(getStatusLedger() === 200, 'Gov sales ledger fetched successfully');
            const foundSale = getDataLedger().data.find(s => s._id.toString() === sale._id.toString());
            assert(Boolean(foundSale), 'Transaction present in government sales ledger');
            assert(approxEqual(foundSale.totalAmount, 1064.00), 'Ledger displays identical total amount ₹1,064.00');
            assert(foundSale.items[0].governmentPrice === 266, 'Ledger displays identical unit rate ₹266');
        }

        console.log('\n--- TEST CASE 7: Regular POS Sales Continue to Use Normal Selling Prices ---');
        {
            // Sell 2 bags of Urea in Regular POS
            // Normal Sell Price: ₹350 (inclusive 5%)
            // Total: 2 × ₹350 = ₹700.00
            // Since Urea has govPrice ₹266, normal sale should ALSO auto-generate linked GovSale at ₹266
            const { res, getStatus, getData } = mockResponse();
            await saleController.createSale({
                user: { id: owner._id },
                body: {
                    shop: fertShop._id,
                    customerName: 'Regular Retail Buyer',
                    customerMobile: '9876540008',
                    paymentMethod: 'Cash',
                    items: [{
                        product: ureaProd._id,
                        quantity: 2,
                        unit: 'Bag'
                    }]
                }
            }, res);

            assert(getStatus() === 201, 'Regular retail sale created');
            const retailSale = getData().data;
            assert(approxEqual(retailSale.totalAmount, 700.00), `Retail sale total uses sellPrice ₹350: ₹700.00 (got ${retailSale.totalAmount})`);
            assert(retailSale.items[0].pricePerBaseUnit === 350, `Retail unit price is ₹350 (got ${retailSale.items[0].pricePerBaseUnit})`);

            // Verify linked GovernmentSale was auto-generated using govPrice ₹266
            const linkedGov = await GovernmentSale.findOne({ linkedSaleId: retailSale._id });
            assert(Boolean(linkedGov), 'Linked GovernmentSale was auto-generated');
            assert(linkedGov.items[0].governmentPrice === 266, `Linked gov sale unit rate is ₹266 (got ${linkedGov.items[0].governmentPrice})`);
            assert(approxEqual(linkedGov.totalAmount, 532.00), `Linked gov sale total is 2 × ₹266 = ₹532.00 (got ${linkedGov.totalAmount})`);

            // Also test regular POS sale with DIFFERENT category product having govPrice > 0 (Cotton Seeds)
            // Cotton seeds: Sell Price ₹220, Gov Price ₹150
            const { res: resSeedSale, getStatus: getStatusSeedSale, getData: getDataSeedSale } = mockResponse();
            await saleController.createSale({
                user: { id: owner._id },
                body: {
                    shop: fertShop._id,
                    customerName: 'Regular Seed Buyer',
                    customerMobile: '9876540009',
                    paymentMethod: 'Cash',
                    items: [{
                        product: seedProd._id,
                        quantity: 2,
                        unit: 'Packet'
                    }]
                }
            }, resSeedSale);

            assert(getStatusSeedSale() === 201, 'Regular seed sale created');
            const seedRetailSale = getDataSeedSale().data;
            assert(approxEqual(seedRetailSale.totalAmount, 440.00), `Retail total uses sellPrice ₹220: ₹440.00 (got ${seedRetailSale.totalAmount})`);

            // Verify auto-generated linked gov sale for Seeds (different category!)
            const linkedSeedGov = await GovernmentSale.findOne({ linkedSaleId: seedRetailSale._id });
            assert(Boolean(linkedSeedGov), 'Linked GovernmentSale auto-generated for non-fertilizer category (Seeds)!');
            assert(linkedSeedGov.items[0].governmentPrice === 150, `Linked gov unit rate is ₹150 (got ${linkedSeedGov.items[0].governmentPrice})`);
            assert(approxEqual(linkedSeedGov.totalAmount, 300.00), `Linked gov total is 2 × ₹150 = ₹300.00 (got ${linkedSeedGov.totalAmount})`);
        }

        console.log('\n===============================================================');
        console.log('   🎉 ALL 7 TEST CASES PASSED WITH 100% SUCCESS!');
        console.log('===============================================================');
    } finally {
        // Clean up test records
        console.log('\nCleaning up test records...');
        await GovernmentSale.deleteMany({ shop: { $in: [fertShop._id, nonFertShop._id] } });
        await Sale.deleteMany({ shop: { $in: [fertShop._id, nonFertShop._id] } });
        await InventoryHistory.deleteMany({ shop: { $in: [fertShop._id, nonFertShop._id] } });
        await Product.deleteMany({ _id: { $in: [ureaProd._id, seedProd._id, pestProd._id, fertNoGovPrice._id, groceryProd._id] } });
        await Shop.deleteMany({ _id: { $in: [fertShop._id, nonFertShop._id] } });
        await User.deleteMany({ _id: owner._id });
        await mongoose.disconnect();
        console.log('Cleaned up and disconnected from MongoDB.');
    }
}

run().catch(err => {
    console.error('Test execution failed:', err);
    process.exit(1);
});
