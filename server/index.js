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

// Enable CORS
app.use(cors({
    origin: [
        'http://localhost:5173',
        'https://shoppluse.onrender.com',
        /\.netlify\.app$/ // Matches any netlify sub-domain
    ],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

// Add a helper GET route for Google Login to prevent 404s if accessed directly
app.get('/api/auth/google', (req, res) => {
    res.json({
        success: true,
        message: 'Google login endpoint. Please use POST with Firebase user data, or redirect to the frontend login page.',
        method: 'GET'
    });
});

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
const errorHandler = require('./middleware/errorMiddleware');

// Mount routers
app.use('/api/auth', auth);
app.use('/api/shops', shops);
app.use('/api/products', products);
app.use('/api/sales', sales);
app.use('/api/khata', khata);
app.use('/api/purchases', purchases);
app.use('/api/invoices', invoices);

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
