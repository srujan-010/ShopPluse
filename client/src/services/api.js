import axios from 'axios';
import { offlineDB } from './offlineDB';

const getBaseUrl = () => {
    // 1. Check for environment variable
    if (import.meta.env.VITE_API_URL) return import.meta.env.VITE_API_URL;
    
    // 2. Default to Render for production if on netlify
    if (typeof window !== 'undefined' && window.location.hostname.includes('netlify.app')) {
        return 'https://shoppluse.onrender.com';
    }
    
    // 3. Fallback to empty string for local proxying
    return '';
};

const BASE_URL = getBaseUrl();
console.log('ShopPulse API Base URL:', BASE_URL);

// Create axios instance
const api = axios.create({
    baseURL: BASE_URL, 
    headers: {
        'Content-Type': 'application/json'
    }
});

// Helper to get full API URL for redirects
export const getFullApiUrl = (path) => {
    const base = BASE_URL.endsWith('/') ? BASE_URL.slice(0, -1) : BASE_URL;
    const cleanPath = path.startsWith('/') ? path : `/${path}`;
    return `${base}${cleanPath}`;
};

// Set the AUTH token for any request
api.interceptors.request.use((config) => {
    const token = localStorage.getItem('token');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    
    // Automatically generate idempotency key for state-changing requests (POST, PUT, DELETE)
    if (config.method && ['post', 'put', 'delete'].includes(config.method.toLowerCase())) {
        if (!config.headers['X-Idempotency-Key']) {
            config.headers['X-Idempotency-Key'] = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        }
    }
    return config;
});

const isEntityRoute = (url, entityPath, ignoreSubpaths = []) => {
    if (!url) return false;
    const urlPath = url.split('?')[0];
    if (!urlPath.includes(entityPath)) return false;
    for (const subpath of ignoreSubpaths) {
        if (urlPath.includes(subpath)) {
            return false;
        }
    }
    return true;
};

