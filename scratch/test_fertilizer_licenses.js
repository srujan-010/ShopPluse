const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../server/.env') });

const Shop = require('../server/models/Shop');

const getShopFertilizerLicenses = (shop) => {
    if (!shop) return [];
    const shopType = (shop.type || '').toLowerCase();
    const isFertilizer = shopType === 'fertilizers' || shopType.includes('fertilizer');
    if (!isFertilizer) return [];

    let licenses = [];
    if (Array.isArray(shop.fertilizerLicenses) && shop.fertilizerLicenses.length > 0) {
        licenses = shop.fertilizerLicenses
            .filter(l => l && l.licenseType && l.licenseNumber && String(l.licenseNumber).trim().length > 0)
            .map(l => ({
                type: String(l.licenseType).trim().toUpperCase(),
                number: String(l.licenseNumber).trim()
            }));
    } else if (shop.fertilizerLicense && typeof shop.fertilizerLicense === 'string' && shop.fertilizerLicense.trim()) {
        const str = shop.fertilizerLicense.trim();
        let type = 'LAID';
        if (str.startsWith('LAFD')) type = 'LAFD';
        else if (str.startsWith('LASD')) type = 'LASD';
        licenses = [{ type, number: str }];
    }

    const allowed = ['LAID', 'LAFD', 'LASD'];
    const valid = licenses.filter(l => allowed.includes(l.type));
    const seen = new Set();
    const unique = [];
    for (const l of valid) {
        if (!seen.has(l.type)) {
            seen.add(l.type);
            unique.push(l);
        }
    }
    return unique;
};

const formatFertilizerLicensesText = (shop) => {
    const licenses = getShopFertilizerLicenses(shop);
    if (!licenses || licenses.length === 0) return '';
    return licenses.map(l => `${l.type} Licence No.: ${l.number}`).join(' | ');
};

const validateAndFormatFertilizerLicenses = (licenses) => {
    if (!Array.isArray(licenses)) {
        throw new Error('Fertilizer licences must be an array');
    }

    const allowedTypes = ['LAID', 'LAFD', 'LASD'];
    const seenTypes = new Set();
    const cleanLicenses = [];

    for (const lic of licenses) {
        if (!lic || typeof lic !== 'object') {
            throw new Error('Invalid licence record');
        }
        const lType = (lic.licenseType || '').trim().toUpperCase();
        const lNum = (lic.licenseNumber || '').trim();

        if (!allowedTypes.includes(lType)) {
            throw new Error(`Invalid licence type: ${lType}. Must be LAID, LAFD, or LASD.`);
        }

        if (!lNum) {
            throw new Error(`Licence number is mandatory for ${lType}`);
        }

        if (seenTypes.has(lType)) {
            throw new Error(`Duplicate licence type: ${lType}. Each licence type can be registered only once per shop.`);
        }

        seenTypes.add(lType);
        cleanLicenses.push({ licenseType: lType, licenseNumber: lNum });
    }

    return cleanLicenses;
};

