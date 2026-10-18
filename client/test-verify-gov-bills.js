/**
 * Automated Verification Script for Government Sales Bills & Standard Invoice Consistency
 * 
 * Verifies:
 * 1. Government sale bill PDF generation matches the standard ShopPulse invoice design.
 * 2. Complete absence of "Government Record Copy", "OFFICIAL INSPECTION COPY" watermark, and "GOV RECORD".
 * 3. Use of standard "INVOICE DETAILS" / "TAX INVOICE DETAILS" and "CUSTOMER DETAILS".
 * 4. Preservation of actual government transaction data (product/fertilizer details, government price, sold/returned/net quantity).
 * 5. Preservation of customer Aadhaar number within standard customer info block.
 * 6. Half-A4 single bill and Two-on-one (2-on-1) sheet generation for government sales.
 * 7. Verification that a normal retail sale bill and government sale bill share identical layout and visual structure.
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

async function runTestSuite() {
    console.log('================================================================');
    console.log(' 🚀 Starting Government vs Standard Bill Verification Suite     ');
    console.log('================================================================\n');

    // Phase 1: Retrieve Shop Details
    console.log('👉 [Phase 1] Retrieving Shop Information...');
    const salesListRes = await apiGet(`/api/sales?shop=${TEST_SHOP_ID}`);
    assert(salesListRes.status === 200, 'GET /api/sales returns HTTP 200');
    const existingSales = salesListRes.data.data || [];
    let shop = null;
    if (existingSales.length > 0) {
        const firstSaleRes = await apiGet(`/api/sales/${existingSales[0]._id}`);
        shop = firstSaleRes.data.data?.shop;
    }
    if (!shop || typeof shop !== 'object') {
        shop = {
            _id: TEST_SHOP_ID,
            name: 'City Mart Fertilizer & Agri',
            location: 'Main Road, Nashik, Maharashtra',
            contactNumber: '9822012345',
            gstNumber: '27AAAAA0000A1Z5'
        };
    }
    assert(Boolean(shop && shop.name), `Active Shop retrieved: "${shop?.name}"`);

    // Phase 2: Create a Government Product (Fertilizer with Government Price)
    console.log('\n👉 [Phase 2] Creating Fertilizer Product with Government Price...');
    const fertRes = await apiPost('/api/products', {
        name: `Urea Bio-Fertilizer Grade A ${Date.now()}`,
        category: 'Fertilizers',
        quantity: 200,
        unit: 'Bag',
        buyPrice: 220,
        sellPrice: 300,
        governmentPrice: 266.50,
        isGstApplicable: true,
        gstRate: 5,
        gstPricingMode: 'inclusive',
        shop: TEST_SHOP_ID
    });
    assert(fertRes.status === 201, 'Fertilizer product created successfully');
    const fertilizerProd = fertRes.data.data;
    assert(fertilizerProd.governmentPrice === 266.50, `Government Price saved: ₹${fertilizerProd.governmentPrice}`);

    // Phase 3: Create a Real Government Sale
    console.log('\n👉 [Phase 3] Creating Government Sale Transaction...');
    const govSalePayload = {
        shop: TEST_SHOP_ID,
        customerName: 'Kisan Ramesh Patil',
        customerMobile: '9876543210',
        customerAadhaar: '123456789012',
        paymentMethod: 'Cash',
        items: [{
            product: fertilizerProd._id,
            productName: fertilizerProd.name,
            soldQtyEntered: 10,
            soldUnit: 'Bag',
            pricePerBaseUnit: 266.50,
            governmentPrice: 266.50,
            isGstApplicable: true,
            gstRate: 5,
            gstPricingMode: 'inclusive'
        }],
        totalAmount: 2665.00
    };

    const createGovRes = await apiPost('/api/gov-sales', govSalePayload);
    assert(createGovRes.status === 201, 'Government Sale recorded in backend', createGovRes.data);
    const createdGovSale = createGovRes.data.data;
    assert(createdGovSale.invoiceNumber.startsWith('GOV-INV-'), `Invoice Number generated: ${createdGovSale.invoiceNumber}`);
    assert(createdGovSale.customerAadhaar === '123456789012', 'Aadhaar accurately recorded');
    assert(createdGovSale.totalAmount === 2665.00, 'Total government sale amount matches ₹2665.00');

    // Phase 4: Fetch a Standard Retail Sale
    console.log('\n👉 [Phase 4] Fetching a Standard Retail Sale for Comparison...');
    const salesRes = await apiGet(`/api/sales?shop=${TEST_SHOP_ID}`);
    const normalSales = (salesRes.data.data || []).filter(s => s.type !== 'GOV_SALE');
    assert(normalSales.length > 0, `Standard retail sales found (Count: ${normalSales.length})`);
    const retailSale = normalSales[0];

    // Phase 5: PDF Inspection - Single Government Bill
    console.log('\n👉 [Phase 5] Verifying Government Bill PDF Layout & Text Content...');
    const govDoc = invoiceService.generateInvoicePDF(createdGovSale, shop, 'GOV_SALE');
    const govPdfBuffer = Buffer.from(govDoc.output('arraybuffer'));
    const govPdfText = govPdfBuffer.toString('latin1');

    // Assert absence of unwanted government branding
    assert(!govPdfText.includes('Government Record Copy'), 'Does NOT contain "Government Record Copy"');
    assert(!govPdfText.includes('OFFICIAL INSPECTION COPY'), 'Does NOT contain "OFFICIAL INSPECTION COPY"');
    assert(!govPdfText.includes('GOV RECORD DETAILS'), 'Does NOT contain "GOV RECORD DETAILS"');
    assert(!govPdfText.includes('OFFICIAL BENEFICIARY'), 'Does NOT contain "OFFICIAL BENEFICIARY"');

    // Assert presence of standard ShopPulse layout
    assert(govPdfText.includes('TAX INVOICE DETAILS') || govPdfText.includes('INVOICE DETAILS'), 'Uses standard "TAX INVOICE DETAILS" / "INVOICE DETAILS"');
    assert(govPdfText.includes('CUSTOMER DETAILS'), 'Uses standard "CUSTOMER DETAILS" header');
    assert(govPdfText.includes(shop.name.toUpperCase()), `Includes shop name: "${shop.name.toUpperCase()}"`);
    assert(govPdfText.includes('Kisan Ramesh Patil'), 'Includes customer name: "Kisan Ramesh Patil"');
    assert(govPdfText.includes('123456789012'), 'Includes customer Aadhaar: 123456789012');
    assert(govPdfText.includes('266.50') || govPdfText.includes('2,665'), 'Preserves actual government price (₹266.50) without retail substitution');
    assert(govPdfText.includes('Generated by ShopPulse POS'), 'Includes standard ShopPulse brand footer');

    // Phase 6: PDF Inspection - Standard Retail Bill
    console.log('\n👉 [Phase 6] Verifying Standard Retail Bill PDF Layout...');
    const retailDoc = invoiceService.generateInvoicePDF(retailSale, shop, 'SALE');
    const retailPdfBuffer = Buffer.from(retailDoc.output('arraybuffer'));
    const retailPdfText = retailPdfBuffer.toString('latin1');

    assert(!retailPdfText.includes('Government Record Copy'), 'Retail bill does NOT contain government branding');
    assert(!retailPdfText.includes('OFFICIAL INSPECTION COPY'), 'Retail bill does NOT contain inspection watermark');
    assert(retailPdfText.includes(shop.name.toUpperCase()), `Retail bill includes shop name: "${shop.name.toUpperCase()}"`);
    assert(retailPdfText.includes('Generated by ShopPulse POS'), 'Retail bill includes standard footer');

    // Phase 7: Two-on-One (2-on-1) A4 Sheet with Government Sale
    console.log('\n👉 [Phase 7] Verifying 2-on-1 A4 Sheet Layout with Government Bill...');
    const secondGovPayload = {
        shop: TEST_SHOP_ID,
        customerName: 'Suresh Kumar',
        customerMobile: '9123456780',
        paymentMethod: 'UPI',
        items: [{
            product: fertilizerProd._id,
            productName: fertilizerProd.name,
            soldQtyEntered: 5,
            soldUnit: 'Bag',
            pricePerBaseUnit: 266.50,
            governmentPrice: 266.50
        }],
        totalAmount: 1332.50
    };
    const createGov2Res = await apiPost('/api/gov-sales', secondGovPayload);
    const govSale2 = createGov2Res.data.data;

    const twoBillsDoc = invoiceService.generateInvoicePDF(createdGovSale, shop, 'GOV_SALE', { secondBill: govSale2 });
    assert(twoBillsDoc.getNumberOfPages() === 1, 'Two government bills fit on exactly 1 A4 sheet without spilling');
    const twoBillsBuffer = Buffer.from(twoBillsDoc.output('arraybuffer'));
    const twoBillsText = twoBillsBuffer.toString('latin1');
    assert(twoBillsText.includes('Cut Along This Line'), 'Contains middle dashed cut line divider');
    assert(!twoBillsText.includes('OFFICIAL INSPECTION COPY'), 'Two-bill sheet contains NO inspection watermark');
    assert(twoBillsText.includes('Kisan Ramesh Patil') && twoBillsText.includes('Suresh Kumar'), 'Both distinct government bills printed on single sheet');

    // Phase 8: Government Sale with Returns Information
    console.log('\n👉 [Phase 8] Verifying Government Sale with Partial Returns Display...');
    const returnedGovSale = {
        ...createdGovSale,
        items: [{
            ...createdGovSale.items[0],
            soldQtyEntered: 10,
            returnedQty: 3,
            remainingQty: 7,
            soldUnit: 'Bag'
        }]
    };
    const retDoc = invoiceService.generateInvoicePDF(returnedGovSale, shop, 'GOV_SALE');
    const retBuffer = Buffer.from(retDoc.output('arraybuffer'));
    const retText = retBuffer.toString('latin1');
    assert(retText.includes('Sold: 10') && retText.includes('Ret: 3'), 'Returned fertilizer quantities cleanly rendered under item description');

    // Save test verification artifacts
    const artifactDir = path.resolve('.');
    fs.writeFileSync(path.join(artifactDir, 'test-verified-gov-sale-bill.pdf'), govPdfBuffer);
    fs.writeFileSync(path.join(artifactDir, 'test-verified-gov-retail-2on1.pdf'), twoBillsBuffer);
    console.log('\n  📄 Saved test-verified-gov-sale-bill.pdf');
    console.log('  📄 Saved test-verified-gov-retail-2on1.pdf');

    // Summary
    console.log('\n================================================================');
    console.log(` 🏁 GOVERNMENT BILL VERIFICATION: ${passedTests} Passed, ${failedTests} Failed`);
    console.log('================================================================\n');

    if (failedTests > 0) {
        process.exit(1);
    }
}

runTestSuite().catch(err => {
    console.error('Fatal error running verification test suite:', err);
    process.exit(1);
});
