import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, IndianRupee, Printer, Download, User, Phone, Calendar, FileText, CheckCircle, AlertCircle, Clock, Share2, ChevronDown } from 'lucide-react';
import { purchaseService, shopService } from '../services/api';
import { invoiceService } from '../utils/invoiceService';

const PurchaseDetailsPage = () => {
    const { shopId, purchaseId } = useParams();
    const navigate = useNavigate();
    const [purchase, setPurchase] = useState(null);
    const [shop, setShop] = useState(null);
    const [loading, setLoading] = useState(true);
    const [showReceivePayment, setShowReceivePayment] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [paymentInput, setPaymentInput] = useState({ amount: '', mode: 'Cash', note: '' });
    
    const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
    const [isItemsExpanded, setIsItemsExpanded] = useState(false);

    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth <= 768);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const fetchPurchaseDetails = async () => {
        try {
            setLoading(true);
            const [purRes, shopRes] = await Promise.all([
                purchaseService.getPurchase(purchaseId),
                shopService.getAll()
            ]);
            setPurchase(purRes.data?.data || purRes.data);
            if (shopRes.data && shopRes.data.data) {
                setShop(shopRes.data.data.find(s => s._id === shopId));
            }
        } catch (error) {
            console.error("Failed to load purchase details:", error);
            alert("Unable to retrieve purchase records.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (purchaseId) {
            fetchPurchaseDetails();
        }
    }, [purchaseId]);

    const handleReceivePayment = async (e) => {
        e.preventDefault();
        if (!paymentInput.amount || Number(paymentInput.amount) <= 0) {
            alert("Please enter a valid amount.");
            return;
        }
        try {
            setIsSaving(true);
            await purchaseService.addPayment(purchaseId, {
                amount: Number(paymentInput.amount),
                mode: paymentInput.mode,
                note: paymentInput.note
            });
            alert("Payment recorded successfully!");
            setPaymentInput({ amount: '', mode: 'Cash', note: '' });
            setShowReceivePayment(false);
            fetchPurchaseDetails();
        } catch (error) {
            console.error("Payment failed:", error);
            alert(error.response?.data?.message || "Failed to register payment.");
        } finally {
            setIsSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="loading-container" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '80vh' }}>
                <div className="premium-spinner" style={{ width: '40px', height: '40px', border: '4px solid #F1F5F9', borderTopColor: '#2563EB', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
            </div>
        );
    }

    if (!purchase) {
        return (
            <div className="empty-state" style={{ padding: '40px', textAlign: 'center', color: '#64748B' }}>
                <AlertCircle size={48} style={{ marginBottom: '12px', color: '#EF4444' }} />
                <h3>Purchase record not found</h3>
                <button onClick={() => navigate(`/shop/${shopId}/purchase-ledger`)} style={{ marginTop: '16px', padding: '8px 16px', background: '#2563EB', color: 'white', border: 'none', borderRadius: '8px', fontWeight: '600', cursor: 'pointer' }}>
                    Back to Ledger
                </button>
            </div>
        );
    }

    const handleDownloadPDF = () => {
        if (!purchase) return;
        invoiceService.downloadInvoice(purchase, shop, 'PURCHASE');
    };

    // Payment Status configuration
    const getStatusConfig = (status) => {
        switch (status) {
            case 'Paid':
                return { bg: '#D1FAE5', color: '#065F46', icon: <CheckCircle size={16} /> };
            case 'Partial Paid':
                return { bg: '#FEF3C7', color: '#92400E', icon: <Clock size={16} /> };
            default:
                return { bg: '#FEE2E2', color: '#991B1B', icon: <AlertCircle size={16} /> };
        }
    };

    const statusConfig = getStatusConfig(purchase.paymentStatus);
    const paidRatio = purchase.totalAmount > 0 ? (purchase.paidAmount / purchase.totalAmount) * 100 : 0;

    /* ─────────── MOBILE LAYOUT ─────────── */
    if (isMobile) {
        const handleShare = async () => {
            await invoiceService.shareInvoice(purchase, shop, 'PURCHASE');
        };

        return (
            <div style={{ background: '#F8FAFC', minHeight: '100vh', paddingBottom: '90px', fontFamily: 'inherit' }}>

                {/* ── Compact Header ── */}
                <div style={{ background: 'white', padding: '10px 12px', display: 'flex', alignItems: 'center', gap: '10px', borderBottom: '1px solid #E2E8F0', position: 'sticky', top: 0, zIndex: 50, height: '56px', boxSizing: 'border-box' }}>
                    <button onClick={() => navigate(`/shop/${shopId}/purchase-ledger`)}
                        style={{ background: '#F1F5F9', border: 'none', width: '32px', height: '32px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
                        <ArrowLeft size={18} color="#475569" />
                    </button>
                    <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
                        <div style={{ fontSize: '18px', fontWeight: '800', color: '#0F172A', lineHeight: 1.1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Purchase Details</div>
                        <div style={{ fontSize: '12px', color: '#64748B', fontWeight: '600', marginTop: '2px' }}>
                            Bill #{purchase.billNo}
                        </div>
                    </div>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: statusConfig.bg, color: statusConfig.color, padding: '4px 10px', borderRadius: '8px', fontSize: '11px', fontWeight: '800', flexShrink: 0 }}>
                        {statusConfig.icon}{purchase.paymentStatus}
                    </span>
                </div>

                <div style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: '12px' }}>

                    {/* ── Financial Swipe Row ── */}
                    <div className="sl-summary-grid-mobile" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                        <div style={{ background: purchase.dueAmount > 0 ? 'linear-gradient(135deg, #FFFBEB, #FEF3C7)' : 'white', border: '1px solid', borderColor: purchase.dueAmount > 0 ? '#FCD34D' : '#E2E8F0', borderRadius: '16px', padding: '14px 16px', display: 'flex', flexDirection: 'column', justifyContent: 'center', height: 'auto', boxSizing: 'border-box', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
                            <span style={{ fontSize: '11px', fontWeight: '800', color: purchase.dueAmount > 0 ? '#B45309' : '#64748B', textTransform: 'uppercase', marginBottom: '4px' }}>Due</span>
                            <strong style={{ fontSize: '18px', fontWeight: '900', color: purchase.dueAmount > 0 ? '#92400E' : '#0F172A' }}>₹{Intl.NumberFormat('en-IN', { notation: "compact", maximumFractionDigits: 1 }).format(purchase.dueAmount || 0)}</strong>
                        </div>
                        <div style={{ background: 'white', border: '1px solid #E2E8F0', borderRadius: '16px', padding: '14px 16px', display: 'flex', flexDirection: 'column', justifyContent: 'center', height: 'auto', boxSizing: 'border-box', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
                            <span style={{ fontSize: '11px', fontWeight: '700', color: '#64748B', textTransform: 'uppercase', marginBottom: '4px' }}>Paid</span>
                            <strong style={{ fontSize: '18px', fontWeight: '900', color: '#10B981' }}>₹{Intl.NumberFormat('en-IN', { notation: "compact", maximumFractionDigits: 1 }).format(purchase.paidAmount || 0)}</strong>
                        </div>
                        <div style={{ background: 'white', border: '1px solid #E2E8F0', borderRadius: '16px', padding: '14px 16px', display: 'flex', flexDirection: 'column', justifyContent: 'center', height: 'auto', boxSizing: 'border-box', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
                            <span style={{ fontSize: '11px', fontWeight: '700', color: '#64748B', textTransform: 'uppercase', marginBottom: '4px' }}>Total</span>
                            <strong style={{ fontSize: '18px', fontWeight: '900', color: '#0F172A' }}>₹{Intl.NumberFormat('en-IN', { notation: "compact", maximumFractionDigits: 1 }).format(purchase.totalAmount || 0)}</strong>
                        </div>
                        <div style={{ background: 'white', border: '1px solid #E2E8F0', borderRadius: '16px', padding: '14px 16px', display: 'flex', flexDirection: 'column', justifyContent: 'center', height: 'auto', boxSizing: 'border-box', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
                            <span style={{ fontSize: '11px', fontWeight: '700', color: '#64748B', textTransform: 'uppercase', marginBottom: '4px' }}>Items</span>
                            <strong style={{ fontSize: '18px', fontWeight: '900', color: '#0F172A' }}>{(purchase.items||[]).length}</strong>
                        </div>
                    </div>

                    {/* ── Quick Action Pills ── */}
                    <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '4px', scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' }}>
                        {purchase.dueAmount > 0 && (
                            <button onClick={() => setShowReceivePayment(!showReceivePayment)}
                                style={{ flexShrink: 0, background: '#D97706', color: 'white', border: 'none', height: '36px', padding: '0 16px', borderRadius: '18px', fontSize: '13px', fontWeight: '800', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', boxShadow: '0 2px 8px rgba(217,119,6,0.2)' }}>
                                <IndianRupee size={14} /> Pay
                            </button>
                        )}
                        <button onClick={handleDownloadPDF}
                            style={{ flexShrink: 0, background: 'white', color: '#334155', border: '1.5px solid #E2E8F0', height: '36px', padding: '0 16px', borderRadius: '18px', fontSize: '12px', fontWeight: '700', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <Download size={14} /> PDF
                        </button>
                        <button onClick={() => window.print()}
                            style={{ flexShrink: 0, background: 'white', color: '#334155', border: '1.5px solid #E2E8F0', height: '36px', padding: '0 16px', borderRadius: '18px', fontSize: '12px', fontWeight: '700', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <Printer size={14} /> Print
                        </button>
                        <button onClick={handleShare}
                            style={{ flexShrink: 0, background: 'white', color: '#334155', border: '1.5px solid #E2E8F0', height: '36px', padding: '0 16px', borderRadius: '18px', fontSize: '12px', fontWeight: '700', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <Share2 size={14} /> Share
                        </button>
                    </div>

                    {/* ── Supplier Info Card ── */}
                    <div style={{ background: 'white', borderRadius: '12px', padding: '12px', border: '1px solid #E2E8F0' }}>
                        <div style={{ fontSize: '10px', fontWeight: '800', color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '8px' }}>Supplier Info</div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <div style={{ background: '#EFF6FF', width: '38px', height: '38px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                    <User size={18} color="#2563EB" />
                                </div>
                                <div>
                                    <div style={{ fontSize: '11px', color: '#94A3B8', fontWeight: '600' }}>Supplier</div>
                                    <div
                                        style={{ fontSize: '15px', fontWeight: '800', color: purchase.supplierName ? '#2563EB' : '#1E293B', cursor: purchase.supplierName ? 'pointer' : 'default', textDecoration: purchase.supplierName ? 'underline' : 'none' }}
                                        onClick={() => purchase.supplierName && navigate(`/shop/${shopId}/suppliers/${encodeURIComponent(purchase.supplierName)}`)}
                                    >
                                        {purchase.supplierName || 'Direct Entry'}
                                    </div>
                                </div>
                            </div>
                            {purchase.supplierPhone && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                    <a href={`tel:${purchase.supplierPhone}`} style={{ background: '#F0FDF4', width: '38px', height: '38px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, textDecoration: 'none' }}>
                                        <Phone size={18} color="#16A34A" />
                                    </a>
                                    <div>
                                        <div style={{ fontSize: '11px', color: '#94A3B8', fontWeight: '600' }}>Phone</div>
                                        <div style={{ fontSize: '15px', fontWeight: '700', color: '#1E293B' }}>{purchase.supplierPhone}</div>
                                    </div>
                                </div>
                            )}
                            <div style={{ display: 'flex', gap: '12px', background: '#F8FAFC', borderRadius: '12px', padding: '12px' }}>
                                <div style={{ flex: 1 }}>
                                    <div style={{ fontSize: '11px', color: '#94A3B8', fontWeight: '600' }}>Date</div>
                                    <div style={{ fontSize: '13px', fontWeight: '700', color: '#1E293B', marginTop: '2px' }}>{new Date(purchase.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</div>
                                </div>
                                <div style={{ flex: 1 }}>
                                    <div style={{ fontSize: '11px', color: '#94A3B8', fontWeight: '600' }}>Payment Mode</div>
                                    <div style={{ fontSize: '13px', fontWeight: '700', color: '#1E293B', marginTop: '2px' }}>{purchase.paymentMethod || purchase.paymentMode || 'Cash'}</div>
                                </div>
                                {purchase.billNo && (
                                    <div style={{ flex: 1 }}>
                                        <div style={{ fontSize: '11px', color: '#94A3B8', fontWeight: '600' }}>Bill No</div>
                                        <div style={{ fontSize: '13px', fontWeight: '700', color: '#1E293B', marginTop: '2px' }}>#{purchase.billNo}</div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* ── Items Purchased (Accordion) ── */}
                    <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #E2E8F0', overflow: 'hidden' }}>
                        <button
                            onClick={() => setIsItemsExpanded(!isItemsExpanded)}
                            style={{ width: '100%', background: 'none', border: 'none', padding: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}>
                            <span style={{ fontSize: '13px', fontWeight: '800', color: '#0F172A' }}>Items Purchased ({(purchase.items||[]).length})</span>
                            <motion.div animate={{ rotate: isItemsExpanded ? 180 : 0 }} transition={{ duration: 0.2 }}>
                                <ChevronDown size={18} color="#64748B" />
                            </motion.div>
                        </button>
                        {isItemsExpanded && (
                            <div style={{ padding: '0 10px 10px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                {(purchase.items || []).map((item, i) => (
                                    <div key={i} style={{ background: '#F8FAFC', borderRadius: '10px', padding: '10px 12px', border: '1px solid #E2E8F0' }}>
                                        <div style={{ fontSize: '13px', fontWeight: '800', color: '#0F172A', marginBottom: '4px' }}>{item.productName}</div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <span style={{ fontSize: '11px', color: '#64748B', fontWeight: '600' }}>
                                                {item.quantity} {item.unit || 'Pc'} × ₹{(item.purchaseRate||0).toLocaleString()}
                                            </span>
                                            <span style={{ fontSize: '13px', fontWeight: '900', color: '#1E293B' }}>₹{(item.itemTotal||0).toLocaleString()}</span>
                                        </div>
                                    </div>
                                ))}
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', background: '#EFF6FF', borderRadius: '12px', marginTop: '4px' }}>
                                    <span style={{ fontSize: '13px', fontWeight: '700', color: '#2563EB' }}>Grand Total</span>
                                    <span style={{ fontSize: '18px', fontWeight: '900', color: '#1E40AF' }}>₹{(purchase.totalAmount||0).toLocaleString()}</span>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* ── Payment History Timeline ── */}
                    <div style={{ background: 'white', borderRadius: '16px', padding: '16px', border: '1px solid #E2E8F0' }}>
                        <div style={{ fontSize: '14px', fontWeight: '800', color: '#0F172A', marginBottom: '12px' }}>Payment History</div>
                        {(!purchase.paymentHistory || purchase.paymentHistory.length === 0) ? (
                            <div style={{ textAlign: 'center', color: '#94A3B8', fontSize: '12px', fontStyle: 'italic', padding: '8px' }}>No payments recorded yet.</div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                {(purchase.paymentHistory || []).map((h, idx) => (
                                    <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#F0FDF4', borderRadius: '12px', padding: '12px 14px', borderLeft: '4px solid #10B981' }}>
                                        <div>
                                            <div style={{ fontSize: '15px', fontWeight: '800', color: '#065F46' }}>₹{(h.amount||0).toLocaleString()}</div>
                                            <div style={{ fontSize: '12px', color: '#64748B', marginTop: '2px' }}>via {h.mode}{h.note ? ` · ${h.note}` : ''}</div>
                                        </div>
                                        <span style={{ fontSize: '12px', color: '#64748B', fontWeight: '600', background: 'white', padding: '4px 8px', borderRadius: '6px', border: '1px solid #D1FAE5', flexShrink: 0 }}>
                                            {new Date(h.paidAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Notes */}
                    {purchase.notes && (
                        <div style={{ background: 'white', borderRadius: '16px', padding: '16px', border: '1px solid #E2E8F0' }}>
                            <div style={{ fontSize: '12px', fontWeight: '800', color: '#0F172A', marginBottom: '8px' }}>Remarks</div>
                            <p style={{ margin: 0, fontSize: '13px', color: '#475569', background: '#F8FAFC', padding: '10px', borderRadius: '8px', borderLeft: '3px solid #94A3B8' }}>{purchase.notes}</p>
                        </div>
                    )}
                </div>

                {/* ── Inline Payment Form (slides in above sticky FAB) ── */}
                {showReceivePayment && (
                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                        style={{ position: 'fixed', bottom: 'calc(150px + env(safe-area-inset-bottom))', left: '12px', right: '12px', background: 'white', borderRadius: '20px', padding: '20px', boxShadow: '0 -8px 32px rgba(0,0,0,0.15)', border: '1.5px solid #FCD34D', zIndex: 60 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                            <span style={{ fontSize: '15px', fontWeight: '800', color: '#78350F' }}>Record Payment</span>
                            <button onClick={() => setShowReceivePayment(false)} style={{ background: 'none', border: 'none', fontSize: '20px', color: '#94A3B8', cursor: 'pointer', lineHeight: 1 }}>×</button>
                        </div>
                        <form onSubmit={handleReceivePayment} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            <input type="number" required placeholder={`Max ₹${(purchase.dueAmount||0).toLocaleString()}`} max={purchase.dueAmount}
                                value={paymentInput.amount} onChange={e => setPaymentInput({...paymentInput, amount: e.target.value})}
                                style={{ width: '100%', height: '48px', padding: '0 16px', borderRadius: '12px', border: '2px solid #FCD34D', fontSize: '16px', fontWeight: '700', outline: 'none', boxSizing: 'border-box' }} />
                            <div style={{ display: 'flex', gap: '8px' }}>
                                <select value={paymentInput.mode} onChange={e => setPaymentInput({...paymentInput, mode: e.target.value})}
                                    style={{ flex: 1, height: '44px', padding: '0 12px', borderRadius: '12px', border: '2px solid #E2E8F0', fontSize: '14px', fontWeight: '600', outline: 'none' }}>
                                    <option value="Cash">Cash</option>
                                    <option value="UPI">UPI</option>
                                    <option value="Bank">Bank</option>
                                </select>
                                <input type="text" placeholder="Note (optional)" value={paymentInput.note}
                                    onChange={e => setPaymentInput({...paymentInput, note: e.target.value})}
                                    style={{ flex: 1, height: '44px', padding: '0 12px', borderRadius: '12px', border: '2px solid #E2E8F0', fontSize: '14px', outline: 'none' }} />
                            </div>
                            <div style={{ display: 'flex', gap: '10px' }}>
                                <button type="button" onClick={() => setShowReceivePayment(false)}
                                    style={{ flex: 1, height: '48px', borderRadius: '12px', border: '2px solid #E2E8F0', background: 'white', color: '#475569', fontSize: '14px', fontWeight: '700', cursor: 'pointer' }}>
                                    Cancel
                                </button>
                                <button type="submit" disabled={isSaving}
                                    style={{ flex: 2, height: '48px', borderRadius: '12px', border: 'none', background: '#D97706', color: 'white', fontSize: '15px', fontWeight: '800', cursor: 'pointer', opacity: isSaving ? 0.7 : 1 }}>
                                    {isSaving ? 'Saving…' : 'Save Payment'}
                                </button>
                            </div>
                        </form>
                    </motion.div>
                )}

                {/* ── Sticky Bottom FAB ── */}
                {purchase.dueAmount > 0 && !showReceivePayment && (
                    <button onClick={() => setShowReceivePayment(true)}
                        style={{ position: 'fixed', bottom: 'calc(140px + env(safe-area-inset-bottom))', left: '16px', right: '16px', height: '54px', background: 'linear-gradient(135deg, #D97706, #B45309)', color: 'white', border: 'none', borderRadius: '16px', fontSize: '16px', fontWeight: '800', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', boxShadow: '0 8px 20px rgba(217,119,6,0.4)', zIndex: 55 }}>
                        <IndianRupee size={20} />
                        Record Payment · ₹{(purchase.dueAmount||0).toLocaleString()} Due
                    </button>
                )}
            </div>
        );
    }

    /* ─────────── DESKTOP LAYOUT (unchanged) ─────────── */
    return (
        <div className="purchase-details-view" style={{ maxWidth: '1400px', margin: '0 auto', padding: '24px' }}>
            
            {/* Header Section */}
            <div className="pd-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '24px', borderBottom: '2px solid #F1F5F9', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <button 
                        onClick={() => navigate(`/shop/${shopId}/purchase-ledger`)} 
                        style={{ background: 'white', border: '1.5px solid #E2E8F0', color: '#475569', width: '40px', height: '40px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'all 0.2s' }}
                    >
                        <ArrowLeft size={20} />
                    </button>
                    <div>
                        <h2 style={{ fontSize: '28px', fontWeight: '900', color: '#0F172A', margin: 0, letterSpacing: '-0.02em' }}>Purchase Details</h2>
                        <p style={{ fontSize: '15px', fontWeight: '600', color: '#64748B', margin: '4px 0 0 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span>Bill #{purchase.billNo}</span>
                            <span>•</span>
                            <Calendar size={14} />
                            <span>{new Date(purchase.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                        </p>
                    </div>
                </div>

                {/* Top Action Bar */}
                <div style={{ display: 'flex', gap: '12px' }}>
                    {purchase.dueAmount > 0 && (
                        <button 
                            onClick={() => setShowReceivePayment(!showReceivePayment)} 
                            style={{ background: '#D97706', border: 'none', color: 'white', padding: '0 20px', height: '44px', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', fontWeight: '800', cursor: 'pointer', boxShadow: '0 4px 6px -1px rgba(217, 119, 6, 0.2)' }}
                        >
                            <IndianRupee size={18} />
                            <span>Record Payment</span>
                        </button>
                    )}
                    <button 
                        onClick={handleDownloadPDF} 
                        style={{ background: 'white', border: '2px solid #E2E8F0', color: '#334155', padding: '0 16px', height: '44px', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', fontWeight: '700', cursor: 'pointer' }}
                    >
                        <Download size={18} />
                        <span>Download PDF</span>
                    </button>
                    <button 
                        onClick={() => window.print()} 
                        style={{ background: 'white', border: '2px solid #E2E8F0', color: '#334155', padding: '0 16px', height: '44px', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', fontWeight: '700', cursor: 'pointer' }}
                    >
                        <Printer size={18} />
                        <span>Print Bill</span>
                    </button>
                </div>
            </div>

            {/* Layout Structure */}
            <div className="pd-main-layout" style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: '24px', alignItems: 'start' }}>
                
                {/* LEFT SIDE */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                    
                    {/* Supplier Meta (Compact View) */}
                    <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '20px', padding: '20px', display: 'flex', gap: '32px', flexWrap: 'wrap' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <div style={{ background: '#E0F2FE', color: '#0284C7', width: '44px', height: '44px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <User size={20} />
                            </div>
                            <div>
                                <span style={{ fontSize: '12px', color: '#64748B', textTransform: 'uppercase', fontWeight: '700', letterSpacing: '0.05em' }}>Supplier</span>
                                <span
                                    style={{ fontSize: '16px', fontWeight: '800', color: purchase.supplierName ? '#2563EB' : '#0F172A', display: 'block', marginTop: '2px', cursor: purchase.supplierName ? 'pointer' : 'default', textDecoration: purchase.supplierName ? 'underline' : 'none' }}
                                    onClick={() => purchase.supplierName && navigate(`/shop/${shopId}/suppliers/${encodeURIComponent(purchase.supplierName)}`)}
                                >{purchase.supplierName || 'Direct Inventory Entry'}</span>
                            </div>
                        </div>

                        {purchase.supplierPhone && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <div style={{ background: '#F0FDF4', color: '#16A34A', width: '44px', height: '44px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <Phone size={20} />
                                </div>
                                <div>
                                    <span style={{ fontSize: '12px', color: '#64748B', textTransform: 'uppercase', fontWeight: '700', letterSpacing: '0.05em' }}>Contact</span>
                                    <span style={{ fontSize: '16px', fontWeight: '800', color: '#0F172A', display: 'block', marginTop: '2px' }}>{purchase.supplierPhone}</span>
                                </div>
                            </div>
                        )}

                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginLeft: 'auto' }}>
                            <div style={{ background: '#F1F5F9', color: '#475569', width: '44px', height: '44px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <Clock size={20} />
                            </div>
                            <div>
                                <span style={{ fontSize: '12px', color: '#64748B', textTransform: 'uppercase', fontWeight: '700', letterSpacing: '0.05em' }}>Created At</span>
                                <span style={{ fontSize: '15px', fontWeight: '700', color: '#334155', display: 'block', marginTop: '2px' }}>{new Date(purchase.createdAt || purchase.date).toLocaleString()}</span>
                            </div>
                        </div>
                    </div>

                    {/* Items Table */}
                    <div style={{ background: 'white', border: '1px solid #E2E8F0', borderRadius: '24px', padding: '24px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02)' }}>
                        <h4 style={{ margin: '0 0 16px 0', fontSize: '16px', color: '#0F172A', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: '800' }}>Items Purchased</h4>
                        <div className="table-responsive-wrapper">
                            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                <thead>
                                    <tr style={{ background: '#F8FAFC', borderBottom: '2px solid #E2E8F0' }}>
                                        <th style={{ textAlign: 'left', padding: '16px', fontSize: '13px', color: '#475569', fontWeight: '700', borderRadius: '10px 0 0 10px' }}>Product / Item</th>
                                        <th style={{ textAlign: 'center', padding: '16px', fontSize: '13px', color: '#475569', fontWeight: '700', width: '100px' }}>Qty</th>
                                        <th style={{ textAlign: 'right', padding: '16px', fontSize: '13px', color: '#475569', fontWeight: '700', width: '140px' }}>Rate</th>
                                        <th style={{ textAlign: 'right', padding: '16px', fontSize: '13px', color: '#475569', fontWeight: '700', width: '140px', borderRadius: '0 10px 10px 0' }}>Total</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {(purchase.items || []).map((item, i) => (
                                        <tr key={i} style={{ borderBottom: '1px solid #F1F5F9', transition: 'background 0.2s' }}>
                                            <td style={{ padding: '18px 16px', fontSize: '15px', fontWeight: '700', color: '#1E293B' }}>{item.productName}</td>
                                            <td style={{ padding: '18px 16px', textAlign: 'center', fontSize: '15px', color: '#334155', fontWeight: '600' }}>{item.quantity} {item.unit || 'Pc'}</td>
                                            <td style={{ padding: '18px 16px', textAlign: 'right', fontSize: '15px', color: '#334155', fontWeight: '600' }}>₹{item.purchaseRate.toLocaleString()}</td>
                                            <td style={{ padding: '18px 16px', textAlign: 'right', fontSize: '15px', fontWeight: '800', color: '#0F172A' }}>₹{item.itemTotal.toLocaleString()}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Payment History */}
                    <div style={{ background: 'white', border: '1px solid #E2E8F0', borderRadius: '24px', padding: '24px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02)' }}>
                        <h4 style={{ margin: '0 0 20px 0', fontSize: '16px', color: '#0F172A', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: '800' }}>Payment History</h4>
                        {(!purchase.paymentHistory || purchase.paymentHistory.length === 0) ? (
                            <div style={{ fontSize: '14px', color: '#64748B', fontStyle: 'italic', background: '#F8FAFC', padding: '20px', borderRadius: '16px', textAlign: 'center' }}>
                                No independent payment history logged.
                            </div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', position: 'relative', paddingLeft: '20px' }}>
                                <div style={{ position: 'absolute', left: '5px', top: '8px', bottom: '8px', width: '2px', background: '#E2E8F0' }} />
                                {(purchase.paymentHistory || []).map((h, idx) => (
                                    <div key={idx} style={{ position: 'relative', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#F8FAFC', padding: '16px 20px', borderRadius: '16px', borderLeft: '5px solid #10B981' }}>
                                        <div style={{ position: 'absolute', left: '-20px', top: 'calc(50% - 6px)', width: '12px', height: '12px', borderRadius: '50%', background: '#10B981', border: '3px solid white' }} />
                                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                                            <span style={{ fontSize: '15px', fontWeight: '800', color: '#1E293B' }}>₹{(h.amount || 0).toLocaleString()}</span>
                                            <span style={{ fontSize: '13px', color: '#64748B', marginTop: '2px' }}>Via {h.mode} {h.note && `• Note: ${h.note}`}</span>
                                        </div>
                                        <span style={{ fontSize: '13px', color: '#64748B', fontWeight: '600', background: 'white', padding: '4px 12px', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
                                            {new Date(h.paidAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Internal Notes (Optional) */}
                    {purchase.notes && (
                        <div style={{ background: 'white', border: '1px solid #E2E8F0', borderRadius: '24px', padding: '24px' }}>
                            <h4 style={{ margin: '0 0 12px 0', fontSize: '16px', color: '#0F172A', textTransform: 'uppercase', fontWeight: '800' }}>Remarks / Notes</h4>
                            <p style={{ margin: 0, fontSize: '15px', color: '#475569', background: '#F8FAFC', padding: '16px', borderRadius: '12px', borderLeft: '4px solid #94A3B8' }}>{purchase.notes}</p>
                        </div>
                    )}
                </div>

                {/* RIGHT SIDE Sticky Summary */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', position: 'sticky', top: '24px' }}>
                    
                    {/* Financial Box */}
                    <div style={{ background: 'white', border: '1px solid #E2E8F0', padding: '28px', borderRadius: '24px', display: 'flex', flexDirection: 'column', gap: '20px', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.03)' }}>
                        <div>
                            <span style={{ fontSize: '12px', color: '#64748B', display: 'block', textTransform: 'uppercase', fontWeight: '700', letterSpacing: '0.05em' }}>Status</span>
                            <span 
                                style={{ 
                                    display: 'inline-flex', 
                                    alignItems: 'center',
                                    gap: '6px',
                                    marginTop: '8px',
                                    background: statusConfig.bg,
                                    color: statusConfig.color,
                                    padding: '6px 16px',
                                    borderRadius: '10px',
                                    fontWeight: '800',
                                    fontSize: '14px'
                                }}
                            >
                                {statusConfig.icon}
                                <span>{purchase.paymentStatus}</span>
                            </span>
                        </div>

                        <div style={{ borderTop: '1px solid #F1F5F9', paddingTop: '20px' }}>
                            <span style={{ fontSize: '13px', color: '#64748B', display: 'block', fontWeight: '600' }}>Grand Total</span>
                            <strong style={{ color: '#0F172A', fontSize: '32px', fontWeight: '900', display: 'block', marginTop: '4px' }}>₹{(purchase.totalAmount || 0).toLocaleString()}</strong>
                        </div>

                        <div>
                            <span style={{ fontSize: '13px', color: '#64748B', display: 'block', fontWeight: '600' }}>Paid Amount</span>
                            <strong style={{ color: '#10B981', fontSize: '20px', fontWeight: '800', display: 'block', marginTop: '4px' }}>₹{(purchase.paidAmount || 0).toLocaleString()}</strong>
                        </div>

                        <div style={{ background: '#FFFBEB', padding: '16px', borderRadius: '16px', border: '1px solid #FEF3C7' }}>
                            <span style={{ fontSize: '13px', color: '#B45309', display: 'block', fontWeight: '700' }}>Pending Due</span>
                            <strong style={{ color: purchase.dueAmount > 0 ? '#B45309' : '#64748B', fontSize: '24px', fontWeight: '900', display: 'block', marginTop: '4px' }}>₹{(purchase.dueAmount || 0).toLocaleString()}</strong>
                        </div>

                        {/* Visual Progress Bar */}
                        <div style={{ marginTop: '8px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', fontWeight: '700', color: '#64748B', marginBottom: '6px' }}>
                                <span>Paid Ratio</span>
                                <span>{paidRatio.toFixed(0)}%</span>
                            </div>
                            <div style={{ width: '100%', height: '8px', background: '#E2E8F0', borderRadius: '4px', overflow: 'hidden' }}>
                                <motion.div 
                                    initial={{ width: 0 }} 
                                    animate={{ width: `${paidRatio}%` }} 
                                    transition={{ duration: 0.5 }}
                                    style={{ height: '100%', background: '#10B981', borderRadius: '4px' }} 
                                />
                            </div>
                        </div>
                    </div>

                    {/* Floating Payment Drawer Component */}
                    {showReceivePayment && (
                        <motion.div 
                            initial={{ opacity: 0, y: -10 }} 
                            animate={{ opacity: 1, y: 0 }} 
                            style={{ background: '#FFFBEB', border: '1.5px solid #FCD34D', padding: '24px', borderRadius: '24px' }}
                        >
                            <h4 style={{ margin: '0 0 16px 0', fontSize: '16px', color: '#78350F', fontWeight: '800' }}>Record Supplier Payment</h4>
                            <form onSubmit={handleReceivePayment} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                <div>
                                    <label style={{ fontSize: '12px', fontWeight: '700', color: '#92400E', display: 'block', marginBottom: '6px' }}>Amount</label>
                                    <input 
                                        type="number" 
                                        placeholder="₹ Enter amount" 
                                        required 
                                        max={purchase.dueAmount}
                                        style={{ width: '100%', height: '44px', padding: '0 16px', borderRadius: '10px', border: '1px solid #FCD34D', outline: 'none', fontSize: '15px', fontWeight: '600', background: 'white' }} 
                                        value={paymentInput.amount} 
                                        onChange={e => setPaymentInput({...paymentInput, amount: e.target.value})} 
                                    />
                                </div>
                                <div>
                                    <label style={{ fontSize: '12px', fontWeight: '700', color: '#92400E', display: 'block', marginBottom: '6px' }}>Payment Mode</label>
                                    <select 
                                        style={{ width: '100%', height: '44px', padding: '0 16px', borderRadius: '10px', border: '1px solid #FCD34D', outline: 'none', fontSize: '15px', fontWeight: '600', background: 'white' }} 
                                        value={paymentInput.mode} 
                                        onChange={e => setPaymentInput({...paymentInput, mode: e.target.value})}
                                    >
                                        <option value="Cash">Cash</option>
                                        <option value="UPI">UPI</option>
                                        <option value="Bank">Bank</option>
                                    </select>
                                </div>
                                <div>
                                    <label style={{ fontSize: '12px', fontWeight: '700', color: '#92400E', display: 'block', marginBottom: '6px' }}>Note (Optional)</label>
                                    <input 
                                        type="text" 
                                        placeholder="Internal reference" 
                                        style={{ width: '100%', height: '44px', padding: '0 16px', borderRadius: '10px', border: '1px solid #FCD34D', outline: 'none', fontSize: '15px', fontWeight: '600', background: 'white' }} 
                                        value={paymentInput.note} 
                                        onChange={e => setPaymentInput({...paymentInput, note: e.target.value})} 
                                    />
                                </div>
                                <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                                    <button 
                                        type="button" 
                                        onClick={() => setShowReceivePayment(false)}
                                        style={{ padding: '0 16px', height: '40px', background: 'none', border: '1px solid #FCD34D', color: '#92400E', borderRadius: '8px', fontSize: '14px', fontWeight: '600', cursor: 'pointer' }}
                                    >
                                        Cancel
                                    </button>
                                    <button 
                                        type="submit" 
                                        disabled={isSaving}
                                        style={{ padding: '0 20px', height: '40px', background: '#D97706', border: 'none', color: 'white', borderRadius: '8px', fontSize: '14px', fontWeight: '700', cursor: 'pointer' }}
                                    >
                                        {isSaving ? 'Processing...' : 'Save Payment'}
                                    </button>
                                </div>
                            </form>
                        </motion.div>
                    )}
                </div>
            </div>

            {/* Mobile Responsive adjustments (Floating styles handled organically) */}
            <style>{`
                @media (max-width: 1024px) {
                    .pd-main-layout {
                        grid-template-columns: 1fr !important;
                    }
                }
            `}</style>
        </div>
    );
};

export default PurchaseDetailsPage;
