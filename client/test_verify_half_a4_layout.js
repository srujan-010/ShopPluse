import { jsPDF } from 'jspdf';
import invoiceService from './src/utils/invoiceService.js';
import { resolveBillTaxDetails } from './src/utils/gstService.js';

console.log('========================================================================');
console.log(' 🚀 ShopPulse — Half A4 Invoice Layout & Generation Verification Suite');
console.log('========================================================================\n');

const mockShop = {
    _id: 'shop_half_a4_test',
    name: 'Sri Venkateshwara Krushi Kendra',
    location: 'Main Road, Warangal, Telangana 506002',
    contactNumber: '9848022338',
    gstNumber: '36ABCDE1234F1Z5',
    defaultPrintFormat: 'half_a4',
    type: 'fertilizers',
    fertilizerLicenses: [
        { licenseType: 'LAFD', licenseNumber: 'LCFRD122022547GDCD' },
        { licenseType: 'LAID', licenseNumber: 'LCID0820260041GDC' }
    ]
};

const createMockBill = (itemCount, isGov = false) => {
    const items = [];
    let runningSubtotal = 0;
    let runningTaxable = 0;
    let runningGst = 0;

    for (let i = 1; i <= itemCount; i++) {
        const rate = 100 * i;
        const qty = i;
        const gstRate = i % 2 === 0 ? 18 : 5;
        const lineTotal = rate * qty;
        
        items.push({
            productName: `Product Item #${i} Spec Grade Fertilizer Pack`,
            quantity: qty,
            unit: 'Bag',
            pricePerBaseUnit: rate,
            governmentPrice: isGov ? rate : undefined,
            isGstApplicable: true,
            gstRate: gstRate,
            gstPricingMode: 'inclusive'
        });
    }

    return {
        _id: `sale_test_${itemCount}_items`,
        invoiceNumber: `INV-2026-${String(itemCount).padStart(4, '0')}`,
        date: new Date('2026-10-22T14:30:00Z'),
        paymentMethod: 'UPI',
        customerName: 'Rajeshwar Sharma',
        customerMobile: '9876543210',
        customerAadhaar: '1234-5678-9012',
        type: isGov ? 'GOV_SALE' : 'SALE',
        items
    };
};

// Helper: extract all text items from jsPDF document
const extractDocText = (doc) => {
    // In jsPDF, text is written into stream operations
    const out = doc.output();
    return out;
};

let allTestsPassed = true;
const assert = (condition, desc) => {
    if (condition) {
        console.log(`  ✅ PASS: ${desc}`);
    } else {
        console.error(`  ❌ FAIL: ${desc}`);
        allTestsPassed = false;
    }
};

// TEST 1: Test 1 item in Half A4
console.log('👉 [Test 1] Half A4 with 1 Item...');
{
    const bill1 = createMockBill(1);
    const doc = invoiceService.generateInvoicePDF(bill1, mockShop, 'SALE', { format: 'half_a4' });
    const pages = doc.getNumberOfPages();
    const w = doc.internal.pageSize.getWidth();
    const h = doc.internal.pageSize.getHeight();
    const text = extractDocText(doc);

    assert(pages === 1, `PDF contains exactly 1 page (received: ${pages})`);
    assert(Math.abs(w - 210) < 1, `Page width is 210mm landscape (received: ${w})`);
    assert(Math.abs(h - 148.5) < 1, `Page height is 148.5mm Half A4 (received: ${h})`);
    assert(text.includes('Product Item #1'), 'Contains product name "Product Item #1"');
    assert(!text.includes('• CGST:'), 'Does NOT contain secondary line "• CGST:" beneath product name');
    assert(text.includes("Buyer's Signature"), 'Contains "Buyer\'s Signature"');
    assert(text.includes("Authorized Signatory"), 'Contains "Authorized Signatory"');
    assert(text.includes("GRAND TOTAL:"), 'Contains "GRAND TOTAL:"');
}