// Handle errors and offline caching globally
api.interceptors.response.use(
    async (response) => {
        // Cache successful GET requests
        if (response.config.method === 'get') {
            try {
                await offlineDB.saveQueryCache(response.config.url, response.data);
                
                const url = response.config.url || '';
                
                // Cache dedicated entities
                if (isEntityRoute(url, '/api/products', ['restock', 'inventory-history']) && response.data && response.data.data) {
                    const data = Array.isArray(response.data.data) ? response.data.data : [response.data.data];
                    await offlineDB.saveProductsBulk(data);
                }
                if (isEntityRoute(url, '/api/sales', ['stats', 'reports', 'history', 'summaries']) && response.data && response.data.data) {
                    const data = Array.isArray(response.data.data) ? response.data.data : [response.data.data];
                    await offlineDB.saveSalesBulk(data);
                }
                if (isEntityRoute(url, '/api/khata', ['pay', 'sale']) && response.data && response.data.data) {
                    const data = Array.isArray(response.data.data) ? response.data.data : [response.data.data];
                    await offlineDB.saveKhataBulk(data);
                }
                if (isEntityRoute(url, '/api/gov-sales', ['stats']) && response.data && response.data.data) {
                    const data = Array.isArray(response.data.data) ? response.data.data : [response.data.data];
                    await offlineDB.saveGovSalesBulk(data);
                }
                if (isEntityRoute(url, '/api/purchases', ['payment']) && response.data && response.data.data) {
                    const data = Array.isArray(response.data.data) ? response.data.data : [response.data.data];
                    await offlineDB.savePurchasesBulk(data);
                }
                if (isEntityRoute(url, '/api/shops', []) && response.data && response.data.data) {
                    const data = Array.isArray(response.data.data) ? response.data.data : [response.data.data];
                    await offlineDB.saveShopsBulk(data);
                }
            } catch(e) { console.error('Cache save failed', e); }
        }
        return response;
    },
    async (error) => {
        const originalRequest = error.config;

        if (error.response && error.response.status === 401) {
            localStorage.removeItem('token');
            if (!window.location.pathname.includes('/login')) {
                window.location.href = '/login';
            }
            return Promise.reject(error);
        }

        // Check if offline, network error, or server error (e.g. 503 Service Unavailable, 500 Internal Server Error)
        const isOfflineOrServerError = !error.response || (error.response && error.response.status >= 500);
        if (isOfflineOrServerError && originalRequest) {
            const url = originalRequest.url;
            const method = originalRequest.method;

            // Handle GET offline fallback
            if (method === 'get') {
                try {
                    if (isEntityRoute(url, '/api/products', ['restock', 'inventory-history'])) {
                        const shopIdMatch = url.match(/shop=([^&]+)/);
                        const shopId = shopIdMatch ? shopIdMatch[1] : null;
                        const products = await offlineDB.getProducts(shopId);
                        if (products && products.length > 0) {
                            return Promise.resolve({ data: { success: true, data: products }, status: 200, fromCache: true });
                        }
                    }
                    if (isEntityRoute(url, '/api/sales', ['stats', 'reports', 'history', 'summaries'])) {
                        const shopIdMatch = url.match(/shop=([^&]+)/);
                        const shopId = shopIdMatch ? shopIdMatch[1] : null;
                        const sales = await offlineDB.getSales(shopId);
                        if (sales && sales.length > 0) {
                            return Promise.resolve({ data: { success: true, data: sales }, status: 200, fromCache: true });
                        }
                    }
                    if (isEntityRoute(url, '/api/khata', ['pay', 'sale'])) {
                        const shopIdMatch = url.match(/shopId=([^&]+)/);
                        const shopId = shopIdMatch ? shopIdMatch[1] : null;
                        const customers = await offlineDB.getKhata(shopId);
                        if (customers && customers.length > 0) {
                            return Promise.resolve({ data: { success: true, data: customers }, status: 200, fromCache: true });
                        }
                    }
                    if (isEntityRoute(url, '/api/gov-sales', ['stats'])) {
                        const shopIdMatch = url.match(/shop=([^&]+)/);
                        const shopId = shopIdMatch ? shopIdMatch[1] : null;
                        const govSales = await offlineDB.getGovSales(shopId);
                        if (govSales && govSales.length > 0) {
                            return Promise.resolve({ data: { success: true, data: govSales }, status: 200, fromCache: true });
                        }
                    }
                    if (isEntityRoute(url, '/api/purchases', ['payment'])) {
                        const shopIdMatch = url.match(/shop=([^&]+)/);
                        const shopId = shopIdMatch ? shopIdMatch[1] : null;
                        const purchases = await offlineDB.getPurchases(shopId);
                        if (purchases && purchases.length > 0) {
                            return Promise.resolve({ data: { success: true, data: purchases }, status: 200, fromCache: true });
                        }
                    }
                    if (isEntityRoute(url, '/api/shops', [])) {
                        const shops = await offlineDB.getShops();
                        if (shops && shops.length > 0) {
                            return Promise.resolve({ data: { success: true, data: shops }, status: 200, fromCache: true });
                        }
                    }

                    // Fallback to query cache
                    const cachedData = await offlineDB.getQueryCache(url);
                    if (cachedData) {
                        return Promise.resolve({ data: cachedData, status: 200, fromCache: true });
                    }
                } catch (e) {
                    console.error('Offline GET fallback failed', e);
                }
            } else {
                // Handle POST/PUT/DELETE offline fallbacks
                try {
                    let parsedData = originalRequest.data;
                    if (typeof originalRequest.data === 'string') {
                        parsedData = JSON.parse(originalRequest.data);
                    }

                    const tempId = 'temp_' + Date.now();
                    let mockResponseData = { success: true, message: 'Saved offline. Will sync when online.', data: [] };

                    // 1. PRODUCTS MUTATIONS
                    if (url.includes('/api/products')) {
                        if (method === 'post') {
                            const newProduct = { 
                                ...parsedData, 
                                _id: tempId, 
                                quantity: Number(parsedData.quantity || 0),
                                updatedAt: new Date().toISOString() 
                            };
                            await offlineDB.saveProduct(newProduct);
                            
                            // Log inventory history for opening stock
                            if (newProduct.quantity > 0) {
                                await offlineDB.saveInventoryHistory({
                                    _id: 'temp_hist_' + Date.now(),
                                    productId: tempId,
                                    productName: newProduct.name,
                                    actionType: 'STOCK_ADDED',
                                    quantity: newProduct.quantity,
                                    unit: newProduct.unit || 'Piece',
                                    previousStock: 0,
                                    newStock: newProduct.quantity,
                                    notes: 'Opening stock added offline',
                                    shop: newProduct.shop,
                                    createdAt: new Date().toISOString()
                                });
                            }

                            mockResponseData.data = newProduct;
                        } else if (method === 'put') {
                            const id = url.split('/').pop();
                            const existingProduct = await offlineDB.getProduct(id) || {};
                            const updatedProduct = { 
                                ...existingProduct, 
                                ...parsedData, 
                                _id: id,
                                updatedAt: new Date().toISOString() 
                            };
                            await offlineDB.saveProduct(updatedProduct);
                            mockResponseData.data = updatedProduct;
                        } else if (method === 'delete') {
                            const id = url.split('/').pop();
                            await offlineDB.deleteProduct(id);
                        }
                    }

                    // 2. PRODUCT RESTOCK
                    else if (url.includes('/api/products/') && url.includes('/restock')) {
                        const id = url.split('/')[3]; // e.g. /api/products/:id/restock
                        const product = await offlineDB.getProduct(id);
                        if (product) {
                            const quantityAdded = Number(parsedData.quantityAdded || 0);
                            const prevQty = product.quantity || 0;
                            product.quantity = parseFloat((prevQty + quantityAdded).toFixed(3));
                            product.updatedAt = new Date().toISOString();
                            await offlineDB.saveProduct(product);

                            // Log inventory history
                            await offlineDB.saveInventoryHistory({
                                _id: 'temp_hist_' + Date.now(),
                                productId: id,
                                productName: product.name,
                                actionType: 'STOCK_ADDED',
                                quantity: quantityAdded,
                                unit: product.unit || 'Piece',
                                previousStock: prevQty,
                                newStock: product.quantity,
                                notes: parsedData.notes || 'Restocked offline',
                                shop: product.shop,
                                createdAt: new Date().toISOString()
                            });
                        }
                    }

                    // 3. SALES MUTATIONS
                    else if (url.includes('/api/sales')) {
                        if (method === 'post') {
                            const newSale = {
                                ...parsedData,
                                _id: tempId,
                                invoiceNumber: parsedData.invoiceNumber || `INV-TEMP-${Math.floor(100000 + Math.random() * 900000)}`,
                                date: parsedData.date || new Date().toISOString(),
                                updatedAt: new Date().toISOString()
                            };
                            
                            // Process stock deduction for cart items
                            if (parsedData.items && Array.isArray(parsedData.items)) {
                                for (const item of parsedData.items) {
                                    const product = await offlineDB.getProduct(item.product);
                                    if (product) {
                                        const prevStock = product.quantity || 0;
                                        // Simple deduction or using multiplier
                                        const qtyToDeduct = Number(item.soldQtyBaseUnit || item.quantity || 0);
                                        product.quantity = Math.max(0, parseFloat((prevStock - qtyToDeduct).toFixed(3)));
                                        product.updatedAt = new Date().toISOString();
                                        await offlineDB.saveProduct(product);

                                        // Log inventory history
                                        await offlineDB.saveInventoryHistory({
                                            _id: 'temp_hist_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
                                            productId: product._id,
                                            productName: product.name,
                                            actionType: 'STOCK_SOLD',
                                            quantity: qtyToDeduct,
                                            unit: item.soldUnit || product.unit || 'Piece',
                                            previousStock: prevStock,
                                            newStock: product.quantity,
                                            notes: `Sold ${qtyToDeduct} offline`,
                                            shop: parsedData.shop,
                                            createdAt: new Date().toISOString()
                                        });
                                    }
                                }
                            }

                            // Save sale locally
                            await offlineDB.saveSale(newSale);

                            // Handle Khata ledger updating locally
                            if (parsedData.paymentMethod === 'Khata' && parsedData.customerMobile) {
                                let khataRecord = await offlineDB.getKhataRecordByMobile(parsedData.shop, parsedData.customerMobile.trim());
                                const amount = Number(parsedData.totalAmount || 0);
                                if (!khataRecord) {
                                    khataRecord = {
                                        _id: 'temp_khata_' + Date.now(),
                                        shop: parsedData.shop,
                                        customerName: parsedData.customerName || 'Walk-in Customer',
                                        mobile: parsedData.customerMobile.trim(),
                                        outstandingDue: 0,
                                        transactions: [],
                                        updatedAt: new Date().toISOString()
                                    };
                                }
                                khataRecord.outstandingDue += amount;
                                khataRecord.transactions.push({
                                    type: 'due',
                                    amount: amount,
                                    date: parsedData.date || new Date().toISOString(),
                                    note: `Sale recorded via POS (Bill #${newSale._id.slice(-6).toUpperCase()})`,
                                    saleId: newSale._id,
                                    isPOSSale: true,
                                    paymentMethod: 'Khata',
                                    items: (parsedData.items || []).map(i => ({
                                        productName: i.productName,
                                        quantity: i.soldQtyEntered || i.quantity,
                                        unit: i.soldUnit || i.unit,
                                        price: i.price
                                    }))
                                });
                                khataRecord.updatedAt = new Date().toISOString();
                                await offlineDB.saveKhata(khataRecord);
                            }

                            mockResponseData.data = newSale;
                        }
                    }

                    // 4. KHATA MUTATIONS
                    else if (url.includes('/api/khata')) {
                        if (url.includes('/sale')) {
                            // khataService.addSale (creates due transaction)
                            const customerMobile = parsedData.mobile || parsedData.customerMobile;
                            let customer = await offlineDB.getKhataRecordByMobile(parsedData.shopId, customerMobile);
                            const amount = Number(parsedData.amount || 0);
                            
                            if (!customer) {
                                customer = {
                                    _id: 'temp_khata_' + Date.now(),
                                    shop: parsedData.shopId,
                                    customerName: parsedData.customerName,
                                    mobile: customerMobile,
                                    outstandingDue: 0,
                                    transactions: [],
                                    updatedAt: new Date().toISOString()
                                };
                            }
                            customer.outstandingDue += amount;
                            customer.transactions.push({
                                type: 'due',
                                amount: amount,
                                date: new Date().toISOString(),
                                note: parsedData.note || 'New credit entry',
                                paymentMethod: 'Khata'
                            });
                            customer.updatedAt = new Date().toISOString();
                            await offlineDB.saveKhata(customer);
                            mockResponseData.data = customer;
                        } else if (url.includes('/pay')) {
                            // khataService.receivePayment (creates payment transaction)
                            const customerId = url.split('/')[3]; // /api/khata/:id/pay
                            const customer = await offlineDB.getKhataRecord(customerId);
                            if (customer) {
                                const amount = Number(parsedData.amount || 0);
                                customer.outstandingDue = Math.max(0, customer.outstandingDue - amount);
                                customer.transactions.push({
                                    type: 'payment',
                                    amount: amount,
                                    date: new Date().toISOString(),
                                    note: parsedData.note || 'Khata Payment received offline'
                                });
                                customer.updatedAt = new Date().toISOString();
                                await offlineDB.saveKhata(customer);
                                mockResponseData.data = customer;
                            }
                        }
                    }

                    // 5. PURCHASES MUTATIONS
                    else if (url.includes('/api/purchases')) {
                        if (method === 'post') {
                            const newPurchase = {
                                ...parsedData,
                                _id: tempId,
                                purchaseDate: parsedData.purchaseDate || new Date().toISOString(),
                                updatedAt: new Date().toISOString()
                            };

                            // Update stock for purchased products
                            if (parsedData.items && Array.isArray(parsedData.items)) {
                                for (const item of parsedData.items) {
                                    const product = await offlineDB.getProduct(item.product);
                                    if (product) {
                                        const prevStock = product.quantity || 0;
                                        const qtyAdded = Number(item.quantity || 0);
                                        product.quantity = parseFloat((prevStock + qtyAdded).toFixed(3));
                                        if (item.buyPrice) product.buyPrice = Number(item.buyPrice);
                                        product.updatedAt = new Date().toISOString();
                                        await offlineDB.saveProduct(product);

                                        // Log inventory history
                                        await offlineDB.saveInventoryHistory({
                                            _id: 'temp_hist_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
                                            productId: product._id,
                                            productName: product.name,
                                            actionType: 'STOCK_ADDED',
                                            quantity: qtyAdded,
                                            unit: product.unit || 'Piece',
                                            previousStock: prevStock,
                                            newStock: product.quantity,
                                            notes: `Purchased from supplier offline`,
                                            shop: parsedData.shop,
                                            createdAt: new Date().toISOString()
                                        });
                                    }
                                }
                            }

                            await offlineDB.savePurchase(newPurchase);
                            mockResponseData.data = newPurchase;
                        }
                    }

                    // Add to synchronization queue
                    await offlineDB.addMutationToQueue({
                        method,
                        url,
                        data: parsedData,
                        headers: originalRequest.headers
                    });

                    // Trigger Sync check in the background
                    setTimeout(() => {
                        window.dispatchEvent(new CustomEvent('offline-mutation-queued'));
                    }, 50);

                    return Promise.resolve({
                        data: mockResponseData,
                        status: 200,
                        offlineQueued: true
                    });

                } catch (e) {
                    console.error('Offline Mutation Intercept failed', e);
                }
            }
        }
        return Promise.reject(error);
    }
);

