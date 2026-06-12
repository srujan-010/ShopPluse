import React, { useState, useEffect } from 'react';
import { 
    CreditCard, 
    AlertTriangle, 
    Calendar,
    Users,
    CheckCircle,
    Info,
    Smartphone,
    User,
    RefreshCw,
    DollarSign,
    TrendingUp,
    History,
    Plus,
    Search,
    Filter,
    ArrowRight,
    X,
    Receipt
} from 'lucide-react';
import api from '../../services/api';
import { useToast } from '../../context/ToastContext';

const AdminSubscriptions = () => {
    const { showToast } = useToast();
    const [subData, setSubData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('registry'); // 'registry' | 'history'
    
    // Filters
    const [filter, setFilter] = useState('All'); // 'All' | 'Active' | 'Expiring' | 'Expired' | 'Lifetime' | 'Yearly'
    const [searchQuery, setSearchQuery] = useState('');
    
    // History logs state
    const [historyList, setHistoryList] = useState([]);
    const [historyLoading, setHistoryLoading] = useState(false);
    
    // Manual Renewal / Plan Change Modal State
    const [showRenewModal, setShowRenewModal] = useState(false);
    const [shopsList, setShopsList] = useState([]);
    const [renewForm, setRenewForm] = useState({
        shopId: '',
        planType: 'Yearly',
        amountPaid: '',
        paymentMode: 'UPI',
        invoiceNumber: '',
        renewalType: 'Renew',
        planStartDate: new Date().toISOString().split('T')[0]
    });
    const [renewSaving, setRenewSaving] = useState(false);

    // Fetch primary subscription metrics & listings
    const fetchSubscriptions = async () => {
        try {
            setLoading(true);
            const res = await api.get(`/api/admin/subscriptions?filter=${filter}`);
            setSubData(res.data.data);
        } catch (e) {
            console.error("Failed to load subscription data:", e);
            showToast("Failed to load subscription metrics.", "error");
        } finally {
            setLoading(false);
        }
    };

    // Fetch renewal/payment logs history
    const fetchHistory = async () => {
        try {
            setHistoryLoading(true);
            const res = await api.get('/api/admin/subscriptions/history');
            setHistoryList(res.data.data);
        } catch (e) {
            console.error("Failed to load subscription history logs:", e);
        } finally {
            setHistoryLoading(false);
        }
    };

    // Fetch shops list for manual renewal dropdown
    const fetchShops = async () => {
        try {
            const res = await api.get('/api/admin/shops');
            setShopsList(res.data.data);
        } catch (e) {
            console.error("Failed to fetch shops list:", e);
        }
    };

    useEffect(() => {
        fetchSubscriptions();
        fetchHistory();
        fetchShops();
    }, [filter]);

    const handleOpenRenewModal = (shopId = '') => {
        setRenewForm({
            shopId: shopId,
            planType: 'Yearly',
            amountPaid: '',
            paymentMode: 'UPI',
            invoiceNumber: '',
            renewalType: 'Renew',
            planStartDate: new Date().toISOString().split('T')[0]
        });
        setShowRenewModal(true);
    };

    const handleRenewSubmit = async (e) => {
        e.preventDefault();
        if (!renewForm.shopId) {
            showToast("Please select a shop.", "error");
            return;
        }
        try {
            setRenewSaving(true);
            await api.post(`/api/admin/shops/${renewForm.shopId}/renew`, {
                planType: renewForm.planType,
                amountPaid: Number(renewForm.amountPaid || 0),
                paymentMode: renewForm.paymentMode,
                invoiceNumber: renewForm.invoiceNumber || undefined,
                renewalType: renewForm.renewalType,
                planStartDate: renewForm.planStartDate
            });
            showToast("Subscription plan applied successfully!", "success");
            setShowRenewModal(false);
            
            // Refresh tables & metrics
            fetchSubscriptions();
            fetchHistory();
        } catch (err) {
            showToast(err.response?.data?.message || "Failed to submit subscription renewal.", "error");
        } finally {
            setRenewSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="loader-container" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
                <div className="spinner" style={{ width: '40px', height: '40px', border: '4px solid #E2E8F0', borderTopColor: '#3B82F6', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            </div>
        );
    }

    const warnings = subData?.warnings || [];
    const lifetimeClients = subData?.lifetimeClients || 0;
    const yearlyClients = subData?.yearlyClients || 0;
    const expiringThisMonth = subData?.expiringThisMonth || 0;
    const expiredShops = subData?.expiredShops || 0;
    const revenueFromPlans = subData?.revenueFromPlans || 0;
    const renewalRate = subData?.renewalRate !== undefined ? subData.renewalRate : 100;

    const filteredSubs = (subData?.subscriptions || []).filter(sub => {
        const shopName = sub.shop?.name || '';
        return shopName.toLowerCase().includes(searchQuery.toLowerCase());
    });

    return (
        <div className="admin-subscriptions" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            
            {/* Header Row */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
                <div>
                    <h2 style={{ margin: 0, fontSize: '24px', fontWeight: '800', color: '#0F172A' }}>SaaS Control Center</h2>
                    <p style={{ margin: '4px 0 0 0', fontSize: '14px', color: '#64748B' }}>Monitor billing activity, renewals, plan metrics, and log payments.</p>
                </div>
                <button 
                    onClick={() => handleOpenRenewModal('')}
                    style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 20px', background: '#3B82F6', color: 'white', border: 'none', borderRadius: '12px', fontWeight: '700', cursor: 'pointer', boxShadow: '0 4px 12px rgba(59,130,246,0.25)', transition: '0.2s' }}
                >
                    <Plus size={18} /> Manual Renewal / Plan Change
                </button>
            </div>

            {/* KPI grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '20px' }}>
                <div className="kpi-card" style={{ background: 'linear-gradient(135deg, #EFF6FF 0%, #DBEAFE 100%)', border: '1px solid #BFDBFE', borderRadius: '16px', padding: '20px', display: 'flex', alignItems: 'center', gap: '14px' }}>
                    <div style={{ padding: '12px', borderRadius: '12px', background: 'white', color: '#1E6BFF', boxShadow: '0 4px 10px rgba(30,107,255,0.05)' }}>
                        <Users size={22} />
                    </div>
                    <div>
                        <span style={{ fontSize: '12px', color: '#1E40AF', fontWeight: '700', textTransform: 'uppercase' }}>Lifetime Plans</span>
                        <strong style={{ fontSize: '24px', fontWeight: '800', color: '#1E3A8A', display: 'block', marginTop: '2px' }}>{lifetimeClients}</strong>
                    </div>
                </div>

                <div className="kpi-card" style={{ background: 'linear-gradient(135deg, #F5F3FF 0%, #EDE9FE 100%)', border: '1px solid #DDD6FE', borderRadius: '16px', padding: '20px', display: 'flex', alignItems: 'center', gap: '14px' }}>
                    <div style={{ padding: '12px', borderRadius: '12px', background: 'white', color: '#7C3AED', boxShadow: '0 4px 10px rgba(124,58,237,0.05)' }}>
                        <RefreshCw size={22} />
                    </div>
                    <div>
                        <span style={{ fontSize: '12px', color: '#5B21B6', fontWeight: '700', textTransform: 'uppercase' }}>Yearly Plans</span>
                        <strong style={{ fontSize: '24px', fontWeight: '800', color: '#4C1D95', display: 'block', marginTop: '2px' }}>{yearlyClients}</strong>
                    </div>
                </div>

                <div className="kpi-card" style={{ background: 'linear-gradient(135deg, #FFFBEB 0%, #FEF3C7 100%)', border: '1px solid #FCD34D', borderRadius: '16px', padding: '20px', display: 'flex', alignItems: 'center', gap: '14px' }}>
                    <div style={{ padding: '12px', borderRadius: '12px', background: 'white', color: '#D97706', boxShadow: '0 4px 10px rgba(217,119,6,0.05)' }}>
                        <AlertTriangle size={22} />
                    </div>
                    <div>
                        <span style={{ fontSize: '12px', color: '#92400E', fontWeight: '700', textTransform: 'uppercase' }}>Expiring Soon</span>
                        <strong style={{ fontSize: '24px', fontWeight: '800', color: '#78350F', display: 'block', marginTop: '2px' }}>{expiringThisMonth}</strong>
                    </div>
                </div>

                <div className="kpi-card" style={{ background: 'linear-gradient(135deg, #FEF2F2 0%, #FEE2E2 100%)', border: '1px solid #FCA5A5', borderRadius: '16px', padding: '20px', display: 'flex', alignItems: 'center', gap: '14px' }}>
                    <div style={{ padding: '12px', borderRadius: '12px', background: 'white', color: '#EF4444', boxShadow: '0 4px 10px rgba(239,68,68,0.05)' }}>
                        <AlertTriangle size={22} />
                    </div>
                    <div>
                        <span style={{ fontSize: '12px', color: '#991B1B', fontWeight: '700', textTransform: 'uppercase' }}>Expired SaaS</span>
                        <strong style={{ fontSize: '24px', fontWeight: '800', color: '#7F1D1D', display: 'block', marginTop: '2px' }}>{expiredShops}</strong>
                    </div>
                </div>

                <div className="kpi-card" style={{ background: 'linear-gradient(135deg, #ECFDF5 0%, #D1FAE5 100%)', border: '1px solid #6EE7B7', borderRadius: '16px', padding: '20px', display: 'flex', alignItems: 'center', gap: '14px' }}>
                    <div style={{ padding: '12px', borderRadius: '12px', background: 'white', color: '#059669', boxShadow: '0 4px 10px rgba(5,150,105,0.05)' }}>
                        <DollarSign size={22} />
                    </div>
                    <div>
                        <span style={{ fontSize: '12px', color: '#065F46', fontWeight: '700', textTransform: 'uppercase' }}>Total Revenue</span>
                        <strong style={{ fontSize: '24px', fontWeight: '800', color: '#064E3B', display: 'block', marginTop: '2px' }}>₹{revenueFromPlans.toLocaleString()}</strong>
                    </div>
                </div>

                <div className="kpi-card" style={{ background: 'linear-gradient(135deg, #F5F3FF 0%, #EDE9FE 100%)', border: '1px solid #DDD6FE', borderRadius: '16px', padding: '20px', display: 'flex', alignItems: 'center', gap: '14px' }}>
                    <div style={{ padding: '12px', borderRadius: '12px', background: 'white', color: '#7C3AED', boxShadow: '0 4px 10px rgba(124,58,237,0.05)' }}>
                        <TrendingUp size={22} />
                    </div>
                    <div>
                        <span style={{ fontSize: '12px', color: '#5B21B6', fontWeight: '700', textTransform: 'uppercase' }}>Renewal Rate</span>
                        <strong style={{ fontSize: '24px', fontWeight: '800', color: '#4C1D95', display: 'block', marginTop: '2px' }}>{renewalRate}%</strong>
                    </div>
                </div>
            </div>

            {/* Warnings banner */}
            {warnings.length > 0 && (
                <div style={{ background: '#FFFBEB', border: '1.5px solid #FCD34D', borderRadius: '16px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <h4 style={{ margin: 0, color: '#B45309', fontSize: '15px', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <AlertTriangle size={18} />
                        <span>Plan Expirations Impending (Next 30 Days)</span>
                    </h4>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '12px' }}>
                        {warnings.map((w, idx) => (
                            <div key={idx} style={{ background: 'white', padding: '12px', borderRadius: '10px', border: '1px solid #FCD34D', fontSize: '13px' }}>
                                <strong style={{ color: '#0F172A', display: 'block' }}>{w.shopName}</strong>
                                <span style={{ color: '#64748B', display: 'block', marginTop: '4px' }}>{w.planType} Plan • <strong style={{ color: '#D97706' }}>{w.daysLeft} days left</strong></span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Tab Selection */}
            <div style={{ display: 'flex', borderBottom: '1.5px solid #E2E8F0', gap: '24px', margin: '8px 0' }}>
                <button 
                    onClick={() => setActiveTab('registry')} 
                    style={{ 
                        background: 'none', border: 'none', borderBottom: activeTab === 'registry' ? '3px solid #3B82F6' : '3px solid transparent', 
                        padding: '12px 6px', fontWeight: '800', fontSize: '15px', color: activeTab === 'registry' ? '#3B82F6' : '#64748B', 
                        cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', transition: '0.2s'
                    }}
                >
                    <CreditCard size={18} /> Subscription Directory
                </button>
                <button 
                    onClick={() => setActiveTab('history')} 
                    style={{ 
                        background: 'none', border: 'none', borderBottom: activeTab === 'history' ? '3px solid #3B82F6' : '3px solid transparent', 
                        padding: '12px 6px', fontWeight: '800', fontSize: '15px', color: activeTab === 'history' ? '#3B82F6' : '#64748B', 
                        cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', transition: '0.2s'
                    }}
                >
                    <Receipt size={18} /> Payment & Renewal History
                </button>
            </div>

            {/* Tab Content 1: Active Directory */}
            {activeTab === 'registry' && (
                <div style={{ background: 'white', border: '1px solid #E2E8F0', borderRadius: '20px', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.02)', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    
                    {/* Filters Row */}
                    <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
                        <div className="search-box" style={{ flex: 1, minWidth: '260px', height: '40px', border: '1.5px solid #E2E8F0', borderRadius: '8px', display: 'flex', alignItems: 'center', padding: '0 12px', gap: 8 }}>
                            <Search size={16} color="#94A3B8" />
                            <input 
                                type="text" 
                                placeholder="Search by shop name..." 
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                style={{ border: 'none', outline: 'none', width: '100%', fontSize: '13px', fontWeight: '600' }}
                            />
                        </div>
                        
                        <div style={{ display: 'flex', gap: '6px' }}>
                            {['All', 'Active', 'Expiring', 'Expired', 'Lifetime', 'Yearly'].map(pill => (
                                <button
                                    key={pill}
                                    onClick={() => setFilter(pill)}
                                    style={{
                                        padding: '6px 14px',
                                        fontSize: '12px',
                                        fontWeight: '700',
                                        borderRadius: '8px',
                                        cursor: 'pointer',
                                        border: '1.5px solid',
                                        borderColor: filter === pill ? '#3B82F6' : '#E2E8F0',
                                        background: filter === pill ? '#EFF6FF' : 'white',
                                        color: filter === pill ? '#3B82F6' : '#475569',
                                        transition: '0.2s'
                                    }}
                                >
                                    {pill}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Table */}
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '850px' }}>
                            <thead>
                                <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
                                    <th style={{ padding: '14px 16px', fontSize: '12px', color: '#64748B', fontWeight: '800', textTransform: 'uppercase' }}>Shop Name</th>
                                    <th style={{ padding: '14px 16px', fontSize: '12px', color: '#64748B', fontWeight: '800', textTransform: 'uppercase' }}>Current Plan</th>
                                    <th style={{ padding: '14px 16px', fontSize: '12px', color: '#64748B', fontWeight: '800', textTransform: 'uppercase' }}>Expiry Status</th>
                                    <th style={{ padding: '14px 16px', fontSize: '12px', color: '#64748B', fontWeight: '800', textTransform: 'uppercase' }}>SaaS Activity Metrics</th>
                                    <th style={{ padding: '14px 16px', fontSize: '12px', color: '#64748B', fontWeight: '800', textTransform: 'uppercase' }}>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredSubs.length === 0 ? (
                                    <tr>
                                        <td colSpan="5" style={{ padding: '40px', textAlign: 'center', color: '#64748B', fontSize: '14px', fontStyle: 'italic' }}>
                                            No active subscriptions found matching criteria.
                                        </td>
                                    </tr>
                                ) : (
                                    filteredSubs.map((sub, i) => (
                                        <tr key={i} style={{ borderBottom: '1px solid #F1F5F9' }}>
                                            <td style={{ padding: '14px 16px' }}>
                                                <strong style={{ fontSize: '14px', color: '#0F172A' }}>{sub.shop?.name || 'Walk-in Shop'}</strong>
                                                <span style={{ fontSize: '11px', color: '#94A3B8', display: 'block', marginTop: '2px' }}>Last Active: {new Date(sub.lastActiveTime).toLocaleDateString()}</span>
                                            </td>
                                            <td style={{ padding: '14px 16px' }}>
                                                <span className={`plan-badge ${sub.planType.toLowerCase()}`}>
                                                    {sub.planType} {sub.isLifetime && '♾️'}
                                                </span>
                                            </td>
                                            <td style={{ padding: '14px 16px' }}>
                                                <span className={`status-pill ${sub.planStatus.toLowerCase().replace(' ', '-')}`}>
                                                    {sub.planStatus}
                                                </span>
                                                <span style={{ fontSize: '11px', color: '#64748B', display: 'block', marginTop: '4px' }}>
                                                    {sub.planType === 'Lifetime' ? 'Never expires' : (sub.planEndDate ? `Expires ${new Date(sub.planEndDate).toLocaleDateString()}` : 'N/A')}
                                                </span>
                                            </td>
                                            <td style={{ padding: '14px 16px' }}>
                                                <strong style={{ fontSize: '13px', color: '#334155', display: 'block' }}>₹{sub.revenueGenerated.toLocaleString()}</strong>
                                                <span style={{ fontSize: '11px', color: '#64748B' }}>{sub.billingCount} total bills logged</span>
                                            </td>
                                            <td style={{ padding: '14px 16px' }}>
                                                <button 
                                                    onClick={() => handleOpenRenewModal(sub.shop?._id)}
                                                    style={{ height: '32px', background: 'white', border: '1.5px solid #3B82F6', color: '#3B82F6', fontWeight: '700', borderRadius: '8px', padding: '0 12px', fontSize: '12px', cursor: 'pointer', transition: '0.2s' }}
                                                    onMouseOver={e => { e.currentTarget.style.background = '#EFF6FF' }}
                                                    onMouseOut={e => { e.currentTarget.style.background = 'white' }}
                                                >
                                                    Renew / Convert Plan
                                                </button>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Tab Content 2: Payment & Renewal Logs */}
            {activeTab === 'history' && (
                <div style={{ background: 'white', border: '1px solid #E2E8F0', borderRadius: '20px', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.02)', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '800', color: '#0F172A' }}>Transaction History</h3>
                        <button onClick={fetchHistory} style={{ background: 'none', border: 'none', color: '#3B82F6', fontWeight: '700', cursor: 'pointer', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <RefreshCw size={14} /> Refresh Logs
                        </button>
                    </div>

                    {historyLoading ? (
                        <div style={{ display: 'flex', justifyContent: 'center', padding: '60px 0' }}>
                            <div className="spinner" style={{ width: '30px', height: '30px', border: '3px solid #F1F5F9', borderTopColor: '#3B82F6', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                        </div>
                    ) : (
                        <div style={{ overflowX: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '950px' }}>
                                <thead>
                                    <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
                                        <th style={{ padding: '14px 16px', fontSize: '12px', color: '#64748B', fontWeight: '800', textTransform: 'uppercase' }}>Timestamp</th>
                                        <th style={{ padding: '14px 16px', fontSize: '12px', color: '#64748B', fontWeight: '800', textTransform: 'uppercase' }}>Shop Name</th>
                                        <th style={{ padding: '14px 16px', fontSize: '12px', color: '#64748B', fontWeight: '800', textTransform: 'uppercase' }}>Invoice No.</th>
                                        <th style={{ padding: '14px 16px', fontSize: '12px', color: '#64748B', fontWeight: '800', textTransform: 'uppercase' }}>Type</th>
                                        <th style={{ padding: '14px 16px', fontSize: '12px', color: '#64748B', fontWeight: '800', textTransform: 'uppercase' }}>Plan Type</th>
                                        <th style={{ padding: '14px 16px', fontSize: '12px', color: '#64748B', fontWeight: '800', textTransform: 'uppercase' }}>Paid Amount</th>
                                        <th style={{ padding: '14px 16px', fontSize: '12px', color: '#64748B', fontWeight: '800', textTransform: 'uppercase' }}>Mode</th>
                                        <th style={{ padding: '14px 16px', fontSize: '12px', color: '#64748B', fontWeight: '800', textTransform: 'uppercase' }}>Performed By</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {historyList.length === 0 ? (
                                        <tr>
                                            <td colSpan="8" style={{ padding: '40px', textAlign: 'center', color: '#64748B', fontSize: '14px', fontStyle: 'italic' }}>
                                                No subscription updates or payment history logged yet.
                                            </td>
                                        </tr>
                                    ) : (
                                        historyList.map((log, i) => (
                                            <tr key={i} style={{ borderBottom: '1px solid #F1F5F9' }}>
                                                <td style={{ padding: '14px 16px', fontSize: '13px', color: '#64748B' }}>
                                                    {new Date(log.timestamp).toLocaleString()}
                                                </td>
                                                <td style={{ padding: '14px 16px' }}>
                                                    <strong style={{ fontSize: '14px', color: '#334155' }}>{log.shop?.name || 'Walk-in Shop'}</strong>
                                                </td>
                                                <td style={{ padding: '14px 16px', fontSize: '13px', color: '#475569', fontFamily: 'monospace', fontWeight: '600' }}>
                                                    {log.invoiceNumber || 'N/A'}
                                                </td>
                                                <td style={{ padding: '14px 16px' }}>
                                                    <span style={{ 
                                                        fontSize: '11px', 
                                                        fontWeight: '800', 
                                                        background: log.renewalType === 'Renew' ? '#F5F3FF' : log.renewalType === 'Convert' ? '#ECFDF5' : '#F1F5F9',
                                                        color: log.renewalType === 'Renew' ? '#7C3AED' : log.renewalType === 'Convert' ? '#059669' : '#475569',
                                                        padding: '3px 8px',
                                                        borderRadius: '6px',
                                                        textTransform: 'uppercase'
                                                    }}>
                                                        {log.renewalType}
                                                    </span>
                                                </td>
                                                <td style={{ padding: '14px 16px' }}>
                                                    <span className={`plan-badge ${log.planType.toLowerCase()}`}>
                                                        {log.planType}
                                                    </span>
                                                </td>
                                                <td style={{ padding: '14px 16px' }}>
                                                    <strong style={{ fontSize: '14px', color: '#0F172A' }}>₹{log.amountPaid.toLocaleString()}</strong>
                                                </td>
                                                <td style={{ padding: '14px 16px', fontSize: '13px', color: '#475569', fontWeight: '700' }}>
                                                    {log.paymentMode}
                                                </td>
                                                <td style={{ padding: '14px 16px', fontSize: '13px', color: '#64748B' }}>
                                                    {log.performedBy?.name || 'System Admin'}
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}

            {/* Manual Renewal Modal */}
            {showRenewModal && (
                <div className="modal-overlay" style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.4)', backdropFilter: 'blur(8px)', zIndex: 2500, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '20px' }}>
                    <div className="modal-card" style={{ background: 'white', borderRadius: '24px', border: '1px solid #E2E8F0', padding: '30px', maxWidth: '500px', width: '100%', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #F1F5F9', paddingBottom: '16px' }}>
                            <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <Plus size={20} color="#3B82F6" /> Manual Renewal / Plan Change
                            </h3>
                            <button onClick={() => setShowRenewModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '6px', borderRadius: '8px' }}>
                                <X size={20} color="#64748B" />
                            </button>
                        </div>
                        
                        <form onSubmit={handleRenewSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            {/* Target Shop */}
                            <div>
                                <label style={{ fontSize: '12px', fontWeight: '700', color: '#64748B', display: 'block', marginBottom: '6px' }}>Target Shop</label>
                                <select 
                                    value={renewForm.shopId}
                                    onChange={e => setRenewForm({ ...renewForm, shopId: e.target.value })}
                                    required
                                    style={{ width: '100%', height: '40px', padding: '0 10px', borderRadius: '8px', border: '1.5px solid #D0D5DD', fontSize: '14px', outline: 'none' }}
                                >
                                    <option value="">-- Select Shop --</option>
                                    {shopsList.map(shop => (
                                        <option key={shop._id} value={shop._id}>{shop.name} (Owner: {shop.ownerName})</option>
                                    ))}
                                </select>
                            </div>
                            
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                {/* Plan Type */}
                                <div>
                                    <label style={{ fontSize: '12px', fontWeight: '700', color: '#64748B', display: 'block', marginBottom: '6px' }}>Plan Type</label>
                                    <select 
                                        value={renewForm.planType}
                                        onChange={e => setRenewForm({ ...renewForm, planType: e.target.value })}
                                        style={{ width: '100%', height: '40px', padding: '0 10px', borderRadius: '8px', border: '1.5px solid #D0D5DD', fontSize: '14px', outline: 'none' }}
                                    >
                                        <option value="Yearly">Yearly</option>
                                        <option value="Lifetime">Lifetime</option>
                                    </select>
                                </div>

                                {/* Renewal Type */}
                                <div>
                                    <label style={{ fontSize: '12px', fontWeight: '700', color: '#64748B', display: 'block', marginBottom: '6px' }}>Renewal Type</label>
                                    <select 
                                        value={renewForm.renewalType}
                                        onChange={e => setRenewForm({ ...renewForm, renewalType: e.target.value })}
                                        style={{ width: '100%', height: '40px', padding: '0 10px', borderRadius: '8px', border: '1.5px solid #D0D5DD', fontSize: '14px', outline: 'none' }}
                                    >
                                        <option value="Renew">Renew</option>
                                        <option value="New">New Activation</option>
                                        <option value="Extend">Extend Validity</option>
                                        <option value="Convert">Convert Plan</option>
                                    </select>
                                </div>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                {/* Amount Paid */}
                                <div>
                                    <label style={{ fontSize: '12px', fontWeight: '700', color: '#64748B', display: 'block', marginBottom: '6px' }}>Amount Paid (₹)</label>
                                    <input 
                                        type="number"
                                        placeholder="e.g. 4999"
                                        value={renewForm.amountPaid}
                                        onChange={e => setRenewForm({ ...renewForm, amountPaid: e.target.value })}
                                        style={{ width: '100%', height: '40px', padding: '0 12px', borderRadius: '8px', border: '1.5px solid #D0D5DD', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }}
                                    />
                                </div>

                                {/* Payment Mode */}
                                <div>
                                    <label style={{ fontSize: '12px', fontWeight: '700', color: '#64748B', display: 'block', marginBottom: '6px' }}>Payment Mode</label>
                                    <select 
                                        value={renewForm.paymentMode}
                                        onChange={e => setRenewForm({ ...renewForm, paymentMode: e.target.value })}
                                        style={{ width: '100%', height: '40px', padding: '0 10px', borderRadius: '8px', border: '1.5px solid #D0D5DD', fontSize: '14px', outline: 'none' }}
                                    >
                                        <option value="UPI">UPI</option>
                                        <option value="Cash">Cash</option>
                                        <option value="Net Banking">Net Banking</option>
                                        <option value="Card">Credit/Debit Card</option>
                                        <option value="None">None</option>
                                    </select>
                                </div>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                {/* Invoice Number */}
                                <div>
                                    <label style={{ fontSize: '12px', fontWeight: '700', color: '#64748B', display: 'block', marginBottom: '6px' }}>Invoice Number (Optional)</label>
                                    <input 
                                        type="text"
                                        placeholder="e.g. INV-1002"
                                        value={renewForm.invoiceNumber}
                                        onChange={e => setRenewForm({ ...renewForm, invoiceNumber: e.target.value })}
                                        style={{ width: '100%', height: '40px', padding: '0 12px', borderRadius: '8px', border: '1.5px solid #D0D5DD', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }}
                                    />
                                </div>

                                {/* Start Date */}
                                <div>
                                    <label style={{ fontSize: '12px', fontWeight: '700', color: '#64748B', display: 'block', marginBottom: '6px' }}>Plan Start Date</label>
                                    <input 
                                        type="date"
                                        value={renewForm.planStartDate}
                                        onChange={e => setRenewForm({ ...renewForm, planStartDate: e.target.value })}
                                        style={{ width: '100%', height: '40px', padding: '0 12px', borderRadius: '8px', border: '1.5px solid #D0D5DD', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }}
                                    />
                                </div>
                            </div>

                            <div style={{ display: 'flex', gap: '10px', marginTop: '16px' }}>
                                <button 
                                    type="button"
                                    onClick={() => setShowRenewModal(false)}
                                    style={{ flex: 1, height: '44px', background: '#F1F5F9', color: '#475569', border: 'none', borderRadius: '10px', fontWeight: '700', cursor: 'pointer' }}
                                >
                                    Cancel
                                </button>
                                <button 
                                    type="submit"
                                    disabled={renewSaving}
                                    style={{ flex: 1, height: '44px', background: '#3B82F6', color: 'white', border: 'none', borderRadius: '10px', fontWeight: '700', cursor: 'pointer' }}
                                >
                                    {renewSaving ? 'Saving...' : 'Apply Subscription'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            <style jsx="true">{`
                .plan-badge { display: inline-block; padding: 2px 8px; font-size: 11px; font-weight: 800; border-radius: 6px; text-transform: uppercase; }
                .plan-badge.trial { background: #F1F5F9; color: #475569; border: 1px solid #E2E8F0; }
                .plan-badge.monthly { background: #EFF6FF; color: #1E6BFF; border: 1px solid #BFDBFE; }
                .plan-badge.yearly { background: #F5F3FF; color: #7C3AED; border: 1px solid #DDD6FE; }
                .plan-badge.lifetime { background: #ECFDF5; color: #059669; border: 1px solid #A7F3D0; }

                .status-pill { display: inline-flex; padding: 4px 10px; border-radius: 8px; font-size: 12px; font-weight: 700; text-transform: uppercase; }
                .status-pill.active { background: #ECFDF5; color: #067647; border: 1px solid #ABEFC6; }
                .status-pill.lifetime-active { background: #ECFDF5; color: #067647; border: 1px solid #ABEFC6; }
                .status-pill.expiring-soon { background: #FFFBEB; color: #B45309; border: 1px solid #FCD34D; }
                .status-pill.expired { background: #FEF3F2; color: #B42318; border: 1px solid #FECDCA; }
            `}</style>
        </div>
    );
};

export default AdminSubscriptions;
