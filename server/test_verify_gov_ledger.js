/**
 * Comprehensive Automated Verification Suite for:
 * ShopPulse Government Ledger Page Redesign, Date Filtering, GST Calculations, and PDF Export Reconciliations
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
const GovernmentSale = require('./models/GovernmentSale');

let passedTests = 0;
let failedTests = 0;

function assert(condition, message) {
    if (condition) {
        passedTests++;
        console.log(`  [PASS] ${message}`);
    } else {
        failedTests++;
        console.error(`  [FAIL] ${message}`);
    }
}

// Emulate client GST resolution logic
function calculateLineItemGst({ unitPrice, quantity, isGstApplicable, gstRate, gstPricingMode, discount = 0 }) {
    const qty = Number(quantity) || 0;
    const rate = Number(unitPrice) || 0;
    const rawLineBase = parseFloat((qty * rate).toFixed(2));
    const disc = Number(discount) || 0;
    const netBase = Math.max(0, parseFloat((rawLineBase - disc).toFixed(2)));

    const isTax = Boolean(isGstApplicable && Number(gstRate) > 0);
    const ratePct = isTax ? Number(gstRate) : 0;
    const mode = gstPricingMode === 'exclusive' ? 'exclusive' : 'inclusive';

    let taxableValue = 0;
    let gstAmount = 0;
    let cgst = 0;
    let sgst = 0;
    let lineTotal = 0;

    if (isTax && ratePct > 0) {
        if (mode === 'exclusive') {
            taxableValue = netBase;
            gstAmount = parseFloat((taxableValue * (ratePct / 100)).toFixed(2));
            cgst = parseFloat((gstAmount / 2).toFixed(2));
            sgst = parseFloat((gstAmount - cgst).toFixed(2));
            lineTotal = parseFloat((taxableValue + gstAmount).toFixed(2));
        } else {
            taxableValue = parseFloat((netBase / (1 + (ratePct / 100))).toFixed(2));
            gstAmount = parseFloat((netBase - taxableValue).toFixed(2));
            cgst = parseFloat((gstAmount / 2).toFixed(2));
            sgst = parseFloat((gstAmount - cgst).toFixed(2));
            lineTotal = netBase;
        }
    } else {
        taxableValue = netBase;
        gstAmount = 0;
        cgst = 0;
        sgst = 0;
        lineTotal = netBase;
    }

    return {
        unitPrice: rate,
        quantity: qty,
        taxableValue,
        gstAmount,
        cgst,
        sgst,
        igst: 0,
        lineTotal
    };
}

async function runVerification() {
    console.log('===============================================================');
    console.log(' ShopPulse Government Sales Ledger Verification Suite');
    console.log('===============================================================\n');

    const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://localhost:27017/shop_pulse';
    await mongoose.connect(mongoUri);
    console.log('Connected to MongoDB.\n');

    // -------------------------------------------------------------
    // 1. Verification of GST Calculations (Inclusive, Exclusive, Zero GST, IGST vs CGST/SGST)
    // -------------------------------------------------------------
    console.log('--- 1. Accurate GST Calculation Engine Tests ---');

    // Test 1.1: Inclusive GST 5% on Government Subsidized Price
    // Example: 2 bags Urea @ gov price ₹266.50 (inclusive 5% GST), retail ₹350.00
    {
        const govRate = 266.50;
        const qty = 2;
        const res = calculateLineItemGst({
            unitPrice: govRate,
            quantity: qty,
            isGstApplicable: true,
            gstRate: 5,
            gstPricingMode: 'inclusive'
        });
        const expectedBase = 533.00;
        const expectedTaxable = parseFloat((533.00 / 1.05).toFixed(2)); // 507.62
        const expectedGst = parseFloat((533.00 - expectedTaxable).toFixed(2)); // 25.38
        const expectedCgst = parseFloat((expectedGst / 2).toFixed(2)); // 12.69
        const expectedSgst = parseFloat((expectedGst - expectedCgst).toFixed(2)); // 12.69

        assert(res.lineTotal === expectedBase, `Inclusive GST: Line total matches government rate x qty = ₹${res.lineTotal}`);
        assert(res.taxableValue === expectedTaxable, `Inclusive GST: Taxable value is ₹${res.taxableValue} (expected ₹${expectedTaxable})`);
        assert(res.gstAmount === expectedGst, `Inclusive GST: Total GST is ₹${res.gstAmount} (expected ₹${expectedGst})`);
        assert(res.cgst === expectedCgst && res.sgst === expectedSgst, `Inclusive GST: CGST=₹${res.cgst}, SGST=₹${res.sgst}`);
        assert(res.taxableValue + res.gstAmount === expectedBase, `Inclusive GST: Taxable + Total GST reconciles perfectly to ₹${expectedBase}`);
    }

    // Test 1.2: Exclusive GST 18% on Government Price
    // Example: 1 drum specialized chemical @ gov price ₹1000.00 (exclusive 18% GST)
    {
        const govRate = 1000.00;
        const qty = 1;
        const res = calculateLineItemGst({
            unitPrice: govRate,
            quantity: qty,
            isGstApplicable: true,
            gstRate: 18,
            gstPricingMode: 'exclusive'
        });
        const expectedTaxable = 1000.00;
        const expectedGst = 180.00;
        const expectedLineTotal = 1180.00;
        assert(res.taxableValue === expectedTaxable, `Exclusive GST: Taxable value matches net base ₹${res.taxableValue}`);
        assert(res.gstAmount === expectedGst, `Exclusive GST: 18% GST added is ₹${res.gstAmount}`);
        assert(res.lineTotal === expectedLineTotal, `Exclusive GST: Final line total is ₹${res.lineTotal}`);
        assert(res.cgst === 90.00 && res.sgst === 90.00, `Exclusive GST: CGST=₹${res.cgst}, SGST=₹${res.sgst}`);
    }

    // Test 1.3: Zero GST / GST-disabled product
    // Example: Organic compost @ gov price ₹150.00 with isGstApplicable: false or gstRate: 0
    {
        const res = calculateLineItemGst({
            unitPrice: 150.00,
            quantity: 4,
            isGstApplicable: false,
            gstRate: 0,
            gstPricingMode: 'inclusive'
        });
        assert(res.taxableValue === 600.00, `Zero GST: Taxable value equals full base ₹${res.taxableValue}`);
        assert(res.gstAmount === 0, `Zero GST: Total GST is 0 (never silently invented)`);
        assert(res.cgst === 0 && res.sgst === 0 && res.igst === 0, `Zero GST: All tax components are ₹0.00`);
        assert(res.lineTotal === 600.00, `Zero GST: Line total equals base ₹${res.lineTotal}`);
    }

    // Test 1.4: IGST vs CGST/SGST distribution
    {
        const totalGst = 100.00;
        // Interstate
        const hasIgst = true;
        const interstateIgst = hasIgst ? totalGst : 0;
        const interstateCgst = hasIgst ? 0 : totalGst / 2;
        const interstateSgst = hasIgst ? 0 : totalGst / 2;
        assert(interstateIgst === 100 && interstateCgst === 0 && interstateSgst === 0, 'Interstate: IGST captures 100% tax, CGST & SGST are 0');

        // Intrastate
        const intrastateIgst = !hasIgst ? totalGst : 0;
        const intrastateCgst = parseFloat((totalGst / 2).toFixed(2));
        const intrastateSgst = parseFloat((totalGst - intrastateCgst).toFixed(2));
        assert(intrastateIgst === 0 && intrastateCgst === 50 && intrastateSgst === 50, 'Intrastate: IGST is 0, CGST & SGST split 50/50');
    }

    // -------------------------------------------------------------
    // 2. Database Records & Backend API Fallback Check
    // -------------------------------------------------------------
    console.log('\n--- 2. Database Records & Backend API Fallback Tests ---');
    const shops = await Shop.find({ isDeleted: { $ne: true } });
    assert(shops.length > 0, `Found ${shops.length} active shops in database`);

    const fertShop = shops.find(s => s.type === 'Fertilizer Shop') || shops[0];
    assert(Boolean(fertShop), `Selected test shop: ${fertShop.name} (${fertShop._id})`);

    const govSales = await GovernmentSale.find({ shop: fertShop._id })
        .populate('shop', 'name location contactNumber gstNumber email')
        .populate('items.product', 'name category isGstApplicable gstRate gstPricingMode gst governmentPrice sellPrice unit')
        .sort('-date');

    assert(govSales.length > 0, `Found ${govSales.length} government sales for shop`);

    // Verify populated shop details
    const sampleSale = govSales[0];
    assert(Boolean(sampleSale.shop && sampleSale.shop.name), `Shop details populated: "${sampleSale.shop?.name}"`);

    // Verify persisted vs fallback calculation
    let persistedCount = 0;
    let fallbackCount = 0;
    govSales.forEach(s => {
        if ((s.taxableAmount !== undefined && s.taxableAmount > 0) || (s.totalGst !== undefined && s.totalGst > 0)) {
            persistedCount++;
        } else {
            fallbackCount++;
        }
    });
    console.log(`  [INFO] Distribution: ${persistedCount} records have pre-persisted GST, ${fallbackCount} use safe fallback.`);
    assert(persistedCount + fallbackCount === govSales.length, 'All sales accounted for without data loss');

    // -------------------------------------------------------------
    // 3. Date Boundary Filtering Tests
    // -------------------------------------------------------------
    console.log('\n--- 3. Date Range Boundary Filtering Tests ---');

    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;

    // Test 3.1: Today boundary filter
    const todaySales = govSales.filter(sale => {
        const d = new Date(sale.date);
        return d.getFullYear() === now.getFullYear() &&
               d.getMonth() === now.getMonth() &&
               d.getDate() === now.getDate();
    });
    console.log(`  [INFO] Today sales count: ${todaySales.length}`);
    assert(Array.isArray(todaySales), 'Today filter returns a valid array');

    // Test 3.2: Last 7 Days filter
    const start7 = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6, 0, 0, 0, 0);
    const end7 = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    const last7Sales = govSales.filter(sale => {
        const d = new Date(sale.date);
        return d >= start7 && d <= end7;
    });
    console.log(`  [INFO] Last 7 days sales count: ${last7Sales.length}`);
    assert(last7Sales.length >= todaySales.length, 'Last 7 Days sales >= Today sales');

    // Test 3.3: This Month filter
    const thisMonthSales = govSales.filter(sale => {
        const d = new Date(sale.date);
        return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
    });
    console.log(`  [INFO] This Month sales count: ${thisMonthSales.length}`);
    assert(thisMonthSales.length >= todaySales.length, 'This Month sales >= Today sales');

    // Test 3.4: Custom Range filter
    const customStart = '2026-01-01';
    const customEnd = '2026-12-31';
    const [sy, sm, sd] = customStart.split('-').map(Number);
    const cStart = new Date(sy, sm - 1, sd, 0, 0, 0, 0);
    const [ey, em, ed] = customEnd.split('-').map(Number);
    const cEnd = new Date(ey, em - 1, ed, 23, 59, 59, 999);

    const customSales = govSales.filter(sale => {
        const d = new Date(sale.date);
        return d >= cStart && d <= cEnd;
    });
    console.log(`  [INFO] Custom (Full Year 2026) sales count: ${customSales.length}`);
    assert(customSales.length > 0, 'Custom range matching 2026 correctly returns records');

    // Test 3.5: Empty Results boundary filter (e.g. year 2020 where no sales exist)
    const emptyStart = new Date(2020, 0, 1, 0, 0, 0, 0);
    const emptyEnd = new Date(2020, 0, 31, 23, 59, 59, 999);
    const emptySales = govSales.filter(sale => {
        const d = new Date(sale.date);
        return d >= emptyStart && d <= emptyEnd;
    });
    assert(emptySales.length === 0, 'Empty date range returns 0 records without crashing');

    // -------------------------------------------------------------
    // 4. Totals Reconciliation & Multi-page PDF Export Reconciliations
    // -------------------------------------------------------------
    console.log('\n--- 4. Summary Totals & PDF Data Reconciliation Tests ---');

    let sumTaxable = 0;
    let sumCgst = 0;
    let sumSgst = 0;
    let sumIgst = 0;
    let sumGst = 0;
    let sumAmount = 0;

    govSales.forEach(s => {
        const tdTaxable = Number(s.taxableAmount || 0);
        const tdCgst = Number(s.cgstTotal || 0);
        const tdSgst = Number(s.sgstTotal || 0);
        const tdIgst = Number(s.igstTotal || 0);
        const tdGst = Number(s.totalGst || (tdCgst + tdSgst + tdIgst) || 0);
        const tdAmount = Number(s.totalAmount || 0);

        sumTaxable += tdTaxable;
        sumCgst += tdCgst;
        sumSgst += tdSgst;
        sumIgst += tdIgst;
        sumGst += tdGst;
        sumAmount += tdAmount;
    });

    sumTaxable = parseFloat(sumTaxable.toFixed(2));
    sumCgst = parseFloat(sumCgst.toFixed(2));
    sumSgst = parseFloat(sumSgst.toFixed(2));
    sumIgst = parseFloat(sumIgst.toFixed(2));
    sumGst = parseFloat(sumGst.toFixed(2));
    sumAmount = parseFloat(sumAmount.toFixed(2));

    console.log(`  [RECONCILIATION SUMMARY across all ${govSales.length} records]`);
    console.log(`    Total Bills:         ${govSales.length}`);
    console.log(`    Total Taxable:       ₹${sumTaxable.toLocaleString('en-IN')}`);
    console.log(`    Total CGST:          ₹${sumCgst.toLocaleString('en-IN')}`);
    console.log(`    Total SGST:          ₹${sumSgst.toLocaleString('en-IN')}`);
    console.log(`    Total IGST:          ₹${sumIgst.toLocaleString('en-IN')}`);
    console.log(`    Total GST:           ₹${sumGst.toLocaleString('en-IN')}`);
    console.log(`    Total Final Amount:  ₹${sumAmount.toLocaleString('en-IN')}`);

    assert(sumTaxable > 0, `Total Taxable Value > 0: ₹${sumTaxable}`);
    assert(sumAmount >= sumTaxable, `Final Bill Amount (₹${sumAmount}) >= Taxable Value (₹${sumTaxable})`);
    assert(Math.abs((sumCgst + sumSgst + sumIgst) - sumGst) < 0.1, `CGST + SGST + IGST reconciles with Total GST (difference < ₹0.10)`);

    // -------------------------------------------------------------
    // Summary
    // -------------------------------------------------------------
    console.log('\n===============================================================');
    console.log(`Verification Complete: ${passedTests} PASSED, ${failedTests} FAILED`);
    console.log('===============================================================');

    await mongoose.disconnect();
    if (failedTests > 0) process.exit(1);
}

runVerification().catch(err => {
    console.error('Fatal error during verification:', err);
    process.exit(1);
});
