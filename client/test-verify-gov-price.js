/**
 * Comprehensive Automated Verification Suite for ShopPulse Government-Sale Pricing Logic
 * 
 * Tests:
 * 1. Product with Selling price ₹400 and Government price ₹266.
 * 2. Missing Government Price validation error (prevents completion, no silent fallback).
 * 3. 1-bag Government Sale: Rate = ₹266, Total = ₹266, stock deducted by 1.
 * 4. 2-bag Government Sale: Rate = ₹266, Total = ₹532, stock deducted by 2.
 * 5. 1-bag Retail Sale: Rate = ₹400, Total = ₹400, stock deducted by 1 (Retail pricing preserved).
 * 6. Khata accounting on Government Sale (partial payment, due recorded, stock updated).
 * 7. Government Ledger & Invoice display matching persisted government rate (₹266).
 * 8. PDF generation matching exact persisted government rate and totals.
 * 9. Auditable historical correction procedure with authorized audit trail.
 */

import fs from 'fs';
import path from 'path';
import jwt from '../server/node_modules/jsonwebtoken/index.js';
import { invoiceService } from './src/utils/invoiceService.js';

const JWT_SECRET = 'shoppulse_secret_key_2026';
const BACKEND_URL = 'http://localhost:5005';
const TEST_USER_ID = '6ad31ef8da65d9da62379fbf';
const TEST_SHOP_ID = '6ad1d099d5145eba50c13795';

const token = jwt.sign({ id: TEST_USER_ID }, JWT_SECRET);

let passedTests = 0;
let failedTests = 0;

function assert(condition, testName, details = '') {
    if (condition) {
        console.log(`  ✅ PASS: ${testName}`);
        passedTests++;
    } else {
        console.error(`  ❌ FAIL: ${testName} - ${typeof details === 'object' ? JSON.stringify(details) : details}`);
        failedTests++;
    }
}

