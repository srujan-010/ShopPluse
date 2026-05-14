import React, { useState, useEffect } from 'react';
import { 
    History, 
    Search, 
    Download, 
    Calendar, 
    Filter, 
    ChevronLeft, 
    MoreHorizontal, 
    FileText, 
    CheckCircle, 
    Clock, 
    ShoppingBag,
    X,
    ArrowUpRight,
    Wallet,
    CreditCard,
    QrCode
} from 'lucide-react';
import { useParams, useNavigate } from 'react-router-dom';
import { saleService, shopService } from '../services/api';
import { motion, AnimatePresence } from 'framer-motion';
import { useScrollLock } from '../hooks/useScrollLock';

const SalesPage = () => {
    const { shopId } = useParams();
    const navigate = useNavigate();
    const [sales, setSales] = useState([]);
    const [shop, setShop] = useState(null);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedSale, setSelectedSale] = useState(null);
    const [periodFilter, setPeriodFilter] = useState('today');
    const [customDate, setCustomDate] = useState(new Date().toISOString().split('T')[0]);

    useScrollLock(!!selectedSale);

    useEffect(() => {
        fetchSales();
    }, [shopId]);

    const fetchSales = async () => {
        try {
            const [salesRes, shopRes] = await Promise.all([
                saleService.getAll(shopId),
                shopService.getAll()
            ]);
            setSales(salesRes.data.data);
            setShop(shopRes.data.data.find(s => s._id === shopId));
        } catch (err) {
            console.error('Error fetching sales:', err);
        } finally {
            setLoading(false);
        }
    };

    const filteredSales = sales.filter(sale => {
        const saleDate = new Date(sale.date);
        const now = new Date();
        let matchesPeriod = false;

        if (periodFilter === 'today') {
            matchesPeriod = saleDate.getFullYear() === now.getFullYear() &&
                            saleDate.getMonth() === now.getMonth() &&
                            saleDate.getDate() === now.getDate();
        } else if (periodFilter === 'yesterday') {
            const yesterday = new Date();
            yesterday.setDate(now.getDate() - 1);
            matchesPeriod = saleDate.getFullYear() === yesterday.getFullYear() &&
                            saleDate.getMonth() === yesterday.getMonth() &&
                            saleDate.getDate() === yesterday.getDate();
        } else if (periodFilter === 'week') {
            const oneWeekAgo = new Date();
            oneWeekAgo.setDate(now.getDate() - 7);
            matchesPeriod = saleDate >= oneWeekAgo;
        } else if (periodFilter === 'custom') {
            const target = new Date(customDate);
            matchesPeriod = saleDate.getFullYear() === target.getFullYear() &&
                            saleDate.getMonth() === target.getMonth() &&
                            saleDate.getDate() === target.getDate();
        }

        const query = searchQuery.toLowerCase();
        const matchesSearch = (sale.customerName || '').toLowerCase().includes(query) ||
                              (sale._id || '').toLowerCase().includes(query) ||
                              (sale.paymentMethod || '').toLowerCase().includes(query);

        return matchesPeriod && matchesSearch;
    }).sort((a, b) => new Date(b.date) - new Date(a.date));

    const totalSalesValue = filteredSales.reduce((sum, sale) => sum + (sale.totalAmount || 0), 0);
    const totalProfitValue = filteredSales.reduce((sum, sale) => sum + (sale.totalProfit || 0), 0);
    const totalOrders = filteredSales.length;
    const totalItemsSold = filteredSales.reduce((sum, sale) => {
        return sum + (sale.items || []).reduce((iSum, item) => iSum + (item.soldQtyEntered || item.quantity || 0), 0);
    }, 0);

    return (
        <div className="premium-sales-v2">
            <header className="sales-header-v2">
                <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="header-text-v2">
                    <h1>Sales Ledger</h1>
                    <p>Transaction records for <strong>{shop?.name || 'your shop'}</strong></p>
                </motion.div>
                <button className="btn-premium-export">
                    <Download size={20} />
                    <span>Export Data</span>
                </button>
            </header>

            <div className="sales-controls-v2">
                <div className="search-box-v2">
                    <Search size={22} color="#98A2B3" />
                    <input 
                        type="text" 
                        placeholder="Search by bill ID or customer name..." 
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>
                <div className="period-pills-v2">
                    {['today', 'yesterday', 'week', 'custom'].map(p => (
                        <button 
                            key={p} 
                            className={`period-pill-v2 ${periodFilter === p ? 'active' : ''}`}
                            onClick={() => setPeriodFilter(p)}
                        >
                            {p === 'week' ? 'This Week' : p.toUpperCase()}
                        </button>
                    ))}
                </div>
            </div>

            {periodFilter === 'custom' && (
                <div className="custom-date-box-v2">
                    <label>Select Date:</label>
                    <input type="date" value={customDate} onChange={(e) => setCustomDate(e.target.value)} />
                </div>
            )}

            {/* Compact 2x2 Mini Cards for Mobile */}
            <div className="compact-2x2-container">
                <div className="mini-stat-card">
                    <span className="mini-stat-label">Total Sales</span>
                    <strong className="mini-stat-val">₹{totalSalesValue.toLocaleString()}</strong>
                </div>
                <div className="mini-stat-card">
                    <span className="mini-stat-label">Orders</span>
                    <strong className="mini-stat-val">{totalOrders}</strong>
                </div>
                <div className="mini-stat-card">
                    <span className="mini-stat-label">Profit</span>
                    <strong className="mini-stat-val profit">₹{totalProfitValue.toLocaleString()}</strong>
                </div>
                <div className="mini-stat-card">
                    <span className="mini-stat-label">Items</span>
                    <strong className="mini-stat-val">{totalItemsSold}</strong>
                </div>
            </div>

            {/* Summary Cards */}
            <div className="sales-summary-grid-v2">
                <div className="ss-card-v2">
                    <span className="ss-label-v2">Total Sales</span>
                    <h3 className="ss-val-v2">₹{totalSalesValue.toLocaleString()}</h3>
                </div>
                <div className="ss-card-v2">
                    <span className="ss-label-v2">Orders</span>
                    <h3 className="ss-val-v2">{totalOrders}</h3>
                </div>
                <div className="ss-card-v2">
                    <span className="ss-label-v2">Profit</span>
                    <h3 className="ss-val-v2 profit">₹{totalProfitValue.toLocaleString()}</h3>
                </div>
                <div className="ss-card-v2">
                    <span className="ss-label-v2">Items Sold</span>
                    <h3 className="ss-val-v2">{totalItemsSold}</h3>
                </div>
            </div>

            {filteredSales.length === 0 && !loading ? (
                <div className="empty-sales-v2">
                    <h3>No transactions found</h3>
                    <p>Try updating filters or clear search targets.</p>
                </div>
            ) : (
                <>
                    {/* Mobile Log Cards */}
                    <div className="sales-list-v2 mobile-only-ledger">
                        {filteredSales.map((sale) => (
                            <div key={sale._id} className="sale-card-v2" onClick={() => setSelectedSale(sale)}>
                                <div className="sc-row-top">
                                    <div className="sc-cust-v2">{sale.customerName || 'Walk-in Customer'}</div>
                                    <div className="sc-amount-v2">₹{(sale.totalAmount || 0).toLocaleString()}</div>
                                </div>
                                <div className="sc-row-mid">
                                    <div className="sc-products-list-v2">
                                        {(sale.items || []).map(i => i.productName).join(', ')}
                                    </div>
                                </div>
                                <div className="sc-row-bot">
                                    <div className="sc-meta-v2">
                                        <span>{new Date(sale.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                        <span className="divider-dot">•</span>
                                        <span>Bill #{sale._id.slice(-6).toUpperCase()}</span>
                                        <span className="divider-dot">•</span>
                                        <span className={`sc-method-v2 ${sale.paymentMethod.toLowerCase()}`}>{sale.paymentMethod}</span>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Desktop Log Table */}
                    <div className="desktop-only-ledger table-wrapper-v2">
                        <table className="ledger-table-v2">
                            <thead>
                                <tr>
                                    <th>Time</th>
                                    <th>Bill No</th>
                                    <th>Customer</th>
                                    <th>Products</th>
                                    <th>Method</th>
                                    <th>Total</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredSales.map((sale) => (
                                    <tr key={sale._id} className="ledger-row-v2" onClick={() => setSelectedSale(sale)}>
                                        <td>{new Date(sale.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                                        <td className="td-bold">#{sale._id.slice(-6).toUpperCase()}</td>
                                        <td className="td-bold">{sale.customerName || 'Walk-in Customer'}</td>
                                        <td>{(sale.items || []).map(i => `${i.productName} (${i.soldQtyEntered || i.quantity} ${i.soldUnit || i.unit || 'Piece'})`).join(', ')}</td>
                                        <td><span className={`sc-method-v2 ${sale.paymentMethod.toLowerCase()}`}>{sale.paymentMethod}</span></td>
                                        <td className="td-bold-amt">₹{(sale.totalAmount || 0).toLocaleString()}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </>
            )}

            <AnimatePresence>
                {selectedSale && (
                    <div className="modal-overlay-v2">
                        <motion.div 
                            initial={{ opacity: 0 }} 
                            animate={{ opacity: 1 }} 
                            exit={{ opacity: 0 }} 
                            className="m-backdrop-v2" 
                            onClick={() => setSelectedSale(null)} 
                        />
                        <motion.div 
                            initial={{ y: "100%" }} 
                            animate={{ y: 0 }} 
                            exit={{ y: "100%" }} 
                            className="m-sheet-v2"
                        >
                            <div className="m-header-v2">
                                <div className="mh-text-v2">
                                    <h2>Sale Details</h2>
                                    <p>Bill #{selectedSale._id.slice(-6).toUpperCase()}</p>
                                </div>
                                <button className="m-close-v2" onClick={() => setSelectedSale(null)}><X size={20} /></button>
                            </div>
                            
                            <div className="m-scroll-v2">
                                <div className="bill-meta-strip-v2">
                                    <div className="bm-item-v2">
                                        <span>Customer</span>
                                        <strong>{selectedSale.customerName || 'Walk-in Customer'}</strong>
                                    </div>
                                    <div className="bm-item-v2">
                                        <span>Time</span>
                                        <strong>{new Date(selectedSale.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</strong>
                                    </div>
                                    <div className="bm-item-v2">
                                        <span>Method</span>
                                        <strong>{selectedSale.paymentMethod}</strong>
                                    </div>
                                </div>

                                <div className="bill-items-v2">
                                    <div className="bi-header-v2">
                                        <span>Product</span>
                                        <span>Total</span>
                                    </div>
                                    {(selectedSale.items || []).map((item, i) => (
                                        <div key={i} className="bi-row-v2">
                                            <div>
                                                <strong className="bir-name-v2">{item.productName}</strong>
                                                <p className="bir-meta-v2">{item.soldQtyEntered || item.quantity} {item.soldUnit || item.unit || 'Piece'} @ ₹{item.pricePerBaseUnit || item.price}</p>
                                            </div>
                                            <strong className="bir-total-v2">₹{((item.pricePerBaseUnit || item.price) * (item.soldQtyEntered || item.quantity)).toFixed(2)}</strong>
                                        </div>
                                    ))}
                                </div>

                                <div className="bill-total-banner-v2">
                                    <span>Grand Total</span>
                                    <strong>₹{(selectedSale.totalAmount || 0).toLocaleString()}</strong>
                                </div>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            <style jsx="true">{`
                .mobile-only-ledger { display: flex; }
                .desktop-only-ledger { display: none; }
                
                @media (min-width: 1024px) {
                    .mobile-only-ledger { display: none !important; }
                    .desktop-only-ledger { display: block !important; }
                }

                .table-wrapper-v2 { background: white; border: 1px solid #F2F4F7; border-radius: 24px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.02); }
                .ledger-table-v2 { width: 100%; border-collapse: collapse; text-align: left; }
                .ledger-table-v2 th { background: #F9FAFB; padding: 16px 20px; font-size: 12px; font-weight: 800; color: #98A2B3; text-transform: uppercase; border-bottom: 1.5px solid #F2F4F7; }
                .ledger-table-v2 td { padding: 20px; font-size: 15px; color: #344054; border-bottom: 1.5px solid #F2F4F7; }
                .ledger-row-v2 { cursor: pointer; transition: 0.2s; }
                .ledger-row-v2:hover { background: #F9FAFB; }
                .td-bold { font-weight: 800; color: #101828; }
                .td-bold-amt { font-weight: 900; color: #101828; font-size: 16px; }

                .premium-sales-v2 { display: flex; flex-direction: column; gap: 32px; padding-bottom: 40px; }
                
                /* Header */
                .sales-header-v2 { display: flex; flex-direction: column; gap: 20px; }
                .header-text-v2 h1 { font-size: 34px; font-weight: 800; color: #101828; margin: 0; letter-spacing: -0.03em; }
                .header-text-v2 p { font-size: 16px; color: #667085; margin: 8px 0 0 0; font-weight: 600; }
                
                .btn-premium-export { height: 58px; background: white; border: 1.5px solid #F2F4F7; border-radius: 20px; font-weight: 800; color: #344054; display: flex; align-items: center; justify-content: center; gap: 10px; cursor: pointer; transition: 0.2s; }
                .btn-premium-export:hover { background: #F9FAFB; border-color: #D0D5DD; }

                /* Controls */
                .sales-controls-v2 { display: flex; gap: 16px; }
                .search-box-v2 { 
                    flex: 1; 
                    height: 42px; 
                    background: #f8fafc; 
                    border: 1.5px solid #F2F4F7; 
                    border-radius: 99px; 
                    display: flex; 
                    align-items: center; 
                    padding: 0 16px; 
                    gap: 12px; 
                    transition: border-color 0.2s, box-shadow 0.2s;
                }

                .search-box-v2:focus-within {
                    border-color: #1E6BFF;
                    box-shadow: 0 0 0 3px rgba(30, 107, 255, 0.1);
                }

                .search-box-v2 input { 
                    border: none; 
                    outline: none; 
                    background: transparent; 
                    flex: 1; 
                    font-weight: 600; 
                    font-size: 14px; 
                    color: #101828; 
                }

                .period-pills-v2 { display: flex; gap: 8px; background: transparent; padding: 0; border-radius: 0; }
                
                .period-pill-v2 { 
                    padding: 6px 16px; 
                    border: 1.5px solid #F2F4F7; 
                    background: white; 
                    border-radius: 99px; 
                    font-size: 13px; 
                    font-weight: 700; 
                    color: #667085; 
                    cursor: pointer; 
                    transition: all 0.2s;
                }

                .period-pill-v2:hover {
                    border-color: #D0D5DD;
                    color: #344054;
                }

                .period-pill-v2.active { 
                    background: #1E6BFF; 
                    color: white; 
                    border-color: #1E6BFF; 
                    box-shadow: 0 4px 12px rgba(30, 107, 255, 0.2); 
                }

                .compact-2x2-container {
                    display: grid;
                    grid-template-columns: repeat(2, 1fr);
                    gap: 12px;
                    background: white;
                    border-radius: 18px;
                    padding: 16px;
                    border: 1.5px solid #F2F4F7;
                    box-shadow: 0 4px 12px rgba(0,0,0,0.03);
                }
                
                @media (min-width: 1024px) {
                    .compact-2x2-container { display: none !important; }
                }

                .mini-stat-card {
                    display: flex;
                    flex-direction: column;
                    gap: 4px;
                }

                .mini-stat-label {
                    font-size: 12px;
                    color: #667085;
                    font-weight: 600;
                    text-transform: uppercase;
                    letter-spacing: 0.05em;
                }

                .mini-stat-val {
                    font-size: 18px;
                    font-weight: 800;
                    color: #101828;
                }

                .mini-stat-val.profit {
                    color: #00A86B;
                }

                .sales-summary-grid-v2 { display: none; }
                
                @media (min-width: 1024px) {
                    .sales-summary-grid-v2 { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; }
                }

                .ss-card-v2 { background: white; border: 1.5px solid #F2F4F7; border-radius: 20px; padding: 16px; }
                .ss-label-v2 { font-size: 11px; font-weight: 800; color: #98A2B3; text-transform: uppercase; letter-spacing: 0.5px; }
                .ss-val-v2 { font-size: 22px; font-weight: 900; color: #101828; margin: 4px 0 0 0; }
                .ss-val-v2.profit { color: #00A86B; }

                .sc-products-list-v2 { font-size: 14px; font-weight: 600; color: #667085; margin: 0; }

                /* List */
                .sales-list-v2 { display: flex; flex-direction: column; gap: 16px; }
                
                .sale-card-v2 {
                    background: white;
                    border: 1.5px solid #F2F4F7;
                    border-radius: 18px;
                    padding: 16px;
                    display: flex;
                    flex-direction: column;
                    gap: 10px;
                    cursor: pointer;
                    width: 100%;
                    box-sizing: border-box;
                    box-shadow: 0 4px 12px rgba(0,0,0,0.03);
                    transition: transform 0.2s, box-shadow 0.2s;
                }

                .sale-card-v2:hover {
                    transform: translateY(-2px);
                    box-shadow: 0 8px 24px rgba(0,0,0,0.06);
                }

                .sc-row-top { display: flex; justify-content: space-between; align-items: center; }
                .sc-cust-v2 { font-size: 16px; font-weight: 800; color: #101828; }
                .sc-amount-v2 { font-size: 18px; font-weight: 800; color: #101828; }

                .sc-row-mid { font-size: 14px; font-weight: 600; color: #667085; }
                
                .sc-row-bot { border-top: 1.5px dashed #f2f4f7; padding-top: 10px; }
                .sc-meta-v2 { display: flex; align-items: center; gap: 8px; font-size: 12px; font-weight: 700; color: #667085; }
                
                .divider-dot { color: #D0D5DD; }

                .sc-method-v2 { 
                    font-size: 11px; 
                    font-weight: 800; 
                    padding: 4px 10px; 
                    border-radius: 6px; 
                    text-transform: uppercase; 
                }
                
                .sc-method-v2.cash { background: #f0fdf4; color: #00A86B; }
                .sc-method-v2.khata { background: #fff7ed; color: #ea580c; }
                .sc-method-v2.upi { background: #eff6ff; color: #1E6BFF; }
                
                .sc-right-v2 { text-align: right; margin-right: 8px; }
                .sc-amount-v2 { font-size: 20px; font-weight: 900; color: #101828; }
                .sc-status-v2 { font-size: 11px; font-weight: 800; color: #00A86B; }

                /* Details Modal */
                .modal-overlay-v2 { position: fixed; inset: 0; z-index: 7000; display: flex; align-items: flex-end; justify-content: center; }
                .m-backdrop-v2 { position: absolute; inset: 0; background: rgba(7, 27, 68, 0.4); backdrop-filter: blur(10px); }
                .m-sheet-v2 { position: relative; width: 100%; max-width: 550px; background: white; border-radius: 32px 32px 0 0; padding-bottom: 32px; max-height: 90vh; display: flex; flex-direction: column; box-shadow: 0 -20px 50px rgba(0,0,0,0.2); }
                .m-header-v2 { padding: 24px 32px; border-bottom: 1px solid #F2F4F7; display: flex; justify-content: space-between; align-items: center; }
                .mh-text-v2 h2 { font-size: 24px; font-weight: 800; margin: 0; }
                .mh-text-v2 p { font-size: 14px; color: #667085; font-weight: 600; margin: 4px 0 0 0; }
                .m-close-v2 { width: 44px; height: 44px; border-radius: 50%; background: #F9FAFB; border: none; color: #98A2B3; cursor: pointer; display: flex; align-items: center; justify-content: center; }

                .m-scroll-v2 { padding: 24px 32px; overflow-y: auto; flex: 1; display: flex; flex-direction: column; gap: 32px; }
                .bill-meta-strip-v2 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; background: #F9FAFB; padding: 16px; border-radius: 16px; border: 1.5px solid #F2F4F7; }
                .bm-item-v2 { display: flex; flex-direction: column; gap: 4px; }
                .bm-item-v2 span { font-size: 10px; font-weight: 800; color: #98A2B3; text-transform: uppercase; }
                .bm-item-v2 strong { font-size: 14px; font-weight: 800; color: #101828; }

                .bill-items-v2 { display: flex; flex-direction: column; gap: 16px; }
                .bi-header-v2 { display: flex; justify-content: space-between; font-size: 11px; font-weight: 800; color: #98A2B3; text-transform: uppercase; border-bottom: 1.5px solid #F2F4F7; padding-bottom: 8px; }
                .bi-row-v2 { display: flex; justify-content: space-between; align-items: center; }
                .bir-name-v2 { font-size: 16px; font-weight: 800; color: #101828; }
                .bir-meta-v2 { font-size: 13px; font-weight: 600; color: #667085; }
                .bir-total-v2 { font-size: 18px; font-weight: 900; color: #101828; }

                .bill-total-banner-v2 { margin-top: 12px; padding: 24px; background: #071B44; color: white; border-radius: 24px; display: flex; justify-content: space-between; align-items: center; }
                .bill-total-banner-v2 span { font-size: 16px; font-weight: 700; opacity: 0.8; }
                .bill-total-banner-v2 strong { font-size: 32px; font-weight: 900; }

                .m-footer-v2-single { padding: 20px 32px; }
                .btn-print-v2 { width: 100%; height: 60px; border-radius: 18px; background: #F9FAFB; color: #101828; border: 1.5px solid #F2F4F7; font-weight: 800; font-size: 16px; display: flex; align-items: center; justify-content: center; gap: 10px; cursor: pointer; }

                @media (min-width: 1024px) {
                    .sales-header-v2 { flex-direction: row; align-items: center; justify-content: space-between; }
                    .btn-premium-export { width: 200px; }
                    
                    .modal-overlay-v2 { align-items: center; padding: 24px; }
                    .m-sheet-v2 { 
                        width: 850px; 
                        max-width: 90vw; 
                        border-radius: 28px; 
                        padding-bottom: 0;
                        overflow: hidden;
                    }
                    .m-header-v2 { padding: 24px 40px; }
                    .m-scroll-v2 { padding: 40px; gap: 40px; }
                    .bill-meta-strip-v2 { grid-template-columns: repeat(3, 1fr); padding: 28px; gap: 32px; }
                    .bm-item-v2 span { font-size: 11px; }
                    .bm-item-v2 strong { font-size: 16px; }
                    .bir-name-v2 { font-size: 18px; }
                    .bir-total-v2 { font-size: 22px; }
                    .bill-total-banner-v2 { padding: 32px 40px; border-radius: 20px; }
                    .m-footer-v2-single { padding: 24px 40px; background: #f8fafc; border-top: 1px solid #f2f4f7; }
                }

                .premium-loader-v2 { height: 50vh; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 20px; color: #667085; font-weight: 700; }
                .loader-orbit-v2 { width: 50px; height: 50px; border: 4px solid #F2F4F7; border-top-color: #1E6BFF; border-radius: 50%; animation: orbit-v2 1s infinite linear; }
                @keyframes orbit-v2 { to { transform: rotate(360deg); } }

                .empty-sales-v2 { padding: 60px 20px; text-align: center; display: flex; flex-direction: column; align-items: center; gap: 16px; color: #98A2B3; }
                .empty-sales-v2 h3 { font-size: 20px; font-weight: 800; color: #101828; margin: 0; }

                /* Mobile Optimization - Ultra Compact ERP UI */
                @media (max-width: 768px) {
                    .premium-sales-v2 { padding: 12px; padding-bottom: 90px; gap: 16px; }
                    .sales-header-v2 { padding: 0; gap: 12px; position: sticky; top: 0; z-index: 100; background: #F6F8FC; padding-top: 8px; margin-bottom: 8px; }
                    .header-text-v2 h1 { font-size: 20px; }
                    .header-text-v2 p { font-size: 11px; margin-top: 2px; }
                    .btn-premium-export { height: 44px; border-radius: 12px; font-size: 14px; }
                    
                    .sales-controls-v2 { gap: 10px; flex-direction: column; }
                    .search-box-v2 { height: 44px; border-radius: 12px; padding: 0 12px; gap: 8px; }
                    .search-box-v2 input { font-size: 14px; }
                    .search-box-v2 svg { width: 18px; height: 18px; }
                    
                    .period-pills-v2 { overflow-x: auto; padding-bottom: 4px; scrollbar-width: none; }
                    .period-pills-v2::-webkit-scrollbar { display: none; }
                    .period-pill-v2 { height: 32px; padding: 0 14px; font-size: 12px; border-radius: 10px; flex: 0 0 auto; display: flex; align-items: center; justify-content: center; }

                    .compact-2x2-container { padding: 12px; border-radius: 14px; gap: 10px; }
                    .mini-stat-label { font-size: 10px; }
                    .mini-stat-val { font-size: 16px; }

                    .sales-list-v2 { gap: 12px; }
                    .sale-card-v2 { padding: 12px; border-radius: 16px; gap: 8px; }
                    .sc-cust-v2 { font-size: 14px; }
                    .sc-amount-v2 { font-size: 15px; }
                    .sc-row-mid { font-size: 12px; }
                    .sc-row-bot { padding-top: 8px; }
                    .sc-meta-v2 { font-size: 11px; gap: 6px; }
                    .sc-method-v2 { font-size: 9px; padding: 2px 8px; border-radius: 6px; }

                    .m-sheet-v2 { border-radius: 24px 24px 0 0; }
                    .m-header-v2 { padding: 16px; }
                    .mh-text-v2 h2 { font-size: 18px; }
                    .m-scroll-v2 { padding: 16px; gap: 20px; }
                    .bill-meta-strip-v2 { padding: 12px; gap: 8px; grid-template-columns: repeat(2, 1fr); border-radius: 12px; }
                    .bm-item-v2 span { font-size: 9px; }
                    .bm-item-v2 strong { font-size: 13px; }
                    .bi-header-v2 { font-size: 10px; }
                    .bir-name-v2 { font-size: 14px; }
                    .bir-meta-v2 { font-size: 12px; }
                    .bir-total-v2 { font-size: 15px; }
                    .bill-total-banner-v2 { padding: 16px; border-radius: 16px; }
                    .bill-total-banner-v2 span { font-size: 13px; }
                    .bill-total-banner-v2 strong { font-size: 20px; }
                    .m-footer-v2-single { padding: 16px; }
                    .btn-print-v2 { height: 48px; border-radius: 12px; font-size: 14px; }
                }
            `}</style>
        </div>
    );
};

const ChevronRight = ({ size, color }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 18l6-6-6-6" />
    </svg>
);

export default SalesPage;
