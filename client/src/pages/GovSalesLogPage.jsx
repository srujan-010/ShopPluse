import React, { useState, useEffect, useMemo } from 'react';
import { 
    Search, 
    Calendar, 
    X, 
    Receipt,
    MessageSquare,
    ChevronLeft,
    ShieldCheck,
    ChevronRight,
    Info,
    Download,
    Printer,
    FileText,
    IndianRupee,
    CheckCircle2
} from 'lucide-react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { govSaleService, shopService, productService } from '../services/api';
import { offlineDB } from '../services/offlineDB';
import { motion, AnimatePresence } from 'framer-motion';
import { EmptyState, Skeleton, PageHeader } from '../components/PremiumUI';
import { useScrollLock } from '../hooks/useScrollLock';
import { invoiceService } from '../utils/invoiceService';
import CompactInvoiceSheet from '../components/CompactInvoiceSheet';
import PrintFormatSelector from '../components/PrintFormatSelector';
import { getFormatOption, applyPrintPageStyles } from '../utils/printFormatConstants';
import { resolveBillTaxDetails } from '../utils/gstService';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const GovSalesLogPage = () => {
    const { shopId } = useParams();
    const navigate = useNavigate();
    const [sales, setSales] = useState([]);
    const [shop, setShop] = useState(null);
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    
    // View Bill State
    const [selectedSaleForInvoice, setSelectedSaleForInvoice] = useState(null);
    const [secondSaleForInvoice, setSecondSaleForInvoice] = useState(null);
    const [isInvoiceOpen, setIsInvoiceOpen] = useState(false);
    const [printFormatOverride, setPrintFormatOverride] = useState(null);

    const activePrintFormat = printFormatOverride || shop?.defaultPrintFormat || 'full_a4';

    // Discrepancy & Historical Audit State
    const [discrepancies, setDiscrepancies] = useState([]);
    const [isReconcileModalOpen, setIsReconcileModalOpen] = useState(false);
    const [reconcileReason, setReconcileReason] = useState('Reconciled retail rates with configured GST ledger prices');
    const [isReconciling, setIsReconciling] = useState(false);
    
    // Filters & Pagination
    const [searchParams] = useSearchParams();
    const initialDate = searchParams.get('date');
    const initialProduct = searchParams.get('product');
    const [productFilter, setProductFilter] = useState(initialProduct || '');
    const [periodFilter, setPeriodFilter] = useState(initialDate ? 'custom' : 'this_month'); 
    const getLocalToday = () => {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    };
    const [customStartDate, setCustomStartDate] = useState(initialDate || getLocalToday());
    const [customEndDate, setCustomEndDate] = useState(initialDate || getLocalToday());
    const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
    const [page, setPage] = useState(1);
    const itemsPerPage = 20;

    useScrollLock(isInvoiceOpen);

    // ESC key support
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'Escape') setIsInvoiceOpen(false);
        };
        if (isInvoiceOpen) window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isInvoiceOpen]);

    useEffect(() => {
        fetchInitialData();
    }, [shopId]);

    useEffect(() => {
        const searchInvoice = searchParams.get('search') || searchParams.get('invoice');
        if (searchInvoice && sales.length > 0) {
            const sale = sales.find(s => s.invoiceNumber === searchInvoice || s._id === searchInvoice);
            if (sale) {
                const sDate = new Date(sale.date);
                const yyyymmdd = `${sDate.getFullYear()}-${String(sDate.getMonth()+1).padStart(2,'0')}-${String(sDate.getDate()).padStart(2,'0')}`;
                setPeriodFilter('custom');
                setCustomStartDate(yyyymmdd);
                setCustomEndDate(yyyymmdd);
                setSearchQuery(searchInvoice);
                handleViewBill(sale);
            }
        }
    }, [sales, searchParams]);

    const fetchInitialData = async () => {
        try {
            // Offline-first load: Instant render from local IndexedDB
            const localSales = await offlineDB.getGovSales(shopId);
            const localShops = await offlineDB.getShops();
            
            if (localSales && localSales.length > 0) {
                setSales(localSales);
                setLoading(false);
            }
            const activeShop = localShops.find(s => s._id === shopId);
            if (activeShop) setShop(activeShop);

            const [salesRes, shopsRes, productsRes, discRes] = await Promise.all([
                govSaleService.getAll(shopId),
                shopService.getAll(),
                productService.getAll(shopId).catch(() => ({ data: { data: [] } })),
                govSaleService.getDiscrepancies(shopId).catch(() => ({ data: { data: [] } }))
            ]);
            setSales(salesRes.data.data || []);
            if (shopsRes.data?.data) {
                setShop(shopsRes.data.data.find(s => s._id === shopId));
            }
            if (productsRes?.data?.data) {
                setProducts(productsRes.data.data);
            }
            if (discRes.data?.data) {
                setDiscrepancies(discRes.data.data);
            }
        } catch (err) {
            console.error('Error fetching government sales data:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleReconcileHistorical = async () => {
        setIsReconciling(true);
        try {
            await govSaleService.correctHistorical({
                authorize: true,
                reason: reconcileReason
            }, shopId);
            setIsReconcileModalOpen(false);
            await fetchInitialData();
        } catch (err) {
            console.error('Reconciliation error:', err);
            alert('Reconciliation failed: ' + (err.response?.data?.message || err.message));
        } finally {
            setIsReconciling(false);
        }
    };

    const handleViewBill = (sale) => {
        if (!sale) return;
        setSelectedSaleForInvoice(sale);
        setSecondSaleForInvoice(null);
        setIsInvoiceOpen(true);
    };

    const handleDownloadPDF = (targetSale) => {
        const saleToPrint = targetSale || selectedSaleForInvoice;
        if (!saleToPrint) return;
        if (secondSaleForInvoice && activePrintFormat === 'half_a4') {
            invoiceService.downloadInvoice(saleToPrint, shop, 'GOV_SALE', { 
                secondBill: secondSaleForInvoice, 
                products, 
                format: activePrintFormat 
            });
        } else {
            invoiceService.downloadInvoice(saleToPrint, shop, 'GOV_SALE', { 
                products, 
                format: activePrintFormat 
            });
        }
    };

    const handleShareWhatsApp = (targetSale) => {
        const saleToShare = targetSale || selectedSaleForInvoice;
        if (!saleToShare) return;
        const opts = { 
            products, 
            format: activePrintFormat 
        };
        if (secondSaleForInvoice && activePrintFormat === 'half_a4') {
            opts.secondBill = secondSaleForInvoice;
        }
        invoiceService.shareInvoice(saleToShare, shop, 'GOV_SALE', opts);
    };

    // Resolve tax breakdown accurately for each government sale
    const salesWithTax = useMemo(() => {
        return sales.map(sale => {
            const td = resolveBillTaxDetails(sale, 'GOV_SALE', shop, products);
            return {
                ...sale,
                taxDetails: td
            };
        });
    }, [sales, shop, products]);

    const getPeriodDisplayLabel = () => {
        if (periodFilter === 'today') {
            return `Today (${new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })})`;
        }
        if (periodFilter === 'last_7_days') {
            const past = new Date();
            past.setDate(past.getDate() - 6);
            return `${past.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })} to ${new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}`;
        }
        if (periodFilter === 'this_month') {
            return new Date().toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
        }
        if (periodFilter === 'custom') {
            const s = customStartDate ? new Date(customStartDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Start';
            const e = customEndDate ? new Date(customEndDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : 'End';
            return `${s} to ${e}`;
        }
        return 'All Time';
    };

    const filteredSales = useMemo(() => {
        return salesWithTax.filter(sale => {
            const saleDate = new Date(sale.date);
            const now = new Date();
            let matchesPeriod = false;

            if (periodFilter === 'today') {
                matchesPeriod = saleDate.getFullYear() === now.getFullYear() &&
                                saleDate.getMonth() === now.getMonth() &&
                                saleDate.getDate() === now.getDate();
            } else if (periodFilter === 'last_7_days') {
                const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6, 0, 0, 0, 0);
                const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
                matchesPeriod = saleDate >= start && saleDate <= end;
            } else if (periodFilter === 'this_month') {
                matchesPeriod = saleDate.getFullYear() === now.getFullYear() &&
                                saleDate.getMonth() === now.getMonth();
            } else if (periodFilter === 'custom') {
                let start = new Date(0);
                if (customStartDate) {
                    const [sy, sm, sd] = customStartDate.split('-').map(Number);
                    start = new Date(sy, sm - 1, sd, 0, 0, 0, 0);
                }
                let end = new Date();
                if (customEndDate) {
                    const [ey, em, ed] = customEndDate.split('-').map(Number);
                    end = new Date(ey, em - 1, ed, 23, 59, 59, 999);
                } else {
                    end.setHours(23, 59, 59, 999);
                }
                matchesPeriod = saleDate >= start && saleDate <= end;
            } else if (periodFilter === 'all') {
                matchesPeriod = true;
            }

            const matchesSearch = searchQuery === '' || 
                (sale.customerName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                (sale.invoiceNumber || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                (sale.customerAadhaar || '').includes(searchQuery);

            const matchesProduct = !productFilter || (sale.items || []).some(item => 
                (item.productName || '').toLowerCase().includes(productFilter.toLowerCase())
            );

            return matchesPeriod && matchesSearch && matchesProduct;
        }).sort((a, b) => new Date(b.date) - new Date(a.date));
    }, [salesWithTax, periodFilter, customStartDate, customEndDate, searchQuery, productFilter]);

    const paginatedSales = filteredSales.slice(0, page * itemsPerPage);

    const summaryTotals = useMemo(() => {
        let totalTaxable = 0;
        let totalGst = 0;
        let totalAmount = 0;

        filteredSales.forEach(s => {
            const td = s.taxDetails || {};
            totalTaxable += Number(td.taxableAmount || 0);
            totalGst += Number(td.totalGst || 0);
            totalAmount += Number(td.grandTotal || s.totalAmount || 0);
        });

        return {
            totalOrders: filteredSales.length,
            totalTaxable: parseFloat(totalTaxable.toFixed(2)),
            totalGst: parseFloat(totalGst.toFixed(2)),
            totalAmount: parseFloat(totalAmount.toFixed(2))
        };
    }, [filteredSales]);

    // Download A4 Multi-page Government Sales GST Register PDF
    const handleExportGstRegisterPdf = () => {
        if (!filteredSales || filteredSales.length === 0) {
            alert('No GST sales records found for the selected date range.');
            return;
        }

        try {
            setIsGeneratingPdf(true);
            const doc = new jsPDF({
                orientation: 'landscape',
                unit: 'mm',
                format: 'a4'
            });

            const pageWidth = doc.internal.pageSize.getWidth(); // 297mm
            const pageHeight = doc.internal.pageSize.getHeight(); // 210mm
            const margin = 12;
            const contentWidth = pageWidth - (margin * 2); // 273mm

            const primaryNavy = [15, 23, 42];     // #0F172A
            const brandBlue = [37, 99, 235];       // #2563EB
            const creditGreen = [5, 150, 105];     // #059669
            const darkText = [30, 41, 59];         // #1E293B
            const mutedGray = [100, 116, 139];     // #64748B
            const borderGray = [226, 232, 240];    // #E2E8F0
            const lightBg = [248, 250, 252];       // #F8FAFC

            let currentY = margin;

            // Accent Top Ribbon
            doc.setFillColor(...brandBlue);
            doc.rect(margin, currentY, contentWidth, 2, 'F');
            currentY += 6;

            // Shop Name & Details
            const shopName = shop?.name || 'ShopPulse Business';
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(14);
            doc.setTextColor(...primaryNavy);
            doc.text(shopName, margin, currentY + 3);

            // Report Title
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(13);
            doc.setTextColor(...brandBlue);
            doc.text('GST Sales Register', pageWidth - margin, currentY + 3, { align: 'right' });

            let shopSubY = currentY + 7.5;
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(8);
            doc.setTextColor(...mutedGray);

            const shopDetails = [];
            if (shop?.location) shopDetails.push(shop.location);
            if (shop?.contactNumber) shopDetails.push(`Phone: ${shop.contactNumber}`);
            if (shop?.gstNumber) shopDetails.push(`GSTIN: ${shop.gstNumber}`);
            if (shopDetails.length > 0) {
                doc.text(shopDetails.join('  •  '), margin, shopSubY);
            }

            const genDateStr = `Generated on: ${new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })} ${new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}`;
            doc.text(`Period: ${getPeriodDisplayLabel()}  •  ${genDateStr}`, pageWidth - margin, shopSubY, { align: 'right' });

            currentY = shopSubY + 6;

            // Divider Line
            doc.setDrawColor(...borderGray);
            doc.setLineWidth(0.4);
            doc.line(margin, currentY, pageWidth - margin, currentY);
            currentY += 5;

            // 4 KPI Summary Boxes in PDF
            const cardWidth = (contentWidth - 12) / 4;
            const cardHeight = 12;
            const kpis = [
                { label: 'NUMBER OF BILLS', val: `${summaryTotals.totalOrders} Bills`, color: brandBlue },
                { label: 'TOTAL TAXABLE VALUE', val: `Rs. ${summaryTotals.totalTaxable.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, color: primaryNavy },
                { label: 'TOTAL GST', val: `Rs. ${summaryTotals.totalGst.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, color: creditGreen },
                { label: 'TOTAL BILL AMOUNT', val: `Rs. ${summaryTotals.totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, color: [180, 83, 9] }
            ];

            kpis.forEach((kpi, idx) => {
                const cardX = margin + (idx * (cardWidth + 4));
                doc.setFillColor(...lightBg);
                doc.roundedRect(cardX, currentY, cardWidth, cardHeight, 1.5, 1.5, 'F');
                doc.setDrawColor(...borderGray);
                doc.roundedRect(cardX, currentY, cardWidth, cardHeight, 1.5, 1.5, 'S');

                doc.setFont('helvetica', 'bold');
                doc.setFontSize(6.5);
                doc.setTextColor(...mutedGray);
                doc.text(kpi.label, cardX + 3, currentY + 3.8);

                doc.setFont('helvetica', 'bold');
                doc.setFontSize(8.5);
                doc.setTextColor(...kpi.color);
                doc.text(kpi.val, cardX + 3, currentY + 8.5);
            });

            currentY += cardHeight + 5;

            // Build AutoTable with ALL matching bills across all pages
            const tableRows = filteredSales.map((sale) => {
                const td = sale.taxDetails || {};
                const d = new Date(sale.date);
                const dateStr = d.toLocaleDateString('en-IN') + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                return [
                    `#${sale.invoiceNumber || sale._id.slice(-6).toUpperCase()}`,
                    sale.customerName || 'Walk-in Customer',
                    dateStr,
                    `Rs. ${Number(td.taxableAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`,
                    `Rs. ${Number(td.totalGst || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`,
                    `Rs. ${Number(td.grandTotal || sale.totalAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`
                ];
            });

            const totalsRow = [
                'TOTALS',
                `${summaryTotals.totalOrders} Bills`,
                '—',
                `Rs. ${summaryTotals.totalTaxable.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`,
                `Rs. ${summaryTotals.totalGst.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`,
                `Rs. ${summaryTotals.totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`
            ];

            autoTable(doc, {
                startY: currentY,
                margin: { left: margin, right: margin, top: margin + 5, bottom: margin + 8 },
                head: [[
                    'Bill Number', 'Customer Name', 'Date',
                    'Taxable Value', 'GST', 'Final Bill Amount'
                ]],
                body: [...tableRows, totalsRow],
                theme: 'grid',
                headStyles: {
                    fillColor: primaryNavy,
                    textColor: [255, 255, 255],
                    fontSize: 8,
                    fontStyle: 'bold',
                    cellPadding: 2.5,
                    halign: 'left'
                },
                styles: {
                    fontSize: 7.5,
                    textColor: darkText,
                    cellPadding: 2.5,
                    valign: 'middle',
                    overflow: 'linebreak',
                    lineColor: borderGray,
                    lineWidth: 0.2
                },
                columnStyles: {
                    0: { cellWidth: 35, fontStyle: 'bold' },
                    1: { cellWidth: 68 },
                    2: { cellWidth: 40 },
                    3: { cellWidth: 42, halign: 'right' },
                    4: { cellWidth: 42, halign: 'right', fontStyle: 'bold', textColor: creditGreen },
                    5: { cellWidth: 46, halign: 'right', fontStyle: 'bold', textColor: brandBlue }
                },
                didParseCell: (data) => {
                    if (data.section === 'body' && data.row.index === tableRows.length) {
                        data.cell.styles.fillColor = [241, 245, 249];
                        data.cell.styles.fontStyle = 'bold';
                        data.cell.styles.fontSize = 8;
                    }
                },
                didDrawPage: (data) => {
                    const totalPages = doc.internal.getNumberOfPages();
                    const pageNum = data.pageNumber;
                    doc.setFontSize(7);
                    doc.setFont('helvetica', 'normal');
                    doc.setTextColor(...mutedGray);
                    doc.text(
                        `ShopPulse GST Sales Register  •  Page ${pageNum} of ${totalPages}`,
                        pageWidth / 2,
                        pageHeight - 5,
                        { align: 'center' }
                    );
                    doc.text(
                        `Report generated for ${shopName}`,
                        margin,
                        pageHeight - 5
                    );
                }
            });

            const safeShopName = (shopName || 'Shop').replace(/[^a-zA-Z0-9]/g, '_');
            doc.save(`GST_Sales_Register_${safeShopName}_${new Date().toISOString().slice(0, 10)}.pdf`);
        } catch (pdfErr) {
            console.error('Error exporting GST register PDF:', pdfErr);
            alert('Failed to generate PDF: ' + (pdfErr.message || 'Unknown error'));
        } finally {
            setIsGeneratingPdf(false);
        }
    };

    return (
        <div className="sales-log-v3">
            <PageHeader 
                title="GST Sales Ledger"
                subtitle="Official GST sales register and inspection-ready records"
                backAction={() => navigate(-1)}
                actions={
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <button 
                            className="btn-download-pdf-prominent"
                            onClick={handleExportGstRegisterPdf}
                            disabled={isGeneratingPdf}
                            title="Download GST Sales Register PDF"
                        >
                            <Download size={16} />
                            <span>{isGeneratingPdf ? 'Generating...' : 'Download PDF'}</span>
                        </button>
                    </div>
                }
            />

            <div className="sl-controls">
                <div className="sl-search">
                    <Search size={20} color="#98A2B3" />
                    <input 
                        type="text" 
                        placeholder="Search by Bill No or Customer Name..." 
                        value={searchQuery}
                        onChange={(e) => { setSearchQuery(e.target.value); setPage(1); }}
                    />
                </div>
                
                <div className="sl-filters">
                    {[
                        { id: 'today', label: 'Today' },
                        { id: 'last_7_days', label: 'Last 7 Days' },
                        { id: 'this_month', label: 'This Month' },
                        { id: 'custom', label: 'Custom Range' },
                        { id: 'all', label: 'All Time' }
                    ].map(p => (
                        <button 
                            key={p.id} 
                            className={`sl-pill ${periodFilter === p.id ? 'active' : ''}`}
                            onClick={() => { setPeriodFilter(p.id); setPage(1); }}
                        >
                            {p.label}
                        </button>
                    ))}
                </div>
            </div>

            {productFilter && (
                <div className="sl-active-filters">
                    <div className="active-filter-badge">
                        <span>Product Audit: <strong>{productFilter}</strong></span>
                        <button 
                            className="btn-clear-filter" 
                            onClick={() => {
                                setProductFilter('');
                                const params = new URLSearchParams(window.location.search);
                                params.delete('product');
                                navigate(`/shop/${shopId}/gov-sales-log?${params.toString()}`, { replace: true });
                                setPage(1);
                            }}
                        >
                            <X size={14} />
                        </button>
                    </div>
                </div>
            )}

            {discrepancies.length > 0 && (
                <div style={{
                    background: '#FEF2F2',
                    border: '1.5px solid #FCA5A5',
                    borderRadius: '16px',
                    padding: '16px 20px',
                    margin: '8px 0 16px 0',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '12px'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <span style={{ fontSize: '24px' }}>⚠️</span>
                        <div>
                            <strong style={{ color: '#991B1B', fontSize: '14px', display: 'block' }}>
                                Historical Rate Discrepancies Detected ({discrepancies.length} records)
                            </strong>
                            <span style={{ color: '#7F1D1D', fontSize: '12px' }}>
                                Legacy records previously stored retail price rates instead of configured GST ledger rates.
                            </span>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={() => setIsReconcileModalOpen(true)}
                        style={{
                            background: '#DC2626',
                            color: '#FFFFFF',
                            border: 'none',
                            padding: '8px 16px',
                            borderRadius: '10px',
                            fontWeight: '700',
                            fontSize: '13px',
                            cursor: 'pointer'
                        }}
                    >
                        Review & Authorize Reconcile
                    </button>
                </div>
            )}

            {/* 4 Summary Cards (Responsive Grid) */}
            <div className="sl-summary-grid">
                <div className="sl-sum-card" style={{ borderTop: '3px solid #2563EB' }}>
                    <span className="sl-sum-label">Number of Bills</span>
                    <strong className="sl-sum-val">{summaryTotals.totalOrders}</strong>
                    <span style={{ fontSize: '11px', color: '#64748B', fontWeight: '600', marginTop: '2px' }}>Total Invoices</span>
                </div>
                <div className="sl-sum-card" style={{ borderTop: '3px solid #0F172A' }}>
                    <span className="sl-sum-label">Total Taxable Value</span>
                    <strong className="sl-sum-val">₹{summaryTotals.totalTaxable.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
                    <span style={{ fontSize: '11px', color: '#64748B', fontWeight: '600', marginTop: '2px' }}>Excl. GST</span>
                </div>
                <div className="sl-sum-card" style={{ borderTop: '3px solid #059669' }}>
                    <span className="sl-sum-label">Total GST</span>
                    <strong className="sl-sum-val" style={{ color: '#059669' }}>₹{summaryTotals.totalGst.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
                    <span style={{ fontSize: '11px', color: '#64748B', fontWeight: '600', marginTop: '2px' }}>Total Tax</span>
                </div>
                <div className="sl-sum-card" style={{ borderTop: '3px solid #EA580C' }}>
                    <span className="sl-sum-label">Total Bill Amount</span>
                    <strong className="sl-sum-val profit" style={{ color: '#2563EB' }}>₹{summaryTotals.totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
                    <span style={{ fontSize: '11px', color: '#64748B', fontWeight: '600', marginTop: '2px' }}>Gross Value</span>
                </div>
            </div>

            {/* Custom Date Range Pickers (Start & End Date) */}
            {periodFilter === 'custom' && (
                <div className="sl-custom-date" style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap', background: '#F8FAFC', border: '1.5px solid #CBD5E1', borderRadius: '12px', padding: '12px 18px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Calendar size={16} color="#2563EB" />
                        <span style={{ fontSize: '13px', fontWeight: '700', color: '#1E293B' }}>From:</span>
                        <input 
                            type="date" 
                            value={customStartDate} 
                            onChange={(e) => { setCustomStartDate(e.target.value); setPage(1); }}
                            style={{ padding: '6px 12px', borderRadius: '8px', border: '1.5px solid #CBD5E1', fontSize: '13px', fontWeight: '600', background: '#FFFFFF' }}
                        />
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '13px', fontWeight: '700', color: '#1E293B' }}>To:</span>
                        <input 
                            type="date" 
                            value={customEndDate} 
                            onChange={(e) => { setCustomEndDate(e.target.value); setPage(1); }}
                            style={{ padding: '6px 12px', borderRadius: '8px', border: '1.5px solid #CBD5E1', fontSize: '13px', fontWeight: '600', background: '#FFFFFF' }}
                        />
                    </div>
                    <span style={{ fontSize: '12px', color: '#64748B', fontWeight: '600', marginLeft: 'auto' }}>
                        {summaryTotals.totalOrders} bills found between {customStartDate || 'start'} and {customEndDate || 'end'}
                    </span>
                </div>
            )}

            {/* Compact 2x2 for Mobile Devices */}
            <div className="compact-2x2-container">
                <div className="mini-stat-card">
                    <span className="mini-stat-label">Number of Bills</span>
                    <strong className="mini-stat-val">{summaryTotals.totalOrders}</strong>
                </div>
                <div className="mini-stat-card">
                    <span className="mini-stat-label">Taxable Value</span>
                    <strong className="mini-stat-val">₹{summaryTotals.totalTaxable.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
                </div>
                <div className="mini-stat-card">
                    <span className="mini-stat-label">Total GST</span>
                    <strong className="mini-stat-val" style={{ color: '#059669' }}>₹{summaryTotals.totalGst.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
                </div>
                <div className="mini-stat-card">
                    <span className="mini-stat-label">Total Bill Amount</span>
                    <strong className="mini-stat-val profit" style={{ color: '#2563EB' }}>₹{summaryTotals.totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
                </div>
            </div>

            {loading ? (
                <div className="sl-list">
                    {[1, 2, 3, 4, 5].map(i => (
                        <div key={i} className="sl-card-premium" style={{ padding: '16px' }}>
                            <Skeleton height="20px" width="70%" className="mb-4" />
                            <Skeleton height="14px" width="40%" className="mb-8" />
                            <Skeleton height="24px" borderRadius="8px" />
                        </div>
                    ))}
                </div>
            ) : paginatedSales.length === 0 ? (
                <EmptyState 
                    icon={Receipt}
                    title="No Official Records Found"
                    description={searchQuery ? `No records match your search "${searchQuery}".` : "No GST sales records for the selected period."}
                    actionLabel={searchQuery ? "Clear Search" : "Create New Sale"}
                    onAction={searchQuery ? () => setSearchQuery('') : () => window.location.href = `/shop/${shopId}/pos`}
                    secondaryActionLabel={!searchQuery ? "Change Date" : null}
                    onSecondaryAction={() => setPeriodFilter('custom')}
                />
            ) : (
                <>
                    {/* Mobile Card List */}
                    <div className="sl-list sl-mobile-only">
                        {paginatedSales.map((sale) => {
                            const td = sale.taxDetails || {};
                            const isAuditMatched = productFilter && (sale.items || []).some(item => 
                                (item.productName || '').toLowerCase().includes(productFilter.toLowerCase())
                            );

                            return (
                                <motion.div 
                                    whileTap={{ scale: 0.98 }}
                                    key={sale._id} 
                                    className={`sl-card-premium ${isAuditMatched ? 'audit-highlighted' : ''}`}
                                    onClick={() => handleViewBill(sale)}
                                >
                                    <div className="sl-card-top">
                                        <div className="sl-card-name" style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                            <span>{sale.customerName || 'Walk-in Customer'}</span>
                                            {isAuditMatched && (
                                                <span className="audit-highlight-badge">
                                                    🔍 Audit Match
                                                </span>
                                            )}
                                        </div>
                                        <div className="sl-card-amount-wrap">
                                            <div className="sl-card-amount" style={{ color: '#2563EB' }}>
                                                ₹{Number(td.grandTotal || sale.totalAmount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                            </div>
                                            <ChevronRight size={16} color="#98A2B3" />
                                        </div>
                                    </div>
                                    <div className="sl-card-mid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', marginTop: '4px', background: '#F8FAFC', padding: '8px 10px', borderRadius: '8px' }}>
                                        <div>
                                            <div style={{ fontSize: '10.5px', color: '#64748B', textTransform: 'uppercase', fontWeight: '700' }}>Taxable</div>
                                            <div style={{ fontSize: '12.5px', fontWeight: '700', color: '#1E293B' }}>₹{Number(td.taxableAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
                                        </div>
                                        <div>
                                            <div style={{ fontSize: '10.5px', color: '#64748B', textTransform: 'uppercase', fontWeight: '700' }}>GST</div>
                                            <div style={{ fontSize: '12.5px', fontWeight: '700', color: '#059669' }}>₹{Number(td.totalGst || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
                                        </div>
                                        <div>
                                            <div style={{ fontSize: '10.5px', color: '#64748B', textTransform: 'uppercase', fontWeight: '700' }}>Amount</div>
                                            <div style={{ fontSize: '12.5px', fontWeight: '800', color: '#2563EB' }}>₹{Number(td.grandTotal || sale.totalAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
                                        </div>
                                    </div>
                                    <div className="sl-card-bot">
                                        <div className="sl-card-meta">
                                            <span>{new Date(sale.date).toLocaleDateString('en-IN')} {new Date(sale.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                            <span className="divider-dot">•</span>
                                            <span>GST Bill #{sale.invoiceNumber || sale._id.slice(-6).toUpperCase()}</span>
                                            <span className="divider-dot">•</span>
                                            <span className="sl-cp-pay-badge upi" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                                <ShieldCheck size={12} /> Official
                                            </span>
                                        </div>
                                    </div>
                                </motion.div>
                            );
                        })}
                    </div>

                    {/* Desktop Redesigned Table with 9 Columns and Footer Totals */}
                    <div className="sl-desktop-only radical-desktop-container">
                        <div className="rdc-header">
                            <div className="rdch-left">
                                <h3>GST Sales Register</h3>
                                <p>{filteredSales.length} Records Found  •  Period: {getPeriodDisplayLabel()}</p>
                            </div>
                            <div className="rdch-right" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <button 
                                    className="btn-download-pdf-prominent"
                                    onClick={handleExportGstRegisterPdf}
                                    disabled={isGeneratingPdf}
                                    title="Download GST Sales Register PDF"
                                >
                                    <Download size={15} />
                                    <span>{isGeneratingPdf ? 'Generating...' : 'Download PDF'}</span>
                                </button>
                                <span className="rdch-stat">Total Value: <strong>₹{summaryTotals.totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong></span>
                            </div>
                        </div>
                        <table className="radical-desktop-table">
                            <thead>
                                <tr>
                                    <th style={{ width: '16%' }}>Bill Number</th>
                                    <th style={{ width: '25%' }}>Customer Name</th>
                                    <th style={{ width: '18%' }}>Date & Time</th>
                                    <th style={{ width: '13%', textAlign: 'right' }}>Taxable Value</th>
                                    <th style={{ width: '13%', textAlign: 'right' }}>GST</th>
                                    <th style={{ width: '15%', textAlign: 'right' }}>Final Bill Amount</th>
                                </tr>
                            </thead>
                            <tbody>
                                {paginatedSales.map((sale) => {
                                    const td = sale.taxDetails || {};
                                    const isAuditMatched = productFilter && (sale.items || []).some(item => 
                                        (item.productName || '').toLowerCase().includes(productFilter.toLowerCase())
                                    );

                                    return (
                                        <tr 
                                            key={sale._id} 
                                            className={`sl-desktop-row ${isAuditMatched ? 'audit-highlighted' : ''}`} 
                                            onClick={() => handleViewBill(sale)}
                                            title="Click to view official invoice"
                                        >
                                            <td className="sld-bill">
                                                <span className="bill-badge">#{sale.invoiceNumber || sale._id.slice(-6).toUpperCase()}</span>
                                            </td>
                                            <td className="sld-cust">
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                    <span className="cust-main">{sale.customerName || 'Walk-in Customer'}</span>
                                                    {isAuditMatched && (
                                                        <span className="audit-highlight-badge">
                                                            🔍 Audit Match
                                                        </span>
                                                    )}
                                                </div>
                                                {sale.customerMobile && <div className="cust-sub">{sale.customerMobile}</div>}
                                            </td>
                                            <td className="sld-time">
                                                <div style={{ fontWeight: 600 }}>{new Date(sale.date).toLocaleDateString('en-IN')}</div>
                                                <div style={{ fontSize: '12px', color: '#64748b' }}>{new Date(sale.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                                            </td>
                                            <td style={{ textAlign: 'right', fontWeight: 600, color: '#1E293B' }}>
                                                ₹{Number(td.taxableAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                            </td>
                                            <td style={{ textAlign: 'right', fontWeight: 700, color: '#059669' }}>
                                                ₹{Number(td.totalGst || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                            </td>
                                            <td className="sld-amt" style={{ textAlign: 'right' }}>
                                                <div className="amt-val" style={{ color: '#2563EB', fontWeight: 800 }}>
                                                    ₹{Number(td.grandTotal || sale.totalAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                            <tfoot>
                                <tr style={{ background: '#F8FAFC', fontWeight: 800, borderTop: '2px solid #CBD5E1' }}>
                                    <td colSpan={3} style={{ padding: '14px 20px', color: '#475569', textTransform: 'uppercase', fontSize: '11px', letterSpacing: '0.05em' }}>
                                        Totals ({summaryTotals.totalOrders} Bills):
                                    </td>
                                    <td style={{ textAlign: 'right', padding: '14px 20px', color: '#1E293B', fontSize: '13px' }}>
                                        ₹{summaryTotals.totalTaxable.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </td>
                                    <td style={{ textAlign: 'right', padding: '14px 20px', color: '#059669', fontSize: '13px' }}>
                                        ₹{summaryTotals.totalGst.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </td>
                                    <td style={{ textAlign: 'right', padding: '14px 20px', color: '#2563EB', fontSize: '14px' }}>
                                        ₹{summaryTotals.totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                </>
            )}

            {filteredSales.length > paginatedSales.length && (
                <button className="sl-load-more" onClick={() => setPage(p => p + 1)}>
                    Load More Records
                </button>
            )}

            {/* Standard Invoice Preview Overlay (Matching Sales Log) */}
            <AnimatePresence>
                {isInvoiceOpen && (
                    <motion.div 
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 20 }}
                        className="invoice-preview-screen"
                    >
                        <div className="ips-top-bar no-print">
                            <button className="ips-back-btn" onClick={() => { setIsInvoiceOpen(false); setSecondSaleForInvoice(null); setPrintFormatOverride(null); }}>
                                <ChevronLeft size={20} />
                                <span>Back</span>
                            </button>
                            <div className="ips-title-area">
                                <h2 style={{ margin: 0, fontSize: '17px', fontWeight: 800, color: '#071B44' }}>
                                    View Bill
                                </h2>
                                <div style={{ marginTop: '4px' }}>
                                    <PrintFormatSelector 
                                        value={activePrintFormat}
                                        onChange={(fmt) => setPrintFormatOverride(fmt)}
                                        savedDefault={shop?.defaultPrintFormat || 'full_a4'}
                                        shopId={shopId || shop?._id}
                                        onShopUpdate={(updated) => {
                                            setShop(updated);
                                            setPrintFormatOverride(null);
                                        }}
                                        mode="pills"
                                        showPrinterTip={false}
                                    />
                                </div>
                            </div>
                            <div style={{ width: 60 }} />
                        </div>

                        {(activePrintFormat === 'thermal_58' || activePrintFormat === 'thermal_80') && (
                            <div className="ips-printer-tip-bar no-print">
                                <Info size={14} />
                                <span>
                                    <strong>Thermal Print Notice:</strong> In the browser print dialog, set Paper Size to {activePrintFormat === 'thermal_58' ? '58mm Roll' : '80mm Roll'} and Margins to None/Minimum.
                                </span>
                            </div>
                        )}

                        <div className="ips-content">
                            {!selectedSaleForInvoice ? (
                                <div className="ips-error">Bill details could not be found.</div>
                            ) : (
                                <CompactInvoiceSheet 
                                    bill1={selectedSaleForInvoice}
                                    bill2={secondSaleForInvoice}
                                    shop={shop}
                                    products={products}
                                    format={activePrintFormat}
                                    availableBills={sales}
                                    onSelectSecondBill={(second) => setSecondSaleForInvoice(second)}
                                    onRemoveSecondBill={() => setSecondSaleForInvoice(null)}
                                />
                            )}
                        </div>

                        <div className="ips-actions-bar no-print">
                            <button className="ips-btn ips-wa" onClick={() => handleShareWhatsApp()}>
                                WhatsApp
                            </button>
                            <button className="ips-btn ips-pdf" onClick={() => handleDownloadPDF()}>
                                Download PDF {secondSaleForInvoice && activePrintFormat === 'half_a4' ? '(2-on-1)' : ''}
                            </button>
                            <button 
                                className="ips-btn ips-print" 
                                onClick={() => {
                                    applyPrintPageStyles(activePrintFormat, { hasSecondBill: Boolean(secondSaleForInvoice) });
                                    window.print();
                                }}
                            >
                                Print ({getFormatOption(activePrintFormat).name})
                            </button>
                            <button className="ips-btn ips-close" onClick={() => { setIsInvoiceOpen(false); setSecondSaleForInvoice(null); setPrintFormatOverride(null); }}>
                                Close
                            </button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Historical Audit & Reconcile Modal */}
            <AnimatePresence>
                {isReconcileModalOpen && (
                    <div className="modal-overlay-v2" style={{
                        position: 'fixed',
                        inset: 0,
                        background: 'rgba(15, 23, 42, 0.6)',
                        backdropFilter: 'blur(4px)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        zIndex: 99999,
                        padding: '16px'
                    }}>
                        <motion.div 
                            initial={{ scale: 0.95, opacity: 0 }} 
                            animate={{ scale: 1, opacity: 1 }} 
                            exit={{ scale: 0.95, opacity: 0 }} 
                            style={{
                                background: '#FFFFFF',
                                borderRadius: '20px',
                                maxWidth: '720px',
                                width: '100%',
                                maxHeight: '90vh',
                                display: 'flex',
                                flexDirection: 'column',
                                overflow: 'hidden',
                                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)'
                            }}
                        >
                            <div style={{
                                padding: '20px 24px',
                                borderBottom: '1px solid #E2E8F0',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                background: '#F8FAFC'
                            }}>
                                <div>
                                    <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '800', color: '#0F172A' }}>
                                        Auditable Historical Rate Correction
                                    </h3>
                                    <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#64748B' }}>
                                        Found {discrepancies.length} records where retail prices were stored instead of configured GST ledger rates.
                                    </p>
                                </div>
                                <button 
                                    onClick={() => setIsReconcileModalOpen(false)}
                                    style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#64748B' }}
                                >
                                    <X size={20} />
                                </button>
                            </div>

                            <div style={{ padding: '20px 24px', overflowY: 'auto', flex: 1 }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                                    <thead>
                                        <tr style={{ background: '#F1F5F9', textAlign: 'left', color: '#475569' }}>
                                            <th style={{ padding: '8px 10px', borderRadius: '6px 0 0 6px' }}>Bill #</th>
                                            <th style={{ padding: '8px 10px' }}>Date</th>
                                            <th style={{ padding: '8px 10px' }}>Customer</th>
                                            <th style={{ padding: '8px 10px' }}>Items & Rates</th>
                                            <th style={{ padding: '8px 10px', textAlign: 'right' }}>Stored</th>
                                            <th style={{ padding: '8px 10px', textAlign: 'right', borderRadius: '0 6px 6px 0' }}>GST Total</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {discrepancies.map(disc => (
                                            <tr key={disc._id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                                                <td style={{ padding: '8px 10px', fontWeight: '700' }}>#{disc.invoiceNumber}</td>
                                                <td style={{ padding: '8px 10px', color: '#64748B' }}>{new Date(disc.date).toLocaleDateString('en-IN')}</td>
                                                <td style={{ padding: '8px 10px' }}>{disc.customerName || 'Walk-in'}</td>
                                                <td style={{ padding: '8px 10px' }}>
                                                    {disc.items.map((it, idx) => (
                                                        <div key={idx} style={{ color: '#0F172A' }}>
                                                            {it.productName}: {it.quantity} {it.unit} @ <del style={{ color: '#DC2626' }}>₹{it.storedRate}</del> <strong>₹{it.persistedGovPrice}</strong>
                                                        </div>
                                                    ))}
                                                </td>
                                                <td style={{ padding: '8px 10px', textAlign: 'right', color: '#DC2626', fontWeight: '700' }}>
                                                    ₹{disc.storedTotalAmount}
                                                </td>
                                                <td style={{ padding: '8px 10px', textAlign: 'right', color: '#059669', fontWeight: '700' }}>
                                                    ₹{disc.recalculatedTotalAmount}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>

                                <div style={{ marginTop: '20px', background: '#FFFBEB', border: '1px solid #FDE68A', padding: '14px', borderRadius: '12px' }}>
                                    <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', color: '#92400E', marginBottom: '6px' }}>
                                        Authorization Audit Reason / Notes:
                                    </label>
                                    <input 
                                        type="text" 
                                        value={reconcileReason} 
                                        onChange={(e) => setReconcileReason(e.target.value)}
                                        style={{
                                            width: '100%',
                                            padding: '8px 12px',
                                            borderRadius: '8px',
                                            border: '1px solid #D97706',
                                            fontSize: '13px'
                                        }}
                                        placeholder="Enter reason for audit record..."
                                    />
                                </div>
                            </div>

                            <div style={{
                                padding: '16px 24px',
                                borderTop: '1px solid #E2E8F0',
                                display: 'flex',
                                justifyContent: 'flex-end',
                                gap: '12px',
                                background: '#F8FAFC'
                            }}>
                                <button
                                    type="button"
                                    onClick={() => setIsReconcileModalOpen(false)}
                                    style={{
                                        padding: '10px 18px',
                                        borderRadius: '10px',
                                        border: '1px solid #CBD5E1',
                                        background: '#FFFFFF',
                                        color: '#475569',
                                        fontWeight: '700',
                                        fontSize: '13px',
                                        cursor: 'pointer'
                                    }}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    disabled={isReconciling}
                                    onClick={handleReconcileHistorical}
                                    style={{
                                        padding: '10px 20px',
                                        borderRadius: '10px',
                                        border: 'none',
                                        background: isReconciling ? '#94A3B8' : '#059669',
                                        color: '#FFFFFF',
                                        fontWeight: '800',
                                        fontSize: '13px',
                                        cursor: isReconciling ? 'not-allowed' : 'pointer'
                                    }}
                                >
                                    {isReconciling ? 'Reconciling Records...' : 'Authorize & Reconcile All'}
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            <style jsx="true">{`

                 .sales-log-v3 { display: flex; flex-direction: column; gap: 20px; padding: 16px; }
                 .btn-download-pdf-prominent {
                     display: inline-flex;
                     align-items: center;
                     gap: 8px;
                     background: #2563EB;
                     color: #FFFFFF;
                     border: none;
                     padding: 8px 16px;
                     border-radius: 10px;
                     font-size: 13px;
                     font-weight: 700;
                     cursor: pointer;
                     box-shadow: 0 2px 8px rgba(37, 99, 235, 0.25);
                     transition: all 0.2s ease;
                 }
                 .btn-download-pdf-prominent:hover:not(:disabled) {
                     background: #1D4ED8;
                     box-shadow: 0 4px 12px rgba(37, 99, 235, 0.35);
                     transform: translateY(-1px);
                 }
                 .btn-download-pdf-prominent:disabled {
                     opacity: 0.6;
                     cursor: not-allowed;
                 }
                 .sl-active-filters {
                     display: flex;
                     gap: 10px;
                     flex-wrap: wrap;
                     margin-top: -8px;
                     margin-bottom: 8px;
                 }
                 .active-filter-badge {
                     display: inline-flex;
                     align-items: center;
                     gap: 8px;
                     background: #F0FDF4;
                     color: #166534;
                     border: 1px solid #BBF7D0;
                     padding: 6px 12px;
                     border-radius: 99px;
                     font-size: 13px;
                     font-weight: 700;
                 }
                 .btn-clear-filter {
                     background: transparent;
                     border: none;
                     color: #166534;
                     cursor: pointer;
                     display: flex;
                     align-items: center;
                     justify-content: center;
                     padding: 2px;
                     border-radius: 50%;
                     transition: background 0.2s;
                 }
                 .btn-clear-filter:hover {
                     background: rgba(22, 101, 52, 0.1);
                 }
                 .audit-highlight-badge {
                     display: inline-flex;
                     align-items: center;
                     gap: 4px;
                     font-size: 11px;
                     font-weight: 850;
                     padding: 2px 8px;
                     border-radius: 6px;
                     background: #DCFCE7;
                     color: #15803D;
                     border: 1px solid #A7F3D0;
                 }
                 .sl-desktop-row.audit-highlighted {
                     background-color: #F0FDF4 !important;
                 }
                 .sl-desktop-row.audit-highlighted:hover {
                     background-color: #DCFCE7 !important;
                 }
                 .sl-desktop-row.audit-highlighted td:first-child {
                     border-left: 4px solid #16A34A !important;
                 }
                 .sl-card-premium.audit-highlighted {
                     background-color: #F0FDF4 !important;
                     border-left: 4px solid #16A34A !important;
                 }
                 .radical-desktop-container { background: white; border-radius: 20px; border: 1px solid #e2e8f0; box-shadow: 0 4px 20px rgba(0,0,0,0.05); overflow: hidden; margin-top: 24px; }
                .rdc-header { padding: 20px 24px; border-bottom: 1px solid #f1f5f9; display: flex; justify-content: space-between; align-items: center; background: #fafafa; }
                .rdch-left h3 { font-size: 18px; font-weight: 800; color: #0f172a; margin: 0; }
                .rdch-left p { font-size: 13px; color: #64748b; font-weight: 600; margin-top: 4px; }
                .rdch-stat { font-size: 14px; color: #475569; font-weight: 600; background: #f1f5f9; padding: 8px 16px; border-radius: 10px; }
                .rdch-stat strong { color: #2563eb; font-weight: 800; }

                .radical-desktop-table { width: 100%; border-collapse: collapse; }
                .radical-desktop-table th { text-align: left; padding: 16px 24px; font-size: 12px; font-weight: 800; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.05em; background: #fafafa; }
                .radical-desktop-table td { padding: 16px 24px; font-size: 14px; color: #1e293b; border-bottom: 1px solid #f8fafc; vertical-align: middle; }
                .sl-desktop-row { cursor: pointer; transition: all 0.2s; }
                .sl-desktop-row:hover { background: #f8fafc; }
                .bill-badge { background: #f1f5f9; color: #475569; font-weight: 700; padding: 4px 10px; border-radius: 6px; font-family: monospace; font-size: 13px; }
                .cust-main { font-weight: 700; color: #0f172a; }
                .cust-sub { font-size: 11px; color: #94a3b8; font-weight: 600; }
                .items-preview { font-size: 13px; color: #64748b; font-weight: 500; max-width: 250px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
                .history-count { background: #eef2ff; color: #4f46e5; font-size: 11px; font-weight: 700; padding: 4px 8px; border-radius: 6px; }
                .amt-val { font-size: 16px; font-weight: 800; color: #0f172a; }

                .sl-mobile-only { display: flex; flex-direction: column; gap: 12px; }
                .sl-desktop-only { display: none; }
                @media (min-width: 1024px) {
                    .sl-desktop-only { display: block !important; }
                    .sl-mobile-only { display: none !important; }
                    .sales-log-v3 { padding: 24px 40px; }
                }

                .sl-header h1 { font-size: 32px; font-weight: 900; color: #0f172a; margin: 0; letter-spacing: -0.03em; }
                .sl-header p { font-size: 15px; font-weight: 600; color: #64748b; margin: 4px 0 0 0; }
                .sl-controls { display: flex; flex-direction: column; gap: 14px; width: 100%; }
                
                @media (min-width: 1024px) {
                    .sl-controls { flex-direction: row; align-items: center; justify-content: flex-start; gap: 20px; }
                    .sl-search { flex: 0 0 350px; }
                    .sl-filters { width: auto; flex: 0 0 auto; }
                }

                .sl-search { height: 42px; background: #f8fafc; border: 1.5px solid #e2e8f0; border-radius: 99px; display: flex; align-items: center; padding: 0 16px; gap: 10px; box-sizing: border-box; }
                .sl-search input { border: none; outline: none; flex: 1; font-size: 14px; font-weight: 600; background: transparent; color: #1e293b; }
                .sl-filters { display: flex; gap: 8px; overflow-x: auto; padding-bottom: 4px; -webkit-overflow-scrolling: touch; flex-shrink: 0; }
                .sl-filters::-webkit-scrollbar { display: none; }
                .sl-pill { flex: 0 0 auto; height: 36px; padding: 0 16px; border: 1.5px solid #e2e8f0; background: white; border-radius: 99px; font-size: 13px; font-weight: 700; color: #64748b; cursor: pointer; white-space: nowrap; transition: all 0.2s; display: flex; align-items: center; justify-content: center; }
                .sl-pill.active { background: #2563eb; color: white; border-color: #2563eb; box-shadow: 0 4px 12px rgba(37, 99, 235, 0.2); }
                .compact-2x2-container { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; background: white; border-radius: 18px; padding: 16px; border: 1.5px solid #e2e8f0; box-shadow: 0 4px 12px rgba(0,0,0,0.03); }
                @media (min-width: 1024px) { .compact-2x2-container { display: none !important; } }
                .mini-stat-card { display: flex; flex-direction: column; gap: 4px; }
                .mini-stat-label { font-size: 12px; color: #64748b; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; }
                .mini-stat-val { font-size: 18px; font-weight: 800; color: #0f172a; }
                .mini-stat-val.profit { color: #16a34a; }
                .sl-summary-grid { display: none; }
                @media (min-width: 1024px) { .sl-summary-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; width: 100%; } }
                .sl-sum-card { background: white; border: 1.5px solid #e2e8f0; border-radius: 16px; padding: 16px; display: flex; flex-direction: column; justify-content: center; min-height: 90px; box-sizing: border-box; }
                .sl-sum-label { font-size: 13px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em; }
                .sl-sum-val { font-size: 24px; font-weight: 900; color: #0f172a; margin-top: 4px; letter-spacing: -0.02em; }
                .sl-sum-val.profit { color: #16a34a; }
                .sl-custom-date { display: flex; align-items: center; gap: 10px; background: #f8fafc; padding: 12px 16px; border-radius: 12px; border: 1.5px solid #e2e8f0; width: 100%; box-sizing: border-box; }
                .sl-custom-date label { font-size: 14px; font-weight: 700; color: #475569; display: flex; align-items: center; gap: 6px; }
                .sl-custom-date input { border: none; font-size: 14px; font-weight: 700; color: #1e293b; outline: none; background: transparent; }
                .sl-card-premium { background: white; border: 1.5px solid #e2e8f0; border-radius: 18px; padding: 16px; display: flex; flex-direction: column; gap: 10px; cursor: pointer; width: 100%; box-sizing: border-box; box-shadow: 0 4px 12px rgba(0,0,0,0.03); }
                .sl-card-top { display: flex; justify-content: space-between; align-items: flex-start; }
                .sl-card-amount-wrap { display: flex; align-items: center; gap: 8px; }
                .sl-card-name { font-size: 16px; font-weight: 800; color: #0f172a; max-width: 70%; line-height: 1.2; }
                .sl-card-amount { font-size: 18px; font-weight: 800; color: #0f172a; }
                .sl-card-mid { font-size: 14px; font-weight: 600; color: #64748b; }
                .sl-card-bot { border-top: 1.5px dashed #f1f5f9; padding-top: 10px; }
                .sl-card-meta { display: flex; align-items: center; gap: 8px; font-size: 12px; font-weight: 700; color: #64748b; }
                .divider-dot { color: #cbd5e1; }
                .sl-cp-pay-badge { font-size: 11px; font-weight: 800; padding: 4px 10px; border-radius: 6px; text-transform: uppercase; background: #f1f5f9; color: #475569; }
                .sl-cp-pay-badge.cash { background: #f0fdf4; color: #16a34a; }
                .sl-cp-pay-badge.khata { background: #fff7ed; color: #ea580c; }
                .sl-cp-pay-badge.upi { background: #eff6ff; color: #2563eb; }
                .sl-load-more { width: 100%; padding: 14px; border-radius: 12px; border: 1.5px solid #e2e8f0; background: white; font-weight: 700; font-size: 15px; color: #475569; cursor: pointer; margin-top: 10px; }
                
                /* Desktop Table Styles */
                .sl-table-desktop-wrapper { 
                    background: white; 
                    border: 1.5px solid #e2e8f0; 
                    border-radius: 20px; 
                    overflow: hidden; 
                    box-shadow: 0 4px 12px rgba(0,0,0,0.03); 
                    margin-top: 24px;
                }
                .sl-desktop-table { 
                    width: 100%; 
                    border-collapse: collapse; 
                    text-align: left; 
                }
                .sl-desktop-table th { 
                    background: #f8fafc; 
                    padding: 16px 20px; 
                    font-size: 12px; 
                    font-weight: 800; 
                    color: #64748b; 
                    text-transform: uppercase; 
                    border-bottom: 1.5px solid #e2e8f0; 
                }
                .sl-desktop-table td { 
                    padding: 18px 20px; 
                    font-size: 14px; 
                    color: #334155; 
                    border-bottom: 1.5px solid #e2e8f0; 
                }
                .sl-desktop-row { cursor: pointer; transition: background 0.2s; }
                .sl-desktop-row:hover { background: #f8fafc; }

                .sld-bill { font-weight: 800; color: #2563eb; width: 100px; }
                .sld-cust { font-weight: 700; color: #0f172a; width: 150px; }
                .sld-time { color: #64748b; width: 100px; }
                .sld-items { color: #475569; max-width: 350px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
                .sld-pay { width: 100px; }
                .sld-amt { font-weight: 800; color: #0f172a; font-size: 16px; text-align: right; width: 120px; }

                /* Transaction Details Modal & Sheet */
                .sl-modal-overlay { 
                    position: fixed; 
                    inset: 0; 
                    z-index: 5000; 
                    display: flex; 
                    align-items: flex-end; 
                    justify-content: center; 
                }
                .sl-backdrop { 
                    position: absolute; 
                    inset: 0; 
                    background: rgba(15, 23, 42, 0.6); 
                    backdrop-filter: blur(8px); 
                }
                .sl-sheet { 
                    position: relative; 
                    background: white; 
                    width: 100%; 
                    max-width: 100%; 
                    border-radius: 24px 24px 0 0; 
                    display: flex; 
                    flex-direction: column; 
                    box-shadow: 0 -12px 32px rgba(0,0,0,0.15); 
                    max-height: 92vh; 
                    overflow: hidden; 
                }
                .sl-sheet-handle { 
                    width: 40px; 
                    height: 5px; 
                    background: #E2E8F0; 
                    border-radius: 10px; 
                    margin: 12px auto; 
                    flex-shrink: 0; 
                }


                .sl-m-header-v2 { padding: 12px 24px 16px; display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 1px solid #f1f5f9; flex-shrink: 0; }
                .sl-m-content-v2 { flex: 1; overflow-y: auto; padding: 20px 24px; display: flex; flex-direction: column; gap: 20px; }
                .sl-m-actions-v3 { padding: 16px 24px; background: white; border-top: 1px solid #f1f5f9; display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; flex-shrink: 0; padding-bottom: calc(16px + env(safe-area-inset-bottom)); }

                .sl-summary-compact { display: flex; flex-direction: column; gap: 8px; background: #F8FAFC; padding: 12px 16px; border-radius: 12px; }
                .ssc-row { display: flex; justify-content: space-between; align-items: center; }
                .ssc-label { font-size: 12px; font-weight: 700; color: #64748b; }
                .ssc-val { font-size: 13px; font-weight: 800; color: #1e293b; }
                .ssc-badge { font-size: 10px; font-weight: 800; padding: 2px 8px; border-radius: 6px; text-transform: uppercase; }
                .ssc-badge.paid { background: #dcfce7; color: #166534; }
                .ssc-badge.khata { background: #fff7ed; color: #9a3412; }
                .ssc-badge.pending { background: #fee2e2; color: #991b1b; }
                .ssc-badge.upi { background: #dbeafe; color: #1e40af; }
                .ssc-badge.cash { background: #dcfce7; color: #166534; }

                .sl-khata-info-row-v2 { display: flex; justify-content: space-between; align-items: center; background: #fff1f2; padding: 10px 16px; border-radius: 10px; border: 1px solid #fecaca; }
                .sl-khata-info-row-v2 .skir-left { display: flex; align-items: center; gap: 8px; font-size: 12px; font-weight: 700; color: #991b1b; }

                .sl-items-table-v2 { display: flex; flex-direction: column; gap: 8px; }
                .sit-header-v2 { display: grid; grid-template-columns: 1.5fr 1fr 1fr; font-size: 11px; font-weight: 800; color: #94a3b8; text-transform: uppercase; padding-bottom: 8px; border-bottom: 1px solid #f1f5f9; }
                .sit-list-v2 { display: flex; flex-direction: column; }
                .sit-row-v2 { display: grid; grid-template-columns: 1.5fr 1fr 1fr; padding: 10px 0; border-bottom: 1px solid #f8fafc; align-items: center; }
                .sit-col-name { font-size: 13px; font-weight: 700; color: #1e293b; }
                .sit-col-rate { font-size: 11px; color: #64748b; font-weight: 600; }
                .sit-col-total { font-size: 13px; font-weight: 800; color: #1e293b; text-align: right; }

                .sl-billing-summary-v2 { display: flex; flex-direction: column; gap: 10px; padding-top: 12px; border-top: 2px dashed #f1f5f9; }
                .sbs-row { display: flex; justify-content: space-between; align-items: center; font-size: 13px; color: #64748b; font-weight: 600; }
                .sbs-row.total { background: #1e293b; color: white; padding: 12px 16px; border-radius: 12px; }
                .sbs-row.total strong { font-size: 18px; }

                .sl-id-expand-v2 { font-size: 11px; color: #94a3b8; cursor: pointer; }
                .sl-id-expand-v2 summary { font-weight: 700; }
                .sl-id-expand-v2 code { display: block; background: #f8fafc; padding: 6px; border-radius: 6px; margin-top: 4px; overflow-x: auto; }

                .btn-v3-primary { grid-column: span 2; height: 48px; background: #2563eb; color: white; border: none; border-radius: 12px; font-weight: 700; display: flex; align-items: center; justify-content: center; gap: 8px; }
                .btn-v3-success { height: 48px; background: #10b981; color: white; border: none; border-radius: 12px; font-weight: 700; display: flex; align-items: center; justify-content: center; gap: 8px; }
                .btn-v3-secondary { height: 48px; background: #f1f5f9; color: #1e293b; border: none; border-radius: 12px; font-weight: 700; display: flex; align-items: center; justify-content: center; gap: 8px; }
                .btn-v3-text { grid-column: span 2; height: 40px; background: transparent; border: none; color: #94a3b8; font-weight: 700; }

                /* Global fix for bottom nav */
                body.modal-open .mobile-bottom-nav { 
                    display: none !important; 
                }

                @media (min-width: 1024px) {
                    .sl-modal-overlay { 
                        align-items: center; 
                        padding: 40px 24px; 
                    }
                    .sl-sheet { 
                        width: 850px; 
                        max-width: 90vw;
                        height: auto; 
                        max-height: 90vh; 
                        border-radius: 28px; 
                        box-shadow: 0 20px 60px rgba(0,0,0,0.15);
                        display: flex;
                        flex-direction: column;
                        overflow: hidden;
                    }
                    .sl-sheet-handle { display: none; }
                    .sl-m-header-v2 {
                        padding: 24px 40px;
                        border-bottom: 1px solid #f1f5f9;
                    }
                    .sl-m-content-v2 { 
                        padding: 40px !important;
                        max-height: calc(90vh - 160px);
                        overflow-y: auto;
                    }
                    .radical-details-grid {
                        grid-template-columns: repeat(4, 1fr);
                        padding: 28px;
                        gap: 32px;
                        margin-bottom: 40px;
                    }
                    .radical-invoice-table th {
                        padding: 16px 12px;
                    }
                    .radical-invoice-table td {
                        padding: 20px 12px;
                    }
                    .rit-name { font-size: 16px; }
                    .radical-summary-section {
                        margin-top: 40px;
                        gap: 12px;
                    }
                    .radical-sticky-footer {
                        padding: 24px 40px;
                        background: #f8fafc;
                    }
                }

                .radical-details-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 20px; background: #f8fafc; padding: 20px; border-radius: 12px; border: 1px solid #e2e8f0; margin-bottom: 24px; }
                .rdg-col { display: flex; flex-direction: column; gap: 4px; }
                .rdg-col label { font-size: 11px; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.05em; }
                .rdg-col span { font-size: 15px; font-weight: 700; color: #1e293b; }
                
                .method-badge { font-size: 10px; font-weight: 800; padding: 2px 8px; border-radius: 6px; width: fit-content; }
                .method-badge.cash { background: #dcfce7; color: #166534; }
                .method-badge.upi { background: #dbeafe; color: #1e40af; }
                .method-badge.khata { background: #fff7ed; color: #9a3412; }
                
                .status-badge { font-size: 11px; font-weight: 700; }
                .status-badge.paid { color: #16a34a; }
                .status-badge.pending { color: #dc2626; }

                .radical-invoice-table { width: 100%; border-collapse: collapse; margin-top: 10px; }
                .radical-invoice-table th { text-align: left; font-size: 11px; font-weight: 800; color: #94a3b8; text-transform: uppercase; padding: 12px 8px; border-bottom: 2px solid #f1f5f9; }
                .radical-invoice-table td { padding: 16px 8px; border-bottom: 1px solid #f1f5f9; vertical-align: top; }
                .rit-name { font-size: 14px; font-weight: 700; color: #1e293b; }
                .rit-unit { font-size: 11px; color: #94a3b8; font-weight: 600; }

                .radical-summary-section { margin-top: 24px; display: flex; flex-direction: column; gap: 8px; align-items: flex-end; }
                .rs-row { display: flex; justify-content: space-between; width: 240px; font-size: 14px; font-weight: 600; color: #64748b; }
                .rs-row.grand { margin-top: 8px; padding-top: 12px; border-top: 2px solid #f1f5f9; color: #0f172a; }
                .rs-row.grand strong { font-size: 20px; font-weight: 900; }
                .rs-row.discount { color: #16a34a; }

                .radical-sticky-footer { padding: 16px 24px; background: white; border-top: 1px solid #f1f5f9; display: flex; gap: 12px; justify-content: flex-end; flex-shrink: 0; }
                @media (max-width: 1024px) {
                    .radical-sticky-footer { display: grid; grid-template-columns: 1fr 1fr; }
                    .r-btn-primary { grid-column: span 2; }
                }

                .r-btn { height: 44px; padding: 0 20px; border-radius: 10px; font-size: 14px; font-weight: 700; display: flex; align-items: center; justify-content: center; gap: 8px; cursor: pointer; transition: all 0.2s; border: none; }
                .r-btn-primary { background: #2563eb; color: white; }
                .r-btn-success { background: #10b981; color: white; }
                .r-btn-secondary { background: #f1f5f9; color: #475569; }
                .r-btn-outline { background: white; border: 1.5px solid #e2e8f0; color: #64748b; }
                .r-btn:active { transform: scale(0.97); }

                .pis-footer {
                    text-align: center;
                    margin-top: 10px;
                    display: flex;
                    flex-direction: column;
                    gap: 4px;
                }

                .pis-thanks {
                    font-size: 13px;
                    font-weight: 800;
                    margin: 0;
                }

                .pis-terms {
                    font-size: 10px;
                    font-weight: 600;
                    margin: 0 0 20px 0;
                }

                .pis-signatures {
                    display: flex;
                    justify-content: space-between;
                    margin-top: 30px;
                }

                .pis-sig-box {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    gap: 4px;
                }

                .pis-sig-line {
                    width: 100px;
                    border-top: 1px solid #000;
                }

                .pis-sig-box span { font-size: 10px; }

                /* Invoice Preview Overlays */
                .invoice-preview-screen { position: fixed; inset: 0; background: #fff; z-index: 9999; display: flex; flex-direction: column; }
                .ips-top-bar { 
                    height: 60px; 
                    background: white; 
                    border-bottom: 1px solid #EAECF0; 
                    display: flex; 
                    align-items: center; 
                    justify-content: space-between; 
                    padding: 0 20px; 
                    position: sticky;
                    top: 0;
                    z-index: 10;
                }
                .ips-back-btn { background: none; border: none; display: flex; align-items: center; gap: 8px; font-weight: 700; color: #344054; cursor: pointer; }
                .ips-content { 
                    flex: 1; 
                    padding: 16px; 
                    overflow-y: auto; 
                    display: flex; 
                    flex-direction: column;
                    align-items: center; 
                    background: #f8fafc;
                }

                .printable-invoice-sheet { 
                    background: white; 
                    width: 100%; 
                    padding: 20px; 
                    display: flex; 
                    flex-direction: column; 
                    gap: 0; 
                    font-family: 'Inter', sans-serif; 
                    color: #1e293b;
                    border-radius: 0;
                }
                
                @media (min-width: 1024px) {
                    .ips-content { padding: 40px; }
                    .printable-invoice-sheet { 
                        max-width: 600px; 
                        padding: 40px; 
                        box-shadow: 0 10px 40px rgba(0,0,0,0.05);
                        border-radius: 12px;
                        border: 1px solid #e2e8f0;
                    }
                }

                .pis-header { text-align: center; margin-bottom: 24px; border-top: 4px solid #1e3a8a; padding-top: 20px; }
                .pis-logo-circle { width: 50px; height: 50px; background: #1e3a8a; color: white; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 24px; font-weight: 900; margin: 0 auto 12px; }
                .pis-shop-name { font-size: 20px; font-weight: 900; color: #071b44; margin: 0; text-transform: uppercase; line-height: 1.2; }
                .pis-shop-address { font-size: 13px; color: #64748b; margin: 4px 0; font-weight: 500; }
                .pis-shop-contact { font-size: 12px; color: #64748b; font-weight: 600; }
                
                .pis-divider-solid { border-top: 1.5px solid #e2e8f0; margin: 20px 0; }
                
                .pis-info-grid { display: flex; flex-direction: column; gap: 20px; margin-bottom: 30px; }
                @media (min-width: 640px) {
                    .pis-info-grid { display: grid; grid-template-columns: 1.2fr 0.8fr; gap: 30px; }
                }

                .pis-info-col { display: flex; flex-direction: column; gap: 8px; }
                .pis-info-label { font-size: 11px; font-weight: 800; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 4px; }
                .pis-info-row { display: flex; align-items: baseline; gap: 8px; font-size: 13px; }
                .pis-info-row label { color: #64748b; min-width: 90px; }
                .pis-info-row strong { color: #1e293b; font-weight: 800; }
                .pis-payment-method { color: #1e3a8a; }
                
                .pis-items-table-v2 { display: none; width: 100%; border-collapse: collapse; font-size: 13px; margin: 20px 0; }
                @media (min-width: 768px) {
                    .pis-items-table-v2 { display: table; }
                }
                .pis-items-table-v2 th { background: #071b44; color: white; padding: 12px; text-align: left; font-weight: 700; border: 1px solid #071b44; }
                .pis-items-table-v2 td { padding: 12px; border: 1px solid #e2e8f0; color: #334155; }
                .pis-items-table-v2 tr:nth-child(even) { background: #f8fafc; }

                .pis-items-mobile-list { display: flex; flex-direction: column; gap: 12px; margin: 16px 0; }
                @media (min-width: 768px) {
                    .pis-items-mobile-list { display: none; }
                }
                .pis-mobile-item-card { 
                    background: #f8fafc; 
                    border: 1px solid #e2e8f0; 
                    border-radius: 12px; 
                    padding: 16px; 
                    display: flex; 
                    flex-direction: column; 
                    gap: 12px; 
                }
                .pmic-header { display: flex; align-items: center; gap: 10px; }
                .pmic-sl { background: #071b44; color: white; width: 24px; height: 24px; border-radius: 6px; display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 800; }
                .pmic-name { font-size: 14px; font-weight: 800; color: #071b44; flex: 1; }
                .pmic-body { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
                .pmic-col { display: flex; flex-direction: column; gap: 2px; }
                .pmic-col label { font-size: 10px; font-weight: 700; color: #64748b; text-transform: uppercase; }
                .pmic-col span { font-size: 13px; font-weight: 600; color: #334155; }
                .pmic-col strong { font-size: 14px; font-weight: 800; color: #071b44; }

                .pis-summary-v2 { display: flex; justify-content: flex-end; margin-top: 20px; }
                .pis-summary-box { width: 100%; max-width: 260px; display: flex; flex-direction: column; gap: 8px; }
                .pis-sum-row { display: flex; justify-content: space-between; font-size: 14px; font-weight: 600; color: #64748b; }
                .pis-sum-row.discount { color: #16a34a; }
                .pis-sum-row.grand { 
                    margin-top: 8px; 
                    padding: 12px 16px; 
                    border-top: 2px solid #071b44; 
                    font-size: 18px; 
                    font-weight: 900; 
                    color: white; 
                    background: #071b44; 
                    border-radius: 8px; 
                    box-shadow: 0 4px 12px rgba(7, 27, 68, 0.2);
                }

                .pis-footer-v2 { text-align: center; margin-top: 40px; padding-bottom: 20px; }
                .pis-footer-divider { border-top: 1.5px solid #e2e8f0; margin-bottom: 20px; }
                .pis-footer-v2 h3 { font-size: 16px; font-weight: 800; color: #071b44; margin: 0 0 8px 0; }
                .pis-footer-v2 p { font-size: 11px; color: #94a3b8; margin: 2px 0; font-weight: 600; }
                .pis-brand-footer { margin-top: 12px; font-size: 10px; font-weight: 800; color: #cbd5e1; text-transform: uppercase; letter-spacing: 1px; }

                .ips-actions-bar {
                    background: white;
                    padding: 16px;
                    display: grid;
                    grid-template-columns: repeat(2, 1fr);
                    gap: 10px;
                    border-top: 1.5px solid #e2e8f0;
                    box-shadow: 0 -4px 20px rgba(0,0,0,0.05);
                    position: sticky;
                    bottom: 0;
                    z-index: 10;
                    padding-bottom: calc(16px + env(safe-area-inset-bottom));
                }
                @media (min-width: 640px) {
                    .ips-actions-bar { grid-template-columns: repeat(4, 1fr); padding: 20px 40px; }
                }

                .ips-btn {
                    height: 44px;
                    border-radius: 8px;
                    border: none;
                    font-size: 13px;
                    font-weight: 700;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 6px;
                    color: white;
                    transition: transform 0.1s;
                }
                .ips-btn:active { transform: scale(0.96); }

                .ips-wa { background: #12B76A; }
                .ips-wa:hover { background: #0ca35d; }
                .ips-pdf { background: #475467; }
                .ips-print { background: #1E6BFF; }
                .ips-close { background: white; color: #344054; border: 1.5px solid #D0D5DD; }

                @media print {
                    .ips-top-bar, .ips-actions-bar {
                        display: none !important;
                    }
                    .invoice-preview-screen {
                        position: absolute;
                        inset: 0;
                        background: white;
                    }
                    .ips-content {
                        background: white;
                        padding: 0;
                        overflow: visible;
                    }
                    .printable-invoice-sheet {
                        box-shadow: none;
                        border: none;
                        padding: 0;
                        max-width: 100%;
                        min-height: auto;
                        border-radius: 0;
                        font-family: 'Courier New', Courier, monospace;
                    }
                    .pis-items-table-v2 {
                        display: table !important;
                    }
                    .pis-items-mobile-list {
                        display: none !important;
                    }
                }

                @media (max-width: 380px) {
                    .sl-summary-grid { grid-template-columns: 1fr; }
                }

                /* Mobile Optimization - Ultra Compact ERP UI */
                @media (max-width: 768px) {
                    .sales-log-v3 { padding: 12px; padding-bottom: 90px; }
                    .sl-header { position: sticky; top: 0; background: #f8fafc; z-index: 100; padding: 12px 0; margin-bottom: 8px; }
                    .sl-header h1 { font-size: 20px; }
                    .sl-header p { font-size: 11px; margin-top: 2px; }

                    .sl-controls { gap: 10px; }
                    .sl-search { height: 44px; padding: 0 12px; border-radius: 12px; }
                    .sl-search input { font-size: 13px; }
                    .sl-filters { padding-bottom: 4px; }
                    .sl-pill { height: 32px; padding: 0 12px; font-size: 12px; border-radius: 8px; }

                    .compact-2x2-container { padding: 12px; border-radius: 14px; gap: 10px; }
                    .mini-stat-label { font-size: 10px; }
                    .mini-stat-val { font-size: 16px; }

                    .sl-custom-date { padding: 10px 12px; border-radius: 10px; }
                    .sl-custom-date label, .sl-custom-date input { font-size: 12px; }

                    .sl-mobile-only { gap: 8px; }
                    .sl-card-premium { padding: 12px; border-radius: 16px; gap: 8px; }
                    .sl-card-name { font-size: 14px; }
                    .sl-card-amount { font-size: 15px; }
                    .sl-card-mid { font-size: 12px; }
                    .sl-card-bot { padding-top: 8px; }
                    .sl-card-meta { font-size: 11px; }
                    .sl-cp-pay-badge { font-size: 9px; padding: 2px 8px; }

                    .sl-m-header-v2 { padding: 12px 16px; }
                    .sl-m-content-v2 { padding: 16px; gap: 16px; }
                    
                    .radical-details-grid { padding: 12px; grid-template-columns: 1fr 1fr; gap: 12px; border-radius: 12px; }
                    .rdg-col label { font-size: 9px; }
                    .rdg-col span { font-size: 13px; }

                    .radical-invoice-table th, .radical-invoice-table td { padding: 12px 4px; font-size: 12px; }
                    .rit-name { font-size: 13px; }
                    .radical-summary-section { margin-top: 16px; }
                    .rs-row { width: 180px; font-size: 12px; }
                    .rs-row.grand strong { font-size: 16px; }

                    .sl-m-actions-v3 { padding: 12px 16px; }
                    .btn-v3-primary, .btn-v3-success, .btn-v3-secondary { height: 44px; font-size: 13px; border-radius: 10px; }
                }
            `}</style>
        </div>
    );
};

export default GovSalesLogPage;
