const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const morgan = require('morgan');
const connectDB = require('./config/db');

// Load env vars
dotenv.config();

// Connect to database
connectDB();

const app = express();

// Body parser
app.use(express.json());

// Idempotency Middleware
const { idempotency } = require('./middleware/idempotency');
app.use(idempotency);

// Shop Status Override Middleware (suspended/expired check)
const shopStatus = require('./middleware/shopStatus');
app.use(shopStatus);

// Enable CORS
app.use(cors({
    origin: [
        'http://localhost:5173',
        'https://shoppluse.onrender.com',
        /\.netlify\.app$/, // Matches any netlify sub-domain
        /\.ngrok-free\.dev$/ // Matches ngrok domains
    ],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Idempotency-Key', 'X-Request-ID']
}));


// Serve static files from public directory
app.use(express.static('public'));

// Dev logging middleware
if (process.env.NODE_ENV === 'development') {
    app.use(morgan('dev'));
}

// Route files
const auth = require('./routes/authRoutes');
const shops = require('./routes/shopRoutes');
const products = require('./routes/productRoutes');
const sales = require('./routes/saleRoutes');
const khata = require('./routes/khataRoutes');
const purchases = require('./routes/purchaseRoutes');
const invoices = require('./routes/invoiceRoutes');
const govSales = require('./routes/govSaleRoutes');
const admin = require('./routes/adminRoutes');
const errorHandler = require('./middleware/errorMiddleware');

// Mount routers
app.use('/api/auth', auth);
app.use('/api/shops', shops);
app.use('/api/products', products);
app.use('/api/sales', sales);
app.use('/api/khata', khata);
app.use('/api/purchases', purchases);
app.use('/api/invoices', invoices);
app.use('/api/gov-sales', govSales);
app.use('/api/admin', admin);

// 404 handler for API routes
app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: `Route ${req.originalUrl} not found`
    });
});

// Error handler
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
    console.log(`Server running in ${process.env.NODE_ENV} mode on port ${PORT}`);
});
