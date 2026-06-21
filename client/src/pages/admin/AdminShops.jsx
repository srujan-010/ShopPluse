import React, { useState, useEffect } from 'react';
import { 
    Search, 
    Filter, 
    MapPin, 
    User, 
    Phone, 
    Clock, 
    Calendar,
    Smartphone, 
    Package, 
    DollarSign,
    CheckCircle,
    X,
    TrendingUp,
    ShieldAlert,
    HelpCircle
} from 'lucide-react';
import api from '../../services/api';
import { useToast } from '../../context/ToastContext';

const AdminShops = () => {
    const { showToast } = useToast();
    const [shops, setShops] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState('All');
    const [planFilter, setPlanFilter] = useState('All');
    const [loading, setLoading] = useState(true);
    
    const [dateRangeType, setDateRangeType] = useState('today');
    const [customStartDate, setCustomStartDate] = useState('');
    const [customEndDate, setCustomEndDate] = useState('');
    
    // Details Drawer state
    const [selectedShop, setSelectedShop] = useState(null);
    const [shopDetails, setShopDetails] = useState(null);
    const [detailsLoading, setDetailsLoading] = useState(false);
    
    // Plan update state
    const [showPlanEdit, setShowPlanEdit] = useState(false);
    const [newPlan, setNewPlan] = useState({ planType: 'Yearly', isLifetime: false, durationMonths: 12 });
    const [planSaving, setPlanSaving] = useState(false);

    // Danger Zone state
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [deleteConfirmPassword, setDeleteConfirmPassword] = useState('');
    const [deleteConfirmText, setDeleteConfirmText] = useState('');
    const [deleteLoading, setDeleteLoading] = useState(false);

    const handleToggleStatus = async (field, currentValue) => {
        try {
            const body = {};
            if (field === 'isSuspended') body.isSuspended = !currentValue;
            if (field === 'isLoginDisabled') body.isLoginDisabled = !currentValue;
            
            await api.put(`/api/admin/shops/${selectedShop._id}/status`, body);
            showToast("Shop settings updated successfully!", "success");
            
            // Refresh
            triggerRefresh();
            fetchShopDetails(selectedShop._id);
        } catch (err) {
            showToast(err.response?.data?.message || "Failed to update shop status.", "error");
        }
    };

    const handleDeleteShop = async () => {
        if (deleteConfirmText !== 'DELETE SHOP') return;
        try {
            setDeleteLoading(true);
            const res = await api.delete(`/api/admin/shops/${selectedShop._id}`, {
                data: { password: deleteConfirmPassword }
            });
            showToast(res.data.message || "Shop permanently deleted.", "success");
            setShowDeleteConfirm(false);
            setDeleteConfirmPassword('');
            setDeleteConfirmText('');
            handleCloseDetails();
            triggerRefresh();
        } catch (err) {
            showToast(err.response?.data?.message || "Incorrect admin password or deletion failed.", "error");
        } finally {
            setDeleteLoading(false);
        }
    };

    const fetchShops = async (startDate, endDate) => {
        try {
            setLoading(true);
            let url = '/api/admin/shops';
            const params = [];
            if (startDate) params.push(`startDate=${startDate}`);
            if (endDate) params.push(`endDate=${endDate}`);
            if (params.length > 0) {
                url += `?${params.join('&')}`;
            }
            const res = await api.get(url);
            setShops(res.data.data);
        } catch (e) {
            console.error("Failed to fetch shops:", e);
        } finally {
            setLoading(false);
        }
    };

    const triggerRefresh = () => {
        let startStr = '';
        let endStr = '';
        if (dateRangeType === 'yesterday') {
            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);
            const yyyy = yesterday.getFullYear();
            const mm = String(yesterday.getMonth() + 1).padStart(2, '0');
            const dd = String(yesterday.getDate()).padStart(2, '0');
            startStr = `${yyyy}-${mm}-${dd}`;
            endStr = `${yyyy}-${mm}-${dd}`;
        } else if (dateRangeType === 'custom') {
            if (customStartDate && customEndDate) {
                startStr = customStartDate;
                endStr = customEndDate;
            } else {
                return;
            }
        }
        fetchShops(startStr, endStr);
    };

    const fetchShopDetails = async (shopId) => {
        try {
            setDetailsLoading(true);
            const res = await api.get(`/api/admin/shops/${shopId}`);
            setShopDetails(res.data.data);
        } catch (e) {
            console.error("Failed to load shop details:", e);
            showToast("Failed to retrieve shop profile.", "error");
        } finally {
            setDetailsLoading(false);
        }
    };

    useEffect(() => {
        triggerRefresh();
    }, [dateRangeType, customStartDate, customEndDate]);

    const handleOpenDetails = (shop) => {
        setSelectedShop(shop);
        setShowPlanEdit(false);
        fetchShopDetails(shop._id);
    };

    const handleCloseDetails = () => {
        setSelectedShop(null);
        setShopDetails(null);
        setShowPlanEdit(false);
    };

    const handleUpdatePlan = async (e) => {
        e.preventDefault();
        try {
            setPlanSaving(true);
            await api.put(`/api/admin/subscriptions/${selectedShop._id}`, newPlan);
            showToast("Subscription plan updated successfully!", "success");
            setShowPlanEdit(false);
            
            // Refresh
            triggerRefresh();
            fetchShopDetails(selectedShop._id);
        } catch (err) {
            showToast("Failed to update subscription.", "error");
        } finally {
            setPlanSaving(false);
        }
    };

    const formatLastUsed = (lastBillingTime) => {
        if (!lastBillingTime) return "Never used";
        const date = new Date(lastBillingTime);
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 1) return "Just now";
        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffHours < 24) return `${diffHours}h ago`;
        if (diffDays === 1) return "Yesterday";
        if (diffDays < 7) return `${diffDays}d ago`;
        return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
    };

    const getLastUsedStyle = (lastBillingTime) => {
        if (!lastBillingTime) return { color: '#64748B', background: '#F1F5F9' };
        const diffDays = Math.floor((new Date() - new Date(lastBillingTime)) / 86400000);
        if (diffDays < 1) return { color: '#0369A1', background: '#E0F2FE' };
        if (diffDays < 7) return { color: '#B45309', background: '#FEF3C7' };
        return { color: '#4B5563', background: '#F3F4F6' };
    };

    const filteredShops = shops.filter(shop => {
        const matchesSearch = shop.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                              shop.ownerName.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesStatus = statusFilter === 'All' || shop.status === statusFilter;
        const matchesPlan = planFilter === 'All' || shop.planType === planFilter;
        return matchesSearch && matchesStatus && matchesPlan;
    });

    if (loading) {
        return (
            <div className="loader-container" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
                <div className="spinner" style={{ width: '40px', height: '40px', border: '4px solid #E2E8F0', borderTopColor: '#3B82F6', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            </div>
        );
    }

    return (
        <div className="admin-shops" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {/* Filter Bar */}
            <div className="controls-bar" style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center', background: 'white', padding: '16px', borderRadius: '16px', border: '1px solid #E2E8F0' }}>
                <div className="search-box" style={{ flex: 1, minWidth: '260px', height: '44px', border: '1.5px solid #E2E8F0', borderRadius: '10px', display: 'flex', alignItems: 'center', padding: '0 12px', gap: 8 }}>
                    <Search size={18} color="#94A3B8" />
                    <input 
                        type="text" 
                        placeholder="Search shop or owner..." 
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        style={{ border: 'none', outline: 'none', width: '100%', fontSize: '14px', fontWeight: '600' }}
                    />
                </div>
                
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                    <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="filter-select">
                        <option value="All">All Statuses</option>
                        <option value="Active">Active</option>
                        <option value="Idle">Idle</option>
                        <option value="Inactive">Inactive</option>
                    </select>

                    <select value={planFilter} onChange={e => setPlanFilter(e.target.value)} className="filter-select">
                        <option value="All">All Plans</option>
                        <option value="Trial">Trial</option>
                        <option value="Monthly">Monthly</option>
                        <option value="Yearly">Yearly</option>
                        <option value="Lifetime">Lifetime</option>
                    </select>

                    <select value={dateRangeType} onChange={e => setDateRangeType(e.target.value)} className="filter-select">
                        <option value="today">Today's Activity</option>
                        <option value="yesterday">Yesterday's Activity</option>
                        <option value="custom">Custom Date Range</option>
                    </select>
                    
                    {dateRangeType === 'custom' && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#F8FAFC', padding: '4px 10px', borderRadius: '10px', border: '1.5px solid #E2E8F0', height: '44px', boxSizing: 'border-box' }}>
                            <input 
                                type="date" 
                                value={customStartDate} 
                                onChange={e => setCustomStartDate(e.target.value)} 
                                style={{ border: 'none', background: 'transparent', outline: 'none', fontSize: '13px', fontWeight: '700', color: '#475569' }} 
                            />
                            <span style={{ fontSize: '12px', color: '#94A3B8', fontWeight: '800' }}>to</span>
                            <input 
                                type="date" 
                                value={customEndDate} 
                                onChange={e => setCustomEndDate(e.target.value)} 
                                style={{ border: 'none', background: 'transparent', outline: 'none', fontSize: '13px', fontWeight: '700', color: '#475569' }} 
                            />
                        </div>
                    )}
                </div>
            </div>

            {/* Desktop Table Wrapper */}
            <div className="table-wrapper" style={{ background: 'white', borderRadius: '20px', border: '1px solid #E2E8F0', overflowX: 'auto', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '1000px' }}>
                    <thead>
                        <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
                            <th style={{ padding: '18px 24px', fontSize: '12px', color: '#64748B', fontWeight: '800', textTransform: 'uppercase' }}>Shop details</th>
                            <th style={{ padding: '18px 24px', fontSize: '12px', color: '#64748B', fontWeight: '800', textTransform: 'uppercase' }}>Owner / Contact</th>
                            <th style={{ padding: '18px 24px', fontSize: '12px', color: '#64748B', fontWeight: '800', textTransform: 'uppercase' }}>Plan</th>
                            <th style={{ padding: '18px 24px', fontSize: '12px', color: '#64748B', fontWeight: '800', textTransform: 'uppercase' }}>
                                {dateRangeType === 'today' ? "Today's Activity" : dateRangeType === 'yesterday' ? "Yesterday's Activity" : "Selected Period Activity"}
                            </th>
                            <th style={{ padding: '18px 24px', fontSize: '12px', color: '#64748B', fontWeight: '800', textTransform: 'uppercase' }}>Sync</th>
                            <th style={{ padding: '18px 24px', fontSize: '12px', color: '#64748B', fontWeight: '800', textTransform: 'uppercase' }}>Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredShops.map((shop) => (
                            <tr 
                                key={shop._id} 
                                className="shop-table-row"
                                onClick={() => handleOpenDetails(shop)}
                                style={{ borderBottom: '1px solid #F1F5F9', cursor: 'pointer', transition: '0.2s' }}
                            >
                                <td style={{ padding: '18px 24px' }}>
                                    <strong style={{ fontSize: '15px', color: '#0F172A', display: 'block' }}>{shop.name}</strong>
                                    <span style={{ fontSize: '12px', color: '#64748B', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '4px' }}>
                                        <MapPin size={12} /> {shop.location} • {shop.shopType}
                                    </span>
                                    <span style={{ 
                                        fontSize: '11px', 
                                        ...getLastUsedStyle(shop.lastBillingTime),
                                        padding: '2px 8px', 
                                        borderRadius: '6px', 
                                        display: 'inline-flex', 
                                        alignItems: 'center', 
                                        gap: '4px', 
                                        marginTop: '6px', 
                                        fontWeight: '800' 
                                    }}>
                                        <Clock size={10} /> Last Used: {formatLastUsed(shop.lastBillingTime)}
                                    </span>
                                </td>
                                <td style={{ padding: '18px 24px' }}>
                                    <span style={{ fontSize: '14px', fontWeight: '700', color: '#334155', display: 'block' }}>{shop.ownerName}</span>
                                    <span style={{ fontSize: '12px', color: '#64748B', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '4px' }}>
                                        <Phone size={12} /> {shop.ownerPhone}
                                    </span>
                                </td>
                                <td style={{ padding: '18px 24px' }}>
                                    <span className={`plan-badge ${shop.planType.toLowerCase()}`}>
                                        {shop.planType} {shop.isLifetime && '♾️'}
                                    </span>
                                    <span style={{ fontSize: '11px', color: '#94A3B8', display: 'block', marginTop: '4px' }}>
                                        {shop.planEndDate ? `Expires ${new Date(shop.planEndDate).toLocaleDateString()}` : 'No expiry'}
                                    </span>
                                </td>
                                <td style={{ padding: '18px 24px' }}>
                                    <strong style={{ fontSize: '14px', color: '#0F172A', display: 'block' }}>₹{shop.todayRevenue.toLocaleString()}</strong>
                                    <span style={{ fontSize: '11px', color: '#64748B' }}>{shop.todayBills} bills generated</span>
                                </td>
                                <td style={{ padding: '18px 24px' }}>
                                    <span style={{ 
                                        fontSize: '12px', 
                                        fontWeight: '800', 
                                        color: shop.syncStatus === 'Synced' ? '#10B981' : '#F59E0B',
                                        background: shop.syncStatus === 'Synced' ? '#ECFDF5' : '#FFFBEB',
                                        padding: '2px 8px',
                                        borderRadius: '6px'
                                    }}>
                                        {shop.syncStatus === 'Synced' ? '🟢 Synced' : `🟡 ${shop.pendingSyncs} Pending`}
                                    </span>
                                </td>
                                <td style={{ padding: '18px 24px' }}>
                                    <span className={`status-pill-new ${shop.status.toLowerCase()}`}>
                                        {shop.status === 'Active' ? '🟢 Active' : shop.status === 'Idle' ? '🟡 Idle' : '🔴 Inactive'}
                                    </span>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Shop Details Slide-Over Drawer */}
            {selectedShop && (
                <div className="drawer-overlay" onClick={handleCloseDetails} style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.3)', backdropFilter: 'blur(4px)', zIndex: 2000, display: 'flex', justifyContent: 'flex-end' }}>
                    <div className="drawer-sheet" onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: '500px', height: '100%', background: 'white', borderLeft: '1px solid #E2E8F0', padding: '24px', boxSizing: 'border-box', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '20px', boxShadow: '-10px 0 30px rgba(0,0,0,0.05)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #F1F5F9', paddingBottom: '16px' }}>
                            <div>
                                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '800' }}>{selectedShop.name}</h3>
                                <span style={{ fontSize: '12px', color: '#64748B' }}>ID: #{selectedShop._id}</span>
                            </div>
                            <button onClick={handleCloseDetails} className="close-btn" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '6px', borderRadius: '8px' }}>
                                <X size={20} color="#64748B" />
                            </button>
                        </div>

                        {detailsLoading ? (
                            <div style={{ display: 'flex', justifyContent: 'center', padding: '60px 0' }}>
                                <div className="spinner" style={{ width: '30px', height: '30px', border: '3px solid #F1F5F9', borderTopColor: '#3B82F6', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                            </div>
                        ) : shopDetails ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                                {/* Financial Stats Summary */}
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                    <div style={{ background: '#F8FAFC', padding: '16px', borderRadius: '14px', border: '1px solid #E2E8F0' }}>
                                        <span style={{ fontSize: '11px', color: '#64748B', fontWeight: '700', textTransform: 'uppercase' }}>Lifetime Revenue</span>
                                        <strong style={{ fontSize: '18px', display: 'block', marginTop: '4px', color: '#0F172A' }}>₹{shopDetails.analytics.totalRevenue.toLocaleString()}</strong>
                                    </div>
                                    <div style={{ background: '#FFFBEB', padding: '16px', borderRadius: '14px', border: '1px solid #FCD34D' }}>
                                        <span style={{ fontSize: '11px', color: '#B45309', fontWeight: '700', textTransform: 'uppercase' }}>Khata Credit Dues</span>
                                        <strong style={{ fontSize: '18px', display: 'block', marginTop: '4px', color: '#92400E' }}>₹{shopDetails.analytics.khataDue.toLocaleString()}</strong>
                                    </div>
                                    <div style={{ background: '#F5F3FF', padding: '16px', borderRadius: '14px', border: '1px solid #DDD6FE' }}>
                                        <span style={{ fontSize: '11px', color: '#6D28D9', fontWeight: '700', textTransform: 'uppercase' }}>Bills Generated</span>
                                        <strong style={{ fontSize: '18px', display: 'block', marginTop: '4px', color: '#5B21B6' }}>{shopDetails.analytics.totalBills} bills</strong>
                                    </div>
                                    <div style={{ background: '#ECFEFF', padding: '16px', borderRadius: '14px', border: '1px solid #CFFAFE' }}>
                                        <span style={{ fontSize: '11px', color: '#0891B2', fontWeight: '700', textTransform: 'uppercase' }}>Gov Records</span>
                                        <strong style={{ fontSize: '18px', display: 'block', marginTop: '4px', color: '#0E7490' }}>{shopDetails.analytics.govRecords} entries</strong>
                                    </div>
                                </div>

                                {/* Active Subscription Plan */}
                                <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '16px', padding: '20px' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                                        <span style={{ fontSize: '13px', fontWeight: '800', color: '#334155' }}>Billing & Subscription</span>
                                        <button onClick={() => setShowPlanEdit(!showPlanEdit)} style={{ background: 'none', border: 'none', color: '#3B82F6', fontWeight: '700', fontSize: '13px', cursor: 'pointer' }}>
                                            {showPlanEdit ? 'Cancel' : 'Modify Plan'}
                                        </button>
                                    </div>

                                    {!showPlanEdit ? (
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <div>
                                                <span style={{ fontSize: '15px', fontWeight: '800', color: '#0F172A' }}>{selectedShop.planType} Plan</span>
                                                <span style={{ fontSize: '12px', color: '#64748B', display: 'block', marginTop: '2px' }}>
                                                    {selectedShop.planEndDate ? `Valid until ${new Date(selectedShop.planEndDate).toLocaleDateString()}` : 'No expiry'}
                                                </span>
                                            </div>
                                            <span className={`plan-badge ${selectedShop.planType.toLowerCase()}`}>
                                                {selectedShop.planType}
                                            </span>
                                        </div>
                                    ) : (
                                        <form onSubmit={handleUpdatePlan} style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '12px', borderTop: '1px solid #E2E8F0', paddingTop: '12px' }}>
                                            <div style={{ display: 'flex', gap: '8px' }}>
                                                <select 
                                                    value={newPlan.planType} 
                                                    onChange={e => setNewPlan({ ...newPlan, planType: e.target.value, isLifetime: e.target.value === 'Lifetime' })}
                                                    style={{ flex: 1, height: '40px', padding: '0 8px', borderRadius: '8px', border: '1px solid #D0D5DD', outline: 'none' }}
                                                >
                                                    <option value="Yearly">Yearly</option>
                                                    <option value="Lifetime">Lifetime</option>
                                                </select>
                                            </div>
                                            <button type="submit" disabled={planSaving} className="save-plan-btn" style={{ height: '40px', background: '#3B82F6', color: 'white', border: 'none', borderRadius: '8px', fontWeight: '700', fontSize: '13px', cursor: 'pointer' }}>
                                                {planSaving ? 'Updating...' : 'Save Subscription Changes'}
                                            </button>
                                        </form>
                                    )}
                                </div>

                                {/* Top products */}
                                <div style={{ borderTop: '1px solid #F1F5F9', paddingTop: '16px' }}>
                                    <h4 style={{ margin: '0 0 12px 0', fontSize: '14px', fontWeight: '800' }}>Top Performing Products</h4>
                                    {shopDetails.topProducts.length === 0 ? (
                                        <span style={{ fontSize: '13px', color: '#64748B', fontStyle: 'italic' }}>No sales logged yet.</span>
                                    ) : (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                            {shopDetails.topProducts.map((p, idx) => (
                                                <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: '#F8FAFC', borderRadius: '8px', border: '1px solid #E2E8F0', fontSize: '13px' }}>
                                                    <span style={{ fontWeight: '700', color: '#334155' }}>{p.productName}</span>
                                                    <span style={{ fontWeight: '800', color: '#0F172A' }}>{p.quantity} Units</span>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {/* Device & Version Metadata */}
                                <div style={{ borderTop: '1px solid #F1F5F9', paddingTop: '16px' }}>
                                    <h4 style={{ margin: '0 0 12px 0', fontSize: '14px', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        <Smartphone size={16} /> Device & Sync Diagnostics
                                    </h4>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', background: '#F8FAFC', padding: '12px', borderRadius: '12px', border: '1px solid #E2E8F0', fontSize: '12px' }}>
                                        <div>
                                            <span style={{ color: '#64748B' }}>Device:</span>
                                            <strong style={{ display: 'block', color: '#334155', marginTop: '2px' }}>{shopDetails.device.deviceName}</strong>
                                        </div>
                                        <div>
                                            <span style={{ color: '#64748B' }}>OS / Browser:</span>
                                            <strong style={{ display: 'block', color: '#334155', marginTop: '2px' }}>{shopDetails.device.os} / {shopDetails.device.browser}</strong>
                                        </div>
                                        <div>
                                            <span style={{ color: '#64748B' }}>App Version:</span>
                                            <strong style={{ display: 'block', color: '#334155', marginTop: '2px' }}>{shopDetails.device.appVersion}</strong>
                                        </div>
                                        <div>
                                            <span style={{ color: '#64748B' }}>IP Address:</span>
                                            <strong style={{ display: 'block', color: '#334155', marginTop: '2px' }}>{shopDetails.device.ipAddress}</strong>
                                        </div>
                                        <div style={{ gridColumn: 'span 2', borderTop: '1px solid #E2E8F0', paddingTop: '8px', marginTop: '4px' }}>
                                            <span style={{ color: '#64748B' }}>Last Sync Completed:</span>
                                            <strong style={{ display: 'block', color: '#0F172A', marginTop: '2px' }}>
                                                {new Date(shopDetails.device.lastSync).toLocaleString()}
                                            </strong>
                                        </div>
                                    </div>
                                </div>

                                {/* Danger Zone */}
                                <div style={{ borderTop: '1.5px solid #FEE2E2', paddingTop: '20px', marginTop: '10px' }}>
                                    <h4 style={{ margin: '0 0 12px 0', fontSize: '14px', fontWeight: '800', color: '#991B1B', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        <ShieldAlert size={16} /> Danger Zone
                                    </h4>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#FEF2F2', padding: '12px 16px', borderRadius: '12px', border: '1px solid #FEE2E2' }}>
                                            <div style={{ flex: 1, paddingRight: '12px' }}>
                                                <strong style={{ fontSize: '13px', color: '#991B1B', display: 'block' }}>
                                                    {shopDetails.profile.isSuspended ? 'Shop is Suspended' : 'Suspend Shop'}
                                                </strong>
                                                <span style={{ fontSize: '11px', color: '#B91C1C' }}>
                                                    {shopDetails.profile.isSuspended ? 'Write operations are blocked for this shop.' : 'Temporarily suspend standard POS checkout & updates.'}
                                                </span>
                                            </div>
                                            <button 
                                                onClick={() => handleToggleStatus('isSuspended', shopDetails.profile.isSuspended)} 
                                                style={{ 
                                                    padding: '6px 12px', 
                                                    background: shopDetails.profile.isSuspended ? '#10B981' : '#EF4444', 
                                                    color: 'white', 
                                                    border: 'none', 
                                                    borderRadius: '8px', 
                                                    fontWeight: '700', 
                                                    fontSize: '12px', 
                                                    cursor: 'pointer',
                                                    flexShrink: 0
                                                }}
                                            >
                                                {shopDetails.profile.isSuspended ? 'Unsuspend' : 'Suspend'}
                                            </button>
                                        </div>

                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#FEF2F2', padding: '12px 16px', borderRadius: '12px', border: '1px solid #FEE2E2' }}>
                                            <div style={{ flex: 1, paddingRight: '12px' }}>
                                                <strong style={{ fontSize: '13px', color: '#991B1B', display: 'block' }}>
                                                    {shopDetails.profile.isLoginDisabled ? 'Logins are Disabled' : 'Disable Login'}
                                                </strong>
                                                <span style={{ fontSize: '11px', color: '#B91C1C' }}>
                                                    {shopDetails.profile.isLoginDisabled ? 'Standard users cannot log in.' : 'Deny all access (both read and write) to this shop.'}
                                                </span>
                                            </div>
                                            <button 
                                                onClick={() => handleToggleStatus('isLoginDisabled', shopDetails.profile.isLoginDisabled)} 
                                                style={{ 
                                                    padding: '6px 12px', 
                                                    background: shopDetails.profile.isLoginDisabled ? '#10B981' : '#EF4444', 
                                                    color: 'white', 
                                                    border: 'none', 
                                                    borderRadius: '8px', 
                                                    fontWeight: '700', 
                                                    fontSize: '12px', 
                                                    cursor: 'pointer',
                                                    flexShrink: 0
                                                }}
                                            >
                                                {shopDetails.profile.isLoginDisabled ? 'Enable' : 'Disable'}
                                            </button>
                                        </div>

                                        <button 
                                            onClick={() => setShowDeleteConfirm(true)}
                                            style={{ 
                                                width: '100%', 
                                                height: '40px', 
                                                background: '#DC2626', 
                                                color: 'white', 
                                                border: 'none', 
                                                borderRadius: '10px', 
                                                fontWeight: '700', 
                                                fontSize: '13px', 
                                                cursor: 'pointer',
                                                marginTop: '6px',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                gap: '6px'
                                            }}
                                        >
                                            Delete Shop Permanently
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ) : null}
                    </div>
                </div>
            )}

            {/* Delete Confirmation Modal */}
            {showDeleteConfirm && (
                <div className="modal-overlay" style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.4)', backdropFilter: 'blur(8px)', zIndex: 3000, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '20px' }}>
                    <div className="modal-card" style={{ background: 'white', borderRadius: '24px', border: '1px solid #FEE2E2', padding: '30px', maxWidth: '450px', width: '100%', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', color: '#DC2626' }}>
                            <ShieldAlert size={28} />
                            <h4 style={{ margin: 0, fontSize: '18px', fontWeight: '800' }}>Confirm Permanent Deletion</h4>
                        </div>
                        
                        <p style={{ fontSize: '14px', color: '#475569', lineHeight: '1.6', margin: 0 }}>
                            <strong>WARNING:</strong> This action permanently deletes the shop <strong>"{selectedShop.name}"</strong> and all associated records (sales, products, khata, devices, sync logs). <strong>This cannot be undone.</strong>
                        </p>
                        
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            <div>
                                <label style={{ fontSize: '12px', fontWeight: '700', color: '#64748B', display: 'block', marginBottom: '6px' }}>Admin Password</label>
                                <input 
                                    type="password" 
                                    placeholder="Enter your administrator password" 
                                    value={deleteConfirmPassword}
                                    onChange={e => setDeleteConfirmPassword(e.target.value)}
                                    style={{ width: '100%', height: '40px', padding: '0 12px', borderRadius: '8px', border: '1.5px solid #E2E8F0', outline: 'none', fontSize: '14px', boxSizing: 'border-box' }}
                                />
                            </div>
                            
                            <div>
                                <label style={{ fontSize: '12px', fontWeight: '700', color: '#64748B', display: 'block', marginBottom: '6px' }}>Type phrase: <code style={{ background: '#F1F5F9', padding: '2px 6px', borderRadius: '4px', color: '#DC2626' }}>DELETE SHOP</code></label>
                                <input 
                                    type="text" 
                                    placeholder="Type DELETE SHOP" 
                                    value={deleteConfirmText}
                                    onChange={e => setDeleteConfirmText(e.target.value)}
                                    style={{ width: '100%', height: '40px', padding: '0 12px', borderRadius: '8px', border: '1.5px solid #E2E8F0', outline: 'none', fontSize: '14px', boxSizing: 'border-box' }}
                                />
                            </div>
                        </div>
                        
                        <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                            <button 
                                onClick={() => {
                                    setShowDeleteConfirm(false);
                                    setDeleteConfirmPassword('');
                                    setDeleteConfirmText('');
                                }}
                                style={{ flex: 1, height: '44px', background: '#F1F5F9', color: '#475569', border: 'none', borderRadius: '10px', fontWeight: '700', cursor: 'pointer' }}
                            >
                                Cancel
                            </button>
                            <button 
                                onClick={handleDeleteShop}
                                disabled={deleteConfirmText !== 'DELETE SHOP' || !deleteConfirmPassword || deleteLoading}
                                style={{ 
                                    flex: 1, 
                                    height: '44px', 
                                    background: (deleteConfirmText === 'DELETE SHOP' && deleteConfirmPassword && !deleteLoading) ? '#DC2626' : '#FCA5A5', 
                                    color: 'white', 
                                    border: 'none', 
                                    borderRadius: '10px', 
                                    fontWeight: '700', 
                                    cursor: (deleteConfirmText === 'DELETE SHOP' && deleteConfirmPassword && !deleteLoading) ? 'pointer' : 'not-allowed' 
                                }}
                            >
                                {deleteLoading ? 'Deleting...' : 'Delete Permanently'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
            
            <style jsx="true">{`
                .filter-select { height: 44px; border: 1.5px solid #E2E8F0; border-radius: 10px; background: white; padding: 0 12px; font-size: 14px; font-weight: 700; color: #475467; outline: none; cursor: pointer; }
                .filter-select:hover { border-color: #98A2B3; }
                .shop-table-row:hover { background: #F8FAFC; }
                
                .plan-badge { display: inline-block; padding: 2px 8px; font-size: 11px; font-weight: 800; border-radius: 6px; text-transform: uppercase; }
                .plan-badge.trial { background: #F1F5F9; color: #475569; border: 1px solid #E2E8F0; }
                .plan-badge.monthly { background: #EFF6FF; color: #1E6BFF; border: 1px solid #BFDBFE; }
                .plan-badge.yearly { background: #F5F3FF; color: #7C3AED; border: 1px solid #DDD6FE; }
                .plan-badge.lifetime { background: #ECFDF5; color: #059669; border: 1px solid #A7F3D0; }

                .status-pill-new { display: inline-flex; padding: 4px 10px; border-radius: 8px; font-size: 12px; font-weight: 700; }
                .status-pill-new.active { background: #ECFDF5; color: #067647; border: 1px solid #ABEFC6; }
                .status-pill-new.idle { background: #FFFBEB; color: #B45309; border: 1px solid #FCD34D; }
                .status-pill-new.inactive { background: #FEF3F2; color: #B42318; border: 1px solid #FECDCA; }
            `}</style>
        </div>
    );
};

export default AdminShops;
