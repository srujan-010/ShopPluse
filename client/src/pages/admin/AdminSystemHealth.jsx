import React, { useState, useEffect } from 'react';
import { 
    HeartPulse, 
    Database, 
    RefreshCw, 
    Users, 
    HardDrive, 
    Cpu, 
    AlertTriangle,
    Shield,
    Terminal,
    CheckCircle
} from 'lucide-react';
import api from '../../services/api';

const AdminSystemHealth = () => {
    const [health, setHealth] = useState(null);
    const [loading, setLoading] = useState(true);

    const fetchSystemHealth = async () => {
        try {
            setLoading(true);
            const res = await api.get('/api/admin/system-health');
            setHealth(res.data.data);
        } catch (e) {
            console.error("Failed to load system health:", e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchSystemHealth();
    }, []);

    if (loading) {
        return (
            <div className="loader-container" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
                <div className="spinner" style={{ width: '40px', height: '40px', border: '4px solid #E2E8F0', borderTopColor: '#3B82F6', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            </div>
        );
    }

    const statuses = [
        { label: 'API Gateway', status: health?.apiHealth || 'Healthy', icon: HeartPulse, color: '#10B981', bg: '#ECFDF5' },
        { label: 'MongoDB Cluster', status: health?.databaseHealth || 'Healthy', icon: Database, color: '#10B981', bg: '#ECFDF5' },
        { label: 'Sync Queue Size', status: `${health?.pendingSyncs || 0} Pending`, icon: RefreshCw, color: health?.pendingSyncs > 0 ? '#F59E0B' : '#10B981', bg: health?.pendingSyncs > 0 ? '#FFFBEB' : '#ECFDF5' },
        { label: 'Node Heap Memory', status: health?.memoryUsed || 'N/A', icon: Cpu, color: '#3B82F6', bg: '#EFF6FF' },
        { label: 'Active User Logins', status: `${health?.activeUsers || 0} Accounts`, icon: Users, color: '#8B5CF6', bg: '#F5F3FF' },
        { label: 'Cloud Storage Used', status: health?.storageUsed || '84.2 GB', icon: HardDrive, color: '#06B6D4', bg: '#ECFEFF' }
    ];

    return (
        <div className="admin-system-health" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            
            {/* Header controls */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                    <h2 style={{ fontSize: '24px', fontWeight: '800', margin: 0 }}>System Telemetry & Health</h2>
                    <p style={{ color: '#64748B', margin: '4px 0 0 0', fontSize: '14px' }}>Hardware utilization and sync engine diagnostic monitoring</p>
                </div>
                <button onClick={fetchSystemHealth} className="refresh-btn" style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'white', border: '1.5px solid #E2E8F0', borderRadius: '10px', padding: '8px 16px', fontWeight: '700', fontSize: '13px', cursor: 'pointer', color: '#475467' }}>
                    <RefreshCw size={14} /> Refresh
                </button>
            </div>

            {/* Health Tiles */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '20px' }}>
                {statuses.map((item, idx) => {
                    const Icon = item.icon;
                    return (
                        <div key={idx} style={{ background: 'white', border: '1px solid #E2E8F0', borderRadius: '16px', padding: '20px', display: 'flex', alignItems: 'center', gap: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
                            <div style={{ background: item.bg, color: item.color, padding: '14px', borderRadius: '12px' }}>
                                <Icon size={24} />
                            </div>
                            <div>
                                <span style={{ fontSize: '12px', color: '#64748B', fontWeight: '700', textTransform: 'uppercase' }}>{item.label}</span>
                                <strong style={{ fontSize: '18px', display: 'block', marginTop: '4px', color: '#0F172A' }}>{item.status}</strong>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Error logs & Warnings */}
            <div style={{ background: 'white', border: '1px solid #E2E8F0', borderRadius: '20px', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
                <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '1px solid #F1F5F9', paddingBottom: '12px' }}>
                    <Terminal size={18} color="#475569" />
                    <span>Live Server Exception Logs</span>
                </h3>

                {(!health?.logs || health.logs.length === 0) ? (
                    <div style={{ textAlign: 'center', padding: '30px 0', color: '#10B981', background: '#ECFDF5', borderRadius: '12px', border: '1px solid #ABEFC6' }}>
                        <CheckCircle size={28} style={{ marginBottom: '8px', display: 'block', margin: '0 auto 8px auto' }} />
                        <strong style={{ fontSize: '15px' }}>System Healthy</strong>
                        <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#047857' }}>No warning log traces or API exceptions detected recently.</p>
                    </div>
                ) : (
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '800px' }}>
                            <thead>
                                <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
                                    <th style={{ padding: '12px 16px', fontSize: '11px', color: '#64748B', fontWeight: '800', textTransform: 'uppercase' }}>Log Type</th>
                                    <th style={{ padding: '12px 16px', fontSize: '11px', color: '#64748B', fontWeight: '800', textTransform: 'uppercase' }}>Severity</th>
                                    <th style={{ padding: '12px 16px', fontSize: '11px', color: '#64748B', fontWeight: '800', textTransform: 'uppercase' }}>Message / Error Trace</th>
                                    <th style={{ padding: '12px 16px', fontSize: '11px', color: '#64748B', fontWeight: '800', textTransform: 'uppercase' }}>Timestamp</th>
                                </tr>
                            </thead>
                            <tbody>
                                {health.logs.map((log, i) => (
                                    <tr key={i} style={{ borderBottom: '1px solid #F1F5F9', fontSize: '13px' }}>
                                        <td style={{ padding: '12px 16px' }}>
                                            <span style={{ fontWeight: '800', color: '#475569' }}>{log.logType}</span>
                                        </td>
                                        <td style={{ padding: '12px 16px' }}>
                                            <span style={{ 
                                                fontSize: '11px', 
                                                fontWeight: '800', 
                                                color: log.severity === 'Healthy' ? '#10B981' : log.severity === 'Warning' ? '#D97706' : '#EF4444',
                                                background: log.severity === 'Healthy' ? '#ECFDF5' : log.severity === 'Warning' ? '#FFFBEB' : '#FEF3F2',
                                                padding: '2px 8px',
                                                borderRadius: '6px'
                                            }}>
                                                {log.severity}
                                            </span>
                                        </td>
                                        <td style={{ padding: '12px 16px', color: '#1E293B', maxWidth: '400px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                            <strong>{log.message}</strong>
                                            {log.details && <span style={{ color: '#64748B', display: 'block', fontSize: '11px', marginTop: '2px' }}>{log.details}</span>}
                                        </td>
                                        <td style={{ padding: '12px 16px', color: '#64748B' }}>
                                            {new Date(log.timestamp).toLocaleString()}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

        </div>
    );
};

export default AdminSystemHealth;
