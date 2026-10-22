/**
 * ShopPulse — Configurable Bill Printing Format Constants & Specs
 * 
 * Supports:
 * 1. Full A4: Standard full-page invoice per A4 sheet (portrait)
 * 2. Half A4: Two compact bills per A4 sheet with scissor cutting line
 * 3. Thermal 58 mm: Narrow receipt format (2 inch roll)
 * 4. Thermal 80 mm: Wider receipt format (3 inch roll)
 */

export const PRINT_FORMATS = {
    FULL_A4: 'full_a4',
    HALF_A4: 'half_a4',
    THERMAL_58: 'thermal_58',
    THERMAL_80: 'thermal_80',
};

export const PRINT_FORMAT_OPTIONS = [
    {
        id: 'full_a4',
        name: 'Full A4',
        paperSize: '210 × 297 mm (A4)',
        shortDesc: 'One full-page invoice per A4 sheet.',
        description: 'Standard full-page portrait layout with spacious item tables, comprehensive GST tax breakdown, and clear totals.',
        badge: '1 Bill / Sheet',
        category: 'A4 Paper',
        printerTip: 'In the browser print dialog, select Destination: Your A4 Printer, Paper Size: A4, Margins: Default.',
    },
    {
        id: 'half_a4',
        name: 'Half A4',
        paperSize: '210 × 148 mm (Half A4)',
        shortDesc: 'Compact genuine Half A4 invoice (210 × 148 mm), with optional 2-on-1 A4 sheet printing.',
        description: 'Eco-saver layout rendering a genuine Half A4 invoice. Optionally pair another bill to print 2 bills on one A4 sheet with a scissor cutting guide.',
        badge: 'Half A4',
        category: 'A4 Paper',
        printerTip: 'In the browser print dialog, select Paper Size: A5 (Landscape) or 210×148mm (Half A4), Margins: Minimum.',
    },
    {
        id: 'thermal_58',
        name: 'Thermal 58 mm',
        paperSize: '58 mm / 2 inch roll',
        shortDesc: 'Narrow receipt format for compatible thermal printers.',
        description: 'Ultra-compact roll receipt with auto-wrapping, optimized typography, and essential store & transaction details.',
        badge: '2" Thermal',
        category: 'Thermal Roll',
        printerTip: 'In the browser print dialog, select your Thermal Printer, Paper Size: 58mm Roll, Margins: None / Minimum.',
    },
    {
        id: 'thermal_80',
        name: 'Thermal 80 mm',
        paperSize: '80 mm / 3 inch roll',
        shortDesc: 'Wider receipt format for compatible thermal printers.',
        description: 'Standard retail roll receipt with column-aligned items, quantities, rates, taxes, and totals without A4-only elements.',
        badge: '3" Thermal',
        category: 'Thermal Roll',
        printerTip: 'In the browser print dialog, select your Thermal Printer, Paper Size: 80mm Roll, Margins: None / Minimum.',
    }
];

export const getFormatOption = (formatId) => {
    return PRINT_FORMAT_OPTIONS.find(opt => opt.id === formatId) || PRINT_FORMAT_OPTIONS[0];
};

export const isValidFormat = (formatId) => {
    return PRINT_FORMAT_OPTIONS.some(opt => opt.id === formatId);
};

export const applyPrintPageStyles = (formatId, options = {}) => {
    if (typeof document === 'undefined') return;

    let pageCss = '';
    switch (formatId) {
        case 'half_a4':
            if (options?.hasSecondBill) {
                pageCss = '@page { size: A4 portrait; margin: 4mm 6mm; }';
            } else {
                pageCss = '@page { size: 210mm 148.5mm; margin: 3mm 5mm; }';
            }
            break;
        case 'thermal_58':
            pageCss = '@page { size: 58mm auto; margin: 2mm 2mm; }';
            break;
        case 'thermal_80':
            pageCss = '@page { size: 80mm auto; margin: 3mm 3mm; }';
            break;
        case 'full_a4':
        default:
            pageCss = '@page { size: A4 portrait; margin: 8mm; }';
            break;
    }

    let styleTag = document.getElementById('shoppulse-print-page-style');
    if (!styleTag) {
        styleTag = document.createElement('style');
        styleTag.id = 'shoppulse-print-page-style';
        document.head.appendChild(styleTag);
    }
    styleTag.innerHTML = pageCss;
    document.body.setAttribute('data-print-format', formatId || 'full_a4');
};

export default {
    PRINT_FORMATS,
    PRINT_FORMAT_OPTIONS,
    getFormatOption,
    isValidFormat,
    applyPrintPageStyles
};
