import React, { useState, useEffect } from 'react';
import { 
    FileText, 
    Download, 
    Filter, 
    PieChart as PieIcon, 
    BarChart3, 
    LineChart as LineIcon,
    Table as TableIcon,
    ChevronLeft,
    Calendar,
    ArrowUpRight,
    TrendingUp,
    Briefcase,
    Zap,
    Share2,
    Search,
    RotateCcw,
    RefreshCw,
    AlertTriangle
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { EmptyState, Skeleton, PageHeader, CustomSelect } from '../components/PremiumUI';
import { useParams, useNavigate } from 'react-router-dom';
import { saleService, shopService } from '../services/api';
import { 
    Chart as ChartJS, 
    CategoryScale, 
    LinearScale, 
    BarElement, 
    Title, 
    Tooltip, 
    Legend, 
    ArcElement,
    PointElement,
    LineElement,
    Filler
} from 'chart.js';
import { Bar, Pie, Line } from 'react-chartjs-2';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import * as XLSX from 'xlsx';

ChartJS.register(
    CategoryScale, 
    LinearScale, 
    BarElement, 
    PointElement,
    LineElement,
    ArcElement,
    Title, 
    Tooltip, 
    Legend,
    Filler
);

const ReportsPage = () => {
    const { shopId } = useParams();
    const navigate = useNavigate();
    const [summaries, setSummaries] = useState({
        today: { totalSales: 0, totalProfit: 0, orders: 0 },
        yesterday: { totalSales: 0, totalProfit: 0, orders: 0 },
        weekly: { totalSales: 0, totalProfit: 0, orders: 0 },
        monthly: { totalSales: 0, totalProfit: 0, orders: 0 }
    });
    const [reportData, setReportData] = useState(null);
    const [historyData, setHistoryData] = useState([]);
    const [shop, setShop] = useState(null);
    const [loading, setLoading] = useState(true);
    const [range, setRange] = useState('monthly');

    useEffect(() => {
        fetchData();
    }, [shopId]);

    useEffect(() => {
        fetchHistory();
    }, [range, shopId]);

    const fetchData = async () => {
        try {
            const [repRes, shopRes, sumRes] = await Promise.all([
                saleService.getReports(shopId),
                shopService.getAll(),
                saleService.getSummaries(shopId)
            ]);
            setReportData(repRes.data.data);
            setShop(shopRes.data.data.find(s => s._id === shopId));
            if (sumRes.data.data) setSummaries(sumRes.data.data);
        } catch (err) {
            console.error('Error fetching reports:', err);
        } finally {
            setLoading(false);
        }
    };

    const fetchHistory = async () => {
        try {
            const res = await saleService.getHistory(range, shopId);
            setHistoryData(res.data.data);
        } catch (err) {
            console.error('Error fetching history:', err);
        }
    };

    const exportToPDF = () => {
        const doc = new jsPDF();
        doc.text(`ShopPulse - Sales Report (${shop?.name || 'All Shops'})`, 14, 15);
        
        const tableData = reportData?.salesByShop?.map(item => [
            item.shopName,
            `Rs. ${item.totalSales}`,
            `Rs. ${item.totalProfit}`
        ]) || [];

        doc.autoTable({
            startY: 20,
            head: [['Shop Name', 'Total Sales', 'Total Profit']],
            body: tableData,
        });

        doc.save(`report-${range}.pdf`);
    };

    const exportToExcel = () => {
        const ws = XLSX.utils.json_to_sheet(historyData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Sales History");
        XLSX.writeFile(wb, `shoppulse-history-${range}.xlsx`);
    };

    const getLabels = () => {
        return historyData.map(d => {
            const id = d._id;
            if (!id) return 'N/A';
            
            if (id.hour !== undefined) {
                const today = new Date();
                return `${today.toLocaleDateString('en-GB')} ${String(id.hour).padStart(2, '0')}:00`;
            }
            if (id.day !== undefined && id.month !== undefined && id.year !== undefined) {
                return `${String(id.day).padStart(2, '0')}-${String(id.month).padStart(2, '0')}-${id.year}`;
            }
            if (id.day !== undefined && id.month !== undefined) {
                return `${String(id.day).padStart(2, '0')}-${String(id.month).padStart(2, '0')}-${new Date().getFullYear()}`;
            }
            if (id.month !== undefined && id.year !== undefined) {
                return `${String(id.month).padStart(2, '0')}-${id.year}`;
            }
            if (id.month !== undefined) {
                return `${String(id.month).padStart(2, '0')}-${new Date().getFullYear()}`;
            }
            if (id.day !== undefined) {
                const now = new Date();
                return `${String(id.day).padStart(2, '0')}-${String(now.getMonth() + 1).padStart(2, '0')}-${now.getFullYear()}`;
            }
            return 'N/A';
        });
    };

    const chartHistoryData = {
        labels: getLabels(),
        datasets: [
            {
                label: 'Sales Amount',
                data: historyData.map(d => d.totalSales),
                borderColor: '#2563eb',
                backgroundColor: 'rgba(37, 99, 235, 0.1)',
                fill: true,
                tension: 0.4
            },
            {
                label: 'Profit',
                data: historyData.map(d => d.totalProfit),
                borderColor: '#10b981',
                backgroundColor: 'rgba(16, 185, 129, 0.1)',
                fill: true,
                tension: 0.4
            }
        ]
    };

    const bestSellingData = {
        labels: reportData?.bestSelling?.map(p => p.productName || 'Unknown Product') || [],
        datasets: [
            {
                label: 'Units Sold',
                data: reportData?.bestSelling?.map(p => p.totalSold || 0) || [],
                backgroundColor: [
                    'rgba(37, 99, 235, 0.7)',
                    'rgba(16, 185, 129, 0.7)',
                    'rgba(245, 158, 11, 0.7)',
                    'rgba(239, 68, 68, 0.7)',
                    'rgba(124, 58, 237, 0.7)'
                ],
            }
        ]
    };

    if (loading) return (
        <div className="reports-container">
            <Skeleton height="80px" borderRadius="24px" className="mb-8" />
            <div className="reports-summary">
                <Skeleton height="120px" borderRadius="24px" />
                <Skeleton height="120px" borderRadius="24px" />
                <Skeleton height="120px" borderRadius="24px" />
            </div>
            <div className="insights-grid mt-8">
                <Skeleton height="400px" borderRadius="24px" />
                <Skeleton height="400px" borderRadius="24px" />
            </div>
        </div>
    );

    const totalSalesValue = historyData.reduce((s, d) => s + d.totalSales, 0);
    const totalProfitValue = historyData.reduce((s, d) => s + d.totalProfit, 0);

    return (
        <div className="reports-container">
            {/* Premium Header */}
            <PageHeader 
                title="Business Intelligence"
                subtitle={`${shop?.name || 'Global'} Performance Reports`}
                backAction={() => navigate(`/shop/${shopId}/dashboard`)}
                actions={
                    <>
                        <div style={{ width: '160px' }}>
                            <CustomSelect 
                                value={range}
                                options={[
                                    { label: 'Today', value: 'today' },
                                    { label: 'This Week', value: 'weekly' },
                                    { label: 'This Month', value: 'monthly' },
                                    { label: 'This Year', value: 'yearly' }
                                ]}
                                onChange={(val) => setRange(val)}
                            />
                        </div>
                        <button className="action-pill" onClick={exportToExcel}>
                            <Download size={18} />
                            <span>Export</span>
                        </button>
                        <button className="btn-primary-premium" onClick={exportToPDF}>
                            <FileText size={18} />
                            <span>PDF</span>
                        </button>
                    </>
                }
            />

            {/* Performance Summary Cards */}
            <section className="reports-summary">
                <div className="premium-card summary-card blue">
                    <div className="sc-icon"><TrendingUp size={24} /></div>
                    <div className="sc-content">
                        <span className="sc-label">Gross Revenue</span>
                        <h3>₹{totalSalesValue.toLocaleString()}</h3>
                        <div className="sc-trend">Over selected range</div>
                    </div>
                </div>
                <div className="premium-card summary-card green">
                    <div className="sc-icon"><Zap size={24} /></div>
                    <div className="sc-content">
                        <span className="sc-label">Net Profit</span>
                        <h3 className="text-success">₹{totalProfitValue.toLocaleString()}</h3>
                        <div className="sc-trend">Total earnings</div>
                    </div>
                </div>
                <div className="premium-card summary-card orange">
                    <div className="sc-icon"><BarChart3 size={24} /></div>
                    <div className="sc-content">
                        <span className="sc-label">Avg. Order</span>
                        <h3>₹{(totalSalesValue / (historyData.reduce((s, d) => s + d.count, 0) || 1)).toFixed(0)}</h3>
                        <div className="sc-trend">Per transaction</div>
                    </div>
                </div>
            </section>

            {/* Return & Exchange Summary Cards */}
            <h2 className="section-title mt-6 mb-4" style={{ fontSize: '1.25rem', fontWeight: 800 }}>Returns & Exchanges Summary</h2>
            <section className="reports-summary">
                <div className="premium-card summary-card red">
                    <div className="sc-icon"><RotateCcw size={24} /></div>
                    <div className="sc-content">
                        <span className="sc-label">Total Returns</span>
                        <h3>₹{(reportData?.totalReturns || 0).toLocaleString()}</h3>
                        <div className="sc-trend">Product refunds issued</div>
                    </div>
                </div>
                <div className="premium-card summary-card purple">
                    <div className="sc-icon"><RefreshCw size={24} /></div>
                    <div className="sc-content">
                        <span className="sc-label">Exchange Value</span>
                        <h3>₹{(reportData?.exchangeValue || 0).toLocaleString()}</h3>
                        <div className="sc-trend">Replacement item volume</div>
                    </div>
                </div>
                <div className="premium-card summary-card rose">
                    <div className="sc-icon"><AlertTriangle size={24} /></div>
                    <div className="sc-content">
                        <span className="sc-label">Return Losses</span>
                        <h3>₹{(reportData?.returnLosses || 0).toLocaleString()}</h3>
                        <div className="sc-trend">Deduction from net earnings</div>
                    </div>
                </div>
            </section>

            {/* Comparative Cycles Summary */}
            <div className="summaries-grid-custom">
                {['today', 'yesterday', 'weekly', 'monthly'].map(period => (
                    <div className="summary-period-card" key={period}>
                        <h4 className="spc-title">{period.toUpperCase()}</h4>
                        <div className="spc-metrics">
                            <div className="spc-metric">
                                <span className="spc-label">Sales</span>
                                <span className="spc-val">₹{(summaries[period]?.totalSales || 0).toLocaleString()}</span>
                            </div>
                            <div className="spc-metric">
                                <span className="spc-label">Profit</span>
                                <span className="spc-val profit">₹{(summaries[period]?.totalProfit || 0).toLocaleString()}</span>
                            </div>
                            <div className="spc-metric">
                                <span className="spc-label">Orders</span>
                                <span className="spc-val">{summaries[period]?.orders || 0}</span>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Main Insights Grid */}
            <section className="insights-grid">
                {/* Best Sellers */}
                <div className="card chart-card-premium">
                    <div className="cc-header">
                        <h3>Best Selling Categories</h3>
                        <PieIcon size={20} className="text-muted" />
                    </div>
                    <div className="cc-body pie-container">
                        {reportData?.bestSelling?.length > 0 ? (
                            <Pie 
                                data={bestSellingData} 
                                options={{ 
                                    maintainAspectRatio: false,
                                    plugins: { legend: { position: 'bottom', labels: { padding: 20 } } }
                                }} 
                            />
                        ) : (
                            <EmptyState 
                                icon={PieIcon}
                                title="No Sales Data"
                                description="Once you start recording sales, your best-selling categories will appear here."
                                compact={true}
                            />
                        )}
                    </div>
                </div>

                {/* Data Table Preview */}
                <div className="card chart-card-premium">
                    <div className="cc-header">
                        <h3>Detailed Breakdown</h3>
                        <TableIcon size={20} className="text-muted" />
                    </div>
                    <div className="cc-body table-preview">
                        <table className="mini-table">
                            <thead>
                                <tr>
                                    <th>Date</th>
                                    <th>Sales</th>
                                    <th>Profit</th>
                                </tr>
                            </thead>
                            <tbody>
                                {historyData.slice(0, 6).map((d, i) => (
                                    <tr key={i}>
                                        <td>{getLabels()[i]}</td>
                                        <td>₹{d.totalSales.toLocaleString()}</td>
                                        <td className="text-success">₹{d.totalProfit.toLocaleString()}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        <button className="full-report-btn" onClick={exportToPDF}>View Full PDF Report</button>
                    </div>
                </div>
            </section>

            <style jsx="true">{`
                .reports-container { display: flex; flex-direction: column; gap: 2rem; padding-bottom: 120px; }
                
                .reports-header { display: flex; justify-content: space-between; align-items: center; }
                .rh-left { display: flex; align-items: center; gap: 1rem; }
                .back-btn-circle { width: 44px; height: 44px; border-radius: 50%; border: none; background: white; display: flex; align-items: center; justify-content: center; box-shadow: var(--shadow-md); color: var(--text-muted); cursor: pointer; }
                .rh-titles h1 { font-size: 1.5rem; font-weight: 800; color: var(--text-main); margin: 0; }
                .rh-titles p { font-size: 0.9rem; color: var(--text-muted); margin: 0; }
                .rh-actions { display: flex; gap: 0.75rem; }
                .action-pill { display: flex; align-items: center; gap: 0.5rem; padding: 0.75rem 1.25rem; background: white; border: 1.5px solid var(--border); border-radius: 12px; font-weight: 700; color: var(--text-main); cursor: pointer; }

                .reports-summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 1.5rem; }
                .summary-card { padding: 1.5rem; display: flex; align-items: center; gap: 1.5rem; border-radius: 24px; position: relative; overflow: hidden; }
                .summary-card::before { content: ''; position: absolute; top: -50%; right: -20%; width: 150px; height: 150px; background: rgba(255,255,255,0.1); border-radius: 50%; }
                
                .summary-card.blue { background: linear-gradient(135deg, #2563eb, #3b82f6); color: white; }
                .summary-card.green { background: linear-gradient(135deg, #059669, #10b981); color: white; }
                .summary-card.orange { background: linear-gradient(135deg, #ea580c, #f97316); color: white; }
                .summary-card.red { background: linear-gradient(135deg, #dc2626, #ef4444); color: white; }
                .summary-card.purple { background: linear-gradient(135deg, #7c3aed, #8b5cf6); color: white; }
                .summary-card.rose { background: linear-gradient(135deg, #be123c, #e11d48); color: white; }

                .sc-icon { width: 52px; height: 52px; background: rgba(255,255,255,0.2); border-radius: 16px; display: flex; align-items: center; justify-content: center; }
                .sc-label { font-size: 0.75rem; font-weight: 700; opacity: 0.9; text-transform: uppercase; letter-spacing: 0.5px; }
                .sc-content h3 { font-size: 1.75rem; font-weight: 900; margin: 2px 0; }
                .sc-trend { font-size: 0.75rem; opacity: 0.8; font-weight: 600; }

                .insights-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem; }
                .chart-card-premium { padding: 1.5rem; display: flex; flex-direction: column; border-radius: 24px; min-height: 400px; }
                .chart-card-premium.full-width { grid-column: 1 / -1; }
                
                .cc-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 2rem; }
                .cc-header h3 { font-size: 1.1rem; font-weight: 800; }
                .cc-header p { font-size: 0.8rem; color: var(--text-muted); }

                .range-pills { display: flex; background: #f1f5f9; padding: 4px; border-radius: 12px; }
                .range-pill { padding: 6px 12px; border-radius: 8px; border: none; background: transparent; font-size: 0.75rem; font-weight: 700; color: #64748b; text-transform: capitalize; cursor: pointer; }
                .range-pill.active { background: white; color: var(--primary); box-shadow: var(--shadow-sm); }

                .cc-body { flex: 1; min-height: 0; position: relative; }
                .pie-container { display: flex; align-items: center; justify-content: center; }
                .empty-chart { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 1rem; color: #cbd5e1; height: 100%; }

                .table-preview { display: flex; flex-direction: column; gap: 1.5rem; }
                .mini-table { width: 100%; border-collapse: collapse; }
                .mini-table th { text-align: left; font-size: 0.7rem; font-weight: 800; color: #94a3b8; text-transform: uppercase; padding-bottom: 1rem; }
                .mini-table td { font-size: 0.9rem; font-weight: 600; padding: 0.75rem 0; border-bottom: 1px solid #f1f5f9; }
                .full-report-btn { width: 100%; padding: 0.85rem; border-radius: 12px; border: 1.5px solid var(--primary); background: transparent; color: var(--primary); font-weight: 800; font-size: 0.85rem; cursor: pointer; transition: all 0.2s; }
                .full-report-btn:hover { background: var(--primary-light); }

                .summaries-grid-custom { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; margin-bottom: 1rem; }
                .summary-period-card { background: white; border-radius: 20px; padding: 1.25rem; box-shadow: var(--shadow-sm); border: 1px solid var(--border); }
                .spc-title { margin: 0 0 0.75rem 0; font-size: 0.75rem; font-weight: 800; color: #64748b; letter-spacing: 0.5px; }
                .spc-metrics { display: flex; flex-direction: column; gap: 0.5rem; }
                .spc-metric { display: flex; justify-content: space-between; align-items: center; }
                .spc-label { font-size: 0.8rem; color: #94a3b8; font-weight: 600; }
                .spc-val { font-size: 0.95rem; font-weight: 700; color: #1e293b; }
                .spc-val.profit { color: #10b981; }

                @media (max-width: 1024px) {
                    .insights-grid { grid-template-columns: 1fr; }
                    .rh-actions { width: 100%; }
                    .rh-actions .btn { flex: 1; }
                }

                /* Mobile Optimization - Ultra Compact ERP UI */
                @media (max-width: 768px) {
                    .reports-container { padding-bottom: 90px; gap: 16px; padding: 12px; }
                    
                    .reports-header { padding: 0; position: sticky; top: 0; z-index: 100; background: #F6F8FC; padding-top: 8px; margin-bottom: 8px; flex-direction: row; flex-wrap: wrap; }
                    .rh-left { gap: 10px; width: 100%; }
                    .back-btn-circle { width: 36px; height: 36px; }
                    .back-btn-circle svg { width: 18px; height: 18px; }
                    .rh-titles h1 { font-size: 18px; }
                    .rh-titles p { font-size: 11px; margin-top: 2px; }
                    
                    .rh-actions { gap: 8px; display: flex; width: 100%; margin-top: 8px; }
                    .action-pill { display: none; }
                    .btn-primary { height: 44px; border-radius: 12px; font-size: 13px; }

                    .reports-summary { display: flex; flex-direction: row; overflow-x: auto; gap: 10px; scrollbar-width: none; -webkit-overflow-scrolling: touch; padding-bottom: 8px; }
                    .reports-summary::-webkit-scrollbar { display: none; }
                    .summary-card { flex: 0 0 auto; width: 160px; padding: 14px; border-radius: 18px; gap: 10px; flex-direction: column; align-items: flex-start; }
                    .sc-icon { width: 36px; height: 36px; border-radius: 10px; margin-bottom: 4px; }
                    .sc-icon svg { width: 18px; height: 18px; }
                    .sc-label { font-size: 10px; }
                    .sc-content h3 { font-size: 20px; }
                    .sc-trend { font-size: 10px; }

                    .summaries-grid-custom { display: flex; flex-direction: row; overflow-x: auto; gap: 10px; scrollbar-width: none; -webkit-overflow-scrolling: touch; padding-bottom: 8px; margin-bottom: 8px; }
                    .summaries-grid-custom::-webkit-scrollbar { display: none; }
                    .summary-period-card { flex: 0 0 auto; width: 140px; padding: 12px; border-radius: 16px; }
                    .spc-title { font-size: 10px; margin-bottom: 8px; }
                    .spc-label { font-size: 10px; }
                    .spc-val { font-size: 12px; }

                    .insights-grid { gap: 12px; }
                    .chart-card-premium { padding: 16px; border-radius: 20px; min-height: 300px; }
                    .cc-header { margin-bottom: 16px; }
                    .cc-header h3 { font-size: 15px; }
                    
                    .mini-table th { font-size: 10px; padding-bottom: 8px; }
                    .mini-table td { font-size: 13px; padding: 8px 0; }
                    .full-report-btn { padding: 12px; font-size: 13px; border-radius: 10px; }
                }

                .reports-loading { height: 60vh; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 1rem; }
                .spinner { width: 40px; height: 40px; border: 4px solid var(--border); border-top-color: var(--primary); border-radius: 50%; animation: spin 1s linear infinite; }
                @keyframes spin { to { transform: rotate(360deg); } }
            `}</style>
        </div>
    );
};

export default ReportsPage;
