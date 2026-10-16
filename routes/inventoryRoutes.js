const express = require('express');
const router = express.Router();
const { getInventoryView } = require('../controllers/inventoryController');
const { verifyToken, authorizeRoles } = require('../middleware/auth');

router.use(verifyToken);
router.get('/', authorizeRoles('admin', 'manager', 'cashier'), getInventoryView);

module.exports = router;
