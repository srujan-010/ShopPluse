import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { offlineDB, db } from '../services/offlineDB';
import api from '../services/api';

const SyncContext = createContext();

export const useSync = () => useContext(SyncContext);

export const SyncProvider = ({ children }) => {
    const [isOnline, setIsOnline] = useState(navigator.onLine);
    const [pendingCount, setPendingCount] = useState(0);
    const [isSyncing, setIsSyncing] = useState(false);
    const isSyncingRef = useRef(false);

    const checkPendingCount = useCallback(async () => {
        try {
            const queue = await offlineDB.getMutationQueue();
            setPendingCount(queue.length);
        } catch (error) {
            console.error('Error checking pending count', error);
        }
    }, []);

    // Remap temporary offline IDs in IndexedDB and subsequent mutations
    const remapIds = useCallback(async (tempId, realId) => {
        try {
            // 1. Update mutation queue
            const queue = await offlineDB.getMutationQueue();
            for (const item of queue) {
                let itemStr = JSON.stringify(item);
                if (itemStr.includes(tempId)) {
                    itemStr = itemStr.split(tempId).join(realId);
                    const updatedItem = JSON.parse(itemStr);
                    await db.mutationQueue.put(updatedItem);
                }
            }

            // 2. Update local database tables
            // Products
            const product = await db.products.get(tempId);
            if (product) {
                await db.products.delete(tempId);
                product._id = realId;
                await db.products.put(product);
            }

            // Inventory History
            const histories = await db.inventoryHistory.where('productId').equals(tempId).toArray();
            for (const hist of histories) {
                await db.inventoryHistory.delete(hist._id);
                hist.productId = realId;
                if (hist._id.startsWith('temp_')) {
                    hist._id = hist._id.replace(tempId, realId) + '_' + Math.random().toString(36).substr(2, 5);
                }
                await db.inventoryHistory.put(hist);
            }

            // Sales
            const sales = await db.sales.toArray();
            for (const sale of sales) {
                let changed = false;
                if (sale.items) {
                    sale.items = sale.items.map(item => {
                        if (item.product === tempId) {
                            item.product = realId;
                            changed = true;
                        }
                        return item;
                    });
                }
                if (sale._id === tempId) {
                    await db.sales.delete(tempId);
                    sale._id = realId;
                    changed = true;
                }
                if (changed) {
                    await db.sales.put(sale);
                }
            }

            // Khata
            const customers = await db.khata.toArray();
            for (const cust of customers) {
                let changed = false;
                if (cust.transactions) {
                    cust.transactions = cust.transactions.map(t => {
                        if (t.saleId === tempId) {
                            t.saleId = realId;
                            changed = true;
                        }
                        return t;
                    });
                }
                if (cust._id === tempId) {
                    await db.khata.delete(tempId);
                    cust._id = realId;
                    changed = true;
                }
                if (changed) {
                    await db.khata.put(cust);
                }
            }

            // Purchases
            const purchases = await db.purchases.toArray();
            for (const pur of purchases) {
                let changed = false;
                if (pur.items) {
                    pur.items = pur.items.map(item => {
                        if (item.product === tempId) {
                            item.product = realId;
                            changed = true;
                        }
                        return item;
                    });
                }
                if (pur._id === tempId) {
                    await db.purchases.delete(tempId);
                    pur._id = realId;
                    changed = true;
                }
                if (changed) {
                    await db.purchases.put(pur);
                }
            }
        } catch (e) {
            console.error('Error remapping offline IDs:', e);
        }
    }, []);

    // Pull the latest data from server and perform conflict-aware bulk sync
    const syncAllCollections = useCallback(async () => {
        try {
            // Check if authenticated
            const token = localStorage.getItem('token');
            if (!token) return;

            // 1. Sync shops first to cache shop metadata
            const shopsRes = await api.get('/api/shops');
            const serverShops = shopsRes.data?.data || [];
            const shopsArray = Array.isArray(serverShops) ? serverShops : [serverShops];
            
            for (const shop of shopsArray) {
                const localShop = await db.shops.get(shop._id);
                if (!localShop || !localShop.updatedAt || new Date(shop.updatedAt) > new Date(localShop.updatedAt)) {
                    await db.shops.put(shop);
                }
            }

            // Sync global stats for business dashboard
            api.get('/api/sales/stats').catch(() => {});

            // 2. Determine target shops to sync (the one in url path if present, otherwise all user shops)
            const urlShopId = window.location.pathname.match(/\/shop\/([^/]+)/)?.[1];
            const targetShops = urlShopId ? shopsArray.filter(s => s._id === urlShopId) : shopsArray;

            // 3. Helper to merge a server collection with local IndexedDB using updatedAt timestamp
            const mergeCollection = async (localTable, fetchPromise) => {
                try {
                    const res = await fetchPromise;
                    const serverItems = res.data?.data || res.data || [];
                    const serverArray = Array.isArray(serverItems) ? serverItems : [serverItems];
                    
                    for (const serverItem of serverArray) {
                        const localItem = await localTable.get(serverItem._id);
                        // Timestamp-based conflict handling
                        if (!localItem || !localItem.updatedAt || new Date(serverItem.updatedAt) > new Date(localItem.updatedAt)) {
                            await localTable.put(serverItem);
                        }
                    }
                } catch (err) {
                    console.error(`Failed to sync collection ${localTable.name}:`, err);
                }
            };

            // 4. Concurrently sync target shops
            const syncPromises = targetShops.map(async (shop) => {
                const shopId = shop._id;
                await Promise.all([
                    mergeCollection(db.products, api.get(`/api/products?shop=${shopId}`)),
                    mergeCollection(db.sales, api.get(`/api/sales?shop=${shopId}`)),
                    mergeCollection(db.khata, api.get(`/api/khata?shopId=${shopId}`)),
                    mergeCollection(db.purchases, api.get(`/api/purchases?shop=${shopId}`)),
                    mergeCollection(db.governmentSales, api.get(`/api/gov-sales?shop=${shopId}`)),
                    api.get(`/api/sales/stats?shop=${shopId}`).catch(() => {}),
                    api.get(`/api/sales/reports?shop=${shopId}`).catch(() => {}),
                    api.get(`/api/sales/summaries?shop=${shopId}`).catch(() => {}),
                    api.get(`/api/sales/history?range=monthly&shop=${shopId}`).catch(() => {}),
                    api.get(`/api/sales/history?range=today&shop=${shopId}`).catch(() => {}),
                    api.get(`/api/sales/history?range=weekly&shop=${shopId}`).catch(() => {}),
                    api.get(`/api/sales/history?range=yearly&shop=${shopId}`).catch(() => {}),
                    api.get(`/api/gov-sales/stats?shop=${shopId}`).catch(() => {})
                ]);
            });

            await Promise.all(syncPromises);

            // 5. If we synced a specific shop, trigger background sync for the other shops to cache their data as well
            if (urlShopId && shopsArray.length > 1) {
                const otherShops = shopsArray.filter(s => s._id !== urlShopId);
                setTimeout(async () => {
                    for (const shop of otherShops) {
                        const shopId = shop._id;
                        await Promise.all([
                            mergeCollection(db.products, api.get(`/api/products?shop=${shopId}`)).catch(() => {}),
                            mergeCollection(db.sales, api.get(`/api/sales?shop=${shopId}`)).catch(() => {}),
                            mergeCollection(db.khata, api.get(`/api/khata?shopId=${shopId}`)).catch(() => {}),
                            mergeCollection(db.purchases, api.get(`/api/purchases?shop=${shopId}`)).catch(() => {}),
                            mergeCollection(db.governmentSales, api.get(`/api/gov-sales?shop=${shopId}`)).catch(() => {}),
                            api.get(`/api/sales/stats?shop=${shopId}`).catch(() => {}),
                            api.get(`/api/sales/reports?shop=${shopId}`).catch(() => {}),
                            api.get(`/api/sales/summaries?shop=${shopId}`).catch(() => {}),
                            api.get(`/api/sales/history?range=monthly&shop=${shopId}`).catch(() => {}),
                            api.get(`/api/sales/history?range=today&shop=${shopId}`).catch(() => {}),
                            api.get(`/api/sales/history?range=weekly&shop=${shopId}`).catch(() => {}),
                            api.get(`/api/sales/history?range=yearly&shop=${shopId}`).catch(() => {}),
                            api.get(`/api/gov-sales/stats?shop=${shopId}`).catch(() => {})
                        ]);
                    }
                }, 2000); // 2-second delay to prioritize active shop load
            }
        } catch (e) {
            console.error('Collection background sync failed:', e);
        }
    }, []);

    const flushQueue = useCallback(async () => {
        if (isSyncingRef.current || !navigator.onLine) return;
        
        isSyncingRef.current = true;
        setIsSyncing(true);
        try {
            const queue = await offlineDB.getMutationQueue();
            if (queue.length === 0) {
                isSyncingRef.current = false;
                setIsSyncing(false);
                return;
            }

            for (const item of queue) {
                try {
                    const res = await api({
                        method: item.method,
                        url: item.url,
                        data: item.data,
                        headers: item.headers
                    });

                    // Remove from queue on success
                    await offlineDB.removeMutationFromQueue(item.id);

                    // If it was a POST that created a new item, map temporary ID to real MongoDB ID
                    if (item.method.toLowerCase() === 'post' && res.data && res.data.data) {
                        const serverRecord = res.data.data;
                        
                        let tempId = null;
                        if (item.url.includes('/api/products') && item.method.toLowerCase() === 'post') {
                            const products = await db.products.toArray();
                            const found = products.find(p => p.name === item.data?.name && p._id.startsWith('temp_'));
                            if (found) tempId = found._id;
                        } else if (item.url.includes('/api/sales') && item.method.toLowerCase() === 'post') {
                            const sales = await db.sales.toArray();
                            const found = sales.find(s => s.invoiceNumber === item.data?.invoiceNumber && s._id.startsWith('temp_'));
                            if (found) tempId = found._id;
                        }

                        if (tempId && serverRecord._id) {
                            await remapIds(tempId, serverRecord._id);
                        }
                    }
                } catch (error) {
                    console.error('Failed to sync item:', item, error);
                    // Network disconnect: stop sync loop and retry later
                    if (!error.response) {
                        break; 
                    }
                    // For client-side logic errors (400-499), drop mutation to prevent queue blockage
                    if (error.response && error.response.status >= 400 && error.response.status < 500) {
                        await offlineDB.removeMutationFromQueue(item.id);
                    }
                }
            }

            // Sync down fresh server collections
            await syncAllCollections();

        } catch (error) {
            console.error('Error flushing queue:', error);
        } finally {
            await checkPendingCount();
            isSyncingRef.current = false;
            setIsSyncing(false);
        }
    }, [checkPendingCount, remapIds, syncAllCollections]);

    useEffect(() => {
        const handleOnline = () => {
            setIsOnline(true);
            // Register for PWA Background Sync when online
            if ('serviceWorker' in navigator && 'SyncManager' in window) {
                navigator.serviceWorker.ready.then((reg) => {
                    reg.sync.register('sync-mutations').catch(e => console.error('BG Sync registration failed', e));
                });
            }
        };
        const handleOffline = () => setIsOnline(false);

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);
        
        // Listen for new mutations queued offline to trigger instant count check
        const handleMutationQueued = () => {
            checkPendingCount();
        };
        window.addEventListener('offline-mutation-queued', handleMutationQueued);

        // Listen for message events from service worker background sync
        const handleServiceWorkerMessage = (event) => {
            if (event.data && event.data.type === 'SYNC_MUTATIONS') {
                flushQueue();
            }
        };
        navigator.serviceWorker?.addEventListener('message', handleServiceWorkerMessage);

        checkPendingCount();

        // Automatic retry loop: Polling sync retry every 30 seconds
        const interval = setInterval(() => {
            checkPendingCount();
            if (navigator.onLine) {
                flushQueue();
                syncAllCollections();
            }
        }, 30000);

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
            window.removeEventListener('offline-mutation-queued', handleMutationQueued);
            navigator.serviceWorker?.removeEventListener('message', handleServiceWorkerMessage);
            clearInterval(interval);
        };
    }, [checkPendingCount, flushQueue, syncAllCollections]);

    useEffect(() => {
        if (isOnline) {
            flushQueue();
            syncAllCollections();
        }
    }, [isOnline, flushQueue, syncAllCollections]);

    const triggerSync = useCallback(async () => {
        await checkPendingCount();
        if (isOnline) {
            await flushQueue();
            await syncAllCollections();
        }
    }, [isOnline, checkPendingCount, flushQueue, syncAllCollections]);

    return (
        <SyncContext.Provider value={{ isOnline, pendingCount, isSyncing, triggerSync, syncAllCollections }}>
            {children}
        </SyncContext.Provider>
    );
};
