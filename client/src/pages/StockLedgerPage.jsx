import React, { useState, useEffect, useMemo, useRef } from 'react';
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
    Clock, 
    Printer, 
    X, 
    CheckCircle2, 
    AlertTriangle, 
    Eye,
    Tag,
    Building2,
    WifiOff
} from 'lucide-react';
import { productService, shopService, purchaseService, govSaleService } from '../services/api';
import { motion, AnimatePresence } from 'framer-motion';
import { EmptyState, Skeleton, PageHeader, CustomSelect, PremiumDatePicker } from '../components/PremiumUI';
import { useScrollLock } from '../hooks/useScrollLock';
import { useToast } from '../context/ToastContext';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

const PERIOD_OPTIONS = [
    { value: 'today', label: 'Today' },
    { value: 'yesterday', label: 'Yesterday' },
    { value: '7d', label: 'Last 7 days' },
    { value: '30d', label: 'Last 30 days' },
    { value: 'custom', label: 'Custom date range' },
    { value: 'all', label: 'All available history' }
];

const MOVEMENT_TYPE_OPTIONS = [
    { value: 'All', label: 'All Movements' },
    { value: 'POS Sales', label: 'POS Sales' },
    { value: 'Government Sales', label: 'GST Sales' },
    { value: 'Returns', label: 'Returns' },
    { value: 'Purchases', label: 'Purchases' },
    { value: 'Exchanges', label: 'Exchanges' },
    { value: 'Adjustments', label: 'Adjustments' }
];

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
    const [isOfflineData, setIsOfflineData] = useState(false);
    
    // Filters
    const [periodFilter, setPeriodFilter] = useState('7d');
    const getLocalToday = () => {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    };
    const [startDate, setStartDate] = useState(getLocalToday());
    const [endDate, setEndDate] = useState(getLocalToday());
    const [typeFilter, setTypeFilter] = useState('All');
    
    // View mode: 'datewise' (consolidated 1 row/date) vs 'detailed' (audit register)
    const [viewMode, setViewMode] = useState('datewise');
    
    // Pagination & Details Accordion
    const [page, setPage] = useState(1);
    const itemsPerPage = 10;
    const [expandedDays, setExpandedDays] = useState({});
    
    // Print Preview Modal
    const [showPrintModal, setShowPrintModal] = useState(false);
    useScrollLock(showPrintModal);

    useEffect(() => {
        fetchData();
    }, [shopId, productId]);

    const fetchData = async () => {
        try {
            setLoading(true);
            const [productsRes, historyRes, shopsRes, purchasesRes, govSalesRes] = await Promise.all([
                productService.getAll(shopId),
                productService.getInventoryHistory(productId, { shop: shopId }),
                shopService.getAll(),
                purchaseService.getAll(shopId).catch(() => ({ data: { data: [] } })),
                govSaleService.getAll(shopId).catch(() => ({ data: { data: [] } }))
            ]);

            const allProducts = productsRes.data?.data || [];
            const currentProduct = allProducts.find(p => p._id === productId);
            setProduct(currentProduct || null);

            const fetchedHistory = historyRes.data?.data || [];
            setHistory(fetchedHistory);
            setIsOfflineData(Boolean(historyRes.fromCache));

            setPurchases(purchasesRes.data?.data || []);
            setGovSales(govSalesRes.data?.data || []);

            if (shopsRes.data?.data) {
                setShop(shopsRes.data.data.find(s => s._id === shopId) || null);
            }
        } catch (err) {
            console.error('Error loading stock ledger details:', err);
            showToast('Failed to load stock ledger details', 'error');
        } finally {
            setLoading(false);
        }
    };

    // Movement Classifier
    const classifyMovement = (log) => {
        const isExchange = Boolean(log.referenceId && log.referenceId.startsWith('EXC-'));
        const isGovSale = log.actionType === 'GOV_SALE' || Boolean(log.referenceId && log.referenceId.startsWith('GOV-'));

        if (isExchange) {
            return {
                category: 'Exchanges',
                label: log.actionType === 'STOCK_RETURNED' ? 'Exchange (In)' : 'Exchange (Out)',
                sign: log.actionType === 'STOCK_RETURNED' ? '+' : '-',
                isPositive: log.actionType === 'STOCK_RETURNED',
                color: '#2563EB',
                bg: '#EFF6FF',
                border: '#BFDBFE',
                icon: '🔄'
            };
        }

        if (isGovSale) {
            return {
                category: 'Government Sales',
                label: 'GST Sale',
                sign: '-',
                isPositive: false,
                color: '#E11D48',
                bg: '#FFF1F2',
                border: '#FECDD3',
                icon: '🏛'
            };
        }

        switch (log.actionType) {
            case 'STOCK_SOLD':
                return {
                    category: 'POS Sales',
                    label: 'POS Sale',
                    sign: '-',
                    isPositive: false,
                    color: '#EF4444',
                    bg: '#FEF2F2',
                    border: '#FECACA',
                    icon: '⬆'
                };
            case 'STOCK_RETURNED':
                return {
                    category: 'Returns',
                    label: 'Return',
                    sign: '+',
                    isPositive: true,
                    color: '#D97706',
                    bg: '#FFFBEB',
                    border: '#FDE68A',
                    icon: '↩'
                };
            case 'PURCHASE_ENTRY':
            case 'STOCK_ADDED':
                return {
                    category: 'Purchases',
                    label: 'Purchase Ledger',
                    sign: '+',
                    isPositive: true,
                    color: '#10B981',
                    bg: '#ECFDF5',
                    border: '#A7F3D0',
                    icon: '⬇'
                };
            case 'STOCK_UPDATED':
            case 'STOCK_ADJUSTED':
            case 'DAMAGED_STOCK':
            default: {
                const diff = (log.newStock ?? 0) - (log.previousStock ?? 0);
                return {
                    category: 'Adjustments',
                    label: log.actionType === 'DAMAGED_STOCK' ? 'Damaged Stock' : 'Manual Adjustment',
                    sign: diff >= 0 ? '+' : '-',
                    isPositive: diff >= 0,
                    color: '#7C3AED',
                    bg: '#F5F3FF',
                    border: '#DDD6FE',
                    icon: '⚙'
                };
            }
        }
    };

    // Chronologically sorted history (oldest to newest)
    const sortedAllLogs = useMemo(() => {
        return [...history].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    }, [history]);

    // Reverse chronological (newest to oldest)
    const reverseChronologicalAllLogs = useMemo(() => {
        return [...history].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    }, [history]);

    // Calculate Summary Stats (Live current stock, today's sold/returned, total purchased, total exchanges, last purchase)
    const stats = useMemo(() => {
        if (!product) {
            return {
                currentStock: 0,
                todaySold: 0,
                todayReturned: 0,
                totalPurchased: 0,
                totalExchanges: 0,
                lastPurchaseDate: 'N/A'
            };
        }

        const now = new Date();
        const todayStr = now.toLocaleDateString('en-IN');
        
        let todaySold = 0;
        let todayReturned = 0;
        let totalPurchased = 0;
        const exchangeInvoiceSet = new Set();
        let lastPurchaseTime = null;

        history.forEach(log => {
            const logDate = new Date(log.createdAt);
            const logDateStr = logDate.toLocaleDateString('en-IN');
            const qty = Number(log.quantity || 0);
            const info = classifyMovement(log);

            if (info.category === 'Exchanges' && log.referenceId) {
                exchangeInvoiceSet.add(log.referenceId);
            }

            // Today stats
            if (logDateStr === todayStr) {
                if (info.category === 'POS Sales' || info.category === 'Government Sales') {
                    todaySold += qty;
                } else if (info.category === 'Returns') {
                    todayReturned += qty;
                }
            }

            // Cumulative purchases & last purchase tracking
            if (info.category === 'Purchases') {
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

    // Filter Range window
    const filterRange = useMemo(() => {
        const now = new Date();
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
        const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

        if (periodFilter === 'today') {
            return {
                start: todayStart,
                end: todayEnd,
                label: `Today (${todayStart.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })})`
            };
        }
        if (periodFilter === 'yesterday') {
            const yStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 0, 0, 0, 0);
            const yEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 23, 59, 59, 999);
            return {
                start: yStart,
                end: yEnd,
                label: `Yesterday (${yStart.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })})`
            };
        }
        if (periodFilter === '7d') {
            const s = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6, 0, 0, 0, 0);
            return {
                start: s,
                end: todayEnd,
                label: `Last 7 Days (${s.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })} – ${todayEnd.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })})`
            };
        }
        if (periodFilter === '30d') {
            const s = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 29, 0, 0, 0, 0);
            return {
                start: s,
                end: todayEnd,
                label: `Last 30 Days (${s.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })} – ${todayEnd.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })})`
            };
        }
        if (periodFilter === 'custom') {
            const s = new Date(startDate);
            s.setHours(0, 0, 0, 0);
            const e = new Date(endDate);
            e.setHours(23, 59, 59, 999);
            return {
                start: s,
                end: e,
                label: `Custom (${s.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })} – ${e.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })})`
            };
        }
        if (periodFilter === 'all') {
            return {
                start: null,
                end: null,
                label: 'All Recorded History'
            };
        }
        return { start: null, end: null, label: 'All History' };
    }, [periodFilter, startDate, endDate]);

    // Logs strictly matching the Date Filter
    const dateMatchingLogs = useMemo(() => {
        return sortedAllLogs.filter(log => {
            const d = new Date(log.createdAt);
            if (filterRange.start && d < filterRange.start) return false;
            if (filterRange.end && d > filterRange.end) return false;
            return true;
        });
    }, [sortedAllLogs, filterRange]);

    // Period Accounting Reconciliation Totals
    const periodSummary = useMemo(() => {
        if (!product) {
            return {
                openingStock: 0,
                closingStock: 0,
                periodSold: 0,
                periodPOSSold: 0,
                periodGovSold: 0,
                periodReturned: 0,
                periodPurchased: 0,
                periodExchangesCount: 0,
                periodExchangeNetQty: 0,
                periodAdjustments: 0
            };
        }

        // 1. Opening Stock Calculation
        let openingStock = product.quantity;
        if (filterRange.start) {
            const logsBeforePeriod = sortedAllLogs.filter(l => new Date(l.createdAt) < filterRange.start);
            if (logsBeforePeriod.length > 0) {
                openingStock = logsBeforePeriod[logsBeforePeriod.length - 1].newStock;
            } else if (sortedAllLogs.length > 0) {
                openingStock = sortedAllLogs[0].previousStock;
            }
        } else {
            // "all" period
            openingStock = sortedAllLogs.length > 0 ? sortedAllLogs[0].previousStock : product.quantity;
        }

        // 2. Closing Stock Calculation
        let closingStock = product.quantity;
        if (filterRange.end && filterRange.end < new Date()) {
            const logsUpToPeriod = sortedAllLogs.filter(l => new Date(l.createdAt) <= filterRange.end);
            if (logsUpToPeriod.length > 0) {
                closingStock = logsUpToPeriod[logsUpToPeriod.length - 1].newStock;
            } else {
                closingStock = openingStock;
            }
        } else {
            closingStock = sortedAllLogs.length > 0 ? sortedAllLogs[sortedAllLogs.length - 1].newStock : product.quantity;
        }

        // 3. Cumulative Period Totals
        let periodSold = 0;
        let periodPOSSold = 0;
        let periodGovSold = 0;
        let periodReturned = 0;
        let periodPurchased = 0;
        const exchangeInvoiceSet = new Set();
        let periodExchangeNetQty = 0;
        let periodAdjustments = 0;

        dateMatchingLogs.forEach(log => {
            const qty = Number(log.quantity || 0);
            const info = classifyMovement(log);

            if (info.category === 'POS Sales') {
                periodPOSSold += qty;
                periodSold += qty;
            } else if (info.category === 'Government Sales') {
                periodGovSold += qty;
                periodSold += qty;
            } else if (info.category === 'Returns') {
                periodReturned += qty;
            } else if (info.category === 'Purchases') {
                periodPurchased += qty;
            } else if (info.category === 'Exchanges') {
                if (log.referenceId) exchangeInvoiceSet.add(log.referenceId);
                if (log.actionType === 'STOCK_RETURNED') {
                    periodExchangeNetQty += qty;
                } else {
                    periodExchangeNetQty -= qty;
                }
            } else if (info.category === 'Adjustments') {
                const diff = (log.newStock ?? 0) - (log.previousStock ?? 0);
                periodAdjustments += diff;
            }
        });

        return {
            openingStock,
            closingStock,
            periodSold,
            periodPOSSold,
            periodGovSold,
            periodReturned,
            periodPurchased,
            periodExchangesCount: exchangeInvoiceSet.size,
            periodExchangeNetQty,
            periodAdjustments
        };
    }, [product, sortedAllLogs, dateMatchingLogs, filterRange]);

    // Matching Logs for Active Period AND Movement Type (Complete filtered recordset)
    const filteredHistory = useMemo(() => {
        return dateMatchingLogs.filter(log => {
            if (typeFilter === 'All') return true;
            const info = classifyMovement(log);
            return info.category === typeFilter;
        });
    }, [dateMatchingLogs, typeFilter]);

    const baseUnit = product?.unit || 'Piece';

    // Group filtered history items by day for interactive UI display
    const groupedDays = useMemo(() => {
        const groups = {};

        // Sort ascending chronologically to compute daily balances properly
        const sorted = [...filteredHistory].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

        sorted.forEach(log => {
            const d = new Date(log.createdAt);
            const dateKey = d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

            if (!groups[dateKey]) {
                groups[dateKey] = {
                    date: dateKey,
                    rawDate: d,
                    sold: 0,
                    posSold: 0,
                    govSold: 0,
                    returned: 0,
                    purchased: 0,
                    exchangedIn: 0,
                    exchangedOut: 0,
                    adjusted: 0,
                    openingStock: log.previousStock,
                    closingStock: log.newStock,
                    finalStock: log.newStock,
                    unit: log.unit || baseUnit,
                    logs: []
                };
            }

            const qty = Number(log.quantity || 0);
            const info = classifyMovement(log);

            if (info.category === 'POS Sales') {
                groups[dateKey].posSold += qty;
                groups[dateKey].sold += qty;
            } else if (info.category === 'Government Sales') {
                groups[dateKey].govSold += qty;
                groups[dateKey].sold += qty;
            } else if (info.category === 'Returns') {
                groups[dateKey].returned += qty;
            } else if (info.category === 'Purchases') {
                groups[dateKey].purchased += qty;
            } else if (info.category === 'Exchanges') {
                if (log.actionType === 'STOCK_RETURNED') {
                    groups[dateKey].exchangedIn += qty;
                } else {
                    groups[dateKey].exchangedOut += qty;
                }
            } else if (info.category === 'Adjustments') {
                const diff = (log.newStock ?? 0) - (log.previousStock ?? 0);
                groups[dateKey].adjusted += diff;
            }

            groups[dateKey].closingStock = log.newStock;
            groups[dateKey].finalStock = log.newStock;
            groups[dateKey].logs.push(log);
        });

        // Return latest days first for interactive scan
        return Object.values(groups).sort((a, b) => b.rawDate - a.rawDate);
    }, [filteredHistory, baseUnit]);

    const paginatedGroupedDays = useMemo(() => {
        return groupedDays.slice(0, page * itemsPerPage);
    }, [groupedDays, page]);

    // Consolidated 1-Row-Per-Date Stock Ledger Rows (Main Requirement: Exactly 1 row per calendar date)
    const dateWiseRows = useMemo(() => {
        // Sort chronologically ascending to compute opening/closing balances accurately
        const sorted = [...filteredHistory].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

        const dayMap = new Map();

        sorted.forEach((log) => {
            const d = new Date(log.createdAt);
            // Group by shop's local calendar date (not UTC)
            const yyyy = d.getFullYear();
            const mm = String(d.getMonth() + 1).padStart(2, '0');
            const dd = String(d.getDate()).padStart(2, '0');
            const dateKey = `${yyyy}-${mm}-${dd}`;
            const displayDate = d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

            if (!dayMap.has(dateKey)) {
                dayMap.set(dateKey, {
                    dateKey,
                    date: displayDate,
                    rawDate: new Date(yyyy, d.getMonth(), d.getDate()),
                    openingBalance: log.previousStock ?? 0,
                    closingBalance: log.newStock ?? 0,
                    purchase: 0,
                    sold: 0,
                    returned: 0,
                    adjusted: 0,
                    unit: log.unit || baseUnit,
                    dealersSet: new Set(),
                    logs: []
                });
            }

            const entry = dayMap.get(dateKey);
            const qty = Number(log.quantity || 0);
            const info = classifyMovement(log);

            // Consolidate sales: both normal POS sales and special-price/GST sales into Sold
            if (info.category === 'POS Sales' || info.category === 'Government Sales') {
                entry.sold += qty;
            } else if (info.category === 'Purchases') {
                entry.purchase += qty;
                // Retrieve actual supplier/dealer name from purchase records or movement source
                let dealer = null;
                if (log.referenceId && purchases && purchases.length > 0) {
                    const found = purchases.find(
                        p => p.billNo === log.referenceId || String(p._id) === String(log.referenceId)
                    );
                    if (found && found.supplierName) {
                        dealer = found.supplierName.trim();
                    }
                }
                if (!dealer && log.source) {
                    const trimmed = log.source.trim();
                    const lower = trimmed.toLowerCase();
                    if (trimmed && !['system', 'unknown', 'manual edit', 'walk-in', 'walk-in customer', 'purchase'].includes(lower)) {
                        dealer = trimmed;
                    }
                }
                if (dealer) {
                    entry.dealersSet.add(dealer);
                }
            } else if (info.category === 'Returns') {
                entry.returned += qty;
            } else if (info.category === 'Exchanges') {
                if (log.actionType === 'STOCK_RETURNED') {
                    entry.returned += qty;
                } else {
                    entry.sold += qty;
                }
            } else if (info.category === 'Adjustments') {
                const diff = (log.newStock ?? 0) - (log.previousStock ?? 0);
                entry.adjusted += diff;
            }

            // The day's closing balance is the newStock of the last movement of this date
            entry.closingBalance = log.newStock ?? entry.closingBalance;
            entry.logs.push(log);
        });

        // Chronologically sorted list of date-wise rows (ascending)
        const rows = Array.from(dayMap.values()).sort((a, b) => a.rawDate - b.rawDate);

        return rows.map((r) => ({
            ...r,
            dealerName: Array.from(r.dealersSet).join(', '),
            formattedOpening: `${r.openingBalance} ${r.unit}`,
            formattedPurchase: `${r.purchase} ${r.unit}`,
            formattedSold: `${r.sold} ${r.unit}`,
            formattedClosing: `${r.closingBalance} ${r.unit}`
        }));
    }, [filteredHistory, baseUnit, purchases]);

    const toggleExpandDay = (dateKey) => {
        setExpandedDays(prev => ({
            ...prev,
            [dateKey]: !prev[dateKey]
        }));
    };

    // Invoice Click handler
    const handleInvoiceClick = (log) => {
        if (!log.referenceId) return;

        if (log.actionType === 'GOV_SALE' || log.referenceId.startsWith('GOV-')) {
            navigate(`/shop/${shopId}/gov-sales-log?search=${log.referenceId}`);
            return;
        }

        if (log.actionType === 'STOCK_SOLD' || log.referenceId.startsWith('SAL-') || log.referenceId.startsWith('EXC-') || log.referenceId.startsWith('RET-')) {
            navigate(`/shop/${shopId}/sales-log?search=${log.referenceId}`);
            return;
        }

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

    // Export CSV Handler
    const handleExportCSV = () => {
        try {
            if (viewMode === 'datewise') {
                if (!dateWiseRows || dateWiseRows.length === 0) {
                    showToast('No records matching current filters to export.', 'warning');
                    return;
                }

                const escapeCsv = (val) => {
                    if (val === null || val === undefined) return '""';
                    const str = String(val).replace(/"/g, '""');
                    return `"${str}"`;
                };

                const headers = [
                    'Date',
                    'Opening Balance',
                    'Dealer Name',
                    'Purchase',
                    'Sold',
                    'Closing Balance'
                ];

                const rows = dateWiseRows.map((row) => [
                    row.date,
                    row.formattedOpening,
                    row.dealerName || '',
                    row.formattedPurchase,
                    row.formattedSold,
                    row.formattedClosing
                ].map(escapeCsv).join(','));

                const summaryRow = [
                    'Total / Period Summary',
                    `${periodSummary.openingStock} ${baseUnit}`,
                    '',
                    `${periodSummary.periodPurchased} ${baseUnit}`,
                    `${periodSummary.periodSold} ${baseUnit}`,
                    `${periodSummary.closingStock} ${baseUnit}`
                ].map(escapeCsv).join(',');

                const csvContent = '\uFEFF' + [headers.map(escapeCsv).join(','), ...rows, summaryRow].join('\r\n');
                const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
                const url = URL.createObjectURL(blob);
                const link = document.createElement('a');
                const safeProdName = (product?.name || 'Product').replace(/[^a-zA-Z0-9]/g, '_');
                link.href = url;
                link.setAttribute('download', `Stock_Ledger_${safeProdName}_${periodFilter}_${new Date().toISOString().slice(0, 10)}.csv`);
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                URL.revokeObjectURL(url);

                showToast(`Exported ${dateWiseRows.length} date-wise ledger records to CSV successfully`, 'success');
                return;
            }

            if (!filteredHistory || filteredHistory.length === 0) {
                showToast('No records matching current filters to export.', 'warning');
                return;
            }

            const escapeCsv = (val) => {
                if (val === null || val === undefined) return '""';
                const str = String(val).replace(/"/g, '""');
                return `"${str}"`;
            };

            const headers = [
                'Sl No',
                'Date & Time',
                'Movement Type',
                'Quantity Change',
                'Unit',
                'Opening Stock',
                'Closing Stock',
                'Bill / Invoice Number',
                'Customer / Source',
                'Notes / Remarks'
            ];

            const rows = filteredHistory.map((log, index) => {
                const info = classifyMovement(log);
                const d = new Date(log.createdAt);
                const dStr = d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

                return [
                    index + 1,
                    dStr,
                    info.label,
                    `${info.sign}${log.quantity}`,
                    log.unit || product?.unit || 'Piece',
                    log.previousStock ?? 0,
                    log.newStock ?? 0,
                    log.referenceId || '',
                    log.source || 'Walk-in',
                    log.notes || ''
                ].map(escapeCsv).join(',');
            });

            const csvContent = '\uFEFF' + [headers.map(escapeCsv).join(','), ...rows].join('\r\n');
            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            const safeProdName = (product?.name || 'Product').replace(/[^a-zA-Z0-9]/g, '_');
            link.href = url;
            link.setAttribute('download', `Stock_Ledger_${safeProdName}_${periodFilter}_${new Date().toISOString().slice(0, 10)}.csv`);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);

            showToast(`Exported ${filteredHistory.length} ledger records to CSV successfully`, 'success');
        } catch (err) {
            console.error('Failed to export CSV:', err);
            showToast('Failed to export CSV. Please try again.', 'error');
        }
    };

    // Download Simplified 5-Column Date-Wise PDF Handler
    const handleDownloadPDF = () => {
        try {
            const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
            const pageWidth = doc.internal.pageSize.getWidth(); // 210mm
            const pageHeight = doc.internal.pageSize.getHeight(); // 297mm

            const primaryNavy = [7, 27, 68];
            const accentBlue = [37, 99, 235];
            const darkText = [15, 23, 42];
            const mutedGray = [100, 116, 139];

            // 1. Decorative Accent Top Bar
            doc.setFillColor(...accentBlue);
            doc.rect(0, 0, pageWidth, 3.5, 'F');

            // 2. Shop & Document Header
            let currentY = 13;
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(14);
            doc.setTextColor(...primaryNavy);
            doc.text(shop?.name || 'ShopPulse Store', 14, currentY);

            doc.setFont('helvetica', 'normal');
            doc.setFontSize(8);
            doc.setTextColor(...mutedGray);
            const shopSub = [
                shop?.address,
                shop?.phone ? `Ph: ${shop.phone}` : null,
                shop?.gstNumber ? `GSTIN: ${shop.gstNumber}` : null
            ].filter(Boolean).join('   |   ');
            if (shopSub) {
                currentY += 4.5;
                doc.text(shopSub, 14, currentY);
            }

            // Right side: Document badge & timestamp
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(11);
            doc.setTextColor(...accentBlue);
            doc.text('STOCK LEDGER REPORT', pageWidth - 14, 13, { align: 'right' });

            doc.setFont('helvetica', 'normal');
            doc.setFontSize(8);
            doc.setTextColor(...mutedGray);
            doc.text(`Generated: ${new Date().toLocaleString('en-IN')}`, pageWidth - 14, 18, { align: 'right' });

            currentY += 6;
            doc.setDrawColor(226, 232, 240);
            doc.setLineWidth(0.4);
            doc.line(14, currentY, pageWidth - 14, currentY);

            // 3. Product Info & Report Period Header Box
            currentY += 4;
            doc.setFillColor(248, 250, 252);
            doc.roundedRect(14, currentY, pageWidth - 28, 14, 2, 2, 'F');

            doc.setFontSize(7);
            doc.setTextColor(...mutedGray);
            doc.text('PRODUCT NAME', 18, currentY + 4.2);
            doc.text('BASE UNIT', 95, currentY + 4.2);
            doc.text('REPORT PERIOD', 145, currentY + 4.2);

            doc.setFontSize(8.5);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(...darkText);
            doc.text(`${product?.name || ''} ${product?.brand ? `(${product.brand})` : ''}`, 18, currentY + 10);
            doc.text(`${product?.category || 'General'}  •  ${baseUnit}`, 95, currentY + 10);
            doc.text(filterRange.label, 145, currentY + 10);

            // 4. Stock Reconciliation Summary Strip (4 KPI boxes)
            currentY += 18;
            const cardWidth = (pageWidth - 28 - 9) / 4; // ~43.25mm
            const kpis = [
                { label: 'OPENING BALANCE', val: `${periodSummary.openingStock} ${baseUnit}`, color: primaryNavy },
                { label: 'TOTAL PURCHASE', val: `+${periodSummary.periodPurchased} ${baseUnit}`, color: [16, 185, 129] },
                { label: 'TOTAL SOLD', val: `-${periodSummary.periodSold} ${baseUnit}`, color: [225, 29, 72] },
                { label: 'CLOSING BALANCE', val: `${periodSummary.closingStock} ${baseUnit}`, color: primaryNavy }
            ];

            kpis.forEach((kpi, idx) => {
                const x = 14 + (idx * (cardWidth + 3));
                doc.setFillColor(255, 255, 255);
                doc.setDrawColor(226, 232, 240);
                doc.roundedRect(x, currentY, cardWidth, 12, 1.5, 1.5, 'FD');

                doc.setFont('helvetica', 'normal');
                doc.setFontSize(6.5);
                doc.setTextColor(...mutedGray);
                doc.text(kpi.label, x + 3, currentY + 4);

                doc.setFont('helvetica', 'bold');
                doc.setFontSize(8.5);
                doc.setTextColor(...kpi.color);
                doc.text(kpi.val, x + 3, currentY + 9);
            });

            // 5. Exactly 6 Columns Date-Wise autoTable (Date, Opening Balance, Dealer Name, Purchase, Sold, Closing Balance)
            currentY += 16;
            const tableBody = dateWiseRows.map((r) => [
                r.date,
                r.formattedOpening,
                r.dealerName || '',
                r.formattedPurchase,
                r.formattedSold,
                r.formattedClosing
            ]);

            const tableFoot = [[
                'Total / Period Summary',
                `${periodSummary.openingStock} ${baseUnit}`,
                '',
                `${periodSummary.periodPurchased} ${baseUnit}`,
                `${periodSummary.periodSold} ${baseUnit}`,
                `${periodSummary.closingStock} ${baseUnit}`
            ]];

            autoTable(doc, {
                startY: currentY,
                head: [['Date', 'Opening Balance', 'Dealer Name', 'Purchase', 'Sold', 'Closing Balance']],
                body: tableBody.length > 0 ? tableBody : [['-', 'No stock movements recorded for selected period.', '', '', '', '']],
                foot: dateWiseRows.length > 0 ? tableFoot : undefined,
                theme: 'grid',
                headStyles: {
                    fillColor: primaryNavy,
                    textColor: [255, 255, 255],
                    fontSize: 8.5,
                    fontStyle: 'bold',
                    halign: 'right',
                    cellPadding: 2.5
                },
                styles: {
                    fontSize: 8,
                    textColor: darkText,
                    cellPadding: 2.5,
                    valign: 'middle'
                },
                columnStyles: {
                    0: { cellWidth: 32, halign: 'left' },
                    1: { cellWidth: 30, halign: 'right' },
                    2: { cellWidth: 46, halign: 'left' },
                    3: { cellWidth: 24, halign: 'right' },
                    4: { cellWidth: 24, halign: 'right' },
                    5: { cellWidth: 26, halign: 'right', fontStyle: 'bold' }
                },
                footStyles: {
                    fillColor: [241, 245, 249],
                    textColor: primaryNavy,
                    fontStyle: 'bold',
                    fontSize: 8.5,
                    halign: 'right',
                    cellPadding: 2.5
                },
                didParseCell: (data) => {
                    // Match horizontal alignment for column headings, body cells, and footer cells
                    if (data.column.index === 0 || data.column.index === 2) {
                        data.cell.styles.halign = 'left';
                    } else {
                        data.cell.styles.halign = 'right';
                    }
                    if (data.section === 'body') {
                        // Highlight non-zero purchase (Column 3)
                        if (data.column.index === 3) {
                            const val = String(data.cell.raw || '');
                            if (!val.startsWith('0 ') && val !== '0') {
                                data.cell.styles.textColor = [16, 185, 129];
                                data.cell.styles.fontStyle = 'bold';
                            }
                        }
                        // Highlight non-zero sold (Column 4)
                        if (data.column.index === 4) {
                            const val = String(data.cell.raw || '');
                            if (!val.startsWith('0 ') && val !== '0') {
                                data.cell.styles.textColor = [225, 29, 72];
                                data.cell.styles.fontStyle = 'bold';
                            }
                        }
                        // Bold closing balance (Column 5)
                        if (data.column.index === 5) {
                            data.cell.styles.textColor = primaryNavy;
                            data.cell.styles.fontStyle = 'bold';
                        }
                    }
                    if (data.section === 'foot') {
                        if (data.column.index === 3) {
                            data.cell.styles.textColor = [16, 185, 129];
                        }
                        if (data.column.index === 4) {
                            data.cell.styles.textColor = [225, 29, 72];
                        }
                        if (data.column.index === 5) {
                            data.cell.styles.textColor = primaryNavy;
                        }
                    }
                },
                didDrawPage: (data) => {
                    const totalPages = doc.internal.getNumberOfPages();
                    const pageNum = data.pageNumber;
                    doc.setFontSize(7.5);
                    doc.setFont('helvetica', 'normal');
                    doc.setTextColor(...mutedGray);
                    doc.text(
                        `ShopPulse Inventory Management  •  Page ${pageNum} of ${totalPages}`,
                        pageWidth / 2,
                        pageHeight - 6,
                        { align: 'center' }
                    );
                },
                margin: { left: 14, right: 14, bottom: 12 }
            });

            const safeProdName = (product?.name || 'Product').replace(/[^a-zA-Z0-9]/g, '_');
            const filename = `Stock_Ledger_${safeProdName}_${periodFilter}_${new Date().toISOString().slice(0, 10)}.pdf`;
            doc.save(filename);
            showToast('Stock Ledger PDF report downloaded successfully', 'success');
        } catch (err) {
            console.error('Failed to export PDF:', err);
            showToast('Failed to generate PDF. Please try again.', 'error');
        }
    };

    // Print Report Handler
    const handlePrintReport = () => {
        setShowPrintModal(true);
    };

    const triggerBrowserPrint = () => {
        window.print();
    };

    if (loading) {
        return (
            <div className="stock-ledger-loading-state">
                <Skeleton height="40px" width="30%" />
                <Skeleton height="110px" borderRadius="16px" />
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '14px' }}>
                    {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} height="88px" borderRadius="14px" />)}
                </div>
                <Skeleton height="56px" borderRadius="14px" />
                <Skeleton height="340px" borderRadius="16px" />
            </div>
        );
    }

    if (!product) {
        return (
            <div className="ledger-empty-wrap">
                <EmptyState 
                    icon={Package} 
                    title="Product Not Found" 
                    description="The product you are trying to view does not exist or has been removed." 
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
            {/* 1. Header with Consistent Action Buttons */}
            <PageHeader 
                title="Stock Ledger"
                subtitle={`Double-entry audit register for ${product.name}`}
                backAction={() => navigate(`/shop/${shopId}/inventory`)}
                actions={
                    <div className="ledger-action-bar">
                        <button 
                            className="btn-action-outline" 
                            onClick={handlePrintReport} 
                            title="Print complete structured stock report"
                            id="btn-print-stock-ledger"
                        >
                            <Printer size={15} />
                            <span>Print Report</span>
                        </button>
                        <button 
                            className="btn-action-outline" 
                            onClick={handleDownloadPDF} 
                            title="Download complete ledger report as PDF"
                            id="btn-pdf-stock-ledger"
                        >
                            <FileText size={15} />
                            <span>Download PDF</span>
                        </button>
                        <button 
                            className="btn-action-primary" 
                            onClick={handleExportCSV} 
                            title="Export all matching records to CSV"
                            id="btn-csv-stock-ledger"
                        >
                            <Download size={15} />
                            <span>Export CSV</span>
                        </button>
                        <button 
                            className="btn-action-nav-back" 
                            onClick={() => navigate(`/shop/${shopId}/inventory`)}
                            title="Back to inventory"
                        >
                            <ArrowLeft size={15} />
                            <span>Inventory</span>
                        </button>
                    </div>
                }
            />

            {/* Offline Notification Banner if cache fallback used */}
            {isOfflineData && (
                <div className="offline-notice-banner">
                    <WifiOff size={16} />
                    <span>Viewing cached offline ledger data. Some recent unsynchronized movements may be pending network sync.</span>
                </div>
            )}

            {/* 2. Compact Product Summary Header Panel */}
            <div className="product-summary-card">
                <div className="psc-left">
                    <div className="psc-title-row">
                        <h2 className="psc-product-name">{product.name}</h2>
                        {product.brand && <span className="psc-brand-pill">{product.brand}</span>}
                    </div>
                    <div className="psc-metadata-row">
                        <span className="psc-meta-tag category"><Tag size={12} /> {product.category || 'General'}</span>
                        <span className="psc-meta-tag unit"><Package size={12} /> Base Unit: {product.unit || 'Piece'}</span>
                        <span className="psc-meta-tag last-purchase"><Calendar size={12} /> Last Purchase: <strong>{stats.lastPurchaseDate}</strong></span>
                        <span className="psc-meta-tag transaction-time"><Clock size={12} /> Last Entry: {lastUpdatedText}</span>
                    </div>
                </div>
                <div className="psc-right">
                    <div className="available-stock-showcase">
                        <span className="ass-label">Available Stock</span>
                        <div className="ass-value-row">
                            <strong className={product.quantity === 0 ? 'out' : product.quantity <= (product.lowStockLimit || 5) ? 'low' : 'healthy'}>
                                {product.quantity.toLocaleString()}
                            </strong>
                            <span className="ass-unit">{product.unit || 'Piece'}</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* 3. Five KPI Metric Cards Arranged in 1 Responsive Grid */}
            <div className="ledger-metrics-grid">
                <div className="metric-kpi-card">
                    <div className="mkc-icon neutral"><Package size={20} /></div>
                    <div className="mkc-content">
                        <span className="mkc-title">Current Stock</span>
                        <strong className="mkc-val">{stats.currentStock.toLocaleString()} <small>{product.unit || 'Piece'}</small></strong>
                        <span className="mkc-sub">Live inventory</span>
                    </div>
                </div>
                <div className="metric-kpi-card">
                    <div className="mkc-icon danger"><TrendingUp size={20} /></div>
                    <div className="mkc-content">
                        <span className="mkc-title">Today Sold</span>
                        <strong className="mkc-val text-danger">{stats.todaySold.toLocaleString()} <small>{product.unit || 'Piece'}</small></strong>
                        <span className="mkc-sub">Outgoing sales</span>
                    </div>
                </div>
                <div className="metric-kpi-card">
                    <div className="mkc-icon warning"><RotateCcw size={20} /></div>
                    <div className="mkc-content">
                        <span className="mkc-title">Today Returned</span>
                        <strong className="mkc-val text-warning">{stats.todayReturned > 0 ? `+${stats.todayReturned.toLocaleString()}` : '0'} <small>{product.unit || 'Piece'}</small></strong>
                        <span className="mkc-sub">Customer returns</span>
                    </div>
                </div>
                <div className="metric-kpi-card">
                    <div className="mkc-icon success"><ShoppingBag size={20} /></div>
                    <div className="mkc-content">
                        <span className="mkc-title">Total Purchased</span>
                        <strong className="mkc-val text-success">{stats.totalPurchased.toLocaleString()} <small>{product.unit || 'Piece'}</small></strong>
                        <span className="mkc-sub">Inward restocks</span>
                    </div>
                </div>
                <div className="metric-kpi-card">
                    <div className="mkc-icon info"><RefreshCw size={20} /></div>
                    <div className="mkc-content">
                        <span className="mkc-title">Total Exchanges</span>
                        <strong className="mkc-val text-info">{stats.totalExchanges} <small>Trades</small></strong>
                        <span className="mkc-sub">Stock replacements</span>
                    </div>
                </div>
            </div>

            {/* 4. Filter Bar (Period, Movement Type, Custom Dates, Active Period Badge) */}
            <div className="ledger-filter-card">
                <div className="lfc-controls-row">
                    <div className="lfc-select-group">
                        <label>Report Period</label>
                        <CustomSelect 
                            value={periodFilter}
                            options={PERIOD_OPTIONS}
                            onChange={(val) => { setPeriodFilter(val); setPage(1); }}
                        />
                    </div>
                    {periodFilter === 'custom' && (
                        <>
                            <div className="lfc-date-group">
                                <PremiumDatePicker 
                                    label="Start Date"
                                    value={startDate}
                                    onChange={(val) => { setStartDate(val); setPage(1); }}
                                />
                            </div>
                            <div className="lfc-date-group">
                                <PremiumDatePicker 
                                    label="End Date"
                                    value={endDate}
                                    onChange={(val) => { setEndDate(val); setPage(1); }}
                                />
                            </div>
                        </>
                    )}
                    <div className="lfc-select-group">
                        <label>Movement Type</label>
                        <CustomSelect 
                            value={typeFilter}
                            options={MOVEMENT_TYPE_OPTIONS}
                            onChange={(val) => { setTypeFilter(val); setPage(1); }}
                        />
                    </div>
                </div>

                {/* Active Period and Filter Indicator Strip */}
                <div className="lfc-status-strip">
                    <div className="active-period-badge">
                        <Calendar size={13} />
                        <span><strong>Period:</strong> {filterRange.label}</span>
                    </div>
                    <div className="active-filter-badge">
                        <SlidersHorizontal size={13} />
                        <span><strong>Filter:</strong> {typeFilter === 'All' ? 'All Movements' : typeFilter}</span>
                    </div>
                    <div className="active-count-badge">
                        <span><strong>{filteredHistory.length}</strong> matching records found</span>
                    </div>
                </div>
            </div>

            {/* 5. Date-Wise Ledger & Detailed Audit Register */}
            <div className="ledger-timeline-container">
                <div className="timeline-header-bar">
                    <div>
                        <h3 className="timeline-title">{viewMode === 'datewise' ? 'Date-Wise Stock Ledger' : 'Audit Register'}</h3>
                        <span className="timeline-subtitle">
                            {viewMode === 'datewise' 
                                ? 'Consolidated one row per calendar date with opening balance, purchases, sales, and closing balance' 
                                : 'Grouped day-by-day with chronological audit verification'}
                        </span>
                    </div>
                    <div className="ledger-view-switcher">
                        <button 
                            type="button"
                            className={`view-switch-btn ${viewMode === 'datewise' ? 'active' : ''}`}
                            onClick={() => setViewMode('datewise')}
                            id="tab-view-datewise"
                        >
                            <Calendar size={14} />
                            <span>Date-Wise Ledger (1 Row / Date)</span>
                        </button>
                        <button 
                            type="button"
                            className={`view-switch-btn ${viewMode === 'detailed' ? 'active' : ''}`}
                            onClick={() => setViewMode('detailed')}
                            id="tab-view-detailed"
                        >
                            <SlidersHorizontal size={14} />
                            <span>Detailed Audit Register</span>
                        </button>
                    </div>
                </div>

                {viewMode === 'datewise' ? (
                    dateWiseRows.length === 0 ? (
                        <div className="timeline-empty-card">
                            <EmptyState 
                                icon={FileText} 
                                title="No Movements Matching Filters" 
                                description="Adjust your selection period or movement type filter to check other ledger dates." 
                            />
                        </div>
                    ) : (
                        <div className="datewise-table-wrapper">
                            <table className="datewise-ledger-table">
                                <thead>
                                    <tr>
                                        <th style={{ width: '18%', textAlign: 'left' }}>Date</th>
                                        <th style={{ width: '16%', textAlign: 'right' }}>Opening Balance</th>
                                        <th style={{ width: '26%', textAlign: 'left' }}>Dealer Name</th>
                                        <th style={{ width: '13%', textAlign: 'right' }}>Purchase</th>
                                        <th style={{ width: '13%', textAlign: 'right' }}>Sold</th>
                                        <th style={{ width: '14%', textAlign: 'right' }}>Closing Balance</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {dateWiseRows.map((row) => (
                                        <tr key={row.dateKey} className="datewise-row">
                                            <td className="cell-date" style={{ textAlign: 'left' }}>
                                                <div className="date-cell-content">
                                                    <Calendar size={14} className="date-icon" />
                                                    <span>{row.date}</span>
                                                </div>
                                            </td>
                                            <td className="cell-num cell-opening" style={{ textAlign: 'right' }}>
                                                <strong>{row.formattedOpening}</strong>
                                            </td>
                                            <td className="cell-dealer" style={{ textAlign: 'left' }}>
                                                {row.dealerName || ''}
                                            </td>
                                            <td className="cell-num cell-purchase" style={{ textAlign: 'right' }}>
                                                {row.purchase > 0 ? (
                                                    <span className="qty-badge purchase">+{row.formattedPurchase}</span>
                                                ) : (
                                                    <span className="qty-zero">{row.formattedPurchase}</span>
                                                )}
                                            </td>
                                            <td className="cell-num cell-sold" style={{ textAlign: 'right' }}>
                                                {row.sold > 0 ? (
                                                    <span className="qty-badge sold">-{row.formattedSold}</span>
                                                ) : (
                                                    <span className="qty-zero">{row.formattedSold}</span>
                                                )}
                                            </td>
                                            <td className="cell-num cell-closing" style={{ textAlign: 'right' }}>
                                                <strong>{row.formattedClosing}</strong>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                                <tfoot>
                                    <tr className="datewise-summary-footer">
                                        <td className="cell-date" style={{ textAlign: 'left' }}>
                                            <strong>Period Summary ({filterRange.label})</strong>
                                        </td>
                                        <td className="cell-num" style={{ textAlign: 'right' }}>
                                            <strong>{periodSummary.openingStock} {baseUnit}</strong>
                                        </td>
                                        <td className="cell-dealer" style={{ textAlign: 'left' }}></td>
                                        <td className="cell-num" style={{ textAlign: 'right' }}>
                                            <strong className="text-success">+{periodSummary.periodPurchased} {baseUnit}</strong>
                                        </td>
                                        <td className="cell-num" style={{ textAlign: 'right' }}>
                                            <strong className="text-danger">-{periodSummary.periodSold} {baseUnit}</strong>
                                        </td>
                                        <td className="cell-num" style={{ textAlign: 'right' }}>
                                            <strong className="text-primary">{periodSummary.closingStock} {baseUnit}</strong>
                                        </td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    )
                ) : (
                    <>
                        {paginatedGroupedDays.length === 0 ? (
                            <div className="timeline-empty-card">
                                <EmptyState 
                                    icon={FileText} 
                                    title="No Movements Matching Filters" 
                                    description="Adjust your selection period or movement type filter to check other ledger dates." 
                                />
                            </div>
                        ) : (
                            <div className="timeline-days-list">
                                {paginatedGroupedDays.map((dayGroup) => {
                                    const isExpanded = !!expandedDays[dayGroup.date];
                                    
                                    // Fertilizer shop gov sales for this day
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

                                    return (
                                        <div key={dayGroup.date} className="timeline-day-card">
                                            {/* Day Header Row */}
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
                                                            <span className="bullet-summary-item text-info">
                                                                Exchanged: <strong>{dayGroup.exchangedIn - dayGroup.exchangedOut > 0 ? `+${dayGroup.exchangedIn - dayGroup.exchangedOut}` : dayGroup.exchangedIn - dayGroup.exchangedOut}</strong> {dayGroup.unit}
                                                            </span>
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
                                                            🏛 GST Logs ({dayGovSales.length})
                                                        </button>
                                                    )}
                                                </div>
                                                <div className="tdch-right">
                                                    <div className="tdc-final-stock-badge">
                                                        <span className="lbl">DAY'S CLOSING STOCK</span>
                                                        <strong>{dayGroup.finalStock}</strong>
                                                        <span className="unit">{dayGroup.unit}</span>
                                                    </div>
                                                    <button className="tdc-expand-btn" aria-label="Toggle day movements">
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
                                                            {/* Day Accounting Summary widget */}
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

                                                            {/* Desktop Table View */}
                                                            <table className="expanded-desktop-table">
                                                                <thead>
                                                                    <tr>
                                                                        <th>Time</th>
                                                                        <th>Movement Type</th>
                                                                        <th style={{ textAlign: 'right' }}>Quantity</th>
                                                                        <th>Audit Balances</th>
                                                                        <th>Bill / Invoice</th>
                                                                        <th>Source / Contact</th>
                                                                        <th>Notes / Remarks</th>
                                                                    </tr>
                                                                </thead>
                                                                <tbody>
                                                                    {dayGroup.logs.map((log) => {
                                                                        const info = classifyMovement(log);
                                                                        const timeStr = new Date(log.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                                                                        
                                                                        return (
                                                                            <tr key={log._id}>
                                                                                <td>
                                                                                    <div style={{ display: 'flex', alignItems: 'center' }}>
                                                                                        <span className="log-timeline-node" style={{ borderColor: info.color }} />
                                                                                        <span className="log-time">{timeStr}</span>
                                                                                    </div>
                                                                                </td>
                                                                                <td>
                                                                                    <span className="log-badge" style={{ backgroundColor: info.bg, color: info.color, border: `1px solid ${info.border}` }}>
                                                                                        {info.icon} {info.label}
                                                                                    </span>
                                                                                </td>
                                                                                <td style={{ textAlign: 'right', fontWeight: '800', color: info.color }}>
                                                                                    {info.sign}{log.quantity} {log.unit || product.unit}
                                                                                </td>
                                                                                <td>
                                                                                    <div className="log-audit-path-cell">
                                                                                        <div><span className="lbl">Opening:</span> <strong>{log.previousStock}</strong></div>
                                                                                        <div><span className="lbl">Closing:</span> <strong>{log.newStock}</strong></div>
                                                                                    </div>
                                                                                </td>
                                                                                <td>
                                                                                    {log.referenceId ? (
                                                                                        <span 
                                                                                            className="log-ref-link"
                                                                                            onClick={() => handleInvoiceClick(log)}
                                                                                            title="Click to view related transaction"
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

                                                            {/* Mobile Stack View */}
                                                            <div className="expanded-mobile-stack">
                                                                {dayGroup.logs.map((log) => {
                                                                    const info = classifyMovement(log);
                                                                    const timeStr = new Date(log.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                                                                    
                                                                    return (
                                                                        <div key={log._id} className="mobile-log-card">
                                                                            <div className="mlc-header">
                                                                                <span className="mlch-badge" style={{ backgroundColor: info.bg, color: info.color }}>
                                                                                    {info.icon} {info.label}
                                                                                </span>
                                                                                <strong style={{ color: info.color }}>
                                                                                    {info.sign}{log.quantity} {log.unit || product.unit}
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
                            <div style={{ display: 'flex', justifyContent: 'center', marginTop: '20px' }}>
                                <button className="btn-ledger-load-more" onClick={() => setPage(page + 1)}>
                                    Load More Days ({groupedDays.length - paginatedGroupedDays.length} remaining)
                                </button>
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* 6. Dedicated Printable Stock Report (Rendered in DOM, styled for Print and Print Preview) */}
            <div className="printable-stock-report" id="printable-stock-ledger-report">
                <div className="psr-header">
                    <div className="psr-shop-info">
                        <h1 className="psr-shop-name">{shop?.name || 'ShopPulse Store'}</h1>
                        <p className="psr-shop-sub">
                            {shop?.address && <span>{shop.address} • </span>}
                            {shop?.phone && <span>Ph: {shop.phone} • </span>}
                            {shop?.gstNumber && <span>GSTIN: {shop.gstNumber} • </span>}
                            <span>Stock Ledger Report</span>
                        </p>
                    </div>
                    <div className="psr-doc-meta">
                        <span className="psr-badge">STOCK LEDGER</span>
                        <span className="psr-gen-date">Generated: {new Date().toLocaleString('en-IN')}</span>
                    </div>
                </div>

                <div className="psr-meta-grid">
                    <div className="psr-meta-item">
                        <span className="lbl">PRODUCT NAME</span>
                        <strong>{product.name} {product.brand ? `(${product.brand})` : ''}</strong>
                    </div>
                    <div className="psr-meta-item">
                        <span className="lbl">CATEGORY & BASE UNIT</span>
                        <strong>{product.category || 'General'} • Base Unit: {baseUnit}</strong>
                    </div>
                    <div className="psr-meta-item">
                        <span className="lbl">REPORT PERIOD</span>
                        <strong>{filterRange.label}</strong>
                    </div>
                    <div className="psr-meta-item">
                        <span className="lbl">LEDGER ENTRIES</span>
                        <strong>{dateWiseRows.length} Date-Wise Records</strong>
                    </div>
                </div>

                <div className="psr-reconciliation-strip">
                    <div className="psr-recon-box">
                        <span className="lbl">OPENING BALANCE</span>
                        <strong>{periodSummary.openingStock} <small>{baseUnit}</small></strong>
                    </div>
                    <div className="psr-recon-box success">
                        <span className="lbl">TOTAL PURCHASE</span>
                        <strong>+{periodSummary.periodPurchased} <small>{baseUnit}</small></strong>
                    </div>
                    <div className="psr-recon-box danger">
                        <span className="lbl">TOTAL SOLD</span>
                        <strong>-{periodSummary.periodSold} <small>{baseUnit}</small></strong>
                    </div>
                    <div className="psr-recon-box closing">
                        <span className="lbl">CLOSING BALANCE</span>
                        <strong>{periodSummary.closingStock} <small>{baseUnit}</small></strong>
                    </div>
                </div>

                <table className="psr-table">
                    <thead>
                        <tr>
                            <th style={{ width: '18%', textAlign: 'left' }}>Date</th>
                            <th style={{ width: '16%', textAlign: 'right' }}>Opening Balance</th>
                            <th style={{ width: '26%', textAlign: 'left' }}>Dealer Name</th>
                            <th style={{ width: '13%', textAlign: 'right' }}>Purchase</th>
                            <th style={{ width: '13%', textAlign: 'right' }}>Sold</th>
                            <th style={{ width: '14%', textAlign: 'right' }}>Closing Balance</th>
                        </tr>
                    </thead>
                    <tbody>
                        {dateWiseRows.length === 0 ? (
                            <tr>
                                <td colSpan="6" style={{ textAlign: 'center', padding: '24px', color: '#64748B' }}>
                                    No stock movements recorded for the selected period.
                                </td>
                            </tr>
                        ) : (
                            dateWiseRows.map((row) => (
                                <tr key={row.dateKey}>
                                    <td style={{ textAlign: 'left', fontWeight: '600' }}>{row.date}</td>
                                    <td style={{ textAlign: 'right' }}>{row.formattedOpening}</td>
                                    <td style={{ textAlign: 'left', color: '#334155' }}>{row.dealerName || ''}</td>
                                    <td style={{ textAlign: 'right', color: row.purchase > 0 ? '#10B981' : 'inherit', fontWeight: row.purchase > 0 ? '700' : 'normal' }}>
                                        {row.formattedPurchase}
                                    </td>
                                    <td style={{ textAlign: 'right', color: row.sold > 0 ? '#E11D48' : 'inherit', fontWeight: row.sold > 0 ? '700' : 'normal' }}>
                                        {row.formattedSold}
                                    </td>
                                    <td style={{ textAlign: 'right', fontWeight: '800', color: '#071B44' }}>{row.formattedClosing}</td>
                                </tr>
                            ))
                        )}
                    </tbody>
                    {dateWiseRows.length > 0 && (
                        <tfoot>
                            <tr className="psr-summary-row">
                                <td style={{ textAlign: 'left', fontWeight: '800' }}>Total / Period Summary</td>
                                <td style={{ textAlign: 'right', fontWeight: '800' }}>{periodSummary.openingStock} {baseUnit}</td>
                                <td style={{ textAlign: 'left' }}></td>
                                <td style={{ textAlign: 'right', fontWeight: '800', color: '#10B981' }}>+{periodSummary.periodPurchased} {baseUnit}</td>
                                <td style={{ textAlign: 'right', fontWeight: '800', color: '#E11D48' }}>-{periodSummary.periodSold} {baseUnit}</td>
                                <td style={{ textAlign: 'right', fontWeight: '800', color: '#071B44' }}>{periodSummary.closingStock} {baseUnit}</td>
                            </tr>
                        </tfoot>
                    )}
                </table>

                <div className="psr-footer">
                    <div className="psr-footer-left">
                        <p>This is a computer-generated Date-Wise Stock Ledger Report from ShopPulse.</p>
                        <p>Consolidated daily stock movements reconciled against database records.</p>
                    </div>
                    <div className="psr-footer-right">
                        <div className="psr-sig-line"></div>
                        <p>Authorized Signature / Stamp</p>
                    </div>
                </div>
            </div>

            {/* 7. Dedicated Print Preview Modal */}
            <AnimatePresence>
                {showPrintModal && (
                    <div className="print-modal-overlay" onClick={() => setShowPrintModal(false)}>
                        <motion.div 
                            initial={{ opacity: 0, scale: 0.95, y: 15 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 15 }}
                            transition={{ duration: 0.2 }}
                            className="print-modal-content"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="pmm-header">
                                <div className="pmm-title-group">
                                    <h3>Print Stock Ledger Report</h3>
                                    <div className="pmm-badges">
                                        <span className="pmm-badge product">{product.name}</span>
                                        <span className="pmm-badge period">{filterRange.label}</span>
                                        <span className="pmm-badge records">{dateWiseRows.length} dates</span>
                                    </div>
                                </div>
                                <div className="pmm-actions">
                                    <button 
                                        className="btn-print-modal-primary" 
                                        onClick={triggerBrowserPrint}
                                        id="btn-print-now-dialog"
                                    >
                                        <Printer size={16} />
                                        <span>Print Now</span>
                                    </button>
                                    <button 
                                        className="btn-print-modal-close" 
                                        onClick={() => setShowPrintModal(false)}
                                    >
                                        <X size={18} />
                                    </button>
                                </div>
                            </div>

                            <div className="pmm-body">
                                <div className="print-paper-canvas">
                                    {/* Paper preview of dedicated printable report */}
                                    <div className="paper-page-view">
                                        <div className="psr-header">
                                            <div className="psr-shop-info">
                                                <h1 className="psr-shop-name">{shop?.name || 'ShopPulse Store'}</h1>
                                                <p className="psr-shop-sub">
                                                    {shop?.address && <span>{shop.address} • </span>}
                                                    {shop?.phone && <span>Ph: {shop.phone} • </span>}
                                                    {shop?.gstNumber && <span>GSTIN: {shop.gstNumber} • </span>}
                                                    <span>Stock Ledger Report</span>
                                                </p>
                                            </div>
                                            <div className="psr-doc-meta">
                                                <span className="psr-badge">STOCK LEDGER</span>
                                                <span className="psr-gen-date">Generated: {new Date().toLocaleString('en-IN')}</span>
                                            </div>
                                        </div>

                                        <div className="psr-meta-grid">
                                            <div className="psr-meta-item">
                                                <span className="lbl">PRODUCT NAME</span>
                                                <strong>{product.name} {product.brand ? `(${product.brand})` : ''}</strong>
                                            </div>
                                            <div className="psr-meta-item">
                                                <span className="lbl">CATEGORY & BASE UNIT</span>
                                                <strong>{product.category || 'General'} • Base Unit: {baseUnit}</strong>
                                            </div>
                                            <div className="psr-meta-item">
                                                <span className="lbl">REPORT PERIOD</span>
                                                <strong>{filterRange.label}</strong>
                                            </div>
                                            <div className="psr-meta-item">
                                                <span className="lbl">LEDGER ENTRIES</span>
                                                <strong>{dateWiseRows.length} Date-Wise Records</strong>
                                            </div>
                                        </div>

                                        <div className="psr-reconciliation-strip">
                                            <div className="psr-recon-box">
                                                <span className="lbl">OPENING BALANCE</span>
                                                <strong>{periodSummary.openingStock} <small>{baseUnit}</small></strong>
                                            </div>
                                            <div className="psr-recon-box success">
                                                <span className="lbl">TOTAL PURCHASE</span>
                                                <strong>+{periodSummary.periodPurchased} <small>{baseUnit}</small></strong>
                                            </div>
                                            <div className="psr-recon-box danger">
                                                <span className="lbl">TOTAL SOLD</span>
                                                <strong>-{periodSummary.periodSold} <small>{baseUnit}</small></strong>
                                            </div>
                                            <div className="psr-recon-box closing">
                                                <span className="lbl">CLOSING BALANCE</span>
                                                <strong>{periodSummary.closingStock} <small>{baseUnit}</small></strong>
                                            </div>
                                        </div>

                                        <table className="psr-table">
                                            <thead>
                                                <tr>
                                                    <th style={{ width: '18%', textAlign: 'left' }}>Date</th>
                                                    <th style={{ width: '16%', textAlign: 'right' }}>Opening Balance</th>
                                                    <th style={{ width: '26%', textAlign: 'left' }}>Dealer Name</th>
                                                    <th style={{ width: '13%', textAlign: 'right' }}>Purchase</th>
                                                    <th style={{ width: '13%', textAlign: 'right' }}>Sold</th>
                                                    <th style={{ width: '14%', textAlign: 'right' }}>Closing Balance</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {dateWiseRows.length === 0 ? (
                                                    <tr>
                                                        <td colSpan="6" style={{ textAlign: 'center', padding: '24px', color: '#64748B' }}>
                                                            No stock movements recorded for the selected period.
                                                        </td>
                                                    </tr>
                                                ) : (
                                                    dateWiseRows.map((row) => (
                                                        <tr key={row.dateKey}>
                                                            <td style={{ textAlign: 'left', fontWeight: '600' }}>{row.date}</td>
                                                            <td style={{ textAlign: 'right' }}>{row.formattedOpening}</td>
                                                            <td style={{ textAlign: 'left', color: '#334155' }}>{row.dealerName || ''}</td>
                                                            <td style={{ textAlign: 'right', color: row.purchase > 0 ? '#10B981' : 'inherit', fontWeight: row.purchase > 0 ? '700' : 'normal' }}>
                                                                {row.formattedPurchase}
                                                            </td>
                                                            <td style={{ textAlign: 'right', color: row.sold > 0 ? '#E11D48' : 'inherit', fontWeight: row.sold > 0 ? '700' : 'normal' }}>
                                                                {row.formattedSold}
                                                            </td>
                                                            <td style={{ textAlign: 'right', fontWeight: '800', color: '#071B44' }}>{row.formattedClosing}</td>
                                                        </tr>
                                                    ))
                                                )}
                                            </tbody>
                                            {dateWiseRows.length > 0 && (
                                                <tfoot>
                                                    <tr className="psr-summary-row">
                                                        <td style={{ textAlign: 'left', fontWeight: '800' }}>Total / Period Summary</td>
                                                        <td style={{ textAlign: 'right', fontWeight: '800' }}>{periodSummary.openingStock} {baseUnit}</td>
                                                        <td style={{ textAlign: 'left' }}></td>
                                                        <td style={{ textAlign: 'right', fontWeight: '800', color: '#10B981' }}>+{periodSummary.periodPurchased} {baseUnit}</td>
                                                        <td style={{ textAlign: 'right', fontWeight: '800', color: '#E11D48' }}>-{periodSummary.periodSold} {baseUnit}</td>
                                                        <td style={{ textAlign: 'right', fontWeight: '800', color: '#071B44' }}>{periodSummary.closingStock} {baseUnit}</td>
                                                    </tr>
                                                </tfoot>
                                            )}
                                        </table>

                                        <div className="psr-footer">
                                            <div className="psr-footer-left">
                                                <p>This is a computer-generated Date-Wise Stock Ledger Report from ShopPulse.</p>
                                                <p>Consolidated daily stock movements reconciled against database records.</p>
                                            </div>
                                            <div className="psr-footer-right">
                                                <div className="psr-sig-line"></div>
                                                <p>Authorized Signature / Stamp</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            <style jsx="true">{`
                .stock-ledger-page {
                    padding: 16px;
                    display: flex;
                    flex-direction: column;
                    gap: 16px;
                    background: #F8FAFC;
                    min-height: 100vh;
                    font-family: inherit;
                }

                .stock-ledger-loading-state {
                    display: flex;
                    flex-direction: column;
                    padding: 40px;
                    gap: 20px;
                }

                .ledger-empty-wrap {
                    padding: 60px 20px;
                    text-align: center;
                }

                /* Header Actions */
                .ledger-action-bar {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    flex-wrap: wrap;
                }

                .btn-action-outline {
                    display: inline-flex;
                    align-items: center;
                    gap: 6px;
                    height: 38px;
                    padding: 0 14px;
                    background: white;
                    border: 1.5px solid #E2E8F0;
                    color: #1E293B;
                    font-size: 13px;
                    font-weight: 700;
                    border-radius: 9px;
                    cursor: pointer;
                    transition: all 0.15s ease;
                }
                .btn-action-outline:hover {
                    background: #F1F5F9;
                    border-color: #CBD5E1;
                    color: #0F172A;
                }

                .btn-action-primary {
                    display: inline-flex;
                    align-items: center;
                    gap: 6px;
                    height: 38px;
                    padding: 0 16px;
                    background: #2563EB;
                    border: 1.5px solid #2563EB;
                    color: white;
                    font-size: 13px;
                    font-weight: 700;
                    border-radius: 9px;
                    cursor: pointer;
                    transition: all 0.15s ease;
                    box-shadow: 0 1px 3px rgba(37, 99, 235, 0.2);
                }
                .btn-action-primary:hover {
                    background: #1D4ED8;
                    border-color: #1D4ED8;
                }

                .btn-action-nav-back {
                    display: inline-flex;
                    align-items: center;
                    gap: 6px;
                    height: 38px;
                    padding: 0 12px;
                    background: #F1F5F9;
                    border: 1.5px solid transparent;
                    color: #475569;
                    font-size: 13px;
                    font-weight: 700;
                    border-radius: 9px;
                    cursor: pointer;
                    transition: all 0.15s ease;
                }
                .btn-action-nav-back:hover {
                    background: #E2E8F0;
                    color: #0F172A;
                }

                /* Offline Banner */
                .offline-notice-banner {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    background: #FFFBEB;
                    border: 1.5px solid #FDE68A;
                    color: #92400E;
                    padding: 10px 16px;
                    border-radius: 12px;
                    font-size: 13px;
                    font-weight: 600;
                }

                /* Product Summary Card */
                .product-summary-card {
                    background: white;
                    border: 1px solid #E2E8F0;
                    border-radius: 18px;
                    padding: 18px 22px;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    gap: 20px;
                    box-shadow: 0 2px 5px rgba(0, 0, 0, 0.02);
                }
                .psc-left {
                    display: flex;
                    flex-direction: column;
                    gap: 8px;
                }
                .psc-title-row {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    flex-wrap: wrap;
                }
                .psc-product-name {
                    margin: 0;
                    font-size: 24px;
                    font-weight: 900;
                    color: #0F172A;
                    letter-spacing: -0.02em;
                }
                .psc-brand-pill {
                    font-size: 11px;
                    font-weight: 800;
                    color: #2563EB;
                    background: #EFF6FF;
                    border: 1px solid #DBEAFE;
                    padding: 2px 8px;
                    border-radius: 6px;
                    text-transform: uppercase;
                }
                .psc-metadata-row {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    flex-wrap: wrap;
                    font-size: 12.5px;
                    font-weight: 600;
                    color: #64748B;
                }
                .psc-meta-tag {
                    display: inline-flex;
                    align-items: center;
                    gap: 5px;
                    padding: 3px 9px;
                    border-radius: 6px;
                    background: #F1F5F9;
                    color: #475569;
                    font-weight: 700;
                }
                .psc-meta-tag.last-purchase {
                    background: #FEF3C7;
                    color: #92400E;
                    border: 1px solid #FDE68A;
                }
                .psc-meta-tag.last-purchase strong {
                    font-weight: 900;
                    color: #78350F;
                }
                .psc-meta-tag.transaction-time {
                    background: #F8FAFC;
                    color: #64748B;
                    border: 1px solid #E2E8F0;
                }
                .psc-right {
                    flex-shrink: 0;
                }
                .available-stock-showcase {
                    background: #F8FAFC;
                    border: 1.5px solid #F1F5F9;
                    padding: 10px 20px;
                    border-radius: 14px;
                    text-align: right;
                    min-width: 140px;
                }
                .ass-label {
                    font-size: 10px;
                    font-weight: 800;
                    color: #94A3B8;
                    text-transform: uppercase;
                    letter-spacing: 0.05em;
                }
                .ass-value-row {
                    display: flex;
                    align-items: baseline;
                    justify-content: flex-end;
                    gap: 5px;
                    margin-top: 2px;
                }
                .ass-value-row strong {
                    font-size: 26px;
                    font-weight: 900;
                    line-height: 1;
                }
                .ass-value-row strong.healthy { color: #10B981; }
                .ass-value-row strong.low { color: #F59E0B; }
                .ass-value-row strong.out { color: #EF4444; }
                .ass-unit {
                    font-size: 12px;
                    font-weight: 700;
                    color: #64748B;
                }

                /* 5 KPI Cards Responsive Grid */
                .ledger-metrics-grid {
                    display: grid;
                    grid-template-columns: repeat(5, minmax(0, 1fr));
                    gap: 12px;
                }
                .metric-kpi-card {
                    background: white;
                    border: 1px solid #E2E8F0;
                    border-radius: 14px;
                    padding: 14px;
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.01);
                    min-height: 74px;
                    box-sizing: border-box;
                }
                .mkc-icon {
                    width: 40px;
                    height: 40px;
                    border-radius: 10px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    flex-shrink: 0;
                }
                .mkc-icon.neutral { background: #F1F5F9; color: #475569; }
                .mkc-icon.danger { background: #FEF2F2; color: #EF4444; }
                .mkc-icon.warning { background: #FFFBEB; color: #F59E0B; }
                .mkc-icon.success { background: #ECFDF5; color: #10B981; }
                .mkc-icon.info { background: #EFF6FF; color: #2563EB; }

                .mkc-content {
                    display: flex;
                    flex-direction: column;
                    gap: 1px;
                    min-width: 0;
                }
                .mkc-title {
                    font-size: 10px;
                    font-weight: 800;
                    color: #94A3B8;
                    text-transform: uppercase;
                    letter-spacing: 0.04em;
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                }
                .mkc-val {
                    font-size: 16px;
                    font-weight: 900;
                    color: #0F172A;
                    line-height: 1.2;
                    white-space: nowrap;
                }
                .mkc-val small {
                    font-size: 11px;
                    font-weight: 700;
                    color: #64748B;
                }
                .mkc-val.text-danger { color: #EF4444; }
                .mkc-val.text-warning { color: #D97706; }
                .mkc-val.text-success { color: #10B981; }
                .mkc-val.text-info { color: #2563EB; }
                .mkc-sub {
                    font-size: 10.5px;
                    color: #94A3B8;
                    font-weight: 600;
                    white-space: nowrap;
                }

                /* Filter Bar */
                .ledger-filter-card {
                    background: white;
                    border: 1px solid #E2E8F0;
                    border-radius: 16px;
                    padding: 14px 18px;
                    display: flex;
                    flex-direction: column;
                    gap: 12px;
                    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.01);
                }
                .lfc-controls-row {
                    display: flex;
                    gap: 12px;
                    flex-wrap: wrap;
                    align-items: flex-end;
                }
                .lfc-select-group {
                    flex: 1;
                    min-width: 170px;
                    display: flex;
                    flex-direction: column;
                    gap: 4px;
                }
                .lfc-select-group label {
                    font-size: 10.5px;
                    font-weight: 800;
                    color: #64748B;
                    text-transform: uppercase;
                    letter-spacing: 0.03em;
                }
                .lfc-date-group {
                    flex: 1;
                    min-width: 150px;
                    display: flex;
                    flex-direction: column;
                    gap: 4px;
                }

                .lfc-status-strip {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    flex-wrap: wrap;
                    padding-top: 8px;
                    border-top: 1px dashed #F1F5F9;
                }
                .active-period-badge,
                .active-filter-badge,
                .active-count-badge {
                    display: inline-flex;
                    align-items: center;
                    gap: 5px;
                    font-size: 11.5px;
                    font-weight: 600;
                    color: #475569;
                    background: #F8FAFC;
                    border: 1px solid #E2E8F0;
                    padding: 3px 8px;
                    border-radius: 6px;
                }
                .active-period-badge {
                    color: #1E40AF;
                    background: #EFF6FF;
                    border-color: #DBEAFE;
                }
                .active-period-badge strong {
                    color: #1D4ED8;
                }
                .active-count-badge {
                    margin-left: auto;
                    color: #065F46;
                    background: #ECFDF5;
                    border-color: #A7F3D0;
                }

                /* Timeline Container */
                .ledger-timeline-container {
                    display: flex;
                    flex-direction: column;
                    gap: 12px;
                }
                .timeline-header-bar {
                    display: flex;
                    align-items: baseline;
                    gap: 10px;
                    margin-top: 4px;
                }
                .timeline-title {
                    margin: 0;
                    font-size: 16px;
                    font-weight: 900;
                    color: #0F172A;
                    text-transform: uppercase;
                    letter-spacing: 0.03em;
                }
                .timeline-subtitle {
                    font-size: 12px;
                    color: #64748B;
                    font-weight: 600;
                }
                .timeline-empty-card {
                    background: white;
                    border: 1px solid #E2E8F0;
                    border-radius: 16px;
                    padding: 36px;
                }
                .timeline-days-list {
                    display: flex;
                    flex-direction: column;
                    gap: 10px;
                }

                /* Timeline Day Card */
                .timeline-day-card {
                    background: white;
                    border: 1px solid #E2E8F0;
                    border-radius: 14px;
                    overflow: hidden;
                    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.01);
                }
                .tdc-header {
                    padding: 14px 18px;
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
                    gap: 12px;
                    flex-wrap: wrap;
                    flex: 1;
                }
                .tdc-date {
                    font-size: 14.5px;
                    font-weight: 900;
                    color: #0F172A;
                    white-space: nowrap;
                }
                .tdc-bullets-summary {
                    display: flex;
                    gap: 6px;
                    flex-wrap: wrap;
                }
                .bullet-summary-item {
                    font-size: 11px;
                    font-weight: 700;
                    padding: 2px 7px;
                    border-radius: 5px;
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

                .btn-view-gov-logs {
                    display: inline-flex;
                    align-items: center;
                    gap: 4px;
                    font-size: 11px;
                    font-weight: 700;
                    padding: 3px 8px;
                    border-radius: 5px;
                    background: #F0FDF4;
                    color: #166534;
                    border: 1px solid #86EFAC;
                    cursor: pointer;
                    transition: all 0.15s ease;
                }
                .btn-view-gov-logs:hover {
                    background: #DCFCE7;
                    border-color: #4ADE80;
                }

                .tdch-right {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    margin-left: auto;
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
                    padding: 5px 12px;
                    border-radius: 8px;
                    text-align: right;
                    min-width: 110px;
                }
                .tdc-final-stock-badge .lbl {
                    font-size: 8px;
                    font-weight: 850;
                    color: #166534;
                    letter-spacing: 0.04em;
                }
                .tdc-final-stock-badge strong {
                    font-size: 16px;
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

                /* Expanded Panel */
                .tdc-expanded-panel {
                    border-top: 1px solid #F1F5F9;
                    background: #FCFDFE;
                }
                .panel-inner-scroll {
                    padding: 14px 18px;
                }

                .day-accounting-summary-block {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(110px, 1fr));
                    gap: 10px;
                    margin-bottom: 16px;
                    background: #F8FAFC;
                    border: 1px solid #E2E8F0;
                    border-radius: 10px;
                    padding: 10px;
                }
                .das-box {
                    display: flex;
                    flex-direction: column;
                    gap: 2px;
                    padding: 6px 10px;
                    border-radius: 6px;
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
                .das-box.closing .das-label { color: #1D4ED8; }
                .das-box.closing .das-value { color: #1E3A8A; }

                .das-label {
                    font-size: 9.5px;
                    font-weight: 700;
                    color: #94A3B8;
                    text-transform: uppercase;
                    letter-spacing: 0.02em;
                }
                .das-value {
                    font-size: 15px;
                    font-weight: 850;
                    color: #1E293B;
                }
                .unit-text {
                    font-size: 10px;
                    font-weight: 600;
                    color: #64748B;
                }

                /* Desktop Table inside Day */
                .expanded-desktop-table {
                    width: 100%;
                    border-collapse: collapse;
                    text-align: left;
                    font-size: 12.5px;
                }
                .expanded-desktop-table th {
                    color: #94A3B8;
                    font-weight: 800;
                    text-transform: uppercase;
                    font-size: 9.5px;
                    letter-spacing: 0.04em;
                    padding: 7px 10px;
                    border-bottom: 1.5px solid #F1F5F9;
                }
                .expanded-desktop-table td {
                    padding: 10px;
                    border-bottom: 1px solid #F8FAFC;
                    vertical-align: middle;
                    color: #334155;
                }
                .log-time {
                    font-weight: 700;
                    color: #64748B;
                    font-size: 12px;
                }
                .log-timeline-node {
                    width: 8px;
                    height: 8px;
                    border-radius: 50%;
                    border: 2px solid #CBD5E1;
                    background: white;
                    margin-right: 8px;
                    display: inline-block;
                    flex-shrink: 0;
                }
                .log-badge {
                    font-size: 10.5px;
                    font-weight: 800;
                    padding: 3px 8px;
                    border-radius: 5px;
                    display: inline-flex;
                    align-items: center;
                    gap: 5px;
                }
                .log-audit-path-cell {
                    display: flex;
                    flex-direction: column;
                    gap: 1px;
                    font-size: 11px;
                }
                .log-audit-path-cell .lbl {
                    font-size: 9px;
                    font-weight: 700;
                    color: #94A3B8;
                    text-transform: uppercase;
                }
                .log-audit-path-cell strong {
                    font-weight: 800;
                    color: #334155;
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
                    color: #1E293B;
                }
                .log-notes {
                    color: #64748B;
                    font-style: italic;
                    max-width: 180px;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    white-space: nowrap;
                    display: inline-block;
                }

                /* Mobile Stack View */
                .expanded-mobile-stack {
                    display: none;
                    flex-direction: column;
                    gap: 10px;
                    margin-top: 8px;
                }
                .mobile-log-card {
                    background: white;
                    border: 1px solid #F1F5F9;
                    border-radius: 10px;
                    padding: 10px;
                    display: flex;
                    flex-direction: column;
                    gap: 6px;
                }
                .mlc-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                }
                .mlch-badge {
                    font-size: 10px;
                    font-weight: 800;
                    padding: 2px 6px;
                    border-radius: 4px;
                }
                .mlc-body {
                    display: flex;
                    flex-direction: column;
                    gap: 3px;
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
                    padding: 4px 6px;
                    border-radius: 4px;
                    color: #64748B;
                    font-style: italic;
                    margin-top: 2px;
                }
                .mlc-footer {
                    display: flex;
                    justify-content: flex-end;
                    font-size: 10.5px;
                    color: #94A3B8;
                    font-weight: 600;
                    border-top: 1px dashed #F1F5F9;
                    padding-top: 4px;
                }

                .btn-ledger-load-more {
                    height: 40px;
                    padding: 0 20px;
                    background: white;
                    border: 1.5px solid #E2E8F0;
                    color: #334155;
                    font-weight: 700;
                    font-size: 13px;
                    border-radius: 99px;
                    cursor: pointer;
                    box-shadow: 0 1px 3px rgba(0,0,0,0.02);
                    transition: 0.15s;
                }
                .btn-ledger-load-more:hover {
                    background: #F8FAFC;
                    border-color: #CBD5E1;
                }

                /* Printable Stock Report DOM (Hidden on screen, styled for @media print) */
                .printable-stock-report {
                    display: none;
                }

                /* Print Modal Overlay & Preview */
                .print-modal-overlay {
                    position: fixed;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    background: rgba(15, 23, 42, 0.7);
                    backdrop-filter: blur(4px);
                    z-index: 9999;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    padding: 20px;
                }
                .print-modal-content {
                    background: #0F172A;
                    border-radius: 20px;
                    width: 100%;
                    max-width: 1100px;
                    height: 92vh;
                    display: flex;
                    flex-direction: column;
                    overflow: hidden;
                    box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
                }
                .pmm-header {
                    padding: 16px 24px;
                    background: #1E293B;
                    border-bottom: 1px solid #334155;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    flex-shrink: 0;
                }
                .pmm-title-group {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    flex-wrap: wrap;
                }
                .pmm-title-group h3 {
                    margin: 0;
                    font-size: 17px;
                    font-weight: 800;
                    color: white;
                }
                .pmm-badges {
                    display: flex;
                    gap: 8px;
                    align-items: center;
                }
                .pmm-badge {
                    font-size: 11px;
                    font-weight: 700;
                    padding: 2px 8px;
                    border-radius: 6px;
                }
                .pmm-badge.product { background: #3B82F6; color: white; }
                .pmm-badge.period { background: #334155; color: #E2E8F0; }
                .pmm-badge.records { background: #10B981; color: white; }

                .pmm-actions {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                }
                .btn-print-modal-primary {
                    display: inline-flex;
                    align-items: center;
                    gap: 6px;
                    height: 38px;
                    padding: 0 18px;
                    background: #2563EB;
                    color: white;
                    border: none;
                    border-radius: 8px;
                    font-size: 13px;
                    font-weight: 700;
                    cursor: pointer;
                    transition: 0.15s;
                    box-shadow: 0 2px 4px rgba(37, 99, 235, 0.3);
                }
                .btn-print-modal-primary:hover {
                    background: #1D4ED8;
                }
                .btn-print-modal-close {
                    width: 38px;
                    height: 38px;
                    border-radius: 8px;
                    background: #334155;
                    border: none;
                    color: #94A3B8;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    cursor: pointer;
                    transition: 0.15s;
                }
                .btn-print-modal-close:hover {
                    background: #475569;
                    color: white;
                }

                .pmm-body {
                    flex: 1;
                    overflow-y: auto;
                    background: #475569;
                    padding: 24px;
                    display: flex;
                    justify-content: center;
                }
                /* View Switcher */
                .ledger-view-switcher {
                    display: inline-flex;
                    align-items: center;
                    background: #F1F5F9;
                    padding: 3px;
                    border-radius: 10px;
                    border: 1px solid #E2E8F0;
                    gap: 3px;
                }
                .view-switch-btn {
                    display: inline-flex;
                    align-items: center;
                    gap: 6px;
                    padding: 6px 14px;
                    border-radius: 7px;
                    border: none;
                    background: transparent;
                    color: #64748B;
                    font-size: 12.5px;
                    font-weight: 700;
                    cursor: pointer;
                    transition: all 0.15s ease;
                }
                .view-switch-btn:hover {
                    color: #1E293B;
                }
                .view-switch-btn.active {
                    background: white;
                    color: #2563EB;
                    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
                }

                /* Date-Wise Table on screen */
                .datewise-table-wrapper {
                    background: white;
                    border: 1px solid #E2E8F0;
                    border-radius: 14px;
                    overflow-x: auto;
                    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.02);
                }
                .datewise-ledger-table {
                    width: 100%;
                    border-collapse: collapse;
                    font-size: 13px;
                }
                .datewise-ledger-table th {
                    background: #F8FAFC;
                    color: #475569;
                    font-size: 11px;
                    font-weight: 800;
                    text-transform: uppercase;
                    letter-spacing: 0.05em;
                    padding: 12px 18px;
                    border-bottom: 1.5px solid #E2E8F0;
                }
                .datewise-ledger-table td {
                    padding: 13px 18px;
                    border-bottom: 1px solid #F1F5F9;
                    color: #1E293B;
                    vertical-align: middle;
                }
                .datewise-ledger-table tbody tr:hover {
                    background: #F8FAFC;
                }
                .datewise-ledger-table tbody tr:last-child td {
                    border-bottom: none;
                }
                .date-cell-content {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    font-weight: 700;
                    color: #0F172A;
                }
                .date-icon {
                    color: #2563EB;
                    flex-shrink: 0;
                }
                .cell-num {
                    font-variant-numeric: tabular-nums;
                }
                .cell-opening strong {
                    color: #334155;
                    font-weight: 700;
                }
                .cell-closing strong {
                    color: #071B44;
                    font-weight: 800;
                }
                .cell-dealer {
                    color: #334155;
                    font-weight: 600;
                    font-size: 13px;
                    line-height: 1.4;
                    word-break: break-word;
                }
                .qty-badge {
                    display: inline-block;
                    padding: 2px 8px;
                    border-radius: 6px;
                    font-weight: 800;
                    font-size: 12.5px;
                }
                .qty-badge.purchase {
                    background: #ECFDF5;
                    color: #059669;
                    border: 1px solid #A7F3D0;
                }
                .qty-badge.sold {
                    background: #FFF1F2;
                    color: #E11D48;
                    border: 1px solid #FECDD3;
                }
                .qty-zero {
                    color: #94A3B8;
                    font-weight: 500;
                }
                .datewise-summary-footer {
                    background: #F8FAFC;
                    border-top: 2px solid #CBD5E1;
                }
                .datewise-summary-footer td {
                    padding: 13px 18px;
                    border-bottom: none;
                    font-size: 13px;
                }
                .text-success { color: #059669 !important; }
                .text-danger { color: #E11D48 !important; }
                .text-primary { color: #071B44 !important; }

                .print-paper-canvas {
                    width: 100%;
                    max-width: 820px;
                    background: white;
                    border-radius: 6px;
                    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
                    padding: 28px;
                    box-sizing: border-box;
                    color: #0F172A;
                }
                .paper-page-view {
                    display: flex;
                    flex-direction: column;
                    gap: 16px;
                }

                /* Structured Printable Report Styles (Shared by Preview & Print) */
                .psr-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: flex-start;
                    border-bottom: 2px solid #071B44;
                    padding-bottom: 12px;
                }
                .psr-shop-name {
                    margin: 0;
                    font-size: 22px;
                    font-weight: 900;
                    color: #071B44;
                    letter-spacing: -0.02em;
                }
                .psr-shop-sub {
                    margin: 4px 0 0 0;
                    font-size: 11px;
                    color: #64748B;
                    font-weight: 600;
                }
                .psr-doc-meta {
                    display: flex;
                    flex-direction: column;
                    align-items: flex-end;
                    gap: 4px;
                }
                .psr-badge {
                    font-size: 11px;
                    font-weight: 850;
                    color: #2563EB;
                    background: #EFF6FF;
                    border: 1px solid #BFDBFE;
                    padding: 3px 8px;
                    border-radius: 4px;
                    letter-spacing: 0.05em;
                }
                .psr-gen-date {
                    font-size: 10px;
                    color: #64748B;
                    font-weight: 600;
                }

                .psr-meta-grid {
                    display: grid;
                    grid-template-columns: repeat(4, 1fr);
                    gap: 10px;
                    background: #F8FAFC;
                    border: 1px solid #E2E8F0;
                    border-radius: 8px;
                    padding: 10px 14px;
                }
                .psr-meta-item {
                    display: flex;
                    flex-direction: column;
                    gap: 2px;
                }
                .psr-meta-item .lbl {
                    font-size: 9px;
                    font-weight: 800;
                    color: #64748B;
                    text-transform: uppercase;
                    letter-spacing: 0.04em;
                }
                .psr-meta-item strong {
                    font-size: 12px;
                    color: #0F172A;
                    font-weight: 800;
                }

                .psr-reconciliation-strip {
                    display: grid;
                    grid-template-columns: repeat(4, 1fr);
                    gap: 8px;
                }
                .psr-recon-box {
                    background: white;
                    border: 1px solid #CBD5E1;
                    border-radius: 6px;
                    padding: 8px 10px;
                    display: flex;
                    flex-direction: column;
                    gap: 2px;
                }
                .psr-recon-box .lbl {
                    font-size: 8.5px;
                    font-weight: 850;
                    color: #64748B;
                    text-transform: uppercase;
                    letter-spacing: 0.03em;
                }
                .psr-recon-box strong {
                    font-size: 14px;
                    font-weight: 900;
                    color: #0F172A;
                }
                .psr-recon-box small {
                    font-size: 9.5px;
                    font-weight: 700;
                    color: #64748B;
                }
                .psr-recon-box.danger strong { color: #DC2626; }
                .psr-recon-box.warning strong { color: #D97706; }
                .psr-recon-box.success strong { color: #16A34A; }
                .psr-recon-box.info strong { color: #2563EB; }
                .psr-recon-box.closing {
                    background: #EFF6FF;
                    border-color: #93C5FD;
                }
                .psr-recon-box.closing .lbl { color: #1D4ED8; }
                .psr-recon-box.closing strong { color: #1E3A8A; }

                .psr-table {
                    width: 100%;
                    border-collapse: collapse;
                    font-size: 11px;
                }
                .psr-table th {
                    background: #071B44;
                    color: white;
                    font-size: 9px;
                    font-weight: 800;
                    text-transform: uppercase;
                    letter-spacing: 0.04em;
                    padding: 8px 10px;
                    border: 1px solid #071B44;
                }
                .psr-table td {
                    padding: 7px 10px;
                    border: 1px solid #E2E8F0;
                    color: #1E293B;
                    font-size: 11px;
                    vertical-align: middle;
                }
                .psr-table tr:nth-child(even) {
                    background: #F8FAFC;
                }
                .psr-summary-row {
                    background: #F1F5F9 !important;
                    border-top: 2px solid #071B44;
                }
                .psr-summary-row td {
                    font-size: 11px;
                    border-top: 2px solid #071B44;
                }

                .psr-footer {
                    display: flex;
                    justify-content: space-between;
                    align-items: flex-end;
                    padding-top: 14px;
                    margin-top: 10px;
                    border-top: 1px dashed #CBD5E1;
                }
                .psr-footer-left p {
                    margin: 0;
                    font-size: 9.5px;
                    color: #64748B;
                    font-weight: 600;
                    line-height: 1.4;
                }
                .psr-footer-right {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    gap: 6px;
                }
                .psr-sig-line {
                    width: 140px;
                    border-bottom: 1.5px solid #64748B;
                }
                .psr-footer-right p {
                    margin: 0;
                    font-size: 9.5px;
                    font-weight: 700;
                    color: #475569;
                }

                /* Print Media Rules */
                @media print {
                    @page {
                        size: A4 portrait;
                        margin: 10mm 12mm;
                    }
                    html, body {
                        background: white !important;
                        color: black !important;
                        margin: 0 !important;
                        padding: 0 !important;
                    }
                    /* Hide entire app UI on print */
                    .stock-ledger-page > *:not(#printable-stock-ledger-report),
                    .print-modal-overlay,
                    .app-sidebar,
                    .navbar,
                    .topbar,
                    header,
                    aside,
                    nav,
                    .premium-page-header {
                        display: none !important;
                    }
                    /* Display only dedicated printable stock report */
                    #printable-stock-ledger-report {
                        display: block !important;
                        position: static !important;
                        width: 100% !important;
                        margin: 0 !important;
                        padding: 0 !important;
                        background: white !important;
                    }
                    .psr-table thead {
                        display: table-header-group !important;
                    }
                    .psr-table tr {
                        page-break-inside: avoid !important;
                    }
                    .psr-reconciliation-strip {
                        page-break-inside: avoid !important;
                    }
                }

                /* Responsive Breakpoints */
                @media (max-width: 1200px) {
                    .ledger-metrics-grid {
                        grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
                    }
                }

                @media (max-width: 1024px) {
                    .expanded-desktop-table {
                        display: none;
                    }
                    .expanded-mobile-stack {
                        display: flex;
                    }
                    .product-summary-card {
                        flex-direction: column;
                        align-items: stretch;
                    }
                    .available-stock-showcase {
                        text-align: left;
                    }
                    .ass-value-row {
                        justify-content: flex-start;
                    }
                }

                @media (max-width: 768px) {
                    .stock-ledger-page {
                        padding: 12px;
                        gap: 12px;
                    }
                    .ledger-action-bar {
                        width: 100%;
                    }
                    .btn-action-outline,
                    .btn-action-primary,
                    .btn-action-nav-back {
                        flex: 1;
                        justify-content: center;
                    }
                    .ledger-metrics-grid {
                        grid-template-columns: repeat(2, 1fr);
                    }
                    .metric-kpi-card:last-child {
                        grid-column: span 2;
                    }
                    .lfc-controls-row {
                        flex-direction: column;
                    }
                    .lfc-select-group,
                    .lfc-date-group {
                        width: 100%;
                    }
                    .tdc-header {
                        padding: 12px;
                    }
                    .tdch-left {
                        flex-direction: column;
                        align-items: flex-start;
                        gap: 6px;
                    }
                    .print-modal-content {
                        height: 96vh;
                    }
                    .pmm-header {
                        flex-direction: column;
                        align-items: stretch;
                        gap: 10px;
                    }
                    .pmm-actions {
                        justify-content: flex-end;
                    }
                }
            `}</style>
        </div>
    );
};

export default StockLedgerPage;
