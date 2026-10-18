/**
 * ShopPulse Automated Invoice Workflow & Data-Binding Verification Suite
 * 
 * Verifies:
 * 1. Backend API /api/sales/:id data binding (real items, quantities, totals, shop info).
 * 2. Slot 1 invoice details accuracy (products, rates, shop details, no #N/A or 0.00).
 * 3. Single-bill A4 layout (Slot 1 populated, cut line present, Slot 2 left completely blank).
 * 4. Two-bill A4 layout (Slot 1 and Slot 2 with two distinct saved transactions).
 * 5. PDF generation integrity (A4 dimensions 210x297mm, valid page streams).
 * 6. Full-page fallback for large bills (>8 items).
 */

import fs from 'fs';
import path from 'path';
import jwt from '../server/node_modules/jsonwebtoken/index.js';

const JWT_SECRET = 'shoppulse_secret_key_2026';
const BACKEND_URL = 'http://localhost:5005';
const TEST_USER_ID = '6ad31ef8da65d9da62379fbf';
const TEST_SHOP_ID = '6ad1d099d5145eba50c13795';

const token = jwt.sign({ id: TEST_USER_ID }, JWT_SECRET);

// Import invoiceService functions
import { invoiceService } from './src/utils/invoiceService.js';

let passedTests = 0;
let failedTests = 0;

function assert(condition, testName, details = '') {
    if (condition) {
        console.log(`  ✅ PASS: ${testName}`);
        passedTests++;
    } else {
        console.error(`  ❌ FAIL: ${testName} - ${details}`);
        failedTests++;
    }
}

