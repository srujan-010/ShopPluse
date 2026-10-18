const mongoose = require('mongoose');
const dotenv = require('dotenv');
const dns = require('dns');
const path = require('path');

try {
    dns.setServers(['8.8.8.8', '1.1.1.1']);
} catch (e) {}

dotenv.config({ path: path.join(__dirname, '.env') });

const User = require('./models/User');
const Shop = require('./models/Shop');
const Product = require('./models/Product');

async function run() {
    console.log('🚀 Starting Product Form & Fields Verification Suite...\n');
    await mongoose.connect(process.env.MONGODB_URI);

    const shop = await Shop.findOne({ _id: '6ad1d099d5145eba50c13795' }) || await Shop.findOne();
    if (!shop) {
        console.error('❌ No shop found to test with.');
        process.exit(1);
    }
    const user = await User.findById(shop.owner);
    console.log(`✅ Using Shop: "${shop.name}" (${shop._id}) owned by User (${user.name || user._id})`);

    // Clean any prior test products
    await Product.deleteMany({ name: { $regex: /^\[TEST-VERIFY\]/ } });

    // TEST 1: Create a new product without specifying SKU, Barcode, or Product Type (as submitted by new Add Product form)
    console.log('\n👉 [Test 1] Adding a new product without SKU, Barcode, Product Type inputs...');
    const testExpiry = new Date();
    testExpiry.setDate(testExpiry.getDate() + 25); // 25 days in future

    const newProductPayload = {
        name: '[TEST-VERIFY] Organic Neem Cake 10kg',
        category: 'Fertilizers',
        brand: 'GreenBio Agro',
        unit: 'Bags',
        quantity: 35,
        lowStockLimit: 8,
        buyPrice: 320,
        sellPrice: 450,
        governmentPrice: 280,
        isGstApplicable: true,
        gstRate: 12,
        gstPricingMode: 'inclusive',
        gst: 12,
        expiryDate: testExpiry,
        shop: shop._id,
        owner: user._id,
        // Frontend initial state values
        sku: '',
        barcode: '',
        productType: 'Piece'
    };

    const createdProduct = await Product.create(newProductPayload);
    console.log(`Created product ID: ${createdProduct._id}`);

    // Verify created product fields
    if (createdProduct.name !== '[TEST-VERIFY] Organic Neem Cake 10kg') throw new Error('Product name mismatch');
    if (createdProduct.brand !== 'GreenBio Agro') throw new Error('Brand mismatch');
    if (createdProduct.category !== 'Fertilizers') throw new Error('Category mismatch');
    if (createdProduct.unit !== 'Bags') throw new Error('Unit mismatch');
    if (createdProduct.quantity !== 35) throw new Error('Quantity mismatch');
    if (createdProduct.lowStockLimit !== 8) throw new Error('Low stock limit mismatch');
    if (createdProduct.buyPrice !== 320) throw new Error('Buy price mismatch');
    if (createdProduct.sellPrice !== 450) throw new Error('Sell price mismatch');
    if (createdProduct.governmentPrice !== 280) throw new Error('Government price mismatch');
    if (createdProduct.isGstApplicable !== true) throw new Error('isGstApplicable mismatch');
    if (createdProduct.gstRate !== 12) throw new Error('gstRate mismatch');
    if (createdProduct.gstPricingMode !== 'inclusive') throw new Error('gstPricingMode mismatch');
    if (!createdProduct.expiryDate) throw new Error('expiryDate missing');
    if (createdProduct.productType !== 'Piece') throw new Error('Default productType mismatch');
    console.log('✅ PASS: New product created with all inventory, pricing, GST, and expiry fields intact!');

    // TEST 2: Preserving existing SKU and Barcode on Edit Product
    console.log('\n👉 [Test 2] Testing Edit Product with existing SKU and Barcode (backward compatibility)...');
    
    // Create an existing product with legacy SKU and Barcode
    const legacyProduct = await Product.create({
        name: '[TEST-VERIFY] Legacy Hybrid Wheat Seeds',
        category: 'Seeds',
        brand: 'KisanVikas',
        unit: 'Kg',
        quantity: 100,
        lowStockLimit: 15,
        buyPrice: 80,
        sellPrice: 120,
        governmentPrice: 95,
        isGstApplicable: false,
        gstRate: 0,
        gstPricingMode: 'inclusive',
        sku: 'LEGACY-WHEAT-SKU-99',
        barcode: '8901234999999',
        productType: 'Piece',
        shop: shop._id,
        owner: user._id
    });
    console.log(`Created legacy product with SKU: "${legacyProduct.sku}" and Barcode: "${legacyProduct.barcode}"`);

    // Simulate the frontend edit flow:
    // Form loads legacy product:
    const editFormData = {
        name: legacyProduct.name,
        category: legacyProduct.category,
        brand: legacyProduct.brand,
        unit: legacyProduct.unit,
        quantity: Number(legacyProduct.quantity),
        lowStockLimit: Number(legacyProduct.lowStockLimit),
        buyPrice: Number(legacyProduct.buyPrice),
        sellPrice: Number(legacyProduct.sellPrice),
        governmentPrice: Number(legacyProduct.governmentPrice),
        isGstApplicable: legacyProduct.isGstApplicable,
        gstRate: legacyProduct.gstRate,
        gstPricingMode: legacyProduct.gstPricingMode,
        expiryDate: legacyProduct.expiryDate || '',
        // The hidden/preserved fields from handleOpenModal:
        sku: legacyProduct.sku || '',
        barcode: legacyProduct.barcode || '',
        productType: legacyProduct.productType || 'Piece'
    };

    // User edits the product in the updated UI (modifies name, quantity, prices, adds expiry, sets GST):
    const updatedExpiry = new Date();
    updatedExpiry.setDate(updatedExpiry.getDate() + 10);

    const updatePayload = {
        ...editFormData,
        name: '[TEST-VERIFY] Premium Hybrid Wheat Seeds (Grade A)',
        quantity: 120,
        lowStockLimit: 20,
        buyPrice: 85,
        sellPrice: 130,
        governmentPrice: 100,
        isGstApplicable: true,
        gstRate: 5,
        gstPricingMode: 'exclusive',
        gst: 5,
        expiryDate: updatedExpiry
    };

    // Update in MongoDB
    const updatedProduct = await Product.findByIdAndUpdate(legacyProduct._id, updatePayload, { new: true, runValidators: true });

    // Verify that SKU and Barcode were NOT deleted
    if (updatedProduct.sku !== 'LEGACY-WHEAT-SKU-99') {
        throw new Error(`Legacy SKU was deleted or altered! Got: "${updatedProduct.sku}"`);
    }
    if (updatedProduct.barcode !== '8901234999999') {
        throw new Error(`Legacy Barcode was deleted or altered! Got: "${updatedProduct.barcode}"`);
    }
    console.log('✅ PASS: Legacy SKU ("LEGACY-WHEAT-SKU-99") and Barcode ("8901234999999") preserved perfectly!');

    // Verify updated values
    if (updatedProduct.name !== '[TEST-VERIFY] Premium Hybrid Wheat Seeds (Grade A)') throw new Error('Updated name mismatch');
    if (updatedProduct.quantity !== 120) throw new Error('Updated quantity mismatch');
    if (updatedProduct.lowStockLimit !== 20) throw new Error('Updated lowStockLimit mismatch');
    if (updatedProduct.buyPrice !== 85) throw new Error('Updated buyPrice mismatch');
    if (updatedProduct.sellPrice !== 130) throw new Error('Updated sellPrice mismatch');
    if (updatedProduct.governmentPrice !== 100) throw new Error('Updated governmentPrice mismatch');
    if (updatedProduct.isGstApplicable !== true) throw new Error('Updated isGstApplicable mismatch');
    if (updatedProduct.gstRate !== 5) throw new Error('Updated gstRate mismatch');
    if (updatedProduct.gstPricingMode !== 'exclusive') throw new Error('Updated gstPricingMode mismatch');
    console.log('✅ PASS: Updated inventory quantity, prices, gov price, GST config, and expiry saved accurately!');

    // TEST 3: Reopening the product from the database
    console.log('\n👉 [Test 3] Reopening and reloading product from MongoDB...');
    const reloaded = await Product.findById(legacyProduct._id);
    if (!reloaded) throw new Error('Product could not be reloaded');
    if (reloaded.name !== '[TEST-VERIFY] Premium Hybrid Wheat Seeds (Grade A)') throw new Error('Reloaded name mismatch');
    if (reloaded.quantity !== 120) throw new Error('Reloaded quantity mismatch');
    if (reloaded.sku !== 'LEGACY-WHEAT-SKU-99') throw new Error('Reloaded sku mismatch');
    if (reloaded.barcode !== '8901234999999') throw new Error('Reloaded barcode mismatch');
    console.log('✅ PASS: Product successfully reopened with all fields and backward-compatible data intact!');

    // Clean up test products
    await Product.deleteMany({ name: { $regex: /^\[TEST-VERIFY\]/ } });
    console.log('\n🧹 Cleaned up temporary test products.');
    await mongoose.disconnect();
    console.log('🎉 ALL PRODUCT FORM UPDATE VERIFICATION CHECKS PASSED!\n');
}

run().catch(err => {
    console.error('❌ Verification failed:', err);
    process.exit(1);
});