export const authService = {
    login: async (data) => {
        try {
            return await api.post('/api/auth/login', data);
        } catch (err) {
            console.error('authService.login failed:', err);
            throw err;
        }
    },
    register: async (data) => {
        try {
            return await api.post('/api/auth/register', data);
        } catch (err) {
            console.error('authService.register failed:', err);
            throw err;
        }
    },
    googleLogin: async (data) => {
        try {
            return await api.post('/api/auth/google', data);
        } catch (err) {
            console.error('authService.googleLogin failed:', err);
            throw err;
        }
    }
};

export const shopService = {
    getAll: async () => {
        try {
            return await api.get('/api/shops');
        } catch (err) {
            console.warn('shopService.getAll failed, using IndexedDB fallback:', err);
            const shops = await offlineDB.getShops();
            return { data: { success: true, data: shops }, status: 200, fromCache: true };
        }
    },
    create: async (data) => {
        try {
            return await api.post('/api/shops', data);
        } catch (err) {
            console.error('shopService.create failed:', err);
            throw err;
        }
    },
    update: async (id, data) => {
        try {
            return await api.put(`/api/shops/${id}`, data);
        } catch (err) {
            console.error('shopService.update failed:', err);
            throw err;
        }
    },
    delete: async (id) => {
        try {
            return await api.delete(`/api/shops/${id}`);
        } catch (err) {
            console.error('shopService.delete failed:', err);
            throw err;
        }
    }
};

