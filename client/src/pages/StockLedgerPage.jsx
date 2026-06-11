import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
    ArrowLeft, 
    Calendar, 
    TrendingUp, 
    RotateCcw, 
    RefreshCw, 
    SlidersHorizontal, 
    ChevronDown, 
    ChevronUp, 
    Info, 
    FileText, 
    Package, 
    Download, 
    Search, 
    ShoppingBag, 
    ArrowDownRight,
    ArrowUpRight,
    ShieldCheck,
    Clock,
    User
} from 'lucide-react';
import { productService, shopService, purchaseService, govSaleService } from '../services/api';
import { motion, AnimatePresence } from 'framer-motion';
import { EmptyState, Skeleton, PageHeader, CustomSelect, PremiumDatePicker } from '../components/PremiumUI';
import { useScrollLock } from '../hooks/useScrollLock';
import { useToast } from '../context/ToastContext';

const StockLedgerPage = () => {
    const { shopId, productId } = useParams();
    const navigate = useNavigate();
    const { showToast } = useToast();
    
    const [product, setProduct] = useState(null);
    const [shop, setShop] = useState(null);
    const [history, setHistory] = useState([]);
    const [purchases, setPurchases] = useState([]);
    const [govSales, setGovSales] = useState([]);
    const [loading, setLoading] = useState(true);
    
    // Filters
    const [periodFilter, setPeriodFilter] = useState('7d'); // today, 7d, month, custom
    const getLocalToday = () => {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    };
    const [startDate, setStartDate] = useState(getLocalToday());
    const [endDate, setEndDate] = useState(getLocalToday());
    const [typeFilter, setTypeFilter] = useState('All'); // All, Sales, Returns, Purchases, Exchanges, Adjustments
    
    // Pagination & Details Accordion
    const [page, setPage] = useState(1);
    const itemsPerPage = 10; // group days per page
    const [expandedDays, setExpandedDays] = useState({}); // dateKey -> bool

    useEffect(() => {
        fetchData();
    }, [shopId, productId]);

    const fetchData = async () => {
        try {
            setLoading(true);
            const [productsRes, historyRes, shopsRes, purchasesRes, govSalesRes] = await Promise.all([
                productService.getAll(shopId),
                productService.getInventoryHistory(productId),
                shopService.getAll(),
                purchaseService.getAll(shopId).catch(() => ({ data: { data: [] } })),
                govSaleService.getAll(shopId).catch(() => ({ data: { data: [] } }))
            ]);

            const allProducts = productsRes.data?.data || [];
            const currentProduct = allProducts.find(p => p._id === productId);
            setProduct(currentProduct);

            setHistory(historyRes.data?.data || []);
            setPurchases(purchasesRes.data?.data || []);
            setGovSales(govSalesRes.data?.data || []);

            if (shopsRes.data?.data) {
                setShop(shopsRes.data.data.find(s => s._id === shopId));
            }
        } catch (err) {
            console.error('Error loading stock ledger details:', err);
        } finally {
            setLoading(false);
        }
    };

    // Calculate Summary Stats
    const stats = useMemo(() => {
        if (!product || history.length === 0) {
            return {
                currentStock: product?.quantity || 0,
                todaySold: 0,
                todayReturned: 0,
                totalPurchased: 0,
                totalExchanges: 0,
                lastPurchaseDate: 'N/A'
            };
        }

        const todayStr = new Date().toLocaleDateString('en-IN');
        
        let todaySold = 0;
        let todayReturned = 0;
        let totalPurchased = 0;
        
        // Track unique exchange transactions by checking referenceId
        const exchangeInvoiceSet = new Set();
        let lastPurchaseTime = null;

        history.forEach(log => {
            const logDate = new Date(log.createdAt);
            const logDateStr = logDate.toLocaleDateString('en-IN');
            const qty = Number(log.quantity || 0);
            const isExchange = log.referenceId && log.referenceId.startsWith('EXC-');

            if (isExchange) {
                exchangeInvoiceSet.add(log.referenceId);
            }

            // Today stats
            if (logDateStr === todayStr && !isExchange) {
                if (log.actionType === 'STOCK_SOLD' || log.actionType === 'GOV_SALE') {
                    todaySold += qty;
                } else if (log.actionType === 'STOCK_RETURNED') {
                    todayReturned += qty;
                }
            }

            // Cumulative stats
            if (log.actionType === 'STOCK_ADDED' || log.actionType === 'PURCHASE_ENTRY') {
                totalPurchased += qty;
                if (!lastPurchaseTime || logDate > lastPurchaseTime) {
                    lastPurchaseTime = logDate;
                }
            }
        });

        return {
            currentStock: product.quantity,
            todaySold,
            todayReturned,
            totalPurchased,
            totalExchanges: exchangeInvoiceSet.size,
            lastPurchaseDate: lastPurchaseTime 
                ? lastPurchaseTime.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
                : 'N/A'
        };
    }, [product, history]);

    // Apply Period & Type Filters
    const filteredHistory = useMemo(() => {
        return history.filter(log => {
            const logDate = new Date(log.createdAt);
            const now = new Date();
            let matchesPeriod = false;

            // 1. Period Filter
            if (periodFilter === 'today') {
                matchesPeriod = logDate.getFullYear() === now.getFullYear() &&
                                logDate.getMonth() === now.getMonth() &&
                                logDate.getDate() === now.getDate();
            } else if (periodFilter === '7d') {
                const sevenDaysAgo = new Date();
                sevenDaysAgo.setDate(now.getDate() - 7);
                matchesPeriod = logDate >= sevenDaysAgo;
            } else if (periodFilter === 'month') {
                const thirtyDaysAgo = new Date();
                thirtyDaysAgo.setDate(now.getDate() - 30);
                matchesPeriod = logDate >= thirtyDaysAgo;
            } else if (periodFilter === 'custom') {
                const start = new Date(startDate);
                start.setHours(0,0,0,0);
                const end = new Date(endDate);
                end.setHours(23,59,59,999);
                matchesPeriod = logDate >= start && logDate <= end;
            }

            if (!matchesPeriod) return false;

            // 2. Type Filter
            const isExchange = log.referenceId && log.referenceId.startsWith('EXC-');
            if (typeFilter === 'All') return true;
            if (typeFilter === 'Sales') return (log.actionType === 'STOCK_SOLD' || log.actionType === 'GOV_SALE') && !isExchange;
            if (typeFilter === 'Returns') return log.actionType === 'STOCK_RETURNED' && !isExchange;
            if (typeFilter === 'Purchases') return log.actionType === 'STOCK_ADDED' || log.actionType === 'PURCHASE_ENTRY';
            if (typeFilter === 'Exchanges') return isExchange;
            if (typeFilter === 'Adjustments') return ['STOCK_UPDATED', 'STOCK_ADJUSTED', 'DAMAGED_STOCK'].includes(log.actionType);

            return true;
        });
    }, [history, periodFilter, startDate, endDate, typeFilter]);

    // Group filtered history items by day
    const groupedDays = useMemo(() => {
        const groups = {};

        // Sort ascending chronologically to process final balances correctly
        const sortedLogs = [...filteredHistory].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

        sortedLogs.forEach(log => {
            const d = new Date(log.createdAt);
            const dateKey = d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

            if (!groups[dateKey]) {
                groups[dateKey] = {
                    date: dateKey,
                    rawDate: d,
                    purchased: 0,
                    sold: 0,
                    returned: 0,
                    exchangedIn: 0,
                    exchangedOut: 0,
                    adjusted: 0,
                    openingStock: log.previousStock,
                    closingStock: log.newStock,
                    finalStock: log.newStock,
                    unit: log.unit || 'Piece',
                    hasMovements: false,
                    logs: []
                };
            }

            const qty = Number(log.quantity || 0);
            const isExchange = log.referenceId && log.referenceId.startsWith('EXC-');

            if (isExchange) {
                if (log.actionType === 'STOCK_RETURNED') {
                    groups[dateKey].exchangedIn += qty;
                } else if (log.actionType === 'STOCK_SOLD') {
                    groups[dateKey].exchangedOut += qty;
                }
                groups[dateKey].hasMovements = true;
            } else if (log.actionType === 'STOCK_ADDED' || log.actionType === 'PURCHASE_ENTRY') {
                groups[dateKey].purchased += qty;
                groups[dateKey].hasMovements = true;
            } else if (log.actionType === 'STOCK_SOLD' || log.actionType === 'GOV_SALE') {
                groups[dateKey].sold += qty;
                groups[dateKey].hasMovements = true;
            } else if (log.actionType === 'STOCK_RETURNED') {
                groups[dateKey].returned += qty;
                groups[dateKey].hasMovements = true;
            } else if (['STOCK_UPDATED', 'STOCK_ADJUSTED', 'DAMAGED_STOCK'].includes(log.actionType)) {
                const diff = log.newStock - log.previousStock;
                groups[dateKey].adjusted += diff;
                groups[dateKey].hasMovements = true;
            }

            groups[dateKey].closingStock = log.newStock;
            groups[dateKey].finalStock = log.newStock;
            groups[dateKey].logs.push(log);
        });

        // Sort descending to show latest days first
        return Object.values(groups).sort((a, b) => b.rawDate - a.rawDate);
    }, [filteredHistory]);

    const paginatedGroupedDays = useMemo(() => {
        return groupedDays.slice(0, page * itemsPerPage);
    }, [groupedDays, page]);

    const toggleExpandDay = (dateKey) => {
        setExpandedDays(prev => ({
            ...prev,
            [dateKey]: !prev[dateKey]
        }));
    };

    // Clickable invoice number redirect logic
    const handleInvoiceClick = (log) => {
        if (!log.referenceId) return;

        // Normal Sales (POS Sales, Exchanges, Returns)
        if (log.actionType === 'STOCK_SOLD' || log.referenceId.startsWith('SAL-') || log.referenceId.startsWith('EXC-') || log.referenceId.startsWith('RET-')) {
            navigate(`/shop/${shopId}/sales-log?search=${log.referenceId}`);
            return;
        }

        // Government Sales
        if (log.actionType === 'GOV_SALE' || log.referenceId.startsWith('GOV-')) {
            navigate(`/shop/${shopId}/gov-sales-log?search=${log.referenceId}`);
            return;
        }

        // Purchases
        if (log.actionType === 'PURCHASE_ENTRY' || log.actionType === 'STOCK_ADDED') {
            const foundPurchase = purchases.find(p => p.billNo === log.referenceId);
            if (foundPurchase) {
                navigate(`/shop/${shopId}/purchase-ledger/${foundPurchase._id}`);
            } else {
                navigate(`/shop/${shopId}/purchase-ledger?search=${log.referenceId}`);
            }
            return;
        }
    };

    // Color & description helper for detail table action badges with enterprise source types & unicode icons
    const getActionBadgeStyle = (log) => {
        const isExchange = log.referenceId && log.referenceId.startsWith('EXC-');
        
        if (isExchange) {
            return {
                label: log.actionType === 'STOCK_RETURNED' ? 'Exchange (In)' : 'Exchange (Out)',
                bg: '#EFF6FF',
                color: '#2563EB',
                sign: log.actionType === 'STOCK_RETURNED' ? '+' : '-',
                icon: '🔄'
            };
        }

        switch (log.actionType) {
            case 'STOCK_ADDED':
            case 'PURCHASE_ENTRY':
                return { label: 'Purchase Ledger', bg: '#ECFDF5', color: '#10B981', sign: '+', icon: '⬇' };
            case 'STOCK_SOLD':
                return { label: 'POS Sale', bg: '#FEF2F2', color: '#EF4444', sign: '-', icon: '⬆' };
            case 'GOV_SALE':
                return { label: 'Government Sale', bg: '#FFF1F2', color: '#F43F5E', sign: '-', icon: '⬆' };
            case 'STOCK_RETURNED':
                return { label: 'Return', bg: '#FFFBEB', color: '#F59E0B', sign: '+', icon: '↩' };
            case 'STOCK_UPDATED':
            case 'STOCK_ADJUSTED':
            case 'DAMAGED_STOCK':
            default:
                const diff = log.newStock - log.previousStock;
                return { 
                    label: log.actionType === 'DAMAGED_STOCK' ? 'Damaged Stock' : 'Manual Adjustment', 
                    bg: '#F5F3FF', 
                    color: '#7C3AED', 
                    sign: diff >= 0 ? '+' : '-',
                    icon: '⚙'
                };
        }
    };

    if (loading) {
        return (
            <div className="ledger-loading" style={{ display: 'flex', flexDirection: 'column', padding: '40px', gap: '20px' }}>
                <Skeleton height="40px" width="30%" />
                <Skeleton height="120px" borderRadius="16px" />
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '16px' }}>
                    {[1, 2, 3, 4, 5, 6].map(i => <Skeleton key={i} height="100px" borderRadius="14px" />)}
                </div>
                <Skeleton height="300px" borderRadius="16px" />
            </div>
        );
    }

    if (!product) {
        return (
            <div className="ledger-empty" style={{ padding: '60px 20px', textAlign: 'center' }}>
                <EmptyState 
                    icon={Package} 
                    title="Product Not Found" 
                    description="The product you are trying to view does not exist." 
                    actionLabel="Back to Inventory"
                    onAction={() => navigate(`/shop/${shopId}/inventory`)}
                />
            </div>
        );
    }

    const lastUpdatedText = history.length > 0 
        ? new Date(history[0].createdAt).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
        : 'N/A';

    return (
        <div className="stock-ledger-page">
            <PageHeader 
                title="Stock Ledger"
                subtitle="Double-entry register matching inventory to sales"
                actions={
                    <button className="btn-ledger-back" onClick={() => navigate(`/shop/${shopId}/inventory`)}>
                        <ArrowLeft size={16} />
                        <span>Inventory</span>
                    </button>
                }
            />

            {/* Product Quick Details Header Panel */}
            <div className="ledger-header-panel">
                <div className="lhp-left">
                    <div className="lhp-title-row">
                        <h2>{product.name}</h2>
                        {product.brand && <span className="brand-badge">{product.brand}</span>}
                    </div>
                    <div className="lhp-meta-row">
                        <span className="category-pill">{product.category || 'General'}</span>
                        <span className="unit-indicator">• {product.unit || 'Piece'} Units</span>
                        <span className="update-time"><Clock size={12} /> Last Transaction: {lastUpdatedText}</span>
                    </div>
                </div>
                <div className="lhp-right">
                    <div className="stock-showcase">
                        <span className="showcase-lbl">Available Stock</span>
                        <div className="showcase-val-row">
                            <strong className={product.quantity === 0 ? 'out' : product.quantity <= (product.lowStockLimit || 5) ? 'low' : 'healthy'}>
                                {product.quantity.toLocaleString()}
                            </strong>
                            <span className="showcase-unit">{product.unit || 'Bags'}</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Summary Statistics Cards */}
            <div className="ledger-stats-grid">
                <div className="stat-card">
                    <div className="sc-icon"><Package size={20} color="#64748B" /></div>
                    <div className="sc-data">
                        <span>Current Stock</span>
                        <strong>{stats.currentStock.toLocaleString()} {product.unit}</strong>
                    </div>
                </div>
                <div className="stat-card">
                    <div className="sc-icon red"><TrendingUp size={20} color="#EF4444" /></div>
                    <div className="sc-data">
                        <span>Today Sold</span>
                        <strong className="text-danger">{stats.todaySold.toLocaleString()} {product.unit}</strong>
                    </div>
                </div>
                <div className="stat-card">
                    <div className="sc-icon orange"><RotateCcw size={20} color="#F59E0B" /></div>
                    <div className="sc-data">
                        <span>Today Returned</span>
                        <strong className="text-warning">+{stats.todayReturned.toLocaleString()} {product.unit}</strong>
                    </div>
                </div>
                <div className="stat-card">
                    <div className="sc-icon green"><ShoppingBag size={20} color="#10B981" /></div>
                    <div className="sc-data">
                        <span>Total Purchased</span>
                        <strong className="text-success">{stats.totalPurchased.toLocaleString()} {product.unit}</strong>
                    </div>
                </div>
                <div className="stat-card">
                    <div className="sc-icon blue"><RefreshCw size={20} color="#2563EB" /></div>
                    <div className="sc-data">
                        <span>Total Exchanges</span>
                        <strong className="text-info">{stats.totalExchanges} Trades</strong>
                    </div>
                </div>
                <div className="stat-card">
                    <div className="sc-icon"><Calendar size={20} color="#64748B" /></div>
                    <div className="sc-data">
                        <span>Last Purchase</span>
                        <strong style={{ fontSize: '15px' }}>{stats.lastPurchaseDate}</strong>
                    </div>
                </div>
            </div>

            {/* Filters Bar */}
            <div className="ledger-filters-container">
                <div className="lfc-title">
                    <SlidersHorizontal size={16} />
                    <span>Filter Movements</span>
                </div>
                <div className="lfc-row">
                    <div className="filter-input-wrap">
                        <label>Period</label>
                        <CustomSelect 
                            value={periodFilter}
                            options={['today', '7d', 'month', 'custom']}
                            onChange={(val) => { setPeriodFilter(val); setPage(1); }}
                        />
                    </div>
                    {periodFilter === 'custom' && (
                        <>
                            <div className="filter-input-wrap">
                                <PremiumDatePicker 
                                    label="Start Date"
                                    value={startDate}
                                    onChange={(val) => { setStartDate(val); setPage(1); }}
                                />
                            </div>
                            <div className="filter-input-wrap">
                                <PremiumDatePicker 
                                    label="End Date"
                                    value={endDate}
                                    onChange={(val) => { setEndDate(val); setPage(1); }}
                                />
                            </div>
                        </>
                    )}
                    <div className="filter-input-wrap">
                        <label>Movement Type</label>
                        <CustomSelect 
                            value={typeFilter}
                            options={['All', 'Sales', 'Returns', 'Purchases', 'Exchanges', 'Adjustments']}
                            onChange={(val) => { setTypeFilter(val); setPage(1); }}
                        />
                    </div>
                </div>
            </div>

            {/* Ledger Register Timeline */}
            <div className="ledger-timeline-container">
                <h3 className="timeline-title">Audit Register</h3>
                
                {paginatedGroupedDays.length === 0 ? (
                    <div style={{ background: 'white', borderRadius: '20px', border: '1px solid #E2E8F0', padding: '40px' }}>
                        <EmptyState 
                            icon={FileText} 
                            title="No Movements Matching Filters" 
                            description="Adjust your selection period or search settings to check older ledger indexes." 
                        />
                    </div>
                ) : (
                    <div className="timeline-days-list">
                        {paginatedGroupedDays.map((dayGroup) => {
                            const isExpanded = !!expandedDays[dayGroup.date];
                            
                            // Filter gov sales matching the date and product
                            const isFertilizerShop = shop?.type === 'Fertilizers';
                            const dayGovSales = isFertilizerShop ? govSales.filter(sale => {
                                const saleDate = new Date(sale.date);
                                const sameDay = saleDate.getFullYear() === dayGroup.rawDate.getFullYear() &&
                                                saleDate.getMonth() === dayGroup.rawDate.getMonth() &&
                                                saleDate.getDate() === dayGroup.rawDate.getDate();
                                if (!sameDay) return false;
                                
                                return (sale.items || []).some(item => 
                                    item.product === productId || 
                                    (item.product && (item.product === productId || item.product._id === productId)) ||
                                    item.productName?.toLowerCase() === product?.name?.toLowerCase()
                                );
                            }) : [];

                            // Calculate Gov Amount as sum of item totalPrice
                            const dayGovAmount = dayGovSales.reduce((sum, sale) => {
                                const prodItems = (sale.items || []).filter(item => 
                                    item.product === productId || 
                                    (item.product && (item.product === productId || item.product._id === productId)) ||
                                    item.productName?.toLowerCase() === product?.name?.toLowerCase()
                                );
                                const itemsSum = prodItems.reduce((iSum, item) => {
                                    return iSum + (item.totalPrice || ((item.soldQtyEntered || item.quantity || 0) * (item.pricePerBaseUnit || item.governmentPrice || item.price || 0)));
                                }, 0);
                                return sum + itemsSum;
                            }, 0);

                            return (
                                <div key={dayGroup.date} className="timeline-day-card">
                                    {/* Card Header (Grouped Summary in clean business language) */}
                                    <div className="tdc-header" onClick={() => toggleExpandDay(dayGroup.date)}>
                                        <div className="tdch-left">
                                            <span className="tdc-date">{dayGroup.date}</span>
                                            <div className="tdc-bullets-summary">
                                                {dayGroup.sold > 0 && (
                                                    <span className="bullet-summary-item text-danger">Sold: <strong>{dayGroup.sold}</strong> {dayGroup.unit}</span>
                                                )}
                                                {dayGroup.returned > 0 && (
                                                    <span className="bullet-summary-item text-warning">Returned: <strong>{dayGroup.returned}</strong> {dayGroup.unit}</span>
                                                )}
                                                {dayGroup.purchased > 0 && (
                                                    <span className="bullet-summary-item text-success">Purchased: <strong>{dayGroup.purchased}</strong> {dayGroup.unit}</span>
                                                )}
                                                {(dayGroup.exchangedIn > 0 || dayGroup.exchangedOut > 0) && (
                                                    <span className="bullet-summary-item text-info">Exchanged: <strong>{dayGroup.exchangedIn - dayGroup.exchangedOut > 0 ? `+${dayGroup.exchangedIn - dayGroup.exchangedOut}` : dayGroup.exchangedIn - dayGroup.exchangedOut}</strong> {dayGroup.unit}</span>
                                                )}
                                                {dayGroup.adjusted !== 0 && (
                                                    <span className="bullet-summary-item text-purple">Adjusted: <strong>{dayGroup.adjusted > 0 ? '+' : ''}{dayGroup.adjusted}</strong> {dayGroup.unit}</span>
                                                )}
                                            </div>
                                            {dayGovSales.length > 0 && (
                                                <button 
                                                    className="btn-view-gov-logs"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        const yyyy = dayGroup.rawDate.getFullYear();
                                                        const mm = String(dayGroup.rawDate.getMonth() + 1).padStart(2, '0');
                                                        const dd = String(dayGroup.rawDate.getDate()).padStart(2, '0');
                                                        const dateStr = `${yyyy}-${mm}-${dd}`;
                                                        navigate(`/shop/${shopId}/gov-sales-log?product=${encodeURIComponent(product.name)}&date=${dateStr}`);
                                                    }}
                                                >
                                                    📄 View Logs
                                                </button>
                                            )}
                                        </div>
                                        <div className="tdch-right">
                                            <span className="tdc-final-stock-badge">
                                                <span className="lbl">CLOSING STOCK</span>
                                                <strong>{dayGroup.finalStock}</strong>
                                                <span className="unit">{dayGroup.unit}</span>
                                            </span>
                                            <button className="tdc-expand-btn">
                                                {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                                            </button>
                                        </div>
                                    </div>

                                    {/* Expanded Details List */}
                                    <AnimatePresence initial={false}>
                                        {isExpanded && (
                                            <motion.div 
                                                initial={{ height: 0, opacity: 0 }}
                                                animate={{ height: "auto", opacity: 1 }}
                                                exit={{ height: 0, opacity: 0 }}
                                                transition={{ duration: 0.2, ease: "easeInOut" }}
                                                style={{ overflow: "hidden" }}
                                                className="tdc-expanded-panel"
                                            >
                                                <div className="panel-inner-scroll">
                                                    {/* Day Accounting Summary widget showing Opening Stock, Sold, Returned, Purchased, Closing Stock */}
                                                    <div className="day-accounting-summary-block">
                                                        <div className="das-box">
                                                            <span className="das-label">Opening Stock</span>
                                                            <strong className="das-value">{dayGroup.openingStock} <span className="unit-text">{dayGroup.unit}</span></strong>
                                                        </div>
                                                        <div className="das-box text-danger">
                                                            <span className="das-label">Sold</span>
                                                            <strong className="das-value">-{dayGroup.sold}</strong>
                                                        </div>
                                                        <div className="das-box text-warning">
                                                            <span className="das-label">Returned</span>
                                                            <strong className="das-value">+{dayGroup.returned}</strong>
                                                        </div>
                                                        <div className="das-box text-success">
                                                            <span className="das-label">Purchased</span>
                                                            <strong className="das-value">+{dayGroup.purchased}</strong>
                                                        </div>
                                                        {dayGroup.adjusted !== 0 && (
                                                            <div className="das-box text-purple">
                                                                <span className="das-label">Adjustments</span>
                                                                <strong className="das-value">{dayGroup.adjusted > 0 ? '+' : ''}{dayGroup.adjusted}</strong>
                                                            </div>
                                                        )}
                                                        <div className="das-box closing">
                                                            <span className="das-label">Closing Stock</span>
                                                            <strong className="das-value">{dayGroup.closingStock} <span className="unit-text">{dayGroup.unit}</span></strong>
                                                        </div>
                                                    </div>

                                                    {/* Desktop Table view */}
                                                    <table className="expanded-desktop-table">
                                                        <thead>
                                                            <tr>
                                                                <th>Time</th>
                                                                <th>Type</th>
                                                                <th style={{ textAlign: 'right' }}>Quantity</th>
                                                                <th>Audit Path</th>
                                                                <th>Bill / Invoice</th>
                                                                <th>Source / Contact</th>
                                                                <th>Notes / Remarks</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody>
                                                            {dayGroup.logs.map((log) => {
                                                                const badge = getActionBadgeStyle(log);
                                                                const timeStr = new Date(log.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                                                                
                                                                return (
                                                                    <tr key={log._id}>
                                                                        <td>
                                                                            <div style={{ display: 'flex', alignItems: 'center' }}>
                                                                                <span className="log-timeline-node" style={{ borderColor: badge.color }} />
                                                                                <span className="log-time">{timeStr}</span>
                                                                            </div>
                                                                        </td>
                                                                        <td>
                                                                            <span className="log-badge" style={{ backgroundColor: badge.bg, color: badge.color }}>
                                                                                {badge.icon} {badge.label}
                                                                            </span>
                                                                        </td>
                                                                        <td style={{ textAlign: 'right', fontWeight: '800', color: badge.color }}>
                                                                            {badge.sign}{log.quantity} {log.unit}
                                                                        </td>
                                                                        <td>
                                                                            <div className="log-audit-path-cell">
                                                                                <div><span className="lbl">Opening Stock:</span> <strong>{log.previousStock}</strong></div>
                                                                                <div><span className="lbl">Closing Stock:</span> <strong>{log.newStock}</strong></div>
                                                                            </div>
                                                                        </td>
                                                                        <td>
                                                                            {log.referenceId ? (
                                                                                <span 
                                                                                    className="log-ref-link"
                                                                                    onClick={() => handleInvoiceClick(log)}
                                                                                >
                                                                                    #{log.referenceId}
                                                                                </span>
                                                                            ) : '-'}
                                                                        </td>
                                                                        <td><span className="log-source">{log.source || 'Walk-in'}</span></td>
                                                                        <td><span className="log-notes">{log.notes || '-'}</span></td>
                                                                    </tr>
                                                                );
                                                            })}
                                                        </tbody>
                                                    </table>

                                                    {/* Mobile Stack view */}
                                                    <div className="expanded-mobile-stack">
                                                        {dayGroup.logs.map((log) => {
                                                            const badge = getActionBadgeStyle(log);
                                                            const timeStr = new Date(log.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                                                            
                                                            return (
                                                                <div key={log._id} className="mobile-log-card">
                                                                    <div className="mlc-header">
                                                                        <span className="mlch-badge" style={{ backgroundColor: badge.bg, color: badge.color }}>
                                                                            {badge.icon} {badge.label}
                                                                        </span>
                                                                        <strong style={{ color: badge.color }}>
                                                                            {badge.sign}{log.quantity} {log.unit}
                                                                        </strong>
                                                                    </div>
                                                                    <div className="mlc-body">
                                                                        <div className="mlcb-row">
                                                                            <span>Opening Stock:</span>
                                                                            <strong>{log.previousStock}</strong>
                                                                        </div>
                                                                        <div className="mlcb-row">
                                                                            <span>Closing Stock:</span>
                                                                            <strong>{log.newStock}</strong>
                                                                        </div>
                                                                        {log.referenceId && (
                                                                            <div className="mlcb-row">
                                                                                <span>Invoice:</span>
                                                                                <strong className="log-ref-link-mobile" onClick={() => handleInvoiceClick(log)}>
                                                                                    #{log.referenceId}
                                                                                </strong>
                                                                            </div>
                                                                        )}
                                                                        <div className="mlcb-row">
                                                                            <span>Contact:</span>
                                                                            <span>{log.source || 'Walk-in Customer'}</span>
                                                                        </div>
                                                                        {log.notes && (
                                                                            <div className="mlcb-notes">
                                                                                <strong>Notes:</strong> {log.notes}
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                    <div className="mlc-footer">
                                                                        <span><Clock size={12} /> {timeStr}</span>
                                                                    </div>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </div>
                            );
                        })}
                    </div>
                )}

                {/* Load More Button */}
                {groupedDays.length > paginatedGroupedDays.length && (
                    <div style={{ display: 'flex', justifyContent: 'center', marginTop: '24px' }}>
                        <button className="btn-ledger-load-more" onClick={() => setPage(page + 1)}>
                            Load More Ledger Days
                        </button>
                    </div>
                )}
            </div>

            <style jsx="true">{`
                .stock-ledger-page {
                    padding: 16px;
                    display: flex;
                    flex-direction: column;
                    gap: 20px;
                    background: #F8FAFC;
                    min-height: 100vh;
                    font-family: inherit;
                }

                .btn-ledger-back {
                    display: flex;
                    align-items: center;
                    gap: 6px;
                    height: 40px;
                    padding: 0 16px;
                    background: white;
                    border: 1.5px solid #E2E8F0;
                    color: #475569;
                    font-weight: 700;
                    font-size: 14px;
                    border-radius: 10px;
                    cursor: pointer;
                    transition: 0.15s;
                }
                .btn-ledger-back:hover {
                    background: #F1F5F9;
                    color: #0F172A;
                }

                .ledger-header-panel {
                    background: white;
                    border: 1px solid #E2E8F0;
                    border-radius: 20px;
                    padding: 20px;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    flex-wrap: wrap;
                    gap: 20px;
                    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.02);
                }

                .lhp-left {
                    display: flex;
                    flex-direction: column;
                    gap: 8px;
                }

                .lhp-title-row {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                }
                .lhp-title-row h2 {
                    margin: 0;
                    font-size: 26px;
                    font-weight: 900;
                    color: #0F172A;
                    letter-spacing: -0.02em;
                }
                .brand-badge {
                    font-size: 11px;
                    font-weight: 800;
                    color: #2563EB;
                    background: #EFF6FF;
                    padding: 2px 8px;
                    border-radius: 6px;
                    text-transform: uppercase;
                }

                .lhp-meta-row {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    flex-wrap: wrap;
                    font-size: 13px;
                    font-weight: 600;
                    color: #64748B;
                }
                .category-pill {
                    background: #F1F5F9;
                    color: #475569;
                    padding: 2px 8px;
                    border-radius: 6px;
                    font-weight: 700;
                }
                .update-time {
                    display: flex;
                    align-items: center;
                    gap: 4px;
                    color: #94A3B8;
                }

                .stock-showcase {
                    background: #F8FAFC;
                    border: 1.5px solid #F1F5F9;
                    padding: 12px 24px;
                    border-radius: 16px;
                    text-align: right;
                    min-width: 160px;
                }
                .showcase-lbl {
                    font-size: 10px;
                    font-weight: 800;
                    color: #94A3B8;
                    text-transform: uppercase;
                    letter-spacing: 0.05em;
                }
                .showcase-val-row {
                    display: flex;
                    align-items: baseline;
                    justify-content: flex-end;
                    gap: 6px;
                    margin-top: 4px;
                }
                .showcase-val-row strong {
                    font-size: 28px;
                    font-weight: 900;
                    line-height: 1;
                }
                .showcase-val-row strong.healthy { color: #10B981; }
                .showcase-val-row strong.low { color: #F59E0B; }
                .showcase-val-row strong.out { color: #EF4444; }
                .showcase-unit {
                    font-size: 13px;
                    font-weight: 700;
                    color: #475569;
                }

                .ledger-stats-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
                    gap: 16px;
                }

                .stat-card {
                    background: white;
                    border: 1px solid #E2E8F0;
                    border-radius: 16px;
                    padding: 16px;
                    display: flex;
                    align-items: center;
                    gap: 14px;
                    box-shadow: 0 2px 4px rgba(0,0,0,0.01);
                }
                .sc-icon {
                    width: 44px;
                    height: 44px;
                    background: #F8FAFC;
                    border-radius: 12px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    flex-shrink: 0;
                }
                .sc-icon.red { background: #FEF2F2; }
                .sc-icon.orange { background: #FFFBEB; }
                .sc-icon.green { background: #ECFDF5; }
                .sc-icon.blue { background: #EFF6FF; }

                .sc-data {
                    display: flex;
                    flex-direction: column;
                    gap: 2px;
                }
                .sc-data span {
                    font-size: 11px;
                    font-weight: 700;
                    color: #94A3B8;
                    text-transform: uppercase;
                    letter-spacing: 0.02em;
                }
                .sc-data strong {
                    font-size: 16px;
                    font-weight: 800;
                    color: #1E293B;
                }
                .sc-data strong.text-danger { color: #EF4444; }
                .sc-data strong.text-warning { color: #D97706; }
                .sc-data strong.text-success { color: #10B981; }
                .sc-data strong.text-info { color: #2563EB; }

                .ledger-filters-container {
                    background: white;
                    border: 1px solid #E2E8F0;
                    border-radius: 20px;
                    padding: 16px 20px;
                    display: flex;
                    flex-direction: column;
                    gap: 12px;
                }
                .lfc-title {
                    display: flex;
                    align-items: center;
                    gap: 6px;
                    font-size: 13px;
                    font-weight: 800;
                    color: #475569;
                    text-transform: uppercase;
                }
                .lfc-row {
                    display: flex;
                    gap: 12px;
                    flex-wrap: wrap;
                }
                .filter-input-wrap {
                    flex: 1;
                    min-width: 180px;
                    display: flex;
                    flex-direction: column;
                    gap: 4px;
                }
                .filter-input-wrap label {
                    font-size: 11px;
                    font-weight: 700;
                    color: #94A3B8;
                    text-transform: uppercase;
                }

                .ledger-timeline-container {
                    display: flex;
                    flex-direction: column;
                    gap: 14px;
                }
                .timeline-title {
                    margin: 8px 0 0 0;
                    font-size: 18px;
                    font-weight: 950;
                    color: #0F172A;
                    text-transform: uppercase;
                    letter-spacing: 0.05em;
                }

                .timeline-days-list {
                    display: flex;
                    flex-direction: column;
                    gap: 10px;
                }

                .timeline-day-card {
                    background: white;
                    border: 1px solid #E2E8F0;
                    border-radius: 16px;
                    overflow: hidden;
                    box-shadow: 0 2px 4px rgba(0,0,0,0.01);
                }

                .tdc-header {
                    padding: 16px 20px;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    cursor: pointer;
                    transition: background 0.15s;
                    user-select: none;
                }
                .tdc-header:hover {
                    background: #F8FAFC;
                }

                .tdch-left {
                    display: flex;
                    align-items: center;
                    gap: 16px;
                    flex-wrap: wrap;
                    flex: 1;
                }

                .tdc-date {
                    font-size: 15px;
                    font-weight: 900;
                    color: #0F172A;
                    white-space: nowrap;
                }

                .tdc-bullets-summary {
                    display: flex;
                    gap: 8px;
                    flex-wrap: wrap;
                    margin-top: 4px;
                }
                .bullet-summary-item {
                    font-size: 11.5px;
                    font-weight: 700;
                    padding: 2px 8px;
                    border-radius: 6px;
                    background: #F1F5F9;
                    color: #475569;
                    display: inline-flex;
                    align-items: center;
                    gap: 4px;
                }
                .bullet-summary-item strong {
                    font-weight: 900;
                }
                .bullet-summary-item.text-danger { background: #FEF2F2; color: #DC2626; }
                .bullet-summary-item.text-warning { background: #FFFBEB; color: #D97706; }
                .bullet-summary-item.text-success { background: #ECFDF5; color: #10B981; }
                .bullet-summary-item.text-info { background: #EFF6FF; color: #2563EB; }
                .bullet-summary-item.text-purple { background: #F5F3FF; color: #7C3AED; }
                .bullet-summary-item.net-change {
                    background: white;
                    border: 1px dashed #CBD5E1;
                    font-weight: 800;
                }
                .btn-view-gov-logs {
                    display: inline-flex;
                    align-items: center;
                    gap: 6px;
                    font-size: 11px;
                    font-weight: 700;
                    padding: 4px 10px;
                    border-radius: 6px;
                    background: transparent;
                    color: #166534;
                    border: 1px solid #86EFAC;
                    cursor: pointer;
                    transition: all 0.2s ease;
                    outline: none;
                    text-transform: uppercase;
                    letter-spacing: 0.02em;
                }
                .btn-view-gov-logs:hover {
                    background: #F0FDF4;
                    border-color: #16A34A;
                    color: #14532D;
                    box-shadow: 0 1px 3px rgba(22, 101, 52, 0.05);
                }
                .btn-view-gov-logs:active {
                    transform: translateY(0);
                }

                .tdch-right {
                    display: flex;
                    align-items: center;
                    gap: 14px;
                    margin-left: auto; /* Fixed aligned right */
                    flex-shrink: 0;
                }

                .tdc-final-stock-badge {
                    display: flex;
                    flex-direction: column;
                    align-items: flex-end;
                    justify-content: center;
                    background: #F0FDF4;
                    border: 1.5px solid #BBF7D0;
                    color: #166534;
                    padding: 6px 14px;
                    border-radius: 10px;
                    text-align: right;
                    min-width: 120px;
                }
                .tdc-final-stock-badge .lbl {
                    font-size: 8px;
                    font-weight: 850;
                    color: #166534;
                    letter-spacing: 0.05em;
                }
                .tdc-final-stock-badge strong {
                    font-size: 18px;
                    font-weight: 900;
                    line-height: 1.1;
                }
                .tdc-final-stock-badge .unit {
                    font-size: 9px;
                    font-weight: 700;
                    color: #166534;
                    text-transform: uppercase;
                }

                .tdc-expand-btn {
                    width: 28px;
                    height: 28px;
                    border-radius: 50%;
                    background: #F1F5F9;
                    border: none;
                    color: #475569;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    cursor: pointer;
                    flex-shrink: 0;
                }

                .tdc-expanded-panel {
                    border-top: 1px solid #F1F5F9;
                    background: #FCFDFE;
                    overflow: hidden;
                }
                .panel-inner-scroll {
                    padding: 16px 20px;
                }

                /* Expanded Desktop Table View */
                .expanded-desktop-table {
                    width: 100%;
                    border-collapse: collapse;
                    text-align: left;
                    font-size: 13px;
                }
                .expanded-desktop-table th {
                    color: #94A3B8;
                    font-weight: 800;
                    text-transform: uppercase;
                    font-size: 10px;
                    letter-spacing: 0.05em;
                    padding: 8px 12px;
                    border-bottom: 2px solid #F1F5F9;
                }
                .expanded-desktop-table td {
                    padding: 12px;
                    border-bottom: 1px solid #F8FAFC;
                    vertical-align: middle;
                    color: #334155;
                }
                .log-time {
                    font-weight: 700;
                    color: #64748B;
                }
                .log-timeline-node {
                    width: 10px;
                    height: 10px;
                    border-radius: 50%;
                    border: 2.5px solid #CBD5E1;
                    background: white;
                    margin-right: 10px;
                    display: inline-block;
                    flex-shrink: 0;
                }
                .log-badge {
                    font-size: 11px;
                    font-weight: 800;
                    padding: 4px 10px;
                    border-radius: 6px;
                    display: inline-flex;
                    align-items: center;
                    gap: 6px;
                }
                .log-audit-path-cell {
                    display: flex;
                    flex-direction: column;
                    gap: 2px;
                    font-size: 12px;
                }
                .log-audit-path-cell .lbl {
                    font-size: 10px;
                    font-weight: 700;
                    color: #94A3B8;
                    text-transform: uppercase;
                }
                .log-audit-path-cell strong {
                    font-weight: 800;
                    color: #334155;
                }

                /* Day Accounting Summary widget */
                .day-accounting-summary-block {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
                    gap: 12px;
                    margin-bottom: 20px;
                    background: #F8FAFC;
                    border: 1px solid #E2E8F0;
                    border-radius: 12px;
                    padding: 14px;
                }
                .das-box {
                    display: flex;
                    flex-direction: column;
                    gap: 4px;
                    padding: 8px 12px;
                    border-radius: 8px;
                    background: white;
                    border: 1px solid #F1F5F9;
                }
                .das-box.text-danger .das-value { color: #EF4444; }
                .das-box.text-warning .das-value { color: #D97706; }
                .das-box.text-success .das-value { color: #10B981; }
                .das-box.text-purple .das-value { color: #7C3AED; }
                .das-box.closing {
                    background: #EFF6FF;
                    border-color: #BFDBFE;
                    color: #1E40AF;
                }
                .das-box.closing .das-label {
                    color: #1D4ED8;
                }
                .das-label {
                    font-size: 10px;
                    font-weight: 700;
                    color: #94A3B8;
                    text-transform: uppercase;
                    letter-spacing: 0.02em;
                }
                .das-value {
                    font-size: 17px;
                    font-weight: 850;
                    color: #1E293B;
                }
                .das-box.closing .das-value {
                    color: #1E3A8A;
                }
                .unit-text {
                    font-size: 11px;
                    font-weight: 600;
                    color: #64748B;
                }

                /* Physical Stock Audit & Reconciliation Panel */
                .ledger-audit-panel {
                    background: white;
                    border: 1px solid #E2E8F0;
                    border-radius: 20px;
                    padding: 20px;
                    display: flex;
                    justify-content: space-between;
                    gap: 24px;
                    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.02);
                }
                .lap-left {
                    flex: 1.2;
                    display: flex;
                    flex-direction: column;
                    gap: 8px;
                }
                .lap-title-row {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                }
                .lap-title-row h3 {
                    margin: 0;
                    font-size: 17px;
                    font-weight: 850;
                    color: #1E293B;
                }
                .lap-desc {
                    font-size: 13px;
                    color: #64748B;
                    margin: 0;
                    line-height: 1.5;
                }
                .audit-calculator {
                    display: flex;
                    gap: 16px;
                    flex-wrap: wrap;
                    margin-top: 14px;
                    width: 100%;
                }
                .ac-field {
                    display: flex;
                    flex-direction: column;
                    gap: 6px;
                    flex: 1;
                    min-width: 140px;
                }
                .ac-field label {
                    font-size: 10px;
                    font-weight: 850;
                    color: #94A3B8;
                    text-transform: uppercase;
                    letter-spacing: 0.05em;
                }
                .ac-value {
                    font-size: 15px;
                    font-weight: 750;
                    color: #334155;
                    background: #F8FAFC;
                    border: 1.5px solid #F1F5F9;
                    height: 42px;
                    display: flex;
                    align-items: center;
                    padding: 0 12px;
                    border-radius: 10px;
                    box-sizing: border-box;
                }
                .physical-input {
                    height: 42px;
                    border: 1.5px solid #CBD5E1;
                    border-radius: 10px;
                    padding: 0 12px;
                    font-size: 15px;
                    font-weight: 700;
                    color: #0F172A;
                    outline: none;
                    transition: 0.15s;
                    box-sizing: border-box;
                }
                .physical-input:focus {
                    border-color: #2563EB;
                    box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
                }
                .ac-variance {
                    font-size: 15px;
                    font-weight: 850;
                    height: 42px;
                    display: flex;
                    align-items: center;
                    padding: 0 12px;
                    border-radius: 10px;
                    box-sizing: border-box;
                }
                .ac-variance.matching {
                    background: #ECFDF5;
                    color: #059669;
                    border: 1.5px solid #A7F3D0;
                }
                .ac-variance.surplus {
                    background: #EFF6FF;
                    color: #2563EB;
                    border: 1.5px solid #BFDBFE;
                }
                .ac-variance.mismatch {
                    background: #FEF2F2;
                    color: #DC2626;
                    border: 1.5px solid #FCA5A5;
                }
                .lap-right {
                    flex: 0.8;
                    display: flex;
                }
                .audit-prompt-card {
                    border: 1.5px dashed #CBD5E1;
                    border-radius: 14px;
                    padding: 16px;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    text-align: center;
                    gap: 8px;
                    width: 100%;
                    background: #F8FAFC;
                    box-sizing: border-box;
                }
                .audit-prompt-card p {
                    font-size: 12px;
                    font-weight: 600;
                    color: #64748B;
                    margin: 0;
                }
                .mismatch-warning-card {
                    background: #FFFBEB;
                    border: 1.5px solid #FDE68A;
                    border-radius: 14px;
                    padding: 16px;
                    display: flex;
                    flex-direction: column;
                    gap: 10px;
                    width: 100%;
                    box-sizing: border-box;
                }
                .warn-badge {
                    font-size: 10px;
                    font-weight: 850;
                    color: #D97706;
                    letter-spacing: 0.05em;
                }
                .mismatch-warning-card p {
                    font-size: 12.5px;
                    color: #92400E;
                    margin: 0;
                    line-height: 1.4;
                    font-weight: 600;
                }
                .btn-reconcile {
                    background: #D97706;
                    color: white;
                    border: none;
                    border-radius: 8px;
                    height: 38px;
                    font-size: 13px;
                    font-weight: 700;
                    cursor: pointer;
                    transition: 0.15s;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    width: 100%;
                }
                .btn-reconcile:hover {
                    background: #B45309;
                }
                .mismatch-success-card {
                    background: #ECFDF5;
                    border: 1.5px solid #A7F3D0;
                    border-radius: 14px;
                    padding: 16px;
                    display: flex;
                    flex-direction: column;
                    gap: 6px;
                    justify-content: center;
                    width: 100%;
                    box-sizing: border-box;
                }
                .success-badge {
                    font-size: 10px;
                    font-weight: 850;
                    color: #059669;
                    letter-spacing: 0.05em;
                }
                .mismatch-success-card p {
                    font-size: 12.5px;
                    color: #065F46;
                    margin: 0;
                    line-height: 1.4;
                    font-weight: 600;
                }
                .log-ref-link {
                    color: #2563EB;
                    font-weight: 800;
                    cursor: pointer;
                    text-decoration: underline;
                }
                .log-ref-link:hover {
                    color: #1D4ED8;
                }
                .log-source {
                    font-weight: 700;
                }
                .log-notes {
                    color: #64748B;
                    font-style: italic;
                    max-width: 200px;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    white-space: nowrap;
                    display: inline-block;
                }

                /* Mobile Stack View */
                .expanded-mobile-stack {
                    display: none;
                    flex-direction: column;
                    gap: 12px;
                    position: relative;
                    padding-left: 16px;
                    border-left: 2px dashed #E2E8F0;
                    margin-left: 8px;
                    margin-top: 10px;
                }
                .mobile-log-card {
                    position: relative;
                    background: white;
                    border: 1px solid #F1F5F9;
                    border-radius: 12px;
                    padding: 12px;
                    display: flex;
                    flex-direction: column;
                    gap: 8px;
                }
                .mobile-log-card::before {
                    content: '';
                    position: absolute;
                    left: -22px;
                    top: 16px;
                    width: 10px;
                    height: 10px;
                    border-radius: 50%;
                    background: white;
                    border: 2px solid #64748B;
                    z-index: 2;
                }
                .mlc-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                }
                .mlch-badge {
                    font-size: 10px;
                    font-weight: 800;
                    padding: 1px 6px;
                    border-radius: 5px;
                }
                .mlc-body {
                    display: flex;
                    flex-direction: column;
                    gap: 4px;
                    font-size: 12px;
                }
                .mlcb-row {
                    display: flex;
                    justify-content: space-between;
                    color: #475569;
                }
                .mlcb-row span {
                    color: #94A3B8;
                    font-weight: 600;
                }
                .log-ref-link-mobile {
                    color: #2563EB;
                    text-decoration: underline;
                    cursor: pointer;
                }
                .mlcb-notes {
                    background: #F8FAFC;
                    padding: 6px 8px;
                    border-radius: 6px;
                    color: #64748B;
                    font-style: italic;
                    margin-top: 2px;
                }
                .mlc-footer {
                    display: flex;
                    justify-content: flex-end;
                    font-size: 11px;
                    color: #94A3B8;
                    font-weight: 600;
                    border-top: 1px dashed #F1F5F9;
                    padding-top: 6px;
                }

                .btn-ledger-load-more {
                    height: 44px;
                    padding: 0 24px;
                    background: white;
                    border: 1.5px solid #E2E8F0;
                    color: #334155;
                    font-weight: 700;
                    font-size: 14px;
                    border-radius: 99px;
                    cursor: pointer;
                    box-shadow: 0 2px 4px rgba(0,0,0,0.02);
                    transition: 0.15s;
                }
                .btn-ledger-load-more:hover {
                    background: #F8FAFC;
                    border-color: #CBD5E1;
                }

                @media (max-width: 1024px) {
                    .expanded-desktop-table {
                        display: none;
                    }
                    .expanded-mobile-stack {
                        display: flex;
                    }
                }

                @media (max-width: 768px) {
                    .stock-ledger-page {
                        padding: 12px;
                        gap: 16px;
                    }
                    .ledger-header-panel {
                        flex-direction: column;
                        align-items: stretch;
                        padding: 16px;
                    }
                    .stock-showcase {
                        text-align: left;
                    }
                    .showcase-val-row {
                        justify-content: flex-start;
                    }
                    .tdc-header {
                        padding: 12px 14px;
                    }
                    .tdch-left {
                        flex-direction: column;
                        align-items: flex-start;
                        gap: 6px;
                    }
                }
            `}</style>
        </div>
    );
};

export default StockLedgerPage;
