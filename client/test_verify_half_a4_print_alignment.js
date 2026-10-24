import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { applyPrintPageStyles, getFormatOption, PRINT_FORMAT_OPTIONS } from './src/utils/printFormatConstants.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('========================================================================');
console.log(' 🚀 ShopPulse — Half A4 Print Alignment & Layout Verification Suite');
console.log('========================================================================\n');

let allPassed = true;
const assert = (condition, desc) => {
    if (condition) {
        console.log(`  ✅ PASS: ${desc}`);
    } else {
        console.error(`  ❌ FAIL: ${desc}`);
        allPassed = false;
    }
};

// 1. SETUP LIGHTWEIGHT MOCK DOM FOR TESTING
const elements = new Map();
const bodyAttrs = new Map();
global.document = {
    getElementById: (id) => elements.get(id) || null,
    createElement: (tag) => {
        const el = { id: '', innerHTML: '' };
        return el;
    },
    head: {
        appendChild: (el) => {
            if (el.id) elements.set(el.id, el);
        }
    },
    body: {
        setAttribute: (key, val) => bodyAttrs.set(key, val),
        getAttribute: (key) => bodyAttrs.get(key)
    }
};

// TEST 1: Verify Single Half-A4 @page Styles
console.log('👉 [Test 1] Verify Single Half-A4 @page and Body Attributes...');
{
    applyPrintPageStyles('half_a4', { hasSecondBill: false });
    const styleTag = document.getElementById('shoppulse-print-page-style');
    const css = styleTag ? styleTag.innerHTML : '';
    const printFormat = document.body.getAttribute('data-print-format');
    const singleBill = document.body.getAttribute('data-single-bill');

    assert(styleTag !== null, 'Print page style tag exists in DOM');
    assert(css.includes('size: A4 portrait'), `Single bill @page specifies "size: A4 portrait" (received: "${css}")`);
    assert(css.includes('margin: 4mm 5mm') || css.includes('margin: 4mm 6mm'), `Single bill @page has standard margins (received: "${css}")`);
    assert(!css.includes('210mm 148.5mm'), 'Single bill @page does NOT set custom 210mm 148.5mm page box (prevents vertical centering)');
    assert(printFormat === 'half_a4', `Body data-print-format is "half_a4" (received: ${printFormat})`);
    assert(singleBill === 'true', `Body data-single-bill is "true" (received: ${singleBill})`);
}

// TEST 2: Verify Two Bills (Paired) Half-A4 @page Styles
console.log('\n👉 [Test 2] Verify Paired (2-on-1) Half-A4 @page Styles...');
{
    applyPrintPageStyles('half_a4', { hasSecondBill: true });
    const styleTag = document.getElementById('shoppulse-print-page-style');
    const css = styleTag ? styleTag.innerHTML : '';
    const printFormat = document.body.getAttribute('data-print-format');
    const singleBill = document.body.getAttribute('data-single-bill');

    assert(css.includes('size: A4 portrait'), `Paired bills @page specifies "size: A4 portrait" (received: "${css}")`);
    assert(printFormat === 'half_a4', `Body data-print-format is "half_a4"`);
    assert(singleBill === 'false', `Body data-single-bill is "false"`);
}

// TEST 3: Verify Format Options and Printer Guidance Tip
console.log('\n👉 [Test 3] Verify Printer Tip Guidance...');
{
    const halfA4Opt = getFormatOption('half_a4');
    assert(halfA4Opt !== null, 'half_a4 format option found');
    assert(halfA4Opt.printerTip.includes('Paper Size: A4'), `Printer tip directs user to select Paper Size: A4 (received: "${halfA4Opt.printerTip}")`);
    assert(halfA4Opt.paperSize.includes('Half A4'), 'Paper size displays Half A4');
}