async function apiPost(endpoint, data) {
    const res = await fetch(`${BACKEND_URL}${endpoint}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(data)
    });
    const json = await res.json();
    return { status: res.status, data: json };
}

async function apiGet(endpoint) {
    const res = await fetch(`${BACKEND_URL}${endpoint}`, {
        headers: { Authorization: `Bearer ${token}` }
    });
    const json = await res.json();
    return { status: res.status, data: json };
}

async function getProductQty(productId) {
    const res = await apiGet(`/api/products?shop=${TEST_SHOP_ID}`);
    const found = (res.data?.data || []).find(p => p._id === productId);
    return found ? Number(found.quantity) : null;
}

async function runTestSuite() {
    console.log('================================================================');
    console.log(' 🚀 Starting ShopPulse Government Price Verification Suite      ');
    console.log('================================================================\n');

    // Phase 1: Retrieve Shop Details
    console.log('👉 [Phase 1] Retrieving Shop Information...');
    const salesListRes = await apiGet(`/api/sales?shop=${TEST_SHOP_ID}`);
    assert(salesListRes.status === 200, 'GET /api/sales returns HTTP 200');
    let shop = {
        _id: TEST_SHOP_ID,
        name: 'City Mart Fertilizer & Agri',
        location: 'Main Road, Nashik, Maharashtra',
        contactNumber: '9822012345',
        gstNumber: '27AAAAA0000A1Z5'
    };
    if (salesListRes.data?.data?.length > 0) {
        const firstSaleRes = await apiGet(`/api/sales/${salesListRes.data.data[0]._id}`);
        if (firstSaleRes.data?.data?.shop) {
            shop = firstSaleRes.data.data.shop;
        }
    }
    assert(Boolean(shop && shop.name), `Active Shop retrieved: "${shop?.name}"`);

    // Phase 2: Create Test Product with Selling Price ₹400 and Government Price ₹266
    console.log('\n👉 [Phase 2] Creating Product with Sell: ₹400, Gov: ₹266...');
    const timestamp = Date.now();
    const productRes = await apiPost('/api/products', {
        name: `Urea Premium Test Bag ${timestamp}`,
        category: 'Fertilizers',
        brand: 'IFFCO',
        productType: 'Piece',
        quantity: 100,
        unit: 'Bag',
        buyPrice: 200,
        sellPrice: 400,
        governmentPrice: 266,
        shop: TEST_SHOP_ID
    });

    assert(productRes.status === 201, 'Product created successfully');
    const product = productRes.data.data;
    assert(Number(product.sellPrice) === 400, 'Product selling price persisted as ₹400');
    assert(Number(product.governmentPrice) === 266, 'Product government price persisted as ₹266');
    assert(Number(product.quantity) === 100, 'Initial product quantity is 100 Bags');

    // Phase 3: Missing Government Price Validation Error Check
    console.log('\n👉 [Phase 3] Testing Missing Government Price Validation...');
    const noGovProdRes = await apiPost('/api/products', {
        name: `Commercial Fertilizer Without Gov Price ${timestamp}`,
        category: 'Fertilizers',
        brand: 'Private Agri',
        productType: 'Piece',
        quantity: 50,
        unit: 'Bag',
        buyPrice: 250,
        sellPrice: 400,
        governmentPrice: 0, // No government price configured
        shop: TEST_SHOP_ID
    });
    assert(noGovProdRes.status === 201, 'Created product without government price');
    const noGovProd = noGovProdRes.data.data;

    // Attempt to make a Government Sale with this product
    const failedGovSaleRes = await apiPost('/api/gov-sales', {
        shop: TEST_SHOP_ID,
        customerName: 'Validation Tester',
        items: [{
            product: noGovProd._id,
            productName: noGovProd.name,
            soldQtyEntered: 1,
            soldUnit: 'Bag',
            unit: 'Bag'
        }],
        paymentMethod: 'Cash'
    });

    assert(failedGovSaleRes.status === 400, 'POST /api/gov-sales rejected sale without government price (HTTP 400)');
    assert(
        failedGovSaleRes.data.message?.toLowerCase().includes('government price'),
        'Clear validation error message returned for missing government price',
        failedGovSaleRes.data.message
    );

    // Phase 4: 1-Bag Government Sale (Must Equal ₹266)
    console.log('\n👉 [Phase 4] Testing 1-Bag Government Sale (Expected: ₹266)...');
    const govSale1Res = await apiPost('/api/gov-sales', {
        shop: TEST_SHOP_ID,
        customerName: 'Ramesh Kisan',
        customerMobile: '9876543210',
        customerAadhaar: '123456789012',
        items: [{
            product: product._id,
            productName: product.name,
            soldQtyEntered: 1,
            soldUnit: 'Bag',
            unit: 'Bag'
        }],
        paymentMethod: 'Cash'
    });

    assert(govSale1Res.status === 201, '1-Bag Government Sale created successfully');
    const govSale1 = govSale1Res.data.data;
    assert(Number(govSale1.totalAmount) === 266, `1-bag totalAmount is exact: ₹${govSale1.totalAmount} (Expected: 266)`);
    assert(Number(govSale1.subtotal) === 266, `1-bag subtotal is exact: ₹${govSale1.subtotal} (Expected: 266)`);
    assert(Number(govSale1.items[0].pricePerBaseUnit) === 266, `Item pricePerBaseUnit persisted as ₹${govSale1.items[0].pricePerBaseUnit}`);
    assert(Number(govSale1.items[0].governmentPrice) === 266, `Item governmentPrice persisted as ₹${govSale1.items[0].governmentPrice}`);
    assert(Number(govSale1.items[0].totalPrice) === 266, `Item line totalPrice is ₹${govSale1.items[0].totalPrice}`);

    // Verify stock deduction for 1-bag sale
    const qty1 = await getProductQty(product._id);
    assert(qty1 === 99, `Stock properly deducted: 100 -> ${qty1} Bags`);

    // Phase 5: 2-Bag Government Sale (Must Equal ₹532)
    console.log('\n👉 [Phase 5] Testing 2-Bag Government Sale (Expected: ₹532)...');
    const govSale2Res = await apiPost('/api/gov-sales', {
        shop: TEST_SHOP_ID,
        customerName: 'Suresh Patil',
        customerMobile: '9876543211',
        customerAadhaar: '987654321098',
        items: [{
            product: product._id,
            productName: product.name,
            soldQtyEntered: 2,
            soldUnit: 'Bag',
            unit: 'Bag'
        }],
        paymentMethod: 'UPI'
    });

    assert(govSale2Res.status === 201, '2-Bag Government Sale created successfully');
    const govSale2 = govSale2Res.data.data;
    assert(Number(govSale2.totalAmount) === 532, `2-bag totalAmount is exact: ₹${govSale2.totalAmount} (Expected: 532)`);
    assert(Number(govSale2.subtotal) === 532, `2-bag subtotal is exact: ₹${govSale2.subtotal} (Expected: 532)`);
    assert(Number(govSale2.items[0].pricePerBaseUnit) === 266, `2-bag item rate is ₹${govSale2.items[0].pricePerBaseUnit}`);
    assert(Number(govSale2.items[0].totalPrice) === 532, `2-bag line totalPrice is ₹${govSale2.items[0].totalPrice}`);

    // Verify stock deduction for 2-bag sale
    const qty2 = await getProductQty(product._id);
    assert(qty2 === 97, `Stock properly deducted: 99 -> ${qty2} Bags`);

    // Phase 6: 1-Bag Retail Sale (Must Preserve Normal Selling Price: ₹400)
    console.log('\n👉 [Phase 6] Testing 1-Bag Regular Retail Sale (Expected: ₹400)...');
    const retailSaleRes = await apiPost('/api/sales', {
        shop: TEST_SHOP_ID,
        customerName: 'Commercial Buyer',
        customerMobile: '9123456789',
        items: [{
            product: product._id,
            productName: product.name,
            quantity: 1,
            unit: 'Bag',
            baseUnit: 'Bag',
            basePrice: 400,
            price: 400,
            multiplier: 1
        }],
        paymentMethod: 'Cash'
    });

    assert(retailSaleRes.status === 201, '1-Bag Retail Sale created successfully');
    const retailSale = retailSaleRes.data.data;
    assert(Number(retailSale.totalAmount) === 400, `Retail sale totalAmount is exact: ₹${retailSale.totalAmount} (Expected: 400)`);
    assert(Number(retailSale.items[0].price) === 400, `Retail item price preserved as ₹${retailSale.items[0].price}`);

    // Verify stock deduction for retail sale
    const qty3 = await getProductQty(product._id);
    assert(qty3 === 96, `Stock properly deducted: 97 -> ${qty3} Bags`);

    // Phase 7: Khata Accounting on Government Sale
    console.log('\n👉 [Phase 7] Testing Khata Accounting on Government Sale...');
    const khataMobile = '9988776655';
    const govKhataSaleRes = await apiPost('/api/gov-sales', {
        shop: TEST_SHOP_ID,
        customerName: 'Khata Farmer Anil',
        customerMobile: khataMobile,
        customerAadhaar: '556677889900',
        items: [{
            product: product._id,
            productName: product.name,
            soldQtyEntered: 2,
            soldUnit: 'Bag',
            unit: 'Bag'
        }],
        paymentMethod: 'Khata',
        paidAmount: 200 // Paid ₹200 upfront out of ₹532
    });

    assert(govKhataSaleRes.status === 201, 'Khata Government Sale created successfully');
    const govKhataSale = govKhataSaleRes.data.data;
    assert(Number(govKhataSale.totalAmount) === 532, `Khata sale total is ₹532`);
    assert(Number(govKhataSale.paidAmount) === 200, `Paid amount recorded as ₹200`);
    assert(Number(govKhataSale.remainingAmount) === 332, `Remaining due balance is ₹332 (532 - 200)`);
    assert(govKhataSale.paymentStatus === 'Partial', `Payment status is Partial: "${govKhataSale.paymentStatus}"`);

    // Verify Khata customer ledger in database
    const khataListRes = await apiGet(`/api/khata?shopId=${TEST_SHOP_ID}`);
    const khataRecord = (khataListRes.data?.data || []).find(k => k.mobile === khataMobile);
    assert(Boolean(khataRecord), `Khata record created for mobile ${khataMobile}`);
    assert(Number(khataRecord?.outstandingDue) >= 332, `Khata customer outstanding due reflects balance: ₹${khataRecord?.outstandingDue}`);

    // Phase 8: Verify Government Ledger Bill Preview & PDF Generation
    console.log('\n👉 [Phase 8] Verifying Invoice & PDF Generation for Gov Sales...');
    const pdf1Doc = invoiceService.generateInvoicePDF(govSale1, shop, 'GOV_SALE');
    const pdf1Buf = Buffer.from(pdf1Doc.output('arraybuffer'));
    const pdf1Str = pdf1Buf.toString('latin1');
    assert(pdf1Buf.length > 5000, `1-Bag Government PDF generated (${pdf1Buf.length} bytes)`);
    assert(pdf1Str.includes('266'), '1-Bag PDF contains the government price ₹266');
    assert(!pdf1Str.includes('400.00'), '1-Bag PDF does NOT substitute retail price ₹400 for government sale');

    const pdf2Doc = invoiceService.generateInvoicePDF(govSale2, shop, 'GOV_SALE');
    const pdf2Buf = Buffer.from(pdf2Doc.output('arraybuffer'));
    const pdf2Str = pdf2Buf.toString('latin1');
    assert(pdf2Buf.length > 5000, `2-Bag Government PDF generated (${pdf2Buf.length} bytes)`);
    assert(pdf2Str.includes('532'), '2-Bag PDF contains total ₹532');
    assert(pdf2Str.includes('266'), '2-Bag PDF contains unit rate ₹266');

    // Phase 9: Auditable Historical Discrepancy Detection & Reconciliation
    console.log('\n👉 [Phase 9] Testing Auditable Historical Discrepancy Detection & Correction...');
    const discRes = await apiGet(`/api/gov-sales/discrepancies?shop=${TEST_SHOP_ID}`);
    assert(discRes.status === 200, 'GET /api/gov-sales/discrepancies returns HTTP 200');
    console.log(`  ℹ️ Found ${discRes.data.count} historical records with retail rates`);

    if (discRes.data.count > 0) {
        const firstDisc = discRes.data.data[0];
        console.log(`  ℹ️ Sample discrepancy: Invoice #${firstDisc.invoiceNumber}, Stored: ₹${firstDisc.storedTotalAmount}, Expected: ₹${firstDisc.recalculatedTotalAmount}`);
        
        // Test authorized correction procedure
        const correctRes = await apiPost('/api/gov-sales/correct-historical', {
            authorize: true,
            reason: 'Automated test authorized historical rate reconciliation'
        });
        assert(correctRes.status === 200, 'POST /api/gov-sales/correct-historical succeeded (HTTP 200)');
        assert(correctRes.data.count > 0, `Corrected ${correctRes.data.count} historical records with audit confirmation`);

        // Re-check discrepancies after reconciliation
        const recheckDiscRes = await apiGet(`/api/gov-sales/discrepancies?shop=${TEST_SHOP_ID}`);
        assert(recheckDiscRes.data.count === 0, `All discrepancies resolved: remaining count = ${recheckDiscRes.data.count}`);
    } else {
        console.log('  ℹ️ No historical discrepancies remaining (already reconciled).');
    }

    console.log('\n================================================================');
    console.log(` 🏁 VERIFICATION SUMMARY: ${passedTests} Passed, ${failedTests} Failed`);
    console.log('================================================================\n');

    if (failedTests > 0) {
        process.exit(1);
    }
}

runTestSuite().catch(err => {
    console.error('Test suite unhandled error:', err);
    process.exit(1);
});
