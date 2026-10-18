import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    ArrowLeft, 
    IndianRupee, 
    Phone, 
    Calendar, 
    Clock, 
    CheckCircle, 
    CheckCircle2,
    AlertCircle, 
    MessageSquare, 
    ShoppingCart, 
    History,
    Plus,
    Search,
    FileText,
    Eye,
    TrendingUp,
    Package,
    Filter,
    ArrowUpDown,
    ExternalLink,
    X,
    FileSpreadsheet
} from 'lucide-react';
import { purchaseService, shopService } from '../services/api';
import { EmptyState, Skeleton, PageHeader, CustomSelect, MessageModal } from '../components/PremiumUI';
import { useScrollLock } from '../hooks/useScrollLock';
import { SupplierAccountStatement } from '../components/SupplierAccountStatement';

const SupplierLedgerPage = () => {
    const { shopId, supplierName } = useParams();
    const navigate = useNavigate();
    const decodedSupplierName = decodeURIComponent(supplierName);
    
    const [purchases, setPurchases] = useState([]);
    const [shop, setShop] = useState(null);
    const [loading, setLoading] = useState(true);
    const [supplierPhone, setSupplierPhone] = useState('');
    
    // UI Navigation & Filtering State
    const [activeTab, setActiveTab] = useState('invoices'); // 'invoices' | 'payments' | 'products'
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState('all'); // 'all' | 'due' | 'paid' | 'partial'
    const [sortBy, setSortBy] = useState('newest'); // 'newest' | 'oldest' | 'amount_desc' | 'due_desc'

    // Payment Modal State
    const [showPaymentModal, setShowPaymentModal] = useState(false);
    const [showStatementModal, setShowStatementModal] = useState(false);
    const [selectedPurchaseForPayment, setSelectedPurchaseForPayment] = useState(null);
    const [paymentInput, setPaymentInput] = useState({ amount: '', mode: 'Cash', remark: '', note: '' });
    const [isSaving, setIsSaving] = useState(false);
    const [alertConfig, setAlertConfig] = useState({ open: false, title: '', message: '', type: 'info' });

    useScrollLock(showPaymentModal || showStatementModal);

    const fetchSupplierData = async () => {
        try {
            setLoading(true);
            const [purRes, shopRes] = await Promise.all([
                purchaseService.getAll(shopId),
                shopService.getAll()
            ]);
            
            const allPurchases = purRes.data?.data || purRes.data || [];
            const filtered = allPurchases.filter(p => 
                (p.supplierName || '').toLowerCase() === decodedSupplierName.toLowerCase()
            );
            
            setPurchases(filtered);
            
            // Extract phone number if available
            const phoneMatch = filtered.find(p => p.supplierPhone)?.supplierPhone;
            if (phoneMatch) setSupplierPhone(phoneMatch);

            if (shopRes.data && shopRes.data.data) {
                setShop(shopRes.data.data.find(s => s._id === shopId));
            }
        } catch (error) {
            console.error("Error loading supplier ledger:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (shopId && supplierName) {
            fetchSupplierData();
        }
    }, [shopId, supplierName, decodedSupplierName]);

    // Financial Totals
    const totalPurchased = useMemo(() => purchases.reduce((sum, p) => sum + (p.totalAmount || 0), 0), [purchases]);
    const totalPaid = useMemo(() => purchases.reduce((sum, p) => sum + (p.paidAmount || 0), 0), [purchases]);
    const outstandingDue = useMemo(() => purchases.reduce((sum, p) => sum + (p.dueAmount || 0), 0), [purchases]);
    const totalBills = purchases.length;
    
    const latestDate = useMemo(() => {
        if (purchases.length === 0) return null;
        return new Date(Math.max(...purchases.map(p => new Date(p.date).getTime())));
    }, [purchases]);

    // Currency Formatter Helpers
    const formatCurrencyCompact = (amount) => {
        const val = Number(amount || 0);
        if (val >= 10000000) {
            return `₹${(val / 10000000).toFixed(2).replace(/\.00$/, '')}Cr`;
        }
        if (val >= 100000) {
            return `₹${(val / 100000).toFixed(2).replace(/\.00$/, '')}L`;
        }
        return `₹${val.toLocaleString('en-IN')}`;
    };

    const formatCurrencyExact = (amount) => {
        return `₹${Number(amount || 0).toLocaleString('en-IN')}`;
    };

    // Flatten Payment History
    const paymentHistory = useMemo(() => {
        const list = [];
        purchases.forEach(p => {
            (p.paymentHistory || []).forEach(ph => {
                list.push({
                    ...ph,
                    billNo: p.billNo,
                    purchaseId: p._id,
                    purchaseDate: p.date
                });
            });
        });
        return list.sort((a, b) => new Date(b.paidAt || b.date) - new Date(a.paidAt || a.date));
    }, [purchases]);

    // Aggregate Product Catalog History
    const productHistory = useMemo(() => {
        const historyMap = {};
        purchases.forEach(p => {
            (p.items || []).forEach(item => {
                const key = (item.productName || 'Unknown Item').toLowerCase();
                if (!historyMap[key]) {
                    historyMap[key] = {
                        productName: item.productName || 'Unknown Item',
                        quantity: 0,
                        unit: item.unit || 'Pc',
                        totalSpent: 0,
                        purchaseCount: 0
                    };
                }
                historyMap[key].quantity += Number(item.quantity || 0);
                historyMap[key].totalSpent += Number(item.itemTotal || (item.quantity * item.purchaseRate) || 0);
                historyMap[key].purchaseCount += 1;
            });
        });
        return Object.values(historyMap).sort((a, b) => b.totalSpent - a.totalSpent);
    }, [purchases]);

    // Filter & Sort Invoices
    const filteredPurchases = useMemo(() => {
        let list = [...purchases];

        // Search filter
        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase();
            list = list.filter(p => {
                const billMatches = (p.billNo || '').toLowerCase().includes(q);
                const itemsMatch = (p.items || []).some(item => (item.productName || '').toLowerCase().includes(q));
                return billMatches || itemsMatch;
            });
        }

        // Status filter
        if (statusFilter === 'due') {
            list = list.filter(p => Number(p.dueAmount || 0) > 0);
        } else if (statusFilter === 'paid') {
            list = list.filter(p => Number(p.dueAmount || 0) === 0);
        } else if (statusFilter === 'partial') {
            list = list.filter(p => p.paymentStatus === 'Partial Paid');
        }

        // Sort
        list.sort((a, b) => {
            if (sortBy === 'newest') return new Date(b.date) - new Date(a.date);
            if (sortBy === 'oldest') return new Date(a.date) - new Date(b.date);
            if (sortBy === 'amount_desc') return (b.totalAmount || 0) - (a.totalAmount || 0);
            if (sortBy === 'due_desc') return (b.dueAmount || 0) - (a.dueAmount || 0);
            return 0;
        });

        return list;
    }, [purchases, searchQuery, statusFilter, sortBy]);

    // Open Payment Modal for specific bill or auto-allocation
    const openPaymentModal = (targetPurchase = null) => {
        if (outstandingDue <= 0) {
            setAlertConfig({ open: true, title: 'No Dues Pending', message: 'There is no outstanding balance due for this supplier.', type: 'info' });
            return;
        }

        if (targetPurchase) {
            setSelectedPurchaseForPayment(targetPurchase);
            setPaymentInput({ amount: targetPurchase.dueAmount || '', mode: 'Cash', remark: '', note: '' });
        } else {
            setSelectedPurchaseForPayment({ _id: 'AUTO', dueAmount: outstandingDue });
            setPaymentInput({ amount: outstandingDue || '', mode: 'Cash', remark: '', note: '' });
        }
        setShowPaymentModal(true);
    };

    // Payment Handler
    const handleRecordPayment = async (e) => {
        e.preventDefault();
        if (!selectedPurchaseForPayment) {
            setAlertConfig({ open: true, title: 'Bill Required', message: 'Please select a bill or auto-allocate.', type: 'error' });
            return;
        }

        if (paymentInput.mode === 'Credit') {
            setAlertConfig({ 
                open: true, 
                title: 'Credit Not an Outgoing Payment', 
                message: 'Credit represents an outstanding due or debt, not an actual money payment. Please choose Cash, Online / UPI, or Bank Transfer to record a payment.', 
                type: 'error' 
            });
            return;
        }

        if (!paymentInput.amount || Number(paymentInput.amount) <= 0) {
            setAlertConfig({ open: true, title: 'Invalid Amount', message: 'Please enter a valid amount greater than 0.', type: 'error' });
            return;
        }

        const payRemark = (paymentInput.remark !== undefined ? paymentInput.remark : (paymentInput.note || '')).trim();

        try {
            setIsSaving(true);
            
            if (selectedPurchaseForPayment._id === 'AUTO') {
                let remainingAmount = Number(paymentInput.amount);
                const pendingPurchases = [...purchases]
                    .filter(p => p.dueAmount > 0)
                    .sort((a, b) => new Date(a.date) - new Date(b.date)); // Oldest first
                
                for (const p of pendingPurchases) {
                    if (remainingAmount <= 0) break;
                    const payAmount = Math.min(remainingAmount, p.dueAmount);
                    await purchaseService.addPayment(p._id, {
                        amount: payAmount,
                        mode: paymentInput.mode,
                        remark: payRemark,
                        note: payRemark || 'Auto-allocated payment'
                    });
                    remainingAmount -= payAmount;
                }
                setAlertConfig({ open: true, title: 'Success', message: 'Payment successfully auto-allocated across pending bills!', type: 'success' });
            } else {
                await purchaseService.addPayment(selectedPurchaseForPayment._id, {
                    amount: Number(paymentInput.amount),
                    mode: paymentInput.mode,
                    remark: payRemark,
                    note: payRemark
                });
                setAlertConfig({ open: true, title: 'Success', message: `Payment of ₹${Number(paymentInput.amount).toLocaleString('en-IN')} via ${paymentInput.mode === 'Online' ? 'Online / UPI' : paymentInput.mode} successfully recorded!`, type: 'success' });
            }
            
            setPaymentInput({ amount: '', mode: 'Cash', remark: '', note: '' });
            setSelectedPurchaseForPayment(null);
            setShowPaymentModal(false);
            fetchSupplierData();
        } catch (error) {
            console.error("Failed to record payment:", error);
            setAlertConfig({ open: true, title: 'Error', message: error.response?.data?.message || 'Unable to log transaction.', type: 'error' });
        } finally {
            setIsSaving(false);
        }
    };

    if (loading) {
        return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', maxWidth: '1400px', margin: '0 auto', padding: '24px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: '#E2E8F0', animation: 'pulse 1.5s infinite' }} />
                    <div style={{ width: '240px', height: '32px', borderRadius: '8px', background: '#E2E8F0', animation: 'pulse 1.5s infinite' }} />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
                    {[1, 2, 3, 4].map(i => (
                        <div key={i} style={{ height: '110px', borderRadius: '16px', background: '#F1F5F9', animation: 'pulse 1.5s infinite' }} />
                    ))}
                </div>
                <div style={{ height: '350px', borderRadius: '20px', background: '#F8FAFC', border: '1px solid #E2E8F0' }} />
                <style>{`@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }`}</style>
            </div>
        );
    }

    return (
        <div className="supplier-details-dashboard" style={{ maxWidth: '1400px', margin: '0 auto', padding: '24px', display: 'flex', flexDirection: 'column', gap: '24px', boxSizing: 'border-box' }}>
            <style>{`
                .sd-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    gap: 16px;
                    flex-wrap: wrap;
                }
                .sd-header-left {
                    display: flex;
                    align-items: center;
                    gap: 14px;
                }
                .sd-back-btn {
                    width: 42px;
                    height: 42px;
                    background: #FFFFFF;
                    border: 1.5px solid #E2E8F0;
                    border-radius: 12px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: #475569;
                    cursor: pointer;
                    transition: all 0.15s ease;
                    flex-shrink: 0;
                }
                .sd-back-btn:hover {
                    background: #F8FAFC;
                    color: #0F172A;
                    border-color: #CBD5E1;
                    transform: translateX(-2px);
                }
                .sd-title-wrap h1 {
                    font-size: 26px;
                    font-weight: 900;
                    color: #0F172A;
                    margin: 0;
                    letter-spacing: -0.02em;
                    line-height: 1.2;
                }
                .sd-contact-meta {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    margin-top: 4px;
                    flex-wrap: wrap;
                }
                .sd-phone-badge {
                    display: inline-flex;
                    align-items: center;
                    gap: 6px;
                    font-size: 13px;
                    font-weight: 600;
                    color: #64748B;
                }
                .sd-contact-chip {
                    display: inline-flex;
                    align-items: center;
                    gap: 5px;
                    padding: 3px 10px;
                    border-radius: 8px;
                    font-size: 12px;
                    font-weight: 700;
                    text-decoration: none;
                    transition: all 0.15s ease;
                }
                .sd-contact-chip.call {
                    background: #F0FDF4;
                    color: #16A34A;
                    border: 1px solid #DCFCE7;
                }
                .sd-contact-chip.call:hover {
                    background: #DCFCE7;
                }
                .sd-contact-chip.whatsapp {
                    background: #ECFDF5;
                    color: #059669;
                    border: 1px solid #D1FAE5;
                }
                .sd-contact-chip.whatsapp:hover {
                    background: #D1FAE5;
                }
                .sd-header-actions {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    flex-wrap: wrap;
                }
                .sd-btn-statement {
                    background: #FFFFFF;
                    color: #1E293B;
                    height: 44px;
                    padding: 0 16px;
                    border-radius: 12px;
                    border: 1.5px solid #CBD5E1;
                    font-size: 14px;
                    font-weight: 800;
                    display: inline-flex;
                    align-items: center;
                    gap: 8px;
                    cursor: pointer;
                    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
                    transition: all 0.15s ease;
                    white-space: nowrap;
                }
                .sd-btn-statement:hover {
                    background: #F8FAFC;
                    color: #2563EB;
                    border-color: #93C5FD;
                    transform: translateY(-1px);
                    box-shadow: 0 4px 12px rgba(37, 99, 235, 0.12);
                }
                .sd-btn-secondary {
                    background: #EA580C;
                    color: #FFFFFF;
                    height: 44px;
                    padding: 0 18px;
                    border-radius: 12px;
                    border: none;
                    font-size: 14px;
                    font-weight: 800;
                    display: inline-flex;
                    align-items: center;
                    gap: 8px;
                    cursor: pointer;
                    box-shadow: 0 2px 6px rgba(234, 88, 12, 0.25);
                    transition: all 0.15s ease;
                }
                .sd-btn-secondary:hover {
                    background: #C2410C;
                    transform: translateY(-1px);
                    box-shadow: 0 4px 12px rgba(234, 88, 12, 0.35);
                }
                .sd-btn-primary {
                    background: #2563EB;
                    color: #FFFFFF;
                    height: 44px;
                    padding: 0 20px;
                    border-radius: 12px;
                    border: none;
                    font-size: 14px;
                    font-weight: 800;
                    display: inline-flex;
                    align-items: center;
                    gap: 8px;
                    cursor: pointer;
                    box-shadow: 0 2px 8px rgba(37, 99, 235, 0.28);
                    transition: all 0.15s ease;
                }
                .sd-btn-primary:hover {
                    background: #1D4ED8;
                    transform: translateY(-1px);
                    box-shadow: 0 4px 14px rgba(37, 99, 235, 0.4);
                }

                /* 4 Summary Cards Grid */
                .sd-summary-grid {
                    display: grid;
                    grid-template-columns: repeat(4, 1fr);
                    gap: 16px;
                }
                .sd-card {
                    background: #FFFFFF;
                    border: 1px solid #E2E8F0;
                    border-radius: 16px;
                    padding: 18px 20px;
                    display: flex;
                    flex-direction: column;
                    justify-content: space-between;
                    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.02);
                    transition: all 0.2s ease;
                    position: relative;
                    min-height: 110px;
                    box-sizing: border-box;
                }
                .sd-card:hover {
                    border-color: #CBD5E1;
                    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.04);
                }
                .sd-card.highlight-due {
                    background: linear-gradient(135deg, #FFFDF5 0%, #FFFBEB 100%);
                    border-color: #FCD34D;
                }
                .sd-card-top {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    margin-bottom: 8px;
                }
                .sd-card-label {
                    font-size: 11px;
                    font-weight: 800;
                    color: #64748B;
                    text-transform: uppercase;
                    letter-spacing: 0.06em;
                }
                .sd-card-icon {
                    width: 30px;
                    height: 30px;
                    border-radius: 8px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }
                .sd-card-val {
                    font-size: 26px;
                    font-weight: 900;
                    color: #0F172A;
                    line-height: 1.15;
                    letter-spacing: -0.02em;
                }
                .sd-card-sub {
                    font-size: 12px;
                    font-weight: 600;
                    color: #64748B;
                    margin-top: 6px;
                    display: flex;
                    align-items: center;
                    gap: 6px;
                }

                /* Section & Tabs */
                .sd-tabs-bar {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    border-bottom: 2px solid #E2E8F0;
                    padding-bottom: 2px;
                    overflow-x: auto;
                    scrollbar-width: none;
                }
                .sd-tab-btn {
                    background: transparent;
                    border: none;
                    padding: 10px 16px;
                    font-size: 14px;
                    font-weight: 800;
                    color: #64748B;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    border-radius: 10px 10px 0 0;
                    position: relative;
                    transition: all 0.15s ease;
                    white-space: nowrap;
                }
                .sd-tab-btn:hover {
                    color: #0F172A;
                    background: #F1F5F9;
                }
                .sd-tab-btn.active {
                    color: #2563EB;
                    background: #EFF6FF;
                }
                .sd-tab-btn.active::after {
                    content: '';
                    position: absolute;
                    bottom: -2px;
                    left: 0;
                    right: 0;
                    height: 2px;
                    background: #2563EB;
                    border-radius: 2px 2px 0 0;
                }
                .sd-tab-count {
                    font-size: 11px;
                    font-weight: 800;
                    padding: 2px 7px;
                    border-radius: 12px;
                    background: #E2E8F0;
                    color: #475569;
                }
                .sd-tab-btn.active .sd-tab-count {
                    background: #DBEAFE;
                    color: #1D4ED8;
                }

                /* Table & Controls Container */
                .sd-content-box {
                    background: #FFFFFF;
                    border: 1px solid #E2E8F0;
                    border-radius: 20px;
                    padding: 20px;
                    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.02);
                }
                .sd-filter-row {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    gap: 14px;
                    flex-wrap: wrap;
                    margin-bottom: 18px;
                }
                .sd-search-box {
                    position: relative;
                    flex: 1;
                    min-width: 220px;
                    max-width: 360px;
                }
                .sd-search-box input {
                    width: 100%;
                    height: 40px;
                    border-radius: 10px;
                    border: 1.5px solid #E2E8F0;
                    background: #F8FAFC;
                    padding: 0 14px 0 36px;
                    font-size: 13px;
                    font-weight: 600;
                    color: #0F172A;
                    outline: none;
                    box-sizing: border-box;
                    transition: all 0.15s ease;
                }
                .sd-search-box input:focus {
                    background: #FFFFFF;
                    border-color: #2563EB;
                    box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
                }
                .sd-search-icon {
                    position: absolute;
                    left: 11px;
                    top: 50%;
                    transform: translateY(-50%);
                    color: #94A3B8;
                    pointer-events: none;
                }
                .sd-status-pills {
                    display: flex;
                    align-items: center;
                    gap: 6px;
                    flex-wrap: wrap;
                }
                .sd-pill {
                    height: 36px;
                    padding: 0 12px;
                    border-radius: 8px;
                    border: 1px solid #E2E8F0;
                    background: #FFFFFF;
                    color: #64748B;
                    font-size: 12px;
                    font-weight: 700;
                    cursor: pointer;
                    transition: all 0.15s ease;
                }
                .sd-pill:hover {
                    background: #F1F5F9;
                    color: #0F172A;
                }
                .sd-pill.active {
                    background: #1E293B;
                    color: #FFFFFF;
                    border-color: #1E293B;
                }
                .sd-sort-select {
                    height: 36px;
                    padding: 0 12px;
                    border-radius: 8px;
                    border: 1px solid #E2E8F0;
                    background: #F8FAFC;
                    color: #475569;
                    font-size: 12px;
                    font-weight: 700;
                    outline: none;
                    cursor: pointer;
                }

                /* Structured Table */
                .sd-table-wrap {
                    width: 100%;
                    overflow-x: auto;
                    -webkit-overflow-scrolling: touch;
                }
                .sd-table {
                    width: 100%;
                    border-collapse: separate;
                    border-spacing: 0;
                    font-size: 13px;
                }
                .sd-table th {
                    background: #F8FAFC;
                    color: #475569;
                    font-weight: 800;
                    font-size: 11px;
                    text-transform: uppercase;
                    letter-spacing: 0.05em;
                    padding: 12px 14px;
                    border-top: 1px solid #E2E8F0;
                    border-bottom: 2px solid #E2E8F0;
                    white-space: nowrap;
                }
                .sd-table th:first-child {
                    border-top-left-radius: 10px;
                    border-bottom-left-radius: 10px;
                }
                .sd-table th:last-child {
                    border-top-right-radius: 10px;
                    border-bottom-right-radius: 10px;
                }
                .sd-table td {
                    padding: 14px;
                    border-bottom: 1px solid #F1F5F9;
                    color: #334155;
                    font-weight: 600;
                    vertical-align: middle;
                }
                .sd-table tbody tr {
                    transition: background 0.15s ease;
                }
                .sd-table tbody tr:hover {
                    background: #F8FAFC;
                }
                .sd-badge {
                    display: inline-flex;
                    align-items: center;
                    gap: 5px;
                    padding: 4px 10px;
                    border-radius: 6px;
                    font-size: 11px;
                    font-weight: 800;
                    text-transform: uppercase;
                    letter-spacing: 0.03em;
                }
                .sd-badge.paid {
                    background: #ECFDF5;
                    color: #059669;
                    border: 1px solid #A7F3D0;
                }
                .sd-badge.partial {
                    background: #FFFBEB;
                    color: #D97706;
                    border: 1px solid #FDE68A;
                }
                .sd-badge.pending {
                    background: #FEF2F2;
                    color: #DC2626;
                    border: 1px solid #FECACA;
                }
                .sd-btn-view {
                    background: #F1F5F9;
                    color: #1E293B;
                    border: 1px solid #E2E8F0;
                    padding: 6px 12px;
                    border-radius: 8px;
                    font-size: 12px;
                    font-weight: 700;
                    display: inline-flex;
                    align-items: center;
                    gap: 5px;
                    cursor: pointer;
                    transition: all 0.15s ease;
                }
                .sd-btn-view:hover {
                    background: #E2E8F0;
                    color: #0F172A;
                }
                .sd-btn-pay-row {
                    background: #FFFBEB;
                    color: #D97706;
                    border: 1px solid #FCD34D;
                    padding: 6px 10px;
                    border-radius: 8px;
                    font-size: 12px;
                    font-weight: 800;
                    display: inline-flex;
                    align-items: center;
                    gap: 4px;
                    cursor: pointer;
                    margin-left: 6px;
                    transition: all 0.15s ease;
                }
                .sd-btn-pay-row:hover {
                    background: #FEF3C7;
                    color: #B45309;
                }

                /* Mobile Card List */
                .sd-mobile-invoices-list {
                    display: none;
                    flex-direction: column;
                    gap: 12px;
                }
                .sd-inv-card {
                    background: #FFFFFF;
                    border: 1px solid #E2E8F0;
                    border-radius: 14px;
                    padding: 14px;
                    display: flex;
                    flex-direction: column;
                    gap: 10px;
                    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.02);
                }

                @media (max-width: 1024px) {
                    .sd-summary-grid {
                        grid-template-columns: repeat(2, 1fr);
                    }
                }
                @media (max-width: 768px) {
                    .supplier-details-dashboard {
                        padding: 14px 12px 40px 12px !important;
                        gap: 18px !important;
                    }
                    .sd-header {
                        flex-direction: column;
                        align-items: stretch;
                        gap: 12px;
                    }
                    .sd-header-actions {
                        width: 100%;
                    }
                    .sd-btn-secondary, .sd-btn-primary, .sd-btn-statement {
                        flex: 1;
                        justify-content: center;
                        font-size: 13px;
                        padding: 0 10px;
                    }
                    .sd-summary-grid {
                        grid-template-columns: repeat(2, 1fr);
                        gap: 10px;
                    }
                    .sd-card {
                        padding: 14px;
                        min-height: 94px;
                    }
                    .sd-card-val {
                        font-size: 20px;
                    }
                    .sd-card-sub {
                        font-size: 11px;
                    }
                    .sd-table-wrap {
                        display: none;
                    }
                    .sd-mobile-invoices-list {
                        display: flex;
                    }
                    .sd-filter-row {
                        flex-direction: column;
                        align-items: stretch;
                    }
                    .sd-search-box {
                        max-width: 100%;
                    }
                    .sd-content-box {
                        padding: 14px;
                        border-radius: 16px;
                    }
                }
                @media (max-width: 480px) {
                    .sd-summary-grid {
                        grid-template-columns: 1fr 1fr;
                        gap: 8px;
                    }
                    .sd-title-wrap h1 {
                        font-size: 22px;
                    }
                }
            `}</style>

            {/* 1. Header Section */}
            <div className="sd-header">
                <div className="sd-header-left">
                    <button 
                        className="sd-back-btn"
                        onClick={() => navigate(`/shop/${shopId}/purchase-ledger`)} 
                        title="Back to Purchase Ledger"
                        aria-label="Back"
                    >
                        <ArrowLeft size={19} />
                    </button>
                    <div className="sd-title-wrap">
                        <h1>{decodedSupplierName}</h1>
                        <div className="sd-contact-meta">
                            {supplierPhone ? (
                                <>
                                    <span className="sd-phone-badge">
                                        <Phone size={13} />
                                        <span>{supplierPhone}</span>
                                    </span>
                                    <a href={`tel:${supplierPhone}`} className="sd-contact-chip call">
                                        <Phone size={11} /> Call
                                    </a>
                                    <a href={`https://wa.me/${supplierPhone.replace(/\D/g, '')}`} target="_blank" rel="noreferrer" className="sd-contact-chip whatsapp">
                                        <MessageSquare size={11} /> WhatsApp
                                    </a>
                                </>
                            ) : (
                                <span style={{ fontSize: '13px', color: '#94A3B8', fontWeight: '500' }}>
                                    Supplier Account
                                </span>
                            )}
                        </div>
                    </div>
                </div>

                <div className="sd-header-actions">
                    <button 
                        className="sd-btn-statement"
                        onClick={() => setShowStatementModal(true)}
                        title="View printable supplier account statement / ledger"
                    >
                        <FileText size={16} />
                        <span>View Account Statement</span>
                    </button>
                    <button 
                        className="sd-btn-secondary"
                        onClick={() => openPaymentModal()}
                        title="Record payment to settle outstanding dues"
                    >
                        <IndianRupee size={16} />
                        <span>Record Payment</span>
                    </button>
                    <button 
                        className="sd-btn-primary"
                        onClick={() => navigate(`/shop/${shopId}/inventory?action=add_stock&supplier=${encodeURIComponent(decodedSupplierName)}`)}
                        title="Log a new stock purchase from this supplier"
                    >
                        <Plus size={16} />
                        <span>Add Purchase</span>
                    </button>
                </div>
            </div>

            {/* 2. Summary Cards (4 Compact Cards in 1 Responsive Grid) */}
            <div className="sd-summary-grid">
                {/* Total Purchased */}
                <div className="sd-card" style={{ borderTop: '3px solid #2563EB' }} title={`Exact: ${formatCurrencyExact(totalPurchased)}`}>
                    <div className="sd-card-top">
                        <span className="sd-card-label">Total Purchased</span>
                        <div className="sd-card-icon" style={{ background: '#EFF6FF', color: '#2563EB' }}>
                            <TrendingUp size={16} />
                        </div>
                    </div>
                    <div>
                        <div className="sd-card-val">{formatCurrencyCompact(totalPurchased)}</div>
                        <div className="sd-card-sub" title={formatCurrencyExact(totalPurchased)}>
                            {totalPurchased >= 100000 ? formatCurrencyExact(totalPurchased) : `Across ${totalBills} bill${totalBills === 1 ? '' : 's'}`}
                        </div>
                    </div>
                </div>

                {/* Total Paid */}
                <div className="sd-card" style={{ borderTop: '3px solid #10B981' }} title={`Exact: ${formatCurrencyExact(totalPaid)}`}>
                    <div className="sd-card-top">
                        <span className="sd-card-label">Total Paid</span>
                        <div className="sd-card-icon" style={{ background: '#ECFDF5', color: '#10B981' }}>
                            <CheckCircle2 size={16} />
                        </div>
                    </div>
                    <div>
                        <div className="sd-card-val" style={{ color: '#059669' }}>{formatCurrencyCompact(totalPaid)}</div>
                        <div className="sd-card-sub">
                            {totalPurchased > 0 
                                ? `${((totalPaid / totalPurchased) * 100).toFixed(0)}% settled` 
                                : 'No payments yet'}
                        </div>
                    </div>
                </div>

                {/* Outstanding Due */}
                <div 
                    className={`sd-card ${outstandingDue > 0 ? 'highlight-due' : ''}`} 
                    style={{ borderTop: outstandingDue > 0 ? '3px solid #D97706' : '3px solid #94A3B8' }}
                    title={`Exact: ${formatCurrencyExact(outstandingDue)}`}
                >
                    <div className="sd-card-top">
                        <span className="sd-card-label" style={{ color: outstandingDue > 0 ? '#B45309' : '#64748B' }}>Outstanding Due</span>
                        <div className="sd-card-icon" style={{ background: outstandingDue > 0 ? '#FEF3C7' : '#F1F5F9', color: outstandingDue > 0 ? '#B45309' : '#64748B' }}>
                            <AlertCircle size={16} />
                        </div>
                    </div>
                    <div>
                        <div className="sd-card-val" style={{ color: outstandingDue > 0 ? '#B45309' : '#0F172A' }}>
                            {formatCurrencyCompact(outstandingDue)}
                        </div>
                        <div className="sd-card-sub" style={{ color: outstandingDue > 0 ? '#92400E' : '#64748B' }}>
                            {outstandingDue > 0 ? 'Settlement pending' : 'All clear / No dues'}
                        </div>
                    </div>
                </div>

                {/* Bills Logged */}
                <div className="sd-card" style={{ borderTop: '3px solid #6366F1' }}>
                    <div className="sd-card-top">
                        <span className="sd-card-label">Bills Logged</span>
                        <div className="sd-card-icon" style={{ background: '#EEF2FF', color: '#6366F1' }}>
                            <FileText size={16} />
                        </div>
                    </div>
                    <div>
                        <div className="sd-card-val">{totalBills}</div>
                        <div className="sd-card-sub">
                            {latestDate ? (
                                <span>Last: {latestDate.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                            ) : (
                                <span>No invoices yet</span>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* 3. Redundant summary blocks removed completely (per requirement 3) */}

            {/* 4. Tabs Navigation Bar */}
            <div className="sd-tabs-bar">
                <button 
                    className={`sd-tab-btn ${activeTab === 'invoices' ? 'active' : ''}`}
                    onClick={() => setActiveTab('invoices')}
                >
                    <FileText size={16} />
                    <span>Purchase Invoices</span>
                    <span className="sd-tab-count">{purchases.length}</span>
                </button>
                <button 
                    className={`sd-tab-btn ${activeTab === 'payments' ? 'active' : ''}`}
                    onClick={() => setActiveTab('payments')}
                >
                    <History size={16} />
                    <span>Payment History</span>
                    <span className="sd-tab-count">{paymentHistory.length}</span>
                </button>
                <button 
                    className={`sd-tab-btn ${activeTab === 'products' ? 'active' : ''}`}
                    onClick={() => setActiveTab('products')}
                >
                    <ShoppingCart size={16} />
                    <span>Purchased Items</span>
                    <span className="sd-tab-count">{productHistory.length}</span>
                </button>
                <button 
                    className={`sd-tab-btn ${activeTab === 'statement' ? 'active' : ''}`}
                    onClick={() => setActiveTab('statement')}
                >
                    <FileSpreadsheet size={16} />
                    <span>Account Statement</span>
                </button>
            </div>

            {/* 5. Tab Content: Purchase Invoices */}
            {activeTab === 'invoices' && (
                <div className="sd-content-box">
                    {/* Controls Row */}
                    <div className="sd-filter-row">
                        <div className="sd-search-box">
                            <Search size={15} className="sd-search-icon" />
                            <input 
                                type="text"
                                placeholder="Search bill no or items..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                            <div className="sd-status-pills">
                                <button 
                                    className={`sd-pill ${statusFilter === 'all' ? 'active' : ''}`}
                                    onClick={() => setStatusFilter('all')}
                                >
                                    All ({purchases.length})
                                </button>
                                <button 
                                    className={`sd-pill ${statusFilter === 'due' ? 'active' : ''}`}
                                    onClick={() => setStatusFilter('due')}
                                >
                                    Pending Due ({purchases.filter(p => Number(p.dueAmount || 0) > 0).length})
                                </button>
                                <button 
                                    className={`sd-pill ${statusFilter === 'paid' ? 'active' : ''}`}
                                    onClick={() => setStatusFilter('paid')}
                                >
                                    Fully Paid ({purchases.filter(p => Number(p.dueAmount || 0) === 0).length})
                                </button>
                            </div>

                            <select 
                                className="sd-sort-select"
                                value={sortBy}
                                onChange={(e) => setSortBy(e.target.value)}
                            >
                                <option value="newest">Newest First</option>
                                <option value="oldest">Oldest First</option>
                                <option value="amount_desc">Highest Amount</option>
                                <option value="due_desc">Highest Due</option>
                            </select>
                        </div>
                    </div>

                    {filteredPurchases.length === 0 ? (
                        <div style={{ padding: '40px 0' }}>
                            <EmptyState 
                                icon={FileText}
                                title={purchases.length === 0 ? "No Purchase Bills Found" : "No Matching Invoices"}
                                description={purchases.length === 0 
                                    ? `No purchase invoices have been recorded yet for ${decodedSupplierName}.`
                                    : "No invoices match the selected filter or search keyword."}
                                actionLabel={purchases.length === 0 ? "Add First Purchase" : "Reset Filters"}
                                onAction={purchases.length === 0 
                                    ? () => navigate(`/shop/${shopId}/inventory?action=add_stock&supplier=${encodeURIComponent(decodedSupplierName)}`)
                                    : () => { setSearchQuery(''); setStatusFilter('all'); }}
                            />
                        </div>
                    ) : (
                        <>
                            {/* Desktop Structured Table */}
                            <div className="sd-table-wrap">
                                <table className="sd-table">
                                    <thead>
                                        <tr>
                                            <th style={{ textAlign: 'left' }}>Bill Number</th>
                                            <th style={{ textAlign: 'left' }}>Purchase Date</th>
                                            <th style={{ textAlign: 'left' }}>Items</th>
                                            <th style={{ textAlign: 'right' }}>Bill Amount</th>
                                            <th style={{ textAlign: 'right' }}>Paid Amount</th>
                                            <th style={{ textAlign: 'right' }}>Outstanding</th>
                                            <th style={{ textAlign: 'center' }}>Payment Status</th>
                                            <th style={{ textAlign: 'right' }}>Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredPurchases.map((pur) => {
                                            const statusClass = 
                                                pur.paymentStatus === 'Paid' ? 'paid' : 
                                                pur.paymentStatus === 'Partial Paid' ? 'partial' : 'pending';
                                            const isDue = Number(pur.dueAmount || 0) > 0;

                                            return (
                                                <tr key={pur._id}>
                                                    <td style={{ fontWeight: '800', color: '#0F172A', whiteSpace: 'nowrap' }}>
                                                        #{pur.billNo}
                                                    </td>
                                                    <td style={{ color: '#475569', whiteSpace: 'nowrap' }}>
                                                        {new Date(pur.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                                                    </td>
                                                    <td style={{ maxWidth: '280px' }}>
                                                        <div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: '#334155' }}>
                                                            {(pur.items && pur.items.length > 0)
                                                                ? pur.items.map(i => `${i.productName} (${i.quantity} ${i.unit || ''})`).join(', ')
                                                                : 'Direct Stock Entry'}
                                                        </div>
                                                    </td>
                                                    <td style={{ textAlign: 'right', fontWeight: '800', color: '#0F172A', whiteSpace: 'nowrap' }}>
                                                        ₹{(pur.totalAmount || 0).toLocaleString('en-IN')}
                                                    </td>
                                                    <td style={{ textAlign: 'right', fontWeight: '700', color: '#059669', whiteSpace: 'nowrap' }}>
                                                        ₹{(pur.paidAmount || 0).toLocaleString('en-IN')}
                                                    </td>
                                                    <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                                                        <span style={{ 
                                                            fontWeight: '800', 
                                                            color: isDue ? '#B45309' : '#64748B',
                                                            background: isDue ? '#FFFBEB' : 'transparent',
                                                            padding: isDue ? '2px 8px' : '0',
                                                            borderRadius: '6px',
                                                            border: isDue ? '1px solid #FCD34D' : 'none'
                                                        }}>
                                                            ₹{(pur.dueAmount || 0).toLocaleString('en-IN')}
                                                        </span>
                                                    </td>
                                                    <td style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>
                                                        <span className={`sd-badge ${statusClass}`}>
                                                            {pur.paymentStatus || (isDue ? 'Pending' : 'Paid')}
                                                        </span>
                                                    </td>
                                                    <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                                                        <button 
                                                            className="sd-btn-view"
                                                            onClick={() => navigate(`/shop/${shopId}/purchase-ledger/${pur._id}`)}
                                                            title="View Purchase Bill Details"
                                                        >
                                                            <Eye size={13} />
                                                            <span>View</span>
                                                        </button>
                                                        {isDue && (
                                                            <button 
                                                                className="sd-btn-pay-row"
                                                                onClick={() => openPaymentModal(pur)}
                                                                title={`Record payment for Bill #${pur.billNo}`}
                                                            >
                                                                <IndianRupee size={12} />
                                                                <span>Pay</span>
                                                            </button>
                                                        )}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>

                            {/* Mobile Card Layout */}
                            <div className="sd-mobile-invoices-list">
                                {filteredPurchases.map((pur) => {
                                    const statusClass = 
                                        pur.paymentStatus === 'Paid' ? 'paid' : 
                                        pur.paymentStatus === 'Partial Paid' ? 'partial' : 'pending';
                                    const isDue = Number(pur.dueAmount || 0) > 0;

                                    return (
                                        <div key={pur._id} className="sd-inv-card">
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                <span style={{ fontSize: '14px', fontWeight: '800', color: '#0F172A' }}>#{pur.billNo}</span>
                                                <span className={`sd-badge ${statusClass}`}>
                                                    {pur.paymentStatus}
                                                </span>
                                            </div>
                                            
                                            <div style={{ fontSize: '13px', color: '#475569', fontWeight: '500' }}>
                                                {(pur.items && pur.items.length > 0)
                                                    ? pur.items.map(i => `${i.productName} (${i.quantity})`).join(', ')
                                                    : 'Direct Entry'}
                                            </div>

                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '8px', borderTop: '1px dashed #E2E8F0', fontSize: '12px' }}>
                                                <span style={{ color: '#64748B' }}>
                                                    {new Date(pur.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                                                </span>
                                                <div style={{ display: 'flex', gap: '10px', alignItems: 'baseline' }}>
                                                    <span style={{ color: '#0F172A', fontWeight: '800', fontSize: '14px' }}>
                                                        ₹{(pur.totalAmount || 0).toLocaleString('en-IN')}
                                                    </span>
                                                    {isDue && (
                                                        <span style={{ color: '#B45309', fontWeight: '800', background: '#FFFBEB', padding: '1px 6px', borderRadius: '4px', border: '1px solid #FCD34D' }}>
                                                            Due: ₹{(pur.dueAmount || 0).toLocaleString('en-IN')}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>

                                            <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                                                <button 
                                                    className="sd-btn-view"
                                                    style={{ flex: 1, justifyContent: 'center' }}
                                                    onClick={() => navigate(`/shop/${shopId}/purchase-ledger/${pur._id}`)}
                                                >
                                                    <Eye size={14} /> View Bill
                                                </button>
                                                {isDue && (
                                                    <button 
                                                        className="sd-btn-pay-row"
                                                        style={{ flex: 1, justifyContent: 'center', margin: 0 }}
                                                        onClick={() => openPaymentModal(pur)}
                                                    >
                                                        <IndianRupee size={13} /> Pay Due
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </>
                    )}
                </div>
            )}

            {/* 6. Tab Content: Supplier Payment History */}
            {activeTab === 'payments' && (
                <div className="sd-content-box">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px', flexWrap: 'wrap', gap: '12px' }}>
                        <div>
                            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '800', color: '#0F172A' }}>Settlement & Payment History</h3>
                            <p style={{ margin: '2px 0 0', fontSize: '13px', color: '#64748B' }}>
                                Total paid: <strong style={{ color: '#059669' }}>{formatCurrencyExact(totalPaid)}</strong> across {paymentHistory.length} transaction{paymentHistory.length === 1 ? '' : 's'}
                            </p>
                        </div>
                        {outstandingDue > 0 && (
                            <button 
                                className="sd-btn-secondary"
                                style={{ height: '38px', fontSize: '13px', padding: '0 14px' }}
                                onClick={() => openPaymentModal()}
                            >
                                <IndianRupee size={14} /> Record Payment
                            </button>
                        )}
                    </div>

                    {paymentHistory.length === 0 ? (
                        <div style={{ padding: '40px 0' }}>
                            <EmptyState 
                                icon={History}
                                title="No Payment Logs Found"
                                description="No payments have been logged for this supplier yet."
                                actionLabel={outstandingDue > 0 ? "Record First Payment" : null}
                                onAction={outstandingDue > 0 ? () => openPaymentModal() : null}
                            />
                        </div>
                    ) : (
                        <div className="sd-table-wrap">
                            <table className="sd-table">
                                <thead>
                                    <tr>
                                        <th style={{ textAlign: 'left' }}>Payment Date</th>
                                        <th style={{ textAlign: 'left' }}>Associated Bill</th>
                                        <th style={{ textAlign: 'left' }}>Payment Mode</th>
                                        <th style={{ textAlign: 'left' }}>Remark / Notes</th>
                                        <th style={{ textAlign: 'right' }}>Amount Paid</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {paymentHistory.map((ph, idx) => (
                                        <tr key={idx}>
                                            <td style={{ color: '#0F172A', fontWeight: '700', whiteSpace: 'nowrap' }}>
                                                {new Date(ph.paidAt || ph.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                                            </td>
                                            <td style={{ whiteSpace: 'nowrap' }}>
                                                {ph.purchaseId ? (
                                                    <span 
                                                        onClick={() => navigate(`/shop/${shopId}/purchase-ledger/${ph.purchaseId}`)}
                                                        style={{ color: '#2563EB', fontWeight: '700', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                                                    >
                                                        #{ph.billNo} <ExternalLink size={11} />
                                                    </span>
                                                ) : (
                                                    <span>#{ph.billNo || '---'}</span>
                                                )}
                                            </td>
                                            <td>
                                                <span style={{ 
                                                    background: ph.mode === 'Bank Transfer' ? '#EFF6FF' : '#F1F5F9', 
                                                    color: ph.mode === 'Bank Transfer' ? '#1D4ED8' : '#334155',
                                                    border: ph.mode === 'Bank Transfer' ? '1px solid #BFDBFE' : '1px solid #E2E8F0',
                                                    padding: '3px 8px', 
                                                    borderRadius: '6px', 
                                                    fontSize: '11px', 
                                                    fontWeight: '700'
                                                }}>
                                                    {ph.mode === 'Online' ? 'Online / UPI' : (ph.mode || 'Cash')}
                                                </span>
                                            </td>
                                            <td style={{ color: (ph.remark || ph.note) ? '#0F172A' : '#94A3B8', maxWidth: '300px' }}>
                                                {ph.remark || ph.note || '—'}
                                            </td>
                                            <td style={{ textAlign: 'right', fontWeight: '800', color: '#059669', fontSize: '14px', whiteSpace: 'nowrap' }}>
                                                +₹{Number(ph.amount || 0).toLocaleString('en-IN')}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}

            {/* 7. Tab Content: Purchased Items Catalog */}
            {activeTab === 'products' && (
                <div className="sd-content-box">
                    <div style={{ marginBottom: '18px' }}>
                        <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '800', color: '#0F172A' }}>Items Purchased from Supplier</h3>
                        <p style={{ margin: '2px 0 0', fontSize: '13px', color: '#64748B' }}>
                            {productHistory.length} distinct item{productHistory.length === 1 ? '' : 's'} procured
                        </p>
                    </div>

                    {productHistory.length === 0 ? (
                        <div style={{ padding: '40px 0' }}>
                            <EmptyState 
                                icon={ShoppingCart}
                                title="No Products Recorded"
                                description="No item records available for this supplier."
                            />
                        </div>
                    ) : (
                        <div className="sd-table-wrap">
                            <table className="sd-table">
                                <thead>
                                    <tr>
                                        <th style={{ textAlign: 'left' }}>Product Name</th>
                                        <th style={{ textAlign: 'right' }}>Total Quantity Procured</th>
                                        <th style={{ textAlign: 'right' }}>Average Rate</th>
                                        <th style={{ textAlign: 'right' }}>Total Spent</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {productHistory.map((item, idx) => (
                                        <tr key={idx}>
                                            <td style={{ fontWeight: '800', color: '#0F172A' }}>
                                                {item.productName}
                                            </td>
                                            <td style={{ textAlign: 'right', fontWeight: '700', color: '#334155' }}>
                                                {item.quantity.toLocaleString('en-IN')} <span style={{ color: '#64748B', fontSize: '12px' }}>{item.unit}</span>
                                            </td>
                                            <td style={{ textAlign: 'right', color: '#64748B', fontWeight: '600' }}>
                                                ₹{item.quantity > 0 ? (item.totalSpent / item.quantity).toFixed(2) : '0.00'} / {item.unit}
                                            </td>
                                            <td style={{ textAlign: 'right', fontWeight: '800', color: '#0F172A' }}>
                                                ₹{item.totalSpent.toLocaleString('en-IN')}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}

            {/* 7. Tab Content: Account Statement (Embedded) */}
            {activeTab === 'statement' && (
                <div style={{ marginTop: '4px' }}>
                    <SupplierAccountStatement 
                        shopId={shopId}
                        supplierName={decodedSupplierName}
                        shop={shop}
                        embedded={true}
                    />
                </div>
            )}

            {/* 8. Record Payment Modal (Rendered in Portal to cover sidebar, header, and entire viewport) */}
            {typeof document !== 'undefined' && createPortal(
                <AnimatePresence>
                    {showPaymentModal && (
                        <div 
                            className="record-payment-portal-backdrop"
                            onClick={(e) => {
                                if (e.target === e.currentTarget) {
                                    setShowPaymentModal(false);
                                    setSelectedPurchaseForPayment(null);
                                }
                            }}
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
                                boxSizing: 'border-box'
                            }}
                        >
                            <motion.div 
                                initial={{ opacity: 0, scale: 0.95, y: 10 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.95, y: 10 }}
                                transition={{ duration: 0.15 }}
                                style={{ 
                                    background: '#FFFFFF', 
                                    borderRadius: '24px', 
                                    width: '100%', 
                                    maxWidth: '480px', 
                                    padding: '28px', 
                                    boxShadow: '0 25px 50px -12px rgba(0,0,0,0.3)', 
                                    boxSizing: 'border-box',
                                    position: 'relative',
                                    zIndex: 100000,
                                    maxHeight: '90vh',
                                    overflowY: 'auto'
                                }}
                                onClick={(e) => e.stopPropagation()}
                            >
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                                    <div>
                                        <h3 style={{ margin: 0, fontSize: '20px', fontWeight: '900', color: '#0F172A' }}>Record Payment</h3>
                                        <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#64748B' }}>
                                            Settle balance for <strong>{decodedSupplierName}</strong>
                                        </p>
                                    </div>
                                    <button 
                                        type="button"
                                        onClick={() => { setShowPaymentModal(false); setSelectedPurchaseForPayment(null); }}
                                        style={{ background: '#F1F5F9', border: 'none', width: '32px', height: '32px', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748B' }}
                                    >
                                        <X size={18} />
                                    </button>
                                </div>

                                <form onSubmit={handleRecordPayment} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                    <CustomSelect 
                                        label="Allocate Payment To"
                                        value={selectedPurchaseForPayment?._id || ''} 
                                        options={[
                                            { label: '-- Select allocation method --', value: '' },
                                            { label: `Auto-allocate across oldest dues (Total: ₹${outstandingDue.toLocaleString('en-IN')})`, value: 'AUTO' },
                                            ...purchases.filter(p => Number(p.dueAmount || 0) > 0).map(pur => ({
                                                label: `Bill #${pur.billNo} — Due: ₹${Number(pur.dueAmount || 0).toLocaleString('en-IN')}`,
                                                value: pur._id
                                            }))
                                        ]}
                                        onChange={(val) => {
                                            if (val === 'AUTO') {
                                                setSelectedPurchaseForPayment({ _id: 'AUTO', dueAmount: outstandingDue });
                                                setPaymentInput({ ...paymentInput, amount: outstandingDue });
                                            } else {
                                                const pur = purchases.find(p => p._id === val);
                                                setSelectedPurchaseForPayment(pur);
                                                if (pur) setPaymentInput({ ...paymentInput, amount: pur.dueAmount });
                                            }
                                        }}
                                    />

                                    {selectedPurchaseForPayment && (
                                        <>
                                            <div>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                                                    <label style={{ fontSize: '13px', fontWeight: '700', color: '#475569' }}>
                                                        Payment Amount (₹) <span style={{ color: '#EF4444' }}>*</span>
                                                    </label>
                                                    <span style={{ fontSize: '12px', fontWeight: '700', color: '#B45309' }}>
                                                        Max: ₹{Number(selectedPurchaseForPayment.dueAmount || 0).toLocaleString('en-IN')}
                                                    </span>
                                                </div>
                                                <input 
                                                    type="number" 
                                                    required
                                                    min="0.01"
                                                    step="0.01"
                                                    max={selectedPurchaseForPayment.dueAmount}
                                                    value={paymentInput.amount} 
                                                    onChange={(e) => setPaymentInput({ ...paymentInput, amount: e.target.value })}
                                                    placeholder="Enter amount to pay"
                                                    style={{ width: '100%', height: '46px', borderRadius: '10px', border: '1.5px solid #CBD5E1', padding: '0 14px', fontSize: '15px', fontWeight: '700', color: '#0F172A', outline: 'none', boxSizing: 'border-box' }}
                                                />
                                            </div>

                                            <CustomSelect 
                                                label="Payment Mode"
                                                value={paymentInput.mode} 
                                                options={[
                                                    { label: 'Cash', value: 'Cash' },
                                                    { label: 'Online / UPI', value: 'Online' },
                                                    { label: 'Bank Transfer', value: 'Bank Transfer' },
                                                    { label: 'Credit (Unpaid Due)', value: 'Credit' }
                                                ]}
                                                onChange={(val) => setPaymentInput({ ...paymentInput, mode: val })}
                                            />

                                            <div>
                                                <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', color: '#475569', marginBottom: '6px' }}>
                                                    Remark (Optional)
                                                </label>
                                                <input 
                                                    type="text" 
                                                    placeholder="e.g. Bank name, Cheque No, UTR / UPI Ref, or payment notes"
                                                    value={paymentInput.remark} 
                                                    onChange={(e) => setPaymentInput({ ...paymentInput, remark: e.target.value, note: e.target.value })}
                                                    style={{ width: '100%', height: '46px', borderRadius: '10px', border: '1.5px solid #CBD5E1', padding: '0 14px', fontSize: '14px', color: '#0F172A', outline: 'none', boxSizing: 'border-box' }}
                                                />
                                                <span style={{ fontSize: '11px', color: '#64748B', marginTop: '4px', display: 'block' }}>
                                                    Enter bank name, cheque number, transaction reference, or notes.
                                                </span>
                                            </div>
                                        </>
                                    )}

                                    <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
                                        <button 
                                            type="button" 
                                            onClick={() => { setShowPaymentModal(false); setSelectedPurchaseForPayment(null); }}
                                            style={{ flex: 1, height: '46px', borderRadius: '12px', border: '1.5px solid #E2E8F0', background: '#FFFFFF', color: '#475569', fontSize: '14px', fontWeight: '700', cursor: 'pointer' }}
                                        >
                                            Cancel
                                        </button>
                                        <button 
                                            type="submit" 
                                            disabled={isSaving || !selectedPurchaseForPayment}
                                            style={{ 
                                                flex: 1, 
                                                height: '46px', 
                                                borderRadius: '12px', 
                                                border: 'none', 
                                                background: '#EA580C', 
                                                color: '#FFFFFF', 
                                                fontSize: '14px', 
                                                fontWeight: '800', 
                                                cursor: (isSaving || !selectedPurchaseForPayment) ? 'not-allowed' : 'pointer', 
                                                opacity: (isSaving || !selectedPurchaseForPayment) ? 0.6 : 1,
                                                boxShadow: '0 2px 6px rgba(234, 88, 12, 0.3)'
                                            }}
                                        >
                                            {isSaving ? 'Processing...' : 'Pay Balance'}
                                        </button>
                                    </div>
                                </form>
                            </motion.div>
                        </div>
                    )}
                </AnimatePresence>,
                document.body
            )}

            {/* 9. Supplier Account Statement Modal */}
            <SupplierAccountStatement 
                shopId={shopId}
                supplierName={decodedSupplierName}
                shop={shop}
                isOpen={showStatementModal}
                onClose={() => setShowStatementModal(false)}
                embedded={false}
            />

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

export default SupplierLedgerPage;
