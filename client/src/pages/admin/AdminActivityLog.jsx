import React, { useState, useEffect } from 'react';
import { 
    Activity, 
    Search, 
    Calendar, 
    Store,
    RefreshCw,
    Download
} from 'lucide-react';
import api from '../../services/api';

const AdminActivityLog = () => {
    const [activities, setActivities] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [typeFilter, setTypeFilter] = useState('All');
    const [loading, setLoading] = useState(true);

    const fetchActivities = async () => {
        try {
            setLoading(true);
            const res = await api.get('/api/admin/activities');
            setActivities(res.data.data);
        } catch (e) {
            console.error("Failed to load activity logs:", e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchActivities();
    }, []);

    const filteredActivities = activities.filter(act => {
        const matchesSearch = act.description.toLowerCase().includes(searchQuery.toLowerCase()) || 
                              (act.shop?.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                              (act.user?.name || '').toLowerCase().includes(searchQuery.toLowerCase());
        const matchesType = typeFilter === 'All' || act.activityType === typeFilter;
        return matchesSearch && matchesType;
    });

    const activityTypes = [
        'Sale',
        'Return',
        'Exchange',
        'Purchase',
        'Khata Payment',
        'Government Record',
        'Login',
        'Sync Completed',
        'Offline Sync Pending',
        'Subscription Change'
    ];

    if (loading) {
        return (
            <div className="loader-container" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
                <div className="spinner" style={{ width: '40px', height: '40px', border: '4px solid #E2E8F0', borderTopColor: '#3B82F6', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            </div>
        );
    }

    return (
        <div className="admin-activity" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {/* Filter controls */}
            <div className="controls-bar" style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center', background: 'white', padding: '16px', borderRadius: '16px', border: '1px solid #E2E8F0' }}>
                <div className="search-box" style={{ flex: 1, minWidth: '260px', height: '44px', border: '1.5px solid #E2E8F0', borderRadius: '10px', display: 'flex', alignItems: 'center', padding: '0 12px', gap: 8 }}>
                    <Search size={18} color="#94A3B8" />
                    <input 
                        type="text" 
                        placeholder="Search logs, shops, or users..." 
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        style={{ border: 'none', outline: 'none', width: '100%', fontSize: '14px', fontWeight: '600' }}
                    />
                </div>
                
                <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} className="filter-select">
                    <option value="All">All Event Types</option>
                    {activityTypes.map(t => (
                        <option key={t} value={t}>{t}</option>
                    ))}
                </select>

                <button onClick={fetchActivities} className="refresh-btn" style={{ display: 'flex', alignExact: 'center', gap: '6px', height: '44px', background: 'white', border: '1.5px solid #E2E8F0', borderRadius: '10px', padding: '0 16px', fontWeight: '700', fontSize: '13px', cursor: 'pointer', color: '#475467', alignItems: 'center' }}>
                    <RefreshCw size={16} /> Refresh
                </button>
            </div>

            {/* Timeline feed */}
            <div className="timeline-container" style={{ background: 'white', border: '1px solid #E2E8F0', borderRadius: '20px', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
                {filteredActivities.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '40px 0', color: '#64748B' }}>
                        <Activity size={32} style={{ marginBottom: '12px', opacity: 0.5 }} />
                        <p style={{ margin: 0, fontStyle: 'italic' }}>No activities match your filters.</p>
                    </div>
                ) : (
                    <div className="activity-list" style={{ display: 'flex', flexDirection: 'column', gap: '16px', position: 'relative', paddingLeft: '16px' }}>
                        <div style={{ position: 'absolute', left: '4px', top: '8px', bottom: '8px', width: '2px', background: '#F1F5F9' }} />
                        
                        {filteredActivities.map((act, index) => (
                            <div key={index} className="activity-item" style={{ position: 'relative', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '14px', padding: '16px', gap: '16px', transition: '0.2s' }}>
                                <div style={{ position: 'absolute', left: '-16px', top: '22px', width: '8px', height: '8px', borderRadius: '50%', background: '#3B82F6', border: '2px solid white' }} />
                                
                                <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                                    <span className={`activity-badge ${act.activityType.toLowerCase().replace(' ', '-')}`} style={{ padding: '4px 10px', fontSize: '11px', fontWeight: '800', borderRadius: '8px', textTransform: 'uppercase', flexShrink: 0, marginTop: '2px' }}>
                                        {act.activityType}
                                    </span>
                                    <div>
                                        <p style={{ margin: 0, fontSize: '15px', fontWeight: '700', color: '#1E293B' }}>{act.description}</p>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#64748B', marginTop: '4px', flexWrap: 'wrap' }}>
                                            <span style={{ fontWeight: '700' }}>Shop: {act.shop?.name || 'Central Control'}</span>
                                            <span>•</span>
                                            <span>User: {act.user?.name || 'Platform'} ({act.user?.email || 'N/A'})</span>
                                        </div>
                                    </div>
                                </div>

                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px', flexShrink: 0 }}>
                                    <span style={{ fontSize: '13px', fontWeight: '800', color: '#0F172A' }}>
                                        {new Date(act.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                    <span style={{ fontSize: '11px', color: '#94A3B8', fontWeight: '600' }}>
                                        {new Date(act.timestamp).toLocaleDateString()}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <style jsx="true">{`
                .filter-select { height: 44px; border: 1.5px solid #E2E8F0; border-radius: 10px; background: white; padding: 0 12px; font-size: 14px; font-weight: 700; color: #475467; outline: none; cursor: pointer; }
                .filter-select:hover { border-color: #98A2B3; }
                .activity-item:hover { border-color: #CBD5E1; background: #F1F5F9; }

                /* Activity badges */
                .activity-badge.sale { background: #ECFDF5; color: #047857; border: 1px solid #A7F3D0; }
                .activity-badge.purchase { background: #EFF6FF; color: #1D4ED8; border: 1px solid #BFDBFE; }
                .activity-badge.khata-payment { background: #FFFBEB; color: #B45309; border: 1px solid #FDE68A; }
                .activity-badge.government-record { background: #ECFEFF; color: #0891B2; border: 1px solid #CFFAFE; }
                .activity-badge.sync-completed { background: #F5F3FF; color: #6D28D9; border: 1px solid #DDD6FE; }
                .activity-badge.login { background: #F1F5F9; color: #475569; border: 1px solid #E2E8F0; }
                .activity-badge.return { background: #FEF3F2; color: #B91C1C; border: 1px solid #FEE2E2; }
                .activity-badge.exchange { background: #EFF6FF; color: #1E6BFF; border: 1px solid #BFDBFE; }
                .activity-badge.subscription-change { background: #FAF5FF; color: #7E22CE; border: 1px solid #F3E8FF; }
            `}</style>
        </div>
    );
};

export default AdminActivityLog;
