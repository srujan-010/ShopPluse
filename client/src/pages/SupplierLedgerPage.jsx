import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
    ArrowLeft, 
    IndianRupee, 
    Phone, 
    Calendar, 
    Clock, 
    CheckCircle, 
    AlertCircle, 
    MessageSquare, 
    ShoppingCart, 
    History,
    Plus
} from 'lucide-react';
import { purchaseService, shopService } from '../services/api';
import { EmptyState, Skeleton, PageHeader, CustomSelect, MessageModal } from '../components/PremiumUI';
import { useScrollLock } from '../hooks/useScrollLock';

const SupplierLedgerPage = () => {
    const { shopId, supplierName } = useParams();
    const navigate = useNavigate();
    const decodedSupplierName = decodeURIComponent(supplierName);
    
    const [purchases, setPurchases] = useState([]);
    const [shop, setShop] = useState(null);
    const [loading, setLoading] = useState(true);
    const [supplierPhone, setSupplierPhone] = useState('');
    
    const [showPaymentModal, setShowPaymentModal] = useState(false);
    const [selectedPurchaseForPayment, setSelectedPurchaseForPayment] = useState(null);
    const [paymentInput, setPaymentInput] = useState({ amount: '', mode: 'Cash', note: '' });
    const [isSaving, setIsSaving] = useState(false);
    const [alertConfig, setAlertConfig] = useState({ open: false, title: '', message: '', type: 'info' });

    useScrollLock(showPaymentModal);

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

    const handleRecordPayment = async (e) => {
        e.preventDefault();
        if (!selectedPurchaseForPayment) {
            setAlertConfig({ open: true, title: 'Bill Required', message: 'Please select a bill first.', type: 'error' });
            return;
        }
        if (!paymentInput.amount || Number(paymentInput.amount) <= 0) {
            setAlertConfig({ open: true, title: 'Invalid Amount', message: 'Please enter a valid amount.', type: 'error' });
            return;
        }
        try {
            setIsSaving(true);
            await purchaseService.addPayment(selectedPurchaseForPayment._id, {
                amount: Number(paymentInput.amount),
                mode: paymentInput.mode,
                note: paymentInput.note
            });
            setAlertConfig({ open: true, title: 'Success', message: 'Payment successfully recorded!', type: 'success' });
            setPaymentInput({ amount: '', mode: 'Cash', note: '' });
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
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '80vh' }}>
                <div style={{ width: '40px', height: '40px', border: '4px solid #F1F5F9', borderTopColor: '#2563EB', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
            </div>
        );
    }

    // Calculations
    const totalPurchased = purchases.reduce((sum, p) => sum + (p.totalAmount || 0), 0);
    const totalPaid = purchases.reduce((sum, p) => sum + (p.paidAmount || 0), 0);
    const outstandingDue = purchases.reduce((sum, p) => sum + (p.dueAmount || 0), 0);
    const totalBills = purchases.length;
    
    const latestDate = purchases.length > 0 
        ? new Date(Math.max(...purchases.map(p => new Date(p.date).getTime())))
        : null;

    // Collect Unique Products
    const productHistory = [];
    purchases.forEach(p => {
        (p.items || []).forEach(item => {
            const existing = productHistory.find(ph => ph.productName === item.productName);
            if (existing) {
                existing.quantity += (item.quantity || 0);
                existing.totalSpent += (item.itemTotal || 0);
            } else {
                productHistory.push({
                    productName: item.productName,
                    quantity: item.quantity || 0,
                    unit: item.unit || 'Pc',
                    totalSpent: item.itemTotal || 0
                });
            }
        });
    });

    // Flatten payment history
    const paymentHistory = [];
    purchases.forEach(p => {
        (p.paymentHistory || []).forEach(ph => {
            paymentHistory.push({
                ...ph,
                billNo: p.billNo,
                purchaseId: p._id
            });
        });
    });
    paymentHistory.sort((a, b) => new Date(b.paidAt) - new Date(a.paidAt));

    return (
        <div className="supplier-ledger-view" style={{ maxWidth: '1400px', margin: '0 auto', padding: '24px', display: 'flex', flexDirection: 'column', gap: '32px' }}>
            <style>{`
                .sl-mobile-only { display: none; }
                .sl-desktop-only { display: block; }
                @media (max-width: 768px) {
                    .supplier-ledger-view { padding: 0 0 80px 0 !important; gap: 0 !important; background: #F8FAFC; min-height: 100vh; }
                    .slv-header { padding: 10px 12px !important; height: 56px !important; display: flex !important; justify-content: space-between !important; align-items: center !important; position: sticky; top: 0; background: rgba(255, 255, 255, 0.9); backdrop-filter: blur(10px); z-index: 100; border-bottom: 1px solid #E2E8F0 !important; margin: 0 !important; }
                    .slv-header > div:first-child { gap: 8px !important; }
                    .slv-header h2 { font-size: 18px !important; font-weight: 900 !important; margin: 0 !important; }
                    .slv-header p { display: none; }
                    .slv-header-buttons { display: flex !important; width: auto !important; gap: 6px !important; }
                    .slv-header-buttons a, .slv-header-buttons button { height: 32px !important; font-size: 11px !important; padding: 0 10px !important; border-radius: 8px !important; }
                    .slv-header-buttons span { display: none; }
                    
                    .sl-desktop-only { display: none !important; }
                    .sl-mobile-only { display: grid !important; }
                    .sl-summary-grid-mobile { padding: 12px; gap: 6px; grid-template-columns: 1fr 1fr; }
                    .sl-mini-chip { background: white; border: 1px solid #E2E8F0; borderRadius: 10px; padding: 8px 10px; display: flex; flexDirection: column; justifyContent: center; height: 56px; boxSizing: border-box; }
                    .sl-mini-chip span { fontSize: 10px; fontWeight: 700; color: #64748B; textTransform: uppercase; }
                    .sl-mini-chip strong { fontSize: 14px; fontWeight: 900; color: #0F172A; }
                    
                    .slv-history-grid { display: flex !important; flex-direction: column !important; gap: 12px !important; padding: 0 12px !important; }
                    .slv-history-card { padding: 14px !important; border-radius: 16px !important; border: 1px solid #E2E8F0 !important; }
                    .slv-history-card h3 { font-size: 15px !important; margin-bottom: 10px !important; }
                    .slv-history-item { padding: 10px !important; border-radius: 10px !important; }
                    
                    .bill-list-mobile { padding: 0 12px 12px; display: flex; flexDirection: column; gap: 6px; }
                    .bill-card-mobile { background: white; borderRadius: 10px; padding: 8px 10px; border: 1px solid #E2E8F0; display: flex; flexDirection: column; gap: 2px; height: 76px; boxSizing: border-box; }
                }
            `}</style>
            
            {/* Header Section */}
            <div className="slv-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '20px', borderBottom: '2px solid #F1F5F9', paddingBottom: '24px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <button 
                        onClick={() => navigate(`/shop/${shopId}/purchase-ledger`)} 
                        style={{ background: 'white', border: '1.5px solid #E2E8F0', color: '#475569', width: '40px', height: '40px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                    >
                        <ArrowLeft size={20} />
                    </button>
                    <div>
                        <h2 style={{ fontSize: '32px', fontWeight: '900', color: '#0F172A', margin: 0, letterSpacing: '-0.03em' }}>{decodedSupplierName}</h2>
                        {supplierPhone && (
                            <p style={{ fontSize: '15px', fontWeight: '600', color: '#64748B', margin: '4px 0 0 0', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <Phone size={14} />
                                <span>{supplierPhone}</span>
                            </p>
                        )}
                    </div>
                </div>

                <div className="slv-header-buttons" style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                    {supplierPhone && (
                        <>
                            <a 
                                href={`tel:${supplierPhone}`}
                                style={{ background: '#F0FDF4', color: '#16A34A', padding: '0 16px', height: '44px', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', fontWeight: '700', textDecoration: 'none', border: '1px solid #DCFCE7' }}
                            >
                                <Phone size={18} />
                                <span>Call</span>
                            </a>
                            <a 
                                href={`https://wa.me/${supplierPhone}`}
                                target="_blank"
                                rel="noreferrer"
                                style={{ background: '#ECFDF5', color: '#059669', padding: '0 16px', height: '44px', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', fontWeight: '700', textDecoration: 'none', border: '1px solid #D1FAE5' }}
                            >
                                <MessageSquare size={18} />
                                <span>WhatsApp</span>
                            </a>
                        </>
                    )}
                    <button 
                        onClick={() => {
                            if (outstandingDue <= 0) {
                                setAlertConfig({ open: true, title: 'No Balance', message: 'No outstanding due balance for this supplier.', type: 'info' });
                                return;
                            }
                            setShowPaymentModal(true);
                        }} 
                        style={{ background: '#D97706', color: 'white', padding: '0 20px', height: '44px', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', fontWeight: '800', border: 'none', cursor: 'pointer', boxShadow: '0 4px 12px rgba(217, 119, 6, 0.2)' }}
                    >
                        <IndianRupee size={18} />
                        <span>Record Payment</span>
                    </button>
                    <button 
                        onClick={() => navigate(`/shop/${shopId}/inventory?action=add_stock`)} 
                        style={{ background: '#2563EB', color: 'white', padding: '0 20px', height: '44px', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', fontWeight: '800', border: 'none', cursor: 'pointer', boxShadow: '0 4px 12px rgba(37, 99, 235, 0.2)' }}
                    >
                        <Plus size={18} />
                        <span>Add Purchase</span>
                    </button>
                </div>
            </div>

            {/* Summary Cards */}
            <>
            <div className="sl-desktop-only">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '20px' }}>
                <div style={{ background: 'white', border: '1px solid #E2E8F0', borderRadius: '20px', padding: '24px' }}>
                    <span style={{ fontSize: '13px', color: '#64748B', textTransform: 'uppercase', fontWeight: '700', letterSpacing: '0.05em' }}>Total Purchased</span>
                    <strong style={{ fontSize: '28px', fontWeight: '900', color: '#0F172A', display: 'block', marginTop: '6px' }}>₹{totalPurchased.toLocaleString()}</strong>
                </div>
                <div style={{ background: 'white', border: '1px solid #E2E8F0', borderRadius: '20px', padding: '24px' }}>
                    <span style={{ fontSize: '13px', color: '#64748B', textTransform: 'uppercase', fontWeight: '700', letterSpacing: '0.05em' }}>Total Paid</span>
                    <strong style={{ fontSize: '28px', fontWeight: '900', color: '#10B981', display: 'block', marginTop: '6px' }}>₹{totalPaid.toLocaleString()}</strong>
                </div>
                <div style={{ background: outstandingDue > 0 ? '#FFFBEB' : 'white', border: '1px solid', borderColor: outstandingDue > 0 ? '#FCD34D' : '#E2E8F0', borderRadius: '20px', padding: '24px' }}>
                    <span style={{ fontSize: '13px', color: outstandingDue > 0 ? '#B45309' : '#64748B', textTransform: 'uppercase', fontWeight: '700', letterSpacing: '0.05em' }}>Outstanding Due</span>
                    <strong style={{ fontSize: '28px', fontWeight: '900', color: outstandingDue > 0 ? '#B45309' : '#0F172A', display: 'block', marginTop: '6px' }}>₹{outstandingDue.toLocaleString()}</strong>
                </div>
                <div style={{ background: 'white', border: '1px solid #E2E8F0', borderRadius: '20px', padding: '24px' }}>
                    <span style={{ fontSize: '13px', color: '#64748B', textTransform: 'uppercase', fontWeight: '700', letterSpacing: '0.05em' }}>Bills Logged</span>
                    <strong style={{ fontSize: '28px', fontWeight: '900', color: '#0F172A', display: 'block', marginTop: '6px' }}>{totalBills}</strong>
                    {latestDate && (
                        <span style={{ fontSize: '12px', color: '#64748B', display: 'block', marginTop: '4px' }}>
                            Last: {latestDate.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
                        </span>
                    )}
                </div>
            </div>
            </div>
            <div className="sl-mobile-only sl-summary-grid-mobile" style={{ display: 'grid' }}>
                <div className="sl-mini-chip">
                    <span>Purchase</span>
                    <strong>₹{Intl.NumberFormat('en-IN', { notation: "compact", maximumFractionDigits: 1 }).format(totalPurchased)}</strong>
                </div>
                <div className="sl-mini-chip">
                    <span>Paid</span>
                    <strong style={{ color: '#10B981' }}>₹{Intl.NumberFormat('en-IN', { notation: "compact", maximumFractionDigits: 1 }).format(totalPaid)}</strong>
                </div>
                <div className="sl-mini-chip" style={{ background: outstandingDue > 0 ? 'linear-gradient(135deg, #FFFBEB, #FEF3C7)' : 'white', borderColor: outstandingDue > 0 ? '#FCD34D' : '#E2E8F0' }}>
                    <span style={{ color: outstandingDue > 0 ? '#B45309' : '#64748B' }}>Due</span>
                    <strong style={{ color: outstandingDue > 0 ? '#92400E' : '#0F172A' }}>₹{Intl.NumberFormat('en-IN', { notation: "compact", maximumFractionDigits: 1 }).format(outstandingDue)}</strong>
                </div>
                <div className="sl-mini-chip">
                    <span>Bills</span>
                    <strong>{totalBills}</strong>
                </div>
            </div>
            </>

            {/* Bills Table Section */}
            <>
            <div className="sl-desktop-only">
            <div style={{ background: 'white', border: '1px solid #E2E8F0', borderRadius: '24px', padding: '24px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02)' }}>
                <h3 style={{ margin: '0 0 20px 0', fontSize: '18px', color: '#0F172A', fontWeight: '800' }}>Purchase Invoices</h3>
                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ background: '#F8FAFC', borderBottom: '2px solid #E2E8F0' }}>
                                <th style={{ textAlign: 'left', padding: '16px', fontSize: '13px', color: '#475569', fontWeight: '700', borderRadius: '10px 0 0 10px' }}>Date</th>
                                <th style={{ textAlign: 'left', padding: '16px', fontSize: '13px', color: '#475569', fontWeight: '700' }}>Bill No</th>
                                <th style={{ textAlign: 'right', padding: '16px', fontSize: '13px', color: '#475569', fontWeight: '700' }}>Total</th>
                                <th style={{ textAlign: 'right', padding: '16px', fontSize: '13px', color: '#475569', fontWeight: '700' }}>Paid</th>
                                <th style={{ textAlign: 'right', padding: '16px', fontSize: '13px', color: '#475569', fontWeight: '700' }}>Due</th>
                                <th style={{ textAlign: 'center', padding: '16px', fontSize: '13px', color: '#475569', fontWeight: '700', borderRadius: '0 10px 10px 0' }}>Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {purchases.map((pur, idx) => {
                                const statusColor = 
                                    pur.paymentStatus === 'Paid' ? '#10B981' : 
                                    pur.paymentStatus === 'Partial Paid' ? '#F59E0B' : '#EF4444';
                                    
                                return (
                                    <tr 
                                        key={idx} 
                                        onClick={() => navigate(`/shop/${shopId}/purchase-ledger/${pur._id}`)}
                                        style={{ borderBottom: '1px solid #F1F5F9', cursor: 'pointer', transition: 'background 0.2s' }}
                                    >
                                        <td style={{ padding: '18px 16px', fontSize: '14px', color: '#475569', fontWeight: '600' }}>
                                            {new Date(pur.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                                        </td>
                                        <td style={{ padding: '18px 16px', fontSize: '15px', fontWeight: '800', color: '#1E293B' }}>#{pur.billNo}</td>
                                        <td style={{ padding: '18px 16px', textAlign: 'right', fontSize: '15px', fontWeight: '800', color: '#1E293B' }}>₹{(pur.totalAmount || 0).toLocaleString()}</td>
                                        <td style={{ padding: '18px 16px', textAlign: 'right', fontSize: '15px', fontWeight: '700', color: '#10B981' }}>₹{(pur.paidAmount || 0).toLocaleString()}</td>
                                        <td style={{ padding: '18px 16px', textAlign: 'right', fontSize: '15px', fontWeight: '800', color: pur.dueAmount > 0 ? '#EF4444' : '#64748B' }}>₹{(pur.dueAmount || 0).toLocaleString()}</td>
                                        <td style={{ padding: '18px 16px', textAlign: 'center' }}>
                                            <span style={{ display: 'inline-block', padding: '4px 12px', borderRadius: '8px', fontSize: '12px', fontWeight: '800', background: `${statusColor}15`, color: statusColor }}>
                                                {pur.paymentStatus}
                                            </span>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
            </div>
            <div className="sl-mobile-only bill-list-mobile">
                <h3 style={{ margin: '0 0 4px 0', fontSize: '15px', color: '#0F172A', fontWeight: '800' }}>Purchase Invoices</h3>
                {purchases.map((pur, idx) => (
                    <motion.div 
                        whileTap={{ scale: 0.98 }}
                        key={idx} 
                        className="bill-card-mobile"
                        onClick={() => navigate(`/shop/${shopId}/purchase-ledger/${pur._id}`)}
                    >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div style={{ color: '#0F172A', fontWeight: '700', fontSize: '13px' }}>#{pur.billNo}</div>
                            <div style={{ fontWeight: '800', fontSize: '14px', color: '#0F172A' }}>₹{Intl.NumberFormat('en-IN', { notation: "compact", maximumFractionDigits: 1 }).format(pur.totalAmount || 0)}</div>
                        </div>
                        <div style={{ fontSize: '11px', color: '#64748B', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {(pur.items || []).map(i => `${i.productName} (${i.quantity})`).join(', ')}
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto' }}>
                            <div style={{ fontSize: '10px', color: '#94A3B8', fontWeight: '600' }}>
                                {new Date(pur.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })} • Due: ₹{Intl.NumberFormat('en-IN', { notation: "compact", maximumFractionDigits: 1 }).format(pur.dueAmount || 0)}
                            </div>
                            <span style={{ padding: '1px 6px', fontSize: '9px', borderRadius: '4px', fontWeight: '800', background: pur.paymentStatus === 'Paid' ? '#D1FAE5' : pur.paymentStatus === 'Partial Paid' ? '#FEF3C7' : '#FEE2E2', color: pur.paymentStatus === 'Paid' ? '#059669' : pur.paymentStatus === 'Partial Paid' ? '#D97706' : '#DC2626' }}>
                                {pur.paymentStatus}
                            </span>
                        </div>
                    </motion.div>
                ))}
            </div>
            </>

            {/* Two Column History grid */}
            <div className="slv-history-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px' }}>
                
                {/* Product History */}
                <div className="slv-history-card" style={{ background: 'white', border: '1px solid #E2E8F0', borderRadius: '24px', padding: '24px' }}>
                    <h3 style={{ margin: '0 0 16px 0', fontSize: '18px', color: '#0F172A', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <ShoppingCart size={20} />
                        <span>Product Catalog</span>
                    </h3>
                    {productHistory.length === 0 ? (
                        <div style={{ textAlign: 'center', color: '#64748B', padding: '20px', fontStyle: 'italic' }}>No products recorded.</div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            {productHistory.map((ph, idx) => (
                                <div key={idx} className="slv-history-item" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#F8FAFC', padding: '16px', borderRadius: '14px', border: '1px solid #E2E8F0' }}>
                                    <div>
                                        <strong style={{ fontSize: '15px', color: '#1E293B', display: 'block' }}>{ph.productName}</strong>
                                        <span style={{ fontSize: '13px', color: '#64748B' }}>Qty Bought: {ph.quantity} {ph.unit}</span>
                                    </div>
                                    <strong style={{ fontSize: '15px', color: '#0F172A' }}>₹{ph.totalSpent.toLocaleString()}</strong>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Payment Logs */}
                <div className="slv-history-card" style={{ background: 'white', border: '1px solid #E2E8F0', borderRadius: '24px', padding: '24px' }}>
                    <h3 style={{ margin: '0 0 16px 0', fontSize: '18px', color: '#0F172A', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <History size={20} />
                        <span>Payment Logs</span>
                    </h3>
                    {paymentHistory.length === 0 ? (
                        <div style={{ textAlign: 'center', color: '#64748B', padding: '20px', fontStyle: 'italic' }}>No payment history recorded.</div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            {paymentHistory.map((h, idx) => (
                                <div key={idx} className="slv-history-item" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#F8FAFC', padding: '16px', borderRadius: '14px', borderLeft: '4px solid #10B981' }}>
                                    <div>
                                        <strong style={{ fontSize: '15px', color: '#1E293B', display: 'block' }}>₹{(h.amount || 0).toLocaleString()}</strong>
                                        <span style={{ fontSize: '13px', color: '#64748B' }}>For Bill #{h.billNo} via {h.mode}</span>
                                    </div>
                                    <span style={{ fontSize: '12px', color: '#64748B', background: 'white', padding: '4px 8px', borderRadius: '6px', border: '1px solid #E2E8F0' }}>
                                        {new Date(h.paidAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Record Payment Modal */}
            {showPaymentModal && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(15, 23, 42, 0.5)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '16px' }}>
                    <div style={{ background: 'white', borderRadius: '24px', width: '100%', maxWidth: '500px', padding: '32px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04)' }}>
                        <h3 style={{ margin: '0 0 8px 0', fontSize: '20px', fontWeight: '800', color: '#0F172A' }}>Record Payment</h3>
                        <p style={{ margin: '0 0 24px 0', fontSize: '14px', color: '#64748B' }}>Allocate settlement amounts to outstanding supplier balances.</p>
                        
                        <form onSubmit={handleRecordPayment} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                            <CustomSelect 
                                label="Select Pending Bill"
                                value={selectedPurchaseForPayment?._id || ''} 
                                options={[
                                    { label: '-- Choose an invoice --', value: '' },
                                    ...purchases.filter(p => p.dueAmount > 0).map(pur => ({
                                        label: `Bill #${pur.billNo} (Due: ₹${pur.dueAmount.toLocaleString()})`,
                                        value: pur._id
                                    }))
                                ]}
                                onChange={(val) => {
                                    const pur = purchases.find(p => p._id === val);
                                    setSelectedPurchaseForPayment(pur);
                                    if (pur) setPaymentInput({ ...paymentInput, amount: pur.dueAmount });
                                }}
                            />

                            {selectedPurchaseForPayment && (
                                <>
                                    <div>
                                        <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', color: '#475569', marginBottom: '8px' }}>Amount (₹)</label>
                                        <input 
                                            type="number" 
                                            required
                                            max={selectedPurchaseForPayment.dueAmount}
                                            value={paymentInput.amount} 
                                            onChange={(e) => setPaymentInput({ ...paymentInput, amount: e.target.value })}
                                            style={{ width: '100%', height: '48px', borderRadius: '12px', border: '2px solid #E2E8F0', padding: '0 16px', fontSize: '15px', outline: 'none' }}
                                        />
                                    </div>

                                    <CustomSelect 
                                        label="Payment Mode"
                                        value={paymentInput.mode} 
                                        options={[
                                            { label: 'Cash', value: 'Cash' },
                                            { label: 'Online / UPI', value: 'Online' },
                                            { label: 'Credit', value: 'Credit' }
                                        ]}
                                        onChange={(val) => setPaymentInput({ ...paymentInput, mode: val })}
                                    />

                                    <div>
                                        <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', color: '#475569', marginBottom: '8px' }}>Note (Optional)</label>
                                        <input 
                                            type="text" 
                                            placeholder="Transaction reference, etc."
                                            value={paymentInput.note} 
                                            onChange={(e) => setPaymentInput({ ...paymentInput, note: e.target.value })}
                                            style={{ width: '100%', height: '48px', borderRadius: '12px', border: '2px solid #E2E8F0', padding: '0 16px', fontSize: '15px', outline: 'none' }}
                                        />
                                    </div>
                                </>
                            )}

                            <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
                                <button 
                                    type="button" 
                                    onClick={() => { setShowPaymentModal(false); setSelectedPurchaseForPayment(null); }}
                                    style={{ flex: 1, height: '48px', borderRadius: '12px', border: '2px solid #E2E8F0', background: 'white', color: '#475569', fontSize: '15px', fontWeight: '700', cursor: 'pointer' }}
                                >
                                    Cancel
                                </button>
                                <button 
                                    type="submit" 
                                    disabled={isSaving || !selectedPurchaseForPayment}
                                    style={{ flex: 1, height: '48px', borderRadius: '12px', border: 'none', background: '#D97706', color: 'white', fontSize: '15px', fontWeight: '800', cursor: 'pointer', opacity: (isSaving || !selectedPurchaseForPayment) ? 0.6 : 1 }}
                                >
                                    {isSaving ? 'Saving...' : 'Pay Balance'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

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
