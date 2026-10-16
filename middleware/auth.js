const jwt = require('jsonwebtoken');
const User = require('../models/User');

const JWT_SECRET = process.env.JWT_SECRET || 'superstore_retail_jwt_secret_key_2026';

/**
 * Middleware: Verify JWT Token
 * Extracts Bearer token from Authorization header and attaches decoded user to req.user
 */
const verifyToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Access denied. No authorization token provided or invalid format.'
      });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET);

    // If database is connected, try to find user document
    if (mongoose.connection.readyState === 1) {
      try {
        const user = await User.findById(decoded.id).select('-passwordHash');
        if (user) {
          req.user = user;
          return next();
        }
      } catch (dbErr) {
        // Fall back to decoded JWT payload on DB error
      }
    }

    // Attach decoded user payload (works offline and on cloud preview)
    req.user = {
      _id: decoded.id,
      id: decoded.id,
      username: decoded.username,
      role: decoded.role || 'admin'
    };
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Token expired. Please log in again.'
      });
    }
    return res.status(401).json({
      success: false,
      message: 'Invalid authentication token.'
    });
  }
};

/**
 * Middleware: Role-Based Access Control (RBAC)
 * Restricts route access to specified roles
 * Usage: authorizeRoles('admin', 'manager')
 */
const authorizeRoles = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Forbidden: Role '${req.user?.role || 'Guest'}' is not authorized to access this resource. Required: [${allowedRoles.join(', ')}]`
      });
    }
    next();
  };
};

module.exports = {
  verifyToken,
  authorizeRoles,
  JWT_SECRET
};
