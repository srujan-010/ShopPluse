import Dexie from 'dexie';

export const db = new Dexie('ShopPulseOfflineDB');

// Define database schema
db.version(3).stores({
  queryCache: 'url, timestamp',
  mutationQueue: '++id, timestamp',
  products: '_id, shop, updatedAt',
  sales: '_id, shop, date, updatedAt',
  khata: '_id, shop, mobile, updatedAt',
  governmentSales: '_id, shop, date, updatedAt',
  purchases: '_id, shop, purchaseDate, updatedAt',
  inventoryHistory: '_id, shop, productId, createdAt, updatedAt',
  shops: '_id, owner'
});

export const offlineDB = {
  // --- QUERY CACHE ---
  async saveQueryCache(url, data) {
    try {
      await db.queryCache.put({ url, data, timestamp: Date.now() });
    } catch (e) {
      console.error('Dexie saveQueryCache error:', e);
    }
  },
  async getQueryCache(url) {
    try {
      const cached = await db.queryCache.get(url);
      return cached ? cached.data : null;
    } catch (e) {
      console.error('Dexie getQueryCache error:', e);
      return null;
    }
  },
  async deleteQueryCache(url) {
    try {
      await db.queryCache.delete(url);
    } catch (e) {
      console.error('Dexie deleteQueryCache error:', e);
    }
  },

  // --- MUTATION QUEUE ---
  async addMutationToQueue(requestConfig) {
    try {
      const { method, url, data, headers } = requestConfig;
      await db.mutationQueue.add({
        method,
        url,
        data: data ? JSON.parse(JSON.stringify(data)) : null,
        headers: headers ? JSON.parse(JSON.stringify(headers)) : null,
        timestamp: Date.now()
      });
    } catch (e) {
      console.error('Dexie addMutationToQueue error:', e);
    }
  },
  async getMutationQueue() {
    try {
      return await db.mutationQueue.toArray();
    } catch (e) {
      console.error('Dexie getMutationQueue error:', e);
      return [];
    }
  },
  async removeMutationFromQueue(id) {
    try {
      await db.mutationQueue.delete(id);
    } catch (e) {
      console.error('Dexie removeMutationFromQueue error:', e);
    }
  },
  async clearMutationQueue() {
    try {
      await db.mutationQueue.clear();
    } catch (e) {
      console.error('Dexie clearMutationQueue error:', e);
    }
  },

  // --- HELPER TO NORMALIZE OBJECT/STRING SHOP ID ---
  _normalizeItem(item) {
    if (!item || typeof item !== 'object') return item;
    const clone = { ...item };
    if (clone.shop && typeof clone.shop === 'object' && clone.shop._id) {
      clone.shopDetails = clone.shop;
      clone.shop = clone.shop._id.toString();
    } else if (clone.shop) {
      clone.shop = clone.shop.toString();
    }
    if (!clone.updatedAt) {
      clone.updatedAt = clone.date || clone.createdAt || new Date().toISOString();
    }
    return clone;
  },

  // --- PRODUCTS ---
  async saveProductsBulk(products) {
    try {
      if (!Array.isArray(products)) return;
      const normalized = products.filter(Boolean).map(p => this._normalizeItem(p));
      await db.products.bulkPut(normalized);
    } catch (e) {
      console.error('Dexie saveProductsBulk error:', e);
    }
  },
  async saveProduct(product) {
    try {
      if (!product) return;
      await db.products.put(this._normalizeItem(product));
    } catch (e) {
      console.error('Dexie saveProduct error:', e);
    }
  },
  async deleteProduct(id) {
    try {
      await db.products.delete(id);
    } catch (e) {
      console.error('Dexie deleteProduct error:', e);
    }
  },
  async getProducts(shopId) {
    try {
      const all = await db.products.toArray();
      if (!shopId) return all;
      return all.filter(p => {
        const pShop = (p.shop && typeof p.shop === 'object') ? p.shop._id?.toString() : String(p.shop || '');
        return pShop === String(shopId);
      });
    } catch (e) {
      console.error('Dexie getProducts error:', e);
      return [];
    }
  },
  async getProduct(id) {
    try {
      return await db.products.get(id);
    } catch (e) {
      console.error('Dexie getProduct error:', e);
      return null;
    }
  },

  // --- SALES ---
  async saveSalesBulk(sales) {
    try {
      if (!Array.isArray(sales)) return;
      const normalized = sales.filter(Boolean).map(s => this._normalizeItem(s));
      await db.sales.bulkPut(normalized);
    } catch (e) {
      console.error('Dexie saveSalesBulk error:', e);
    }
  },
  async saveSale(sale) {
    try {
      if (!sale) return;
      await db.sales.put(this._normalizeItem(sale));
    } catch (e) {
      console.error('Dexie saveSale error:', e);
    }
  },
  async getSales(shopId) {
    try {
      const allSales = await db.sales.toArray();
      if (!shopId) return allSales;
      return allSales.filter(s => {
        const sShop = (s.shop && typeof s.shop === 'object') ? s.shop._id?.toString() : String(s.shop || '');
        return sShop === String(shopId);
      });
    } catch (e) {
      console.error('Dexie getSales error:', e);
      return [];
    }
  },
  async getSale(id) {
    try {
      return await db.sales.get(id);
    } catch (e) {
      console.error('Dexie getSale error:', e);
      return null;
    }
  },

  // --- KHATA (CUSTOMERS & LEDGER) ---
  async saveKhataBulk(customers) {
    try {
      await db.khata.bulkPut(customers);
    } catch (e) {
      console.error('Dexie saveKhataBulk error:', e);
    }
  },
  async saveKhata(customer) {
    try {
      await db.khata.put(customer);
    } catch (e) {
      console.error('Dexie saveKhata error:', e);
    }
  },
  async getKhata(shopId) {
    try {
      if (shopId) {
        return await db.khata.where('shop').equals(shopId).toArray();
      }
      return await db.khata.toArray();
    } catch (e) {
      console.error('Dexie getKhata error:', e);
      return [];
    }
  },
  async getKhataRecord(id) {
    try {
      return await db.khata.get(id);
    } catch (e) {
      console.error('Dexie getKhataRecord error:', e);
      return null;
    }
  },
  async getKhataRecordByMobile(shopId, mobile) {
    try {
      if (shopId) {
        return await db.khata.where({ shop: shopId, mobile: mobile }).first();
      }
      return await db.khata.where('mobile').equals(mobile).first();
    } catch (e) {
      console.error('Dexie getKhataRecordByMobile error:', e);
      return null;
    }
  },

  // --- GOVERNMENT SALES ---
  async saveGovSalesBulk(govSales) {
    try {
      if (!Array.isArray(govSales)) return;
      const normalized = govSales.filter(Boolean).map(s => this._normalizeItem(s));
      await db.governmentSales.bulkPut(normalized);
    } catch (e) {
      console.error('Dexie saveGovSalesBulk error:', e);
    }
  },
  async saveGovSale(govSale) {
    try {
      if (!govSale) return;
      await db.governmentSales.put(this._normalizeItem(govSale));
    } catch (e) {
      console.error('Dexie saveGovSale error:', e);
    }
  },
  async getGovSales(shopId) {
    try {
      const allGovSales = await db.governmentSales.toArray();
      if (!shopId) return allGovSales;
      return allGovSales.filter(s => {
        const sShop = (s.shop && typeof s.shop === 'object') ? s.shop._id?.toString() : String(s.shop || '');
        return sShop === String(shopId);
      });
    } catch (e) {
      console.error('Dexie getGovSales error:', e);
      return [];
    }
  },
  async getGovSale(id) {
    try {
      return await db.governmentSales.get(id);
    } catch (e) {
      console.error('Dexie getGovSale error:', e);
      return null;
    }
  },

  // --- PURCHASES ---
  async savePurchasesBulk(purchases) {
    try {
      await db.purchases.bulkPut(purchases);
    } catch (e) {
      console.error('Dexie savePurchasesBulk error:', e);
    }
  },
  async savePurchase(purchase) {
    try {
      await db.purchases.put(purchase);
    } catch (e) {
      console.error('Dexie savePurchase error:', e);
    }
  },
  async getPurchases(shopId) {
    try {
      if (shopId) {
        return await db.purchases.where('shop').equals(shopId).toArray();
      }
      return await db.purchases.toArray();
    } catch (e) {
      console.error('Dexie getPurchases error:', e);
      return [];
    }
  },
  async getPurchase(id) {
    try {
      return await db.purchases.get(id);
    } catch (e) {
      console.error('Dexie getPurchase error:', e);
      return null;
    }
  },

  // --- INVENTORY HISTORY / STOCK MOVEMENT ---
  async saveInventoryHistoryBulk(history) {
    try {
      await db.inventoryHistory.bulkPut(history);
    } catch (e) {
      console.error('Dexie saveInventoryHistoryBulk error:', e);
    }
  },
  async saveInventoryHistory(history) {
    try {
      await db.inventoryHistory.put(history);
    } catch (e) {
      console.error('Dexie saveInventoryHistory error:', e);
    }
  },
  async getInventoryHistoryByProduct(productId) {
    try {
      return await db.inventoryHistory.where('productId').equals(productId).toArray();
    } catch (e) {
      console.error('Dexie getInventoryHistoryByProduct error:', e);
      return [];
    }
  },
  async getInventoryHistoryByShop(shopId) {
    try {
      if (shopId) {
        return await db.inventoryHistory.where('shop').equals(shopId).toArray();
      }
      return await db.inventoryHistory.toArray();
    } catch (e) {
      console.error('Dexie getInventoryHistoryByShop error:', e);
      return [];
    }
  },

  // --- SHOPS ---
  async saveShopsBulk(shops) {
    try {
      await db.shops.bulkPut(shops);
    } catch (e) {
      console.error('Dexie saveShopsBulk error:', e);
    }
  },
  async saveShop(shop) {
    try {
      await db.shops.put(shop);
    } catch (e) {
      console.error('Dexie saveShop error:', e);
    }
  },
  async getShops() {
    try {
      return await db.shops.toArray();
    } catch (e) {
      console.error('Dexie getShops error:', e);
      return [];
    }
  }
};
