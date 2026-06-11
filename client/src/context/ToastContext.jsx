import React, { createContext, useContext, useState, useCallback } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { CheckCircle, AlertTriangle, XCircle, Info, X } from 'lucide-react';

const ToastContext = createContext(null);

export const useToast = () => {
    const context = useContext(ToastContext);
    if (!context) {
        throw new Error('useToast must be used within a ToastProvider');
    }
    return context;
};

export const ToastProvider = ({ children }) => {
    const [toasts, setToasts] = useState([]);

    const showToast = useCallback((message, type = 'success') => {
        const id = Math.random().toString(36).substring(2, 9);
        setToasts((prev) => [...prev, { id, message, type }]);
        setTimeout(() => {
            setToasts((prev) => prev.filter((t) => t.id !== id));
        }, 4000);
    }, []);

    const removeToast = useCallback((id) => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
    }, []);

    const getIcon = (type) => {
        switch (type) {
            case 'success':
                return <CheckCircle size={20} color="#10B981" />;
            case 'error':
                return <XCircle size={20} color="#EF4444" />;
            case 'warning':
                return <AlertTriangle size={20} color="#F59E0B" />;
            case 'info':
            default:
                return <Info size={20} color="#3B82F6" />;
        }
    };

    return (
        <ToastContext.Provider value={{ showToast }}>
            {children}
            <div className="toast-container">
                <AnimatePresence>
                    {toasts.map((t) => (
                        <motion.div
                            key={t.id}
                            initial={{ opacity: 0, y: -20, scale: 0.9 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: 20, scale: 0.9, transition: { duration: 0.15 } }}
                            className={`toast-card ${t.type}`}
                        >
                            <div className="toast-content">
                                {getIcon(t.type)}
                                <span className="toast-message">{t.message}</span>
                            </div>
                            <button onClick={() => removeToast(t.id)} className="toast-close-btn">
                                <X size={16} />
                            </button>
                        </motion.div>
                    ))}
                </AnimatePresence>
            </div>
            
            <style jsx="true">{`
                .toast-container {
                    position: fixed;
                    top: 24px;
                    right: 24px;
                    z-index: 9999;
                    display: flex;
                    flex-direction: column;
                    gap: 12px;
                    max-width: 380px;
                    width: calc(100% - 48px);
                    pointer-events: none;
                }
                .toast-card {
                    pointer-events: auto;
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    padding: 14px 18px;
                    border-radius: 16px;
                    border: 1.5px solid;
                    box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.05), 0 8px 10px -6px rgba(0, 0, 0, 0.05);
                    backdrop-filter: blur(8px);
                    transition: 0.2s;
                }
                .toast-card.success {
                    background: #F0FDF4;
                    border-color: #BBF7D0;
                    color: #166534;
                }
                .toast-card.error {
                    background: #FEF2F2;
                    border-color: #FECACA;
                    color: #991B1B;
                }
                .toast-card.warning {
                    background: #FFFBEB;
                    border-color: #FDE68A;
                    color: #92400E;
                }
                .toast-card.info {
                    background: #EFF6FF;
                    border-color: #BFDBFE;
                    color: #1E40AF;
                }
                .toast-content {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                }
                .toast-message {
                    font-size: 14px;
                    font-weight: 800;
                    line-height: 1.4;
                }
                .toast-close-btn {
                    background: transparent;
                    border: none;
                    color: #94A3B8;
                    cursor: pointer;
                    padding: 4px;
                    border-radius: 6px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    transition: 0.15s;
                    margin-left: 12px;
                }
                .toast-close-btn:hover {
                    background: rgba(0, 0, 0, 0.04);
                    color: #64748B;
                }
            `}</style>
        </ToastContext.Provider>
    );
};
