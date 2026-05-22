import React, { useState, useEffect, useMemo } from 'react';
import { 
    Plus, 
    Search, 
    Edit2, 
    Trash2, 
    Package, 
    AlertCircle, 
    Filter, 
    ChevronLeft,
    PackageOpen,
    X,
    ArrowUpRight,
    Tag,
    History,
    Clock,
    FileText,
    Box,
    Info,
    MoreVertical,
    CheckCircle,
    LayoutGrid,
    List,
    ShoppingBag,
    Briefcase,
    Zap,
    TrendingUp,
    ShieldCheck,
    MoreHorizontal,
    Edit3,
    AlertTriangle,
    ShoppingCart
} from 'lucide-react';
import { useParams, useNavigate } from 'react-router-dom';
import { productService, shopService, purchaseService } from '../services/api';
import { motion, AnimatePresence } from 'framer-motion';
import { EmptyState, Skeleton, PageHeader, CustomSelect, SearchableSelect, ConfirmModal, MessageModal, PremiumDatePicker, PremiumToggle } from '../components/PremiumUI';
import { useScrollLock } from '../hooks/useScrollLock';
import { offlineDB } from '../services/offlineDB';
import { useSync } from '../context/SyncContext';

const InventoryPage = () => {
    const { shopId } = useParams();
    const navigate = useNavigate();
    const { isOnline } = useSync();
    const [products, setProducts] = useState([]);
    const [shop, setShop] = useState(null);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('All');
    const [showModal, setShowModal] = useState(false);
    const [showRestockModal, setShowRestockModal] = useState(false);
    const [currentProduct, setCurrentProduct] = useState(null);
    
    const [isSaving, setIsSaving] = useState(false);
    const [restockHistory, setRestockHistory] = useState([]);
    
    const [supplierDetailsList, setSupplierDetailsList] = useState([]);
    const [showOnlyLowStock, setShowOnlyLowStock] = useState(false);
    const [deleteConfirm, setDeleteConfirm] = useState({ open: false, id: null });
    const [alertConfig, setAlertConfig] = useState({ open: false, title: '', message: '', type: 'info' });

    // History Modal State
    const [showHistoryModal, setShowHistoryModal] = useState(false);
    const [inventoryHistory, setInventoryHistory] = useState([]);
    const [isHistoryLoading, setIsHistoryLoading] = useState(false);

    // Lock body scroll when main modals are open
    useScrollLock(showModal || showRestockModal || showHistoryModal);

    const getLocalToday = () => {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    };
    const getLocalFromDate = (dateVal) => {
        if (!dateVal) return '';
        const d = new Date(dateVal);
        return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    };

    const [formData, setFormData] = useState({
        name: '',
        category: '',
        brand: '',
        barcode: '',
        productType: 'Piece',
        quantity: 0,
        unit: 'Piece',
        buyPrice: 0,
        sellPrice: 0,
        governmentPrice: 0,
        lowStockLimit: 5,
        expiryDate: '',
        notes: '',
        shop: shopId || '',
        allowPartialSelling: false,
        allowedUnits: [],
        supplier: '',
        supplierPhone: '',
        billNo: '',
        purchaseDate: getLocalToday(),
        paymentMethod: 'Cash',
        amountPaid: '',
        entryType: 'Purchase'
    });

    const [restockData, setRestockData] = useState({
        productId: '',
        quantityAdded: '',
        costPrice: '',
        supplier: '',
        supplierPhone: '',
        billNo: '',
        purchaseDate: getLocalToday(),
        paymentMethod: 'Cash',
        amountPaid: '',
        entryType: 'Purchase',
        notes: ''
    });

    const unitOptions = [
        'Piece', 'Pack', 'Box', 'Dozen', 'KG', 'Gram', 'Liter', 'ML', 'Meter', 'CM', 'Feet', 'Bag', 'Roll', 'Ton'
    ];

    useEffect(() => {
        fetchData();
    }, [shopId]);


    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        if (params.get('add') === 'true' || params.get('action') === 'add_product') {
            handleOpenModal();
        } else if (params.get('action') === 'add_stock') {
            handleOpenRestockModal();
        }
        
        if (params.get('filter') === 'low-stock') {
            setShowOnlyLowStock(true);
        }
    }, [products]);

    useEffect(() => {
        if (formData.isFullPaid) {
            const total = parseFloat(((Number(formData.quantity) || 0) * (Number(formData.buyPrice) || 0)).toFixed(2));
            if (Number(formData.amountPaid) !== total) {
                setFormData(prev => ({...prev, amountPaid: total}));
            }
        }
    }, [formData.isFullPaid, formData.quantity, formData.buyPrice]);

    useEffect(() => {
        if (restockData.isFullPaid) {
            const total = parseFloat(((Number(restockData.quantityAdded) || 0) * (Number(restockData.costPrice) || 0)).toFixed(2));
            if (Number(restockData.amountPaid) !== total) {
                setRestockData(prev => ({...prev, amountPaid: total}));
            }
        }
    }, [restockData.isFullPaid, restockData.quantityAdded, restockData.costPrice]);

    const categoryList = useMemo(() => {
        const cats = new Set(products.map(p => p.category).filter(Boolean));
        return Array.from(cats).sort();
    }, [products]);

    const sanitizeProduct = (p) => ({
        ...p,
        buyPrice: Number(p.buyPrice || 0),
        sellPrice: Number(p.sellPrice || 0),
        governmentPrice: Number(p.governmentPrice || 0),
        quantity: Number(p.quantity || 0),
        lowStockLimit: Number(p.lowStockLimit || 5)
    });

    const fetchData = async () => {
        try {
            // Offline-first load: Instant render from local IndexedDB
            const localProducts = await offlineDB.getProducts(shopId);
            if (localProducts && Array.isArray(localProducts) && localProducts.length > 0) {
                setProducts(localProducts.map(sanitizeProduct));
                setLoading(false);
            }

            const [prodRes, shopRes, purRes] = await Promise.all([
                productService.getAll(shopId),
                shopService.getAll(),
                purchaseService.getAll(shopId)
            ]);
            
            const fetchedProducts = prodRes.data?.data || prodRes.data || [];
            if (Array.isArray(fetchedProducts)) {
                setProducts(fetchedProducts.map(sanitizeProduct));
            }
            setShop(shopRes.data.data.find(s => s._id === shopId));

            const purchases = purRes.data?.data || purRes.data || [];
            const supplierMap = new Map();
            purchases.forEach(pur => {
                if (pur.supplierName && !supplierMap.has(pur.supplierName)) {
                    supplierMap.set(pur.supplierName, pur.supplierPhone || '');
                } else if (pur.supplierName && pur.supplierPhone && !supplierMap.get(pur.supplierName)) {
                    supplierMap.set(pur.supplierName, pur.supplierPhone);
                }
            });
            (prodRes.data.data || []).forEach(p => {
                if (p.supplier && !supplierMap.has(p.supplier)) {
                    supplierMap.set(p.supplier, '');
                }
            });
            setSupplierDetailsList(Array.from(supplierMap.entries()).map(([name, phone]) => ({ name, phone })));
        } catch (err) {
            console.error('Error fetching inventory:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleUnitChange = (newUnit) => {
        let allowPartial = false;
        let allowed = [newUnit];

        if (newUnit === 'KG') {
            allowPartial = true;
            allowed = ['KG', 'Gram'];
        } else if (newUnit === 'Liter') {
            allowPartial = true;
            allowed = ['Liter', 'ML'];
        } else if (newUnit === 'Dozen') {
            allowPartial = true;
            allowed = ['Dozen', 'Piece'];
        } else if (newUnit === 'Meter') {
            allowPartial = true;
            allowed = ['Meter', 'CM'];
        }

        setFormData(prev => ({
            ...prev,
            unit: newUnit,
            allowPartialSelling: allowPartial,
            allowedUnits: allowed
        }));
    };

    const handleOpenModal = async (product = null) => {
        setRestockHistory([]);
        if (product) {
            setCurrentProduct(product);
            setFormData({
                ...product,
                buyPrice: Number(product.buyPrice || 0),
                sellPrice: Number(product.sellPrice || 0),
                governmentPrice: Number(product.governmentPrice || 0),
                quantity: Number(product.quantity || 0),
                lowStockLimit: Number(product.lowStockLimit || 5),
                expiryDate: product.expiryDate ? getLocalFromDate(product.expiryDate) : '',
                shop: shopId,
                allowPartialSelling: product.allowPartialSelling || false,
                allowedUnits: product.allowedUnits?.length ? product.allowedUnits : [product.unit || 'Piece'],
                supplier: product.supplier || '',
                supplierPhone: product.supplierPhone || '',
                billNo: product.billNo || '',
                purchaseDate: product.purchaseDate ? getLocalFromDate(product.purchaseDate) : getLocalToday(),
                paymentMethod: product.paymentMethod || 'Cash',
                amountPaid: product.amountPaid || '',
                entryType: product.entryType || 'Purchase'
            });

            try {
                const res = await productService.getRestockHistory(product._id);
                setRestockHistory(res.data.data);
            } catch (err) {
                console.error('Failed to fetch restock history:', err);
            }
        } else {
            setCurrentProduct(null);
            setFormData({
                name: '',
                category: '',
                brand: '',
                barcode: '',
                productType: 'Piece',
                quantity: 0,
                unit: 'Piece',
                buyPrice: 0,
                sellPrice: 0,
                governmentPrice: 0,
                lowStockLimit: 5,
                expiryDate: '',
                notes: '',
                shop: shopId,
                allowPartialSelling: false,
                allowedUnits: ['Piece'],
                supplier: '',
                supplierPhone: '',
                billNo: '',
                purchaseDate: getLocalToday(),
                paymentMethod: 'Cash',
                amountPaid: '',
                entryType: 'Purchase'
            });
        }
        setShowModal(true);
    };

    const handleOpenRestockModal = (product = null) => {
        if (product) {
            setCurrentProduct(product);
            setRestockData({
                productId: product._id,
                quantityAdded: '',
                costPrice: product.buyPrice || '',
                supplier: product.supplier || '',
                supplierPhone: '',
                billNo: '',
                purchaseDate: getLocalToday(),
                paymentMethod: 'Cash',
                amountPaid: '',
                entryType: 'Purchase',
                notes: ''
            });
        } else {
            setCurrentProduct(null);
            setRestockData({
                productId: '',
                quantityAdded: '',
                costPrice: '',
                supplier: '',
                supplierPhone: '',
                billNo: '',
                purchaseDate: getLocalToday(),
                paymentMethod: 'Cash',
                amountPaid: '',
                entryType: 'Purchase',
                notes: ''
            });
        }
        setShowRestockModal(true);
    };

    const handleOpenHistoryModal = async (product) => {
        setCurrentProduct(product);
        setShowHistoryModal(true);
        setIsHistoryLoading(true);
        try {
            const res = await productService.getInventoryHistory(product._id);
            setInventoryHistory(res.data.data || []);
        } catch (err) {
            console.error('Failed to fetch inventory history:', err);
            setAlertConfig({ open: true, title: 'Error', message: 'Failed to load item history.', type: 'error' });
        } finally {
            setIsHistoryLoading(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        const payload = {
            ...formData,
            buyPrice: Number(formData.buyPrice || 0),
            sellPrice: Number(formData.sellPrice || 0),
            governmentPrice: Number(formData.governmentPrice || 0),
            quantity: Number(formData.quantity || 0),
            lowStockLimit: Number(formData.lowStockLimit || 5)
        };

        if (payload.sellPrice < 0) {
            setAlertConfig({ open: true, title: 'Invalid Price', message: 'Selling price cannot be negative', type: 'error' });
            return;
        }
        if (payload.quantity < 0) {
            setAlertConfig({ open: true, title: 'Invalid Stock', message: 'Stock cannot be negative', type: 'error' });
            return;
        }
        if (payload.allowPartialSelling && (!payload.allowedUnits || payload.allowedUnits.length === 0)) {
            setAlertConfig({ open: true, title: 'Units Required', message: 'Please select at least one allowed unit for partial selling', type: 'error' });
            return;
        }

        setIsSaving(true);
        try {
            if (currentProduct) {
                await productService.update(currentProduct._id, payload);
            } else {
                await productService.create(payload);
            }
            setAlertConfig({ open: true, title: 'Success', message: 'Product saved successfully!', type: 'success' });
            setShowModal(false);
        } catch (err) {
            setAlertConfig({ open: true, title: 'Error', message: err.response?.data?.message || 'Error saving product', type: 'error' });
        } finally {
            setIsSaving(false);
        }
    };

    const handleRestockSubmit = async (e) => {
        e.preventDefault();

        const targetProductId = restockData.productId || (currentProduct && currentProduct._id);
        if (!targetProductId) {
            setAlertConfig({ open: true, title: 'Selection Required', message: 'Please select a product to add stock', type: 'error' });
            return;
        }
        if (restockData.quantityAdded <= 0) {
            setAlertConfig({ open: true, title: 'Invalid Quantity', message: 'Please enter valid quantity', type: 'error' });
            return;
        }

        setIsSaving(true);
        try {
            await productService.restock(targetProductId, restockData);
            fetchData();
            setShowRestockModal(false);
        } catch (err) {
            setAlertConfig({ open: true, title: 'Restock Error', message: err.response?.data?.message || 'Error adding stock', type: 'error' });
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async (id) => {
        setDeleteConfirm({ open: true, id });
    };

    const confirmDelete = async () => {
        try {
            await productService.delete(deleteConfirm.id);
            fetchData();
        } catch (err) {
            console.error('Error deleting product:', err);
        } finally {
            setDeleteConfirm({ open: false, id: null });
        }
    };

    const categories = ['All', ...new Set(products.map(p => p.category).filter(Boolean))];

    const filteredProducts = products.filter(p => {
        const matchesSearch = (p.name || '').toLowerCase().includes((searchQuery || '').toLowerCase()) ||
                            (p.category || '').toLowerCase().includes((searchQuery || '').toLowerCase()) ||
                            (p.barcode || '').includes(searchQuery);
        const matchesCategory = selectedCategory === 'All' || p.category === selectedCategory;
        const matchesLowStock = !showOnlyLowStock || p.quantity <= (p.lowStockLimit || 5);
        return matchesSearch && matchesCategory && matchesLowStock;
    });

    const lowStockItems = products.filter(p => p.quantity <= (p.lowStockLimit || 5));
    const healthyStockItems = products.filter(p => p.quantity > (p.lowStockLimit || 5));

    if (!products || !Array.isArray(products)) {
        return <div style={{padding: '40px', textAlign: 'center'}}>Loading inventory...</div>;
    }

    return (
        <div className="old-inventory-page">
            {/* Old Header Section */}
            <PageHeader 
                title="Stock Center"
                subtitle={shop?.name || 'My Business'}
                backAction={() => navigate(-1)}
                actions={
                    <div className="inventory-header-actions">
                        <button className="inventory-action-btn secondary" onClick={() => handleOpenRestockModal()}>
                            <PackageOpen size={18} /> <span>Add Stock</span>
                        </button>
                        <button className="inventory-action-btn primary" onClick={() => handleOpenModal()}>
                            <Plus size={18} strokeWidth={3} /> <span>New Item</span>
                        </button>
                    </div>
                }
            />

            {!isOnline && (
                <div style={{ background: '#FFFBEB', color: '#B45309', padding: '12px 16px', borderRadius: '12px', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px', border: '1px solid #FEF3C7', fontWeight: 'bold' }}>
                    <AlertCircle size={18} /> Offline Mode – using saved data
                </div>
            )}

            {/* Old Summary Cards */}
            <section className="old-summary-grid">
                <div className="old-metric-row">
                    <div className="old-metric-card">
                        <div className="omc-icon" style={{ backgroundColor: '#1E6BFF15', color: '#1E6BFF' }}><Package size={22} /></div>
                        <div className="omc-data">
                            <span className="omc-label">TOTAL ITEMS</span>
                            <div className="omc-value">{products.length}</div>
                        </div>
                    </div>
                    <div 
                        className={`old-metric-card ${showOnlyLowStock ? 'active-filter' : ''}`} 
                        onClick={() => setShowOnlyLowStock(!showOnlyLowStock)}
                        style={{ cursor: 'pointer', border: showOnlyLowStock ? '2px solid #FF4D4F' : '1px solid transparent' }}
                    >
                        <div className="omc-icon" style={{ backgroundColor: '#FF4D4F15', color: '#FF4D4F' }}><AlertCircle size={22} /></div>
                        <div className="omc-data">
                            <span className="omc-label">LOW STOCK</span>
                            <div className="omc-value">{lowStockItems.length}</div>
                        </div>
                    </div>
                </div>
                <div className="old-metric-card full">
                    <div className="omc-icon" style={{ backgroundColor: '#00B26B15', color: '#00B26B' }}><ShieldCheck size={22} /></div>
                    <div className="omc-data">
                        <span className="omc-label">HEALTHY STOCK</span>
                        <div className="omc-value">{healthyStockItems.length}</div>
                    </div>
                </div>
            </section>

            {/* Old Search + Filter Bar */}
            <div className="old-controls-bar">
                <div className="old-search-wrap">
                    <Search size={20} color="#98A2B3" />
                    <input 
                        type="text" 
                        placeholder="Search items..." 
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>
                <div className="old-category-scroller">
                    {categories.map(cat => (
                        <button 
                            key={cat} 
                            className={`old-cat-chip ${selectedCategory === cat ? 'active' : ''}`}
                            onClick={() => setSelectedCategory(cat)}
                        >
                            {cat}
                        </button>
                    ))}
                </div>

                {showOnlyLowStock && (
                    <div className="active-filter-badge" onClick={() => setShowOnlyLowStock(false)}>
                        Showing only low stock items <X size={14} />
                    </div>
                )}
            </div>

            {loading ? (
                <div className="old-product-grid">
                    {[1, 2, 3, 4, 5, 6].map(i => (
                        <div key={i} className="old-product-card" style={{ padding: '20px' }}>
                            <Skeleton height="24px" width="60%" className="mb-4" />
                            <Skeleton height="16px" width="40%" className="mb-8" />
                            <Skeleton height="40px" borderRadius="12px" />
                        </div>
                    ))}
                </div>
            ) : (
                <>
                    {/* Mobile Only Grid */}
                    <div className="old-product-grid mobile-only">
                        {filteredProducts.length > 0 ? (
                            filteredProducts.map((product) => (
                            <motion.div 
                                key={product._id} 
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="old-product-card"
                            >
                                <div className="opc-header">
                                    <div>
                                        <h3>{product.name}</h3>
                                        {product.brand && <div style={{fontSize: '12px', color: '#667085', marginTop: '2px', fontWeight: '600'}}>{product.brand}</div>}
                                    </div>
                                    <button className="opc-more" onClick={() => handleOpenModal(product)}><Edit3 size={18} /></button>
                                </div>
                                
                                <div className="opc-cat-badge">{product.category || 'GENERAL'}</div>
                                
                                <div className="opc-middle">
                                    <div className="opc-stock-focus" style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                        <span style={{ fontSize: '12px', fontWeight: '800', color: '#98A2B3', textTransform: 'uppercase' }}>Available Stock</span>
                                        <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                                            <span className="opc-price" style={{ color: product.quantity === 0 ? '#DC2626' : product.quantity <= (product.lowStockLimit || 5) ? '#EA580C' : '#059669', fontSize: '28px' }}>
                                                {product.quantity}
                                            </span>
                                            <span style={{ fontWeight: '800', color: '#475467' }}>{product.unit}</span>
                                        </div>
                                    </div>
                                    <button className="btn-history-mobile" onClick={() => handleOpenHistoryModal(product)} style={{ background: '#F0FDF4', border: '1px solid #BBF7D0', padding: '8px 12px', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: '800', color: '#059669', cursor: 'pointer' }}>
                                        <History size={16} /> History
                                    </button>
                                </div>

                                <div className="opc-footer-btns" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', marginTop: '8px' }}>
                                    <button className="btn-old-sell" onClick={() => navigate(`/shop/${shopId}/pos?search=${product.name}`)}>
                                        Sell ↗
                                    </button>
                                    <button className="btn-old-restock" onClick={() => handleOpenRestockModal(product)} style={{ height: '46px', background: '#F2F4F7', border: 'none', color: '#344054', borderRadius: '16px', fontWeight: '800', cursor: 'pointer' }}>
                                        + Stock
                                    </button>
                                    <button className="btn-old-edit" onClick={() => handleDelete(product._id)}>
                                        <Trash2 size={16} color="#FF4D4F" />
                                    </button>
                                </div>
                            </motion.div>
                        ))
                        ) : (
                            <EmptyState 
                                icon={Package}
                                title="No Products Found"
                                description={searchQuery ? `No products match your search "${searchQuery}".` : "Your inventory is currently empty."}
                                actionLabel={searchQuery ? "Clear Search" : "Add Your First Product"}
                                onAction={searchQuery ? () => setSearchQuery('') : () => handleOpenModal()}
                            />
                        )}
                    </div>

                    {/* Desktop Only Radical Table */}
                    <div className="desktop-only radical-desktop-container">
                        <div className="rdc-header">
                            <div className="rdch-left">
                                <h3>Inventory Management</h3>
                                <p>{filteredProducts.length} Items listed in {selectedCategory === 'All' ? 'all categories' : selectedCategory}</p>
                            </div>
                            <div className="rdch-right">
                                <span className="rdch-stat">Total Value: <strong>₹{filteredProducts.reduce((acc, p) => acc + (p.quantity * (p.buyPrice || 0)), 0).toLocaleString()}</strong></span>
                            </div>
                        </div>
                        
                        {filteredProducts.length === 0 ? (
                            <div style={{ padding: '60px 0' }}>
                                <EmptyState 
                                    icon={Package}
                                    title="No Results Found"
                                    description="Adjust your filters or search to see products."
                                    actionLabel="Clear All Filters"
                                    onAction={() => { setSearchQuery(''); setSelectedCategory('All'); setShowOnlyLowStock(false); }}
                                />
                            </div>
                        ) : (
                            <div className="table-responsive-wrapper">
                                <table className="radical-desktop-table">
                                    <thead>
                                        <tr>
                                            <th>Product Details</th>
                                            <th>Category</th>
                                            <th style={{ width: '25%' }}>Available Stock</th>
                                            <th>Sell Price</th>
                                            <th style={{ textAlign: 'right' }}>Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredProducts.map((product) => (
                                            <tr key={product._id} className="sl-desktop-row">
                                                <td className="sld-cust">
                                                    <div className="cust-main" style={{ fontSize: '16px' }}>{product.name}</div>
                                                    {product.brand && <div className="cust-sub" style={{color: '#667085', fontWeight: '600'}}>{product.brand}</div>}
                                                    {product.barcode && <div className="cust-sub">#{product.barcode}</div>}
                                                </td>
                                                <td className="sld-time">
                                                    <span className="cat-pill">{product.category || 'General'}</span>
                                                </td>
                                                <td className="sld-stock">
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                        <span style={{ 
                                                            fontSize: '24px', 
                                                            fontWeight: '900', 
                                                            color: product.quantity === 0 ? '#DC2626' : product.quantity <= (product.lowStockLimit || 5) ? '#EA580C' : '#059669' 
                                                        }}>
                                                            {product.quantity}
                                                        </span>
                                                        <span style={{ fontSize: '14px', fontWeight: '700', color: '#475467' }}>{product.unit}</span>
                                                        {product.quantity <= (product.lowStockLimit || 5) && (
                                                            <span style={{ background: product.quantity === 0 ? '#FEE2E2' : '#FFEDD5', color: product.quantity === 0 ? '#DC2626' : '#EA580C', padding: '4px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: '800' }}>
                                                                {product.quantity === 0 ? 'OUT OF STOCK' : 'LOW STOCK'}
                                                            </span>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="sld-amt" style={{ textAlign: 'left' }}>
                                                    <div className="amt-val" style={{ color: '#64748B', fontWeight: '600' }}>₹{product.sellPrice?.toLocaleString() || 0}</div>
                                                </td>
                                                <td className="sld-actions" style={{ textAlign: 'right' }}>
                                                    <div className="table-action-group">
                                                        <button className="t-btn history-btn" title="Item History" onClick={() => handleOpenHistoryModal(product)} style={{ background: '#F0FDF4', color: '#059669', borderColor: '#BBF7D0', width: 'auto', padding: '0 12px', gap: '6px' }}>
                                                            <History size={16} /> <span style={{ fontWeight: 700 }}>History</span>
                                                        </button>
                                                        <button className="t-btn edit" title="Edit Product" onClick={() => handleOpenModal(product)}><Edit3 size={16} /></button>
                                                        <button className="t-btn restock" title="Add Stock" onClick={() => handleOpenRestockModal(product)}><PackageOpen size={16} /></button>
                                                        <button className="t-btn delete" title="Delete" onClick={() => handleDelete(product._id)}><Trash2 size={16} /></button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </>
            )}

            {/* Old Modal Style */}
            <AnimatePresence>
                {showModal && (
                    <div className="old-modal-overlay">
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="old-m-backdrop" onClick={() => setShowModal(false)} />
                        <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} className="old-m-sheet">
                            <div className="old-m-header">
                                <div className="old-m-line"></div>
                                <h2>{currentProduct ? 'Edit Product' : 'Add New Product'}</h2>
                            </div>
                            <form onSubmit={handleSubmit} className="old-stock-form">
                                <div className="old-m-scroll">
                                    <div className="old-field">
                                        <label>Product Name <span className="req">*</span></label>
                                        <input required value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} placeholder="e.g. Premium Rice" />
                                    </div>
                                    <div className="old-field">
                                        <label>Brand Name</label>
                                        <input value={formData.brand} onChange={(e) => setFormData({...formData, brand: e.target.value})} placeholder="e.g. Aashirvaad" />
                                    </div>
                                    <div className="old-field">
                                        <label>Category</label>
                                        <SearchableSelect 
                                            value={formData.category}
                                            options={categoryList}
                                            onChange={(val) => setFormData({...formData, category: val})}
                                            placeholder="Select existing or type new..."
                                        />
                                    </div>

                                    <SearchableSelect 
                                        label="Supplier / Retailer"
                                        value={formData.supplier}
                                        options={supplierDetailsList.map(s => s.name)}
                                        onChange={(val) => {
                                            const existing = supplierDetailsList.find(s => s.name === val);
                                            setFormData({
                                                ...formData, 
                                                supplier: val, 
                                                supplierPhone: (existing && existing.phone) ? existing.phone : formData.supplierPhone
                                            });
                                        }}
                                        placeholder="Search existing or type new..."
                                    />

                                    <div className="old-field-row-mobile-2">
                                        <div className="old-field">
                                            <label>Supplier Phone</label>
                                            <input value={formData.supplierPhone} onChange={(e) => setFormData({...formData, supplierPhone: e.target.value})} placeholder="99XXXXXXXX" />
                                        </div>
                                        <div className="old-field">
                                            <label>Purchase Bill No</label>
                                            <input value={formData.billNo} onChange={(e) => setFormData({...formData, billNo: e.target.value})} placeholder="BILL-101" />
                                        </div>
                                    </div>

                                    <div className="old-field-row-mobile-2">
                                        <PremiumDatePicker 
                                            label="Purchase Date"
                                            value={formData.purchaseDate}
                                            onChange={(val) => setFormData({...formData, purchaseDate: val})}
                                        />
                                        <CustomSelect 
                                            label="Entry Type"
                                            value={formData.entryType}
                                            options={['Purchase', 'Opening Stock', 'Adjustment', 'Return Stock']}
                                            onChange={(val) => setFormData({...formData, entryType: val})}
                                        />
                                    </div>

                                    <div className="old-field-row-mobile-2">
                                        <CustomSelect 
                                            label="Payment Method"
                                            value={formData.paymentMethod}
                                            options={['Cash', 'Online', 'Credit']}
                                            onChange={(val) => setFormData({...formData, paymentMethod: val})}
                                        />
                                        <div className="old-field">
                                            <label>Amount Paid</label>
                                            <input 
                                                type="number" 
                                                min="0" step="0.01" 
                                                value={formData.amountPaid} 
                                                disabled={formData.isFullPaid}
                                                onChange={(e) => {
                                                    const val = e.target.value;
                                                    const total = parseFloat(((Number(formData.quantity) || 0) * (Number(formData.buyPrice) || 0)).toFixed(2));
                                                    setFormData({...formData, amountPaid: val, isFullPaid: Number(val) === total && total > 0});
                                                }} 
                                                placeholder="Amount paid" 
                                            />
                                            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '6px', cursor: 'pointer', fontSize: '13px', color: '#475569', fontWeight: '600', flexDirection: 'row' }}>
                                                <input 
                                                    type="checkbox" 
                                                    checked={formData.isFullPaid || false}
                                                    onChange={(e) => {
                                                        if (e.target.checked) {
                                                            const total = parseFloat(((Number(formData.quantity) || 0) * (Number(formData.buyPrice) || 0)).toFixed(2));
                                                            setFormData({...formData, isFullPaid: true, amountPaid: total});
                                                        } else {
                                                            setFormData({...formData, isFullPaid: false, amountPaid: ''});
                                                        }
                                                    }} 
                                                    style={{ width: '16px', height: '16px', margin: 0, cursor: 'pointer', display: 'inline-block' }} 
                                                />
                                                Mark as full paid
                                            </label>
                                        </div>
                                    </div>

                                    <div className="old-field-row-mobile-2">
                                        <CustomSelect 
                                            label="Base Unit"
                                            value={formData.unit}
                                            options={unitOptions}
                                            onChange={(val) => handleUnitChange(val)}
                                        />
                                        <div className="old-field">
                                            <label>Available Stock <span className="req">*</span></label>
                                            <input type="number" required min="0" step="0.01" value={formData.quantity} onChange={(e) => setFormData({...formData, quantity: e.target.value})} />
                                        </div>
                                    </div>

                                    {/* Partial Selling Section */}
                                    <div className="partial-selling-box">
                                        <div className="ps-header">
                                            <div className="ps-info">
                                                <h4>Allow Partial Selling</h4>
                                                <p>Can customers buy this in smaller units?</p>
                                            </div>
                                            <PremiumToggle 
                                                label="Allow Partial Selling"
                                                active={formData.allowPartialSelling}
                                                onChange={(val) => setFormData({...formData, allowPartialSelling: val})}
                                            />
                                        </div>
                                        {formData.allowPartialSelling && (
                                            <div className="ps-units">
                                                <label>Allowed Selling Units</label>
                                                <div className="ps-chips">
                                                    {['KG', 'Gram', 'Liter', 'ML', 'Dozen', 'Piece', 'Meter', 'CM', 'Pack', 'Box'].map(u => (
                                                        <button 
                                                            type="button"
                                                            key={u} 
                                                            className={formData.allowedUnits.includes(u) ? 'active' : ''}
                                                            onClick={() => {
                                                                const units = formData.allowedUnits.includes(u) 
                                                                    ? formData.allowedUnits.filter(x => x !== u)
                                                                    : [...formData.allowedUnits, u];
                                                                setFormData({...formData, allowedUnits: units});
                                                            }}
                                                        >
                                                            {u}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    <div className="old-field-row-mobile-2">
                                        <div className="old-field">
                                            <label>Purchase Price (per unit)</label>
                                            <input type="number" min="0" max="10000000" step="0.01" value={formData.buyPrice} onChange={(e) => setFormData({...formData, buyPrice: e.target.value})} />
                                        </div>
                                        <div className="old-field">
                                            <label>Selling Price (per unit) <span className="req">*</span></label>
                                            <input type="number" required min="0" max="10000000" step="0.01" value={formData.sellPrice} onChange={(e) => setFormData({...formData, sellPrice: e.target.value})} />
                                        </div>
                                    </div>

                                    {shop?.type === 'Fertilizers' && (
                                        <div className="old-field-row-mobile-2">
                                            <div className="old-field">
                                                <label style={{color: '#059669'}}>Government Price (per unit)</label>
                                                <input type="number" min="0" max="10000000" step="0.01" value={formData.governmentPrice} onChange={(e) => setFormData({...formData, governmentPrice: e.target.value})} />
                                            </div>
                                        </div>
                                    )}

                                    <div className="old-field-row-mobile-2">
                                        <div className="old-field">
                                            <label>Low Stock Alert</label>
                                            <input type="number" min="0" value={formData.lowStockLimit} onChange={(e) => setFormData({...formData, lowStockLimit: e.target.value})} />
                                        </div>
                                        <PremiumDatePicker 
                                            label="Expiry Date"
                                            value={formData.expiryDate}
                                            onChange={(val) => setFormData({...formData, expiryDate: val})}
                                        />
                                    </div>

                                    {currentProduct && restockHistory.length > 0 && (
                                        <div className="restock-history-box">
                                            <h4>Stock Addition History</h4>
                                            <div className="rh-table-wrapper">
                                                <table className="rh-table">
                                                    <thead>
                                                        <tr>
                                                            <th>Date</th>
                                                            <th>Qty Added</th>
                                                            <th>Supplier</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {restockHistory.map((log, i) => (
                                                            <tr key={i}>
                                                                 <td>{new Date(log.date).toLocaleDateString('en-IN', {day: 'numeric', month: 'short'})}</td>
                                                                <td className="text-success">+{log.quantityAdded}</td>
                                                                <td>{log.supplier}</td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                    )}
                                </div>
                                <div className="old-m-footer">
                                    <button type="submit" className="btn-old-save-modal" disabled={isSaving}>
                                        {isSaving ? 'Saving...' : currentProduct ? 'Update Product' : 'Add Product'}
                                    </button>
                                </div>
                            </form>
                        </motion.div>
                    </div>
                )}

                {showRestockModal && (
                    <div className="old-modal-overlay">
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="old-m-backdrop" onClick={() => setShowRestockModal(false)} />
                        <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} className="old-m-sheet">
                            <div className="old-m-header">
                                <div className="old-m-line"></div>
                                <h2>Add Stock to Product</h2>
                            </div>
                            <form onSubmit={handleRestockSubmit} className="old-stock-form">
                                <div className="old-m-scroll">
                                    <div className="old-field">
                                        <label>Select Product <span className="req">*</span></label>
                                        {currentProduct ? (
                                            <input type="text" value={currentProduct.name} disabled style={{ background: '#F2F4F7', color: '#667085' }} />
                                        ) : (
                                            <SearchableSelect 
                                                label="Select Product"
                                                placeholder="🔍 Type product name..."
                                                value={restockData.productId}
                                                options={products.map(p => ({ label: p.name, value: p._id }))}
                                                onChange={(val) => {
                                                    const prod = products.find(p => p._id === val);
                                                    setRestockData({
                                                        ...restockData,
                                                        productId: val,
                                                        costPrice: prod?.buyPrice || '',
                                                        supplier: prod?.supplier || ''
                                                    });
                                                }}
                                            />
                                        )}
                                    </div>

                                    <div className="old-field-row-mobile-2">
                                        <div className="old-field">
                                            <label>Quantity Added <span className="req">*</span></label>
                                            <input type="number" required min="0.01" step="0.01" value={restockData.quantityAdded} onChange={(e) => setRestockData({...restockData, quantityAdded: e.target.value})} placeholder="e.g. 50" />
                                        </div>
                                        <div className="old-field">
                                            <label>Purchase Price (Per Unit) <span className="req">*</span></label>
                                            <input type="number" required min="0" step="0.01" value={restockData.costPrice} onChange={(e) => setRestockData({...restockData, costPrice: e.target.value})} placeholder="e.g. 350" />
                                        </div>
                                    </div>

                                    <SearchableSelect 
                                        label="Supplier / Retailer Name"
                                        value={restockData.supplier}
                                        options={supplierDetailsList.map(s => s.name)}
                                        onChange={(val) => {
                                            const existing = supplierDetailsList.find(s => s.name === val);
                                            setRestockData({
                                                ...restockData, 
                                                supplier: val, 
                                                supplierPhone: (existing && existing.phone) ? existing.phone : restockData.supplierPhone
                                            });
                                        }}
                                        placeholder="🔍 Search existing or add new"
                                    />

                                    <div className="old-field-row-mobile-2">
                                        <div className="old-field">
                                            <label>Supplier Phone</label>
                                            <input value={restockData.supplierPhone} onChange={(e) => setRestockData({...restockData, supplierPhone: e.target.value})} placeholder="99XXXXXXXX" />
                                        </div>
                                        <div className="old-field">
                                            <label>Purchase Bill No</label>
                                            <input value={restockData.billNo} onChange={(e) => setRestockData({...restockData, billNo: e.target.value})} placeholder="BILL-101" />
                                        </div>
                                    </div>

                                    <div className="old-field-row-mobile-2">
                                        <PremiumDatePicker 
                                            label="Purchase Date"
                                            value={restockData.purchaseDate}
                                            onChange={(val) => setRestockData({...restockData, purchaseDate: val})}
                                        />
                                        <CustomSelect 
                                            label="Entry Type"
                                            value={restockData.entryType}
                                            options={['Purchase', 'Opening Stock', 'Adjustment', 'Return Stock']}
                                            onChange={(val) => setRestockData({...restockData, entryType: val})}
                                        />
                                    </div>

                                    <div className="old-field-row-mobile-2">
                                        <div className="old-field">
                                            <label>Payment Method</label>
                                            <select value={restockData.paymentMethod} onChange={(e) => setRestockData({...restockData, paymentMethod: e.target.value})}>
                                                <option value="Cash">Cash</option>
                                                <option value="Online">Online</option>
                                                <option value="Credit">Credit</option>
                                            </select>
                                        </div>
                                        <div className="old-field">
                                            <label>Amount Paid</label>
                                            <input 
                                                type="number" 
                                                min="0" step="0.01" 
                                                value={restockData.amountPaid} 
                                                disabled={restockData.isFullPaid}
                                                onChange={(e) => {
                                                    const val = e.target.value;
                                                    const total = parseFloat(((Number(restockData.quantityAdded) || 0) * (Number(restockData.costPrice) || 0)).toFixed(2));
                                                    setRestockData({...restockData, amountPaid: val, isFullPaid: Number(val) === total && total > 0});
                                                }} 
                                                placeholder="Amount paid" 
                                            />
                                            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '6px', cursor: 'pointer', fontSize: '13px', color: '#475569', fontWeight: '600', flexDirection: 'row' }}>
                                                <input 
                                                    type="checkbox" 
                                                    checked={restockData.isFullPaid || false}
                                                    onChange={(e) => {
                                                        if (e.target.checked) {
                                                            const total = parseFloat(((Number(restockData.quantityAdded) || 0) * (Number(restockData.costPrice) || 0)).toFixed(2));
                                                            setRestockData({...restockData, isFullPaid: true, amountPaid: total});
                                                        } else {
                                                            setRestockData({...restockData, isFullPaid: false, amountPaid: ''});
                                                        }
                                                    }} 
                                                    style={{ width: '16px', height: '16px', margin: 0, cursor: 'pointer', display: 'inline-block' }} 
                                                />
                                                Mark as full paid
                                            </label>
                                        </div>
                                    </div>

                                    <div className="old-field">
                                        <label>Notes</label>
                                        <input value={restockData.notes} onChange={(e) => setRestockData({...restockData, notes: e.target.value})} placeholder="Add notes about this stock entry..." />
                                    </div>
                                </div>
                                <div className="old-m-footer">
                                    <button type="submit" className="btn-old-save-modal" disabled={isSaving}>
                                        {isSaving ? 'Adding Stock...' : 'Add Stock Entry'}
                                    </button>
                                </div>
                            </form>
                        </motion.div>
                    </div>
                )}

                {/* History Modal */}
                {showHistoryModal && (
                    <div className="old-modal-overlay">
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="old-m-backdrop" onClick={() => setShowHistoryModal(false)} />
                        <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} className="old-m-sheet" style={{ height: '90vh', display: 'flex', flexDirection: 'column' }}>
                            <div className="old-m-header" style={{ paddingBottom: '0' }}>
                                <div className="old-m-line"></div>
                                <h2>Stock History</h2>
                                <p style={{ margin: '4px 0 16px 0', color: '#667085', fontWeight: 600 }}>{currentProduct?.name}</p>
                            </div>
                            
                            {/* Sticky Stock Summary */}
                            <div style={{ padding: '0 24px 16px 24px', borderBottom: '1px solid #F2F4F7' }}>
                                <div style={{ background: '#F9FAFB', border: '1.5px solid #E4E7EC', borderRadius: '16px', padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <div>
                                        <div style={{ fontSize: '12px', fontWeight: 800, color: '#667085', textTransform: 'uppercase' }}>Current Available Stock</div>
                                        <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginTop: '4px' }}>
                                            <span style={{ fontSize: '32px', fontWeight: 900, color: currentProduct?.quantity === 0 ? '#DC2626' : currentProduct?.quantity <= (currentProduct?.lowStockLimit || 5) ? '#EA580C' : '#059669' }}>
                                                {currentProduct?.quantity}
                                            </span>
                                            <span style={{ fontSize: '16px', fontWeight: 700, color: '#475467' }}>{currentProduct?.unit}</span>
                                        </div>
                                    </div>
                                    <PackageOpen size={40} color="#D0D5DD" />
                                </div>
                            </div>

                            <div className="old-m-scroll" style={{ padding: '16px 24px', background: '#F9FAFB', flex: 1 }}>
                                {isHistoryLoading ? (
                                    <div style={{ display: 'flex', justifyContent: 'center', padding: '40px 0' }}>
                                        <div className="old-loader-circle" style={{ borderColor: '#E4E7EC', borderTopColor: '#059669' }}></div>
                                    </div>
                                ) : inventoryHistory.length === 0 ? (
                                    <EmptyState icon={History} title="No History Yet" description="Stock movements will appear here chronologically." />
                                ) : (
                                    <div className="history-timeline" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                        {inventoryHistory.map((log) => {
                                            const isAddition = ['STOCK_ADDED', 'PURCHASE_ENTRY', 'STOCK_RETURNED'].includes(log.actionType);
                                            const isManual = log.actionType === 'STOCK_UPDATED' || log.actionType === 'STOCK_ADJUSTED';
                                            const isSold = log.actionType === 'STOCK_SOLD';
                                            
                                            let icon = <Package size={16} />;
                                            let color = '#475467';
                                            let bg = '#F2F4F7';

                                            if (isAddition) {
                                                icon = <TrendingUp size={16} />;
                                                color = '#059669';
                                                bg = '#D1FAE5';
                                            } else if (isSold) {
                                                icon = <ShoppingCart size={16} />;
                                                color = '#DC2626';
                                                bg = '#FEE2E2';
                                            } else if (isManual) {
                                                icon = <Edit3 size={16} />;
                                                color = '#D97706';
                                                bg = '#FEF3C7';
                                            }

                                            return (
                                                <div 
                                                    key={log._id} 
                                                    className={`history-card ${isSold ? 'history-card-clickable' : ''}`} 
                                                    style={{ background: 'white', borderRadius: '16px', padding: '16px', border: '1px solid #F2F4F7', boxShadow: '0 2px 8px rgba(0,0,0,0.02)' }}
                                                    onClick={() => {
                                                        if (isSold) {
                                                            const d = new Date(log.createdAt);
                                                            const localDateStr = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
                                                            navigate(`/shop/${shopId}/gov-sales-log?date=${localDateStr}`);
                                                        }
                                                    }}
                                                >
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                                                        <span style={{ fontSize: '12px', fontWeight: 800, color: '#98A2B3' }}>
                                                            {new Date(log.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })} · {new Date(log.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                        </span>
                                                        {log.referenceId && (
                                                            <span style={{ fontSize: '11px', fontWeight: 700, color: '#667085', background: '#F2F4F7', padding: '2px 8px', borderRadius: '6px' }}>
                                                                Ref: {log.referenceId}
                                                            </span>
                                                        )}
                                                    </div>
                                                    
                                                    <div style={{ display: 'flex', gap: '12px' }}>
                                                        <div style={{ width: '32px', height: '32px', borderRadius: '10px', background: bg, color: color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                                            {icon}
                                                        </div>
                                                        <div style={{ flex: 1 }}>
                                                            <div style={{ fontSize: '15px', fontWeight: 800, color: '#101828', marginBottom: (!isSold) ? '4px' : '12px' }}>
                                                                {isAddition && `+ Added ${log.quantity} ${log.unit}`}
                                                                {isSold && `- Sold ${log.quantity} ${log.unit}`}
                                                                {isManual && `Stock Adjusted by ${log.quantity} ${log.unit}`}
                                                            </div>
                                                            
                                                            {(!isSold) && (
                                                                <div style={{ fontSize: '13px', color: '#667085', fontWeight: 600, marginBottom: '12px' }}>
                                                                    {log.notes} {(log.source && log.source !== 'Daily Summary' && log.source !== 'System') ? `(${log.source})` : ''}
                                                                </div>
                                                            )}
                                                            
                                                            <div style={{ background: '#F9FAFB', border: '1px dashed #E4E7EC', padding: '8px 12px', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                                <span style={{ fontSize: '12px', fontWeight: 800, color: '#667085', textTransform: 'uppercase' }}>Stock Transition</span>
                                                                <span style={{ fontSize: '14px', fontWeight: 800, color: '#101828' }}>
                                                                    {log.previousStock} <ArrowUpRight size={14} style={{ margin: '0 4px', color: '#98A2B3' }} /> {log.newStock} {log.unit}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            <style jsx="true">{`
                .old-inventory-page { background: #F6F8FC; min-height: 100vh; padding-bottom: 120px; }
                
                /* Old Header */
                .old-header { display: flex; align-items: center; justify-content: space-between; padding: 16px; margin-bottom: 10px; }
                .old-back-btn { width: 48px; height: 48px; background: white; border: none; border-radius: 14px; display: flex; align-items: center; justify-content: center; color: #101828; box-shadow: 0 4px 12px rgba(0,0,0,0.05); cursor: pointer; }
                .old-header-text { text-align: center; flex: 1; }
                .old-header-text h1 { font-size: 22px; font-weight: 800; color: #071B44; margin: 0; }
                .old-header-text p { font-size: 14px; color: #98A2B3; margin: 4px 0 0 0; font-weight: 600; }
                .header-action-group { display: flex; gap: 10px; }
                .inventory-header-actions { display: flex; gap: 8px; width: 100%; }
                .inventory-action-btn { flex: 1; height: 48px; border-radius: 14px; border: none; font-weight: 800; font-size: 14px; display: flex; align-items: center; justify-content: center; gap: 8px; cursor: pointer; transition: 0.2s; white-space: nowrap; }
                .inventory-action-btn.primary { background: #071B44; color: white; box-shadow: 0 4px 12px rgba(7, 27, 68, 0.2); }
                .inventory-action-btn.secondary { background: white; color: #071B44; border: 1.5px solid #E4E7EC; }
                .inventory-action-btn:active { transform: scale(0.96); }
                
                @media (min-width: 768px) {
                    .inventory-header-actions { width: auto; }
                    .inventory-action-btn { padding: 0 20px; flex: none; }
                }

                /* Summary Cards */
                .old-summary-grid { padding: 0 12px; display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 16px; }
                .old-metric-row { display: contents; }
                .old-metric-card { background: white; padding: 10px 14px; border-radius: 14px; display: flex; align-items: center; gap: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.02); height: 56px; }
                .omc-icon { width: 32px; height: 32px; border-radius: 8px; display: flex; align-items: center; justify-content: center; }
                .omc-icon svg { width: 18px; height: 18px; }
                .omc-data { display: flex; flex-direction: column; }
                .omc-label { font-size: 9px; font-weight: 800; color: #98A2B3; text-transform: uppercase; letter-spacing: 0.05em; }
                .omc-value { font-size: 16px; font-weight: 800; color: #101828; }

                /* Search + Filters */
                .old-controls-bar { padding: 0 12px; display: flex; flex-direction: column; gap: 12px; margin-bottom: 16px; }
                .old-search-wrap { height: 44px; background: white; border-radius: 12px; display: flex; align-items: center; padding: 0 12px; gap: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.02); }
                .old-search-wrap input { border: none; outline: none; background: transparent; flex: 1; font-weight: 700; font-size: 14px; color: #101828; }
                
                .active-filter-badge { margin: 0 12px; padding: 6px 12px; background: #FEF3F2; color: #B42318; border-radius: 8px; font-size: 12px; font-weight: 800; display: flex; align-items: center; justify-content: space-between; cursor: pointer; border: 1px solid #FECDCA; }
                .old-category-scroller { display: flex; gap: 8px; overflow-x: auto; scrollbar-width: none; padding-bottom: 0; }
                .old-cat-chip { padding: 8px 16px; background: white; border: 1.5px solid #F2F4F7; border-radius: 99px; font-weight: 800; font-size: 12px; color: #667085; cursor: pointer; white-space: nowrap; transition: 0.2s; }
                .old-cat-chip.active { background: #071B44; border-color: #071B44; color: white; }

                /* Product Grid */
                .old-product-grid { padding: 0 12px; display: flex; flex-direction: column; gap: 12px; }
                .old-product-card { background: white; border-radius: 18px; padding: 14px; box-shadow: 0 2px 15px rgba(0,0,0,0.03); display: flex; flex-direction: column; gap: 10px; }
                
                .opc-header { display: flex; justify-content: space-between; align-items: center; }
                .opc-header h3 { font-size: 20px; font-weight: 800; color: #101828; margin: 0; }
                .opc-more { background: transparent; border: none; color: #D0D5DD; cursor: pointer; }
                
                .opc-cat-badge { font-size: 10px; font-weight: 800; color: #1E6BFF; background: #F5F9FF; padding: 4px 12px; border-radius: 8px; text-transform: uppercase; letter-spacing: 0.05em; align-self: flex-start; }
                
                .opc-middle { display: flex; justify-content: space-between; align-items: center; }
                .opc-pricing { display: flex; align-items: baseline; gap: 8px; }
                .opc-price { font-size: 24px; font-weight: 800; color: #101828; }
                .opc-profit { font-size: 14px; font-weight: 700; color: #00B26B; }
                
                .opc-low-badge { background: #FFF1F0; color: #FF4D4F; padding: 4px 8px; border-radius: 6px; font-size: 11px; font-weight: 700; display: inline-flex; align-items: center; gap: 4px; }
                .opc-stock-info-muted { font-size: 12px; font-weight: 600; color: #98A2B3; }

                .opc-footer-btns { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-top: 4px; }
                .btn-old-sell { height: 46px; background: #071B44; color: white; border: none; border-radius: 16px; font-weight: 800; cursor: pointer; }
                .btn-old-edit { height: 46px; background: white; border: 1.5px solid #F2F4F7; color: #475467; border-radius: 16px; font-weight: 800; cursor: pointer; }

                /* Old Modal Sheet */
                .old-modal-overlay { position: fixed; inset: 0; z-index: 7000; display: flex; align-items: flex-end; justify-content: center; }
                .old-m-backdrop { position: absolute; inset: 0; background: rgba(7, 27, 68, 0.3); backdrop-filter: blur(10px); }
                .old-m-sheet { position: relative; width: 100%; max-width: 500px; background: white; border-radius: 32px 32px 0 0; padding-bottom: 32px; box-shadow: 0 -20px 40px rgba(0,0,0,0.1); }
                .old-m-header { padding: 16px 0; display: flex; flex-direction: column; align-items: center; gap: 12px; }
                .old-m-line { width: 40px; height: 5px; background: #F2F4F7; border-radius: 10px; }
                .old-m-header h2 { font-size: 20px; font-weight: 800; margin: 0; }

                .old-stock-form { padding: 0 24px; }
                .old-m-scroll { display: flex; flex-direction: column; gap: 20px; max-height: 60dvh; overflow-y: auto; overflow-x: hidden; padding-bottom: 20px; }
                .old-field { display: flex; flex-direction: column; gap: 8px; }
                .old-field-row { display: grid; grid-template-columns: 1fr; gap: 16px; }
                .old-field-row-mobile-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
                @media (max-width: 360px) {
                    .old-field-row-mobile-2 { grid-template-columns: 1fr; }
                }
                
                /* Restock History */
                .restock-history-box { border-top: 1px dashed #E4E7EC; padding-top: 16px; margin-top: 10px; }
                .restock-history-box h4 { font-size: 14px; font-weight: 800; color: #101828; margin: 0 0 12px 0; }
                .rh-table-wrapper { background: #F9FAFB; border-radius: 12px; padding: 8px; border: 1px solid #F2F4F7; max-height: 180px; overflow-y: auto; }
                .rh-table { width: 100%; border-collapse: collapse; }
                .rh-table th { text-align: left; font-size: 11px; font-weight: 800; color: #667085; text-transform: uppercase; padding: 8px; border-bottom: 1px solid #EAECF0; }
                .rh-table td { padding: 8px; font-size: 13px; font-weight: 600; color: #344054; border-bottom: 1px solid #F2F4F7; }
                .rh-table tr:last-child td { border-bottom: none; }
                .text-success { color: #027A48; font-weight: 700; }
                .old-field label { font-size: 13px; font-weight: 700; color: #667085; display: flex; align-items: center; gap: 4px; }
                .old-field label .req { color: #FF4D4F; }
                .old-field input, .old-field select { height: 54px; padding: 0 16px; border-radius: 16px; border: 1.5px solid #F2F4F7; background: #F9FAFB; font-weight: 600; font-size: 16px; width: 100%; box-sizing: border-box; }
                .btn-old-save-modal { width: 100%; height: 60px; background: #1E6BFF; color: white; border: none; border-radius: 18px; font-size: 18px; font-weight: 800; cursor: pointer; margin-top: 10px; transition: 0.2s; }
                .btn-old-save-modal:disabled { background: #98A2B3; cursor: not-allowed; }

                /* Mobile Optimization - Ultra Compact ERP UI */
                @media (max-width: 768px) {
                    .old-inventory-page { padding-bottom: 40px; }
                    
                    .old-header { height: 56px; padding: 0 12px; position: sticky; top: 0; z-index: 100; background: #F6F8FC; margin-bottom: 8px; }
                    .old-back-btn { width: 36px; height: 36px; border-radius: 10px; }
                    .old-back-btn svg { width: 18px; height: 18px; }
                    .header-action-group { gap: 6px; }
                    .old-add-btn-pill, .old-add-btn-square { height: 36px; padding: 0 10px; border-radius: 10px; font-size: 13px; }
                    .old-add-btn-pill span, .old-add-btn-square span { display: none; }
                    .old-header-text h1 { font-size: 18px; }
                    .old-header-text p { font-size: 11px; margin-top: 2px; }

                    .old-summary-grid { 
                        display: flex; 
                        flex-direction: row; 
                        overflow-x: auto; 
                        gap: 10px; 
                        padding: 0 12px 8px 12px; 
                        margin-bottom: 12px; 
                        scrollbar-width: none; 
                        -webkit-overflow-scrolling: touch;
                    }
                    .old-summary-grid::-webkit-scrollbar { display: none; }
                    .old-metric-row { display: flex; gap: 10px; }
                    .old-metric-card { flex: 0 0 auto; width: 140px; padding: 12px; border-radius: 16px; gap: 10px; height: 60px; }
                    .omc-icon { width: 32px; height: 32px; border-radius: 8px; }
                    .omc-icon svg { width: 16px; height: 16px; }
                    .omc-label { font-size: 9px; }
                    .omc-value { font-size: 16px; }

                    .old-controls-bar { padding: 0 12px; margin-bottom: 12px; gap: 10px; position: sticky; top: 56px; z-index: 99; background: #F6F8FC; padding-top: 4px; }
                    .old-search-wrap { height: 44px; border-radius: 14px; padding: 0 12px; gap: 8px; }
                    .old-search-wrap input { font-size: 14px; }
                    .old-search-wrap svg { width: 18px; height: 18px; }
                    
                    .old-cat-chip { padding: 6px 14px; font-size: 12px; border-radius: 99px; }

                    .old-product-grid { padding: 0 12px; gap: 12px; }
                    .old-product-card { padding: 14px; border-radius: 20px; gap: 12px; }
                    .opc-header h3 { font-size: 16px; }
                    .opc-cat-badge { font-size: 9px; padding: 3px 8px; }
                    .opc-price { font-size: 18px; }
                    .opc-profit { font-size: 12px; }
                    .opc-low-badge, .opc-stock-info-muted { font-size: 11px; }

                    .opc-footer-btns { gap: 8px; }
                    .btn-old-sell, .btn-old-edit { height: 36px; border-radius: 12px; font-size: 13px; font-weight: 700; }
                    .btn-old-restock { height: 36px !important; border-radius: 12px !important; font-size: 13px !important; font-weight: 700 !important; }

                    .old-m-sheet { 
                        border-radius: 24px 24px 0 0; 
                        max-height: 90vh; 
                        display: flex; 
                        flex-direction: column;
                        padding-bottom: var(--keyboard-height);
                        transition: padding-bottom 0.15s ease-out;
                    }
                    .old-m-header { position: sticky; top: 0; background: white; z-index: 10; border-radius: 24px 24px 0 0; }
                    .old-stock-form { padding: 0 16px; flex: 1; display: flex; flex-direction: column; overflow: hidden; }
                    .old-m-scroll { flex: 1; overflow-y: auto; }
                    .old-field input, .old-field select { height: 48px; border-radius: 14px; font-size: 14px; padding: 0 12px; }
                    .old-field label { font-size: 12px; }
                    .old-m-footer { position: sticky; bottom: 0; background: white; padding: 16px 0; border-top: 1px solid #F2F4F7; z-index: 10; }
                    .btn-old-save-modal { height: 50px; border-radius: 14px; font-size: 16px; margin-top: 0; }
                }

                /* Partial Selling UI */
                .partial-selling-box { background: white; border: 1.5px solid #F2F4F7; border-radius: 16px; padding: 16px; display: flex; flex-direction: column; gap: 16px; }
                .ps-header { display: flex; justify-content: space-between; align-items: center; }
                .ps-info h4 { font-size: 15px; font-weight: 800; color: #101828; margin: 0; }
                .ps-info p { font-size: 12px; font-weight: 600; color: #667085; margin: 4px 0 0 0; }
                
                .switch-v2 { position: relative; display: inline-block; width: 44px; height: 24px; }
                .switch-v2 input { opacity: 0; width: 0; height: 0; }
                .slider-v2 { position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0; background-color: #D0D5DD; transition: .3s; border-radius: 34px; }
                .slider-v2:before { position: absolute; content: ""; height: 18px; width: 18px; left: 3px; bottom: 3px; background-color: white; transition: .3s; border-radius: 50%; box-shadow: 0 2px 4px rgba(0,0,0,0.2); }
                .switch-v2 input:checked + .slider-v2 { background-color: #00B26B; }
                .switch-v2 input:checked + .slider-v2:before { transform: translateX(20px); }

                .ps-units { display: flex; flex-direction: column; gap: 10px; padding-top: 12px; border-top: 1px dashed #F2F4F7; }
                .ps-units label { font-size: 12px; font-weight: 800; color: #667085; text-transform: uppercase; }
                .ps-chips { display: flex; flex-wrap: wrap; gap: 8px; }
                .ps-chips button { padding: 8px 16px; background: #F9FAFB; border: 1.5px solid #F2F4F7; border-radius: 12px; font-weight: 700; font-size: 13px; color: #667085; cursor: pointer; transition: 0.2s; }
                .ps-chips button.active { background: #F0FDF4; border-color: #00B26B; color: #00B26B; }

                .radical-desktop-container { background: white; border-radius: 24px; border: 1.5px solid #E2E8F0; box-shadow: 0 4px 20px rgba(0,0,0,0.05); overflow: hidden; margin: 0 12px; }
                .rdc-header { padding: 24px; border-bottom: 1px solid #F1F5F9; display: flex; justify-content: space-between; align-items: center; background: #FAFAFA; }
                .rdch-left h3 { font-size: 20px; font-weight: 800; color: #0F172A; margin: 0; }
                .rdch-left p { font-size: 14px; color: #64748B; font-weight: 600; margin-top: 4px; }
                .rdch-stat { font-size: 14px; color: #475569; font-weight: 600; background: #F1F5F9; padding: 10px 20px; border-radius: 12px; }
                .rdch-stat strong { color: #1E6BFF; font-weight: 900; }

                .radical-desktop-table { width: 100%; border-collapse: collapse; }
                .radical-desktop-table th { text-align: left; padding: 18px 24px; font-size: 12px; font-weight: 800; color: #94A3B8; text-transform: uppercase; letter-spacing: 0.05em; background: #FAFAFA; }
                .radical-desktop-table td { padding: 20px 24px; font-size: 15px; color: #1E293B; border-bottom: 1px solid #F8FAFC; vertical-align: middle; }
                
                .sld-cust .cust-main { font-weight: 800; color: #0F172A; }
                .sld-cust .cust-sub { font-size: 11px; color: #94A3B8; font-weight: 700; margin-top: 2px; }
                .cat-pill { background: #F1F5F9; color: #475569; font-weight: 700; padding: 4px 10px; border-radius: 8px; font-size: 12px; }
                
                .stock-level { display: flex; align-items: center; font-weight: 800; }
                .stock-level.low { color: #FF4D4F; }
                .stock-level.healthy { color: #00B26B; }
                
                .profit-badge { background: #F0FDF4; color: #15803D; font-weight: 800; font-size: 12px; padding: 4px 8px; border-radius: 6px; }
                .table-action-group { display: flex; gap: 8px; justify-content: flex-end; }
                .t-btn { width: 36px; height: 36px; border-radius: 10px; border: 1.5px solid #F2F4F7; background: white; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: 0.2s; color: #64748B; }
                .t-btn:hover { border-color: #1E6BFF; color: #1E6BFF; background: #F5F9FF; }
                .t-btn.delete:hover { border-color: #FF4D4F; color: #FF4D4F; background: #FFF1F0; }

                .mobile-only { display: flex; }
                .desktop-only { display: none; }

                @media (min-width: 1024px) {
                    .mobile-only { display: none !important; }
                    .desktop-only { display: block !important; }
                    .old-summary-grid { grid-template-columns: repeat(3, 1fr); gap: 20px; padding: 0 12px; display: grid !important; overflow: visible !important; }
                    .old-metric-card { height: 100px; padding: 24px; border-radius: 24px; border: 1px solid #F2F4F7; box-shadow: 0 4px 12px rgba(0,0,0,0.02); width: auto !important; }
                    .omc-icon { width: 52px; height: 52px; border-radius: 16px; }
                    .omc-icon svg { width: 24px; height: 24px; }
                    .omc-label { font-size: 11px; margin-bottom: 2px; }
                    .omc-value { font-size: 28px; }
                    .old-controls-bar { flex-direction: row; align-items: center; justify-content: space-between; padding: 12px; position: static !important; }
                    .old-search-wrap { flex: 0 0 400px; height: 52px; border-radius: 16px; }
                    .old-category-scroller { border-left: 1.5px solid #E2E8F0; padding-left: 20px; padding-bottom: 0; }
                }

                @media (min-width: 768px) and (max-width: 1023px) {
                    .old-product-grid { grid-template-columns: 1fr 1fr; display: grid; }
                    .old-field-row { grid-template-columns: 1fr 1fr; }
                }

                .old-loader { height: 40vh; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 16px; color: #98A2B3; }
                .old-loader-circle { width: 40px; height: 40px; border: 4px solid #F2F4F7; border-top-color: #1E6BFF; border-radius: 50%; animation: orbit 1s infinite linear; }
                @keyframes orbit { to { transform: rotate(360deg); } }
                
                .history-card-clickable { cursor: pointer; transition: all 0.2s ease; }
                .history-card-clickable:hover { transform: translateY(-2px); box-shadow: 0 6px 16px rgba(0,0,0,0.06) !important; border-color: #D0D5DD !important; }
                .history-card-clickable:active { transform: translateY(0); }
            `}</style>
            <ConfirmModal 
                isOpen={deleteConfirm.open}
                title="Delete Product?"
                message="Are you sure you want to delete this product? This action cannot be undone."
                onConfirm={confirmDelete}
                onCancel={() => setDeleteConfirm({ open: false, id: null })}
                confirmLabel="Delete"
                cancelLabel="Cancel"
                type="danger"
            />
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

export default InventoryPage;
