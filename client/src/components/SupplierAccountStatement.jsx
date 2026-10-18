import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    Printer, 
    Download, 
    X, 
    Calendar, 
    IndianRupee, 
    FileText, 
    TrendingUp, 
    CheckCircle2, 
    AlertCircle, 
    RefreshCw, 
    ArrowRight,
    Building2,
    Phone,
    FileSpreadsheet,
    ShieldCheck
} from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { purchaseService } from '../services/api';

/**
 * Supplier Account Statement Component
 * Two-Column Ledger matching standard Indian accounting / CA format
 * Supports Modal & Embedded Tab display, Print, PDF export, and Date Range filters
 */
export const SupplierAccountStatement = ({ 
    shopId, 
    supplierName, 
    shop, 
    isOpen = true, 
    onClose, 
    embedded = false 
}) => {
    const [loading, setLoading] = useState(true);
    const [statement, setStatement] = useState(null);
    const [period, setPeriod] = useState('this_financial_year'); // 'today' | 'this_month' | 'this_financial_year' | 'custom' | 'all'
    const [customStartDate, setCustomStartDate] = useState('');
    const [customEndDate, setCustomEndDate] = useState('');
    const [showCustomPicker, setShowCustomPicker] = useState(false);
    const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
    const [error, setError] = useState(null);

    const statementRef = useRef(null);

    // Fetch Statement Data from Backend
    const fetchStatement = async (filterPeriod = period, sDate = customStartDate, eDate = customEndDate) => {
        if (!shopId || !supplierName) return;
        try {
            setLoading(true);
            setError(null);
            const params = {
                shop: shopId,
                supplierName: supplierName.trim(),
                period: filterPeriod
            };
            if (filterPeriod === 'custom' && (sDate || eDate)) {
                if (sDate) params.startDate = sDate;
                if (eDate) params.endDate = eDate;
            }

            const res = await purchaseService.getSupplierStatement(params);
            if (res.data?.success) {
                setStatement(res.data.data);
            } else {
                setError(res.data?.message || 'Failed to load supplier statement');
            }
        } catch (err) {
            console.error('Error fetching supplier statement:', err);
            setError(err.response?.data?.message || err.message || 'Unable to load supplier ledger');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchStatement(period);
    }, [shopId, supplierName, period]);

    const handlePeriodChange = (newPeriod) => {
        setPeriod(newPeriod);
        if (newPeriod === 'custom') {
            setShowCustomPicker(true);
        } else {
            setShowCustomPicker(false);
            fetchStatement(newPeriod);
        }
    };

    const handleApplyCustomDate = (e) => {
        e?.preventDefault();
        if (!customStartDate && !customEndDate) return;
        fetchStatement('custom', customStartDate, customEndDate);
    };

    // Formatters
    const formatINR = (val) => {
        const num = Number(val) || 0;
        return `₹${num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    };

    const formatDateStr = (d) => {
        if (!d) return '-';
        const dateObj = new Date(d);
        if (isNaN(dateObj.getTime())) return '-';
        return dateObj.toLocaleDateString('en-IN', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        });
    };

    // Prepare Aligned Rows for Two-Column Ledger
    const { alignedRows, maxCount } = useMemo(() => {
        if (!statement) return { alignedRows: [], maxCount: 0 };
        const credits = statement.credits || [];
        const debits = statement.debits || [];
        const count = Math.max(credits.length, debits.length);
        const rows = [];
        for (let i = 0; i < count; i++) {
            rows.push({
                credit: credits[i] || null,
                debit: debits[i] || null,
                index: i + 1
            });
        }
        return { alignedRows: rows, maxCount: count };
    }, [statement]);

    // Native Browser Print
    const handlePrint = () => {
        window.print();
    };

    // Download PDF via jsPDF & autoTable
    const handleDownloadPDF = async () => {
        if (!statement) return;
        try {
            setIsGeneratingPdf(true);

            // Create A4 Landscape PDF for optimal side-by-side two-column ledger readability
            const doc = new jsPDF({
                orientation: 'landscape',
                unit: 'mm',
                format: 'a4'
            });

            const pageWidth = doc.internal.pageSize.getWidth(); // 297mm
            const pageHeight = doc.internal.pageSize.getHeight(); // 210mm
            const margin = 12;
            const contentWidth = pageWidth - (margin * 2); // 273mm

            // Color Palette
            const primaryNavy = [15, 23, 42];     // #0F172A
            const brandBlue = [37, 99, 235];       // #2563EB
            const creditGreen = [5, 150, 105];     // #059669
            const debitAmber = [180, 83, 9];       // #B45309
            const darkText = [30, 41, 59];         // #1E293B
            const mutedGray = [100, 116, 139];     // #64748B
            const borderGray = [226, 232, 240];    // #E2E8F0
            const lightBg = [248, 250, 252];       // #F8FAFC

            let currentY = margin;

            // 1. Accent Top Ribbon
            doc.setFillColor(...brandBlue);
            doc.rect(margin, currentY, contentWidth, 2, 'F');
            currentY += 6;

            // 2. Header Section
            // Left: Shop Name & Details
            const shopName = statement.shop?.name || shop?.name || 'ShopPulse Business';
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(14);
            doc.setTextColor(...primaryNavy);
            doc.text(shopName, margin, currentY + 3);

            let shopSubY = currentY + 7.5;
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(8);
            doc.setTextColor(...mutedGray);

            const shopDetails = [];
            if (statement.shop?.location) shopDetails.push(statement.shop.location);
            if (statement.shop?.contactNumber) shopDetails.push(`Phone: ${statement.shop.contactNumber}`);
            if (statement.shop?.gstNumber) shopDetails.push(`GSTIN: ${statement.shop.gstNumber}`);
            
            if (shopDetails.length > 0) {
                doc.text(shopDetails.join('  •  '), margin, shopSubY);
            }

            // Right: Statement Title & Generation Date
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(13);
            doc.setTextColor(...brandBlue);
            doc.text('ACCOUNT STATEMENT', pageWidth - margin, currentY + 3, { align: 'right' });

            doc.setFont('helvetica', 'normal');
            doc.setFontSize(8);
            doc.setTextColor(...mutedGray);
            const genDateStr = `Generated on: ${new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })} ${new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}`;
            doc.text(genDateStr, pageWidth - margin, shopSubY, { align: 'right' });

            currentY = shopSubY + 6;

            // Divider Line
            doc.setDrawColor(...borderGray);
            doc.setLineWidth(0.4);
            doc.line(margin, currentY, pageWidth - margin, currentY);
            currentY += 4;

            // 3. Parties & Period Box
            doc.setFillColor(...lightBg);
            doc.roundedRect(margin, currentY, contentWidth, 14, 2, 2, 'F');
            doc.setDrawColor(...borderGray);
            doc.roundedRect(margin, currentY, contentWidth, 14, 2, 2, 'S');

            // Supplier Info (Left)
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(7.5);
            doc.setTextColor(...mutedGray);
            doc.text('STATEMENT FOR (SUPPLIER):', margin + 4, currentY + 4.5);

            doc.setFont('helvetica', 'bold');
            doc.setFontSize(10);
            doc.setTextColor(...primaryNavy);
            doc.text(statement.supplier?.name || supplierName, margin + 4, currentY + 9.5);

            if (statement.supplier?.phone) {
                doc.setFont('helvetica', 'normal');
                doc.setFontSize(8);
                doc.setTextColor(...mutedGray);
                doc.text(`Contact: ${statement.supplier.phone}`, margin + 80, currentY + 9.5);
            }

            // Statement Period (Right)
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(7.5);
            doc.setTextColor(...mutedGray);
            doc.text('STATEMENT PERIOD:', pageWidth - margin - 80, currentY + 4.5);

            doc.setFont('helvetica', 'bold');
            doc.setFontSize(9);
            doc.setTextColor(...brandBlue);
            doc.text(statement.period?.label || 'All Time', pageWidth - margin - 80, currentY + 9.5);

            currentY += 18;

            // 4. Financial KPI Summary Cards (4 Cards side by side)
            const cardWidth = (contentWidth - (3 * 4)) / 4;
            const cardHeight = 13.5;

            const summary = statement.summary || {};
            const kpiCards = [
                {
                    label: 'OPENING BALANCE',
                    val: `Rs. ${Math.abs(summary.openingBalance || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`,
                    sub: summary.openingBalance > 0 ? 'Payable (Cr)' : summary.openingBalance < 0 ? 'Advance (Dr)' : 'Nil Balance',
                    color: summary.openingBalance > 0 ? [180, 83, 9] : [71, 85, 105],
                    bg: [255, 251, 235]
                },
                {
                    label: 'TOTAL DEBITS (PURCHASES)',
                    val: `Rs. ${(summary.totalDebits || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`,
                    sub: `${statement.debits?.length || 0} Bills Logged`,
                    color: brandBlue,
                    bg: [239, 246, 255]
                },
                {
                    label: 'TOTAL CREDITS (PAYMENTS)',
                    val: `Rs. ${(summary.totalCredits || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`,
                    sub: `${statement.credits?.length || 0} Payments Made`,
                    color: creditGreen,
                    bg: [236, 253, 245]
                },
                {
                    label: 'CLOSING BALANCE',
                    val: `Rs. ${Math.abs(summary.closingBalance || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`,
                    sub: summary.balanceStatusLabel || 'Settled',
                    color: summary.closingBalance > 0 ? [180, 83, 9] : summary.closingBalance < 0 ? creditGreen : [71, 85, 105],
                    bg: summary.closingBalance > 0 ? [254, 243, 199] : [241, 245, 249]
                }
            ];

            kpiCards.forEach((card, idx) => {
                const cardX = margin + (idx * (cardWidth + 4));
                doc.setFillColor(...card.bg);
                doc.roundedRect(cardX, currentY, cardWidth, cardHeight, 1.5, 1.5, 'F');
                doc.setDrawColor(...borderGray);
                doc.roundedRect(cardX, currentY, cardWidth, cardHeight, 1.5, 1.5, 'S');

                doc.setFont('helvetica', 'bold');
                doc.setFontSize(6.5);
                doc.setTextColor(...mutedGray);
                doc.text(card.label, cardX + 3, currentY + 3.8);

                doc.setFont('helvetica', 'bold');
                doc.setFontSize(8.5);
                doc.setTextColor(...card.color);
                doc.text(card.val, cardX + 3, currentY + 8.2);

                doc.setFont('helvetica', 'normal');
                doc.setFontSize(6.5);
                doc.setTextColor(...darkText);
                doc.text(card.sub, cardX + 3, currentY + 11.5);
            });

            currentY += cardHeight + 4;

            // 5. Two-Column Ledger Table via autoTable
            // Table structure (A4 Landscape 273mm content width):
            // Credit Side (Payments): Date (18mm), Mode (24mm), Remark (66.5mm), Amount Cr (28mm) = 136.5mm
            // Debit Side (Purchases): Date (18mm), Bill # & Particulars (90.5mm), Amount Dr (28mm) = 136.5mm
            // Total = 18 + 24 + 66.5 + 28 + 18 + 90.5 + 28 = 273mm (matches contentWidth exactly!)

            const tableRows = alignedRows.map(row => {
                const c = row.credit;
                const d = row.debit;

                // Credit Particulars
                const cDate = c ? formatDateStr(c.date) : '';
                const cMode = c ? (c.paymentMethod || 'Cash') : '';
                const cRemark = c ? (c.remark ? c.remark : '—') : '';
                const cAmount = c ? `Rs. ${Number(c.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '';

                // Debit Particulars String
                let dParticulars = '-';
                if (d) {
                    const parts = [];
                    if (d.billNo && d.billNo !== '-') parts.push(`Bill #${d.billNo}`);
                    if (d.category) parts.push(`Cat: ${d.category}`);
                    if (d.description) parts.push(d.description);
                    if (d.notes) parts.push(d.notes);
                    dParticulars = parts.join(' | ') || 'Stock Purchase';
                }

                return [
                    cDate,
                    cMode,
                    cRemark,
                    cAmount,
                    d ? formatDateStr(d.date) : '',
                    d ? dParticulars : '',
                    d ? `Rs. ${Number(d.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : ''
                ];
            });

            // If empty
            if (tableRows.length === 0) {
                tableRows.push(['-', '-', 'No payment entries in this period', '-', '-', 'No purchase bills in this period', '-']);
            }

            // Subtotals Row
            const subtotalRow = [
                'SUBTOTAL',
                '',
                'Total Payments (Credits)',
                `Rs. ${(summary.totalCredits || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`,
                'SUBTOTAL',
                'Total Purchases (Debits)',
                `Rs. ${(summary.totalDebits || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`
            ];

            autoTable(doc, {
                startY: currentY,
                margin: { left: margin, right: margin, top: margin + 5, bottom: margin + 10 },
                head: [
                    [
                        { content: 'CREDIT PARTICULARS — PAYMENTS', colSpan: 4, styles: { halign: 'center', fillColor: creditGreen, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8.5 } },
                        { content: 'DEBIT PARTICULARS — PURCHASES', colSpan: 3, styles: { halign: 'center', fillColor: brandBlue, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8.5 } }
                    ],
                    [
                        'Date', 'Mode', 'Remark', 'Amount (Cr)',
                        'Date', 'Bill # & Particulars', 'Amount (Dr)'
                    ]
                ],
                body: [...tableRows, subtotalRow],
                theme: 'grid',
                headStyles: {
                    fillColor: primaryNavy,
                    textColor: [255, 255, 255],
                    fontSize: 7.5,
                    fontStyle: 'bold',
                    cellPadding: 2,
                    halign: 'left'
                },
                styles: {
                    fontSize: 7,
                    textColor: darkText,
                    cellPadding: 2,
                    valign: 'middle',
                    overflow: 'linebreak',
                    lineColor: borderGray,
                    lineWidth: 0.2
                },
                columnStyles: {
                    0: { cellWidth: 18, halign: 'center' },
                    1: { cellWidth: 24, halign: 'center' },
                    2: { cellWidth: 66.5, overflow: 'linebreak' },
                    3: { cellWidth: 28, halign: 'right', fontStyle: 'bold', textColor: creditGreen },
                    4: { cellWidth: 18, halign: 'center' },
                    5: { cellWidth: 90.5, overflow: 'linebreak' },
                    6: { cellWidth: 28, halign: 'right', fontStyle: 'bold', textColor: darkText }
                },
                didParseCell: (data) => {
                    // Check if this is the subtotal row (last row of body)
                    if (data.section === 'body' && data.row.index === tableRows.length) {
                        data.cell.styles.fillColor = [241, 245, 249];
                        data.cell.styles.fontStyle = 'bold';
                        data.cell.styles.fontSize = 7.5;
                        if (data.column.index === 3) {
                            data.cell.styles.textColor = creditGreen;
                        }
                        if (data.column.index === 6) {
                            data.cell.styles.textColor = brandBlue;
                        }
                    }
                },
                didDrawPage: (data) => {
                    // Footer with Page Number
                    const totalPages = doc.internal.getNumberOfPages();
                    const pageNum = data.pageNumber;

                    doc.setFontSize(7);
                    doc.setFont('helvetica', 'normal');
                    doc.setTextColor(...mutedGray);
                    doc.text(
                        `ShopPulse Supplier Ledger Statement  •  ${statement.supplier?.name}  •  Page ${pageNum} of ${totalPages}`,
                        pageWidth / 2,
                        pageHeight - 6,
                        { align: 'center' }
                    );

                    doc.text(
                        'This is a computer-generated account statement.',
                        margin,
                        pageHeight - 6
                    );
                }
            });

            // 6. Reconciliation Summary at Bottom of Statement
            let finalY = doc.lastAutoTable.finalY + 4;
            if (finalY + 28 > pageHeight - margin) {
                doc.addPage();
                finalY = margin + 10;
            }

            doc.setFillColor(...lightBg);
            doc.roundedRect(margin, finalY, contentWidth, 22, 2, 2, 'F');
            doc.setDrawColor(...borderGray);
            doc.roundedRect(margin, finalY, contentWidth, 22, 2, 2, 'S');

            // Accounting equation breakdown
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(8);
            doc.setTextColor(...primaryNavy);
            doc.text('ACCOUNT RECONCILIATION SUMMARY:', margin + 4, finalY + 5);

            doc.setFont('helvetica', 'normal');
            doc.setFontSize(7.5);
            doc.setTextColor(...darkText);

            const opSign = summary.openingBalance >= 0 ? '+' : '-';
            const opText = `Opening Balance: Rs. ${Math.abs(summary.openingBalance || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })} (${summary.openingBalance >= 0 ? 'Cr Payable' : 'Dr Advance'})`;
            const debText = `+ Total Purchases (Debits): Rs. ${(summary.totalDebits || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
            const credText = `- Total Payments (Credits): Rs. ${(summary.totalCredits || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
            const clText = `= Closing Balance: Rs. ${Math.abs(summary.closingBalance || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;

            doc.text(`${opText}    ${debText}    ${credText}`, margin + 4, finalY + 10);
            
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(9);
            const statusColor = summary.closingBalance > 0 ? [180, 83, 9] : summary.closingBalance < 0 ? creditGreen : [71, 85, 105];
            doc.setTextColor(...statusColor);
            doc.text(`${clText}  [${summary.balanceStatusLabel?.toUpperCase() || 'SETTLED'}]`, margin + 4, finalY + 16.5);

            // Authorized Signatures Block on Right
            const sigX = pageWidth - margin - 60;
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(7);
            doc.setTextColor(...mutedGray);
            doc.text(`For ${shopName}`, sigX, finalY + 6);
            doc.line(sigX, finalY + 16, pageWidth - margin - 4, finalY + 16);
            doc.text('Authorized Signatory', sigX, finalY + 19.5);

            // Save PDF
            const safeSupplierName = (statement.supplier?.name || 'supplier').replace(/[^a-zA-Z0-9]/g, '_');
            const fileName = `Supplier_Statement_${safeSupplierName}_${new Date().toISOString().slice(0, 10)}.pdf`;
            doc.save(fileName);
        } catch (pdfErr) {
            console.error('Failed to generate statement PDF:', pdfErr);
            alert('Failed to generate PDF: ' + (pdfErr.message || 'Unknown error'));
        } finally {
            setIsGeneratingPdf(false);
        }
    };

    if (!isOpen && !embedded) return null;

    // Component Content
    const content = (
        <div 
            className="supplier-account-statement-container"
            style={{ 
                display: 'flex', 
                flexDirection: 'column', 
                gap: '16px', 
                width: '100%', 
                boxSizing: 'border-box' 
            }}
        >
            {/* Inline CSS for Screen & Print */}
            <style>{`
                .statement-toolbar {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    gap: 12px;
                    flex-wrap: wrap;
                    background: #FFFFFF;
                    border: 1px solid #E2E8F0;
                    border-radius: 14px;
                    padding: 12px 16px;
                }
                .statement-pills {
                    display: flex;
                    align-items: center;
                    gap: 6px;
                    flex-wrap: wrap;
                }
                .statement-pill {
                    border: 1px solid #E2E8F0;
                    background: #F8FAFC;
                    color: #475569;
                    font-size: 13px;
                    font-weight: 700;
                    padding: 6px 14px;
                    border-radius: 20px;
                    cursor: pointer;
                    transition: all 0.15s ease;
                }
                .statement-pill:hover {
                    background: #EDF2F7;
                    color: #0F172A;
                }
                .statement-pill.active {
                    background: #2563EB;
                    color: #FFFFFF;
                    border-color: #2563EB;
                    box-shadow: 0 2px 6px rgba(37, 99, 235, 0.25);
                }
                .statement-actions {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                }
                .statement-btn-action {
                    display: inline-flex;
                    align-items: center;
                    gap: 6px;
                    height: 38px;
                    padding: 0 14px;
                    border-radius: 10px;
                    font-size: 13px;
                    font-weight: 700;
                    cursor: pointer;
                    transition: all 0.15s ease;
                }
                .statement-btn-print {
                    background: #F1F5F9;
                    color: #1E293B;
                    border: 1px solid #CBD5E1;
                }
                .statement-btn-print:hover {
                    background: #E2E8F0;
                }
                .statement-btn-pdf {
                    background: #2563EB;
                    color: #FFFFFF;
                    border: none;
                    box-shadow: 0 2px 6px rgba(37, 99, 235, 0.25);
                }
                .statement-btn-pdf:hover {
                    background: #1D4ED8;
                }

                /* Printable Paper Sheet */
                .statement-paper {
                    background: #FFFFFF;
                    border: 1.5px solid #CBD5E1;
                    border-radius: 16px;
                    padding: 24px;
                    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.04);
                    box-sizing: border-box;
                    display: flex;
                    flex-direction: column;
                    gap: 20px;
                }

                /* Header Info */
                .st-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: flex-start;
                    border-bottom: 2px solid #E2E8F0;
                    padding-bottom: 16px;
                    gap: 16px;
                    flex-wrap: wrap;
                }
                .st-business-name {
                    font-size: 22px;
                    font-weight: 900;
                    color: #0F172A;
                    margin: 0;
                    letter-spacing: -0.01em;
                }
                .st-business-meta {
                    font-size: 12px;
                    color: #64748B;
                    margin-top: 4px;
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    flex-wrap: wrap;
                }
                .st-title-box {
                    text-align: right;
                }
                .st-doc-title {
                    font-size: 20px;
                    font-weight: 900;
                    color: #2563EB;
                    letter-spacing: 0.04em;
                    margin: 0;
                    text-transform: uppercase;
                }
                .st-doc-meta {
                    font-size: 12px;
                    color: #64748B;
                    margin-top: 4px;
                }

                /* Parties Details Box */
                .st-parties-grid {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 16px;
                    background: #F8FAFC;
                    border: 1px solid #E2E8F0;
                    border-radius: 12px;
                    padding: 14px 18px;
                }
                .st-party-title {
                    font-size: 11px;
                    font-weight: 800;
                    text-transform: uppercase;
                    color: #64748B;
                    letter-spacing: 0.05em;
                }
                .st-party-name {
                    font-size: 16px;
                    font-weight: 900;
                    color: #0F172A;
                    margin-top: 2px;
                }
                .st-party-contact {
                    font-size: 12px;
                    font-weight: 600;
                    color: #475569;
                    margin-top: 2px;
                }

                /* KPI Cards */
                .st-kpi-grid {
                    display: grid;
                    grid-template-columns: repeat(4, 1fr);
                    gap: 12px;
                }
                .st-kpi-card {
                    background: #FFFFFF;
                    border: 1px solid #E2E8F0;
                    border-radius: 12px;
                    padding: 12px 14px;
                    display: flex;
                    flex-direction: column;
                    justify-content: space-between;
                }
                .st-kpi-label {
                    font-size: 10.5px;
                    font-weight: 800;
                    text-transform: uppercase;
                    color: #64748B;
                    letter-spacing: 0.05em;
                }
                .st-kpi-val {
                    font-size: 19px;
                    font-weight: 900;
                    margin-top: 4px;
                    line-height: 1.2;
                }
                .st-kpi-sub {
                    font-size: 11px;
                    font-weight: 600;
                    color: #64748B;
                    margin-top: 4px;
                }

                /* Two Column Ledger Grid */
                .st-ledger-wrap {
                    width: 100%;
                    border: 1.5px solid #CBD5E1;
                    border-radius: 12px;
                    overflow: hidden;
                    background: #FFFFFF;
                }
                .st-ledger-table {
                    width: 100%;
                    border-collapse: collapse;
                    font-size: 12px;
                }
                .st-ledger-table th {
                    padding: 10px 12px;
                    font-size: 11px;
                    font-weight: 800;
                    text-transform: uppercase;
                    letter-spacing: 0.04em;
                    border-bottom: 2px solid #CBD5E1;
                }
                .st-th-group-credit {
                    background: #059669;
                    color: #FFFFFF;
                    text-align: center;
                    border-right: 2px solid #CBD5E1;
                }
                .st-th-group-debit {
                    background: #2563EB;
                    color: #FFFFFF;
                    text-align: center;
                }
                .st-th-sub {
                    background: #F1F5F9;
                    color: #334155;
                    font-size: 10.5px;
                }
                .st-ledger-table td {
                    padding: 10px 12px;
                    border-bottom: 1px solid #E2E8F0;
                    color: #1E293B;
                    vertical-align: top;
                }
                .st-col-divider {
                    border-right: 2px solid #CBD5E1 !important;
                }
                .st-row-empty {
                    color: #94A3B8;
                    font-style: italic;
                    text-align: center;
                }
                .st-subtotal-row {
                    background: #F8FAFC;
                    font-weight: 800;
                    border-top: 2px solid #CBD5E1;
                }

                /* Accounting Summary Footer */
                .st-reconciliation-box {
                    background: #F8FAFC;
                    border: 1.5px solid #CBD5E1;
                    border-radius: 12px;
                    padding: 16px 20px;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    gap: 16px;
                    flex-wrap: wrap;
                }
                .st-equation-line {
                    font-size: 13px;
                    font-weight: 700;
                    color: #334155;
                    line-height: 1.5;
                }
                .st-status-badge-lg {
                    display: inline-flex;
                    align-items: center;
                    gap: 6px;
                    padding: 6px 14px;
                    border-radius: 20px;
                    font-size: 13px;
                    font-weight: 900;
                    text-transform: uppercase;
                    letter-spacing: 0.04em;
                }

                /* Print Media Styles */
                @media print {
                    @page {
                        size: A4 portrait;
                        margin: 10mm;
                    }
                    body * {
                        visibility: hidden;
                    }
                    .supplier-account-statement-container,
                    .supplier-account-statement-container * {
                        visibility: visible;
                    }
                    .supplier-account-statement-container {
                        position: absolute;
                        left: 0;
                        top: 0;
                        width: 100% !important;
                        padding: 0 !important;
                        margin: 0 !important;
                    }
                    .statement-toolbar {
                        display: none !important;
                    }
                    .statement-paper {
                        box-shadow: none !important;
                        border: 1px solid #94A3B8 !important;
                        padding: 12px !important;
                    }
                    .no-print {
                        display: none !important;
                    }
                }

                @media (max-width: 900px) {
                    .st-kpi-grid {
                        grid-template-columns: repeat(2, 1fr);
                    }
                }
                @media (max-width: 600px) {
                    .st-parties-grid {
                        grid-template-columns: 1fr;
                    }
                    .st-kpi-grid {
                        grid-template-columns: 1fr;
                    }
                    .st-ledger-wrap {
                        overflow-x: auto;
                    }
                    .st-ledger-table {
                        min-width: 680px;
                    }
                }
            `}</style>

            {/* 1. Interactive Statement Toolbar (Filters & Export Actions) */}
            <div className="statement-toolbar no-print">
                <div className="statement-pills">
                    <button 
                        className={`statement-pill ${period === 'today' ? 'active' : ''}`}
                        onClick={() => handlePeriodChange('today')}
                    >
                        Today
                    </button>
                    <button 
                        className={`statement-pill ${period === 'this_month' ? 'active' : ''}`}
                        onClick={() => handlePeriodChange('this_month')}
                    >
                        This Month
                    </button>
                    <button 
                        className={`statement-pill ${period === 'this_financial_year' ? 'active' : ''}`}
                        onClick={() => handlePeriodChange('this_financial_year')}
                    >
                        This Financial Year
                    </button>
                    <button 
                        className={`statement-pill ${period === 'custom' ? 'active' : ''}`}
                        onClick={() => handlePeriodChange('custom')}
                    >
                        Custom Range
                    </button>
                    <button 
                        className={`statement-pill ${period === 'all' ? 'active' : ''}`}
                        onClick={() => handlePeriodChange('all')}
                    >
                        All Time
                    </button>
                </div>

                <div className="statement-actions">
                    <button 
                        className="statement-btn-action statement-btn-print"
                        onClick={handlePrint}
                        title="Print statement on A4 paper"
                    >
                        <Printer size={15} />
                        <span>Print</span>
                    </button>
                    <button 
                        className="statement-btn-action statement-btn-pdf"
                        onClick={handleDownloadPDF}
                        disabled={isGeneratingPdf || loading}
                        title="Download official statement PDF"
                    >
                        {isGeneratingPdf ? (
                            <RefreshCw size={15} className="spin" />
                        ) : (
                            <Download size={15} />
                        )}
                        <span>{isGeneratingPdf ? 'Generating...' : 'Download PDF'}</span>
                    </button>
                    {!embedded && onClose && (
                        <button 
                            onClick={onClose}
                            style={{ 
                                background: '#F1F5F9', 
                                border: 'none', 
                                width: '36px', 
                                height: '36px', 
                                borderRadius: '10px', 
                                cursor: 'pointer', 
                                display: 'flex', 
                                alignItems: 'center', 
                                justifyContent: 'center', 
                                color: '#475569' 
                            }}
                            title="Close Statement"
                        >
                            <X size={18} />
                        </button>
                    )}
                </div>
            </div>

            {/* Custom Date Range Picker Bar (if custom selected) */}
            {showCustomPicker && (
                <div 
                    className="no-print" 
                    style={{ 
                        background: '#EFF6FF', 
                        border: '1px solid #BFDBFE', 
                        borderRadius: '12px', 
                        padding: '12px 16px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        flexWrap: 'wrap'
                    }}
                >
                    <Calendar size={16} color="#2563EB" />
                    <span style={{ fontSize: '13px', fontWeight: '700', color: '#1E40AF' }}>Select Custom Period:</span>
                    <input 
                        type="date"
                        value={customStartDate}
                        onChange={(e) => setCustomStartDate(e.target.value)}
                        style={{ padding: '6px 10px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '13px', fontWeight: '600' }}
                    />
                    <span style={{ fontSize: '13px', fontWeight: '600', color: '#64748B' }}>to</span>
                    <input 
                        type="date"
                        value={customEndDate}
                        onChange={(e) => setCustomEndDate(e.target.value)}
                        style={{ padding: '6px 10px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '13px', fontWeight: '600' }}
                    />
                    <button 
                        onClick={handleApplyCustomDate}
                        style={{ 
                            background: '#2563EB', 
                            color: '#FFFFFF', 
                            border: 'none', 
                            padding: '6px 14px', 
                            borderRadius: '8px', 
                            fontSize: '13px', 
                            fontWeight: '700', 
                            cursor: 'pointer' 
                        }}
                    >
                        Apply Filter
                    </button>
                </div>
            )}

            {/* Error Message */}
            {error && (
                <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '12px', padding: '14px', color: '#DC2626', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', fontWeight: '600' }}>
                    <AlertCircle size={18} />
                    <span>{error}</span>
                </div>
            )}

            {/* Loading State */}
            {loading && (
                <div style={{ padding: '40px', textAlign: 'center', color: '#64748B' }}>
                    <RefreshCw size={28} className="spin" style={{ margin: '0 auto 12px' }} />
                    <div style={{ fontSize: '14px', fontWeight: '700' }}>Generating Account Statement...</div>
                    <div style={{ fontSize: '12px', color: '#94A3B8', marginTop: '4px' }}>Reconciling purchases, payments, and opening balances</div>
                </div>
            )}

            {/* 2. Printable Paper Sheet */}
            {!loading && statement && (
                <div className="statement-paper" ref={statementRef} id="supplier-statement-printable">
                    {/* Header */}
                    <div className="st-header">
                        <div>
                            <h2 className="st-business-name">{statement.shop?.name || shop?.name || 'ShopPulse Business'}</h2>
                            <div className="st-business-meta">
                                {statement.shop?.location && <span>{statement.shop.location}</span>}
                                {statement.shop?.contactNumber && <span>• Phone: {statement.shop.contactNumber}</span>}
                                {statement.shop?.gstNumber && <span>• GSTIN: {statement.shop.gstNumber}</span>}
                            </div>
                        </div>
                        <div className="st-title-box">
                            <h1 className="st-doc-title">Account Statement</h1>
                            <div className="st-doc-meta">
                                <span>Period: <strong>{statement.period?.label}</strong></span>
                            </div>
                        </div>
                    </div>

                    {/* Parties & Account Block */}
                    <div className="st-parties-grid">
                        <div>
                            <div className="st-party-title">Supplier / Creditor Account</div>
                            <div className="st-party-name">{statement.supplier?.name || supplierName}</div>
                            {statement.supplier?.phone && (
                                <div className="st-party-contact">
                                    <Phone size={11} style={{ display: 'inline', marginRight: '4px' }} />
                                    {statement.supplier.phone}
                                </div>
                            )}
                        </div>
                        <div style={{ textAlign: 'right' }}>
                            <div className="st-party-title">Ledger Summary Status</div>
                            <div style={{ marginTop: '4px' }}>
                                <span 
                                    className="st-status-badge-lg" 
                                    style={{
                                        background: statement.summary?.closingBalance > 0 ? '#FEF3C7' : statement.summary?.closingBalance < 0 ? '#ECFDF5' : '#F1F5F9',
                                        color: statement.summary?.closingBalance > 0 ? '#B45309' : statement.summary?.closingBalance < 0 ? '#059669' : '#475569',
                                        border: `1px solid ${statement.summary?.closingBalance > 0 ? '#FCD34D' : statement.summary?.closingBalance < 0 ? '#A7F3D0' : '#E2E8F0'}`
                                    }}
                                >
                                    {statement.summary?.balanceStatusLabel}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* 4 Financial KPI Summary Cards */}
                    <div className="st-kpi-grid">
                        {/* Opening Balance */}
                        <div className="st-kpi-card" style={{ borderTop: '3px solid #64748B' }}>
                            <span className="st-kpi-label">Opening Balance</span>
                            <div className="st-kpi-val" style={{ color: statement.summary?.openingBalance > 0 ? '#B45309' : '#0F172A' }}>
                                {formatINR(Math.abs(statement.summary?.openingBalance || 0))}
                            </div>
                            <div className="st-kpi-sub">
                                {statement.summary?.openingBalance > 0 
                                    ? 'Payable (Cr)' 
                                    : statement.summary?.openingBalance < 0 
                                        ? 'Advance Paid (Dr)' 
                                        : 'Nil / Clear'}
                            </div>
                        </div>

                        {/* Total Purchases (Debits) */}
                        <div className="st-kpi-card" style={{ borderTop: '3px solid #2563EB' }}>
                            <span className="st-kpi-label">Total Purchases (Debits)</span>
                            <div className="st-kpi-val" style={{ color: '#2563EB' }}>
                                {formatINR(statement.summary?.totalDebits || 0)}
                            </div>
                            <div className="st-kpi-sub">
                                Across {statement.debits?.length || 0} purchase bills
                            </div>
                        </div>

                        {/* Total Payments (Credits) */}
                        <div className="st-kpi-card" style={{ borderTop: '3px solid #059669' }}>
                            <span className="st-kpi-label">Total Payments (Credits)</span>
                            <div className="st-kpi-val" style={{ color: '#059669' }}>
                                {formatINR(statement.summary?.totalCredits || 0)}
                            </div>
                            <div className="st-kpi-sub">
                                Across {statement.credits?.length || 0} payments made
                            </div>
                        </div>

                        {/* Closing Outstanding Balance */}
                        <div 
                            className="st-kpi-card" 
                            style={{ 
                                borderTop: statement.summary?.closingBalance > 0 ? '3px solid #D97706' : statement.summary?.closingBalance < 0 ? '3px solid #059669' : '3px solid #64748B',
                                background: statement.summary?.closingBalance > 0 ? '#FFFDF5' : '#FFFFFF'
                            }}
                        >
                            <span className="st-kpi-label" style={{ color: statement.summary?.closingBalance > 0 ? '#B45309' : '#64748B' }}>
                                Closing Balance
                            </span>
                            <div className="st-kpi-val" style={{ color: statement.summary?.closingBalance > 0 ? '#B45309' : statement.summary?.closingBalance < 0 ? '#059669' : '#0F172A' }}>
                                {formatINR(Math.abs(statement.summary?.closingBalance || 0))}
                            </div>
                            <div className="st-kpi-sub" style={{ color: statement.summary?.closingBalance > 0 ? '#B45309' : '#64748B' }}>
                                {statement.summary?.balanceStatusLabel}
                            </div>
                        </div>
                    </div>

                    {/* Two-Column Accounting Ledger Table */}
                    <div className="st-ledger-wrap">
                        <table className="st-ledger-table">
                            <thead>
                                <tr>
                                    <th colSpan={4} className="st-th-group-credit">
                                        Credit Particulars — Payments
                                    </th>
                                    <th colSpan={3} className="st-th-group-debit">
                                        Debit Particulars — Purchases
                                    </th>
                                </tr>
                                <tr>
                                    <th className="st-th-sub" style={{ width: '9%' }}>Date</th>
                                    <th className="st-th-sub" style={{ width: '11%' }}>Mode</th>
                                    <th className="st-th-sub" style={{ width: '20%' }}>Remark</th>
                                    <th className="st-th-sub st-col-divider" style={{ width: '10%', textAlign: 'right' }}>Amount (Cr)</th>
                                    <th className="st-th-sub" style={{ width: '9%' }}>Date</th>
                                    <th className="st-th-sub" style={{ width: '31%' }}>Bill # & Description</th>
                                    <th className="st-th-sub" style={{ width: '10%', textAlign: 'right' }}>Amount (Dr)</th>
                                </tr>
                            </thead>
                            <tbody>
                                {alignedRows.map((row) => (
                                    <tr key={row.index}>
                                        {/* Credit / Payment Side */}
                                        {row.credit ? (
                                            <>
                                                <td style={{ fontWeight: '700', whiteSpace: 'nowrap' }}>
                                                    {formatDateStr(row.credit.date)}
                                                </td>
                                                <td>
                                                    <span style={{ 
                                                        display: 'inline-block', 
                                                        background: row.credit.paymentMethod === 'Bank Transfer' ? '#EFF6FF' : (row.credit.paymentMethod === 'Online' || row.credit.paymentMethod === 'UPI' || row.credit.paymentMethod === 'Online / UPI') ? '#F5F3FF' : '#ECFDF5', 
                                                        color: row.credit.paymentMethod === 'Bank Transfer' ? '#1D4ED8' : (row.credit.paymentMethod === 'Online' || row.credit.paymentMethod === 'UPI' || row.credit.paymentMethod === 'Online / UPI') ? '#6D28D9' : '#059669', 
                                                        padding: '3px 8px', 
                                                        borderRadius: '6px', 
                                                        fontSize: '11px', 
                                                        fontWeight: '700',
                                                        whiteSpace: 'nowrap'
                                                    }}>
                                                        {row.credit.paymentMethod || 'Cash'}
                                                    </span>
                                                </td>
                                                <td style={{ wordBreak: 'break-word', maxWidth: '240px' }}>
                                                    {row.credit.remark ? (
                                                        <span style={{ color: '#0F172A', fontWeight: '500' }}>{row.credit.remark}</span>
                                                    ) : (
                                                        <span style={{ color: '#94A3B8' }}>—</span>
                                                    )}
                                                </td>
                                                <td className="st-col-divider" style={{ textAlign: 'right', fontWeight: '800', color: '#059669', whiteSpace: 'nowrap' }}>
                                                    {formatINR(row.credit.amount)}
                                                </td>
                                            </>
                                        ) : (
                                            <>
                                                <td className="st-row-empty">-</td>
                                                <td className="st-row-empty">-</td>
                                                <td className="st-row-empty">-</td>
                                                <td className="st-row-empty st-col-divider">-</td>
                                            </>
                                        )}

                                        {/* Debit / Purchase Side */}
                                        {row.debit ? (
                                            <>
                                                <td style={{ fontWeight: '700', whiteSpace: 'nowrap' }}>
                                                    {formatDateStr(row.debit.date)}
                                                </td>
                                                <td>
                                                    <div style={{ fontWeight: '700', color: '#0F172A' }}>
                                                        <span style={{ display: 'inline-block', background: '#EFF6FF', color: '#2563EB', padding: '2px 6px', borderRadius: '4px', fontSize: '11px', marginRight: '6px' }}>
                                                            Bill #{row.debit.billNo}
                                                        </span>
                                                        {row.debit.category && <span style={{ color: '#475569', fontSize: '11.5px' }}>[{row.debit.category}]</span>}
                                                    </div>
                                                    <div style={{ fontSize: '11.5px', color: '#64748B', marginTop: '2px' }}>
                                                        {row.debit.description}
                                                    </div>
                                                    {row.debit.notes && (
                                                        <div style={{ fontSize: '11px', color: '#94A3B8', fontStyle: 'italic', marginTop: '1px' }}>
                                                            Note: {row.debit.notes}
                                                        </div>
                                                    )}
                                                </td>
                                                <td style={{ textAlign: 'right', fontWeight: '800', color: '#0F172A', whiteSpace: 'nowrap' }}>
                                                    {formatINR(row.debit.amount)}
                                                </td>
                                            </>
                                        ) : (
                                            <>
                                                <td className="st-row-empty">-</td>
                                                <td className="st-row-empty">-</td>
                                                <td className="st-row-empty">-</td>
                                            </>
                                        )}
                                    </tr>
                                ))}

                                {alignedRows.length === 0 && (
                                    <tr>
                                        <td colSpan={7} style={{ textAlign: 'center', padding: '24px', color: '#64748B', fontStyle: 'italic' }}>
                                            No ledger transactions recorded for the selected period.
                                        </td>
                                    </tr>
                                )}

                                {/* Subtotals Row */}
                                <tr className="st-subtotal-row">
                                    <td colSpan={3} style={{ textAlign: 'right', textTransform: 'uppercase', fontSize: '11px', color: '#64748B' }}>
                                        Total Payments (Credits):
                                    </td>
                                    <td className="st-col-divider" style={{ textAlign: 'right', color: '#059669', fontSize: '13px' }}>
                                        {formatINR(statement.summary?.totalCredits || 0)}
                                    </td>
                                    <td colSpan={2} style={{ textAlign: 'right', textTransform: 'uppercase', fontSize: '11px', color: '#64748B' }}>
                                        Total Purchases (Debits):
                                    </td>
                                    <td style={{ textAlign: 'right', color: '#2563EB', fontSize: '13px' }}>
                                        {formatINR(statement.summary?.totalDebits || 0)}
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>

                    {/* Accounting Reconciliation Summary Block */}
                    <div className="st-reconciliation-box">
                        <div>
                            <div style={{ fontSize: '11px', fontWeight: '800', textTransform: 'uppercase', color: '#64748B', letterSpacing: '0.05em' }}>
                                Accounting Balance Reconciliation
                            </div>
                            <div className="st-equation-line" style={{ marginTop: '4px' }}>
                                <span>Opening Balance: <strong>{formatINR(Math.abs(statement.summary?.openingBalance || 0))}</strong> ({statement.summary?.openingBalance >= 0 ? 'Cr' : 'Dr'})</span>
                                <span style={{ margin: '0 8px', color: '#94A3B8' }}>+</span>
                                <span>Purchases: <strong>{formatINR(statement.summary?.totalDebits || 0)}</strong></span>
                                <span style={{ margin: '0 8px', color: '#94A3B8' }}>-</span>
                                <span>Payments: <strong>{formatINR(statement.summary?.totalCredits || 0)}</strong></span>
                                <span style={{ margin: '0 8px', color: '#94A3B8' }}>=</span>
                                <span style={{ color: statement.summary?.closingBalance > 0 ? '#B45309' : '#059669', fontSize: '14px' }}>
                                    Net Balance: <strong>{formatINR(Math.abs(statement.summary?.closingBalance || 0))}</strong>
                                </span>
                            </div>
                        </div>

                        <div>
                            <span 
                                className="st-status-badge-lg" 
                                style={{
                                    background: statement.summary?.closingBalance > 0 ? '#FEF3C7' : statement.summary?.closingBalance < 0 ? '#ECFDF5' : '#F1F5F9',
                                    color: statement.summary?.closingBalance > 0 ? '#B45309' : statement.summary?.closingBalance < 0 ? '#059669' : '#475569',
                                    border: `1px solid ${statement.summary?.closingBalance > 0 ? '#FCD34D' : statement.summary?.closingBalance < 0 ? '#A7F3D0' : '#E2E8F0'}`
                                }}
                            >
                                <ShieldCheck size={16} />
                                {statement.summary?.balanceStatusLabel}
                            </span>
                        </div>
                    </div>

                    {/* Signatures & Verification Footer */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: '16px', paddingTop: '16px', borderTop: '1px solid #E2E8F0' }}>
                        <div style={{ fontSize: '11px', color: '#94A3B8' }}>
                            <div>This is a computer generated account statement from ShopPulse.</div>
                            <div style={{ marginTop: '2px' }}>Printed / Generated: {new Date().toLocaleString('en-IN')}</div>
                        </div>

                        <div style={{ textAlign: 'right' }}>
                            <div style={{ width: '200px', borderBottom: '1px solid #94A3B8', marginBottom: '6px' }} />
                            <div style={{ fontSize: '12px', fontWeight: '800', color: '#0F172A' }}>
                                For {statement.shop?.name || shop?.name || 'ShopPulse Business'}
                            </div>
                            <div style={{ fontSize: '11px', color: '#64748B' }}>Authorized Signatory</div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );

    // If used as Embedded tab inside SupplierLedgerPage
    if (embedded) {
        return content;
    }

    // Modal wrapper with full-viewport backdrop via React Portal
    return typeof document !== 'undefined' ? createPortal(
        <AnimatePresence>
            {isOpen && (
                <div 
                    onClick={onClose}
                    style={{ 
                        position: 'fixed', 
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        width: '100vw',
                        height: '100vh', 
                        background: 'rgba(15, 23, 42, 0.65)', 
                        backdropFilter: 'blur(8px)', 
                        WebkitBackdropFilter: 'blur(8px)',
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'center', 
                        zIndex: 99999, 
                        padding: '16px',
                        overflowY: 'auto',
                        boxSizing: 'border-box'
                    }}
                >
                    <motion.div 
                        onClick={(e) => e.stopPropagation()}
                        initial={{ opacity: 0, scale: 0.95, y: 15 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 15 }}
                        transition={{ duration: 0.18 }}
                        style={{ 
                            background: '#F8FAFC', 
                            borderRadius: '24px', 
                            width: '100%', 
                            maxWidth: '1200px', 
                            maxHeight: '92vh',
                            overflowY: 'auto',
                            padding: '24px', 
                            boxShadow: '0 25px 50px -12px rgba(0,0,0,0.3)', 
                            boxSizing: 'border-box',
                            position: 'relative',
                            zIndex: 100000
                        }}
                    >
                        {content}
                    </motion.div>
                </div>
            )}
        </AnimatePresence>,
        document.body
    ) : null;
};

export default SupplierAccountStatement;
