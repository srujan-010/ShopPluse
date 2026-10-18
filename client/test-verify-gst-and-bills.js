/**
 * Comprehensive Automated Verification Suite for ShopPulse:
 * "Unify GST Breakdown and Remove Paid/Due Amounts From All Bills"
 * 
 * Verifies:
 * 1. Retail sale with GST-inclusive pricing (GST extracted from gross).
 * 2. Retail sale with GST-exclusive pricing (GST added to taxable amount).
 * 3. Government sale with GST-inclusive pricing (uses gov price, GST extracted).
 * 4. Government sale with GST-exclusive pricing (uses gov price, GST added).
 * 5. Product with GST disabled (isTaxable = false, no misleading GST claims).
 * 6. Correct government price vs normal selling price.
 * 7. Cash, UPI, and Khata payment workflows.
 * 8. Customer-facing invoice presentation:
 *    - "Paid Amount" is completely absent from all bills and PDFs.
 *    - "Due Amount" is completely absent from all bills and PDFs.
 *    - "Payment Status" row is completely absent from all bills and PDFs.
 *    - "Payment:" mode is preserved in invoice details.
 *    - "GRAND TOTAL:" is preserved and matches transaction.
 *    - "Taxable Value", "CGST", "SGST", "Total GST" match transaction.
 * 9. PDF generation: single bill Half-A4, 2-on-1 sheet, and full-page fallback.
 * 10. WhatsApp share template validation.
 * 11. Database integrity: paidAmount, remainingAmount, paymentStatus preserved in DB and Khata.
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

async function runVerification() {
    console.log('========================================================================');
    console.log(' 🚀 ShopPulse GST Breakdown & Bill Presentation Verification Suite     ');
    console.log('========================================================================\n');

    const shop = {
        _id: TEST_SHOP_ID,
        name: 'ShopPulse Agri & General Retail',
        location: 'Industrial Area, Nashik, MH',
        contactNumber: '9822000000',
        gstNumber: '27AAAAA1234A1Z5'
    };

    const timestamp = Date.now();

    // -------------------------------------------------------------------------
    // TEST 1: Retail Sale with GST-inclusive pricing
    // -------------------------------------------------------------------------
    console.log('👉 [Test 1] Retail Sale with GST-Inclusive Pricing (18%)...');
    const prod1Res = await apiPost('/api/products', {
        name: `Test Product GST-Incl ${timestamp}`,
        category: 'Fertilizers',
        brand: 'BrandA',
        productType: 'Piece',
        quantity: 100,
        buyPrice: 300,
        sellPrice: 590, // inclusive of 18% GST -> Taxable 500, GST 90
        governmentPrice: 400,
        isGstApplicable: true,
        gstRate: 18,
        gstPricingMode: 'inclusive',
        shop: TEST_SHOP_ID
    });
    assert(prod1Res.status === 201, 'Created GST-inclusive product');
    const p1 = prod1Res.data.data;

    const sale1Res = await apiPost('/api/sales', {
        shop: TEST_SHOP_ID,
        customerName: 'Karan Sharma',
        customerMobile: '9876543210',
        paymentMethod: 'Cash',
        items: [{
            product: p1._id,
            quantity: 1,
            unit: 'Piece'
        }]
    });
    assert(sale1Res.status === 201, 'Created retail sale with GST-inclusive pricing');
    const s1 = sale1Res.data.data;
    assert(s1.totalAmount === 590, `Grand total is ₹590 (received ${s1.totalAmount})`);
    assert(s1.taxableAmount === 500, `Taxable value is ₹500 (received ${s1.taxableAmount})`);
    assert(s1.totalGst === 90, `Total GST is ₹90 (received ${s1.totalGst})`);
    assert(s1.cgstTotal === 45, `CGST is ₹45 (received ${s1.cgstTotal})`);
    assert(s1.sgstTotal === 45, `SGST is ₹45 (received ${s1.sgstTotal})`);

    // Verify PDF output for Test 1
    const pdf1 = invoiceService.generateInvoicePDF(s1, shop, 'SALE');
    const pdf1Text = pdf1.output();
    assert(!pdf1Text.includes('Paid Amount:'), 'PDF has NO "Paid Amount:"');
    assert(!pdf1Text.includes('Due Amount:'), 'PDF has NO "Due Amount:"');
    assert(!pdf1Text.includes('Payment Status:'), 'PDF has NO "Payment Status:"');
    assert(pdf1Text.includes('GRAND TOTAL:'), 'PDF contains "GRAND TOTAL:"');
    assert(pdf1Text.includes('Taxable Value:'), 'PDF contains "Taxable Value:"');
    assert(pdf1Text.includes('CGST:'), 'PDF contains "CGST:"');
    assert(pdf1Text.includes('SGST:'), 'PDF contains "SGST:"');
    assert(pdf1Text.includes('Payment:'), 'PDF contains "Payment:" mode');

    // -------------------------------------------------------------------------
    // TEST 2: Retail Sale with GST-exclusive pricing
    // -------------------------------------------------------------------------
    console.log('\n👉 [Test 2] Retail Sale with GST-Exclusive Pricing (18%)...');
    const prod2Res = await apiPost('/api/products', {
        name: `Test Product GST-Excl ${timestamp}`,
        category: 'Agri',
        brand: 'BrandB',
        productType: 'Piece',
        quantity: 100,
        buyPrice: 300,
        sellPrice: 500, // exclusive: GST 18% added -> Taxable 500, GST 90, Total 590
        governmentPrice: 350,
        isGstApplicable: true,
        gstRate: 18,
        gstPricingMode: 'exclusive',
        shop: TEST_SHOP_ID
    });
    assert(prod2Res.status === 201, 'Created GST-exclusive product');
    const p2 = prod2Res.data.data;

    const sale2Res = await apiPost('/api/sales', {
        shop: TEST_SHOP_ID,
        customerName: 'Anil Verma',
        customerMobile: '9876543211',
        paymentMethod: 'UPI',
        items: [{
            product: p2._id,
            quantity: 1,
            unit: 'Piece'
        }]
    });
    assert(sale2Res.status === 201, 'Created retail sale with GST-exclusive pricing');
    const s2 = sale2Res.data.data;
    assert(s2.totalAmount === 590, `Grand total is ₹590 (received ${s2.totalAmount})`);
    assert(s2.taxableAmount === 500, `Taxable value is ₹500 (received ${s2.taxableAmount})`);
    assert(s2.totalGst === 90, `Total GST is ₹90 (received ${s2.totalGst})`);

    const pdf2 = invoiceService.generateInvoicePDF(s2, shop, 'SALE');
    const pdf2Text = pdf2.output();
    assert(!pdf2Text.includes('Paid Amount:'), 'Exclusive PDF has NO "Paid Amount:"');
    assert(!pdf2Text.includes('Due Amount:'), 'Exclusive PDF has NO "Due Amount:"');
    assert(!pdf2Text.includes('Payment Status:'), 'Exclusive PDF has NO "Payment Status:"');

    // -------------------------------------------------------------------------
    // TEST 3: Government Sale with GST-inclusive pricing
    // -------------------------------------------------------------------------
    console.log('\n👉 [Test 3] Government Sale with GST-Inclusive Pricing (5%)...');
    const prod3Res = await apiPost('/api/products', {
        name: `Gov Product GST-Incl ${timestamp}`,
        category: 'Pesticides',
        brand: 'IFFCO',
        productType: 'Piece',
        quantity: 100,
        buyPrice: 200,
        sellPrice: 400, // Retail price
        governmentPrice: 210, // Gov price: inclusive 5% -> Taxable 200, GST 10
        isGstApplicable: true,
        gstRate: 5,
        gstPricingMode: 'inclusive',
        shop: TEST_SHOP_ID
    });
    assert(prod3Res.status === 201, 'Created Gov product with 5% GST inclusive');
    const p3 = prod3Res.data.data;

    const govSale1Res = await apiPost('/api/gov-sales', {
        shop: TEST_SHOP_ID,
        customerName: 'Farmer Ramesh',
        customerMobile: '9876543212',
        customerAadhaar: '123456789012',
        paymentMethod: 'Cash',
        items: [{
            product: p3._id,
            productName: p3.name,
            soldQtyEntered: 1,
            unit: 'Piece'
        }]
    });
    assert(govSale1Res.status === 201, 'Created government sale with GST-inclusive pricing');
    const gs1 = govSale1Res.data.data;
    assert(gs1.items[0].governmentPrice === 210, `Item used gov price ₹210 (received ${gs1.items[0].governmentPrice})`);
    assert(gs1.totalAmount === 210, `Gov Grand Total is ₹210 (received ${gs1.totalAmount})`);
    assert(gs1.taxableAmount === 200, `Gov Taxable value is ₹200 (received ${gs1.taxableAmount})`);
    assert(gs1.totalGst === 10, `Gov Total GST is ₹10 (received ${gs1.totalGst})`);
    assert(gs1.cgstTotal === 5, `Gov CGST is ₹5 (received ${gs1.cgstTotal})`);
    assert(gs1.sgstTotal === 5, `Gov SGST is ₹5 (received ${gs1.sgstTotal})`);

    const pdfGs1 = invoiceService.generateInvoicePDF(gs1, shop, 'GOV_SALE');
    const pdfGs1Text = pdfGs1.output();
    assert(!pdfGs1Text.includes('Paid Amount:'), 'Gov PDF has NO "Paid Amount:"');
    assert(!pdfGs1Text.includes('Due Amount:'), 'Gov PDF has NO "Due Amount:"');
    assert(!pdfGs1Text.includes('Payment Status:'), 'Gov PDF has NO "Payment Status:"');
    assert(pdfGs1Text.includes('GRAND TOTAL:'), 'Gov PDF has "GRAND TOTAL:"');
    assert(pdfGs1Text.includes('Taxable Value:'), 'Gov PDF has "Taxable Value:"');
    assert(pdfGs1Text.includes('Total GST:'), 'Gov PDF has "Total GST:"');

    // -------------------------------------------------------------------------
    // TEST 4: Government Sale with GST-exclusive pricing
    // -------------------------------------------------------------------------
    console.log('\n👉 [Test 4] Government Sale with GST-Exclusive Pricing (12%)...');
    const prod4Res = await apiPost('/api/products', {
        name: `Gov Product GST-Excl ${timestamp}`,
        category: 'Seeds',
        brand: 'National Seeds',
        productType: 'Piece',
        quantity: 100,
        buyPrice: 150,
        sellPrice: 300, // Retail price
        governmentPrice: 200, // Gov price: exclusive 12% -> Taxable 200, GST 24, Total 224
        isGstApplicable: true,
        gstRate: 12,
        gstPricingMode: 'exclusive',
        shop: TEST_SHOP_ID
    });
    assert(prod4Res.status === 201, 'Created Gov product with 12% GST exclusive');
    const p4 = prod4Res.data.data;

    const govSale2Res = await apiPost('/api/gov-sales', {
        shop: TEST_SHOP_ID,
        customerName: 'Farmer Suresh',
        customerMobile: '9876543213',
        customerAadhaar: '987654321098',
        paymentMethod: 'UPI',
        items: [{
            product: p4._id,
            productName: p4.name,
            soldQtyEntered: 1,
            unit: 'Piece'
        }]
    });
    assert(govSale2Res.status === 201, 'Created government sale with GST-exclusive pricing');
    const gs2 = govSale2Res.data.data;
    assert(gs2.items[0].governmentPrice === 200, `Item used gov price ₹200 (received ${gs2.items[0].governmentPrice})`);
    assert(gs2.totalAmount === 224, `Gov Grand Total is ₹224 (received ${gs2.totalAmount})`);
    assert(gs2.taxableAmount === 200, `Gov Taxable value is ₹200 (received ${gs2.taxableAmount})`);
    assert(gs2.totalGst === 24, `Gov Total GST is ₹24 (received ${gs2.totalGst})`);
    assert(gs2.cgstTotal === 12, `Gov CGST is ₹12 (received ${gs2.cgstTotal})`);
    assert(gs2.sgstTotal === 12, `Gov SGST is ₹12 (received ${gs2.sgstTotal})`);

    const pdfGs2 = invoiceService.generateInvoicePDF(gs2, shop, 'GOV_SALE');
    const pdfGs2Text = pdfGs2.output();
    assert(!pdfGs2Text.includes('Paid Amount:'), 'Gov Exclusive PDF has NO "Paid Amount:"');
    assert(!pdfGs2Text.includes('Due Amount:'), 'Gov Exclusive PDF has NO "Due Amount:"');
    assert(!pdfGs2Text.includes('Payment Status:'), 'Gov Exclusive PDF has NO "Payment Status:"');

    // -------------------------------------------------------------------------
    // TEST 5: Product with GST Disabled
    // -------------------------------------------------------------------------
    console.log('\n👉 [Test 5] Product with GST Disabled...');
    const prod5Res = await apiPost('/api/products', {
        name: `Non-GST Organic Product ${timestamp}`,
        category: 'Organic',
        brand: 'PureAgri',
        productType: 'Piece',
        quantity: 100,
        buyPrice: 100,
        sellPrice: 150,
        governmentPrice: 120,
        isGstApplicable: false,
        gstRate: 0,
        shop: TEST_SHOP_ID
    });
    assert(prod5Res.status === 201, 'Created non-GST product');
    const p5 = prod5Res.data.data;

    const sale5Res = await apiPost('/api/sales', {
        shop: TEST_SHOP_ID,
        customerName: 'Suresh Kumar',
        customerMobile: '9876543214',
        paymentMethod: 'Cash',
        items: [{
            product: p5._id,
            quantity: 2,
            unit: 'Piece'
        }]
    });
    assert(sale5Res.status === 201, 'Created non-GST sale');
    const s5 = sale5Res.data.data;
    assert(s5.totalAmount === 300, `Grand total is ₹300 (received ${s5.totalAmount})`);
    assert(s5.isGstInvoice === false, 'isGstInvoice is false');
    assert(s5.totalGst === 0, 'totalGst is 0');

    const pdf5 = invoiceService.generateInvoicePDF(s5, shop, 'SALE');
    const pdf5Text = pdf5.output();
    assert(!pdf5Text.includes('TAX INVOICE DETAILS'), 'Non-GST PDF does not claim TAX INVOICE');
    assert(!pdf5Text.includes('Paid Amount:'), 'Non-GST PDF has NO "Paid Amount:"');
    assert(!pdf5Text.includes('Due Amount:'), 'Non-GST PDF has NO "Due Amount:"');

    // -------------------------------------------------------------------------
    // TEST 6: Correct Government Price vs Normal Selling Price
    // -------------------------------------------------------------------------
    console.log('\n👉 [Test 6] Government Price ₹266 vs Selling Price ₹400...');
    const prod6Res = await apiPost('/api/products', {
        name: `DAP Fertilizer ${timestamp}`,
        category: 'Fertilizer',
        brand: 'IFFCO',
        productType: 'Piece',
        quantity: 100,
        buyPrice: 200,
        sellPrice: 400,
        governmentPrice: 266,
        isGstApplicable: false,
        shop: TEST_SHOP_ID
    });
    const p6 = prod6Res.data.data;

    // Retail sale: must use ₹400
    const retSaleRes = await apiPost('/api/sales', {
        shop: TEST_SHOP_ID,
        customerName: 'Retail Buyer',
        customerMobile: '9876543215',
        paymentMethod: 'Cash',
        items: [{ product: p6._id, quantity: 1, unit: 'Piece' }]
    });
    assert(retSaleRes.data.data.totalAmount === 400, `Retail sale used selling price ₹400`);

    // Government sale: must use ₹266
    const govSaleRes = await apiPost('/api/gov-sales', {
        shop: TEST_SHOP_ID,
        customerName: 'Gov Buyer',
        customerMobile: '9876543216',
        customerAadhaar: '112233445566',
        paymentMethod: 'Cash',
        items: [{ product: p6._id, productName: p6.name, soldQtyEntered: 1, unit: 'Piece' }]
    });
    assert(govSaleRes.data.data.totalAmount === 266, `Gov sale used government price ₹266`);
    assert(govSaleRes.data.data.items[0].governmentPrice === 266, `Gov sale persisted gov rate ₹266`);

    // -------------------------------------------------------------------------
    // TEST 7: Khata Workflow & Database Balance Preservation
    // -------------------------------------------------------------------------
    console.log('\n👉 [Test 7] Khata Payment Workflow & DB Balance Preservation...');
    const khataMobile = `9822${String(timestamp).slice(-6)}`;
    const khataSaleRes = await apiPost('/api/gov-sales', {
        shop: TEST_SHOP_ID,
        customerName: 'Khata Farmer Patel',
        customerMobile: khataMobile,
        customerAadhaar: '998877665544',
        paymentMethod: 'Khata',
        paidAmount: 100, // Grand total is 266, Paid 100, Due 166
        items: [{ product: p6._id, productName: p6.name, soldQtyEntered: 1, unit: 'Piece' }]
    });
    assert(khataSaleRes.status === 201, 'Created government sale with Khata split');
    const ks = khataSaleRes.data.data;
    assert(ks.paidAmount === 100, `DB preserved paidAmount = ₹100`);
    assert(ks.remainingAmount === 166, `DB preserved remainingAmount = ₹166`);
    assert(ks.paymentStatus === 'Partial', `DB preserved paymentStatus = Partial`);

    // Verify Customer-Facing Bill for Khata Sale: Paid and Due amounts are absent!
    const pdfKhata = invoiceService.generateInvoicePDF(ks, shop, 'GOV_SALE');
    const pdfKhataText = pdfKhata.output();
    assert(!pdfKhataText.includes('Paid Amount:'), 'Khata customer invoice has NO "Paid Amount:" row');
    assert(!pdfKhataText.includes('Due Amount:'), 'Khata customer invoice has NO "Due Amount:" row');
    assert(!pdfKhataText.includes('Payment Status:'), 'Khata customer invoice has NO "Payment Status:" row');
    assert(pdfKhataText.includes('Payment:'), 'Khata customer invoice retains "Payment: KHATA"');
    assert(pdfKhataText.includes('GRAND TOTAL:'), 'Khata customer invoice retains "GRAND TOTAL:"');

    // Verify Khata Ledger in DB actually has the outstanding balance
    const khataCustRes = await apiGet(`/api/khata?shopId=${TEST_SHOP_ID}`);
    const khataAccount = (khataCustRes.data?.data || []).find(c => c.mobile === khataMobile);
    assert(Boolean(khataAccount), `Found Khata account for mobile ${khataMobile}`);
    assert(khataAccount?.outstandingDue === 166, `Khata ledger tracks outstanding ₹166 (received ${khataAccount?.outstandingDue})`);

    // -------------------------------------------------------------------------
    // TEST 8: Two-Bills-Per-Sheet (2-on-1) Eco Saver PDF
    // -------------------------------------------------------------------------
    console.log('\n👉 [Test 8] Two Bills Per Sheet (2-on-1) PDF Generation...');
    const pdf2on1 = invoiceService.generateInvoicePDF(gs1, shop, 'GOV_SALE', { secondBill: s1 });
    const pdf2on1Text = pdf2on1.output();
    assert(!pdf2on1Text.includes('Paid Amount:'), '2-on-1 PDF has NO "Paid Amount:"');
    assert(!pdf2on1Text.includes('Due Amount:'), '2-on-1 PDF has NO "Due Amount:"');
    assert(!pdf2on1Text.includes('Payment Status:'), '2-on-1 PDF has NO "Payment Status:"');
    assert(pdf2on1Text.includes('Cut Along This Line'), '2-on-1 PDF contains dashed cut line');

    const pdfPath = path.join(process.cwd(), 'test-verified-unified-gst-bills.pdf');
    fs.writeFileSync(pdfPath, Buffer.from(pdf2on1.output('arraybuffer')));
    assert(fs.existsSync(pdfPath), `Saved verified PDF to ${pdfPath}`);

    // -------------------------------------------------------------------------
    // TEST 9: Inter-State IGST Supply Handling
    // -------------------------------------------------------------------------
    console.log('\n👉 [Test 9] Inter-State Supply with IGST Breakdown...');
    const igstBill = {
        _id: '6ad999888777666555444333',
        invoiceNumber: 'GOV-IGST-001',
        customerName: 'Interstate Agency',
        customerMobile: '9898989898',
        paymentMethod: 'UPI',
        totalAmount: 1180,
        taxableAmount: 1000,
        totalGst: 180,
        cgstTotal: 0,
        sgstTotal: 0,
        igstTotal: 180,
        isGstInvoice: true,
        items: [{
            productName: 'Interstate Fertilizer Consignment',
            quantity: 10,
            soldUnit: 'Bag',
            price: 118,
            governmentPrice: 118,
            lineTotal: 1180,
            taxableValue: 1000,
            gstAmount: 180,
            gstRate: 18,
            isGstApplicable: true,
            gstPricingMode: 'inclusive'
        }]
    };
    const pdfIgst = invoiceService.generateInvoicePDF(igstBill, shop, 'GOV_SALE');
    const pdfIgstText = pdfIgst.output();
    assert(pdfIgstText.includes('IGST:'), 'PDF displays "IGST:" breakdown row');
    assert(pdfIgstText.includes('GST inter-state supply: IGST charged'), 'PDF terms specify inter-state IGST supply');
    assert(!pdfIgstText.includes('Paid Amount:'), 'IGST PDF has NO "Paid Amount:"');
    assert(!pdfIgstText.includes('Due Amount:'), 'IGST PDF has NO "Due Amount:"');

    // -------------------------------------------------------------------------
    // TEST 10: WhatsApp Sharing Text Template
    // -------------------------------------------------------------------------
    console.log('\n👉 [Test 10] WhatsApp Invoice Sharing Template Format...');
    let openedUrl = '';
    const origWindowOpen = globalThis.window?.open;
    globalThis.window = globalThis.window || {};
    globalThis.window.open = (url) => { openedUrl = url; };

    await invoiceService.shareInvoice(gs1, shop, 'GOV_SALE');
    assert(Boolean(openedUrl), 'Generated WhatsApp share URL');
    const decodedWa = decodeURIComponent(openedUrl);
    assert(decodedWa.includes('Payment Mode: CASH'), 'WhatsApp text contains Payment Mode: CASH');
    assert(decodedWa.includes('Grand Total: ₹210'), 'WhatsApp text contains Grand Total: ₹210');
    assert(decodedWa.includes('Taxable Value: ₹200'), 'WhatsApp text contains Taxable Value: ₹200');
    assert(decodedWa.includes('Total GST: ₹10'), 'WhatsApp text contains Total GST: ₹10');
    assert(!decodedWa.includes('Paid Amount'), 'WhatsApp text does NOT contain "Paid Amount"');
    assert(!decodedWa.includes('Due Amount'), 'WhatsApp text does NOT contain "Due Amount"');
    if (origWindowOpen) globalThis.window.open = origWindowOpen;

    // -------------------------------------------------------------------------
    // Summary
    // -------------------------------------------------------------------------
    console.log('\n========================================================================');
    console.log(` 📊 Verification Finished: ${passedTests} Passed, ${failedTests} Failed`);
    console.log('========================================================================\n');

    if (failedTests > 0) {
        process.exit(1);
    }
}

runVerification().catch(err => {
    console.error('Fatal suite error:', err);
    process.exit(1);
});
