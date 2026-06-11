import React, { useState, useEffect } from 'react';
import { 
    Search, 
    Calendar, 
    X, 
    Wallet, 
    CreditCard, 
    ChevronRight,
    ChevronLeft,
    Receipt,
    History,
    Plus,
    ShoppingCart,
    Building2,
    Truck,
    Package,
    ArrowUpRight,
    CheckCircle,
    MoreHorizontal,
    IndianRupee
} from 'lucide-react';
import { useParams, useNavigate } from 'react-router-dom';
import { purchaseService, productService, shopService } from '../services/api';
import { offlineDB } from '../services/offlineDB';
import { motion, AnimatePresence } from 'framer-motion';
import { EmptyState, Skeleton, PageHeader, CustomSelect, PremiumDatePicker, MessageModal } from '../components/PremiumUI';
import { useScrollLock } from '../hooks/useScrollLock';
import { invoiceService } from '../utils/invoiceService';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import { useToast } from '../context/ToastContext';

const PurchaseLedgerPage = () => {
    const { shopId } = useParams();
    const navigate = useNavigate();
    const { showToast } = useToast();
    const [purchases, setPurchases] = useState([]);
    const [products, setProducts] = useState([]);
    const [shop, setShop] = useState(null);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedPurchase, setSelectedPurchase] = useState(null);
    const [periodFilter, setPeriodFilter] = useState('today');
    const getLocalToday = () => {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    };

    const [customDate, setCustomDate] = useState(getLocalToday());
    const [paymentStatusFilter, setPaymentStatusFilter] = useState('All');
    const [entryTypeFilter, setEntryTypeFilter] = useState('All');
    const [page, setPage] = useState(1);
    const [isMobile, setIsMobile] = useState(window.innerWidth < 1024);
    
    const [showAddModal, setShowAddModal] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [purchaseForm, setPurchaseForm] = useState({
        supplierName: '',
        supplierPhone: '',
        billNo: '',
        date: getLocalToday(),
        paymentMethod: 'Cash',
        paymentStatus: 'Paid',
        items: []
    });

    const [itemInput, setItemInput] = useState({
        product: '',
        productName: '',
        quantity: '',
        purchaseRate: '',
        unit: 'Piece'
    });

    const [showReceivePayment, setShowReceivePayment] = useState(false);
    const [paymentInput, setPaymentInput] = useState({ amount: '', mode: 'Cash', note: '' });
    const [selectedSupplierFilter, setSelectedSupplierFilter] = useState('All');
    const [activeTab, setActiveTab] = useState('purchases');
    const [selectedSupplierForLedger, setSelectedSupplierForLedger] = useState(null);
    const [supplierLedgerSearch, setSupplierLedgerSearch] = useState('');
    const [alertConfig, setAlertConfig] = useState({ open: false, title: '', message: '', type: 'info' });

    useScrollLock(showAddModal || !!selectedPurchase || showReceivePayment || !!selectedSupplierForLedger);

    const itemsPerPage = 20;

    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth < 1024);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    useEffect(() => {
        fetchInitialData();
        const params = new URLSearchParams(window.location.search);
        if (params.get('add') === 'true') {
            setShowAddModal(true);
        }
    }, [shopId]);

    const fetchInitialData = async () => {
        try {
            // Offline-first load: Instant render from local IndexedDB
            const localPurchases = await offlineDB.getPurchases(shopId);
            const localProducts = await offlineDB.getProducts(shopId);
            const localShops = await offlineDB.getShops();
            
            if (localPurchases && localPurchases.length > 0) {
                setPurchases(localPurchases);
            }
            if (localProducts && localProducts.length > 0) {
                setProducts(localProducts);
            }
            const activeShop = localShops.find(s => s._id === shopId);
            if (activeShop) setShop(activeShop);
            
            if ((localPurchases && localPurchases.length > 0) || (localProducts && localProducts.length > 0)) {
                setLoading(false);
            }

            const [purRes, prodRes, shopsRes] = await Promise.all([
                purchaseService.getAll(shopId),
                productService.getAll(shopId),
                shopService.getAll()
            ]);
            setPurchases(purRes.data.data || []);
            setProducts(prodRes.data.data || []);
            if (shopsRes.data?.data) {
                setShop(shopsRes.data.data.find(s => s._id === shopId));
            }
        } catch (err) {
            console.error('Error fetching data:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleAddItem = () => {
        if (!itemInput.productName || !itemInput.quantity || !itemInput.purchaseRate) {
            showToast('Please fill item details', 'warning');
            return;
        }

        const newItem = {
            product: itemInput.product || null,
            productName: itemInput.productName,
            quantity: parseFloat(itemInput.quantity),
            purchaseRate: parseFloat(itemInput.purchaseRate),
            unit: itemInput.unit,
            itemTotal: parseFloat(itemInput.quantity) * parseFloat(itemInput.purchaseRate)
        };

        setPurchaseForm(prev => ({
            ...prev,
            items: [...prev.items, newItem]
        }));

        setItemInput({
            product: '',
            productName: '',
            quantity: '',
            purchaseRate: '',
            unit: 'Piece'
        });
    };

    const handleRemoveItem = (index) => {
        setPurchaseForm(prev => ({
            ...prev,
            items: prev.items.filter((_, i) => i !== index)
        }));
    };
    const handleReceivePayment = async (e) => {
        e.preventDefault();
        if (isSaving) return;
        if (!paymentInput.amount || parseFloat(paymentInput.amount) <= 0) {
            showToast('Please enter a valid amount', 'warning');
            return;
        }
        try {
            setIsSaving(true);
            const res = await purchaseService.addPayment(selectedPurchase._id, {
                amount: parseFloat(paymentInput.amount),
                mode: paymentInput.mode,
                note: paymentInput.note
            });
            if (res.data.success) {
                setPurchases(purchases.map(p => p._id === selectedPurchase._id ? res.data.data : p));
                setSelectedPurchase(res.data.data);
                setPaymentInput({ amount: '', mode: 'Cash', note: '' });
                setShowReceivePayment(false);
                showToast('Payment recorded successfully', 'success');
            }
        } catch (err) {
            showToast(err.response?.data?.message || 'Error recording payment', 'error');
        } finally {
            setIsSaving(false);
        }
    };
    const handleSavePurchase = async (e) => {
        e.preventDefault();
        if (isSaving) return;
        if (purchaseForm.items.length === 0) {
            showToast('Add at least one item', 'warning');
            return;
        }

        setIsSaving(true);
        try {
            const totalAmount = purchaseForm.items.reduce((sum, item) => sum + item.itemTotal, 0);
            const totalItems = purchaseForm.items.length;
            
            await purchaseService.create({
                ...purchaseForm,
                shop: shopId,
                totalAmount,
                totalItems
            });

            setShowAddModal(false);
            setPurchaseForm({
                supplierName: '',
                supplierPhone: '',
                billNo: '',
                date: getLocalToday(),
                paymentMethod: 'Cash',
                paymentStatus: 'Paid',
                items: []
            });
            fetchInitialData();
            showToast('Purchase recorded successfully', 'success');
        } catch (err) {
            showToast(err.response?.data?.message || 'Failed to save purchase', 'error');
        } finally {
            setIsSaving(false);
        }
    };

    const handleDownloadPDF = (purchase) => {
        const purToPrint = purchase || selectedPurchase;
        if (!purToPrint) return;
        invoiceService.downloadInvoice(purToPrint, shop, 'PURCHASE');
    };

    const filteredPurchases = purchases.filter(pur => {
        const purDate = new Date(pur.date);
        const now = new Date();
        let matchesPeriod = false;

        if (periodFilter === 'today') {
            matchesPeriod = purDate.getFullYear() === now.getFullYear() &&
                            purDate.getMonth() === now.getMonth() &&
                            purDate.getDate() === now.getDate();
        } else if (periodFilter === 'yesterday') {
            const yesterday = new Date();
            yesterday.setDate(now.getDate() - 1);
            matchesPeriod = purDate.getFullYear() === yesterday.getFullYear() &&
                            purDate.getMonth() === yesterday.getMonth() &&
                            purDate.getDate() === yesterday.getDate();
        } else if (periodFilter === 'week' || periodFilter === '7d') {
            const oneWeekAgo = new Date();
            oneWeekAgo.setDate(now.getDate() - 7);
            matchesPeriod = purDate >= oneWeekAgo;
        } else if (periodFilter === 'month') {
            const oneMonthAgo = new Date();
            oneMonthAgo.setMonth(now.getMonth() - 1);
            matchesPeriod = purDate >= oneMonthAgo;
        } else if (periodFilter === 'custom') {
            const target = new Date(customDate);
            matchesPeriod = purDate.getFullYear() === target.getFullYear() &&
                            purDate.getMonth() === target.getMonth() &&
                            purDate.getDate() === target.getDate();
        }

        const query = searchQuery.toLowerCase();
        const matchesSearch = 
            (pur.supplierName || '').toLowerCase().includes(query) ||
            (pur.billNo || '').toLowerCase().includes(query) ||
            (pur.items || []).some(item => (item.productName || '').toLowerCase().includes(query));

        const matchesStatus = paymentStatusFilter === 'All' || pur.paymentStatus === paymentStatusFilter;
        const matchesEntryType = entryTypeFilter === 'All' || (pur.entryType || 'Purchase') === entryTypeFilter;
        const matchesSupplier = selectedSupplierFilter === 'All' || (pur.supplierName || 'Unknown Supplier') === selectedSupplierFilter;

        return matchesPeriod && matchesSearch && matchesStatus && matchesEntryType && matchesSupplier;
    }).sort((a, b) => new Date(b.date) - new Date(a.date));

    const paginatedPurchases = filteredPurchases.slice(0, page * itemsPerPage);

    const supplierStats = purchases.reduce((acc, pur) => {
        const name = pur.supplierName || 'Unknown Supplier';
        if (!acc[name]) {
            acc[name] = { name, total: 0, paid: 0, due: 0, bills: 0 };
        }
        acc[name].total += (pur.totalAmount || 0);
        acc[name].paid += (pur.paidAmount || 0);
        acc[name].due += (pur.dueAmount || 0);
        acc[name].bills += 1;
        return acc;
    }, {});

    const supplierList = Object.values(supplierStats).sort((a, b) => b.total - a.total);

    const stats = {
        totalPurchases: filteredPurchases.reduce((sum, p) => sum + (p.totalAmount || 0), 0),
        totalBills: filteredPurchases.length,
        totalPaid: filteredPurchases.reduce((sum, p) => sum + (p.paidAmount || 0), 0),
        pendingAmount: filteredPurchases.reduce((sum, p) => sum + (p.dueAmount || 0), 0),
        itemsBought: filteredPurchases.reduce((sum, p) => sum + (p.items || []).reduce((iSum, item) => iSum + (item.quantity || 0), 0), 0)
    };

    return (
        <div className="sales-log-v3 purchase-ledger">
            <PageHeader 
                title="Purchase Ledger"
                subtitle="Track inward stock and supplier bills"
                actions={
                    <button className="btn-primary-premium hide-mobile" onClick={() => navigate(`/shop/${shopId}/inventory?action=add_stock`)}>
                        <Plus size={20} />
                        <span>Add Purchase</span>
                    </button>
                }
            />

            <div className="pl-tabs" style={{ display: 'flex', gap: '12px', marginBottom: '20px', borderBottom: '1px solid #E2E8F0', paddingBottom: '8px' }}>
                {['purchases', 'suppliers', 'analytics'].map((tab) => (
                    <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        style={{
                            padding: '8px 16px',
                            fontSize: '15px',
                            fontWeight: '700',
                            color: activeTab === tab ? '#2563EB' : '#64748B',
                            background: 'none',
                            border: 'none',
                            borderBottom: activeTab === tab ? '3px solid #2563EB' : '3px solid transparent',
                            cursor: 'pointer',
                            textTransform: 'capitalize',
                            transition: 'all 0.2s',
                            whiteSpace: 'nowrap'
                        }}
                    >
                        {tab}
                    </button>
                ))}
            </div>

            {activeTab === 'purchases' && (
                <>
                    <div className="sl-controls">
                        <div className="sl-search full-width">
                    <Search size={20} color="#98A2B3" />
                    <input 
                        type="text" 
                        placeholder="Search supplier, bill no, item..." 
                        value={searchQuery}
                        onChange={(e) => { setSearchQuery(e.target.value); setPage(1); }}
                    />
                </div>
                <div className="sl-filters-scroll-row" style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '12px', scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch', whiteSpace: 'nowrap' }}>
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
                            style={{ flexShrink: 0 }}
                        >
                            {p.label}
                        </button>
                    ))}
                    <button 
                        className={`sl-pill sl-pill-cal ${periodFilter === 'custom' ? 'active' : ''}`}
                        onClick={() => { setPeriodFilter('custom'); setPage(1); }}
                        style={{ flexShrink: 0 }}
                    >
                        <Calendar size={16} />
                    </button>
                    <div style={{ width: '120px', flexShrink: 0 }}>
                        <CustomSelect 
                            value={paymentStatusFilter}
                            options={['All', 'Paid', 'Partial Paid', 'Pending']}
                            onChange={(val) => { setPaymentStatusFilter(val); setPage(1); }}
                        />
                    </div>
                    <div style={{ width: '120px', flexShrink: 0 }}>
                        <CustomSelect 
                            value={entryTypeFilter}
                            options={['All', 'Purchase', 'Opening Stock', 'Adjustment']}
                            onChange={(val) => { setEntryTypeFilter(val); setPage(1); }}
                        />
                    </div>
                </div>
            </div>

            {periodFilter === 'custom' && (
                <div className="sl-custom-date" style={{ padding: '0 12px' }}>
                    <PremiumDatePicker 
                        label="Select Custom Date"
                        value={customDate}
                        onChange={(val) => { setCustomDate(val); setPage(1); }}
                    />
                </div>
            )}

            <>
                <div className="sl-desktop-only">
                    <div className="sl-summary-grid">
                        <div className="sl-sum-card">
                            <span className="sl-sum-label">Total Purchases</span>
                            <strong className="sl-sum-val">₹{stats.totalPurchases.toLocaleString()}</strong>
                        </div>
                        <div className="sl-sum-card">
                            <span className="sl-sum-label">Total Bills</span>
                            <strong className="sl-sum-val">{stats.totalBills}</strong>
                        </div>
                        <div className="sl-sum-card pending-due-card">
                            <span className="sl-sum-label" style={{ color: '#B45309' }}>Pending Due</span>
                            <strong className="sl-sum-val" style={{ color: '#92400E' }}>₹{stats.pendingAmount.toLocaleString()}</strong>
                        </div>
                        <div className="sl-sum-card">
                            <span className="sl-sum-label">Items Bought</span>
                            <strong className="sl-sum-val">{stats.itemsBought.toLocaleString()}</strong>
                        </div>
                    </div>
                </div>
                <div className="sl-mobile-only sl-summary-grid-v2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', padding: '0 12px 12px' }}>
                    <div className="sl-mini-chip" style={{ background: 'white', border: '1px solid #E2E8F0', borderRadius: '16px', padding: '14px 16px', display: 'flex', flexDirection: 'column', justifyContent: 'center', height: 'auto', boxSizing: 'border-box', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
                        <span style={{ fontSize: '11px', fontWeight: '700', color: '#64748B', textTransform: 'uppercase', marginBottom: '4px' }}>Purchase</span>
                        <strong style={{ fontSize: '18px', fontWeight: '900', color: '#0F172A' }}>₹{Intl.NumberFormat('en-IN', { notation: "compact", maximumFractionDigits: 1 }).format(stats.totalPurchases)}</strong>
                    </div>
                    <div className="sl-mini-chip" style={{ background: 'white', border: '1px solid #E2E8F0', borderRadius: '16px', padding: '14px 16px', display: 'flex', flexDirection: 'column', justifyContent: 'center', height: 'auto', boxSizing: 'border-box', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
                        <span style={{ fontSize: '11px', fontWeight: '700', color: '#64748B', textTransform: 'uppercase', marginBottom: '4px' }}>Paid</span>
                        <strong style={{ fontSize: '18px', fontWeight: '900', color: '#10B981' }}>₹{Intl.NumberFormat('en-IN', { notation: "compact", maximumFractionDigits: 1 }).format(stats.totalPaid)}</strong>
                    </div>
                    <div className="sl-mini-chip pending-due-chip" style={{ background: stats.pendingAmount > 0 ? 'linear-gradient(135deg, #FFFBEB, #FEF3C7)' : 'white', border: '1px solid', borderColor: stats.pendingAmount > 0 ? '#FCD34D' : '#E2E8F0', borderRadius: '16px', padding: '14px 16px', display: 'flex', flexDirection: 'column', justifyContent: 'center', height: 'auto', boxSizing: 'border-box', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
                        <span style={{ fontSize: '11px', fontWeight: '800', color: stats.pendingAmount > 0 ? '#B45309' : '#64748B', textTransform: 'uppercase', marginBottom: '4px' }}>Due</span>
                        <strong style={{ fontSize: '18px', fontWeight: '900', color: stats.pendingAmount > 0 ? '#92400E' : '#0F172A' }}>₹{Intl.NumberFormat('en-IN', { notation: "compact", maximumFractionDigits: 1 }).format(stats.pendingAmount)}</strong>
                    </div>
                    <div className="sl-mini-chip" style={{ background: 'white', border: '1px solid #E2E8F0', borderRadius: '16px', padding: '14px 16px', display: 'flex', flexDirection: 'column', justifyContent: 'center', height: 'auto', boxSizing: 'border-box', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
                        <span style={{ fontSize: '11px', fontWeight: '700', color: '#64748B', textTransform: 'uppercase', marginBottom: '4px' }}>Bills</span>
                        <strong style={{ fontSize: '18px', fontWeight: '900', color: '#0F172A' }}>{stats.totalBills}</strong>
                    </div>
                </div>
            </>

            {loading ? (
                <div className="sl-list">
                    {[1, 2, 3, 4].map(i => (
                        <div key={i} className="sl-card-premium" style={{ padding: '16px' }}>
                            <Skeleton height="20px" width="70%" className="mb-4" />
                            <Skeleton height="14px" width="40%" className="mb-8" />
                            <Skeleton height="24px" borderRadius="8px" />
                        </div>
                    ))}
                </div>
            ) : paginatedPurchases.length === 0 ? (
                <EmptyState 
                    icon={ShoppingCart}
                    title="No Purchases Found"
                    description={searchQuery ? `No purchases match your search "${searchQuery}".` : "You haven't recorded any purchases for this period."}
                    actionLabel="Add Purchase"
                    onAction={() => navigate(`/shop/${shopId}/inventory?action=add_stock`)}
                />
            ) : (
                <>
                    <div className="sl-list sl-mobile-only" style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '0 12px' }}>
                        {paginatedPurchases.map((pur) => {
                            const statusColor = 
                                pur.paymentStatus === 'Paid' ? '#10B981' : 
                                pur.paymentStatus === 'Partial Paid' ? '#F59E0B' : '#EF4444';
                                
                            return (
                                <motion.div 
                                    whileTap={{ scale: 0.98 }}
                                    key={pur._id} 
                                    style={{ background: 'white', borderRadius: '16px', padding: '14px 16px', border: '1px solid #E2E8F0', boxShadow: '0 2px 6px rgba(0,0,0,0.03)', display: 'flex', flexDirection: 'column', gap: '10px', boxSizing: 'border-box' }}
                                    onClick={() => navigate(`/shop/${shopId}/purchase-ledger/${pur._id}`)}
                                >
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                        <div style={{ flex: 1, paddingRight: '12px' }}>
                                            <div style={{ color: '#0F172A', fontWeight: '700', fontSize: '16px', lineHeight: '1.4', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                                                {pur.items && pur.items.length > 0 ? pur.items.map(i => `${i.productName} (${i.quantity})`).join(', ') : (pur.supplierName || 'Purchase Entry')}
                                            </div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '6px', flexWrap: 'wrap' }}>
                                                <span style={{ fontSize: '13px', color: '#64748B', fontWeight: '500' }}>
                                                    Bill #{pur.billNo ? (pur.billNo.includes('-') ? pur.billNo.split('-').pop() : (pur.billNo.length > 6 ? pur.billNo.slice(-6) : pur.billNo)) : 'N/A'}
                                                </span>
                                                <span style={{ fontSize: '14px', color: '#CBD5E1' }}>•</span>
                                                <span style={{ fontSize: '13px', color: '#64748B', fontWeight: '500' }}>
                                                    {new Date(pur.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
                                                </span>
                                                {pur.supplierName && (
                                                    <>
                                                        <span style={{ fontSize: '14px', color: '#CBD5E1' }}>•</span>
                                                        <span 
                                                            style={{ fontSize: '13px', color: '#2563EB', fontWeight: '600', cursor: 'pointer' }}
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                navigate(`/shop/${shopId}/suppliers/${encodeURIComponent(pur.supplierName)}`);
                                                            }}
                                                        >
                                                            {pur.supplierName}
                                                        </span>
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                        <div style={{ fontWeight: '800', fontSize: '16px', color: '#0F172A', whiteSpace: 'nowrap' }}>
                                            ₹{Intl.NumberFormat('en-IN', { notation: "compact", maximumFractionDigits: 1 }).format(pur.totalAmount || 0)}
                                        </div>
                                    </div>
                                    
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px', paddingTop: '12px', borderTop: '1px dashed #E2E8F0' }}>
                                        <div style={{ fontSize: '13px', color: '#64748B', fontWeight: '600' }}>
                                            Due: <span style={{ color: pur.dueAmount > 0 ? '#EF4444' : '#10B981', fontWeight: '800' }}>₹{Intl.NumberFormat('en-IN', { notation: "compact", maximumFractionDigits: 1 }).format(pur.dueAmount || 0)}</span>
                                        </div>
                                        <span style={{ padding: '4px 10px', fontSize: '12px', fontWeight: '700', borderRadius: '8px', background: `${statusColor}15`, color: statusColor }}>
                                            {pur.paymentStatus}
                                        </span>
                                    </div>
                                </motion.div>
                            );
                        })}
                    </div>
                    {filteredPurchases.length > paginatedPurchases.length && (
                        <div className="sl-mobile-only" style={{ display: 'flex', justifyContent: 'center', marginTop: '16px', marginBottom: '16px' }}>
                            <button onClick={() => setPage(page + 1)} style={{ padding: '10px 24px', background: 'white', color: '#334155', borderRadius: '99px', fontSize: '14px', fontWeight: '700', border: '1.5px solid #E2E8F0', cursor: 'pointer', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>Load More</button>
                        </div>
                    )}

                    <div className="sl-desktop-only radical-desktop-container">
                        <table className="radical-desktop-table">
                            <thead>
                                <tr>
                                    <th>Date</th>
                                    <th>Bill No</th>
                                    <th>Supplier</th>
                                    <th>Product(s)</th>
                                    <th style={{ textAlign: 'right' }}>Total</th>
                                    <th style={{ textAlign: 'right' }}>Paid</th>
                                    <th style={{ textAlign: 'right' }}>Due</th>
                                    <th style={{ textAlign: 'center' }}>Status</th>
                                    <th style={{ textAlign: 'center' }}>Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {paginatedPurchases.map((pur) => {
                                    const statusColor = 
                                        pur.paymentStatus === 'Paid' ? '#10B981' : 
                                        pur.paymentStatus === 'Partial Paid' ? '#F59E0B' : '#EF4444';
                                    
                                    const itemsText = pur.items.map(i => i.productName).join(', ');
                                    const itemsDisplay = itemsText.length > 30 ? itemsText.substring(0, 30) + '...' : itemsText;
                                    
                                    return (
                                        <tr key={pur._id} className="sl-desktop-row" onClick={() => navigate(`/shop/${shopId}/purchase-ledger/${pur._id}`)}>
                                            <td>{new Date(pur.date).toLocaleDateString()}</td>
                                            <td><span className="bill-badge" style={{ maxWidth: '100px', overflow: 'hidden', textOverflow: 'ellipsis', display: 'inline-block', whiteSpace: 'nowrap' }}>#{pur.billNo}</span></td>
                                            <td className="sld-cust">
                                                <strong 
                                                    style={{ color: '#2563EB', textDecoration: 'underline', cursor: 'pointer' }}
                                                    onClick={(e) => { 
                                                        e.stopPropagation(); 
                                                        navigate(`/shop/${shopId}/suppliers/${encodeURIComponent(pur.supplierName || 'Unknown Supplier')}`); 
                                                    }}
                                                >
                                                    {pur.supplierName || 'Unknown Supplier'}
                                                </strong>
                                            </td>
                                            <td style={{ fontSize: '13px', color: '#475467' }}>{itemsDisplay} {pur.items.length > 1 && <span style={{ color: '#2563EB', fontWeight: '600' }}>+{pur.items.length - 1} more</span>}</td>
                                            <td style={{ textAlign: 'right', fontWeight: '700' }}>₹{(pur.totalAmount || 0).toLocaleString()}</td>
                                            <td style={{ textAlign: 'right', color: '#10B981', fontWeight: '600' }}>₹{(pur.paidAmount || 0).toLocaleString()}</td>
                                            <td style={{ textAlign: 'right', color: pur.dueAmount > 0 ? '#EF4444' : '#667085', fontWeight: '600' }}>₹{(pur.dueAmount || 0).toLocaleString()}</td>
                                            <td style={{ textAlign: 'center' }}>
                                                <span className={`status-pill ${(pur.paymentStatus || '').toLowerCase().replace(' ', '-')}`} style={{ background: `${statusColor}15`, color: statusColor, border: `1px solid ${statusColor}30` }}>
                                                    {pur.paymentStatus}
                                                </span>
                                            </td>
                                            <td style={{ textAlign: 'center' }}>
                                                <button 
                                                    onClick={(e) => { e.stopPropagation(); navigate(`/shop/${shopId}/purchase-ledger/${pur._id}`); }} 
                                                    style={{ background: '#EFF6FF', color: '#2563EB', border: 'none', padding: '6px 12px', borderRadius: '8px', fontSize: '12px', fontWeight: '700', cursor: 'pointer' }}
                                                >
                                                    View
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                    </>
                )}
            </>
        )}
            {activeTab === 'suppliers' && (
                <div className="suppliers-tab" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    <div className="sl-controls">
                        <div className="sl-search full-width">
                            <Search size={20} color="#98A2B3" />
                            <input 
                                type="text" 
                                placeholder="Search suppliers..." 
                                value={supplierLedgerSearch}
                                onChange={(e) => setSupplierLedgerSearch(e.target.value)}
                                style={{ width: '100%', border: 'none', outline: 'none', background: 'transparent', fontSize: '15px', fontWeight: '600' }}
                            />
                        </div>
                    </div>

                    {supplierList.filter(s => s.name.toLowerCase().includes(supplierLedgerSearch.toLowerCase())).length === 0 ? (
                        <EmptyState 
                            icon={Building2}
                            title="No Suppliers Found"
                            description="Add stock to existing products to create supplier records."
                            actionLabel="Go to Inventory"
                            onAction={() => navigate(`/shop/${shopId}/inventory`)}
                        />
                    ) : (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '16px' }}>
                            {supplierList.filter(s => s.name.toLowerCase().includes(supplierLedgerSearch.toLowerCase())).map((sup, index) => (
                                <motion.div 
                                    key={index}
                                    whileHover={{ y: -2, boxShadow: '0 10px 15px -3px rgba(0,0,0,0.05), 0 4px 6px -2px rgba(0,0,0,0.02)' }}
                                    whileTap={{ scale: 0.98 }}
                                    onClick={() => navigate(`/shop/${shopId}/suppliers/${encodeURIComponent(sup.name)}`)} 
                                    style={{ 
                                        background: 'white', 
                                        border: '1px solid #E2E8F0', 
                                        borderRadius: '16px', 
                                        padding: '16px', 
                                        display: 'flex', 
                                        justifyContent: 'space-between', 
                                        alignItems: 'center', 
                                        boxShadow: '0 2px 6px rgba(0,0,0,0.02)', 
                                        cursor: 'pointer',
                                        transition: 'all 0.2s ease-in-out'
                                    }}
                                >
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1, overflow: 'hidden' }}>
                                        <h4 style={{ fontSize: '16px', fontWeight: '800', color: '#0F172A', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                            {sup.name}
                                        </h4>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: '#64748B', fontWeight: '600', flexWrap: 'wrap' }}>
                                            <span>{sup.bills} {sup.bills === 1 ? 'Bill' : 'Bills'}</span>
                                            <span style={{ fontSize: '16px', color: '#CBD5E1', lineHeight: '1' }}>•</span>
                                            <span>₹{Intl.NumberFormat('en-IN', { notation: "compact", maximumFractionDigits: 1 }).format(sup.total)} Purchase</span>
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
                                            <span style={{ fontSize: '13px', fontWeight: '700', color: '#475569' }}>Due:</span>
                                            <span style={{ 
                                                fontSize: '13px', 
                                                fontWeight: '800', 
                                                color: sup.due > 0 ? (sup.paid > 0 ? '#F59E0B' : '#EF4444') : '#10B981',
                                                background: sup.due > 0 ? (sup.paid > 0 ? '#FFFBEB' : '#FEF2F2') : '#ECFDF5',
                                                padding: '2px 8px',
                                                borderRadius: '6px'
                                            }}>
                                                ₹{Intl.NumberFormat('en-IN', { notation: "compact", maximumFractionDigits: 1 }).format(sup.due)}
                                            </span>
                                        </div>
                                    </div>
                                    
                                    <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: '#F8FAFC', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid #F1F5F9', flexShrink: 0, marginLeft: '12px' }}>
                                        <ChevronRight size={18} color="#64748B" />
                                    </div>
                                </motion.div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {activeTab === 'analytics' && (
                <div className="analytics-tab" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '20px' }}>
                        <div className="sl-sum-card" style={{ background: 'white', border: '1px solid #E2E8F0', borderRadius: '20px', padding: '24px' }}>
                            <span className="sl-sum-label" style={{ fontSize: '13px', fontWeight: '700', color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em' }}>This Month Purchases</span>
                            <strong className="sl-sum-val" style={{ fontSize: '32px', fontWeight: '900', color: '#0F172A', display: 'block', marginTop: '6px' }}>
                                ₹{purchases
                                    .filter(p => new Date(p.date).getMonth() === new Date().getMonth() && new Date(p.date).getFullYear() === new Date().getFullYear())
                                    .reduce((sum, p) => sum + (p.totalAmount || 0), 0)
                                    .toLocaleString()}
                            </strong>
                        </div>
                        <div className="sl-sum-card" style={{ background: 'white', border: '1px solid #E2E8F0', borderRadius: '20px', padding: '24px' }}>
                            <span className="sl-sum-label" style={{ fontSize: '13px', fontWeight: '700', color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Pending Dues</span>
                            <strong className="sl-sum-val warning" style={{ fontSize: '32px', fontWeight: '900', color: '#D97706', display: 'block', marginTop: '6px' }}>
                                ₹{purchases.reduce((sum, p) => sum + (p.dueAmount || 0), 0).toLocaleString()}
                            </strong>
                        </div>
                        <div className="sl-sum-card" style={{ background: 'white', border: '1px solid #E2E8F0', borderRadius: '20px', padding: '24px' }}>
                            <span className="sl-sum-label" style={{ fontSize: '13px', fontWeight: '700', color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Most Used Supplier</span>
                            <strong className="sl-sum-val" style={{ fontSize: '24px', fontWeight: '900', color: '#0F172A', display: 'block', marginTop: '12px' }}>
                                {supplierList.length > 0 ? supplierList[0].name : 'N/A'}
                            </strong>
                            {supplierList.length > 0 && <span style={{ fontSize: '13px', color: '#64748B', display: 'block', marginTop: '4px' }}>{supplierList[0].bills} bills recorded</span>}
                        </div>
                        <div className="sl-sum-card" style={{ background: 'white', border: '1px solid #E2E8F0', borderRadius: '20px', padding: '24px' }}>
                            <span className="sl-sum-label" style={{ fontSize: '13px', fontWeight: '700', color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Items Bought Count</span>
                            <strong className="sl-sum-val" style={{ fontSize: '32px', fontWeight: '900', color: '#0F172A', display: 'block', marginTop: '6px' }}>
                                {purchases.reduce((sum, p) => sum + (p.items || []).reduce((iSum, item) => iSum + (item.quantity || 0), 0), 0).toLocaleString()}
                            </strong>
                        </div>
                    </div>
                </div>
            )}

            {/* Supplier Ledger Overlay removed in favor of standalone full-page views */}
            {/* Add Purchase Modal */}
            <AnimatePresence>
                {showAddModal && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="sl-modal-overlay">
                        <div className="sl-backdrop" onClick={() => { if (!isSaving) setShowAddModal(false); }} />
                        <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} className="pl-add-sheet">
                            <div className="sl-sheet-handle"></div>
                            <div className="sl-m-header-v2">
                                <div className="slmh-title">
                                    <h3>New Purchase Entry</h3>
                                    <p>Enter bill details from supplier</p>
                                </div>
                                <button className="sl-m-close-v2" onClick={() => { if (!isSaving) setShowAddModal(false); }} disabled={isSaving}><X size={20} /></button>
                            </div>

                            <form onSubmit={handleSavePurchase} className="pl-form">
                                <div className="pl-form-scroll">
                                    <div className="pl-form-row">
                                        <div className="pl-field">
                                            <label>Supplier Name</label>
                                            <input 
                                                required 
                                                list="supplier-list-full"
                                                placeholder="e.g. Ramesh Distributors" 
                                                value={purchaseForm.supplierName} 
                                                onChange={e => {
                                                    const newName = e.target.value;
                                                    const existing = supplierList.find(s => s.name === newName);
                                                    setPurchaseForm({
                                                        ...purchaseForm, 
                                                        supplierName: newName,
                                                        supplierPhone: existing ? (purchases.find(p => p.supplierName === newName)?.supplierPhone || '') : purchaseForm.supplierPhone
                                                    });
                                                }} 
                                            />
                                            <datalist id="supplier-list-full">
                                                {supplierList.map(s => <option key={s.name} value={s.name} />)}
                                            </datalist>
                                        </div>
                                        <div className="pl-field">
                                            <label>Supplier Phone</label>
                                            <input 
                                                placeholder="99XXXXXXXX" 
                                                value={purchaseForm.supplierPhone} 
                                                onChange={e => setPurchaseForm({...purchaseForm, supplierPhone: e.target.value})} 
                                            />
                                        </div>
                                    </div>

                                    <div className="pl-form-row">
                                        <div className="pl-field">
                                            <label>Bill / Invoice No</label>
                                            <input 
                                                required 
                                                placeholder="e.g. BILL-123" 
                                                value={purchaseForm.billNo} 
                                                onChange={e => setPurchaseForm({...purchaseForm, billNo: e.target.value})} 
                                            />
                                        </div>
                                        <div className="pl-field">
                                            <label>Purchase Date</label>
                                            <input 
                                                type="date"
                                                required 
                                                value={purchaseForm.date} 
                                                onChange={e => setPurchaseForm({...purchaseForm, date: e.target.value})} 
                                            />
                                        </div>
                                    </div>

                                    <div className="pl-form-row">
                                        <div className="pl-field">
                                            <label>Payment Method</label>
                                            <select value={purchaseForm.paymentMethod} onChange={e => setPurchaseForm({...purchaseForm, paymentMethod: e.target.value})}>
                                                <option value="Cash">Cash</option>
                                                <option value="Online">Online / UPI</option>
                                                <option value="Credit">Credit / Khata</option>
                                            </select>
                                        </div>
                                        <div className="pl-field">
                                            <label>Status</label>
                                            <select value={purchaseForm.paymentStatus} onChange={e => setPurchaseForm({...purchaseForm, paymentStatus: e.target.value})}>
                                                <option value="Paid">Paid</option>
                                                <option value="Pending">Pending</option>
                                            </select>
                                        </div>
                                    </div>

                                    <div className="pl-items-builder">
                                        <label>Add Items</label>
                                        <div className="pl-item-inputs">
                                            <div className="pl-input-group main">
                                                <input 
                                                    list="products-list"
                                                    placeholder="Product Name" 
                                                    value={itemInput.productName} 
                                                    onChange={e => {
                                                        const p = products.find(x => x.name === e.target.value);
                                                        setItemInput({
                                                            ...itemInput, 
                                                            productName: e.target.value,
                                                            product: p ? p._id : '',
                                                            purchaseRate: p ? p.buyPrice : '',
                                                            unit: p ? p.unit : 'Piece'
                                                        });
                                                    }} 
                                                />
                                                <datalist id="products-list">
                                                    {products.map(p => <option key={p._id} value={p.name} />)}
                                                </datalist>
                                            </div>
                                            <div className="pl-input-group">
                                                <input type="number" placeholder="Qty" value={itemInput.quantity} onChange={e => setItemInput({...itemInput, quantity: e.target.value})} />
                                                <input type="number" placeholder="Rate" value={itemInput.purchaseRate} onChange={e => setItemInput({...itemInput, purchaseRate: e.target.value})} />
                                                <button type="button" onClick={handleAddItem} className="btn-add-item-inner"><Plus size={18} /></button>
                                            </div>
                                        </div>

                                        <div className="pl-items-list">
                                            {purchaseForm.items.map((item, idx) => (
                                                <div key={idx} className="pl-item-row">
                                                    <div className="plir-info">
                                                        <strong>{item.productName}</strong>
                                                        <span>{item.quantity} {item.unit} x ₹{item.purchaseRate}</span>
                                                    </div>
                                                    <div className="plir-right">
                                                        <strong>₹{item.itemTotal.toLocaleString()}</strong>
                                                        <button type="button" onClick={() => handleRemoveItem(idx)}><X size={14} /></button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>

                                <div className="pl-form-footer">
                                    <div className="pl-grand-total">
                                        <span>Grand Total</span>
                                        <strong>₹{purchaseForm.items.reduce((sum, i) => sum + i.itemTotal, 0).toLocaleString()}</strong>
                                    </div>
                                    <button type="submit" className="btn-save-purchase" disabled={isSaving}>
                                        {isSaving ? 'Saving...' : 'Confirm & Add Entry'}
                                    </button>
                                </div>
                            </form>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            <style jsx="true">{`
                .purchase-ledger { min-height: 100vh; background: #F6F8FC; padding: 16px; display: flex; flex-direction: column; gap: 24px; }
                
                @media (min-width: 1024px) {
                    .purchase-ledger { padding: 32px 40px; gap: 32px; }
                }

                .sl-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
                .sl-header h1 { font-size: 32px; font-weight: 900; color: #0F172A; margin: 0; letter-spacing: -0.03em; }
                .sl-header p { font-size: 15px; font-weight: 600; color: #64748B; margin: 4px 0 0 0; }
                
                .pl-add-btn { background: #2563EB; color: white; border: none; padding: 0 24px; height: 48px; border-radius: 12px; font-weight: 800; font-size: 15px; display: flex; align-items: center; justify-content: center; gap: 8px; cursor: pointer; transition: all 0.2s ease; box-shadow: 0 4px 12px rgba(37, 99, 235, 0.2); }
                .pl-add-btn:hover { transform: translateY(-2px); box-shadow: 0 6px 16px rgba(37, 99, 235, 0.3); background: #1D4ED8; }

                .sl-controls { display: flex; flex-direction: column; gap: 16px; width: 100%; }
                @media (min-width: 1024px) {
                    .sl-controls { flex-direction: row; align-items: center; justify-content: space-between; }
                    .sl-search { flex: 1; }
                    .sl-filters { width: auto; }
                }

                .sl-search { height: 48px; background: white; border: 1.5px solid #E2E8F0; border-radius: 14px; display: flex; align-items: center; padding: 0 16px; gap: 12px; box-shadow: 0 2px 4px rgba(0,0,0,0.02); transition: 0.2s; width: 100%; box-sizing: border-box; }
                .sl-search:focus-within { border-color: #2563EB; box-shadow: 0 0 0 4px rgba(37, 99, 235, 0.1); }
                .sl-search input { border: none; outline: none; flex: 1; font-size: 15px; font-weight: 600; background: transparent; color: #1E293B; }
                
                .sl-filters { display: flex; gap: 8px; overflow-x: auto; padding-bottom: 4px; -webkit-overflow-scrolling: touch; }
                .sl-filters::-webkit-scrollbar { display: none; }
                .sl-pill { flex: 0 0 auto; height: 40px; padding: 0 20px; border: 1.5px solid #E2E8F0; background: white; border-radius: 99px; font-size: 14px; font-weight: 700; color: #64748B; cursor: pointer; white-space: nowrap; transition: all 0.2s; display: flex; align-items: center; justify-content: center; box-shadow: 0 2px 4px rgba(0,0,0,0.02); }
                .sl-pill.active { background: #2563EB; color: white; border-color: #2563EB; box-shadow: 0 4px 12px rgba(37, 99, 235, 0.2); }
                .sl-pill-cal { padding: 0 16px; }

                .sl-custom-date { display: flex; align-items: center; gap: 10px; background: white; padding: 12px 16px; border-radius: 14px; border: 1.5px solid #E2E8F0; width: 100%; box-sizing: border-box; box-shadow: 0 2px 4px rgba(0,0,0,0.02); }
                .sl-custom-date label { font-size: 14px; font-weight: 700; color: #475569; display: flex; align-items: center; gap: 6px; }
                .sl-custom-date input { border: none; font-size: 14px; font-weight: 700; color: #1e293b; outline: none; background: transparent; }

                .sl-summary-grid { display: grid; grid-template-columns: 1fr; gap: 16px; width: 100%; }
                @media (min-width: 640px) { .sl-summary-grid { grid-template-columns: repeat(2, 1fr); } }
                @media (min-width: 1024px) { .sl-summary-grid { grid-template-columns: repeat(4, 1fr); gap: 20px; } }
                
                .sl-sum-card { background: white; border: 1px solid #E2E8F0; border-radius: 20px; padding: 24px; display: flex; flex-direction: column; justify-content: center; box-shadow: 0 4px 12px rgba(0,0,0,0.02); transition: transform 0.3s ease, box-shadow 0.3s ease; position: relative; overflow: hidden; }
                .sl-sum-card::after { content: ''; position: absolute; top: 0; right: 0; width: 100px; height: 100px; background: linear-gradient(135deg, transparent, rgba(241, 245, 249, 0.5)); border-radius: 50%; transform: translate(30%, -30%); pointer-events: none; }
                .sl-sum-card:hover { transform: translateY(-4px); box-shadow: 0 12px 24px rgba(0,0,0,0.06); }
                .sl-sum-label { font-size: 13px; font-weight: 700; color: #64748B; text-transform: uppercase; letter-spacing: 0.05em; }
                .sl-sum-val { font-size: 32px; font-weight: 900; color: #0F172A; margin-top: 6px; letter-spacing: -0.02em; }
                .sl-sum-val.warning { color: #D97706 !important; }

                /* List Views */
                .sl-mobile-only { display: flex; flex-direction: column; gap: 16px; }
                .sl-desktop-only { display: none; }
                .sl-sum-card.pending-due-card { background: linear-gradient(135deg, #FFFBEB, #FEF3C7); border-color: #FCD34D; box-shadow: 0 4px 12px rgba(245,158,11,0.15); }
                
                @media (max-width: 768px) {
                    .sales-log-v3.purchase-ledger { padding: 0 0 80px 0; background: #F8FAFC; min-height: 100vh; }
                    .sl-header { display: flex; justify-content: space-between; align-items: center; padding: 10px 12px; height: 56px; margin: 0; box-sizing: border-box; }
                    .sl-header div { display: flex; align-items: center; gap: 8px; }
                    .sl-header h1 { font-size: 18px !important; margin: 0; line-height: 1; font-weight: 900 !important; }
                    .sl-header p { display: none; }
                    .pl-add-btn { height: 36px; padding: 0 12px; font-size: 13px; border-radius: 10px; margin: 0; font-weight: 800; }
                    .pl-add-btn span { display: inline; margin-left: 2px; }
                    
                    .pl-tabs { margin: 0; padding: 8px 12px; background: rgba(255, 255, 255, 0.9); backdrop-filter: blur(10px); position: sticky; top: 0; z-index: 100; border-bottom: 1px solid #E2E8F0; gap: 8px; overflow-x: auto; scrollbar-width: none; }
                    .pl-tabs::-webkit-scrollbar { display: none; }
                    .pl-tabs button { font-size: 12px !important; padding: 0 16px !important; height: 32px; border-radius: 99px; border: 1px solid #E2E8F0 !important; background: white !important; color: #64748B !important; }
                    .pl-tabs button[style*="2563EB"] { background: #2563EB !important; color: white !important; border-color: #2563EB !important; }
                    
                    .sl-controls { padding: 8px 12px; gap: 8px; background: white; position: sticky; top: 48px; z-index: 90; border-bottom: 1px solid #F1F5F9; box-shadow: 0 4px 10px rgba(0,0,0,0.02); }
                    .sl-search { height: 44px; border-radius: 12px; }
                    .sl-filters-scroll-row { padding-bottom: 0; gap: 6px; }
                    .sl-pill { height: 32px !important; font-size: 12px !important; padding: 0 12px !important; border-radius: 8px !important; }

                    .sl-summary-grid-v2 { padding: 12px; gap: 6px; }
                    .sl-mini-chip { height: 56px !important; padding: 6px 10px !important; border-radius: 10px !important; }
                    .sl-mini-chip strong { fontSize: 14px !important; }
                    .sl-mini-chip span { fontSize: 10px !important; }
                    
                    .analytics-tab { padding: 0 12px; }
                    .suppliers-tab { gap: 8px; }
                }

                @media (min-width: 1024px) {
                    .sl-desktop-only { display: block !important; }
                    .sl-mobile-only { display: none !important; }
                }

                .sl-card-premium { background: white; border: 1px solid #E2E8F0; border-radius: 20px; padding: 20px; display: flex; flex-direction: column; gap: 12px; cursor: pointer; transition: all 0.2s ease; box-shadow: 0 4px 12px rgba(0,0,0,0.02); }
                .sl-card-premium:hover { border-color: #CBD5E1; transform: translateY(-2px); box-shadow: 0 8px 24px rgba(0,0,0,0.04); }
                .sl-card-top { display: flex; justify-content: space-between; align-items: center; }
                .sl-card-name { font-weight: 800; font-size: 16px; color: #0F172A; }
                .sl-card-amount-wrap { display: flex; align-items: center; gap: 6px; }
                .sl-card-amount { font-weight: 900; font-size: 18px; color: #0F172A; }
                .sl-card-mid { font-size: 14px; font-weight: 600; color: #64748B; }
                .sl-card-bot { margin-top: 4px; padding-top: 12px; border-top: 1px dashed #E2E8F0; }
                .sl-card-meta { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; font-size: 13px; font-weight: 700; color: #94A3B8; }
                .divider-dot { color: #CBD5E1; }

                .radical-desktop-container { background: white; border-radius: 24px; border: 1px solid #E2E8F0; box-shadow: 0 10px 30px rgba(0,0,0,0.03); overflow: hidden; }
                .radical-desktop-table { width: 100%; border-collapse: collapse; }
                .radical-desktop-table th { text-align: left; padding: 20px 24px; font-size: 13px; font-weight: 800; color: #64748B; text-transform: uppercase; letter-spacing: 0.05em; background: #F8FAFC; border-bottom: 1px solid #E2E8F0; }
                .radical-desktop-table td { padding: 20px 24px; font-size: 15px; color: #1E293B; border-bottom: 1px solid #F1F5F9; vertical-align: middle; }
                .sl-desktop-row { cursor: pointer; transition: all 0.2s; }
                .sl-desktop-row:hover { background: #F8FAFC; }
                
                .bill-badge { background: #F1F5F9; color: #475569; font-weight: 800; padding: 6px 12px; border-radius: 8px; font-family: monospace; font-size: 14px; border: 1px solid #E2E8F0; }
                .sld-cust { font-weight: 800 !important; color: #0F172A !important; }

                /* Badges */
                .status-pill { padding: 6px 12px; border-radius: 99px; font-size: 12px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em; display: inline-flex; align-items: center; justify-content: center; }
                .status-pill.paid { background: #DCFCE7; color: #15803D; border: 1px solid #BBF7D0; }
                .status-pill.pending { background: #FEF3C7; color: #B45309; border: 1px solid #FDE68A; }
                
                .method-badge { font-weight: 800; font-size: 13px; padding: 6px 12px; border-radius: 8px; background: #F1F5F9; color: #475569; display: inline-flex; }
                .method-badge.cash { background: #ECFEFF; color: #0E7490; border: 1px solid #CFFAFE; }
                .method-badge.online { background: #EFF6FF; color: #1D4ED8; border: 1px solid #DBEAFE; }
                .method-badge.credit { background: #FAF5FF; color: #7E22CE; border: 1px solid #F3E8FF; }

                /* Empty State */
                .sl-empty-state-card { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 60px 24px; background: white; border-radius: 24px; border: 1.5px solid #E2E8F0; box-shadow: 0 10px 30px rgba(0,0,0,0.03); text-align: center; max-width: 500px; margin: 40px auto; width: 100%; box-sizing: border-box; }
                .sl-empty-icon-wrapper { width: 80px; height: 80px; background: #F1F5F9; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin-bottom: 20px; }
                .sl-empty-state-card h3 { font-size: 22px; font-weight: 800; color: #0F172A; margin: 0 0 8px 0; }
                .sl-empty-state-card p { font-size: 15px; color: #64748B; font-weight: 600; margin: 0 0 24px 0; max-width: 320px; line-height: 1.5; }
                .pl-add-btn-empty { background: #2563EB; color: white; border: none; padding: 12px 24px; border-radius: 12px; font-weight: 800; font-size: 15px; display: flex; align-items: center; gap: 8px; cursor: pointer; transition: all 0.2s; box-shadow: 0 4px 12px rgba(37, 99, 235, 0.2); }
                .pl-add-btn-empty:hover { transform: translateY(-2px); box-shadow: 0 6px 16px rgba(37, 99, 235, 0.3); background: #1D4ED8; }

                /* Modals Common */
                .sl-modal-overlay { position: fixed; inset: 0; z-index: 10000; display: flex; align-items: flex-end; justify-content: center; }
                @media (min-width: 1024px) { .sl-modal-overlay { align-items: center; } }
                .sl-backdrop { position: absolute; inset: 0; background: rgba(15, 23, 42, 0.4); backdrop-filter: blur(8px); }
                
                .sl-sheet, .pl-add-sheet { position: relative; width: 100%; background: white; display: flex; flex-direction: column; max-height: 90vh; }
                @media (min-width: 1024px) {
                    .sl-sheet, .pl-add-sheet { max-width: 650px; border-radius: 32px; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25); }
                }
                @media (max-width: 1023px) {
                    .sl-sheet, .pl-add-sheet { border-radius: 32px 32px 0 0; }
                }

                .sl-sheet-handle { width: 48px; height: 6px; background: #E2E8F0; border-radius: 99px; margin: 12px auto 0; }
                @media (min-width: 1024px) { .sl-sheet-handle { display: none; } }

                .sl-m-header-v2 { padding: 24px; border-bottom: 1px solid #F1F5F9; display: flex; justify-content: space-between; align-items: flex-start; }
                .slmh-title h3 { font-size: 24px; font-weight: 900; color: #0F172A; margin: 0; }
                .slmh-title p { font-size: 14px; font-weight: 600; color: #64748B; margin: 4px 0 0 0; }
                .sl-m-close-v2 { width: 40px; height: 40px; border-radius: 50%; background: #F1F5F9; border: none; color: #64748B; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: 0.2s; }
                .sl-m-close-v2:hover { background: #E2E8F0; color: #0F172A; }

                /* Add Purchase Form Specifics */
                .pl-form { display: flex; flex-direction: column; overflow: hidden; flex: 1; }
                .pl-form-scroll { padding: 24px; overflow-y: auto; flex: 1; display: flex; flex-direction: column; gap: 24px; }
                
                .pl-form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
                @media (max-width: 768px) { .pl-form-row { grid-template-columns: 1fr; gap: 16px; } }
                
                .pl-field { display: flex; flex-direction: column; gap: 8px; }
                .pl-field label { font-size: 13px; font-weight: 800; color: #475569; text-transform: uppercase; letter-spacing: 0.05em; }
                .pl-field input, .pl-field select { height: 52px; border: 2px solid #E2E8F0; background: #F8FAFC; border-radius: 14px; padding: 0 16px; font-size: 15px; font-weight: 700; color: #0F172A; outline: none; transition: 0.2s; }
                .pl-field input:focus, .pl-field select:focus { border-color: #2563EB; background: white; box-shadow: 0 0 0 4px rgba(37, 99, 235, 0.1); }

                .pl-items-builder { background: white; border: 2px solid #E2E8F0; border-radius: 20px; padding: 24px; display: flex; flex-direction: column; gap: 16px; box-shadow: 0 4px 12px rgba(0,0,0,0.02); }
                .pl-items-builder > label { font-size: 15px; font-weight: 900; color: #0F172A; display: flex; align-items: center; gap: 8px; }
                .pl-items-builder > label::before { content: ''; width: 8px; height: 8px; background: #3B82F6; border-radius: 50%; }
                
                .pl-item-inputs { display: flex; flex-direction: column; gap: 12px; }
                @media (min-width: 768px) { .pl-item-inputs { flex-direction: row; } .pl-input-group.main { flex: 2; } .pl-input-group { flex: 1; } }
                
                .pl-input-group { display: flex; gap: 12px; }
                .pl-input-group input { height: 48px; border: 2px solid #E2E8F0; background: #F8FAFC; border-radius: 12px; padding: 0 16px; font-size: 14px; font-weight: 700; flex: 1; min-width: 0; outline: none; transition: 0.2s; }
                .pl-input-group input:focus { border-color: #2563EB; background: white; }
                
                .btn-add-item-inner { background: #2563EB; color: white; border: none; width: 48px; height: 48px; border-radius: 12px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; cursor: pointer; transition: 0.2s; box-shadow: 0 4px 10px rgba(37,99,235,0.2); }
                .btn-add-item-inner:hover { background: #1D4ED8; transform: translateY(-2px); }
                
                .pl-items-list { display: flex; flex-direction: column; gap: 12px; margin-top: 12px; }
                .pl-item-row { background: #F8FAFC; padding: 16px; border-radius: 16px; border: 1px solid #E2E8F0; display: flex; justify-content: space-between; align-items: center; transition: 0.2s; }
                .pl-item-row:hover { border-color: #CBD5E1; background: white; box-shadow: 0 4px 12px rgba(0,0,0,0.03); }
                .plir-info { display: flex; flex-direction: column; gap: 4px; }
                .plir-info strong { font-size: 16px; font-weight: 800; color: #0F172A; }
                .plir-info span { font-size: 13px; color: #64748B; font-weight: 700; background: white; padding: 2px 8px; border-radius: 6px; border: 1px solid #E2E8F0; display: inline-block; width: fit-content; }
                .plir-right { display: flex; align-items: center; gap: 20px; }
                .plir-right strong { font-size: 18px; font-weight: 900; color: #0F172A; }
                .plir-right button { background: #FEE2E2; border: none; width: 32px; height: 32px; border-radius: 10px; color: #EF4444; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: 0.2s; }
                .plir-right button:hover { background: #EF4444; color: white; }

                .pl-form-footer { padding: 24px; border-top: 1px solid #E2E8F0; display: flex; justify-content: space-between; align-items: center; background: #F8FAFC; border-radius: 0 0 32px 32px; }
                @media (max-width: 1023px) { .pl-form-footer { border-radius: 0; flex-direction: column; gap: 20px; align-items: stretch; text-align: center; padding-bottom: 40px; } }
                
                .pl-grand-total { display: flex; flex-direction: column; align-items: flex-start; }
                @media (max-width: 1023px) { .pl-grand-total { align-items: center; } }
                .pl-grand-total span { font-size: 14px; color: #64748B; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em; }
                .pl-grand-total strong { font-size: 32px; color: #0F172A; font-weight: 900; letter-spacing: -0.02em; line-height: 1.1; margin-top: 4px; }
                
                .btn-save-purchase { background: #2563EB; color: white; border: none; padding: 18px 40px; border-radius: 16px; font-weight: 900; font-size: 18px; cursor: pointer; transition: 0.3s; box-shadow: 0 10px 25px rgba(37, 99, 235, 0.2); }
                .btn-save-purchase:hover { transform: translateY(-3px); box-shadow: 0 15px 35px rgba(37, 99, 235, 0.3); background: #1D4ED8; }
                .btn-save-purchase:disabled { opacity: 0.6; cursor: not-allowed; transform: none; box-shadow: none; }

                /* Details Modal Specifics */
                .sl-m-content-v2 { padding: 24px; overflow-y: auto; display: flex; flex-direction: column; gap: 24px; }
                .radical-details-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; background: #F8FAFC; padding: 20px; border-radius: 20px; border: 1px solid #E2E8F0; }
                .rdg-col { display: flex; flex-direction: column; gap: 6px; }
                .rdg-col label { font-size: 12px; font-weight: 700; color: #64748B; text-transform: uppercase; letter-spacing: 0.05em; }
                .rdg-col span { font-size: 15px; font-weight: 800; color: #0F172A; }

                .radical-items-section { border: 1px solid #E2E8F0; border-radius: 20px; overflow: hidden; }
                .radical-items-section h4 { padding: 16px 20px; margin: 0; background: #F8FAFC; border-bottom: 1px solid #E2E8F0; font-size: 15px; font-weight: 800; color: #0F172A; }
                .radical-invoice-table { width: 100%; border-collapse: collapse; background: white; }
                .radical-invoice-table th { padding: 12px 20px; font-size: 12px; font-weight: 700; color: #64748B; text-transform: uppercase; border-bottom: 1px solid #E2E8F0; background: #F1F5F9; }
                .radical-invoice-table td { padding: 16px 20px; font-size: 14px; font-weight: 700; color: #1E293B; border-bottom: 1px solid #F1F5F9; }
                
                .radical-summary-section { display: flex; justify-content: flex-end; padding: 0 8px; }
                .rs-row { display: flex; justify-content: space-between; align-items: center; width: 100%; max-width: 300px; padding: 16px; background: #F8FAFC; border-radius: 16px; border: 1px solid #E2E8F0; }
                .rs-row.grand { background: #0F172A; color: white; border: none; box-shadow: 0 10px 25px rgba(15,23,42,0.2); }
                .rs-row.grand span { font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; font-size: 13px; color: #94A3B8; }
                .rs-row.grand strong { font-size: 24px; font-weight: 900; }

                .radical-sticky-footer { position: sticky; bottom: 0; padding: 20px 24px; background: white; border-top: 1px solid #E2E8F0; display: flex; gap: 12px; z-index: 10; border-radius: 0 0 32px 32px; }
                @media (max-width: 1023px) { .radical-sticky-footer { border-radius: 0; padding-bottom: 40px; display: flex; flex-direction: column; } }
                
                .r-btn { flex: 1; height: 52px; border-radius: 14px; font-weight: 800; font-size: 15px; display: flex; align-items: center; justify-content: center; gap: 8px; cursor: pointer; transition: 0.2s; border: none; }
                .r-btn-primary { background: #2563EB; color: white; box-shadow: 0 4px 12px rgba(37,99,235,0.2); }
                .r-btn-primary:hover { background: #1D4ED8; transform: translateY(-2px); }
                .r-btn-secondary { background: #F1F5F9; color: #0F172A; border: 1px solid #E2E8F0; }
                .r-btn-secondary:hover { background: #E2E8F0; }
                .r-btn-outline { background: white; color: #64748B; border: 1.5px solid #E2E8F0; }
                .r-btn-outline:hover { background: #F8FAFC; color: #0F172A; border-color: #CBD5E1; }

                /* Loading & Empty States */
                .sl-loader { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 60px 20px; text-align: center; gap: 16px; background: white; border-radius: 24px; border: 1px dashed #CBD5E1; margin-top: 20px; }
                .spinner { width: 40px; height: 40px; border: 4px solid #E2E8F0; border-top-color: #2563EB; border-radius: 50%; animation: spin 1s linear infinite; }
                @keyframes spin { to { transform: rotate(360deg); } }
            `}</style>
            <MessageModal 
                isOpen={alertConfig.open}
                title={alertConfig.title}
                message={alertConfig.message}
                type={alertConfig.type}
                onClose={() => setAlertConfig({ ...alertConfig, open: false })}
            />
        </div>
    );
};

export default PurchaseLedgerPage;
