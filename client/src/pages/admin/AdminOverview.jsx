import React, { useState, useEffect } from 'react';
import { 
    Store, 
    CheckCircle, 
    FileText, 
    IndianRupee, 
    AlertCircle, 
    ChevronRight, 
    ArrowUpRight, 
    ArrowDownRight,
    TrendingUp,
    RefreshCw,
    Activity
} from 'lucide-react';
import api from '../../services/api';

const AdminOverview = () => {
    const [stats, setStats] = useState(null);
    const [activities, setActivities] = useState([]);
    const [loading, setLoading] = useState(true);

    const fetchOverviewData = async () => {
        try {
            setLoading(true);
            const [statsRes, actRes] = await Promise.all([
                api.get('/api/admin/dashboard-stats'),
                api.get('/api/admin/activities')
            ]);
            setStats(statsRes.data.data);
            setActivities(actRes.data.data.slice(0, 5)); // show recent 5
        } catch (e) {
            console.error("Failed to load admin stats:", e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchOverviewData();
    }, []);

    if (loading) {
        return (
            <div className="loader-container" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
                <div className="spinner" style={{ width: '40px', height: '40px', border: '4px solid #E2E8F0', borderTopColor: '#3B82F6', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            </div>
        );
    }

    const cards = [
        { title: 'Total Shops', value: stats?.totalShops || 0, subText: 'Registered accounts', icon: Store, color: '#3B82F6', bg: '#EFF6FF' },
        { title: 'Active Shops', value: stats?.activeShops || 0, subText: 'Active in last 30d', icon: CheckCircle, color: '#10B981', bg: '#ECFDF5' },
        { title: 'Bills Generated', value: stats?.totalBills || 0, subText: 'Lifetime sales logs', icon: FileText, color: '#8B5CF6', bg: '#F5F3FF' },
        { title: 'Revenue Processed', value: `₹${(stats?.totalRevenue || 0).toLocaleString()}`, subText: 'Lifetime sales volume', icon: IndianRupee, color: '#059669', bg: '#ECFDF5' },
        { title: 'Total Khata Due', value: `₹${(stats?.totalKhataDue || 0).toLocaleString()}`, subText: 'Outstanding credit', icon: AlertCircle, color: '#D97706', bg: '#FFFBEB' },
        { title: 'Gov Records', value: stats?.totalGovRecords || 0, subText: 'Fertilizer registries', icon: FileText, color: '#06B6D4', bg: '#ECFEFF' },
        { title: "Today's Sales", value: `₹${(stats?.todaySales || 0).toLocaleString()}`, subText: `${stats?.todayTransactions || 0} purchases today`, icon: IndianRupee, color: '#10B981', bg: '#ECFDF5' },
        { title: 'Returns Logged', value: stats?.totalReturns || 0, subText: 'Refund items', icon: RefreshCw, color: '#EF4444', bg: '#FEF3F2' },
        { title: 'Exchanges Logged', value: stats?.totalExchanges || 0, subText: 'Swap items', icon: RefreshCw, color: '#3B82F6', bg: '#EFF6FF' }
    ];

    const growthIsPositive = stats?.monthlyGrowth >= 0;

    return (
        <div className="admin-overview" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <div className="overview-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                    <h2 style={{ fontSize: '24px', fontWeight: '800', margin: 0 }}>System Health & Overview</h2>
                    <p style={{ color: '#64748B', margin: '4px 0 0 0', fontSize: '14px' }}>Real-time business telemetry across all shops</p>
                </div>
                <button onClick={fetchOverviewData} className="refresh-btn">
                    <RefreshCw size={16} />
                    <span>Refresh</span>
                </button>
            </div>

            {/* Growth & KPI Summary Banner */}
            <div className="growth-banner" style={{ background: 'linear-gradient(135deg, #1E3A8A, #3B82F6)', color: 'white', borderRadius: '16px', padding: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px', boxShadow: '0 10px 15px -3px rgba(59, 130, 246, 0.2)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <div style={{ background: 'rgba(255, 255, 255, 0.1)', padding: '12px', borderRadius: '12px' }}>
                        <TrendingUp size={24} />
                    </div>
                    <div>
                        <span style={{ fontSize: '13px', fontWeight: '600', opacity: 0.8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Monthly Revenue Growth</span>
                        <strong style={{ fontSize: '28px', fontWeight: '900', display: 'block', marginTop: '2px' }}>
                            {growthIsPositive ? '+' : ''}{stats?.monthlyGrowth || 0}%
                        </strong>
                    </div>
                </div>
                <div className="banner-badge" style={{ background: 'rgba(255, 255, 255, 0.2)', padding: '8px 16px', borderRadius: '99px', fontSize: '14px', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    {growthIsPositive ? <ArrowUpRight size={16} color="#34D399" /> : <ArrowDownRight size={16} color="#F87171" />}
                    <span>Compared to Last Month</span>
                </div>
            </div>

            {/* KPI Cards Grid */}
            <div className="kpi-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '20px' }}>
                {cards.map((card, idx) => {
                    const Icon = card.icon;
                    return (
                        <div key={idx} className="kpi-card" style={{ background: 'white', border: '1px solid #E2E8F0', borderRadius: '16px', padding: '20px', display: 'flex', alignItems: 'center', gap: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
                            <div className="kpi-icon-box" style={{ background: card.bg, color: card.color, padding: '14px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <Icon size={24} />
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                                <span style={{ fontSize: '13px', fontWeight: '600', color: '#64748B' }}>{card.title}</span>
                                <strong style={{ fontSize: '22px', fontWeight: '800', color: '#0F172A', marginTop: '4px' }}>{card.value}</strong>
                                <span style={{ fontSize: '11px', color: '#94A3B8', marginTop: '2px' }}>{card.subText}</span>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Activity Log preview */}
            <div className="overview-split" style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '24px' }}>
                <div className="recent-activity-panel" style={{ background: 'white', border: '1px solid #E2E8F0', borderRadius: '16px', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid #F1F5F9', paddingBottom: '12px' }}>
                        <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <Activity size={18} color="#3B82F6" />
                            <span>Recent Network Activity</span>
                        </h3>
                    </div>
                    {activities.length === 0 ? (
                        <p style={{ color: '#64748B', fontStyle: 'italic', fontSize: '14px', textAlign: 'center', padding: '20px 0' }}>No recent system activities found.</p>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                            {activities.map((act, i) => (
                                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '12px', background: '#F8FAFC', borderRadius: '12px', border: '1px solid #E2E8F0' }}>
                                    <div style={{ display: 'flex', gap: '12px' }}>
                                        <span className={`activity-badge ${act.activityType.toLowerCase().replace(' ', '-')}`} style={{ padding: '4px 10px', fontSize: '11px', fontWeight: '800', borderRadius: '8px', textTransform: 'uppercase', height: 'fit-content' }}>
                                            {act.activityType}
                                        </span>
                                        <div>
                                            <p style={{ margin: 0, fontSize: '14px', fontWeight: '700', color: '#1E293B' }}>{act.description}</p>
                                            <span style={{ fontSize: '11px', color: '#64748B', marginTop: '2px', display: 'block' }}>Shop: {act.shop?.name || 'Central Platform'} • User: {act.user?.name || 'System'}</span>
                                        </div>
                                    </div>
                                    <span style={{ fontSize: '11px', color: '#94A3B8', fontWeight: '600' }}>
                                        {new Date(act.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            <style jsx="true">{`
                .refresh-btn { display: flex; align-items: center; gap: 8px; border: 1px solid #D0D5DD; background: white; padding: 8px 16px; border-radius: 8px; font-size: 13px; font-weight: 700; color: #344054; cursor: pointer; transition: 0.2s; }
                .refresh-btn:hover { background: #F9FAFB; border-color: #98A2B3; }
                .refresh-btn:active { transform: scale(0.96); }

                /* Activity badges */
                .activity-badge.sale { background: #ECFDF5; color: #047857; border: 1px solid #A7F3D0; }
                .activity-badge.purchase { background: #EFF6FF; color: #1D4ED8; border: 1px solid #BFDBFE; }
                .activity-badge.khata-payment { background: #FFFBEB; color: #B45309; border: 1px solid #FDE68A; }
                .activity-badge.government-record { background: #ECFEFF; color: #0891B2; border: 1px solid #CFFAFE; }
                .activity-badge.sync-completed { background: #F5F3FF; color: #6D28D9; border: 1px solid #DDD6FE; }
                .activity-badge.login { background: #F1F5F9; color: #475569; border: 1px solid #E2E8F0; }
                .activity-badge.return { background: #FEF3F2; color: #B91C1C; border: 1px solid #FEE2E2; }
                .activity-badge.exchange { background: #EFF6FF; color: #1E6BFF; border: 1px solid #BFDBFE; }
            `}</style>
        </div>
    );
};

export default AdminOverview;
