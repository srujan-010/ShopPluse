import React, { useState, useEffect } from 'react';
import { 
    User, 
    Phone, 
    MessageSquare, 
    PlusCircle, 
    ArrowDownCircle, 
    Search, 
    ChevronRight, 
    ChevronLeft,
    X, 
    FileText,
    History,
    ArrowUpCircle,
    Receipt,
    Filter,
    Calendar
} from 'lucide-react';
import { useParams, useNavigate } from 'react-router-dom';
import { khataService, shopService, saleService } from '../services/api';
import { motion, AnimatePresence } from 'framer-motion';
import { EmptyState, Skeleton, PageHeader, MessageModal } from '../components/PremiumUI';
import { useScrollLock } from '../hooks/useScrollLock';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import { invoiceService } from '../utils/invoiceService';

const KhataPage = () => {
    const { shopId } = useParams();
    const [shop, setShop] = useState(null);
    const [customers, setCustomers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCustomer, setSelectedCustomer] = useState(null);
    
    // Modals
    const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
    const [isSaleModalOpen, setIsSaleModalOpen] = useState(false);
    const [isNewAccountModalOpen, setIsNewAccountModalOpen] = useState(false);
    const [amountInput, setAmountInput] = useState('');
    const [noteInput, setNoteInput] = useState('');
    
    // Ledger Filter & Search
    const [ledgerSearch, setLedgerSearch] = useState('');
    const [ledgerFilter, setLedgerFilter] = useState('all'); // all, today, week, month, pending, paid
    
    // Invoice Preview State
    const [isInvoiceOpen, setIsInvoiceOpen] = useState(false);
    const [selectedSaleForInvoice, setSelectedSaleForInvoice] = useState(null);
    const [invoiceLoading, setInvoiceLoading] = useState(false);
    
    // Transaction Details Modal
    const [selectedTxn, setSelectedTxn] = useState(null);
    const [isTxnModalOpen, setIsTxnModalOpen] = useState(false);
    const [txnSaleDetails, setTxnSaleDetails] = useState(null);
    const [txnLoading, setTxnLoading] = useState(false);
    
    // Direct Entry State
    const [newCustMobile, setNewCustMobile] = useState('');
    const [alertConfig, setAlertConfig] = useState({ open: false, title: '', message: '', type: 'info' });

    useEffect(() => {
        fetchInitialData();
    }, [shopId]);

    // Lock body scroll when modal is open
    useScrollLock(isTxnModalOpen || isInvoiceOpen || isPaymentModalOpen || isSaleModalOpen || isNewAccountModalOpen);

    const fetchInitialData = async () => {
        try {
            const [shopRes, customersRes] = await Promise.all([
                shopService.getAll(),
                khataService.getCustomers(shopId)
            ]);
            setShop(shopRes.data.data.find(s => s._id === shopId));
            setCustomers(customersRes.data.data);
        } catch (err) {
            console.error('Failed to load Khata records:', err);
        } finally {
            setLoading(false);
        }
    };

    const fetchDetails = async (id) => {
        try {
            const res = await khataService.getDetails(id);
            setSelectedCustomer(res.data.data);
        } catch (err) {
            console.error(err);
        }
    };

    const handleOpenTxnDetails = async (txn) => {
        setSelectedTxn(txn);
        setIsTxnModalOpen(true);
        if (txn.saleId) {
            setTxnLoading(true);
            try {
                const res = await saleService.getSale(txn.saleId);
                setTxnSaleDetails(res.data.data);
            } catch (err) {
                console.error('Failed to fetch sale details:', err);
                setTxnSaleDetails(null);
            } finally {
                setTxnLoading(false);
            }
        } else {
            setTxnSaleDetails(null);
        }
    };

    const handleReceivePayment = async () => {
        if (!amountInput || amountInput <= 0) return;
        try {
            await khataService.receivePayment(selectedCustomer._id, amountInput, noteInput);
            setIsPaymentModalOpen(false);
            setAmountInput('');
            setNoteInput('');
            await fetchDetails(selectedCustomer._id);
            fetchInitialData();
        } catch (err) {
            setAlertConfig({ open: true, title: 'Operation Failed', message: err.response?.data?.message || 'Operation failed', type: 'error' });
        }
    };

    const handleCreateAccount = async () => {
        if (!newCustName.trim() || !newCustMobile.trim()) {
            setAlertConfig({ open: true, title: 'Details Required', message: 'Name and Mobile Number are required.', type: 'error' });
            return;
        }
        try {
            await khataService.addSale(shopId, newCustName.trim(), newCustMobile.trim(), 0, 'New Khata Account');
            setIsNewAccountModalOpen(false);
            setNewCustName('');
            setNewCustMobile('');
            fetchInitialData();
        } catch (err) {
            setAlertConfig({ open: true, title: 'Operation Failed', message: err.response?.data?.message || 'Operation failed', type: 'error' });
        }
    };

    const handleAddSale = async () => {
        if (!amountInput || amountInput <= 0) return;
        try {
            await khataService.addSale(
                shopId, 
                selectedCustomer?.customerName, 
                selectedCustomer?.mobile, 
                amountInput, 
                noteInput
            );
            setIsSaleModalOpen(false);
            setAmountInput('');
            setNoteInput('');
            if (selectedCustomer) await fetchDetails(selectedCustomer._id);
            fetchInitialData();
        } catch (err) {
            setAlertConfig({ open: true, title: 'Operation Failed', message: err.response?.data?.message || 'Operation failed', type: 'error' });
        }
    };

    const handleViewBill = async (saleId) => {
        if (!saleId) return;
        
        // Close modal first
        setIsTxnModalOpen(false);
        setSelectedTxn(null);
        setTxnSaleDetails(null);

        // Delay then open invoice
        setTimeout(async () => {
            setInvoiceLoading(true);
            setIsInvoiceOpen(true);
            try {
                const res = await saleService.getSale(saleId);
                setSelectedSaleForInvoice(res.data.data);
            } catch (err) {
                console.error('Failed to fetch bill:', err);
            } finally {
                setInvoiceLoading(false);
            }
        }, 150);
    };

    const handleDownloadPDF = () => {
        if (!selectedSaleForInvoice) return;
        invoiceService.downloadInvoice(selectedSaleForInvoice, shop, 'SALE');
    };

    const handleShareWhatsApp = () => {
        if (!selectedSaleForInvoice) return;
        invoiceService.shareInvoice(selectedSaleForInvoice, shop, 'SALE');
    };

    const filteredCustomers = customers.filter(c => 
        c.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.mobile.includes(searchQuery)
    );

    const triggerCall = (number) => {
        window.open(`tel:${number}`);
    };

    const triggerWhatsApp = (customer) => {
        const msg = `Dear ${customer.customerName}, this is a friendly reminder from ${shop?.name || 'our shop'} regarding your outstanding due balance of ₹${customer.outstandingDue}. Kindly settle as soon as possible. Thank you!`;
        window.open(`https://wa.me/91${customer.mobile}?text=${encodeURIComponent(msg)}`);
    };

    return (
        <div className="premium-khata-v1">
            <PageHeader 
                title="Khata Book"
                subtitle={shop?.name || 'Your Shop'}
                actions={
                    <button className="btn-primary-premium hide-mobile" onClick={() => setIsNewAccountModalOpen(true)}>
                        <PlusCircle size={20} />
                        <span>Add New Account</span>
                    </button>
                }
            />

            {loading ? (
                <div className="khata-list-view">
                    <div className="khata-mobile-list">
                        {[1, 2, 3, 4].map(i => (
                            <div key={i} className="khata-mobile-card" style={{ padding: '20px' }}>
                                <Skeleton height="20px" width="60%" className="mb-4" />
                                <Skeleton height="14px" width="30%" />
                            </div>
                        ))}
                    </div>
                </div>
            ) : !selectedCustomer ? (
                /* STEP 1: Customer List */
                <div className="khata-list-view">
                    <div className="khata-controls">
                        <div className="khata-search">
                            <Search size={20} color="#98A2B3" />
                            <input 
                                type="text" 
                                placeholder="Search customer by name or mobile..." 
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>
                        <button className="btn-new-khata" onClick={() => setIsNewAccountModalOpen(true)}>
                            <PlusCircle size={20} />
                            <span>Add New Account</span>
                        </button>
                    </div>

                    <div className="khata-records-wrapper">
                        {filteredCustomers.length === 0 ? (
                            <EmptyState 
                                icon={User}
                                title={searchQuery ? "No matching accounts" : "No Khata accounts yet"}
                                description={searchQuery ? `We couldn't find any customers matching "${searchQuery}".` : "Start by adding a customer to track their credit and payments."}
                                actionLabel={searchQuery ? "Clear Search" : "Add New Account"}
                                onAction={searchQuery ? () => setSearchQuery('') : () => setIsNewAccountModalOpen(true)}
                            />
                        ) : (
                            <>
                                {/* Mobile List */}
                                <div className="khata-mobile-list">
                                    {filteredCustomers.map(c => (
                                        <div key={c._id} className="khata-mobile-card" onClick={() => fetchDetails(c._id)}>
                                            <div className="kmc-info">
                                                <strong>{c.customerName}</strong>
                                                <span>{c.mobile}</span>
                                            </div>
                                            <div className="kmc-due">
                                                <span className="kmcd-lbl">DUE</span>
                                                <strong className={c.outstandingDue > 0 ? 'text-danger' : ''}>
                                                    ₹{c.outstandingDue.toLocaleString()}
                                                </strong>
                                            </div>
                                            <ChevronRight size={18} color="#98A2B3" />
                                        </div>
                                    ))}
                                </div>

                                {/* Desktop Table */}
                                <div className="khata-desktop-table-wrapper table-responsive-wrapper">
                                    <table className="khata-desktop-table">
                                        <thead>
                                            <tr>
                                                <th>Customer Name</th>
                                                <th>Mobile Number</th>
                                                <th>Last Payment</th>
                                                <th>Outstanding Due</th>
                                                <th>Action</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {filteredCustomers.map(c => (
                                                <tr key={c._id} onClick={() => fetchDetails(c._id)} className="khata-tr">
                                                    <td><strong>{c.customerName}</strong></td>
                                                    <td>{c.mobile}</td>
                                                    <td>{c.lastPaymentDate ? new Date(c.lastPaymentDate).toLocaleDateString() : 'No payment yet'}</td>
                                                    <td><strong className={c.outstandingDue > 0 ? 'text-danger' : ''}>₹{c.outstandingDue.toLocaleString()}</strong></td>
                                                    <td><button className="khata-btn-row">Manage</button></td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            ) : (
                /* STEP 2: Detailed View */
                <div className="khata-detail-view-v2">
                    {/* Compact Sticky Header */}
                    <div className="kdv2-sticky-header">
                        <div className="kdv2-back-row">
                            <button className="kdv2-back-btn" onClick={() => setSelectedCustomer(null)}>
                                <ChevronLeft size={24} />
                            </button>
                            <div className="kdv2-customer-info">
                                <h3>{selectedCustomer.customerName}</h3>
                                <span>{selectedCustomer.mobile}</span>
                            </div>
                            <div className="kdv2-due-summary">
                                <span className="kdv2-due-label">Outstanding</span>
                                <strong className={selectedCustomer.outstandingDue > 0 ? 'text-danger' : ''}>
                                    ₹{selectedCustomer.outstandingDue.toLocaleString()}
                                </strong>
                            </div>
                        </div>

                        <div className="kdv2-quick-actions">
                            <button className="qa-btn call" onClick={() => triggerCall(selectedCustomer.mobile)}>
                                <Phone size={16} />
                                <span>Call</span>
                            </button>
                            <button className="qa-btn wa" onClick={() => triggerWhatsApp(selectedCustomer)}>
                                <MessageSquare size={16} />
                                <span>WhatsApp</span>
                            </button>
                            <button className="qa-btn pay" onClick={() => setIsPaymentModalOpen(true)}>
                                <ArrowDownCircle size={16} />
                                <span>Receive</span>
                            </button>
                            <button className="qa-btn sale" onClick={() => setIsSaleModalOpen(true)}>
                                <PlusCircle size={16} />
                                <span>Add Sale</span>
                            </button>
                        </div>

                        <div className="kdv2-search-filter">
                            <div className="kdv2-search">
                                <Search size={16} />
                                <input 
                                    type="text" 
                                    placeholder="Search bills, items..." 
                                    value={ledgerSearch}
                                    onChange={(e) => setLedgerSearch(e.target.value)}
                                />
                            </div>
                            <div className="kdv2-chips">
                                {['all', 'pending', 'paid'].map(f => (
                                    <button 
                                        key={f} 
                                        className={`chip ${ledgerFilter === f ? 'active' : ''}`}
                                        onClick={() => setLedgerFilter(f)}
                                    >
                                        {f.charAt(0).toUpperCase() + f.slice(1)}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    <div className="khata-ledger-list-v2">
                        {(!selectedCustomer.transactions || selectedCustomer.transactions.length === 0) ? (
                            <EmptyState 
                                icon={History}
                                title="No Transaction History"
                                description="Record your first sale or payment for this customer to see the ledger."
                                actionLabel="Add Sale"
                                onAction={() => setIsSaleModalOpen(true)}
                                secondaryActionLabel="Receive Payment"
                                onSecondaryAction={() => setIsPaymentModalOpen(true)}
                                compact={true}
                            />
                        ) : (() => {
                            let balance = 0;
                            const sortedTransactions = [...selectedCustomer.transactions].sort((a, b) => new Date(a.date) - new Date(b.date));
                            const ledgerWithBalance = sortedTransactions.map(t => {
                                if (t.type === 'due') balance += t.amount;
                                else balance -= t.amount;
                                return { ...t, runningBalance: balance };
                            }).reverse();

                            const filteredLedger = ledgerWithBalance.filter(t => {
                                const query = ledgerSearch.toLowerCase();
                                const matchesSearch = 
                                    (t.note || '').toLowerCase().includes(query) ||
                                    (t.saleId || '').toString().toLowerCase().includes(query) ||
                                    (t.items || []).some(item => item.productName.toLowerCase().includes(query));
                                const matchesFilter = ledgerFilter === 'all' || (ledgerFilter === 'pending' && t.type === 'due' && t.amount > 0) || (ledgerFilter === 'paid' && t.type === 'payment');
                                return matchesSearch && matchesFilter;
                            });

                            return filteredLedger.map((t, i) => (
                                <div 
                                    key={i} 
                                    className={`ledger-row-v2 ${t.type}`}
                                    onClick={() => handleOpenTxnDetails(t)}
                                >
                                    <div className="lrv2-left">
                                        <div className="lrv2-date-box">
                                            <span className="day">{new Date(t.date).getDate()}</span>
                                            <span className="month">{new Date(t.date).toLocaleString('default', { month: 'short' }).toUpperCase()}</span>
                                        </div>
                                        <div className="lrv2-details">
                                            <div className="lrv2-type-row">
                                                <span className="lrv2-type">{t.type === 'due' ? 'CREDIT SALE' : 'PAYMENT'}</span>
                                                {t.saleId && <span className="lrv2-bill">#{t.saleId.slice(-6).toUpperCase()}</span>}
                                            </div>
                                            <div className="lrv2-items">
                                                {t.items && t.items.length > 0 
                                                    ? t.items.map(item => item.productName).join(', ') 
                                                    : t.note || (t.type === 'due' ? 'Manual Entry' : 'Khata Payment')}
                                            </div>
                                            <div className="lrv2-time">{new Date(t.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                                        </div>
                                    </div>
                                    <div className="lrv2-right-wrap">
                                        <div className="lrv2-right">
                                            <div className={`lrv2-amount ${t.type === 'due' ? 'text-danger' : 'text-success'}`}>
                                                {t.type === 'due' ? '+' : '-'} ₹{t.amount.toLocaleString()}
                                            </div>
                                            <div className="lrv2-balance">Bal: ₹{t.runningBalance.toLocaleString()}</div>
                                        </div>
                                        <ChevronRight size={16} color="#98A2B3" />
                                    </div>
                                </div>
                            ));
                        })()}
                    </div>
                </div>
            )}

            {/* Invoice Preview Overlay */}
            <AnimatePresence>
                {isInvoiceOpen && (
                    <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="invoice-preview-screen"
                    >
                        <div className="ips-top-bar">
                            <button className="ips-back-btn" onClick={() => setIsInvoiceOpen(false)}>
                                <ChevronLeft size={20} />
                                <span>Back</span>
                            </button>
                            <h2>Invoice Preview</h2>
                            <div style={{ width: 60 }} />
                        </div>

                        <div className="ips-content">
                            {invoiceLoading ? (
                                <div className="khata-loader"><div className="spinner"></div></div>
                            ) : !selectedSaleForInvoice ? (
                                <div className="ips-error">Bill details could not be found.</div>
                            ) : (
                                <div className="printable-invoice-sheet">
                                    <div className="pis-header">
                                        <div className="pis-logo-circle">{(shop?.name || 'S')[0]}</div>
                                        <h1 className="pis-shop-name">{shop?.name || 'ShopPulse Business'}</h1>
                                        <p className="pis-shop-address">{shop?.location || 'Ankisa, Maharashtra'}</p>
                                        <p className="pis-shop-contact">Phone: {shop?.contactNumber || 'XXXXXXXXXX'} | GSTIN: {shop?.gstNumber || 'N/A'}</p>
                                    </div>

                                    <div className="pis-divider-solid"></div>

                                    <div className="pis-info-grid">
                                        <div className="pis-info-col">
                                            <span className="pis-info-label">INVOICE DETAILS</span>
                                            <div className="pis-info-row">
                                                <label>Invoice No:</label>
                                                <strong>#{selectedSaleForInvoice._id.slice(-6).toUpperCase()}</strong>
                                            </div>
                                            <div className="pis-info-row">
                                                <label>Date:</label>
                                                <span>{new Date(selectedSaleForInvoice.date).toLocaleDateString('en-IN')}</span>
                                            </div>
                                            <div className="pis-info-row">
                                                <label>Time:</label>
                                                <span>{new Date(selectedSaleForInvoice.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                            </div>
                                            <div className="pis-info-row">
                                                <label>Payment:</label>
                                                <strong className="pis-payment-method">{selectedSaleForInvoice.paymentMethod?.toUpperCase() || 'KHATA'}</strong>
                                            </div>
                                        </div>
                                        <div className="pis-info-col">
                                            <span className="pis-info-label">CUSTOMER DETAILS</span>
                                            <div className="pis-info-row">
                                                <label>Name:</label>
                                                <strong>{selectedSaleForInvoice.customerName || 'Walk-in Customer'}</strong>
                                            </div>
                                            {selectedSaleForInvoice.customerMobile && (
                                                <div className="pis-info-row">
                                                    <label>Mobile:</label>
                                                    <span>{selectedSaleForInvoice.customerMobile}</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    <div className="table-responsive-wrapper">
                                        <table className="pis-items-table-v2">
                                            <thead>
                                                <tr>
                                                    <th style={{ width: '40px' }}>Sl</th>
                                                    <th>Product Description</th>
                                                    <th style={{ textAlign: 'center' }}>Qty</th>
                                                    <th style={{ textAlign: 'right' }}>Rate</th>
                                                    <th style={{ textAlign: 'right' }}>Amount</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {(selectedSaleForInvoice.items || []).map((item, i) => (
                                                    <tr key={i}>
                                                        <td>{i + 1}</td>
                                                        <td>{item.productName}</td>
                                                        <td style={{ textAlign: 'center' }}>{item.soldQtyEntered || item.quantity} {item.soldUnit || item.unit || 'Pc'}</td>
                                                        <td style={{ textAlign: 'right' }}>₹{(item.pricePerBaseUnit || item.price || (item.totalPrice / item.quantity)).toFixed(2)}</td>
                                                        <td style={{ textAlign: 'right' }}>₹{(item.totalPrice || ((item.pricePerBaseUnit || item.price) * (item.soldQtyEntered || item.quantity))).toFixed(2)}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>

                                    {/* Mobile Item Cards (Stacked Layout) */}
                                    <div className="pis-items-mobile-list">
                                        {(selectedSaleForInvoice.items || []).map((item, i) => (
                                            <div key={i} className="pis-mobile-item-card">
                                                <div className="pmic-header">
                                                    <span className="pmic-sl">#{i + 1}</span>
                                                    <span className="pmic-name">{item.productName}</span>
                                                </div>
                                                <div className="pmic-body">
                                                    <div className="pmic-col">
                                                        <label>Qty</label>
                                                        <span>{item.soldQtyEntered || item.quantity} {item.soldUnit || item.unit || 'Pc'}</span>
                                                    </div>
                                                    <div className="pmic-col">
                                                        <label>Rate</label>
                                                        <span>₹{(item.pricePerBaseUnit || item.price || (item.totalPrice / item.quantity)).toFixed(2)}</span>
                                                    </div>
                                                    <div className="pmic-col">
                                                        <label>Amount</label>
                                                        <strong>₹{(item.totalPrice || ((item.pricePerBaseUnit || item.price) * (item.soldQtyEntered || item.quantity))).toFixed(2)}</strong>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>

                                    <div className="pis-summary-v2">
                                        <div className="pis-summary-box">
                                            <div className="pis-sum-row">
                                                <span>Subtotal:</span>
                                                <span>₹{(selectedSaleForInvoice.totalAmount + (selectedSaleForInvoice.discount || 0)).toLocaleString()}</span>
                                            </div>
                                            {selectedSaleForInvoice.discount > 0 && (
                                                <div className="pis-sum-row discount">
                                                    <span>Discount:</span>
                                                    <span>- ₹{selectedSaleForInvoice.discount.toLocaleString()}</span>
                                                </div>
                                            )}
                                            <div className="pis-sum-row grand">
                                                <span>GRAND TOTAL:</span>
                                                <span>₹{(selectedSaleForInvoice.totalAmount || 0).toLocaleString()}</span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="pis-footer-v2">
                                        <div className="pis-footer-divider"></div>
                                        <h3>Thank you for your business!</h3>
                                        <p>Returns accepted within 7 days with original bill.</p>
                                        <p>This is a computer generated invoice.</p>
                                        <div className="pis-brand-footer">Generated by ShopPulse POS</div>
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="ips-actions-bar">
                            <button className="ips-btn ips-wa" onClick={handleShareWhatsApp}>WhatsApp</button>
                            <button className="ips-btn ips-pdf" onClick={handleDownloadPDF}>PDF</button>
                            <button className="ips-btn ips-print" onClick={() => window.print()}>Print</button>
                            <button className="ips-btn ips-close" onClick={() => setIsInvoiceOpen(false)}>Close</button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Transaction Details Bottom Sheet */}
            <AnimatePresence>
                {isTxnModalOpen && selectedTxn && (
                    <div className="sl-modal-overlay">
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="sl-backdrop" onClick={() => setIsTxnModalOpen(false)} />
                        <motion.div 
                            initial={{ y: "100%" }} 
                            animate={{ y: 0 }} 
                            exit={{ y: "100%" }} 
                            transition={{ type: "spring", damping: 25, stiffness: 200 }}
                            className="sl-sheet"
                        >
                            <div className="sl-sheet-handle"></div>
                             <div className="sl-m-header-v2">
                                <div className="slmh-title">
                                    <h3 style={{ fontSize: '20px', fontWeight: 800, color: '#0f172a' }}>Transaction Details</h3>
                                    <p style={{ fontSize: '13px', color: '#64748b', fontWeight: 600, marginTop: '2px' }}>
                                        {selectedTxn.saleId ? `Bill #${selectedTxn.saleId.slice(-6).toUpperCase()}` : 'Manual Entry'} • {new Date(selectedTxn.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })} • {new Date(selectedTxn.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </p>
                                </div>
                                <button className="sl-m-close-v2" onClick={() => setIsTxnModalOpen(false)} style={{ background: '#f1f5f9', padding: '8px', borderRadius: '50%' }}><X size={20} /></button>
                            </div>

                            <div className="sl-m-content-v2">
                                <div className="radical-details-grid">
                                    <div className="rdg-col">
                                        <label>Customer</label>
                                        <span>{selectedCustomer.customerName}</span>
                                    </div>
                                    <div className="rdg-col">
                                        <label>Entry Type</label>
                                        <span className={`method-badge ${selectedTxn.type === 'due' ? 'khata' : 'cash'}`}>
                                            {selectedTxn.type === 'due' ? 'CREDIT SALE' : 'PAYMENT'}
                                        </span>
                                    </div>
                                    <div className="rdg-col">
                                        <label>Status</label>
                                        <span className={`status-badge ${selectedTxn.type === 'due' ? 'pending' : 'paid'}`}>
                                            {selectedTxn.type === 'due' ? 'Payment Pending' : 'Fully Settled'}
                                        </span>
                                    </div>
                                    <div className="rdg-col">
                                        <label>Time</label>
                                        <span>{new Date(selectedTxn.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
                                    </div>
                                </div>

                                {selectedTxn.isPOSSale && (
                                    <div className="pos-origin-banner-v2" style={{ marginBottom: '16px' }}>
                                        <Receipt size={14} />
                                        <span>Origin: POS Billing System</span>
                                    </div>
                                )}

                                <div className="radical-items-section">
                                    <h4 style={{ fontSize: '12px', textTransform: 'uppercase', color: '#94a3b8', letterSpacing: '0.05em', marginBottom: '12px' }}>Items & Details</h4>
                                    <div className="table-responsive-wrapper">
                                        <table className="radical-invoice-table">
                                            <thead>
                                                <tr>
                                                    <th>Description</th>
                                                    <th style={{ textAlign: 'center' }}>Qty</th>
                                                    <th style={{ textAlign: 'right' }}>Amount</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {txnSaleDetails ? (
                                                    (txnSaleDetails.items || []).map((item, i) => (
                                                        <tr key={i}>
                                                            <td>
                                                                <div className="rit-name">{item.productName}</div>
                                                                <div className="rit-unit">{item.soldUnit || item.unit}</div>
                                                            </td>
                                                            <td style={{ textAlign: 'center', fontWeight: 700 }}>{item.soldQtyEntered || item.quantity}</td>
                                                            <td style={{ textAlign: 'right', fontWeight: 800 }}>₹{(item.totalPrice || (item.price * item.quantity)).toLocaleString()}</td>
                                                        </tr>
                                                    ))
                                                ) : selectedTxn.items && selectedTxn.items.length > 0 ? (
                                                    selectedTxn.items.map((item, i) => (
                                                        <tr key={i}>
                                                            <td>
                                                                <div className="rit-name">{item.productName}</div>
                                                                <div className="rit-unit">{item.unit}</div>
                                                            </td>
                                                            <td style={{ textAlign: 'center', fontWeight: 700 }}>{item.quantity}</td>
                                                            <td style={{ textAlign: 'right', fontWeight: 800 }}>₹{selectedTxn.amount.toLocaleString()}</td>
                                                        </tr>
                                                    ))
                                                ) : (
                                                    <tr>
                                                        <td colSpan="3" style={{ textAlign: 'center', color: '#64748b', fontStyle: 'italic', padding: '24px' }}>
                                                            {selectedTxn.note || (selectedTxn.type === 'due' ? 'Manual credit entry' : 'Payment received')}
                                                        </td>
                                                    </tr>
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>

                                <div className="radical-summary-section">
                                    <div className="rs-row">
                                        <span>Transaction Amount</span>
                                        <span>₹{selectedTxn.amount.toLocaleString()}</span>
                                    </div>
                                    <div className="rs-row">
                                        <span>Previous Balance</span>
                                        <span>₹{(selectedTxn.runningBalance - (selectedTxn.type === 'due' ? selectedTxn.amount : -selectedTxn.amount)).toLocaleString()}</span>
                                    </div>
                                    <div className="rs-row grand">
                                        <span>Running Balance</span>
                                        <strong>₹{selectedTxn.runningBalance.toLocaleString()}</strong>
                                    </div>
                                </div>
                            </div>

                            <div className="radical-sticky-footer">
                                {selectedTxn.saleId && (
                                    <button className="r-btn r-btn-primary" onClick={() => handleViewBill(selectedTxn.saleId)}>
                                        <Receipt size={18} />
                                        <span>View Bill</span>
                                    </button>
                                )}
                                
                                {selectedTxn.type === 'due' && (
                                    <button className="r-btn r-btn-success" onClick={() => { setIsTxnModalOpen(false); setIsPaymentModalOpen(true); }}>
                                        <ArrowDownCircle size={18} />
                                        <span>Receive Payment</span>
                                    </button>
                                )}

                                <button className="r-btn r-btn-secondary" onClick={() => triggerWhatsApp(selectedCustomer)}>
                                    <MessageSquare size={18} />
                                    <span>WhatsApp</span>
                                </button>
                                
                                <button className="r-btn r-btn-outline" onClick={() => setIsTxnModalOpen(false)}>
                                    Close
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Payment Modal */}
            {isPaymentModalOpen && (
                <div className="modal-overlay">
                    <div className="modal-backdrop" onClick={() => setIsPaymentModalOpen(false)}></div>
                    <div className="modal-content">
                        <h3>Receive Payment</h3>
                        <p>Recording payments from {selectedCustomer?.customerName}</p>
                        <input 
                            type="number" 
                            placeholder="Amount in ₹" 
                            value={amountInput} 
                            onChange={(e) => setAmountInput(e.target.value)} 
                        />
                        <input 
                            type="text" 
                            placeholder="Note (optional)" 
                            value={noteInput} 
                            onChange={(e) => setNoteInput(e.target.value)} 
                        />
                        <div className="modal-actions">
                            <button className="btn-cancel" onClick={() => setIsPaymentModalOpen(false)}>Cancel</button>
                            <button className="btn-confirm" onClick={handleReceivePayment}>Save Payment</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Add Account Modal */}
            {isNewAccountModalOpen && (
                <div className="modal-overlay">
                    <div className="modal-backdrop" onClick={() => setIsNewAccountModalOpen(false)}></div>
                    <div className="modal-content">
                        <h3>Add New Account</h3>
                        <p>Provide customer details to open a credit account</p>
                        <input 
                            type="text" 
                            placeholder="Customer Full Name" 
                            value={newCustName} 
                            onChange={(e) => setNewCustName(e.target.value)} 
                        />
                        <input 
                            type="text" 
                            placeholder="Mobile Number" 
                            value={newCustMobile} 
                            onChange={(e) => setNewCustMobile(e.target.value)} 
                        />
                        <div className="modal-actions">
                            <button className="btn-cancel" onClick={() => setIsNewAccountModalOpen(false)}>Cancel</button>
                            <button className="btn-confirm" onClick={handleCreateAccount}>Create Account</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Add Sale Modal */}
            {isSaleModalOpen && (
                <div className="modal-overlay">
                    <div className="modal-backdrop" onClick={() => setIsSaleModalOpen(false)}></div>
                    <div className="modal-content">
                        <h3>Add Credit Sale</h3>
                        <p>Recording due for {selectedCustomer?.customerName}</p>
                        <input 
                            type="number" 
                            placeholder="Sale Amount in ₹" 
                            value={amountInput} 
                            onChange={(e) => setAmountInput(e.target.value)} 
                        />
                        <input 
                            type="text" 
                            placeholder="Note (optional)" 
                            value={noteInput} 
                            onChange={(e) => setNoteInput(e.target.value)} 
                        />
                        <div className="modal-actions">
                            <button className="btn-cancel" onClick={() => setIsSaleModalOpen(false)}>Cancel</button>
                            <button className="btn-confirm" onClick={handleAddSale}>Add Due Credit</button>
                        </div>
                    </div>
                </div>
            )}

            <style jsx="true">{`
                .premium-khata-v1 { padding: 16px; display: flex; flex-direction: column; gap: 24px; }
                .khata-header h1 { font-size: 28px; font-weight: 800; color: #101828; margin: 0; }
                .khata-header p { font-size: 14px; color: #667085; margin: 4px 0 0 0; }
                
                .khata-loader { padding: 50px 0; text-align: center; }
                
                .khata-controls { display: flex; flex-direction: column; gap: 12px; }
                .khata-search { flex: 1; height: 48px; background: white; border: 1px solid #D0D5DD; border-radius: 12px; display: flex; align-items: center; padding: 0 16px; gap: 10px; box-shadow: 0 2px 6px rgba(0,0,0,0.05); }
                .khata-search input { border: none; outline: none; flex: 1; font-size: 14px; }
                .btn-new-khata { background: #1E6BFF; color: white; border: none; border-radius: 12px; padding: 0 16px; height: 48px; display: flex; align-items: center; justify-content: center; gap: 8px; font-size: 14px; font-weight: 700; cursor: pointer; }

                .khata-mobile-list { display: flex; flex-direction: column; gap: 12px; margin-top: 16px; }
                .khata-mobile-card { background: white; border: 1px solid #EAECF0; border-radius: 14px; padding: 16px; display: flex; align-items: center; justify-content: space-between; cursor: pointer; transition: 0.2s; }
                .kmc-info { display: flex; flex-direction: column; gap: 4px; }
                .kmc-info strong { font-size: 16px; color: #101828; }
                .kmc-info span { font-size: 13px; color: #667085; }
                .kmc-due { text-align: right; margin-right: 12px; }
                .kmcd-lbl { font-size: 9px; font-weight: 800; color: #98A2B3; display: block; }
                .kmc-due strong { font-size: 16px; }
                
                .khata-desktop-table-wrapper { display: none; background: white; border: 1px solid #EAECF0; border-radius: 16px; overflow: hidden; margin-top: 20px; }
                .khata-desktop-table { width: 100%; border-collapse: collapse; text-align: left; }
                .khata-desktop-table th { background: #F9FAFB; padding: 16px; font-size: 13px; font-weight: 700; color: #475467; border-bottom: 1px solid #EAECF0; }
                .khata-desktop-table td { padding: 16px; font-size: 14px; color: #344054; border-bottom: 1px solid #F2F4F7; }
                .khata-tr { cursor: pointer; transition: 0.2s; }
                .khata-tr:hover { background: #F9FAFB; }
                .khata-btn-row { padding: 6px 12px; border: 1px solid #D0D5DD; background: white; border-radius: 8px; font-size: 12px; font-weight: 700; cursor: pointer; }

                .khata-back-bar { display: flex; }
                .btn-khata-back { background: none; border: none; color: #1E6BFF; font-weight: 700; font-size: 14px; display: flex; align-items: center; gap: 6px; cursor: pointer; }
                
                .khata-profile-card { background: white; border: 1px solid #EAECF0; border-radius: 18px; padding: 20px; display: flex; flex-direction: column; gap: 20px; margin-top: 16px; }
                .kpc-top { display: flex; align-items: center; flex-wrap: wrap; gap: 16px; }
                .kpc-avatar { width: 60px; height: 60px; border-radius: 50%; background: #F5F9FF; display: flex; align-items: center; justify-content: center; }
                .kpc-identity { flex: 1; min-width: 200px; }
                .kpc-identity h2 { font-size: 20px; font-weight: 800; color: #101828; margin: 0; }
                .kpc-identity p { font-size: 14px; color: #667085; margin: 4px 0 0 0; }
                .kpc-due-box { background: #FEF3F2; border: 1px solid #FECDCA; border-radius: 12px; padding: 12px 20px; text-align: center; }
                .kpc-due-box span { font-size: 10px; font-weight: 800; color: #B42318; letter-spacing: 0.5px; }
                .kpc-due-box h3 { font-size: 24px; font-weight: 900; color: #B42318; margin: 2px 0 0 0; }

                .kpc-actions { display: flex; gap: 12px; flex-wrap: wrap; }
                .kpc-btn { flex: 1; min-width: 160px; height: 44px; border-radius: 10px; font-weight: 700; font-size: 13px; display: flex; align-items: center; justify-content: center; gap: 8px; cursor: pointer; border: none; }
                .kpc-btn.call { background: #F2F4F7; color: #344054; }
                .kpc-btn.whatsapp { background: #DCF8C6; color: #075E54; }

                .khata-ops-row { display: flex; gap: 12px; margin-top: 16px; }
                .ops-btn { flex: 1; height: 56px; border-radius: 14px; font-size: 15px; font-weight: 700; display: flex; align-items: center; justify-content: center; gap: 8px; cursor: pointer; border: none; }
                .ops-btn.pay { background: #ECFDF3; color: #027A48; }
                .ops-btn.sale { background: #EFF8FF; color: #175CD3; }

                .khata-detail-view-v2 { background: white; min-height: 100vh; display: flex; flex-direction: column; }
                .kdv2-sticky-header { position: sticky; top: 0; background: white; z-index: 100; border-bottom: 1px solid #F2F4F7; padding: 12px 16px; display: flex; flex-direction: column; gap: 16px; box-shadow: 0 4px 12px rgba(0,0,0,0.02); }
                .kdv2-back-row { display: flex; align-items: center; gap: 12px; }
                .kdv2-back-btn { background: none; border: none; padding: 0; color: #344054; cursor: pointer; }
                .kdv2-customer-info { flex: 1; display: flex; flex-direction: column; }
                .kdv2-customer-info h3 { margin: 0; font-size: 18px; font-weight: 800; color: #101828; }
                .kdv2-customer-info span { font-size: 13px; color: #667085; font-weight: 600; }
                .kdv2-due-summary { text-align: right; }
                .kdv2-due-label { font-size: 9px; font-weight: 800; color: #98A2B3; text-transform: uppercase; display: block; }
                .kdv2-due-summary strong { font-size: 18px; font-weight: 900; }

                .kdv2-quick-actions { display: flex; gap: 8px; overflow-x: auto; padding-bottom: 4px; }
                .kdv2-quick-actions::-webkit-scrollbar { display: none; }
                .qa-btn { flex: 0 0 auto; height: 36px; padding: 0 14px; border-radius: 99px; border: 1.5px solid #EAECF0; background: white; font-size: 13px; font-weight: 700; display: flex; align-items: center; gap: 6px; cursor: pointer; color: #344054; }
                .qa-btn.pay { background: #ECFDF3; border-color: #D1FADF; color: #027A48; }
                .qa-btn.sale { background: #EFF8FF; border-color: #D1E9FF; color: #175CD3; }
                
                .kdv2-search-filter { display: flex; flex-direction: column; gap: 12px; }
                .kdv2-search { height: 38px; background: #F9FAFB; border: 1px solid #EAECF0; border-radius: 10px; display: flex; align-items: center; padding: 0 12px; gap: 8px; }
                .kdv2-search input { border: none; outline: none; background: transparent; flex: 1; font-size: 13px; font-weight: 600; }
                .kdv2-chips { display: flex; gap: 8px; }
                .chip { height: 32px; padding: 0 14px; border-radius: 99px; border: 1px solid #EAECF0; background: white; font-size: 12px; font-weight: 700; color: #667085; cursor: pointer; }
                .chip.active { background: #1E6BFF; color: white; border-color: #1E6BFF; }

                .khata-ledger-list-v2 { display: flex; flex-direction: column; }
                .ledger-row-v2 { padding: 16px; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #F2F4F7; cursor: pointer; transition: background 0.2s; }
                .ledger-row-v2:active { background: #F9FAFB; }
                .lrv2-left { display: flex; gap: 16px; align-items: center; }
                .lrv2-date-box { width: 44px; height: 44px; background: #F9FAFB; border-radius: 10px; display: flex; flex-direction: column; align-items: center; justify-content: center; flex-shrink: 0; }
                .lrv2-date-box .day { font-size: 16px; font-weight: 900; color: #101828; line-height: 1; }
                .lrv2-date-box .month { font-size: 9px; font-weight: 800; color: #667085; margin-top: 2px; }
                
                .lrv2-details { display: flex; flex-direction: column; gap: 2px; }
                .lrv2-type-row { display: flex; align-items: center; gap: 6px; }
                .lrv2-type { font-size: 11px; font-weight: 800; color: #475467; letter-spacing: 0.5px; }
                .lrv2-bill { font-size: 10px; font-weight: 800; color: #1E6BFF; background: #EFF8FF; padding: 1px 6px; border-radius: 4px; }
                .lrv2-items { font-size: 14px; font-weight: 700; color: #101828; max-width: 180px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
                .lrv2-time { font-size: 11px; color: #98A2B3; font-weight: 600; }

                .lrv2-right-wrap { display: flex; align-items: center; gap: 12px; }
                .lrv2-right { text-align: right; display: flex; flex-direction: column; gap: 2px; }
                .lrv2-amount { font-size: 16px; font-weight: 800; }
                .lrv2-balance { font-size: 11px; font-weight: 700; color: #98A2B3; }

                .khata-empty-state-v2 { padding: 60px 20px; text-align: center; display: flex; flex-direction: column; align-items: center; gap: 12px; }
                .khata-empty-state-v2 p { font-size: 14px; color: #667085; font-weight: 600; }

                /* Refined Transaction Detail Modal Styles */
                .sl-modal-overlay { 
                    position: fixed; 
                    inset: 0; 
                    z-index: 10000; 
                    display: flex; 
                    align-items: flex-end; 
                    justify-content: center; 
                }
                .sl-backdrop { 
                    position: absolute; 
                    inset: 0; 
                    background: rgba(15, 23, 42, 0.6); 
                    backdrop-filter: blur(8px); 
                }
                .sl-sheet { 
                    position: relative; 
                    background: white; 
                    width: 100%; 
                    max-width: 100%; 
                    border-radius: 24px 24px 0 0; 
                    display: flex; 
                    flex-direction: column; 
                    box-shadow: 0 -12px 32px rgba(0,0,0,0.15); 
                    max-height: 92vh; 
                    overflow: hidden; 
                }
                .sl-sheet-handle { 
                    width: 40px; 
                    height: 5px; 
                    background: #E2E8F0; 
                    border-radius: 10px; 
                    margin: 12px auto; 
                    flex-shrink: 0; 
                }

                @media (min-width: 1024px) {
                    .sl-modal-overlay { 
                        align-items: center; 
                        padding: 40px 24px; 
                    }
                    .sl-sheet { 
                        width: 850px; 
                        max-width: 90vw;
                        height: auto; 
                        max-height: 90vh; 
                        border-radius: 28px; 
                        box-shadow: 0 20px 60px rgba(0,0,0,0.15);
                        display: flex;
                        flex-direction: column;
                        overflow: hidden;
                    }
                    .sl-sheet-handle { display: none; }
                    .sl-m-header-v2 {
                        padding: 24px 40px;
                        border-bottom: 1px solid #f1f5f9;
                    }
                    .sl-m-content-v2 { 
                        padding: 40px !important;
                        max-height: calc(90vh - 160px);
                        overflow-y: auto;
                    }
                    .radical-details-grid {
                        grid-template-columns: repeat(4, 1fr);
                        padding: 28px;
                        gap: 32px;
                        margin-bottom: 40px;
                    }
                    .radical-invoice-table th {
                        padding: 16px 12px;
                    }
                    .radical-invoice-table td {
                        padding: 20px 12px;
                    }
                    .rit-name { font-size: 16px; }
                    .radical-summary-section {
                        margin-top: 40px;
                        gap: 12px;
                    }
                    .radical-sticky-footer {
                        padding: 24px 40px;
                        background: #f8fafc;
                    }
                }

                .radical-details-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 20px; background: #f8fafc; padding: 20px; border-radius: 12px; border: 1px solid #e2e8f0; margin-bottom: 24px; }
                .rdg-col { display: flex; flex-direction: column; gap: 4px; }
                .rdg-col label { font-size: 11px; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.05em; }
                .rdg-col span { font-size: 15px; font-weight: 700; color: #1e293b; }
                
                .method-badge { font-size: 10px; font-weight: 800; padding: 2px 8px; border-radius: 6px; width: fit-content; }
                .method-badge.cash { background: #dcfce7; color: #166534; }
                .method-badge.upi { background: #dbeafe; color: #1e40af; }
                .method-badge.khata { background: #fff7ed; color: #9a3412; }
                
                .status-badge { font-size: 11px; font-weight: 700; }
                .status-badge.paid { color: #16a34a; }
                .status-badge.pending { color: #dc2626; }

                .radical-invoice-table { width: 100%; border-collapse: collapse; margin-top: 10px; }
                .radical-invoice-table th { text-align: left; font-size: 11px; font-weight: 800; color: #94a3b8; text-transform: uppercase; padding: 12px 8px; border-bottom: 2px solid #f1f5f9; }
                .radical-invoice-table td { padding: 16px 8px; border-bottom: 1px solid #f1f5f9; vertical-align: top; }
                .rit-name { font-size: 14px; font-weight: 700; color: #1e293b; }
                .rit-unit { font-size: 11px; color: #94a3b8; font-weight: 600; }

                .radical-summary-section { margin-top: 24px; display: flex; flex-direction: column; gap: 8px; align-items: flex-end; }
                .rs-row { display: flex; justify-content: space-between; width: 240px; font-size: 14px; font-weight: 600; color: #64748b; }
                .rs-row.grand { margin-top: 8px; padding-top: 12px; border-top: 2px solid #f1f5f9; color: #0f172a; }
                .rs-row.grand strong { font-size: 20px; font-weight: 900; }
                .rs-row.discount { color: #16a34a; }

                .radical-sticky-footer { padding: 16px 24px; background: white; border-top: 1px solid #f1f5f9; display: flex; gap: 12px; justify-content: flex-end; flex-shrink: 0; }
                @media (max-width: 1024px) {
                    .radical-sticky-footer { display: grid; grid-template-columns: 1fr 1fr; }
                    .r-btn-primary { grid-column: span 2; }
                }

                .r-btn { height: 44px; padding: 0 20px; border-radius: 10px; font-size: 14px; font-weight: 700; display: flex; align-items: center; justify-content: center; gap: 8px; cursor: pointer; transition: all 0.2s; border: none; }
                .r-btn-primary { background: #2563eb; color: white; }
                .r-btn-success { background: #10b981; color: white; }
                .r-btn-secondary { background: #f1f5f9; color: #475569; }
                .r-btn-outline { background: white; border: 1.5px solid #e2e8f0; color: #64748b; }
                .r-btn:active { transform: scale(0.97); }

                .sl-m-header-v2 { padding: 12px 24px 16px; display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 1px solid #f1f5f9; flex-shrink: 0; }
                .sl-m-content-v2 { flex: 1; overflow-y: auto; padding: 20px 24px; display: flex; flex-direction: column; gap: 20px; }
                .sl-m-actions-v3 { padding: 16px 24px; background: white; border-top: 1px solid #f1f5f9; display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; flex-shrink: 0; padding-bottom: calc(16px + env(safe-area-inset-bottom)); }

                .sl-summary-compact { display: flex; flex-direction: column; gap: 8px; background: #F8FAFC; padding: 12px 16px; border-radius: 12px; }
                .ssc-row { display: flex; justify-content: space-between; align-items: center; }
                .ssc-label { font-size: 12px; font-weight: 700; color: #64748b; }
                .ssc-val { font-size: 13px; font-weight: 800; color: #1e293b; }
                .ssc-badge { font-size: 10px; font-weight: 800; padding: 2px 8px; border-radius: 6px; text-transform: uppercase; }
                .ssc-badge.paid { background: #dcfce7; color: #166534; }
                .ssc-badge.pending { background: #fee2e2; color: #991b1b; }

                .pos-origin-banner-v2 { display: flex; align-items: center; gap: 6px; font-size: 11px; font-weight: 700; color: #2563eb; background: #eff6ff; padding: 6px 12px; border-radius: 8px; width: fit-content; }

                .sl-items-table-v2 { display: flex; flex-direction: column; gap: 8px; }
                .sit-header-v2 { display: grid; grid-template-columns: 1.5fr 1fr 1fr; font-size: 11px; font-weight: 800; color: #94a3b8; text-transform: uppercase; padding-bottom: 8px; border-bottom: 1px solid #f1f5f9; }
                .sit-row-v2 { display: grid; grid-template-columns: 1.5fr 1fr 1fr; padding: 10px 0; border-bottom: 1px solid #f8fafc; align-items: center; }
                .sit-col-name { font-size: 13px; font-weight: 700; color: #1e293b; }
                .sit-col-rate { font-size: 11px; color: #64748b; font-weight: 600; }
                .sit-col-total { font-size: 13px; font-weight: 800; color: #1e293b; text-align: right; }
                .sit-note-v2 { font-size: 13px; font-style: italic; color: #64748b; padding: 12px 0; }

                .sl-billing-summary-v2 { display: flex; flex-direction: column; gap: 10px; padding-top: 16px; border-top: 2px dashed #f1f5f9; }
                .sbs-row { display: flex; justify-content: space-between; align-items: center; font-size: 13px; color: #64748b; font-weight: 600; }
                .sbs-row.total { background: #1e293b; color: white; padding: 12px 16px; border-radius: 12px; margin-top: 4px; }
                .sbs-row strong { font-size: 14px; }
                .sbs-row.total strong { font-size: 18px; }

                .btn-v3-primary { grid-column: span 2; height: 48px; background: #2563eb; color: white; border: none; border-radius: 12px; font-weight: 700; display: flex; align-items: center; justify-content: center; gap: 8px; }
                .btn-v3-success { height: 48px; background: #10b981; color: white; border: none; border-radius: 12px; font-weight: 700; display: flex; align-items: center; justify-content: center; gap: 8px; }
                .btn-v3-secondary { height: 48px; background: #f1f5f9; color: #1e293b; border: none; border-radius: 12px; font-weight: 700; display: flex; align-items: center; justify-content: center; gap: 8px; }
                .btn-v3-text { grid-column: span 2; height: 40px; background: transparent; border: none; color: #94a3b8; font-weight: 700; }

                /* Global fix for bottom nav */
                body.modal-open .mobile-bottom-nav { 
                    display: none !important; 
                }

                /* Mobile Optimization - Ultra Compact ERP UI */
                @media (max-width: 768px) {
                    .premium-khata-v1 { padding: 0; padding-bottom: 90px; gap: 16px; }
                    .khata-header { height: 56px; padding: 0 16px; position: sticky; top: 0; z-index: 100; background: white; border-bottom: 1px solid #EAECF0; display: flex; flex-direction: column; justify-content: center; margin-bottom: 8px; }
                    .khata-header h1 { font-size: 18px; }
                    .khata-header p { font-size: 11px; margin-top: 2px; }

                    .khata-list-view { padding: 0 16px; }
                    .khata-search { height: 44px; border-radius: 12px; }
                    .btn-new-khata { height: 44px; font-size: 13px; }
                    
                    .khata-mobile-card { padding: 12px; border-radius: 12px; }
                    .kmc-info strong { font-size: 14px; }
                    .kmc-info span { font-size: 12px; }
                    .kmc-due strong { font-size: 15px; }

                    .kdv2-sticky-header { padding: 8px 12px; gap: 12px; }
                    .kdv2-customer-info h3 { font-size: 16px; }
                    .kdv2-customer-info span { font-size: 12px; }
                    .kdv2-due-summary strong { font-size: 16px; }
                    .qa-btn { height: 32px; padding: 0 12px; font-size: 12px; }
                    
                    .kdv2-search { height: 36px; border-radius: 8px; }
                    .kdv2-chips { overflow-x: auto; scrollbar-width: none; padding-bottom: 4px; }
                    .kdv2-chips::-webkit-scrollbar { display: none; }
                    .chip { height: 28px; font-size: 11px; padding: 0 12px; flex: 0 0 auto; }

                    .ledger-row-v2 { padding: 12px; }
                    .lrv2-date-box { width: 36px; height: 36px; border-radius: 8px; }
                    .lrv2-date-box .day { font-size: 14px; }
                    .lrv2-date-box .month { font-size: 8px; }
                    .lrv2-type { font-size: 10px; }
                    .lrv2-items { font-size: 13px; }
                    .lrv2-amount { font-size: 14px; }
                    .lrv2-balance { font-size: 10px; }
                }

                /* Invoice Preview Overlays */
                .invoice-preview-screen { position: fixed; inset: 0; background: #fff; z-index: 9999; display: flex; flex-direction: column; }
                .ips-top-bar { 
                    height: 60px; 
                    background: white; 
                    border-bottom: 1px solid #EAECF0; 
                    display: flex; 
                    align-items: center; 
                    justify-content: space-between; 
                    padding: 0 20px; 
                    position: sticky;
                    top: 0;
                    z-index: 10;
                }
                .ips-back-btn { background: none; border: none; display: flex; align-items: center; gap: 8px; font-weight: 700; color: #344054; cursor: pointer; }
                .ips-content { 
                    flex: 1; 
                    padding: 16px; 
                    overflow-y: auto; 
                    display: flex; 
                    flex-direction: column;
                    align-items: center; 
                    background: #f8fafc;
                }

                .printable-invoice-sheet { 
                    background: white; 
                    width: 100%; 
                    padding: 20px; 
                    display: flex; 
                    flex-direction: column; 
                    gap: 0; 
                    font-family: 'Inter', sans-serif; 
                    color: #1e293b;
                    border-radius: 0;
                }
                
                @media (min-width: 1024px) {
                    .ips-content { padding: 40px; }
                    .printable-invoice-sheet { 
                        max-width: 600px; 
                        padding: 40px; 
                        box-shadow: 0 10px 40px rgba(0,0,0,0.05);
                        border-radius: 12px;
                        border: 1px solid #e2e8f0;
                    }
                }

                .pis-header { text-align: center; margin-bottom: 24px; border-top: 4px solid #1e3a8a; padding-top: 20px; }
                .pis-logo-circle { width: 50px; height: 50px; background: #1e3a8a; color: white; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 24px; font-weight: 900; margin: 0 auto 12px; }
                .pis-shop-name { font-size: 20px; font-weight: 900; color: #071b44; margin: 0; text-transform: uppercase; line-height: 1.2; }
                .pis-shop-address { font-size: 13px; color: #64748b; margin: 4px 0; font-weight: 500; }
                .pis-shop-contact { font-size: 12px; color: #64748b; font-weight: 600; }
                
                .pis-divider-solid { border-top: 1.5px solid #e2e8f0; margin: 20px 0; }
                
                .pis-info-grid { display: flex; flex-direction: column; gap: 20px; margin-bottom: 30px; }
                @media (min-width: 640px) {
                    .pis-info-grid { display: grid; grid-template-columns: 1.2fr 0.8fr; gap: 30px; }
                }

                .pis-info-col { display: flex; flex-direction: column; gap: 8px; }
                .pis-info-label { font-size: 11px; font-weight: 800; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 4px; }
                .pis-info-row { display: flex; align-items: baseline; gap: 8px; font-size: 13px; }
                .pis-info-row label { color: #64748b; min-width: 90px; }
                .pis-info-row strong { color: #1e293b; font-weight: 800; }
                .pis-payment-method { color: #1e3a8a; }
                
                /* Items Table (Desktop) */
                .pis-items-table-v2 { display: none; width: 100%; border-collapse: collapse; font-size: 13px; margin: 20px 0; }
                @media (min-width: 768px) {
                    .pis-items-table-v2 { display: table; }
                }
                .pis-items-table-v2 th { background: #071b44; color: white; padding: 12px; text-align: left; font-weight: 700; border: 1px solid #071b44; }
                .pis-items-table-v2 td { padding: 12px; border: 1px solid #e2e8f0; color: #334155; }
                .pis-items-table-v2 tr:nth-child(even) { background: #f8fafc; }

                /* Mobile Item Cards */
                .pis-items-mobile-list { display: flex; flex-direction: column; gap: 12px; margin: 16px 0; }
                @media (min-width: 768px) {
                    .pis-items-mobile-list { display: none; }
                }
                .pis-mobile-item-card { 
                    background: #f8fafc; 
                    border: 1px solid #e2e8f0; 
                    border-radius: 12px; 
                    padding: 16px; 
                    display: flex; 
                    flex-direction: column; 
                    gap: 12px; 
                }
                .pmic-header { display: flex; align-items: center; gap: 10px; }
                .pmic-sl { background: #071b44; color: white; width: 24px; height: 24px; border-radius: 6px; display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 800; }
                .pmic-name { font-size: 14px; font-weight: 800; color: #071b44; flex: 1; }
                .pmic-body { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
                .pmic-col { display: flex; flex-direction: column; gap: 2px; }
                .pmic-col label { font-size: 10px; font-weight: 700; color: #64748b; text-transform: uppercase; }
                .pmic-col span { font-size: 13px; font-weight: 600; color: #334155; }
                .pmic-col strong { font-size: 14px; font-weight: 800; color: #071b44; }

                .pis-summary-v2 { display: flex; justify-content: flex-end; margin-top: 20px; }
                .pis-summary-box { width: 100%; max-width: 260px; display: flex; flex-direction: column; gap: 8px; }
                .pis-sum-row { display: flex; justify-content: space-between; font-size: 14px; font-weight: 600; color: #64748b; }
                .pis-sum-row.discount { color: #16a34a; }
                .pis-sum-row.grand { 
                    margin-top: 8px; 
                    padding: 12px 16px; 
                    border-top: 2px solid #071b44; 
                    font-size: 18px; 
                    font-weight: 900; 
                    color: white; 
                    background: #071b44; 
                    border-radius: 8px; 
                    box-shadow: 0 4px 12px rgba(7, 27, 68, 0.2);
                }

                .pis-footer-v2 { text-align: center; margin-top: 40px; padding-bottom: 20px; }
                .pis-footer-divider { border-top: 1.5px solid #e2e8f0; margin-bottom: 20px; }
                .pis-footer-v2 h3 { font-size: 16px; font-weight: 800; color: #071b44; margin: 0 0 8px 0; }
                .pis-footer-v2 p { font-size: 11px; color: #94a3b8; margin: 2px 0; font-weight: 600; }
                .pis-brand-footer { margin-top: 12px; font-size: 10px; font-weight: 800; color: #cbd5e1; text-transform: uppercase; letter-spacing: 1px; }

                .ips-actions-bar {
                    background: white;
                    padding: 16px;
                    display: grid;
                    grid-template-columns: repeat(2, 1fr);
                    gap: 10px;
                    border-top: 1.5px solid #e2e8f0;
                    box-shadow: 0 -4px 20px rgba(0,0,0,0.05);
                    position: sticky;
                    bottom: 0;
                    z-index: 10;
                    padding-bottom: calc(16px + env(safe-area-inset-bottom));
                }
                @media (min-width: 640px) {
                    .ips-actions-bar { grid-template-columns: repeat(4, 1fr); padding: 20px 40px; }
                }

                .ips-btn {
                    height: 48px;
                    border-radius: 12px;
                    border: none;
                    font-size: 14px;
                    font-weight: 700;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 8px;
                    color: white;
                    transition: all 0.2s;
                }
                .ips-wa { background: #12B76A; }
                .ips-wa:hover { background: #0ca35d; }
                .ips-pdf { background: #475467; }
                .ips-print { background: #1E6BFF; }
                .ips-close { background: white; color: #344054; border: 1.5px solid #D0D5DD; }
                .ips-btn:active { transform: scale(0.96); }

                @media print {
                    .ips-top-bar, .ips-actions-bar {
                        display: none !important;
                    }
                    .invoice-preview-screen {
                        position: absolute;
                        inset: 0;
                        background: white;
                    }
                    .ips-content {
                        background: white;
                        padding: 0;
                        overflow: visible;
                    }
                    .printable-invoice-sheet {
                        box-shadow: none;
                        border: none;
                        padding: 0;
                        max-width: 100%;
                    }
                    .pis-items-table-v2 {
                        display: table !important;
                    }
                    .pis-items-mobile-list {
                        display: none !important;
                    }
                }

                .text-success { color: #12B76A !important; }
                .text-danger { color: #F04438 !important; }

                @media (min-width: 1024px) {
                    .kls-header { flex-direction: row; justify-content: space-between; align-items: center; }
                    .klsh-right { flex-direction: row; }
                }

                .modal-overlay { position: fixed; inset: 0; z-index: 9000; display: flex; align-items: center; justify-content: center; padding: 20px; }
                .modal-backdrop { position: absolute; inset: 0; background: rgba(16, 24, 40, 0.5); backdrop-filter: blur(4px); }
                .modal-content { position: relative; background: white; width: 100%; max-width: 400px; border-radius: 16px; padding: 24px; display: flex; flex-direction: column; gap: 16px; box-shadow: 0 20px 24px rgba(0,0,0,0.1); }
                .modal-content h3 { margin: 0; font-size: 18px; font-weight: 800; color: #101828; }
                .modal-content p { margin: 0; font-size: 13px; color: #667085; }
                .modal-content input { height: 44px; border: 1px solid #D0D5DD; border-radius: 10px; padding: 0 12px; font-size: 14px; outline: none; }
                .modal-content input:focus { border-color: #1E6BFF; }
                .modal-actions { display: flex; gap: 12px; justify-content: flex-end; margin-top: 8px; }
                .btn-cancel { background: white; border: 1px solid #D0D5DD; border-radius: 8px; padding: 0 16px; height: 40px; font-size: 13px; font-weight: 700; color: #344054; cursor: pointer; }
                .btn-confirm { background: #1E6BFF; color: white; border: none; border-radius: 8px; padding: 0 16px; height: 40px; font-size: 13px; font-weight: 700; cursor: pointer; }

                .text-danger { color: #D92D20 !important; }
                
                @media (min-width: 1024px) {
                    .khata-controls { flex-direction: row; align-items: center; }
                    .khata-mobile-list { display: none; }
                    .khata-desktop-table-wrapper { display: block; }
                }
            `}</style>
            <MessageModal 
                isOpen={alertConfig.open}
                title={alertConfig.title}
                message={alertConfig.message}
                type={alertConfig.type}
                onClose={() => setAlertConfig({ ...alertConfig, open: false })}
            />
        </div>
    );
};

export default KhataPage;