// TEST 2: Test 3 items in Half A4
console.log('\n👉 [Test 2] Half A4 with 3 Items...');
{
    const bill3 = createMockBill(3);
    const doc = invoiceService.generateInvoicePDF(bill3, mockShop, 'SALE', { format: 'half_a4' });
    const pages = doc.getNumberOfPages();
    const w = doc.internal.pageSize.getWidth();
    const h = doc.internal.pageSize.getHeight();
    const text = extractDocText(doc);

    assert(pages === 1, `PDF contains exactly 1 page (received: ${pages})`);
    assert(Math.abs(w - 210) < 1, `Page width is 210mm (received: ${w})`);
    assert(Math.abs(h - 148.5) < 1, `Page height is 148.5mm (received: ${h})`);
    for (let i = 1; i <= 3; i++) {
        assert(text.includes(`Product Item #${i}`), `Contains Product Item #${i}`);
    }
    assert(!text.includes('• CGST:'), 'Does NOT contain secondary line "• CGST:" beneath product name');
    assert(text.includes("Buyer's Signature"), 'Contains "Buyer\'s Signature"');
    assert(text.includes("Authorized Signatory"), 'Contains "Authorized Signatory"');
    assert(text.includes("GRAND TOTAL:"), 'Contains "GRAND TOTAL:"');
}

// TEST 3: Test 5 items in Half A4
console.log('\n👉 [Test 3] Half A4 with 5 Items...');
{
    const bill5 = createMockBill(5);
    const doc = invoiceService.generateInvoicePDF(bill5, mockShop, 'SALE', { format: 'half_a4' });
    const pages = doc.getNumberOfPages();
    const w = doc.internal.pageSize.getWidth();
    const h = doc.internal.pageSize.getHeight();
    const text = extractDocText(doc);

    assert(pages === 1, `PDF contains exactly 1 page (received: ${pages})`);
    assert(Math.abs(w - 210) < 1, `Page width is 210mm (received: ${w})`);
    assert(Math.abs(h - 148.5) < 1, `Page height is 148.5mm (received: ${h})`);
    for (let i = 1; i <= 5; i++) {
        assert(text.includes(`Product Item #${i}`), `Contains Product Item #${i}`);
    }
    assert(!text.includes('• CGST:'), 'Does NOT contain secondary line "• CGST:" beneath product name');
    assert(text.includes("Buyer's Signature"), 'Contains "Buyer\'s Signature"');
    assert(text.includes("Authorized Signatory"), 'Contains "Authorized Signatory"');
    assert(text.includes("GRAND TOTAL:"), 'Contains "GRAND TOTAL:"');
}

// TEST 4: Test 10 items in Half A4 (Crucial: must fit on 1 Half A4 page and not fall back to Full A4!)
console.log('\n👉 [Test 4] Half A4 with 10 Items (High Density)...');
{
    const bill10 = createMockBill(10);
    const doc = invoiceService.generateInvoicePDF(bill10, mockShop, 'SALE', { format: 'half_a4' });
    const pages = doc.getNumberOfPages();
    const w = doc.internal.pageSize.getWidth();
    const h = doc.internal.pageSize.getHeight();
    const text = extractDocText(doc);

    assert(pages === 1, `PDF contains exactly 1 page (received: ${pages})`);
    assert(Math.abs(w - 210) < 1, `Page width is 210mm (received: ${w})`);
    assert(Math.abs(h - 148.5) < 1, `Page height is genuine Half A4 148.5mm, NOT Full A4! (received: ${h})`);
    for (let i = 1; i <= 10; i++) {
        assert(text.includes(`Product Item #${i}`), `Contains Product Item #${i}`);
    }
    assert(!text.includes('• CGST:'), 'Does NOT contain secondary line "• CGST:" beneath product name');
    assert(text.includes("Buyer's Signature"), 'Contains "Buyer\'s Signature"');
    assert(text.includes("Authorized Signatory"), 'Contains "Authorized Signatory"');
    assert(text.includes("GRAND TOTAL:"), 'Contains "GRAND TOTAL:"');
}

