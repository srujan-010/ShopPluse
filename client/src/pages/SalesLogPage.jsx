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
    ArrowDownCircle,
    Printer,
    FileText,
    Info,
    Undo2,
    RefreshCw,
    RotateCcw,
    TrendingUp,
    Package,
    ShoppingBag,
    Eye
} from 'lucide-react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { saleService, shopService, khataService, productService } from '../services/api';
import { offlineDB } from '../services/offlineDB';
import { motion, AnimatePresence } from 'framer-motion';
import { EmptyState, Skeleton, PageHeader } from '../components/PremiumUI';
import { useScrollLock } from '../hooks/useScrollLock';
import { invoiceService } from '../utils/invoiceService';
import { useToast } from '../context/ToastContext';
import CompactInvoiceSheet from '../components/CompactInvoiceSheet';
import PrintFormatSelector from '../components/PrintFormatSelector';
import { getFormatOption, applyPrintPageStyles } from '../utils/printFormatConstants';

// Compact date formatting: e.g. "18 Oct 2026" (always single line)
const formatDateCompact = (dateVal) => {
    if (!dateVal) return '-';
    const d = new Date(dateVal);
    if (isNaN(d.getTime())) return '-';
    return d.toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
    });
};

// Formats currency consistently using Indian number formatting
const formatINR = (amount, includeDecimals = false) => {
    if (amount === undefined || amount === null || isNaN(amount)) return '₹0';
    const num = Number(amount);
    const sign = num < 0 ? '-' : '';
    const abs = Math.abs(num);
    const formatted = abs.toLocaleString('en-IN', {
        minimumFractionDigits: includeDecimals ? 2 : (abs % 1 !== 0 ? 2 : 0),
        maximumFractionDigits: 2
    });
    return `${sign}₹${formatted}`;
};

// Formats invoice identifier cleanly on a single line
const getInvoiceDisplayNumber = (sale) => {
    if (!sale) return '';
    const raw = sale.invoiceNumber || sale.invoiceNo || (sale._id ? sale._id.slice(-6).toUpperCase() : '');
    if (!raw) return '#-';
    return raw.startsWith('#') ? raw : `#${raw}`;
};

