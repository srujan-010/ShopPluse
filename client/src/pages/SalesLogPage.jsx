import React, { useState, useEffect } from 'react';
import { 
    Search, 
    Calendar, 
    X, 
    Wallet, 
    CreditCard, 
    QrCode,
    ChevronRight,
    ChevronLeft,
    Receipt,
    MessageSquare,
    History,
    ArrowDownCircle
} from 'lucide-react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { saleService, shopService, khataService, productService } from '../services/api';
import { offlineDB } from '../services/offlineDB';
import { motion, AnimatePresence } from 'framer-motion';
import { EmptyState, Skeleton, PageHeader } from '../components/PremiumUI';
import { useScrollLock } from '../hooks/useScrollLock';
import { invoiceService } from '../utils/invoiceService';
import { useToast } from '../context/ToastContext';

const SalesLogPage = () => {
    const { shopId } = useParams();
    const { showToast } = useToast();
    const [sales, setSales] = useState([]);
    const [shop, setShop] = useState(null);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedSale, setSelectedSale] = useState(null);
    const [selectedCustomerKhata, setSelectedCustomerKhata] = useState(null);
    const [selectedCustomer, setSelectedCustomer] = useState(null);
    const [searchParams] = useSearchParams();
    const initialDate = searchParams.get('date');
    const [periodFilter, setPeriodFilter] = useState(initialDate ? 'custom' : 'today');
    const [paymentFilter, setPaymentFilter] = useState('All');
    const getLocalToday = () => {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    };
    const [customDate, setCustomDate] = useState(initialDate || getLocalToday());
    const [page, setPage] = useState(1);
    const [isMobile, setIsMobile] = useState(window.innerWidth < 1024);
    const [isInvoiceOpen, setIsInvoiceOpen] = useState(false);
    const [selectedSaleForInvoice, setSelectedSaleForInvoice] = useState(null);
    const [invoiceLoading, setInvoiceLoading] = useState(false);
    const itemsPerPage = 20;

    // Return & Exchange Modal States
    const [showReturnModal, setShowReturnModal] = useState(false);
    const [showExchangeModal, setShowExchangeModal] = useState(false);
    const [saleToReturn, setSaleToReturn] = useState(null);
    const [saleToExchange, setSaleToExchange] = useState(null);
    const [returnQuantities, setReturnQuantities] = useState({}); // productId -> quantity
    const [returnReason, setReturnReason] = useState('');
    const [refundMethod, setRefundMethod] = useState('Cash');

    const [exchangeReturnQuantities, setExchangeReturnQuantities] = useState({}); // productId -> quantity
    const [replacementItems, setReplacementItems] = useState([]); // array of { product, productName, quantity, unit, price }
    const [exchangePaymentMethod, setExchangePaymentMethod] = useState('Cash');
    const [shopProducts, setShopProducts] = useState([]);
    const [productSearch, setProductSearch] = useState('');
    const [searchResults, setSearchResults] = useState([]);

    const [isReturnSubmitting, setIsReturnSubmitting] = useState(false);
    const [isExchangeSubmitting, setIsExchangeSubmitting] = useState(false);

    const getAlreadyReturnedQuantities = (saleId) => {
        const qtyMap = {};
        sales.forEach(tx => {
            if (tx.type === 'RETURN' && tx.originalSale === saleId) {
                (tx.items || []).forEach(item => {
                    const prodId = item.product.toString();
                    qtyMap[prodId] = (qtyMap[prodId] || 0) + item.quantity;
                });
            }
            if (tx.type === 'EXCHANGE' && tx.originalSale === saleId) {
                (tx.returnedItems || []).forEach(item => {
                    const prodId = item.product.toString();
                    qtyMap[prodId] = (qtyMap[prodId] || 0) + item.quantity;
                });
            }
        });
        return qtyMap;
    };

    const handleOpenReturnModal = (sale) => {
        const alreadyReturnedMap = getAlreadyReturnedQuantities(sale._id);
        const initialReturnQty = {};
        (sale.items || []).forEach(item => {
            initialReturnQty[item.product] = 0;
        });
        setSaleToReturn(sale);
        setReturnQuantities(initialReturnQty);
        setReturnReason('');
        setRefundMethod(sale.paymentMethod === 'Khata' ? 'Khata' : 'Cash');
        setShowReturnModal(true);
    };

    const handleOpenExchangeModal = (sale) => {
        const alreadyReturnedMap = getAlreadyReturnedQuantities(sale._id);
        const initialReturnQty = {};
        (sale.items || []).forEach(item => {
            initialReturnQty[item.product] = 0;
        });
        setSaleToExchange(sale);
        setExchangeReturnQuantities(initialReturnQty);
        setReplacementItems([]);
        setExchangePaymentMethod(sale.paymentMethod === 'Khata' ? 'Khata' : 'Cash');
        fetchShopProducts();
        setShowExchangeModal(true);
    };

    const fetchShopProducts = async () => {
        try {
            const res = await productService.getAll(shopId);
            setShopProducts(res.data.data || []);
        } catch (err) {
            console.error('Failed to fetch shop products:', err);
        }
    };

    useEffect(() => {
        if (productSearch.trim() === '') {
            setSearchResults([]);
            return;
        }
        const filtered = shopProducts.filter(p => 
            p.name.toLowerCase().includes(productSearch.toLowerCase()) || 
            (p.brand && p.brand.toLowerCase().includes(productSearch.toLowerCase()))
        );
        setSearchResults(filtered);
    }, [productSearch, shopProducts]);

    const handleReturnSubmit = async (e) => {
        e.preventDefault();
        if (isReturnSubmitting) return;
        
        const alreadyReturnedMap = getAlreadyReturnedQuantities(saleToReturn._id);
        const itemsToSubmit = [];
        
        for (const [productId, quantity] of Object.entries(returnQuantities)) {
            const qty = Number(quantity);
            if (qty <= 0) continue;
            
            const saleItem = saleToReturn.items.find(item => item.product === productId);
            if (!saleItem) continue;
            
            const alreadyRet = alreadyReturnedMap[productId] || 0;
            const multiplier = saleItem.multiplier || 1;
            const maxReturnable = (saleItem.soldQtyBaseUnit - alreadyRet) / multiplier;
            
            if (qty > maxReturnable + 0.001) {
                showToast(`Cannot return ${qty} of ${saleItem.productName}. Max remaining returnable: ${maxReturnable.toFixed(3)}.`, 'error');
                return;
            }
            
            itemsToSubmit.push({
                product: productId,
                productName: saleItem.productName,
                quantity: qty
            });
        }

        if (itemsToSubmit.length === 0) {
            showToast('Please select at least one item and quantity to return.', 'warning');
            return;
        }

        try {
            setIsReturnSubmitting(true);
            await saleService.processReturn(saleToReturn._id, {
                returnedItems: itemsToSubmit,
                reason: returnReason,
                refundMethod
            });
            setShowReturnModal(false);
            fetchInitialData();
            showToast('Return processed successfully.', 'success');
        } catch (err) {
            showToast(err.response?.data?.message || 'Error processing return', 'error');
        } finally {
            setIsReturnSubmitting(false);
        }
    };

    const handleExchangeSubmit = async (e) => {
        e.preventDefault();
        if (isExchangeSubmitting) return;
        
        const alreadyReturnedMap = getAlreadyReturnedQuantities(saleToExchange._id);
        const returnedItemsToSubmit = [];
        
        for (const [productId, quantity] of Object.entries(exchangeReturnQuantities)) {
            const qty = Number(quantity);
            if (qty <= 0) continue;
            
            const saleItem = saleToExchange.items.find(item => item.product === productId);
            if (!saleItem) continue;
            
            const alreadyRet = alreadyReturnedMap[productId] || 0;
            const multiplier = saleItem.multiplier || 1;
            const maxReturnable = (saleItem.soldQtyBaseUnit - alreadyRet) / multiplier;
            
            if (qty > maxReturnable + 0.001) {
                showToast(`Cannot return ${qty} of ${saleItem.productName} for exchange. Max remaining returnable: ${maxReturnable.toFixed(3)}.`, 'error');
                return;
            }
            
            returnedItemsToSubmit.push({
                product: productId,
                productName: saleItem.productName,
                quantity: qty
            });
        }

        if (returnedItemsToSubmit.length === 0) {
            showToast('Please select at least one returned item to exchange.', 'warning');
            return;
        }
        if (replacementItems.length === 0) {
            showToast('Please add at least one replacement item.', 'warning');
            return;
        }

        try {
            setIsExchangeSubmitting(true);
            await saleService.processExchange(saleToExchange._id, {
                returnedItems: returnedItemsToSubmit,
                replacementItems: replacementItems.map(item => ({
                    product: item.product,
                    productName: item.productName,
                    quantity: item.quantity,
                    unit: item.unit
                })),
                paymentMethod: exchangePaymentMethod
            });
            setShowExchangeModal(false);
            fetchInitialData();
            showToast('Exchange processed successfully.', 'success');
        } catch (err) {
            showToast(err.response?.data?.message || 'Error processing exchange', 'error');
        } finally {
            setIsExchangeSubmitting(false);
        }
    };

    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth < 1024);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // Lock body scroll when modal is open
    useScrollLock(selectedSale || isInvoiceOpen || showReturnModal || showExchangeModal);

    useEffect(() => {
        if (selectedSale && selectedSale.paymentMethod === 'Khata' && selectedSale.customerMobile) {
            fetchKhataInfo(selectedSale.customerMobile);
        } else {
            setSelectedCustomerKhata(null);
        }
    }, [selectedSale]);

    const fetchKhataInfo = async (mobile) => {
        try {
            const res = await khataService.getCustomers(shopId);
            const found = res.data.data.find(c => c.mobile === mobile);
            if (found) {
                const details = await khataService.getDetails(found._id);
                setSelectedCustomerKhata(details.data.data);
            }
        } catch (err) {
            console.error('Failed to fetch Khata info:', err);
        }
    };

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
                setSelectedSale(sale);
            }
        }
    }, [sales, searchParams]);

    const fetchInitialData = async () => {
        try {
            // Offline-first load: Instant render from local IndexedDB
            const localSales = await offlineDB.getSales(shopId);
            const localShops = await offlineDB.getShops();
            
            if (localSales && localSales.length > 0) {
                setSales(localSales);
                setLoading(false);
            }
            const activeShop = localShops.find(s => s._id === shopId);
            if (activeShop) setShop(activeShop);

            const [salesRes, shopsRes] = await Promise.all([
                saleService.getAll(shopId),
                shopService.getAll()
            ]);
            setSales(salesRes.data.data || []);
            if (shopsRes.data?.data) {
                setShop(shopsRes.data.data.find(s => s._id === shopId));
            }
        } catch (err) {
            console.error('Error fetching initial data:', err);
        } finally {
            setLoading(false);
        }
    };
    const handleViewBill = async (saleId) => {
        if (!saleId) return;
        
        // Close modal first
        setSelectedSale(null);

        // Delay then open invoice
        setTimeout(async () => {
            setInvoiceLoading(true);
            setIsInvoiceOpen(true);
            try {
                const res = await saleService.getSale(saleId);
                setSelectedSaleForInvoice(res.data.data);
            } catch (err) {
                console.error('Failed to fetch bill:', err);
            } finally {
                setInvoiceLoading(false);
            }
        }, 150);
    };

    const handleDownloadPDF = (targetSale) => {
        const saleToPrint = targetSale || selectedSaleForInvoice || selectedSale;
        if (!saleToPrint) return;
        invoiceService.downloadInvoice(saleToPrint, shop, 'SALE');
    };

    const handleShareWhatsApp = (targetSale) => {
        const saleToShare = targetSale || selectedSaleForInvoice || selectedSale;
        if (!saleToShare) return;
        invoiceService.shareInvoice(saleToShare, shop, 'SALE');
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
        }

        const matchesSearch = searchQuery === '' || 
            (sale.customerName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
            (sale.invoiceNumber || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
            sale.totalAmount.toString().includes(searchQuery);

        const matchesPayment = paymentFilter === 'All' || sale.paymentMethod === paymentFilter;

        return matchesPeriod && matchesSearch && matchesPayment;
    }).sort((a, b) => new Date(b.date) - new Date(a.date));

    const paginatedSales = filteredSales.slice(0, page * itemsPerPage);

    const totalOrders = filteredSales.length;
    const totalAmount = filteredSales.reduce((sum, s) => sum + (s.totalAmount || 0), 0);
    const totalItems = filteredSales.reduce((sum, s) => sum + (s.items || []).reduce((iSum, item) => iSum + (item.soldQtyEntered || item.quantity || 0), 0), 0);
    
    const totalProfit = filteredSales.reduce((sum, s) => sum + (s.totalProfit || s.profit || 0), 0);

    return (
        <div className="sales-log-v3">
            <PageHeader 
                title="Sales Ledger"
                subtitle={periodFilter === 'today' ? "Today's transactions" : 
                        periodFilter === 'yesterday' ? "Yesterday's transactions" : 
                        periodFilter === 'week' ? "Last 7 days' transactions" : 
                        periodFilter === 'month' ? "This month's transactions" : "Custom transactions"}
                actions={
                    <div className="sl-filters hide-mobile">
                        {['today', 'yesterday', 'week', 'month'].map(id => (
                            <button 
                                key={id} 
                                className={`sl-pill ${periodFilter === id ? 'active' : ''}`}
                                onClick={() => { setPeriodFilter(id); setPage(1); }}
                            >
                                {id.charAt(0).toUpperCase() + id.slice(1)}
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
                        placeholder="Search by customer name, amount or bill..." 
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

            <div className="sl-summary-grid">
                <div className="sl-sum-card">
                    <span className="sl-sum-label">Total Sales</span>
                    <strong className="sl-sum-val">₹{totalAmount.toLocaleString()}</strong>
                </div>
                <div className="sl-sum-card">
                    <span className="sl-sum-label">Orders</span>
                    <strong className="sl-sum-val">{totalOrders}</strong>
                </div>
                <div className="sl-sum-card">
                    <span className="sl-sum-label">Profit</span>
                    <strong className="sl-sum-val profit">₹{Math.round(totalProfit).toLocaleString()}</strong>
                </div>
                <div className="sl-sum-card">
                    <span className="sl-sum-label">Items</span>
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
                    <span className="mini-stat-label">Total Sales</span>
                    <strong className="mini-stat-val">₹{totalAmount.toLocaleString()}</strong>
                </div>
                <div className="mini-stat-card">
                    <span className="mini-stat-label">Orders</span>
                    <strong className="mini-stat-val">{totalOrders}</strong>
                </div>
                <div className="mini-stat-card">
                    <span className="mini-stat-label">Profit</span>
                    <strong className="mini-stat-val profit">₹{Math.round(totalProfit).toLocaleString()}</strong>
                </div>
                <div className="mini-stat-card">
                    <span className="mini-stat-label">Items</span>
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
                    title="No Transactions Found"
                    description={searchQuery ? `No transactions match your search "${searchQuery}".` : "No transactions recorded for the selected period."}
                    actionLabel={searchQuery ? "Clear Search" : "Create New Sale"}
                    onAction={searchQuery ? () => setSearchQuery('') : () => window.location.href = `/shop/${shopId}/pos`}
                    secondaryActionLabel={!searchQuery ? "Change Date" : null}
                    onSecondaryAction={() => setPeriodFilter('custom')}
                />
            ) : (
                <>
                    <div className="sl-list sl-mobile-only">
                        {paginatedSales.map((sale, idx) => (
                            <motion.div 
                                whileTap={{ scale: 0.98 }}
                                key={sale._id} 
                                className="sl-card-premium"
                                onClick={() => setSelectedSale(sale)}
                            >
                                <div className="sl-card-top">
                                    <div className="sl-card-name" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <span className={`type-tag-mobile ${(sale.type || 'SALE').toLowerCase()}`}>
                                            {sale.type || 'SALE'}
                                        </span>
                                        {sale.customerName || 'Walk-in Customer'}
                                    </div>
                                    <div className="sl-card-amount-wrap">
                                        <div className="sl-card-amount" style={{ color: sale.type === 'RETURN' ? '#DC2626' : sale.type === 'EXCHANGE' ? '#EA580C' : '#059669', fontWeight: 'bold' }}>
                                            {sale.type === 'RETURN' ? '-' : ''}₹{Math.abs(sale.totalAmount || 0).toLocaleString()}
                                        </div>
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
                                        <span>{new Date(sale.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                                        <span className="divider-dot">•</span>
                                        <span>Bill #{sale.invoiceNumber || sale._id.slice(-6).toUpperCase()}</span>
                                        <span className="divider-dot">•</span>
                                        <span className={`sl-cp-pay-badge ${sale.paymentMethod.toLowerCase()}`}>{sale.paymentMethod}</span>
                                    </div>
                                </div>
                            </motion.div>
                        ))}
                    </div>

                    <div className="sl-desktop-only radical-desktop-container">
                    <div className="rdc-header">
                        <div className="rdch-left">
                            <h3>Sales History</h3>
                            <p>{filteredSales.length} Transactions Found</p>
                        </div>
                        <div className="rdch-right">
                            <span className="rdch-stat">Total: <strong>₹{filteredSales.reduce((acc, s) => acc + (s.totalAmount || 0), 0).toLocaleString()}</strong></span>
                        </div>
                    </div>
                    <table className="radical-desktop-table">
                        <thead>
                            <tr>
                                <th>Type</th>
                                <th>Bill No</th>
                                <th>Customer Name</th>
                                <th>Date</th>
                                <th style={{ width: '25%' }}>Items Summary</th>
                                <th>Payment</th>
                                <th style={{ textAlign: 'center' }}>History</th>
                                <th style={{ textAlign: 'right' }}>Amount</th>
                                <th style={{ textAlign: 'right' }}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {paginatedSales.map((sale) => {
                                const customerHistory = sales.filter(s => 
                                    s._id !== sale._id && 
                                    sale.customerName && 
                                    sale.customerName !== 'Walk-in Customer' &&
                                    s.customerName?.toLowerCase().trim() === sale.customerName?.toLowerCase().trim()
                                );
                                const prevOrders = customerHistory.length;
                                
                                return (
                                    <tr key={sale._id} className="sl-desktop-row" onClick={() => setSelectedSale(sale)}>
                                        <td className="sld-type">
                                            <span className={`type-tag ${(sale.type || 'SALE').toLowerCase()}`}>
                                                {sale.type || 'SALE'}
                                            </span>
                                        </td>
                                        <td className="sld-bill">
                                            <span className="bill-badge">#{sale.invoiceNumber || sale._id.slice(-6).toUpperCase()}</span>
                                        </td>
                                        <td className="sld-cust">
                                            <div className="cust-main">{sale.customerName || 'Walk-in Customer'}</div>
                                            {sale.customerMobile && <div className="cust-sub">{sale.customerMobile}</div>}
                                        </td>
                                        <td className="sld-time">
                                            {new Date(sale.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                                        </td>
                                        <td className="sld-items">
                                            <div className="items-preview">
                                                {(sale.items || []).slice(0, 2).map(item => item.productName).join(', ')}
                                                {sale.items?.length > 2 && ` +${sale.items.length - 2} more`}
                                            </div>
                                        </td>
                                        <td className="sld-method">
                                            <span className={`method-badge ${sale.paymentMethod.toLowerCase()}`}>
                                                {sale.paymentMethod.toUpperCase()}
                                            </span>
                                        </td>
                                        <td className="sld-prev" style={{ textAlign: 'center' }}>
                                            <span className="history-count">{prevOrders} Orders</span>
                                        </td>
                                        <td className="sld-amt" style={{ textAlign: 'right', fontWeight: 'bold', color: sale.type === 'RETURN' ? '#DC2626' : sale.type === 'EXCHANGE' ? '#EA580C' : '#059669' }}>
                                            <div className="amt-val">
                                                {sale.type === 'RETURN' ? '-' : ''}₹{Math.abs(sale.totalAmount || 0).toLocaleString()}
                                            </div>
                                        </td>
                                        <td className="sld-actions" style={{ textAlign: 'right' }} onClick={(e) => e.stopPropagation()}>
                                            <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                                                <button className="sl-btn-action view" onClick={() => handleViewBill(sale._id)}>View Bill</button>
                                                {sale.type === 'SALE' && (
                                                    <>
                                                        <button className="sl-btn-action return" onClick={() => handleOpenReturnModal(sale)}>Return</button>
                                                        <button className="sl-btn-action exchange" onClick={() => handleOpenExchangeModal(sale)}>Exchange</button>
                                                    </>
                                                )}
                                            </div>
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
                    Load More Transactions
                </button>
            )}

            <AnimatePresence>
                {selectedSale && !isInvoiceOpen && (
                    <motion.div 
                        key={`sale-modal-${selectedSale._id}`}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="sl-modal-overlay"
                    >
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="sl-backdrop" onClick={() => setSelectedSale(null)} />
                        <motion.div 
                            initial={{ y: "100%" }} 
                            animate={{ y: 0 }} 
                            exit={{ y: "100%" }} 
                            transition={{ type: "spring", damping: 25, stiffness: 200 }}
                            className="sl-sheet"
                        >
                            <div className="sl-sheet-handle"></div>
                            
                            <div className="sl-m-header-v2">
                                <div className="slmh-title">
                                    <h3 style={{ fontSize: '20px', fontWeight: 800, color: '#0f172a' }}>Sale Details</h3>
                                    <p style={{ fontSize: '13px', color: '#64748b', fontWeight: 600, marginTop: '2px' }}>
                                        Bill #{selectedSale.invoiceNumber || selectedSale._id.slice(-6).toUpperCase()} • {new Date(selectedSale.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })} • {new Date(selectedSale.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </p>
                                </div>
                                <button className="sl-m-close-v2" onClick={() => setSelectedSale(null)} style={{ background: '#f1f5f9', padding: '8px', borderRadius: '50%' }}><X size={20} /></button>
                            </div>

                            <div className="sl-m-content-v2">
                                <div className="radical-details-grid">
                                    <div className="rdg-col">
                                        <label>Customer</label>
                                        <span>{selectedSale.customerName || 'Walk-in Customer'}</span>
                                    </div>
                                    <div className="rdg-col">
                                        <label>Payment Method</label>
                                        <span className={`method-badge ${selectedSale.paymentMethod.toLowerCase()}`}>
                                            {selectedSale.paymentMethod.toUpperCase()}
                                        </span>
                                    </div>
                                    <div className="rdg-col">
                                        <label>Status</label>
                                        <span className={`status-badge ${selectedSale.paymentMethod === 'Khata' ? 'pending' : 'paid'}`}>
                                            {selectedSale.paymentMethod === 'Khata' ? 'Payment Pending' : 'Fully Paid'}
                                        </span>
                                    </div>
                                    <div className="rdg-col">
                                        <label>Transaction Time</label>
                                        <span>{new Date(selectedSale.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
                                    </div>
                                </div>

                                <div className="radical-items-section">
                                    <h4 style={{ fontSize: '12px', textTransform: 'uppercase', color: '#94a3b8', letterSpacing: '0.05em', marginBottom: '12px' }}>
                                        {selectedSale.type === 'SALE' ? 'Effective Sale Items' : selectedSale.type === 'RETURN' ? 'Returned Items' : 'Exchanged Items'}
                                    </h4>
                                    <table className="radical-invoice-table">
                                        {selectedSale.type === 'SALE' ? (
                                            <>
                                                <thead>
                                                    <tr>
                                                        <th>Item Description</th>
                                                        <th style={{ textAlign: 'center' }}>Sold</th>
                                                        <th style={{ textAlign: 'center' }}>Returned</th>
                                                        <th style={{ textAlign: 'center' }}>Remaining</th>
                                                        <th style={{ textAlign: 'right' }}>Rate</th>
                                                        <th style={{ textAlign: 'right' }}>Total</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {(() => {
                                                        const alreadyReturnedMap = getAlreadyReturnedQuantities(selectedSale._id);
                                                        return (selectedSale.items || []).map((item, i) => {
                                                            const soldQty = item.soldQtyEntered || item.quantity || 0;
                                                            const alreadyRet = alreadyReturnedMap[item.product] || 0;
                                                            const multiplier = item.multiplier || 1;
                                                            const returnedQty = parseFloat((alreadyRet / multiplier).toFixed(3));
                                                            const remainingQty = Math.max(0, parseFloat((soldQty - returnedQty).toFixed(3)));
                                                            const rate = item.pricePerBaseUnit || item.price || 0;
                                                            const total = remainingQty * rate;

                                                            return (
                                                                <tr key={i}>
                                                                    <td>
                                                                        <div className="rit-name">{item.productName}</div>
                                                                        <div className="rit-unit">{item.soldUnit || item.unit}</div>
                                                                    </td>
                                                                    <td style={{ textAlign: 'center', fontWeight: 600 }}>{soldQty}</td>
                                                                    <td style={{ textAlign: 'center', color: '#dc2626', fontWeight: 600 }}>{returnedQty}</td>
                                                                    <td style={{ textAlign: 'center', color: '#16a34a', fontWeight: 700 }}>{remainingQty}</td>
                                                                    <td style={{ textAlign: 'right' }}>₹{rate.toLocaleString()}</td>
                                                                    <td style={{ textAlign: 'right', fontWeight: 800 }}>₹{total.toLocaleString()}</td>
                                                                </tr>
                                                            );
                                                        });
                                                    })()}
                                                </tbody>
                                            </>
                                        ) : selectedSale.type === 'EXCHANGE' ? (
                                            <>
                                                <thead>
                                                    <tr>
                                                        <th>Item Description</th>
                                                        <th style={{ textAlign: 'center' }}>Type</th>
                                                        <th style={{ textAlign: 'center' }}>Qty</th>
                                                        <th style={{ textAlign: 'right' }}>Rate</th>
                                                        <th style={{ textAlign: 'right' }}>Total</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {(selectedSale.items || []).map((item, i) => {
                                                        const isRet = item.isReturnedInExchange;
                                                        const qty = item.soldQtyEntered || item.quantity || 0;
                                                        const rate = item.pricePerBaseUnit || item.price || 0;
                                                        const total = qty * rate;

                                                        return (
                                                            <tr key={i} style={{ color: isRet ? '#b91c1c' : '#0f172a' }}>
                                                                <td>
                                                                    <div className="rit-name">{item.productName}</div>
                                                                    <div className="rit-unit">{item.soldUnit || item.unit}</div>
                                                                </td>
                                                                <td style={{ textAlign: 'center' }}>
                                                                    <span style={{ padding: '2px 8px', borderRadius: '6px', fontSize: '11px', background: isRet ? '#fef2f2' : '#eff6ff', color: isRet ? '#b91c1c' : '#1e40af', fontWeight: 600 }}>
                                                                        {isRet ? 'Returned' : 'Replacement'}
                                                                    </span>
                                                                </td>
                                                                <td style={{ textAlign: 'center', fontWeight: 700 }}>{qty}</td>
                                                                <td style={{ textAlign: 'right' }}>₹{rate.toLocaleString()}</td>
                                                                <td style={{ textAlign: 'right', fontWeight: 800 }}>₹{total.toLocaleString()}</td>
                                                            </tr>
                                                        );
                                                    })}
                                                </tbody>
                                            </>
                                        ) : (
                                            <>
                                                {/* RETURN transaction */}
                                                <thead>
                                                    <tr>
                                                        <th>Item Description</th>
                                                        <th style={{ textAlign: 'center' }}>Qty</th>
                                                        <th style={{ textAlign: 'right' }}>Rate</th>
                                                        <th style={{ textAlign: 'right' }}>Total</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {(selectedSale.items || []).map((item, i) => {
                                                        const qty = item.soldQtyEntered || item.quantity || 0;
                                                        const rate = item.pricePerBaseUnit || item.price || 0;
                                                        const total = qty * rate;

                                                        return (
                                                            <tr key={i} style={{ color: '#b91c1c' }}>
                                                                <td>
                                                                    <div className="rit-name">{item.productName}</div>
                                                                    <div className="rit-unit">{item.soldUnit || item.unit}</div>
                                                                </td>
                                                                <td style={{ textAlign: 'center', fontWeight: 700 }}>{qty}</td>
                                                                <td style={{ textAlign: 'right' }}>₹{rate.toLocaleString()}</td>
                                                                <td style={{ textAlign: 'right', fontWeight: 800 }}>₹{total.toLocaleString()}</td>
                                                            </tr>
                                                        );
                                                    })}
                                                </tbody>
                                            </>
                                        )}
                                    </table>
                                </div>

                                <div className="radical-summary-section">
                                    {selectedSale.type === 'SALE' ? (
                                        (() => {
                                            const alreadyReturnedMap = getAlreadyReturnedQuantities(selectedSale._id);
                                            const effectiveSubtotal = (selectedSale.items || []).reduce((sum, item) => {
                                                const soldQty = item.soldQtyEntered || item.quantity || 0;
                                                const alreadyRet = alreadyReturnedMap[item.product] || 0;
                                                const multiplier = item.multiplier || 1;
                                                const returnedQty = parseFloat((alreadyRet / multiplier).toFixed(3));
                                                const remainingQty = Math.max(0, parseFloat((soldQty - returnedQty).toFixed(3)));
                                                const rate = item.pricePerBaseUnit || item.price || 0;
                                                return sum + (remainingQty * rate);
                                            }, 0);
                                            const discount = selectedSale.discount || 0;
                                            const effectiveGrandTotal = Math.max(0, effectiveSubtotal - discount);

                                            return (
                                                <>
                                                    <div className="rs-row">
                                                        <span>Subtotal (Effective)</span>
                                                        <span>₹{effectiveSubtotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                                    </div>
                                                    {discount > 0 && (
                                                        <div className="rs-row discount">
                                                            <span>Discount</span>
                                                            <span>- ₹{discount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                                        </div>
                                                    )}
                                                    <div className="rs-row grand">
                                                        <span>Grand Total</span>
                                                        <strong>₹{effectiveGrandTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
                                                    </div>
                                                </>
                                            );
                                        })()
                                    ) : selectedSale.type === 'EXCHANGE' ? (
                                        <>
                                            <div className="rs-row">
                                                <span>Total Returned</span>
                                                <span style={{ color: '#b91c1c', fontWeight: 600 }}>₹{selectedSale.totalReturnedValue?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00'}</span>
                                            </div>
                                            <div className="rs-row">
                                                <span>Total Replacement</span>
                                                <span style={{ color: '#1e40af', fontWeight: 600 }}>₹{selectedSale.totalReplacementValue?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00'}</span>
                                            </div>
                                            <div className="rs-row grand" style={{ 
                                                color: selectedSale.balanceDifference >= 0 ? '#1e40af' : '#b91c1c' 
                                            }}>
                                                <span>{selectedSale.balanceDifference >= 0 ? 'Balance Due' : 'Refund Due'}</span>
                                                <strong>₹{Math.abs(selectedSale.balanceDifference || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
                                            </div>
                                        </>
                                    ) : (
                                        /* RETURN transaction */
                                        <>
                                            <div className="rs-row grand" style={{ color: '#b91c1c' }}>
                                                <span>Total Refund</span>
                                                <strong>₹{Math.abs(selectedSale.totalAmount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
                                            </div>
                                        </>
                                    )}
                                </div>
                            </div>

                            <div className="radical-sticky-footer" style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                                <button className="r-btn r-btn-primary" onClick={() => handleViewBill(selectedSale._id)}>
                                    <Receipt size={18} />
                                    <span>View Bill</span>
                                </button>
                                
                                {selectedSale.type === 'SALE' && (
                                    <>
                                        <button className="r-btn r-btn-warning" style={{ background: '#FFF7ED', color: '#EA580C', border: '1px solid #FFEDD5' }} onClick={() => { handleOpenReturnModal(selectedSale); setSelectedSale(null); }}>
                                            <ArrowDownCircle size={18} />
                                            <span>Return</span>
                                        </button>
                                        <button className="r-btn r-btn-info" style={{ background: '#EEF2FF', color: '#4F46E5', border: '1px solid #E0E7FF' }} onClick={() => { handleOpenExchangeModal(selectedSale); setSelectedSale(null); }}>
                                            <ArrowDownCircle size={18} />
                                            <span>Exchange</span>
                                        </button>
                                    </>
                                )}

                                {selectedSale.paymentMethod === 'Khata' && (
                                    <button className="r-btn r-btn-success" onClick={() => window.location.href = `/khata/${shopId}`}>
                                        <ArrowDownCircle size={18} />
                                        <span>Receive Payment</span>
                                    </button>
                                )}

                                <button className="r-btn r-btn-secondary" onClick={() => handleShareWhatsApp()}>
                                    <MessageSquare size={18} />
                                    <span>Share</span>
                                </button>
                                
                                <button className="r-btn r-btn-outline" onClick={() => setSelectedSale(null)}>
                                    Close
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
            
            <AnimatePresence>
                {isInvoiceOpen && (
                    <motion.div 
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 20 }}
                        className="invoice-preview-screen"
                    >
                        <div className="ips-top-bar">
                            <button className="ips-back-btn" onClick={() => setIsInvoiceOpen(false)}>
                                <ChevronLeft size={20} />
                                <span>Back</span>
                            </button>
                            <h2>View Bill</h2>
                            <div style={{ width: 60 }} />
                        </div>

                        <div className="ips-content">
                            {invoiceLoading ? (
                                <div className="khata-loader"><div className="spinner"></div></div>
                            ) : !selectedSaleForInvoice ? (
                                <div className="ips-error">Bill details could not be found.</div>
                            ) : (
                                <div className="printable-invoice-sheet">
                                    <div className="pis-header">
                                        <div className="pis-logo-circle">{(shop?.name || 'S')[0]}</div>
                                        <h1 className="pis-shop-name">{shop?.name || 'ShopPulse Business'}</h1>
                                        <p className="pis-shop-address">{shop?.location || 'Ankisa, Maharashtra'}</p>
                                        <p className="pis-shop-contact">Phone: {shop?.contactNumber || 'XXXXXXXXXX'} | GSTIN: {shop?.gstNumber || 'N/A'}</p>
                                    </div>

                                    <div className="pis-divider-solid"></div>

                                    <div className="pis-info-grid">
                                        <div className="pis-info-col">
                                            <span className="pis-info-label">INVOICE DETAILS</span>
                                            <div className="pis-info-row">
                                                <label>Invoice No:</label>
                                                <strong>#{selectedSaleForInvoice._id.slice(-6).toUpperCase()}</strong>
                                            </div>
                                            <div className="pis-info-row">
                                                <label>Date:</label>
                                                <span>{new Date(selectedSaleForInvoice.date).toLocaleDateString('en-IN')}</span>
                                            </div>
                                            <div className="pis-info-row">
                                                <label>Time:</label>
                                                <span>{new Date(selectedSaleForInvoice.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                            </div>
                                            <div className="pis-info-row">
                                                <label>Payment:</label>
                                                <strong className="pis-payment-method">{selectedSaleForInvoice.paymentMethod.toUpperCase()}</strong>
                                            </div>
                                        </div>
                                        <div className="pis-info-col">
                                            <span className="pis-info-label">CUSTOMER DETAILS</span>
                                            <div className="pis-info-row">
                                                <label>Name:</label>
                                                <strong>{selectedSaleForInvoice.customerName || 'Walk-in Customer'}</strong>
                                            </div>
                                            {selectedSaleForInvoice.customerMobile && (
                                                <div className="pis-info-row">
                                                    <label>Mobile:</label>
                                                    <span>{selectedSaleForInvoice.customerMobile}</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {selectedSaleForInvoice.type === 'SALE' ? (
                                        <>
                                            {/* Original Sale Bill: Dynamic Effective Sale */}
                                            <span className="pis-info-label" style={{ color: '#2563eb' }}>Current Effective Items (In Possession)</span>
                                            <table className="pis-items-table-v2">
                                                <thead>
                                                    <tr>
                                                        <th style={{ width: '40px' }}>Sl</th>
                                                        <th>Product Description</th>
                                                        <th style={{ textAlign: 'center' }}>Qty</th>
                                                        <th style={{ textAlign: 'right' }}>Rate</th>
                                                        <th style={{ textAlign: 'right' }}>Amount</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {(selectedSaleForInvoice.items || [])
                                                        .filter(item => (item.remainingQty !== undefined ? item.remainingQty : item.soldQtyEntered || item.quantity) > 0)
                                                        .map((item, idx) => {
                                                            const qty = item.remainingQty !== undefined ? item.remainingQty : (item.soldQtyEntered || item.quantity || 0);
                                                            const rate = item.pricePerBaseUnit || item.price || 0;
                                                            return (
                                                                <tr key={idx}>
                                                                    <td>{idx + 1}</td>
                                                                    <td>{item.productName}</td>
                                                                    <td style={{ textAlign: 'center' }}>{qty} {item.soldUnit || item.unit || 'Pc'}</td>
                                                                    <td style={{ textAlign: 'right' }}>₹{rate.toFixed(2)}</td>
                                                                    <td style={{ textAlign: 'right' }}>₹{(qty * rate).toFixed(2)}</td>
                                                                </tr>
                                                            );
                                                        })}
                                                </tbody>
                                            </table>

                                            {/* Show returns in a separate table if any exist */}
                                            {(selectedSaleForInvoice.items || []).some(item => (item.returnedQty || 0) > 0) && (
                                                <div style={{ marginTop: '24px' }}>
                                                    <span className="pis-info-label" style={{ color: '#EF4444' }}>Returned / Exchanged Items</span>
                                                    <table className="pis-items-table-v2" style={{ borderColor: '#FEE2E2', marginTop: '8px' }}>
                                                        <thead>
                                                            <tr style={{ background: '#FEF2F2' }}>
                                                                <th style={{ width: '40px', color: '#991B1B' }}>Sl</th>
                                                                <th style={{ color: '#991B1B' }}>Product Description</th>
                                                                <th style={{ textAlign: 'center', color: '#991B1B' }}>Qty Returned</th>
                                                                <th style={{ textAlign: 'right', color: '#991B1B' }}>Rate</th>
                                                                <th style={{ textAlign: 'right', color: '#991B1B' }}>Refunded Value</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody>
                                                            {(selectedSaleForInvoice.items || [])
                                                                .filter(item => (item.returnedQty || 0) > 0)
                                                                .map((item, idx) => {
                                                                    const rQty = item.returnedQty || 0;
                                                                    const rate = item.pricePerBaseUnit || item.price || 0;
                                                                    return (
                                                                        <tr key={idx} style={{ color: '#991B1B' }}>
                                                                            <td>{idx + 1}</td>
                                                                            <td>{item.productName}</td>
                                                                            <td style={{ textAlign: 'center', fontWeight: 700 }}>{rQty} {item.soldUnit || item.unit || 'Pc'}</td>
                                                                            <td style={{ textAlign: 'right' }}>₹{rate.toFixed(2)}</td>
                                                                            <td style={{ textAlign: 'right', fontWeight: 700 }}>₹{(rQty * rate).toFixed(2)}</td>
                                                                        </tr>
                                                                    );
                                                                })}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            )}

                                            {/* Mobile Item Cards */}
                                            <div className="pis-items-mobile-list">
                                                {(selectedSaleForInvoice.items || [])
                                                    .filter(item => (item.remainingQty !== undefined ? item.remainingQty : item.soldQtyEntered || item.quantity) > 0)
                                                    .map((item, idx) => {
                                                        const qty = item.remainingQty !== undefined ? item.remainingQty : (item.soldQtyEntered || item.quantity || 0);
                                                        const rate = item.pricePerBaseUnit || item.price || 0;
                                                        return (
                                                            <div key={idx} className="pis-mobile-item-card">
                                                                <div className="pmic-header">
                                                                    <span className="pmic-sl">#{idx + 1}</span>
                                                                    <span className="pmic-name">{item.productName}</span>
                                                                </div>
                                                                <div className="pmic-body">
                                                                    <div className="pmic-col">
                                                                        <label>Qty</label>
                                                                        <span>{qty} {item.soldUnit || item.unit || 'Pc'}</span>
                                                                    </div>
                                                                    <div className="pmic-col">
                                                                        <label>Rate</label>
                                                                        <span>₹{rate.toFixed(2)}</span>
                                                                    </div>
                                                                    <div className="pmic-col">
                                                                        <label>Amount</label>
                                                                        <strong>₹{(qty * rate).toFixed(2)}</strong>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                            </div>

                                            {/* Subtotal calculation based on effective items */}
                                            {(() => {
                                                const effectiveSubtotal = (selectedSaleForInvoice.items || [])
                                                    .reduce((sum, item) => sum + ((item.remainingQty !== undefined ? item.remainingQty : item.soldQtyEntered || item.quantity || 0) * (item.pricePerBaseUnit || item.price || 0)), 0);
                                                const discount = selectedSaleForInvoice.discount || 0;
                                                const grandTotal = Math.max(0, effectiveSubtotal - discount);
                                                return (
                                                    <div className="pis-summary-v2">
                                                        <div className="pis-summary-box">
                                                            <div className="pis-sum-row">
                                                                <span>Subtotal (Effective):</span>
                                                                <span>₹{effectiveSubtotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                                                            </div>
                                                            {discount > 0 && (
                                                                <div className="pis-sum-row discount">
                                                                    <span>Discount:</span>
                                                                    <span>- ₹{discount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                                                                </div>
                                                            )}
                                                            <div className="pis-sum-row grand">
                                                                <span>GRAND TOTAL:</span>
                                                                <span>₹{grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })()}
                                        </>
                                    ) : selectedSaleForInvoice.type === 'RETURN' ? (
                                        <>
                                            {/* Return Receipt */}
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', background: '#F8FAFC', padding: '12px 16px', borderRadius: '12px', border: '1px solid #E2E8F0' }}>
                                                <span style={{ fontWeight: 700, fontSize: '13px', color: '#64748B' }}>LINKED BILL:</span>
                                                <span style={{ fontWeight: 800, fontSize: '14px', color: '#0F172A' }}>#{selectedSaleForInvoice.originalSaleInvoice || 'N/A'}</span>
                                            </div>

                                            <span className="pis-info-label" style={{ color: '#EF4444' }}>Returned Items (Refunded)</span>
                                            <table className="pis-items-table-v2" style={{ borderColor: '#FEE2E2', marginTop: '6px' }}>
                                                <thead>
                                                    <tr style={{ background: '#FEF2F2' }}>
                                                        <th style={{ width: '40px', color: '#991B1B' }}>Sl</th>
                                                        <th style={{ color: '#991B1B' }}>Product Description</th>
                                                        <th style={{ textAlign: 'center', color: '#991B1B' }}>Qty</th>
                                                        <th style={{ textAlign: 'right', color: '#991B1B' }}>Rate</th>
                                                        <th style={{ textAlign: 'right', color: '#991B1B' }}>Amount</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {(selectedSaleForInvoice.items || []).map((item, idx) => {
                                                        const qty = item.soldQtyEntered || item.quantity || 0;
                                                        const rate = item.pricePerBaseUnit || item.price || 0;
                                                        return (
                                                            <tr key={idx} style={{ color: '#991B1B' }}>
                                                                <td>{idx + 1}</td>
                                                                <td>{item.productName}</td>
                                                                <td style={{ textAlign: 'center', fontWeight: 700 }}>{qty} {item.soldUnit || item.unit || 'Pc'}</td>
                                                                <td style={{ textAlign: 'right' }}>₹{rate.toFixed(2)}</td>
                                                                <td style={{ textAlign: 'right', fontWeight: 700 }}>₹{(qty * rate).toFixed(2)}</td>
                                                            </tr>
                                                        );
                                                    })}
                                                </tbody>
                                            </table>

                                            {/* Remaining active items */}
                                            {selectedSaleForInvoice.remainingActiveItems && selectedSaleForInvoice.remainingActiveItems.length > 0 && (
                                                <div style={{ marginTop: '24px' }}>
                                                    <span className="pis-info-label" style={{ color: '#16A34A' }}>Remaining Items (In Possession After Return)</span>
                                                    <table className="pis-items-table-v2" style={{ borderColor: '#DCFCE7', marginTop: '8px' }}>
                                                        <thead>
                                                            <tr style={{ background: '#F0FDF4' }}>
                                                                <th style={{ width: '40px', color: '#166534' }}>Sl</th>
                                                                <th style={{ color: '#166534' }}>Product Description</th>
                                                                <th style={{ textAlign: 'center', color: '#166534' }}>Qty Remaining</th>
                                                                <th style={{ textAlign: 'right', color: '#166534' }}>Rate</th>
                                                                <th style={{ textAlign: 'right', color: '#166534' }}>Total</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody>
                                                            {selectedSaleForInvoice.remainingActiveItems.map((item, idx) => (
                                                                <tr key={idx} style={{ color: '#166534' }}>
                                                                    <td>{idx + 1}</td>
                                                                    <td>{item.productName}</td>
                                                                    <td style={{ textAlign: 'center', fontWeight: 700 }}>{item.quantity} {item.unit || 'Pc'}</td>
                                                                    <td style={{ textAlign: 'right' }}>₹{item.price.toFixed(2)}</td>
                                                                    <td style={{ textAlign: 'right', fontWeight: 700 }}>₹{item.totalPrice.toFixed(2)}</td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            )}

                                            <div className="pis-summary-v2">
                                                <div className="pis-summary-box">
                                                    <div className="pis-sum-row grand" style={{ background: '#FEF2F2', borderColor: '#FCA5A5', color: '#B91C1C' }}>
                                                        <span>TOTAL REFUND:</span>
                                                        <span>₹{selectedSaleForInvoice.totalRefundAmount?.toLocaleString(undefined, { minimumFractionDigits: 2 }) || '0.00'}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </>
                                    ) : (
                                        <>
                                            {/* Exchange Receipt */}
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', background: '#F8FAFC', padding: '12px 16px', borderRadius: '12px', border: '1px solid #E2E8F0' }}>
                                                <span style={{ fontWeight: 700, fontSize: '13px', color: '#64748B' }}>LINKED BILL:</span>
                                                <span style={{ fontWeight: 800, fontSize: '14px', color: '#0F172A' }}>#{selectedSaleForInvoice.originalSaleInvoice || 'N/A'}</span>
                                            </div>

                                            {/* Exchanged Details */}
                                            <span className="pis-info-label" style={{ color: '#EA580C' }}>Items Returned / Replaced</span>
                                            <table className="pis-items-table-v2" style={{ marginTop: '6px' }}>
                                                <thead>
                                                    <tr>
                                                        <th style={{ width: '40px' }}>Sl</th>
                                                        <th>Product Description</th>
                                                        <th style={{ textAlign: 'center' }}>Type</th>
                                                        <th style={{ textAlign: 'center' }}>Qty</th>
                                                        <th style={{ textAlign: 'right' }}>Rate</th>
                                                        <th style={{ textAlign: 'right' }}>Amount</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {(selectedSaleForInvoice.items || []).map((item, idx) => {
                                                        const isRet = item.isReturnedInExchange;
                                                        const qty = item.soldQtyEntered || item.quantity || 0;
                                                        const rate = item.pricePerBaseUnit || item.price || 0;
                                                        return (
                                                            <tr key={idx} style={{ color: isRet ? '#B91C1C' : '#0F172A' }}>
                                                                <td>{idx + 1}</td>
                                                                <td>{item.productName}</td>
                                                                <td style={{ textAlign: 'center', fontWeight: 700 }}>
                                                                    <span style={{ padding: '2px 8px', borderRadius: '6px', fontSize: '11px', background: isRet ? '#FEF2F2' : '#EFF6FF', color: isRet ? '#B91C1C' : '#1E40AF' }}>
                                                                        {isRet ? 'Returned' : 'Replacement'}
                                                                    </span>
                                                                </td>
                                                                <td style={{ textAlign: 'center', fontWeight: 700 }}>{qty} {item.soldUnit || item.unit || 'Pc'}</td>
                                                                <td style={{ textAlign: 'right' }}>₹{rate.toFixed(2)}</td>
                                                                <td style={{ textAlign: 'right' }}>₹{(qty * rate).toFixed(2)}</td>
                                                            </tr>
                                                        );
                                                    })}
                                                </tbody>
                                            </table>

                                            {/* Remaining active items */}
                                            {selectedSaleForInvoice.remainingActiveItems && selectedSaleForInvoice.remainingActiveItems.length > 0 && (
                                                <div style={{ marginTop: '24px' }}>
                                                    <span className="pis-info-label" style={{ color: '#16A34A' }}>Remaining Items (In Possession After Exchange)</span>
                                                    <table className="pis-items-table-v2" style={{ borderColor: '#DCFCE7', marginTop: '8px' }}>
                                                        <thead>
                                                            <tr style={{ background: '#F0FDF4' }}>
                                                                <th style={{ width: '40px', color: '#166534' }}>Sl</th>
                                                                <th style={{ color: '#166534' }}>Product Description</th>
                                                                <th style={{ textAlign: 'center', color: '#166534' }}>Qty Remaining</th>
                                                                <th style={{ textAlign: 'right', color: '#166534' }}>Rate</th>
                                                                <th style={{ textAlign: 'right', color: '#166534' }}>Total</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody>
                                                            {selectedSaleForInvoice.remainingActiveItems.map((item, idx) => (
                                                                <tr key={idx} style={{ color: '#166534' }}>
                                                                    <td>{idx + 1}</td>
                                                                    <td>{item.productName}</td>
                                                                    <td style={{ textAlign: 'center', fontWeight: 700 }}>{item.quantity} {item.unit || 'Pc'}</td>
                                                                    <td style={{ textAlign: 'right' }}>₹{item.price.toFixed(2)}</td>
                                                                    <td style={{ textAlign: 'right', fontWeight: 700 }}>₹{item.totalPrice.toFixed(2)}</td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            )}

                                            <div className="pis-summary-v2">
                                                <div className="pis-summary-box">
                                                    <div className="pis-sum-row">
                                                        <span>Total Returned:</span>
                                                        <span style={{ color: '#B91C1C', fontWeight: 700 }}>₹{selectedSaleForInvoice.totalReturnedValue?.toLocaleString(undefined, { minimumFractionDigits: 2 }) || '0.00'}</span>
                                                    </div>
                                                    <div className="pis-sum-row">
                                                        <span>Total Replacement:</span>
                                                        <span style={{ color: '#1E40AF', fontWeight: 700 }}>₹{selectedSaleForInvoice.totalReplacementValue?.toLocaleString(undefined, { minimumFractionDigits: 2 }) || '0.00'}</span>
                                                    </div>
                                                    <div className="pis-sum-row grand" style={{ 
                                                        background: selectedSaleForInvoice.balanceDifference >= 0 ? '#EFF6FF' : '#FEF2F2',
                                                        borderColor: selectedSaleForInvoice.balanceDifference >= 0 ? '#BFDBFE' : '#FCA5A5',
                                                        color: selectedSaleForInvoice.balanceDifference >= 0 ? '#1E40AF' : '#B91C1C' 
                                                    }}>
                                                        <span>{selectedSaleForInvoice.balanceDifference >= 0 ? 'BALANCE DUE:' : 'REFUND DUE:'}</span>
                                                        <span>₹{Math.abs(selectedSaleForInvoice.balanceDifference || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </>
                                    )}

                                    <div className="pis-footer-v2">
                                        <div className="pis-footer-divider"></div>
                                        <h3>Thank you for your business!</h3>
                                        <p>Returns accepted within 7 days with original bill.</p>
                                        <p>This is a computer generated invoice.</p>
                                        <div className="pis-brand-footer">Generated by ShopPulse POS</div>
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="ips-actions-bar">
                            <button className="ips-btn ips-wa" onClick={() => handleShareWhatsApp()}>
                                WhatsApp
                            </button>
                            <button className="ips-btn ips-pdf" onClick={() => handleDownloadPDF()}>
                                Download PDF
                            </button>
                            <button className="ips-btn ips-print" onClick={() => window.print()}>
                                Print
                            </button>
                            <button className="ips-btn ips-close" onClick={() => setIsInvoiceOpen(false)}>
                                Close
                            </button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Return Modal */}
            <AnimatePresence>
                {showReturnModal && saleToReturn && (
                    <div className="sl-modal-overlay-custom">
                        <div className="sl-modal-backdrop-custom" onClick={() => { if (!isReturnSubmitting) setShowReturnModal(false); }} />
                        <div className="sl-modal-sheet-custom">
                            <div className="sl-modal-header-custom">
                                <div>
                                    <h3>Process Product Return</h3>
                                    <p>Bill #{saleToReturn.invoiceNumber || saleToReturn._id.slice(-6).toUpperCase()} • {saleToReturn.customerName || 'Walk-in Customer'}</p>
                                </div>
                                <button className="sl-modal-close-custom" onClick={() => { if (!isReturnSubmitting) setShowReturnModal(false); }} disabled={isReturnSubmitting}><X size={18} /></button>
                            </div>
                            <form onSubmit={handleReturnSubmit} style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
                                <div className="sl-modal-content-custom">
                                    <div className="item-list-container">
                                        <div className="item-row-custom header">
                                            <span>Item</span>
                                            <span style={{ textAlign: 'center' }}>Sold Qty</span>
                                            <span style={{ textAlign: 'center' }}>Already Ret</span>
                                            <span style={{ textAlign: 'center' }}>Return Qty</span>
                                        </div>
                                        {saleToReturn.items.map(item => {
                                            const alreadyRet = getAlreadyReturnedQuantities(saleToReturn._id)[item.product] || 0;
                                            const multiplier = item.multiplier || 1;
                                            const maxReturnable = (item.soldQtyBaseUnit - alreadyRet) / multiplier;

                                            return (
                                                <div key={item.product} className="item-row-custom">
                                                    <div>
                                                        <div style={{ fontWeight: 800, fontSize: '14px', color: '#1E293B' }}>{item.productName}</div>
                                                        <div style={{ fontSize: '11px', color: '#64748B' }}>₹{item.pricePerBaseUnit || item.price} / {item.soldUnit || item.unit}</div>
                                                    </div>
                                                    <span style={{ textAlign: 'center', fontWeight: 600 }}>{item.soldQtyEntered || item.quantity} {item.soldUnit || item.unit}</span>
                                                    <span style={{ textAlign: 'center', color: '#EF4444', fontWeight: 600 }}>{alreadyRet / multiplier} {item.soldUnit || item.unit}</span>
                                                    <div className="qty-input-wrap" style={{ justifyContent: 'center' }}>
                                                        <input 
                                                            type="number" 
                                                            min="0" 
                                                            max={maxReturnable} 
                                                            step="any"
                                                            value={returnQuantities[item.product] || 0} 
                                                            onChange={(e) => {
                                                                const val = Number(e.target.value);
                                                                setReturnQuantities(prev => ({
                                                                    ...prev,
                                                                    [item.product]: val
                                                                }));
                                                            }}
                                                        />
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>

                                    <div>
                                        <label style={{ fontSize: '13px', fontWeight: 800, color: '#334155', display: 'block', marginBottom: '6px' }}>Return Reason</label>
                                        <textarea 
                                            rows="2" 
                                            className="reason-input-textarea" 
                                            placeholder="Specify reason for return (e.g. defective product, customer change of mind)..."
                                            value={returnReason}
                                            onChange={(e) => setReturnReason(e.target.value)}
                                        />
                                    </div>

                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                                        <div>
                                            <label style={{ fontSize: '13px', fontWeight: 800, color: '#334155', display: 'block', marginBottom: '6px' }}>Refund Method</label>
                                            <select 
                                                className="select-refund-method"
                                                value={refundMethod}
                                                onChange={(e) => setRefundMethod(e.target.value)}
                                            >
                                                <option value="Cash">Cash</option>
                                                <option value="UPI">UPI / Online</option>
                                                {saleToReturn.paymentMethod === 'Khata' && <option value="Khata">Khata Dues Reduction</option>}
                                            </select>
                                        </div>
                                        <div className="summary-box-custom" style={{ justifyContent: 'center' }}>
                                            <div className="summary-row-custom total">
                                                <span>Total Refund</span>
                                                <span>₹{Object.entries(returnQuantities).reduce((acc, [productId, qty]) => {
                                                    const saleItem = saleToReturn.items.find(item => item.product === productId);
                                                    const rate = saleItem.pricePerBaseUnit || saleItem.price || 0;
                                                    const mult = saleItem.multiplier || 1;
                                                    return acc + (qty * mult * rate);
                                                }, 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <div className="sl-modal-footer-custom">
                                    <button type="button" className="sl-btn-action view" onClick={() => setShowReturnModal(false)} disabled={isReturnSubmitting}>Cancel</button>
                                    <button type="submit" className="sl-btn-action return" style={{ color: 'white', background: '#EF4444' }} disabled={isReturnSubmitting}>
                                        {isReturnSubmitting ? 'Processing Return...' : 'Confirm Return'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}
            </AnimatePresence>

            {/* Exchange Modal */}
            <AnimatePresence>
                {showExchangeModal && saleToExchange && (
                    <div className="sl-modal-overlay-custom">
                        <div className="sl-modal-backdrop-custom" onClick={() => { if (!isExchangeSubmitting) setShowExchangeModal(false); }} />
                        <div className="sl-modal-sheet-custom" style={{ maxWidth: '800px' }}>
                            <div className="sl-modal-header-custom">
                                <div>
                                    <h3>Process Exchange</h3>
                                    <p>Exchange items for Bill #{saleToExchange.invoiceNumber || saleToExchange._id.slice(-6).toUpperCase()}</p>
                                </div>
                                <button className="sl-modal-close-custom" onClick={() => { if (!isExchangeSubmitting) setShowExchangeModal(false); }} disabled={isExchangeSubmitting}><X size={18} /></button>
                            </div>
                            <form onSubmit={handleExchangeSubmit} style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
                                <div className="sl-modal-content-custom" style={{ gap: '16px' }}>
                                    
                                    {/* 1. Returned Items section */}
                                    <div>
                                        <h4 style={{ fontSize: '13px', fontWeight: 800, color: '#475569', marginBottom: '8px' }}>1. Select Items to Return</h4>
                                        <div className="item-list-container">
                                            <div className="item-row-custom header">
                                                <span>Item</span>
                                                <span style={{ textAlign: 'center' }}>Sold Qty</span>
                                                <span style={{ textAlign: 'center' }}>Already Ret</span>
                                                <span style={{ textAlign: 'center' }}>Return Qty</span>
                                            </div>
                                            {saleToExchange.items.map(item => {
                                                const alreadyRet = getAlreadyReturnedQuantities(saleToExchange._id)[item.product] || 0;
                                                const multiplier = item.multiplier || 1;
                                                const maxReturnable = (item.soldQtyBaseUnit - alreadyRet) / multiplier;

                                                return (
                                                    <div key={item.product} className="item-row-custom">
                                                        <div>
                                                            <div style={{ fontWeight: 800, fontSize: '13px' }}>{item.productName}</div>
                                                            <div style={{ fontSize: '11px', color: '#64748B' }}>₹{item.pricePerBaseUnit || item.price} / {item.soldUnit || item.unit}</div>
                                                        </div>
                                                        <span style={{ textAlign: 'center' }}>{item.soldQtyEntered || item.quantity} {item.soldUnit || item.unit}</span>
                                                        <span style={{ textAlign: 'center', color: '#EF4444' }}>{alreadyRet / multiplier} {item.soldUnit || item.unit}</span>
                                                        <div className="qty-input-wrap" style={{ justifyContent: 'center' }}>
                                                            <input 
                                                                type="number" 
                                                                min="0" 
                                                                max={maxReturnable} 
                                                                step="any"
                                                                value={exchangeReturnQuantities[item.product] || 0} 
                                                                onChange={(e) => {
                                                                    const val = Number(e.target.value);
                                                                    setExchangeReturnQuantities(prev => ({
                                                                        ...prev,
                                                                        [item.product]: val
                                                                    }));
                                                                }}
                                                            />
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>

                                    {/* 2. Replacement Items section */}
                                    <div>
                                        <h4 style={{ fontSize: '13px', fontWeight: 800, color: '#475569', marginBottom: '8px' }}>2. Select Replacement Products</h4>
                                        <div className="search-replacement-wrap">
                                            <input 
                                                type="text" 
                                                className="reason-input-textarea" 
                                                style={{ height: '44px', padding: '0 12px' }}
                                                placeholder="Search replacement products by name or brand..."
                                                value={productSearch}
                                                onChange={(e) => setProductSearch(e.target.value)}
                                            />
                                            {searchResults.length > 0 && (
                                                <div className="search-replacement-results">
                                                    {searchResults.map(prod => (
                                                        <div 
                                                            key={prod._id} 
                                                            className="search-result-item"
                                                            onClick={() => {
                                                                const exists = replacementItems.find(item => item.product === prod._id);
                                                                if (exists) {
                                                                    showToast('Product already added as replacement.', 'warning');
                                                                } else {
                                                                    setReplacementItems(prev => [
                                                                        ...prev,
                                                                        {
                                                                            product: prod._id,
                                                                            productName: prod.name,
                                                                            quantity: 1,
                                                                            unit: prod.unit || 'Piece',
                                                                            price: prod.sellPrice,
                                                                            maxQty: prod.quantity
                                                                        }
                                                                    ]);
                                                                }
                                                                setProductSearch('');
                                                                setSearchResults([]);
                                                            }}
                                                        >
                                                            <span>{prod.name} {prod.brand ? `(${prod.brand})` : ''}</span>
                                                            <strong style={{ color: '#059669' }}>₹{prod.sellPrice} (Stock: {prod.quantity})</strong>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>

                                        {replacementItems.length > 0 && (
                                            <div className="item-list-container" style={{ marginTop: '12px' }}>
                                                <div className="item-row-custom header" style={{ gridTemplateColumns: '2fr 1.5fr 1fr 0.5fr' }}>
                                                    <span>Replacement Item</span>
                                                    <span style={{ textAlign: 'center' }}>Qty</span>
                                                    <span style={{ textAlign: 'right' }}>Total</span>
                                                    <span></span>
                                                </div>
                                                {replacementItems.map((item, idx) => (
                                                    <div key={item.product} className="item-row-custom" style={{ gridTemplateColumns: '2fr 1.5fr 1fr 0.5fr' }}>
                                                        <div>
                                                            <div style={{ fontWeight: 800, fontSize: '13px' }}>{item.productName}</div>
                                                            <div style={{ fontSize: '11px', color: '#64748B' }}>₹{item.price} / {item.unit}</div>
                                                        </div>
                                                        <div className="qty-input-wrap" style={{ justifyContent: 'center' }}>
                                                            <input 
                                                                type="number" 
                                                                min="0.001" 
                                                                step="any"
                                                                value={item.quantity} 
                                                                onChange={(e) => {
                                                                    const val = Number(e.target.value);
                                                                    setReplacementItems(prev => prev.map((it, i) => 
                                                                        i === idx ? { ...it, quantity: val } : it
                                                                    ));
                                                                }}
                                                            />
                                                            <span style={{ fontSize: '11px', fontWeight: 600 }}>{item.unit}</span>
                                                        </div>
                                                        <span style={{ textAlign: 'right', fontWeight: 800 }}>₹{(item.quantity * item.price).toFixed(2)}</span>
                                                        <button 
                                                            type="button" 
                                                            style={{ background: 'none', border: 'none', color: '#EF4444', cursor: 'pointer', fontWeight: 'bold', textAlign: 'right' }}
                                                            onClick={() => setReplacementItems(prev => prev.filter((_, i) => i !== idx))}
                                                        >
                                                            ✕
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    {/* 3. Summary and settling */}
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginTop: '8px' }}>
                                        <div>
                                            <label style={{ fontSize: '13px', fontWeight: 800, color: '#334155', display: 'block', marginBottom: '6px' }}>Difference Payment Method</label>
                                            <select 
                                                className="select-refund-method"
                                                value={exchangePaymentMethod}
                                                onChange={(e) => setExchangePaymentMethod(e.target.value)}
                                            >
                                                <option value="Cash">Cash</option>
                                                <option value="UPI">UPI / Online</option>
                                                {saleToExchange.paymentMethod === 'Khata' && <option value="Khata">Khata Dues Adjustment</option>}
                                            </select>
                                        </div>
                                        <div className="summary-box-custom">
                                            <div className="summary-row-custom">
                                                <span>Returned Credit:</span>
                                                <span style={{ color: '#EF4444', fontWeight: 700 }}>- ₹{Object.entries(exchangeReturnQuantities).reduce((acc, [productId, qty]) => {
                                                    const saleItem = saleToExchange.items.find(item => item.product === productId);
                                                    const rate = saleItem.pricePerBaseUnit || saleItem.price || 0;
                                                    const mult = saleItem.multiplier || 1;
                                                    return acc + (qty * mult * rate);
                                                }, 0).toFixed(2)}</span>
                                            </div>
                                            <div className="summary-row-custom">
                                                <span>Replacement Value:</span>
                                                <span style={{ color: '#059669', fontWeight: 700 }}>+ ₹{replacementItems.reduce((acc, it) => acc + (it.quantity * it.price), 0).toFixed(2)}</span>
                                            </div>
                                            <div className="summary-row-custom total">
                                                <span>Balance Difference</span>
                                                {(() => {
                                                    const retVal = Object.entries(exchangeReturnQuantities).reduce((acc, [productId, qty]) => {
                                                        const saleItem = saleToExchange.items.find(item => item.product === productId);
                                                        const rate = saleItem.pricePerBaseUnit || saleItem.price || 0;
                                                        const mult = saleItem.multiplier || 1;
                                                        return acc + (qty * mult * rate);
                                                    }, 0);
                                                    const repVal = replacementItems.reduce((acc, it) => acc + (it.quantity * it.price), 0);
                                                    const diff = repVal - retVal;
                                                    if (diff >= 0) {
                                                        return <strong style={{ color: '#059669' }}>Customer Pays: ₹{diff.toFixed(2)}</strong>;
                                                    } else {
                                                        return <strong style={{ color: '#EF4444' }}>Refund Customer: ₹{Math.abs(diff).toFixed(2)}</strong>;
                                                    }
                                                })()}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <div className="sl-modal-footer-custom">
                                    <button type="button" className="sl-btn-action view" onClick={() => setShowExchangeModal(false)} disabled={isExchangeSubmitting}>Cancel</button>
                                    <button type="submit" className="sl-btn-action exchange" style={{ color: 'white', background: '#EA580C' }} disabled={isExchangeSubmitting}>
                                        {isExchangeSubmitting ? 'Exchanging...' : 'Confirm Exchange'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}
            </AnimatePresence>

            <AnimatePresence>
                {selectedCustomer && (
                    <div className="sl-modal-overlay">
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="sl-backdrop" onClick={() => setSelectedCustomer(null)} />
                        <motion.div initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }} className="sl-sheet-history">
                            <div className="sl-m-header">
                                <div>
                                    <h3>Customer Purchase History</h3>
                                    <p>{selectedCustomer}</p>
                                </div>
                                <button className="sl-m-close" onClick={() => setSelectedCustomer(null)}><X size={20} /></button>
                            </div>
                            <div className="sl-m-content">
                                {sales
                                    .filter(s => s.customerName?.toLowerCase().trim() === selectedCustomer.toLowerCase().trim())
                                    .sort((a, b) => new Date(b.date) - new Date(a.date))
                                    .map(sale => (
                                        <div key={sale._id} className="sl-hist-card">
                                            <div className="sl-hist-head">
                                                <strong>Bill #{sale._id.slice(-6).toUpperCase()}</strong>
                                                <span>{new Date(sale.date).toLocaleDateString()} {new Date(sale.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                            </div>
                                            <div className="sl-hist-body">
                                                {(sale.items || []).map((item, idx) => (
                                                    <div key={idx} className="sl-hist-item">
                                                        <span>{item.productName} x {item.soldQtyEntered || item.quantity} {item.soldUnit || item.unit || 'Piece'}</span>
                                                        <strong>₹{((item.pricePerBaseUnit || item.price) * (item.soldQtyEntered || item.quantity)).toFixed(2)}</strong>
                                                    </div>
                                                ))}
                                            </div>
                                            <div className="sl-hist-foot">
                                                <span>Method: {sale.paymentMethod}</span>
                                                <strong>Total: ₹{sale.totalAmount.toLocaleString()}</strong>
                                            </div>
                                        </div>
                                    ))}
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            <style jsx="true">{`
                .sales-log-v3 { display: flex; flex-direction: column; gap: 20px; padding: 16px; }
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

                /* Return & Exchange Styles */
                .sl-btn-action {
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    padding: 6px 12px;
                    border-radius: 8px;
                    font-size: 11px;
                    font-weight: 800;
                    cursor: pointer;
                    border: 1px solid transparent;
                    transition: all 0.2s ease;
                }
                .sl-btn-action.view { background: #F2F4F7; color: #344054; border-color: #D0D5DD; }
                .sl-btn-action.return { background: #FEF2F2; color: #DC2626; border-color: #FEE2E2; }
                .sl-btn-action.exchange { background: #FFF7ED; color: #EA580C; border-color: #FFEDD5; }
                .sl-btn-action:hover { opacity: 0.85; transform: translateY(-1px); }

                .type-tag {
                    display: inline-block;
                    padding: 2px 6px;
                    border-radius: 6px;
                    font-size: 10px;
                    font-weight: 800;
                    text-transform: uppercase;
                }
                .type-tag.sale { background: #E1F8EB; color: #00B26B; }
                .type-tag.return { background: #FEE2E2; color: #FF4D4F; }
                .type-tag.exchange { background: #FFEDD5; color: #EA580C; }

                .type-tag-mobile {
                    display: inline-block;
                    padding: 2px 6px;
                    border-radius: 4px;
                    font-size: 9px;
                    font-weight: 800;
                    text-transform: uppercase;
                }
                .type-tag-mobile.sale { background: #E1F8EB; color: #00B26B; }
                .type-tag-mobile.return { background: #FEE2E2; color: #FF4D4F; }
                .type-tag-mobile.exchange { background: #FFEDD5; color: #EA580C; }

                .sl-modal-overlay-custom {
                    position: fixed;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    z-index: 2000;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    padding: 16px;
                }
                .sl-modal-backdrop-custom {
                    position: absolute;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    background: rgba(15, 23, 42, 0.4);
                    backdrop-filter: blur(8px);
                }
                .sl-modal-sheet-custom {
                    position: relative;
                    background: white;
                    width: 100%;
                    max-width: 680px;
                    max-height: 90vh;
                    border-radius: 24px;
                    box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
                    display: flex;
                    flex-direction: column;
                    overflow: hidden;
                    z-index: 2001;
                    border: 1px solid #E2E8F0;
                }
                .sl-modal-header-custom {
                    padding: 20px 24px;
                    border-bottom: 1px solid #F1F5F9;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                }
                .sl-modal-header-custom h3 {
                    font-size: 18px;
                    font-weight: 800;
                    color: #0F172A;
                    margin: 0;
                }
                .sl-modal-header-custom p {
                    font-size: 12px;
                    color: #64748B;
                    margin: 4px 0 0 0;
                    font-weight: 600;
                }
                .sl-modal-close-custom {
                    background: #F1F5F9;
                    border: none;
                    border-radius: 50%;
                    width: 32px;
                    height: 32px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    cursor: pointer;
                    color: #64748B;
                    transition: all 0.2s ease;
                }
                .sl-modal-close-custom:hover { background: #E2E8F0; color: #0F172A; }

                .sl-modal-content-custom {
                    padding: 24px;
                    overflow-y: auto;
                    flex: 1;
                    display: flex;
                    flex-direction: column;
                    gap: 20px;
                }
                .sl-modal-footer-custom {
                    padding: 16px 24px;
                    background: #F8FAFC;
                    border-top: 1px solid #E2E8F0;
                    display: flex;
                    justify-content: flex-end;
                    gap: 12px;
                }

                .item-list-container {
                    border: 1px solid #E2E8F0;
                    border-radius: 16px;
                    overflow: hidden;
                }
                .item-row-custom {
                    display: grid;
                    grid-template-columns: 2fr 1fr 1fr 1.2fr;
                    padding: 12px 16px;
                    border-bottom: 1px solid #E2E8F0;
                    align-items: center;
                }
                .item-row-custom.header {
                    background: #F8FAFC;
                    font-weight: 800;
                    font-size: 11px;
                    color: #64748B;
                    text-transform: uppercase;
                }
                .item-row-custom:last-child {
                    border-bottom: none;
                }
                .qty-input-wrap {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                }
                .qty-input-wrap input {
                    width: 65px;
                    padding: 6px;
                    border: 1.5px solid #CBD5E1;
                    border-radius: 8px;
                    text-align: center;
                    font-weight: 800;
                    outline: none;
                }
                .qty-input-wrap input:focus {
                    border-color: #1E6BFF;
                }
                .reason-input-textarea {
                    width: 100%;
                    padding: 12px;
                    border: 1.5px solid #CBD5E1;
                    border-radius: 12px;
                    font-family: inherit;
                    resize: none;
                    font-size: 14px;
                    outline: none;
                }
                .reason-input-textarea:focus {
                    border-color: #1E6BFF;
                }
                .select-refund-method {
                    padding: 10px 12px;
                    border: 1.5px solid #CBD5E1;
                    border-radius: 12px;
                    font-size: 14px;
                    background: white;
                    width: 100%;
                    outline: none;
                }
                .select-refund-method:focus {
                    border-color: #1E6BFF;
                }

                .summary-box-custom {
                    background: #F8FAFC;
                    padding: 16px;
                    border: 1.5px solid #E2E8F0;
                    border-radius: 16px;
                    display: flex;
                    flex-direction: column;
                    gap: 8px;
                }
                .summary-row-custom {
                    display: flex;
                    justify-content: space-between;
                    font-size: 13px;
                    color: #475569;
                    font-weight: 600;
                }
                .summary-row-custom.total {
                    font-size: 15px;
                    font-weight: 800;
                    color: #0F172A;
                    border-top: 1px dashed #E2E8F0;
                    padding-top: 8px;
                    margin-top: 4px;
                }

                .search-replacement-wrap {
                    position: relative;
                }
                .search-replacement-results {
                    position: absolute;
                    top: 100%;
                    left: 0;
                    right: 0;
                    background: white;
                    border: 1px solid #E2E8F0;
                    border-radius: 12px;
                    box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
                    z-index: 2002;
                    max-height: 200px;
                    overflow-y: auto;
                    margin-top: 4px;
                }
                .search-result-item {
                    padding: 10px 16px;
                    cursor: pointer;
                    transition: all 0.2s;
                    display: flex;
                    justify-content: space-between;
                    font-size: 13px;
                }
                .search-result-item:hover { background: #F1F5F9; }
            `}</style>
        </div>
    );
};

export default SalesLogPage;
