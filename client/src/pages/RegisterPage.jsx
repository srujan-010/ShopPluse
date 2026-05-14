import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { 
    Store, 
    Activity, 
    ArrowUpRight, 
    Mail, 
    Lock, 
    User, 
    Eye, 
    EyeOff, 
    ArrowRight, 
    CheckCircle2, 
    TrendingUp, 
    Bell, 
    Smartphone,
    Globe,
    Layout,
    AlertCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { CustomCheckbox } from '../components/PremiumUI';
import { signInWithGoogle } from '../firebase';

const RegisterPage = () => {
    const navigate = useNavigate();
    const [showPassword, setShowPassword] = useState(false);
    const [password, setPassword] = useState('');
    const [passwordStrength, setPasswordStrength] = useState(0);
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        password: '',
        confirmPassword: ''
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const calculateStrength = (pass) => {
        let strength = 0;
        if (pass.length >= 8) strength += 25;
        if (/[A-Z]/.test(pass)) strength += 25;
        if (/[0-9]/.test(pass)) strength += 25;
        if (/[^A-Za-z0-9]/.test(pass)) strength += 25;
        return strength;
    };

    useEffect(() => {
        setPasswordStrength(calculateStrength(password));
    }, [password]);

    const { register: authRegister } = useAuth();

    const handleGoogleLogin = async () => {
        setLoading(true);
        setError('');
        try {
            await signInWithGoogle();
        } catch (err) {
            console.error('Google login error:', err);
            setError('Failed to sign in with Google. Please try again.');
            setLoading(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (formData.password !== formData.confirmPassword) {
            return setError('Passwords do not match');
        }
        
        setLoading(true);
        setError('');
        
        try {
            await authRegister(formData);
            navigate('/shops');
        } catch (err) {
            console.error('Registration Error Full Object:', err);
            if (err.response) {
                console.log('Error Response Data:', err.response.data);
            }
            if (!err.response) {
                setError('Server unreachable. Please check your connection.');
            } else if (err.response.data && err.response.data.message) {
                setError(err.response.data.message);
            } else {
                setError('Error Body: ' + JSON.stringify(err.response.data) || 'Registration failed. Check console.');
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
                        <h1>Create your account</h1>
                        <p>Start managing your shops smarter today.</p>
                    </div>

                    <div className="social-auth">
                        <button 
                            className="social-btn" 
                            type="button" 
                            onClick={handleGoogleLogin}
                            disabled={loading}
                        >
                            <Globe size={20} />
                            <span>Continue with Google</span>
                        </button>
                        <button className="social-btn" type="button" disabled={loading}>
                            <Layout size={20} />
                            <span>Continue with Apple</span>
                        </button>
                    </div>

                    <div className="divider">
                        <span>or continue with email</span>
                    </div>

                    <form onSubmit={handleSubmit} className="auth-form">
                        <AnimatePresence>
                            {error && (
                                <motion.div 
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: 'auto' }}
                                    exit={{ opacity: 0, height: 0 }}
                                    className="error-message"
                                >
                                    <AlertCircle size={18} />
                                    <span>{error}</span>
                                </motion.div>
                            )}
                        </AnimatePresence>
                        
                        <div className="input-group">
                            <label>Full Name</label>
                            <div className="input-wrapper">
                                <User className="input-icon" size={18} />
                                <input 
                                    type="text" 
                                    placeholder="John Doe"
                                    required 
                                    value={formData.name}
                                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                                />
                            </div>
                        </div>

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
                            <label>Password</label>
                            <div className="input-wrapper">
                                <Lock className="input-icon" size={18} />
                                <input 
                                    type={showPassword ? "text" : "password"} 
                                    placeholder="••••••••"
                                    required 
                                    value={formData.password}
                                    onChange={(e) => {
                                        setFormData({...formData, password: e.target.value});
                                        setPassword(e.target.value);
                                    }}
                                />
                                <button 
                                    type="button" 
                                    className="password-toggle"
                                    onClick={() => setShowPassword(!showPassword)}
                                >
                                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                </button>
                            </div>
                            
                            {password.length > 0 && (
                                <div className="password-strength">
                                    <div className="strength-bar">
                                        <div 
                                            className={`strength-fill ${passwordStrength <= 25 ? 'weak' : passwordStrength <= 50 ? 'fair' : passwordStrength <= 75 ? 'good' : 'strong'}`}
                                            style={{ width: `${passwordStrength}%` }}
                                        ></div>
                                    </div>
                                    <div className="strength-labels">
                                        <span className={password.length >= 8 ? 'met' : ''}>8+ chars</span>
                                        <span className={/[A-Z]/.test(password) ? 'met' : ''}>Uppercase</span>
                                        <span className={/[0-9]/.test(password) ? 'met' : ''}>Number</span>
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="input-group">
                            <label>Confirm Password</label>
                            <div className="input-wrapper">
                                <Lock className="input-icon" size={18} />
                                <input 
                                    type="password" 
                                    placeholder="••••••••"
                                    required 
                                    value={formData.confirmPassword}
                                    onChange={(e) => setFormData({...formData, confirmPassword: e.target.value})}
                                />
                            </div>
                        </div>

                        <div className="auth-options">
                            <CustomCheckbox 
                                label={
                                    <span className="label-text">
                                        I agree to the <Link to="/terms">Terms</Link> & <Link to="/privacy">Privacy Policy</Link>
                                    </span>
                                }
                                checked={formData.agreed}
                                onChange={(e) => setFormData({...formData, agreed: e.target.checked})}
                                required
                            />
                        </div>

                        <button type="submit" className="btn btn-primary auth-btn" disabled={loading}>
                            {loading ? <div className="spinner"></div> : (
                                <>Start Free Trial <ArrowRight size={18} /></>
                            )}
                        </button>
                        
                        <p className="auth-footer-note">🔒 No credit card required</p>
                    </form>

                    <div className="auth-card-footer">
                        Already have an account? <Link to="/login">Log in</Link>
                    </div>
                </motion.div>
            </div>

            {/* Right Side: Visuals */}
            <div className="auth-visual-side">
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
                            Grow Every Shop with <br />
                            <span className="p-gradient-text">Smart Insights</span>
                        </motion.h2>
                        <motion.p
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: 0.3 }}
                        >
                            Track sales, stock, profit, and expenses across all your stores in real time.
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
                        <p>Rated 5/5 by 10,000+ Business Owners</p>
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
                    max-width: 480px;
                    width: 100%;
                    margin: auto;
                    padding: 1rem;
                }

                .auth-card-header {
                    margin-bottom: 2rem;
                }

                .auth-card-header h1 {
                    font-size: 2rem;
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
                    border-radius: 99px;
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
                    gap: 1.25rem;
                }

                .input-group {
                    display: flex;
                    flex-direction: column;
                    gap: 0.5rem;
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
                    padding: 0.75rem 1rem 0.75rem 2.75rem;
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
                    padding: 0;
                }

                .password-strength {
                    margin-top: 0.5rem;
                }

                .strength-bar {
                    height: 4px;
                    background: #f1f5f9;
                    border-radius: 2px;
                    overflow: hidden;
                    margin-bottom: 0.5rem;
                }

                .strength-fill {
                    height: 100%;
                    transition: all 0.3s ease;
                }

                .strength-fill.weak { background: #ef4444; }
                .strength-fill.fair { background: #f59e0b; }
                .strength-fill.good { background: #3b82f6; }
                .strength-fill.strong { background: #10b981; }

                .strength-labels {
                    display: flex;
                    gap: 1rem;
                    font-size: 0.7rem;
                    color: #94a3b8;
                }

                .strength-labels span.met {
                    color: #10b981;
                }

                .auth-options {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                }

                .checkbox-container {
                    display: flex;
                    align-items: center;
                    gap: 0.75rem;
                    cursor: pointer;
                    font-size: 0.875rem;
                    color: #64748b;
                }

                .label-text a {
                    color: #2563eb;
                    text-decoration: none;
                    font-weight: 500;
                }

                .auth-btn {
                    width: 100%;
                    padding: 0.875rem;
                    font-size: 1rem;
                    font-weight: 600;
                    margin-top: 0.5rem;
                    border-radius: 99px;
                    background: #0f172a;
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

                .auth-footer-note {
                    text-align: center;
                    font-size: 0.8rem;
                    color: #94a3b8;
                    margin: 0;
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
                    background: #f8fafc;
                    border-left: 1px solid #f1f5f9;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    padding: 4rem;
                    color: #0f172a;
                    position: relative;
                    overflow: hidden;
                }

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
                    line-height: 1.6;
                }

                /* Mockup Style */
                .visual-mockup-container {
                    position: relative;
                    perspective: 1000px;
                }

                .mockup-card {
                    background: #ffffff;
                    border: 1px solid #e2e8f0;
                    border-radius: 24px;
                    padding: 1.5rem;
                    transform: rotateX(5deg) rotateY(-5deg);
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
                .mockup-info strong { color: #0f172a; font-size: 1rem; }
                .mockup-badge { background: #dcfce7; color: #166534; font-size: 0.7rem; font-weight: 700; padding: 0.25rem 0.75rem; border-radius: 99px; }

                .mockup-row { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1rem; }
                .mini-card { background: #f8fafc; padding: 1rem; border-radius: 16px; border: 1px solid #f1f5f9; display: flex; flex-direction: column; }
                .mini-card .label { font-size: 0.75rem; color: #64748b; font-weight: 600; }
                .mini-card .value { font-size: 1.25rem; font-weight: 800; color: #0f172a; margin: 4px 0; }
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
                    border: 1px solid #fee2e2;
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    margin-bottom: 0.5rem;
                    overflow: hidden;
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

export default RegisterPage;
