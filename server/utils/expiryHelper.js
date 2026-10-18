/**
 * Utility functions for inventory expiry detection and alerts in ShopPulse.
 */

/**
 * Calculates calendar day difference between targetDate and baseDate.
 * Avoids timezone off-by-one errors by comparing calendar year, month, date.
 *
 * @param {Date|string} targetDate - The expiry date
 * @param {Date|string} baseDate - Reference date (default: now)
 * @returns {number|null} Days remaining (positive = future, 0 = today, negative = past)
 */
function getCalendarDayDifference(targetDate, baseDate = new Date()) {
    if (!targetDate) return null;
    const target = new Date(targetDate);
    if (isNaN(target.getTime())) return null;

    const base = new Date(baseDate);
    if (isNaN(base.getTime())) return null;

    // Use UTC midnight of the calendar year, month, date
    const baseMidnight = Date.UTC(base.getFullYear(), base.getMonth(), base.getDate());
    const targetMidnight = Date.UTC(target.getFullYear(), target.getMonth(), target.getDate());

    const msPerDay = 24 * 60 * 60 * 1000;
    return Math.round((targetMidnight - baseMidnight) / msPerDay);
}

/**
 * Determines urgency category based on days remaining:
 * - diffDays < 0: 'expired' (separate red alert)
 * - 0 <= diffDays <= 7: 'critical' (Critical Red)
 * - 8 <= diffDays <= 15: 'warning' (Orange)
 * - 16 <= diffDays <= 45: 'attention' (Amber)
 * - diffDays > 45: 'fresh'
 */
function getUrgencyLevel(diffDays) {
    if (diffDays === null || diffDays === undefined) return 'none';
    if (diffDays < 0) return 'expired';
    if (diffDays <= 7) return 'critical';
    if (diffDays <= 15) return 'warning';
    if (diffDays <= 45) return 'attention';
    return 'fresh';
}

/**
 * Processes a list of products and extracts expiring and expired items/batches.
 *
 * Rules:
 * - Include products/batches expiring today through next 45 calendar days.
 * - Exclude products with no expiry date.
 * - Exclude already expired from 'Expiring Soon' and group into 'Expired Stock'.
 * - Filter by shop (products must belong to target shop).
 * - Respect batch-level expiry dates where batches exist.
 * - If product has multiple batches, alert on each relevant batch with quantity > 0.
 * - Do not count zero-stock batches or products.
 * - Avoid double-counting batches and product level records.
 *
 * @param {Array} products - List of product documents (populated with shop if available)
 * @param {Object} options - { maxDays = 45, baseDate = new Date(), shopId = null }
 * @returns {Object} { summary, expiringSoon, expired }
 */
function processExpiryAlerts(products, options = {}) {
    const maxDays = Number(options.maxDays) || 45;
    const baseDate = options.baseDate ? new Date(options.baseDate) : new Date();
    const shopId = options.shopId ? options.shopId.toString() : null;

    const expiringSoon = [];
    const expired = [];

    for (const p of products) {
        // Shop isolation check
        const pShopId = p.shop?._id ? p.shop._id.toString() : (p.shop ? p.shop.toString() : null);
        if (shopId && pShopId && pShopId !== shopId) {
            continue;
        }

        const shopName = p.shop?.name || p.shopName || '';

        // Check if product has batches tracked
        const hasBatches = Array.isArray(p.batches) && p.batches.length > 0;

        if (hasBatches) {
            // Check each batch
            for (const batch of p.batches) {
                const batchQty = Number(batch.quantity || 0);
                if (batchQty <= 0) continue; // Exclude zero or negative stock
                if (!batch.expiryDate) continue; // Exclude missing expiry date

                const diffDays = getCalendarDayDifference(batch.expiryDate, baseDate);
                if (diffDays === null) continue;

                const itemData = {
                    productId: p._id.toString(),
                    productName: p.name,
                    category: p.category || '',
                    brand: p.brand || '',
                    sku: p.sku || '',
                    barcode: p.barcode || '',
                    batchNumber: batch.batchNumber || null,
                    quantity: batchQty,
                    unit: p.unit || 'Piece',
                    expiryDate: batch.expiryDate,
                    daysRemaining: diffDays,
                    urgency: getUrgencyLevel(diffDays),
                    isBatch: true,
                    shopId: pShopId,
                    shopName
                };

                if (diffDays < 0) {
                    expired.push(itemData);
                } else if (diffDays <= maxDays) {
                    expiringSoon.push(itemData);
                }
            }
        } else {
            // Standard single-product stock
            const prodQty = Number(p.quantity || 0);
            if (prodQty <= 0) continue; // Exclude zero stock
            if (!p.expiryDate) continue; // Exclude missing expiry date

            const diffDays = getCalendarDayDifference(p.expiryDate, baseDate);
            if (diffDays === null) continue;

            const itemData = {
                productId: p._id.toString(),
                productName: p.name,
                category: p.category || '',
                brand: p.brand || '',
                sku: p.sku || '',
                barcode: p.barcode || '',
                batchNumber: p.batchNumber || null,
                quantity: prodQty,
                unit: p.unit || 'Piece',
                expiryDate: p.expiryDate,
                daysRemaining: diffDays,
                urgency: getUrgencyLevel(diffDays),
                isBatch: false,
                shopId: pShopId,
                shopName
            };

            if (diffDays < 0) {
                expired.push(itemData);
            } else if (diffDays <= maxDays) {
                expiringSoon.push(itemData);
            }
        }
    }

    // Sort both lists by nearest expiry first
    expiringSoon.sort((a, b) => a.daysRemaining - b.daysRemaining);
    expired.sort((a, b) => b.daysRemaining - a.daysRemaining); // Most recently expired first (e.g. -1 before -10)

    // Compute overall urgency and nearest expiry date for expiring soon
    let nearestExpiryDays = null;
    let nearestExpiryDate = null;
    let overallUrgency = 'none';

    if (expiringSoon.length > 0) {
        nearestExpiryDays = expiringSoon[0].daysRemaining;
        nearestExpiryDate = expiringSoon[0].expiryDate;
        overallUrgency = getUrgencyLevel(nearestExpiryDays);
    }

    return {
        summary: {
            expiringSoonCount: expiringSoon.length,
            expiredCount: expired.length,
            nearestExpiryDays,
            nearestExpiryDate,
            urgency: overallUrgency,
            thresholdDays: maxDays
        },
        expiringSoon,
        expired
    };
}

module.exports = {
    getCalendarDayDifference,
    getUrgencyLevel,
    processExpiryAlerts
};