export const productService = {
    getAll: async (shopId) => {
        try {
            return await api.get(`/api/products${shopId ? `?shop=${shopId}` : ''}`);
        } catch (err) {
            console.warn('productService.getAll failed, using IndexedDB fallback:', err);
            const products = await offlineDB.getProducts(shopId);
            return { data: { success: true, data: products }, status: 200, fromCache: true };
        }
    },
    create: async (data) => {
        try {
            return await api.post('/api/products', data);
        } catch (err) {
            console.error('productService.create failed:', err);
            throw err;
        }
    },
    update: async (id, data) => {
        try {
            return await api.put(`/api/products/${id}`, data);
        } catch (err) {
            console.error('productService.update failed:', err);
            throw err;
        }
    },
    delete: async (id) => {
        try {
            return await api.delete(`/api/products/${id}`);
        } catch (err) {
            console.error('productService.delete failed:', err);
            throw err;
        }
    },
    getRestockHistory: async (id) => {
        try {
            return await api.get(`/api/products/${id}/restock-history`);
        } catch (err) {
            console.warn('productService.getRestockHistory failed, using IndexedDB fallback:', err);
            const cached = await offlineDB.getQueryCache(`/api/products/${id}/restock-history`);
            return { data: cached || { success: true, data: [] }, status: 200, fromCache: true };
        }
    },
    getInventoryHistory: async (id) => {
        try {
            return await api.get(`/api/products/${id}/inventory-history`);
        } catch (err) {
            console.warn('productService.getInventoryHistory failed, using IndexedDB fallback:', err);
            const history = await offlineDB.getInventoryHistoryByProduct(id);
            return { data: { success: true, data: history }, status: 200, fromCache: true };
        }
    },
    restock: async (id, data) => {
        try {
            return await api.post(`/api/products/${id}/restock`, data);
        } catch (err) {
            console.error('productService.restock failed:', err);
            throw err;
        }
    }
};

