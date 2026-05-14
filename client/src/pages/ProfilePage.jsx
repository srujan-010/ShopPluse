import React from 'react';
import { 
    User, 
    Mail, 
    Shield, 
    Bell, 
    Smartphone, 
    CreditCard, 
    LogOut, 
    ChevronRight, 
    Settings,
    Globe,
    Lock,
    HelpCircle,
    ChevronLeft
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';

const ProfilePage = () => {
    const { user, logout } = useAuth();
    const navigate = useNavigate();

    const settingGroups = [
        {
            title: 'Account Settings',
            items: [
                { icon: <User size={20} />, label: 'Personal Information', value: 'Name, Email, Phone', color: '#2563eb' },
                { icon: <Lock size={20} />, label: 'Login & Security', value: 'Password, 2FA', color: '#7c3aed' },
                { icon: <Shield size={20} />, label: 'Data & Privacy', value: 'Managed your data', color: '#059669' },
            ]
        },
        {
            title: 'Business & Payments',
            items: [
                { icon: <CreditCard size={20} />, label: 'Subscription Plan', value: 'Premium Member', color: '#ea580c' },
                { icon: <Globe size={20} />, label: 'Business Profile', value: 'Shop Details', color: '#2563eb' },
            ]
        },
        {
            title: 'Preferences',
            items: [
                { icon: <Bell size={20} />, label: 'Notifications', value: 'Email, Push', color: '#f59e0b' },
                { icon: <Smartphone size={20} />, label: 'App Settings', value: 'Theme, Language', color: '#64748b' },
            ]
        }
    ];

    return (
        <div className="profile-container">
            {/* Header */}
            <header className="profile-header">
                <button className="back-btn-circle" onClick={() => navigate(-1)}>
                    <ChevronLeft size={22} />
                </button>
                <h1>Account Settings</h1>
                <button className="action-icon-btn"><Settings size={22} /></button>
            </header>

            {/* User Identity Card */}
            <section className="identity-section">
                <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="card identity-card"
                >
                    <div className="avatar-large">
                        {user?.avatar ? (
                            <img src={user.avatar} alt={user.name} style={{ width: '100%', height: '100%', borderRadius: 'inherit', objectFit: 'cover' }} />
                        ) : (
                            user?.name?.charAt(0).toUpperCase()
                        )}
                    </div>
                    <div className="user-details-main">
                        <h2>{user?.name || 'Shop Owner'}</h2>
                        <div className="user-meta-row">
                            <Mail size={14} />
                            <span>{user?.email}</span>
                        </div>
                        <div className="badge-premium">PREMIUM MEMBER</div>
                    </div>
                </motion.div>
            </section>

            {/* Settings Groups */}
            <section className="settings-section">
                {settingGroups.map((group, gIdx) => (
                    <div key={gIdx} className="settings-group">
                        <h3 className="group-title">{group.title}</h3>
                        <div className="card group-card">
                            {group.items.map((item, iIdx) => (
                                <div key={iIdx} className="setting-item">
                                    <div className="si-left">
                                        <div className="si-icon" style={{ color: item.color, background: `${item.color}15` }}>
                                            {item.icon}
                                        </div>
                                        <div className="si-text">
                                            <span className="si-label">{item.label}</span>
                                            <span className="si-value">{item.value}</span>
                                        </div>
                                    </div>
                                    <ChevronRight size={18} className="si-arrow" />
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
            </section>

            {/* Support & Logout */}
            <section className="footer-actions">
                <button className="card support-card">
                    <div className="sc-left">
                        <HelpCircle size={22} />
                        <span>Support & Feedback</span>
                    </div>
                    <ChevronRight size={18} />
                </button>

                <button className="logout-btn-full" onClick={logout}>
                    <LogOut size={20} />
                    <span>Sign Out from ShopPulse</span>
                </button>

                <div className="app-version">
                    ShopPulse v2.4.0 (Build 2026)
                </div>
            </section>

            <style jsx="true">{`
                .profile-container { display: flex; flex-direction: column; gap: 2rem; padding-bottom: 120px; }
                
                .profile-header { display: flex; justify-content: space-between; align-items: center; }
                .profile-header h1 { font-size: 1.25rem; font-weight: 800; margin: 0; }
                .back-btn-circle, .action-icon-btn { width: 44px; height: 44px; border-radius: 50%; border: none; background: white; display: flex; align-items: center; justify-content: center; box-shadow: var(--shadow-md); color: var(--text-muted); cursor: pointer; }

                .identity-card { padding: 2rem; display: flex; align-items: center; gap: 1.5rem; border-radius: 28px; background: linear-gradient(135deg, #ffffff 0%, #f8fafc 100%); }
                .avatar-large { width: 80px; height: 80px; background: var(--primary); color: white; border-radius: 24px; display: flex; align-items: center; justify-content: center; font-size: 2rem; font-weight: 900; box-shadow: 0 10px 25px rgba(37, 99, 235, 0.3); }
                .user-details-main h2 { font-size: 1.5rem; font-weight: 900; margin-bottom: 0.25rem; color: #0f172a; }
                .user-meta-row { display: flex; align-items: center; gap: 0.5rem; color: #64748b; font-size: 0.9rem; margin-bottom: 0.75rem; }
                .badge-premium { display: inline-block; padding: 4px 12px; background: #fffbeb; color: #d97706; font-size: 0.7rem; font-weight: 800; border-radius: 99px; border: 1px solid #fef3c7; }

                .settings-group { margin-bottom: 0.5rem; }
                .group-title { font-size: 0.75rem; font-weight: 800; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 0.75rem; padding-left: 0.5rem; }
                .group-card { border-radius: 24px; overflow: hidden; padding: 0.5rem; }
                
                .setting-item { display: flex; justify-content: space-between; align-items: center; padding: 1rem; border-radius: 16px; cursor: pointer; transition: all 0.2s; }
                .setting-item:hover { background: #f8fafc; }
                .si-left { display: flex; align-items: center; gap: 1rem; }
                .si-icon { width: 40px; height: 40px; border-radius: 12px; display: flex; align-items: center; justify-content: center; }
                .si-text { display: flex; flex-direction: column; }
                .si-label { font-size: 0.95rem; font-weight: 700; color: #1e293b; }
                .si-value { font-size: 0.75rem; color: #94a3b8; font-weight: 600; }
                .si-arrow { color: #cbd5e1; }

                .footer-actions { display: flex; flex-direction: column; gap: 1.5rem; }
                .support-card { display: flex; justify-content: space-between; align-items: center; padding: 1.25rem; border-radius: 20px; background: white; border: none; cursor: pointer; text-align: left; width: 100%; color: var(--text-main); }
                .sc-left { display: flex; align-items: center; gap: 1rem; font-weight: 700; }
                
                .logout-btn-full { display: flex; align-items: center; justify-content: center; gap: 0.75rem; padding: 1.25rem; border-radius: 20px; background: #fff1f2; border: 1px solid #ffe4e6; color: #e11d48; font-weight: 800; font-size: 1rem; cursor: pointer; transition: all 0.2s; }
                .logout-btn-full:hover { background: #ffe4e6; transform: translateY(-2px); }

                .app-version { text-align: center; font-size: 0.7rem; font-weight: 700; color: #cbd5e1; text-transform: uppercase; letter-spacing: 1px; margin-top: 1rem; }

                @media (max-width: 640px) {
                    .identity-card { flex-direction: column; text-align: center; padding: 2.5rem 1.5rem; }
                    .user-meta-row { justify-content: center; }
                }
            `}</style>
        </div>
    );
};

export default ProfilePage;
