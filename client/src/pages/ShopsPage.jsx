import React, { useState, useEffect } from 'react';
import { Plus, Search, Edit2, Trash2, MapPin, Phone, Store, ArrowRight, MoreHorizontal, LayoutGrid, List } from 'lucide-react';
import { shopService } from '../services/api';
import { motion, AnimatePresence } from 'framer-motion';
import { EmptyState, Skeleton, CustomSelect, ConfirmModal } from '../components/PremiumUI';
import { useScrollLock } from '../hooks/useScrollLock';

const ShopsPage = () => {
    const [shops, setShops] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [currentShop, setCurrentShop] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [formData, setFormData] = useState({
        name: '',
        type: '',
        location: '',
        contactNumber: '',
        ownerName: '',
        whatsappNumber: '',
        logo: '',
        invoicePrefix: 'LK',
        currency: '₹',
        gstNumber: '',
        email: '',
        footerMessage: 'Thank you visit again',
        upiId: ''
    });
    const [step, setStep] = useState(1);
    const [formErrors, setFormErrors] = useState({});
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [deleteConfirm, setDeleteConfirm] = useState({ open: false, id: null });

    useEffect(() => {
        fetchShops();
    }, []);

    // Lock body scroll when modal is open
    useScrollLock(showModal);

    const fetchShops = async () => {
        try {
            const res = await shopService.getAll();
            setShops(res.data.data);
        } catch (err) {
            console.error('Error fetching shops:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleOpenModal = (shop = null) => {
        if (shop) {
            setCurrentShop(shop);
            setFormData({
                name: shop.name || '',
                type: shop.type || '',
                location: shop.location || '',
                contactNumber: shop.contactNumber || '',
                ownerName: shop.ownerName || '',
                whatsappNumber: shop.whatsappNumber || '',
                logo: shop.logo || '',
                invoicePrefix: shop.invoicePrefix || 'LK',
                currency: shop.currency || '₹',
                gstNumber: shop.gstNumber || '',
                email: shop.email || '',
                footerMessage: shop.footerMessage || 'Thank you visit again',
                upiId: shop.upiId || ''
            });
        } else {
            setCurrentShop(null);
            setFormData({ 
                name: '', 
                type: '', 
                location: '', 
                contactNumber: '',
                ownerName: '',
                whatsappNumber: '',
                logo: '',
                invoicePrefix: 'LK',
                currency: '₹',
                gstNumber: '',
                email: '',
                footerMessage: 'Thank you visit again',
                upiId: ''
            });
        }
        setStep(1);
        setFormErrors({});
        setShowModal(true);
    };

    const validateStep = (currentStep) => {
        const errors = {};
        if (currentStep === 1) {
            if (!formData.name?.trim()) errors.name = 'Business Name is required';
            if (!formData.type) errors.type = 'Category is required';
            if (!formData.contactNumber?.trim()) errors.contactNumber = 'Contact Number is required';
        } else if (currentStep === 2) {
            if (!formData.location?.trim()) errors.location = 'Full Address is required';
        }
        setFormErrors(errors);
        return Object.keys(errors).length === 0;
    };

    const handleNext = (e) => {
        if (e) e.preventDefault();
        if (validateStep(step)) {
            // Auto-generate invoice prefix if not present
            if (step === 1 && !formData.invoicePrefix && formData.name) {
                const prefix = formData.name.substring(0, 2).toUpperCase();
                setFormData(prev => ({ ...prev, invoicePrefix: prefix }));
            }
            setStep(prev => prev + 1);
        }
    };

    const handleBack = (e) => {
        if (e) e.preventDefault();
        setStep(prev => Math.max(1, prev - 1));
    };

    const handleSubmit = async (e) => {
        if (e) e.preventDefault();
        if (!validateStep(step)) return;
        
        setIsSubmitting(true);
        try {
            if (currentShop) {
                await shopService.update(currentShop._id, formData);
            } else {
                await shopService.create(formData);
            }
            fetchShops();
            setShowModal(false);
        } catch (err) {
            console.error('Error saving shop:', err);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDelete = async (id) => {
        setDeleteConfirm({ open: true, id });
    };

    const confirmDelete = async () => {
        try {
            await shopService.delete(deleteConfirm.id);
            fetchShops();
            setDeleteConfirm({ open: false, id: null });
        } catch (err) {
            console.error('Error deleting shop:', err);
        }
    };

    const filteredShops = shops.filter(s => 
        s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.location.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="shops-container">
            {/* Header Section */}
            <div className="shops-header">
                <div className="header-text">
                    <h1>Your Shops</h1>
                    <p>Manage and monitor all your business locations</p>
                </div>
                <button className="btn btn-primary add-shop-btn" onClick={() => handleOpenModal()}>
                    <Plus size={20} />
                    <span>Add New Shop</span>
                </button>
            </div>

            {/* Toolbar Section */}
            <div className="shops-toolbar">
                <div className="search-pill">
                    <Search size={18} />
                    <input 
                        type="text" 
                        placeholder="Search by name or city..." 
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>
                <div className="view-toggle hide-mobile">
                    <button className="view-btn active"><LayoutGrid size={18} /></button>
                    <button className="view-btn"><List size={18} /></button>
                </div>
            </div>

            {/* Shops Grid */}
            <div className="shops-grid">
                {loading ? (
                    [1, 2, 3].map(i => (
                        <div key={i} className="card" style={{ padding: '24px' }}>
                            <div style={{ display: 'flex', gap: '16px', marginBottom: '20px' }}>
                                <Skeleton circle={true} width="48px" height="48px" />
                                <div style={{ flex: 1 }}>
                                    <Skeleton height="24px" width="60%" className="mb-2" />
                                    <Skeleton height="16px" width="40%" />
                                </div>
                            </div>
                            <Skeleton height="100px" borderRadius="16px" />
                        </div>
                    ))
                ) : filteredShops.length === 0 ? (
                    <div style={{ gridColumn: '1 / -1', padding: '40px 0' }}>
                        <EmptyState 
                            icon={Store}
                            title={searchQuery ? "No matching shops" : "No Shops Found"}
                            description={searchQuery ? `We couldn't find any shops matching "${searchQuery}".` : "Get started by adding your first business location to manage inventory and sales."}
                            actionLabel={searchQuery ? "Clear Search" : "Add Your First Shop"}
                            onAction={searchQuery ? () => setSearchQuery('') : () => handleOpenModal()}
                        />
                    </div>
                ) : (
                    <AnimatePresence>
                        {filteredShops.map((shop, index) => (
                            <motion.div 
                                key={shop._id}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: index * 0.1 }}
                                className="card shop-card"
                            >
                                <div className="shop-card-top">
                                    <div className="shop-visual">
                                        <div className="shop-initials">{shop.name.charAt(0)}</div>
                                        <div className="shop-type-tag">{shop.type}</div>
                                    </div>
                                    <div className="shop-actions">
                                        <button className="action-btn" onClick={() => handleOpenModal(shop)}><Edit2 size={16} /></button>
                                        <button className="action-btn delete" onClick={() => handleDelete(shop._id)}><Trash2 size={16} /></button>
                                    </div>
                                </div>
                                
                                <div className="shop-card-content">
                                    <h3>{shop.name}</h3>
                                    <div className="info-row">
                                        <MapPin size={14} />
                                        <span>{shop.location}</span>
                                    </div>
                                    <div className="info-row">
                                        <Phone size={14} />
                                        <span>{shop.contactNumber}</span>
                                    </div>
                                </div>

                                <div className="shop-card-footer">
                                    <div className="shop-stats">
                                        <div className="stat">
                                            <span className="s-label">Products</span>
                                            <span className="s-value">124</span>
                                        </div>
                                        <div className="stat">
                                            <span className="s-label">Sales</span>
                                            <span className="s-value">₹24.5k</span>
                                        </div>
                                    </div>
                                    <button 
                                        className="btn-enter" 
                                        onClick={() => window.location.href = `/shop/${shop._id}/dashboard`}
                                    >
                                        Enter Shop <ArrowRight size={16} />
                                    </button>
                                </div>
                            </motion.div>
                        ))}
                    </AnimatePresence>
                )}
            </div>

            {/* Premium Modal */}
            <AnimatePresence>
                {showModal && (
                    <div className="modal-wrapper">
                        <motion.div 
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="modal-backdrop" 
                            onClick={() => setShowModal(false)}
                        />
                        <motion.div 
                            initial={{ opacity: 0, scale: 0.9, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.9, y: 20 }}
                            className="card modal-content"
                        >
                            {/* Bottom Sheet Handle */}
                            <div className="sheet-drag-handle"></div>

                            <div className="modal-header-wizard">
                                <div>
                                    <h2>{currentShop ? 'Edit Business' : 'Create Business'}</h2>
                                    <p className="subtitle-premium">Set up your shop profile</p>
                                </div>
                                <p className="step-indicator">{step} / 3</p>
                            </div>

                            {/* Progress Bar */}
                            <div className="progress-bar-wrapper">
                                <div className={`progress-bar-fill step-${step}`}></div>
                            </div>
                            
                            <form onSubmit={handleSubmit} className="wizard-form-content">
                                {step === 1 && (
                                    <motion.div 
                                        initial={{ opacity: 0, x: 20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        exit={{ opacity: 0, x: -20 }}
                                        className="wizard-step"
                                    >
                                        <div className="input-group-premium">
                                            <label>Business Name *</label>
                                            <input 
                                                className="input-control-premium" 
                                                placeholder="e.g. Laxmipathi Stores"
                                                value={formData.name}
                                                onChange={(e) => setFormData({...formData, name: e.target.value})}
                                                required 
                                            />
                                            {formErrors.name && <span className="error-inline">{formErrors.name}</span>}
                                        </div>

                                        <div className="input-row-premium">
                                            <CustomSelect 
                                                label="Category *"
                                                value={formData.type}
                                                options={[
                                                    { label: 'Select', value: '' },
                                                    { label: 'Grocery', value: 'Grocery' },
                                                    { label: 'Electronics', value: 'Electronics' },
                                                    { label: 'Clothing', value: 'Clothing' },
                                                    { label: 'Pharmacy', value: 'Pharmacy' },
                                                    { label: 'Other', value: 'Other' }
                                                ]}
                                                onChange={(val) => setFormData({...formData, type: val})}
                                                error={formErrors.type}
                                            />

                                            <div className="input-group-premium flex-1">
                                                <label>Owner Name</label>
                                                <input 
                                                    className="input-control-premium" 
                                                    placeholder="Full name"
                                                    value={formData.ownerName}
                                                    onChange={(e) => setFormData({...formData, ownerName: e.target.value})}
                                                />
                                            </div>
                                        </div>

                                        <div className="input-group-premium">
                                            <label>Contact Number *</label>
                                            <div className="phone-input-wrapper">
                                                <span className="country-code">+91</span>
                                                <input 
                                                    className="input-control-premium phone-input"
                                                    type="tel"
                                                    inputMode="numeric"
                                                    pattern="[0-9]*"
                                                    placeholder="9876543210"
                                                    value={formData.contactNumber}
                                                    onChange={(e) => setFormData({...formData, contactNumber: e.target.value})}
                                                    required 
                                                />
                                            </div>
                                            {formErrors.contactNumber && <span className="error-inline">{formErrors.contactNumber}</span>}
                                        </div>
                                    </motion.div>
                                )}

                                {step === 2 && (
                                    <motion.div 
                                        initial={{ opacity: 0, x: 20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        exit={{ opacity: 0, x: -20 }}
                                        className="wizard-step"
                                    >
                                        <div className="input-group-premium">
                                            <label>Full Address *</label>
                                            <input 
                                                className="input-control-premium"
                                                placeholder="Shop address location"
                                                value={formData.location}
                                                onChange={(e) => setFormData({...formData, location: e.target.value})}
                                                required 
                                            />
                                            {formErrors.location && <span className="error-inline">{formErrors.location}</span>}
                                        </div>

                                        <div className="input-row-premium">
                                            <div className="input-group-premium flex-65">
                                                <label>Invoice Prefix</label>
                                                <input 
                                                    className="input-control-premium"
                                                    placeholder="LK"
                                                    value={formData.invoicePrefix}
                                                    onChange={(e) => setFormData({...formData, invoicePrefix: e.target.value})}
                                                />
                                            </div>

                                            <div className="input-group-premium flex-35">
                                                <label>Currency</label>
                                                <input 
                                                    className="input-control-premium"
                                                    placeholder="₹"
                                                    value={formData.currency}
                                                    onChange={(e) => setFormData({...formData, currency: e.target.value})}
                                                />
                                            </div>
                                        </div>

                                        <div className="input-group-premium">
                                            <label>GST Number</label>
                                            <input 
                                                className="input-control-premium"
                                                placeholder="GSTIN"
                                                value={formData.gstNumber}
                                                onChange={(e) => setFormData({...formData, gstNumber: e.target.value})}
                                            />
                                        </div>
                                    </motion.div>
                                )}

                                {step === 3 && (
                                    <motion.div 
                                        initial={{ opacity: 0, x: 20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        exit={{ opacity: 0, x: -20 }}
                                        className="wizard-step"
                                    >
                                        <div className="input-group-premium">
                                            <label>WhatsApp Number</label>
                                            <input 
                                                className="input-control-premium"
                                                type="tel"
                                                inputMode="numeric"
                                                placeholder="WhatsApp updates"
                                                value={formData.whatsappNumber}
                                                onChange={(e) => setFormData({...formData, whatsappNumber: e.target.value})}
                                            />
                                        </div>

                                        <div className="input-group-premium">
                                            <label>Business Email</label>
                                            <input 
                                                className="input-control-premium"
                                                type="email"
                                                inputMode="email"
                                                placeholder="Email for accounts"
                                                value={formData.email}
                                                onChange={(e) => setFormData({...formData, email: e.target.value})}
                                            />
                                        </div>

                                        <div className="input-group-premium">
                                            <label>UPI / Payment ID</label>
                                            <input 
                                                className="input-control-premium"
                                                placeholder="upi@paymentid"
                                                value={formData.upiId}
                                                onChange={(e) => setFormData({...formData, upiId: e.target.value})}
                                            />
                                        </div>

                                        <div className="input-group-premium">
                                            <label>Footer Invoice Message</label>
                                            <input 
                                                className="input-control-premium"
                                                placeholder="Thank you visit again"
                                                value={formData.footerMessage}
                                                onChange={(e) => setFormData({...formData, footerMessage: e.target.value})}
                                            />
                                        </div>
                                    </motion.div>
                                )}

                                <div className="wizard-sticky-footer">
                                    {step === 1 ? (
                                        <button 
                                            type="button" 
                                            className="btn btn-outline-premium" 
                                            onClick={() => setShowModal(false)}
                                        >
                                            Cancel
                                        </button>
                                    ) : (
                                        <button 
                                            type="button" 
                                            className="btn btn-outline-premium" 
                                            onClick={handleBack}
                                        >
                                            Back
                                        </button>
                                    )}

                                    {step < 3 ? (
                                        <button 
                                            type="button" 
                                            className="btn btn-primary-premium" 
                                            onClick={handleNext}
                                        >
                                            Next
                                        </button>
                                    ) : (
                                        <button 
                                            type="submit" 
                                            className="btn btn-primary-premium"
                                            disabled={isSubmitting}
                                        >
                                            {isSubmitting ? 'Saving...' : (currentShop ? 'Save' : 'Create')}
                                        </button>
                                    )}
                                </div>
                            </form>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            <style jsx="true">{`
                .shops-container {
                    padding-bottom: 2rem;
                }

                .shops-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 2rem;
                }

                .header-text h1 { font-size: 1.75rem; font-weight: 800; color: var(--text-main); margin-bottom: 0.25rem; }
                .header-text p { color: var(--text-muted); font-size: 0.95rem; }

                .shops-toolbar {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 2rem;
                    gap: 1rem;
                }

                .search-pill {
                    display: flex;
                    align-items: center;
                    background: white;
                    padding: 0.5rem 1.25rem;
                    border-radius: 99px;
                    border: 1.5px solid var(--border);
                    flex: 1;
                    max-width: 400px;
                    box-shadow: var(--shadow-sm);
                }

                .search-pill input {
                    border: none;
                    background: transparent;
                    padding: 0.5rem;
                    width: 100%;
                    outline: none;
                    font-size: 0.9rem;
                    margin-left: 0.5rem;
                }

                .view-toggle {
                    display: flex;
                    background: white;
                    padding: 4px;
                    border-radius: 12px;
                    border: 1px solid var(--border);
                }

                .view-btn {
                    padding: 0.5rem;
                    border-radius: 8px;
                    border: none;
                    background: transparent;
                    color: var(--text-muted);
                    cursor: pointer;
                }

                .view-btn.active {
                    background: var(--primary-light);
                    color: var(--primary);
                }

                /* Grid Layout */
                .shops-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
                    gap: 1.5rem;
                }

                /* Mobile Optimization - Ultra Compact ERP UI */
                @media (max-width: 768px) {
                    .shops-container { padding: 12px; padding-bottom: 90px; }
                    .shops-header { flex-direction: row; align-items: center; justify-content: space-between; position: sticky; top: 0; background: #F6F8FC; z-index: 100; padding-top: 8px; margin-bottom: 8px; flex-wrap: wrap; gap: 8px; }
                    .header-text { width: 100%; }
                    .header-text h1 { font-size: 20px; margin-bottom: 0; }
                    .header-text p { font-size: 11px; margin-top: 2px; }
                    .add-shop-btn { width: 100%; height: 44px; font-size: 13px; border-radius: 12px; }
                    
                    .shops-toolbar { margin-bottom: 12px; gap: 8px; flex-direction: column; }
                    .search-pill { width: 100%; max-width: 100%; padding: 0 12px; height: 44px; border-radius: 12px; }
                    .search-pill input { font-size: 13px; }
                    .view-toggle { display: none; }

                    .shops-grid { grid-template-columns: 1fr; gap: 12px; }
                    .shop-card { padding: 12px; border-radius: 16px; gap: 10px; }
                    .shop-initials { width: 36px; height: 36px; border-radius: 10px; font-size: 16px; }
                    .shop-type-tag { font-size: 9px; padding: 2px 8px; }
                    .action-btn { padding: 6px; border-radius: 8px; }
                    .action-btn svg { width: 14px; height: 14px; }
                    
                    .shop-card-content h3 { font-size: 16px; margin-bottom: 4px; }
                    .info-row { font-size: 11px; gap: 6px; }
                    
                    .shop-card-footer { padding-top: 12px; }
                    .s-label { font-size: 9px; }
                    .s-value { font-size: 13px; }
                    .btn-enter { font-size: 12px; }
                }

                .shop-card {
                    padding: 1.5rem;
                    display: flex;
                    flex-direction: column;
                    gap: 1.25rem;
                }

                .shop-card-top {
                    display: flex;
                    justify-content: space-between;
                    align-items: flex-start;
                }

                .shop-visual {
                    display: flex;
                    align-items: center;
                    gap: 1rem;
                }

                .shop-initials {
                    width: 48px;
                    height: 48px;
                    background: var(--primary);
                    color: white;
                    border-radius: 14px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 1.25rem;
                    font-weight: 800;
                    box-shadow: 0 4px 12px rgba(37, 99, 235, 0.25);
                }

                .shop-type-tag {
                    font-size: 0.7rem;
                    font-weight: 700;
                    padding: 4px 10px;
                    background: var(--primary-light);
                    color: var(--primary);
                    border-radius: 6px;
                    text-transform: uppercase;
                }

                .shop-actions { display: flex; gap: 0.5rem; }
                .action-btn {
                    padding: 0.5rem;
                    border-radius: 8px;
                    border: 1px solid var(--border);
                    background: white;
                    color: var(--text-muted);
                    cursor: pointer;
                    transition: all 0.2s;
                }

                .action-btn:hover { color: var(--primary); border-color: var(--primary); background: var(--primary-light); }
                .action-btn.delete:hover { color: var(--danger); border-color: var(--danger); background: #fef2f2; }

                .shop-card-content h3 { font-size: 1.25rem; font-weight: 800; margin-bottom: 0.5rem; }
                .info-row { display: flex; align-items: center; gap: 0.5rem; color: var(--text-muted); font-size: 0.85rem; margin-bottom: 0.25rem; }

                .shop-card-footer {
                    margin-top: auto;
                    padding-top: 1.25rem;
                    border-top: 1px solid var(--border);
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                }

                .shop-stats { display: flex; gap: 1.5rem; }
                .stat { display: flex; flex-direction: column; }
                .s-label { font-size: 0.65rem; font-weight: 700; color: #94a3b8; text-transform: uppercase; }
                .s-value { font-size: 0.9rem; font-weight: 800; color: var(--text-main); }

                .btn-enter {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    color: var(--primary);
                    font-weight: 700;
                    font-size: 0.85rem;
                    background: transparent;
                    border: none;
                    cursor: pointer;
                }

                .btn-enter:hover { text-decoration: underline; }

                /* Premium Mobile Wizard Styling */
                .modal-wrapper { 
                    position: fixed; 
                    inset: 0; 
                    background: rgba(0,0,0,0.45); 
                    backdrop-filter: blur(6px); 
                    z-index: 9999; 
                }
                
                .modal-backdrop { 
                    position: absolute; 
                    inset: 0; 
                    background: rgba(15, 23, 42, 0.4); 
                    backdrop-filter: blur(6px); 
                }

                .modal-content { 
                    position: fixed; 
                    left: 0; 
                    right: 0; 
                    bottom: 0; 
                    height: auto;
                    max-height: 90vh; 
                    background: white; 
                    border-radius: 28px 28px 0 0; 
                    display: flex; 
                    flex-direction: column; 
                    overflow: hidden; 
                    padding-bottom: calc(80px + env(safe-area-inset-bottom));
                    z-index: 9999;
                    box-shadow: 0 -10px 40px rgba(0,0,0,0.15);
                }

                .sheet-drag-handle {
                    width: 40px;
                    height: 4px;
                    background: #cbd5e1;
                    border-radius: 99px;
                    margin: 0.75rem auto 1rem;
                    flex-shrink: 0;
                }

                .modal-header-wizard {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 0.75rem;
                    padding: 0 1rem;
                    flex-shrink: 0;
                }

                .modal-header-wizard h2 { font-size: 1.25rem; font-weight: 800; color: #0f172a; }
                .subtitle-premium { font-size: 0.8rem; color: #64748b; margin-top: 0.25rem; }
                .step-indicator { font-size: 0.85rem; font-weight: 700; color: var(--primary); background: var(--primary-light); padding: 4px 12px; border-radius: 99px; }

                .progress-bar-wrapper {
                    width: calc(100% - 2rem);
                    height: 4px;
                    background: #e2e8f0;
                    border-radius: 99px;
                    margin: 0 auto 1.25rem;
                    overflow: hidden;
                    flex-shrink: 0;
                }

                .progress-bar-fill {
                    height: 100%;
                    background: linear-gradient(90deg, var(--primary) 0%, #3b82f6 100%);
                    transition: width 0.3s ease-in-out;
                }

                .progress-bar-fill.step-1 { width: 33.33%; }
                .progress-bar-fill.step-2 { width: 66.66%; }
                .progress-bar-fill.step-3 { width: 100%; }

                .wizard-form-content {
                    flex: 1;
                    overflow-y: auto;
                    overscroll-behavior: contain;
                    -webkit-overflow-scrolling: touch;
                    padding: 0 1rem 1rem;
                }

                .wizard-step {
                    display: flex;
                    flex-direction: column;
                    gap: 1rem;
                }

                .input-row-premium {
                    display: flex;
                    gap: 0.75rem;
                    width: 100%;
                }

                .input-row-premium .flex-1 {
                    flex: 1;
                    min-width: 0;
                }

                .input-row-premium .flex-35 {
                    flex: 0 0 35%;
                    min-width: 0;
                }

                .input-row-premium .flex-65 {
                    flex: 0 0 65%;
                    min-width: 0;
                }

                @media (max-width: 380px) {
                    .input-row-premium {
                        flex-direction: column;
                        gap: 1rem;
                    }
                    .input-row-premium .flex-35,
                    .input-row-premium .flex-65 {
                        flex: 1;
                    }
                }

                .input-group-premium {
                    display: flex;
                    flex-direction: column;
                    gap: 0.35rem;
                }

                .flex-1 { flex: 1; }

                .input-group-premium label {
                    font-size: 0.8rem;
                    font-weight: 700;
                    color: #475569;
                }

                .input-control-premium {
                    width: 100%;
                    box-sizing: border-box;
                    height: 48px;
                    border-radius: 12px;
                    border: 1.5px solid #e2e8f0;
                    padding: 0 1rem;
                    font-size: 0.95rem;
                    font-weight: 600;
                    color: #1e293b;
                    transition: all 0.2s ease;
                    background: #fafafa;
                    outline: none;
                }

                .input-control-premium::placeholder {
                    color: #94a3b8;
                    font-size: 0.85rem;
                }

                .input-control-premium:focus {
                    border-color: var(--primary);
                    background: white;
                    box-shadow: 0 0 0 4px rgba(37, 99, 235, 0.1);
                }

                select.input-control-premium {
                    appearance: none;
                    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%2364748b' stroke-width='2'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' d='M19 9l-7 7-7-7'/%3E%3C/svg%3E");
                    background-repeat: no-repeat;
                    background-position: right 1rem center;
                    background-size: 1rem;
                }

                .phone-input-wrapper {
                    display: flex;
                    align-items: center;
                    border: 1.5px solid #e2e8f0;
                    border-radius: 12px;
                    background: #fafafa;
                    overflow: hidden;
                }

                .country-code {
                    padding: 0 0.75rem 0 1rem;
                    font-size: 0.95rem;
                    font-weight: 700;
                    color: #64748b;
                    border-right: 1.5px solid #e2e8f0;
                    height: 48px;
                    display: flex;
                    align-items: center;
                    background: #f1f5f9;
                }

                .phone-input {
                    border: none !important;
                    border-radius: 0;
                    flex: 1;
                    height: 45px;
                }

                .error-inline {
                    font-size: 0.7rem;
                    color: var(--danger);
                    font-weight: 600;
                }

                .wizard-sticky-footer {
                    position: absolute;
                    bottom: 0;
                    left: 0;
                    right: 0;
                    background: white;
                    z-index: 1000;
                    border-top: 1px solid #eee;
                    padding: 14px 16px calc(18px + env(safe-area-inset-bottom));
                    display: flex;
                    gap: 12px;
                }

                .btn-primary-premium {
                    flex: 1;
                    height: 50px;
                    background: linear-gradient(135deg, var(--primary) 0%, #1d4ed8 100%);
                    color: white;
                    font-weight: 700;
                    border-radius: 12px;
                    border: none;
                    cursor: pointer;
                    transition: all 0.2s ease;
                    font-size: 0.95rem;
                }

                .btn-primary-premium:hover { transform: translateY(-1px); opacity: 0.95; }
                .btn-primary-premium:disabled { opacity: 0.6; cursor: not-allowed; }

                .btn-outline-premium {
                    flex: 1;
                    height: 50px;
                    background: white;
                    border: 1.5px solid #e2e8f0;
                    color: #64748b;
                    font-weight: 700;
                    border-radius: 12px;
                    cursor: pointer;
                    transition: all 0.2s ease;
                }

                .btn-outline-premium:hover { background: #f8fafc; color: #1e293b; }

                .btn-text-premium {
                    flex: 1;
                    height: 52px;
                    background: transparent;
                    border: none;
                    color: #94a3b8;
                    font-weight: 700;
                    cursor: pointer;
                }

                @media (min-width: 640px) {
                    .modal-wrapper { align-items: center; padding: 1.5rem; }
                    .modal-content { border-radius: 24px; max-height: 80vh; }
                    .wizard-form-content { max-height: calc(80vh - 140px); }
                }

                /* Empty State */
                .empty-state { grid-column: 1 / -1; display: flex; flex-direction: column; align-items: center; gap: 1rem; padding: 5rem 2rem; text-align: center; }
                .empty-state h3 { font-size: 1.5rem; font-weight: 800; }
                .empty-state p { color: var(--text-muted); max-width: 300px; margin-bottom: 1rem; }

                .skeleton-card { height: 220px; background: #f1f5f9; animation: pulse 1.5s infinite; }
            `}</style>
            <ConfirmModal 
                isOpen={deleteConfirm.open}
                title="Delete Shop?"
                message="Are you sure you want to delete this shop? This action cannot be undone and all associated data will be lost."
                onConfirm={confirmDelete}
                onCancel={() => setDeleteConfirm({ open: false, id: null })}
            />
        </div>
    );
};

export default ShopsPage;
