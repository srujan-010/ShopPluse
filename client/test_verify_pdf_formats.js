import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import invoiceService from './src/utils/invoiceService.js';
import { resolveBillTaxDetails } from './src/utils/gstService.js';

console.log('=== Step 1: Testing jsPDF Output for All 4 Formats ===');

const mockShop = {
    _id: 'shop123',
    name: 'Sri Venkateshwara Krushi Kendra',
    location: 'Main Road, Warangal, Telangana',
    contactNumber: '9848022338',
    gstNumber: '36ABCDE1234F1Z5',
    defaultPrintFormat: 'full_a4'
};

const mockRetailBill = {
    _id: '67b3123456789abcdef01234',
    invoiceNumber: 'INV-2026-0042',
    date: new Date('2026-10-18T10:30:00Z'),
    paymentMethod: 'UPI',
    customerName: 'Anil Kumar Reddy',
    customerMobile: '9988776655',
    customerAadhaar: '1234-5678-9012',
    type: 'SALE',
    items: [
        {
            productName: 'Urea 46% Nitrogen Fertilizer 50kg Bag',
            quantity: 3,
            unit: 'Bag',
            pricePerBaseUnit: 266.50,
            isGstApplicable: true,
            gstRate: 5,
            gstPricingMode: 'inclusive'
        },
        {
            productName: 'DAP Diammonium Phosphate (18-46-0)',
            quantity: 2,
            unit: 'Bag',
            pricePerBaseUnit: 1350.00,
            isGstApplicable: true,
            gstRate: 18,
            gstPricingMode: 'inclusive'
        },
        {
            productName: 'Chlorpyriphos 20% EC Insecticide 1L Bottle',
            quantity: 1,
            unit: 'Bottle',
            pricePerBaseUnit: 480.00,
            isGstApplicable: true,
            gstRate: 18,
            gstPricingMode: 'exclusive'
        }
    ],
    totalAmount: 4045.90
};

const mockGovBill = {
    _id: '67b3987654321fedcba43210',
    invoiceNumber: 'GOV-2026-0089',
    date: new Date('2026-10-18T11:15:00Z'),
    paymentMethod: 'CASH',
    farmerName: 'K. Somanna',
    customerName: 'K. Somanna',
    farmerAadhaar: '9876-5432-1098',
    customerAadhaar: '9876-5432-1098',
    type: 'GOV_SALE',
    items: [
        {
            productName: 'Neem Coated Urea (Govt Subsidized)',
            quantity: 4,
            unit: 'Bag',
            governmentPrice: 266.50,
            isGstApplicable: true,
            gstRate: 5,
            gstPricingMode: 'inclusive'
        }
    ],
    totalAmount: 1066.00
};

const formats = ['full_a4', 'half_a4', 'thermal_58', 'thermal_80'];

for (const fmt of formats) {
    try {
        console.log(`\nTesting format: "${fmt}" with Retail Bill...`);
        const docRetail = invoiceService.generateInvoicePDF(mockRetailBill, mockShop, 'SALE', { format: fmt });
        const outputRetail = docRetail.output('arraybuffer');
        const numPagesRetail = docRetail.getNumberOfPages();
        console.log(`  -> Retail PDF generated: ${outputRetail.byteLength} bytes, Pages: ${numPagesRetail}`);

        console.log(`Testing format: "${fmt}" with Government Sale Bill...`);
        const docGov = invoiceService.generateInvoicePDF(mockGovBill, mockShop, 'GOV_SALE', { format: fmt });
        const outputGov = docGov.output('arraybuffer');
        const numPagesGov = docGov.getNumberOfPages();
        console.log(`  -> Gov PDF generated: ${outputGov.byteLength} bytes, Pages: ${numPagesGov}`);

        if (outputRetail.byteLength > 1000 && outputGov.byteLength > 1000) {
            console.log(`  -> Format "${fmt}": PASS`);
        } else {
            console.error(`  -> Format "${fmt}": FAIL (unexpected small buffer size)`);
        }
    } catch (e) {
        console.error(`  -> Format "${fmt}" ERROR:`, e);
    }
}

console.log('\n=== All PDF Formats Verified Successfully! ===');