// TEST 5: Test 15 items in Half A4 (Must fit within half-page without overflow or pushing into 2nd half)
console.log('\n👉 [Test 5] Half A4 with 15 Items (Fits on Single Half A4)...');
{
    const bill15 = createMockBill(15);
    const doc = invoiceService.generateInvoicePDF(bill15, mockShop, 'SALE', { format: 'half_a4' });
    const pages = doc.getNumberOfPages();
    const w = doc.internal.pageSize.getWidth();
    const h = doc.internal.pageSize.getHeight();
    const text = extractDocText(doc);

    assert(pages === 1, `PDF fits within 1 Half A4 page without overflow (received: ${pages})`);
    assert(Math.abs(w - 210) < 1, `Page width is 210mm (received: ${w})`);
    assert(Math.abs(h - 148.5) < 1, `Page height is genuine Half A4 148.5mm (received: ${h})`);
    for (let i = 1; i <= 15; i++) {
        assert(text.includes(`Product Item #${i}`), `Contains Product Item #${i}`);
    }
    assert(!text.includes('• CGST:'), 'Does NOT contain secondary line "• CGST:" beneath product name');
    assert(text.includes("Buyer's Signature"), 'Contains "Buyer\'s Signature"');
    assert(text.includes("Authorized Signatory"), 'Contains "Authorized Signatory"');
    assert(text.includes("GRAND TOTAL:"), 'Contains "GRAND TOTAL:"');
}

// TEST 6: Test Government Sale in Half A4
console.log('\n👉 [Test 6] Government Sale with Subsidized Pricing in Half A4...');
{
    const govBill = createMockBill(4, true);
    const doc = invoiceService.generateInvoicePDF(govBill, mockShop, 'GOV_SALE', { format: 'half_a4' });
    const pages = doc.getNumberOfPages();
    const w = doc.internal.pageSize.getWidth();
    const h = doc.internal.pageSize.getHeight();
    const text = extractDocText(doc);

    assert(pages === 1, `Gov PDF contains exactly 1 page (received: ${pages})`);
    assert(Math.abs(w - 210) < 1 && Math.abs(h - 148.5) < 1, 'Gov PDF is 210x148.5mm Half A4');
    assert(text.includes('Product Item #1'), 'Contains Gov item');
    assert(text.includes("Buyer's Signature"), 'Contains "Buyer\'s Signature"');
    assert(text.includes("Authorized Signatory"), 'Contains "Authorized Signatory"');
}

// TEST 7: Test Paired Bills (2 bills on 1 A4 Sheet)
console.log('\n👉 [Test 7] Paired Bills (2-on-1 A4 Sheet with Cut Line)...');
{
    const billA = createMockBill(4);
    const billB = createMockBill(5);
    const doc = invoiceService.generateInvoicePDF(billA, mockShop, 'SALE', { 
        format: 'half_a4',
        secondBill: billB
    });
    const pages = doc.getNumberOfPages();
    const w = doc.internal.pageSize.getWidth();
    const h = doc.internal.pageSize.getHeight();
    const text = extractDocText(doc);

    assert(pages === 1, `Paired PDF is 1 full A4 sheet (received: ${pages})`);
    assert(Math.abs(w - 210) < 1 && Math.abs(h - 297) < 1, 'Paired PDF is 210x297mm A4 portrait');
    assert(text.includes('Cut Along This Line'), 'Contains scissors cut line divider');
    assert(text.includes(billA.invoiceNumber), `Contains Bill 1 #${billA.invoiceNumber}`);
    assert(text.includes(billB.invoiceNumber), `Contains Bill 2 #${billB.invoiceNumber}`);
}

// TEST 8: Verify other formats (full_a4, thermal_58, thermal_80) have no regressions
console.log('\n👉 [Test 8] Regression Check on Other Formats...');
{
    const bill = createMockBill(3);
    const docFull = invoiceService.generateInvoicePDF(bill, mockShop, 'SALE', { format: 'full_a4' });
    assert(docFull.getNumberOfPages() === 1, 'Full A4 generates 1 page');
    assert(Math.abs(docFull.internal.pageSize.getHeight() - 297) < 1, 'Full A4 height is 297mm');

    const doc58 = invoiceService.generateInvoicePDF(bill, mockShop, 'SALE', { format: 'thermal_58' });
    assert(doc58.internal.pageSize.getWidth() === 58, 'Thermal 58 width is 58mm');

    const doc80 = invoiceService.generateInvoicePDF(bill, mockShop, 'SALE', { format: 'thermal_80' });
    assert(doc80.internal.pageSize.getWidth() === 80, 'Thermal 80 width is 80mm');
}

