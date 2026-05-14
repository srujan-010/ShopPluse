import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    Search, 
    RefreshCw, 
    AlertCircle, 
    CheckCircle2, 
    Info,
    ChevronRight,
    ChevronDown,
    X,
    Trash2,
    Plus,
    Calendar,
    Check
} from 'lucide-react';
import { useScrollLock } from '../hooks/useScrollLock';

/**
 * Premium Empty State UI
 */
export const EmptyState = ({ 
    icon: Icon = Search, 
    title = "No data found", 
    description = "We couldn't find what you're looking for.", 
    actionLabel, 
    onAction,
    secondaryActionLabel,
    onSecondaryAction,
    compact = false
}) => (
    <motion.div 
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className={`premium-empty-state ${compact ? 'compact' : ''}`}
    >
        <div className="pes-icon-box">
            <Icon size={compact ? 32 : 48} strokeWidth={1.5} />
        </div>
        <div className="pes-content">
            <h3>{title}</h3>
            <p>{description}</p>
        </div>
        {(actionLabel || secondaryActionLabel) && (
            <div className="pes-actions">
                {secondaryActionLabel && (
                    <button className="btn-secondary-outline" onClick={onSecondaryAction}>
                        {secondaryActionLabel}
                    </button>
                )}
                {actionLabel && (
                    <button className="btn-primary-premium" onClick={onAction}>
                        {actionLabel}
                    </button>
                )}
            </div>
        )}
    </motion.div>
);

/**
 * Premium Skeleton Loader (Shimmer)
 */
export const Skeleton = ({ width = "100%", height = "20px", borderRadius = "8px", className = "" }) => (
    <div 
        className={`premium-skeleton-shimmer ${className}`} 
        style={{ width, height, borderRadius }}
    />
);

/**
 * Premium Alert/Notification Card
 */
export const AlertCard = ({ 
    type = "info", 
    title, 
    message, 
    onRetry, 
    onClose 
}) => {
    const config = {
        error: { icon: AlertCircle, color: "#B42318", bg: "#FEF3F2", border: "#FECDCA" },
        success: { icon: CheckCircle2, color: "#067647", bg: "#ECFDF3", border: "#ABEFC6" },
        info: { icon: Info, color: "#006BBD", bg: "#F5FBFF", border: "#B9E6FE" }
    }[type];

    const Icon = config.icon;

    return (
        <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="premium-alert-card"
            style={{ backgroundColor: config.bg, borderColor: config.border }}
        >
            <div className="pac-icon" style={{ color: config.color }}>
                <Icon size={20} />
            </div>
            <div className="pac-content">
                {title && <h4 style={{ color: config.color }}>{title}</h4>}
                <p style={{ color: config.color }}>{message}</p>
            </div>
            {onRetry && (
                <button className="pac-retry-btn" onClick={onRetry}>
                    <RefreshCw size={14} /> Retry
                </button>
            )}
        </motion.div>
    );
};

/**
 * Premium Page Header (Mobile Friendly)
 */
export const PageHeader = ({ 
    title, 
    subtitle, 
    backAction, 
    actions 
}) => (
    <header className="premium-page-header">
        <div className="pph-left">
            {backAction && (
                <button className="pph-back-btn" onClick={backAction}>
                    <ChevronRight size={20} style={{ transform: 'rotate(180deg)' }} />
                </button>
            )}
            <div className="pph-titles">
                <h1>{title}</h1>
                {subtitle && <p>{subtitle}</p>}
            </div>
        </div>
        {actions && (
            <div className="pph-actions">
                {actions}
            </div>
        )}
    </header>
);

/**
 * Premium Custom Select (Replaces Native Select)
 */
