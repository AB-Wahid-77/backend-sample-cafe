// src/routes/reviewRoutes.js
//
// Mounted at /api/v1/products/:productId/reviews (see src/routes/index.js).
// mergeParams: true lets this router read req.params.productId from
// the parent mount without productRoutes.js needing any changes.

const express = require('express');
const { createReview, getProductReviews } = require('../controllers/reviewController');
const customerAuthMiddleware = require('../middleware/customerAuthMiddleware');

const router = express.Router({ mergeParams: true });

router.get('/', getProductReviews); // public
router.post('/', customerAuthMiddleware, createReview); // customer auth required

module.exports = router;
