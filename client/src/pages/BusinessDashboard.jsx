import React, { useState, useEffect } from 'react';
import { 
    TrendingUp, 
    Zap, 
    Users, 
    ArrowUpRight, 
    Package, 
    Store, 
    Plus, 
    ArrowRight,
    MapPin,
    BarChart3,
    Settings,
    ChevronRight,
    Search,
    Clock
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { shopService, saleService } from '../services/api';
import { offlineDB } from '../services/offlineDB';
import { motion, AnimatePresence } from 'framer-motion';
import { Skeleton, EmptyState } from '../components/PremiumUI';

const BusinessDashboard = () => {
    const navigate = useNavigate();
    const { user } = useAuth();
    const [shops, setShops] = useState([]);
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            // Offline-first load: Instant render from local IndexedDB
            const localShops = await offlineDB.getShops();
            const localStats = await offlineDB.getQueryCache('/api/sales/stats');
            if (localShops && localShops.length > 0) {
                setShops(localShops);
            }
            if (localStats && localStats.data) {
                setStats(localStats.data);
            }
            if (localShops && localShops.length > 0) {
                setLoading(false);
            }

            const [shopRes, statRes] = await Promise.all([
                shopService.getAll(),
                saleService.getShopStats() // No shopId = Global Stats
            ]);
            setShops(shopRes.data.data || []);
            setStats(statRes.data.data || null);
        } catch (err) {
            console.error('Error fetching business data:', err);
        } finally {
            setLoading(false);
        }
    };

    const filteredShops = shops.filter(s => 
        s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.location.toLowerCase().includes(searchQuery.toLowerCase())
    );

    if (loading) {
        return (
            <div className="business-dashboard">
                <div style={{ padding: '20px' }}>
                    <Skeleton width="180px" height="24px" className="mb-2" />
                    <Skeleton width="240px" height="16px" className="mb-8" />
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px', marginBottom: '24px' }}>
                        {[1, 2, 3, 4].map(i => <Skeleton key={i} height="100px" borderRadius="20px" />)}
                    </div>
                    <Skeleton width="120px" height="20px" className="mb-4" />
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        {[1, 2].map(i => <Skeleton key={i} height="140px" borderRadius="24px" />)}
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="business-dashboard">
            {/* Header */}
            <header className="business-hero">
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                    <h1>Welcome, {user?.name?.split(' ')[0]} 👋</h1>
                    <p>Aggregated insights across all your businesses</p>
                </motion.div>
            </header>

            {/* Global Aggregated Metrics */}
            <section className="metrics-grid">
                <GlobalKPICard 
                    label="All Sales Today" 
                    value={`₹${stats?.totalSales?.toLocaleString() || 0}`}
                    icon={TrendingUp}
                    color="#1E6BFF"
                />
                <GlobalKPICard 
                    label="Total Profit" 
                    value={`₹${stats?.totalProfit?.toLocaleString() || 0}`}
                    icon={Zap}
                    color="#7c3aed"
                />
                <GlobalKPICard 
                    label="Customer Dues" 
                    value={`₹${stats?.pendingMetrics?.customerCredits?.toLocaleString() || 0}`}
                    icon={Users}
                    color="#FF7A00"
                />
                <GlobalKPICard 
                    label="Supplier Dues" 
                    value={`₹${stats?.pendingMetrics?.supplierDues?.toLocaleString() || 0}`}
                    icon={ArrowUpRight}
                    color="#00B26B"
                />
                <GlobalKPICard 
                    label="Low Stock Alert" 
                    value={stats?.lowStockCount || 0}
                    icon={Package}
                    color="#FF4D4F"
                    suffix="Items"
                />
            </section>

            {/* Quick Global Actions */}
            <section className="global-actions">
                <div className="action-strip">
                    <button onClick={() => navigate('/shops')} className="strip-btn">
                        <Plus size={18} /> Add Shop
                    </button>
                    <button onClick={() => navigate('/reports')} className="strip-btn">
                        <BarChart3 size={18} /> Global Reports
                    </button>
                    <button onClick={() => navigate('/profile')} className="strip-btn">
                        <Settings size={18} /> Settings
                    </button>
                </div>
            </section>

            {/* Shop List Section */}
            <section className="shop-list-section">
                <div className="section-header-flex">
                    <h2 className="section-title">My Businesses</h2>
                    <div className="search-pill-mini">
                        <Search size={14} />
                        <input 
                            placeholder="Search shops..." 
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                </div>

                <div className="shops-vertical-list">
                    {filteredShops.length > 0 ? (
                        filteredShops.map((shop, i) => (
                            <motion.div 
                                key={shop._id} 
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: i * 0.05 }}
                                className="shop-summary-card"
                                onClick={() => navigate(`/shop/${shop._id}/dashboard`)}
                            >
                                <div className="ssc-top">
                                    <div className="ssc-info">
                                        <div className="ssc-icon">{shop.name.charAt(0)}</div>
                                        <div className="ssc-text">
                                            <h3>{shop.name}</h3>
                                            <span className="ssc-loc"><MapPin size={12} /> {shop.location}</span>
                                        </div>
                                    </div>
                                    <div className="ssc-badge">
                                        <div className="badge-dot"></div>
                                        Active
                                    </div>
                                </div>
                                <div className="ssc-metrics">
                                    <div className="sscm-item">
                                        <label>Today Sales</label>
                                        <strong>₹{shop.stats?.todaySales?.toLocaleString() || 0}</strong>
                                    </div>
                                    <div className="sscm-item">
                                        <label>Low Stock</label>
                                        <strong style={{ color: shop.stats?.lowStockCount > 0 ? '#FF4D4F' : '#00B26B' }}>
                                            {shop.stats?.lowStockCount || 0}
                                        </strong>
                                    </div>
                                    <div className="sscm-item">
                                        <label>Inventory</label>
                                        <strong>{shop.stats?.productCount || 0} SKU</strong>
                                    </div>
                                </div>
                                <div className="ssc-footer">
                                    <span className="last-sync"><Clock size={12} /> Just now</span>
                                    <button className="ssc-enter-btn">
                                        Enter Shop <ChevronRight size={16} />
                                    </button>
                                </div>
                            </motion.div>
                        ))
                    ) : (
                        <EmptyState 
                            icon={Store}
                            title="No Shops Found"
                            description="Start your business journey by adding your first shop."
                            actionLabel="Add New Shop"
                            onAction={() => navigate('/shops')}
                        />
                    )}
                </div>
            </section>

            <style jsx="true">{`
                .business-dashboard { display: flex; flex-direction: column; gap: 24px; padding-bottom: 40px; }
                
                .business-hero { padding: 8px 0; }
                .business-hero h1 { font-size: 24px; font-weight: 800; color: #101828; margin: 0; }
                .business-hero p { font-size: 14px; color: #667085; font-weight: 500; margin-top: 4px; }
                
                .metrics-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; }
                @media (min-width: 1024px) { .metrics-grid { grid-template-columns: repeat(5, 1fr); } }

                .gkpi-card { background: white; padding: 16px; border-radius: 20px; border: 1px solid #F2F4F7; display: flex; flex-direction: column; gap: 12px; }
                .gkpi-icon-box { width: 40px; height: 40px; border-radius: 12px; display: flex; align-items: center; justify-content: center; }
                .gkpi-content { display: flex; flex-direction: column; }
                .gkpi-label { font-size: 11px; font-weight: 700; color: #667085; text-transform: uppercase; letter-spacing: 0.05em; }
                .gkpi-value { font-size: 20px; font-weight: 800; color: #101828; margin-top: 2px; }
                .gkpi-value span { font-size: 12px; font-weight: 600; color: #98A2B3; margin-left: 4px; }

                .global-actions { padding: 4px 0; }
                .action-strip { display: flex; gap: 10px; overflow-x: auto; scrollbar-width: none; }
                .action-strip::-webkit-scrollbar { display: none; }
                .strip-btn { flex: 0 0 auto; display: flex; align-items: center; gap: 8px; padding: 10px 16px; background: white; border: 1px solid #E2E8F0; border-radius: 12px; font-size: 13px; font-weight: 700; color: #475467; cursor: pointer; transition: 0.2s; }
                .strip-btn:hover { background: #F8FAFC; border-color: #1E6BFF; color: #1E6BFF; }

                .section-header-flex { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
                .section-title { font-size: 18px; font-weight: 800; color: #101828; margin: 0; }
                .search-pill-mini { display: flex; align-items: center; gap: 8px; background: white; padding: 6px 12px; border-radius: 10px; border: 1px solid #F2F4F7; }
                .search-pill-mini input { border: none; outline: none; font-size: 12px; font-weight: 600; width: 100px; }

                .shops-vertical-list { display: flex; flex-direction: column; gap: 12px; }
                .shop-summary-card { background: white; border-radius: 24px; border: 1px solid #F2F4F7; padding: 16px; display: flex; flex-direction: column; gap: 16px; cursor: pointer; transition: 0.2s; }
                .shop-summary-card:hover { transform: translateY(-2px); box-shadow: 0 10px 30px rgba(0,0,0,0.05); border-color: #1E6BFF20; }
                
                .ssc-top { display: flex; justify-content: space-between; align-items: flex-start; }
                .ssc-info { display: flex; align-items: center; gap: 12px; }
                .ssc-icon { width: 44px; height: 44px; background: #F2F4F7; border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 18px; font-weight: 800; color: #475467; }
                .ssc-text h3 { font-size: 16px; font-weight: 800; color: #101828; margin: 0; }
                .ssc-loc { font-size: 12px; color: #667085; display: flex; align-items: center; gap: 4px; margin-top: 2px; }
                
                .ssc-badge { display: flex; align-items: center; gap: 6px; font-size: 10px; font-weight: 800; color: #00B26B; background: #F0FDF4; padding: 4px 10px; border-radius: 99px; }
                .badge-dot { width: 6px; height: 6px; background: #00B26B; border-radius: 50%; }

                .ssc-metrics { display: grid; grid-template-columns: repeat(3, 1fr); background: #F9FAFB; border-radius: 16px; padding: 12px; gap: 12px; }
                .sscm-item { display: flex; flex-direction: column; gap: 2px; }
                .sscm-item label { font-size: 10px; font-weight: 700; color: #98A2B3; text-transform: uppercase; }
                .sscm-item strong { font-size: 14px; font-weight: 800; color: #101828; }

                .ssc-footer { display: flex; justify-content: space-between; align-items: center; padding-top: 4px; }
                .last-sync { font-size: 11px; color: #98A2B3; display: flex; align-items: center; gap: 4px; }
                .ssc-enter-btn { display: flex; align-items: center; gap: 4px; font-size: 13px; font-weight: 800; color: #1E6BFF; background: transparent; border: none; cursor: pointer; }
            `}</style>
        </div>
    );
};

const GlobalKPICard = ({ label, value, icon: Icon, color, suffix }) => (
    <motion.div whileTap={{ scale: 0.98 }} className="gkpi-card">
        <div className="gkpi-icon-box" style={{ background: `${color}15`, color: color }}>
            <Icon size={20} />
        </div>
        <div className="gkpi-content">
            <span className="gkpi-label">{label}</span>
            <div className="gkpi-value">
                {value}
                {suffix && <span>{suffix}</span>}
            </div>
        </div>
    </motion.div>
);

export default BusinessDashboard;
