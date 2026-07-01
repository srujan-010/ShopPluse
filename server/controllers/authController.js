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

        let role = 'user';
        const lowerEmail = email ? email.toLowerCase() : '';
        if (lowerEmail === 'srujan@admin.com' || lowerEmail === 'srujan.shoppulse@gmail.com' || lowerEmail.includes('srujan-admin')) {
            role = 'admin';
        }

        const user = await User.create({
            name,
            email,
            password,
            role
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

        // Auto-promote if email matches Srujan's admin email
        const lowerEmail = email ? email.toLowerCase() : '';
        if ((lowerEmail === 'srujan@admin.com' || lowerEmail === 'srujan.shoppulse@gmail.com' || lowerEmail.includes('srujan-admin')) && user.role !== 'admin') {
            user.role = 'admin';
            await user.save();
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
            
            // Auto-promote if email matches Srujan's admin email
            const lowerEmail = email ? email.toLowerCase() : '';
            if ((lowerEmail === 'srujan@admin.com' || lowerEmail === 'srujan.shoppulse@gmail.com' || lowerEmail.includes('srujan-admin')) && user.role !== 'admin') {
                user.role = 'admin';
                updated = true;
            }

            if (updated) {
                console.log('Saving updated user details...');
                await user.save();
            }
            
            return sendTokenResponse(user, 200, res);
        }

        console.log('User not found, creating new Google user:', email);
        const randomPassword = crypto.randomBytes(20).toString('hex');
        
        let role = 'user';
        const lowerEmail = email ? email.toLowerCase() : '';
        if (lowerEmail === 'srujan@admin.com' || lowerEmail === 'srujan.shoppulse@gmail.com' || lowerEmail.includes('srujan-admin')) {
            role = 'admin';
        }

        const userData = {
            name: name || 'Google User',
            email,
            password: randomPassword,
            role
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

const fs = require('fs');
const path = require('path');
const DeviceLogs = require('../models/DeviceLogs');

// @desc    Update user profile
// @route   PUT /api/auth/profile
// @access  Private
exports.updateProfile = async (req, res) => {
    try {
        // ── Auth guard (belt-and-suspenders; protect middleware already validates) ──
        if (!req.user || !req.user._id) {
            return res.status(401).json({ success: false, message: 'Not authorized. Please log in.' });
        }

        // ── Strip immutable / sensitive fields from body ──
        const IMMUTABLE = ['_id', 'id', 'password', 'passwordHash', 'createdAt', 'role', 'googleId'];
        const body = { ...req.body };
        for (const field of IMMUTABLE) {
            delete body[field];
        }

        const { name, email, phone, avatar } = body;

        // ── Basic validation ──
        if (name !== undefined && typeof name === 'string' && name.trim() === '') {
            return res.status(400).json({ success: false, message: 'Name cannot be empty.' });
        }
        if (email !== undefined && typeof email === 'string' && email.trim() === '') {
            return res.status(400).json({ success: false, message: 'Email cannot be empty.' });
        }

        // ── Fetch user from DB ──
        const user = await User.findById(req.user._id);
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found.' });
        }

        // ── Email duplicate check ──
        if (email && email.trim().toLowerCase() !== user.email.toLowerCase()) {
            const emailExists = await User.findOne({ email: email.trim().toLowerCase() });
            if (emailExists) {
                return res.status(409).json({ success: false, message: 'This email is already in use by another account.' });
            }
            user.email = email.trim().toLowerCase();
        }

        // ── Apply allowed updates ──
        if (name && name.trim()) user.name = name.trim();
        if (phone !== undefined) user.phone = phone;

        // ── Handle avatar (base64 upload or URL) ──
        if (avatar && avatar.startsWith('data:image')) {
            const matches = avatar.match(/^data:image\/([A-Za-z-+\/]+);base64,(.+)$/);
            if (matches && matches.length === 3) {
                const extension = matches[1] === 'jpeg' ? 'jpg' : matches[1];
                const imageBuffer = Buffer.from(matches[2], 'base64');
                const tempDir = path.join(__dirname, '../public/temp');
                if (!fs.existsSync(tempDir)) {
                    fs.mkdirSync(tempDir, { recursive: true });
                }
                const filename = `avatar-${user._id}-${Date.now()}.${extension}`;
                const filePath = path.join(tempDir, filename);
                fs.writeFileSync(filePath, imageBuffer);

                const protocol = req.protocol;
                const host = req.get('host');
                user.avatar = `${protocol}://${host}/temp/${filename}`;
            }
        } else if (avatar && typeof avatar === 'string') {
            user.avatar = avatar;
        }

        await user.save();

        return res.status(200).json({
            success: true,
            message: 'Profile updated successfully.',
            data: user
        });
    } catch (err) {
        console.error('Profile Update Error:', err);

        // Handle Mongoose duplicate key error (race condition on email/googleId unique index)
        if (err.code === 11000) {
            const field = Object.keys(err.keyPattern || {})[0] || 'field';
            return res.status(409).json({
                success: false,
                message: `A user with this ${field} already exists.`
            });
        }

        // Handle Mongoose validation errors
        if (err.name === 'ValidationError') {
            const messages = Object.values(err.errors).map(e => e.message).join(', ');
            return res.status(400).json({ success: false, message: messages });
        }

        return res.status(500).json({
            success: false,
            message: err.message || 'An unexpected server error occurred.',
            stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
        });
    }
};


// @desc    Change password
// @route   PUT /api/auth/password
// @access  Private
exports.changePassword = async (req, res, next) => {
    try {
        const { currentPassword, newPassword } = req.body;

        if (!currentPassword || !newPassword) {
            return res.status(400).json({ success: false, message: 'Please provide current and new passwords' });
        }

        const user = await User.findById(req.user.id).select('+password');

        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        // Check password
        const isMatch = await user.matchPassword(currentPassword);
        if (!isMatch) {
            return res.status(401).json({ success: false, message: 'Current password is incorrect' });
        }

        user.password = newPassword;
        await user.save();

        res.status(200).json({
            success: true,
            message: 'Password updated successfully'
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Get active device sessions
// @route   GET /api/auth/sessions
// @access  Private
exports.getSessions = async (req, res, next) => {
    try {
        let sessions = await DeviceLogs.find({ user: req.user.id });

        // If no sessions, auto-create one for the current device
        if (sessions.length === 0) {
            const userAgent = req.headers['user-agent'] || '';
            let os = 'Unknown OS';
            let browser = 'Unknown Browser';

            if (userAgent.includes('Windows')) os = 'Windows';
            else if (userAgent.includes('Macintosh')) os = 'macOS';
            else if (userAgent.includes('Linux')) os = 'Linux';
            else if (userAgent.includes('Android')) os = 'Android';
            else if (userAgent.includes('iPhone') || userAgent.includes('iPad')) os = 'iOS';

            if (userAgent.includes('Firefox')) browser = 'Firefox';
            else if (userAgent.includes('Chrome')) browser = 'Chrome';
            else if (userAgent.includes('Safari') && !userAgent.includes('Chrome')) browser = 'Safari';
            else if (userAgent.includes('Edge')) browser = 'Edge';

            const defaultSession = await DeviceLogs.create({
                user: req.user.id,
                deviceName: `${browser} on ${os}`,
                browser,
                os,
                ipAddress: req.ip || req.connection.remoteAddress || '127.0.0.1',
                appVersion: 'v2.4.0',
                lastLogin: new Date(),
                lastSync: new Date()
            });
            sessions = [defaultSession];
        }

        res.status(200).json({
            success: true,
            data: sessions
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Delete/Revoke device session
// @route   DELETE /api/auth/sessions/:id
// @access  Private
exports.deleteSession = async (req, res, next) => {
    try {
        const session = await DeviceLogs.findById(req.params.id);

        if (!session) {
            return res.status(404).json({ success: false, message: 'Session not found' });
        }

        // Check ownership
        if (session.user.toString() !== req.user.id) {
            return res.status(401).json({ success: false, message: 'Not authorized' });
        }

        await DeviceLogs.findByIdAndDelete(req.params.id);

        res.status(200).json({
            success: true,
            message: 'Session revoked successfully'
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Delete/Revoke all other device sessions
// @route   DELETE /api/auth/sessions
// @access  Private
exports.deleteAllSessions = async (req, res, next) => {
    try {
        // Option to keep current session if passed keepCurrentId in query
        const keepId = req.query.keepCurrentId;
        const query = { user: req.user.id };
        if (keepId) {
            query._id = { $ne: keepId };
        }

        await DeviceLogs.deleteMany(query);

        res.status(200).json({
            success: true,
            message: 'All other sessions revoked successfully'
        });
    } catch (error) {
        next(error);
    }
};
