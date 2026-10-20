const Product = require('../models/Product');
const RestockHistory = require('../models/RestockHistory');
const InventoryHistory = require('../models/InventoryHistory');
const { processExpiryAlerts } = require('../utils/expiryHelper');

// @desc    Get all products for owner (optionally filter by shop)
// @route   GET /api/products
// @access  Private
exports.getProducts = async (req, res) => {
    try {
        let query = { owner: req.user.id };
        if (req.query.shop) {
            query.shop = req.query.shop;
        }
        const products = await Product.find(query).populate('shop', 'name');

        // Backward compatibility: Hydrate entryType, payment info, and initialPurchaseId from linked Purchase
        const productIds = products.map(p => p._id);
        let purchaseMap = {};
        if (productIds.length > 0) {
            const Purchase = require('../models/Purchase');
            const linkedPurchases = await Purchase.find({
                linkedProductId: { $in: productIds }
            }).sort({ createdAt: 1 });

            linkedPurchases.forEach(pur => {
                const pId = pur.linkedProductId ? pur.linkedProductId.toString() : '';
                if (pId && !purchaseMap[pId]) {
                    purchaseMap[pId] = pur;
                }
            });
        }

        const enrichedProducts = products.map(prod => {
            const pObj = prod.toObject();
            const linked = purchaseMap[prod._id.toString()];
            if (linked) {
                // If product is legacy (doesn't have initialPurchaseId) or entryType was defaulted to 'Purchase',
                // adopt the actual saved entryType from the linked purchase record!
                if (!prod.initialPurchaseId || pObj.entryType === 'Purchase') {
                    if (linked.entryType) pObj.entryType = linked.entryType;
                }
                if (!pObj.billNo) pObj.billNo = linked.billNo || '';
                if (!pObj.supplierPhone) pObj.supplierPhone = linked.supplierPhone || '';
                if (!pObj.purchaseDate) pObj.purchaseDate = linked.date;
                if (!prod.initialPurchaseId || !pObj.paymentMethod) pObj.paymentMethod = linked.paymentMethod || 'Cash';
                if (!prod.initialPurchaseId || !pObj.paymentStatus) pObj.paymentStatus = linked.paymentStatus || 'Paid';
                if (!prod.initialPurchaseId || pObj.amountPaid === undefined || pObj.amountPaid === 0) pObj.amountPaid = linked.paidAmount || 0;
                if (!prod.initialPurchaseId || pObj.isFullPaid === undefined || pObj.isFullPaid === false) {
                    const totalCost = (pObj.quantity || 0) * (pObj.buyPrice || 0);
                    pObj.isFullPaid = linked.entryType === 'Opening Stock' || linked.paymentStatus === 'Paid' || (linked.paidAmount >= totalCost && totalCost > 0);
                }
                if (!pObj.initialPurchaseId) pObj.initialPurchaseId = linked._id;
            }
            return pObj;
        });

        res.status(200).json({ success: true, data: enrichedProducts });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};

// @desc    Create new product
// @route   POST /api/products
// @access  Private
exports.createProduct = async (req, res) => {
    try {
        req.body.owner = req.user.id;
        if (req.body.gstRate !== undefined) {
            req.body.gstRate = Math.max(0, Math.min(100, Number(req.body.gstRate) || 0));
            req.body.gst = req.body.gstRate;
        } else if (req.body.gst !== undefined) {
            req.body.gst = Math.max(0, Math.min(100, Number(req.body.gst) || 0));
            req.body.gstRate = req.body.gst;
        }
        if (req.body.isGstApplicable !== undefined) {
            req.body.isGstApplicable = Boolean(req.body.isGstApplicable);
        } else if (req.body.gstRate !== undefined || req.body.gst !== undefined) {
            req.body.isGstApplicable = (req.body.gstRate || req.body.gst || 0) > 0;
        }
        if (req.body.gstPricingMode) {
            req.body.gstPricingMode = req.body.gstPricingMode === 'exclusive' ? 'exclusive' : 'inclusive';
        }

        const entryType = req.body.entryType || 'Purchase';
        const costPrice = parseFloat(req.body.buyPrice || 0);
        const quantity = parseFloat(req.body.quantity || 0);
        const totalAmount = parseFloat((quantity * costPrice).toFixed(2));
        const paymentMethod = req.body.paymentMethod || 'Cash';
        const billNo = req.body.billNo || `BILL-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;
        const supplierName = req.body.supplier || 'Unknown Supplier';
        const supplierPhone = req.body.supplierPhone || '';
        const purchaseDate = req.body.purchaseDate ? new Date(req.body.purchaseDate) : new Date();

        let isFullPaid = Boolean(req.body.isFullPaid);
        let amountPaid = parseFloat(req.body.amountPaid || 0);
        let remainingDue = 0;
        let paymentStatus = 'Paid';

        if (entryType === 'Opening Stock') {
            // Opening Stock initializes stock without creating an incorrect supplier payable
            remainingDue = 0;
            amountPaid = isFullPaid || amountPaid > 0 ? (amountPaid || totalAmount) : 0;
            paymentStatus = req.body.supplier ? 'Paid' : 'Direct Entry';
            isFullPaid = true;
        } else {
            if (isFullPaid) {
                amountPaid = totalAmount;
                remainingDue = 0;
                paymentStatus = req.body.supplier ? 'Paid' : 'Direct Entry';
            } else {
                if (amountPaid >= totalAmount && totalAmount > 0) {
                    isFullPaid = true;
                    paymentStatus = req.body.supplier ? 'Paid' : 'Direct Entry';
                    remainingDue = 0;
                } else if (amountPaid > 0 && amountPaid < totalAmount) {
                    isFullPaid = false;
                    paymentStatus = 'Partial Paid';
                    remainingDue = Math.max(0, parseFloat((totalAmount - amountPaid).toFixed(2)));
                } else {
                    isFullPaid = false;
                    amountPaid = 0;
                    remainingDue = totalAmount;
                    paymentStatus = req.body.supplier ? 'Pending' : 'Direct Entry';
                }
            }
        }

        req.body.entryType = entryType;
        req.body.paymentMethod = paymentMethod;
        req.body.paymentStatus = paymentStatus;
        req.body.amountPaid = amountPaid;
        req.body.isFullPaid = isFullPaid;
        req.body.billNo = billNo;
        req.body.supplierPhone = supplierPhone;
        req.body.purchaseDate = purchaseDate;

        const product = await Product.create(req.body);
        
        if (product.quantity > 0) {
            const Purchase = require('../models/Purchase');

            const paymentHistory = amountPaid > 0 ? [{
                amount: amountPaid,
                mode: paymentMethod,
                note: entryType === 'Opening Stock' ? 'Opening stock balance' : 'Initial payment',
                paidAt: purchaseDate
            }] : [];

            const purchase = await Purchase.create({
                shop: product.shop,
                billNo,
                supplierName,
                supplierPhone,
                items: [{
                    product: product._id,
                    productName: product.name,
                    quantity: product.quantity,
                    unit: product.unit || 'Piece',
                    purchaseRate: costPrice,
                    itemTotal: totalAmount
                }],
                totalAmount,
                totalItems: 1,
                paymentStatus,
                paymentMethod,
                paidAmount: amountPaid,
                dueAmount: remainingDue,
                paymentHistory,
                entryType,
                notes: req.body.notes || '',
                linkedProductId: product._id,
                addedBy: req.user.id,
                owner: req.user.id,
                date: purchaseDate
            });

            product.initialPurchaseId = purchase._id;
            await product.save();

            await RestockHistory.create({
                product: product._id,
                productName: product.name,
                quantityAdded: product.quantity,
                supplier: supplierName,
                purchasePrice: costPrice,
                shop: product.shop,
                owner: product.owner
            });

            const actionType = entryType === 'Adjustment' ? 'STOCK_ADJUSTED' : (entryType === 'Return Stock' ? 'STOCK_RETURNED' : 'STOCK_ADDED');
            await InventoryHistory.create({
                productId: product._id,
                productName: product.name,
                actionType,
                quantity: product.quantity,
                unit: product.unit || 'Piece',
                previousStock: 0,
                newStock: product.quantity,
                source: supplierName,
                referenceId: billNo,
                notes: `Initial stock addition via ${entryType}`,
                shop: product.shop,
                owner: req.user.id
            });
        }

        res.status(201).json({ success: true, data: product });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};

// @desc    Update product
// @route   PUT /api/products/:id
// @access  Private
exports.updateProduct = async (req, res) => {
    try {
        let product = await Product.findById(req.params.id);

        if (!product) {
            return res.status(404).json({ success: false, message: 'Product not found' });
        }

        if (product.owner.toString() !== req.user.id) {
            return res.status(401).json({ success: false, message: 'Not authorized' });
        }

        const oldQuantity = product.quantity;

        if (req.body.gstRate !== undefined) {
            req.body.gstRate = Math.max(0, Math.min(100, Number(req.body.gstRate) || 0));
            req.body.gst = req.body.gstRate;
        } else if (req.body.gst !== undefined) {
            req.body.gst = Math.max(0, Math.min(100, Number(req.body.gst) || 0));
            req.body.gstRate = req.body.gst;
        }
        if (req.body.isGstApplicable !== undefined) {
            req.body.isGstApplicable = Boolean(req.body.isGstApplicable);
        } else if (req.body.gstRate !== undefined || req.body.gst !== undefined) {
            req.body.isGstApplicable = (req.body.gstRate || req.body.gst || 0) > 0;
        }
        if (req.body.gstPricingMode) {
            req.body.gstPricingMode = req.body.gstPricingMode === 'exclusive' ? 'exclusive' : 'inclusive';
        }

        const entryType = req.body.entryType !== undefined ? req.body.entryType : (product.entryType || 'Purchase');
        const costPrice = req.body.buyPrice !== undefined ? parseFloat(req.body.buyPrice || 0) : product.buyPrice;
        const newQuantity = req.body.quantity !== undefined ? parseFloat(req.body.quantity || 0) : product.quantity;
        const totalAmount = parseFloat((newQuantity * costPrice).toFixed(2));
        const paymentMethod = req.body.paymentMethod || product.paymentMethod || 'Cash';
        const billNo = req.body.billNo !== undefined ? req.body.billNo : product.billNo;
        const supplierName = req.body.supplier !== undefined ? req.body.supplier : product.supplier;
        const supplierPhone = req.body.supplierPhone !== undefined ? req.body.supplierPhone : product.supplierPhone;
        const purchaseDate = req.body.purchaseDate ? new Date(req.body.purchaseDate) : (product.purchaseDate || new Date());

        let isFullPaid = req.body.isFullPaid !== undefined ? Boolean(req.body.isFullPaid) : Boolean(product.isFullPaid);
        let amountPaid = req.body.amountPaid !== undefined ? parseFloat(req.body.amountPaid || 0) : (product.amountPaid || 0);
        let remainingDue = 0;
        let paymentStatus = 'Paid';

        if (entryType === 'Opening Stock') {
            remainingDue = 0;
            amountPaid = isFullPaid || amountPaid > 0 ? (amountPaid || totalAmount) : 0;
            paymentStatus = supplierName ? 'Paid' : 'Direct Entry';
            isFullPaid = true;
        } else {
            if (isFullPaid) {
                amountPaid = totalAmount;
                remainingDue = 0;
                paymentStatus = supplierName ? 'Paid' : 'Direct Entry';
            } else {
                if (amountPaid >= totalAmount && totalAmount > 0) {
                    isFullPaid = true;
                    paymentStatus = supplierName ? 'Paid' : 'Direct Entry';
                    remainingDue = 0;
                } else if (amountPaid > 0 && amountPaid < totalAmount) {
                    isFullPaid = false;
                    paymentStatus = 'Partial Paid';
                    remainingDue = Math.max(0, parseFloat((totalAmount - amountPaid).toFixed(2)));
                } else {
                    isFullPaid = false;
                    amountPaid = 0;
                    remainingDue = totalAmount;
                    paymentStatus = supplierName ? 'Pending' : 'Direct Entry';
                }
            }
        }

        req.body.entryType = entryType;
        req.body.paymentMethod = paymentMethod;
        req.body.paymentStatus = paymentStatus;
        req.body.amountPaid = amountPaid;
        req.body.isFullPaid = isFullPaid;
        if (billNo !== undefined) req.body.billNo = billNo;
        if (supplierPhone !== undefined) req.body.supplierPhone = supplierPhone;
        req.body.purchaseDate = purchaseDate;

        product = await Product.findByIdAndUpdate(req.params.id, req.body, {
            new: true,
            runValidators: true
        });

        // Synchronize linked Purchase without creating duplicates
        const Purchase = require('../models/Purchase');
        let linkedPurchase = null;
        if (product.initialPurchaseId) {
            linkedPurchase = await Purchase.findById(product.initialPurchaseId);
        }
        if (!linkedPurchase) {
            linkedPurchase = await Purchase.findOne({ linkedProductId: product._id });
        }

        if (linkedPurchase) {
            linkedPurchase.entryType = entryType;
            if (billNo) linkedPurchase.billNo = billNo;
            if (supplierName) linkedPurchase.supplierName = supplierName;
            if (supplierPhone !== undefined) linkedPurchase.supplierPhone = supplierPhone;
            linkedPurchase.paymentMethod = paymentMethod;
            linkedPurchase.paymentStatus = paymentStatus;
            linkedPurchase.totalAmount = totalAmount;
            linkedPurchase.paidAmount = amountPaid;
            linkedPurchase.dueAmount = remainingDue;
            linkedPurchase.date = purchaseDate;
            if (req.body.notes !== undefined) linkedPurchase.notes = req.body.notes;

            if (linkedPurchase.items && linkedPurchase.items.length > 0) {
                const pItem = linkedPurchase.items.find(it => it.product && it.product.toString() === product._id.toString()) || linkedPurchase.items[0];
                pItem.productName = product.name;
                pItem.quantity = product.quantity;
                pItem.unit = product.unit || 'Piece';
                pItem.purchaseRate = costPrice;
                pItem.itemTotal = totalAmount;
            }

            // In-place update of paymentHistory to prevent duplicate records
            if (amountPaid > 0) {
                if (linkedPurchase.paymentHistory && linkedPurchase.paymentHistory.length > 0) {
                    linkedPurchase.paymentHistory[0].amount = amountPaid;
                    linkedPurchase.paymentHistory[0].mode = paymentMethod;
                    linkedPurchase.paymentHistory[0].paidAt = purchaseDate;
                    linkedPurchase.paymentHistory[0].note = entryType === 'Opening Stock' ? 'Opening stock balance' : 'Initial payment';
                } else {
                    linkedPurchase.paymentHistory = [{
                        amount: amountPaid,
                        mode: paymentMethod,
                        note: entryType === 'Opening Stock' ? 'Opening stock balance' : 'Initial payment',
                        paidAt: purchaseDate
                    }];
                }
            } else {
                linkedPurchase.paymentHistory = [];
            }

            await linkedPurchase.save();

            if (!product.initialPurchaseId) {
                product.initialPurchaseId = linkedPurchase._id;
                await product.save();
            }
        }

        if (product.quantity !== oldQuantity) {
            const difference = product.quantity - oldQuantity;
            const actionType = difference > 0 ? 'STOCK_ADDED' : 'STOCK_ADJUSTED';
            
            if (product.quantity > oldQuantity) {
                await RestockHistory.create({
                    product: product._id,
                    productName: product.name,
                    quantityAdded: difference,
                    supplier: product.supplier || req.body.supplier || 'Unknown',
                    shop: product.shop,
                    owner: product.owner
                });
            }

            await InventoryHistory.create({
                productId: product._id,
                productName: product.name,
                actionType: actionType,
                quantity: Math.abs(difference),
                unit: product.unit || 'Piece',
                previousStock: oldQuantity,
                newStock: product.quantity,
                source: 'System',
                referenceId: 'Manual Edit',
                notes: `Stock updated manually from ${oldQuantity} to ${product.quantity}`,
                shop: product.shop,
                owner: req.user.id
            });
        }

        res.status(200).json({ success: true, data: product });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};

// @desc    Delete product
// @route   DELETE /api/products/:id
// @access  Private
exports.deleteProduct = async (req, res) => {
    try {
        const product = await Product.findById(req.params.id);

        if (!product) {
            return res.status(404).json({ success: false, message: 'Product not found' });
        }

        if (product.owner.toString() !== req.user.id) {
            return res.status(401).json({ success: false, message: 'Not authorized' });
        }

        await product.deleteOne();

        res.status(200).json({ success: true, data: {} });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};

// @desc    Get inventory history for a product
// @route   GET /api/products/:id/inventory-history
// @access  Private
exports.getProductInventoryHistory = async (req, res) => {
    try {
        const product = await Product.findById(req.params.id);
        if (!product) {
            return res.status(404).json({ success: false, message: 'Product not found' });
        }

        const query = {
            productId: req.params.id
        };

        if (req.query.shop) {
            query.shop = req.query.shop;
        } else if (product.shop) {
            query.shop = product.shop;
        }

        if (req.query.startDate || req.query.endDate) {
            query.createdAt = {};
            if (req.query.startDate) {
                const s = new Date(req.query.startDate);
                s.setHours(0, 0, 0, 0);
                query.createdAt.$gte = s;
            }
            if (req.query.endDate) {
                const e = new Date(req.query.endDate);
                e.setHours(23, 59, 59, 999);
                query.createdAt.$lte = e;
            }
        }

        const history = await InventoryHistory.find(query).sort('-createdAt');

        res.status(200).json({ success: true, data: history });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};



// @desc    Get restock history for a product
// @route   GET /api/products/:id/restock-history
// @access  Private
exports.getProductRestockHistory = async (req, res) => {
    try {
        const history = await RestockHistory.find({
            product: req.params.id,
            owner: req.user.id
        }).sort('-date');

        res.status(200).json({ success: true, data: history });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};

// @desc    Restock existing product
// @route   POST /api/products/:id/restock
// @access  Private
exports.restockProduct = async (req, res) => {
    try {
        const Product = require('../models/Product');
        const Purchase = require('../models/Purchase');
        const RestockHistory = require('../models/RestockHistory');
        const InventoryHistory = require('../models/InventoryHistory');

        const product = await Product.findById(req.params.id);

        if (!product) {
            return res.status(404).json({ success: false, message: 'Product not found' });
        }

        if (product.owner.toString() !== req.user.id) {
            return res.status(401).json({ success: false, message: 'Not authorized' });
        }

        const quantityAdded = parseFloat(req.body.quantityAdded || 0);
        const costPrice = parseFloat(req.body.costPrice || 0);
        
        if (quantityAdded <= 0) {
            return res.status(400).json({ success: false, message: 'Please provide a valid quantity added' });
        }

        product.quantity = parseFloat((product.quantity + quantityAdded).toFixed(3));
        product.buyPrice = costPrice;
        if (req.body.supplier) product.supplier = req.body.supplier;

        await product.save();

        const billNo = req.body.billNo || `BILL-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;
        const supplierName = req.body.supplier || 'Unknown Supplier';
        const totalAmount = quantityAdded * costPrice;
        const entryType = req.body.entryType || 'Purchase';
        const paymentMethod = req.body.paymentMethod || 'Cash';
        const isFullPaid = Boolean(req.body.isFullPaid);
        let amountPaid = parseFloat(req.body.amountPaid || 0);
        let remainingDue = 0;
        let paymentStatus = 'Paid';

        if (entryType === 'Opening Stock') {
            remainingDue = 0;
            amountPaid = isFullPaid || amountPaid > 0 ? (amountPaid || totalAmount) : 0;
            paymentStatus = req.body.supplier ? 'Paid' : 'Direct Entry';
        } else {
            if (isFullPaid) {
                amountPaid = totalAmount;
                remainingDue = 0;
                paymentStatus = req.body.supplier ? 'Paid' : 'Direct Entry';
            } else {
                if (amountPaid >= totalAmount && totalAmount > 0) {
                    paymentStatus = req.body.supplier ? 'Paid' : 'Direct Entry';
                    remainingDue = 0;
                } else if (amountPaid > 0 && amountPaid < totalAmount) {
                    paymentStatus = 'Partial Paid';
                    remainingDue = Math.max(0, parseFloat((totalAmount - amountPaid).toFixed(2)));
                } else {
                    amountPaid = 0;
                    remainingDue = totalAmount;
                    paymentStatus = req.body.supplier ? 'Pending' : 'Direct Entry';
                }
            }
        }

        const paymentHistory = amountPaid > 0 ? [{
            amount: amountPaid,
            mode: paymentMethod,
            note: entryType === 'Opening Stock' ? 'Opening stock balance' : 'Initial payment',
            paidAt: req.body.purchaseDate || new Date()
        }] : [];

        await Purchase.create({
            shop: product.shop,
            billNo,
            supplierName,
            supplierPhone: req.body.supplierPhone || '',
            items: [{
                product: product._id,
                productName: product.name,
                quantity: quantityAdded,
                unit: product.unit || 'Piece',
                purchaseRate: costPrice,
                itemTotal: totalAmount
            }],
            totalAmount,
            totalItems: 1,
            paymentStatus,
            paymentMethod,
            paidAmount: amountPaid,
            dueAmount: remainingDue,
            paymentHistory,
            entryType,
            notes: req.body.notes || '',
            linkedProductId: product._id,
            addedBy: req.user.id,
            owner: req.user.id,
            date: req.body.purchaseDate || new Date()
        });

        await RestockHistory.create({
            product: product._id,
            productName: product.name,
            quantityAdded,
            supplier: supplierName,
            purchasePrice: costPrice,
            shop: product.shop,
            owner: product.owner
        });

        await InventoryHistory.create({
            productId: product._id,
            productName: product.name,
            actionType: 'STOCK_ADDED',
            quantity: quantityAdded,
            unit: product.unit || 'Piece',
            previousStock: product.quantity - quantityAdded,
            newStock: product.quantity,
            source: supplierName,
            referenceId: billNo,
            notes: `Stock added${req.body.entryType ? ` via ${req.body.entryType}` : ''}`,
            shop: product.shop,
            owner: req.user.id
        });

        res.status(200).json({ success: true, data: product });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};

// @desc    Get expiry alerts (expiring within X days + expired stock)
// @route   GET /api/products/expiry-alerts
// @access  Private
exports.getExpiryAlerts = async (req, res) => {
    try {
        let query = { owner: req.user.id };
        if (req.query.shop) {
            query.shop = req.query.shop;
        }

        const days = parseInt(req.query.days, 10) || 45;
        const clientDate = req.query.clientDate ? new Date(req.query.clientDate) : new Date();

        // Query only products that have an expiryDate or have batches
        const candidateQuery = {
            ...query,
            $or: [
                { expiryDate: { $exists: true, $ne: null } },
                { 'batches.0': { $exists: true } }
            ]
        };

        const products = await Product.find(candidateQuery)
            .select('name category brand sku barcode quantity unit expiryDate batchNumber batches shop')
            .populate('shop', 'name');

        const result = processExpiryAlerts(products, {
            maxDays: days,
            baseDate: clientDate,
            shopId: req.query.shop
        });

        res.status(200).json({ success: true, data: result });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};