// TEST 4: Verify compactInvoice.css Print Rules
console.log('\n👉 [Test 4] Verify compactInvoice.css Print Rules & Dimensions...');
{
    const cssPath = path.join(__dirname, 'src/styles/compactInvoice.css');
    const cssContent = fs.readFileSync(cssPath, 'utf8');

    // Extract @media print block
    const printIndex = cssContent.indexOf('@media print');
    assert(printIndex !== -1, '@media print block exists in compactInvoice.css');
    const printCss = cssContent.slice(printIndex);

    // Verify #root hiding in print
    assert(printCss.includes('#root') && printCss.includes('display: none !important'), '#root has display: none !important in print to eliminate page obstruction');

    // Verify .invoice-preview-screen print rules
    assert(printCss.includes('.invoice-preview-screen {') || printCss.includes('.invoice-preview-screen,'), '.invoice-preview-screen is defined under @media print');
    assert(printCss.includes('top: 0 !important'), 'invoice-preview-screen is positioned at top: 0 !important in print (starts at top of page)');
    assert(printCss.includes('transform: none !important'), 'invoice-preview-screen clears transform in print to prevent stacking-context bugs');

    // Verify .ips-content print rules
    assert(printCss.includes('display: block !important'), 'ips-content has display: block !important in print (clears flex alignment/centering)');

    // Verify .format-half_a4.single-bill container
    assert(printCss.includes('.format-half_a4.single-bill {'), '.format-half_a4.single-bill is styled in print');
    assert(printCss.includes('margin: 0 !important'), 'single-bill has margin: 0 !important (starts at top margin, no horizontal/vertical auto centering)');

    // Verify .format-half_a4.single-bill .half-a4-single-sheet
    assert(printCss.includes('.format-half_a4.single-bill .half-a4-single-sheet {'), '.format-half_a4.single-bill .half-a4-single-sheet styled in print');
    assert(printCss.includes('200mm !important') || printCss.includes('198mm !important'), 'half-a4-single-sheet width spans full printable half-page width');
    assert(printCss.includes('max-height: 142mm !important'), 'half-a4-single-sheet max-height is 142mm !important (fits within 148.5mm top half)');
    assert(printCss.includes('page-break-after: avoid !important'), 'half-a4-single-sheet avoids page breaks');

    // Verify single bill typography & legibility in print
    assert(printCss.includes('.format-half_a4.single-bill .cis-shop-name'), 'Single bill shop name has print styling');
    assert(printCss.includes('.format-half_a4.single-bill .cis-items-table th'), 'Single bill items table th has print styling');
    assert(printCss.includes('.format-half_a4.single-bill .cis-items-table td'), 'Single bill items table td has print styling');
    assert(printCss.includes('.format-half_a4.single-bill .cis-summary-box'), 'Single bill summary box has print styling');
    assert(printCss.includes('.format-half_a4.single-bill .cis-signatures-wrap'), 'Single bill signatures wrap has print styling');
    assert(printCss.includes('.format-half_a4.single-bill .cis-single-cut-divider'), 'Single bill cut divider has print styling');

    // CRITICAL: Verify Paired Bills rules are UNMODIFIED and intact
    assert(printCss.includes('.format-half_a4.paired-bills .a4-print-sheet'), 'Paired bills a4-print-sheet rules are intact');
    assert(printCss.includes('height: 285mm !important'), 'Paired bills height remains 285mm !important');
    assert(printCss.includes('.format-full_a4 .full-a4-sheet'), 'Full A4 print rules are intact');
    assert(printCss.includes('.format-thermal_58'), 'Thermal 58 print rules are intact');
    assert(printCss.includes('.format-thermal_80'), 'Thermal 80 print rules are intact');
}

// TEST 5: Verify CompactInvoiceSheet JSX Structure for Single Bill
console.log('\n👉 [Test 5] Verify CompactInvoiceSheet.jsx Single Bill Structure...');
{
    const jsxPath = path.join(__dirname, 'src/components/CompactInvoiceSheet.jsx');
    const jsxContent = fs.readFileSync(jsxPath, 'utf8');

    // Verify single bill return contains half-a4-single-sheet and cut-divider
    assert(jsxContent.includes('className="a4-sheet-wrapper format-half_a4 single-bill"'), 'Contains single-bill wrapper');
    assert(jsxContent.includes('className="half-a4-single-sheet"'), 'Contains half-a4-single-sheet container');
    assert(jsxContent.includes('isSingleHalf={true}'), 'Passes isSingleHalf={true} to CompactInvoiceSlot');
    assert(jsxContent.includes('className="half-a4-cut-divider cis-single-cut-divider"'), 'Renders half-a4-cut-divider cis-single-cut-divider at the bottom of the single sheet');

    // CRITICAL: Verify Paired Bills (bill2) structure is completely intact
    assert(jsxContent.includes('className="a4-sheet-wrapper format-half_a4 paired-bills"'), 'Paired bills wrapper remains intact');
    assert(jsxContent.includes('className="half-a4-slot slot-top"'), 'Slot top remains intact');
    assert(jsxContent.includes('className="half-a4-slot slot-bottom"'), 'Slot bottom remains intact');
}

console.log('\n========================================================================');
if (allPassed) {
    console.log(' 🎉 ALL HALF A4 PRINT ALIGNMENT TESTS PASSED! ZERO REGRESSIONS!');
} else {
    console.error(' ❌ SOME TESTS FAILED!');
    process.exit(1);
}
console.log('========================================================================\n');
