// src/routes/productRoutes.js

const express = require('express');
const {
  createProduct,
  getProducts,
  getProductById,
  updateProduct,
  deleteProduct,
  toggleProductAvailability,
} = require('../controllers/productController');
const authMiddleware = require('../middleware/authMiddleware');

const router = express.Router();

// Public — menu browsing, no auth required.
router.get('/', getProducts);
router.get('/:id', getProductById);

// Admin only — reuses the existing authMiddleware exactly as-is.
router.post('/', authMiddleware, createProduct);
router.patch('/:id', authMiddleware, updateProduct);
router.delete('/:id', authMiddleware, deleteProduct);
router.patch('/:id/availability', authMiddleware, toggleProductAvailability);

module.exports = router;
