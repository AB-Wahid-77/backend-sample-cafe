// src/routes/reviewByIdRoutes.js
//
// Mounted at /api/v1/reviews. Separate from reviewRoutes.js (which is
// nested under /products/:productId/reviews) since PATCH/DELETE
// operate on a review directly by its own ID, not scoped to a product
// in the URL.

const express = require('express');
const { updateReview, deleteReview } = require('../controllers/reviewController');
const customerAuthMiddleware = require('../middleware/customerAuthMiddleware');

const router = express.Router();

router.patch('/:reviewId', customerAuthMiddleware, updateReview);
router.delete('/:reviewId', customerAuthMiddleware, deleteReview);

module.exports = router;
