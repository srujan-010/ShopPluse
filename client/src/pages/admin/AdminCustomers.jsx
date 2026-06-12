import React, { useState, useEffect } from 'react';
import { 
    Search, 
    Users, 
    AlertCircle, 
    ArrowUpRight,
    TrendingUp,
    Briefcase,
    Phone,
    MapPin,
    DollarSign,
    Heart
} from 'lucide-react';
import api from '../../services/api';

const AdminCustomers = () => {
    const [customerData, setCustomerData] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [onlyDueFilter, setOnlyDueFilter] = useState(false);
    const [loading, setLoading] = useState(true);

    const fetchCustomers = async () => {
        try {
            setLoading(true);
            const res = await api.get('/api/admin/customers');
            setCustomerData(res.data.data);
        } catch (e) {
            console.error("Failed to fetch customer data:", e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchCustomers();
    }, []);

    if (loading) {
        return (
            <div className="loader-container" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
                <div className="spinner" style={{ width: '40px', height: '40px', border: '4px solid #E2E8F0', borderTopColor: '#3B82F6', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            </div>
        );
    }

    const filteredCustomers = (customerData?.customers || []).filter(cust => {
        const matchesSearch = cust.customerName.toLowerCase().includes(searchQuery.toLowerCase()) || 
                              cust.phone.includes(searchQuery);
        const matchesDue = !onlyDueFilter || cust.totalDue > 0;
        return matchesSearch && matchesDue;
    });

    return (
        <div className="admin-customers" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {/* KPI Cards Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '20px' }}>
                <div className="kpi-card" style={{ background: 'white', border: '1px solid #E2E8F0', borderRadius: '16px', padding: '20px', display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <div style={{ background: '#EFF6FF', color: '#3B82F6', padding: '14px', borderRadius: '12px' }}>
                        <Users size={24} />
                    </div>
                    <div>
                        <span style={{ fontSize: '13px', color: '#64748B', fontWeight: '600' }}>Total Customers</span>
                        <strong style={{ fontSize: '22px', fontWeight: '800', color: '#0F172A', display: 'block', marginTop: '4px' }}>{customerData?.totalCustomers || 0}</strong>
                    </div>
                </div>
                <div className="kpi-card" style={{ background: 'white', border: '1px solid #E2E8F0', borderRadius: '16px', padding: '20px', display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <div style={{ background: '#FEF3F2', color: '#EF4444', padding: '14px', borderRadius: '12px' }}>
                        <AlertCircle size={24} />
                    </div>
                    <div>
                        <span style={{ fontSize: '13px', color: '#64748B', fontWeight: '600' }}>Active Credit Accounts</span>
                        <strong style={{ fontSize: '22px', fontWeight: '800', color: '#0F172A', display: 'block', marginTop: '4px' }}>{customerData?.khataCustomers || 0}</strong>
                    </div>
                </div>
                <div className="kpi-card" style={{ background: 'white', border: '1px solid #E2E8F0', borderRadius: '16px', padding: '20px', display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <div style={{ background: '#FFFBEB', color: '#D97706', padding: '14px', borderRadius: '12px' }}>
                        <DollarSign size={24} />
                    </div>
                    <div>
                        <span style={{ fontSize: '13px', color: '#64748B', fontWeight: '600' }}>Total Outstanding Dues</span>
                        <strong style={{ fontSize: '22px', fontWeight: '800', color: '#0F172A', display: 'block', marginTop: '4px' }}>₹{(customerData?.totalDueAmount || 0).toLocaleString()}</strong>
                    </div>
                </div>
            </div>

            {/* Split layout: High Value Customers & Search Filter */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '24px' }}>
                
                {/* 1. High Value Customers */}
                <div style={{ background: 'white', border: '1px solid #E2E8F0', borderRadius: '20px', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
                    <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <TrendingUp size={18} color="#10B981" />
                        <span>Top High-Value Buyers</span>
                    </h3>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
                        {(customerData?.highValueCustomers || []).map((cust, idx) => (
                            <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', padding: '16px', background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '14px', alignItems: 'center' }}>
                                <div>
                                    <strong style={{ fontSize: '15px', color: '#0F172A', display: 'block' }}>{cust.customerName}</strong>
                                    <span style={{ fontSize: '12px', color: '#64748B', display: 'block', marginTop: '2px' }}>{cust.phone} • {cust.purchaseCount} bills</span>
                                </div>
                                <div style={{ textAlign: 'right' }}>
                                    <strong style={{ fontSize: '16px', color: '#059669', display: 'block' }}>₹{cust.totalPurchases.toLocaleString()}</strong>
                                    <span style={{ fontSize: '11px', color: '#94A3B8' }}>Bought</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* 2. Customer Directory */}
                <div style={{ background: 'white', border: '1px solid #E2E8F0', borderRadius: '20px', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '20px' }}>
                        <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '800' }}>Customer Directory</h3>
                        
                        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
                            <div className="search-box" style={{ width: '240px', height: '38px', border: '1.5px solid #E2E8F0', borderRadius: '8px', display: 'flex', alignItems: 'center', padding: '0 10px', gap: 6 }}>
                                <Search size={16} color="#94A3B8" />
                                <input 
                                    type="text" 
                                    placeholder="Search name or mobile..." 
                                    value={searchQuery}
                                    onChange={e => setSearchQuery(e.target.value)}
                                    style={{ border: 'none', outline: 'none', width: '100%', fontSize: '13px', fontWeight: '600' }}
                                />
                            </div>

                            <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: '700', color: '#475569', cursor: 'pointer' }}>
                                <input 
                                    type="checkbox" 
                                    checked={onlyDueFilter}
                                    onChange={e => setOnlyDueFilter(e.target.checked)}
                                    style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                                />
                                <span>Show Dues Only</span>
                            </label>
                        </div>
                    </div>

                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '800px' }}>
                            <thead>
                                <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
                                    <th style={{ padding: '14px 16px', fontSize: '12px', color: '#64748B', fontWeight: '800', textTransform: 'uppercase' }}>Customer</th>
                                    <th style={{ padding: '14px 16px', fontSize: '12px', color: '#64748B', fontWeight: '800', textTransform: 'uppercase' }}>Purchases</th>
                                    <th style={{ padding: '14px 16px', fontSize: '12px', color: '#64748B', fontWeight: '800', textTransform: 'uppercase' }}>Outstanding Due</th>
                                    <th style={{ padding: '14px 16px', fontSize: '12px', color: '#64748B', fontWeight: '800', textTransform: 'uppercase' }}>Favorite Shop</th>
                                    <th style={{ padding: '14px 16px', fontSize: '12px', color: '#64748B', fontWeight: '800', textTransform: 'uppercase' }}>Last Active</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredCustomers.map((cust, i) => (
                                    <tr key={i} style={{ borderBottom: '1px solid #F1F5F9' }}>
                                        <td style={{ padding: '14px 16px' }}>
                                            <strong style={{ fontSize: '14px', color: '#0F172A', display: 'block' }}>{cust.customerName}</strong>
                                            <span style={{ fontSize: '12px', color: '#64748B', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
                                                <Phone size={12} /> {cust.phone}
                                            </span>
                                        </td>
                                        <td style={{ padding: '14px 16px' }}>
                                            <strong style={{ fontSize: '14px', color: '#0F172A' }}>₹{cust.totalPurchases.toLocaleString()}</strong>
                                            <span style={{ fontSize: '12px', color: '#64748B', marginLeft: '6px' }}>({cust.purchaseCount} bills)</span>
                                        </td>
                                        <td style={{ padding: '14px 16px' }}>
                                            <span style={{ 
                                                fontSize: '13px', 
                                                fontWeight: '800', 
                                                color: cust.totalDue > 0 ? '#B45309' : '#10B981',
                                                background: cust.totalDue > 0 ? '#FFFBEB' : '#ECFDF5',
                                                padding: '2px 8px',
                                                borderRadius: '6px'
                                            }}>
                                                ₹{cust.totalDue.toLocaleString()}
                                            </span>
                                        </td>
                                        <td style={{ padding: '14px 16px', fontSize: '14px', fontWeight: '700', color: '#475569' }}>
                                            {cust.favoriteShop}
                                        </td>
                                        <td style={{ padding: '14px 16px', fontSize: '13px', color: '#64748B' }}>
                                            {new Date(cust.lastPurchaseDate).toLocaleDateString()}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

            </div>
        </div>
    );
};

export default AdminCustomers;