export const saleService = {
    getAll: async (shopId) => {
        try {
            return await api.get(`/api/sales${shopId ? `?shop=${shopId}` : ''}`);
        } catch (err) {
            console.warn('saleService.getAll failed, using IndexedDB fallback:', err);
            const sales = await offlineDB.getSales(shopId);
            return { data: { success: true, data: sales }, status: 200, fromCache: true };
        }
    },
    getSale: async (id) => {
        try {
            return await api.get(`/api/sales/${id}`);
        } catch (err) {
            console.warn('saleService.getSale failed, using IndexedDB fallback:', err);
            const sale = await offlineDB.getSale(id);
            return { data: { success: true, data: sale }, status: 200, fromCache: true };
        }
    },
    create: async (data) => {
        try {
            return await api.post('/api/sales', data);
        } catch (err) {
            console.error('saleService.create failed:', err);
            throw err;
        }
    },
    getShopStats: async (shopId) => {
        try {
            return await api.get(`/api/sales/stats${shopId ? `?shop=${shopId}` : ''}`);
        } catch (err) {
            console.warn('saleService.getShopStats failed, using IndexedDB fallback:', err);
            const cached = await offlineDB.getQueryCache(`/api/sales/stats${shopId ? `?shop=${shopId}` : ''}`);
            return { data: cached || { success: true, data: {} }, status: 200, fromCache: true };
        }
    },
    getReports: async (shopId) => {
        try {
            return await api.get(`/api/sales/reports${shopId ? `?shop=${shopId}` : ''}`);
        } catch (err) {
            console.warn('saleService.getReports failed, using IndexedDB fallback:', err);
            const cached = await offlineDB.getQueryCache(`/api/sales/reports${shopId ? `?shop=${shopId}` : ''}`);
            return { data: cached || { success: true, data: {} }, status: 200, fromCache: true };
        }
    },
    getHistory: async (range, shopId) => {
        try {
            return await api.get(`/api/sales/history?range=${range}${shopId ? `&shop=${shopId}` : ''}`);
        } catch (err) {
            console.warn('saleService.getHistory failed, using IndexedDB fallback:', err);
            const cached = await offlineDB.getQueryCache(`/api/sales/history?range=${range}${shopId ? `&shop=${shopId}` : ''}`);
            return { data: cached || { success: true, data: [] }, status: 200, fromCache: true };
        }
    },
    getSummaries: async (shopId) => {
        try {
            return await api.get(`/api/sales/summaries${shopId ? `?shop=${shopId}` : ''}`);
        } catch (err) {
            console.warn('saleService.getSummaries failed, using IndexedDB fallback:', err);
            const cached = await offlineDB.getQueryCache(`/api/sales/summaries${shopId ? `?shop=${shopId}` : ''}`);
            return { data: cached || { success: true, data: [] }, status: 200, fromCache: true };
        }
    },
    processReturn: async (id, data) => {
        try {
            return await api.post(`/api/sales/${id}/return`, data);
        } catch (err) {
            console.error('saleService.processReturn failed:', err);
            throw err;
        }
    },
    processExchange: async (id, data) => {
        try {
            return await api.post(`/api/sales/${id}/exchange`, data);
        } catch (err) {
            console.error('saleService.processExchange failed:', err);
            throw err;
        }
    }
};

