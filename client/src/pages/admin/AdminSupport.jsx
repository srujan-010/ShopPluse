import React, { useState, useEffect } from 'react';
import { 
    LifeBuoy, 
    CheckCircle, 
    AlertCircle, 
    Clock,
    User,
    Store,
    RefreshCw,
    MessageSquare,
    AlertTriangle
} from 'lucide-react';
import api from '../../services/api';
import { useToast } from '../../context/ToastContext';

const AdminSupport = () => {
    const { showToast } = useToast();
    const [tickets, setTickets] = useState([]);
    const [loading, setLoading] = useState(true);
    
    // Resolution states
    const [resolvingTicketId, setResolvingTicketId] = useState(null);
    const [resolutionNotes, setResolutionNotes] = useState('');
    const [resolving, setResolving] = useState(false);

    const fetchTickets = async () => {
        try {
            setLoading(true);
            const res = await api.get('/api/admin/support-tickets');
            setTickets(res.data.data);
        } catch (e) {
            console.error("Failed to fetch support tickets:", e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchTickets();
    }, []);

    const handleResolveTicket = async (ticketId) => {
        try {
            setResolving(true);
            await api.put(`/api/admin/support-tickets/${ticketId}/resolve`, { resolutionNotes });
            showToast("Ticket resolved successfully!", "success");
            setResolvingTicketId(null);
            setResolutionNotes('');
            fetchTickets();
        } catch (err) {
            showToast("Failed to resolve ticket.", "error");
        } finally {
            setResolving(false);
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

    const pendingTickets = tickets.filter(t => t.status !== 'Resolved');
    const resolvedTickets = tickets.filter(t => t.status === 'Resolved');

    return (
        <div className="admin-support" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            
            {/* KPI Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '20px' }}>
                <div className="kpi-card" style={{ background: 'white', border: '1px solid #E2E8F0', borderRadius: '16px', padding: '20px', display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <div style={{ background: '#FFFBEB', color: '#D97706', padding: '14px', borderRadius: '12px' }}>
                        <Clock size={24} />
                    </div>
                    <div>
                        <span style={{ fontSize: '13px', color: '#64748B', fontWeight: '600' }}>Pending Tickets</span>
                        <strong style={{ fontSize: '24px', fontWeight: '800', color: '#0F172A', display: 'block', marginTop: '4px' }}>{pendingTickets.length}</strong>
                    </div>
                </div>
                <div className="kpi-card" style={{ background: 'white', border: '1px solid #E2E8F0', borderRadius: '16px', padding: '20px', display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <div style={{ background: '#ECFDF5', color: '#10B981', padding: '14px', borderRadius: '12px' }}>
                        <CheckCircle size={24} />
                    </div>
                    <div>
                        <span style={{ fontSize: '13px', color: '#64748B', fontWeight: '600' }}>Resolved Tickets</span>
                        <strong style={{ fontSize: '24px', fontWeight: '800', color: '#0F172A', display: 'block', marginTop: '4px' }}>{resolvedTickets.length}</strong>
                    </div>
                </div>
            </div>

            {/* Split layout: Pending & History */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '24px' }}>
                
                {/* 1. Pending tickets list */}
                <div style={{ background: 'white', border: '1px solid #E2E8F0', borderRadius: '20px', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid #F1F5F9', paddingBottom: '12px' }}>
                        <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <Clock size={18} color="#D97706" />
                            <span>Pending Helpdesk Tickets</span>
                        </h3>
                        <button onClick={fetchTickets} className="refresh-btn" style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'none', border: 'none', color: '#3B82F6', fontWeight: '700', cursor: 'pointer', fontSize: '13px' }}>
                            <RefreshCw size={14} /> Refresh
                        </button>
                    </div>

                    {pendingTickets.length === 0 ? (
                        <p style={{ color: '#64748B', fontStyle: 'italic', fontSize: '14px', textAlign: 'center', padding: '20px 0' }}>No pending support tickets found. Inbox is clean!</p>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            {pendingTickets.map((t) => (
                                <div key={t._id} style={{ border: '1px solid #E2E8F0', borderRadius: '14px', padding: '20px', background: '#F8FAFC', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                            <span className={`priority-badge ${t.priority.toLowerCase()}`} style={{ padding: '2px 8px', fontSize: '11px', fontWeight: '800', borderRadius: '6px', textTransform: 'uppercase' }}>
                                                {t.priority} priority
                                            </span>
                                            <span style={{ fontSize: '13px', color: '#64748B', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                <Store size={14} /> {t.shopName}
                                            </span>
                                        </div>
                                        <span style={{ fontSize: '12px', color: '#94A3B8', fontWeight: '600' }}>
                                            Created: {new Date(t.createdAt).toLocaleString()}
                                        </span>
                                    </div>

                                    <div>
                                        <h4 style={{ margin: '0 0 6px 0', fontSize: '16px', fontWeight: '800', color: '#0F172A' }}>{t.title}</h4>
                                        <p style={{ margin: 0, fontSize: '14px', color: '#475569', lineHeight: '1.5' }}>{t.description}</p>
                                    </div>

                                    {resolvingTicketId !== t._id ? (
                                        <button 
                                            onClick={() => setResolvingTicketId(t._id)}
                                            style={{ alignSelf: 'flex-start', height: '36px', background: '#3B82F6', color: 'white', border: 'none', fontWeight: '700', borderRadius: '8px', padding: '0 16px', fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
                                        >
                                            <MessageSquare size={14} /> Resolve Ticket
                                        </button>
                                    ) : (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', borderTop: '1px solid #E2E8F0', paddingTop: '12px' }}>
                                            <textarea 
                                                placeholder="Write resolution notes for the shopkeeper..."
                                                value={resolutionNotes}
                                                onChange={e => setResolutionNotes(e.target.value)}
                                                style={{ width: '100%', height: '80px', borderRadius: '8px', border: '1.5px solid #D0D5DD', padding: '10px', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }}
                                            />
                                            <div style={{ display: 'flex', gap: '8px', alignSelf: 'flex-start' }}>
                                                <button 
                                                    onClick={() => handleResolveTicket(t._id)}
                                                    disabled={resolving || !resolutionNotes}
                                                    style={{ height: '36px', background: '#10B981', color: 'white', border: 'none', fontWeight: '700', borderRadius: '8px', padding: '0 16px', fontSize: '13px', cursor: 'pointer' }}
                                                >
                                                    {resolving ? 'Resolving...' : 'Confirm Resolution'}
                                                </button>
                                                <button 
                                                    onClick={() => { setResolvingTicketId(null); setResolutionNotes(''); }}
                                                    style={{ height: '36px', background: 'white', border: '1.5px solid #D0D5DD', color: '#475569', fontWeight: '700', borderRadius: '8px', padding: '0 16px', fontSize: '13px', cursor: 'pointer' }}
                                                >
                                                    Cancel
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* 2. Resolved tickets history */}
                <div style={{ background: 'white', border: '1px solid #E2E8F0', borderRadius: '20px', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
                    <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '1px solid #F1F5F9', paddingBottom: '12px' }}>
                        <CheckCircle size={18} color="#10B981" />
                        <span>Resolution History</span>
                    </h3>
                    
                    {resolvedTickets.length === 0 ? (
                        <p style={{ color: '#64748B', fontStyle: 'italic', fontSize: '14px', textAlign: 'center', padding: '20px 0' }}>No resolved tickets yet.</p>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            {resolvedTickets.map((t) => (
                                <div key={t._id} style={{ display: 'flex', justifyContent: 'space-between', padding: '16px', background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '12px', flexWrap: 'wrap', gap: '12px' }}>
                                    <div>
                                        <strong style={{ fontSize: '15px', color: '#334155' }}>{t.title}</strong>
                                        <span style={{ fontSize: '12px', color: '#64748B', display: 'block', marginTop: '2px' }}>Shop: {t.shopName}</span>
                                        <p style={{ margin: '6px 0 0 0', fontSize: '13px', color: '#475569', background: 'white', padding: '8px', borderRadius: '6px', borderLeft: '3px solid #10B981' }}>
                                            <strong>Resolution:</strong> {t.resolutionNotes}
                                        </p>
                                    </div>
                                    <div style={{ textAlign: 'right', fontSize: '12px', color: '#94A3B8' }}>
                                        <span>Resolved on:</span>
                                        <strong style={{ display: 'block', color: '#64748B', marginTop: '2px' }}>{new Date(t.resolvedAt).toLocaleDateString()}</strong>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

            </div>

            <style jsx="true">{`
                .priority-badge.low { background: #F1F5F9; color: #475569; border: 1px solid #E2E8F0; }
                .priority-badge.medium { background: #EFF6FF; color: #1E6BFF; border: 1px solid #BFDBFE; }
                .priority-badge.high { background: #FFFBEB; color: #D97706; border: 1px solid #FCD34D; }
                .priority-badge.urgent { background: #FEF3F2; color: #B42318; border: 1px solid #FECDCA; }
            `}</style>
        </div>
    );
};

export default AdminSupport;
