const mongoose = require('mongoose');
const dotenv = require('dotenv');
const User = require('./models/User');

dotenv.config();

const run = async () => {
    try {
        console.log('Connecting to database...');
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to MongoDB.');

        const email = 'srujan@admin.com';
        const password = 'adminpassword123';

        let user = await User.findOne({ email });

        if (user) {
            console.log(`User ${email} already exists. Updating role to admin and resetting password...`);
            user.role = 'admin';
            user.password = password; // pre-save hook will hash it
            await user.save();
            console.log(`User ${email} updated successfully.`);
        } else {
            console.log(`Creating new admin user: ${email}...`);
            user = await User.create({
                name: 'A. Srujan (Super Admin)',
                email,
                password,
                role: 'admin'
            });
            console.log(`Admin user ${email} created successfully.`);
        }

        console.log('\n--- Admin Login Details ---');
        console.log(`Email: ${email}`);
        console.log(`Password: ${password}`);
        console.log('---------------------------\n');

        process.exit(0);
    } catch (err) {
        console.error('Error creating admin:', err);
        process.exit(1);
    }
};

run();
