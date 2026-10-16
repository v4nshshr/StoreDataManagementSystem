const express = require('express');
const router = express.Router();
const {
  getCustomers,
  getCustomerById,
  getCustomerOrders,
  createCustomer,
  updateCustomer,
  deleteCustomer
} = require('../controllers/customerController');
const { verifyToken, authorizeRoles } = require('../middleware/auth');

// All customer routes require authentication
router.use(verifyToken);

// Read-only routes (Cashier, Manager, Admin)
router.get('/', authorizeRoles('admin', 'manager', 'cashier'), getCustomers);
router.get('/:id', authorizeRoles('admin', 'manager', 'cashier'), getCustomerById);
router.get('/:id/orders', authorizeRoles('admin', 'manager', 'cashier'), getCustomerOrders);

// Mutating routes (Manager, Admin)
router.post('/', authorizeRoles('admin', 'manager'), createCustomer);
router.put('/:id', authorizeRoles('admin', 'manager'), updateCustomer);

// Destructive routes (Admin only)
router.delete('/:id', authorizeRoles('admin'), deleteCustomer);

module.exports = router;
