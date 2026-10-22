import React, { useEffect } from 'react';
import { Scissors, X, Receipt, Sparkles, Printer, FileText, CheckCircle2 } from 'lucide-react';
import { resolveBillTaxDetails } from '../utils/gstService';
import { applyPrintPageStyles, getFormatOption } from '../utils/printFormatConstants';
import '../styles/compactInvoice.css';

/**
 * Format currency
 */
const fmt = (val) => {
    const n = Number(val) || 0;
    return `₹${n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

/**
 * Retrieve registered fertilizer licences for a fertilizer shop
 */
export const getShopFertilizerLicenses = (shop) => {
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

/**
 * Format registered fertilizer licences into compact header string
 * e.g. "Lic No.: LCFRD122022547GDCD | Lic No.: LCID0820260041GDC"
 */
export const formatFertilizerLicensesText = (shop) => {
    const licenses = getShopFertilizerLicenses(shop);
    if (!licenses || licenses.length === 0) return '';
    return licenses.map(l => `Lic No.: ${l.number}`).join(' | ');
};

/**
 * --------------------------------------------------------------------------
 * 1. Half-A4 Compact Bill Slot Component
 * --------------------------------------------------------------------------
 */
export const CompactInvoiceSlot = ({ 
    bill, 
    shop, 
    type = 'SALE', 
    products = [],
    slotNumber = 1, 
    onRemove = null,
    isSingleHalf = false
}) => {
    if (!bill) return null;

    if (!bill._id && !bill.invoiceNumber && (!bill.items || bill.items.length === 0)) {
        return (
            <div className={`cis-slot-container slot-${slotNumber} cis-slot-error`}>
                <div style={{ padding: '32px 16px', textAlign: 'center', color: '#b91c1c' }}>
                    <p style={{ margin: '0 0 6px', fontWeight: 800, fontSize: '13px' }}>⚠️ Invoice Details Unavailable</p>
                    <span style={{ fontSize: '11px', color: '#64748b' }}>Required transaction details could not be loaded for this slot.</span>
                </div>
            </div>
        );
    }

    const effectiveShop = {
        ...(shop || {}),
        ...((bill.shop && typeof bill.shop === 'object') ? bill.shop : {})
    };
    if ((!effectiveShop.fertilizerLicenses || effectiveShop.fertilizerLicenses.length === 0) && shop?.fertilizerLicenses) {
        effectiveShop.fertilizerLicenses = shop.fertilizerLicenses;
    }
    if (!effectiveShop.type && shop?.type) {
        effectiveShop.type = shop.type;
    }
    const fertilizerLicText = formatFertilizerLicensesText(effectiveShop);
    const invoiceNum = bill.invoiceNumber || (bill._id ? bill._id.slice(-6).toUpperCase() : 'N/A');
    const billDate = bill.date ? new Date(bill.date) : new Date();
    const dateFormatted = billDate.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    const timeFormatted = billDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const partyName = type === 'PURCHASE' ? (bill.supplierName || 'Supplier') : (bill.customerName || 'Walk-in Customer');
    const partyPhone = type === 'PURCHASE' ? bill.supplierPhone : (bill.customerMobile || bill.customerPhone);

    const taxDetails = resolveBillTaxDetails(bill, type, effectiveShop, products);
    const {
        isGovBill,
        isTaxableInvoice,
        hasIgst,
        subtotal,
        discount,
        taxableAmount,
        totalGst,
        cgstTotal,
        sgstTotal,
        igstTotal,
        grandTotal,
        items: displayItems = []
    } = taxDetails;

    const itemCount = displayItems.length;
    const densityClass = itemCount > 10 ? 'density-ultra' 
                       : (itemCount > 6 ? 'density-compact' 
                       : (itemCount > 3 ? 'density-medium' : 'density-normal'));

    return (
        <div className={`cis-slot-container slot-${slotNumber} ${densityClass} ${isSingleHalf ? 'cis-single-slot' : ''}`}>
            {/* Top Accent Strip */}
            <div className="cis-accent-bar" />

            {/* Header: Shop Info */}
            <div className="cis-header">
                <div className="cis-shop-meta">
                    <h2 className="cis-shop-name">{effectiveShop?.name || 'ShopPulse Business'}</h2>
                    <p className="cis-shop-address">{effectiveShop?.location || 'India'}</p>
                    <p className="cis-shop-contact">
                        Phone: {effectiveShop?.contactNumber || 'XXXXXXXXXX'}  |  GSTIN: {effectiveShop?.gstNumber || 'N/A'}
                    </p>
                    {fertilizerLicText && (
                        <p className="cis-shop-licenses">
                            {fertilizerLicText}
                        </p>
                    )}
                </div>
                {onRemove && (
                    <button 
                        type="button" 
                        className="cis-remove-bill-btn no-print" 
                        onClick={onRemove}
                        title="Remove second bill"
                    >
                        <X size={14} /> Remove 2nd Bill
                    </button>
                )}
            </div>

            <div className="cis-divider" />

            {/* Meta Grid: Invoice & Customer Info */}
            <div className="cis-info-grid">
                <div className="cis-info-col">
                    <span className="cis-info-heading">
                        {type === 'PURCHASE' ? 'SUPPLIER BILL' : (isTaxableInvoice ? 'TAX INVOICE DETAILS' : 'INVOICE DETAILS')}
                    </span>
                    <div className="cis-info-row">
                        <label>Bill No:</label>
                        <strong>#{invoiceNum}</strong>
                    </div>
                    <div className="cis-info-row">
                        <label>Date & Time:</label>
                        <span>{dateFormatted}, {timeFormatted}</span>
                    </div>
                    <div className="cis-info-row">
                        <label>Payment:</label>
                        <strong className="cis-payment-badge">{(bill.paymentMethod || 'CASH').toUpperCase()}</strong>
                    </div>
                </div>

                <div className="cis-info-col">
                    <span className="cis-info-heading">
                        {type === 'PURCHASE' ? 'SUPPLIER DETAILS' : 'CUSTOMER DETAILS'}
                    </span>
                    <div className="cis-info-row">
                        <label>Name:</label>
                        <strong>{partyName}</strong>
                    </div>
                    {partyPhone && (
                        <div className="cis-info-row">
                            <label>Mobile:</label>
                            <span>{partyPhone}</span>
                        </div>
                    )}
                    {bill.customerAadhaar && (
                        <div className="cis-info-row">
                            <label>Aadhaar:</label>
                            <span>{bill.customerAadhaar}</span>
                        </div>
                    )}
                    {(type === 'RETURN' || type === 'EXCHANGE') && bill.originalSaleInvoice && (
                        <div className="cis-info-row">
                            <label>Linked Bill:</label>
                            <strong>#{bill.originalSaleInvoice}</strong>
                        </div>
                    )}
                </div>
            </div>

            {/* Items Table */}
            <div className="cis-table-wrap">
                <table className="cis-items-table">
                    <thead>
                        {isTaxableInvoice ? (
                            <tr>
                                <th style={{ width: '28px', textAlign: 'center' }}>Sl</th>
                                <th style={{ textAlign: 'left' }}>Product Description</th>
                                <th style={{ width: '68px', textAlign: 'center' }}>Qty</th>
                                <th style={{ width: '68px', textAlign: 'right' }}>{isGovBill ? 'GST Price' : 'Rate'}</th>
                                <th style={{ width: '74px', textAlign: 'right' }}>Taxable</th>
                                <th style={{ width: '76px', textAlign: 'right' }}>GST</th>
                                <th style={{ width: '76px', textAlign: 'right' }}>Amount</th>
                            </tr>
                        ) : (
                            <tr>
                                <th style={{ width: '32px', textAlign: 'center' }}>Sl</th>
                                <th style={{ textAlign: 'left' }}>Product Description</th>
                                <th style={{ width: '85px', textAlign: 'center' }}>Qty</th>
                                <th style={{ width: '95px', textAlign: 'right' }}>{isGovBill ? 'GST Price' : 'Rate'}</th>
                                <th style={{ width: '105px', textAlign: 'right' }}>Amount</th>
                            </tr>
                        )}
                    </thead>
                    <tbody>
                        {displayItems.length === 0 ? (
                            <tr>
                                <td colSpan={isTaxableInvoice ? 7 : 5} style={{ textAlign: 'center', color: '#dc2626', padding: '12px', fontWeight: 600 }}>
                                    ⚠️ No item records found in this transaction
                                </td>
                            </tr>
                        ) : (
                            displayItems.map((item, idx) => {
                                return isTaxableInvoice ? (
                                    <tr key={idx}>
                                        <td style={{ textAlign: 'center', verticalAlign: 'top' }}>{idx + 1}</td>
                                        <td className="cis-item-name" style={{ verticalAlign: 'top' }}>
                                            <div>{item.productName || 'Item'}</div>
                                            {item.returnedQty > 0 && (
                                                <div style={{ fontSize: '9px', color: '#64748B', fontWeight: '500', marginTop: '2px' }}>
                                                    Sold: {item.soldQtyEntered || item.quantity} {item.unit} | Returned: {item.returnedQty} {item.unit} (Net: {item.qty} {item.unit})
                                                </div>
                                            )}
                                        </td>
                                        <td style={{ textAlign: 'center', verticalAlign: 'top', whiteSpace: 'nowrap' }}>{item.qty} {item.unit}</td>
                                        <td style={{ textAlign: 'right', verticalAlign: 'top', whiteSpace: 'nowrap' }}>{fmt(item.appliedRate)}</td>
                                        <td style={{ textAlign: 'right', verticalAlign: 'top', whiteSpace: 'nowrap' }}>{fmt(item.taxableValue)}</td>
                                        <td style={{ textAlign: 'right', verticalAlign: 'top', whiteSpace: 'nowrap', color: item.isTaxable && item.gstRate > 0 ? '#1E6BFF' : '#64748B' }}>
                                            {item.isTaxable && item.gstRate > 0 ? `${fmt(item.gstAmount)}` : '₹0.00'}
                                        </td>
                                        <td style={{ textAlign: 'right', verticalAlign: 'top', whiteSpace: 'nowrap', fontWeight: 600 }}>{fmt(item.lineTotal)}</td>
                                    </tr>
                                ) : (
                                    <tr key={idx}>
                                        <td style={{ textAlign: 'center', verticalAlign: 'top' }}>{idx + 1}</td>
                                        <td className="cis-item-name" style={{ verticalAlign: 'top' }}>
                                            <div>{item.productName || 'Item'}</div>
                                            {item.returnedQty > 0 && (
                                                <div style={{ fontSize: '9px', color: '#64748B', fontWeight: '500', marginTop: '2px' }}>
                                                    Sold: {item.soldQtyEntered || item.quantity} {item.unit} | Returned: {item.returnedQty} {item.unit} (Net: {item.qty} {item.unit})
                                                </div>
                                            )}
                                        </td>
                                        <td style={{ textAlign: 'center', verticalAlign: 'top', whiteSpace: 'nowrap' }}>{item.qty} {item.unit}</td>
                                        <td style={{ textAlign: 'right', verticalAlign: 'top', whiteSpace: 'nowrap' }}>{fmt(item.appliedRate)}</td>
                                        <td style={{ textAlign: 'right', verticalAlign: 'top', whiteSpace: 'nowrap', fontWeight: 600 }}>{fmt(item.lineTotal)}</td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>

            {/* Financial Summary */}
            <div className="cis-bottom-section">
                {effectiveShop?.footerMessage && (
                    <div className="cis-custom-msg">
                        "{effectiveShop.footerMessage}"
                    </div>
                )}

                <div className="cis-summary-box">
                    <div className="cis-sum-row">
                        <span>Subtotal:</span>
                        <span>{fmt(subtotal)}</span>
                    </div>
                    {discount > 0 && (
                        <div className="cis-sum-row discount">
                            <span>Discount:</span>
                            <span>- {fmt(discount)}</span>
                        </div>
                    )}
                    {isTaxableInvoice && (
                        <>
                            <div className="cis-sum-row">
                                <span>Taxable Value:</span>
                                <span>{fmt(taxableAmount)}</span>
                            </div>
                            {hasIgst ? (
                                <div className="cis-sum-row">
                                    <span>IGST:</span>
                                    <span>{fmt(igstTotal)}</span>
                                </div>
                            ) : (
                                <>
                                    <div className="cis-sum-row">
                                        <span>CGST:</span>
                                        <span>{fmt(cgstTotal)}</span>
                                    </div>
                                    <div className="cis-sum-row">
                                        <span>SGST:</span>
                                        <span>{fmt(sgstTotal)}</span>
                                    </div>
                                </>
                            )}
                            <div className="cis-sum-row" style={{ color: '#1E6BFF' }}>
                                <span style={{ color: '#1E6BFF', fontWeight: '700' }}>Total GST:</span>
                                <span style={{ color: '#1E6BFF', fontWeight: '700' }}>+ {fmt(totalGst)}</span>
                            </div>
                        </>
                    )}
                    <div className="cis-sum-row grand">
                        <span>GRAND TOTAL:</span>
                        <span>{fmt(grandTotal)}</span>
                    </div>
                </div>
            </div>

            {/* Professional Signature Section */}
            <div className="cis-signatures-wrap">
                <div className="cis-sig-col left">
                    <span className="cis-sig-heading">Buyer's Signature</span>
                    <div className="cis-sig-space" />
                    <div className="cis-sig-line" />
                    <span className="cis-sig-role">Customer / Buyer</span>
                </div>
                <div className="cis-sig-col right">
                    <span className="cis-sig-for-shop">For {effectiveShop?.name || 'ShopPulse Business'}</span>
                    <div className="cis-sig-space" />
                    <div className="cis-sig-line" />
                    <span className="cis-sig-role auth">Authorized Signatory</span>
                </div>
            </div>

            {/* Slot Footer */}
            <div className="cis-footer">
                <div className="cis-footer-divider" />
                <div className="cis-footer-msg">Thank you for your business!</div>
                <div className="cis-footer-brand">Generated by ShopPulse POS — Half A4 Bill</div>
            </div>
        </div>
    );
};

/**
 * --------------------------------------------------------------------------
 * 2. Full A4 Invoice Component (Single full-page sheet)
 * --------------------------------------------------------------------------
 */
export const FullA4Invoice = ({
    bill,
    shop,
    type = 'SALE',
    products = []
}) => {
    if (!bill) return null;

    const effectiveShop = {
        ...(shop || {}),
        ...((bill.shop && typeof bill.shop === 'object') ? bill.shop : {})
    };
    if ((!effectiveShop.fertilizerLicenses || effectiveShop.fertilizerLicenses.length === 0) && shop?.fertilizerLicenses) {
        effectiveShop.fertilizerLicenses = shop.fertilizerLicenses;
    }
    if (!effectiveShop.type && shop?.type) {
        effectiveShop.type = shop.type;
    }
    const fertilizerLicText = formatFertilizerLicensesText(effectiveShop);
    const invoiceNum = bill.invoiceNumber || (bill._id ? bill._id.slice(-6).toUpperCase() : 'N/A');
    const billDate = bill.date ? new Date(bill.date) : new Date();
    const dateFormatted = billDate.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    const timeFormatted = billDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const partyName = type === 'PURCHASE' ? (bill.supplierName || 'Supplier') : (bill.customerName || 'Walk-in Customer');
    const partyPhone = type === 'PURCHASE' ? bill.supplierPhone : (bill.customerMobile || bill.customerPhone);

    const taxDetails = resolveBillTaxDetails(bill, type, effectiveShop, products);
    const {
        isGovBill,
        isTaxableInvoice,
        hasIgst,
        subtotal,
        discount,
        taxableAmount,
        totalGst,
        cgstTotal,
        sgstTotal,
        igstTotal,
        grandTotal,
        items: displayItems = []
    } = taxDetails;

    return (
        <div className="full-a4-sheet">
            {/* Top Accent Strip */}
            <div className="full-a4-accent-bar" />

            {/* Header: Shop Meta & Title */}
            <div className="full-a4-header">
                <div className="full-a4-brand-wrap">
                    <h1 className="full-a4-shop-name">{effectiveShop?.name || 'ShopPulse Business'}</h1>
                    <p className="full-a4-shop-address">{effectiveShop?.location || 'India'}</p>
                    <p className="full-a4-shop-contact">
                        Phone: {effectiveShop?.contactNumber || 'XXXXXXXXXX'} &nbsp;|&nbsp; GSTIN: {effectiveShop?.gstNumber || 'N/A'}
                        {effectiveShop?.email && <span> &nbsp;|&nbsp; Email: {effectiveShop.email}</span>}
                    </p>
                    {fertilizerLicText && (
                        <p className="full-a4-shop-licenses">
                            {fertilizerLicText}
                        </p>
                    )}
                </div>
                <div className="full-a4-badge-box">
                    <span className="full-a4-title-tag">
                        {type === 'PURCHASE' ? 'PURCHASE INVOICE' : (isTaxableInvoice ? 'TAX INVOICE' : 'BILL OF SUPPLY')}
                    </span>
                    <span className="full-a4-orig-copy">ORIGINAL FOR RECIPIENT</span>
                </div>
            </div>

            <div className="full-a4-divider" />

            {/* Metadata Grid */}
            <div className="full-a4-meta-grid">
                <div className="full-a4-meta-card">
                    <span className="full-a4-meta-title">Invoice Information</span>
                    <div className="full-a4-meta-row">
                        <label>Invoice No:</label>
                        <strong>#{invoiceNum}</strong>
                    </div>
                    <div className="full-a4-meta-row">
                        <label>Invoice Date:</label>
                        <span>{dateFormatted}, {timeFormatted}</span>
                    </div>
                    <div className="full-a4-meta-row">
                        <label>Payment Mode:</label>
                        <strong className="full-a4-pill-pay">{(bill.paymentMethod || 'CASH').toUpperCase()}</strong>
                    </div>
                    {isGovBill && (
                        <div className="full-a4-meta-row">
                            <label>Category:</label>
                            <span style={{ color: '#0284c7', fontWeight: 700 }}>GST Registered Sale</span>
                        </div>
                    )}
                </div>

                <div className="full-a4-meta-card">
                    <span className="full-a4-meta-title">Customer Details</span>
                    <div className="full-a4-meta-row">
                        <label>Customer Name:</label>
                        <strong>{partyName}</strong>
                    </div>
                    {partyPhone && (
                        <div className="full-a4-meta-row">
                            <label>Mobile Number:</label>
                            <span>{partyPhone}</span>
                        </div>
                    )}
                    {bill.customerAadhaar && (
                        <div className="full-a4-meta-row">
                            <label>Aadhaar / ID:</label>
                            <span>{bill.customerAadhaar}</span>
                        </div>
                    )}
                    {bill.customerAddress && (
                        <div className="full-a4-meta-row">
                            <label>Address:</label>
                            <span>{bill.customerAddress}</span>
                        </div>
                    )}
                </div>
            </div>

            {/* Full Items Table */}
            <div className="full-a4-table-wrap">
                <table className="full-a4-table">
                    <thead>
                        {isTaxableInvoice ? (
                            <tr>
                                <th style={{ width: '38px', textAlign: 'center' }}>#</th>
                                <th style={{ textAlign: 'left' }}>Product / Item Description</th>
                                <th style={{ width: '70px', textAlign: 'center' }}>Qty</th>
                                <th style={{ width: '85px', textAlign: 'right' }}>{isGovBill ? 'GST Price' : 'Rate'}</th>
                                <th style={{ width: '90px', textAlign: 'right' }}>Taxable Val</th>
                                <th style={{ width: '85px', textAlign: 'center' }}>GST Rate</th>
                                <th style={{ width: '90px', textAlign: 'right' }}>GST Amt</th>
                                <th style={{ width: '105px', textAlign: 'right' }}>Total Amount</th>
                            </tr>
                        ) : (
                            <tr>
                                <th style={{ width: '45px', textAlign: 'center' }}>#</th>
                                <th style={{ textAlign: 'left' }}>Product / Item Description</th>
                                <th style={{ width: '100px', textAlign: 'center' }}>Qty</th>
                                <th style={{ width: '120px', textAlign: 'right' }}>{isGovBill ? 'GST Price' : 'Rate'}</th>
                                <th style={{ width: '140px', textAlign: 'right' }}>Total Amount</th>
                            </tr>
                        )}
                    </thead>
                    <tbody>
                        {displayItems.length === 0 ? (
                            <tr>
                                <td colSpan={isTaxableInvoice ? 8 : 5} style={{ textAlign: 'center', padding: '24px', color: '#dc2626' }}>
                                    No item records found in this invoice.
                                </td>
                            </tr>
                        ) : (
                            displayItems.map((item, idx) => (
                                <tr key={idx}>
                                    <td style={{ textAlign: 'center', verticalAlign: 'top' }}>{idx + 1}</td>
                                    <td className="full-a4-item-desc" style={{ verticalAlign: 'top' }}>
                                        <div className="item-title">{item.productName || 'Item'}</div>
                                        {item.returnedQty > 0 && (
                                            <div className="item-sub">
                                                Sold: {item.soldQtyEntered || item.quantity} {item.unit} | Returned: {item.returnedQty} {item.unit} (Net: {item.qty} {item.unit})
                                            </div>
                                        )}
                                        {item.isTaxable && item.gstRate > 0 && (
                                            <div className="item-sub">
                                                Mode: {item.gstPricingMode === 'exclusive' ? 'GST Exclusive' : 'GST Inclusive'}
                                                {hasIgst 
                                                    ? ` • IGST: ${fmt(item.gstAmount)}` 
                                                    : ` • CGST: ${fmt(item.cgst)} | SGST: ${fmt(item.sgst)}`}
                                            </div>
                                        )}
                                    </td>
                                    <td style={{ textAlign: 'center', verticalAlign: 'top', whiteSpace: 'nowrap', fontWeight: 600 }}>{item.qty} {item.unit}</td>
                                    <td style={{ textAlign: 'right', verticalAlign: 'top', whiteSpace: 'nowrap' }}>{fmt(item.appliedRate)}</td>
                                    {isTaxableInvoice && (
                                        <>
                                            <td style={{ textAlign: 'right', verticalAlign: 'top', whiteSpace: 'nowrap' }}>{fmt(item.taxableValue)}</td>
                                            <td style={{ textAlign: 'center', verticalAlign: 'top', whiteSpace: 'nowrap', color: '#1e6bff', fontWeight: 600 }}>
                                                {item.isTaxable && item.gstRate > 0 ? `${item.gstRate}%` : '0%'}
                                            </td>
                                            <td style={{ textAlign: 'right', verticalAlign: 'top', whiteSpace: 'nowrap', color: item.isTaxable && item.gstRate > 0 ? '#1e6bff' : '#64748b' }}>
                                                {item.isTaxable && item.gstRate > 0 ? fmt(item.gstAmount) : '₹0.00'}
                                            </td>
                                        </>
                                    )}
                                    <td style={{ textAlign: 'right', verticalAlign: 'top', whiteSpace: 'nowrap', fontWeight: 700 }}>{fmt(item.lineTotal)}</td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* Bottom Section: Summary */}
            <div className="full-a4-bottom-section">
                <div className="full-a4-notes-block">
                    {effectiveShop?.footerMessage && (
                        <div className="full-a4-custom-msg">
                            "{effectiveShop.footerMessage}"
                        </div>
                    )}
                </div>

                <div className="full-a4-summary-card">
                    <div className="sum-line">
                        <span>Subtotal:</span>
                        <span>{fmt(subtotal)}</span>
                    </div>
                    {discount > 0 && (
                        <div className="sum-line disc">
                            <span>Discount:</span>
                            <span>- {fmt(discount)}</span>
                        </div>
                    )}
                    {isTaxableInvoice && (
                        <>
                            <div className="sum-line">
                                <span>Taxable Value:</span>
                                <span>{fmt(taxableAmount)}</span>
                            </div>
                            {hasIgst ? (
                                <div className="sum-line">
                                    <span>IGST:</span>
                                    <span>{fmt(igstTotal)}</span>
                                </div>
                            ) : (
                                <>
                                    <div className="sum-line">
                                        <span>CGST:</span>
                                        <span>{fmt(cgstTotal)}</span>
                                    </div>
                                    <div className="sum-line">
                                        <span>SGST:</span>
                                        <span>{fmt(sgstTotal)}</span>
                                    </div>
                                </>
                            )}
                            <div className="sum-line gst-total-line">
                                <span>Total GST:</span>
                                <span>+ {fmt(totalGst)}</span>
                            </div>
                        </>
                    )}
                    <div className="sum-line full-grand">
                        <span>GRAND TOTAL:</span>
                        <span>{fmt(grandTotal)}</span>
                    </div>
                </div>
            </div>

            {/* Professional Signature Section */}
            <div className="full-a4-signatures-wrap">
                <div className="full-a4-sig-col left">
                    <span className="full-a4-sig-heading">Buyer's Signature</span>
                    <div className="full-a4-sig-space" />
                    <div className="full-a4-sig-line" />
                    <span className="full-a4-sig-role">Customer / Buyer</span>
                </div>
                <div className="full-a4-sig-col right">
                    <span className="full-a4-sig-for-shop">For {effectiveShop?.name || 'ShopPulse Business'}</span>
                    <div className="full-a4-sig-space" />
                    <div className="full-a4-sig-line" />
                    <span className="full-a4-sig-role auth">Authorized Signatory</span>
                </div>
            </div>

            {/* Page Footer */}
            <div className="full-a4-footer">
                <div className="full-a4-footer-line" />
                <div className="full-a4-footer-content">
                    <span>Thank you for your business!</span>
                    <span className="brand-credit">Generated by ShopPulse Retail Platform — Full A4 Sheet</span>
                </div>
            </div>
        </div>
    );
};

/**
 * --------------------------------------------------------------------------
 * 3. Thermal 58 mm Receipt Component (Narrow roll)
 * --------------------------------------------------------------------------
 */
export const Thermal58Receipt = ({
    bill,
    shop,
    type = 'SALE',
    products = []
}) => {
    if (!bill) return null;

    const effectiveShop = {
        ...(shop || {}),
        ...((bill.shop && typeof bill.shop === 'object') ? bill.shop : {})
    };
    if ((!effectiveShop.fertilizerLicenses || effectiveShop.fertilizerLicenses.length === 0) && shop?.fertilizerLicenses) {
        effectiveShop.fertilizerLicenses = shop.fertilizerLicenses;
    }
    if (!effectiveShop.type && shop?.type) {
        effectiveShop.type = shop.type;
    }
    const fertilizerLicText = formatFertilizerLicensesText(effectiveShop);
    const invoiceNum = bill.invoiceNumber || (bill._id ? bill._id.slice(-6).toUpperCase() : 'N/A');
    const billDate = bill.date ? new Date(bill.date) : new Date();
    const dateFormatted = billDate.toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: '2-digit' });
    const timeFormatted = billDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const partyName = type === 'PURCHASE' ? (bill.supplierName || 'Supplier') : (bill.customerName || 'Walk-in');
    const partyPhone = type === 'PURCHASE' ? bill.supplierPhone : (bill.customerMobile || bill.customerPhone);

    const taxDetails = resolveBillTaxDetails(bill, type, effectiveShop, products);
    const {
        isGovBill,
        isTaxableInvoice,
        hasIgst,
        subtotal,
        discount,
        taxableAmount,
        totalGst,
        cgstTotal,
        sgstTotal,
        igstTotal,
        grandTotal,
        items: displayItems = []
    } = taxDetails;

    return (
        <div className="thermal-receipt-58">
            {/* Store Header */}
            <div className="tr-header">
                <h3 className="tr-shop-name">{effectiveShop?.name || 'ShopPulse Business'}</h3>
                {effectiveShop?.location && <div className="tr-shop-line">{effectiveShop.location}</div>}
                {effectiveShop?.contactNumber && <div className="tr-shop-line">Ph: {effectiveShop.contactNumber}</div>}
                {effectiveShop?.gstNumber && <div className="tr-shop-line">GSTIN: {effectiveShop.gstNumber}</div>}
                {fertilizerLicText && (
                    <div className="tr-shop-line tr-shop-licenses">
                        {fertilizerLicText}
                    </div>
                )}
            </div>

            <div className="tr-dashed-divider" />

            {/* Bill Meta */}
            <div className="tr-meta">
                <div className="tr-meta-row">
                    <span>BILL: #{invoiceNum}</span>
                    <span>{(bill.paymentMethod || 'CASH').toUpperCase()}</span>
                </div>
                <div className="tr-meta-row">
                    <span>DATE: {dateFormatted}</span>
                    <span>{timeFormatted}</span>
                </div>
                {partyName && partyName !== 'Walk-in Customer' && partyName !== 'Walk-in' && (
                    <div className="tr-meta-row">
                        <span>CUST: {partyName}</span>
                    </div>
                )}
                {partyPhone && (
                    <div className="tr-meta-row">
                        <span>MOB: {partyPhone}</span>
                    </div>
                )}
                {isGovBill && (
                    <div className="tr-badge-gov">GST SALE</div>
                )}
            </div>

            <div className="tr-dashed-divider" />

            {/* Items List (Narrow stacked) */}
            <div className="tr-items-list-58">
                <div className="tr-items-head-58">
                    <span>ITEM</span>
                    <span>TOTAL</span>
                </div>
                <div className="tr-dashed-divider light" />

                {displayItems.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '6px 0', fontSize: '11px' }}>No items</div>
                ) : (
                    displayItems.map((item, idx) => (
                        <div key={idx} className="tr-item-block-58">
                            <div className="tr-item-name-58">
                                {idx + 1}. {item.productName || 'Item'}
                            </div>
                            <div className="tr-item-calc-row">
                                <span className="tr-calc-left">
                                    {item.qty} {item.unit} @ {fmt(item.appliedRate)}
                                </span>
                                <span className="tr-calc-right">{fmt(item.lineTotal)}</span>
                            </div>
                            {item.isTaxable && item.gstRate > 0 && (
                                <div className="tr-item-tax-note">
                                    GST {item.gstRate}%: {fmt(item.gstAmount)}
                                </div>
                            )}
                        </div>
                    ))
                )}
            </div>

            <div className="tr-dashed-divider" />

            {/* Financial Summary */}
            <div className="tr-summary-58">
                <div className="tr-sum-row">
                    <span>Subtotal:</span>
                    <span>{fmt(subtotal)}</span>
                </div>
                {discount > 0 && (
                    <div className="tr-sum-row">
                        <span>Discount:</span>
                        <span>- {fmt(discount)}</span>
                    </div>
                )}
                {isTaxableInvoice && (
                    <>
                        <div className="tr-sum-row">
                            <span>Taxable:</span>
                            <span>{fmt(taxableAmount)}</span>
                        </div>
                        {hasIgst ? (
                            <div className="tr-sum-row">
                                <span>IGST:</span>
                                <span>{fmt(igstTotal)}</span>
                            </div>
                        ) : (
                            <>
                                <div className="tr-sum-row">
                                    <span>CGST:</span>
                                    <span>{fmt(cgstTotal)}</span>
                                </div>
                                <div className="tr-sum-row">
                                    <span>SGST:</span>
                                    <span>{fmt(sgstTotal)}</span>
                                </div>
                            </>
                        )}
                        <div className="tr-sum-row bold">
                            <span>Total GST:</span>
                            <span>{fmt(totalGst)}</span>
                        </div>
                    </>
                )}
                <div className="tr-dashed-divider light" />
                <div className="tr-grand-total-58">
                    <span>TOTAL:</span>
                    <span>{fmt(grandTotal)}</span>
                </div>
            </div>

            <div className="tr-dashed-divider" />

            {/* Footer */}
            <div className="tr-footer">
                <div className="tr-thankyou">Thank You! Visit Again</div>
                <div className="tr-credit">ShopPulse POS • 58mm Thermal</div>
            </div>
        </div>
    );
};

/**
 * --------------------------------------------------------------------------
 * 4. Thermal 80 mm Receipt Component (Standard 3-inch roll)
 * --------------------------------------------------------------------------
 */
export const Thermal80Receipt = ({
    bill,
    shop,
    type = 'SALE',
    products = []
}) => {
    if (!bill) return null;

    const effectiveShop = {
        ...(shop || {}),
        ...((bill.shop && typeof bill.shop === 'object') ? bill.shop : {})
    };
    if ((!effectiveShop.fertilizerLicenses || effectiveShop.fertilizerLicenses.length === 0) && shop?.fertilizerLicenses) {
        effectiveShop.fertilizerLicenses = shop.fertilizerLicenses;
    }
    if (!effectiveShop.type && shop?.type) {
        effectiveShop.type = shop.type;
    }
    const fertilizerLicText = formatFertilizerLicensesText(effectiveShop);
    const invoiceNum = bill.invoiceNumber || (bill._id ? bill._id.slice(-6).toUpperCase() : 'N/A');
    const billDate = bill.date ? new Date(bill.date) : new Date();
    const dateFormatted = billDate.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    const timeFormatted = billDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const partyName = type === 'PURCHASE' ? (bill.supplierName || 'Supplier') : (bill.customerName || 'Walk-in Customer');
    const partyPhone = type === 'PURCHASE' ? bill.supplierPhone : (bill.customerMobile || bill.customerPhone);

    const taxDetails = resolveBillTaxDetails(bill, type, effectiveShop, products);
    const {
        isGovBill,
        isTaxableInvoice,
        hasIgst,
        subtotal,
        discount,
        taxableAmount,
        totalGst,
        cgstTotal,
        sgstTotal,
        igstTotal,
        grandTotal,
        items: displayItems = []
    } = taxDetails;

    return (
        <div className="thermal-receipt-80">
            {/* Header Section */}
            <div className="tr-header">
                <h3 className="tr-shop-name-80">{effectiveShop?.name || 'ShopPulse Business'}</h3>
                {effectiveShop?.location && <div className="tr-shop-line-80">{effectiveShop.location}</div>}
                <div className="tr-shop-line-80">
                    Ph: {effectiveShop?.contactNumber || 'XXXXXXXXXX'}
                    {effectiveShop?.gstNumber && ` | GSTIN: ${effectiveShop.gstNumber}`}
                </div>
                {fertilizerLicText && (
                    <div className="tr-shop-line-80 tr-shop-licenses-80">
                        {fertilizerLicText}
                    </div>
                )}
            </div>

            <div className="tr-dashed-divider" />

            {/* Meta Grid */}
            <div className="tr-meta-grid-80">
                <div className="tr-mg-col">
                    <div><strong>Bill #:</strong> {invoiceNum}</div>
                    <div><strong>Date:</strong> {dateFormatted}</div>
                    <div><strong>Time:</strong> {timeFormatted}</div>
                </div>
                <div className="tr-mg-col right">
                    <div><strong>Pay:</strong> {(bill.paymentMethod || 'CASH').toUpperCase()}</div>
                    {partyName && <div><strong>Cust:</strong> {partyName}</div>}
                    {partyPhone && <div><strong>Ph:</strong> {partyPhone}</div>}
                </div>
            </div>

            {isGovBill && (
                <div className="tr-badge-gov-80">
                    *** GST REGISTERED SALE ***
                </div>
            )}

            <div className="tr-dashed-divider" />

            {/* Columnar Items Table */}
            <table className="tr-table-80">
                <thead>
                    <tr>
                        <th style={{ textAlign: 'left' }}>Item</th>
                        <th style={{ width: '38px', textAlign: 'center' }}>Qty</th>
                        <th style={{ width: '56px', textAlign: 'right' }}>Rate</th>
                        {isTaxableInvoice && <th style={{ width: '45px', textAlign: 'right' }}>GST</th>}
                        <th style={{ width: '64px', textAlign: 'right' }}>Total</th>
                    </tr>
                </thead>
                <tbody>
                    {displayItems.length === 0 ? (
                        <tr>
                            <td colSpan={isTaxableInvoice ? 5 : 4} style={{ textAlign: 'center', padding: '8px' }}>
                                No item records found
                            </td>
                        </tr>
                    ) : (
                        displayItems.map((item, idx) => (
                            <tr key={idx}>
                                <td className="tr-td-item">
                                    <div className="tr-pname">{item.productName || 'Item'}</div>
                                    {item.isTaxable && item.gstRate > 0 && (
                                        <span className="tr-ptax">GST {item.gstRate}%</span>
                                    )}
                                </td>
                                <td style={{ textAlign: 'center' }}>{item.qty}</td>
                                <td style={{ textAlign: 'right' }}>{fmt(item.appliedRate)}</td>
                                {isTaxableInvoice && (
                                    <td style={{ textAlign: 'right', color: '#1e6bff' }}>
                                        {item.isTaxable && item.gstRate > 0 ? fmt(item.gstAmount) : '0'}
                                    </td>
                                )}
                                <td style={{ textAlign: 'right', fontWeight: 700 }}>{fmt(item.lineTotal)}</td>
                            </tr>
                        ))
                    )}
                </tbody>
            </table>

            <div className="tr-dashed-divider" />

            {/* Financial Summary */}
            <div className="tr-summary-80">
                <div className="tr-sum-row-80">
                    <span>Subtotal:</span>
                    <span>{fmt(subtotal)}</span>
                </div>
                {discount > 0 && (
                    <div className="tr-sum-row-80 disc">
                        <span>Discount:</span>
                        <span>- {fmt(discount)}</span>
                    </div>
                )}
                {isTaxableInvoice && (
                    <>
                        <div className="tr-sum-row-80">
                            <span>Taxable Value:</span>
                            <span>{fmt(taxableAmount)}</span>
                        </div>
                        {hasIgst ? (
                            <div className="tr-sum-row-80">
                                <span>IGST:</span>
                                <span>{fmt(igstTotal)}</span>
                            </div>
                        ) : (
                            <>
                                <div className="tr-sum-row-80">
                                    <span>CGST:</span>
                                    <span>{fmt(cgstTotal)}</span>
                                </div>
                                <div className="tr-sum-row-80">
                                    <span>SGST:</span>
                                    <span>{fmt(sgstTotal)}</span>
                                </div>
                            </>
                        )}
                        <div className="tr-sum-row-80 bold">
                            <span>Total GST:</span>
                            <span>{fmt(totalGst)}</span>
                        </div>
                    </>
                )}
                <div className="tr-dashed-divider light" />
                <div className="tr-grand-total-80">
                    <span>GRAND TOTAL:</span>
                    <span>{fmt(grandTotal)}</span>
                </div>
            </div>

            <div className="tr-dashed-divider" />

            {/* Footer */}
            <div className="tr-footer">
                <div className="tr-thankyou">Thank You For Your Business!</div>
                <div className="tr-credit">ShopPulse POS • 80mm Thermal Receipt</div>
            </div>
        </div>
    );
};

/**
 * --------------------------------------------------------------------------
 * Master BillPrintSheet / CompactInvoiceSheet Component
 * Supports all 4 formats: 'full_a4', 'half_a4', 'thermal_58', 'thermal_80'
 * --------------------------------------------------------------------------
 */
export const CompactInvoiceSheet = ({
    bill1,
    bill2,
    shop,
    products = [],
    availableBills = [],
    onSelectSecondBill,
    onRemoveSecondBill,
    format, // optional override
}) => {
    // Determine active print format (falls back to shop preference, then full_a4)
    const activeFormat = format || shop?.defaultPrintFormat || 'full_a4';

    // Apply dynamic print styles whenever format or bill2 changes
    useEffect(() => {
        applyPrintPageStyles(activeFormat, { hasSecondBill: Boolean(bill2) });
    }, [activeFormat, bill2]);

    // Format 1: Full A4
    if (activeFormat === 'full_a4') {
        return (
            <div className="a4-sheet-wrapper format-full_a4">
                <FullA4Invoice 
                    bill={bill1} 
                    shop={shop} 
                    type={bill1?.type || 'SALE'} 
                    products={products} 
                />
            </div>
        );
    }

    // Format 3: Thermal 58 mm
    if (activeFormat === 'thermal_58') {
        return (
            <div className="thermal-wrapper format-thermal_58">
                <Thermal58Receipt 
                    bill={bill1} 
                    shop={shop} 
                    type={bill1?.type || 'SALE'} 
                    products={products} 
                />
            </div>
        );
    }

    // Format 4: Thermal 80 mm
    if (activeFormat === 'thermal_80') {
        return (
            <div className="thermal-wrapper format-thermal_80">
                <Thermal80Receipt 
                    bill={bill1} 
                    shop={shop} 
                    type={bill1?.type || 'SALE'} 
                    products={products} 
                />
            </div>
        );
    }

    // Format 2: Half A4 (default fallback)
    // If bill2 is provided: render 2 bills on one A4 sheet with cutting line
    if (bill2) {
        return (
            <div className="a4-sheet-wrapper format-half_a4 paired-bills">
                <div className="a4-print-sheet">
                    {/* Slot 1: Primary Bill */}
                    <div className="half-a4-slot slot-top">
                        <CompactInvoiceSlot 
                            bill={bill1} 
                            shop={shop} 
                            type={bill1?.type || 'SALE'} 
                            products={products}
                            slotNumber={1}
                            isSingleHalf={false}
                        />
                    </div>

                    {/* Middle Cut Line Divider */}
                    <div className="half-a4-cut-divider">
                        <Scissors size={14} className="cis-scissors-icon" />
                        <span className="cis-cut-line"></span>
                        <span className="cis-cut-label">Cut Along This Line (Half-A4)</span>
                        <span className="cis-cut-line"></span>
                        <Scissors size={14} className="cis-scissors-icon right" />
                    </div>

                    {/* Slot 2: Secondary Paired Bill */}
                    <div className="half-a4-slot slot-bottom">
                        <CompactInvoiceSlot 
                            bill={bill2} 
                            shop={shop} 
                            type={bill2?.type || 'SALE'} 
                            products={products}
                            slotNumber={2}
                            onRemove={onRemoveSecondBill}
                            isSingleHalf={false}
                        />
                    </div>
                </div>
            </div>
        );
    }

    // Single Half A4 Bill: genuine Half A4 invoice without blank second half slot
    return (
        <div className="a4-sheet-wrapper format-half_a4 single-bill">
            {availableBills && availableBills.length > 0 && onSelectSecondBill && (
                <div className="cis-pair-toolbar no-print">
                    <div className="cis-pt-left">
                        <Sparkles size={14} className="cis-pt-icon" />
                        <span className="cis-pt-text">Optional 2-on-1 Eco Saver: Pair another bill to print 2 bills on a single A4 sheet</span>
                    </div>
                    <select 
                        className="cis-pt-select"
                        defaultValue=""
                        onChange={(e) => {
                            if (e.target.value) {
                                const found = availableBills.find(b => b._id === e.target.value);
                                if (found) onSelectSecondBill(found);
                            }
                        }}
                    >
                        <option value="">+ Pair Another Bill (2-on-1 A4 Sheet)...</option>
                        {availableBills
                            .filter(b => b._id !== bill1?._id)
                            .slice(0, 25)
                            .map(b => (
                                <option key={b._id} value={b._id}>
                                    #{b.invoiceNumber || b._id.slice(-6).toUpperCase()} — {b.customerName || 'Walk-in'} ({fmt(b.totalAmount)})
                                </option>
                            ))
                        }
                    </select>
                </div>
            )}

            <div className="half-a4-single-sheet">
                <CompactInvoiceSlot 
                    bill={bill1} 
                    shop={shop} 
                    type={bill1?.type || 'SALE'} 
                    products={products}
                    slotNumber={1}
                    isSingleHalf={true}
                />
            </div>
        </div>
    );
};

export default CompactInvoiceSheet;
