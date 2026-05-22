import React from 'react';
import { NavLink, useParams, useNavigate } from 'react-router-dom';
import { 
    LayoutDashboard, 
    Store, 
    Package, 
    ShoppingCart, 
    BarChart3, 
    LogOut,
    X,
    ChevronLeft,
    ClipboardList,
    Settings,
    User,
    Book,
    ArrowRightLeft,
    Truck
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useInstall } from '../context/InstallContext';
import { motion } from 'framer-motion';
import { Download, ShieldCheck } from 'lucide-react';

const Sidebar = ({ isOpen, toggleSidebar, currentShop }) => {
    const { logout } = useAuth();
    const { isInstallable, installApp } = useInstall();
    const { shopId } = useParams();
    const navigate = useNavigate();
    
    // Lock body scroll when sidebar is open
    React.useEffect(() => {
        if (isOpen && window.innerWidth < 1024) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = 'unset';
        }
        return () => {
            document.body.style.overflow = 'unset';
        };
    }, [isOpen]);

    const mainItems = [
        { name: 'Dashboard', path: '/dashboard', icon: <LayoutDashboard size={20} /> },
        { name: 'My Businesses', path: '/shops', icon: <Store size={20} /> },
    ];

    const shopItems = [
        { name: 'Shop Home', path: `/shop/${shopId}/dashboard`, icon: <LayoutDashboard size={20} /> },
        { name: 'New Sale', path: `/shop/${shopId}/pos`, icon: <ShoppingCart size={20} /> },
        { name: 'Inventory', path: `/shop/${shopId}/inventory`, icon: <Package size={20} /> },
        { name: 'Sales Log', path: `/shop/${shopId}/sales-log`, icon: <ClipboardList size={20} /> },
        { name: 'Khata Book', path: `/shop/${shopId}/khata`, icon: <Book size={20} /> },
        { name: 'Purchase Ledger', path: `/shop/${shopId}/purchase-ledger`, icon: <Truck size={20} /> },
        { name: 'Analytics', path: `/shop/${shopId}/reports`, icon: <BarChart3 size={20} /> },
    ];

    const govItems = currentShop && currentShop.type === 'Fertilizers' ? [
        { name: 'Government Ledger', path: `/shop/${shopId}/gov-sales-log`, icon: <ClipboardList size={20} /> },
        { name: 'Gov Reports', path: `/shop/${shopId}/gov-reports`, icon: <BarChart3 size={20} /> },
    ] : [];

    const currentItems = shopId ? shopItems : mainItems;

    return (
        <>
            {isOpen && (
                <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="mobile-overlay" 
                    onClick={toggleSidebar}
                />
            )}

            <aside className={`sidebar-premium ${isOpen ? 'open' : ''}`}>
                <div className="sidebar-header">
                    <div className="brand-logo" onClick={() => navigate('/dashboard')}>
                        <img src="https://i.ibb.co/9mVRXF5q/Chat-GPT-Image-May-14-2026-01-56-04-PM.png" alt="ShopPulse" className="logo-img" />
                        <span className="brand-name">ShopPulse</span>
                    </div>
                    <button className="mobile-close-btn" onClick={toggleSidebar}><X size={18} /></button>
                </div>

                <div className="sidebar-scroll">
                    <nav className="nav-group">
                        <div className="nav-label-top">Main Menu</div>
                        {currentItems.map((item) => (
                            <NavLink 
                                key={item.path} 
                                to={item.path} 
                                className={({ isActive }) => `nav-link-premium ${isActive ? 'active' : ''}`}
                                onClick={() => window.innerWidth < 1024 && toggleSidebar()}
                            >
                                <span className="nl-icon">{item.icon}</span>
                                <span className="nl-text">{item.name}</span>
                                {item.path.includes('pos') && !item.path.includes('gov') && <span className="hot-tag">HOT</span>}
                            </NavLink>
                        ))}
                    </nav>

                    {govItems.length > 0 && (
                        <nav className="nav-group secondary">
                            <div className="nav-label-top" style={{color: '#059669'}}>Government Records</div>
                            {govItems.map((item) => (
                                <NavLink 
                                    key={item.path} 
                                    to={item.path} 
                                    className={({ isActive }) => `nav-link-premium gov-link ${isActive ? 'active' : ''}`}
                                    onClick={() => window.innerWidth < 1024 && toggleSidebar()}
                                    style={{ '--hover-bg': '#ECFDF5', '--active-bg': '#D1FAE5', '--active-color': '#059669' }}
                                >
                                    <span className="nl-icon">{item.icon}</span>
                                    <span className="nl-text">{item.name}</span>
                                </NavLink>
                            ))}
                        </nav>
                    )}

                    {shopId && (
                        <div className="nav-group secondary">
                            <div className="nav-label-top">Management</div>
                            <NavLink to="/dashboard" className="nav-link-premium switch-link">
                                <span className="nl-icon"><ArrowRightLeft size={20} /></span>
                                <span className="nl-text">Switch Business</span>
                            </NavLink>
                        </div>
                    )}
                </div>

                <div className="sidebar-footer-premium">
                    {isInstallable && (
                        <button onClick={installApp} className="install-btn-premium">
                            <Download size={18} />
                            <span>Get App</span>
                        </button>
                    )}
                    <div className="user-pill-sidebar" onClick={() => navigate('/dashboard')}>
                        <div className="up-avatar">A</div>
                        <div className="up-info">
                            <span className="up-name">Account Settings</span>
                            <span className="up-role">Owner</span>
                        </div>
                        <Settings size={16} className="text-muted" />
                    </div>
                    <button onClick={logout} className="logout-btn-premium">
                        <LogOut size={18} />
                        <span>Sign Out</span>
                    </button>
                </div>
            </aside>

            <style jsx="true">{`
                .sidebar-premium {
                    width: var(--sidebar-width);
                    height: 100vh;
                    background: #ffffff;
                    border-right: 1px solid var(--border);
                    position: fixed;
                    top: 0;
                    left: 0;
                    display: flex;
                    flex-direction: column;
                    z-index: 2000;
                    transition: transform 0.4s cubic-bezier(0.4, 0, 0.2, 1);
                }

                @media (max-width: 1023px) {
                    .sidebar-premium { 
                        width: 82%; 
                        max-width: 320px;
                        transform: translateX(-100%); 
                        border-right: none;
                    }
                    .sidebar-premium.open { 
                        transform: translateX(0); 
                        box-shadow: 15px 0 40px rgba(0,0,0,0.12); 
                    }
                    .mobile-overlay { 
                        position: fixed; 
                        inset: 0; 
                        background: rgba(15, 23, 42, 0.35); 
                        backdrop-filter: blur(3px); 
                        -webkit-backdrop-filter: blur(3px);
                        z-index: 1900; 
                    }
                }

                .sidebar-header { 
                    height: 80px;
                    padding: 0 1.75rem; 
                    display: flex; 
                    align-items: center; 
                    justify-content: space-between; 
                    border-bottom: 1px solid #f8fafc;
                }
                
                .brand-logo { 
                    display: flex; 
                    align-items: center; 
                    gap: 0.85rem; 
                    cursor: pointer; 
                    font-size: 1.25rem; 
                    font-weight: 800; 
                    color: #0f172a; 
                    letter-spacing: -0.02em;
                    font-family: 'Plus Jakarta Sans', sans-serif;
                }
                
                .logo-img { width: 32px; height: 32px; border-radius: 9px; object-fit: cover; flex-shrink: 0; }
                .brand-name { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
                .mobile-close-btn { 
                    width: 32px; 
                    height: 32px; 
                    display: flex; 
                    align-items: center; 
                    justify-content: center; 
                    background: #f8fafc; 
                    border: 1px solid #f1f5f9; 
                    border-radius: 10px; 
                    color: #94a3b8;
                    transition: all 0.2s;
                }
                .mobile-close-btn:active { transform: scale(0.9); background: #f1f5f9; }

                .sidebar-scroll { 
                    flex: 1; 
                    overflow-y: auto; 
                    padding: 1.25rem; 
                    scrollbar-width: none; 
                    -ms-overflow-style: none;
                }
                .sidebar-scroll::-webkit-scrollbar { display: none; }
                
                .nav-group { margin-bottom: 2rem; display: flex; flex-direction: column; gap: 0.5rem; }
                
                .nav-label-top { 
                    font-size: 0.65rem; 
                    font-weight: 800; 
                    color: #94a3b8; 
                    text-transform: uppercase; 
                    letter-spacing: 0.1em; 
                    padding: 0 0.75rem 0.75rem;
                    font-family: 'Plus Jakarta Sans', sans-serif;
                }

                .nav-link-premium {
                    display: flex;
                    align-items: center;
                    gap: 0.85rem;
                    padding: 0.85rem 1.25rem;
                    border-radius: 14px;
                    color: #64748b;
                    font-weight: 500;
                    font-size: 17px;
                    text-decoration: none;
                    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
                }

                .nav-link-premium:hover { 
                    background: #f8fafc; 
                    color: #0f172a; 
                }

                .nav-link-premium.active { 
                    background: #f1f5f9; 
                    color: var(--primary); 
                    font-weight: 700;
                }
                
                .nav-link-premium.active .nl-icon { color: var(--primary); }
                .nl-icon { display: flex; align-items: center; justify-content: center; width: 22px; }
                
                .hot-tag { font-size: 0.65rem; background: #fee2e2; color: #ef4444; padding: 2px 6px; border-radius: 6px; font-weight: 800; margin-left: auto; }
                .switch-link { color: var(--primary); background: #f0f9ff !important; margin-top: 0.5rem; font-weight: 700; padding: 0.85rem 1.25rem; }

                .sidebar-footer-premium { 
                    padding: 1.5rem 1.25rem; 
                    padding-bottom: calc(1.5rem + env(safe-area-inset-bottom, 0px));
                    border-top: 1px solid #f8fafc; 
                    display: flex; 
                    flex-direction: column; 
                    gap: 0.75rem; 
                }
                
                .user-pill-sidebar { 
                    display: flex; 
                    align-items: center; 
                    gap: 0.85rem; 
                    padding: 0.85rem; 
                    background: #f8fafc; 
                    border-radius: 16px; 
                    cursor: pointer; 
                    transition: all 0.2s;
                    border: 1px solid #f1f5f9;
                }
                .user-pill-sidebar:hover { border-color: #e2e8f0; background: #f1f5f9; }
                
                .up-avatar { 
                    width: 32px; 
                    height: 32px; 
                    background: linear-gradient(135deg, #e2e8f0, #cbd5e1); 
                    color: #475569; 
                    border-radius: 9px; 
                    display: flex; 
                    align-items: center; 
                    justify-content: center; 
                    font-weight: 800;
                    font-size: 0.85rem;
                }
                
                .up-info { flex: 1; display: flex; flex-direction: column; min-width: 0; }
                .up-name { font-size: 0.85rem; font-weight: 700; color: #1e293b; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
                .up-role { font-size: 0.7rem; color: #94a3b8; font-weight: 600; }

                .logout-btn-premium { 
                    display: flex; 
                    align-items: center; 
                    gap: 0.85rem; 
                    padding: 0.85rem 1.25rem; 
                    background: transparent; 
                    border: none; 
                    color: #94a3b8; 
                    font-weight: 600; 
                    font-size: 0.875rem; 
                    cursor: pointer; 
                    border-radius: 14px; 
                    transition: all 0.2s; 
                }
                .logout-btn-premium:hover { background: #fef2f2; color: #ef4444; }

                .install-btn-premium {
                    display: flex;
                    align-items: center;
                    gap: 0.85rem;
                    padding: 1rem 1.25rem;
                    background: linear-gradient(135deg, #2563eb, #1e40af);
                    border: none;
                    color: white;
                    font-weight: 700;
                    font-size: 0.875rem;
                    cursor: pointer;
                    border-radius: 14px;
                    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
                    box-shadow: 0 4px 12px rgba(37, 99, 235, 0.2);
                    margin-bottom: 0.5rem;
                }
                .install-btn-premium:hover {
                    transform: translateY(-2px);
                    box-shadow: 0 6px 16px rgba(37, 99, 235, 0.3);
                    background: linear-gradient(135deg, #1d4ed8, #1e3a8a);
                }
                .install-btn-premium:active { transform: translateY(0); }
            `}</style>
        </>
    );
};

export default Sidebar;
