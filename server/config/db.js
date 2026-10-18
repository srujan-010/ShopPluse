const mongoose = require('mongoose');
const dns = require('dns');

// Configure reliable DNS servers to avoid querySrv EREFUSED on Windows
try {
    dns.setServers(['8.8.8.8', '1.1.1.1']);
} catch (e) {
    console.warn('Could not set custom DNS servers:', e.message);
}

const connectDB = async () => {
    try {
        const conn = await mongoose.connect(process.env.MONGODB_URI);
        console.log(`MongoDB Connected: ${conn.connection.host}`);
    } catch (error) {
        console.error(`MongoDB connection error: ${error.message}`);
        // Retry after delay instead of hard exit so nodemon doesn't crash permanently
        setTimeout(connectDB, 5000);
    }
};

module.exports = connectDB;

