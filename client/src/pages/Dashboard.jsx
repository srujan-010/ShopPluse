import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
    Store, 
    Package, 
    TrendingUp, 
    AlertTriangle, 
    ArrowRight,
    Plus,
    Calendar,
    ShoppingCart,
    ShoppingBag,
    Users,
    Activity,
    ChevronRight,
    PlusCircle,
    ArrowUpRight,
    ArrowDownRight,
    BarChart3,
    History,
    Zap,
    Briefcase,
    Wallet,
    QrCode,
    FileText,
    Bell,
    CheckCircle2,
    XCircle,
    Filter,
    Clock,
    LayoutGrid,
    MapPin
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { saleService, shopService } from '../services/api';
import { motion, AnimatePresence } from 'framer-motion';
import { EmptyState, Skeleton } from '../components/PremiumUI';
// Chart registration removed as chart was deleted

const Dashboard = () => {
    const { shopId } = useParams();
    const navigate = useNavigate();
    const { user } = useAuth();
    const [stats, setStats] = useState(null);
    const [shop, setShop] = useState(null);
    const [loading, setLoading] = useState(true);
    const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
    const [activityFilter, setActivityFilter] = useState('All');

    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth <= 768);
        window.addEventListener('resize', handleResize);
        
        if (shopId) {
            fetchShopStats();
        } else {
            setLoading(false);
        }
        
        return () => window.removeEventListener('resize', handleResize);
    }, [shopId]);

    const fetchShopStats = async () => {
        setLoading(true);
        try {
            const [statRes, shopRes] = await Promise.all([
                saleService.getShopStats(shopId),
                shopService.getAll()
            ]);
            setStats(statRes.data.data);
            setShop(shopRes.data.data.find(s => s._id === shopId));
        } catch (err) {
            console.error('Dashboard Error:', err);
        } finally {
            setLoading(false);
        }
    };


    if (loading) {
        return (
            <div className="premium-dashboard">
                <header className="premium-header-mobile">
                    <div className="greeting-pill-v2">
                        <Skeleton circle={true} width="32px" height="32px" />
                        <Skeleton width="120px" height="16px" />
                    </div>
                </header>
                <div style={{ padding: '20px' }}>
                    <Skeleton height="120px" borderRadius="24px" className="mb-6" />
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
                        <Skeleton height="100px" borderRadius="20px" />
                        <Skeleton height="100px" borderRadius="20px" />
                    </div>
                    <Skeleton height="40px" width="150px" className="mb-4" />
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        {[1, 2, 3].map(i => <Skeleton key={i} height="80px" borderRadius="16px" />)}
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="premium-dashboard">
            {/* Conditional Rendering based on isMobile */}
            {isMobile ? (
                /* Premium Mobile View */
                <>
                    <header className="mobile-premium-hero">
                        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mobile-hero-content">
                            <div className="hero-text">
                                <div className="shop-context-badge">Active Shop</div>
                                <h1>{shop?.name || 'Shop Dashboard'}</h1>
                                <p><MapPin size={12} /> {shop?.location || 'Business Location'}</p>
                            </div>
                        </motion.div>
                    </header>

                    <section className="premium-kpi-grid mobile-kpi-grid">
                        <div className="featured-kpi">
                            <KPICard 
                                label="Today Sales" 
                                value={`₹${stats?.totalSales?.toLocaleString() || 0}`}
                                type="positive"
                                icon={TrendingUp}
                                color="#1E6BFF"
                                featured={true}
                            />
                        </div>
                        <div className="secondary-kpis">
                            <KPICard label="Profit" value={`₹${stats?.totalProfit?.toLocaleString() || 0}`} type="positive" icon={Zap} color="#7c3aed" />
                            <KPICard label="Orders" value={stats?.totalOrders || 0} type="positive" icon={ShoppingCart} color="#FF7A00" />
                            <KPICard label="Low Stock" value={stats?.lowStockCount || 0} type={stats?.lowStockCount > 0 ? "negative" : "neutral"} icon={AlertTriangle} color="#FF4D4F" />
                        </div>
                    </section>

                    {/* Today Collection Summary (Mobile) */}
                    <section className="premium-section collection-section">
                        <div className="collection-row">
                            <div className="collection-chip">
                                <Wallet size={16} />
                                <span>Cash: ₹{stats?.paymentBreakdown?.Cash || 0}</span>
                            </div>
                            <div className="collection-chip">
                                <QrCode size={16} />
                                <span>UPI: ₹{stats?.paymentBreakdown?.UPI || 0}</span>
                            </div>
                            <div className="collection-chip">
                                <FileText size={16} />
                                <span>Credit: ₹{stats?.paymentBreakdown?.Khata || 0}</span>
                            </div>
                        </div>
                    </section>

                    {/* Pending Alerts (Mobile) */}
                    <section className="premium-section">
                        <div className="section-header-flex">
                            <h2 className="section-title">Pending Alerts</h2>
                            <Bell size={18} color="#FF4D4F" />
                        </div>
                        <div className="alerts-grid">
                            <div className="alert-card" onClick={() => navigate(`/shop/${shopId}/inventory?filter=low-stock`)}>
                                <div className="alert-icon" style={{ background: '#FEF3F2', color: '#B42318' }}><Package size={16} /></div>
                                <div className="alert-text">
                                    <strong>{stats?.pendingMetrics?.lowStockCount || 0} items</strong>
                                    <span>Low stock</span>
                                </div>
                            </div>
                            <div className="alert-card" onClick={() => navigate(`/shop/${shopId}/purchase-ledger`)}>
                                <div className="alert-icon" style={{ background: '#FFFAEB', color: '#B54708' }}><ArrowUpRight size={16} /></div>
                                <div className="alert-text">
                                    <strong>₹{stats?.pendingMetrics?.supplierDues?.toLocaleString() || 0}</strong>
                                    <span>Supplier dues</span>
                                </div>
                            </div>
                            <div className="alert-card" onClick={() => navigate(`/shop/${shopId}/khata`)}>
                                <div className="alert-icon" style={{ background: '#F5FBFF', color: '#006BBD' }}><Users size={16} /></div>
                                <div className="alert-text">
                                    <strong>₹{stats?.pendingMetrics?.customerCredits?.toLocaleString() || 0}</strong>
                                    <span>Khata credit</span>
                                </div>
                            </div>
                        </div>
                    </section>

                    <section className="premium-section">
                        <div className="section-header-flex">
                            <h2 className="section-title">Quick Actions</h2>
                        </div>
                        <div className="mobile-actions-hub">
                            <ActionItem title="New Sale" icon={PlusCircle} color="#1E6BFF" onClick={() => navigate(`/shop/${shopId}/pos`)} />
                            <ActionItem title="Stock" icon={Package} color="#00A86B" onClick={() => navigate(`/shop/${shopId}/inventory`)} />
                            <ActionItem title="Reports" icon={BarChart3} color="#7c3aed" onClick={() => navigate(`/shop/${shopId}/reports`)} />
                            <ActionItem title="Logs" icon={History} color="#ea580c" onClick={() => navigate(`/shop/${shopId}/sales-log`)} />
                        </div>
                    </section>
                </>
            ) : (
                /* Original Desktop View */
                <>
                    <header className="premium-hero">
                        <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="hero-text">
                            <div className="shop-context-badge">Shop Management Mode</div>
                            <h1>{shop?.name || 'Dashboard'}</h1>
                            <p><MapPin size={14} /> {shop?.location || 'Select shop location'}</p>
                        </motion.div>
                    </header>

                    <section className="premium-kpi-grid">
                        <KPICard label="Today Sales" value={`₹${stats?.totalSales?.toLocaleString() || 0}`} type="positive" icon={TrendingUp} color="#1E6BFF" />
                        <KPICard label="Profit" value={`₹${stats?.totalProfit?.toLocaleString() || 0}`} type="positive" icon={Zap} color="#7c3aed" />
                        <KPICard label="Orders" value={stats?.totalOrders || 0} type="positive" icon={ShoppingCart} color="#FF7A00" />
                        <KPICard label="Low Stock" value={stats?.lowStockCount || 0} type={stats?.lowStockCount > 0 ? "negative" : "neutral"} icon={AlertTriangle} color="#FF4D4F" />
                    </section>

                    {/* Today Collection Summary (Desktop) */}
                    <section className="premium-section">
                        <div className="collection-summary-bar">
                            <div className="cs-item">
                                <div className="cs-icon-box cash"><Wallet size={22} /></div>
                                <div><label>Cash</label><strong>₹{stats?.paymentBreakdown?.Cash || 0}</strong></div>
                            </div>
                            <div className="cs-item">
                                <div className="cs-icon-box upi"><QrCode size={22} /></div>
                                <div><label>UPI / Online</label><strong>₹{stats?.paymentBreakdown?.UPI || 0}</strong></div>
                            </div>
                            <div className="cs-item">
                                <div className="cs-icon-box khata"><FileText size={22} /></div>
                                <div><label>Khata / Credit</label><strong>₹{stats?.paymentBreakdown?.Khata || 0}</strong></div>
                            </div>
                            <div className="cs-item total">
                                <div className="cs-icon-box total"><TrendingUp size={24} /></div>
                                <div><label>Today Total</label><strong>₹{stats?.paymentBreakdown?.Total || 0}</strong></div>
                            </div>
                        </div>
                    </section>

                    {/* Pending Alerts (Desktop) */}
                    <section className="premium-section">
                        <h2 className="section-title">Pending Alerts</h2>
                        <div className="alerts-grid desktop">
                            <div className="alert-card" onClick={() => navigate(`/shop/${shopId}/inventory?filter=low-stock`)}>
                                <div className="alert-icon" style={{ background: '#FEF3F2', color: '#B42318' }}><Package size={20} /></div>
                                <div className="alert-text">
                                    <strong>{stats?.pendingMetrics?.lowStockCount || 0} items low on stock</strong>
                                    <span>Click to manage inventory</span>
                                </div>
                                <ArrowRight size={20} className="arrow-icon-desktop" />
                            </div>
                            <div className="alert-card" onClick={() => navigate(`/shop/${shopId}/purchase-ledger`)}>
                                <div className="alert-icon" style={{ background: '#FFFAEB', color: '#B54708' }}><ArrowUpRight size={20} /></div>
                                <div className="alert-text">
                                    <strong>₹{stats?.pendingMetrics?.supplierDues?.toLocaleString() || 0} due to suppliers</strong>
                                    <span>Click to check purchase ledger</span>
                                </div>
                                <ArrowRight size={20} className="arrow-icon-desktop" />
                            </div>
                            <div className="alert-card" onClick={() => navigate(`/shop/${shopId}/khata`)}>
                                <div className="alert-icon" style={{ background: '#F5FBFF', color: '#006BBD' }}><Users size={20} /></div>
                                <div className="alert-text">
                                    <strong>₹{stats?.pendingMetrics?.customerCredits?.toLocaleString() || 0} pending from customers</strong>
                                    <span>Click to open Khata book</span>
                                </div>
                                <ArrowRight size={20} className="arrow-icon-desktop" />
                            </div>
                        </div>
                    </section>

                    <section className="premium-section">
                        <h2 className="section-title">Quick Actions</h2>
                        <div className="quick-actions-grid">
                            <ActionCard title="New Sale" icon={ShoppingCart} color="#1E6BFF" onClick={() => navigate(`/shop/${shopId}/pos`)} />
                            <ActionCard title="Inventory" icon={Package} color="#00A86B" onClick={() => navigate(`/shop/${shopId}/inventory`)} />
                            <ActionCard title="Reports" icon={BarChart3} color="#7c3aed" onClick={() => navigate(`/shop/${shopId}/reports`)} />
                            <ActionCard title="Sales Log" icon={History} color="#ea580c" onClick={() => navigate(`/shop/${shopId}/sales-log`)} />
                        </div>
                    </section>
                </>
            )}

            {/* Common Sections */}
            <section className="premium-section">
                <div className="recent-activity-card">
                    <div className="rac-header">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <h3>Recent Activity</h3>
                            <button 
                                className="btn-text-link" 
                                onClick={() => navigate(`/shop/${shopId}/sales-log`)}
                                style={{ padding: '4px 8px', borderRadius: '8px', background: '#F0F9FF' }}
                            >
                                View All <ArrowRight size={14} />
                            </button>
                        </div>
                        <div className="activity-filters">
                            {['All', 'Sales', 'Payments', 'Stock'].map(f => (
                                <button 
                                    key={f} 
                                    className={activityFilter === f ? 'active' : ''} 
                                    onClick={() => setActivityFilter(f)}
                                >
                                    {f}
                                </button>
                            ))}
                        </div>
                    </div>
                    <div className="rac-list">
                        {stats?.recentSales?.length > 0 ? (
                            stats.recentSales
                            .filter(sale => {
                                if (activityFilter === 'All') return true;
                                if (activityFilter === 'Sales') return true; // Currently all are sales
                                if (activityFilter === 'Payments' && sale.paymentMethod !== 'Cash') return true;
                                return false;
                            })
                            .slice(0, 5)
                            .map((sale, i) => (
                                <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} className="activity-item-premium" onClick={() => navigate(`/shop/${shopId}/sales-log`)}>
                                    <div className="aip-icon-box" style={{ background: sale.paymentMethod === 'Khata' ? '#FEF3F2' : '#F0F9FF' }}>
                                        {sale.paymentMethod === 'Khata' ? <Clock size={18} color="#B42318" /> : <ShoppingCart size={18} color="#026AA2" />}
                                    </div>
                                    <div className="aip-info">
                                        <div className="aip-title">{sale.customerName || 'Walk-in Customer'}</div>
                                        <div className="aip-time">
                                            {sale.paymentMethod} • {sale?.date ? new Date(sale.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Just now'}
                                        </div>
                                    </div>
                                    <div className="aip-amount">₹{((sale?.totalAmount || sale?.salesAmount) || 0).toLocaleString()}</div>
                                    {!isMobile && <ChevronRight size={18} className="aip-arrow" />}
                                </motion.div>
                            ))
                        ) : (
                            <EmptyState 
                                icon={Activity}
                                title="No Activity Yet"
                                description="Your recent sales and transactions will appear here."
                                actionLabel="Create Sale"
                                onAction={() => navigate(`/shop/${shopId}/pos`)}
                                compact={true}
                            />
                        )}
                    </div>
                </div>
            </section>

            <style jsx="true">{`
                .premium-dashboard { display: flex; flex-direction: column; gap: 32px; }
                
                /* DESKTOP STYLES (Original) */
                .premium-hero { display: flex; flex-direction: column; gap: 8px; }
                .shop-context-badge { display: inline-flex; width: fit-content; padding: 4px 12px; background: #F0F9FF; color: #026AA2; font-size: 10px; font-weight: 800; border-radius: 99px; text-transform: uppercase; letter-spacing: 0.05em; border: 1px solid #B9E6FE; margin-bottom: 4px; }
                .hero-text h1 { font-size: 28px; font-weight: 800; color: #101828; margin: 0; letter-spacing: -0.03em; line-height: 1.1; }
                .hero-text p { font-size: 14px; color: #667085; margin: 4px 0 0 0; font-weight: 500; display: flex; align-items: center; gap: 6px; }
                
                .premium-kpi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 18px; }
                .kpi-card { background: white; padding: 24px; border-radius: 28px; border: 1px solid #F2F4F7; box-shadow: 0 4px 20px rgba(0,0,0,0.02); display: flex; flex-direction: column; gap: 16px; transition: 0.3s; }
                .kpi-card:hover { transform: translateY(-6px); box-shadow: 0 20px 40px rgba(0,0,0,0.06); }
                .kpi-icon-tile { width: 56px; height: 56px; border-radius: 18px; display: flex; align-items: center; justify-content: center; color: white; }
                .kpi-data { display: flex; flex-direction: column; gap: 4px; }
                .kpi-label { font-size: 12px; font-weight: 800; color: #667085; text-transform: uppercase; letter-spacing: 0.08em; }
                .kpi-value { font-size: 32px; font-weight: 900; color: #101828; margin: 4px 0; letter-spacing: -0.02em; }
                .kpi-insight { font-size: 12px; font-weight: 700; display: flex; align-items: center; gap: 4px; }
                .kpi-insight.positive { color: #00A86B; }
                .kpi-insight.negative { color: #FF4D4F; }
                .kpi-insight.neutral { color: #667085; }

                .premium-section { display: flex; flex-direction: column; gap: 20px; }
                .section-title { font-size: 24px; font-weight: 800; color: #101828; margin: 0; letter-spacing: -0.02em; }
                .quick-actions-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 18px; }
                .action-card { background: white; height: 160px; border-radius: 28px; border: 1px solid #F2F4F7; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 16px; cursor: pointer; transition: 0.3s; }
                .action-card:hover { border-color: #1E6BFF; background: #F5F9FF; transform: translateY(-4px); box-shadow: 0 15px 30px rgba(30, 107, 255, 0.08); }
                .ac-icon-tile { width: 60px; height: 60px; border-radius: 20px; display: flex; align-items: center; justify-content: center; }
                .ac-icon-tile svg { width: 32px; height: 32px; }
                .action-card span { font-size: 18px; font-weight: 800; color: #101828; }

                .recent-activity-card { background: white; border-radius: 32px; border: 1px solid #F2F4F7; padding: 24px; display: flex; flex-direction: column; gap: 24px; box-shadow: 0 4px 20px rgba(0,0,0,0.02); }
                .rac-header { display: flex; justify-content: space-between; align-items: center; }
                .rac-header h3 { font-size: 20px; font-weight: 800; margin: 0; }
                .btn-text-link { background: none; border: none; color: #1E6BFF; font-weight: 800; font-size: 14px; display: flex; align-items: center; gap: 6px; cursor: pointer; }
                .rac-list { display: flex; flex-direction: column; gap: 12px; }
                .activity-item-premium { display: flex; align-items: center; gap: 16px; padding: 16px; border-radius: 20px; transition: 0.2s; cursor: pointer; border: 1px solid transparent; }
                .activity-item-premium:hover { background: #F9FAFB; border-color: #F2F4F7; }
                .aip-icon-box { width: 44px; height: 44px; background: #F2F4F7; border-radius: 14px; display: flex; align-items: center; justify-content: center; color: #475467; }
                .aip-info { flex: 1; }
                .aip-title { font-size: 16px; font-weight: 700; color: #101828; }
                .aip-time { font-size: 13px; color: #667085; font-weight: 600; margin-top: 2px; }
                .aip-amount { font-size: 18px; font-weight: 900; color: #101828; }
                .aip-arrow { color: #D0D5DD; }
                .empty-activity-premium { padding: 40px 0; text-align: center; color: #98A2B3; }
                .empty-activity-premium p { font-weight: 600; margin-top: 12px; }

                /* MOBILE PREMIUM STYLES */
                @media (max-width: 768px) {
                    .premium-dashboard { gap: 24px; padding: 0 20px 100px 20px; }
                    
                    .mobile-premium-hero { 
                        background: linear-gradient(135deg, #071B44 0%, #1E6BFF 100%);
                        margin: -24px -20px 0 -20px;
                        padding: 32px 20px;
                        border-radius: 0 0 32px 32px;
                        color: white;
                    }
                    .mobile-hero-content { display: flex; flex-direction: column; gap: 8px; }
                    .mobile-hero-content .shop-context-badge { background: rgba(255,255,255,0.2); color: white; border-color: rgba(255,255,255,0.3); }
                    .mobile-hero-content h1 { font-size: 26px; font-weight: 800; color: white; margin: 0; }
                    .mobile-hero-content p { font-size: 13px; color: rgba(255,255,255,0.9); margin: 0; display: flex; align-items: center; gap: 4px; font-weight: 600; }
                    
                    .mobile-kpi-grid { display: flex; flex-direction: column; gap: 16px; }
                    .kpi-card.featured { flex-direction: row; align-items: center; gap: 16px; padding: 20px; border: 1px solid #E5E7EB; }
                    .kpi-card.featured .kpi-icon-tile { width: 52px; height: 52px; border-radius: 16px; }
                    .kpi-card.featured .kpi-value { font-size: 28px; }
                    
                    .secondary-kpis { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
                    .secondary-kpis .kpi-card { padding: 12px; border-radius: 16px; gap: 8px; }
                    .secondary-kpis .kpi-icon-tile { width: 32px; height: 32px; border-radius: 10px; }
                    .secondary-kpis .kpi-icon-tile svg { width: 16px; height: 16px; }
                    .secondary-kpis .kpi-value { font-size: 16px; }
                    .secondary-kpis .kpi-label { font-size: 10px; }
                    .secondary-kpis .kpi-insight { font-size: 10px; }

                    .mobile-actions-hub { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; }
                    .action-item-box { display: flex; flex-direction: column; align-items: center; gap: 8px; }
                    .aib-icon { width: 56px; height: 56px; border-radius: 18px; display: flex; align-items: center; justify-content: center; background: #F5F9FF; }
                    .action-item-box span { font-size: 11px; font-weight: 700; color: #344054; }

                    .recent-activity-card { padding: 16px; border-radius: 20px; }
                    .rac-header { flex-direction: column; align-items: flex-start; gap: 16px; }
                    .rac-header > div:first-child { width: 100%; justify-content: space-between; }
                    .activity-item-premium { padding: 12px; border-radius: 14px; gap: 12px; }
                    .aip-icon-box { width: 36px; height: 36px; border-radius: 10px; }
                    .aip-title { font-size: 13px; }
                    .aip-amount { font-size: 15px; }

                    .collection-row { display: flex; gap: 10px; overflow-x: auto; scrollbar-width: none; margin: 0 -20px; padding: 0 20px; }
                    .collection-row::-webkit-scrollbar { display: none; }
                    .collection-chip { flex: 0 0 auto; background: white; padding: 10px 16px; border-radius: 12px; border: 1px solid #E2E8F0; display: flex; align-items: center; gap: 8px; font-size: 13px; font-weight: 700; color: #475467; }
                    
                    .alerts-grid { display: flex; flex-direction: column; gap: 10px; }
                    .alert-card { background: white; padding: 14px; border-radius: 16px; border: 1px solid #F2F4F7; display: flex; align-items: center; gap: 12px; cursor: pointer; }
                    .alert-icon { width: 40px; height: 40px; border-radius: 10px; display: flex; align-items: center; justify-content: center; }
                    .alert-text { display: flex; flex-direction: column; }
                    .alert-text strong { font-size: 15px; color: #101828; }
                    .alert-text span { font-size: 12px; color: #667085; font-weight: 600; }

                    .activity-filters { display: flex; gap: 8px; margin-top: 12px; overflow-x: auto; }
                    .activity-filters button { padding: 6px 14px; background: #F9FAFB; border: 1px solid #EAECF0; border-radius: 8px; font-size: 12px; font-weight: 700; color: #667085; white-space: nowrap; }
                    .activity-filters button.active { background: #071B44; color: white; border-color: #071B44; }
                }

                /* Desktop Specific Upgrades */
                .alerts-grid.desktop { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; }
                .alerts-grid.desktop .alert-card { 
                    padding: 24px; 
                    border-radius: 28px; 
                    background: white;
                    border: 1px solid #F2F4F7;
                    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
                }
                .alerts-grid.desktop .alert-card:hover { 
                    transform: translateY(-4px);
                    box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
                    border-color: #E5E7EB;
                }
                .alerts-grid.desktop .alert-icon { 
                    width: 52px; 
                    height: 52px; 
                    border-radius: 16px; 
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-weight: bold;
                }
                .alerts-grid.desktop .alert-text {
                    display: flex;
                    flex-direction: column;
                    gap: 2px;
                }
                .alerts-grid.desktop .alert-text strong { 
                    font-size: 18px; 
                    color: #0F172A;
                }
                .alerts-grid.desktop .alert-text span { 
                    color: #64748B;
                    font-weight: 600;
                }
                .alerts-grid.desktop .arrow-icon-desktop {
                    color: #CBD5E1;
                    transition: all 0.2s ease;
                }
                .alerts-grid.desktop .alert-card:hover .arrow-icon-desktop {
                    color: #1E6BFF;
                    transform: translateX(4px);
                }
                .collection-summary-bar { 
                    background: white; 
                    padding: 32px; 
                    border-radius: 36px; 
                    border: 1px solid #F2F4F7; 
                    display: grid; 
                    grid-template-columns: repeat(4, 1fr); 
                    gap: 40px; 
                    box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.05), 0 8px 10px -6px rgba(0, 0, 0, 0.05); 
                }
                .cs-item { display: flex; align-items: center; gap: 20px; transition: all 0.2s ease; }
                .cs-item:hover { transform: translateX(4px); }
                .cs-icon-box { 
                    width: 56px; 
                    height: 56px; 
                    border-radius: 18px; 
                    display: flex; 
                    align-items: center; 
                    justify-content: center; 
                    flex-shrink: 0;
                }
                .cs-icon-box.cash { background: #F0FDF4; color: #15803D; }
                .cs-icon-box.upi { background: #F5F3FF; color: #7C3AED; }
                .cs-icon-box.khata { background: #FEF2F2; color: #B91C1C; }
                .cs-icon-box.total { background: #EFF6FF; color: #1D4ED8; }
                
                .cs-item label { display: block; font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.1em; color: #64748B; margin-bottom: 2px; }
                .cs-item strong { font-size: 26px; font-weight: 900; color: #0F172A; }
                .cs-item.total { border-left: 2px solid #F1F5F9; padding-left: 40px; }
                .cs-item.total strong { color: #1D4ED8; }
                .activity-filters { display: flex; gap: 8px; }
                .activity-filters button { padding: 8px 16px; background: #F9FAFB; border: 1px solid #EAECF0; border-radius: 10px; font-size: 13px; font-weight: 700; color: #667085; cursor: pointer; transition: 0.2s; }
                .activity-filters button:hover { background: #F2F4F7; }
                .activity-filters button.active { background: #071B44; color: white; border-color: #071B44; }

                /* Loader */
                .premium-loader-shell { height: 70vh; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 24px; color: #667085; }
                .loader-orbit { width: 60px; height: 60px; border: 4px solid #F2F4F7; border-top-color: #1E6BFF; border-radius: 50%; animation: orbit 1s infinite linear; }
                @keyframes orbit { to { transform: rotate(360deg); } }
            `}</style>
        </div>
    );
};

const KPICard = ({ label, value, type, icon: Icon, color, featured }) => (
    <motion.div whileHover={{ y: -5 }} className={`kpi-card ${featured ? 'featured' : ''}`}>
        <div className="kpi-icon-tile" style={{ backgroundColor: featured ? color : `${color}15`, color: featured ? 'white' : color }}>
            <Icon size={featured ? 32 : 26} />
        </div>
        <div className="kpi-data">
            <span className="kpi-label">{label}</span>
            <h2 className="kpi-value">{value}</h2>
        </div>
    </motion.div>
);

const ActionCard = ({ title, icon: Icon, color, onClick }) => (
    <motion.div whileTap={{ scale: 0.95 }} className="action-card" onClick={onClick}>
        <div className="ac-icon-tile" style={{ backgroundColor: `${color}15`, color: color }}>
            <Icon strokeWidth={2.5} />
        </div>
        <span>{title}</span>
    </motion.div>
);

const ActionItem = ({ title, icon: Icon, color, onClick }) => (
    <motion.div whileTap={{ scale: 0.9 }} className="action-item-box" onClick={onClick}>
        <div className="aib-icon" style={{ backgroundColor: `${color}15`, color: color }}>
            <Icon size={24} strokeWidth={2.5} />
        </div>
        <span>{title}</span>
    </motion.div>
);

export default Dashboard;
