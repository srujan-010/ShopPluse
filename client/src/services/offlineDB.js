const DB_NAME = 'ShopPulseOfflineDB';
const DB_VERSION = 2;

const STORES = {
  QUERY_CACHE: 'queryCache',
  MUTATION_QUEUE: 'mutationQueue',
  PRODUCTS: 'products'
};

const openDB = () => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORES.QUERY_CACHE)) {
        db.createObjectStore(STORES.QUERY_CACHE, { keyPath: 'url' });
      }
      if (!db.objectStoreNames.contains(STORES.MUTATION_QUEUE)) {
        db.createObjectStore(STORES.MUTATION_QUEUE, { keyPath: 'id', autoIncrement: true });
      }
      if (!db.objectStoreNames.contains(STORES.PRODUCTS)) {
        db.createObjectStore(STORES.PRODUCTS, { keyPath: '_id' });
      }
    };

    request.onsuccess = (event) => resolve(event.target.result);
    request.onerror = (event) => reject(event.target.error);
  });
};

export const offlineDB = {
  async saveQueryCache(url, data) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.QUERY_CACHE, 'readwrite');
      const store = tx.objectStore(STORES.QUERY_CACHE);
      const request = store.put({ url, data, timestamp: Date.now() });
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  },

  async getQueryCache(url) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.QUERY_CACHE, 'readonly');
      const store = tx.objectStore(STORES.QUERY_CACHE);
      const request = store.get(url);
      request.onsuccess = () => resolve(request.result?.data || null);
      request.onerror = () => reject(request.error);
    });
  },

  async addMutationToQueue(requestConfig) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.MUTATION_QUEUE, 'readwrite');
      const store = tx.objectStore(STORES.MUTATION_QUEUE);
      // Ensure we only store serializable data
      const { method, url, data, headers } = requestConfig;
      const request = store.add({ 
        method, 
        url, 
        data: data ? JSON.parse(JSON.stringify(data)) : null, 
        headers, 
        timestamp: Date.now() 
      });
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  },

  async getMutationQueue() {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.MUTATION_QUEUE, 'readonly');
      const store = tx.objectStore(STORES.MUTATION_QUEUE);
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  },

  async removeMutationFromQueue(id) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.MUTATION_QUEUE, 'readwrite');
      const store = tx.objectStore(STORES.MUTATION_QUEUE);
      const request = store.delete(id);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  },

  async clearMutationQueue() {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.MUTATION_QUEUE, 'readwrite');
      const store = tx.objectStore(STORES.MUTATION_QUEUE);
      const request = store.clear();
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  },

  // --- PRODUCTS OFFLINE STORE ---

  async saveProductsBulk(products) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.PRODUCTS, 'readwrite');
      const store = tx.objectStore(STORES.PRODUCTS);
      // We don't clear, we upsert so we don't lose local offline edits that haven't synced
      products.forEach(p => store.put(p));
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  },

  async saveProduct(product) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.PRODUCTS, 'readwrite');
      const store = tx.objectStore(STORES.PRODUCTS);
      const request = store.put(product);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  },

  async deleteProduct(id) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.PRODUCTS, 'readwrite');
      const store = tx.objectStore(STORES.PRODUCTS);
      const request = store.delete(id);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  },

  async getProducts(shopId) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.PRODUCTS, 'readonly');
      const store = tx.objectStore(STORES.PRODUCTS);
      const request = store.getAll();
      request.onsuccess = () => {
        const all = request.result || [];
        if (shopId) {
          resolve(all.filter(p => p.shop === shopId));
        } else {
          resolve(all);
        }
      };
      request.onerror = () => reject(request.error);
    });
  }
};