export const khataService = {
    getCustomers: async (shopId) => {
        try {
            return await api.get(`/api/khata?shopId=${shopId}`);
        } catch (err) {
            console.warn('khataService.getCustomers failed, using IndexedDB fallback:', err);
            const customers = await offlineDB.getKhata(shopId);
            return { data: { success: true, data: customers }, status: 200, fromCache: true };
        }
    },
    getDetails: async (id) => {
        try {
            return await api.get(`/api/khata/${id}`);
        } catch (err) {
            console.warn('khataService.getDetails failed, using IndexedDB fallback:', err);
            const customer = await offlineDB.getKhataRecord(id);
            return { data: { success: true, data: customer }, status: 200, fromCache: true };
        }
    },
    receivePayment: async (id, amount, note) => {
        try {
            return await api.post(`/api/khata/${id}/pay`, { amount, note });
        } catch (err) {
            console.error('khataService.receivePayment failed:', err);
            throw err;
        }
    },
    addSale: async (shopId, customerName, mobile, amount, note) => {
        try {
            return await api.post('/api/khata/sale', { shopId, customerName, mobile, amount, note });
        } catch (err) {
            console.error('khataService.addSale failed:', err);
            throw err;
        }
    }
};

export const purchaseService = {
    getAll: async (shopId) => {
        try {
            return await api.get(`/api/purchases${shopId ? `?shop=${shopId}` : ''}`);
        } catch (err) {
            console.warn('purchaseService.getAll failed, using IndexedDB fallback:', err);
            const purchases = await offlineDB.getPurchases(shopId);
            return { data: { success: true, data: purchases }, status: 200, fromCache: true };
        }
    },
    getPurchase: async (id) => {
        try {
            return await api.get(`/api/purchases/${id}`);
        } catch (err) {
            console.warn('purchaseService.getPurchase failed, using IndexedDB fallback:', err);
            const purchase = await offlineDB.getPurchase(id);
            return { data: { success: true, data: purchase }, status: 200, fromCache: true };
        }
    },
    create: async (data) => {
        try {
            return await api.post('/api/purchases', data);
        } catch (err) {
            console.error('purchaseService.create failed:', err);
            throw err;
        }
    },
    addPayment: async (id, paymentData) => {
        try {
            return await api.post(`/api/purchases/${id}/payment`, paymentData);
        } catch (err) {
            console.error('purchaseService.addPayment failed:', err);
            throw err;
        }
    }
};

