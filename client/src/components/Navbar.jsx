import React, { useState, useEffect } from 'react';
import { Menu, Bell, Search, User, ChevronDown, Store, Zap, Plus, Settings } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useParams, useNavigate } from 'react-router-dom';
import { shopService } from '../services/api';

const Navbar = ({ toggleSidebar }) => {
    const { user } = useAuth();
    const { shopId } = useParams();
    const navigate = useNavigate();
    const [shops, setShops] = useState([]);
    const [currentShop, setCurrentShop] = useState(null);

    useEffect(() => {
        const fetchShops = async () => {
            try {
                const res = await shopService.getAll();
                setShops(res.data.data);
                if (shopId) {
                    setCurrentShop(res.data.data.find(s => s._id === shopId));
                }
            } catch (err) {
                console.error(err);
            }
        };
        fetchShops();
    }, [shopId]);

    const handleShopChange = (e) => {
        const newShopId = e.target.value;
        if (newShopId) {
            navigate(`/shop/${newShopId}/dashboard`);
        } else {
            navigate('/dashboard');
        }
    };

    return (
        <header className="navbar-premium glass">
            <div className="nv-left">
                <button className="nv-menu-btn hide-desktop" onClick={toggleSidebar}>
                    <Menu size={22} />
                </button>
                
                <div className="shop-switcher-pill">
                    <div className="ss-icon">
                        <Store size={16} />
                    </div>
                    <select 
                        value={shopId || ''} 
                        onChange={handleShopChange} 
                        className="ss-select"
                    >
                        <option value="">Switch Business...</option>
                        {shops.map(shop => (
                            <option key={shop._id} value={shop._id}>{shop.name}</option>
                        ))}
                    </select>
                    <ChevronDown size={14} className="ss-arrow" />
                </div>

                <div className="search-pill-nav hide-mobile">
                    <Search size={16} />
                    <input type="text" placeholder="Search orders, stock..." />
                    <span className="search-kb">⌘K</span>
                </div>
            </div>

            <div className="nv-right">
                <div className="nv-actions">
                    <button className="action-circle-nav hide-mobile" onClick={() => navigate(`/shop/${shopId}/pos`)}>
                        <Plus size={20} />
                    </button>
                    <button className="action-circle-nav">
                        <Bell size={20} />
                        <div className="notif-dot"></div>
                    </button>
                </div>

                <div className="nv-profile-box" onClick={() => navigate('/dashboard')}>
                    <div className="nv-user-text hide-mobile">
                        <span className="nv-name">{user?.name?.split(' ')[0]}</span>
                        <span className="nv-role">Pro Account</span>
                    </div>
                    <div className="nv-avatar">
                        {user?.name?.charAt(0).toUpperCase()}
                    </div>
                </div>
            </div>

            <style jsx="true">{`
                .navbar-premium {
                    height: var(--header-height);
                    padding: 0 2rem;
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    position: sticky;
                    top: 0;
                    z-index: 100;
                    background: rgba(255, 255, 255, 0.7);
                    backdrop-filter: blur(16px);
                    -webkit-backdrop-filter: blur(16px);
                    border-bottom: 1px solid var(--border);
                }

                .nv-left { display: flex; align-items: center; gap: 1.5rem; }
                
                .nv-menu-btn { background: transparent; border: none; color: #64748b; cursor: pointer; padding: 0.5rem; border-radius: 12px; }
                .nv-menu-btn:hover { background: #f1f5f9; }

                .shop-switcher-pill {
                    display: flex;
                    align-items: center;
                    gap: 0.85rem;
                    background: #ffffff;
                    padding: 0.5rem 1rem;
                    border-radius: 12px;
                    border: 1px solid var(--border);
                    position: relative;
                    min-width: 160px;
                    max-width: 260px;
                    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
                    box-shadow: var(--shadow-sm);
                }

                .shop-switcher-pill:hover { border-color: #cbd5e1; transform: translateY(-1px); box-shadow: var(--shadow-md); }
                
                .ss-icon { width: 24px; height: 24px; background: var(--primary-light); color: var(--primary); border-radius: 6px; display: flex; align-items: center; justify-content: center; }
                
                .ss-select {
                    appearance: none;
                    background: transparent;
                    border: none;
                    font-size: 0.85rem;
                    font-weight: 700;
                    color: #1e293b;
                    width: 100%;
                    padding-right: 1.5rem;
                    outline: none;
                    cursor: pointer;
                    z-index: 2;
                    font-family: 'Plus Jakarta Sans', sans-serif;
                }

                .ss-arrow { position: absolute; right: 12px; color: #94a3b8; pointer-events: none; }

                .search-pill-nav {
                    display: flex;
                    align-items: center;
                    gap: 0.75rem;
                    background: #f1f5f9;
                    padding: 0.65rem 1.25rem;
                    border-radius: 12px;
                    width: 320px;
                    color: #94a3b8;
                    border: 1px solid transparent;
                    transition: all 0.2s;
                }
                
                .search-pill-nav:focus-within {
                    background: white;
                    border-color: var(--primary);
                    box-shadow: 0 0 0 4px rgba(37, 99, 235, 0.08);
                }

                .search-pill-nav input { background: transparent; border: none; outline: none; flex: 1; font-size: 0.875rem; font-weight: 500; color: #0f172a; }
                .search-kb { font-size: 0.65rem; font-weight: 800; background: white; padding: 2px 6px; border-radius: 6px; border: 1px solid #e2e8f0; color: #94a3b8; box-shadow: var(--shadow-sm); }

                .nv-right { display: flex; align-items: center; gap: 1.5rem; }
                .nv-actions { display: flex; gap: 0.75rem; padding-right: 1.5rem; border-right: 1px solid var(--border); }
                
                .action-circle-nav { width: 40px; height: 40px; border-radius: 10px; border: 1px solid var(--border); background: white; color: #64748b; display: flex; align-items: center; justify-content: center; cursor: pointer; position: relative; transition: all 0.2s; }
                .action-circle-nav:hover { background: #f8fafc; color: var(--primary); border-color: #cbd5e1; transform: translateY(-1px); }
                
                .notif-dot { position: absolute; top: 10px; right: 10px; width: 6px; height: 6px; background: #ef4444; border-radius: 50%; border: 2px solid white; }

                .nv-profile-box { display: flex; align-items: center; gap: 1rem; cursor: pointer; padding: 0.5rem; border-radius: 12px; transition: all 0.2s; }
                .nv-profile-box:hover { background: #f8fafc; }
                
                .nv-user-text { display: flex; flex-direction: column; text-align: right; }
                .nv-name { 
                    font-size: 0.875rem; 
                    font-weight: 700; 
                    color: #0f172a; 
                    font-family: 'Plus Jakarta Sans', sans-serif;
                }
                .nv-role { font-size: 0.7rem; color: #94a3b8; font-weight: 600; }
                
                .nv-avatar { 
                    width: 36px; 
                    height: 36px; 
                    border-radius: 10px; 
                    background: var(--primary); 
                    color: white; 
                    display: flex; 
                    align-items: center; 
                    justify-content: center; 
                    font-weight: 800; 
                    font-size: 0.875rem; 
                    box-shadow: 0 4px 12px rgba(37,99,235,0.15); 
                }

                @media (max-width: 640px) {
                    .navbar-premium { padding: 0 1rem; }
                    .shop-switcher-pill { min-width: 120px; }
                }
            `}</style>
        </header>
    );
};

export default Navbar;
