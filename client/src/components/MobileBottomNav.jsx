import React, { useState } from 'react';
import { NavLink, useParams, useLocation, useNavigate } from 'react-router-dom';
import { 
    Home, 
    Package, 
    Plus, 
    Receipt, 
    ShoppingCart,
    Store,
    Layers,
    X,
    ChevronRight,
    Truck
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useScrollLock } from '../hooks/useScrollLock';

const MobileBottomNav = () => {
    const { shopId } = useParams();
    const location = useLocation();
    const navigate = useNavigate();
    const [isActionSheetOpen, setIsActionSheetOpen] = useState(false);

    // Lock body scroll when action sheet is open
    useScrollLock(isActionSheetOpen);

    const navItems = [
        { name: 'Home', path: shopId ? `/shop/${shopId}/dashboard` : '/dashboard', icon: <Home size={22} /> },
        { name: 'Stock', path: shopId ? `/shop/${shopId}/inventory` : '/shops', icon: <Package size={22} /> },
        { name: 'Add', path: '#', icon: <Plus size={28} />, isCenter: true, action: () => setIsActionSheetOpen(true) },
        { name: 'Sell', path: shopId ? `/shop/${shopId}/pos` : '/shops', icon: <ShoppingCart size={22} /> },
        { name: 'Logs', path: shopId ? `/shop/${shopId}/sales-log` : '/dashboard', icon: <Receipt size={22} /> },
    ];

    const quickActions = [
        { name: 'Add Product', icon: <Plus />, color: '#2563eb', path: shopId ? `/shop/${shopId}/inventory?add=true` : '/shops' },
        { name: 'New Sale', icon: <ShoppingCart />, color: '#10b981', path: shopId ? `/shop/${shopId}/pos` : '/shops' },
        { name: 'Add Purchase', icon: <Truck />, color: '#0f172a', path: shopId ? `/shop/${shopId}/purchase-ledger?add=true` : '/shops' },
        { name: 'Add Shop', icon: <Store />, color: '#f59e0b', path: '/shops' },
        { name: 'Update Stock', icon: <Layers />, color: '#8b5cf6', path: shopId ? `/shop/${shopId}/inventory` : '/shops' },
    ];

    const handleAction = (path) => {
        setIsActionSheetOpen(false);
        navigate(path);
    };

    return (
        <>
            <nav className="mobile-bottom-nav">
                <div className="nav-container">
                    {navItems.map((item) => {
                        const isActive = item.path !== '#' && location.pathname.includes(item.path.split('?')[0]) && item.path !== '/dashboard';
                        const isHome = item.name === 'Home' && (location.pathname.includes('/dashboard') || location.pathname === '/');
                        const active = isActive || isHome;
                        
                        return item.isCenter ? (
                            <button 
                                key={item.name}
                                onClick={item.action}
                                className="bottom-nav-item center-item"
                            >
                                <div className="nav-icon-wrapper">
                                    <Plus size={28} />
                                </div>
                                <span className="nav-label">{item.name}</span>
                            </button>
                        ) : (
                            <NavLink 
                                key={item.name} 
                                to={item.path} 
                                className={`bottom-nav-item ${active ? 'active' : ''}`}
                            >
                                <div className="nav-icon-wrapper">
                                    {item.icon}
                                    {active && (
                                        <motion.div 
                                            layoutId="active-pill"
                                            className="active-indicator-pill"
                                            transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                                        />
                                    )}
                                </div>
                                <span className="nav-label">{item.name}</span>
                            </NavLink>
                        );
                    })}
                </div>
            </nav>

            <AnimatePresence>
                {isActionSheetOpen && (
                    <>
                        <motion.div 
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="as-backdrop"
                            onClick={() => setIsActionSheetOpen(false)}
                        />
                        <motion.div 
                            initial={{ y: "100%" }}
                            animate={{ y: 0 }}
                            exit={{ y: "100%" }}
                            transition={{ type: "spring", damping: 25, stiffness: 300 }}
                            className="action-sheet"
                        >
                            <div className="as-header">
                                <div className="as-handle" />
                                <div className="as-title">
                                    <h3>Quick Actions</h3>
                                    <button onClick={() => setIsActionSheetOpen(false)}><X size={20} /></button>
                                </div>
                            </div>
                            <div className="as-content">
                                {quickActions.map(action => (
                                    <button 
                                        key={action.name}
                                        className="as-item"
                                        onClick={() => handleAction(action.path)}
                                    >
                                        <div className="asi-icon" style={{ background: action.color }}>
                                            {React.cloneElement(action.icon, { size: 20, color: 'white' })}
                                        </div>
                                        <div className="asi-text">
                                            <span>{action.name}</span>
                                        </div>
                                        <ChevronRight size={18} className="asi-arrow" />
                                    </button>
                                ))}
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>

            <style jsx="true">{`
                .mobile-bottom-nav {
                    position: fixed;
                    bottom: 0;
                    left: 0;
                    right: 0;
                    background: #ffffff;
                    border-top: 1px solid rgba(0, 0, 0, 0.05);
                    z-index: 9999;
                    padding-bottom: env(safe-area-inset-bottom);
                    border-radius: 24px 24px 0 0;
                    box-shadow: 0 -10px 40px rgba(0, 0, 0, 0.08);
                    display: none;
                    transform: translateZ(0);
                    will-change: transform;
                }

                @media (max-width: 1023px) {
                    .mobile-bottom-nav {
                        display: block;
                    }
                }

                .nav-container {
                    display: flex;
                    height: 80px; /* Increased to stable height */
                    align-items: center;
                    justify-content: space-around;
                    padding: 0 4px;
                    width: 100%;
                }

                .bottom-nav-item {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    gap: 4px;
                    color: #94a3b8;
                    text-decoration: none;
                    flex: 1;
                    position: relative;
                    height: 100%;
                    background: transparent;
                    border: none;
                    outline: none;
                    cursor: pointer;
                    min-width: 0;
                }

                .bottom-nav-item.active {
                    color: #0f172a;
                }

                .nav-icon-wrapper {
                    position: relative;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    width: 38px;
                    height: 38px;
                    z-index: 1;
                }

                .active-indicator-pill {
                    position: absolute;
                    inset: 0;
                    background: #f1f5f9;
                    border-radius: 12px;
                    z-index: -1;
                }

                .nav-label {
                    font-size: 10px;
                    font-weight: 800;
                    font-family: 'Plus Jakarta Sans', sans-serif;
                    letter-spacing: 0.01em;
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    width: 100%;
                    text-align: center;
                }

                .center-item {
                    transform: translateY(-18px);
                }

                .center-item .nav-icon-wrapper {
                    background: #0f172a;
                    color: white;
                    width: 52px;
                    height: 52px;
                    border-radius: 18px;
                    box-shadow: 0 10px 24px rgba(15, 23, 42, 0.3);
                    border: 4px solid white;
                }

                .center-item .nav-label {
                    position: absolute;
                    bottom: -20px;
                    font-weight: 900;
                    color: #0f172a;
                    font-size: 11px;
                }

                /* Action Sheet */
                .as-backdrop { position: fixed; inset: 0; background: rgba(15, 23, 42, 0.4); backdrop-filter: blur(8px); z-index: 10000; }
                .action-sheet { position: fixed; bottom: 0; left: 0; right: 0; background: white; border-radius: 32px 32px 0 0; z-index: 10001; padding-bottom: env(safe-area-inset-bottom); box-shadow: 0 -20px 60px rgba(0, 0, 0, 0.15); }
                .as-header { padding: 12px 24px 16px; display: flex; flex-direction: column; align-items: center; gap: 12px; }
                .as-handle { width: 40px; height: 5px; background: #e2e8f0; border-radius: 99px; }
                .as-title { width: 100%; display: flex; justify-content: space-between; align-items: center; }
                .as-title h3 { font-size: 1.25rem; font-weight: 800; color: #0f172a; margin: 0; font-family: 'Plus Jakarta Sans', sans-serif; }
                .as-title button { background: #f1f5f9; border: none; width: 36px; height: 36px; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: #64748b; }
                .as-content { padding: 0 16px 32px; display: flex; flex-direction: column; gap: 10px; }
                .as-item { display: flex; align-items: center; gap: 16px; padding: 14px; background: #f8fafc; border: none; border-radius: 20px; width: 100%; text-align: left; transition: all 0.2s; }
                .as-item:active { background: #f1f5f9; transform: scale(0.98); }
                .asi-icon { width: 40px; height: 40px; border-radius: 12px; display: flex; align-items: center; justify-content: center; box-shadow: 0 6px 12px rgba(0, 0, 0, 0.1); }
                .asi-text { flex: 1; font-size: 1rem; font-weight: 700; color: #1e293b; font-family: 'Plus Jakarta Sans', sans-serif; }
                .asi-arrow { color: #cbd5e1; }
            `}</style>
        </>
    );
};

export default MobileBottomNav;
