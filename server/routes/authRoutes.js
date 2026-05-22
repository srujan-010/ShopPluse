const express = require('express');
const { register, login, getMe, googleLogin } = require('../controllers/authController');
const { protect } = require('../middleware/auth');

const router = express.Router();

router.post('/register', register);
router.post('/login', login);
router.post('/google', googleLogin);
router.get('/google', (req, res) => {
    res.json({
        success: true,
        message: 'Google login endpoint. Please use POST with Firebase user data.',
        method: 'GET'
    });
});
router.get('/me', protect, getMe);

module.exports = router;
