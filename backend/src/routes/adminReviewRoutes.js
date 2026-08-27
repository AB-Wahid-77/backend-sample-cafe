// src/routes/adminReviewRoutes.js
//
// Admin review moderation. Reuses the existing authMiddleware exactly
// as-is — no second admin authentication system.

const express = require('express');
const {
  adminListReviews,
  adminGetReviewById,
  adminDeleteReview,
} = require('../controllers/reviewController');
const authMiddleware = require('../middleware/authMiddleware');

const router = express.Router();

router.use(authMiddleware);

router.get('/', adminListReviews);
router.get('/:id', adminGetReviewById);
router.delete('/:id', adminDeleteReview);

module.exports = router;
