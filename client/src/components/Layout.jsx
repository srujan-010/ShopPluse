import React, { useState, useEffect } from 'react';
import { useSync } from '../context/SyncContext';
import { 
    Home, 
    Package, 
    ShoppingCart, 
    ShoppingBag, 
    UserCircle,
    Bell,
    Plus,
    Store,
    ChevronDown,
    ChevronLeft,
    Menu,
    Search,
    History,
    Settings,
    X,
    Edit3,
    ArrowRight,
    Users,
    LayoutGrid
} from 'lucide-react';
import { Link, useLocation, useNavigate, useParams, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { shopService } from '../services/api';
import { motion, AnimatePresence } from 'framer-motion';
import Sidebar from './Sidebar';

const Layout = () => {
    const { logout, user } = useAuth();
    const { isOnline, pendingCount, isSyncing, triggerSync } = useSync();
    const location = useLocation();
    const navigate = useNavigate();
    const { shopId } = useParams();
    const [shops, setShops] = useState([]);
    const [showShopDropdown, setShowShopDropdown] = useState(false);
    const [isScrolled, setIsScrolled] = useState(false);
    const [showQuickActions, setShowQuickActions] = useState(false);
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);

    useEffect(() => {
        fetchShops();
        const handleScroll = () => setIsScrolled(window.scrollY > 20);
        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    const fetchShops = async () => {
        try {
            const res = await shopService.getAll();
            setShops(res.data.data);
        } catch (err) {
            console.error('Error fetching shops:', err);
        }
    };

    const currentShop = shops.find(s => s._id === shopId);

    const navItems = [
        { name: 'Home', icon: Home, path: shopId ? `/shop/${shopId}/dashboard` : '/dashboard' },
        { name: 'Stock', icon: Package, path: shopId ? `/shop/${shopId}/inventory` : '/inventory' },
        { name: 'Sell', icon: ShoppingCart, path: shopId ? `/shop/${shopId}/pos` : '/pos' },
        { name: 'Logs', icon: ShoppingBag, path: shopId ? `/shop/${shopId}/sales-log` : '/sales-log' },
    ];

    const quickActions = [
        { 
            title: 'Add Stock', 
            sub: 'Add new inventory items', 
            icon: Package, 
            color: '#1E6BFF', 
            path: shopId ? `/shop/${shopId}/inventory?add=true` : '/inventory?add=true' 
        },
        { 
            title: 'New Sale', 
            sub: 'Create bill / sell products', 
            icon: ShoppingCart, 
            color: '#00B26B', 
            path: shopId ? `/shop/${shopId}/pos` : '/pos' 
        },
        { 
            title: 'Edit Product', 
            sub: 'Update price / stock / details', 
            icon: Edit3, 
            color: '#FF7A00', 
            path: shopId ? `/shop/${shopId}/inventory` : '/inventory' 
        },
        { 
            title: 'Sales Log', 
            sub: 'View all transactions', 
            icon: History, 
            color: '#7c3aed', 
            path: shopId ? `/shop/${shopId}/sales-log` : '/sales-log' 
        }
    ];

    const handleActionClick = (path) => {
        setShowQuickActions(false);
        navigate(path);
    };

    const handleShopSwitch = (id) => {
        setShowShopDropdown(false);
        const currentPath = location.pathname;
        const newPath = currentPath.replace(shopId, id);
        navigate(newPath);
    };

    return (
        <div className="premium-layout">
            <Sidebar isOpen={isSidebarOpen} toggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)} currentShop={currentShop} />
            
            {/* Elegant Top Header */}
            <header className={`premium-header ${isScrolled ? 'scrolled' : ''}`}>
                <div className="header-inner">
                    <div className="header-left">
                        {/* Logic: Show hamburger on root dashboards, show back button on specific shop pages/details */}
                        {location.pathname === '/dashboard' || location.pathname === '/shops' || location.pathname.endsWith('/dashboard') ? (
                            <button className="icon-btn menu-trigger" onClick={() => setIsSidebarOpen(true)}><Menu size={24} /></button>
                        ) : (
                            <button className="icon-btn-back" onClick={() => navigate(-1)}>
                                <ChevronLeft size={24} />
                            </button>
                        )}
                        
                        {!shopId && (
                            <div className="brand-minimal" onClick={() => navigate('/dashboard')}>
                                <img src="https://i.ibb.co/9mVRXF5q/Chat-GPT-Image-May-14-2026-01-56-04-PM.png" alt="ShopPulse" className="logo-img-mini" />
                            </div>
                        )}
                    </div>

                    <div className="header-center">
                        {shopId ? (
                            <div className="shop-pill-container">
                                <button className="shop-selector-pill" onClick={() => setShowShopDropdown(!showShopDropdown)}>
                                    <span className="shop-name-trunc">{currentShop?.name || 'Select Shop'}</span>
                                    <ChevronDown size={14} className={showShopDropdown ? 'rotated' : ''} />
                                </button>
                                <AnimatePresence>
                                    {showShopDropdown && (
                                        <motion.div 
                                            initial={{ opacity: 0, y: 10, scale: 0.95 }}
                                            animate={{ opacity: 1, y: 0, scale: 1 }}
                                            exit={{ opacity: 0, y: 10, scale: 0.95 }}
                                            className="shop-dropdown-overlay"
                                        >
                                            <div className="dropdown-title">Switch Shop</div>
                                            {shops.map(s => (
                                                <button key={s._id} className={`shop-item ${s._id === shopId ? 'active' : ''}`} onClick={() => handleShopSwitch(s._id)}>
                                                    <div className="shop-icon-mini">{s.name.charAt(0)}</div>
                                                    <span>{s.name}</span>
                                                </button>
                                            ))}
                                            <div className="dropdown-divider"></div>
                                            <button className="shop-item manage" onClick={() => { navigate('/dashboard'); setShowShopDropdown(false); }}>
                                                <LayoutGrid size={14} /> Back to All Shops
                                            </button>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>
                        ) : (
                            <div className="brand-name-top">My Businesses</div>
                        )}
                    </div>

                    <div className="header-right">
                        {/* Sync Status Pill */}
                        <div 
                            className="sync-status-pill" 
                            onClick={triggerSync}
                            style={{ 
                                display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', 
                                borderRadius: '99px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer',
                                background: isOnline ? (pendingCount > 0 ? '#FFFBEB' : '#F0FDF4') : '#FEF2F2',
                                color: isOnline ? (pendingCount > 0 ? '#B45309' : '#15803D') : '#B91C1C',
                                border: `1px solid ${isOnline ? (pendingCount > 0 ? '#FEF3C7' : '#DCFCE7') : '#FEE2E2'}`
                            }}
                        >
                            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: isOnline ? (pendingCount > 0 ? '#F59E0B' : '#22C55E') : '#EF4444' }}></div>
                            <span className="hide-mobile">{!isOnline ? 'Offline' : (isSyncing ? 'Syncing...' : (pendingCount > 0 ? `${pendingCount} Pending` : 'Synced'))}</span>
                        </div>
                        <button className="icon-btn-ghost"><Bell size={22} /></button>
                        <div className="profile-square" onClick={() => navigate('/profile')}>
                            {user?.name?.charAt(0) || 'A'}
                        </div>
                    </div>
                </div>
            </header>

            {/* Main Premium Canvas */}
            <main className="premium-canvas">
                <div className="canvas-content">
                    <Outlet />
                </div>
            </main>

            {/* Quick Action Overlay */}
            <AnimatePresence>
                {showQuickActions && (
                    <div className="quick-action-overlay">
                        <motion.div 
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="qa-backdrop" 
                            onClick={() => setShowQuickActions(false)}
                        />
                        <motion.div 
                            initial={{ y: "100%" }}
                            animate={{ y: 0 }}
                            exit={{ y: "100%" }}
                            className="qa-sheet"
                        >
                            <div className="qa-header">
                                <div className="qah-line"></div>
                                <div className="qah-text">
                                    <h3>Quick Actions</h3>
                                    <p>Choose what you want to do</p>
                                </div>
                            </div>
                            <div className="qa-list">
                                {quickActions.map((action, i) => (
                                    <motion.button 
                                        key={i}
                                        initial={{ opacity: 0, x: -20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ delay: i * 0.05 }}
                                        className="qa-item-row"
                                        onClick={() => handleActionClick(action.path)}
                                    >
                                        <div className="qai-icon-box" style={{ backgroundColor: `${action.color}15`, color: action.color }}>
                                            <action.icon size={22} strokeWidth={2.5} />
                                        </div>
                                        <div className="qai-content">
                                            <div className="qai-title">{action.title}</div>
                                            <div className="qai-sub">{action.sub}</div>
                                        </div>
                                        <ArrowRight size={18} color="#D0D5DD" />
                                    </motion.button>
                                ))}
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Premium Floating Bottom Nav */}
            {!isSidebarOpen && (
                <nav className="premium-bottom-nav">
                    <div className="nav-blur-bg"></div>
                    <div className="nav-items-wrapper">
                        {navItems.slice(0, 2).map((item) => (
                            <Link key={item.path} to={item.path} className={`nav-item-link ${location.pathname.includes(item.path.split('/')[3] || 'dashboard') ? 'active' : ''}`}>
                                <item.icon size={26} />
                                <span>{item.name}</span>
                            </Link>
                        ))}
                        <div className="fab-add-center-spacer"></div>
                        <button className="fab-add-center" onClick={() => setShowQuickActions(!showQuickActions)}>
                            <motion.div 
                                animate={{ rotate: showQuickActions ? 45 : 0 }}
                                className={`fab-circle ${showQuickActions ? 'active' : ''}`}
                            >
                                <Plus size={32} strokeWidth={3} />
                            </motion.div>
                        </button>
    
                        {navItems.slice(2).map((item) => (
                            <Link key={item.path} to={item.path} className={`nav-item-link ${location.pathname.includes(item.path.split('/')[3]) ? 'active' : ''}`}>
                                <item.icon size={26} />
                                <span>{item.name}</span>
                            </Link>
                        ))}
                    </div>
                </nav>
            )}

            <style jsx="true">{`
                .premium-layout { 
                    min-height: 100dvh; 
                    display: flex; 
                    flex-direction: column; 
                    background: #F6F8FC; 
                    color: #101828; 
                    font-family: 'Inter', sans-serif; 
                }
                
                /* Elegant Top Header */
                .premium-header { 
                    position: sticky; 
                    top: 0; 
                    left: 0; 
                    right: 0; 
                    height: 72px; 
                    background: white; 
                    z-index: 1000; 
                    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); 
                    border-bottom: 1px solid #F2F4F7; 
                }
                .premium-header.scrolled { 
                    height: 64px; 
                    box-shadow: 0 4px 20px rgba(0,0,0,0.05); 
                }
                .header-inner { max-width: 1440px; margin: 0 auto; height: 100%; display: flex; align-items: center; justify-content: space-between; padding: 0 20px; }
                
                .header-left { display: flex; align-items: center; gap: 12px; }
                .back-to-global-btn { display: flex; align-items: center; gap: 4px; padding: 6px 12px; background: #F9FAFB; border: 1px solid #F2F4F7; border-radius: 12px; color: #475467; font-weight: 700; font-size: 13px; cursor: pointer; transition: 0.2s; }
                .back-to-global-btn:hover { background: #F2F4F7; color: #1E6BFF; }
                .icon-btn { width: 44px; height: 44px; border: none; background: transparent; color: #101828; display: flex; align-items: center; justify-content: center; cursor: pointer; border-radius: 12px; }
                .icon-btn-back { width: 44px; height: 44px; border: none; background: transparent; color: #101828; display: flex; align-items: center; justify-content: center; cursor: pointer; border-radius: 12px; }
                .brand-icon-box { width: 40px; height: 40px; background: #071B44; color: white; border-radius: 10px; display: flex; align-items: center; justify-content: center; }
                .logo-img-mini { width: 32px; height: 32px; border-radius: 8px; object-fit: cover; }

                .header-center { flex: 1; display: flex; justify-content: center; }
                .shop-pill-container { position: relative; }
                .shop-selector-pill { display: flex; align-items: center; gap: 8px; padding: 8px 16px; background: #F9FAFB; border: 1px solid #F2F4F7; border-radius: 99px; font-weight: 700; color: #101828; font-size: 0.9rem; cursor: pointer; transition: all 0.2s; max-width: 200px; }
                .shop-selector-pill:hover { background: #F2F4F7; }
                .shop-name-trunc { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
                .rotated { transform: rotate(180deg); }

                .shop-dropdown-overlay { position: absolute; top: calc(100% + 12px); left: 50%; transform: translateX(-50%); width: 260px; background: white; border-radius: 20px; box-shadow: 0 20px 50px rgba(0,0,0,0.1); border: 1px solid #F2F4F7; padding: 12px; z-index: 2000; }
                .dropdown-title { font-size: 0.7rem; font-weight: 800; text-transform: uppercase; color: #667085; padding: 8px 12px; letter-spacing: 0.05em; }
                .shop-item { width: 100%; display: flex; align-items: center; gap: 12px; padding: 10px 12px; border: none; background: transparent; border-radius: 12px; cursor: pointer; transition: 0.2s; font-weight: 600; color: #344054; }
                .shop-item:hover { background: #F9FAFB; color: #1E6BFF; }
                .shop-item.active { background: #F5F9FF; color: #1E6BFF; }
                .shop-icon-mini { width: 32px; height: 32px; background: #F2F4F7; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-weight: 800; color: #475467; }
                .dropdown-divider { height: 1px; background: #F2F4F7; margin: 8px 0; }
                .shop-item.manage { font-size: 0.85rem; color: #1E6BFF; }

                .header-right { display: flex; align-items: center; gap: 16px; }
                .icon-btn-ghost { width: 44px; height: 44px; border: none; background: transparent; color: #475467; display: flex; align-items: center; justify-content: center; cursor: pointer; }
                .profile-square { width: 42px; height: 42px; background: #1E6BFF; color: white; border-radius: 12px; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 1.1rem; cursor: pointer; box-shadow: 0 4px 12px rgba(30, 107, 255, 0.2); }

                /* Canvas Content */
                .premium-canvas { 
                    flex: 1; 
                    display: flex; 
                    flex-direction: column; 
                    overflow-y: auto;
                }
                .canvas-content { 
                    flex: 1; 
                    padding: 24px 20px 120px 20px; 
                    max-width: 1440px; 
                    margin: 0 auto; 
                    width: 100%; 
                }

                /* Floating Bottom Nav */
                .premium-bottom-nav { 
                    position: fixed; 
                    bottom: 0; 
                    left: 0; 
                    right: 0; 
                    width: 100%;
                    height: 70px; 
                    z-index: 999; 
                    display: flex; 
                    justify-content: center; 
                    padding: 0 20px;
                    padding-bottom: max(10px, env(safe-area-inset-bottom));
                    box-shadow: 0 -2px 10px rgba(0,0,0,0.08);
                }
                .nav-blur-bg { position: absolute; inset: 0; background: rgba(255, 255, 255, 0.95); backdrop-filter: blur(15px); -webkit-backdrop-filter: blur(15px); border-top: 1px solid rgba(0, 0, 0, 0.05); }
                .nav-items-wrapper { position: relative; width: 100%; max-width: 500px; height: 100%; display: flex; align-items: center; justify-content: space-between; padding: 0; margin-bottom: env(safe-area-inset-bottom); }
                
                .nav-item-link { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px; text-decoration: none; color: #94A3B8; transition: all 0.15s ease-out; min-width: 64px; height: 100%; flex: 1; }
                .nav-item-link:active { transform: scale(0.97); opacity: 0.8; }
                .nav-item-link.active { color: #1E6BFF; }
                .nav-item-link span { font-size: 0.65rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.02em; margin-top: 2px; }
                
                .fab-add-center-spacer {
                    width: 70px;
                    flex-shrink: 0;
                }
                
                .fab-add-center { 
                    position: fixed; 
                    bottom: calc(45px + env(safe-area-inset-bottom)); 
                    left: 50%; 
                    transform: translate(-50%, 50%); 
                    width: 72px; 
                    height: 72px; 
                    border: none; 
                    background: transparent; 
                    cursor: pointer; 
                    z-index: 1000; 
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    padding: 0;
                }
                .fab-circle { width: 60px; height: 60px; background: #1E6BFF; color: white; border-radius: 20px; display: flex; align-items: center; justify-content: center; box-shadow: 0 8px 24px rgba(30, 107, 255, 0.35); border: 4px solid white; transition: all 0.15s ease-out; }
                .fab-circle:active { transform: scale(0.95); opacity: 0.9; }
                .fab-circle.active { background: #FF4D4F; box-shadow: 0 10px 30px rgba(255, 77, 79, 0.3); }

                @media (max-width: 1024px) {
                    .premium-layout { padding-left: 0; }
                    .premium-header { height: 60px !important; }
                    .header-inner { padding: 0 12px; gap: 8px; }
                    .menu-trigger { width: 40px; height: 40px; }
                    .icon-btn-back { width: 40px; height: 40px; }
                    .brand-minimal { display: none; }
                    .header-center { flex: 1; min-width: 0; justify-content: flex-start; padding-left: 4px; }
                    .shop-pill-container { width: 100%; max-width: 160px; }
                    .shop-selector-pill { width: 100%; padding: 4px 10px; height: 32px; font-size: 13px; gap: 4px; }
                    .shop-name-trunc { flex: 1; }
                    .header-right { gap: 8px; }
                    .icon-btn-ghost { width: 36px; height: 36px; }
                    .profile-square { width: 32px; height: 32px; font-size: 0.9rem; border-radius: 8px; }
                    
                    .premium-canvas { padding-top: 0; }
                    .canvas-content { padding: 12px 12px calc(130px + env(safe-area-inset-bottom)) 12px; }
                }

                @media (max-width: 480px) {
                    .fab-circle { width: 56px !important; height: 56px !important; border-radius: 18px !important; border-width: 3px !important; }
                    .fab-add-center { width: 64px !important; height: 64px !important; bottom: calc(45px + env(safe-area-inset-bottom)) !important; margin-top: 0 !important; }
                }

                /* Quick Action Overlay */
                .quick-action-overlay { position: fixed; inset: 0; z-index: 5000; display: flex; align-items: flex-end; justify-content: center; }
                .qa-backdrop { position: absolute; inset: 0; background: rgba(7, 27, 68, 0.3); backdrop-filter: blur(12px); }
                .qa-sheet { position: relative; width: 100%; max-width: 500px; background: white; border-radius: 32px 32px 0 0; padding-bottom: 110px; box-shadow: 0 -20px 40px rgba(0,0,0,0.1); }
                
                .qa-header { padding: 20px 0; display: flex; flex-direction: column; align-items: center; gap: 12px; }
                .qah-line { width: 40px; height: 5px; background: #F2F4F7; border-radius: 10px; }
                .qah-text { text-align: center; }
                .qah-text h3 { font-size: 1.25rem; font-weight: 800; margin: 0; color: #101828; }
                .qah-text p { font-size: 0.9rem; color: #667085; font-weight: 600; margin: 4px 0 0 0; }
                
                .qa-list { padding: 0 20px; display: flex; flex-direction: column; gap: 12px; }
                .qa-item-row { width: 100%; height: 72px; background: white; border: 1px solid #F2F4F7; border-radius: 20px; display: flex; align-items: center; padding: 0 16px; gap: 16px; cursor: pointer; transition: all 0.15s ease-out; }
                .qa-item-row:hover { background: #F9FAFB; transform: scale(1.02); border-color: #1E6BFF; }
                .qa-item-row:active { transform: scale(0.97); opacity: 0.9; }
                
                .qai-icon-box { width: 44px; height: 44px; border-radius: 14px; display: flex; align-items: center; justify-content: center; }
                .qai-content { flex: 1; text-align: left; }
                .qai-title { font-size: 1rem; font-weight: 800; color: #101828; }
                .qai-sub { font-size: 0.8rem; font-weight: 600; color: #667085; margin-top: 1px; }

                @media (min-width: 1024px) {
                    .premium-layout { padding-left: var(--sidebar-width); }
                    .premium-header { left: var(--sidebar-width); width: calc(100% - var(--sidebar-width)); }
                    .menu-trigger { display: none; }
                    .premium-bottom-nav { display: none; }
                    .canvas-content { padding-bottom: 40px; }
                    .qa-sheet { position: fixed; bottom: 100px; right: 40px; width: 320px; border-radius: 24px; padding-bottom: 20px; }
                    .quick-action-overlay { justify-content: flex-end; align-items: flex-end; }
                }
            `}</style>
        </div>
    );
};

export default Layout;