export const CustomSelect = ({ label, value, options, onChange, icon: Icon }) => {
    const [isOpen, setIsOpen] = React.useState(false);
    const containerRef = React.useRef(null);

    useScrollLock(isOpen);

    React.useEffect(() => {
        const handleClickOutside = (event) => {
            if (containerRef.current && !containerRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const selectedOption = options.find(opt => opt.value === value || opt === value);
    const displayValue = selectedOption?.label || selectedOption || value;

    return (
        <div className="premium-select-container" ref={containerRef}>
            {label && <label className="ps-label">{label}</label>}
            <div className={`ps-trigger ${isOpen ? 'open' : ''}`} onClick={() => setIsOpen(!isOpen)}>
                <div className="ps-trigger-left">
                    {Icon && <Icon size={18} className="ps-icon" />}
                    <span>{displayValue || 'Select...'}</span>
                </div>
                <ChevronDown size={18} className={`ps-chevron ${isOpen ? 'up' : ''}`} />
            </div>
            {isOpen && (
                <div className="ps-dropdown">
                    {options.map((opt, i) => {
                        const val = opt.value || opt;
                        const lab = opt.label || opt;
                        return (
                            <div 
                                key={i} 
                                className={`ps-option ${val === value ? 'selected' : ''}`}
                                onClick={() => { onChange(val); setIsOpen(false); }}
                            >
                                {lab}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

/**
 * Premium Searchable Select (Replaces Datalist)
 */
export const SearchableSelect = ({ label, value, options, onChange, onSearch, placeholder = "Search..." }) => {
    const [isOpen, setIsOpen] = React.useState(false);
    
    const getLabel = (val) => {
        const opt = options.find(o => (o.value || o) === val);
        return opt?.label || opt || val || '';
    };

    const [query, setQuery] = React.useState(getLabel(value));
    const containerRef = React.useRef(null);

    React.useEffect(() => {
        setQuery(getLabel(value));
    }, [value, options]);

    const filtered = options.filter(opt => 
        (opt.label || opt).toLowerCase().includes(query.toLowerCase())
    );

    useScrollLock(isOpen);

    return (
        <div className={`premium-search-select ${isOpen ? 'is-searching' : ''}`} ref={containerRef}>
            {label && <label className="ps-label">{label}</label>}
            <div className="pss-input-wrap">
                <Search size={18} className="pss-icon" />
                <input 
                    type="text"
                    value={query}
                    placeholder={placeholder}
                    onFocus={() => setIsOpen(true)}
                    onChange={(e) => {
                        const val = e.target.value;
                        setQuery(val);
                        onChange(val);
                        setIsOpen(true);
                        if (onSearch) onSearch(val);
                    }}
                />
                {isOpen && (
                    <button className="pss-close-mobile" type="button" onClick={() => setIsOpen(false)}><X size={20} /></button>
                )}
            </div>
            {isOpen && (
                <div className="pss-dropdown-portal">
                    <div className="pss-dropdown-header">
                        <span>{label || 'Select Option'}</span>
                    </div>
                    <div className="pss-options-list">
                        {filtered.length > 0 ? filtered.map((opt, i) => {
                            const val = opt.value || opt;
                            const lab = opt.label || opt;
                            return (
                                <div 
                                    key={i} 
                                    className="pss-option"
                                    onClick={() => {
                                        onChange(val);
                                        setQuery(lab);
                                        setIsOpen(false);
                                    }}
                                >
                                    {lab}
                                </div>
                            );
                        }) : (
                            <div className="pss-no-results">
                                <p>No existing matches for "<strong>{query}</strong>"</p>
                            </div>
                        )}
                        {query && !options.includes(query) && (
                            <div 
                                className="pss-option pss-add-new"
                                onClick={() => {
                                    onChange(query);
                                    setIsOpen(false);
                                }}
                            >
                                <Plus size={16} />
                                <span>Add New "{query}"</span>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

/**
 * Premium Confirmation Modal
 */
export const ConfirmModal = ({ isOpen, title, message, onConfirm, onCancel, confirmLabel = "Confirm", cancelLabel = "Cancel", type = "danger" }) => {
    useScrollLock(isOpen);

    if (!isOpen) return null;
    return (
        <div className="confirm-modal-overlay">
            <div className="confirm-modal-backdrop" onClick={onCancel} />
            <motion.div 
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                className="confirm-modal-card keyboard-aware-modal"
            >
                <div className="cm-header">
                    <h3>{title}</h3>
                    <button className="cm-close" onClick={onCancel}><X size={20} /></button>
                </div>
                <div className="cm-body">
                    <p>{message}</p>
                </div>
                <div className="cm-footer">
                    <button className="btn-secondary-outline" onClick={onCancel}>{cancelLabel}</button>
                    <button className={`btn-primary-premium ${type}`} onClick={onConfirm}>{confirmLabel}</button>
                </div>
            </motion.div>
        </div>
    );
};

/**
 * Premium Simple Message Modal (Replaces Native Alert)
 */
export const MessageModal = ({ isOpen, title, message, onClose, type = "info" }) => {
    useScrollLock(isOpen);
    if (!isOpen) return null;
    const config = {
        error: { color: "#EF4444", bg: "#FEF2F2" },
        info: { color: "#1E6BFF", bg: "#F0F7FF" },
        success: { color: "#00B26B", bg: "#F0FDF4" }
    }[type] || { color: "#1E6BFF", bg: "#F0F7FF" };

    return (
        <div className="confirm-modal-overlay">
            <div className="confirm-modal-backdrop" onClick={onClose} />
            <motion.div 
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="confirm-modal-card"
                style={{ borderLeft: `6px solid ${config.color}` }}
            >
                <div className="cm-header">
                    <h3 style={{ color: config.color }}>{title}</h3>
                    <button className="cm-close" onClick={onClose}><X size={20} /></button>
                </div>
                <div className="cm-body">
                    <p>{message}</p>
                </div>
                <div className="cm-footer">
                    <button 
                        className="btn-primary-premium" 
                        style={{ background: config.color, width: '100%', color: 'white', border: 'none', borderRadius: '12px', height: '48px', fontWeight: '700' }} 
                        onClick={onClose}
                    >
                        Okay
                    </button>
                </div>
            </motion.div>
        </div>
    );
};

/**
 * Premium Toggle / Switch
 */
export const PremiumToggle = ({ label, active, onChange }) => (
    <div className={`premium-toggle ${active ? 'active' : ''}`} onClick={() => onChange(!active)}>
        <div className="pt-switch" />
        {label && <span className="pt-label">{label}</span>}
    </div>
);

/**
 * Premium Quantity Control (Stepper)
 */
export const QuantityControl = ({ value, onChange, min = 0, max = 999999 }) => (
    <div className="premium-qty-control">
        <button type="button" className="pqc-btn" onClick={() => onChange(Math.max(min, Number(value) - 1))}><Plus size={20} style={{ transform: 'rotate(45deg)' }} /></button>
        <input 
            type="number" 
            className="pqc-input" 
            value={value} 
            onChange={(e) => {
                const val = Number(e.target.value);
                if (!isNaN(val)) onChange(Math.min(max, Math.max(min, val)));
            }}
        />
        <button type="button" className="pqc-btn" onClick={() => onChange(Math.min(max, Number(value) + 1))}><Plus size={20} /></button>
    </div>
);

/**
 * Premium Option Group (Replacement for Radio Buttons)
 */
export const OptionGroup = ({ options, value, onChange, label }) => (
    <div className="premium-option-group-wrapper">
        {label && <label className="ps-label mb-2 block">{label}</label>}
        <div className="premium-option-group">
            {options.map((opt, i) => {
                const isActive = (opt.value || opt) === value;
                return (
                    <div 
                        key={i} 
                        className={`pog-option ${isActive ? 'active' : ''}`}
                        onClick={() => onChange(opt.value || opt)}
                    >
                        <div className="pog-check" />
                        <div className="pog-content">
                            <span className="pog-label">{opt.label || opt}</span>
                            {opt.description && <span className="pog-desc">{opt.description}</span>}
                        </div>
                    </div>
                );
            })}
        </div>
    </div>
);

/**
 * Premium Date Picker
 */
export const PremiumDatePicker = ({ value, onChange, label, placeholder = "Select Date" }) => {
    const [isOpen, setIsOpen] = React.useState(false);
    const [viewDate, setViewDate] = React.useState(value ? new Date(value) : new Date());
    const [viewMode, setViewMode] = React.useState('days'); // 'days' | 'months' | 'years'
    
    useScrollLock(isOpen);
    
    const currentMonth = viewDate.getMonth();
    const currentYear = viewDate.getFullYear();
    const monthName = viewDate.toLocaleString('default', { month: 'long' });

    // Days Logic
    const daysInMonth = (month, year) => new Date(year, month + 1, 0).getDate();
    const firstDayOfMonth = (month, year) => new Date(year, month, 1).getDay();
    const days = [];
    for (let i = 0; i < firstDayOfMonth(currentMonth, currentYear); i++) days.push(null);
    for (let i = 1; i <= daysInMonth(currentMonth, currentYear); i++) days.push(i);
    
    // Years Logic
    const startYear = Math.floor(currentYear / 12) * 12;
    const years = Array.from({ length: 12 }, (_, i) => startYear + i);

    // Months Logic
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

    const handleSelectDate = (day) => {
        if (!day) return;
        const selected = new Date(currentYear, currentMonth, day);
        onChange(selected.toISOString().split('T')[0]);
        setIsOpen(false);
    };

    const handleSelectMonth = (monthIdx) => {
        setViewDate(new Date(currentYear, monthIdx, 1));
        setViewMode('days');
    };

    const handleSelectYear = (year) => {
        setViewDate(new Date(year, currentMonth, 1));
        setViewMode('months');
    };

    const changeMonth = (offset) => setViewDate(new Date(currentYear, currentMonth + offset, 1));
    const changeYear = (offset) => setViewDate(new Date(currentYear + offset, currentMonth, 1));
    const changeYearRange = (offset) => setViewDate(new Date(currentYear + (offset * 12), currentMonth, 1));

    const formatDate = (dateStr) => {
        if (!dateStr) return '';
        const d = new Date(dateStr);
        return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
    };

    return (
        <div className="premium-date-picker">
            {label && <label className="ps-label">{label}</label>}
            <div className="pdp-trigger" onClick={() => { setIsOpen(true); setViewMode('days'); }}>
                <Calendar size={18} className="pdp-icon" />
                <span className="pdp-value">{value ? formatDate(value) : placeholder}</span>
            </div>

            <AnimatePresence>
                {isOpen && (
                    <div className="pdp-calendar-modal">
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="pdp-backdrop" onClick={() => setIsOpen(false)} />
                        <motion.div initial={{ y: 100, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 100, opacity: 0 }} className="pdp-content">
                            <div className="pdp-header">
                                <span onClick={() => setViewMode('years')} style={{ cursor: 'pointer' }}>{currentYear}</span>
                                <h2 onClick={() => setViewMode('months')} style={{ cursor: 'pointer' }}>{monthName} {currentYear}</h2>
                            </div>
                            
                            <div className="pdp-body">
                                {viewMode === 'days' && (
                                    <>
                                        <div className="pdp-month-nav">
                                            <button type="button" className="pdp-nav-btn" onClick={() => changeMonth(-1)}><ChevronRight size={18} style={{ transform: 'rotate(180deg)' }} /></button>
                                            <h4>{monthName}</h4>
                                            <button type="button" className="pdp-nav-btn" onClick={() => changeMonth(1)}><ChevronRight size={18} /></button>
                                        </div>
                                        <div className="pdp-grid">
                                            {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map(d => <div key={d} className="pdp-day-label">{d}</div>)}
                                            {days.map((d, i) => {
                                                const isSelected = value && new Date(value).getDate() === d && new Date(value).getMonth() === currentMonth && new Date(value).getFullYear() === currentYear;
                                                const isToday = new Date().getDate() === d && new Date().getMonth() === currentMonth && new Date().getFullYear() === currentYear;
                                                return (
                                                    <div key={i} className={`pdp-day ${!d ? 'empty' : ''} ${isSelected ? 'active' : ''} ${isToday ? 'today' : ''}`} onClick={() => handleSelectDate(d)}>
                                                        {d}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </>
                                )}

                                {viewMode === 'months' && (
                                    <>
                                        <div className="pdp-month-nav">
                                            <button type="button" className="pdp-nav-btn" onClick={() => changeYear(-1)}><ChevronRight size={18} style={{ transform: 'rotate(180deg)' }} /></button>
                                            <h4>{currentYear}</h4>
                                            <button type="button" className="pdp-nav-btn" onClick={() => changeYear(1)}><ChevronRight size={18} /></button>
                                        </div>
                                        <div className="pdp-grid-view">
                                            {monthNames.map((m, idx) => (
                                                <div key={m} className={`pdp-grid-item ${currentMonth === idx ? 'active' : ''}`} onClick={() => handleSelectMonth(idx)}>
                                                    {m}
                                                </div>
                                            ))}
                                        </div>
                                    </>
                                )}

                                {viewMode === 'years' && (
                                    <>
                                        <div className="pdp-month-nav">
                                            <button type="button" className="pdp-nav-btn" onClick={() => changeYearRange(-1)}><ChevronRight size={18} style={{ transform: 'rotate(180deg)' }} /></button>
                                            <h4>{years[0]} - {years[11]}</h4>
                                            <button type="button" className="pdp-nav-btn" onClick={() => changeYearRange(1)}><ChevronRight size={18} /></button>
                                        </div>
                                        <div className="pdp-grid-view years">
                                            {years.map(y => (
                                                <div key={y} className={`pdp-grid-item ${currentYear === y ? 'active' : ''}`} onClick={() => handleSelectYear(y)}>
                                                    {y}
                                                </div>
                                            ))}
                                        </div>
                                    </>
                                )}
                            </div>

                            <div className="pdp-footer">
                                <button type="button" className="btn-secondary-outline" onClick={() => setIsOpen(false)}>Cancel</button>
                                <button type="button" className="btn-primary-premium" onClick={() => {
                                    const today = new Date();
                                    setViewDate(today);
                                    onChange(today.toISOString().split('T')[0]);
                                    setIsOpen(false);
                                }}>Today</button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
};

/**
 * Custom Checkbox
 */
export const CustomCheckbox = ({ label, checked, onChange, required, error }) => {
    return (
        <div className="custom-checkbox-wrapper">
            <label className="p-checkbox-container" style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', fontSize: '14px', color: '#64748B' }}>
                <div style={{ 
                    width: '22px', 
                    height: '22px', 
                    borderRadius: '8px', 
                    border: checked ? 'none' : '2px solid #E2E8F0', 
                    background: checked ? '#2563EB' : 'white',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                    boxShadow: checked ? '0 4px 10px rgba(37, 99, 235, 0.3)' : 'none'
                }}>
                    {checked && <Check size={14} color="white" strokeWidth={4} />}
                </div>
                <input 
                    type="checkbox" 
                    checked={checked} 
                    onChange={onChange} 
                    required={required} 
                    style={{ display: 'none' }} 
                />
                <span style={{ fontWeight: '500' }}>{label}</span>
            </label>
            {error && <span style={{ fontSize: '12px', color: '#EF4444', marginTop: '4px', display: 'block' }}>{error}</span>}
        </div>
    );
};
