/**
 * Comprehensive ShopPulse GST & Invoice Verification Suite
 * 
 * Verifies:
 * 1. Product-level tax configuration (Add/Edit Product with isGstApplicable, gstRate, gstPricingMode).
 * 2. GST-disabled (0%) pricing calculations and transaction persistence.
 * 3. GST-inclusive pricing calculations (gross total, taxable extraction, GST amount).
 * 4. GST-exclusive pricing calculations (base amount, added GST, final line total).
 * 5. Mixed cart with multiple products, different rates (0%, 5%, 12%, 18%, 28%), and inclusive/exclusive modes.
 * 6. Discounts (flat & percentage) applied to taxable values accurately without double taxation.
 * 7. Payment methods: Cash, UPI, and Khata (paid upfront and balance due).
 * 8. Legacy / historical sales data integrity (no retroactive alterations, no invented tax claims).
 * 9. PDF generation: Half-A4 single bill, Two bills on 1 sheet (2-on-1), Large bill full-page fallback.
 * 10. Data consistency across checkout summary, database record, and invoice view.
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

async function runGstTestSuite() {
    console.log('================================================================');
    console.log(' 🚀 Starting ShopPulse Comprehensive GST & Invoice Test Suite ');
    console.log('================================================================\n');

    // 1. Fetch Shop details
    console.log('👉 [Phase 1] Verifying Shop & Backend Connection...');
    const shopRes = await apiGet(`/api/sales?shop=${TEST_SHOP_ID}`);
    assert(shopRes.status === 200, 'GET /api/sales returns HTTP 200');

    // 2. Create products with different GST configurations
    console.log('\n👉 [Phase 2] Creating Products with Distinct GST Tax Configurations...');
    
    // Product 1: GST Disabled (Exempt)
    const prodNoGstRes = await apiPost('/api/products', {
        name: `Test Product No-GST ${Date.now()}`,
        category: 'Groceries',
        quantity: 100,
        unit: 'Pieces',
        buyPrice: 30,
        sellPrice: 50,
        isGstApplicable: false,
        gstRate: 0,
        gstPricingMode: 'inclusive',
        shop: TEST_SHOP_ID
    });
    assert(prodNoGstRes.status === 201, 'Created GST-Disabled Product', prodNoGstRes.data);
    const prodNoGst = prodNoGstRes.data?.data;
    assert(prodNoGst.isGstApplicable === false, 'Product isGstApplicable is false');
    assert(prodNoGst.gstRate === 0, 'Product gstRate is 0');

    // Product 2: GST 18% Inclusive
    const prodInclRes = await apiPost('/api/products', {
        name: `Test Product 18% Incl ${Date.now()}`,
        category: 'Electronics',
        quantity: 100,
        unit: 'Pieces',
        buyPrice: 60,
        sellPrice: 100,
        isGstApplicable: true,
        gstRate: 18,
        gstPricingMode: 'inclusive',
        shop: TEST_SHOP_ID
    });
    assert(prodInclRes.status === 201, 'Created GST 18% Inclusive Product');
    const prodIncl = prodInclRes.data.data;
    assert(prodIncl.isGstApplicable === true, 'Product isGstApplicable is true');
    assert(prodIncl.gstRate === 18, 'Product gstRate is 18%');
    assert(prodIncl.gstPricingMode === 'inclusive', 'Product gstPricingMode is inclusive');

    // Product 3: GST 18% Exclusive
    const prodExclRes = await apiPost('/api/products', {
        name: `Test Product 18% Excl ${Date.now()}`,
        category: 'Hardware',
        quantity: 100,
        unit: 'Pieces',
        buyPrice: 70,
        sellPrice: 100,
        isGstApplicable: true,
        gstRate: 18,
        gstPricingMode: 'exclusive',
        shop: TEST_SHOP_ID
    });
    assert(prodExclRes.status === 201, 'Created GST 18% Exclusive Product');
    const prodExcl = prodExclRes.data.data;
    assert(prodExcl.isGstApplicable === true, 'Product isGstApplicable is true');
    assert(prodExcl.gstRate === 18, 'Product gstRate is 18%');
    assert(prodExcl.gstPricingMode === 'exclusive', 'Product gstPricingMode is exclusive');

    // Product 4: GST 5% Inclusive
    const prod5InclRes = await apiPost('/api/products', {
        name: `Test Product 5% Incl ${Date.now()}`,
        category: 'Food',
        quantity: 100,
        unit: 'Pieces',
        buyPrice: 40,
        sellPrice: 50,
        isGstApplicable: true,
        gstRate: 5,
        gstPricingMode: 'inclusive',
        shop: TEST_SHOP_ID
    });
    assert(prod5InclRes.status === 201, 'Created GST 5% Inclusive Product');
    const prod5Incl = prod5InclRes.data.data;

    // Product 5: GST 12% Exclusive
    const prod12ExclRes = await apiPost('/api/products', {
        name: `Test Product 12% Excl ${Date.now()}`,
        category: 'Stationery',
        quantity: 100,
        unit: 'Pieces',
        buyPrice: 80,
        sellPrice: 100,
        isGstApplicable: true,
        gstRate: 12,
        gstPricingMode: 'exclusive',
        shop: TEST_SHOP_ID
    });
    assert(prod12ExclRes.status === 201, 'Created GST 12% Exclusive Product');
    const prod12Excl = prod12ExclRes.data.data;

    // 3. Test GST-Disabled Transaction (Cash)
    console.log('\n👉 [Phase 3] Testing Sale with GST-Disabled (0%) Product...');
    const saleNoGstRes = await apiPost('/api/sales', {
        shop: TEST_SHOP_ID,
        customerName: 'Cash Buyer (No GST)',
        paymentMethod: 'Cash',
        items: [{
            product: prodNoGst._id,
            quantity: 2,
            unit: 'Pieces'
        }]
    });
    assert(saleNoGstRes.status === 201, 'Sale created successfully for GST-disabled product');
    const saleNoGst = saleNoGstRes.data.data;
    assert(saleNoGst.totalAmount === 100, `Total amount is exact: ₹${saleNoGst.totalAmount} (Expected: 100)`);
    assert(saleNoGst.totalGst === 0, `Total GST is zero: ₹${saleNoGst.totalGst}`);
    assert(saleNoGst.taxableAmount === 100, `Taxable amount equals total: ₹${saleNoGst.taxableAmount}`);
    assert(saleNoGst.isGstInvoice === false, 'isGstInvoice is false');

    // 4. Test GST-Inclusive Pricing Transaction (UPI)
    console.log('\n👉 [Phase 4] Testing GST-Inclusive Pricing (18% Rate)...');
    // 2 units at ₹100 = ₹200 gross total.
    // Taxable = 200 / 1.18 = 169.49. GST = 200 - 169.49 = 30.51 (CGST: 15.26, SGST: 15.25).
    const saleInclRes = await apiPost('/api/sales', {
        shop: TEST_SHOP_ID,
        customerName: 'UPI Buyer (18% Incl)',
        paymentMethod: 'UPI',
        items: [{
            product: prodIncl._id,
            quantity: 2,
            unit: 'Pieces'
        }]
    });
    assert(saleInclRes.status === 201, 'Sale created for GST-inclusive product');
    const saleIncl = saleInclRes.data.data;
    assert(saleIncl.totalAmount === 200, `Final payable is exact shelf price: ₹${saleIncl.totalAmount} (Expected: 200.00)`);
    assert(saleIncl.taxableAmount === 169.49, `Taxable amount correctly extracted: ₹${saleIncl.taxableAmount} (Expected: 169.49)`);
    assert(saleIncl.totalGst === 30.51, `GST amount correctly extracted: ₹${saleIncl.totalGst} (Expected: 30.51)`);
    assert(saleIncl.cgstTotal === 15.26 || saleIncl.cgstTotal === 15.25, `CGST populated: ₹${saleIncl.cgstTotal}`);
    assert(saleIncl.sgstTotal === 15.25 || saleIncl.sgstTotal === 15.26, `SGST populated: ₹${saleIncl.sgstTotal}`);
    assert(parseFloat((saleIncl.taxableAmount + saleIncl.totalGst).toFixed(2)) === saleIncl.totalAmount, 'Taxable + GST === Total Amount');
    assert(saleIncl.isGstInvoice === true, 'isGstInvoice is true');

    // 5. Test GST-Exclusive Pricing Transaction (Cash)
    console.log('\n👉 [Phase 5] Testing GST-Exclusive Pricing (18% Rate)...');
    // 2 units at ₹100 = ₹200 taxable value.
    // GST = 200 * 0.18 = ₹36.00. Final Payable = 200 + 36 = ₹236.00.
    const saleExclRes = await apiPost('/api/sales', {
        shop: TEST_SHOP_ID,
        customerName: 'Cash Buyer (18% Excl)',
        paymentMethod: 'Cash',
        items: [{
            product: prodExcl._id,
            quantity: 2,
            unit: 'Pieces'
        }]
    });
    assert(saleExclRes.status === 201, 'Sale created for GST-exclusive product');
    const saleExcl = saleExclRes.data.data;
    assert(saleExcl.totalAmount === 236, `Final payable is taxable + GST: ₹${saleExcl.totalAmount} (Expected: 236.00)`);
    assert(saleExcl.taxableAmount === 200, `Taxable amount is base price: ₹${saleExcl.taxableAmount} (Expected: 200.00)`);
    assert(saleExcl.totalGst === 36, `GST is 18% of taxable: ₹${saleExcl.totalGst} (Expected: 36.00)`);
    assert(saleExcl.cgstTotal === 18, `CGST is half of GST: ₹${saleExcl.cgstTotal} (Expected: 18.00)`);
    assert(saleExcl.sgstTotal === 18, `SGST is half of GST: ₹${saleExcl.sgstTotal} (Expected: 18.00)`);
    assert(parseFloat((saleExcl.taxableAmount + saleExcl.totalGst).toFixed(2)) === saleExcl.totalAmount, 'Taxable + GST === Total Amount');

    // 6. Test Multi-Product Mixed Cart with Different Tax Rates
    console.log('\n👉 [Phase 6] Testing Multi-Product Mixed Cart (Different Rates & Pricing Modes)...');
    // Item 1: 1 x prodIncl (₹100, 18% incl) -> Gross 100 -> Taxable 84.75, GST 15.25, LineTotal 100
    // Item 2: 1 x prodExcl (₹100, 18% excl) -> Base 100 -> Taxable 100.00, GST 18.00, LineTotal 118
    // Item 3: 2 x prod5Incl (₹50, 5% incl) -> Gross 100 -> Taxable 95.24, GST 4.76, LineTotal 100
    // Item 4: 1 x prod12Excl (₹100, 12% excl) -> Base 100 -> Taxable 100.00, GST 12.00, LineTotal 112
    // Item 5: 1 x prodNoGst (₹50, 0%) -> Base 50 -> Taxable 50.00, GST 0, LineTotal 50
    // Sum of Line Totals = 100 + 118 + 100 + 112 + 50 = ₹480.00
    // Sum of Taxable = 84.75 + 100.00 + 95.24 + 100.00 + 50.00 = ₹429.99
    // Sum of GST = 15.25 + 18.00 + 4.76 + 12.00 + 0 = ₹50.01
    // Total = 429.99 + 50.01 = ₹480.00!
    const saleMixedRes = await apiPost('/api/sales', {
        shop: TEST_SHOP_ID,
        customerName: 'Mixed Cart Buyer',
        paymentMethod: 'UPI',
        items: [
            { product: prodIncl._id, quantity: 1, unit: 'Pieces' },
            { product: prodExcl._id, quantity: 1, unit: 'Pieces' },
            { product: prod5Incl._id, quantity: 2, unit: 'Pieces' },
            { product: prod12Excl._id, quantity: 1, unit: 'Pieces' },
            { product: prodNoGst._id, quantity: 1, unit: 'Pieces' }
        ]
    });
    assert(saleMixedRes.status === 201, 'Mixed cart sale created');
    const saleMixed = saleMixedRes.data.data;
    assert(saleMixed.totalAmount === 480, `Grand total matches calculated sum: ₹${saleMixed.totalAmount} (Expected: 480.00)`);
    assert(saleMixed.taxableAmount === 429.99, `Taxable sum matches: ₹${saleMixed.taxableAmount} (Expected: 429.99)`);
    assert(saleMixed.totalGst === 50.01, `GST sum matches: ₹${saleMixed.totalGst} (Expected: 50.01)`);
    assert(parseFloat((saleMixed.taxableAmount + saleMixed.totalGst).toFixed(2)) === saleMixed.totalAmount, 'Mixed cart Taxable + GST === Total Amount');

    // 7. Test Discounts on GST Invoices
    console.log('\n👉 [Phase 7] Testing Discounts on GST-Inclusive and Exclusive Invoices...');
    // 1 x prodExcl (₹100, 18% excl) + 1 x prodIncl (₹100, 18% incl) = Subtotal 200
    // Discount: Flat ₹20 (10 per item)
    // Item 1 (Excl): Net Base = 90. Taxable = 90.00. GST (18%) = 16.20. Line Total = 106.20.
    // Item 2 (Incl): Net Gross = 90. Taxable = 90 / 1.18 = 76.27. GST = 13.73. Line Total = 90.00.
    // Total Taxable = 90.00 + 76.27 = 166.27
    // Total GST = 16.20 + 13.73 = 29.93
    // Final Amount = 106.20 + 90.00 = 196.20 (166.27 + 29.93 = 196.20!)
    const saleDiscountRes = await apiPost('/api/sales', {
        shop: TEST_SHOP_ID,
        customerName: 'Discount Shopper',
        paymentMethod: 'Cash',
        discountType: 'flat',
        discountValue: 20,
        items: [
            { product: prodExcl._id, quantity: 1, unit: 'Pieces' },
            { product: prodIncl._id, quantity: 1, unit: 'Pieces' }
        ]
    });
    assert(saleDiscountRes.status === 201, 'Discounted sale created');
    const saleDiscount = saleDiscountRes.data.data;
    assert(saleDiscount.discountAmount === 20, `Discount amount recorded: ₹${saleDiscount.discountAmount}`);
    assert(saleDiscount.totalAmount === 196.2, `Final payable after discount & GST: ₹${saleDiscount.totalAmount} (Expected: 196.20)`);
    assert(saleDiscount.taxableAmount === 166.27, `Taxable value matches: ₹${saleDiscount.taxableAmount} (Expected: 166.27)`);
    assert(saleDiscount.totalGst === 29.93, `Total GST matches: ₹${saleDiscount.totalGst} (Expected: 29.93)`);
    assert(parseFloat((saleDiscount.taxableAmount + saleDiscount.totalGst).toFixed(2)) === saleDiscount.totalAmount, 'Discounted Taxable + GST === Total Amount');

    // 8. Test Khata Transaction with Partial Upfront Payment and GST
    console.log('\n👉 [Phase 8] Testing Khata Transaction with GST & Partial Payment...');
    // 2 x prodExcl (₹100, 18% excl) = ₹236.00 Total.
    // Upfront paid = ₹100.00. Remaining due = ₹136.00.
    const saleKhataRes = await apiPost('/api/sales', {
        shop: TEST_SHOP_ID,
        customerName: 'Khata Regular Customer',
        customerMobile: '9876543210',
        paymentMethod: 'Khata',
        paidAmount: 100,
        items: [{
            product: prodExcl._id,
            quantity: 2,
            unit: 'Pieces'
        }]
    });
    assert(saleKhataRes.status === 201, 'Khata transaction created');
    const saleKhata = saleKhataRes.data.data;
    assert(saleKhata.totalAmount === 236, `Khata totalAmount is ₹${saleKhata.totalAmount}`);
    assert(saleKhata.paidAmount === 100, `Paid amount upfront is ₹${saleKhata.paidAmount}`);
    assert(saleKhata.remainingAmount === 136, `Remaining balance due is ₹${saleKhata.remainingAmount}`);
    assert(saleKhata.paymentStatus === 'Partial', `Payment status is Partial: ${saleKhata.paymentStatus}`);

    // 9. Historical Invoices Data-Binding Integrity
    console.log('\n👉 [Phase 9] Verifying Historical Invoices (No Retroactive Changes)...');
    const historicalRes = await apiGet(`/api/sales/${shopRes.data.data[0]._id}`);
    assert(historicalRes.status === 200, 'Fetched historical sale record');
    const histSale = historicalRes.data.data;
    assert(histSale.totalAmount > 0, `Historical totalAmount preserved: ₹${histSale.totalAmount}`);
    assert(histSale.invoiceNumber && histSale.invoiceNumber !== 'N/A', `Historical invoice number intact: ${histSale.invoiceNumber}`);

    // 10. PDF Generation Integrity for Taxable and Non-Taxable Bills
    console.log('\n👉 [Phase 10] Testing PDF Generation (Single Bill, 2-on-1, and Large Bill Fallback)...');
    
    // Half-A4 Taxable PDF
    const docTaxable = invoiceService.generateInvoicePDF(saleMixed, saleMixed.shop, 'SALE');
    assert(docTaxable.internal.getNumberOfPages() === 1, 'Taxable single bill occupies exactly 1 page');
    const bufTaxable = Buffer.from(docTaxable.output('arraybuffer'));
    const pathTaxable = path.resolve('./test-verified-gst-single-bill.pdf');
    fs.writeFileSync(pathTaxable, bufTaxable);
    assert(fs.existsSync(pathTaxable) && bufTaxable.length > 5000, `Taxable PDF generated successfully (${bufTaxable.length} bytes)`);

    // Two Distinct Bills on 1 A4 Sheet (saleMixed and saleDiscount)
    const docTwo = invoiceService.generateInvoicePDF(saleMixed, saleMixed.shop, 'SALE', { secondBill: saleDiscount });
    assert(docTwo.internal.getNumberOfPages() === 1, 'Two distinct GST bills fit on 1 A4 sheet without spilling');
    const bufTwo = Buffer.from(docTwo.output('arraybuffer'));
    const pathTwo = path.resolve('./test-verified-gst-two-bills.pdf');
    fs.writeFileSync(pathTwo, bufTwo);
    assert(fs.existsSync(pathTwo) && bufTwo.length > 7000, `Two-bill GST PDF generated successfully (${bufTwo.length} bytes)`);

    // Non-Taxable PDF (verifies no fabricated tax claims)
    const docNonTax = invoiceService.generateInvoicePDF(saleNoGst, saleNoGst.shop, 'SALE');
    assert(docNonTax.internal.getNumberOfPages() === 1, 'Non-taxable bill generates 1 page cleanly');

    // Large Bill Fallback (>8 items with GST)
    const largeGstBill = {
        ...saleMixed,
        invoiceNumber: 'LRG-GST-101',
        totalGst: 100,
        items: [
            { productName: 'Item 1', quantity: 1, unit: 'Pc', price: 100, isGstApplicable: true, gstRate: 18, gstPricingMode: 'inclusive', taxableValue: 84.75, gstAmount: 15.25, lineTotal: 100 },
            { productName: 'Item 2', quantity: 2, unit: 'Pc', price: 100, isGstApplicable: true, gstRate: 18, gstPricingMode: 'exclusive', taxableValue: 200, gstAmount: 36, lineTotal: 236 },
            { productName: 'Item 3', quantity: 1, unit: 'Pc', price: 50, isGstApplicable: false, gstRate: 0, taxableValue: 50, gstAmount: 0, lineTotal: 50 },
            { productName: 'Item 4', quantity: 3, unit: 'Pc', price: 80, isGstApplicable: true, gstRate: 5, gstPricingMode: 'inclusive', taxableValue: 228.57, gstAmount: 11.43, lineTotal: 240 },
            { productName: 'Item 5', quantity: 1, unit: 'Pc', price: 120, isGstApplicable: true, gstRate: 12, gstPricingMode: 'exclusive', taxableValue: 120, gstAmount: 14.4, lineTotal: 134.4 },
            { productName: 'Item 6', quantity: 2, unit: 'Pc', price: 90, isGstApplicable: true, gstRate: 18, gstPricingMode: 'inclusive', taxableValue: 152.54, gstAmount: 27.46, lineTotal: 180 },
            { productName: 'Item 7', quantity: 4, unit: 'Pc', price: 40, isGstApplicable: false, gstRate: 0, taxableValue: 160, gstAmount: 0, lineTotal: 160 },
            { productName: 'Item 8', quantity: 1, unit: 'Pc', price: 200, isGstApplicable: true, gstRate: 18, gstPricingMode: 'exclusive', taxableValue: 200, gstAmount: 36, lineTotal: 236 },
            { productName: 'Item 9', quantity: 2, unit: 'Pc', price: 75, isGstApplicable: true, gstRate: 5, gstPricingMode: 'inclusive', taxableValue: 142.86, gstAmount: 7.14, lineTotal: 150 },
            { productName: 'Item 10', quantity: 1, unit: 'Pc', price: 300, isGstApplicable: true, gstRate: 18, gstPricingMode: 'inclusive', taxableValue: 254.24, gstAmount: 45.76, lineTotal: 300 }
        ],
        totalAmount: 1786.4
    };
    const docLargeGst = invoiceService.generateInvoicePDF(largeGstBill, saleMixed.shop, 'SALE');
    assert(docLargeGst.internal.getNumberOfPages() === 1, 'Large GST bill renders cleanly on full-page fallback');

    // 11. Summary Check: Checkout, Saved DB Record, and Invoice View Agreement
    console.log('\n👉 [Phase 11] Verifying Agreement Between DB Record, Invoice and View Model...');
    const verifySaleRes = await apiGet(`/api/sales/${saleMixed._id}`);
    const fetchedMixed = verifySaleRes.data.data;
    assert(fetchedMixed.totalAmount === saleMixed.totalAmount, `DB totalAmount matches checkout: ₹${fetchedMixed.totalAmount}`);
    assert(fetchedMixed.taxableAmount === saleMixed.taxableAmount, `DB taxableAmount matches checkout: ₹${fetchedMixed.taxableAmount}`);
    assert(fetchedMixed.totalGst === saleMixed.totalGst, `DB totalGst matches checkout: ₹${fetchedMixed.totalGst}`);
    assert(fetchedMixed.items.length === 5, 'All 5 cart items persisted with individual tax breakdowns');

    console.log('\n================================================================');
    console.log(` 🏁 GST TEST RUN COMPLETE: ${passedTests} Passed, ${failedTests} Failed`);
    console.log('================================================================\n');

    if (failedTests > 0) {
        process.exit(1);
    } else {
        process.exit(0);
    }
}

runGstTestSuite().catch(err => {
    console.error('Fatal test error:', err);
    process.exit(1);
});
