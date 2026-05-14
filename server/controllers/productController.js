const Product = require('../models/Product');
const RestockHistory = require('../models/RestockHistory');

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
        res.status(200).json({ success: true, data: products });
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
        const product = await Product.create(req.body);
        
        if (product.quantity > 0) {
            const Purchase = require('../models/Purchase');
            const billNo = req.body.billNo || `BILL-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;
            const supplierName = req.body.supplier || 'Unknown Supplier';
            const costPrice = parseFloat(req.body.buyPrice || 0);
            const totalAmount = product.quantity * costPrice;
            const amountPaid = parseFloat(req.body.amountPaid || 0);
            const remainingDue = Math.max(0, totalAmount - amountPaid);

            let paymentStatus = 'Paid';
            if (!req.body.supplier) {
                paymentStatus = 'Direct Entry';
            } else if (amountPaid >= totalAmount) {
                paymentStatus = 'Paid';
            } else if (amountPaid > 0 && amountPaid < totalAmount) {
                paymentStatus = 'Partial Paid';
            } else {
                paymentStatus = 'Pending';
            }

            const paymentHistory = amountPaid > 0 ? [{
                amount: amountPaid,
                mode: req.body.paymentMethod || 'Cash',
                note: 'Initial payment',
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
                    quantity: product.quantity,
                    unit: product.unit || 'Piece',
                    purchaseRate: costPrice,
                    itemTotal: totalAmount
                }],
                totalAmount,
                totalItems: 1,
                paymentStatus,
                paymentMethod: req.body.paymentMethod || 'Cash',
                paidAmount: amountPaid,
                dueAmount: remainingDue,
                paymentHistory,
                entryType: req.body.entryType || 'Purchase',
                notes: req.body.notes || '',
                linkedProductId: product._id,
                addedBy: req.user.id,
                owner: req.user.id,
                date: req.body.purchaseDate || new Date()
            });

            await RestockHistory.create({
                product: product._id,
                productName: product.name,
                quantityAdded: product.quantity,
                supplier: supplierName,
                purchasePrice: costPrice,
                shop: product.shop,
                owner: product.owner
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

        product = await Product.findByIdAndUpdate(req.params.id, req.body, {
            new: true,
            runValidators: true
        });

        if (product.quantity > oldQuantity) {
            await RestockHistory.create({
                product: product._id,
                productName: product.name,
                quantityAdded: product.quantity - oldQuantity,
                supplier: product.supplier || req.body.supplier || 'Unknown',
                shop: product.shop,
                owner: product.owner
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
        const amountPaid = parseFloat(req.body.amountPaid || 0);
        const remainingDue = Math.max(0, totalAmount - amountPaid);

        let paymentStatus = 'Paid';
        if (!req.body.supplier) {
            paymentStatus = 'Direct Entry';
        } else if (amountPaid >= totalAmount) {
            paymentStatus = 'Paid';
        } else if (amountPaid > 0 && amountPaid < totalAmount) {
            paymentStatus = 'Partial Paid';
        } else {
            paymentStatus = 'Pending';
        }

        const paymentHistory = amountPaid > 0 ? [{
            amount: amountPaid,
            mode: req.body.paymentMethod || 'Cash',
            note: 'Initial payment',
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
            paymentMethod: req.body.paymentMethod || 'Cash',
            paidAmount: amountPaid,
            dueAmount: remainingDue,
            paymentHistory,
            entryType: req.body.entryType || 'Purchase',
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

        res.status(200).json({ success: true, data: product });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};
