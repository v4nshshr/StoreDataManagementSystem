const express = require('express');
const router = express.Router();
const {
  getProducts,
  getCategories,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct
} = require('../controllers/productController');
const { verifyToken, authorizeRoles } = require('../middleware/auth');

// All product routes require authentication
router.use(verifyToken);

// Read-only routes (Cashier, Manager, Admin)
router.get('/', authorizeRoles('admin', 'manager', 'cashier'), getProducts);
router.get('/categories', authorizeRoles('admin', 'manager', 'cashier'), getCategories);
router.get('/:id', authorizeRoles('admin', 'manager', 'cashier'), getProductById);

// Mutating routes (Manager, Admin)
router.post('/', authorizeRoles('admin', 'manager'), createProduct);
router.put('/:id', authorizeRoles('admin', 'manager'), updateProduct);

// Destructive routes (Admin only)
router.delete('/:id', authorizeRoles('admin'), deleteProduct);

module.exports = router;
