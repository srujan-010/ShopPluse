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
    MapPin,
    RotateCcw,
    RefreshCw,
    Search,
    X,
    ExternalLink,
    ShieldAlert
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { saleService, shopService, productService } from '../services/api';
import { offlineDB } from '../services/offlineDB';
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
    const [expiryModalOpen, setExpiryModalOpen] = useState(false);
    const [expiryModalTab, setExpiryModalTab] = useState('expiring');

    const expiryMetrics = stats?.pendingMetrics?.expiryAlerts || stats?.expiryAlerts || {
        expiringSoonCount: 0,
        expiredCount: 0,
        nearestExpiryDays: null,
        nearestExpiryDate: null,
        urgency: 'none'
    };
    const expiringCount = expiryMetrics.expiringSoonCount || 0;
    const expiredCount = expiryMetrics.expiredCount || 0;
    const nearestDays = expiryMetrics.nearestExpiryDays;
    const nearestDate = expiryMetrics.nearestExpiryDate;
    const expiryUrgency = expiryMetrics.urgency || 'none';

    const handleOpenExpiryModal = (tab = 'expiring') => {
        setExpiryModalTab(tab);
        setExpiryModalOpen(true);
    };

    const formatNearestExpiry = (dateStr, days) => {
        if (days === null || days === undefined) return '';
        if (days === 0) return 'Nearest: Today';
        if (days === 1) return 'Nearest: Tomorrow (1d left)';
        if (!dateStr) return `Nearest: in ${days} days`;
        try {
            const d = new Date(dateStr);
            const formatted = d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
            return `Nearest: ${formatted} (${days}d left)`;
        } catch (e) {
            return `Nearest: in ${days} days`;
        }
    };

    const getExpiryTheme = (urgency, count) => {
        if (count === 0) {
            return {
                bg: '#F8FDF9',
                border: '#D1FADF',
                color: '#027A48',
                iconBg: '#ECFDF3',
                badgeBg: '#D1FADF',
                badgeColor: '#027A48',
                textColor: '#027A48'
            };
        }
        if (urgency === 'critical') {
            return {
                bg: '#FEF3F2',
                border: '#FECDCA',
                color: '#B42318',
                iconBg: '#FEE4E2',
                badgeBg: '#FECDCA',
                badgeColor: '#912018',
                textColor: '#912018'
            };
        }
        if (urgency === 'warning') {
            return {
                bg: '#FFF6ED',
                border: '#FEE4E2',
                color: '#C4320A',
                iconBg: '#FFECE5',
                badgeBg: '#FEDAD0',
                badgeColor: '#B93815',
                textColor: '#B93815'
            };
        }
        return {
            bg: '#FFFAEB',
            border: '#FEDF89',
            color: '#B54708',
            iconBg: '#FEF0C7',
            badgeBg: '#FEDF89',
            badgeColor: '#93370D',
            textColor: '#93370D'
        };
    };

    const expiryTheme = getExpiryTheme(expiryUrgency, expiringCount);

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
        try {
            // Offline-first load: Instant render from local IndexedDB
            const localShops = await offlineDB.getShops();
            const activeShop = localShops.find(s => s._id === shopId);
            if (activeShop) setShop(activeShop);

            const localStats = await offlineDB.getQueryCache(`/api/sales/stats?shop=${shopId}`);
            if (localStats && localStats.data) {
                setStats(localStats.data);
            }

            if (activeShop) {
                setLoading(false);
            }

            const [statRes, shopRes] = await Promise.all([
                saleService.getShopStats(shopId),
                shopService.getAll()
            ]);
            setStats(statRes.data.data || null);
            setShop(shopRes.data.data.find(s => s._id === shopId) || null);
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

                            {/* Expiring Soon Alert Card */}
                            <div 
                                className="alert-card expiry-card-interactive" 
                                onClick={() => handleOpenExpiryModal('expiring')}
                                style={{ 
                                    background: expiryTheme.bg,
                                    border: `1px solid ${expiryTheme.border}`
                                }}
                            >
                                <div className="alert-icon" style={{ background: expiryTheme.iconBg, color: expiryTheme.color }}>
                                    {expiringCount > 0 ? <AlertTriangle size={16} /> : <CheckCircle2 size={16} />}
                                </div>
                                <div className="alert-text">
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        <strong style={{ color: expiryTheme.textColor }}>
                                            {expiringCount > 0 
                                                ? `${expiringCount} ${expiringCount === 1 ? 'batch' : 'batches'} expiring`
                                                : '0 batches expiring'}
                                        </strong>
                                        {expiringCount > 0 && nearestDays !== null && (
                                            <span className="urgency-badge" style={{ background: expiryTheme.badgeBg, color: expiryTheme.badgeColor }}>
                                                {nearestDays === 0 ? 'Today' : `${nearestDays}d`}
                                            </span>
                                        )}
                                    </div>
                                    <span style={{ color: expiringCount > 0 ? '#475467' : '#027A48' }}>
                                        {expiringCount > 0 
                                            ? `${expiringCount} ${expiringCount === 1 ? 'batch' : 'batches'} expiring within 45 days`
                                            : 'No products expiring within 45 days'}
                                    </span>
                                </div>
                            </div>

                            {/* Expired Stock Alert Card (Separate red alert if any expired) */}
                            {expiredCount > 0 && (
                                <div 
                                    className="alert-card expired-card-interactive" 
                                    onClick={() => handleOpenExpiryModal('expired')}
                                    style={{ 
                                        background: '#FEF2F2',
                                        border: '1px solid #FCA5A5'
                                    }}
                                >
                                    <div className="alert-icon" style={{ background: '#FEE4E2', color: '#D92D20' }}>
                                        <XCircle size={16} />
                                    </div>
                                    <div className="alert-text">
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                            <strong style={{ color: '#991B1B' }}>
                                                {expiredCount} {expiredCount === 1 ? 'batch' : 'batches'} expired
                                            </strong>
                                            <span className="urgency-badge" style={{ background: '#FEE4E2', color: '#B42318' }}>
                                                Expired Stock
                                            </span>
                                        </div>
                                        <span style={{ color: '#B42318' }}>Requires immediate clearance</span>
                                    </div>
                                </div>
                            )}
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

                            {/* Expiring Soon Alert Card */}
                            <div 
                                className="alert-card expiry-card-interactive" 
                                onClick={() => handleOpenExpiryModal('expiring')}
                                style={{ 
                                    background: expiryTheme.bg,
                                    border: `1px solid ${expiryTheme.border}`
                                }}
                            >
                                <div className="alert-icon" style={{ background: expiryTheme.iconBg, color: expiryTheme.color }}>
                                    {expiringCount > 0 ? <AlertTriangle size={20} /> : <CheckCircle2 size={20} />}
                                </div>
                                <div className="alert-text">
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                        <strong style={{ color: expiryTheme.textColor }}>
                                            {expiringCount > 0 
                                                ? `${expiringCount} ${expiringCount === 1 ? 'batch' : 'batches'} expiring`
                                                : '0 batches expiring'}
                                        </strong>
                                        {expiringCount > 0 && nearestDays !== null && (
                                            <span className="urgency-badge" style={{ background: expiryTheme.badgeBg, color: expiryTheme.badgeColor }}>
                                                {nearestDays === 0 ? 'Today' : `${nearestDays}d left`}
                                            </span>
                                        )}
                                    </div>
                                    <span style={{ color: expiringCount > 0 ? '#475467' : '#027A48' }}>
                                        {expiringCount > 0 
                                            ? `${expiringCount} ${expiringCount === 1 ? 'batch' : 'batches'} expiring within 45 days • ${formatNearestExpiry(nearestDate, nearestDays)}`
                                            : 'No products expiring within 45 days'}
                                    </span>
                                </div>
                                <ArrowRight size={20} className="arrow-icon-desktop" />
                            </div>

                            {/* Expired Stock Alert Card (Separate red alert if any expired) */}
                            {expiredCount > 0 && (
                                <div 
                                    className="alert-card expired-card-interactive" 
                                    onClick={() => handleOpenExpiryModal('expired')}
                                    style={{ 
                                        background: '#FEF2F2',
                                        border: '1px solid #FCA5A5'
                                    }}
                                >
                                    <div className="alert-icon" style={{ background: '#FEE4E2', color: '#D92D20' }}>
                                        <XCircle size={20} />
                                    </div>
                                    <div className="alert-text">
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                            <strong style={{ color: '#991B1B' }}>
                                                {expiredCount} {expiredCount === 1 ? 'batch' : 'batches'} expired
                                            </strong>
                                            <span className="urgency-badge" style={{ background: '#FEE4E2', color: '#B42318' }}>
                                                Expired Stock
                                            </span>
                                        </div>
                                        <span style={{ color: '#B42318' }}>Requires immediate clearance</span>
                                    </div>
                                    <ArrowRight size={20} className="arrow-icon-desktop" />
                                </div>
                            )}
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
                            .map((sale, i) => {
                                const isReturn = sale.type === 'RETURN';
                                const isExchange = sale.type === 'EXCHANGE';
                                
                                let iconBoxBg = '#F0F9FF';
                                let iconColor = '#026AA2';
                                let IconComponent = ShoppingCart;
                                
                                if (isReturn) {
                                    iconBoxBg = '#FEF2F2';
                                    iconColor = '#EF4444';
                                    IconComponent = RotateCcw;
                                } else if (isExchange) {
                                    iconBoxBg = '#FFF7ED';
                                    iconColor = '#F97316';
                                    IconComponent = RefreshCw;
                                } else if (sale.paymentMethod === 'Khata') {
                                    iconBoxBg = '#FEF3F2';
                                    iconColor = '#B42318';
                                    IconComponent = Clock;
                                }
                                
                                let displayTitle = sale.customerName || 'Walk-in Customer';
                                if (isReturn) {
                                    displayTitle = `Return - ${displayTitle}`;
                                } else if (isExchange) {
                                    displayTitle = `Exchange - ${displayTitle}`;
                                }
                                
                                return (
                                    <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} className="activity-item-premium" onClick={() => navigate(`/shop/${shopId}/sales-log`)}>
                                        <div className="aip-icon-box" style={{ background: iconBoxBg }}>
                                            <IconComponent size={18} color={iconColor} />
                                        </div>
                                        <div className="aip-info">
                                            <div className="aip-title">{displayTitle}</div>
                                            <div className="aip-time">
                                                {sale.paymentMethod} • {sale?.date ? new Date(sale.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Just now'}
                                            </div>
                                        </div>
                                        <div className="aip-amount" style={{ color: isReturn ? '#EF4444' : isExchange ? '#F97316' : '#101828' }}>
                                            {isReturn ? '-' : ''}₹{Math.abs(sale?.totalAmount || sale?.salesAmount || 0).toLocaleString()}
                                        </div>
                                        {!isMobile && <ChevronRight size={18} className="aip-arrow" />}
                                    </motion.div>
                                );
                            })
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

            {/* Expiry Management Modal */}
            <ExpiryManagementModal 
                isOpen={expiryModalOpen}
                onClose={() => setExpiryModalOpen(false)}
                shopId={shopId}
                currentShopName={shop?.name}
                initialTab={expiryModalTab}
            />

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
                .alerts-grid.desktop { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 20px; }
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

                /* Expiry Alert Cards & Badges */
                .urgency-badge {
                    display: inline-flex;
                    align-items: center;
                    padding: 2px 8px;
                    border-radius: 999px;
                    font-size: 11px;
                    font-weight: 800;
                    text-transform: uppercase;
                    letter-spacing: 0.04em;
                }
                .alert-card.expiry-card-interactive, .alert-card.expired-card-interactive {
                    transition: all 0.25s ease;
                    cursor: pointer;
                }
                .alert-card.expiry-card-interactive:hover, .alert-card.expired-card-interactive:hover {
                    transform: translateY(-4px);
                    box-shadow: 0 12px 24px rgba(0,0,0,0.08);
                }

                /* Expiry Management Modal Styles */
                .emm-backdrop {
                    position: fixed;
                    inset: 0;
                    background: rgba(15, 23, 42, 0.65);
                    backdrop-filter: blur(8px);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    z-index: 9999;
                    padding: 20px;
                    animation: emmFadeIn 0.2s ease-out;
                }
                @keyframes emmFadeIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }

                .emm-container {
                    background: #ffffff;
                    border-radius: 24px;
                    width: 100%;
                    max-width: 920px;
                    max-height: 88vh;
                    display: flex;
                    flex-direction: column;
                    box-shadow: 0 25px 50px -12px rgba(15, 23, 42, 0.25);
                    border: 1px solid #E2E8F0;
                    overflow: hidden;
                    animation: emmSlideUp 0.25s cubic-bezier(0.16, 1, 0.3, 1);
                }
                @keyframes emmSlideUp {
                    from { transform: translateY(20px) scale(0.97); opacity: 0; }
                    to { transform: translateY(0) scale(1); opacity: 1; }
                }

                .emm-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 22px 28px;
                    border-bottom: 1px solid #F1F5F9;
                    background: #FAFAFC;
                }
                .emm-header-title {
                    display: flex;
                    align-items: center;
                    gap: 14px;
                }
                .emm-icon-wrap {
                    width: 44px;
                    height: 44px;
                    border-radius: 12px;
                    background: #EFF6FF;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }
                .emm-header h3 {
                    margin: 0;
                    font-size: 20px;
                    font-weight: 800;
                    color: #0F172A;
                    letter-spacing: -0.02em;
                }
                .emm-header p {
                    margin: 3px 0 0 0;
                    font-size: 13px;
                    color: #64748B;
                    font-weight: 600;
                }
                .emm-close-btn {
                    width: 36px;
                    height: 36px;
                    border-radius: 10px;
                    border: 1px solid #E2E8F0;
                    background: white;
                    color: #64748B;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    cursor: pointer;
                    transition: all 0.15s;
                }
                .emm-close-btn:hover {
                    background: #F1F5F9;
                    color: #0F172A;
                }

                .emm-primary-tabs {
                    display: flex;
                    gap: 8px;
                    padding: 14px 28px;
                    background: #F8FAFC;
                    border-bottom: 1px solid #F1F5F9;
                }
                .emm-tab-btn {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    padding: 10px 18px;
                    border-radius: 12px;
                    font-size: 14px;
                    font-weight: 700;
                    border: 1px solid transparent;
                    background: transparent;
                    color: #64748B;
                    cursor: pointer;
                    transition: all 0.2s;
                }
                .emm-tab-btn:hover {
                    background: #EDF2F7;
                    color: #0F172A;
                }
                .emm-tab-btn.active {
                    background: #1E6BFF;
                    color: white;
                    box-shadow: 0 4px 12px rgba(30, 107, 255, 0.25);
                }
                .emm-tab-btn.tab-danger.active {
                    background: #D92D20;
                    color: white;
                    box-shadow: 0 4px 12px rgba(217, 45, 32, 0.25);
                }
                .emm-tab-count {
                    padding: 2px 7px;
                    border-radius: 99px;
                    font-size: 11px;
                    font-weight: 800;
                    background: rgba(0,0,0,0.08);
                }
                .emm-tab-btn.active .emm-tab-count {
                    background: rgba(255,255,255,0.25);
                    color: white;
                }
                .emm-tab-count.count-danger {
                    background: #FEE4E2;
                    color: #D92D20;
                }

                .emm-toolbar {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    gap: 16px;
                    padding: 16px 28px;
                    border-bottom: 1px solid #F1F5F9;
                    background: white;
                    flex-wrap: wrap;
                }
                .emm-subfilters {
                    display: flex;
                    gap: 6px;
                    flex-wrap: wrap;
                }
                .emm-subfilters button {
                    padding: 6px 12px;
                    border-radius: 8px;
                    font-size: 12px;
                    font-weight: 700;
                    border: 1px solid #E2E8F0;
                    background: #F8FAFC;
                    color: #64748B;
                    cursor: pointer;
                    transition: all 0.15s;
                }
                .emm-subfilters button.active {
                    background: #0F172A;
                    color: white;
                    border-color: #0F172A;
                }
                .emm-subfilters button.btn-sub-crit.active {
                    background: #B42318;
                    color: white;
                    border-color: #B42318;
                }
                .emm-subfilters button.btn-sub-warn.active {
                    background: #C4320A;
                    color: white;
                    border-color: #C4320A;
                }
                .emm-subfilters button.btn-sub-att.active {
                    background: #B54708;
                    color: white;
                    border-color: #B54708;
                }

                .emm-search-box {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    background: #F8FAFC;
                    border: 1px solid #E2E8F0;
                    border-radius: 10px;
                    padding: 6px 12px;
                    width: 260px;
                }
                .emm-search-box input {
                    border: none;
                    background: transparent;
                    outline: none;
                    font-size: 13px;
                    color: #0F172A;
                    width: 100%;
                }
                .emm-search-clear {
                    background: none;
                    border: none;
                    color: #94A3B8;
                    cursor: pointer;
                    padding: 2px;
                }

                .emm-content {
                    flex: 1;
                    overflow-y: auto;
                    padding: 0;
                }
                .emm-table-container {
                    overflow-x: auto;
                }
                .emm-table {
                    width: 100%;
                    border-collapse: collapse;
                    text-align: left;
                }
                .emm-table th {
                    padding: 12px 24px;
                    background: #F8FAFC;
                    font-size: 11px;
                    font-weight: 800;
                    text-transform: uppercase;
                    letter-spacing: 0.05em;
                    color: #64748B;
                    border-bottom: 1px solid #E2E8F0;
                }
                .emm-table td {
                    padding: 16px 24px;
                    border-bottom: 1px solid #F1F5F9;
                    font-size: 14px;
                    color: #0F172A;
                    vertical-align: middle;
                }
                .emm-row:hover {
                    background: #FBFDFF;
                }
                .emm-prod-info {
                    display: flex;
                    flex-direction: column;
                    gap: 4px;
                }
                .emm-prod-name {
                    font-size: 15px;
                    font-weight: 700;
                    color: #0F172A;
                }
                .emm-prod-tags {
                    display: flex;
                    align-items: center;
                    gap: 6px;
                    flex-wrap: wrap;
                }
                .emm-tag {
                    font-size: 11px;
                    font-weight: 700;
                    padding: 2px 8px;
                    border-radius: 6px;
                    background: #F1F5F9;
                    color: #475467;
                }
                .emm-tag.sku {
                    background: #EFF6FF;
                    color: #1E6BFF;
                }
                .emm-tag.shop {
                    background: #F5F3FF;
                    color: #7C3AED;
                }
                .emm-batch-pill {
                    display: inline-block;
                    padding: 3px 8px;
                    border-radius: 6px;
                    background: #F1F5F9;
                    font-family: monospace;
                    font-weight: 700;
                    font-size: 12px;
                    color: #334155;
                    border: 1px solid #E2E8F0;
                }
                .emm-batch-none {
                    color: #94A3B8;
                    font-size: 12px;
                    font-style: italic;
                }
                .emm-stock-qty {
                    font-size: 14px;
                    color: #334155;
                }
                .emm-stock-qty strong {
                    font-size: 16px;
                    color: #0F172A;
                }
                .emm-date {
                    font-weight: 600;
                    color: #334155;
                }

                .emm-badge {
                    display: inline-flex;
                    align-items: center;
                    padding: 4px 10px;
                    border-radius: 8px;
                    font-size: 12px;
                    font-weight: 800;
                    white-space: nowrap;
                }
                .badge-critical {
                    background: #FEF3F2;
                    color: #B42318;
                    border: 1px solid #FECDCA;
                }
                .badge-critical.pulse {
                    animation: emmPulse 1.5s infinite;
                }
                @keyframes emmPulse {
                    0%, 100% { opacity: 1; }
                    50% { opacity: 0.6; }
                }
                .badge-warning {
                    background: #FFF6ED;
                    color: #C4320A;
                    border: 1px solid #FEE4E2;
                }
                .badge-attention {
                    background: #FFFAEB;
                    color: #B54708;
                    border: 1px solid #FEDF89;
                }
                .badge-expired {
                    background: #FEF2F2;
                    color: #DC2626;
                    border: 1px solid #FCA5A5;
                }

                .emm-action-btn {
                    display: inline-flex;
                    align-items: center;
                    gap: 6px;
                    padding: 6px 12px;
                    border-radius: 8px;
                    background: #EFF6FF;
                    color: #1E6BFF;
                    border: 1px solid #BFDBFE;
                    font-size: 12px;
                    font-weight: 700;
                    cursor: pointer;
                    transition: all 0.15s;
                }
                .emm-action-btn:hover {
                    background: #1E6BFF;
                    color: white;
                }

                .emm-loading, .emm-empty {
                    padding: 60px 24px;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    gap: 12px;
                    text-align: center;
                }
                .emm-loading p {
                    color: #64748B;
                    font-size: 14px;
                    font-weight: 600;
                }
                .emm-empty h4 {
                    margin: 8px 0 0 0;
                    font-size: 18px;
                    font-weight: 800;
                    color: #0F172A;
                }
                .emm-empty p {
                    margin: 4px 0 0 0;
                    font-size: 14px;
                    color: #64748B;
                }
                .emm-spinner {
                    width: 36px;
                    height: 36px;
                    border: 3px solid #E2E8F0;
                    border-top-color: #1E6BFF;
                    border-radius: 50%;
                    animation: emmSpin 0.8s linear infinite;
                }
                @keyframes emmSpin {
                    to { transform: rotate(360deg); }
                }

                .emm-footer {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 16px 28px;
                    border-top: 1px solid #F1F5F9;
                    background: #FAFAFC;
                }
                .emm-footer-note {
                    font-size: 12px;
                    font-weight: 600;
                    color: #64748B;
                }
                .emm-btn-secondary {
                    padding: 8px 20px;
                    border-radius: 10px;
                    border: 1px solid #E2E8F0;
                    background: white;
                    color: #334155;
                    font-size: 13px;
                    font-weight: 700;
                    cursor: pointer;
                    transition: all 0.15s;
                }
                .emm-btn-secondary:hover {
                    background: #F1F5F9;
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

const ExpiryManagementModal = ({ isOpen, onClose, shopId, currentShopName, initialTab = 'expiring' }) => {
    const navigate = useNavigate();
    const [tab, setTab] = useState(initialTab); // 'expiring' | 'expired'
    const [subFilter, setSubFilter] = useState('all'); // 'all', 'critical', 'warning', 'attention'
    const [search, setSearch] = useState('');
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState({ expiringSoon: [], expired: [], summary: {} });

    useEffect(() => {
        if (isOpen) {
            setTab(initialTab);
            setSubFilter('all');
            setSearch('');
            loadExpiryData();
        }
    }, [isOpen, shopId, initialTab]);

    const loadExpiryData = async () => {
        setLoading(true);
        try {
            const res = await productService.getExpiryAlerts(shopId, 45);
            setData(res.data?.data || { expiringSoon: [], expired: [], summary: {} });
        } catch (err) {
            console.error('Failed to load expiry alerts in modal:', err);
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    const expiringList = data.expiringSoon || [];
    const expiredList = data.expired || [];

    const activeList = tab === 'expiring' ? expiringList : expiredList;

    const filteredItems = activeList.filter(item => {
        if (tab === 'expiring') {
            if (subFilter === 'critical' && item.urgency !== 'critical') return false;
            if (subFilter === 'warning' && item.urgency !== 'warning') return false;
            if (subFilter === 'attention' && item.urgency !== 'attention') return false;
        }
        if (search.trim()) {
            const q = search.toLowerCase();
            const matchesName = (item.productName || '').toLowerCase().includes(q);
            const matchesBatch = (item.batchNumber || '').toLowerCase().includes(q);
            const matchesSku = (item.sku || '').toLowerCase().includes(q);
            const matchesCategory = (item.category || '').toLowerCase().includes(q);
            return matchesName || matchesBatch || matchesSku || matchesCategory;
        }
        return true;
    });

    const getDaysBadge = (days, urgency) => {
        if (urgency === 'expired' || days < 0) {
            const abs = Math.abs(days);
            return (
                <span className="emm-badge badge-expired">
                    Expired {abs === 0 ? 'today' : `${abs}d ago`}
                </span>
            );
        }
        if (days === 0) {
            return <span className="emm-badge badge-critical pulse">Expires Today</span>;
        }
        if (days <= 7) {
            return <span className="emm-badge badge-critical">{days}d left</span>;
        }
        if (days <= 15) {
            return <span className="emm-badge badge-warning">{days}d left</span>;
        }
        return <span className="emm-badge badge-attention">{days}d left</span>;
    };

    return (
        <div className="emm-backdrop" onClick={onClose}>
            <div className="emm-container" onClick={e => e.stopPropagation()}>
                {/* Header */}
                <div className="emm-header">
                    <div className="emm-header-title">
                        <div className="emm-icon-wrap">
                            <Clock size={22} color="#1E6BFF" />
                        </div>
                        <div>
                            <h3>Inventory Expiry Management</h3>
                            <p>
                                {currentShopName ? `Shop: ${currentShopName} • ` : ''}
                                {data.summary?.expiringSoonCount || 0} expiring soon • {data.summary?.expiredCount || 0} expired
                            </p>
                        </div>
                    </div>
                    <button className="emm-close-btn" onClick={onClose} aria-label="Close modal">
                        <X size={20} />
                    </button>
                </div>

                {/* Primary Tabs */}
                <div className="emm-primary-tabs">
                    <button 
                        className={`emm-tab-btn ${tab === 'expiring' ? 'active' : ''}`}
                        onClick={() => { setTab('expiring'); setSubFilter('all'); }}
                    >
                        <AlertTriangle size={16} />
                        <span>Expiring Soon (45d)</span>
                        <span className="emm-tab-count">{expiringList.length}</span>
                    </button>
                    <button 
                        className={`emm-tab-btn ${tab === 'expired' ? 'active tab-danger' : ''} ${expiredList.length > 0 && tab !== 'expired' ? 'tab-has-expired' : ''}`}
                        onClick={() => { setTab('expired'); setSubFilter('all'); }}
                    >
                        <XCircle size={16} />
                        <span>Expired Stock</span>
                        <span className="emm-tab-count count-danger">{expiredList.length}</span>
                    </button>
                </div>

                {/* Subfilter & Search Toolbar */}
                <div className="emm-toolbar">
                    {tab === 'expiring' ? (
                        <div className="emm-subfilters">
                            <button className={subFilter === 'all' ? 'active' : ''} onClick={() => setSubFilter('all')}>
                                All ({expiringList.length})
                            </button>
                            <button className={`btn-sub-crit ${subFilter === 'critical' ? 'active' : ''}`} onClick={() => setSubFilter('critical')}>
                                Critical (0–7d) ({expiringList.filter(i => i.urgency === 'critical').length})
                            </button>
                            <button className={`btn-sub-warn ${subFilter === 'warning' ? 'active' : ''}`} onClick={() => setSubFilter('warning')}>
                                Warning (8–15d) ({expiringList.filter(i => i.urgency === 'warning').length})
                            </button>
                            <button className={`btn-sub-att ${subFilter === 'attention' ? 'active' : ''}`} onClick={() => setSubFilter('attention')}>
                                Attention (16–45d) ({expiringList.filter(i => i.urgency === 'attention').length})
                            </button>
                        </div>
                    ) : (
                        <div style={{ fontSize: '13px', fontWeight: '700', color: '#DC2626' }}>
                            Items past expiry date ({expiredList.length})
                        </div>
                    )}
                    <div className="emm-search-box">
                        <Search size={16} color="#94A3B8" />
                        <input 
                            type="text" 
                            placeholder="Search by product, batch or SKU..." 
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                        />
                        {search && (
                            <button className="emm-search-clear" onClick={() => setSearch('')}>
                                <X size={14} />
                            </button>
                        )}
                    </div>
                </div>

                {/* Body Content */}
                <div className="emm-content">
                    {loading ? (
                        <div className="emm-loading">
                            <div className="emm-spinner"></div>
                            <p>Loading inventory expiry records...</p>
                        </div>
                    ) : filteredItems.length === 0 ? (
                        <div className="emm-empty">
                            <CheckCircle2 size={44} color="#10B981" />
                            <h4>{tab === 'expiring' ? 'No products expiring in this range' : 'No expired stock found'}</h4>
                            <p>
                                {tab === 'expiring' 
                                    ? 'All inventory items are fresh beyond 45 calendar days.' 
                                    : 'All products in stock are within their valid freshness window.'}
                            </p>
                        </div>
                    ) : (
                        <div className="emm-table-container">
                            <table className="emm-table">
                                <thead>
                                    <tr>
                                        <th>Product</th>
                                        <th>Batch</th>
                                        <th>Available Stock</th>
                                        <th>Expiry Date</th>
                                        <th>Days Left</th>
                                        <th>Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredItems.map((item, idx) => {
                                        const formattedExp = item.expiryDate 
                                            ? new Date(item.expiryDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
                                            : '—';
                                        return (
                                            <tr key={`${item.productId}-${item.batchNumber || idx}`} className="emm-row">
                                                <td>
                                                    <div className="emm-prod-info">
                                                        <span className="emm-prod-name">{item.productName}</span>
                                                        <div className="emm-prod-tags">
                                                            {item.category && <span className="emm-tag">{item.category}</span>}
                                                            {item.sku && <span className="emm-tag sku">SKU: {item.sku}</span>}
                                                            {item.shopName && <span className="emm-tag shop">🏪 {item.shopName}</span>}
                                                        </div>
                                                    </div>
                                                </td>
                                                <td>
                                                    {item.batchNumber ? (
                                                        <span className="emm-batch-pill">{item.batchNumber}</span>
                                                    ) : (
                                                        <span className="emm-batch-none">Standard Stock</span>
                                                    )}
                                                </td>
                                                <td>
                                                    <span className="emm-stock-qty">
                                                        <strong>{item.quantity}</strong> {item.unit || 'Piece'}
                                                    </span>
                                                </td>
                                                <td>
                                                    <span className="emm-date">{formattedExp}</span>
                                                </td>
                                                <td>
                                                    {getDaysBadge(item.daysRemaining, item.urgency)}
                                                </td>
                                                <td>
                                                    <button 
                                                        className="emm-action-btn"
                                                        onClick={() => {
                                                            onClose();
                                                            navigate(`/shop/${shopId}/inventory?filter=${tab === 'expired' ? 'expired' : 'expiring-soon'}&search=${encodeURIComponent(item.productName)}`);
                                                        }}
                                                        title="Inspect in Inventory"
                                                    >
                                                        <span>Inspect</span>
                                                        <ExternalLink size={14} />
                                                    </button>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="emm-footer">
                    <span className="emm-footer-note">
                        Showing {filteredItems.length} of {activeList.length} {tab === 'expiring' ? 'expiring' : 'expired'} records
                    </span>
                    <button className="emm-btn-secondary" onClick={onClose}>
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
};

export default Dashboard;
