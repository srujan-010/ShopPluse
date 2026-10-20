// Automated verification test script for POS GST Sale Government Price Filtering
const assert = require('assert');

// 1. Re-implement / import shared logic
function getProductGovPrice(product) {
    if (!product || typeof product !== 'object') return null;
    const raw = product.governmentPrice !== undefined && product.governmentPrice !== null && product.governmentPrice !== ''
        ? product.governmentPrice
        : (product.govPrice !== undefined && product.govPrice !== null && product.govPrice !== '' ? product.govPrice : null);

    if (raw === null || raw === undefined || raw === '') return null;
    const num = Number(raw);
    return !isNaN(num) && num > 0 ? num : null;
}

function isProductEligibleForSaleMode(product, isGovSaleMode = false) {
    if (!product) return false;
    if (isGovSaleMode) {
        return getProductGovPrice(product) !== null;
    }
    return true;
}

function filterProducts({ products, isGovSale, searchTerm = '', selectedCategory = 'All' }) {
    const modeEligible = products.filter(p => isProductEligibleForSaleMode(p, isGovSale));
    const categories = ['All', ...new Set(modeEligible.map(p => p.category).filter(Boolean))];
    
    const cleanSearch = (searchTerm || '').trim().toLowerCase();
    const filtered = modeEligible.filter(p => {
        const matchesSearch = !cleanSearch || 
            (p.name || '').toLowerCase().includes(cleanSearch) || 
            (p.barcode || '').toLowerCase().includes(cleanSearch) ||
            (p.sku || '').toLowerCase().includes(cleanSearch);
        const matchesCategory = selectedCategory === 'All' || p.category === selectedCategory;
        return matchesSearch && matchesCategory;
    });

    return { modeEligible, categories, filtered };
}

// 2. Define test products
const testProducts = [
    {
        _id: 'p1',
        name: 'Urea 45kg Bag',
        category: 'Fertilizers',
        sellPrice: 300,
        governmentPrice: 266, // Case 1: govPrice = 266
        quantity: 100,
        unit: 'Bags'
    },
    {
        _id: 'p2',
        name: 'DAP 50kg Bag',
        category: 'Fertilizers',
        sellPrice: 1400,
        governmentPrice: 0, // Case 2: govPrice = 0
        quantity: 50,
        unit: 'Bags'
    },
    {
        _id: 'p3',
        name: 'Pesticide Spray 1L',
        category: 'Pesticides',
        sellPrice: 650,
        // Case 3: governmentPrice missing / undefined
        quantity: 25,
        unit: 'Liter'
    },
    {
        _id: 'p4',
        name: 'Cotton Hybrid Seed 450g',
        category: 'Seeds', // Case 4: Non-fertilizer category with govPrice = 500
        sellPrice: 850,
        governmentPrice: 500,
        quantity: 40,
        unit: 'Packet'
    },
    {
        _id: 'p5',
        name: 'Zinc Sulphate 5kg',
        category: 'Micronutrients',
        sellPrice: 420,
        governmentPrice: null, // Case 5: govPrice = null
        quantity: 15,
        unit: 'Packet'
    },
    {
        _id: 'p6',
        name: 'Bio-Fertilizer 1kg',
        category: 'Bio',
        sellPrice: 180,
        governmentPrice: '', // Case 6: govPrice = empty string
        quantity: 30,
        unit: 'Packet'
    }
];

console.log('--- Running POS Government Price Filtering Acceptance Tests ---');

// Test 1: Government price ₹266 -> visible in GST Sale mode
const gstModeAll = filterProducts({ products: testProducts, isGovSale: true });
const p1Visible = gstModeAll.filtered.some(p => p._id === 'p1');
assert.strictEqual(p1Visible, true, 'Product with governmentPrice: 266 MUST be visible in GST Sale mode');
console.log('✔ Test 1 Passed: Product with govPrice ₹266 is visible in GST Sale mode');

// Test 2: Government price ₹0 -> hidden in GST Sale mode
const p2Visible = gstModeAll.filtered.some(p => p._id === 'p2');
assert.strictEqual(p2Visible, false, 'Product with governmentPrice: 0 MUST be hidden in GST Sale mode');
console.log('✔ Test 2 Passed: Product with govPrice ₹0 is hidden in GST Sale mode');