// Resolve row financial metrics (paid, due, payment status, payment mode)
const getSaleRowMetrics = (sale) => {
    const totalAmount = Number(sale.totalAmount || 0);
    const isReturn = sale.type === 'RETURN';
    const isExchange = sale.type === 'EXCHANGE';

    let paidAmount = 0;
    let dueAmount = 0;

    if (isReturn) {
        paidAmount = sale.totalRefundAmount || Math.abs(totalAmount);
        dueAmount = 0;
    } else if (isExchange) {
        paidAmount = sale.paidAmount !== undefined ? Number(sale.paidAmount) : (sale.balanceDifference > 0 ? (sale.paymentMethod === 'Khata' ? 0 : sale.balanceDifference) : 0);
        dueAmount = sale.remainingAmount !== undefined ? Number(sale.remainingAmount) : (sale.balanceDifference > 0 && sale.paymentMethod === 'Khata' ? sale.balanceDifference : 0);
    } else {
        if (sale.paidAmount !== undefined && sale.paidAmount !== null) {
            paidAmount = Number(sale.paidAmount);
        } else {
            paidAmount = (sale.paymentStatus === 'Paid' || (!sale.paymentStatus && sale.paymentMethod !== 'Khata')) ? totalAmount : 0;
        }

        if (sale.remainingAmount !== undefined && sale.remainingAmount !== null) {
            dueAmount = Number(sale.remainingAmount);
        } else {
            dueAmount = Math.max(0, totalAmount - paidAmount);
        }
    }

    // Payment Status badge
    let statusBadge = { label: 'Paid', className: 'paid' };
    if (isReturn) {
        statusBadge = { label: 'Refunded', className: 'refunded' };
    } else if (sale.paymentStatus) {
        const s = sale.paymentStatus.toLowerCase();
        if (s === 'paid') statusBadge = { label: 'Paid', className: 'paid' };
        else if (s === 'partial') statusBadge = { label: 'Partial', className: 'partial' };
        else statusBadge = { label: 'Unpaid', className: 'unpaid' };
    } else if (dueAmount === 0) {
        statusBadge = { label: 'Paid', className: 'paid' };
    } else if (paidAmount > 0) {
        statusBadge = { label: 'Partial', className: 'partial' };
    } else {
        statusBadge = { label: 'Unpaid', className: 'unpaid' };
    }

    // Payment Mode badge
    const methodStr = (sale.paymentMethod || sale.paymentMode || 'Cash').toUpperCase();
    let modeBadge = { label: 'Cash', className: 'cash' };
    if (methodStr === 'UPI') modeBadge = { label: 'UPI', className: 'upi' };
    else if (methodStr === 'KHATA') modeBadge = { label: 'Khata', className: 'khata' };
    else if (methodStr === 'CARD') modeBadge = { label: 'Card', className: 'card' };

    return {
        totalAmount,
        paidAmount,
        dueAmount,
        statusBadge,
        modeBadge,
        isReturn,
        isExchange
    };
};

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
    const [secondSaleForInvoice, setSecondSaleForInvoice] = useState(null);
    const [selectedBatchBillIds, setSelectedBatchBillIds] = useState([]);
    const [invoiceLoading, setInvoiceLoading] = useState(false);
    const [printFormatOverride, setPrintFormatOverride] = useState(null);
    const itemsPerPage = 20;

    const activePrintFormat = printFormatOverride || shop?.defaultPrintFormat || 'full_a4';

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

    const getDynamicFinancials = (sale) => {
        if (!sale) return { originalSale: 0, returnedAmount: 0, netSale: 0, netProfit: 0 };
        const originalSale = sale.totalAmount || 0;
        let returnedAmount = 0;
        let netSale = originalSale;
        let netProfit = sale.totalProfit || 0;

        sales.forEach(tx => {
            if (tx.originalSale === sale._id) {
                if (tx.type === 'RETURN') {
                    returnedAmount += tx.totalRefundAmount;
                    netSale -= tx.totalRefundAmount;
                    if (tx.totalProfit !== undefined && tx.totalProfit !== 0) {
                        netProfit += tx.totalProfit;
                    } else {
                        let profitLoss = 0;
                        (tx.items || []).forEach(item => {
                            const saleItem = (sale.items || []).find(si => si.product === item.product);
                            if (saleItem && saleItem.soldQtyBaseUnit > 0) {
                                const profitPerBase = (saleItem.profit || 0) / saleItem.soldQtyBaseUnit;
                                profitLoss += item.quantity * profitPerBase;
                            }
                        });
                        netProfit -= profitLoss;
                    }
                } else if (tx.type === 'EXCHANGE') {
                    returnedAmount += tx.totalReturnedValue;
                    netSale += tx.balanceDifference;
                    if (tx.totalProfit !== undefined && tx.totalProfit !== 0) {
                        netProfit += tx.totalProfit;
                    } else {
                        let returnedProfit = 0;
                        (tx.returnedItems || []).forEach(item => {
                            const saleItem = (sale.items || []).find(si => si.product === item.product);
                            if (saleItem && saleItem.soldQtyBaseUnit > 0) {
                                const profitPerBase = (saleItem.profit || 0) / saleItem.soldQtyBaseUnit;
                                returnedProfit += item.quantity * profitPerBase;
                            }
                        });
                        netProfit -= returnedProfit;
                    }
                }
            }
        });

        return {
            originalSale,
            returnedAmount,
            netSale: Math.max(0, netSale),
            netProfit
        };
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
            const [localSales, localGovSales, localShops] = await Promise.all([
                offlineDB.getSales(shopId),
                offlineDB.getGovSales(shopId),
                offlineDB.getShops()
            ]);
            
            const activeShop = (localShops || []).find(s => s._id === shopId);
            if (activeShop) setShop(activeShop);

            // Merge local standalone gov sales if not linked
            const combinedLocal = [...(localSales || [])];
            const localIds = new Set(combinedLocal.map(s => s._id));
            (localGovSales || []).forEach(g => {
                if (!g.linkedSaleId && !localIds.has(g._id)) {
                    combinedLocal.push({
                        ...g,
                        type: 'GOV_SALE',
                        totalProfit: g.totalProfit || 0,
                        paidAmount: g.totalAmount,
                        remainingAmount: 0,
                        paymentStatus: 'Paid'
                    });
                }
            });

            if (combinedLocal.length > 0) {
                setSales(combinedLocal);
                setLoading(false);
            }

            const [salesRes, shopsRes, productsRes] = await Promise.all([
                saleService.getAll(shopId),
                shopService.getAll(),
                productService.getAll(shopId).catch(() => ({ data: { data: [] } }))
            ]);
            setSales(salesRes.data?.data || []);
            if (shopsRes.data?.data) {
                setShop(shopsRes.data.data.find(s => s._id === shopId));
            }
            if (productsRes?.data?.data) {
                setShopProducts(productsRes.data.data);
            }
        } catch (err) {
            console.error('Error fetching initial data:', err);
        } finally {
            setLoading(false);
        }
    };
    const handleViewBill = async (saleOrId, pairedSaleOrId = null) => {
        if (!saleOrId) return;

        const saleId = (saleOrId && typeof saleOrId === 'object') ? saleOrId._id : saleOrId;
        const initialSale = (saleOrId && typeof saleOrId === 'object') ? saleOrId : (saleId ? sales.find(s => s._id === saleId) : null);

        const pairedId = (pairedSaleOrId && typeof pairedSaleOrId === 'object') ? pairedSaleOrId._id : pairedSaleOrId;
        const initialPaired = (pairedSaleOrId && typeof pairedSaleOrId === 'object') ? pairedSaleOrId : (pairedId ? sales.find(s => s._id === pairedId) : null);

        // Close details modal
        setSelectedSale(null);

        // Pre-populate immediately so there is zero flash or race condition
        if (initialSale) {
            setSelectedSaleForInvoice(initialSale);
        }
        setSecondSaleForInvoice(initialPaired || null);
        setIsInvoiceOpen(true);
        setInvoiceLoading(false);

        // Now asynchronously fetch full populated details in background
        try {
            let fullSale = initialSale;
            if (initialSale?.type !== 'GOV_SALE' && saleId) {
                try {
                    const res = await saleService.getSale(saleId);
                    if (res?.data?.data) {
                        fullSale = res.data.data;
                        setSelectedSaleForInvoice(fullSale);
                    }
                } catch (e) {
                    console.warn('Backend full sale fetch fallback:', e);
                }
            }

            if (pairedId) {
                let fullSecond = initialPaired;
                if (initialPaired?.type !== 'GOV_SALE') {
                    try {
                        const res2 = await saleService.getSale(pairedId);
                        if (res2?.data?.data) {
                            fullSecond = res2.data.data;
                            setSecondSaleForInvoice(fullSecond);
                        }
                    } catch (e) {
                        console.warn('Backend full second sale fetch fallback:', e);
                    }
                }
            }
        } catch (err) {
            console.error('Failed to fetch full bill details:', err);
        }
    };

    const handleDownloadPDF = (targetSale) => {
        const saleToPrint = targetSale || selectedSaleForInvoice || selectedSale;
        if (!saleToPrint) return;
        const invoiceType = saleToPrint.type === 'GOV_SALE' ? 'GOV_SALE' : 'SALE';
        if (secondSaleForInvoice && activePrintFormat === 'half_a4') {
            invoiceService.downloadInvoice(saleToPrint, shop, invoiceType, { 
                secondBill: secondSaleForInvoice, 
                products: shopProducts,
                format: activePrintFormat
            });
        } else {
            invoiceService.downloadInvoice(saleToPrint, shop, invoiceType, { 
                products: shopProducts,
                format: activePrintFormat 
            });
        }
    };

    const handleShareWhatsApp = (targetSale) => {
        const saleToShare = targetSale || selectedSaleForInvoice || selectedSale;
        if (!saleToShare) return;
        const invoiceType = saleToShare.type === 'GOV_SALE' ? 'GOV_SALE' : 'SALE';
        const opts = { 
            products: shopProducts,
            format: activePrintFormat 
        };
        if (secondSaleForInvoice && activePrintFormat === 'half_a4') {
            opts.secondBill = secondSaleForInvoice;
        }
        invoiceService.shareInvoice(saleToShare, shop, invoiceType, opts);
    };

    const handleToggleSelectBill = (id, e) => {
        if (e) e.stopPropagation();
        setSelectedBatchBillIds(prev => 
            prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
        );
    };

    const handleBatchPrint = () => {
        if (selectedBatchBillIds.length === 0) return;
        if (selectedBatchBillIds.length === 1) {
            handleViewBill(selectedBatchBillIds[0]);
        } else {
            handleViewBill(selectedBatchBillIds[0], selectedBatchBillIds[1]);
        }
    };

    const handleBatchDownloadPDF = () => {
        if (selectedBatchBillIds.length === 0) return;
        const selectedSales = sales.filter(s => selectedBatchBillIds.includes(s._id));
        invoiceService.downloadInvoice(selectedSales, shop);
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
            matchesPeriod = saleDate.getFullYear() === now.getFullYear() &&
                            saleDate.getMonth() === now.getMonth();
        } else if (periodFilter === 'custom') {
            const target = new Date(customDate);
            matchesPeriod = saleDate.getFullYear() === target.getFullYear() &&
                            saleDate.getMonth() === target.getMonth() &&
                            saleDate.getDate() === target.getDate();
        }

        const matchesSearch = searchQuery === '' || 
            (sale.customerName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
            (sale.invoiceNumber || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
            (sale.totalAmount != null ? sale.totalAmount.toString() : '').includes(searchQuery);

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
            />

            {/* Unified Compact Summary Stat Cards */}
            <div className="sl-summary-grid-unified">
                <div className="sl-stat-card-v4">
                    <div className="sl-stat-top">
                        <span className="sl-stat-label">Total Sales</span>
                        <div className="sl-stat-icon-wrap sales"><Wallet size={15} /></div>
                    </div>
                    <strong className="sl-stat-val">{formatINR(totalAmount)}</strong>
                </div>
                <div className="sl-stat-card-v4">
                    <div className="sl-stat-top">
                        <span className="sl-stat-label">Orders</span>
                        <div className="sl-stat-icon-wrap orders"><Receipt size={15} /></div>
                    </div>
                    <strong className="sl-stat-val">{totalOrders.toLocaleString('en-IN')}</strong>
                </div>
                <div className="sl-stat-card-v4">
                    <div className="sl-stat-top">
                        <span className="sl-stat-label">Profit</span>
                        <div className="sl-stat-icon-wrap profit"><TrendingUp size={15} /></div>
                    </div>
                    <strong className="sl-stat-val profit-val">{formatINR(Math.round(totalProfit))}</strong>
                </div>
                <div className="sl-stat-card-v4">
                    <div className="sl-stat-top">
                        <span className="sl-stat-label">Items</span>
                        <div className="sl-stat-icon-wrap items"><Package size={15} /></div>
                    </div>
                    <strong className="sl-stat-val">{totalItems.toLocaleString('en-IN')}</strong>
                </div>
            </div>

            {/* Unified Filters Bar */}
            <div className="sl-controls-v4">
                <div className="sl-search-v4">
                    <Search size={18} color="#94A3B8" />
                    <input 
                        type="text" 
                        placeholder="Search by customer, amount, or bill #..." 
                        value={searchQuery}
                        onChange={(e) => { setSearchQuery(e.target.value); setPage(1); }}
                    />
                    {searchQuery && (
                        <button 
                            type="button" 
                            className="sl-search-clear" 
                            onClick={() => { setSearchQuery(''); setPage(1); }}
                            title="Clear search"
                        >
                            <X size={15} />
                        </button>
                    )}
                </div>

                <div className="sl-filters-scroll-group">
                    <div className="sl-pills-row date-pills">
                        {[
                            { id: 'today', label: 'Today' },
                            { id: 'yesterday', label: 'Yesterday' },
                            { id: 'week', label: '7D' },
                            { id: 'month', label: 'Month' },
                        ].map(p => (
                            <button 
                                key={p.id} 
                                className={`sl-pill-v4 ${periodFilter === p.id ? 'active' : ''}`}
                                onClick={() => { setPeriodFilter(p.id); setPage(1); }}
                            >
                                {p.label}
                            </button>
                        ))}
                        <button 
                            className={`sl-pill-v4 cal-pill ${periodFilter === 'custom' ? 'active' : ''}`}
                            onClick={() => { setPeriodFilter('custom'); setPage(1); }}
                            title="Select custom date"
                        >
                            <Calendar size={14} />
                        </button>
                    </div>

                    <div className="sl-pills-divider" />

                    <div className="sl-pills-row payment-pills">
                        {['All', 'Cash', 'UPI', 'Khata'].map(p => (
                            <button 
                                key={p} 
                                className={`sl-pill-v4 ${paymentFilter === p ? 'active' : ''}`}
                                onClick={() => { setPaymentFilter(p); setPage(1); }}
                            >
                                {p}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {periodFilter === 'custom' && (
                <div className="sl-custom-date-v4">
                    <label><Calendar size={14} /> Custom Date:</label>
                    <input 
                        type="date" 
                        value={customDate} 
                        onChange={(e) => { setCustomDate(e.target.value); setPage(1); }} 
                    />
                </div>
            )}

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
                    {/* Mobile Transaction Cards */}
                    <div className="sl-list sl-mobile-only">
                        {paginatedSales.map((sale) => {
                            const displayInvoice = getInvoiceDisplayNumber(sale);
                            const dateFormatted = formatDateCompact(sale.date);
                            const { paidAmount, dueAmount, statusBadge, modeBadge } = getSaleRowMetrics(sale);

                            return (
                                <motion.div 
                                    whileTap={{ scale: 0.99 }}
                                    key={sale._id} 
                                    className="sl-card-premium"
                                    onClick={() => setSelectedSale(sale)}
                                >
                                    <div className="sl-card-top">
                                        <div className="sl-card-top-left">
                                            <span className="invoice-badge-v4">{displayInvoice}</span>
                                            <span className={`mode-pill mode-${modeBadge.className}`}>{modeBadge.label}</span>
                                        </div>
                                        <div className="sl-card-total-wrap">
                                            <span className={`sl-card-total ${sale.type === 'RETURN' ? 'negative' : ''}`}>
                                                {sale.type === 'RETURN' ? '-' : ''}{formatINR(Math.abs(sale.totalAmount || 0))}
                                            </span>
                                            <ChevronRight size={16} color="#98A2B3" />
                                        </div>
                                    </div>

                                    <div className="sl-card-mid">
                                        <div className="sl-card-cust-name" title={sale.customerName || 'Walk-in Customer'}>
                                            {sale.customerName || 'Walk-in Customer'}
                                            {sale.customerMobile && <span className="sl-card-cust-phone">({sale.customerMobile})</span>}
                                        </div>
                                        <div className="sl-card-date-line">
                                            <Calendar size={13} color="#64748B" />
                                            <span>{dateFormatted}</span>
                                        </div>
                                    </div>

                                    <div className="sl-card-bot">
                                        <div className="sl-card-fin-row">
                                            <div className="sl-card-status-col">
                                                <span className={`status-pill status-${statusBadge.className}`}>
                                                    <span className="status-dot"></span>
                                                    {statusBadge.label}
                                                </span>
                                            </div>
                                            <div className="sl-card-amt-pills">
                                                <span className="sl-card-paid">Paid: {formatINR(paidAmount)}</span>
                                                {dueAmount > 0 ? (
                                                    <span className="sl-card-due-alert">Due: {formatINR(dueAmount)}</span>
                                                ) : (
                                                    <span className="sl-card-due-zero">Due: ₹0</span>
                                                )}
                                            </div>
                                        </div>

                                        <div className="sl-card-actions" onClick={(e) => e.stopPropagation()}>
                                            <button 
                                                type="button"
                                                className="sl-action-icon-btn view"
                                                onClick={() => handleViewBill(sale)}
                                                title="View Bill Details"
                                                aria-label="View Bill"
                                            >
                                                <Receipt size={13} />
                                                <span>Bill</span>
                                            </button>
                                            {(sale.type === 'SALE' || !sale.type) && (
                                                <>
                                                    <button 
                                                        type="button"
                                                        className="sl-action-icon-btn return"
                                                        onClick={() => handleOpenReturnModal(sale)}
                                                        title="Process Return"
                                                        aria-label="Return Items"
                                                    >
                                                        <Undo2 size={13} />
                                                        <span>Return</span>
                                                    </button>
                                                    <button 
                                                        type="button"
                                                        className="sl-action-icon-btn exchange"
                                                        onClick={() => handleOpenExchangeModal(sale)}
                                                        title="Process Exchange"
                                                        aria-label="Exchange Items"
                                                    >
                                                        <RefreshCw size={12} />
                                                        <span>Exchange</span>
                                                    </button>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                </motion.div>
                            );
                        })}
                    </div>

                    {/* Redesigned Desktop Sales History Table */}
                    <div className="sl-desktop-only radical-desktop-container">
                        <div className="rdc-header">
                            <div className="rdch-left">
                                <h3>Sales History</h3>
                                <p>{filteredSales.length} Transactions Found</p>
                            </div>
                            <div className="rdch-right">
                                <span className="rdch-stat">Total: <strong>{formatINR(filteredSales.reduce((acc, s) => acc + (s.totalAmount || 0), 0))}</strong></span>
                            </div>
                        </div>
                        <div className="table-responsive-wrapper">
                            <table className="radical-desktop-table">
                                <thead>
                                    <tr>
                                        <th className="th-checkbox">
                                            <input 
                                                type="checkbox"
                                                checked={paginatedSales.length > 0 && paginatedSales.every(s => selectedBatchBillIds.includes(s._id))}
                                                onChange={(e) => {
                                                    if (e.target.checked) {
                                                        setSelectedBatchBillIds(paginatedSales.map(s => s._id));
                                                    } else {
                                                        setSelectedBatchBillIds([]);
                                                    }
                                                }}
                                                title="Select all bills for 2-on-1 A4 printing"
                                                style={{ cursor: 'pointer', width: '16px', height: '16px' }}
                                            />
                                        </th>
                                        <th className="th-invoice">Invoice No.</th>
                                        <th className="th-customer">Customer</th>
                                        <th className="th-date">Date</th>
                                        <th className="th-mode">Payment Mode</th>
                                        <th className="th-status">Payment Status</th>
                                        <th className="th-total">Total Amount</th>
                                        <th className="th-paid">Paid</th>
                                        <th className="th-due">Due</th>
                                        <th className="th-actions">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {paginatedSales.map((sale) => {
                                        const displayInvoice = getInvoiceDisplayNumber(sale);
                                        const dateFormatted = formatDateCompact(sale.date);
                                        const { paidAmount, dueAmount, statusBadge, modeBadge } = getSaleRowMetrics(sale);

                                        return (
                                            <tr key={sale._id} className="sl-desktop-row" onClick={() => setSelectedSale(sale)}>
                                                <td className="sld-checkbox" onClick={(e) => e.stopPropagation()}>
                                                    <input 
                                                        type="checkbox"
                                                        checked={selectedBatchBillIds.includes(sale._id)}
                                                        onChange={(e) => handleToggleSelectBill(sale._id, e)}
                                                        style={{ cursor: 'pointer', width: '16px', height: '16px' }}
                                                    />
                                                </td>
                                                <td className="sld-invoice">
                                                    <span className="invoice-badge-v4" title={displayInvoice}>{displayInvoice}</span>
                                                </td>
                                                <td className="sld-customer">
                                                    <div className="cust-cell-content">
                                                        <div className="cust-name-text" title={sale.customerName || 'Walk-in Customer'}>
                                                            {sale.customerName || 'Walk-in Customer'}
                                                        </div>
                                                        {sale.customerMobile && (
                                                            <div className="cust-phone-sub" title={sale.customerMobile}>
                                                                {sale.customerMobile}
                                                            </div>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="sld-date">
                                                    <span className="date-compact-text">{dateFormatted}</span>
                                                </td>
                                                <td className="sld-mode">
                                                    <span className={`mode-pill mode-${modeBadge.className}`}>
                                                        {modeBadge.label}
                                                    </span>
                                                </td>
                                                <td className="sld-status">
                                                    <span className={`status-pill status-${statusBadge.className}`}>
                                                        <span className="status-dot"></span>
                                                        {statusBadge.label}
                                                    </span>
                                                </td>
                                                <td className="sld-total">
                                                    <span className={`total-amount-val ${sale.type === 'RETURN' ? 'negative' : ''}`}>
                                                        {sale.type === 'RETURN' ? '-' : ''}{formatINR(Math.abs(sale.totalAmount || 0))}
                                                    </span>
                                                </td>
                                                <td className="sld-paid">
                                                    <span className="paid-amount-val">
                                                        {formatINR(paidAmount)}
                                                    </span>
                                                </td>
                                                <td className="sld-due">
                                                    {dueAmount > 0 ? (
                                                        <span className="due-amount-warning">{formatINR(dueAmount)}</span>
                                                    ) : (
                                                        <span className="due-amount-zero">₹0</span>
                                                    )}
                                                </td>
                                                <td className="sld-actions" onClick={(e) => e.stopPropagation()}>
                                                    <div className="compact-actions-row">
                                                        <button 
                                                            type="button"
                                                            className="sl-action-icon-btn view" 
                                                            onClick={() => handleViewBill(sale)}
                                                            title="View Bill Details"
                                                            aria-label="View Bill"
                                                        >
                                                            <Receipt size={13} />
                                                            <span>Bill</span>
                                                        </button>
                                                        {(sale.type === 'SALE' || !sale.type) && (
                                                            <>
                                                                <button 
                                                                    type="button"
                                                                    className="sl-action-icon-btn return" 
                                                                    onClick={() => handleOpenReturnModal(sale)}
                                                                    title="Process Return"
                                                                    aria-label="Return Items"
                                                                >
                                                                    <Undo2 size={13} />
                                                                    <span>Return</span>
                                                                </button>
                                                                <button 
                                                                    type="button"
                                                                    className="sl-action-icon-btn exchange" 
                                                                    onClick={() => handleOpenExchangeModal(sale)}
                                                                    title="Process Exchange"
                                                                    aria-label="Exchange Items"
                                                                >
                                                                    <RefreshCw size={12} />
                                                                    <span>Exchange</span>
                                                                </button>
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
                    </div>
                </>
            )}

            {filteredSales.length > paginatedSales.length && (
                <button className="sl-load-more" onClick={() => setPage(p => p + 1)}>
                    Load More Transactions
                </button>
            )}

            {/* Floating Batch Bar for Multi-Bill 2-on-1 A4 Printing */}
            <AnimatePresence>
                {selectedBatchBillIds.length > 0 && (
                    <motion.div 
                        initial={{ opacity: 0, y: 30 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 30 }}
                        className="sl-floating-batch-bar no-print"
                    >
                        <div className="fbb-info">
                            <span className="fbb-count">{selectedBatchBillIds.length}</span>
                            <span>{selectedBatchBillIds.length === 1 ? 'bill selected' : 'bills selected for 2-on-1 A4 printing'}</span>
                        </div>
                        <div className="fbb-actions">
                            <button className="fbb-btn fbb-print" onClick={handleBatchPrint}>
                                <Printer size={15} />
                                <span>{selectedBatchBillIds.length >= 2 ? 'Print 2 Bills on 1 Sheet' : 'Print Selected Bill (Half-A4)'}</span>
                            </button>
                            <button className="fbb-btn fbb-download" onClick={handleBatchDownloadPDF}>
                                <FileText size={15} />
                                <span>Download 2-Up PDF</span>
                            </button>
                            <button className="fbb-btn fbb-clear" onClick={() => setSelectedBatchBillIds([])}>
                                Clear
                            </button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

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
                                            const financials = getDynamicFinancials(selectedSale);
                                            return (
                                                <>
                                                    <div className="rs-row">
                                                        <span>Original Sale</span>
                                                        <span>₹{financials.originalSale.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                                    </div>
                                                    <div className="rs-row" style={{ color: financials.returnedAmount > 0 ? '#b91c1c' : '#64748b' }}>
                                                        <span>Returned Amount</span>
                                                        <span>- ₹{financials.returnedAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                                    </div>
                                                    <div className="rs-row grand">
                                                        <span>Net Sale</span>
                                                        <strong>₹{financials.netSale.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
                                                    </div>
                                                    <div className="rs-row" style={{ paddingTop: '8px', borderTop: '1px dashed #E2E8F0', marginTop: '4px' }}>
                                                        <span>Net Profit</span>
                                                        <strong style={{ color: financials.netProfit >= 0 ? '#10b981' : '#b91c1c' }}>₹{financials.netProfit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
                                                    </div>
                                                    <div className="rs-row" style={{ paddingTop: '8px', borderTop: '1px dashed #E2E8F0', marginTop: '4px' }}>
                                                        <span>Paid Amount</span>
                                                        <span style={{ color: '#067647', fontWeight: 600 }}>₹{(selectedSale.paidAmount || selectedSale.totalAmount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                                    </div>
                                                    <div className="rs-row">
                                                        <span>Due Amount</span>
                                                        <span style={{ color: selectedSale.remainingAmount > 0 ? '#B45309' : '#64748B', fontWeight: 600 }}>₹{(selectedSale.remainingAmount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                                    </div>
                                                    <div className="rs-row">
                                                        <span>Payment Status</span>
                                                        <span className={`status-badge-new ${(selectedSale.paymentStatus || 'Paid').toLowerCase()}`} style={{ padding: '2px 8px', fontSize: '11px', borderRadius: '6px' }}>
                                                            {selectedSale.paymentStatus === 'Paid' ? '🟢 Paid' : selectedSale.paymentStatus === 'Partial' ? '🟡 Partial' : '🔴 Unpaid'}
                                                        </span>
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
                                <button className="r-btn r-btn-primary" onClick={() => handleViewBill(selectedSale)}>
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
                            {invoiceLoading ? (
                                <div className="khata-loader"><div className="spinner"></div></div>
                            ) : !selectedSaleForInvoice ? (
                                <div className="ips-error">Bill details could not be found.</div>
                            ) : (
                                <CompactInvoiceSheet 
                                    bill1={selectedSaleForInvoice}
                                    bill2={secondSaleForInvoice}
                                    shop={shop}
                                    products={shopProducts}
                                    format={activePrintFormat}
                                    availableBills={sales}
                                    onSelectSecondBill={async (second) => {
                                        if (!second) {
                                            setSecondSaleForInvoice(null);
                                            return;
                                        }
                                        setSecondSaleForInvoice(second);
                                        if (second._id && second.type !== 'GOV_SALE') {
                                            try {
                                                const res = await saleService.getSale(second._id);
                                                if (res?.data?.data) {
                                                    setSecondSaleForInvoice(res.data.data);
                                                }
                                            } catch (err) {
                                                console.warn('Could not fetch full second sale:', err);
                                            }
                                        }
                                    }}
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
                                            const multiplier = Number(item.multiplier) || 1;
                                            const baseQty = (item.soldQtyBaseUnit !== undefined && item.soldQtyBaseUnit !== null)
                                                ? Number(item.soldQtyBaseUnit)
                                                : (Number(item.soldQtyEntered || item.quantity || 0) * multiplier);
                                            const rawMax = (baseQty - alreadyRet) / multiplier;
                                            const maxReturnable = isNaN(rawMax) ? Math.max(0, Number(item.soldQtyEntered || item.quantity || 0)) : Math.max(0, rawMax);

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
                                    <button type="submit" className="sl-btn-action return" style={{ color: 'white', background: '#EF4444', display: 'flex', alignItems: 'center', gap: '6px', justifyContent: 'center' }} disabled={isReturnSubmitting}>
                                        {isReturnSubmitting ? (
                                            <>
                                                <div className="spinner-mini" style={{ width: '16px', height: '16px', border: '2px solid white', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.6s linear infinite' }}></div>
                                                <span>Processing Transaction...</span>
                                            </>
                                        ) : 'Confirm Return'}
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
                                                const multiplier = Number(item.multiplier) || 1;
                                                const baseQty = (item.soldQtyBaseUnit !== undefined && item.soldQtyBaseUnit !== null)
                                                    ? Number(item.soldQtyBaseUnit)
                                                    : (Number(item.soldQtyEntered || item.quantity || 0) * multiplier);
                                                const rawMax = (baseQty - alreadyRet) / multiplier;
                                                const maxReturnable = isNaN(rawMax) ? Math.max(0, Number(item.soldQtyEntered || item.quantity || 0)) : Math.max(0, rawMax);

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
                                    <button type="submit" className="sl-btn-action exchange" style={{ color: 'white', background: '#EA580C', display: 'flex', alignItems: 'center', gap: '6px', justifyContent: 'center' }} disabled={isExchangeSubmitting}>
                                        {isExchangeSubmitting ? (
                                            <>
                                                <div className="spinner-mini" style={{ width: '16px', height: '16px', border: '2px solid white', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.6s linear infinite' }}></div>
                                                <span>Processing Transaction...</span>
                                            </>
                                        ) : 'Confirm Exchange'}
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
                @keyframes spin {
                    to { transform: rotate(360deg); }
                }
                .spinner-mini {
                    animation: spin 0.6s linear infinite;
                }
                .status-badge-new { display: inline-flex; align-items: center; gap: 4px; padding: 4px 10px; border-radius: 8px; font-size: 12px; font-weight: 700; }
                .status-badge-new.paid { background: #ECFDF5; color: #067647; border: 1px solid #ABEFC6; }
                .status-badge-new.partial { background: #FFFBEB; color: #B45309; border: 1px solid #FCD34D; }
                .status-badge-new.unpaid { background: #FEF3F2; color: #B42318; border: 1px solid #FECDCA; }
                .sales-log-v3 { display: flex; flex-direction: column; gap: 16px; padding: 16px; }
                @media (min-width: 1024px) {
                    .sales-log-v3 { padding: 24px 36px; gap: 20px; }
                }

                /* Unified Summary Grid */
                .sl-summary-grid-unified {
                    display: grid;
                    grid-template-columns: repeat(2, 1fr);
                    gap: 12px;
                    width: 100%;
                }
                @media (min-width: 1024px) {
                    .sl-summary-grid-unified {
                        grid-template-columns: repeat(4, 1fr);
                        gap: 14px;
                    }
                }
                .sl-stat-card-v4 {
                    background: white;
                    border: 1.5px solid #e2e8f0;
                    border-radius: 14px;
                    padding: 14px 16px;
                    display: flex;
                    flex-direction: column;
                    justify-content: space-between;
                    min-height: 80px;
                    box-sizing: border-box;
                    box-shadow: 0 2px 6px rgba(0,0,0,0.02);
                    transition: transform 0.15s ease, box-shadow 0.15s ease;
                }
                .sl-stat-card-v4:hover {
                    transform: translateY(-1px);
                    box-shadow: 0 4px 12px rgba(0,0,0,0.05);
                }
                .sl-stat-top {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                }
                .sl-stat-label {
                    font-size: 11px;
                    font-weight: 800;
                    color: #64748b;
                    text-transform: uppercase;
                    letter-spacing: 0.05em;
                }
                .sl-stat-icon-wrap {
                    width: 28px;
                    height: 28px;
                    border-radius: 7px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }
                .sl-stat-icon-wrap.sales { background: #eff6ff; color: #2563eb; }
                .sl-stat-icon-wrap.orders { background: #f8fafc; color: #475569; }
                .sl-stat-icon-wrap.profit { background: #ecfdf5; color: #16a34a; }
                .sl-stat-icon-wrap.items { background: #fff7ed; color: #ea580c; }
                .sl-stat-val {
                    font-size: 21px;
                    font-weight: 900;
                    color: #0f172a;
                    letter-spacing: -0.02em;
                    margin-top: 6px;
                }
                .sl-stat-val.profit-val {
                    color: #16a34a;
                }

                /* Controls & Filters Bar */
                .sl-controls-v4 {
                    display: flex;
                    flex-direction: column;
                    gap: 12px;
                    width: 100%;
                }
                @media (min-width: 1024px) {
                    .sl-controls-v4 {
                        flex-direction: row;
                        align-items: center;
                        gap: 16px;
                    }
                }
                .sl-search-v4 {
                    height: 40px;
                    background: white;
                    border: 1.5px solid #e2e8f0;
                    border-radius: 10px;
                    display: flex;
                    align-items: center;
                    padding: 0 12px;
                    gap: 8px;
                    box-sizing: border-box;
                    flex: 1;
                    min-width: 240px;
                }
                @media (min-width: 1024px) {
                    .sl-search-v4 {
                        max-width: 360px;
                    }
                }
                .sl-search-v4 input {
                    border: none;
                    outline: none;
                    flex: 1;
                    font-size: 13.5px;
                    font-weight: 600;
                    background: transparent;
                    color: #1e293b;
                }
                .sl-search-v4 input::placeholder {
                    color: #94a3b8;
                    font-weight: 500;
                }
                .sl-search-clear {
                    background: transparent;
                    border: none;
                    color: #94a3b8;
                    cursor: pointer;
                    padding: 2px;
                    display: flex;
                    align-items: center;
                }
                .sl-search-clear:hover { color: #475569; }

                .sl-filters-scroll-group {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    overflow-x: auto;
                    padding-bottom: 2px;
                    -webkit-overflow-scrolling: touch;
                    flex-shrink: 0;
                }
                .sl-filters-scroll-group::-webkit-scrollbar { display: none; }
                .sl-pills-row {
                    display: flex;
                    align-items: center;
                    gap: 6px;
                    flex-shrink: 0;
                }
                .sl-pills-divider {
                    width: 1px;
                    height: 22px;
                    background: #e2e8f0;
                    flex-shrink: 0;
                    margin: 0 4px;
                }
                .sl-pill-v4 {
                    flex: 0 0 auto;
                    height: 34px;
                    padding: 0 12px;
                    border: 1.5px solid #e2e8f0;
                    background: white;
                    border-radius: 8px;
                    font-size: 12.5px;
                    font-weight: 700;
                    color: #64748b;
                    cursor: pointer;
                    white-space: nowrap;
                    transition: all 0.15s ease;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }
                .sl-pill-v4:hover {
                    border-color: #cbd5e1;
                    color: #1e293b;
                }
                .sl-pill-v4.active {
                    background: #2563eb;
                    color: white;
                    border-color: #2563eb;
                    box-shadow: 0 2px 8px rgba(37, 99, 235, 0.25);
                }
                .sl-pill-v4.cal-pill {
                    padding: 0 10px;
                }

                .sl-custom-date-v4 {
                    display: inline-flex;
                    align-items: center;
                    gap: 8px;
                    background: white;
                    padding: 6px 12px;
                    border-radius: 8px;
                    border: 1.5px solid #e2e8f0;
                    width: fit-content;
                    box-sizing: border-box;
                }
                .sl-custom-date-v4 label {
                    font-size: 12px;
                    font-weight: 700;
                    color: #475569;
                    display: flex;
                    align-items: center;
                    gap: 4px;
                }
                .sl-custom-date-v4 input {
                    border: none;
                    font-size: 13px;
                    font-weight: 700;
                    color: #1e293b;
                    outline: none;
                    background: transparent;
                    cursor: pointer;
                }

                /* Redesigned Sales History Container & Table */
                .radical-desktop-container {
                    background: white;
                    border-radius: 16px;
                    border: 1.5px solid #e2e8f0;
                    box-shadow: 0 4px 16px rgba(0,0,0,0.03);
                    overflow: hidden;
                    width: 100%;
                    margin-top: 4px;
                }
                .rdc-header {
                    padding: 16px 20px;
                    border-bottom: 1.5px solid #f1f5f9;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    background: #fafafa;
                }
                .rdch-left h3 {
                    font-size: 17px;
                    font-weight: 800;
                    color: #0f172a;
                    margin: 0;
                }
                .rdch-left p {
                    font-size: 12.5px;
                    color: #64748b;
                    font-weight: 600;
                    margin-top: 2px;
                }
                .rdch-stat {
                    font-size: 13px;
                    color: #475569;
                    font-weight: 600;
                    background: #f1f5f9;
                    padding: 6px 14px;
                    border-radius: 8px;
                    border: 1px solid #e2e8f0;
                }
                .rdch-stat strong {
                    color: #2563eb;
                    font-weight: 800;
                }

                .table-responsive-wrapper {
                    overflow-x: auto;
                    width: 100%;
                    -webkit-overflow-scrolling: touch;
                }
                .radical-desktop-table {
                    width: 100%;
                    border-collapse: collapse;
                    table-layout: auto;
                }
                .radical-desktop-table th {
                    padding: 12px 10px;
                    font-size: 11px;
                    font-weight: 800;
                    color: #64748b;
                    text-transform: uppercase;
                    letter-spacing: 0.05em;
                    background: #f8fafc;
                    border-bottom: 1.5px solid #e2e8f0;
                    white-space: nowrap;
                }
                .radical-desktop-table td {
                    padding: 11px 10px;
                    font-size: 13px;
                    color: #1e293b;
                    border-bottom: 1px solid #f1f5f9;
                    vertical-align: middle;
                    height: 52px;
                    box-sizing: border-box;
                }
                .sl-desktop-row {
                    cursor: pointer;
                    transition: background 0.12s ease;
                }
                .sl-desktop-row:hover {
                    background: #f8fafc;
                }

                /* Column specific widths & alignments */
                .radical-desktop-table th.th-checkbox, .radical-desktop-table td.sld-checkbox { width: 36px; text-align: center; padding-left: 12px; }
                .radical-desktop-table th.th-invoice, .radical-desktop-table td.sld-invoice { width: 115px; text-align: left; white-space: nowrap; }
                .radical-desktop-table th.th-customer, .radical-desktop-table td.sld-customer { min-width: 125px; max-width: 170px; text-align: left; }
                .radical-desktop-table th.th-date, .radical-desktop-table td.sld-date { width: 95px; text-align: left; white-space: nowrap; }
                .radical-desktop-table th.th-mode, .radical-desktop-table td.sld-mode { width: 85px; text-align: center; }
                .radical-desktop-table th.th-status, .radical-desktop-table td.sld-status { width: 90px; text-align: center; }
                .radical-desktop-table th.th-total, .radical-desktop-table td.sld-total { width: 100px; text-align: right; white-space: nowrap; }
                .radical-desktop-table th.th-paid, .radical-desktop-table td.sld-paid { width: 90px; text-align: right; white-space: nowrap; }
                .radical-desktop-table th.th-due, .radical-desktop-table td.sld-due { width: 85px; text-align: right; white-space: nowrap; }
                .radical-desktop-table th.th-actions, .radical-desktop-table td.sld-actions { width: 180px; min-width: 175px; text-align: right; padding-right: 14px; }

                /* Invoice badge */
                .invoice-badge-v4 {
                    display: inline-block;
                    background: #f1f5f9;
                    color: #1e293b;
                    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
                    font-size: 12px;
                    font-weight: 700;
                    padding: 3px 8px;
                    border-radius: 6px;
                    border: 1px solid #e2e8f0;
                    white-space: nowrap;
                }

                /* Customer cell */
                .cust-cell-content { display: flex; flex-direction: column; gap: 2px; }
                .cust-name-text {
                    font-weight: 700;
                    color: #0f172a;
                    font-size: 13.5px;
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    max-width: 190px;
                }
                .cust-phone-sub {
                    font-size: 11px;
                    color: #64748b;
                    font-weight: 500;
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    max-width: 190px;
                }

                /* Date cell */
                .date-compact-text {
                    font-weight: 600;
                    color: #475569;
                    font-size: 13px;
                    white-space: nowrap;
                }

                /* Payment Mode badges */
                .mode-pill {
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 11px;
                    font-weight: 800;
                    padding: 3px 10px;
                    border-radius: 999px;
                    text-transform: uppercase;
                    letter-spacing: 0.03em;
                    white-space: nowrap;
                }
                .mode-pill.mode-cash { background: #ecfdf5; color: #067647; border: 1px solid #abefc6; }
                .mode-pill.mode-upi { background: #eff6ff; color: #1d4ed8; border: 1px solid #bfdbfe; }
                .mode-pill.mode-khata { background: #fff7ed; color: #c2410c; border: 1px solid #fed7aa; }
                .mode-pill.mode-card { background: #f5f3ff; color: #6d28d9; border: 1px solid #ddd6fe; }

                /* Payment Status badges */
                .status-pill {
                    display: inline-flex;
                    align-items: center;
                    gap: 5px;
                    font-size: 11px;
                    font-weight: 800;
                    padding: 3px 9px;
                    border-radius: 999px;
                    white-space: nowrap;
                }
                .status-pill .status-dot {
                    width: 6px;
                    height: 6px;
                    border-radius: 50%;
                    display: inline-block;
                    flex-shrink: 0;
                }
                .status-pill.status-paid { background: #ecfdf5; color: #067647; border: 1px solid #abefc6; }
                .status-pill.status-paid .status-dot { background: #10b981; }
                .status-pill.status-partial { background: #fffbeb; color: #b45309; border: 1px solid #fcd34d; }
                .status-pill.status-partial .status-dot { background: #f59e0b; }
                .status-pill.status-unpaid { background: #fef2f2; color: #b91c1c; border: 1px solid #fecdca; }
                .status-pill.status-unpaid .status-dot { background: #ef4444; }
                .status-pill.status-refunded { background: #f1f5f9; color: #475569; border: 1px solid #e2e8f0; }
                .status-pill.status-refunded .status-dot { background: #64748b; }

                /* Financial values */
                .total-amount-val { font-size: 13.5px; font-weight: 800; color: #0f172a; white-space: nowrap; }
                .total-amount-val.negative { color: #dc2626; }
                .paid-amount-val { font-size: 13px; font-weight: 700; color: #059669; white-space: nowrap; }
                .due-amount-warning { font-size: 13px; font-weight: 700; color: #d97706; white-space: nowrap; }
                .due-amount-zero { font-size: 12.5px; font-weight: 600; color: #94a3b8; white-space: nowrap; }

                /* Compact action buttons */
                .compact-actions-row {
                    display: inline-flex;
                    align-items: center;
                    justify-content: flex-end;
                    gap: 5px;
                }
                .sl-action-icon-btn {
                    display: inline-flex;
                    align-items: center;
                    gap: 4px;
                    height: 28px;
                    padding: 0 8px;
                    border-radius: 6px;
                    font-size: 11px;
                    font-weight: 700;
                    cursor: pointer;
                    border: 1px solid transparent;
                    transition: all 0.15s ease;
                    white-space: nowrap;
                }
                .sl-action-icon-btn.view { background: #f1f5f9; color: #334155; border-color: #e2e8f0; }
                .sl-action-icon-btn.view:hover { background: #e2e8f0; color: #0f172a; }
                .sl-action-icon-btn.return { background: #fef2f2; color: #dc2626; border-color: #fee2e2; }
                .sl-action-icon-btn.return:hover { background: #fee2e2; color: #b91c1c; }
                .sl-action-icon-btn.exchange { background: #fff7ed; color: #ea580c; border-color: #ffedd5; }
                .sl-action-icon-btn.exchange:hover { background: #ffedd5; color: #c2410c; }

                /* Mobile Card Styles */
                .sl-mobile-only { display: flex; flex-direction: column; gap: 12px; }
                .sl-desktop-only { display: none; }
                @media (min-width: 1024px) {
                    .sl-desktop-only { display: block !important; }
                    .sl-mobile-only { display: none !important; }
                }

                .sl-card-premium {
                    background: white;
                    border: 1.5px solid #e2e8f0;
                    border-radius: 14px;
                    padding: 14px;
                    display: flex;
                    flex-direction: column;
                    gap: 10px;
                    cursor: pointer;
                    width: 100%;
                    box-sizing: border-box;
                    box-shadow: 0 2px 8px rgba(0,0,0,0.02);
                }
                .sl-card-top {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                }
                .sl-card-top-left {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    flex-wrap: nowrap;
                }
                .sl-card-total-wrap {
                    display: flex;
                    align-items: center;
                    gap: 6px;
                }
                .sl-card-total {
                    font-size: 16px;
                    font-weight: 800;
                    color: #0f172a;
                }
                .sl-card-total.negative {
                    color: #dc2626;
                }
                .sl-card-mid {
                    display: flex;
                    justify-content: space-between;
                    align-items: baseline;
                    gap: 8px;
                }
                .sl-card-cust-name {
                    font-size: 14px;
                    font-weight: 700;
                    color: #0f172a;
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    max-width: 65%;
                }
                .sl-card-cust-phone {
                    font-size: 11px;
                    color: #64748b;
                    font-weight: 500;
                    margin-left: 4px;
                }
                .sl-card-date-line {
                    display: flex;
                    align-items: center;
                    gap: 5px;
                    font-size: 12px;
                    font-weight: 600;
                    color: #64748b;
                    white-space: nowrap;
                    flex-shrink: 0;
                }
                .sl-card-bot {
                    border-top: 1px dashed #e2e8f0;
                    padding-top: 10px;
                    display: flex;
                    flex-direction: column;
                    gap: 10px;
                }
                .sl-card-fin-row {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                }
                .sl-card-amt-pills {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    font-size: 12px;
                    font-weight: 700;
                }
                .sl-card-paid {
                    color: #059669;
                }
                .sl-card-due-alert {
                    color: #d97706;
                }
                .sl-card-due-zero {
                    color: #94a3b8;
                }
                .sl-card-actions {
                    display: flex;
                    align-items: center;
                    justify-content: flex-end;
                    gap: 6px;
                    padding-top: 2px;
                }

                .sl-load-more {
                    width: 100%;
                    padding: 12px;
                    border-radius: 10px;
                    border: 1.5px solid #e2e8f0;
                    background: white;
                    font-weight: 700;
                    font-size: 14px;
                    color: #475569;
                    cursor: pointer;
                    margin-top: 8px;
                    transition: all 0.15s ease;
                }
                .sl-load-more:hover {
                    background: #f8fafc;
                    border-color: #cbd5e1;
                }

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
                    padding: 5px 10px;
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

                /* Floating Batch Bar Styles */
                .sl-floating-batch-bar {
                    position: fixed;
                    bottom: 24px;
                    left: 50%;
                    transform: translateX(-50%);
                    background: #071b44;
                    color: white;
                    padding: 10px 18px;
                    border-radius: 50px;
                    box-shadow: 0 10px 30px rgba(7, 27, 68, 0.35), 0 0 0 1px rgba(255, 255, 255, 0.1);
                    display: flex;
                    align-items: center;
                    gap: 16px;
                    z-index: 1000;
                    backdrop-filter: blur(8px);
                }
                .fbb-info {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    font-size: 13px;
                    font-weight: 600;
                }
                .fbb-count {
                    background: #1e6bff;
                    color: white;
                    width: 22px;
                    height: 22px;
                    border-radius: 50%;
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 12px;
                    font-weight: 800;
                }
                .fbb-actions {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                }
                .fbb-btn {
                    height: 34px;
                    padding: 0 14px;
                    border-radius: 20px;
                    border: none;
                    font-size: 12px;
                    font-weight: 700;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    gap: 6px;
                    transition: all 0.15s;
                }
                .fbb-print {
                    background: #1e6bff;
                    color: white;
                }
                .fbb-print:hover {
                    background: #1557d4;
                }
                .fbb-download {
                    background: rgba(255, 255, 255, 0.15);
                    color: white;
                }
                .fbb-download:hover {
                    background: rgba(255, 255, 255, 0.25);
                }
                .fbb-clear {
                    background: transparent;
                    color: #94a3b8;
                    border: 1px solid rgba(255, 255, 255, 0.2);
                }
                .fbb-clear:hover {
                    color: white;
                    border-color: white;
                }
            `}</style>
        </div>
    );
};

export default SalesLogPage;
