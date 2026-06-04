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
    return config;
});

// Handle errors and offline caching globally
api.interceptors.response.use(
    async (response) => {
        // Cache successful GET requests
        if (response.config.method === 'get') {
            try {
                await offlineDB.saveQueryCache(response.config.url, response.data);
                
                // Cache dedicated entities
                if (response.config.url.includes('/api/products') && response.data && response.data.data) {
                    const data = Array.isArray(response.data.data) ? response.data.data : [response.data.data];
                    await offlineDB.saveProductsBulk(data);
                }
                if (response.config.url.includes('/api/sales') && response.data && response.data.data) {
                    const data = Array.isArray(response.data.data) ? response.data.data : [response.data.data];
                    await offlineDB.saveSalesBulk(data);
                }
                if (response.config.url.includes('/api/khata') && response.data && response.data.data) {
                    const data = Array.isArray(response.data.data) ? response.data.data : [response.data.data];
                    await offlineDB.saveKhataBulk(data);
                }
                if (response.config.url.includes('/api/gov-sales') && response.data && response.data.data) {
                    const data = Array.isArray(response.data.data) ? response.data.data : [response.data.data];
                    await offlineDB.saveGovSalesBulk(data);
                }
                if (response.config.url.includes('/api/purchases') && response.data && response.data.data) {
                    const data = Array.isArray(response.data.data) ? response.data.data : [response.data.data];
                    await offlineDB.savePurchasesBulk(data);
                }
                if (response.config.url.includes('/api/shops') && response.data && response.data.data) {
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

        // Check if offline or network error
        if (!error.response && originalRequest) {
            const url = originalRequest.url;
            const method = originalRequest.method;

            // Handle GET offline fallback
            if (method === 'get') {
                try {
                    if (url.includes('/api/products')) {
                        const shopIdMatch = url.match(/shop=([^&]+)/);
                        const shopId = shopIdMatch ? shopIdMatch[1] : null;
                        const products = await offlineDB.getProducts(shopId);
                        if (products && products.length > 0) {
                            return Promise.resolve({ data: { success: true, data: products }, status: 200, fromCache: true });
                        }
                    }
                    if (url.includes('/api/sales')) {
                        const shopIdMatch = url.match(/shop=([^&]+)/);
                        const shopId = shopIdMatch ? shopIdMatch[1] : null;
                        const sales = await offlineDB.getSales(shopId);
                        if (sales && sales.length > 0) {
                            return Promise.resolve({ data: { success: true, data: sales }, status: 200, fromCache: true });
                        }
                    }
                    if (url.includes('/api/khata')) {
                        const shopIdMatch = url.match(/shopId=([^&]+)/);
                        const shopId = shopIdMatch ? shopIdMatch[1] : null;
                        const customers = await offlineDB.getKhata(shopId);
                        if (customers && customers.length > 0) {
                            return Promise.resolve({ data: { success: true, data: customers }, status: 200, fromCache: true });
                        }
                    }
                    if (url.includes('/api/gov-sales')) {
                        const shopIdMatch = url.match(/shop=([^&]+)/);
                        const shopId = shopIdMatch ? shopIdMatch[1] : null;
                        const govSales = await offlineDB.getGovSales(shopId);
                        if (govSales && govSales.length > 0) {
                            return Promise.resolve({ data: { success: true, data: govSales }, status: 200, fromCache: true });
                        }
                    }
                    if (url.includes('/api/purchases')) {
                        const shopIdMatch = url.match(/shop=([^&]+)/);
                        const shopId = shopIdMatch ? shopIdMatch[1] : null;
                        const purchases = await offlineDB.getPurchases(shopId);
                        if (purchases && purchases.length > 0) {
                            return Promise.resolve({ data: { success: true, data: purchases }, status: 200, fromCache: true });
                        }
                    }
                    if (url.includes('/api/shops')) {
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
    login: (data) => api.post('/api/auth/login', data),
    register: (data) => api.post('/api/auth/register', data),
    googleLogin: (data) => api.post('/api/auth/google', data)
};

export const shopService = {
    getAll: () => api.get('/api/shops'),
    create: (data) => api.post('/api/shops', data),
    update: (id, data) => api.put(`/api/shops/${id}`, data),
    delete: (id) => api.delete(`/api/shops/${id}`)
};

export const productService = {
    getAll: (shopId) => api.get(`/api/products${shopId ? `?shop=${shopId}` : ''}`),
    create: (data) => api.post('/api/products', data),
    update: (id, data) => api.put(`/api/products/${id}`, data),
    delete: (id) => api.delete(`/api/products/${id}`),
    getRestockHistory: (id) => api.get(`/api/products/${id}/restock-history`),
    getInventoryHistory: (id) => api.get(`/api/products/${id}/inventory-history`),
    restock: (id, data) => api.post(`/api/products/${id}/restock`, data)
};

export const saleService = {
    getAll: (shopId) => api.get(`/api/sales${shopId ? `?shop=${shopId}` : ''}`),
    getSale: (id) => api.get(`/api/sales/${id}`),
    create: (data) => api.post('/api/sales', data),
    getShopStats: (shopId) => api.get(`/api/sales/stats${shopId ? `?shop=${shopId}` : ''}`),
    getReports: (shopId) => api.get(`/api/sales/reports${shopId ? `?shop=${shopId}` : ''}`),
    getHistory: (range, shopId) => api.get(`/api/sales/history?range=${range}${shopId ? `&shop=${shopId}` : ''}`),
    getSummaries: (shopId) => api.get(`/api/sales/summaries${shopId ? `?shop=${shopId}` : ''}`)
};

export const khataService = {
    getCustomers: (shopId) => api.get(`/api/khata?shopId=${shopId}`),
    getDetails: (id) => api.get(`/api/khata/${id}`),
    receivePayment: (id, amount, note) => api.post(`/api/khata/${id}/pay`, { amount, note }),
    addSale: (shopId, customerName, mobile, amount, note) => api.post('/api/khata/sale', { shopId, customerName, mobile, amount, note })
};

export const purchaseService = {
    getAll: (shopId) => api.get(`/api/purchases${shopId ? `?shop=${shopId}` : ''}`),
    getPurchase: (id) => api.get(`/api/purchases/${id}`),
    create: (data) => api.post('/api/purchases', data),
    addPayment: (id, paymentData) => api.post(`/api/purchases/${id}/payment`, paymentData)
};

export const govSaleService = {
    getAll: (shopId) => api.get(`/api/gov-sales${shopId ? `?shop=${shopId}` : ''}`),
    getSale: (id) => api.get(`/api/gov-sales/${id}`),
    getStats: (shopId) => api.get(`/api/gov-sales/stats${shopId ? `?shop=${shopId}` : ''}`)
};

export default api;
