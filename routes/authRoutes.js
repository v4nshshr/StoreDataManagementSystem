const express = require('express');
const router = express.Router();
const { register, login, getMe } = require('../controllers/authController');
const { verifyToken, authorizeRoles } = require('../middleware/auth');

// Public route: Login
router.post('/login', login);

// Admin-only route: Register a new user with specific role
router.post('/register', verifyToken, authorizeRoles('admin'), register);

// Authenticated route: Get current user info
router.get('/me', verifyToken, getMe);

module.exports = router;