// TEST 9: Invoices with 3 items containing long product descriptions and diverse GST rates (0%, 5%, 18%)
console.log('\n👉 [Test 9] Invoices with Long Product Descriptions & Diverse GST Rates...');
{
    const longDescBill = {
        _id: 'sale_long_desc_test',
        invoiceNumber: 'INV-2026-LONG',
        date: new Date('2026-10-22T16:00:00Z'),
        paymentMethod: 'CASH',
        customerName: 'Venkata Nageshwara Rao Chowdary',
        customerMobile: '9440123456',
        type: 'SALE',
        items: [
            {
                productName: 'Mahyco Hybrid Cotton Seeds Extra Long Staple High Germination Spec Batch 2026',
                quantity: 10,
                unit: 'Packets',
                pricePerBaseUnit: 850,
                isGstApplicable: true,
                gstRate: 5,
                gstPricingMode: 'inclusive'
            },
            {
                productName: 'Urea Fertilizer Granular Coated Soil Nutrition Booster Nitrogen 46% Pure Grade',
                quantity: 25,
                unit: 'Bags',
                pricePerBaseUnit: 266.50,
                isGstApplicable: true,
                gstRate: 5,
                gstPricingMode: 'inclusive'
            },
            {
                productName: 'Bayer Confidor Insecticide Imidacloprid 17.8% SL Multi-Crop Protection Liquid 500ml',
                quantity: 4,
                unit: 'Bottles',
                pricePerBaseUnit: 1200,
                isGstApplicable: true,
                gstRate: 18,
                gstPricingMode: 'exclusive'
            }
        ]
    };

    const doc = invoiceService.generateInvoicePDF(longDescBill, mockShop, 'SALE', { format: 'half_a4' });
    const pages = doc.getNumberOfPages();
    const text = extractDocText(doc);

    assert(pages === 1, `Long description bill fits on 1 Half A4 page (received: ${pages})`);
    assert(text.includes('Mahyco Hybrid Cotton'), 'Contains long product name 1');
    assert(text.includes('Urea Fertilizer Granular'), 'Contains long product name 2');
    assert(text.includes('Bayer Confidor Insecticide'), 'Contains long product name 3');
    assert(text.includes('Subtotal:'), 'Contains Subtotal');
    assert(text.includes('Taxable Value:'), 'Contains Taxable Value');
    assert(text.includes('CGST:'), 'Contains CGST');
    assert(text.includes('SGST:'), 'Contains SGST');
    assert(text.includes('Total GST:'), 'Contains Total GST');
    assert(text.includes('GRAND TOTAL:'), 'Contains GRAND TOTAL');
    assert(text.includes("Buyer's Signature"), 'Contains Buyer\'s Signature');
    assert(text.includes("Authorized Signatory"), 'Contains Authorized Signatory');
}

// TEST 10: Invoices with 1 item and non-taxable / zero-GST sale
console.log('\n👉 [Test 10] Invoice with 1 Item and Zero-GST Sale...');
{
    const zeroGstBill = {
        _id: 'sale_zero_gst_test',
        invoiceNumber: 'INV-2026-ZERO',
        date: new Date('2026-10-22T17:15:00Z'),
        paymentMethod: 'UPI',
        customerName: 'Ramesh Reddy',
        customerMobile: '9123456789',
        type: 'SALE',
        items: [
            {
                productName: 'Organic Vermicompost Soil Conditioner Natural Earthworm Castings 50Kg Bag',
                quantity: 2,
                unit: 'Bags',
                pricePerBaseUnit: 400,
                isGstApplicable: false,
                gstRate: 0
            }
        ]
    };

    const doc = invoiceService.generateInvoicePDF(zeroGstBill, mockShop, 'SALE', { format: 'half_a4' });
    const pages = doc.getNumberOfPages();
    const text = extractDocText(doc);

    assert(pages === 1, `Zero-GST bill fits on 1 Half A4 page (received: ${pages})`);
    assert(text.includes('Organic Vermicompost'), 'Contains zero-GST product name');
    assert(text.includes('Subtotal:'), 'Contains Subtotal');
    assert(text.includes('GRAND TOTAL:'), 'Contains GRAND TOTAL');
    assert(text.includes("Buyer's Signature"), 'Contains Buyer\'s Signature');
    assert(text.includes("Authorized Signatory"), 'Contains Authorized Signatory');
}

console.log('\n========================================================================');
if (allTestsPassed) {
    console.log(' 🎉 ALL HALF A4 INVOICE TESTS PASSED SUCCESSFULLY! ZERO REGRESSIONS!');
} else {
    console.error(' ❌ SOME TESTS FAILED!');
    process.exit(1);
}
console.log('========================================================================\n');