export const govSaleService = {
    getAll: async (shopId) => {
        try {
            return await api.get(`/api/gov-sales${shopId ? `?shop=${shopId}` : ''}`);
        } catch (err) {
            console.warn('govSaleService.getAll failed, using IndexedDB fallback:', err);
            const govSales = await offlineDB.getGovSales(shopId);
            return { data: { success: true, data: govSales }, status: 200, fromCache: true };
        }
    },
    getSale: async (id) => {
        try {
            return await api.get(`/api/gov-sales/${id}`);
        } catch (err) {
            console.warn('govSaleService.getSale failed, using IndexedDB fallback:', err);
            const govSale = await offlineDB.getGovSale(id);
            return { data: { success: true, data: govSale }, status: 200, fromCache: true };
        }
    },
    getStats: async (shopId) => {
        try {
            return await api.get(`/api/gov-sales/stats${shopId ? `?shop=${shopId}` : ''}`);
        } catch (err) {
            console.warn('govSaleService.getStats failed, using IndexedDB fallback:', err);
            const cached = await offlineDB.getQueryCache(`/api/gov-sales/stats${shopId ? `?shop=${shopId}` : ''}`);
            return { data: cached || { success: true, data: {} }, status: 200, fromCache: true };
        }
    }
};

export default api;
