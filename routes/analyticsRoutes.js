const express = require('express');
const router = express.Router();
const {
  getKpis,
  getSalesByYearMonth,
  getCategoryPerformance,
  getTopCustomers,
  getProductsByProfit,
  getProfitByGeography,
  getDiscountImpact,
  getShippingTimeByMode,
  getSalesBySegment
} = require('../controllers/analyticsController');
const { verifyToken, authorizeRoles } = require('../middleware/auth');

// All analytics require authentication (Cashier, Manager, Admin can view)
router.use(verifyToken);

router.get('/kpis', authorizeRoles('admin', 'manager', 'cashier'), getKpis);
router.get('/sales-by-year-month', authorizeRoles('admin', 'manager'), getSalesByYearMonth);
router.get('/category-performance', authorizeRoles('admin', 'manager'), getCategoryPerformance);
router.get('/top-customers', authorizeRoles('admin', 'manager'), getTopCustomers);
router.get('/products-by-profit', authorizeRoles('admin', 'manager'), getProductsByProfit);
router.get('/profit-by-geography', authorizeRoles('admin', 'manager'), getProfitByGeography);
router.get('/discount-impact', authorizeRoles('admin', 'manager'), getDiscountImpact);
router.get('/shipping-time', authorizeRoles('admin', 'manager', 'cashier'), getShippingTimeByMode);
router.get('/sales-by-segment', authorizeRoles('admin', 'manager'), getSalesBySegment);

module.exports = router;
