import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { govSaleService, shopService } from '../services/api';
import { PageHeader, Skeleton } from '../components/PremiumUI';
import { 
    BarChart3, 
    PieChart, 
    TrendingUp, 
    FileSpreadsheet, 
    Calendar,
    Download
} from 'lucide-react';
import * as XLSX from 'xlsx';

const GovReportsPage = () => {
    const { shopId } = useParams();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [sales, setSales] = useState([]);
    const [shop, setShop] = useState(null);

    // Filters
    const [dateRange, setDateRange] = useState('month'); // today, week, month, year, all

    useEffect(() => {
        fetchData();
    }, [shopId]);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [salesRes, shopRes] = await Promise.all([
                govSaleService.getAll(shopId),
                shopService.getAll()
            ]);
            
            const allSales = salesRes.data.data || [];
            setSales(allSales);

            const fetchedShops = shopRes.data.data || [];
            setShop(fetchedShops.find(s => s._id === shopId));
        } catch (err) {
            console.error('Failed to fetch gov reports data', err);
        } finally {
            setLoading(false);
        }
    };

    // Filter sales based on dateRange
    const getFilteredSales = () => {
        const now = new Date();
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        
        return sales.filter(sale => {
            const saleDate = new Date(sale.date);
            if (dateRange === 'today') return saleDate >= startOfToday;
            if (dateRange === 'week') return saleDate >= new Date(now.setDate(now.getDate() - 7));
            if (dateRange === 'month') return saleDate >= new Date(now.setMonth(now.getMonth() - 1));
            if (dateRange === 'year') return saleDate >= new Date(now.setFullYear(now.getFullYear() - 1));
            return true;
        });
    };

    const filteredSales = getFilteredSales();

    // Calculations
    const totalRevenue = filteredSales.reduce((sum, sale) => sum + sale.totalAmount, 0);
    const totalInvoices = filteredSales.length;
    
    // Item-wise Ledger (Fertilizer Ledger)
    const itemLedgerMap = {};
    filteredSales.forEach(sale => {
        (sale.items || []).forEach(item => {
            if (!itemLedgerMap[item.productName]) {
                itemLedgerMap[item.productName] = { name: item.productName, qtyBase: 0, amount: 0, baseUnit: item.soldUnit };
            }
            itemLedgerMap[item.productName].qtyBase += item.soldQtyBaseUnit || item.soldQtyEntered || 0;
            itemLedgerMap[item.productName].amount += item.totalPrice;
        });
    });
    
    const itemLedger = Object.values(itemLedgerMap).sort((a, b) => b.amount - a.amount);
    
    // Date-wise Report
    const dateMap = {};
    filteredSales.forEach(sale => {
        const d = new Date(sale.date).toLocaleDateString('en-IN');
        if (!dateMap[d]) dateMap[d] = { date: d, amount: 0, invoices: 0 };
        dateMap[d].amount += sale.totalAmount;
        dateMap[d].invoices += 1;
    });
    
    const dateLedger = Object.values(dateMap).sort((a, b) => {
        const dateA = new Date(a.date.split('/').reverse().join('-'));
        const dateB = new Date(b.date.split('/').reverse().join('-'));
        return dateB - dateA;
    });

    const exportToExcel = () => {
        const wb = XLSX.utils.book_new();

        // 1. Item Ledger Sheet
        const wsItems = XLSX.utils.json_to_sheet(itemLedger.map(i => ({
            'Fertilizer Name': i.name,
            'Total Quantity Sold': `${i.qtyBase.toFixed(2)} ${i.baseUnit}`,
            'Total Revenue (Gov Rate)': i.amount.toFixed(2)
        })));
        XLSX.utils.book_append_sheet(wb, wsItems, "Fertilizer Ledger");

        // 2. Date Ledger Sheet
        const wsDates = XLSX.utils.json_to_sheet(dateLedger.map(d => ({
            'Date': d.date,
            'No. of Invoices': d.invoices,
            'Total Revenue (Gov Rate)': d.amount.toFixed(2)
        })));
        XLSX.utils.book_append_sheet(wb, wsDates, "Date-wise Report");

        // 3. Raw Data
        const wsRaw = XLSX.utils.json_to_sheet(filteredSales.map(s => ({
            'Bill No': s.invoiceNumber || s._id.slice(-6).toUpperCase(),
            'Date': new Date(s.date).toLocaleDateString('en-IN'),
            'Customer': s.customerName,
            'Payment Method': s.paymentMethod,
            'Total Amount': s.totalAmount
        })));
        XLSX.utils.book_append_sheet(wb, wsRaw, "All Records");

        XLSX.writeFile(wb, `Gov_Reports_${shop?.name || 'Shop'}_${new Date().toLocaleDateString('en-IN').replace(/\//g, '-')}.xlsx`);
    };

    if (loading) {
        return (
            <div style={{ padding: '24px' }}>
                <Skeleton height={100} style={{ marginBottom: '20px' }} />
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                    <Skeleton height={300} />
                    <Skeleton height={300} />
                </div>
            </div>
        );
    }

    return (
        <div className="gov-reports-page">
            <PageHeader 
                title="Official Government Reports"
                subtitle={`Isolated analytics for ${shop?.name || 'your shop'}`}
                backAction={() => navigate(-1)}
            />

            <div className="grp-container">
                <div className="grp-header-actions">
                    <div className="grp-filters">
                        <select value={dateRange} onChange={(e) => setDateRange(e.target.value)} className="grp-select">
                            <option value="today">Today</option>
                            <option value="week">Last 7 Days</option>
                            <option value="month">Last 30 Days</option>
                            <option value="year">Last Year</option>
                            <option value="all">All Time</option>
                        </select>
                    </div>
                    <button className="grp-export-btn" onClick={exportToExcel}>
                        <FileSpreadsheet size={18} /> Export to Excel
                    </button>
                </div>

                <div className="grp-stats-grid">
                    <div className="grp-stat-card">
                        <div className="grp-stat-icon" style={{ background: '#ECFDF5', color: '#059669' }}>
                            <TrendingUp size={24} />
                        </div>
                        <div className="grp-stat-info">
                            <span>Total Official Revenue</span>
                            <strong>₹{totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2 })}</strong>
                        </div>
                    </div>
                    <div className="grp-stat-card">
                        <div className="grp-stat-icon" style={{ background: '#EFF6FF', color: '#2563EB' }}>
                            <FileSpreadsheet size={24} />
                        </div>
                        <div className="grp-stat-info">
                            <span>Total Gov Invoices</span>
                            <strong>{totalInvoices}</strong>
                        </div>
                    </div>
                </div>

                <div className="grp-tables-grid">
                    {/* Item Ledger */}
                    <div className="grp-table-card">
                        <div className="grp-tc-header">
                            <h3><PieChart size={18} /> Fertilizer Government Ledger</h3>
                        </div>
                        <div className="grp-tc-body">
                            {itemLedger.length > 0 ? (
                                <div className="table-responsive-wrapper">
                                    <table className="grp-table">
                                        <thead>
                                            <tr>
                                                <th>Item Name</th>
                                                <th style={{textAlign: 'right'}}>Total Sold</th>
                                                <th style={{textAlign: 'right'}}>Revenue (₹)</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {itemLedger.map(item => (
                                                <tr key={item.name}>
                                                    <td><strong>{item.name}</strong></td>
                                                    <td style={{textAlign: 'right'}}>{item.qtyBase.toFixed(2)} {item.baseUnit}</td>
                                                    <td style={{textAlign: 'right', fontWeight: 'bold', color: '#059669'}}>
                                                        {item.amount.toLocaleString(undefined, {minimumFractionDigits: 2})}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            ) : (
                                <div className="grp-empty">No item data found for selected range.</div>
                            )}
                        </div>
                    </div>

                    {/* Date-wise Report */}
                    <div className="grp-table-card">
                        <div className="grp-tc-header">
                            <h3><Calendar size={18} /> Date-wise Government Report</h3>
                        </div>
                        <div className="grp-tc-body">
                            {dateLedger.length > 0 ? (
                                <div className="table-responsive-wrapper">
                                    <table className="grp-table">
                                        <thead>
                                            <tr>
                                                <th>Date</th>
                                                <th style={{textAlign: 'center'}}>Invoices</th>
                                                <th style={{textAlign: 'right'}}>Revenue (₹)</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {dateLedger.map(row => (
                                                <tr key={row.date}>
                                                    <td><strong>{row.date}</strong></td>
                                                    <td style={{textAlign: 'center'}}>{row.invoices}</td>
                                                    <td style={{textAlign: 'right', fontWeight: 'bold', color: '#059669'}}>
                                                        {row.amount.toLocaleString(undefined, {minimumFractionDigits: 2})}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            ) : (
                                <div className="grp-empty">No date data found for selected range.</div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            <style jsx="true">{`
                .gov-reports-page { display: flex; flex-direction: column; height: calc(100vh - 72px); background: #F9FAFB; overflow-y: auto; }
                .grp-container { padding: 24px; max-width: 1200px; margin: 0 auto; width: 100%; box-sizing: border-box; }
                
                .grp-header-actions { display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; }
                .grp-select { padding: 10px 16px; border: 1px solid #D0D5DD; border-radius: 8px; font-weight: 600; font-size: 14px; outline: none; background: white; color: #101828; cursor: pointer; }
                .grp-export-btn { display: flex; align-items: center; gap: 8px; padding: 10px 20px; background: white; border: 1px solid #D0D5DD; border-radius: 8px; font-weight: 700; color: #344054; cursor: pointer; transition: 0.2s; box-shadow: 0 1px 2px rgba(16, 24, 40, 0.05); }
                .grp-export-btn:hover { background: #F9FAFB; border-color: #98A2B3; }
                
                .grp-stats-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-bottom: 24px; }
                .grp-stat-card { background: white; border: 1px solid #E4E7EC; border-radius: 16px; padding: 24px; display: flex; align-items: center; gap: 20px; box-shadow: 0 1px 3px rgba(16, 24, 40, 0.05); }
                .grp-stat-icon { width: 56px; height: 56px; border-radius: 12px; display: flex; align-items: center; justify-content: center; }
                .grp-stat-info { display: flex; flex-direction: column; gap: 4px; }
                .grp-stat-info span { font-size: 13px; font-weight: 700; color: #475467; text-transform: uppercase; letter-spacing: 0.5px; }
                .grp-stat-info strong { font-size: 28px; font-weight: 800; color: #101828; }
                
                .grp-tables-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; }
                .grp-table-card { background: white; border: 1px solid #E4E7EC; border-radius: 16px; display: flex; flex-direction: column; overflow: hidden; box-shadow: 0 1px 3px rgba(16, 24, 40, 0.05); }
                .grp-tc-header { padding: 20px 24px; border-bottom: 1px solid #F2F4F7; background: #FCFCFD; }
                .grp-tc-header h3 { margin: 0; display: flex; align-items: center; gap: 10px; font-size: 16px; font-weight: 800; color: #101828; }
                .grp-tc-body { padding: 0; max-height: 400px; overflow-y: auto; }
                
                .grp-table { width: 100%; border-collapse: collapse; }
                .grp-table th { padding: 12px 24px; background: #F9FAFB; font-size: 12px; font-weight: 700; color: #475467; text-transform: uppercase; text-align: left; position: sticky; top: 0; z-index: 10; border-bottom: 1px solid #E4E7EC; }
                .grp-table td { padding: 16px 24px; border-bottom: 1px solid #F2F4F7; font-size: 14px; color: #344054; }
                
                .grp-empty { padding: 40px; text-align: center; color: #667085; font-size: 14px; font-weight: 600; }
                
                @media (max-width: 768px) {
                    .grp-stats-grid { grid-template-columns: 1fr; }
                    .grp-tables-grid { grid-template-columns: 1fr; }
                    .grp-header-actions { flex-direction: column; gap: 16px; align-items: stretch; }
                }
            `}</style>
        </div>
    );
};

export default GovReportsPage;
