import React, { useState, useEffect } from 'react';
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
    ChevronLeft,
    X,
    Eye,
    EyeOff,
    Loader2,
    RefreshCw,
    Database,
    SmartphoneIcon,
    Trash2,
    Camera,
    Check,
    AlertTriangle,
    ShieldAlert,
    Save,
    Printer,
    Plus
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useSync } from '../context/SyncContext';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { authService, shopService, supportService } from '../services/api';
import { db } from '../services/offlineDB';
import PrintFormatSelector from '../components/PrintFormatSelector';

const ProfilePage = () => {
    const { user, logout, setUser } = useAuth();
    const { showToast } = useToast();
    const { isOnline, pendingCount, isSyncing, triggerSync } = useSync();
    const navigate = useNavigate();

    // Modal Control State
    const [activeModal, setActiveModal] = useState(null); // 'personal' | 'security' | 'privacy' | 'subscription' | 'business' | 'notifications' | 'app' | 'support'
    
    // Shared Form States
    const [isLoading, setIsLoading] = useState(false);
    const [shops, setShops] = useState([]);

    // Personal Info State
    const [personalForm, setPersonalForm] = useState({
        name: '',
        email: '',
        phone: '',
        avatar: ''
    });

    // Password State
    const [passwordForm, setPasswordForm] = useState({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
    });
    const [showPass, setShowPass] = useState({ current: false, new: false, confirm: false });

    // Sessions State
    const [sessions, setSessions] = useState([]);

    // Data & Privacy Info
    const [exportShopId, setExportShopId] = useState('');
    const [dbCounts, setDbCounts] = useState({
        products: 0,
        sales: 0,
        khata: 0,
        purchases: 0,
        governmentSales: 0
    });

    // Business Profile Edit States
    const [selectedShopId, setSelectedShopId] = useState('');
    const [shopForm, setShopForm] = useState({
        name: '',
        ownerName: '',
        gstNumber: '',
        location: '',
        contactNumber: '',
        fertilizerLicense: '',
        fertilizerLicenses: [],
        logo: '',
        defaultPrintFormat: 'full_a4'
    });

    // Local Preferences: Notifications
    const [notifPreferences, setNotifPreferences] = useState({
        salesAlerts: true,
        khataAlerts: true,
        lowStockAlerts: true,
        syncNotifications: true
    });

    // Local Preferences: App Settings
    const [appPreferences, setAppPreferences] = useState({
        darkMode: false,
        language: 'English',
        currency: '₹',
        printerSize: '3 inch',
        billFormat: 'Standard',
        offlineMode: 'Auto'
    });

    // Support Form State
    const [supportForm, setSupportForm] = useState({
        shopId: '',
        type: 'Bug', // 'Bug' | 'Feature'
        title: '',
        description: '',
        priority: 'Medium'
    });

    // Initialize/Sync Preferences & Shops
    useEffect(() => {
        // Load notification preferences
        const savedNotif = localStorage.getItem('notification_preferences');
        if (savedNotif) {
            try {
                setNotifPreferences(JSON.parse(savedNotif));
            } catch (e) {
                console.error(e);
            }
        }

        // Load app preferences
        const savedApp = localStorage.getItem('app_preferences');
        if (savedApp) {
            try {
                const parsed = JSON.parse(savedApp);
                setAppPreferences(parsed);
                // Apply Dark Mode if saved
                if (parsed.darkMode) {
                    document.body.classList.add('dark-mode');
                } else {
                    document.body.classList.remove('dark-mode');
                }
            } catch (e) {
                console.error(e);
            }
        }

        fetchShopsList();
        loadLocalDbCounts();
    }, []);

    // Load user values when user context is ready
    useEffect(() => {
        if (user) {
            setPersonalForm({
                name: user.name || '',
                email: user.email || '',
                phone: user.phone || '',
                avatar: user.avatar || ''
            });
        }
    }, [user]);

    const fetchShopsList = async () => {
        try {
            const res = await shopService.getAll();
            if (res.data && res.data.success) {
                const fetchedShops = res.data.data || [];
                setShops(fetchedShops);
                if (fetchedShops.length > 0) {
                    setExportShopId(fetchedShops[0]._id);
                    setSupportForm(prev => ({ ...prev, shopId: fetchedShops[0]._id }));
                    handleSelectShopForEdit(fetchedShops[0]._id, fetchedShops);
                }
            }
        } catch (e) {
            console.error('Failed to fetch shops:', e);
        }
    };

    const handleSelectShopForEdit = (shopId, list = shops) => {
        setSelectedShopId(shopId);
        const target = list.find(s => s._id === shopId);
        if (target) {
            let licList = [];
            if (Array.isArray(target.fertilizerLicenses) && target.fertilizerLicenses.length > 0) {
                licList = target.fertilizerLicenses.map(l => ({
                    licenseType: l.licenseType || 'LAID',
                    licenseNumber: l.licenseNumber || ''
                }));
            } else if (target.fertilizerLicense && typeof target.fertilizerLicense === 'string' && target.fertilizerLicense.trim()) {
                const legacyStr = target.fertilizerLicense.trim();
                let type = 'LAID';
                if (legacyStr.startsWith('LAFD')) type = 'LAFD';
                else if (legacyStr.startsWith('LASD')) type = 'LASD';
                licList = [{ licenseType: type, licenseNumber: legacyStr }];
            }

            setShopForm({
                name: target.name || '',
                ownerName: target.ownerName || '',
                gstNumber: target.gstNumber || '',
                location: target.location || '',
                contactNumber: target.contactNumber || '',
                fertilizerLicense: target.fertilizerLicense || '',
                fertilizerLicenses: licList,
                logo: target.logo || '',
                defaultPrintFormat: target.defaultPrintFormat || 'full_a4'
            });
        }
    };

    const handleAddFertilizerLicense = () => {
        const currentTypes = (shopForm.fertilizerLicenses || []).map(l => l.licenseType);
        const availableTypes = ['LAID', 'LAFD', 'LASD'].filter(t => !currentTypes.includes(t));
        if (availableTypes.length === 0) {
            showToast('All 3 licence types (LAID, LAFD, LASD) are already added', 'info');
            return;
        }
        setShopForm(prev => ({
            ...prev,
            fertilizerLicenses: [
                ...(prev.fertilizerLicenses || []),
                { licenseType: availableTypes[0], licenseNumber: '' }
            ]
        }));
    };

    const handleUpdateFertilizerLicense = (index, field, value) => {
        setShopForm(prev => {
            const updated = [...(prev.fertilizerLicenses || [])];
            if (updated[index]) {
                updated[index] = { ...updated[index], [field]: value };
            }
            return { ...prev, fertilizerLicenses: updated };
        });
    };

    const handleRemoveFertilizerLicense = (index) => {
        setShopForm(prev => ({
            ...prev,
            fertilizerLicenses: (prev.fertilizerLicenses || []).filter((_, i) => i !== index)
        }));
    };

    const loadLocalDbCounts = async () => {
        try {
            const products = await db.products.count();
            const sales = await db.sales.count();
            const khata = await db.khata.count();
            const purchases = await db.purchases.count();
            const governmentSales = await db.governmentSales.count();
            setDbCounts({ products, sales, khata, purchases, governmentSales });
        } catch (e) {
            console.error('Dexie counts error:', e);
        }
    };

    const fetchSessions = async () => {
        setIsLoading(true);
        try {
            const res = await authService.getSessions();
            if (res.data && res.data.success) {
                setSessions(res.data.data);
            }
        } catch (e) {
            showToast(e.response?.data?.message || 'Failed to load device logs', 'error');
        } finally {
            setIsLoading(false);
        }
    };

    // Form Submissions
    const handleSaveProfile = async (e) => {
        e.preventDefault();
        if (isLoading) return;
        setIsLoading(true);
        try {
            const res = await authService.updateProfile(personalForm);
            if (res.data && res.data.success) {
                setUser(res.data.data);
                showToast('Profile updated successfully', 'success');
                setActiveModal(null);
            }
        } catch (error) {
            showToast(error.response?.data?.message || 'Profile update failed', 'error');
        } finally {
            setIsLoading(false);
        }
    };

    const handleChangePassword = async (e) => {
        e.preventDefault();
        if (isLoading) return;
        if (passwordForm.newPassword !== passwordForm.confirmPassword) {
            showToast('New passwords do not match', 'error');
            return;
        }
        if (passwordForm.newPassword.length < 6) {
            showToast('Password must be at least 6 characters', 'error');
            return;
        }
        setIsLoading(true);
        try {
            await authService.changePassword({
                currentPassword: passwordForm.currentPassword,
                newPassword: passwordForm.newPassword
            });
            showToast('Password updated successfully', 'success');
            setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
            setActiveModal(null);
        } catch (error) {
            showToast(error.response?.data?.message || 'Password change failed', 'error');
        } finally {
            setIsLoading(false);
        }
    };

    const handleRevokeSession = async (sessionId) => {
        if (isLoading) return;
        setIsLoading(true);
        try {
            await authService.deleteSession(sessionId);
            showToast('Device session revoked', 'success');
            // Refresh list
            const res = await authService.getSessions();
            if (res.data && res.data.success) {
                setSessions(res.data.data);
            }
        } catch (error) {
            showToast(error.response?.data?.message || 'Failed to revoke session', 'error');
        } finally {
            setIsLoading(false);
        }
    };

    const handleRevokeAllOtherSessions = async () => {
        if (isLoading) return;
        setIsLoading(true);
        try {
            await authService.deleteAllSessions();
            showToast('All other device sessions revoked', 'success');
            // Refresh list
            const res = await authService.getSessions();
            if (res.data && res.data.success) {
                setSessions(res.data.data);
            }
        } catch (error) {
            showToast(error.response?.data?.message || 'Failed to revoke sessions', 'error');
        } finally {
            setIsLoading(false);
        }
    };

    const handleExportBackup = async () => {
        if (!exportShopId) {
            showToast('Please select a shop to export', 'error');
            return;
        }
        setIsLoading(true);
        try {
            const res = await shopService.exportData(exportShopId);
            if (res.data && res.data.success) {
                const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(res.data.data, null, 2));
                const downloadAnchor = document.createElement('a');
                downloadAnchor.setAttribute("href", dataStr);
                const filename = `shoppulse-backup-${res.data.data.shopName.replace(/\s+/g, '-').toLowerCase()}-${new Date().toISOString().split('T')[0]}.json`;
                downloadAnchor.setAttribute("download", filename);
                document.body.appendChild(downloadAnchor);
                downloadAnchor.click();
                downloadAnchor.remove();
                showToast('Shop data backup downloaded successfully', 'success');
            }
        } catch (error) {
            showToast(error.response?.data?.message || 'Backup failed', 'error');
        } finally {
            setIsLoading(false);
        }
    };

    const handleClearLocalCache = async () => {
        if (pendingCount > 0) {
            const confirmClear = window.confirm(`WARNING: You have ${pendingCount} offline changes pending synchronization. Clearing local cache now will result in permanent loss of this data. Do you still want to proceed?`);
            if (!confirmClear) return;
        } else {
            const confirmClear = window.confirm('Are you sure you want to clear the local IndexedDB cache and reload the application? This will fetch all data fresh from the cloud.');
            if (!confirmClear) return;
        }

        setIsLoading(true);
        try {
            await db.products.clear();
            await db.sales.clear();
            await db.khata.clear();
            await db.governmentSales.clear();
            await db.purchases.clear();
            await db.inventoryHistory.clear();
            await db.shops.clear();
            await db.queryCache.clear();
            
            showToast('Local cache cleared successfully. Reloading...', 'success');
            setTimeout(() => {
                window.location.reload();
            }, 1000);
        } catch (e) {
            showToast('Failed to clear IndexedDB cache', 'error');
            setIsLoading(false);
        }
    };

    const handleSaveShopDetails = async (e) => {
        e.preventDefault();
        if (isLoading || !selectedShopId) return;

        // Validation for fertilizer shops
        const currentShop = shops.find(s => s._id === selectedShopId);
        const isFertilizer = Boolean(
            currentShop?.type === 'Fertilizers' ||
            (currentShop?.type && currentShop.type.toLowerCase().includes('fertilizer'))
        );

        if (isFertilizer && shopForm.fertilizerLicenses && shopForm.fertilizerLicenses.length > 0) {
            const seenTypes = new Set();
            for (let i = 0; i < shopForm.fertilizerLicenses.length; i++) {
                const lic = shopForm.fertilizerLicenses[i];
                const type = (lic.licenseType || '').trim().toUpperCase();
                const num = (lic.licenseNumber || '').trim();

                if (!type) {
                    showToast(`Please select a valid licence type for row #${i + 1}`, 'error');
                    return;
                }
                if (!num) {
                    showToast(`Licence number is mandatory for ${type}`, 'error');
                    return;
                }
                if (seenTypes.has(type)) {
                    showToast(`Duplicate licence type: ${type}. Each licence type can only be added once.`, 'error');
                    return;
                }
                seenTypes.add(type);
            }
        }

        setIsLoading(true);
        try {
            const res = await shopService.update(selectedShopId, shopForm);
            if (res.data && res.data.success) {
                showToast('Business profile updated successfully', 'success');
                // Refresh list
                await fetchShopsList();
                setActiveModal(null);
            }
        } catch (error) {
            showToast(error.response?.data?.message || 'Failed to update shop details', 'error');
        } finally {
            setIsLoading(false);
        }
    };

    const handleSaveNotifications = (e) => {
        e.preventDefault();
        localStorage.setItem('notification_preferences', JSON.stringify(notifPreferences));
        showToast('Notification preferences saved locally', 'success');
        setActiveModal(null);
    };

    const handleSaveAppSettings = (e) => {
        e.preventDefault();
        localStorage.setItem('app_preferences', JSON.stringify(appPreferences));
        
        // Apply Dark Mode Class
        if (appPreferences.darkMode) {
            document.body.classList.add('dark-mode');
        } else {
            document.body.classList.remove('dark-mode');
        }

        showToast('App settings saved locally', 'success');
        setActiveModal(null);
    };

    const handleSubmitSupportTicket = async (e) => {
        e.preventDefault();
        if (isLoading) return;
        if (!supportForm.title || !supportForm.description) {
            showToast('Please fill in all support details', 'error');
            return;
        }
        setIsLoading(true);
        try {
            await supportService.createTicket({
                shopId: supportForm.shopId,
                title: `[${supportForm.type}] ${supportForm.title}`,
                description: supportForm.description,
                priority: supportForm.priority
            });
            showToast('Support ticket submitted successfully', 'success');
            setSupportForm(prev => ({ ...prev, title: '', description: '' }));
            setActiveModal(null);
        } catch (error) {
            showToast(error.response?.data?.message || 'Support ticket submission failed', 'error');
        } finally {
            setIsLoading(false);
        }
    };

    // Utility Base64 convertor for uploads
    const handleFileChange = (e, targetSetter) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                targetSetter(prev => ({ ...prev, [e.target.name]: reader.result }));
            };
            reader.readAsDataURL(file);
        }
    };

    // Setting group definitions dynamically mapping clicks
    const settingGroups = [
        {
            title: 'Account Settings',
            items: [
                { icon: <User size={20} />, label: 'Personal Information', value: 'Name, Email, Phone', color: '#2563eb', action: () => setActiveModal('personal') },
                { icon: <Lock size={20} />, label: 'Login & Security', value: 'Password, Sessions', color: '#7c3aed', action: () => { setActiveModal('security'); fetchSessions(); } },
                { icon: <Shield size={20} />, label: 'Data & Privacy', value: 'Backups, Database Info', color: '#059669', action: () => { setActiveModal('privacy'); loadLocalDbCounts(); } },
            ]
        },
        {
            title: 'Business & Payments',
            items: [
                { icon: <CreditCard size={20} />, label: 'Subscription Plan', value: 'License, Billing Dates', color: '#ea580c', action: () => setActiveModal('subscription') },
                { icon: <Globe size={20} />, label: 'Business Profile', value: 'GST, License, Logo', color: '#2563eb', action: () => { setActiveModal('business'); fetchShopsList(); } },
                { icon: <Printer size={20} />, label: 'Bill Print Settings', value: 'A4, Half-A4, Thermal 58/80mm', color: '#0284c7', action: () => { setActiveModal('bill_print'); fetchShopsList(); } },
            ]
        },
        {
            title: 'Preferences',
            items: [
                { icon: <Bell size={20} />, label: 'Notifications', value: 'System alerts local settings', color: '#f59e0b', action: () => setActiveModal('notifications') },
                { icon: <Smartphone size={20} />, label: 'App Settings', value: 'Dark theme, printers, currency', color: '#64748b', action: () => setActiveModal('app') },
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
                        {user?.phone && (
                            <div className="user-meta-row">
                                <Smartphone size={14} />
                                <span>{user.phone}</span>
                            </div>
                        )}
                        <div className="badge-premium">PREMIUM MEMBER</div>
                    </div>
                </motion.div>
            </section>

            {/* Hidden Admin Section widgets if user.role === 'admin' */}
            {user?.role === 'admin' && (
                <section className="settings-section">
                    <div className="settings-group">
                        <h3 className="group-title" style={{ color: '#e11d48' }}>Super Admin Panel</h3>
                        <div className="card admin-control-card" onClick={() => navigate('/admin')}>
                            <div className="si-left">
                                <div className="si-icon" style={{ color: '#e11d48', background: `#e11d4815` }}>
                                    <ShieldAlert size={20} />
                                </div>
                                <div className="si-text">
                                    <span className="si-label" style={{ color: '#9f1239' }}>Launch Admin Dashboard</span>
                                    <span className="si-value">Manage client shops, track subscription billing, suspend/expire shop accounts, delete shops</span>
                                </div>
                            </div>
                            <ChevronRight size={20} className="si-arrow" style={{ color: '#e11d48' }} />
                        </div>
                    </div>
                </section>
            )}

            {/* Settings Groups */}
            <section className="settings-section">
                {settingGroups.map((group, gIdx) => (
                    <div key={gIdx} className="settings-group">
                        <h3 className="group-title">{group.title}</h3>
                        <div className="card group-card">
                            {group.items.map((item, iIdx) => (
                                <div key={iIdx} className="setting-item" onClick={item.action}>
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
                <button className="card support-card" onClick={() => setActiveModal('support')}>
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

            {/* FULLSCREEN POPUP MODALS SYSTEM */}
            <AnimatePresence>
                {activeModal && (
                    <div className="modal-overlay-v2">
                        <motion.div 
                            className="modal-backdrop-v2"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setActiveModal(null)}
                        />
                        <motion.div 
                            className="modal-container-v2"
                            initial={{ y: 50, opacity: 0, scale: 0.95 }}
                            animate={{ y: 0, opacity: 1, scale: 1 }}
                            exit={{ y: 50, opacity: 0, scale: 0.95 }}
                            transition={{ type: 'spring', damping: 25, stiffness: 250 }}
                        >
                            {/* Modal Header */}
                            <div className="modal-header-v2">
                                <h2>
                                    {activeModal === 'personal' && 'Personal Information'}
                                    {activeModal === 'security' && 'Login & Security'}
                                    {activeModal === 'privacy' && 'Data & Privacy'}
                                    {activeModal === 'subscription' && 'Subscription Plan'}
                                    {activeModal === 'business' && 'Business Profile'}
                                    {activeModal === 'bill_print' && 'Bill Print Settings'}
                                    {activeModal === 'notifications' && 'Notifications'}
                                    {activeModal === 'app' && 'App Settings'}
                                    {activeModal === 'support' && 'Support & Feedback'}
                                </h2>
                                <button className="modal-close-btn-v2" onClick={() => setActiveModal(null)}>
                                    <X size={20} />
                                </button>
                            </div>

                            {/* Modal Body */}
                            <div className="modal-body-v2">
                                {isLoading && (
                                    <div className="modal-loading-cover">
                                        <Loader2 size={36} className="animate-spin" />
                                        <span>Saving changes...</span>
                                    </div>
                                )}

                                {/* PERSONAL INFORMATION */}
                                {activeModal === 'personal' && (
                                    <form onSubmit={handleSaveProfile} className="form-layout">
                                        <div className="avatar-upload-section">
                                            <div className="avatar-upload-preview">
                                                {personalForm.avatar ? (
                                                    <img src={personalForm.avatar} alt="Avatar Preview" />
                                                ) : (
                                                    <span>{personalForm.name?.charAt(0).toUpperCase()}</span>
                                                )}
                                                <label htmlFor="avatar-file-input" className="avatar-edit-overlay">
                                                    <Camera size={18} />
                                                    <input 
                                                        type="file" 
                                                        id="avatar-file-input" 
                                                        name="avatar" 
                                                        accept="image/*"
                                                        onChange={(e) => handleFileChange(e, setPersonalForm)} 
                                                        style={{ display: 'none' }} 
                                                    />
                                                </label>
                                            </div>
                                            <span className="avatar-hint">Click image to upload custom profile avatar</span>
                                        </div>

                                        <div className="input-group-v2">
                                            <label>Full Name</label>
                                            <input 
                                                type="text" 
                                                value={personalForm.name} 
                                                onChange={(e) => setPersonalForm({ ...personalForm, name: e.target.value })}
                                                required 
                                                className="input-control" 
                                            />
                                        </div>

                                        <div className="input-group-v2">
                                            <label>Email Address</label>
                                            <input 
                                                type="email" 
                                                value={personalForm.email} 
                                                onChange={(e) => setPersonalForm({ ...personalForm, email: e.target.value })}
                                                required 
                                                className="input-control" 
                                            />
                                        </div>

                                        <div className="input-group-v2">
                                            <label>Phone Number</label>
                                            <input 
                                                type="text" 
                                                placeholder="Enter phone number"
                                                value={personalForm.phone} 
                                                onChange={(e) => setPersonalForm({ ...personalForm, phone: e.target.value })}
                                                className="input-control" 
                                            />
                                        </div>

                                        <div className="modal-footer-v2">
                                            <button type="button" className="btn-secondary-outline" onClick={() => setActiveModal(null)}>Cancel</button>
                                            <button type="submit" disabled={isLoading} className="btn-primary-premium">
                                                <Save size={16} /> Save Changes
                                            </button>
                                        </div>
                                    </form>
                                )}

                                {/* LOGIN & SECURITY */}
                                {activeModal === 'security' && (
                                    <div className="sub-sections">
                                        {/* Change Password form */}
                                        <div className="sub-section-card">
                                            <h3>Change Password</h3>
                                            <form onSubmit={handleChangePassword} className="form-layout">
                                                <div className="input-group-v2">
                                                    <label>Current Password</label>
                                                    <div className="password-input-wrap">
                                                        <input 
                                                            type={showPass.current ? 'text' : 'password'} 
                                                            value={passwordForm.currentPassword}
                                                            onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
                                                            required 
                                                            className="input-control" 
                                                        />
                                                        <button type="button" onClick={() => setShowPass({ ...showPass, current: !showPass.current })}>
                                                            {showPass.current ? <EyeOff size={16} /> : <Eye size={16} />}
                                                        </button>
                                                    </div>
                                                </div>

                                                <div className="input-group-v2">
                                                    <label>New Password</label>
                                                    <div className="password-input-wrap">
                                                        <input 
                                                            type={showPass.new ? 'text' : 'password'} 
                                                            value={passwordForm.newPassword}
                                                            onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                                                            required 
                                                            className="input-control" 
                                                        />
                                                        <button type="button" onClick={() => setShowPass({ ...showPass, new: !showPass.new })}>
                                                            {showPass.new ? <EyeOff size={16} /> : <Eye size={16} />}
                                                        </button>
                                                    </div>
                                                </div>

                                                <div className="input-group-v2">
                                                    <label>Confirm New Password</label>
                                                    <div className="password-input-wrap">
                                                        <input 
                                                            type={showPass.confirm ? 'text' : 'password'} 
                                                            value={passwordForm.confirmPassword}
                                                            onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                                                            required 
                                                            className="input-control" 
                                                        />
                                                        <button type="button" onClick={() => setShowPass({ ...showPass, confirm: !showPass.confirm })}>
                                                            {showPass.confirm ? <EyeOff size={16} /> : <Eye size={16} />}
                                                        </button>
                                                    </div>
                                                </div>

                                                <button type="submit" disabled={isLoading} className="btn-primary-premium" style={{ width: 'fit-content' }}>
                                                    Update Password
                                                </button>
                                            </form>
                                        </div>

                                        {/* Mobile Verification */}
                                        <div className="sub-section-card">
                                            <div className="card-header-v2">
                                                <h3>Mobile Verification</h3>
                                                <span className="badge-coming-soon">Coming Soon</span>
                                            </div>
                                            <p className="card-desc-v2">Secure your login by verifying your primary contact number. Receive OTP notifications.</p>
                                        </div>

                                        {/* 2FA */}
                                        <div className="sub-section-card">
                                            <div className="card-header-v2">
                                                <h3>Two-Factor Authentication (2FA)</h3>
                                                <span className="badge-coming-soon">Coming Soon</span>
                                            </div>
                                            <p className="card-desc-v2">Require an authentication code from a 2FA mobile app before signing in.</p>
                                        </div>

                                        {/* Sessions List */}
                                        <div className="sub-section-card">
                                            <div className="card-header-v2">
                                                <h3>Active Login Sessions</h3>
                                                <button onClick={handleRevokeAllOtherSessions} className="btn-text-link" style={{ color: '#ef4444' }}>
                                                    Revoke All Other Devices
                                                </button>
                                            </div>
                                            
                                            <div className="sessions-list">
                                                {sessions.map((sess, idx) => (
                                                    <div key={idx} className="session-item-row">
                                                        <div className="session-info-left">
                                                            <SmartphoneIcon size={20} className="session-icon" />
                                                            <div className="session-text">
                                                                <strong>{sess.deviceName}</strong>
                                                                <span>IP: {sess.ipAddress} • OS: {sess.os}</span>
                                                                <span className="session-meta">Last active: {new Date(sess.lastLogin).toLocaleString()} • App Version: {sess.appVersion}</span>
                                                            </div>
                                                        </div>
                                                        <button 
                                                            onClick={() => handleRevokeSession(sess._id)}
                                                            className="btn-session-revoke"
                                                            title="Revoke session"
                                                        >
                                                            <Trash2 size={16} />
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* DATA & PRIVACY */}
                                {activeModal === 'privacy' && (
                                    <div className="sub-sections">
                                        {/* Export Data */}
                                        <div className="sub-section-card">
                                            <h3>Export Shop Data Backup</h3>
                                            <p className="card-desc-v2">Download a copy of your entire ledger, products, purchases, sales history locally in JSON format.</p>
                                            
                                            <div className="export-controls" style={{ display: 'flex', gap: '12px', marginTop: '12px', alignItems: 'center' }}>
                                                <select 
                                                    value={exportShopId}
                                                    onChange={(e) => setExportShopId(e.target.value)}
                                                    className="input-control"
                                                    style={{ flex: 1, height: '48px' }}
                                                >
                                                    {shops.map((s) => (
                                                        <option key={s._id} value={s._id}>{s.name}</option>
                                                    ))}
                                                </select>
                                                
                                                <button 
                                                    type="button" 
                                                    onClick={handleExportBackup} 
                                                    disabled={isLoading || !exportShopId}
                                                    className="btn-primary-premium"
                                                    style={{ height: '48px', padding: '0 24px' }}
                                                >
                                                    Export Backup JSON
                                                </button>
                                            </div>
                                        </div>

                                        {/* Clear Cache */}
                                        <div className="sub-section-card">
                                            <h3>Offline Database Cache</h3>
                                            <p className="card-desc-v2">Your browser saves product list and sales history in an offline database for rapid load. If you experience inconsistencies, clear local cache.</p>
                                            
                                            <div className="offline-counts-row" style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '10px', margin: '16px 0' }}>
                                                <div className="db-count-card"><strong>{dbCounts.products}</strong><span>Products</span></div>
                                                <div className="db-count-card"><strong>{dbCounts.sales}</strong><span>Sales</span></div>
                                                <div className="db-count-card"><strong>{dbCounts.khata}</strong><span>Khata</span></div>
                                                <div className="db-count-card"><strong>{dbCounts.purchases}</strong><span>Purchases</span></div>
                                                <div className="db-count-card"><strong>{dbCounts.governmentSales}</strong><span>GST Sales</span></div>
                                            </div>

                                            <div style={{ display: 'flex', gap: '12px' }}>
                                                <button 
                                                    onClick={handleClearLocalCache}
                                                    className="btn-secondary-outline"
                                                    style={{ borderColor: '#ef4444', color: '#ef4444', height: '44px' }}
                                                >
                                                    Clear Local Cache Database
                                                </button>
                                            </div>
                                        </div>

                                        {/* Sync / Backup Status */}
                                        <div className="sub-section-card">
                                            <h3>Cloud Sync Status</h3>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '12px' }}>
                                                <div className="sync-status-pill green">
                                                    <Check size={14} />
                                                    <span>Cloud Sync Active</span>
                                                </div>
                                                <span className="last-sync-lbl">Synced recently. Offline changes pending: {pendingCount}</span>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* SUBSCRIPTION PLAN */}
                                {activeModal === 'subscription' && (
                                    <div className="sub-sections">
                                        {shops.map((shop, sIdx) => {
                                            const sub = shop.subscription || {};
                                            const isYearly = sub.planType === 'Yearly';
                                            const endDate = sub.planEndDate ? new Date(sub.planEndDate) : null;
                                            
                                            // 30 days reminder
                                            const showReminder = isYearly && endDate && (endDate - new Date()) < (30 * 24 * 60 * 60 * 1000);

                                            return (
                                                <div key={sIdx} className="sub-section-card subscription-card-v2">
                                                    <div className="sub-header-v2">
                                                        <h3>{shop.name} Plan</h3>
                                                        <span className={`plan-badge ${sub.planType?.toLowerCase()}`}>
                                                            {sub.planType || 'Trial'}
                                                        </span>
                                                    </div>

                                                    {showReminder && (
                                                        <div className="reminder-banner">
                                                            <AlertTriangle size={18} />
                                                            <span>Your yearly subscription is expiring soon on {endDate.toLocaleDateString()}. Please contact support to renew.</span>
                                                        </div>
                                                    )}

                                                    <div className="sub-details-grid">
                                                        <div><label>Plan Type</label><span>{sub.isLifetime ? 'Lifetime License' : `${sub.planType || 'Trial'} membership`}</span></div>
                                                        <div><label>Status</label><span style={{ color: sub.subscriptionStatus === 'Active' ? '#10B981' : '#EF4444', fontWeight: 800 }}>{sub.subscriptionStatus || 'Active'}</span></div>
                                                        <div><label>Activation Date</label><span>{sub.planStartDate ? new Date(sub.planStartDate).toLocaleDateString() : 'N/A'}</span></div>
                                                        <div><label>Renewal / Expire Date</label><span>{sub.planEndDate ? new Date(sub.planEndDate).toLocaleDateString() : 'N/A'}</span></div>
                                                        <div><label>Active Devices</label><span>{sessions.length || 1} Device logins</span></div>
                                                        <div><label>License Status</label><span>Verified & Licensed</span></div>
                                                    </div>

                                                    <div className="sub-footer-actions">
                                                        <button 
                                                            onClick={() => {
                                                                setActiveModal('support');
                                                                setSupportForm(prev => ({ ...prev, shopId: shop._id, type: 'Feature', title: 'Plan Upgrade / Renewal Request', description: 'Please upgrade my subscription plan.' }));
                                                            }}
                                                            className="btn-primary-premium"
                                                        >
                                                            Contact Support
                                                        </button>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}

                                {/* BUSINESS PROFILE */}
                                {activeModal === 'business' && (
                                    <div className="sub-sections">
                                        <div className="input-group-v2">
                                            <label>Select Business Shop</label>
                                            <select 
                                                value={selectedShopId}
                                                onChange={(e) => handleSelectShopForEdit(e.target.value)}
                                                className="input-control"
                                            >
                                                {shops.map((s) => (
                                                    <option key={s._id} value={s._id}>{s.name}</option>
                                                ))}
                                            </select>
                                        </div>

                                        {selectedShopId && (
                                            <form onSubmit={handleSaveShopDetails} className="form-layout" style={{ marginTop: '1rem' }}>
                                                {/* Logo upload */}
                                                <div className="avatar-upload-section">
                                                    <div className="avatar-upload-preview" style={{ borderRadius: '16px', width: '120px', height: '80px' }}>
                                                        {shopForm.logo ? (
                                                            <img src={shopForm.logo} alt="Shop Logo Preview" style={{ objectFit: 'contain' }} />
                                                        ) : (
                                                            <span style={{ fontSize: '0.9rem', fontWeight: 800 }}>No Logo</span>
                                                        )}
                                                        <label htmlFor="logo-file-input" className="avatar-edit-overlay">
                                                            <Camera size={18} />
                                                            <input 
                                                                type="file" 
                                                                id="logo-file-input" 
                                                                name="logo" 
                                                                accept="image/*"
                                                                onChange={(e) => handleFileChange(e, setShopForm)} 
                                                                style={{ display: 'none' }} 
                                                            />
                                                        </label>
                                                    </div>
                                                    <span className="avatar-hint">Click image to upload custom store logo</span>
                                                </div>

                                                <div className="input-group-v2">
                                                    <label>Shop Name</label>
                                                    <input 
                                                        type="text" 
                                                        value={shopForm.name} 
                                                        onChange={(e) => setShopForm({ ...shopForm, name: e.target.value })}
                                                        required 
                                                        className="input-control" 
                                                    />
                                                </div>

                                                <div className="input-group-v2">
                                                    <label>Owner Name</label>
                                                    <input 
                                                        type="text" 
                                                        value={shopForm.ownerName} 
                                                        onChange={(e) => setShopForm({ ...shopForm, ownerName: e.target.value })}
                                                        className="input-control" 
                                                    />
                                                </div>

                                                <div className="input-group-v2">
                                                    <label>GST Number</label>
                                                    <input 
                                                        type="text" 
                                                        value={shopForm.gstNumber} 
                                                        onChange={(e) => setShopForm({ ...shopForm, gstNumber: e.target.value })}
                                                        className="input-control" 
                                                    />
                                                </div>

                                                {/* Fertilizer Licences Section - Only for Fertilizer Shops */}
                                                {(() => {
                                                    const curShop = shops.find(s => s._id === selectedShopId);
                                                    const isFertilizer = Boolean(
                                                        curShop?.type === 'Fertilizers' ||
                                                        (curShop?.type && curShop.type.toLowerCase().includes('fertilizer'))
                                                    );

                                                    if (!isFertilizer) return null;

                                                    return (
                                                        <div className="fertilizer-licenses-section">
                                                            <div className="fl-header-row">
                                                                <div>
                                                                    <h4 className="fl-title">Fertilizer Licences</h4>
                                                                    <p className="fl-desc">Register statutory licences (LAID, LAFD, LASD) to display on customer bills.</p>
                                                                </div>
                                                                {(!shopForm.fertilizerLicenses || shopForm.fertilizerLicenses.length < 3) && (
                                                                    <button
                                                                        type="button"
                                                                        onClick={handleAddFertilizerLicense}
                                                                        className="fl-add-btn"
                                                                    >
                                                                        <Plus size={14} /> Add Licence
                                                                    </button>
                                                                )}
                                                            </div>

                                                            {(!shopForm.fertilizerLicenses || shopForm.fertilizerLicenses.length === 0) ? (
                                                                <div className="fl-empty-notice">
                                                                    <span>No fertilizer licences registered yet. Click <strong>+ Add Licence</strong> to register LAID, LAFD, or LASD.</span>
                                                                </div>
                                                            ) : (
                                                                <div className="fl-list">
                                                                    {shopForm.fertilizerLicenses.map((lic, idx) => {
                                                                        const otherTypes = shopForm.fertilizerLicenses
                                                                            .filter((_, i) => i !== idx)
                                                                            .map(l => l.licenseType);

                                                                        return (
                                                                            <div key={idx} className="fl-item-card">
                                                                                <div className="fl-field-type">
                                                                                    <label>Licence Type</label>
                                                                                    <select
                                                                                        value={lic.licenseType}
                                                                                        onChange={(e) => handleUpdateFertilizerLicense(idx, 'licenseType', e.target.value)}
                                                                                        className="input-control fl-type-select"
                                                                                    >
                                                                                        {['LAID', 'LAFD', 'LASD'].map(t => (
                                                                                            <option key={t} value={t} disabled={otherTypes.includes(t)}>
                                                                                                {t} {otherTypes.includes(t) ? '(Added)' : ''}
                                                                                            </option>
                                                                                        ))}
                                                                                    </select>
                                                                                </div>

                                                                                <div className="fl-field-num">
                                                                                    <label>Licence Number *</label>
                                                                                    <input
                                                                                        type="text"
                                                                                        placeholder={`e.g. ${lic.licenseType}/12345`}
                                                                                        value={lic.licenseNumber}
                                                                                        onChange={(e) => handleUpdateFertilizerLicense(idx, 'licenseNumber', e.target.value)}
                                                                                        className="input-control fl-num-input"
                                                                                        required
                                                                                    />
                                                                                </div>

                                                                                <button
                                                                                    type="button"
                                                                                    onClick={() => handleRemoveFertilizerLicense(idx)}
                                                                                    className="fl-remove-btn"
                                                                                    title="Remove licence"
                                                                                >
                                                                                    <Trash2 size={16} />
                                                                                </button>
                                                                            </div>
                                                                        );
                                                                    })}
                                                                </div>
                                                            )}
                                                        </div>
                                                    );
                                                })()}

                                                <div className="input-group-v2">
                                                    <label>Business Address</label>
                                                    <input 
                                                        type="text" 
                                                        value={shopForm.location} 
                                                        onChange={(e) => setShopForm({ ...shopForm, location: e.target.value })}
                                                        required 
                                                        className="input-control" 
                                                    />
                                                </div>

                                                <div className="input-group-v2">
                                                    <label>Store Phone Contact</label>
                                                    <input 
                                                        type="text" 
                                                        value={shopForm.contactNumber} 
                                                        onChange={(e) => setShopForm({ ...shopForm, contactNumber: e.target.value })}
                                                        required 
                                                        className="input-control" 
                                                    />
                                                </div>

                                                <div className="input-group-v2">
                                                    <label>Default Bill Print Format</label>
                                                    <PrintFormatSelector 
                                                        value={shopForm.defaultPrintFormat || 'full_a4'}
                                                        onChange={(newFormat) => setShopForm({ ...shopForm, defaultPrintFormat: newFormat })}
                                                        mode="select"
                                                        showPrinterTip={false}
                                                    />
                                                </div>

                                                <div className="modal-footer-v2">
                                                    <button type="button" className="btn-secondary-outline" onClick={() => setActiveModal(null)}>Cancel</button>
                                                    <button type="submit" disabled={isLoading} className="btn-primary-premium">
                                                        <Save size={16} /> Save Shop Profile
                                                    </button>
                                                </div>
                                            </form>
                                        )}
                                    </div>
                                )}

                                {/* BILL PRINT SETTINGS */}
                                {activeModal === 'bill_print' && (
                                    <div className="sub-sections">
                                        <div className="input-group-v2">
                                            <label>Select Business Shop</label>
                                            <select 
                                                value={selectedShopId}
                                                onChange={(e) => handleSelectShopForEdit(e.target.value)}
                                                className="input-control"
                                            >
                                                {shops.map((s) => (
                                                    <option key={s._id} value={s._id}>
                                                        {s.name} (Current: {s.defaultPrintFormat || 'full_a4'})
                                                    </option>
                                                ))}
                                            </select>
                                        </div>

                                        {selectedShopId && (
                                            <form onSubmit={handleSaveShopDetails} className="form-layout" style={{ marginTop: '1rem' }}>
                                                <div style={{ marginBottom: '8px' }}>
                                                    <label style={{ fontSize: '13px', fontWeight: 700, color: '#071b44', display: 'block', marginBottom: '4px' }}>
                                                        Select Default Print Format for {shopForm.name || 'Selected Shop'}
                                                    </label>
                                                    <p style={{ fontSize: '12px', color: '#64748b', margin: '0 0 14px' }}>
                                                        This default format is saved per shop and automatically applies when viewing bills, downloading PDFs, or printing across any browser or device.
                                                    </p>
                                                    <PrintFormatSelector 
                                                        value={shopForm.defaultPrintFormat || 'full_a4'}
                                                        onChange={(newFormat) => setShopForm({ ...shopForm, defaultPrintFormat: newFormat })}
                                                        savedDefault={shops.find(s => s._id === selectedShopId)?.defaultPrintFormat || 'full_a4'}
                                                        shopId={selectedShopId}
                                                        onShopUpdate={(updatedShop) => {
                                                            setShops(prev => prev.map(s => s._id === updatedShop._id ? updatedShop : s));
                                                            setShopForm(prev => ({ ...prev, defaultPrintFormat: updatedShop.defaultPrintFormat }));
                                                        }}
                                                        mode="cards"
                                                        showPrinterTip={true}
                                                    />
                                                </div>

                                                <div className="modal-footer-v2" style={{ marginTop: '1.25rem' }}>
                                                    <button type="button" className="btn-secondary-outline" onClick={() => setActiveModal(null)}>Cancel</button>
                                                    <button type="submit" disabled={isLoading} className="btn-primary-premium">
                                                        <Save size={16} /> Save Print Preference
                                                    </button>
                                                </div>
                                            </form>
                                        )}
                                    </div>
                                )}

                                {/* NOTIFICATIONS */}
                                {activeModal === 'notifications' && (
                                    <form onSubmit={handleSaveNotifications} className="form-layout">
                                        <div className="toggle-list">
                                            <div className="toggle-item-row">
                                                <div className="toggle-text">
                                                    <strong>Sales Alerts</strong>
                                                    <span>Receive notifications for invoices and products return</span>
                                                </div>
                                                <div 
                                                    className={`premium-toggle ${notifPreferences.salesAlerts ? 'active' : ''}`}
                                                    onClick={() => setNotifPreferences({ ...notifPreferences, salesAlerts: !notifPreferences.salesAlerts })}
                                                >
                                                    <div className="pt-switch"></div>
                                                </div>
                                            </div>

                                            <div className="toggle-item-row">
                                                <div className="toggle-text">
                                                    <strong>Khata Due Alerts</strong>
                                                    <span>Notify when customer khata ledger dues are exceeded</span>
                                                </div>
                                                <div 
                                                    className={`premium-toggle ${notifPreferences.khataAlerts ? 'active' : ''}`}
                                                    onClick={() => setNotifPreferences({ ...notifPreferences, khataAlerts: !notifPreferences.khataAlerts })}
                                                >
                                                    <div className="pt-switch"></div>
                                                </div>
                                            </div>

                                            <div className="toggle-item-row">
                                                <div className="toggle-text">
                                                    <strong>Low Stock Alerts</strong>
                                                    <span>Warn immediately when stock falls below safety limit</span>
                                                </div>
                                                <div 
                                                    className={`premium-toggle ${notifPreferences.lowStockAlerts ? 'active' : ''}`}
                                                    onClick={() => setNotifPreferences({ ...notifPreferences, lowStockAlerts: !notifPreferences.lowStockAlerts })}
                                                >
                                                    <div className="pt-switch"></div>
                                                </div>
                                            </div>

                                            <div className="toggle-item-row">
                                                <div className="toggle-text">
                                                    <strong>Sync Notifications</strong>
                                                    <span>Notify when database synchronization completes in background</span>
                                                </div>
                                                <div 
                                                    className={`premium-toggle ${notifPreferences.syncNotifications ? 'active' : ''}`}
                                                    onClick={() => setNotifPreferences({ ...notifPreferences, syncNotifications: !notifPreferences.syncNotifications })}
                                                >
                                                    <div className="pt-switch"></div>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="modal-footer-v2">
                                            <button type="button" className="btn-secondary-outline" onClick={() => setActiveModal(null)}>Cancel</button>
                                            <button type="submit" className="btn-primary-premium">Save Preferences</button>
                                        </div>
                                    </form>
                                )}

                                {/* APP SETTINGS */}
                                {activeModal === 'app' && (
                                    <form onSubmit={handleSaveAppSettings} className="form-layout">
                                        <div className="toggle-item-row" style={{ borderBottom: '1px solid #f1f5f9', paddingBottom: '16px' }}>
                                            <div className="toggle-text">
                                                <strong>Dark Mode</strong>
                                                <span>Switch color theme to night mode</span>
                                            </div>
                                            <div 
                                                className={`premium-toggle ${appPreferences.darkMode ? 'active' : ''}`}
                                                onClick={() => setAppPreferences({ ...appPreferences, darkMode: !appPreferences.darkMode })}
                                            >
                                                <div className="pt-switch"></div>
                                            </div>
                                        </div>

                                        <div className="input-group-v2">
                                            <label>Default Language</label>
                                            <select 
                                                value={appPreferences.language}
                                                onChange={(e) => setAppPreferences({ ...appPreferences, language: e.target.value })}
                                                className="input-control"
                                            >
                                                <option value="English">English</option>
                                                <option value="Hindi">Hindi (हिंदी)</option>
                                            </select>
                                        </div>

                                        <div className="input-group-v2">
                                            <label>Store Currency</label>
                                            <select 
                                                value={appPreferences.currency}
                                                onChange={(e) => setAppPreferences({ ...appPreferences, currency: e.target.value })}
                                                className="input-control"
                                            >
                                                <option value="₹">₹ INR Indian Rupee</option>
                                                <option value="$">$ USD US Dollar</option>
                                                <option value="€">€ EUR Euro</option>
                                            </select>
                                        </div>

                                        <div className="input-group-v2">
                                            <label>Printer Thermal Size</label>
                                            <select 
                                                value={appPreferences.printerSize}
                                                onChange={(e) => setAppPreferences({ ...appPreferences, printerSize: e.target.value })}
                                                className="input-control"
                                            >
                                                <option value="2 inch">2 inch (58mm)</option>
                                                <option value="3 inch">3 inch (80mm)</option>
                                                <option value="4 inch">4 inch (100mm)</option>
                                            </select>
                                        </div>

                                        <div className="input-group-v2">
                                            <label>Bill/Invoice Format</label>
                                            <select 
                                                value={appPreferences.billFormat}
                                                onChange={(e) => setAppPreferences({ ...appPreferences, billFormat: e.target.value })}
                                                className="input-control"
                                            >
                                                <option value="Standard">Standard Invoice</option>
                                                <option value="Thermal">Thermal Receipt</option>
                                                <option value="Detailed">Detailed GST Ledger Invoice</option>
                                            </select>
                                        </div>

                                        <div className="input-group-v2">
                                            <label>Offline Sync Mode</label>
                                            <select 
                                                value={appPreferences.offlineMode}
                                                onChange={(e) => setAppPreferences({ ...appPreferences, offlineMode: e.target.value })}
                                                className="input-control"
                                            >
                                                <option value="Auto">Auto Sync (Recommended)</option>
                                                <option value="Online Only">Strictly Cloud Only</option>
                                                <option value="Offline Only">Strictly Local Database</option>
                                            </select>
                                        </div>

                                        <div className="modal-footer-v2">
                                            <button type="button" className="btn-secondary-outline" onClick={() => setActiveModal(null)}>Cancel</button>
                                            <button type="submit" className="btn-primary-premium">Apply Settings</button>
                                        </div>
                                    </form>
                                )}

                                {/* SUPPORT & FEEDBACK */}
                                {activeModal === 'support' && (
                                    <div className="sub-sections">
                                        {/* Direct Contact */}
                                        <div className="support-quick-contact">
                                            <a href="https://wa.me/91789" target="_blank" rel="noreferrer" className="quick-btn whatsapp">
                                                <span>Chat on WhatsApp Support</span>
                                            </a>
                                            <a href="tel:+91789" className="quick-btn phone">
                                                <span>Call Customer Support Line</span>
                                            </a>
                                        </div>

                                        {/* Submit Ticket form */}
                                        <div className="sub-section-card" style={{ marginTop: '1rem' }}>
                                            <h3>Submit Support Ticket / Feature Request</h3>
                                            <form onSubmit={handleSubmitSupportTicket} className="form-layout" style={{ marginTop: '12px' }}>
                                                <div className="input-group-v2">
                                                    <label>Select Associated Store</label>
                                                    <select 
                                                        value={supportForm.shopId}
                                                        onChange={(e) => setSupportForm({ ...supportForm, shopId: e.target.value })}
                                                        className="input-control"
                                                        required
                                                    >
                                                        {shops.map((s) => (
                                                            <option key={s._id} value={s._id}>{s.name}</option>
                                                        ))}
                                                    </select>
                                                </div>

                                                <div className="input-group-v2">
                                                    <label>Ticket Type</label>
                                                    <select 
                                                        value={supportForm.type}
                                                        onChange={(e) => setSupportForm({ ...supportForm, type: e.target.value })}
                                                        className="input-control"
                                                    >
                                                        <option value="Bug">Report Bug / Glitch</option>
                                                        <option value="Feature">Feature Request</option>
                                                    </select>
                                                </div>

                                                <div className="input-group-v2">
                                                    <label>Subject Title</label>
                                                    <input 
                                                        type="text" 
                                                        placeholder="Provide brief issue heading"
                                                        value={supportForm.title} 
                                                        onChange={(e) => setSupportForm({ ...supportForm, title: e.target.value })}
                                                        required 
                                                        className="input-control" 
                                                    />
                                                </div>

                                                <div className="input-group-v2">
                                                    <label>Detailed Description</label>
                                                    <textarea 
                                                        placeholder="Explain the issue or describe the feature request in detail..."
                                                        value={supportForm.description} 
                                                        onChange={(e) => setSupportForm({ ...supportForm, description: e.target.value })}
                                                        required 
                                                        className="input-control" 
                                                        rows={4}
                                                        style={{ resize: 'none' }}
                                                    />
                                                </div>

                                                <div className="input-group-v2">
                                                    <label>Priority</label>
                                                    <select 
                                                        value={supportForm.priority}
                                                        onChange={(e) => setSupportForm({ ...supportForm, priority: e.target.value })}
                                                        className="input-control"
                                                    >
                                                        <option value="Low">Low</option>
                                                        <option value="Medium">Medium</option>
                                                        <option value="High">High</option>
                                                        <option value="Urgent">Urgent</option>
                                                    </select>
                                                </div>

                                                <div className="modal-footer-v2" style={{ padding: '0', marginTop: '1rem' }}>
                                                    <button type="button" className="btn-secondary-outline" onClick={() => setActiveModal(null)}>Cancel</button>
                                                    <button type="submit" disabled={isLoading} className="btn-primary-premium">Submit Ticket</button>
                                                </div>
                                            </form>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            <style jsx="true">{`
                .profile-container { 
                    display: flex; 
                    flex-direction: column; 
                    gap: 1.5rem; 
                    padding: 10px 10px 80px 10px; 
                    max-width: 800px;
                    margin: 0 auto;
                }
                
                .profile-header { display: flex; justify-content: space-between; align-items: center; }
                .profile-header h1 { font-size: 1.5rem; font-weight: 800; margin: 0; }
                .back-btn-circle, .action-icon-btn { width: 44px; height: 44px; border-radius: 50%; border: none; background: white; display: flex; align-items: center; justify-content: center; box-shadow: var(--shadow-md); color: var(--text-muted); cursor: pointer; }

                .identity-card { padding: 2rem; display: flex; align-items: center; gap: 1.5rem; border-radius: 28px; background: linear-gradient(135deg, #ffffff 0%, #f8fafc 100%); }
                .avatar-large { width: 80px; height: 80px; background: var(--primary); color: white; border-radius: 24px; display: flex; align-items: center; justify-content: center; font-size: 2rem; font-weight: 900; box-shadow: 0 10px 25px rgba(37, 99, 235, 0.3); overflow: hidden; flex-shrink: 0; }
                .user-details-main h2 { font-size: 1.5rem; font-weight: 900; margin-bottom: 0.25rem; color: #0f172a; }
                .user-meta-row { display: flex; align-items: center; gap: 0.5rem; color: #64748b; font-size: 0.9rem; margin-bottom: 0.5rem; }
                .badge-premium { display: inline-block; padding: 4px 12px; background: #fffbeb; color: #d97706; font-size: 0.7rem; font-weight: 800; border-radius: 99px; border: 1px solid #fef3c7; margin-top: 4px; width: fit-content; }

                .settings-group { margin-bottom: 0.5rem; }
                .group-title { font-size: 0.75rem; font-weight: 800; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 0.75rem; padding-left: 0.5rem; }
                .group-card { border-radius: 24px; overflow: hidden; padding: 0.5rem; background: white; border: 1px solid var(--border); }
                
                .setting-item { display: flex; justify-content: space-between; align-items: center; padding: 1rem; border-radius: 16px; cursor: pointer; transition: all 0.2s; }
                .setting-item:hover { background: #f8fafc; }
                .si-left { display: flex; align-items: center; gap: 1rem; }
                .si-icon { width: 40px; height: 40px; border-radius: 12px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
                .si-text { display: flex; flex-direction: column; text-align: left; }
                .si-label { font-size: 0.95rem; font-weight: 700; color: #1e293b; }
                .si-value { font-size: 0.75rem; color: #94a3b8; font-weight: 600; margin-top: 2px; }
                .si-arrow { color: #cbd5e1; }

                .admin-control-card {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 1.25rem;
                    border-radius: 24px;
                    border: 1.5px dashed #f43f5e;
                    background: #fff5f5;
                    cursor: pointer;
                    transition: all 0.2s;
                }
                .admin-control-card:hover {
                    background: #ffe4e6;
                    transform: translateY(-2px);
                }

                .footer-actions { display: flex; flex-direction: column; gap: 1.5rem; }
                .support-card { display: flex; justify-content: space-between; align-items: center; padding: 1.25rem; border-radius: 20px; background: white; border: 1px solid var(--border); cursor: pointer; text-align: left; width: 100%; color: var(--text-main); }
                .sc-left { display: flex; align-items: center; gap: 1rem; font-weight: 700; }
                
                .logout-btn-full { display: flex; align-items: center; justify-content: center; gap: 0.75rem; padding: 1.25rem; border-radius: 20px; background: #fff1f2; border: 1px solid #ffe4e6; color: #e11d48; font-weight: 800; font-size: 1rem; cursor: pointer; transition: all 0.2s; }
                .logout-btn-full:hover { background: #ffe4e6; transform: translateY(-2px); }

                .app-version { text-align: center; font-size: 0.7rem; font-weight: 700; color: #cbd5e1; text-transform: uppercase; letter-spacing: 1px; margin-top: 1rem; }

                /* MODALS SYSTEM STYLING */
                .modal-overlay-v2 {
                    position: fixed;
                    inset: 0;
                    z-index: 9999;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    padding: 24px;
                }
                .modal-backdrop-v2 {
                    position: absolute;
                    inset: 0;
                    background: rgba(15, 23, 42, 0.4);
                    backdrop-filter: blur(12px);
                    -webkit-backdrop-filter: blur(12px);
                }
                .modal-container-v2 {
                    position: relative;
                    background: white;
                    width: 100%;
                    max-width: 600px;
                    max-height: 85vh;
                    border-radius: 32px;
                    box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
                    display: flex;
                    flex-direction: column;
                    overflow: hidden;
                    border: 1px solid rgba(255, 255, 255, 0.7);
                }
                .modal-header-v2 {
                    padding: 24px 32px;
                    border-bottom: 1px solid #f1f5f9;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    flex-shrink: 0;
                }
                .modal-header-v2 h2 {
                    font-size: 1.25rem;
                    font-weight: 800;
                    color: #0f172a;
                    margin: 0;
                }
                .modal-close-btn-v2 {
                    background: #f1f5f9;
                    border: none;
                    width: 36px;
                    height: 36px;
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: #64748b;
                    cursor: pointer;
                    transition: 0.15s;
                }
                .modal-close-btn-v2:hover {
                    background: #e2e8f0;
                    color: #0f172a;
                }
                .modal-body-v2 {
                    padding: 32px;
                    overflow-y: auto;
                    flex-grow: 1;
                    position: relative;
                }
                .modal-body-v2::-webkit-scrollbar {
                    width: 6px;
                }
                .modal-body-v2::-webkit-scrollbar-thumb {
                    background: #e2e8f0;
                    border-radius: 99px;
                }
                .modal-loading-cover {
                    position: absolute;
                    inset: 0;
                    background: rgba(255, 255, 255, 0.85);
                    z-index: 10;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    gap: 12px;
                }
                .modal-loading-cover span {
                    font-size: 0.9rem;
                    font-weight: 800;
                    color: #64748b;
                }

                .form-layout {
                    display: flex;
                    flex-direction: column;
                    gap: 20px;
                }
                .input-group-v2 {
                    display: flex;
                    flex-direction: column;
                    gap: 8px;
                }
                .input-group-v2 label {
                    font-size: 0.8rem;
                    font-weight: 800;
                    color: #64748b;
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                }
                .password-input-wrap {
                    position: relative;
                    display: flex;
                    align-items: center;
                }
                .password-input-wrap input {
                    width: 100%;
                    padding-right: 48px;
                }
                .password-input-wrap button {
                    position: absolute;
                    right: 12px;
                    background: transparent;
                    border: none;
                    color: #64748b;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                }

                .avatar-upload-section {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    gap: 12px;
                    margin-bottom: 8px;
                }
                .avatar-upload-preview {
                    position: relative;
                    width: 96px;
                    height: 96px;
                    border-radius: 50%;
                    background: #2563eb;
                    color: white;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 2.25rem;
                    font-weight: 900;
                    box-shadow: 0 10px 20px rgba(37, 99, 235, 0.2);
                    overflow: hidden;
                }
                .avatar-upload-preview img {
                    width: 100%;
                    height: 100%;
                    object-fit: cover;
                }
                .avatar-edit-overlay {
                    position: absolute;
                    inset: 0;
                    background: rgba(0, 0, 0, 0.4);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    opacity: 0;
                    cursor: pointer;
                    transition: 0.2s;
                }
                .avatar-upload-preview:hover .avatar-edit-overlay {
                    opacity: 1;
                }
                .avatar-hint {
                    font-size: 0.75rem;
                    color: #94a3b8;
                    font-weight: 600;
                }

                .modal-footer-v2 {
                    display: flex;
                    gap: 12px;
                    margin-top: 12px;
                    padding-top: 24px;
                    border-top: 1px solid #f1f5f9;
                }
                .modal-footer-v2 button {
                    flex: 1;
                    height: 50px;
                    border-radius: 14px;
                    font-weight: 700;
                    font-size: 0.95rem;
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    gap: 8px;
                }

                .sub-sections {
                    display: flex;
                    flex-direction: column;
                    gap: 24px;
                }
                .sub-section-card {
                    border: 1px solid #f1f5f9;
                    border-radius: 20px;
                    padding: 20px;
                    background: #f8fafc;
                }
                .sub-section-card h3 {
                    font-size: 1rem;
                    font-weight: 800;
                    color: #0f172a;
                    margin-bottom: 6px;
                }
                .card-desc-v2 {
                    font-size: 0.8rem;
                    color: #64748b;
                    font-weight: 500;
                    line-height: 1.5;
                }
                .card-header-v2 {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 8px;
                }
                .badge-coming-soon {
                    padding: 4px 8px;
                    background: #f1f5f9;
                    color: #64748b;
                    font-size: 0.65rem;
                    font-weight: 800;
                    border-radius: 99px;
                    border: 1px solid #e2e8f0;
                    text-transform: uppercase;
                }

                .sessions-list {
                    display: flex;
                    flex-direction: column;
                    gap: 12px;
                    margin-top: 12px;
                }
                .session-item-row {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    background: white;
                    border: 1px solid #e2e8f0;
                    padding: 12px 16px;
                    border-radius: 14px;
                }
                .session-info-left {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                }
                .session-icon {
                    color: #64748b;
                }
                .session-text {
                    display: flex;
                    flex-direction: column;
                    text-align: left;
                }
                .session-text strong {
                    font-size: 0.875rem;
                    color: #1e293b;
                }
                .session-text span {
                    font-size: 0.75rem;
                    color: #64748b;
                    margin-top: 2px;
                }
                .session-meta {
                    font-size: 0.65rem !important;
                    color: #94a3b8 !important;
                }
                .btn-session-revoke {
                    background: #fff1f2;
                    border: 1px solid #ffe4e6;
                    color: #e11d48;
                    width: 32px;
                    height: 32px;
                    border-radius: 8px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    cursor: pointer;
                    transition: 0.15s;
                }
                .btn-session-revoke:hover {
                    background: #ffe4e6;
                }

                .db-count-card {
                    background: white;
                    border: 1px solid #e2e8f0;
                    border-radius: 12px;
                    padding: 10px;
                    text-align: center;
                    display: flex;
                    flex-direction: column;
                    gap: 4px;
                }
                .db-count-card strong {
                    font-size: 1.1rem;
                    color: #1e293b;
                }
                .db-count-card span {
                    font-size: 0.65rem;
                    color: #64748b;
                    font-weight: 800;
                    text-transform: uppercase;
                }
                .sync-status-pill {
                    display: inline-flex;
                    align-items: center;
                    gap: 6px;
                    padding: 6px 12px;
                    border-radius: 99px;
                    font-size: 0.75rem;
                    font-weight: 800;
                }
                .sync-status-pill.green {
                    background: #ecfdf5;
                    border: 1px solid #a7f3d0;
                    color: #047857;
                }
                .last-sync-lbl {
                    font-size: 0.75rem;
                    color: #64748b;
                    font-weight: 600;
                }

                .subscription-card-v2 {
                    display: flex;
                    flex-direction: column;
                    gap: 16px;
                    background: linear-gradient(135deg, #f8fafc 0%, #eff6ff 100%);
                    border-color: #dbeafe;
                }
                .sub-header-v2 {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                }
                .plan-badge {
                    padding: 6px 14px;
                    border-radius: 99px;
                    font-size: 0.75rem;
                    font-weight: 900;
                    text-transform: uppercase;
                    border: 1px solid;
                }
                .plan-badge.trial { background: #fef3c7; border-color: #fde68a; color: #b45309; }
                .plan-badge.yearly { background: #dbeafe; border-color: #bfdbfe; color: #1d4ed8; }
                .plan-badge.lifetime { background: #dcfce7; border-color: #bbf7d0; color: #15803d; }
                
                .reminder-banner {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    padding: 12px;
                    background: #fffbeb;
                    border: 1px solid #fde68a;
                    border-radius: 12px;
                    color: #b45309;
                    font-size: 0.8rem;
                    font-weight: 600;
                }

                .sub-details-grid {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 16px;
                }
                .sub-details-grid div {
                    display: flex;
                    flex-direction: column;
                    gap: 4px;
                }
                .sub-details-grid label {
                    font-size: 0.65rem;
                    font-weight: 800;
                    color: #64748b;
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                }
                .sub-details-grid span {
                    font-size: 0.9rem;
                    font-weight: 700;
                    color: #1e293b;
                }

                .toggle-list {
                    display: flex;
                    flex-direction: column;
                    gap: 16px;
                }
                .toggle-item-row {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 12px 0;
                }
                .toggle-text {
                    display: flex;
                    flex-direction: column;
                    gap: 4px;
                    text-align: left;
                }
                .toggle-text strong {
                    font-size: 0.95rem;
                    color: #1e293b;
                }
                .toggle-text span {
                    font-size: 0.75rem;
                    color: #64748b;
                    font-weight: 500;
                }

                .support-quick-contact {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 12px;
                }
                .quick-btn {
                    height: 50px;
                    border-radius: 14px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-weight: 800;
                    font-size: 0.85rem;
                    text-decoration: none;
                    color: white;
                    box-shadow: 0 4px 12px rgba(0,0,0,0.05);
                }
                .quick-btn.whatsapp { background: #22c55e; }
                .quick-btn.phone { background: #2563eb; }

                /* Dark mode CSS values helper */
                :global(body.dark-mode) {
                    --bg-main: #0f172a;
                    --bg-card: #1e293b;
                    --text-main: #f8fafc;
                    --text-muted: #94a3b8;
                    --border: #334155;
                }
                :global(body.dark-mode) .back-btn-circle, 
                :global(body.dark-mode) .action-icon-btn,
                :global(body.dark-mode) .group-card,
                :global(body.dark-mode) .support-card {
                    background: #1e293b !important;
                    border-color: #334155 !important;
                    color: #f8fafc !important;
                }
                :global(body.dark-mode) .setting-item:hover {
                    background: #334155 !important;
                }
                :global(body.dark-mode) .identity-card {
                    background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%) !important;
                    color: #f8fafc !important;
                }
                :global(body.dark-mode) .user-details-main h2 {
                    color: #f8fafc !important;
                }
                :global(body.dark-mode) .si-label {
                    color: #f8fafc !important;
                }
                :global(body.dark-mode) .modal-container-v2 {
                    background: #1e293b !important;
                    border-color: #475569 !important;
                }
                :global(body.dark-mode) .modal-header-v2 {
                    border-bottom-color: #334155 !important;
                }
                :global(body.dark-mode) .modal-header-v2 h2,
                :global(body.dark-mode) .sub-section-card h3,
                :global(body.dark-mode) .sub-details-grid span,
                :global(body.dark-mode) .toggle-text strong,
                :global(body.dark-mode) .session-text strong {
                    color: #f8fafc !important;
                }
                :global(body.dark-mode) .sub-section-card,
                :global(body.dark-mode) .session-item-row,
                :global(body.dark-mode) .db-count-card {
                    background: #0f172a !important;
                    border-color: #334155 !important;
                }
                :global(body.dark-mode) .input-control {
                    background: #0f172a !important;
                    border-color: #334155 !important;
                    color: #f8fafc !important;
                }
                :global(body.dark-mode) .modal-close-btn-v2 {
                    background: #334155 !important;
                    color: #94a3b8 !important;
                }
                :global(body.dark-mode) .modal-close-btn-v2:hover {
                    background: #475569 !important;
                    color: #f8fafc !important;
                }
                :global(body.dark-mode) .modal-loading-cover {
                    background: rgba(30, 41, 59, 0.9) !important;
                }
                :global(body.dark-mode) .btn-secondary-outline {
                    color: #f8fafc !important;
                    border-color: #334155 !important;
                }

                @media (max-width: 640px) {
                    .identity-card { flex-direction: column; text-align: center; padding: 2.5rem 1.5rem; }
                    .user-meta-row { justify-content: center; }
                    .modal-container-v2 {
                        max-height: 95vh;
                    }
                    .modal-body-v2 {
                        padding: 20px;
                    }
                    .sub-details-grid {
                        grid-template-columns: 1fr;
                    }
                    .support-quick-contact {
                        grid-template-columns: 1fr;
                    }
                }
                
                /* Fertilizer Licences Section */
                .fertilizer-licenses-section {
                    background: #f8fafc;
                    border: 1.5px solid #e2e8f0;
                    border-radius: 16px;
                    padding: 16px;
                    margin: 10px 0;
                }
                .fl-header-row {
                    display: flex;
                    justify-content: space-between;
                    align-items: flex-start;
                    gap: 12px;
                    margin-bottom: 12px;
                }
                .fl-title {
                    font-size: 0.95rem;
                    font-weight: 800;
                    color: #0f172a;
                    margin: 0 0 2px 0;
                }
                .fl-desc {
                    font-size: 0.78rem;
                    color: #64748b;
                    margin: 0;
                }
                .fl-add-btn {
                    display: inline-flex;
                    align-items: center;
                    gap: 5px;
                    background: #eff6ff;
                    color: #2563eb;
                    border: 1px solid #bfdbfe;
                    padding: 6px 12px;
                    border-radius: 8px;
                    font-size: 0.8rem;
                    font-weight: 700;
                    cursor: pointer;
                    transition: all 0.2s;
                    white-space: nowrap;
                }
                .fl-add-btn:hover {
                    background: #2563eb;
                    color: #ffffff;
                }
                .fl-empty-notice {
                    background: #ffffff;
                    border: 1.5px dashed #cbd5e1;
                    border-radius: 10px;
                    padding: 14px;
                    text-align: center;
                    font-size: 0.82rem;
                    color: #64748b;
                }
                .fl-list {
                    display: flex;
                    flex-direction: column;
                    gap: 10px;
                }
                .fl-item-card {
                    display: flex;
                    align-items: flex-end;
                    gap: 10px;
                    background: #ffffff;
                    border: 1px solid #e2e8f0;
                    border-radius: 12px;
                    padding: 10px 12px;
                }
                .fl-field-type {
                    width: 110px;
                    flex-shrink: 0;
                }
                .fl-field-type label,
                .fl-field-num label {
                    display: block;
                    font-size: 0.75rem;
                    font-weight: 700;
                    color: #475569;
                    margin-bottom: 4px;
                }
                .fl-field-num {
                    flex: 1;
                }
                .fl-remove-btn {
                    background: #fef2f2;
                    border: 1px solid #fee2e2;
                    color: #ef4444;
                    width: 38px;
                    height: 38px;
                    border-radius: 8px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    cursor: pointer;
                    flex-shrink: 0;
                    transition: all 0.2s;
                }
                .fl-remove-btn:hover {
                    background: #ef4444;
                    color: #ffffff;
                }
                :global(body.dark-mode) .fertilizer-licenses-section {
                    background: #1e293b;
                    border-color: #334155;
                }
                :global(body.dark-mode) .fl-title {
                    color: #f8fafc;
                }
                :global(body.dark-mode) .fl-desc {
                    color: #94a3b8;
                }
                :global(body.dark-mode) .fl-empty-notice {
                    background: #0f172a;
                    border-color: #334155;
                    color: #94a3b8;
                }
                :global(body.dark-mode) .fl-item-card {
                    background: #0f172a;
                    border-color: #334155;
                }
                :global(body.dark-mode) .fl-field-type label,
                :global(body.dark-mode) .fl-field-num label {
                    color: #cbd5e1;
                }
                @media (max-width: 480px) {
                    .fl-item-card {
                        flex-wrap: wrap;
                    }
                    .fl-field-type {
                        width: 100%;
                    }
                    .fl-field-num {
                        width: calc(100% - 50px);
                    }
                }

                .animate-spin {
                    animation: spin 1s linear infinite;
                }
                @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
            `}</style>
        </div>
    );
};

export default ProfilePage;