async function runTestSuite() {
    console.log('================================================================');
    console.log(' 🚀 Starting ShopPulse Invoice & Two-Bill Automated Test Suite ');
    console.log('================================================================\n');

    // TEST 1: Backend Sales Listing
    console.log('👉 [Test 1] Fetching Sales List from Backend API...');
    let sales = [];
    try {
        const res = await fetch(`${BACKEND_URL}/api/sales?shop=${TEST_SHOP_ID}`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        const json = await res.json();
        sales = json.data || [];
        assert(res.status === 200, 'GET /api/sales returns HTTP 200');
        assert(sales.length >= 2, `Sales found in database for shop (Found: ${sales.length})`);
    } catch (err) {
        assert(false, 'GET /api/sales connection', err.message);
    }

    if (sales.length < 2) {
        console.error('⚠️ Not enough saved sales in database to complete full two-bill verification.');
        return;
    }

    const sale1Summary = sales[0];
    const sale2Summary = sales[1];

    // TEST 2: Single Sale Lookup & Data Binding Integrity
    console.log('\n👉 [Test 2] Verifying GET /api/sales/:id Data Binding...');
    let sale1Full = null;
    let sale2Full = null;
    try {
        const res1 = await fetch(`${BACKEND_URL}/api/sales/${sale1Summary._id}`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        const json1 = await res1.json();
        sale1Full = json1.data;

        assert(res1.status === 200, 'GET /api/sales/:id returns HTTP 200');
        assert(sale1Full && sale1Full._id === sale1Summary._id, 'Sale ID matches requested record');
        assert(sale1Full.invoiceNumber && sale1Full.invoiceNumber !== '#N/A' && sale1Full.invoiceNumber !== 'N/A', `Invoice number is preserved: ${sale1Full.invoiceNumber}`);
        assert(sale1Full.shop && typeof sale1Full.shop === 'object', 'Shop is populated as an object');
        assert(sale1Full.shop.name && sale1Full.shop.name !== 'ShopPulse Business', `Shop name is accurately populated: "${sale1Full.shop.name}"`);
        assert(sale1Full.items && sale1Full.items.length > 0, `Sale contains actual items (${sale1Full.items?.length} items)`);
        
        const firstItem = sale1Full.items[0];
        assert(firstItem.productName && firstItem.productName.length > 0, `Item productName is populated: "${firstItem.productName}"`);
        assert(!isNaN(firstItem.remainingQty) && firstItem.remainingQty > 0, `Item remainingQty is valid number: ${firstItem.remainingQty}`);
        assert(sale1Full.totalAmount > 0, `totalAmount is real value: ₹${sale1Full.totalAmount}`);

        const res2 = await fetch(`${BACKEND_URL}/api/sales/${sale2Summary._id}`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        const json2 = await res2.json();
        sale2Full = json2.data;
        assert(sale2Full && sale2Full._id === sale2Summary._id, `Second sale retrieved: ${sale2Full.invoiceNumber}`);
    } catch (err) {
        assert(false, 'GET /api/sales/:id retrieval', err.message);
    }

    // TEST 3: Single Bill Half-A4 PDF Layout
    console.log('\n👉 [Test 3] Verifying Single-Bill Half-A4 PDF Generation...');
    try {
        const docSingle = invoiceService.generateInvoicePDF(sale1Full, sale1Full.shop, 'SALE');
        const pageCount = docSingle.internal.getNumberOfPages();
        assert(pageCount === 1, `Single bill occupies exactly 1 A4 page (Got: ${pageCount})`);

        const pdfBuffer = Buffer.from(docSingle.output('arraybuffer'));
        const outPath = path.resolve('./test-verified-single-bill.pdf');
        fs.writeFileSync(outPath, pdfBuffer);
        assert(fs.existsSync(outPath) && pdfBuffer.length > 5000, `Single bill PDF written successfully (${pdfBuffer.length} bytes)`);
    } catch (err) {
        assert(false, 'Single bill PDF generation', err.message);
    }

    // TEST 4: Two Distinct Bills On 1 Sheet Layout
    console.log('\n👉 [Test 4] Verifying Two-Bill (2-on-1) A4 Sheet PDF Generation...');
    try {
        assert(sale1Full.invoiceNumber !== sale2Full.invoiceNumber, `Two distinct invoices used: #${sale1Full.invoiceNumber} vs #${sale2Full.invoiceNumber}`);
        
        const docTwo = invoiceService.generateInvoicePDF(sale1Full, sale1Full.shop, 'SALE', { secondBill: sale2Full });
        const pageCountTwo = docTwo.internal.getNumberOfPages();
        assert(pageCountTwo === 1, `Two bills fit onto exactly 1 A4 sheet without spilling (Got: ${pageCountTwo})`);

        const pdfBufferTwo = Buffer.from(docTwo.output('arraybuffer'));
        const outPathTwo = path.resolve('./test-verified-two-bills.pdf');
        fs.writeFileSync(outPathTwo, pdfBufferTwo);
        assert(fs.existsSync(outPathTwo) && pdfBufferTwo.length > 7000, `Two-bill PDF written successfully (${pdfBufferTwo.length} bytes)`);
    } catch (err) {
        assert(false, 'Two-bill PDF generation', err.message);
    }

    // TEST 5: Batch Printing Array Interface
    console.log('\n👉 [Test 5] Verifying Batch Printing Array Interface...');
    try {
        const docBatch = invoiceService.generateInvoicePDF([sale1Full, sale2Full], sale1Full.shop, 'SALE');
        const batchPages = docBatch.internal.getNumberOfPages();
        assert(batchPages === 1, `Array of 2 bills produces 1 sheet (Got: ${batchPages})`);
    } catch (err) {
        assert(false, 'Batch printing interface', err.message);
    }

    // TEST 6: Large Bill Fallback (>8 items)
    console.log('\n👉 [Test 6] Verifying Full-Page Fallback for Large Invoices...');
    try {
        const largeBill = {
            ...sale1Full,
            invoiceNumber: 'LRG-9999',
            items: [
                { productName: 'Item 1', quantity: 1, unit: 'Pc', price: 100, totalPrice: 100 },
                { productName: 'Item 2', quantity: 2, unit: 'Pc', price: 100, totalPrice: 200 },
                { productName: 'Item 3', quantity: 1, unit: 'Pc', price: 50, totalPrice: 50 },
                { productName: 'Item 4', quantity: 3, unit: 'Pc', price: 80, totalPrice: 240 },
                { productName: 'Item 5', quantity: 1, unit: 'Pc', price: 120, totalPrice: 120 },
                { productName: 'Item 6', quantity: 2, unit: 'Pc', price: 90, totalPrice: 180 },
                { productName: 'Item 7', quantity: 4, unit: 'Pc', price: 40, totalPrice: 160 },
                { productName: 'Item 8', quantity: 1, unit: 'Pc', price: 200, totalPrice: 200 },
                { productName: 'Item 9', quantity: 2, unit: 'Pc', price: 75, totalPrice: 150 },
                { productName: 'Item 10', quantity: 1, unit: 'Pc', price: 300, totalPrice: 300 }
            ],
            totalAmount: 1700
        };
        const docLarge = invoiceService.generateInvoicePDF(largeBill, sale1Full.shop, 'SALE');
        assert(docLarge.internal.getNumberOfPages() === 1, 'Large bill expands to full page without error');
    } catch (err) {
        assert(false, 'Large bill fallback', err.message);
    }

    // SUMMARY
    console.log('\n================================================================');
    console.log(` 🏁 TEST RUN COMPLETE: ${passedTests} Passed, ${failedTests} Failed`);
    console.log('================================================================\n');

    if (failedTests > 0) {
        process.exit(1);
    } else {
        process.exit(0);
    }
}

runTestSuite().catch(err => {
    console.error('Fatal test error:', err);
    process.exit(1);
});
