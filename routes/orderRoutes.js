const express = require('express');
const router = express.Router();
const {
  getOrders,
  getOrderById,
  createOrder,
  updateShippingStatus,
  deleteOrder
} = require('../controllers/orderController');
const { verifyToken, authorizeRoles } = require('../middleware/auth');

// All order routes require authentication
router.use(verifyToken);

// Read-only routes (Cashier, Manager, Admin)
router.get('/', authorizeRoles('admin', 'manager', 'cashier'), getOrders);
router.get('/:id', authorizeRoles('admin', 'manager', 'cashier'), getOrderById);

// Create order (Cashier, Manager, Admin)
router.post('/', authorizeRoles('admin', 'manager', 'cashier'), createOrder);

// Update shipping status (Manager, Admin, Cashier)
router.patch('/:id/status', authorizeRoles('admin', 'manager', 'cashier'), updateShippingStatus);

// Delete order (Admin only)
router.delete('/:id', authorizeRoles('admin'), deleteOrder);

module.exports = router;
