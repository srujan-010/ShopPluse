import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { 
    Store, 
    Activity, 
    Mail, 
    Lock, 
    Eye, 
    EyeOff, 
    ArrowRight, 
    TrendingUp, 
    Bell, 
    Globe,
    Layout
} from 'lucide-react';
import { motion } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { CustomCheckbox } from '../components/PremiumUI';
import { signInWithGoogle } from '../firebase';

const LoginPage = () => {
    const navigate = useNavigate();
    const [showPassword, setShowPassword] = useState(false);
    const [formData, setFormData] = useState({
        email: '',
        password: ''
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const { login: authLogin, user } = useAuth();
    
    React.useEffect(() => {
        if (user) {
            navigate('/shops');
        }
    }, [user, navigate]);

    const handleGoogleLogin = async () => {
        setLoading(true);
        setError('');
        try {
            await signInWithGoogle();
            // Note: On mobile, the page will redirect. On desktop, signInWithPopup returns.
            // AuthContext's onAuthStateChanged handles the backend sync.
        } catch (err) {
            console.error('Google login error:', err);
            setError('Failed to sign in with Google. Please try again.');
            setLoading(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        
        try {
            await authLogin(formData);
            navigate('/shops');
        } catch (err) {
            console.error('Login error:', err);
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
        <div className="auth-container">
            {/* Left Side: Form */}
            <div className="auth-form-side">
                <div className="auth-header-mobile">
                    <div className="logo">
                        <img src="https://i.ibb.co/9mVRXF5q/Chat-GPT-Image-May-14-2026-01-56-04-PM.png" alt="ShopPulse" className="auth-logo-img" />
                        <span>ShopPulse</span>
                    </div>
                </div>

                <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="auth-card"
                >
                    <div className="auth-card-header">
                        <h1>Welcome back</h1>
                        <p>Glad to see you again! Enter your details.</p>
                    </div>

                    <div className="social-auth">
                        <button 
                            className="social-btn" 
                            type="button" 
                            onClick={handleGoogleLogin}
                            disabled={loading}
                        >
                            <Globe size={20} />
                            <span>Google</span>
                        </button>
                        <button className="social-btn" type="button" disabled={loading}>
                            <Layout size={20} />
                            <span>Apple</span>
                        </button>
                    </div>

                    <div className="divider">
                        <span>or continue with email</span>
                    </div>

                    <form onSubmit={handleSubmit} className="auth-form">
                        {error && <div className="error-message">{error}</div>}
                        
                        <div className="input-group">
                            <label>Email Address</label>
                            <div className="input-wrapper">
                                <Mail className="input-icon" size={18} />
                                <input 
                                    type="email" 
                                    placeholder="name@company.com"
                                    required 
                                    value={formData.email}
                                    onChange={(e) => setFormData({...formData, email: e.target.value})}
                                />
                            </div>
                        </div>

                        <div className="input-group">
                            <div className="label-with-link">
                                <label>Password</label>
                                <Link to="/forgot-password">Forgot password?</Link>
                            </div>
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

                        <div className="auth-options">
                            <CustomCheckbox 
                                label="Remember for 30 days"
                                checked={formData.remember}
                                onChange={(e) => setFormData({...formData, remember: e.target.checked})}
                            />
                        </div>

                        <button type="submit" className="btn btn-primary auth-btn" disabled={loading}>
                            {loading ? <div className="spinner"></div> : (
                                <>Sign in <ArrowRight size={18} /></>
                            )}
                        </button>
                    </form>

                    <div className="auth-card-footer">
                        Don't have an account? <Link to="/register">Sign up for free</Link>
                    </div>
                </motion.div>
            </div>

            {/* Right Side: Visuals */}
            <div className="auth-visual-side">
                {/* Decorative blurs matching landing page */}
                <div className="p-blur-circle blur-blue"></div>
                <div className="p-blur-circle blur-purple"></div>

                <div className="visual-content">
                    <div className="logo">
                        <img src="https://i.ibb.co/9mVRXF5q/Chat-GPT-Image-May-14-2026-01-56-04-PM.png" alt="ShopPulse" className="auth-logo-img-large" />
                        <span>ShopPulse</span>
                    </div>

                    <div className="visual-text">
                        <motion.h2
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: 0.2 }}
                        >
                            The Most Trusted <br />
                            <span className="p-gradient-text">Shop Manager</span>
                        </motion.h2>
                        <motion.p
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: 0.3 }}
                        >
                            Monitor your business performance anytime, anywhere with real-time data synchronization.
                        </motion.p>
                    </div>

                    <div className="visual-mockup-container">
                        <motion.div 
                            className="mockup-card"
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ delay: 0.4 }}
                        >
                            <div className="mockup-header">
                                <div className="mockup-info">
                                    <span>Main Dashboard</span>
                                    <strong>ShopPulse Analytics</strong>
                                </div>
                                <div className="mockup-badge">Live</div>
                            </div>
                            <div className="mockup-body">
                                <div className="mockup-row">
                                    <div className="mini-card">
                                        <span className="label">Today Sales</span>
                                        <span className="value">₹24,500</span>
                                        <span className="trend positive">+12%</span>
                                    </div>
                                    <div className="mini-card">
                                        <span className="label">Profit</span>
                                        <span className="value">+18%</span>
                                        <div className="mini-chart">
                                            <div className="bar" style={{height: '40%'}}></div>
                                            <div className="bar" style={{height: '70%'}}></div>
                                            <div className="bar" style={{height: '50%'}}></div>
                                        </div>
                                    </div>
                                </div>
                                <div className="mockup-full-card">
                                    <div className="chart-header">
                                        <span>Revenue Growth</span>
                                        <TrendingUp size={16} />
                                    </div>
                                    <div className="main-chart">
                                        <svg viewBox="0 0 200 60">
                                            <path d="M0,50 Q20,45 40,30 T80,35 T120,15 T160,25 T200,5" fill="none" stroke="#2563eb" strokeWidth="3" />
                                        </svg>
                                    </div>
                                </div>
                            </div>

                            {/* Floating Badges */}
                            <motion.div 
                                className="floating-badge revenue"
                                animate={{ y: [0, -10, 0] }}
                                transition={{ duration: 4, repeat: Infinity }}
                            >
                                <div className="f-icon"><TrendingUp size={14} /></div>
                                <span>+32% Revenue</span>
                            </motion.div>

                            <motion.div 
                                className="floating-badge alert"
                                animate={{ y: [0, 10, 0] }}
                                transition={{ duration: 5, repeat: Infinity }}
                            >
                                <div className="f-icon"><Bell size={14} /></div>
                                <span>Low Stock Alert</span>
                            </motion.div>
                        </motion.div>
                    </div>

                    <div className="trust-badges">
                        <div className="stars">
                            {[...Array(5)].map((_, i) => <Star key={i} filled={true} />)}
                        </div>
                        <p>Trusted by shop owners across India</p>
                    </div>
                </div>
            </div>

            <style jsx="true">{`
                @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Plus+Jakarta+Sans:wght@600;700;800&display=swap');

                .auth-container {
                    display: flex;
                    min-height: 100vh;
                    font-family: 'Inter', sans-serif;
                    background: #ffffff;
                }

                h1, h2, .brand-name, .logo span {
                    font-family: 'Plus Jakarta Sans', sans-serif;
                    letter-spacing: -0.02em;
                }

                .p-gradient-text {
                    background: linear-gradient(135deg, #2563eb 0%, #10b981 100%);
                    -webkit-background-clip: text;
                    -webkit-text-fill-color: transparent;
                }

                .auth-form-side {
                    flex: 1;
                    display: flex;
                    flex-direction: column;
                    padding: 2rem;
                    background: #ffffff;
                    z-index: 10;
                }

                .auth-header-mobile {
                    display: none;
                    margin-bottom: 2rem;
                }

                .auth-card {
                    max-width: 400px;
                    width: 100%;
                    margin: auto;
                }

                .auth-card-header {
                    margin-bottom: 2.5rem;
                }

                .auth-card-header h1 {
                    font-size: 2.25rem;
                    color: #0f172a;
                    margin-bottom: 0.5rem;
                }

                .auth-card-header p {
                    color: #64748b;
                    font-size: 1rem;
                }

                .social-auth {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 1rem;
                    margin-bottom: 1.5rem;
                }

                .social-btn {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 0.75rem;
                    padding: 0.75rem;
                    border: 1px solid #e2e8f0;
                    border-radius: 99px; /* Pill shape */
                    background: #ffffff;
                    color: #0f172a;
                    font-weight: 600;
                    font-size: 0.9rem;
                    cursor: pointer;
                    transition: all 0.2s;
                }

                .social-btn:hover {
                    background: #f8fafc;
                    border-color: #cbd5e1;
                }

                .divider {
                    display: flex;
                    align-items: center;
                    margin: 1.5rem 0;
                    color: #94a3b8;
                    font-size: 0.8rem;
                    text-transform: uppercase;
                    letter-spacing: 0.05em;
                }

                .divider::before, .divider::after {
                    content: "";
                    flex: 1;
                    height: 1px;
                    background: #e2e8f0;
                }

                .divider span {
                    padding: 0 1rem;
                }

                .auth-form {
                    display: flex;
                    flex-direction: column;
                    gap: 1.5rem;
                }

                .input-group {
                    display: flex;
                    flex-direction: column;
                    gap: 0.5rem;
                }

                .label-with-link {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                }

                .label-with-link a {
                    font-size: 0.8rem;
                    color: #2563eb;
                    text-decoration: none;
                    font-weight: 600;
                }

                .input-group label {
                    font-size: 0.875rem;
                    font-weight: 600;
                    color: #475569;
                }

                .input-wrapper {
                    position: relative;
                    display: flex;
                    align-items: center;
                }

                .input-icon {
                    position: absolute;
                    left: 1rem;
                    color: #94a3b8;
                }

                .input-wrapper input {
                    width: 100%;
                    padding: 0.875rem 1rem 0.875rem 2.75rem;
                    border: 1.5px solid #e2e8f0;
                    border-radius: 12px;
                    font-size: 1rem;
                    color: #0f172a;
                    background: #f8fafc;
                    transition: all 0.2s;
                }

                .input-wrapper input:focus {
                    outline: none;
                    border-color: #2563eb;
                    background: #ffffff;
                    box-shadow: 0 0 0 4px rgba(37, 99, 235, 0.1);
                }

                .password-toggle {
                    position: absolute;
                    right: 1rem;
                    background: none;
                    border: none;
                    color: #94a3b8;
                    cursor: pointer;
                }

                .checkbox-container {
                    display: flex;
                    align-items: center;
                    gap: 0.75rem;
                    cursor: pointer;
                    font-size: 0.875rem;
                    color: #64748b;
                }

                .auth-btn {
                    width: 100%;
                    padding: 1rem;
                    font-size: 1rem;
                    font-weight: 600;
                    border-radius: 99px; /* matches landing */
                    background: #0f172a; /* matches landing */
                    color: #ffffff;
                    border: none;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 0.5rem;
                    cursor: pointer;
                    box-shadow: 0 4px 12px rgba(15, 23, 42, 0.15);
                    transition: all 0.2s;
                }

                .auth-btn:hover {
                    background: #1e293b;
                    transform: translateY(-1px);
                    box-shadow: 0 6px 16px rgba(15, 23, 42, 0.2);
                }

                .auth-card-footer {
                    margin-top: 2rem;
                    text-align: center;
                    color: #64748b;
                    font-size: 0.9rem;
                }

                .auth-card-footer a {
                    color: #2563eb;
                    text-decoration: none;
                    font-weight: 600;
                }

                /* Visual Side - Refactored to light theme */
                .auth-visual-side {
                    flex: 1.2;
                    background: #f8fafc; /* Light background */
                    border-left: 1px solid #f1f5f9;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    padding: 4rem;
                    color: #0f172a; /* Dark text */
                    position: relative;
                    overflow: hidden;
                }

                /* Blurs matching landing page */
                .p-blur-circle {
                    position: absolute;
                    width: 400px;
                    height: 400px;
                    border-radius: 50%;
                    filter: blur(100px);
                    z-index: 1;
                    opacity: 0.15;
                }
                .blur-blue { background: #3b82f6; top: -10%; right: -10%; }
                .blur-purple { background: #8b5cf6; bottom: -10%; left: -10%; }

                .visual-content {
                    width: 100%;
                    max-width: 600px;
                    display: flex;
                    flex-direction: column;
                    gap: 3rem;
                    position: relative;
                    z-index: 2;
                }

                .visual-content .logo {
                    display: flex;
                    align-items: center;
                    gap: 1rem;
                }

                .auth-logo-img { width: 36px; height: 36px; border-radius: 8px; object-fit: cover; }
                .auth-logo-img-large { width: 48px; height: 48px; border-radius: 12px; object-fit: cover; }
                
                .logo-icon {
                    width: 44px;
                    height: 44px;
                    background: #0f172a;
                    border-radius: 12px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    position: relative;
                    color: white;
                }

                .pulse-icon {
                    position: absolute;
                    bottom: 6px;
                    right: 6px;
                    background: white;
                    color: #0f172a;
                    border-radius: 4px;
                }

                .visual-content .logo span {
                    font-size: 1.75rem;
                    font-weight: 800;
                    color: #0f172a;
                }

                .visual-text h2 {
                    font-size: 3rem;
                    line-height: 1.2;
                    margin-bottom: 1.5rem;
                    color: #0f172a;
                }

                .visual-text p {
                    font-size: 1.25rem;
                    color: #475569;
                }

                /* Mockup Style - Refactored to light UI */
                .visual-mockup-container {
                    position: relative;
                }

                .mockup-card {
                    background: #ffffff; /* Light background */
                    border: 1px solid #e2e8f0;
                    border-radius: 24px;
                    padding: 1.5rem;
                    box-shadow: 0 25px 50px -12px rgba(0,0,0,0.1);
                }

                .mockup-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 1.5rem;
                    padding-bottom: 1rem;
                    border-bottom: 1px solid #f1f5f9;
                }

                .mockup-info { display: flex; flex-direction: column; }
                .mockup-info span { font-size: 0.7rem; color: #64748b; text-transform: uppercase; font-weight: 600; }
                .mockup-info strong { color: #0f172a; }
                .mockup-badge { background: #dcfce7; color: #166534; font-size: 0.7rem; font-weight: 600; padding: 0.25rem 0.75rem; border-radius: 99px; }

                .mockup-row { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1rem; }
                .mini-card { background: #f8fafc; padding: 1rem; border-radius: 16px; border: 1px solid #f1f5f9; }
                .mini-card .label { font-size: 0.75rem; color: #64748b; font-weight: 600; }
                .mini-card .value { font-size: 1.25rem; font-weight: 800; color: #0f172a; display: block; margin: 4px 0; }
                .trend.positive { color: #10b981; font-size: 0.75rem; font-weight: 600; }

                .mini-chart { display: flex; align-items: flex-end; gap: 4px; height: 20px; margin-top: 4px; }
                .mini-chart .bar { width: 8px; background: #e2e8f0; border-radius: 2px; }

                .mockup-full-card { background: #f8fafc; padding: 1rem; border-radius: 16px; border: 1px solid #f1f5f9; }
                .chart-header { display: flex; justify-content: space-between; font-size: 0.8rem; font-weight: 600; color: #475569; margin-bottom: 0.5rem; }
                .main-chart { height: 60px; }

                .floating-badge {
                    position: absolute;
                    background: white;
                    color: #0f172a;
                    padding: 0.6rem 1rem;
                    border-radius: 12px;
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    font-size: 0.8rem;
                    font-weight: 700;
                    box-shadow: 0 10px 25px rgba(0,0,0,0.1);
                    border: 1px solid #f1f5f9;
                }

                .f-icon { width: 28px; height: 28px; border-radius: 8px; display: flex; align-items: center; justify-content: center; }
                .revenue { top: -1.5rem; right: 2rem; }
                .revenue .f-icon { background: #ecfdf5; color: #10b981; }
                .alert { bottom: 2rem; left: -2rem; }
                .alert .f-icon { background: #fef2f2; color: #ef4444; }

                .trust-badges { margin-top: 2rem; }
                .stars { display: flex; gap: 4px; color: #f59e0b; margin-bottom: 0.5rem; }
                .trust-badges p { font-size: 0.9rem; color: #64748b; font-weight: 500; }

                .error-message {
                    background: #fef2f2;
                    color: #dc2626;
                    padding: 0.75rem;
                    border-radius: 12px;
                    font-size: 0.875rem;
                    text-align: center;
                    border: 1px solid #fee2e2;
                }

                .spinner {
                    width: 20px;
                    height: 20px;
                    border: 2px solid rgba(255,255,255,0.3);
                    border-radius: 50%;
                    border-top-color: #fff;
                    animation: spin 1s linear infinite;
                }

                @keyframes spin { to { transform: rotate(360deg); } }

                @media (max-width: 1024px) {
                    .auth-visual-side { display: none; }
                    .auth-header-mobile { display: block; }
                    .auth-container { justify-content: center; background: #f8fafc; }
                    .auth-card { background: white; padding: 2.5rem; border-radius: 24px; box-shadow: 0 4px 20px rgba(0,0,0,0.05); border: 1px solid #e2e8f0; }
                }

                @media (max-width: 640px) {
                    .auth-card { padding: 1.5rem; border: none; box-shadow: none; background: transparent; }
                    .social-auth { grid-template-columns: 1fr; }
                    .auth-form-side { padding: 1rem; }
                }
            `}</style>
        </div>
    );
};

const Star = ({ filled }) => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
);

export default LoginPage;
