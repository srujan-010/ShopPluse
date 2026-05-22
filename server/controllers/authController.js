const User = require('../models/User');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

// @desc    Register user
// @route   POST /api/auth/register
// @access  Public
exports.register = async (req, res, next) => {
    try {
        const { name, email, password } = req.body;

        // Check if user exists
        const userExists = await User.findOne({ email });

        if (userExists) {
            return res.status(400).json({
                success: false,
                message: 'Email already exists. Please use a different email.'
            });
        }

        const user = await User.create({
            name,
            email,
            password
        });

        sendTokenResponse(user, 201, res);
    } catch (error) {
        next(error);
    }
};

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
exports.login = async (req, res, next) => {
    try {
        const { email, password } = req.body;

        // Validate email & password
        if (!email || !password) {
            return res.status(400).json({ success: false, message: 'Please provide an email and password' });
        }

        // Check for user
        const user = await User.findOne({ email }).select('+password');

        if (!user) {
            return res.status(401).json({ success: false, message: 'Invalid credentials' });
        }

        // Check if password matches
        const isMatch = await user.matchPassword(password);

        if (!isMatch) {
            return res.status(401).json({ success: false, message: 'Invalid credentials' });
        }

        sendTokenResponse(user, 200, res);
    } catch (error) {
        next(error);
    }
};

// @desc    Get current logged in user
// @route   GET /api/auth/me
// @access  Private
exports.getMe = async (req, res, next) => {
    try {
        const user = await User.findById(req.user.id);
        res.status(200).json({
            success: true,
            data: user
        });
    } catch (error) {
        next(error);
    }
};

// Get token from model, create cookie and send response
const sendTokenResponse = (user, statusCode, res) => {
    // Create token
    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
        expiresIn: '30d'
    });

    // Remove password from output
    user.password = undefined;

    res.status(statusCode).json({
        success: true,
        token,
        data: user
    });
};

// @desc    Google login / registration
// @route   POST /api/auth/google
// @access  Public
exports.googleLogin = async (req, res, next) => {
    try {
        console.log('Google Login Request Body:', req.body);
        const { email, name, uid, photoURL } = req.body;

        if (!email) {
            console.log('Google Login Error: Email missing');
            return res.status(400).json({ success: false, message: 'Email is required for Google login' });
        }

        // Build a flexible query: check by email OR googleId if available
        let query = { email };
        if (uid) {
            query = { $or: [{ email }, { googleId: uid }] };
        }

        let user = await User.findOne(query).select('+password');

        if (user) {
            console.log('User found, updating if necessary:', user.email);
            let updated = false;
            if (uid && !user.googleId) { user.googleId = uid; updated = true; }
            if (photoURL && !user.avatar) { user.avatar = photoURL; updated = true; }
            
            if (updated) {
                console.log('Saving updated user details...');
                await user.save();
            }
            
            return sendTokenResponse(user, 200, res);
        }

        console.log('User not found, creating new Google user:', email);
        const randomPassword = crypto.randomBytes(20).toString('hex');
        
        const userData = {
            name: name || 'Google User',
            email,
            password: randomPassword
        };
        
        if (uid) userData.googleId = uid;
        if (photoURL) userData.avatar = photoURL;

        user = await User.create(userData);

        console.log('New user created successfully:', user._id);
        return sendTokenResponse(user, 201, res);
    } catch (error) {
        console.error('CRITICAL GOOGLE LOGIN ERROR:', error);
        return res.status(500).json({ 
            success: false, 
            message: 'Server Error during Google Login',
            error: error.message 
        });
    }
};
