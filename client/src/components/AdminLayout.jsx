import React, { useState } from 'react';
import { Link, useLocation, useNavigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { 
    LayoutDashboard, 
    Store, 
    Activity, 
    BarChart3, 
    Users, 
    CreditCard, 
    LifeBuoy, 
    HeartPulse, 
    ArrowLeft, 
    LogOut,
    Menu,
    X,
    Shield
} from 'lucide-react';

const AdminLayout = () => {
    const { logout, user } = useAuth();
    const location = useLocation();
    const navigate = useNavigate();
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);

    const menuItems = [
        { name: 'Overview', path: '/admin', icon: LayoutDashboard },
        { name: 'Shops Control', path: '/admin/shops', icon: Store },
        { name: 'Activity Log', path: '/admin/activity', icon: Activity },
        { name: 'Analytics', path: '/admin/analytics', icon: BarChart3 },
        { name: 'Customers', path: '/admin/customers', icon: Users },
        { name: 'Subscriptions', path: '/admin/subscriptions', icon: CreditCard },
        { name: 'Support tickets', path: '/admin/support', icon: LifeBuoy },
        { name: 'System Health', path: '/admin/system-health', icon: HeartPulse }
    ];

    const currentTitle = menuItems.find(item => item.path === location.pathname)?.name || 'Control Center';

    return (
        <div className="admin-frame">
            {/* Sidebar */}
            <aside className={`admin-sidebar ${isSidebarOpen ? 'open' : ''}`}>
                <div className="sidebar-brand">
                    <div className="admin-badge">
                        <Shield size={16} color="#3B82F6" />
                        <span>SUPER ADMIN</span>
                    </div>
                    <h2>ShopPulse</h2>
                </div>

                <nav className="sidebar-nav">
                    {menuItems.map(item => {
                        const Icon = item.icon;
                        const isActive = location.pathname === item.path;
                        return (
                            <Link 
                                key={item.path} 
                                to={item.path} 
                                className={`sidebar-nav-item ${isActive ? 'active' : ''}`}
                                onClick={() => setIsSidebarOpen(false)}
                            >
                                <Icon size={20} />
                                <span>{item.name}</span>
                            </Link>
                        );
                    })}
                </nav>

                <div className="sidebar-footer">
                    <button className="sidebar-action-btn escape-btn" onClick={() => navigate('/dashboard')}>
                        <ArrowLeft size={18} />
                        <span>Back to App</span>
                    </button>
                    <button className="sidebar-action-btn logout-btn" onClick={logout}>
                        <LogOut size={18} />
                        <span>Log Out</span>
                    </button>
                </div>
            </aside>

            {isSidebarOpen && <div className="sidebar-overlay" onClick={() => setIsSidebarOpen(false)} />}

            {/* Main Canvas */}
            <div className="admin-canvas">
                <header className="admin-header">
                    <div className="header-left">
                        <button className="mobile-menu-btn" onClick={() => setIsSidebarOpen(true)}>
                            <Menu size={24} />
                        </button>
                        <h1>{currentTitle}</h1>
                    </div>

                    <div className="header-right">
                        <div className="admin-profile">
                            <div className="profile-initial">{user?.name?.charAt(0) || 'A'}</div>
                            <div className="profile-details">
                                <div className="profile-name">{user?.name || 'Administrator'}</div>
                                <div className="profile-role">Owner / Admin</div>
                            </div>
                        </div>
                    </div>
                </header>

                <main className="admin-content">
                    <Outlet />
                </main>
            </div>

            <style jsx="true">{`
                .admin-frame { display: flex; min-height: 100vh; background: #F8FAFC; color: #0F172A; font-family: 'Inter', sans-serif; }
                
                /* Sidebar */
                .admin-sidebar {
                    width: 260px;
                    background: white;
                    border-right: 1px solid #E2E8F0;
                    display: flex;
                    flex-direction: column;
                    position: fixed;
                    top: 0;
                    bottom: 0;
                    left: 0;
                    z-index: 1000;
                    transition: transform 0.3s ease;
                }

                .sidebar-brand { padding: 24px; display: flex; flex-direction: column; gap: 8px; border-bottom: 1px solid #F1F5F9; }
                .admin-badge { display: inline-flex; align-items: center; gap: 6px; background: #EFF6FF; color: #1D4ED8; font-size: 11px; font-weight: 800; padding: 4px 8px; border-radius: 6px; width: fit-content; }
                .sidebar-brand h2 { margin: 0; font-size: 20px; font-weight: 800; color: #0F172A; letter-spacing: -0.02em; }
                
                .sidebar-nav { flex: 1; padding: 20px 12px; display: flex; flex-direction: column; gap: 4px; overflow-y: auto; }
                .sidebar-nav-item { display: flex; align-items: center; gap: 12px; padding: 12px 16px; border-radius: 12px; color: #475569; font-weight: 600; text-decoration: none; font-size: 14px; transition: all 0.2s; }
                .sidebar-nav-item:hover { background: #F1F5F9; color: #1E6BFF; }
                .sidebar-nav-item.active { background: #EFF6FF; color: #1E6BFF; font-weight: 700; }

                .sidebar-footer { padding: 16px 12px; display: flex; flex-direction: column; gap: 8px; border-top: 1px solid #F1F5F9; }
                .sidebar-action-btn { width: 100%; height: 44px; border-radius: 10px; font-size: 13px; font-weight: 700; cursor: pointer; display: flex; align-items: center; gap: 10px; padding: 0 16px; border: none; transition: 0.2s; }
                .escape-btn { background: #F1F5F9; color: #334155; }
                .escape-btn:hover { background: #E2E8F0; color: #0F172A; }
                .logout-btn { background: #FEF2F2; color: #991B1B; }
                .logout-btn:hover { background: #FEE2E2; color: #7F1D1D; }

                /* Main Content Area */
                .admin-canvas { flex: 1; margin-left: 260px; display: flex; flex-direction: column; min-width: 0; }
                
                .admin-header {
                    height: 70px;
                    background: white;
                    border-bottom: 1px solid #E2E8F0;
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    padding: 0 32px;
                    position: sticky;
                    top: 0;
                    z-index: 900;
                }

                .header-left { display: flex; align-items: center; gap: 16px; }
                .header-left h1 { margin: 0; font-size: 20px; font-weight: 800; color: #0F172A; letter-spacing: -0.02em; }
                .mobile-menu-btn { display: none; background: none; border: none; color: #334155; cursor: pointer; }

                .admin-profile { display: flex; align-items: center; gap: 12px; }
                .profile-initial { width: 38px; height: 38px; border-radius: 10px; background: #3B82F6; color: white; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 16px; }
                .profile-details { text-align: left; }
                .profile-name { font-size: 14px; font-weight: 700; color: #0F172A; }
                .profile-role { font-size: 11px; font-weight: 600; color: #64748B; }

                .admin-content { padding: 32px; flex: 1; overflow-y: auto; }

                /* Mobile responsive adjustments */
                @media (max-width: 1024px) {
                    .admin-sidebar { transform: translateX(-100%); }
                    .admin-sidebar.open { transform: translateX(0); }
                    .sidebar-overlay { position: fixed; inset: 0; background: rgba(15, 23, 42, 0.4); backdrop-filter: blur(4px); z-index: 999; }
                    .admin-canvas { margin-left: 0; }
                    .admin-header { padding: 0 16px; height: 60px; }
                    .mobile-menu-btn { display: block; }
                    .admin-content { padding: 16px; }
                }
            `}</style>
        </div>
    );
};

export default AdminLayout;
