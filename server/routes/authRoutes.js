const express = require('express');
const { 
    register, 
    login, 
    getMe, 
    googleLogin,
    updateProfile,
    changePassword,
    getSessions,
    deleteSession,
    deleteAllSessions
} = require('../controllers/authController');
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

// Settings and sessions routes
router.put('/profile', protect, updateProfile);
router.put('/password', protect, changePassword);
router.get('/sessions', protect, getSessions);
router.delete('/sessions/:id', protect, deleteSession);
router.delete('/sessions', protect, deleteAllSessions);

module.exports = router;
