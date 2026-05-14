import React, { useState, useEffect, useMemo } from 'react';
import { 
    ShoppingCart, 
    Search, 
    Plus, 
    Minus, 
    Trash2, 
    CreditCard, 
    ChevronLeft, 
    CheckCircle, 
    PackageOpen, 
    Zap, 
    ArrowRight, 
    X,
    User,
    ShoppingBag,
    History,
    Scale,
    Info,
    ArrowUpRight,
    QrCode,
    Wallet,
    ChevronDown,
    LayoutGrid,
    Tag,
    Smartphone,
    FileText,
    Receipt as ReceiptIcon,
    ChevronRight
} from 'lucide-react';
import { useParams, useNavigate } from 'react-router-dom';
import { productService, saleService, shopService, khataService } from '../services/api';
import { motion, AnimatePresence } from 'framer-motion';
import { EmptyState, Skeleton, PageHeader, SearchableSelect, MessageModal } from '../components/PremiumUI';
import { useScrollLock } from '../hooks/useScrollLock';
import { invoiceService } from '../utils/invoiceService';
import { offlineDB } from '../services/offlineDB';
import { useSync } from '../context/SyncContext';

const POSPage = () => {
    const { shopId } = useParams();
    const navigate = useNavigate();
    const { isOnline } = useSync();
    const [products, setProducts] = useState([]);
    const [shop, setShop] = useState(null);
    const [cart, setCart] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('All');
    const [loading, setLoading] = useState(true);
    const [isCheckingOut, setIsCheckingOut] = useState(false);
    const [paymentMethod, setPaymentMethod] = useState('Cash');
    const [customerName, setCustomerName] = useState('');
    const [customerMobile, setCustomerMobile] = useState('');
    const [khataCustomers, setKhataCustomers] = useState([]);
    const [orderSuccess, setOrderSuccess] = useState(false);
    const [lastCreatedSale, setLastCreatedSale] = useState(null);
    const [isCartDrawerOpen, setIsCartDrawerOpen] = useState(false);
    const [isDesktop, setIsDesktop] = useState(window.innerWidth >= 1024);
    const [alertConfig, setAlertConfig] = useState({ open: false, title: '', message: '', type: 'info' });
    
    // Sell Modal for measured items
    const [sellingProduct, setSellingProduct] = useState(null);
    const [sellQty, setSellQty] = useState('1');
    const [sellUnit, setSellUnit] = useState('');

    // Khata Selector State
    const [isKhataPickerOpen, setIsKhataPickerOpen] = useState(false);
    const [khataSearch, setKhataSearch] = useState('');
    const [isAddingNewKhata, setIsAddingNewKhata] = useState(false);

    // Lock scroll when any modal or drawer is open
    useScrollLock(isCheckingOut || sellingProduct || isKhataPickerOpen || isCartDrawerOpen);

    useEffect(() => {
        const handleResize = () => setIsDesktop(window.innerWidth >= 1024);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    useEffect(() => {
        fetchData();
        const params = new URLSearchParams(window.location.search);
        const searchVal = params.get('search');
        if (searchVal) setSearchTerm(searchVal);
    }, [shopId]);

    const fetchData = async () => {
        try {
            // Offline-first load: Instant render from local IndexedDB
            const localProducts = await offlineDB.getProducts(shopId);
            if (localProducts && localProducts.length > 0) {
                setProducts(localProducts);
                setLoading(false);
            }

            const [prodRes, shopRes, khataRes] = await Promise.all([
                productService.getAll(shopId).catch(e => ({ data: { data: localProducts || [] } })),
                shopService.getAll().catch(e => ({ data: { data: [] } })),
                khataService.getCustomers(shopId).catch(e => ({ data: { data: [] } }))
            ]);
            
            const fetchedProducts = prodRes.data?.data || prodRes.data || [];
            if (fetchedProducts.length > 0) setProducts(fetchedProducts);
            
            const fetchedShops = shopRes.data?.data || [];
            setShop(fetchedShops.find(s => s._id === shopId));
            
            setKhataCustomers(khataRes.data?.data || []);
        } catch (err) {
            console.error('Error fetching data:', err);
        } finally {
            setLoading(false);
        }
    };

    const categories = ['All', ...new Set(products.map(p => p.category))];

    const filteredProducts = products.filter(p => {
        const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                            (p.barcode || '').includes(searchTerm);
        const matchesCategory = selectedCategory === 'All' || p.category === selectedCategory;
        return matchesSearch && matchesCategory;
    });

    const quickChips = {
        'KG': [
            { label: '250g', qty: '250', unit: 'Gram' },
            { label: '500g', qty: '500', unit: 'Gram' },
            { label: '1kg', qty: '1', unit: 'KG' }
        ],
        'LITER': [
            { label: '250ml', qty: '250', unit: 'ML' },
            { label: '500ml', qty: '500', unit: 'ML' },
            { label: '1L', qty: '1', unit: 'Liter' }
        ]
    };

    const getCompatibleUnits = (baseUnit) => {
        const bu = (baseUnit || '').toUpperCase();
        if (bu === 'KG' || bu === 'GRAM') return ['KG', 'Gram'];
        if (bu === 'LITER' || bu === 'ML') return ['Liter', 'ML'];
        if (bu === 'METER' || bu === 'CM' || bu === 'FEET') return ['Meter', 'CM', 'Feet'];
        if (bu === 'DOZEN' || bu === 'PIECE') return ['Dozen', 'Piece'];
        return [baseUnit || 'Piece'];
    };

    const calculateConversion = (qty, unit, baseUnit) => {
        const q = parseFloat(qty) || 0;
        const u = (unit || '').toUpperCase();
        const bu = (baseUnit || '').toUpperCase();
        let multiplier = 1;

        if (u === 'GRAM' && bu === 'KG') multiplier = 0.001;
        if (u === 'KG' && bu === 'GRAM') multiplier = 1000;
        if (u === 'ML' && bu === 'LITER') multiplier = 0.001;
        if (u === 'LITER' && bu === 'ML') multiplier = 1000;
        if (u === 'CM' && bu === 'METER') multiplier = 0.01;
        if (u === 'FEET' && bu === 'METER') multiplier = 0.3048;
        if (u === 'PIECE' && bu === 'DOZEN') multiplier = 1/12;
        if (u === 'DOZEN' && bu === 'PIECE') multiplier = 12;

        return { deduction: q * multiplier, multiplier };
    };

    const handleProductClick = (product) => {
        if (product.quantity <= 0) return;
        setSellingProduct(product);
        setSellUnit(product.unit || 'Piece');
        setSellQty('1');
    };

    const addToCart = (product, qty, unit, multiplier) => {
        const q = parseFloat(qty);
        const cartKey = `${product._id}-${unit}`;
        const priceForUnit = product.sellPrice * multiplier;

        setCart(prev => {
            const existing = prev.find(item => item.cartKey === cartKey);
            if (existing) {
                return prev.map(item => item.cartKey === cartKey 
                    ? { ...item, quantity: item.quantity + q } 
                    : item
                );
            }
            return [...prev, { 
                cartKey,
                product: product._id, 
                productName: product.name, 
                unit: unit,
                price: priceForUnit, 
                multiplier: multiplier,
                quantity: q, 
                maxStock: product.quantity
            }];
        });
        setSellingProduct(null);
    };

    const updateCartQty = (cartKey, delta) => {
        setCart(prev => prev.map(item => {
            if (item.cartKey !== cartKey) return item;
            const newQty = item.quantity + delta;
            if (newQty <= 0) return null;
            return { ...item, quantity: newQty };
        }).filter(Boolean));
    };

    const subtotal = cart.reduce((s, i) => s + (i.price * i.quantity), 0);

    const handleCheckout = async () => {
        if (cart.length === 0) return;
        if (paymentMethod === 'Khata' && (!customerName.trim() || !customerMobile.trim())) {
            setAlertConfig({ open: true, title: 'Details Required', message: 'Customer Name and Mobile are required for Khata payment.', type: 'error' });
            return;
        }
        setIsCheckingOut(true);
        try {
            const res = await saleService.create({
                shop: shopId,
                items: cart,
                paymentMethod,
                customerName,
                customerMobile,
                date: new Date()
            });
            setLastCreatedSale(res.data.data);
            setOrderSuccess(true);
            setCart([]);
            setIsCartDrawerOpen(false);
            fetchData();
        } catch (err) {
            setAlertConfig({ open: true, title: 'Checkout Failed', message: err.response?.data?.message || 'Checkout failed', type: 'error' });
        } finally {
            setIsCheckingOut(false);
        }
    };

    return (
        <div className="premium-pos-v2">
            <div className="pos-catalog-shell">
                <PageHeader 
                    title="Sales Terminal"
                    subtitle={`Recording sales for ${shop?.name || 'your shop'}`}
                    backAction={() => navigate(-1)}
                />

                {!isOnline && (
                    <div style={{ background: '#FFFBEB', color: '#B45309', padding: '10px 24px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '1px solid #FEF3C7', fontWeight: 'bold' }}>
                        Offline Mode – recording sales locally
                    </div>
                )}

                <div className="pos-search-belt-v2">
                    <div className="search-pill-v2">
                        <Search size={22} color="#98A2B3" />
                        <input 
                            type="text" 
                            placeholder="Scan or search products..." 
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <div className="cat-scroller-v2">
                        {categories.map(cat => (
                            <button 
                                key={cat} 
                                className={`cat-pill-v2 ${selectedCategory === cat ? 'active' : ''}`}
                                onClick={() => setSelectedCategory(cat)}
                            >
                                {cat}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="pos-grid-v2">
                    {loading ? (
                        [1, 2, 3, 4, 5, 6].map(i => (
                            <div key={i} className="pos-card-v2" style={{ padding: '16px' }}>
                                <Skeleton height="100px" borderRadius="18px" className="mb-4" />
                                <Skeleton height="20px" width="70%" className="mb-2" />
                                <Skeleton height="24px" width="40%" />
                            </div>
                        ))
                    ) : filteredProducts.length > 0 ? (
                        filteredProducts.map(product => {
                            const productCartItems = cart.filter(item => item.product === product._id);
                            const totalQtyInCart = productCartItems.reduce((sum, item) => sum + item.quantity, 0);

                            return (
                                <motion.div 
                                    key={product._id} 
                                    whileTap={{ scale: 0.98 }}
                                    className={`pos-card-v2 ${product.quantity <= 0 ? 'out-of-stock' : ''}`}
                                    onClick={() => { if (totalQtyInCart === 0) handleProductClick(product); }}
                                >
                                    <div className="pcv2-badge">{product.category || 'ITEM'}</div>
                                    <div className="pcv2-info">
                                        <h3>{product.name}</h3>
                                        <div className="pcv2-stock">
                                            <PackageOpen size={14} />
                                            <span>{product.quantity} {product.unit} available</span>
                                        </div>
                                    </div>
                                    <div className="pcv2-footer">
                                        <div className="pcv2-price">₹{product.sellPrice}</div>
                                        {totalQtyInCart > 0 ? (
                                            <div className="pcv2-qty-controls" onClick={(e) => e.stopPropagation()}>
                                                <button onClick={() => updateCartQty(productCartItems[0].cartKey, -1)}><Minus size={14} /></button>
                                                <span>{totalQtyInCart}</span>
                                                <button onClick={() => {
                                                    if (product.productType === 'Measured') {
                                                        handleProductClick(product);
                                                    } else {
                                                        updateCartQty(productCartItems[0].cartKey, 1);
                                                    }
                                                }}><Plus size={14} /></button>
                                            </div>
                                        ) : (
                                            <div className="pcv2-add-btn"><Plus size={20} /></div>
                                        )}
                                    </div>
                                </motion.div>
                            );
                        })
                    ) : (
                        <div style={{ gridColumn: '1 / -1', padding: '40px 0' }}>
                            <EmptyState 
                                icon={ShoppingBag}
                                title={searchTerm ? "No products found" : "Your catalog is empty"}
                                description={searchTerm ? `We couldn't find anything matching "${searchTerm}".` : "Add products to your inventory to start selling."}
                                actionLabel={searchTerm ? "Clear Search" : "Add Products"}
                                onAction={searchTerm ? () => setSearchTerm('') : () => navigate(`/shop/${shopId}/inventory`)}
                            />
                        </div>
                    )}
                </div>
            </div>

            {/* Zomato-style Floating Cart Bar */}
            {cart.length > 0 && (
                <div className="mobile-pos-bar-v2 zomato-cart-bar" onClick={() => setIsCartDrawerOpen(true)}>
                    <div className="mpbv2-left">
                        <div className="mpbv2-count">{cart.length} ITEMS</div>
                        <div className="mpbv2-total">₹{subtotal.toLocaleString()}</div>
                    </div>
                    <button className="mpbv2-btn">View Cart <ShoppingCart size={18} /></button>
                </div>
            )}

            {/* Measurement Modal */}
            <AnimatePresence>
                {sellingProduct && (
                    <div className="modal-overlay-v2">
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="m-backdrop-v2" onClick={() => setSellingProduct(null)} />
                        <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} className="m-sheet-v2">
                            <div className="m-header-v2">
                                <div className="mh-text-v2">
                                    <h2>Stock Check</h2>
                                    <p>{sellingProduct.name}</p>
                                </div>
                                <button className="m-close-v2" onClick={() => setSellingProduct(null)}><X size={24} /></button>
                            </div>
                            <div className="m-scroll-v2">
                                <div className="qty-picker-v2">
                                    <label>Quantity to Sell</label>
                                    <div className="qp-input-v2">
                                        <button onClick={() => setSellQty(Math.max(0, parseFloat(sellQty) - 1).toString())}><Minus size={24} /></button>
                                        <input type="number" value={sellQty} onChange={(e) => setSellQty(e.target.value)} />
                                        <button onClick={() => setSellQty((parseFloat(sellQty) + 1).toString())}><Plus size={24} /></button>
                                    </div>
                                    {quickChips[(sellingProduct.unit || '').toUpperCase()] && (
                                        <div className="quick-chips-v2">
                                            {quickChips[(sellingProduct.unit || '').toUpperCase()].map(chip => (
                                                <button key={chip.label} onClick={() => {
                                                    setSellQty(chip.qty);
                                                    setSellUnit(chip.unit);
                                                }}>{chip.label}</button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                                <div className="unit-picker-v2">
                                    <label>Select Unit</label>
                                    <div className="up-grid-v2">
                                        {getCompatibleUnits(sellingProduct.unit).map(u => (
                                            <button key={u} className={sellUnit === u ? 'active' : ''} onClick={() => setSellUnit(u)}>{u}</button>
                                        ))}
                                    </div>
                                </div>
                                <div className="sell-banner-v2">
                                    <span>Total Amount</span>
                                    <strong>₹{(calculateConversion(sellQty, sellUnit, sellingProduct.unit).multiplier * sellingProduct.sellPrice * parseFloat(sellQty || 0)).toFixed(2)}</strong>
                                </div>
                                <button className="btn-add-cart-v2" onClick={() => {
                                    if (parseFloat(sellQty) <= 0 || isNaN(parseFloat(sellQty))) {
                                        setAlertConfig({ open: true, title: 'Invalid Quantity', message: 'Please enter a quantity greater than 0', type: 'error' });
                                        return;
                                    }
                                    const { deduction, multiplier } = calculateConversion(sellQty, sellUnit, sellingProduct.unit);
                                    if (deduction > sellingProduct.quantity) {
                                        setAlertConfig({ open: true, title: 'Insufficient Stock', message: `You only have ${sellingProduct.quantity} ${sellingProduct.unit} available.`, type: 'error' });
                                        return;
                                    }
                                    addToCart(sellingProduct, sellQty, sellUnit, multiplier);
                                }}>Add to Order</button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Checkout Drawer */}
            <AnimatePresence>
                {isCartDrawerOpen && (
                    <div className="modal-overlay-v2">
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="m-backdrop-v2" onClick={() => setIsCartDrawerOpen(false)} />
                        <motion.div initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }} className="checkout-drawer-v2">
                            <div className="cdv2-header">
                                <button className="btn-cdv2-back" onClick={() => setIsCartDrawerOpen(false)}><ChevronLeft size={24} /></button>
                                <h3>Complete Transaction</h3>
                            </div>
                            <div className="cdv2-body">
                                <div className="premium-bill-card">
                                    <div className="pbc-header">
                                        <div className="pbc-title">
                                            <ReceiptIcon size={18} />
                                            <span>Bill Summary</span>
                                        </div>
                                        <span className="pbc-count">{cart.length} Items</span>
                                    </div>
                                    
                                    <div className="pbc-items-list">
                                        {cart.map(item => (
                                            <div key={item.cartKey} className="pbc-item-row">
                                                <div className="pbc-item-info">
                                                    <span className="pbc-item-name">{item.productName}</span>
                                                    <span className="pbc-item-qty">{item.quantity} {item.unit} × ₹{item.price.toFixed(2)}</span>
                                                </div>
                                                <span className="pbc-item-total">₹{(item.price * item.quantity).toFixed(2)}</span>
                                            </div>
                                        ))}
                                    </div>

                                    <div className="pbc-divider" />
                                    
                                    <div className="pbc-total-row">
                                        <span>Grand Total</span>
                                        <span className="pbc-grand-total">₹{subtotal.toLocaleString()}</span>
                                    </div>
                                </div>

                                <div className="pm-section-v2">
                                    <label>Payment Mode</label>
                                    <div className="pm-grid-v2">
                                        <button className={paymentMethod === 'Cash' ? 'active' : ''} onClick={() => setPaymentMethod('Cash')}><Wallet size={20} /><span>Cash</span></button>
                                        <button className={paymentMethod === 'UPI' ? 'active' : ''} onClick={() => setPaymentMethod('UPI')}><QrCode size={20} /><span>UPI</span></button>
                                        <button className={paymentMethod === 'Khata' ? 'active' : ''} onClick={() => setPaymentMethod('Khata')}><FileText size={20} /><span>Khata</span></button>
                                    </div>
                                </div>

                                <div className="cust-section-v3">
                                    <label>Customer Details</label>
                                    
                                    {paymentMethod === 'Khata' ? (
                                        <div className="khata-selector-wrapper">
                                            {customerMobile ? (
                                                <div className="selected-khata-card">
                                                    <div className="skc-info">
                                                        <span className="skc-name">{customerName}</span>
                                                        <span className="skc-phone">{customerMobile}</span>
                                                    </div>
                                                    <button className="skc-change-btn" onClick={() => setIsKhataPickerOpen(true)}>Change</button>
                                                </div>
                                            ) : (
                                                <button className="khata-picker-trigger" onClick={() => setIsKhataPickerOpen(true)}>
                                                    <div className="kpt-left">
                                                        <div className="kpt-icon"><User size={20} /></div>
                                                        <div className="kpt-text">
                                                            <span>Select Khata Customer</span>
                                                            <small>Find existing or add new</small>
                                                        </div>
                                                    </div>
                                                    <ChevronDown size={20} />
                                                </button>
                                            )}

                                            {isAddingNewKhata && (
                                                <div className="new-khata-inline-form">
                                                    <div className="nkif-header">
                                                        <span>New Customer Details</span>
                                                        <button onClick={() => { setIsAddingNewKhata(false); setCustomerName(''); setCustomerMobile(''); }}>Cancel</button>
                                                    </div>
                                                    <div className="nkif-inputs">
                                                        <div className="cust-input-v2">
                                                            <User size={18} color="#98A2B3" />
                                                            <input value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="Full Name" />
                                                        </div>
                                                        <div className="cust-input-v2">
                                                            <Smartphone size={18} color="#98A2B3" />
                                                            <input value={customerMobile} onChange={(e) => setCustomerMobile(e.target.value)} placeholder="Mobile Number" />
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    ) : (
                                        <div className="cust-input-group-v2">
                                            <div className="cust-input-v2">
                                                <User size={18} color="#98A2B3" />
                                                <input 
                                                    value={customerName} 
                                                    onChange={(e) => setCustomerName(e.target.value)} 
                                                    placeholder="Customer Name (Optional)" 
                                                />
                                            </div>
                                            <div className="cust-input-v2">
                                                <Smartphone size={18} color="#98A2B3" />
                                                <input 
                                                    value={customerMobile} 
                                                    onChange={(e) => setCustomerMobile(e.target.value)} 
                                                    placeholder="Mobile Number (Optional)" 
                                                />
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                            <div className="cdv2-footer">
                                <button className="btn-final-v2" onClick={handleCheckout} disabled={isCheckingOut}>
                                    {isCheckingOut ? 'Recording Sale...' : `Pay ₹${subtotal.toLocaleString()}`}
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            <AnimatePresence>
                {isKhataPickerOpen && (
                    <div className="modal-overlay-v2">
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="m-backdrop-v2" onClick={() => setIsKhataPickerOpen(false)} />
                        <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} className="khata-picker-sheet">
                            <div className="kps-header">
                                <div className="kps-title-row">
                                    <h3>Select Khata Account</h3>
                                    <button className="kps-close" onClick={() => setIsKhataPickerOpen(false)}><X size={24} /></button>
                                </div>
                                <div className="kps-search-bar">
                                    <Search size={20} />
                                    <input 
                                        type="text" 
                                        placeholder="Search by name or mobile..." 
                                        value={khataSearch}
                                        onChange={(e) => setKhataSearch(e.target.value)}
                                        autoFocus
                                    />
                                </div>
                            </div>
                            <div className="kps-list">
                                <button className="kps-add-new-btn" onClick={() => { setIsAddingNewKhata(true); setIsKhataPickerOpen(false); setCustomerName(''); setCustomerMobile(''); }}>
                                    <div className="kanb-icon"><Plus size={20} /></div>
                                    <span>Add New Khata Customer</span>
                                </button>

                                {khataCustomers
                                    .filter(c => 
                                        c.customerName.toLowerCase().includes(khataSearch.toLowerCase()) || 
                                        c.mobile.includes(khataSearch)
                                    )
                                    .map(cust => (
                                        <button key={cust._id} className="kps-item" onClick={() => {
                                            setCustomerName(cust.customerName);
                                            setCustomerMobile(cust.mobile);
                                            setIsKhataPickerOpen(false);
                                            setIsAddingNewKhata(false);
                                        }}>
                                            <div className="kpsi-avatar">{cust.customerName[0]}</div>
                                            <div className="kpsi-info">
                                                <strong>{cust.customerName}</strong>
                                                <span>{cust.mobile}</span>
                                            </div>
                                            <ChevronRight size={18} color="#98A2B3" />
                                        </button>
                                    ))
                                }
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            <AnimatePresence>
                {orderSuccess && (
                    <div className="modal-overlay-v2">
                        <motion.div initial={{ scale: 0.8 }} animate={{ scale: 1 }} className="success-card-v2">
                            <div className="s-icon-v2"><CheckCircle size={64} color="#00A86B" /></div>
                            <h2>Transaction Complete</h2>
                            <p>Bill recorded and stock updated.</p>
                            
                            <div style={{ display: 'flex', gap: '10px', width: '100%' }}>
                                <button 
                                    className="ips-btn ips-wa" 
                                    style={{ flex: 1, background: '#25D366', color: 'white', border: 'none', height: '44px', borderRadius: '12px', fontWeight: '800', cursor: 'pointer' }}
                                    onClick={() => lastCreatedSale && invoiceService.shareInvoice(lastCreatedSale, shop, 'SALE')}
                                >
                                    Share
                                </button>
                                <button 
                                    className="ips-btn ips-pdf" 
                                    style={{ flex: 1, background: '#F2F4F7', color: '#101828', border: 'none', height: '44px', borderRadius: '12px', fontWeight: '800', cursor: 'pointer' }}
                                    onClick={() => lastCreatedSale && invoiceService.downloadInvoice(lastCreatedSale, shop, 'SALE')}
                                >
                                    PDF
                                </button>
                            </div>

                            <button className="btn-s-done-v2" onClick={() => { setOrderSuccess(false); setLastCreatedSale(null); setIsAddingNewKhata(false); setCustomerName(''); setCustomerMobile(''); }}>New Sale</button>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            <style jsx="true">{`
                .premium-pos-v2 { display: flex; height: calc(100vh - 72px); background: #F6F8FC; overflow: hidden; }
                .pos-catalog-shell { flex: 1; display: flex; flex-direction: column; overflow: hidden; }
                
                .pos-header-v2 { padding: 24px 24px 0 24px; }
                .pos-header-text h1 { font-size: 34px; font-weight: 800; color: #101828; margin: 0; }
                .pos-header-text p { font-size: 15px; color: #667085; font-weight: 600; margin-top: 4px; }

                .pos-search-belt-v2 { padding: 24px; display: flex; flex-direction: column; gap: 16px; border-bottom: 1px solid #F2F4F7; background: white; margin-top: 16px; }
                .search-pill-v2 { height: 54px; background: #F9FAFB; border: 1.5px solid #F2F4F7; border-radius: 18px; display: flex; align-items: center; padding: 0 18px; gap: 12px; }
                .search-pill-v2 input { border: none; outline: none; background: transparent; flex: 1; font-size: 18px; font-weight: 600; }
                
                .cat-scroller-v2 { display: flex; gap: 8px; overflow-x: auto; scrollbar-width: none; }
                .cat-pill-v2 { padding: 10px 18px; background: white; border: 1.5px solid #F2F4F7; border-radius: 12px; font-weight: 800; font-size: 13px; color: #667085; cursor: pointer; white-space: nowrap; }
                .cat-pill-v2.active { background: #071B44; color: white; border-color: #071B44; }

                .pos-grid-v2 { flex: 1; overflow-y: auto; padding: 24px; display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 18px; align-content: flex-start; }
                .pos-card-v2 { background: white; padding: 20px; border-radius: 28px; border: 1px solid #F2F4F7; display: flex; flex-direction: column; gap: 12px; cursor: pointer; transition: 0.3s; box-shadow: 0 4px 12px rgba(0,0,0,0.02); }
                .pos-card-v2:hover { transform: translateY(-4px); box-shadow: 0 15px 30px rgba(0,0,0,0.06); border-color: #1E6BFF; }
                .pos-card-v2.out-of-stock { opacity: 0.5; cursor: not-allowed; }
                
                .pcv2-badge { font-size: 10px; font-weight: 800; color: #1E6BFF; background: #F5F9FF; padding: 3px 10px; border-radius: 6px; text-transform: uppercase; align-self: flex-start; }
                .pcv2-info h3 { font-size: 18px; font-weight: 800; color: #101828; margin: 0; line-height: 1.2; }
                .pcv2-stock { display: flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 700; color: #667085; }
                
                .pcv2-footer { display: flex; justify-content: space-between; align-items: center; margin-top: auto; }
                .pcv2-price { font-size: 22px; font-weight: 900; color: #101828; }
                .pcv2-add-btn { width: 38px; height: 38px; background: #071B44; color: white; border-radius: 10px; display: flex; align-items: center; justify-content: center; }
                .pcv2-qty-controls { display: flex; align-items: center; gap: 8px; background: #F2F4F7; padding: 4px; border-radius: 12px; }
                .pcv2-qty-controls button { width: 30px; height: 30px; border: none; background: white; border-radius: 8px; cursor: pointer; display: flex; align-items: center; justify-content: center; box-shadow: 0 2px 5px rgba(0,0,0,0.05); }
                .pcv2-qty-controls span { font-weight: 800; font-size: 14px; min-width: 20px; text-align: center; color: #101828; }

                /* Sidebar */
                .pos-sidebar-v2 { width: 400px; background: white; border-left: 1px solid #F2F4F7; display: flex; flex-direction: column; }
                .sidebar-header-v2 { padding: 24px; border-bottom: 1px solid #F2F4F7; display: flex; justify-content: space-between; align-items: center; }
                .shv2-left { display: flex; align-items: center; gap: 12px; }
                .shv2-left h3 { font-size: 22px; font-weight: 800; margin: 0; }
                .cart-badge-v2 { background: #F5F9FF; color: #1E6BFF; padding: 4px 12px; border-radius: 10px; font-weight: 800; font-size: 13px; }
                
                .sidebar-content-v2 { flex: 1; overflow-y: auto; padding: 24px; }
                .empty-cart-v2 { height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; gap: 20px; }
                .empty-cart-v2 p { font-weight: 700; color: #98A2B3; }
                
                .cart-list-v2 { display: flex; flex-direction: column; gap: 12px; }
                .cart-item-v2 { background: #F9FAFB; padding: 16px; border-radius: 20px; border: 1px solid #F2F4F7; display: flex; justify-content: space-between; align-items: center; }
                .civ2-title { font-weight: 800; font-size: 16px; }
                .civ2-sub { font-size: 13px; font-weight: 600; color: #667085; }
                .civ2-controls { display: flex; align-items: center; gap: 10px; background: white; padding: 6px; border-radius: 10px; }
                .civ2-controls button { width: 28px; height: 28px; border: none; background: #F2F4F7; border-radius: 8px; cursor: pointer; display: flex; align-items: center; justify-content: center; }
                .civ2-controls span { font-weight: 900; font-size: 16px; min-width: 20px; text-align: center; }

                .sidebar-footer-v2 { padding: 24px; background: #F9FAFB; border-top: 1px solid #F2F4F7; display: flex; flex-direction: column; gap: 24px; }
                .sfv2-total { display: flex; justify-content: space-between; align-items: baseline; }
                .sfv2-total span { font-size: 16px; font-weight: 700; color: #667085; }
                .sfv2-total strong { font-size: 32px; font-weight: 900; color: #101828; }
                .btn-checkout-v2 { height: 68px; background: #071B44; color: white; border: none; border-radius: 22px; font-size: 18px; font-weight: 900; display: flex; align-items: center; justify-content: center; gap: 12px; cursor: pointer; box-shadow: 0 10px 30px rgba(7, 27, 68, 0.2); }

                /* Measurement Modal */
                .m-sheet-v2 { position: relative; width: 100%; max-width: 500px; background: white; border-radius: 28px 28px 0 0; max-height: 90vh; display: flex; flex-direction: column; box-shadow: 0 -20px 50px rgba(0,0,0,0.2); box-sizing: border-box; }
                .m-header-v2 { padding: 16px 20px; border-bottom: 1px solid #F2F4F7; display: flex; justify-content: space-between; align-items: center; }
                .mh-text-v2 h2 { font-size: 20px; font-weight: 800; margin: 0; }
                .mh-text-v2 p { font-size: 13px; color: #667085; font-weight: 600; margin: 2px 0 0 0; }
                .m-close-v2 { width: 36px; height: 36px; border-radius: 50%; background: #F9FAFB; border: none; color: #98A2B3; cursor: pointer; display: flex; align-items: center; justify-content: center; }
                .m-scroll-v2 { padding: 16px 20px; overflow-y: auto; flex: 1; display: flex; flex-direction: column; gap: 16px; box-sizing: border-box; }

                .qp-input-v2 { display: flex; justify-content: center; align-items: center; background: #F9FAFB; border: 1.5px solid #F2F4F7; border-radius: 16px; padding: 6px; gap: 12px; margin-top: 6px; }
                .qp-input-v2 button { width: 44px; height: 44px; border-radius: 12px; border: none; background: white; color: #071B44; cursor: pointer; box-shadow: 0 4px 12px rgba(0,0,0,0.05); }
                .qp-input-v2 input { width: 80px; flex: none; border: none; background: transparent; text-align: center; font-size: 24px; font-weight: 900; outline: none; }
                
                .quick-chips-v2 { display: flex; gap: 8px; margin-top: 8px; overflow-x: auto; scrollbar-width: none; flex-wrap: nowrap; padding-bottom: 4px; }
                .quick-chips-v2::-webkit-scrollbar { display: none; }
                .quick-chips-v2 button { flex: 0 0 auto; padding: 6px 14px; background: #F2F4F7; border: 1px solid #D0D5DD; border-radius: 10px; font-size: 13px; font-weight: 800; color: #071B44; cursor: pointer; transition: 0.2s; }
                .quick-chips-v2 button:hover { background: #E4E7EC; }
                
                .up-grid-v2 { display: grid; grid-template-columns: repeat(auto-fit, minmax(70px, 1fr)); gap: 8px; margin-top: 6px; }
                .up-grid-v2 button { height: 44px; border-radius: 10px; border: 1.5px solid #F2F4F7; background: white; font-size: 14px; font-weight: 800; color: #667085; cursor: pointer; }
                .up-grid-v2 button.active { border-color: #1E6BFF; background: #F5F9FF; color: #1E6BFF; }
                
                .sell-banner-v2 { margin: 8px 0 0 0; padding: 14px 18px; background: #071B44; color: white; border-radius: 16px; display: flex; justify-content: space-between; align-items: center; }
                .sell-banner-v2 span { font-size: 14px; font-weight: 600; opacity: 0.8; }
                .sell-banner-v2 strong { font-size: 22px; font-weight: 900; }
                .btn-add-cart-v2 { position: sticky; bottom: 0; width: 100%; height: 56px; background: #1E6BFF; color: white; border: none; border-radius: 16px; font-weight: 900; font-size: 16px; cursor: pointer; box-shadow: 0 -12px 24px white; z-index: 10; margin-top: auto; }

                /* Zomato Cart Bar */
                .mobile-pos-bar-v2 { position: fixed; bottom: 100px; left: 20px; right: 20px; height: 74px; background: #071B44; color: white; border-radius: 22px; padding: 0 20px; display: flex; align-items: center; justify-content: space-between; z-index: 1001; }
                .mobile-pos-bar-v2.zomato-cart-bar { left: 50%; right: auto; transform: translateX(-50%); max-width: 600px; width: calc(100% - 40px); box-shadow: 0 15px 40px rgba(7,27,68,0.3); transition: 0.3s; cursor: pointer; }
                .mobile-pos-bar-v2.zomato-cart-bar:hover { transform: translateX(-50%) translateY(-5px); box-shadow: 0 20px 50px rgba(7,27,68,0.4); }
                .mpbv2-count { font-size: 11px; font-weight: 800; color: #98A2B3; letter-spacing: 1px; }
                .mpbv2-total { font-size: 22px; font-weight: 900; line-height: 1.1; }
                .mpbv2-btn { background: #1E6BFF; color: white; border: none; padding: 10px 20px; border-radius: 14px; font-weight: 800; display: flex; align-items: center; gap: 8px; cursor: pointer; }
                
                .modal-overlay-v2 { position: fixed; inset: 0; z-index: 7000; display: flex; align-items: flex-end; justify-content: center; }
                .m-backdrop-v2 { position: absolute; inset: 0; background: rgba(7, 27, 68, 0.4); backdrop-filter: blur(8px); }

                /* Checkout Drawer */
                .checkout-drawer-v2 { background: white; height: 100vh; width: 100%; max-width: 500px; display: flex; flex-direction: column; position: absolute; right: 0; top: 0; bottom: 0; box-shadow: -10px 0 40px rgba(0,0,0,0.1); }
                .cdv2-header { padding: 24px; border-bottom: 1px solid #F2F4F7; display: flex; align-items: center; gap: 16px; }
                .btn-cdv2-back { width: 44px; height: 44px; border-radius: 12px; border: none; background: #F9FAFB; display: flex; align-items: center; justify-content: center; }
                .cdv2-body { flex: 1; overflow-y: auto; padding: 24px; display: flex; flex-direction: column; gap: 32px; }
                /* Premium Checkout Drawer */
                .premium-bill-card { background: white; border: 1.5px solid #F2F4F7; border-radius: 24px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.03); }
                .pbc-header { padding: 16px 20px; background: #F9FAFB; border-bottom: 1px solid #F2F4F7; display: flex; justify-content: space-between; align-items: center; }
                .pbc-title { display: flex; align-items: center; gap: 8px; color: #101828; font-weight: 800; font-size: 14px; }
                .pbc-count { font-size: 12px; font-weight: 700; color: #667085; background: white; padding: 4px 10px; border-radius: 8px; border: 1px solid #EAECF0; }
                .pbc-items-list { padding: 12px 20px; display: flex; flex-direction: column; gap: 10px; max-height: 180px; overflow-y: auto; }
                .pbc-item-row { display: flex; justify-content: space-between; align-items: center; }
                .pbc-item-info { display: flex; flex-direction: column; }
                .pbc-item-name { font-size: 14px; font-weight: 700; color: #101828; }
                .pbc-item-qty { font-size: 11px; font-weight: 600; color: #667085; }
                .pbc-item-total { font-size: 14px; font-weight: 800; color: #101828; }
                .pbc-divider { margin: 4px 20px; height: 1px; background: #F2F4F7; border-top: 2px dashed #EAECF0; }
                .pbc-total-row { padding: 16px 20px; display: flex; justify-content: space-between; align-items: baseline; }
                .pbc-total-row span:first-child { font-size: 14px; font-weight: 700; color: #667085; }
                .pbc-grand-total { font-size: 24px; font-weight: 900; color: #071B44; }

                .pm-section-v2 { display: flex; flex-direction: column; gap: 12px; }
                .pm-section-v2 label { font-size: 13px; font-weight: 800; color: #667085; text-transform: uppercase; letter-spacing: 0.05em; }
                .pm-grid-v2 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
                .pm-grid-v2 button { height: 74px; border-radius: 18px; border: 1.5px solid #F2F4F7; background: white; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; cursor: pointer; transition: 0.2s; }
                .pm-grid-v2 button span { font-size: 12px; font-weight: 800; color: #667085; }
                .pm-grid-v2 button svg { color: #98A2B3; }
                .pm-grid-v2 button.active { border-color: #1E6BFF; background: #F5F9FF; box-shadow: 0 4px 12px rgba(30, 107, 255, 0.1); }
                .pm-grid-v2 button.active span { color: #1E6BFF; }
                .pm-grid-v2 button.active svg { color: #1E6BFF; }

                .cust-section-v3 { display: flex; flex-direction: column; gap: 12px; }
                .cust-section-v3 label { font-size: 13px; font-weight: 800; color: #667085; text-transform: uppercase; letter-spacing: 0.05em; }
                
                .khata-selector-wrapper { display: flex; flex-direction: column; gap: 12px; }
                .khata-picker-trigger { width: 100%; height: 72px; background: white; border: 1.5px solid #F2F4F7; border-radius: 20px; display: flex; align-items: center; justify-content: space-between; padding: 0 16px; cursor: pointer; }
                .kpt-left { display: flex; align-items: center; gap: 12px; }
                .kpt-icon { width: 44px; height: 44px; background: #F5F9FF; color: #1E6BFF; border-radius: 12px; display: flex; align-items: center; justify-content: center; }
                .kpt-text { display: flex; flex-direction: column; align-items: flex-start; }
                .kpt-text span { font-weight: 800; color: #101828; font-size: 15px; }
                .kpt-text small { font-size: 12px; color: #667085; font-weight: 600; }

                .selected-khata-card { background: #F5F9FF; border: 1.5px solid #D1E9FF; border-radius: 20px; padding: 16px; display: flex; justify-content: space-between; align-items: center; }
                .skc-info { display: flex; flex-direction: column; gap: 2px; }
                .skc-name { font-weight: 800; color: #101828; font-size: 16px; }
                .skc-phone { font-size: 13px; font-weight: 700; color: #1E6BFF; }
                .skc-change-btn { background: white; border: 1px solid #D0D5DD; padding: 6px 12px; border-radius: 8px; font-size: 12px; font-weight: 800; color: #344054; cursor: pointer; }

                .new-khata-inline-form { background: #F9FAFB; border: 1.5px solid #F2F4F7; border-radius: 20px; padding: 16px; display: flex; flex-direction: column; gap: 12px; }
                .nkif-header { display: flex; justify-content: space-between; align-items: center; }
                .nkif-header span { font-size: 12px; font-weight: 800; color: #667085; }
                .nkif-header button { background: transparent; border: none; color: #B42318; font-weight: 800; font-size: 12px; cursor: pointer; }
                .nkif-inputs { display: flex; flex-direction: column; gap: 8px; }

                /* Khata Picker Sheet */
                .khata-picker-sheet { position: absolute; bottom: 0; left: 0; right: 0; background: white; border-radius: 32px 32px 0 0; max-height: 85vh; display: flex; flex-direction: column; box-shadow: 0 -20px 50px rgba(0,0,0,0.2); }
                .kps-header { padding: 20px 24px; border-bottom: 1px solid #F2F4F7; }
                .kps-title-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
                .kps-title-row h3 { font-size: 20px; font-weight: 800; margin: 0; }
                .kps-close { width: 40px; height: 40px; border-radius: 50%; background: #F9FAFB; border: none; display: flex; align-items: center; justify-content: center; color: #667085; cursor: pointer; }
                .kps-search-bar { height: 52px; background: #F9FAFB; border: 1.5px solid #EAECF0; border-radius: 16px; display: flex; align-items: center; padding: 0 16px; gap: 12px; }
                .kps-search-bar input { border: none; background: transparent; outline: none; flex: 1; font-weight: 700; font-size: 16px; }
                .kps-search-bar svg { color: #98A2B3; }

                .kps-list { flex: 1; overflow-y: auto; padding: 16px 24px; display: flex; flex-direction: column; gap: 8px; }
                .kps-add-new-btn { width: 100%; height: 64px; border: 1.5px dashed #D1E9FF; background: #F5F9FF; border-radius: 18px; display: flex; align-items: center; gap: 12px; padding: 0 16px; cursor: pointer; margin-bottom: 8px; }
                .kanb-icon { width: 36px; height: 36px; background: #1E6BFF; color: white; border-radius: 10px; display: flex; align-items: center; justify-content: center; }
                .kps-add-new-btn span { font-weight: 800; color: #1E6BFF; font-size: 14px; }

                .kps-item { width: 100%; height: 68px; background: white; border: 1.5px solid #F2F4F7; border-radius: 18px; display: flex; align-items: center; gap: 12px; padding: 0 16px; cursor: pointer; transition: 0.2s; }
                .kps-item:active { background: #F9FAFB; transform: scale(0.98); }
                .kpsi-avatar { width: 40px; height: 40px; background: #071B44; color: white; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 900; font-size: 16px; text-transform: uppercase; }
                .kpsi-info { flex: 1; display: flex; flex-direction: column; align-items: flex-start; }
                .kpsi-info strong { font-weight: 800; color: #101828; font-size: 15px; }
                .kpsi-info span { font-size: 12px; font-weight: 600; color: #667085; }

                .cust-input-group-v2 { display: flex; flex-direction: column; gap: 10px; }
                .cust-input-v2 { display: flex; align-items: center; gap: 12px; background: white; border: 1.5px solid #F2F4F7; border-radius: 18px; padding: 0 16px; height: 56px; transition: 0.2s; }
                .cust-input-v2:focus-within { border-color: #1E6BFF; background: white; box-shadow: 0 4px 12px rgba(0,0,0,0.03); }
                .cust-input-v2 input { border: none; outline: none; background: transparent; flex: 1; font-weight: 700; font-size: 15px; color: #101828; }
                
                .cdv2-footer { padding: 16px; background: white; border-top: 1px solid #F2F4F7; position: sticky; bottom: 0; z-index: 10; }
                .btn-final-v2 { width: 100%; height: 56px; background: #071B44; color: white; border: none; border-radius: 16px; font-size: 18px; font-weight: 900; cursor: pointer; transition: 0.2s; }
                .btn-final-v2:active { transform: scale(0.98); background: #0a255a; }

                .success-card-v2 { background: white; padding: 40px; border-radius: 40px; text-align: center; max-width: 400px; display: flex; flex-direction: column; gap: 24px; align-items: center; }
                .s-icon-v2 { width: 100px; height: 100px; background: #F0FDF4; border-radius: 50%; display: flex; align-items: center; justify-content: center; }
                .btn-s-done-v2 { width: 100%; height: 60px; background: #071B44; color: white; border: none; border-radius: 18px; font-weight: 800; font-size: 18px; }

                /* Mobile Optimization - Ultra Compact ERP UI */
                @media (max-width: 768px) {
                    .premium-pos-v2 { height: calc(100vh - 56px); }
                    .pos-header-v2 { padding: 16px 16px 0 16px; }
                    .pos-header-text h1 { font-size: 24px; }
                    .pos-header-text p { font-size: 13px; margin-top: 2px; }

                    .pos-search-belt-v2 { padding: 12px 16px; gap: 10px; margin-top: 8px; }
                    .search-pill-v2 { height: 44px; padding: 0 12px; border-radius: 14px; gap: 8px; }
                    .search-pill-v2 input { font-size: 14px; }
                    .search-pill-v2 svg { width: 18px; height: 18px; }

                    .cat-pill-v2 { padding: 8px 14px; font-size: 12px; border-radius: 10px; }

                    .pos-grid-v2 { padding: 12px 16px 100px 16px; gap: 12px; grid-template-columns: repeat(2, 1fr); }
                    .pos-card-v2 { padding: 12px; border-radius: 16px; gap: 8px; }
                    .pcv2-badge { font-size: 9px; padding: 2px 8px; }
                    .pcv2-info h3 { font-size: 14px; }
                    .pcv2-stock { font-size: 11px; }
                    .pcv2-price { font-size: 16px; }
                    .pcv2-add-btn { width: 32px; height: 32px; border-radius: 8px; }
                    
                    .pcv2-qty-controls button { width: 26px; height: 26px; border-radius: 6px; }
                    .pcv2-qty-controls span { font-size: 13px; min-width: 16px; }

                    .mobile-pos-bar-v2 { height: 60px; bottom: 70px; border-radius: 16px; padding: 0 16px; }
                    .mpbv2-count { font-size: 10px; }
                    .mpbv2-total { font-size: 18px; }
                    .mpbv2-btn { padding: 8px 16px; border-radius: 10px; font-size: 14px; }

                    .checkout-drawer-v2 { 
                        width: 100%; 
                        max-width: 100%; 
                        height: 90dvh; 
                        top: auto; 
                        bottom: 0; 
                        border-radius: 32px 32px 0 0; 
                        box-shadow: 0 -10px 40px rgba(0,0,0,0.1);
                        transform: translateY(0);
                        padding-bottom: var(--keyboard-height);
                        transition: padding-bottom 0.15s ease-out;
                    }
                    .cdv2-header { padding: 12px 16px; height: 56px; border-bottom: 1px solid #F2F4F7; position: sticky; top: 0; background: white; z-index: 20; border-radius: 32px 32px 0 0; }
                    .btn-cdv2-back { width: 36px; height: 36px; border-radius: 10px; }
                    .cdv2-body { padding: 16px; gap: 20px; overflow-y: auto; }
                    
                    .premium-bill-card { border-radius: 20px; }
                    .pbc-header { padding: 12px 16px; }
                    .pbc-items-list { padding: 10px 16px; max-height: 140px; }
                    .pbc-item-name { font-size: 13px; }
                    .pbc-grand-total { font-size: 20px; }

                    .pm-grid-v2 { gap: 8px; }
                    .pm-grid-v2 button { height: 64px; border-radius: 14px; }
                    .pm-grid-v2 button span { font-size: 11px; }

                    .cust-input-v2 { height: 48px; border-radius: 14px; padding: 0 12px; }
                    .cust-input-v2 input { font-size: 14px; }

                    .cdv2-footer { padding: 16px; background: white; border-top: 1px solid #F2F4F7; position: sticky; bottom: 0; z-index: 20; }
                    .btn-final-v2 { height: 56px; border-radius: 16px; font-size: 18px; }
                    
                    .khata-picker-sheet { 
                        height: 90dvh; 
                        padding-bottom: var(--keyboard-height);
                        transition: padding-bottom 0.15s ease-out;
                    }

                    .m-sheet-v2 { border-radius: 24px 24px 0 0; padding-bottom: var(--keyboard-height); }
                    .m-header-v2 { padding: 12px 16px; }
                    .mh-text-v2 h2 { font-size: 18px; }
                    .m-scroll-v2 { padding: 16px; }
                    .qp-input-v2 button { width: 36px; height: 36px; border-radius: 10px; }
                    .qp-input-v2 input { font-size: 20px; width: 60px; }
                    .btn-add-cart-v2 { height: 50px; border-radius: 14px; }
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

export default POSPage;