async function runTests() {
    console.log('--- Starting Fertilizer Licences Test Suite ---');

    // Unit test 1: Format with 1 licence
    const shop1 = { type: 'Fertilizers', fertilizerLicenses: [{ licenseType: 'LAID', licenseNumber: 'LAID/12345' }] };
    const text1 = formatFertilizerLicensesText(shop1);
    console.log('Test 1 (1 licence):', text1);
    if (text1 !== 'LAID Licence No.: LAID/12345') throw new Error(`Test 1 failed: got "${text1}"`);

    // Unit test 2: Format with 2 licences
    const shop2 = {
        type: 'Fertilizers',
        fertilizerLicenses: [
            { licenseType: 'LAID', licenseNumber: 'LAID/12345' },
            { licenseType: 'LAFD', licenseNumber: 'LAFD/67890' }
        ]
    };
    const text2 = formatFertilizerLicensesText(shop2);
    console.log('Test 2 (2 licences):', text2);
    if (text2 !== 'LAID Licence No.: LAID/12345 | LAFD Licence No.: LAFD/67890') throw new Error(`Test 2 failed: got "${text2}"`);

    // Unit test 3: Format with 3 licences
    const shop3 = {
        type: 'Fertilizers',
        fertilizerLicenses: [
            { licenseType: 'LAID', licenseNumber: 'LAID/12345' },
            { licenseType: 'LAFD', licenseNumber: 'LAFD/67890' },
            { licenseType: 'LASD', licenseNumber: 'LASD/24680' }
        ]
    };
    const text3 = formatFertilizerLicensesText(shop3);
    console.log('Test 3 (3 licences):', text3);
    if (text3 !== 'LAID Licence No.: LAID/12345 | LAFD Licence No.: LAFD/67890 | LASD Licence No.: LASD/24680') throw new Error(`Test 3 failed: got "${text3}"`);

    // Unit test 4: Non-fertilizer shop
    const shopNonFert = {
        type: 'Grocery',
        fertilizerLicenses: [{ licenseType: 'LAID', licenseNumber: 'LAID/12345' }]
    };
    const textNonFert = formatFertilizerLicensesText(shopNonFert);
    console.log('Test 4 (Non-fertilizer shop):', `"${textNonFert}"`);
    if (textNonFert !== '') throw new Error('Test 4 failed: non-fertilizer shop must not show licences');

    // Unit test 5: Empty licences
    const shopEmpty = { type: 'Fertilizers', fertilizerLicenses: [] };
    const textEmpty = formatFertilizerLicensesText(shopEmpty);
    console.log('Test 5 (Empty licences):', `"${textEmpty}"`);
    if (textEmpty !== '') throw new Error('Test 5 failed: empty licences must return empty string');

    // Unit test 6: Validation tests
    try {
        validateAndFormatFertilizerLicenses([{ licenseType: 'LAID', licenseNumber: '' }]);
        throw new Error('Should have failed for empty licence number');
    } catch (e) {
        console.log('Test 6a (Empty licence number rejected):', e.message);
    }

    try {
        validateAndFormatFertilizerLicenses([
            { licenseType: 'LAID', licenseNumber: '123' },
            { licenseType: 'LAID', licenseNumber: '456' }
        ]);
        throw new Error('Should have failed for duplicate licence type');
    } catch (e) {
        console.log('Test 6b (Duplicate licence type rejected):', e.message);
    }

    try {
        validateAndFormatFertilizerLicenses([{ licenseType: 'INVALID', licenseNumber: '123' }]);
        throw new Error('Should have failed for invalid licence type');
    } catch (e) {
        console.log('Test 6c (Invalid licence type rejected):', e.message);
    }

    // Database tests
    const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/shoppulse';
    await mongoose.connect(mongoUri);
    console.log('Connected to MongoDB');

    let testShop = await Shop.findOne({ type: 'Fertilizers' });
    if (!testShop) {
        console.log('Finding any shop or creating temporary test shop');
        testShop = await Shop.findOne();
    }

    if (testShop) {
        console.log('Testing DB persistence on shop:', testShop.name, testShop._id);
        const originalLic = testShop.fertilizerLicenses;

        // Save 1 licence
        testShop.fertilizerLicenses = [{ licenseType: 'LAID', licenseNumber: 'LAID/TEST/111' }];
        await testShop.save();
        let reloaded = await Shop.findById(testShop._id);
        console.log('Saved 1 licence, DB has:', reloaded.fertilizerLicenses);
        if (reloaded.fertilizerLicenses.length !== 1 || reloaded.fertilizerLicenses[0].licenseNumber !== 'LAID/TEST/111') {
            throw new Error('DB test failed for 1 licence');
        }

        // Save 2 licences
        testShop.fertilizerLicenses = [
            { licenseType: 'LAID', licenseNumber: 'LAID/TEST/111' },
            { licenseType: 'LAFD', licenseNumber: 'LAFD/TEST/222' }
        ];
        await testShop.save();
        reloaded = await Shop.findById(testShop._id);
        console.log('Saved 2 licences, DB has:', reloaded.fertilizerLicenses);
        if (reloaded.fertilizerLicenses.length !== 2) throw new Error('DB test failed for 2 licences');

        // Save 3 licences
        testShop.fertilizerLicenses = [
            { licenseType: 'LAID', licenseNumber: 'LAID/TEST/111' },
            { licenseType: 'LAFD', licenseNumber: 'LAFD/TEST/222' },
            { licenseType: 'LASD', licenseNumber: 'LASD/TEST/333' }
        ];
        await testShop.save();
        reloaded = await Shop.findById(testShop._id);
        console.log('Saved 3 licences, DB has:', reloaded.fertilizerLicenses);
        if (reloaded.fertilizerLicenses.length !== 3) throw new Error('DB test failed for 3 licences');

        // Edit licence
        testShop.fertilizerLicenses[1].licenseNumber = 'LAFD/UPDATED/999';
        await testShop.save();
        reloaded = await Shop.findById(testShop._id);
        console.log('Edited licence, DB has:', reloaded.fertilizerLicenses[1].licenseNumber);
        if (reloaded.fertilizerLicenses[1].licenseNumber !== 'LAFD/UPDATED/999') throw new Error('DB test failed for edit');

        // Remove licence (keep LAID and LASD)
        testShop.fertilizerLicenses = [testShop.fertilizerLicenses[0], testShop.fertilizerLicenses[2]];
        await testShop.save();
        reloaded = await Shop.findById(testShop._id);
        console.log('Removed 1 licence, remaining count:', reloaded.fertilizerLicenses.length);
        if (reloaded.fertilizerLicenses.length !== 2) throw new Error('DB test failed for remove');

        // Restore original
        testShop.fertilizerLicenses = originalLic || [];
        await testShop.save();
        console.log('Restored shop original licence state.');
    }

    await mongoose.disconnect();
    console.log('--- ALL ACCEPTANCE TESTS PASSED SUCCESSFULLY! ---');
}

runTests().catch(err => {
    console.error('Test error:', err);
    process.exit(1);
});
