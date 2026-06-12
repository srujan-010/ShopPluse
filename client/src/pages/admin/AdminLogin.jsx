import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
    Shield, 
    Mail, 
    Lock, 
    Eye, 
    EyeOff, 
    ArrowRight,
    TrendingUp,
    Server,
    ShieldAlert
} from 'lucide-react';
import { motion } from 'framer-motion';
import { useAuth } from '../../context/AuthContext';

const AdminLogin = () => {
    const navigate = useNavigate();
    const [showPassword, setShowPassword] = useState(false);
    const [formData, setFormData] = useState({
        email: '',
        password: ''
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const { login: authLogin, logout, user } = useAuth();
    
    useEffect(() => {
        if (user && user.role === 'admin') {
            navigate('/admin');
        }
    }, [user, navigate]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        
        try {
            const res = await authLogin(formData);
            if (res.success && res.data.role !== 'admin') {
                // Not an admin! Log out immediately to clear the session
                await logout();
                setError('Access Denied: You do not have administrator permissions.');
            } else {
                navigate('/admin');
            }
        } catch (err) {
            console.error('Admin login error:', err);
            if (!err.response) {
                setError('Server unreachable. Please check your connection.');
            } else {
                setError(err.response?.data?.message || 'Invalid email or password');
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="admin-login-container">
            {/* Left Side: Dynamic Visual Layout */}
            <div className="admin-visual-side">
                <div className="bg-gradient-overlay"></div>
                <div className="grid-overlay"></div>
                <div className="visual-content">
                    <div className="logo-section">
                        <div className="logo-icon-box">
                            <Shield size={28} />
                        </div>
                        <span className="logo-text">ShopPulse Control Center</span>
                    </div>

                    <div className="visual-text">
                        <h2>Administrative <br/><span className="gradient-highlight">Super Admin Portal</span></h2>
                        <p>Configure subscriptions, review real-time database telemetry, track offline device sync logs, and manage active shops.</p>
                    </div>

                    <div className="telemetry-box">
                        <div className="telemetry-header">
                            <span className="telemetry-title">Platform Diagnostic Feed</span>
                            <span className="telemetry-status-pill">Live</span>
                        </div>
                        <div className="telemetry-body">
                            <div className="telemetry-item">
                                <span className="telemetry-label">Main Database:</span>
                                <span className="telemetry-val text-green">🟢 Connected</span>
                            </div>
                            <div className="telemetry-item">
                                <span className="telemetry-label">API Gateway:</span>
                                <span className="telemetry-val text-green">🟢 Healthy</span>
                            </div>
                            <div className="telemetry-item">
                                <span className="telemetry-label">Offline Sync Worker:</span>
                                <span className="telemetry-val">Active (0 errors)</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Right Side: Secure Login Form */}
            <div className="admin-form-side">
                <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="admin-login-card"
                >
                    <div className="admin-card-header">
                        <div className="mobile-logo-header">
                            <Shield size={24} color="#3B82F6" />
                            <span>ShopPulse Admin</span>
                        </div>
                        <h1>Security Authentication</h1>
                        <p>Enter credentials to access the Super Admin Dashboard.</p>
                    </div>

                    <form onSubmit={handleSubmit} className="admin-login-form">
                        {error && (
                            <div className="admin-error-box">
                                <ShieldAlert size={18} />
                                <span>{error}</span>
                            </div>
                        )}
                        
                        <div className="input-group">
                            <label>Admin Email Address</label>
                            <div className="input-wrapper">
                                <Mail className="input-icon" size={18} />
                                <input 
                                    type="email" 
                                    placeholder="srujan@admin.com"
                                    required 
                                    value={formData.email}
                                    onChange={(e) => setFormData({...formData, email: e.target.value})}
                                />
                            </div>
                        </div>

                        <div className="input-group">
                            <label>Secure Security Password</label>
                            <div className="input-wrapper">
                                <Lock className="input-icon" size={18} />
                                <input 
                                    type={showPassword ? "text" : "password"} 
                                    placeholder="••••••••"
                                    required 
                                    value={formData.password}
                                    onChange={(e) => setFormData({...formData, password: e.target.value})}
                                />
                                <button 
                                    type="button" 
                                    className="password-toggle"
                                    onClick={() => setShowPassword(!showPassword)}
                                >
                                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                </button>
                            </div>
                        </div>

                        <button type="submit" className="admin-submit-btn" disabled={loading}>
                            {loading ? <div className="spinner"></div> : (
                                <>Authenticate Admin <ArrowRight size={18} /></>
                            )}
                        </button>
                    </form>
                </motion.div>
            </div>

            <style jsx="true">{`
                @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@500;600;700;800&family=Inter:wght@400;500;600;700&display=swap');

                .admin-login-container {
                    display: flex;
                    min-height: 100vh;
                    font-family: 'Inter', sans-serif;
                    background: #0B0F19; /* Dark premium background */
                    color: #F8FAFC;
                    overflow: hidden;
                }

                h1, h2, .logo-text, .gradient-highlight {
                    font-family: 'Plus Jakarta Sans', sans-serif;
                    letter-spacing: -0.02em;
                }

                /* Left Visual Panel */
                .admin-visual-side {
                    flex: 1.2;
                    background: #0F172A;
                    position: relative;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    padding: 4rem;
                    border-right: 1px solid rgba(255, 255, 255, 0.05);
                }

                .bg-gradient-overlay {
                    position: absolute;
                    top: 0; left: 0; right: 0; bottom: 0;
                    background: radial-gradient(circle at 10% 20%, rgba(30, 107, 255, 0.15) 0%, transparent 50%),
                                radial-gradient(circle at 90% 80%, rgba(139, 92, 246, 0.1) 0%, transparent 50%);
                    z-index: 1;
                }

                .grid-overlay {
                    position: absolute;
                    top: 0; left: 0; right: 0; bottom: 0;
                    background-image: linear-gradient(rgba(255, 255, 255, 0.02) 1px, transparent 1px),
                                      linear-gradient(90deg, rgba(255, 255, 255, 0.02) 1px, transparent 1px);
                    background-size: 30px 30px;
                    z-index: 1;
                }

                .visual-content {
                    position: relative;
                    z-index: 5;
                    width: 100%;
                    max-width: 540px;
                    display: flex;
                    flex-direction: column;
                    gap: 3.5rem;
                }

                .logo-section {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                }

                .logo-icon-box {
                    background: linear-gradient(135deg, #1E6BFF, #3B82F6);
                    color: white;
                    padding: 10px;
                    border-radius: 12px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    box-shadow: 0 4px 12px rgba(30, 107, 255, 0.3);
                }

                .logo-text {
                    font-size: 1.5rem;
                    font-weight: 800;
                    color: #FFFFFF;
                }

                .visual-text h2 {
                    font-size: 2.75rem;
                    line-height: 1.2;
                    margin-bottom: 1.5rem;
                    color: #FFFFFF;
                    font-weight: 800;
                }

                .gradient-highlight {
                    background: linear-gradient(135deg, #3B82F6 0%, #8B5CF6 100%);
                    -webkit-background-clip: text;
                    -webkit-text-fill-color: transparent;
                }

                .visual-text p {
                    font-size: 1.1rem;
                    line-height: 1.6;
                    color: #94A3B8;
                }

                .telemetry-box {
                    background: rgba(15, 23, 42, 0.6);
                    border: 1px solid rgba(255, 255, 255, 0.08);
                    border-radius: 20px;
                    padding: 20px;
                    backdrop-filter: blur(10px);
                }

                .telemetry-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 1rem;
                    border-bottom: 1px solid rgba(255,255,255,0.06);
                    padding-bottom: 10px;
                }

                .telemetry-title {
                    font-size: 0.8rem;
                    color: #64748B;
                    text-transform: uppercase;
                    font-weight: 700;
                    letter-spacing: 0.05em;
                }

                .telemetry-status-pill {
                    background: rgba(16, 185, 129, 0.1);
                    color: #34D399;
                    font-size: 0.7rem;
                    font-weight: 700;
                    padding: 2px 8px;
                    border-radius: 99px;
                    border: 1px solid rgba(16, 185, 129, 0.2);
                }

                .telemetry-body {
                    display: flex;
                    flex-direction: column;
                    gap: 8px;
                }

                .telemetry-item {
                    display: flex;
                    justify-content: space-between;
                    font-size: 0.9rem;
                }

                .telemetry-label {
                    color: #94A3B8;
                }

                .telemetry-val {
                    font-weight: 600;
                    color: #E2E8F0;
                }

                .text-green { color: #34D399; }

                /* Right Form Panel */
                .admin-form-side {
                    flex: 1;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    padding: 2rem;
                    background: #0B0F19;
                }

                .admin-login-card {
                    width: 100%;
                    max-width: 400px;
                }

                .admin-card-header {
                    margin-bottom: 2.5rem;
                }

                .mobile-logo-header {
                    display: none;
                    align-items: center;
                    gap: 8px;
                    margin-bottom: 1.5rem;
                }

                .mobile-logo-header span {
                    font-size: 1.1rem;
                    font-weight: 700;
                    color: white;
                }

                .admin-card-header h1 {
                    font-size: 2.25rem;
                    font-weight: 800;
                    color: #FFFFFF;
                    margin-bottom: 0.5rem;
                }

                .admin-card-header p {
                    color: #64748B;
                    font-size: 0.95rem;
                    line-height: 1.5;
                }

                .admin-login-form {
                    display: flex;
                    flex-direction: column;
                    gap: 1.5rem;
                }

                .input-group {
                    display: flex;
                    flex-direction: column;
                    gap: 6px;
                }

                .input-group label {
                    font-size: 0.85rem;
                    font-weight: 600;
                    color: #94A3B8;
                }

                .input-wrapper {
                    position: relative;
                    display: flex;
                    align-items: center;
                }

                .input-icon {
                    position: absolute;
                    left: 1rem;
                    color: #475569;
                }

                .input-wrapper input {
                    width: 100%;
                    padding: 0.875rem 1rem 0.875rem 2.75rem;
                    background: #111827;
                    border: 1.5px solid rgba(255, 255, 255, 0.08);
                    border-radius: 12px;
                    font-size: 1rem;
                    color: #FFFFFF;
                    transition: all 0.2s;
                }

                .input-wrapper input:focus {
                    outline: none;
                    border-color: #3B82F6;
                    box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.15);
                    background: #1F2937;
                }

                .password-toggle {
                    position: absolute;
                    right: 1rem;
                    background: none;
                    border: none;
                    color: #475569;
                    cursor: pointer;
                }

                .password-toggle:hover {
                    color: #94A3B8;
                }

                .admin-submit-btn {
                    width: 100%;
                    padding: 1rem;
                    font-size: 1rem;
                    font-weight: 700;
                    border-radius: 12px;
                    background: linear-gradient(135deg, #1E6BFF, #3B82F6);
                    color: #FFFFFF;
                    border: none;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 8px;
                    cursor: pointer;
                    box-shadow: 0 4px 14px rgba(30, 107, 255, 0.25);
                    transition: all 0.2s;
                }

                .admin-submit-btn:hover {
                    transform: translateY(-1px);
                    box-shadow: 0 6px 18px rgba(30, 107, 255, 0.35);
                }

                .admin-submit-btn:disabled {
                    opacity: 0.7;
                    cursor: not-allowed;
                }

                .admin-error-box {
                    background: rgba(239, 68, 68, 0.1);
                    border: 1px solid rgba(239, 68, 68, 0.25);
                    color: #FCA5A5;
                    padding: 12px;
                    border-radius: 12px;
                    font-size: 0.85rem;
                    display: flex;
                    align-items: center;
                    gap: 10px;
                }

                .spinner {
                    width: 20px;
                    height: 20px;
                    border: 2px solid rgba(255, 255, 255, 0.3);
                    border-radius: 50%;
                    border-top-color: #FFFFFF;
                    animation: spin 1s linear infinite;
                }

                @keyframes spin { to { transform: rotate(360deg); } }

                @media (max-width: 1024px) {
                    .admin-visual-side { display: none; }
                    .mobile-logo-header { display: flex; }
                    .admin-form-side { background: #0B0F19; }
                    .admin-login-card {
                        background: #111827;
                        padding: 2.5rem;
                        border-radius: 20px;
                        border: 1px solid rgba(255, 255, 255, 0.05);
                        box-shadow: 0 10px 30px rgba(0,0,0,0.3);
                    }
                }

                @media (max-width: 640px) {
                    .admin-login-card { padding: 1.5rem; border: none; box-shadow: none; background: transparent; }
                    .admin-form-side { padding: 1rem; }
                }
            `}</style>
        </div>
    );
};

export default AdminLogin;
