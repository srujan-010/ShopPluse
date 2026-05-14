const mongoose = require('mongoose');
const dotenv = require('dotenv');

dotenv.config();

const Shop = require('./models/Shop');
const Product = require('./models/Product');
const Sale = require('./models/Sale');

const clearDb = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('MongoDB Connected');

        await Shop.deleteMany();
        await Product.deleteMany();
        await Sale.deleteMany();

        console.log('All shops, products, and sales have been deleted.');
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
};

clearDb();
