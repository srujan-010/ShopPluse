import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
    Store, Activity, WifiOff, Zap, Package, BookOpen, 
    BarChart3, CheckCircle2, ArrowRight, Smartphone, 
    ShieldCheck, Clock, ChevronRight, PlayCircle, Menu, X
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const LandingPage = () => {
    const [scrolled, setScrolled] = useState(false);
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

    useEffect(() => {
        const handleScroll = () => {
            setScrolled(window.scrollY > 20);
        };
        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    const fadeUpVariants = {
        hidden: { opacity: 0, y: 30 },
        visible: (i) => ({
            opacity: 1, 
            y: 0,
            transition: { delay: i * 0.1, duration: 0.6, ease: [0.22, 1, 0.36, 1] }
        })
    };

    return (
        <div className="premium-landing">
            {/* Navbar */}
            <nav className={`p-nav ${scrolled ? 'scrolled' : ''}`}>
                <div className="p-nav-container">
                    <div className="p-logo">
                        <img src="https://i.ibb.co/9mVRXF5q/Chat-GPT-Image-May-14-2026-01-56-04-PM.png" alt="ShopPulse" className="p-logo-img" />
                        <span className="p-brand">ShopPulse</span>
                    </div>
                    
                    <div className="p-nav-actions hidden-mobile">
                        <Link to="/login" className="p-btn-text">Login</Link>
                        <Link to="/register" className="p-btn p-btn-primary">Get Started</Link>
                    </div>

                    <button className="p-menu-btn hidden-desktop" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
                        {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
                    </button>
                </div>
            </nav>

            <AnimatePresence>
                {mobileMenuOpen && (
                    <motion.div 
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="p-mobile-menu"
                    >
                        <Link to="/login" className="p-mobile-link">Login to Account</Link>
                        <Link to="/register" className="p-btn p-btn-primary p-w-full">Get Started Now</Link>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Hero Section */}
            <section className="p-hero">
                <div className="p-container">
                    <div className="p-hero-content">
                        <motion.div custom={0} initial="hidden" animate="visible" variants={fadeUpVariants} className="p-hero-badges">
                            <span className="p-badge"><WifiOff size={14} /> Works Offline</span>
                            <span className="p-badge"><Zap size={14} /> Fast Billing</span>
                            <span className="p-badge"><Package size={14} /> Easy Stock</span>
                        </motion.div>
                        
                        <motion.h1 custom={1} initial="hidden" animate="visible" variants={fadeUpVariants} className="p-hero-title">
                            Simple Shop Management <br className="hidden-mobile" />
                            <span className="p-gradient-text">That Just Works</span>
                        </motion.h1>
                        
                        <motion.p custom={2} initial="hidden" animate="visible" variants={fadeUpVariants} className="p-hero-subtitle">
                            Manage sales, stock, and customer credit seamlessly — even without internet. Built specifically for your phone.
                        </motion.p>
                        
                        <motion.div custom={3} initial="hidden" animate="visible" variants={fadeUpVariants} className="p-hero-actions">
                            <Link to="/register" className="p-btn p-btn-primary p-btn-lg">
                                Start Using Now <ArrowRight size={18} />
                            </Link>
                            <button className="p-btn p-btn-secondary p-btn-lg">
                                <PlayCircle size={18} /> View Demo
                            </button>
                        </motion.div>
                    </div>

                    {/* Mobile UI Preview Mockup */}
                    <motion.div custom={4} initial={{ opacity: 0, y: 50 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4, duration: 0.8 }} className="p-hero-visual">
                        <div className="p-mobile-mockup">
                            <div className="mockup-notch"></div>
                            <div className="mockup-screen">
                                <div className="mockup-header">
                                    <div className="mockup-greeting">
                                        <span>Good Morning,</span>
                                        <strong>My Shop</strong>
                                    </div>
                                    <div className="mockup-avatar"></div>
                                </div>
                                <div className="mockup-card premium">
                                    <span>Today's Sales</span>
                                    <h2>₹ 4,520</h2>
                                    <div className="mockup-chart">
                                        <div style={{height: '40%'}}></div>
                                        <div style={{height: '70%'}}></div>
                                        <div style={{height: '50%'}}></div>
                                        <div style={{height: '90%'}}></div>
                                        <div style={{height: '60%'}}></div>
                                    </div>
                                </div>
                                <div className="mockup-grid">
                                    <div className="mockup-action"><Zap size={20} color="#2563eb" /><span>New Bill</span></div>
                                    <div className="mockup-action"><Package size={20} color="#10b981" /><span>Add Item</span></div>
                                    <div className="mockup-action"><BookOpen size={20} color="#f59e0b" /><span>Khata</span></div>
                                    <div className="mockup-action"><BarChart3 size={20} color="#8b5cf6" /><span>Reports</span></div>
                                </div>
                                <div className="mockup-list">
                                    <h4>Recent Bills</h4>
                                    <div className="mockup-list-item">
                                        <div className="li-icon"></div>
                                        <div className="li-details"><div className="li-line1"></div><div className="li-line2"></div></div>
                                        <div className="li-amount"></div>
                                    </div>
                                    <div className="mockup-list-item">
                                        <div className="li-icon"></div>
                                        <div className="li-details"><div className="li-line1" style={{width: '60%'}}></div><div className="li-line2"></div></div>
                                        <div className="li-amount"></div>
                                    </div>
                                </div>
                            </div>
                        </div>
                        {/* Decorative blur elements */}
                        <div className="p-blur-circle blur-blue"></div>
                        <div className="p-blur-circle blur-purple"></div>
                    </motion.div>
                </div>
            </section>

            {/* Trust Section */}
            <section className="p-trust">
                <div className="p-container">
                    <div className="p-trust-grid">
                        <div className="p-trust-item">
                            <ShieldCheck className="trust-icon" />
                            <span>Built for real shop owners</span>
                        </div>
                        <div className="p-trust-item">
                            <Clock className="trust-icon" />
                            <span>No complicated setup</span>
                        </div>
                        <div className="p-trust-item">
                            <Smartphone className="trust-icon" />
                            <span>Works on your phone</span>
                        </div>
                    </div>
                </div>
            </section>

            {/* Core Features */}
            <section className="p-features">
                <div className="p-container">
                    <div className="p-section-header">
                        <h2>Everything you need. <span className="p-text-muted">Nothing you don't.</span></h2>
                    </div>

                    <div className="p-features-grid">
                        <FeatureCard 
                            icon={<Zap size={24} />}
                            title="Fast Billing"
                            desc="Create bills in seconds. Scan barcodes or tap products to speed up checkout."
                            color="blue"
                        />
                        <FeatureCard 
                            icon={<WifiOff size={24} />}
                            title="Offline Mode"
                            desc="Sell even without internet. Data syncs automatically when you're back online."
                            color="green"
                        />
                        <FeatureCard 
                            icon={<Package size={24} />}
                            title="Stock Management"
                            desc="Always know what's available. Get alerts when items are running low."
                            color="orange"
                        />
                        <FeatureCard 
                            icon={<BookOpen size={24} />}
                            title="Khata / Credit System"
                            desc="Track customer dues easily. Send WhatsApp reminders for pending payments."
                            color="purple"
                        />
                        <FeatureCard 
                            icon={<BarChart3 size={24} />}
                            title="Daily Reports"
                            desc="See daily sales, profit, and top-selling items at a glance."
                            color="pink"
                        />
                    </div>
                </div>
            </section>

            {/* How It Works */}
            <section className="p-how-it-works">
                <div className="p-container">
                    <div className="p-section-header text-center">
                        <h2>Start in 3 Simple Steps</h2>
                    </div>
                    
                    <div className="p-steps-container">
                        <div className="p-step">
                            <div className="p-step-number">1</div>
                            <div className="p-step-content">
                                <h3>Add Products</h3>
                                <p>Quickly add your items with name and price.</p>
                            </div>
                        </div>
                        <div className="p-step-connector"></div>
                        <div className="p-step">
                            <div className="p-step-number">2</div>
                            <div className="p-step-content">
                                <h3>Start Selling</h3>
                                <p>Create your first bill in under 10 seconds.</p>
                            </div>
                        </div>
                        <div className="p-step-connector"></div>
                        <div className="p-step">
                            <div className="p-step-number">3</div>
                            <div className="p-step-content">
                                <h3>Track Automatically</h3>
                                <p>Stock and sales are updated instantly.</p>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Real Screens Preview */}
            <section className="p-screens">
                <div className="p-container">
                    <div className="p-section-header">
                        <h2>Designed for your phone screen</h2>
                    </div>
                    
                    <div className="p-screens-slider">
                        <div className="p-screen-card">
                            <div className="p-screen-img">
                                <MockupDashboard />
                            </div>
                            <h4>Dashboard</h4>
                        </div>
                        <div className="p-screen-card">
                            <div className="p-screen-img">
                                <MockupBilling />
                            </div>
                            <h4>Fast Billing</h4>
                        </div>
                        <div className="p-screen-card">
                            <div className="p-screen-img">
                                <MockupStock />
                            </div>
                            <h4>Stock Screen</h4>
                        </div>
                        <div className="p-screen-card">
                            <div className="p-screen-img">
                                <MockupReports />
                            </div>
                            <h4>Reports</h4>
                        </div>
                    </div>
                </div>
            </section>

            {/* Why Choose Us */}
            <section className="p-why-choose">
                <div className="p-container p-why-container">
                    <div className="p-why-content">
                        <h2>Why shop owners love ShopPulse</h2>
                        <ul className="p-why-list">
                            <li><CheckCircle2 className="p-check" size={20} /> <strong>Works Offline:</strong> No internet? No problem.</li>
                            <li><CheckCircle2 className="p-check" size={20} /> <strong>Simple to Use:</strong> Needs zero training.</li>
                            <li><CheckCircle2 className="p-check" size={20} /> <strong>Built for Mobile:</strong> Manage your shop from anywhere.</li>
                            <li><CheckCircle2 className="p-check" size={20} /> <strong>No Complicated Setup:</strong> Start in 2 minutes.</li>
                        </ul>
                    </div>
                </div>
            </section>

            {/* CTA */}
            <section className="p-cta">
                <div className="p-container">
                    <div className="p-cta-card">
                        <h2>Start Managing Your Shop Today</h2>
                        <p>Join thousands of smart shop owners who have simplified their business.</p>
                        <Link to="/register" className="p-btn p-btn-primary p-btn-xl">
                            Open App <ChevronRight size={20} />
                        </Link>
                    </div>
                </div>
            </section>

            {/* Footer */}
            <footer className="p-footer">
                <div className="p-container">
                    <div className="p-footer-content">
                        <div className="p-footer-brand">
                            <div className="p-logo">
                                <img src="https://i.ibb.co/9mVRXF5q/Chat-GPT-Image-May-14-2026-01-56-04-PM.png" alt="ShopPulse" className="p-logo-img-small" />
                                <span className="p-brand">ShopPulse</span>
                            </div>
                            <p>The simple way to manage your shop.</p>
                        </div>
                        <div className="p-footer-links">
                            <a href="#">About</a>
                            <a href="#">Contact</a>
                            <a href="#">Privacy</a>
                            <a href="#">Terms</a>
                        </div>
                    </div>
                    <div className="p-footer-bottom">
                        <p>&copy; {new Date().getFullYear()} ShopPulse. All rights reserved.</p>
                    </div>
                </div>
            </footer>

            <style jsx="true">{`
                .premium-landing {
                    font-family: 'Inter', sans-serif;
                    background: #ffffff;
                    color: #0f172a;
                    overflow-x: hidden;
                    -webkit-font-smoothing: antialiased;
                }

                h1, h2, h3, .p-brand {
                    font-family: 'Plus Jakarta Sans', sans-serif;
                    letter-spacing: -0.02em;
                }

                .p-container {
                    max-width: 1200px;
                    margin: 0 auto;
                    padding: 0 1.5rem;
                }

                /* Buttons */
                .p-btn {
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    gap: 0.5rem;
                    padding: 0.6rem 1.25rem;
                    border-radius: 99px;
                    font-weight: 600;
                    font-size: 0.95rem;
                    transition: all 0.2s ease;
                    cursor: pointer;
                    text-decoration: none;
                    border: none;
                }

                .p-btn-primary {
                    background: #0f172a;
                    color: #ffffff;
                    box-shadow: 0 4px 12px rgba(15, 23, 42, 0.15);
                }

                .p-btn-primary:hover {
                    background: #1e293b;
                    transform: translateY(-1px);
                    box-shadow: 0 6px 16px rgba(15, 23, 42, 0.2);
                }

                .p-btn-secondary {
                    background: #f1f5f9;
                    color: #0f172a;
                }

                .p-btn-secondary:hover {
                    background: #e2e8f0;
                }

                .p-btn-lg {
                    padding: 0.8rem 1.75rem;
                    font-size: 1.05rem;
                }

                .p-btn-xl {
                    padding: 1rem 2.5rem;
                    font-size: 1.1rem;
                    border-radius: 16px;
                }

                .p-btn-text {
                    color: #475569;
                    font-weight: 600;
                    text-decoration: none;
                    transition: color 0.2s;
                }
                
                .p-btn-text:hover {
                    color: #0f172a;
                }

                /* Nav */
                .p-nav {
                    position: fixed;
                    top: 0;
                    left: 0;
                    right: 0;
                    z-index: 100;
                    padding: 1.25rem 0;
                    transition: all 0.3s ease;
                }

                .p-nav.scrolled {
                    background: rgba(255, 255, 255, 0.9);
                    backdrop-filter: blur(16px);
                    -webkit-backdrop-filter: blur(16px);
                    padding: 0.75rem 0;
                    border-bottom: 1px solid rgba(0,0,0,0.05);
                }

                .p-nav-container {
                    max-width: 1200px;
                    margin: 0 auto;
                    padding: 0 1.5rem;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                }

                .p-logo {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                }

                .p-logo-img { width: 40px; height: 40px; border-radius: 10px; object-fit: cover; }
                .p-logo-img-small { width: 32px; height: 32px; border-radius: 8px; object-fit: cover; }
                
                .p-logo-icon {
                    position: relative;
                    width: 32px;
                    height: 32px;
                    background: #0f172a;
                    border-radius: 8px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: white;
                }

                .icon-pulse {
                    position: absolute;
                    bottom: 2px;
                    right: 2px;
                    background: white;
                    color: #0f172a;
                    border-radius: 4px;
                    padding: 1px;
                }

                .p-brand {
                    font-size: 1.25rem;
                    font-weight: 800;
                    color: #0f172a;
                }

                .p-nav-actions {
                    display: flex;
                    align-items: center;
                    gap: 1.5rem;
                }

                .p-menu-btn {
                    background: transparent;
                    border: none;
                    color: #0f172a;
                    cursor: pointer;
                    display: flex;
                }

                .p-mobile-menu {
                    position: fixed;
                    top: 60px;
                    left: 0;
                    right: 0;
                    background: white;
                    padding: 1rem 1.5rem 1.5rem;
                    border-bottom: 1px solid #f1f5f9;
                    z-index: 99;
                    display: flex;
                    flex-direction: column;
                    gap: 1rem;
                    box-shadow: 0 10px 15px -3px rgba(0,0,0,0.05);
                }

                .p-mobile-link {
                    text-decoration: none;
                    color: #0f172a;
                    font-weight: 600;
                    padding: 0.5rem 0;
                }

                .p-w-full {
                    width: 100%;
                }

                /* Hero */
                .p-hero {
                    padding: 8rem 0 4rem;
                    min-height: 100vh;
                    display: flex;
                    align-items: center;
                    position: relative;
                    overflow: hidden;
                }

                .p-hero .p-container {
                    display: flex;
                    align-items: center;
                    gap: 4rem;
                    position: relative;
                    z-index: 2;
                }

                .p-hero-content {
                    flex: 1;
                    max-width: 600px;
                }

                .p-hero-badges {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 0.75rem;
                    margin-bottom: 2rem;
                }

                .p-badge {
                    display: inline-flex;
                    align-items: center;
                    gap: 0.4rem;
                    padding: 0.4rem 0.8rem;
                    background: #f8fafc;
                    border: 1px solid #e2e8f0;
                    border-radius: 99px;
                    font-size: 0.85rem;
                    font-weight: 600;
                    color: #475569;
                }

                .p-hero-title {
                    font-size: 4rem;
                    line-height: 1.1;
                    margin-bottom: 1.5rem;
                    color: #0f172a;
                }

                .p-gradient-text {
                    background: linear-gradient(135deg, #2563eb 0%, #10b981 100%);
                    -webkit-background-clip: text;
                    -webkit-text-fill-color: transparent;
                }

                .p-hero-subtitle {
                    font-size: 1.2rem;
                    color: #475569;
                    line-height: 1.6;
                    margin-bottom: 2.5rem;
                    max-width: 90%;
                }

                .p-hero-actions {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 1rem;
                }

                .p-hero-visual {
                    flex: 1;
                    position: relative;
                    display: flex;
                    justify-content: center;
                }

                /* Mockup Mobile */
                .p-mobile-mockup {
                    width: 300px;
                    height: 600px;
                    background: #ffffff;
                    border-radius: 40px;
                    box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25), 0 0 0 10px #0f172a;
                    position: relative;
                    overflow: hidden;
                    z-index: 2;
                    display: flex;
                    flex-direction: column;
                }

                .mockup-notch {
                    position: absolute;
                    top: 0;
                    left: 50%;
                    transform: translateX(-50%);
                    width: 120px;
                    height: 24px;
                    background: #0f172a;
                    border-bottom-left-radius: 16px;
                    border-bottom-right-radius: 16px;
                    z-index: 10;
                }

                .mockup-screen {
                    flex: 1;
                    background: #f8fafc;
                    padding: 40px 16px 16px;
                    display: flex;
                    flex-direction: column;
                    gap: 16px;
                    overflow-y: hidden;
                }

                .mockup-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                }

                .mockup-greeting span { font-size: 0.7rem; color: #64748b; display: block; }
                .mockup-greeting strong { font-size: 1.1rem; color: #0f172a; }
                .mockup-avatar { width: 32px; height: 32px; background: #e2e8f0; border-radius: 50%; }

                .mockup-card.premium {
                    background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
                    border-radius: 20px;
                    padding: 20px;
                    color: white;
                    position: relative;
                    overflow: hidden;
                }

                .mockup-card.premium span { font-size: 0.8rem; opacity: 0.8; }
                .mockup-card.premium h2 { font-size: 2rem; margin-top: 4px; }

                .mockup-chart {
                    display: flex;
                    align-items: flex-end;
                    gap: 8px;
                    height: 40px;
                    margin-top: 16px;
                }
                .mockup-chart div {
                    flex: 1;
                    background: rgba(255,255,255,0.2);
                    border-radius: 4px;
                }

                .mockup-grid {
                    display: grid;
                    grid-template-columns: repeat(4, 1fr);
                    gap: 8px;
                }

                .mockup-action {
                    background: white;
                    border-radius: 12px;
                    padding: 12px 0;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    gap: 8px;
                    box-shadow: 0 1px 3px rgba(0,0,0,0.05);
                }
                .mockup-action span { font-size: 0.65rem; font-weight: 600; color: #475569; }

                .mockup-list {
                    background: white;
                    border-radius: 16px;
                    padding: 16px;
                    flex: 1;
                }
                .mockup-list h4 { font-size: 0.9rem; margin-bottom: 12px; }
                .mockup-list-item { display: flex; align-items: center; gap: 12px; margin-bottom: 12px; }
                .li-icon { width: 36px; height: 36px; background: #f1f5f9; border-radius: 10px; }
                .li-details { flex: 1; }
                .li-line1 { height: 8px; background: #e2e8f0; width: 80%; border-radius: 4px; margin-bottom: 6px; }
                .li-line2 { height: 6px; background: #f1f5f9; width: 40%; border-radius: 4px; }
                .li-amount { width: 40px; height: 12px; background: #e2e8f0; border-radius: 4px; }

                .p-blur-circle {
                    position: absolute;
                    width: 300px;
                    height: 300px;
                    border-radius: 50%;
                    filter: blur(80px);
                    z-index: 1;
                    opacity: 0.5;
                }
                .blur-blue { background: #3b82f6; top: 10%; right: 10%; }
                .blur-purple { background: #8b5cf6; bottom: 10%; left: 10%; }

                /* Trust */
                .p-trust {
                    padding: 2rem 0;
                    border-top: 1px solid #f1f5f9;
                    border-bottom: 1px solid #f1f5f9;
                    background: #f8fafc;
                }

                .p-trust-grid {
                    display: flex;
                    justify-content: center;
                    gap: 3rem;
                    flex-wrap: wrap;
                }

                .p-trust-item {
                    display: flex;
                    align-items: center;
                    gap: 0.75rem;
                    color: #475569;
                    font-weight: 600;
                    font-size: 0.95rem;
                }

                .trust-icon { color: #10b981; }

                /* Features */
                .p-features { padding: 6rem 0; }
                
                .p-section-header {
                    margin-bottom: 4rem;
                }
                
                .p-section-header h2 {
                    font-size: 2.5rem;
                    color: #0f172a;
                }
                
                .p-text-muted { color: #94a3b8; }

                .p-features-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
                    gap: 1.5rem;
                }

                .p-feature-card {
                    padding: 2rem;
                    background: #f8fafc;
                    border-radius: 24px;
                    border: 1px solid #f1f5f9;
                    transition: all 0.3s ease;
                }

                .p-feature-card:hover {
                    background: white;
                    box-shadow: 0 20px 40px -10px rgba(0,0,0,0.05);
                    transform: translateY(-5px);
                }

                .pf-icon {
                    width: 48px;
                    height: 48px;
                    border-radius: 12px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    margin-bottom: 1.5rem;
                }
                .pf-icon.blue { background: #eff6ff; color: #2563eb; }
                .pf-icon.green { background: #ecfdf5; color: #10b981; }
                .pf-icon.orange { background: #fff7ed; color: #f97316; }
                .pf-icon.purple { background: #f5f3ff; color: #8b5cf6; }
                .pf-icon.pink { background: #fdf2f8; color: #ec4899; }

                .p-feature-card h3 {
                    font-size: 1.25rem;
                    margin-bottom: 0.75rem;
                    color: #0f172a;
                }

                .p-feature-card p {
                    color: #475569;
                    line-height: 1.6;
                }

                /* How It Works */
                .p-how-it-works {
                    padding: 6rem 0;
                    background: #f8fafc;
                }

                .text-center { text-align: center; }

                .p-steps-container {
                    display: flex;
                    justify-content: center;
                    align-items: flex-start;
                    gap: 1rem;
                    max-width: 900px;
                    margin: 0 auto;
                }

                .p-step {
                    flex: 1;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    text-align: center;
                }

                .p-step-number {
                    width: 48px;
                    height: 48px;
                    background: #0f172a;
                    color: white;
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 1.25rem;
                    font-weight: 800;
                    margin-bottom: 1.5rem;
                }

                .p-step-content h3 {
                    font-size: 1.25rem;
                    margin-bottom: 0.5rem;
                    color: #0f172a;
                }

                .p-step-content p {
                    color: #475569;
                    font-size: 0.95rem;
                    line-height: 1.5;
                }

                .p-step-connector {
                    flex: 0.5;
                    height: 2px;
                    background: #e2e8f0;
                    margin-top: 24px;
                }

                /* Screens */
                .p-screens {
                    padding: 6rem 0;
                    overflow: hidden;
                }

                .p-screens-slider {
                    display: flex;
                    gap: 2rem;
                    overflow-x: auto;
                    padding-bottom: 2rem;
                    scrollbar-width: none; /* Firefox */
                }
                .p-screens-slider::-webkit-scrollbar { display: none; } /* Chrome */

                .p-screen-card {
                    min-width: 280px;
                    display: flex;
                    flex-direction: column;
                    gap: 1.5rem;
                }

                .p-screen-card:hover .p-screen-img {
                    transform: translateY(-5px);
                    box-shadow: 0 30px 60px -15px rgba(0,0,0,0.15);
                }

                .p-screen-img {
                    height: 500px;
                    background: #f8fafc;
                    border-radius: 24px;
                    border: 8px solid #0f172a;
                    box-shadow: 0 20px 40px -10px rgba(0,0,0,0.1);
                    position: relative;
                    overflow: hidden;
                    transition: all 0.3s ease;
                }

                .rm-screen { display: flex; flex-direction: column; height: 100%; width: 100%; background: #f8fafc; font-family: 'Inter', sans-serif; }
                .rm-header { padding: 20px 16px; background: white; border-bottom: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: center; }
                .rm-subtitle { font-size: 0.65rem; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em; font-weight: 600; }
                .rm-title { font-size: 1.1rem; color: #0f172a; font-weight: 700; margin-top: 2px; }
                .rm-avatar { width: 32px; height: 32px; background: #e2e8f0; border-radius: 50%; }
                
                .rm-body { padding: 16px; flex: 1; overflow: hidden; display: flex; flex-direction: column; gap: 16px; }
                .rm-card { background: white; padding: 16px; border-radius: 16px; border: 1px solid #e2e8f0; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); }
                .rm-card.rm-dark { background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); color: white; border: none; }
                .rm-card span { font-size: 0.75rem; opacity: 0.8; }
                .rm-card h2 { font-size: 1.75rem; margin-top: 4px; }
                
                .rm-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; }
                .rm-action { background: white; padding: 12px 0; border-radius: 12px; display: flex; flex-direction: column; align-items: center; gap: 6px; border: 1px solid #e2e8f0; }
                .rm-action span { font-size: 0.6rem; font-weight: 600; color: #475569; }
                
                .rm-section-title { font-size: 0.85rem; font-weight: 700; color: #0f172a; margin-bottom: -8px; }
                .rm-list { background: white; border-radius: 16px; border: 1px solid #e2e8f0; padding: 12px; }
                .rm-list-item { display: flex; align-items: center; gap: 12px; margin-bottom: 12px; }
                .rm-list-item:last-child { margin-bottom: 0; }
                .rm-li-icon { width: 36px; height: 36px; border-radius: 10px; }
                .rm-li-icon.green { background: #ecfdf5; }
                .rm-li-icon.blue { background: #eff6ff; }
                .rm-li-icon.orange { background: #fff7ed; }
                .rm-li-text { flex: 1; }
                .rm-line1 { height: 8px; background: #e2e8f0; width: 80%; border-radius: 4px; margin-bottom: 6px; }
                .rm-line2 { height: 6px; background: #f1f5f9; width: 40%; border-radius: 4px; }
                .rm-li-amt { font-size: 0.75rem; font-weight: 700; color: #10b981; }

                .rm-search { padding-bottom: 16px; border-bottom: 1px solid #e2e8f0; }
                .rm-search-bar { background: white; border: 1px solid #e2e8f0; padding: 10px 12px; border-radius: 10px; font-size: 0.75rem; color: #94a3b8; }
                .rm-products { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; overflow-y: hidden; }
                .rm-product { background: white; border: 1px solid #e2e8f0; border-radius: 12px; padding: 8px; display: flex; flex-direction: column; gap: 8px; }
                .rm-p-img { height: 60px; background: #f1f5f9; border-radius: 8px; }
                .rm-p-name { font-size: 0.7rem; font-weight: 600; color: #0f172a; }
                .rm-p-price { font-size: 0.75rem; font-weight: 700; color: #2563eb; }
                
                .rm-cart { padding: 16px; background: white; border-top: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: center; }
                .rm-cart-info { display: flex; flex-direction: column; }
                .rm-cart-info span { font-size: 0.65rem; color: #64748b; font-weight: 600; }
                .rm-cart-info strong { font-size: 1.1rem; color: #0f172a; font-weight: 800; }
                .rm-cart-btn { background: #2563eb; color: white; padding: 8px 16px; border-radius: 8px; font-size: 0.8rem; font-weight: 600; }

                .rm-stock-stats { display: flex; gap: 12px; }
                .rm-stat { flex: 1; background: white; border: 1px solid #e2e8f0; padding: 12px; border-radius: 12px; display: flex; flex-direction: column; }
                .rm-stat span { font-size: 0.65rem; color: #64748b; font-weight: 600; }
                .rm-stat strong { font-size: 1.25rem; color: #0f172a; font-weight: 800; }
                .rm-stat.alert { border-color: #fecaca; background: #fef2f2; }
                .rm-stat.alert strong { color: #dc2626; }
                .rm-stock-item { display: flex; align-items: center; gap: 12px; padding: 12px; border-bottom: 1px solid #f1f5f9; }
                .rm-stock-item:last-child { border-bottom: none; }
                .rm-s-img { width: 40px; height: 40px; background: #f1f5f9; border-radius: 8px; }
                .rm-s-info { flex: 1; display: flex; flex-direction: column; }
                .rm-s-info strong { font-size: 0.8rem; color: #0f172a; }
                .rm-s-info span { font-size: 0.7rem; color: #64748b; }
                .rm-s-qty { font-size: 0.75rem; font-weight: 600; color: #10b981; background: #ecfdf5; padding: 4px 8px; border-radius: 99px; }
                .rm-s-qty.alert { color: #dc2626; background: #fef2f2; }

                .rm-tabs { display: flex; gap: 8px; background: #e2e8f0; padding: 4px; border-radius: 10px; }
                .rm-tab { flex: 1; text-align: center; font-size: 0.7rem; font-weight: 600; color: #475569; padding: 6px 0; border-radius: 6px; }
                .rm-tab.active { background: white; color: #0f172a; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
                .rm-chart-container { background: white; padding: 20px; border-radius: 16px; border: 1px solid #e2e8f0; display: flex; align-items: center; gap: 20px; }
                .rm-pie-chart { width: 80px; height: 80px; border-radius: 50%; background: conic-gradient(#2563eb 0% 60%, #10b981 60% 85%, #f59e0b 85% 100%); }
                .rm-chart-legend { display: flex; flex-direction: column; gap: 8px; }
                .rm-chart-legend div { display: flex; align-items: center; gap: 6px; font-size: 0.7rem; color: #475569; font-weight: 600; }
                .rm-chart-legend .dot { width: 8px; height: 8px; border-radius: 50%; }
                .rm-chart-legend .dot.blue { background: #2563eb; }
                .rm-chart-legend .dot.green { background: #10b981; }
                .rm-chart-legend .dot.orange { background: #f59e0b; }
                .rm-metrics { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
                .rm-metric { background: white; padding: 12px; border-radius: 12px; border: 1px solid #e2e8f0; display: flex; flex-direction: column; }
                .rm-metric span { font-size: 0.65rem; color: #64748b; font-weight: 600; }
                .rm-metric strong { font-size: 1rem; color: #0f172a; font-weight: 800; margin-top: 2px; }
                .rm-metric strong.green { color: #10b981; }

                .p-screen-card h4 {
                    text-align: center;
                    font-size: 1.1rem;
                    color: #0f172a;
                }

                /* Why Choose */
                .p-why-choose {
                    padding: 6rem 0;
                    background: #0f172a;
                    color: white;
                }

                .p-why-container {
                    display: flex;
                    justify-content: center;
                }

                .p-why-content {
                    max-width: 600px;
                }

                .p-why-content h2 {
                    font-size: 2.5rem;
                    margin-bottom: 2.5rem;
                }

                .p-why-list {
                    list-style: none;
                    padding: 0;
                    display: flex;
                    flex-direction: column;
                    gap: 1.5rem;
                }

                .p-why-list li {
                    display: flex;
                    align-items: center;
                    gap: 1rem;
                    font-size: 1.1rem;
                    color: #cbd5e1;
                }

                .p-check { color: #10b981; flex-shrink: 0; }
                .p-why-list li strong { color: white; }

                /* CTA */
                .p-cta {
                    padding: 6rem 0;
                }

                .p-cta-card {
                    background: linear-gradient(135deg, #f8fafc 0%, #eff6ff 100%);
                    border-radius: 32px;
                    padding: 4rem 2rem;
                    text-align: center;
                    border: 1px solid #e2e8f0;
                }

                .p-cta-card h2 {
                    font-size: 3rem;
                    margin-bottom: 1rem;
                    color: #0f172a;
                }

                .p-cta-card p {
                    font-size: 1.1rem;
                    color: #475569;
                    margin-bottom: 2.5rem;
                    max-width: 500px;
                    margin-left: auto;
                    margin-right: auto;
                }

                /* Footer */
                .p-footer {
                    border-top: 1px solid #e2e8f0;
                    padding: 4rem 0 2rem;
                    background: #ffffff;
                }

                .p-footer-content {
                    display: flex;
                    justify-content: space-between;
                    align-items: flex-start;
                    margin-bottom: 3rem;
                    flex-wrap: wrap;
                    gap: 2rem;
                }

                .p-footer-brand p {
                    color: #64748b;
                    margin-top: 1rem;
                    font-size: 0.95rem;
                }

                .p-footer-links {
                    display: flex;
                    gap: 2rem;
                }

                .p-footer-links a {
                    color: #475569;
                    text-decoration: none;
                    font-weight: 500;
                    transition: color 0.2s;
                }

                .p-footer-links a:hover {
                    color: #0f172a;
                }

                .p-footer-bottom {
                    border-top: 1px solid #f1f5f9;
                    padding-top: 2rem;
                    text-align: center;
                    color: #94a3b8;
                    font-size: 0.9rem;
                }

                /* Mobile Responsiveness */
                .hidden-desktop { display: none; }

                @media (max-width: 768px) {
                    .hidden-mobile { display: none; }
                    .hidden-desktop { display: block; }

                    .p-hero {
                        padding: 6rem 0 3rem;
                    }

                    .p-hero .p-container {
                        flex-direction: column;
                        text-align: center;
                        gap: 3rem;
                    }

                    .p-hero-badges {
                        justify-content: center;
                    }

                    .p-hero-title {
                        font-size: 2.5rem;
                    }

                    .p-hero-subtitle {
                        margin-left: auto;
                        margin-right: auto;
                    }

                    .p-hero-actions {
                        justify-content: center;
                        flex-direction: column;
                    }

                    .p-hero-actions .p-btn { width: 100%; }

                    .p-trust-grid { gap: 1.5rem; flex-direction: column; align-items: center; }

                    .p-steps-container {
                        flex-direction: column;
                        align-items: center;
                        gap: 2rem;
                    }

                    .p-step-connector {
                        width: 2px;
                        height: 40px;
                        margin-top: 0;
                    }

                    .p-section-header h2 {
                        font-size: 2rem;
                    }

                    .p-why-content h2 {
                        font-size: 2rem;
                    }

                    .p-cta-card h2 {
                        font-size: 2rem;
                    }
                    
                    .p-screens-slider {
                        padding-left: 1rem;
                        padding-right: 1rem;
                        gap: 1rem;
                        scroll-snap-type: x mandatory;
                        -webkit-overflow-scrolling: touch;
                        padding-bottom: 2rem;
                    }

                    .p-screen-card {
                        min-width: 85vw;
                        scroll-snap-align: center;
                    }
                    
                    .p-screen-img {
                        height: 520px;
                        border-width: 6px;
                    }

                    .rm-header { padding: 16px 12px; }
                    .rm-body { padding: 12px; gap: 12px; }
                    .rm-card h2 { font-size: 1.5rem; }
                    .rm-grid { gap: 6px; }
                    .rm-action { padding: 10px 0; }
                    .rm-search-bar { padding: 8px 10px; }
                    .rm-products { grid-template-columns: 1fr 1fr; gap: 8px; }
                    .rm-cart { padding: 12px; }
                    
                    .p-footer-content {
                        flex-direction: column;
                    }
                    
                    .p-footer-links {
                        flex-direction: column;
                        gap: 1rem;
                    }
                }
            `}</style>
        </div>
    );
};

const FeatureCard = ({ icon, title, desc, color }) => (
    <div className="p-feature-card">
        <div className={`pf-icon ${color}`}>
            {icon}
        </div>
        <h3>{title}</h3>
        <p>{desc}</p>
    </div>
);

const MockupDashboard = () => (
    <div className="rm-screen">
        <div className="rm-header">
            <div><span className="rm-subtitle">My Shop</span><h3 className="rm-title">Dashboard</h3></div>
            <div className="rm-avatar"></div>
        </div>
        <div className="rm-body">
            <div className="rm-card rm-dark">
                <span>Today's Sales</span>
                <h2>₹ 12,450</h2>
            </div>
            <div className="rm-grid">
                <div className="rm-action"><Zap size={16} color="#2563eb" /><span>Bill</span></div>
                <div className="rm-action"><Package size={16} color="#10b981" /><span>Stock</span></div>
                <div className="rm-action"><BookOpen size={16} color="#f59e0b" /><span>Khata</span></div>
                <div className="rm-action"><BarChart3 size={16} color="#8b5cf6" /><span>Stats</span></div>
            </div>
            <div className="rm-section-title">Recent Activity</div>
            <div className="rm-list">
                <div className="rm-list-item"><div className="rm-li-icon green"></div><div className="rm-li-text"><div className="rm-line1"></div><div className="rm-line2"></div></div><div className="rm-li-amt">+ ₹450</div></div>
                <div className="rm-list-item"><div className="rm-li-icon blue"></div><div className="rm-li-text"><div className="rm-line1" style={{width:'60%'}}></div><div className="rm-line2"></div></div><div className="rm-li-amt">+ ₹120</div></div>
                <div className="rm-list-item"><div className="rm-li-icon orange"></div><div className="rm-li-text"><div className="rm-line1" style={{width:'80%'}}></div><div className="rm-line2"></div></div><div className="rm-li-amt">+ ₹890</div></div>
            </div>
        </div>
    </div>
);

const MockupBilling = () => (
    <div className="rm-screen">
        <div className="rm-header">
            <h3 className="rm-title">Fast Billing</h3>
        </div>
        <div className="rm-body rm-billing">
            <div className="rm-search"><div className="rm-search-bar">Search products...</div></div>
            <div className="rm-products">
                <div className="rm-product"><div className="rm-p-img"></div><div className="rm-p-name">Sugar 1kg</div><div className="rm-p-price">₹45</div></div>
                <div className="rm-product"><div className="rm-p-img"></div><div className="rm-p-name">Aashirvaad Atta</div><div className="rm-p-price">₹210</div></div>
                <div className="rm-product"><div className="rm-p-img"></div><div className="rm-p-name">Tata Salt</div><div className="rm-p-price">₹25</div></div>
                <div className="rm-product"><div className="rm-p-img"></div><div className="rm-p-name">Maggi 140g</div><div className="rm-p-price">₹28</div></div>
            </div>
        </div>
        <div className="rm-cart">
            <div className="rm-cart-info"><span>3 Items</span><strong>₹ 283</strong></div>
            <div className="rm-cart-btn">Charge</div>
        </div>
    </div>
);

const MockupStock = () => (
    <div className="rm-screen">
        <div className="rm-header">
            <h3 className="rm-title">Inventory</h3>
        </div>
        <div className="rm-body">
            <div className="rm-stock-stats">
                <div className="rm-stat"><span>Total Items</span><strong>245</strong></div>
                <div className="rm-stat alert"><span>Low Stock</span><strong>12</strong></div>
            </div>
            <div className="rm-list" style={{padding:0, overflow:'hidden'}}>
                <div className="rm-stock-item"><div className="rm-s-img"></div><div className="rm-s-info"><strong>Rice 25kg</strong><span>₹1,250</span></div><div className="rm-s-qty">42 in stock</div></div>
                <div className="rm-stock-item"><div className="rm-s-img"></div><div className="rm-s-info"><strong>Milk 1L</strong><span>₹65</span></div><div className="rm-s-qty alert">2 left</div></div>
                <div className="rm-stock-item"><div className="rm-s-img"></div><div className="rm-s-info"><strong>Bread</strong><span>₹40</span></div><div className="rm-s-qty alert">Out of stock</div></div>
                <div className="rm-stock-item"><div className="rm-s-img"></div><div className="rm-s-info"><strong>Eggs 12pc</strong><span>₹80</span></div><div className="rm-s-qty">15 in stock</div></div>
            </div>
        </div>
    </div>
);

const MockupReports = () => (
    <div className="rm-screen">
        <div className="rm-header">
            <h3 className="rm-title">Reports</h3>
        </div>
        <div className="rm-body">
            <div className="rm-tabs"><div className="rm-tab active">Today</div><div className="rm-tab">Week</div><div className="rm-tab">Month</div></div>
            <div className="rm-chart-container">
                <div className="rm-pie-chart"></div>
                <div className="rm-chart-legend">
                    <div><span className="dot blue"></span>Groceries</div>
                    <div><span className="dot green"></span>Dairy</div>
                    <div><span className="dot orange"></span>Snacks</div>
                </div>
            </div>
            <div className="rm-section-title">Key Metrics</div>
            <div className="rm-metrics">
                <div className="rm-metric"><span>Revenue</span><strong>₹ 12,450</strong></div>
                <div className="rm-metric"><span>Profit</span><strong className="green">+ ₹ 3,120</strong></div>
                <div className="rm-metric"><span>Bills</span><strong>45</strong></div>
                <div className="rm-metric"><span>Avg Value</span><strong>₹ 276</strong></div>
            </div>
        </div>
    </div>
);

export default LandingPage;