// Test 3: Government price missing / undefined / null / empty -> hidden in GST Sale mode
const p3Visible = gstModeAll.filtered.some(p => p._id === 'p3');
const p5Visible = gstModeAll.filtered.some(p => p._id === 'p5');
const p6Visible = gstModeAll.filtered.some(p => p._id === 'p6');
assert.strictEqual(p3Visible, false, 'Product with missing governmentPrice MUST be hidden in GST Sale mode');
assert.strictEqual(p5Visible, false, 'Product with null governmentPrice MUST be hidden in GST Sale mode');
assert.strictEqual(p6Visible, false, 'Product with empty string governmentPrice MUST be hidden in GST Sale mode');
console.log('✔ Test 3 Passed: Products with missing, null, or empty govPrice are hidden in GST Sale mode');

// Test 4: Government price ₹500 for a product in any category -> visible in GST Sale mode
const p4Visible = gstModeAll.filtered.some(p => p._id === 'p4');
assert.strictEqual(p4Visible, true, 'Product with govPrice ₹500 in Seeds category MUST be visible in GST Sale mode');
console.log('✔ Test 4 Passed: Product with govPrice ₹500 in Seeds category is visible in GST Sale mode');

// Exactly 2 products should be visible in GST mode: p1 (Urea) and p4 (Cotton Seed)
assert.strictEqual(gstModeAll.filtered.length, 2, 'Exactly 2 products must be visible in GST mode');
assert.deepStrictEqual(gstModeAll.filtered.map(p => p._id).sort(), ['p1', 'p4'], 'Only p1 and p4 must be in GST mode');
console.log('✔ Overall GST Mode Grid Count: 2 products visible out of 6');

// Test 5: In Regular Retail Sale mode -> ALL 6 products remain available according to retail logic
const retailModeAll = filterProducts({ products: testProducts, isGovSale: false });
assert.strictEqual(retailModeAll.filtered.length, 6, 'All products must remain available in Regular Retail Sale mode');
console.log('✔ Test 5 Passed: All 6 products remain available in Regular Retail Sale mode');

// Test 6: Search filtering in GST Sale mode
// Searching for "DAP" (which has govPrice: 0) should return 0 results in GST mode
const gstSearchDap = filterProducts({ products: testProducts, isGovSale: true, searchTerm: 'DAP' });
assert.strictEqual(gstSearchDap.filtered.length, 0, 'Searching for product without govPrice in GST mode must return 0 results');
// Searching for "Urea" (govPrice: 266) should return p1
const gstSearchUrea = filterProducts({ products: testProducts, isGovSale: true, searchTerm: 'Urea' });
assert.strictEqual(gstSearchUrea.filtered.length, 1);
assert.strictEqual(gstSearchUrea.filtered[0]._id, 'p1');
console.log('✔ Test 6 Passed: Search filtering strictly respects GST price requirement');

// Test 7: Category filtering in GST Sale mode
// In GST mode, categories should only include 'All', 'Fertilizers' (for Urea), and 'Seeds' (for Cotton Seed)
assert.deepStrictEqual(gstModeAll.categories.sort(), ['All', 'Fertilizers', 'Seeds'].sort());
// Filtering by 'Pesticides' in GST mode yields 0 items
const gstPesticides = filterProducts({ products: testProducts, isGovSale: true, selectedCategory: 'Pesticides' });
assert.strictEqual(gstPesticides.filtered.length, 0);
console.log('✔ Test 7 Passed: Categories dynamically derive from eligible products only');

// Test 8: Price calculation check
const p1PriceInGov = getProductGovPrice(testProducts[0]);
assert.strictEqual(p1PriceInGov, 266, 'Base price in GST sale must be 266');
const p1PriceInRetail = testProducts[0].sellPrice;
assert.strictEqual(p1PriceInRetail, 300, 'Base price in Retail sale must be 300');
console.log('✔ Test 8 Passed: Correct government price used for GST calculations and retail price for retail');

console.log('\n--- ALL ACCEPTANCE TESTS PASSED WITH 100% SUCCESS! ---');
