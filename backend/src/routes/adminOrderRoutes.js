// src/routes/adminOrderRoutes.js
//
// Admin order management. Reuses the existing authMiddleware exactly
// as-is — no second authentication system.

const express = require('express');
const {
  adminListOrders,
  adminGetOrderById,
  adminUpdateOrderStatus,
} = require('../controllers/orderController');
const authMiddleware = require('../middleware/authMiddleware');

const router = express.Router();

router.use(authMiddleware);

router.get('/', adminListOrders);
router.get('/:id', adminGetOrderById);
router.patch('/:id/status', adminUpdateOrderStatus);

module.exports = router;
