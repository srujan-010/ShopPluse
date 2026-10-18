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
    ChevronRight,
    ShieldCheck
} from 'lucide-react';
import { useParams, useNavigate } from 'react-router-dom';
import { productService, saleService, shopService, khataService, govSaleService } from '../services/api';
import { motion, AnimatePresence } from 'framer-motion';
import { EmptyState, Skeleton, PageHeader, SearchableSelect, MessageModal } from '../components/PremiumUI';
import { useScrollLock } from '../hooks/useScrollLock';
import { invoiceService } from '../utils/invoiceService';
import { offlineDB } from '../services/offlineDB';
import { useSync } from '../context/SyncContext';
import { useToast } from '../context/ToastContext';

const POSPage = () => {
    const { shopId } = useParams();
    const navigate = useNavigate();
    const { isOnline } = useSync();
    const { showToast } = useToast();
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
    const [customerAadhaar, setCustomerAadhaar] = useState('');
    const [saleMode, setSaleMode] = useState('government');
    const [khataCustomers, setKhataCustomers] = useState([]);
    const [orderSuccess, setOrderSuccess] = useState(false);
    const [lastCreatedSale, setLastCreatedSale] = useState(null);
    const [isCartDrawerOpen, setIsCartDrawerOpen] = useState(false);
    const [isDesktop, setIsDesktop] = useState(window.innerWidth >= 1024);
    const [alertConfig, setAlertConfig] = useState({ open: false, title: '', message: '', type: 'info' });

    // Discount & Partial Payment states
    const [discountType, setDiscountType] = useState('none');
    const [discountValue, setDiscountValue] = useState('');
    const [paidAmount, setPaidAmount] = useState('');
    const [isItemListExpanded, setIsItemListExpanded] = useState(true);

    const isFertilizerShop = shop?.type === 'Fertilizers';
    const isGovSale = Boolean(isFertilizerShop && saleMode === 'government');

    useEffect(() => {
        if (shop?.type === 'Fertilizers') {
            setSaleMode('government');
        } else if (shop) {
            setSaleMode('retail');
        }
    }, [shop?.type]);

    const rawSubtotal = useMemo(() => {
        return parseFloat(cart.reduce((s, i) => s + ((Number(i.price) || 0) * (Number(i.quantity) || 0)), 0).toFixed(2));
    }, [cart]);

    const distinctProductsCount = cart.length;

    const totalQuantityCount = useMemo(() => {
        const total = cart.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);
        return Number.isInteger(total) ? total : parseFloat(total.toFixed(3));
    }, [cart]);

    const discountAmount = useMemo(() => {
        if (discountType === 'flat') {
            return Math.min(rawSubtotal, Number(discountValue) || 0);
        }
        if (discountType === 'percentage') {
            const pct = Number(discountValue) || 0;
            return Math.min(rawSubtotal, parseFloat(((rawSubtotal * pct) / 100).toFixed(2)));
        }
        return 0;
    }, [rawSubtotal, discountType, discountValue]);

    // Complete GST and line-item tax calculations
    const taxCalculation = useMemo(() => {
        let totalTaxable = 0;
        let totalGst = 0;
        let totalCgst = 0;
        let totalSgst = 0;
        let grandTotal = 0;
        let accumulatedDiscount = 0;

        const itemsWithTax = cart.map((item, idx) => {
            const qty = Number(item.quantity) || 0;
            const price = Number(item.price) || 0;
            const itemBaseAmount = parseFloat((qty * price).toFixed(2));
            const isLast = idx === cart.length - 1;

            let itemDiscount = 0;
            if (discountAmount > 0 && rawSubtotal > 0) {
                if (isLast) {
                    itemDiscount = parseFloat((discountAmount - accumulatedDiscount).toFixed(2));
                } else {
                    itemDiscount = parseFloat(((itemBaseAmount / rawSubtotal) * discountAmount).toFixed(2));
                    accumulatedDiscount += itemDiscount;
                }
            }

            const isApplicable = item.isGstApplicable !== undefined ? Boolean(item.isGstApplicable) : (Number(item.gst) > 0);
            const rate = isApplicable ? (Number(item.gstRate !== undefined ? item.gstRate : item.gst) || 0) : 0;
            const mode = item.gstPricingMode || 'inclusive';

            let itemTaxable = 0;
            let itemGst = 0;
            let itemCgst = 0;
            let itemSgst = 0;
            let itemLineTotal = 0;

            if (isApplicable && rate > 0) {
                if (mode === 'exclusive') {
                    itemTaxable = Math.max(0, parseFloat((itemBaseAmount - itemDiscount).toFixed(2)));
                    itemGst = parseFloat((itemTaxable * (rate / 100)).toFixed(2));
                    itemCgst = parseFloat((itemGst / 2).toFixed(2));
                    itemSgst = parseFloat((itemGst - itemCgst).toFixed(2));
                    itemLineTotal = parseFloat((itemTaxable + itemGst).toFixed(2));
                } else {
                    const netGross = Math.max(0, parseFloat((itemBaseAmount - itemDiscount).toFixed(2)));
                    itemTaxable = parseFloat((netGross / (1 + (rate / 100))).toFixed(2));
                    itemGst = parseFloat((netGross - itemTaxable).toFixed(2));
                    itemCgst = parseFloat((itemGst / 2).toFixed(2));
                    itemSgst = parseFloat((itemGst - itemCgst).toFixed(2));
                    itemLineTotal = netGross;
                }
            } else {
                itemTaxable = Math.max(0, parseFloat((itemBaseAmount - itemDiscount).toFixed(2)));
                itemGst = 0;
                itemCgst = 0;
                itemSgst = 0;
                itemLineTotal = itemTaxable;
            }

            totalTaxable += itemTaxable;
            totalGst += itemGst;
            totalCgst += itemCgst;
            totalSgst += itemSgst;
            grandTotal += itemLineTotal;

            return {
                ...item,
                itemBaseAmount,
                itemDiscount,
                isGstApplicable: isApplicable,
                gstRate: rate,
                gstPricingMode: mode,
                taxableValue: itemTaxable,
                gstAmount: itemGst,
                cgst: itemCgst,
                sgst: itemSgst,
                lineTotal: itemLineTotal
            };
        });

        totalTaxable = parseFloat(totalTaxable.toFixed(2));
        totalGst = parseFloat(totalGst.toFixed(2));
        totalCgst = parseFloat(totalCgst.toFixed(2));
        totalSgst = parseFloat(totalSgst.toFixed(2));
        grandTotal = parseFloat(grandTotal.toFixed(2));

        return {
            itemsWithTax,
            subtotal: rawSubtotal,
            discountAmount,
            taxableAmount: totalTaxable,
            totalGst,
            cgstTotal: totalCgst,
            sgstTotal: totalSgst,
            finalAmount: grandTotal,
            isTaxable: totalGst > 0
        };
    }, [cart, rawSubtotal, discountAmount]);

    const subtotal = rawSubtotal;
    const finalAmount = taxCalculation.finalAmount;

    const remainingAmount = useMemo(() => {
        if (paymentMethod === 'Khata') {
            const paid = Number(paidAmount) || 0;
            return Math.max(0, parseFloat((finalAmount - paid).toFixed(2)));
        }
        return 0;
    }, [finalAmount, paymentMethod, paidAmount]);

    const getUnitStep = (unit) => {
        const u = (unit || '').toLowerCase();
        if (u === 'gram' || u === 'g') return 50;
        if (u === 'ml') return 50;
        return 1;
    };

    const formatCartItemEquation = (item, productObj) => {
        const qty = Number(item.quantity) || 0;
        const unit = (item.unit || productObj?.unit || '').trim();
        const baseUnit = (item.baseUnit || productObj?.unit || unit || 'Piece').trim();
        const multiplier = Number(item.multiplier) || 1;
        const basePrice = item.basePrice != null 
            ? Number(item.basePrice) 
            : (productObj?.sellPrice != null ? Number(productObj.sellPrice) : (multiplier ? item.price / multiplier : 0));
        const lineTotal = parseFloat(((Number(item.price) || 0) * qty).toFixed(2));

        const formattedTotal = `₹${lineTotal.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;

        // Quantity string with unit
        let qtyStr = `${qty}`;
        const uLower = unit.toLowerCase();
        const buLower = baseUnit.toLowerCase();
        const isPiece = !unit || uLower === 'piece' || uLower === 'pieces' || uLower === 'pc' || uLower === 'pcs';

        if (uLower === 'gram' || uLower === 'g') qtyStr = `${qty} g`;
        else if (uLower === 'kg') qtyStr = `${qty} kg`;
        else if (uLower === 'ml') qtyStr = `${qty} ml`;
        else if (uLower === 'liter' || uLower === 'l') qtyStr = `${qty} L`;
        else if (isPiece) qtyStr = `${qty}`;
        else if (unit) qtyStr = `${qty} ${unit}`;

        // Rate string
        let rateStr;
        const formattedBasePrice = `₹${basePrice.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;

        if (multiplier !== 1 && baseUnit) {
            let buDisplay = baseUnit;
            if (buLower === 'kg') buDisplay = 'kg';
            else if (buLower === 'liter' || buLower === 'l') buDisplay = 'L';
            else if (buLower === 'piece' || buLower === 'pieces' || buLower === 'pc' || buLower === 'pcs') buDisplay = 'pc';
            rateStr = `${formattedBasePrice}/${buDisplay}`;
        } else if (isPiece) {
            rateStr = `${formattedBasePrice}`;
        } else {
            let uDisplay = unit;
            if (uLower === 'kg') uDisplay = 'kg';
            else if (uLower === 'liter' || uLower === 'l') uDisplay = 'L';
            rateStr = `${formattedBasePrice}/${uDisplay}`;
        }

        return {
            qtyStr,
            rateStr,
            lineTotal,
            formattedTotal,
            equationStr: `${qtyStr} × ${rateStr} = ${formattedTotal}`
        };
    };

    const checkoutBtnText = useMemo(() => {
        if (isCheckingOut) {
            return (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                    <div className="spinner-mini" style={{ width: '18px', height: '18px', border: '2px solid white', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.6s linear infinite' }}></div>
                    <span>Processing Transaction...</span>
                </div>
            );
        }

        if (cart.length === 0) {
            return 'Cart is Empty';
        }
        
        if (paymentMethod === 'Cash' || paymentMethod === 'UPI') {
            return `Collect ₹${finalAmount.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
        }
        
        // Khata
        const paid = Number(paidAmount) || 0;
        if (paid === 0) {
            return 'Save Khata Due';
        }
        return `Collect ₹${paid.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
    }, [isCheckingOut, cart.length, paymentMethod, finalAmount, paidAmount]);
    
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

    const categories = ['All', ...new Set(products.map(p => p.category).filter(Boolean))];

    const filteredProducts = products.filter(p => {
        const matchesSearch = (p.name || '').toLowerCase().includes((searchTerm || '').toLowerCase()) || 
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
        if (isGovSale && (product.governmentPrice === undefined || product.governmentPrice === null || Number(product.governmentPrice) <= 0)) {
            setAlertConfig({
                open: true,
                title: 'Missing GST Ledger Price',
                message: `"${product.name}" does not have a configured GST Ledger Price (current: ₹${product.governmentPrice || 0}). GST sales require a configured GST ledger rate. Please edit this product in Inventory to set a valid GST Ledger Price before adding it to a GST sale.`,
                type: 'error'
            });
            return;
        }
        setSellingProduct(product);
        setSellUnit(product.unit || 'Piece');
        setSellQty('1');
    };

    const addToCart = (product, qty, unit, multiplier) => {
        const q = parseFloat(qty);
        const cartKey = `${product._id}-${unit}`;
        const m = multiplier || 1;

        if (isGovSale && (product.governmentPrice === undefined || product.governmentPrice === null || Number(product.governmentPrice) <= 0)) {
            setAlertConfig({
                open: true,
                title: 'Missing GST Ledger Price',
                message: `Cannot add "${product.name}" to a GST sale: Missing configured GST Ledger Price. Please update this product in Inventory first.`,
                type: 'error'
            });
            return;
        }

        const activeBasePrice = isGovSale ? Number(product.governmentPrice) : Number(product.sellPrice);
        const priceForUnit = activeBasePrice * m;

        setCart(prev => {
            const existing = prev.find(item => item.cartKey === cartKey);
            if (existing) {
                return prev.map(item => item.cartKey === cartKey 
                    ? { ...item, quantity: parseFloat((item.quantity + q).toFixed(4)) } 
                    : item
                );
            }
            return [...prev, { 
                cartKey,
                product: product._id, 
                productName: product.name, 
                unit: unit,
                baseUnit: product.unit || unit || 'Piece',
                basePrice: activeBasePrice,
                price: priceForUnit, 
                multiplier: m,
                quantity: q, 
                maxStock: product.quantity,
                brand: product.brand,
                category: product.category,
                productType: product.productType,
                governmentPrice: Number(product.governmentPrice || 0),
                isGstApplicable: product.isGstApplicable !== undefined ? Boolean(product.isGstApplicable) : (Number(product.gst) > 0),
                gstRate: product.gstRate !== undefined ? Number(product.gstRate) : Number(product.gst || 0),
                gstPricingMode: product.gstPricingMode || 'inclusive'
            }];
        });
        setSellingProduct(null);
    };

    const updateCartQty = (cartKey, delta) => {
        setCart(prev => prev.map(item => {
            if (item.cartKey !== cartKey) return item;
            const newQty = parseFloat((item.quantity + delta).toFixed(4));
            if (newQty <= 0) return null;
            return { ...item, quantity: newQty };
        }).filter(Boolean));
    };

    const removeFromCart = (cartKey) => {
        setCart(prev => prev.filter(item => item.cartKey !== cartKey));
    };

    const handleCheckout = async () => {
        if (isCheckingOut) return;

        // Expiry & Suspension check
        const isYearly = shop?.subscription?.planType === 'Yearly';
        const isExpired = isYearly && shop?.subscription?.planEndDate && new Date() > new Date(shop?.subscription?.planEndDate);
        const isSuspended = shop?.isSuspended;
        if (isExpired || isSuspended) {
            showToast(isSuspended ? 'Cannot process transaction: Shop is suspended.' : 'Cannot process transaction: Subscription expired.', 'error');
            return;
        }

        if (cart.length === 0) return;
        if (paymentMethod === 'Khata' && (!customerName.trim() || !customerMobile.trim())) {
            showToast('Customer Name and Mobile are required for Khata payment.', 'warning');
            return;
        }

        // Validations
        if (Number(discountValue) < 0) {
            showToast('Discount value cannot be negative.', 'warning');
            return;
        }
        if (discountAmount > subtotal) {
            showToast('Discount cannot exceed subtotal.', 'warning');
            return;
        }

        if (isGovSale) {
            if (customerAadhaar.trim() && !/^\d{12}$/.test(customerAadhaar.trim())) {
                showToast('Aadhaar Card number must be exactly 12 digits.', 'warning');
                return;
            }

            // Verify all items have valid positive government price
            for (const it of cart) {
                const productObj = products.find(p => p._id === it.product);
                if (!productObj?.governmentPrice || Number(productObj.governmentPrice) <= 0) {
                    showToast(`Cannot complete GST sale: "${it.productName}" lacks a valid GST Ledger Price.`, 'error');
                    setAlertConfig({
                        open: true,
                        title: 'Missing GST Ledger Price',
                        message: `Product "${it.productName}" does not have a configured GST Ledger Price. Please update this product in Inventory before completing this GST sale.`,
                        type: 'error'
                    });
                    return;
                }
            }
        }
        
        let reqPaidAmount = finalAmount;
        let reqRemainingAmount = 0;
        let reqPaymentStatus = 'Paid';

        if (paymentMethod === 'Khata') {
            const paid = Number(paidAmount) || 0;
            if (paid < 0) {
                showToast('Paid amount cannot be negative.', 'warning');
                return;
            }
            if (paid > finalAmount + 0.01) {
                showToast('Paid amount cannot exceed final amount.', 'warning');
                return;
            }
            reqPaidAmount = paid;
            reqRemainingAmount = parseFloat((finalAmount - paid).toFixed(2));
            if (reqRemainingAmount === 0) {
                reqPaymentStatus = 'Paid';
            } else if (reqPaidAmount > 0) {
                reqPaymentStatus = 'Partial';
            } else {
                reqPaymentStatus = 'Unpaid';
            }
        }

        setIsCheckingOut(true);
        try {
            const res = isGovSale
                ? await govSaleService.create({
                    shop: shopId,
                    customerName: customerName || 'Walk-in Customer',
                    customerMobile: customerMobile || '',
                    customerAadhaar: customerAadhaar || '',
                    items: taxCalculation.itemsWithTax.map(item => {
                        const productObj = products.find(p => p._id === item.product);
                        const govPrice = Number(productObj?.governmentPrice);
                        return {
                            product: item.product,
                            productName: item.productName,
                            soldQtyEntered: item.quantity,
                            soldUnit: item.unit,
                            pricePerBaseUnit: govPrice,
                            governmentPrice: govPrice,
                            totalPrice: item.lineTotal,
                            isGstApplicable: item.isGstApplicable,
                            gstRate: item.gstRate,
                            gstPricingMode: item.gstPricingMode,
                            taxableValue: item.taxableValue,
                            gstAmount: item.gstAmount,
                            cgst: item.cgst,
                            sgst: item.sgst,
                            lineTotal: item.lineTotal
                        };
                    }),
                    subtotal: taxCalculation.subtotal,
                    taxableAmount: taxCalculation.taxableAmount,
                    totalGst: taxCalculation.totalGst,
                    cgstTotal: taxCalculation.cgstTotal,
                    sgstTotal: taxCalculation.sgstTotal,
                    isGstInvoice: taxCalculation.totalGst > 0,
                    totalAmount: finalAmount,
                    paymentMethod,
                    paidAmount: reqPaidAmount,
                    remainingAmount: reqRemainingAmount,
                    paymentStatus: reqPaymentStatus,
                    date: new Date()
                })
                : await saleService.create({
                    shop: shopId,
                    items: taxCalculation.itemsWithTax.map(item => ({
                        product: item.product,
                        productName: item.productName,
                        quantity: item.quantity,
                        unit: item.unit,
                        baseUnit: item.baseUnit,
                        basePrice: item.basePrice,
                        price: item.price,
                        multiplier: item.multiplier,
                        isGstApplicable: item.isGstApplicable,
                        gstRate: item.gstRate,
                        gstPricingMode: item.gstPricingMode,
                        taxableValue: item.taxableValue,
                        gstAmount: item.gstAmount,
                        cgst: item.cgst,
                        sgst: item.sgst,
                        lineTotal: item.lineTotal
                    })),
                    subtotal: taxCalculation.subtotal,
                    taxableAmount: taxCalculation.taxableAmount,
                    totalGst: taxCalculation.totalGst,
                    cgstTotal: taxCalculation.cgstTotal,
                    sgstTotal: taxCalculation.sgstTotal,
                    isGstInvoice: taxCalculation.totalGst > 0,
                    totalAmount: finalAmount,
                    paymentMethod,
                    customerName,
                    customerMobile,
                    discountType,
                    discountValue: Number(discountValue) || 0,
                    discountAmount,
                    paidAmount: reqPaidAmount,
                    remainingAmount: reqRemainingAmount,
                    paymentStatus: reqPaymentStatus,
                    date: new Date()
                });
            const createdSale = res.data?.data;
            if (createdSale) {
                if (isGovSale) {
                    await offlineDB.saveGovSale(createdSale);
                } else {
                    await offlineDB.saveSale(createdSale);
                }
            }
            setLastCreatedSale(createdSale);
            setOrderSuccess(true);
            setCart([]);
            setIsCartDrawerOpen(false);
            
            // Reset discount and payment inputs
            setDiscountType('none');
            setDiscountValue('');
            setPaidAmount('');
            setCustomerAadhaar('');

            // Invalidate cached query stats so navigation to sales ledger / dashboard is immediately fresh
            await offlineDB.deleteQueryCache(`/api/sales/stats?shop=${shopId}`);
            await offlineDB.deleteQueryCache('/api/sales/stats');
            await offlineDB.deleteQueryCache(`/api/sales?shop=${shopId}`);
            window.dispatchEvent(new CustomEvent('offline-mutation-queued'));

            fetchData();
            showToast('Sale created successfully!', 'success');
        } catch (err) {
            showToast(err.response?.data?.message || 'Checkout failed', 'error');
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
                    actions={
                        <button 
                            type="button"
                            className="pos-header-cart-btn" 
                            onClick={() => setIsCartDrawerOpen(true)}
                            title="Open Checkout Panel"
                        >
                            <ShoppingCart size={18} />
                            <span>Cart</span>
                            {cart.length > 0 && (
                                <span className="pos-hcb-count">{cart.length}</span>
                            )}
                        </button>
                    }
                />

                {!isOnline && (
                    <div style={{ background: '#FFFBEB', color: '#B45309', padding: '10px 24px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '1px solid #FEF3C7', fontWeight: 'bold' }}>
                        Offline Mode – recording sales locally
                    </div>
                )}

                {isFertilizerShop && (
                    <div style={{
                        display: 'flex',
                        gap: '8px',
                        padding: '12px 24px 0 24px',
                        background: '#FFFFFF'
                    }}>
                        <button
                            type="button"
                            onClick={() => {
                                if (saleMode !== 'government') {
                                    if (cart.length > 0) {
                                        if (window.confirm('Switching to GST Sale mode will reset your current cart. Continue?')) {
                                            setCart([]);
                                            setSaleMode('government');
                                        }
                                    } else {
                                        setSaleMode('government');
                                    }
                                }
                            }}
                            style={{
                                flex: 1,
                                padding: '10px 16px',
                                borderRadius: '12px',
                                border: isGovSale ? '2px solid #059669' : '1.5px solid #E2E8F0',
                                background: isGovSale ? '#ECFDF5' : '#FFFFFF',
                                color: isGovSale ? '#065F46' : '#64748B',
                                fontWeight: '800',
                                fontSize: '13px',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '8px',
                                transition: 'all 0.2s ease'
                            }}
                        >
                            <ShieldCheck size={16} color={isGovSale ? '#059669' : '#94A3B8'} />
                            <span>GST Sale (Special Price)</span>
                        </button>

                        <button
                            type="button"
                            onClick={() => {
                                if (saleMode !== 'retail') {
                                    if (cart.length > 0) {
                                        if (window.confirm('Switching to Retail Sale mode will reset your current cart. Continue?')) {
                                            setCart([]);
                                            setSaleMode('retail');
                                        }
                                    } else {
                                        setSaleMode('retail');
                                    }
                                }
                            }}
                            style={{
                                flex: 1,
                                padding: '10px 16px',
                                borderRadius: '12px',
                                border: !isGovSale ? '2px solid #1E6BFF' : '1.5px solid #E2E8F0',
                                background: !isGovSale ? '#EFF6FF' : '#FFFFFF',
                                color: !isGovSale ? '#1E40AF' : '#64748B',
                                fontWeight: '800',
                                fontSize: '13px',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '8px',
                                transition: 'all 0.2s ease'
                            }}
                        >
                            <ShoppingBag size={16} color={!isGovSale ? '#1E6BFF' : '#94A3B8'} />
                            <span>Regular Retail Sale (Selling Price)</span>
                        </button>
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
                        {categories.map((cat, idx) => (
                            <button 
                                key={idx} 
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
                                        {product.brand && <div style={{fontSize: '11px', color: '#667085', marginTop: '2px', fontWeight: '700'}}>{product.brand}</div>}
                                        <div className="pcv2-stock">
                                            <PackageOpen size={14} />
                                            <span>{product.quantity} {product.unit} available</span>
                                        </div>
                                    </div>
                                    <div className="pcv2-footer">
                                        <div className="pcv2-price">
                                            {isGovSale ? (
                                                product.governmentPrice && Number(product.governmentPrice) > 0 ? (
                                                    <span>₹{product.governmentPrice} <small style={{ fontSize: '10px', color: '#059669', fontWeight: '800' }}>GST</small></span>
                                                ) : (
                                                    <span style={{ color: '#DC2626', fontSize: '11px', fontWeight: '800' }}>No GST Price</span>
                                                )
                                            ) : (
                                                <span>₹{product.sellPrice}</span>
                                            )}
                                        </div>
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
                            {!isOnline && products.length === 0 ? (
                                <EmptyState 
                                    icon={ShoppingBag}
                                    title="No offline data cached yet"
                                    description="Connect to the internet once to sync products and populate your local offline database."
                                />
                            ) : (
                                <EmptyState 
                                    icon={ShoppingBag}
                                    title={searchTerm ? "No products found" : "Your catalog is empty"}
                                    description={searchTerm ? `We couldn't find anything matching "${searchTerm}".` : "Add products to your inventory to start selling."}
                                    actionLabel={searchTerm ? "Clear Search" : "Add Products"}
                                    onAction={searchTerm ? () => setSearchTerm('') : () => navigate(`/shop/${shopId}/inventory`)}
                                />
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Zomato-style Floating Cart Bar */}
            {cart.length > 0 && (
                <div className="mobile-pos-bar-v2 zomato-cart-bar" onClick={() => setIsCartDrawerOpen(true)}>
                    <div className="mpbv2-left">
                        <div className="mpbv2-count">{distinctProductsCount} {distinctProductsCount === 1 ? 'PRODUCT' : 'PRODUCTS'} ({totalQuantityCount} TOTAL)</div>
                        <div className="mpbv2-total">₹{finalAmount.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}</div>
                    </div>
                    <button type="button" className="mpbv2-btn">Complete Transaction <ArrowRight size={18} /></button>
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
                                    <strong>₹{(calculateConversion(sellQty, sellUnit, sellingProduct.unit).multiplier * (isGovSale ? Number(sellingProduct.governmentPrice) : Number(sellingProduct.sellPrice)) * parseFloat(sellQty || 0)).toFixed(2)}</strong>
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
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="m-backdrop-v2" onClick={() => { if (!isCheckingOut) setIsCartDrawerOpen(false); }} />
                        <motion.div initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }} className="checkout-drawer-v2">
                            {/* 1. HEADER */}
                            <div className="cdv2-header">
                                <button 
                                    type="button"
                                    className="btn-cdv2-back" 
                                    onClick={() => { if (!isCheckingOut) setIsCartDrawerOpen(false); }}
                                    title="Back to Catalog"
                                    aria-label="Back to Catalog"
                                >
                                    <ChevronLeft size={24} />
                                </button>
                                <div className="cdv2-header-text">
                                    <h3>Complete Transaction</h3>
                                    <p>{shop?.name ? `Checkout for ${shop.name}` : 'Order Summary & Payment'}</p>
                                </div>
                            </div>

                            <div className="cdv2-body">
                                {/* 1. DISCOUNT */}
                                <div className="checkout-card discount-card-v2">
                                    <div className="cc-header">
                                        <div className="cc-title-left">
                                            <Tag size={18} color="#1E6BFF" />
                                            <span>Apply Discount</span>
                                        </div>
                                        {discountAmount > 0 && (
                                            <span className="cc-badge-green">-₹{discountAmount.toLocaleString()} Saved</span>
                                        )}
                                    </div>
                                    <div className="discount-tabs-container">
                                        <div className="discount-segmented-group">
                                            <button 
                                                type="button"
                                                className={`ds-btn ${discountType === 'none' ? 'active' : ''}`}
                                                onClick={() => { setDiscountType('none'); setDiscountValue(''); }}
                                            >
                                                None
                                            </button>
                                            <button 
                                                type="button"
                                                className={`ds-btn ${discountType === 'flat' ? 'active' : ''}`}
                                                onClick={() => { setDiscountType('flat'); setDiscountValue(''); }}
                                            >
                                                ₹ Flat
                                            </button>
                                            <button 
                                                type="button"
                                                className={`ds-btn ${discountType === 'percentage' ? 'active' : ''}`}
                                                onClick={() => { setDiscountType('percentage'); setDiscountValue(''); }}
                                            >
                                                % Percentage
                                            </button>
                                        </div>

                                        {discountType !== 'none' && (
                                            <div className="discount-input-box">
                                                <span className="dib-prefix">
                                                    {discountType === 'flat' ? '₹' : '%'}
                                                </span>
                                                <input 
                                                    type="number" 
                                                    min="0"
                                                    placeholder={discountType === 'flat' ? 'Enter flat discount amount' : 'Enter discount percentage'} 
                                                    value={discountValue}
                                                    onChange={(e) => {
                                                        const val = e.target.value;
                                                        if (val === '') {
                                                            setDiscountValue('');
                                                        } else {
                                                            const numVal = Number(val);
                                                            if (numVal < 0) return;
                                                            if (discountType === 'percentage') {
                                                                setDiscountValue(Math.min(100, numVal));
                                                            } else {
                                                                setDiscountValue(Math.min(subtotal, numVal));
                                                            }
                                                        }
                                                    }}
                                                />
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* 4. PAYMENT MODE */}
                                <div className="checkout-card payment-mode-card">
                                    <div className="cc-header">
                                        <div className="cc-title-left">
                                            <CreditCard size={18} color="#1E6BFF" />
                                            <span>Payment Mode</span>
                                        </div>
                                    </div>
                                    <div className="pm-grid-v2">
                                        <button 
                                            type="button"
                                            className={paymentMethod === 'Cash' ? 'active' : ''} 
                                            onClick={() => setPaymentMethod('Cash')}
                                        >
                                            <Wallet size={20} />
                                            <span>Cash</span>
                                        </button>
                                        <button 
                                            type="button"
                                            className={paymentMethod === 'UPI' ? 'active' : ''} 
                                            onClick={() => setPaymentMethod('UPI')}
                                        >
                                            <QrCode size={20} />
                                            <span>UPI</span>
                                        </button>
                                        <button 
                                            type="button"
                                            className={paymentMethod === 'Khata' ? 'active' : ''} 
                                            onClick={() => { setPaymentMethod('Khata'); setPaidAmount(''); }}
                                        >
                                            <FileText size={20} />
                                            <span>Khata</span>
                                        </button>
                                    </div>
                                </div>

                                {/* 5. CUSTOMER DETAILS */}
                                <div className="checkout-card customer-details-card">
                                    <div className="cc-header">
                                        <div className="cc-title-left">
                                            <User size={18} color="#1E6BFF" />
                                            <span>Customer Details</span>
                                        </div>
                                        <span className="cc-badge-muted">
                                            {paymentMethod === 'Khata' ? 'Required for Khata' : 'Optional'}
                                        </span>
                                    </div>

                                    {paymentMethod === 'Khata' ? (
                                        <div className="khata-selector-wrapper">
                                            {customerMobile ? (
                                                <div className="selected-khata-card">
                                                    <div className="skc-info">
                                                        <span className="skc-name">{customerName}</span>
                                                        <span className="skc-phone">{customerMobile}</span>
                                                    </div>
                                                    <button type="button" className="skc-change-btn" onClick={() => setIsKhataPickerOpen(true)}>Change</button>
                                                </div>
                                            ) : (
                                                <button type="button" className="khata-picker-trigger" onClick={() => setIsKhataPickerOpen(true)}>
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
                                                        <button type="button" onClick={() => { setIsAddingNewKhata(false); setCustomerName(''); setCustomerMobile(''); }}>Cancel</button>
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

                                    {isGovSale && (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '12px' }}>
                                            <div className="cust-input-v2">
                                                <FileText size={18} color="#98A2B3" />
                                                <input 
                                                    type="text"
                                                    maxLength={12}
                                                    value={customerAadhaar} 
                                                    onChange={(e) => {
                                                        const val = e.target.value;
                                                        if (/^\d*$/.test(val)) {
                                                            setCustomerAadhaar(val);
                                                        }
                                                    }} 
                                                    placeholder="Aadhaar Card Number (12 digits)" 
                                                />
                                            </div>
                                        </div>
                                    )}

                                    {/* KHATA PAYMENT SPLIT DETAILS (when Khata selected) */}
                                    {paymentMethod === 'Khata' && customerMobile && (
                                        <div className="khata-payment-section" style={{ marginTop: '16px', padding: '16px', background: '#FFFDF5', border: '1.5px solid #FEF3C7', borderRadius: '18px' }}>
                                            <label style={{ fontSize: '13px', fontWeight: '800', color: '#854D0E', display: 'block', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                                Khata Due Breakdown
                                            </label>
                                            
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                                    <span style={{ fontSize: '14px', fontWeight: '600', color: '#64748B' }}>Paid Now</span>
                                                    <div style={{ display: 'flex', alignItems: 'center', background: 'white', border: '1.5px solid #CBD5E1', borderRadius: '12px', padding: '0 12px', width: '150px', height: '40px' }}>
                                                        <span style={{ fontSize: '14px', fontWeight: '700', color: '#64748B', marginRight: '4px' }}>₹</span>
                                                        <input 
                                                            type="number"
                                                            placeholder="0.00"
                                                            value={paidAmount}
                                                            onChange={(e) => {
                                                                const val = e.target.value;
                                                                if (val === '') {
                                                                    setPaidAmount('');
                                                                } else {
                                                                    const numVal = Number(val);
                                                                    setPaidAmount(Math.min(finalAmount, numVal));
                                                                }
                                                            }}
                                                            style={{ border: 'none', outline: 'none', width: '100%', fontSize: '15px', fontWeight: '800', color: '#0F172A' }}
                                                        />
                                                    </div>
                                                </div>

                                                <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                                                    <button 
                                                        type="button"
                                                        onClick={() => setPaidAmount(parseFloat((finalAmount * 0.25).toFixed(2)))} 
                                                        style={{ border: '1px solid #FEF3C7', background: 'white', color: '#854D0E', fontSize: '12px', fontWeight: '800', padding: '6px 10px', borderRadius: '8px', cursor: 'pointer' }}
                                                    >
                                                        25%
                                                    </button>
                                                    <button 
                                                        type="button"
                                                        onClick={() => setPaidAmount(parseFloat((finalAmount * 0.50).toFixed(2)))} 
                                                        style={{ border: '1px solid #FEF3C7', background: 'white', color: '#854D0E', fontSize: '12px', fontWeight: '800', padding: '6px 10px', borderRadius: '8px', cursor: 'pointer' }}
                                                    >
                                                        50%
                                                    </button>
                                                    <button 
                                                        type="button"
                                                        onClick={() => setPaidAmount(parseFloat((finalAmount * 0.75).toFixed(2)))} 
                                                        style={{ border: '1px solid #FEF3C7', background: 'white', color: '#854D0E', fontSize: '12px', fontWeight: '800', padding: '6px 10px', borderRadius: '8px', cursor: 'pointer' }}
                                                    >
                                                        75%
                                                    </button>
                                                    <button 
                                                        type="button"
                                                        onClick={() => setPaidAmount(finalAmount)} 
                                                        style={{ border: '1px solid #FEF3C7', background: 'white', color: '#854D0E', fontSize: '12px', fontWeight: '800', padding: '6px 10px', borderRadius: '8px', cursor: 'pointer' }}
                                                    >
                                                        Full
                                                    </button>
                                                </div>

                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '10px', borderTop: '1px dashed #FEF3C7' }}>
                                                    <span style={{ fontSize: '14px', fontWeight: '600', color: '#64748B' }}>Remaining Due</span>
                                                    <span style={{ fontSize: '16px', fontWeight: '900', color: '#EF4444' }}>₹{remainingAmount.toLocaleString()}</span>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* 4. PAYMENT SUMMARY WITH ITEMIZED CART ITEMS */}
                                <div className="checkout-card final-total-card">
                                    <div className="cc-header">
                                        <div className="cc-title-left">
                                            <ReceiptIcon size={18} color="#071B44" />
                                            <span>Payment Summary</span>
                                        </div>
                                        {cart.length > 0 && (
                                            <div className="ps-header-right">
                                                <span className="ps-pill-badge ps-badge-count">
                                                    {distinctProductsCount} {distinctProductsCount === 1 ? 'Product' : 'Products'}
                                                </span>
                                                <span className="ps-pill-badge ps-badge-qty">
                                                    Qty: {totalQuantityCount}
                                                </span>
                                                <button
                                                    type="button"
                                                    className="ps-toggle-btn"
                                                    onClick={() => setIsItemListExpanded(!isItemListExpanded)}
                                                    title={isItemListExpanded ? "Collapse item list" : "Expand item list"}
                                                    aria-label="Toggle cart items list"
                                                >
                                                    {isItemListExpanded ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                                                </button>
                                            </div>
                                        )}
                                    </div>

                                    {/* Itemized Cart Items List */}
                                    {cart.length === 0 ? (
                                        <div className="ps-empty-wrap">
                                            <ShoppingBag size={24} strokeWidth={1.5} color="#94A3B8" />
                                            <span>Your cart is empty</span>
                                        </div>
                                    ) : isItemListExpanded ? (
                                        <div className="ps-cart-items-scrollable">
                                            {cart.map(item => {
                                                const productObj = products.find(p => p._id === item.product);
                                                const { qtyStr, formattedTotal, equationStr } = formatCartItemEquation(item, productObj);
                                                const uLower = (item.unit || '').toLowerCase();
                                                const isPiece = !item.unit || uLower === 'piece' || uLower === 'pieces' || uLower === 'pc' || uLower === 'pcs';
                                                const variantLabel = !isPiece ? item.unit : (item.brand || productObj?.brand || '');
                                                const step = getUnitStep(item.unit);

                                                return (
                                                    <div key={item.cartKey} className="ps-cart-item-row">
                                                        <div className="ps-item-left">
                                                            <div className="ps-item-title-row">
                                                                <span className="ps-item-name">{item.productName}</span>
                                                                {variantLabel && (
                                                                    <span className="ps-item-variant">{variantLabel}</span>
                                                                )}
                                                                {item.isGstApplicable && item.gstRate > 0 && (
                                                                    <span style={{
                                                                        fontSize: '10px',
                                                                        fontWeight: '700',
                                                                        padding: '1px 5px',
                                                                        borderRadius: '4px',
                                                                        background: item.gstPricingMode === 'exclusive' ? '#EFF6FF' : '#F0FDF4',
                                                                        color: item.gstPricingMode === 'exclusive' ? '#1E6BFF' : '#16A34A',
                                                                        border: item.gstPricingMode === 'exclusive' ? '1px solid #BFDBFE' : '1px solid #BBF7D0'
                                                                    }}>
                                                                        {item.gstPricingMode === 'exclusive' ? `+${item.gstRate}% GST` : `${item.gstRate}% Incl.`}
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <div className="ps-item-equation-row">
                                                                <span className="ps-item-equation">{equationStr}</span>
                                                            </div>
                                                        </div>

                                                        <div className="ps-item-right">
                                                            <div className="ps-item-stepper">
                                                                <button 
                                                                    type="button" 
                                                                    onClick={() => updateCartQty(item.cartKey, -step)}
                                                                    title="Decrease quantity"
                                                                >
                                                                    <Minus size={11} />
                                                                </button>
                                                                <span className="ps-item-stepper-qty">{qtyStr}</span>
                                                                <button 
                                                                    type="button" 
                                                                    onClick={() => {
                                                                        const maxAvailable = item.maxStock ?? productObj?.quantity ?? Infinity;
                                                                        const nextDeduction = (item.quantity + step) * (item.multiplier || 1);
                                                                        if (nextDeduction > maxAvailable) {
                                                                            showToast(`Cannot exceed available stock (${maxAvailable} ${item.baseUnit || productObj?.unit || ''}).`, 'warning');
                                                                            return;
                                                                        }
                                                                        updateCartQty(item.cartKey, step);
                                                                    }}
                                                                    title="Increase quantity"
                                                                >
                                                                    <Plus size={11} />
                                                                </button>
                                                            </div>

                                                            <span className="ps-item-line-total">{formattedTotal}</span>

                                                            <button 
                                                                type="button" 
                                                                className="ps-item-delete"
                                                                onClick={() => removeFromCart(item.cartKey)}
                                                                title="Remove from cart"
                                                            >
                                                                <Trash2 size={13} />
                                                            </button>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    ) : (
                                        <button 
                                            type="button" 
                                            className="ps-collapsed-bar"
                                            onClick={() => setIsItemListExpanded(true)}
                                        >
                                            <span>{distinctProductsCount} {distinctProductsCount === 1 ? 'item' : 'items'} in cart ({cart.map(i => i.productName).slice(0, 2).join(', ')}{cart.length > 2 ? '...' : ''})</span>
                                            <span className="ps-show-link">View items</span>
                                        </button>
                                    )}

                                    <div className="ps-divider" />

                                    <div className="final-total-content">
                                        <div className="ft-row">
                                            <span className="ft-label">Cart Subtotal</span>
                                            <span className="ft-val">₹{subtotal.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}</span>
                                        </div>
                                        {discountAmount > 0 && (
                                            <div className="ft-row ft-discount">
                                                <span className="ft-label">Discount Deducted {discountType === 'percentage' ? `(${discountValue}%)` : ''}</span>
                                                <span className="ft-val">- ₹{discountAmount.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}</span>
                                            </div>
                                        )}
                                        {taxCalculation.totalGst > 0 && (
                                            <>
                                                <div className="ft-row">
                                                    <span className="ft-label">Taxable Amount</span>
                                                    <span className="ft-val">₹{taxCalculation.taxableAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                                </div>
                                                <div className="ft-row" style={{ color: '#1E6BFF' }}>
                                                    <span className="ft-label" style={{ fontWeight: '700', color: '#1E6BFF' }}>Total GST</span>
                                                    <span className="ft-val" style={{ fontWeight: '700', color: '#1E6BFF' }}>+ ₹{taxCalculation.totalGst.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                                </div>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#64748B', padding: '0 0 4px 2px' }}>
                                                    <span>GST Breakdown:</span>
                                                    <span>CGST: ₹{taxCalculation.cgstTotal.toFixed(2)} | SGST: ₹{taxCalculation.sgstTotal.toFixed(2)}</span>
                                                </div>
                                            </>
                                        )}
                                        {paymentMethod === 'Khata' && (
                                            <>
                                                <div className="ft-row">
                                                    <span className="ft-label">Paid Upfront</span>
                                                    <span className="ft-val">₹{(Number(paidAmount) || 0).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}</span>
                                                </div>
                                                {remainingAmount > 0 && (
                                                    <div className="ft-row ft-due">
                                                        <span className="ft-label">Khata Balance Due</span>
                                                        <span className="ft-val">₹{remainingAmount.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}</span>
                                                    </div>
                                                )}
                                            </>
                                        )}
                                        <div className="ft-divider" />
                                        <div className="ft-row ft-grand-total">
                                            <div className="ft-grand-titles">
                                                <span className="ft-grand-label">Grand Total</span>
                                                <span className="ft-grand-sub">Net Payable Amount</span>
                                            </div>
                                            <span className="ft-grand-val">₹{finalAmount.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* 7. FIXED BOTTOM FOOTER (Collect Payment) */}
                            <div className="cdv2-footer">
                                <button 
                                    type="button"
                                    className="btn-final-v2" 
                                    onClick={handleCheckout} 
                                    disabled={isCheckingOut || cart.length === 0}
                                >
                                    {checkoutBtnText}
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
                                    onClick={() => lastCreatedSale && invoiceService.shareInvoice(lastCreatedSale, shop, isGovSale ? 'GOV_SALE' : 'SALE', { products, format: shop?.defaultPrintFormat || 'full_a4' })}
                                >
                                    Share
                                </button>
                                <button 
                                    className="ips-btn ips-pdf" 
                                    style={{ flex: 1, background: '#F2F4F7', color: '#101828', border: 'none', height: '44px', borderRadius: '12px', fontWeight: '800', cursor: 'pointer' }}
                                    onClick={() => lastCreatedSale && invoiceService.downloadInvoice(lastCreatedSale, shop, isGovSale ? 'GOV_SALE' : 'SALE', { products, format: shop?.defaultPrintFormat || 'full_a4' })}
                                >
                                    Download PDF
                                </button>
                            </div>

                            <button className="btn-s-done-v2" onClick={() => { setOrderSuccess(false); setLastCreatedSale(null); setIsAddingNewKhata(false); setCustomerName(''); setCustomerMobile(''); setCustomerAadhaar(''); }}>New Sale</button>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            <style jsx="true">{`
                @keyframes spin {
                    to { transform: rotate(360deg); }
                }
                .spinner-mini {
                    animation: spin 0.6s linear infinite;
                }
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

                .pos-header-cart-btn {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    background: white;
                    color: #071B44;
                    border: 1.5px solid #E2E8F0;
                    padding: 8px 16px;
                    border-radius: 14px;
                    font-weight: 700;
                    font-size: 14px;
                    cursor: pointer;
                    transition: 0.2s;
                    box-shadow: 0 2px 6px rgba(0,0,0,0.03);
                }
                .pos-header-cart-btn:hover {
                    border-color: #1E6BFF;
                    color: #1E6BFF;
                    background: #F5F9FF;
                }
                .pos-hcb-count {
                    background: #1E6BFF;
                    color: white;
                    font-size: 11px;
                    font-weight: 900;
                    padding: 2px 8px;
                    border-radius: 10px;
                }

                /* Checkout Drawer V2 */
                .checkout-drawer-v2 { 
                    background: #F8FAFC; 
                    height: 100vh; 
                    width: 100%; 
                    max-width: 520px; 
                    display: flex; 
                    flex-direction: column; 
                    overflow: hidden; 
                    position: absolute; 
                    right: 0; 
                    top: 0; 
                    bottom: 0; 
                    box-shadow: -12px 0 50px rgba(7, 27, 68, 0.15); 
                    z-index: 7001;
                }
                .cdv2-header { 
                    padding: 18px 24px; 
                    background: white;
                    border-bottom: 1px solid #EAECF0; 
                    display: flex; 
                    align-items: center; 
                    gap: 14px; 
                    flex-shrink: 0;
                }
                .btn-cdv2-back { 
                    width: 42px; 
                    height: 42px; 
                    border-radius: 12px; 
                    border: 1px solid #EAECF0; 
                    background: #F9FAFB; 
                    color: #344054;
                    display: flex; 
                    align-items: center; 
                    justify-content: center; 
                    cursor: pointer;
                    transition: 0.2s;
                }
                .btn-cdv2-back:hover {
                    background: #F2F4F7;
                    color: #101828;
                }
                .cdv2-header-text h3 {
                    font-size: 20px;
                    font-weight: 800;
                    color: #101828;
                    margin: 0;
                    line-height: 1.2;
                }
                .cdv2-header-text p {
                    font-size: 12px;
                    font-weight: 600;
                    color: #667085;
                    margin: 2px 0 0 0;
                }
                .cdv2-body { 
                    flex: 1; 
                    min-height: 0; 
                    overflow-y: auto; 
                    padding: 20px 24px; 
                    display: flex; 
                    flex-direction: column; 
                    gap: 18px; 
                    background: #F8FAFC;
                    -webkit-overflow-scrolling: touch;
                }

                /* Payment Summary Itemized Cart List */
                .ps-header-right {
                    display: flex;
                    align-items: center;
                    gap: 6px;
                }
                .ps-pill-badge {
                    font-size: 11px;
                    font-weight: 700;
                    padding: 3px 8px;
                    border-radius: 8px;
                }
                .ps-badge-count {
                    background: #EFF6FF;
                    color: #1E6BFF;
                    border: 1px solid #DBEAFE;
                }
                .ps-badge-qty {
                    background: #F1F5F9;
                    color: #475569;
                    border: 1px solid #E2E8F0;
                }
                .ps-toggle-btn {
                    width: 24px;
                    height: 24px;
                    border-radius: 6px;
                    border: 1px solid #E2E8F0;
                    background: white;
                    color: #64748B;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    cursor: pointer;
                    transition: 0.15s;
                    padding: 0;
                }
                .ps-toggle-btn:hover {
                    background: #F1F5F9;
                    color: #0F172A;
                }
                .ps-empty-wrap {
                    padding: 18px 12px;
                    text-align: center;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    gap: 6px;
                    color: #94A3B8;
                    font-size: 13px;
                    font-weight: 600;
                }
                .ps-cart-items-scrollable {
                    max-height: 210px;
                    overflow-y: auto;
                    display: flex;
                    flex-direction: column;
                    gap: 8px;
                    padding: 4px 2px 8px 2px;
                    -webkit-overflow-scrolling: touch;
                }
                .ps-cart-items-scrollable::-webkit-scrollbar {
                    width: 4px;
                }
                .ps-cart-items-scrollable::-webkit-scrollbar-thumb {
                    background: #CBD5E1;
                    border-radius: 4px;
                }
                .ps-cart-item-row {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 10px 12px;
                    background: #F8FAFC;
                    border: 1px solid #E2E8F0;
                    border-radius: 12px;
                    transition: 0.15s ease;
                }
                .ps-cart-item-row:hover {
                    border-color: #CBD5E1;
                    background: #F1F5F9;
                }
                .ps-item-left {
                    display: flex;
                    flex-direction: column;
                    gap: 2px;
                    min-width: 0;
                    flex: 1;
                    padding-right: 8px;
                }
                .ps-item-title-row {
                    display: flex;
                    align-items: center;
                    gap: 6px;
                    flex-wrap: wrap;
                }
                .ps-item-name {
                    font-size: 13px;
                    font-weight: 800;
                    color: #0F172A;
                    line-height: 1.2;
                }
                .ps-item-variant {
                    font-size: 10px;
                    font-weight: 700;
                    padding: 1px 6px;
                    background: #EFF6FF;
                    color: #1E6BFF;
                    border-radius: 6px;
                    text-transform: uppercase;
                }
                .ps-item-equation-row {
                    display: flex;
                    align-items: center;
                    gap: 6px;
                }
                .ps-item-equation {
                    font-size: 12px;
                    font-weight: 600;
                    color: #64748B;
                }
                .ps-item-right {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    flex-shrink: 0;
                }
                .ps-item-stepper {
                    display: flex;
                    align-items: center;
                    background: white;
                    border: 1px solid #CBD5E1;
                    border-radius: 8px;
                    padding: 2px 4px;
                    gap: 2px;
                    height: 28px;
                }
                .ps-item-stepper button {
                    width: 22px;
                    height: 22px;
                    border: none;
                    background: #F1F5F9;
                    border-radius: 5px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: #0F172A;
                    cursor: pointer;
                    transition: 0.15s;
                }
                .ps-item-stepper button:hover {
                    background: #E2E8F0;
                }
                .ps-item-stepper-qty {
                    padding: 0 4px;
                    font-size: 11px;
                    font-weight: 800;
                    color: #0F172A;
                    min-width: 20px;
                    text-align: center;
                }
                .ps-item-line-total {
                    font-size: 14px;
                    font-weight: 900;
                    color: #071B44;
                    min-width: 50px;
                    text-align: right;
                }
                .ps-item-delete {
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
                }
                .ps-item-delete:hover {
                    color: #EF4444;
                    background: #FEE2E2;
                }
                .ps-collapsed-bar {
                    width: 100%;
                    border: 1px dashed #CBD5E1;
                    background: #F8FAFC;
                    padding: 8px 12px;
                    border-radius: 10px;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    font-size: 12px;
                    font-weight: 700;
                    color: #64748B;
                    cursor: pointer;
                    transition: 0.15s;
                }
                .ps-collapsed-bar:hover {
                    background: #F1F5F9;
                    color: #0F172A;
                }
                .ps-show-link {
                    color: #1E6BFF;
                    font-weight: 800;
                }
                .ps-divider {
                    height: 1px;
                    background: #E2E8F0;
                    margin: 6px 0;
                }

                /* Shared Checkout Card */
                .checkout-card {
                    background: white;
                    border: 1.5px solid #E2E8F0;
                    border-radius: 20px;
                    padding: 16px;
                    display: flex;
                    flex-direction: column;
                    gap: 12px;
                    box-shadow: 0 4px 16px rgba(0,0,0,0.02);
                }
                .cc-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                }
                .cc-title-left {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    font-size: 13px;
                    font-weight: 800;
                    color: #334155;
                    text-transform: uppercase;
                    letter-spacing: 0.05em;
                }
                .cc-badge-green {
                    font-size: 11px;
                    font-weight: 800;
                    color: #059669;
                    background: #ECFDF5;
                    padding: 3px 8px;
                    border-radius: 8px;
                    border: 1px solid #A7F3D0;
                }
                .cc-badge-muted {
                    font-size: 11px;
                    font-weight: 700;
                    color: #64748B;
                    background: #F1F5F9;
                    padding: 2px 8px;
                    border-radius: 6px;
                }

                /* Discount Tabs & Input */
                .discount-tabs-container {
                    display: flex;
                    flex-direction: column;
                    gap: 10px;
                }
                .discount-segmented-group {
                    display: flex;
                    background: #F1F5F9;
                    padding: 4px;
                    border-radius: 12px;
                    gap: 4px;
                }
                .ds-btn {
                    flex: 1;
                    border: none;
                    background: transparent;
                    color: #64748B;
                    font-weight: 800;
                    font-size: 12px;
                    padding: 8px 10px;
                    border-radius: 8px;
                    cursor: pointer;
                    transition: 0.2s;
                }
                .ds-btn.active {
                    background: white;
                    color: #071B44;
                    box-shadow: 0 2px 6px rgba(0,0,0,0.06);
                }
                .discount-input-box {
                    display: flex;
                    align-items: center;
                    background: white;
                    border: 1.5px solid #CBD5E1;
                    border-radius: 12px;
                    padding: 0 12px;
                    height: 42px;
                }
                .dib-prefix {
                    font-size: 14px;
                    font-weight: 800;
                    color: #64748B;
                    margin-right: 6px;
                }
                .discount-input-box input {
                    border: none;
                    outline: none;
                    background: transparent;
                    flex: 1;
                    font-size: 14px;
                    font-weight: 700;
                    color: #0F172A;
                }

                /* Final Total Card */
                .final-total-card {
                    background: #F8FAFC;
                    border-color: #CBD5E1;
                }
                .final-total-content {
                    display: flex;
                    flex-direction: column;
                    gap: 8px;
                }
                .ft-row {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                }
                .ft-label {
                    font-size: 13px;
                    font-weight: 600;
                    color: #64748B;
                }
                .ft-val {
                    font-size: 14px;
                    font-weight: 700;
                    color: #1E293B;
                }
                .ft-discount .ft-label, .ft-discount .ft-val {
                    color: #059669;
                    font-weight: 700;
                }
                .ft-due .ft-label, .ft-due .ft-val {
                    color: #DC2626;
                    font-weight: 800;
                }
                .ft-divider {
                    height: 1px;
                    background: #E2E8F0;
                    margin: 4px 0;
                }
                .ft-grand-total {
                    padding-top: 4px;
                }
                .ft-grand-titles {
                    display: flex;
                    flex-direction: column;
                }
                .ft-grand-label {
                    font-size: 16px;
                    font-weight: 900;
                    color: #071B44;
                }
                .ft-grand-sub {
                    font-size: 11px;
                    font-weight: 600;
                    color: #64748B;
                }
                .ft-grand-val {
                    font-size: 22px;
                    font-weight: 900;
                    color: #071B44;
                }

                /* Fixed Bottom Footer */
                .cdv2-footer {
                    padding: 16px 24px;
                    background: white;
                    border-top: 1.5px solid #EAECF0;
                    box-shadow: 0 -8px 24px rgba(7, 27, 68, 0.05);
                    flex-shrink: 0;
                    z-index: 10;
                }
                .btn-final-v2 { 
                    width: 100%; 
                    height: 54px; 
                    background: #071B44; 
                    color: white; 
                    border: none; 
                    border-radius: 16px; 
                    font-size: 17px; 
                    font-weight: 800; 
                    cursor: pointer; 
                    transition: all 0.2s ease;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    box-shadow: 0 8px 20px rgba(7, 27, 68, 0.2);
                }
                .btn-final-v2:not(:disabled):hover {
                    background: #0d2864;
                    transform: translateY(-1px);
                    box-shadow: 0 10px 24px rgba(7, 27, 68, 0.25);
                }
                .btn-final-v2:disabled {
                    background: #94A3B8;
                    cursor: not-allowed;
                    box-shadow: none;
                    opacity: 0.75;
                }

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
                        height: 92dvh; 
                        top: auto; 
                        bottom: 0; 
                        border-radius: 28px 28px 0 0; 
                        box-shadow: 0 -10px 40px rgba(0,0,0,0.15);
                        transform: translateY(0);
                        padding-bottom: var(--keyboard-height);
                        transition: padding-bottom 0.15s ease-out;
                    }
                    .cdv2-header { 
                        padding: 14px 18px; 
                        height: 56px; 
                        border-bottom: 1px solid #EAECF0; 
                        position: sticky; 
                        top: 0; 
                        background: white; 
                        z-index: 20; 
                        border-radius: 28px 28px 0 0; 
                    }
                    .btn-cdv2-back { width: 36px; height: 36px; border-radius: 10px; }
                    .cdv2-body { padding: 14px 16px; gap: 14px; min-height: 0; overflow-y: auto; }
                    
                    .ps-cart-items-scrollable { max-height: 180px; gap: 6px; }
                    .ps-cart-item-row { padding: 8px 10px; }
                    .ps-item-name { font-size: 12px; }
                    .ps-item-equation { font-size: 11px; }
                    .ps-item-line-total { font-size: 13px; min-width: 45px; }
                    .ps-item-stepper { height: 26px; }
                    .ps-item-stepper button { width: 20px; height: 20px; }
                    .ps-item-stepper-qty { font-size: 10px; padding: 0 3px; }

                    .checkout-card { border-radius: 16px; padding: 14px; gap: 10px; }
                    .final-total-card { border-radius: 16px; padding: 14px; }

                    .pm-grid-v2 { gap: 8px; }
                    .pm-grid-v2 button { height: 64px; border-radius: 14px; }
                    .pm-grid-v2 button span { font-size: 11px; }

                    .cust-input-v2 { height: 48px; border-radius: 14px; padding: 0 12px; }
                    .cust-input-v2 input { font-size: 14px; }

                    .cdv2-footer { padding: 12px 16px; padding-bottom: calc(12px + env(safe-area-inset-bottom, 0px)); }
                    .btn-final-v2 { height: 50px; border-radius: 14px; font-size: 16px; }
                    
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
