// src/routes/customerAuthRoutes.js

const express = require('express');
const {
  register,
  login,
  getMe,
  updateMe,
  changePassword,
  logout,
  getOrderHistory,
} = require('../controllers/customerAuthController');
const customerAuthMiddleware = require('../middleware/customerAuthMiddleware');

const router = express.Router();

router.post('/register', register);
router.post('/login', login);
router.get('/me', customerAuthMiddleware, getMe);
router.patch('/me', customerAuthMiddleware, updateMe);
router.patch('/password', customerAuthMiddleware, changePassword);
router.post('/logout', customerAuthMiddleware, logout);
router.get('/orders', customerAuthMiddleware, getOrderHistory);

module.exports = router;
