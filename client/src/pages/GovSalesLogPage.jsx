import React, { useState, useEffect } from 'react';
import { 
    Search, 
    Calendar, 
    X, 
    Receipt,
    MessageSquare,
    ChevronLeft,
    ShieldCheck,
    ChevronRight
} from 'lucide-react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { govSaleService, shopService } from '../services/api';
import { offlineDB } from '../services/offlineDB';
import { motion, AnimatePresence } from 'framer-motion';
import { EmptyState, Skeleton, PageHeader } from '../components/PremiumUI';
import { useScrollLock } from '../hooks/useScrollLock';
import { invoiceService } from '../utils/invoiceService';

const GovSalesLogPage = () => {
    const { shopId } = useParams();
    const navigate = useNavigate();
    const [sales, setSales] = useState([]);
    const [shop, setShop] = useState(null);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    
    // View Bill State
    const [selectedSaleForInvoice, setSelectedSaleForInvoice] = useState(null);
    const [isInvoiceOpen, setIsInvoiceOpen] = useState(false);
    const [isInspectionCopy, setIsInspectionCopy] = useState(true);
    
    // Filters & Pagination
    const [searchParams] = useSearchParams();
    const initialDate = searchParams.get('date');
    const initialProduct = searchParams.get('product');
    const [productFilter, setProductFilter] = useState(initialProduct || '');
    const [periodFilter, setPeriodFilter] = useState(initialDate ? 'custom' : 'month'); 
    const [paymentFilter, setPaymentFilter] = useState('All'); 
    const getLocalToday = () => {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    };
    const [customDate, setCustomDate] = useState(initialDate || getLocalToday());
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
                setCustomDate(yyyymmdd);
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

            const [salesRes, shopsRes] = await Promise.all([
                govSaleService.getAll(shopId),
                shopService.getAll()
            ]);
            setSales(salesRes.data.data || []);
            if (shopsRes.data?.data) {
                setShop(shopsRes.data.data.find(s => s._id === shopId));
            }
        } catch (err) {
            console.error('Error fetching government sales data:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleViewBill = (sale) => {
        if (!sale) return;
        setSelectedSaleForInvoice(sale);
        setIsInspectionCopy(sale.isInspectionCopy !== undefined ? sale.isInspectionCopy : true);
        setIsInvoiceOpen(true);
    };

    const handleDownloadPDF = (sale) => {
        if (!sale) return;
        invoiceService.downloadInvoice(sale, shop, 'GOV_SALE', { isInspectionCopy });
    };

    const handleShareWhatsApp = (sale) => {
        if (!sale) return;
        invoiceService.shareInvoice(sale, shop, 'GOV_SALE', { isInspectionCopy });
    };

    const filteredSales = sales.filter(sale => {
        const saleDate = new Date(sale.date);
        const now = new Date();
        let matchesPeriod = false;

        if (periodFilter === 'today') {
            matchesPeriod = saleDate.getFullYear() === now.getFullYear() &&
                            saleDate.getMonth() === now.getMonth() &&
                            saleDate.getDate() === now.getDate();
        } else if (periodFilter === 'yesterday') {
            const yesterday = new Date();
            yesterday.setDate(now.getDate() - 1);
            matchesPeriod = saleDate.getFullYear() === yesterday.getFullYear() &&
                            saleDate.getMonth() === yesterday.getMonth() &&
                            saleDate.getDate() === yesterday.getDate();
        } else if (periodFilter === 'week') {
            const oneWeekAgo = new Date();
            oneWeekAgo.setDate(now.getDate() - 7);
            matchesPeriod = saleDate >= oneWeekAgo;
        } else if (periodFilter === 'month') {
            const oneMonthAgo = new Date();
            oneMonthAgo.setMonth(now.getMonth() - 1);
            matchesPeriod = saleDate >= oneMonthAgo;
        } else if (periodFilter === 'custom') {
            const target = new Date(customDate);
            matchesPeriod = saleDate.getFullYear() === target.getFullYear() &&
                            saleDate.getMonth() === target.getMonth() &&
                            saleDate.getDate() === target.getDate();
        } else if (periodFilter === 'all') {
            matchesPeriod = true;
        }

        const isQueryValidAadhaar = searchQuery.toLowerCase() === 'valid';
        const isQueryInvalidAadhaar = searchQuery.toLowerCase() === 'invalid';
        
        let matchesAadhaarStatus = false;
        if (isQueryValidAadhaar) {
            matchesAadhaarStatus = sale.customerAadhaar && /^\d{12}$/.test(sale.customerAadhaar.trim());
        } else if (isQueryInvalidAadhaar) {
            matchesAadhaarStatus = sale.customerAadhaar && !/^\d{12}$/.test(sale.customerAadhaar.trim());
        }

        const matchesSearch = searchQuery === '' || 
            (sale.customerName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
            (sale.invoiceNumber || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
            (sale.customerAadhaar || '').includes(searchQuery) ||
            matchesAadhaarStatus;

        const matchesPayment = paymentFilter === 'All' || 
            (sale.paymentMethod && sale.paymentMethod.toLowerCase() === paymentFilter.toLowerCase());

        const matchesProduct = !productFilter || (sale.items || []).some(item => 
            (item.productName || '').toLowerCase().includes(productFilter.toLowerCase())
        );

        return matchesPeriod && matchesSearch && matchesPayment && matchesProduct;
    }).sort((a, b) => new Date(b.date) - new Date(a.date));

    const paginatedSales = filteredSales.slice(0, page * itemsPerPage);

    const totalAmount = filteredSales.reduce((sum, s) => sum + (s.totalAmount || 0), 0);
    const totalOrders = filteredSales.length;
    const totalItems = filteredSales.reduce((sum, s) => sum + (s.items || []).reduce((iSum, item) => iSum + (item.soldQtyEntered || item.quantity || 0), 0), 0);

    return (
        <div className="sales-log-v3">
            <PageHeader 
                title="Government Sales Ledger"
                subtitle="Official inspection-ready transactions"
                backAction={() => navigate(-1)}
                actions={
                    <div className="sl-filters hide-mobile">
                        {['today', 'yesterday', 'week', 'month'].map(id => (
                            <button 
                                key={id} 
                                className={`sl-pill ${periodFilter === id ? 'active' : ''}`}
                                onClick={() => { setPeriodFilter(id); setPage(1); }}
                            >
                                {id === 'week' ? '7D' : id.charAt(0).toUpperCase() + id.slice(1)}
                            </button>
                        ))}
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
                        { id: 'yesterday', label: 'Yesterday' },
                        { id: 'week', label: '7D' },
                        { id: 'month', label: 'Month' },
                    ].map(p => (
                        <button 
                            key={p.id} 
                            className={`sl-pill ${periodFilter === p.id ? 'active' : ''}`}
                            onClick={() => { setPeriodFilter(p.id); setPage(1); }}
                        >
                            {p.label}
                        </button>
                    ))}
                    <button 
                        className={`sl-pill sl-pill-cal ${periodFilter === 'custom' ? 'active' : ''}`}
                        onClick={() => { setPeriodFilter('custom'); setPage(1); }}
                    >
                        <Calendar size={16} />
                    </button>
                </div>

                <div className="sl-filters payment-filters">
                    {['All', 'Cash', 'UPI', 'Khata'].map(p => (
                        <button 
                            key={p} 
                            className={`sl-pill ${paymentFilter === p ? 'active' : ''}`}
                            onClick={() => { setPaymentFilter(p); setPage(1); }}
                        >
                            {p}
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

            <div className="sl-summary-grid">
                <div className="sl-sum-card">
                    <span className="sl-sum-label">Total Official Sales</span>
                    <strong className="sl-sum-val">₹{totalAmount.toLocaleString()}</strong>
                </div>
                <div className="sl-sum-card">
                    <span className="sl-sum-label">Total Records</span>
                    <strong className="sl-sum-val">{totalOrders}</strong>
                </div>
                <div className="sl-sum-card">
                    <span className="sl-sum-label">Government Revenue</span>
                    <strong className="sl-sum-val profit">₹{totalAmount.toLocaleString()}</strong>
                </div>
                <div className="sl-sum-card">
                    <span className="sl-sum-label">Fertilizer Items Sold</span>
                    <strong className="sl-sum-val">{totalItems}</strong>
                </div>
            </div>

            {periodFilter === 'custom' && (
                <div className="sl-custom-date">
                    <label><Calendar size={16} /> Select Date:</label>
                    <input type="date" value={customDate} onChange={(e) => { setCustomDate(e.target.value); setPage(1); }} />
                </div>
            )}

            <div className="compact-2x2-container">
                <div className="mini-stat-card">
                    <span className="mini-stat-label">Total Official</span>
                    <strong className="mini-stat-val">₹{totalAmount.toLocaleString()}</strong>
                </div>
                <div className="mini-stat-card">
                    <span className="mini-stat-label">Total Records</span>
                    <strong className="mini-stat-val">{totalOrders}</strong>
                </div>
                <div className="mini-stat-card">
                    <span className="mini-stat-label">Gov Revenue</span>
                    <strong className="mini-stat-val profit">₹{totalAmount.toLocaleString()}</strong>
                </div>
                <div className="mini-stat-card">
                    <span className="mini-stat-label">Items Sold</span>
                    <strong className="mini-stat-val">{totalItems}</strong>
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
                    description={searchQuery ? `No records match your search "${searchQuery}".` : "No official government records for the selected period."}
                    actionLabel={searchQuery ? "Clear Search" : "Create New Sale"}
                    onAction={searchQuery ? () => setSearchQuery('') : () => window.location.href = `/shop/${shopId}/pos`}
                    secondaryActionLabel={!searchQuery ? "Change Date" : null}
                    onSecondaryAction={() => setPeriodFilter('custom')}
                />
            ) : (
                <>
                    <div className="sl-list sl-mobile-only">
                        {paginatedSales.map((sale) => {
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
                                            <div className="sl-card-amount">₹{(sale.totalAmount || 0).toLocaleString()}</div>
                                            <ChevronRight size={16} color="#98A2B3" />
                                        </div>
                                    </div>
                                    <div className="sl-card-mid">
                                        <div className="sl-card-qty">
                                            {(sale.items || []).length === 1 
                                                ? `${sale.items[0].productName} • ${sale.items[0].soldQtyEntered || sale.items[0].quantity} ${sale.items[0].soldUnit || sale.items[0].unit || 'Piece'}`
                                                : `${(sale.items || []).length} Items Purchased`}
                                        </div>
                                    </div>
                                    <div className="sl-card-bot">
                                        <div className="sl-card-meta">
                                            <span>{new Date(sale.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                            <span className="divider-dot">•</span>
                                            <span>Gov Bill #{sale.invoiceNumber || sale._id.slice(-6).toUpperCase()}</span>
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

                    <div className="sl-desktop-only radical-desktop-container">
                        <div className="rdc-header">
                            <div className="rdch-left">
                                <h3>Official Government Records</h3>
                                <p>{filteredSales.length} Records Found</p>
                            </div>
                            <div className="rdch-right">
                                <span className="rdch-stat">Total Amount: <strong>₹{totalAmount.toLocaleString()}</strong></span>
                            </div>
                        </div>
                        <table className="radical-desktop-table">
                            <thead>
                                <tr>
                                    <th>Bill No</th>
                                    <th>Customer Name</th>
                                    <th>Date & Time</th>
                                    <th style={{ width: '25%' }}>Fertilizer Items Summary</th>
                                    <th style={{ textAlign: 'center' }}>Gov Status</th>
                                    <th style={{ textAlign: 'right' }}>Amount</th>
                                </tr>
                            </thead>
                            <tbody>
                                {paginatedSales.map((sale) => {
                                    const isAuditMatched = productFilter && (sale.items || []).some(item => 
                                        (item.productName || '').toLowerCase().includes(productFilter.toLowerCase())
                                    );

                                    return (
                                        <tr 
                                            key={sale._id} 
                                            className={`sl-desktop-row ${isAuditMatched ? 'audit-highlighted' : ''}`} 
                                            onClick={() => handleViewBill(sale)}
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
                                            <td className="sld-items">
                                                <div className="items-preview">
                                                    {(sale.items || []).slice(0, 2).map(item => `${item.productName}`).join(', ')}
                                                    {sale.items?.length > 2 && ` +${sale.items.length - 2} more`}
                                                </div>
                                            </td>
                                            <td className="sld-prev" style={{ textAlign: 'center' }}>
                                                <span className="status-badge paid" style={{ background: '#ECFDF5', color: '#059669', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                                    <ShieldCheck size={14} /> Logged
                                                </span>
                                            </td>
                                            <td className="sld-amt" style={{ textAlign: 'right' }}>
                                                <div className="amt-val">₹{(sale.totalAmount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </>
            )}

            {filteredSales.length > paginatedSales.length && (
                <button className="sl-load-more" onClick={() => setPage(p => p + 1)}>
                    Load More Records
                </button>
            )}

            {/* Invoice Modal Overlay */}
            <AnimatePresence>
                {isInvoiceOpen && selectedSaleForInvoice && (
                    <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="modal-overlay-v2"
                        onClick={() => setIsInvoiceOpen(false)}
                    >
                        <motion.div 
                            initial={{ scale: 0.95, opacity: 0, y: 20 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ scale: 0.95, opacity: 0, y: 20 }}
                            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                            className="gsl-invoice-modal gov-corner-accent"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="gsl-im-header">
                                <div>
                                    <h3 style={{ margin: 0, color: '#059669', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '18px' }}>
                                        <ShieldCheck size={24} /> Government Record Copy
                                    </h3>
                                    <p style={{ margin: '4px 0 0', fontSize: '14px', color: '#047857', fontWeight: 600 }}>
                                        Bill #{selectedSaleForInvoice.invoiceNumber || selectedSaleForInvoice._id.slice(-6).toUpperCase()}
                                    </p>
                                </div>
                                <button className="gsl-close-btn" onClick={() => setIsInvoiceOpen(false)}>
                                    <X size={24} />
                                </button>
                            </div>
                            
                            <div className="gsl-im-body">
                                {isInspectionCopy && (
                                    <div className="gov-watermark-overlay">
                                        OFFICIAL INSPECTION COPY
                                    </div>
                                )}
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '24px' }}>
                                    <div>
                                        <div style={{ fontSize: '12px', fontWeight: 700, color: '#98A2B3', textTransform: 'uppercase' }}>Customer</div>
                                        <div style={{ fontWeight: 700, fontSize: '16px', color: '#101828' }}>{selectedSaleForInvoice.customerName || 'Walk-in Customer'}</div>
                                        {selectedSaleForInvoice.customerMobile && <div style={{ color: '#667085' }}>{selectedSaleForInvoice.customerMobile}</div>}
                                        {selectedSaleForInvoice.customerAadhaar && <div style={{ color: '#047857', fontWeight: 'bold', fontSize: '13px', marginTop: '4px' }}>Aadhaar: {selectedSaleForInvoice.customerAadhaar}</div>}
                                    </div>
                                    <div style={{ textAlign: 'right' }}>
                                        <div style={{ fontSize: '12px', fontWeight: 700, color: '#98A2B3', textTransform: 'uppercase' }}>Date & Time</div>
                                        <div style={{ fontWeight: 600, color: '#101828' }}>{new Date(selectedSaleForInvoice.date).toLocaleDateString('en-IN')}</div>
                                        <div style={{ color: '#667085' }}>{new Date(selectedSaleForInvoice.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                                    </div>
                                </div>

                                <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '24px' }}>
                                    <thead>
                                        <tr style={{ borderBottom: '2px solid #F2F4F7' }}>
                                            <th style={{ textAlign: 'left', padding: '12px 0', color: '#667085', fontSize: '12px', textTransform: 'uppercase' }}>Fertilizer Details</th>
                                            <th style={{ textAlign: 'center', padding: '12px 0', color: '#667085', fontSize: '12px', textTransform: 'uppercase' }}>Sold</th>
                                            <th style={{ textAlign: 'center', padding: '12px 0', color: '#667085', fontSize: '12px', textTransform: 'uppercase' }}>Returned</th>
                                            <th style={{ textAlign: 'center', padding: '12px 0', color: '#667085', fontSize: '12px', textTransform: 'uppercase' }}>Remaining</th>
                                            <th style={{ textAlign: 'right', padding: '12px 0', color: '#667085', fontSize: '12px', textTransform: 'uppercase' }}>Gov Rate</th>
                                            <th style={{ textAlign: 'right', padding: '12px 0', color: '#667085', fontSize: '12px', textTransform: 'uppercase' }}>Amount</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {(selectedSaleForInvoice.items || []).map((item, i) => {
                                            const soldVal = item.soldQtyEntered || item.quantity || 0;
                                            const returnedVal = item.returnedQty || 0;
                                            const remainingVal = item.remainingQty !== undefined ? item.remainingQty : Math.max(0, soldVal - returnedVal);
                                            const unitStr = item.soldUnit || item.unit || 'Pc';
                                            
                                            return (
                                                <tr key={i} style={{ borderBottom: '1px solid #F2F4F7' }}>
                                                    <td style={{ padding: '16px 0', fontWeight: 600, color: '#101828' }}>{item.productName}</td>
                                                    <td style={{ padding: '16px 0', textAlign: 'center', color: '#475467' }}>{soldVal} {unitStr}</td>
                                                    <td style={{ padding: '16px 0', textAlign: 'center', color: '#EF4444', fontWeight: returnedVal > 0 ? 700 : 500 }}>{returnedVal} {unitStr}</td>
                                                    <td style={{ padding: '16px 0', textAlign: 'center', color: '#059669', fontWeight: 700 }}>{remainingVal} {unitStr}</td>
                                                    <td style={{ padding: '16px 0', textAlign: 'right', color: '#475467' }}>₹{(item.pricePerBaseUnit || item.price).toFixed(2)}</td>
                                                    <td style={{ padding: '16px 0', textAlign: 'right', fontWeight: 700, color: '#101828' }}>₹{(remainingVal * (item.pricePerBaseUnit || item.price)).toFixed(2)}</td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>

                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#F0FDF4', border: '1px solid #BBF7D0', padding: '16px', borderRadius: '12px' }}>
                                    <div style={{ color: '#047857', fontWeight: 600 }}>Payment: {selectedSaleForInvoice.paymentMethod}</div>
                                    <div style={{ textAlign: 'right' }}>
                                        <span style={{ fontSize: '14px', color: '#047857', marginRight: '12px', fontWeight: 600 }}>Total Gov Amount</span>
                                        <strong style={{ fontSize: '24px', color: '#059669', fontWeight: 800 }}>₹{selectedSaleForInvoice.totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</strong>
                                    </div>
                                </div>
                            </div>
                            
                            <div className="gsl-im-footer" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', borderBottom: '1px solid #E4E7EC', paddingBottom: '12px' }}>
                                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '14px', fontWeight: 700, color: '#344054' }}>
                                        <input 
                                            type="checkbox" 
                                            checked={isInspectionCopy} 
                                            onChange={(e) => setIsInspectionCopy(e.target.checked)}
                                            style={{ width: '18px', height: '18px', accentColor: '#059669', cursor: 'pointer' }}
                                        />
                                        <span>Apply Official Inspection Watermark</span>
                                    </label>
                                </div>
                                <div style={{ display: 'flex', gap: '12px', width: '100%' }}>
                                    <button 
                                        className="gsl-print-btn"
                                        style={{ flex: 1 }}
                                        onClick={() => handleDownloadPDF(selectedSaleForInvoice)}
                                    >
                                        Print Government Copy
                                    </button>
                                    <button 
                                        className="gsl-wa-btn"
                                        style={{ flex: 1 }}
                                        onClick={() => handleShareWhatsApp(selectedSaleForInvoice)}
                                    >
                                        <MessageSquare size={18} /> Download / Share PDF
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            <style jsx="true">{`

                 .sales-log-v3 { display: flex; flex-direction: column; gap: 20px; padding: 16px; }
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
                    .payment-filters { margin-left: auto; }
                }

                .sl-search { height: 42px; background: #f8fafc; border: 1.5px solid #e2e8f0; border-radius: 99px; display: flex; align-items: center; padding: 0 16px; gap: 10px; box-sizing: border-box; }
                .sl-search input { border: none; outline: none; flex: 1; font-size: 14px; font-weight: 600; background: transparent; color: #1e293b; }
                .sl-filters { display: flex; gap: 8px; overflow-x: auto; padding-bottom: 4px; -webkit-overflow-scrolling: touch; flex-shrink: 0; }
                .sl-filters::-webkit-scrollbar { display: none; }
                .payment-filters { border-left: 0; padding-left: 0; }
                @media (min-width: 1024px) {
                    .payment-filters { border-left: 1.5px solid #e2e8f0; padding-left: 20px; }
                }
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
            

                /* MODAL STYLES & GOV DECORATION */
                .modal-overlay-v2 { position: fixed; inset: 0; z-index: 7000; display: flex; align-items: center; justify-content: center; background: rgba(15, 23, 42, 0.6); backdrop-filter: blur(4px); padding: 20px; }
                .gsl-invoice-modal { background: white; border-radius: 16px; width: 100%; max-width: 700px; max-height: 90vh; display: flex; flex-direction: column; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.25); overflow: hidden; border-top: 6px solid #10B981; }
                .gsl-im-header { padding: 20px 24px; border-bottom: 1px solid #E4E7EC; display: flex; justify-content: space-between; align-items: center; background: #ECFDF5; }
                .gsl-close-btn { background: transparent; border: none; cursor: pointer; color: #047857; width: 36px; height: 36px; border-radius: 8px; display: flex; align-items: center; justify-content: center; transition: 0.2s; }
                .gsl-close-btn:hover { background: #D1FAE5; }
                .gsl-im-body { position: relative; padding: 24px; overflow-y: auto; flex: 1; }
                .gov-watermark-overlay {
                    position: absolute;
                    top: 50%;
                    left: 50%;
                    transform: translate(-50%, -50%) rotate(-30deg);
                    font-size: 32px;
                    font-weight: 900;
                    color: rgba(239, 68, 68, 0.12); /* Semi-transparent light red */
                    border: 4px solid rgba(239, 68, 68, 0.12);
                    padding: 10px 20px;
                    text-transform: uppercase;
                    pointer-events: none;
                    white-space: nowrap;
                    z-index: 10;
                    user-select: none;
                    letter-spacing: 2px;
                }
                .gsl-im-footer { padding: 20px 24px; border-top: 1px solid #E4E7EC; display: flex; gap: 16px; background: #F9FAFB; }
                
                .gsl-print-btn { flex: 1; padding: 12px; background: white; border: 1px solid #D0D5DD; border-radius: 8px; font-weight: 700; display: flex; align-items: center; justify-content: center; gap: 8px; cursor: pointer; color: #344054; transition: 0.2s; }
                .gsl-print-btn:hover { background: #F9FAFB; border-color: #98A2B3; }
                
                .gsl-wa-btn { flex: 1; padding: 12px; background: #10B981; border: none; border-radius: 8px; font-weight: 700; display: flex; align-items: center; justify-content: center; gap: 8px; cursor: pointer; color: white; transition: 0.2s; }
                .gsl-wa-btn:hover { background: #059669; }

                @media (max-width: 768px) {
                    .modal-overlay-v2 { padding: 0; align-items: flex-end; }
                    .gsl-invoice-modal { max-width: 100%; border-radius: 20px 20px 0 0; max-height: 90vh; border-top: none; }
                }

                /* Decorative Curved Corner Accent */
                .gov-corner-accent {
                    position: relative;
                    overflow: hidden;
                }
                .gov-corner-accent::before {
                    content: '';
                    position: absolute;
                    bottom: -10px;
                    right: -10px;
                    width: 180px;
                    height: 180px;
                    background: linear-gradient(135deg, rgba(37, 99, 235, 0.1), rgba(37, 99, 235, 0.02));
                    border-top-left-radius: 120px;
                    z-index: 0;
                    pointer-events: none;
                }
                .gov-corner-accent::after {
                    content: '';
                    position: absolute;
                    bottom: -5px;
                    right: -5px;
                    width: 100px;
                    height: 100px;
                    background: linear-gradient(135deg, rgba(37, 99, 235, 0.2), rgba(37, 99, 235, 0.05));
                    border-top-left-radius: 80px;
                    z-index: 0;
                    pointer-events: none;
                }
                .gov-corner-accent > * {
                    position: relative;
                    z-index: 1;
                }
            `}</style>
        </div>
    );
};

export default GovSalesLogPage;
