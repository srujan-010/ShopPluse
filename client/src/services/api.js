import axios from 'axios';
import { offlineDB } from './offlineDB';

// Create axios instance with base URL as empty so we can use full relative paths
const api = axios.create({
    baseURL: '', 
    headers: {
        'Content-Type': 'application/json'
    }
});

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
                // Background Sync: Save products to products store for offline ERP mode
                if (response.config.url.includes('/api/products') && response.data && response.data.data && Array.isArray(response.data.data)) {
                    await offlineDB.saveProductsBulk(response.data.data);
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

        // Check if offline / network error
        if (!error.response && originalRequest) {
            if (originalRequest.method === 'get') {
                try {
                    // Try to load products from dedicated DB if offline
                    if (originalRequest.url.includes('/api/products')) {
                        const shopIdMatch = originalRequest.url.match(/shop=([^&]+)/);
                        const shopId = shopIdMatch ? shopIdMatch[1] : null;
                        const products = await offlineDB.getProducts(shopId);
                        if (products && products.length > 0) {
                            return Promise.resolve({ data: { success: true, data: products }, status: 200, fromCache: true });
                        }
                    }

                    // Fallback to generic cache
                    const cachedData = await offlineDB.getQueryCache(originalRequest.url);
                    if (cachedData) {
                        return Promise.resolve({ data: cachedData, status: 200, fromCache: true });
                    }
                } catch(e) { console.error('Cache read failed', e); }
            } else {
                // Queue mutations (POST, PUT, DELETE)
                try {
                    let parsedData = originalRequest.data;
                    if (typeof originalRequest.data === 'string') {
                        parsedData = JSON.parse(originalRequest.data);
                    }
                    
                    // Offline ERP Product Actions
                    if (originalRequest.url.includes('/api/products')) {
                        if (originalRequest.method === 'post') {
                            const newProduct = { ...parsedData, _id: 'temp_' + Date.now() };
                            await offlineDB.saveProduct(newProduct);
                        } else if (originalRequest.method === 'put') {
                            const id = originalRequest.url.split('/').pop();
                            const updatedProduct = { ...parsedData, _id: id };
                            await offlineDB.saveProduct(updatedProduct);
                        } else if (originalRequest.method === 'delete') {
                            const id = originalRequest.url.split('/').pop();
                            await offlineDB.deleteProduct(id);
                        }
                    }

                    await offlineDB.addMutationToQueue({
                        method: originalRequest.method,
                        url: originalRequest.url,
                        data: parsedData,
                        headers: { ...originalRequest.headers }
                    });
                    
                    // Return mock success
                    return Promise.resolve({ 
                        data: { success: true, message: 'Saved offline. Will sync when online.', data: [] }, 
                        status: 200, 
                        offlineQueued: true 
                    });
                } catch(e) {
                    console.error('Queueing failed', e);
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

export default api;
