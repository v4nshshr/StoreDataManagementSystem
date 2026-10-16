const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { JWT_SECRET } = require('../middleware/auth');

/**
 * @desc    Register a new user
 * @route   POST /api/auth/register
 * @access  Private (Admin only) or Initial Setup
 */
const register = async (req, res, next) => {
  try {
    const { username, password, role } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: 'Username and password are required'
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters long'
      });
    }

    const existingUser = await User.findOne({ username: username.toLowerCase().trim() });
    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: `Username '${username}' is already taken`
      });
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const user = await User.create({
      username: username.toLowerCase().trim(),
      passwordHash,
      role: role || 'cashier'
    });

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      data: {
        id: user._id,
        username: user.username,
        role: user.role,
        createdAt: user.createdAt
      }
    });
  } catch (error) {
    next(error);
  }
};

const mongoose = require('mongoose');

const SEED_USERS = {
  admin: { id: '6ad1fbaa32e07ab656afddfd', username: 'admin', role: 'admin', password: 'AdminPassword123!' },
  manager: { id: '6ad1fbaa32e07ab656afddfe', username: 'manager', role: 'manager', password: 'ManagerPassword123!' },
  cashier: { id: '6ad1fbaa32e07ab656afddff', username: 'cashier', role: 'cashier', password: 'CashierPassword123!' }
};

/**
 * @desc    Authenticate user & get JWT token
 * @route   POST /api/auth/login
 * @access  Public
 */
const login = async (req, res, next) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide both username and password'
      });
    }

    const cleanUser = username.toLowerCase().trim();

    // If database is not connected, support seed credentials for live cloud demo
    if (mongoose.connection.readyState !== 1) {
      const seed = SEED_USERS[cleanUser];
      if (seed && seed.password === password) {
        const token = jwt.sign(
          { id: seed.id, username: seed.username, role: seed.role },
          JWT_SECRET,
          { expiresIn: '24h' }
        );
        return res.status(200).json({
          success: true,
          message: 'Login successful (Preview Mode)',
          token,
          user: { id: seed.id, username: seed.username, role: seed.role }
        });
      }
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials. User not found.'
      });
    }

    const user = await User.findOne({ username: cleanUser });
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials. User not found.'
      });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials. Incorrect password.'
      });
    }

    const token = jwt.sign(
      { id: user._id, username: user.username, role: user.role },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.status(200).json({
      success: true,
      message: 'Login successful',
      token,
      user: {
        id: user._id,
        username: user.username,
        role: user.role
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get profile of currently logged-in user
 * @route   GET /api/auth/me
 * @access  Private (Authenticated)
 */
const getMe = async (req, res) => {
  res.status(200).json({
    success: true,
    user: {
      id: req.user._id,
      username: req.user.username,
      role: req.user.role,
      createdAt: req.user.createdAt
    }
  });
};

module.exports = {
  register,
  login,
  getMe
};
