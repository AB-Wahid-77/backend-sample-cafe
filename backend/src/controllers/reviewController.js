// src/controllers/reviewController.js
//
// Follows the same response/validation conventions as
// productController.js / orderController.js / reservationController.js.
// Reuses customerAuthMiddleware/authMiddleware for auth — no second
// auth system.

const mongoose = require('mongoose');
const Review = require('../models/Review');
const Product = require('../models/Product');

const DEFAULT_PAGE_LIMIT = 10;
const MAX_PAGE_LIMIT = 50;

function isValidObjectId(id) {
  return mongoose.Types.ObjectId.isValid(id);
}

function validateRating(rating) {
  const num = Number(rating);
  if (rating === undefined || rating === null || Number.isNaN(num) || !Number.isInteger(num)) {
    return { valid: false, message: 'rating must be a whole number between 1 and 5' };
  }
  if (num < 1 || num > 5) {
    return { valid: false, message: 'rating must be between 1 and 5' };
  }
  return { valid: true, value: num };
}

function validateComment(comment) {
  if (comment === undefined || comment === null) {
    return { valid: true, value: '' };
  }
  if (typeof comment !== 'string') {
    return { valid: false, message: 'comment must be a string' };
  }
  const trimmed = comment.trim();
  if (trimmed.length > 1000) {
    return { valid: false, message: 'comment cannot exceed 1000 characters' };
  }
  return { valid: true, value: trimmed };
}

function parsePagination(query) {
  let page = parseInt(query.page, 10);
  let limit = parseInt(query.limit, 10);

  if (!Number.isInteger(page) || page < 1) page = 1;
  if (!Number.isInteger(limit) || limit < 1) limit = DEFAULT_PAGE_LIMIT;
  if (limit > MAX_PAGE_LIMIT) limit = MAX_PAGE_LIMIT;

  return { page, limit, skip: (page - 1) * limit };
}

async function createReview(req, res, next) {
  try {
    const { productId } = req.params;

    if (!isValidObjectId(productId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid product ID',
      });
    }

    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found',
      });
    }

    const ratingCheck = validateRating(req.body.rating);
    const commentCheck = validateComment(req.body.comment);
    const errors = [];
    if (!ratingCheck.valid) errors.push(ratingCheck.message);
    if (!commentCheck.valid) errors.push(commentCheck.message);

    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        message: errors.join(', '),
      });
    }

    // Explicit pre-check for a clear, friendly conflict message — the
    // unique compound index on (customer, product) is still the real
    // backstop against a race between two concurrent requests (see
    // the E11000 catch below).
    const existing = await Review.findOne({ customer: req.customer.id, product: productId });
    if (existing) {
      return res.status(409).json({
        success: false,
        message: 'You have already reviewed this product',
      });
    }

    let review;
    try {
      review = await Review.create({
        customer: req.customer.id,
        product: productId,
        rating: ratingCheck.value,
        comment: commentCheck.value,
      });
    } catch (err) {
      if (err.code === 11000) {
        return res.status(409).json({
          success: false,
          message: 'You have already reviewed this product',
        });
      }
      throw err;
    }

    await review.populate('customer', 'name');

    return res.status(201).json({
      success: true,
      message: 'Review submitted successfully',
      data: { review },
    });
  } catch (error) {
    if (error.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        message: Object.values(error.errors)
          .map((e) => e.message)
          .join(', '),
      });
    }
    return next(error);
  }
}

async function getProductReviews(req, res, next) {
  try {
    const { productId } = req.params;

    if (!isValidObjectId(productId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid product ID',
      });
    }

    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found',
      });
    }

    const { page, limit, skip } = parsePagination(req.query);
    const filter = { product: productId, isApproved: true };

    const [reviews, totalCount, summaryAgg] = await Promise.all([
      Review.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('customer', 'name'),
      Review.countDocuments(filter),
      Review.aggregate([
        { $match: { product: new mongoose.Types.ObjectId(productId), isApproved: true } },
        { $group: { _id: null, averageRating: { $avg: '$rating' }, reviewCount: { $sum: 1 } } },
      ]),
    ]);

    const summary = summaryAgg[0]
      ? {
          averageRating: Math.round(summaryAgg[0].averageRating * 10) / 10,
          reviewCount: summaryAgg[0].reviewCount,
        }
      : { averageRating: 0, reviewCount: 0 };

    return res.status(200).json({
      success: true,
      data: {
        reviews,
        summary,
        pagination: {
          page,
          limit,
          totalCount,
          totalPages: Math.max(1, Math.ceil(totalCount / limit)),
        },
      },
    });
  } catch (error) {
    return next(error);
  }
}

async function updateReview(req, res, next) {
  try {
    const { reviewId } = req.params;

    if (!isValidObjectId(reviewId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid review ID',
      });
    }

    const review = await Review.findById(reviewId);

    if (!review) {
      return res.status(404).json({
        success: false,
        message: 'Review not found',
      });
    }

    if (review.customer.toString() !== req.customer.id.toString()) {
      // Same "not found" shape as Order/Reservation ownership checks
      // elsewhere in this project — don't reveal existence to a
      // non-owner.
      return res.status(404).json({
        success: false,
        message: 'Review not found',
      });
    }

    const updates = {};
    const errors = [];

    if (req.body.rating !== undefined) {
      const ratingCheck = validateRating(req.body.rating);
      if (!ratingCheck.valid) errors.push(ratingCheck.message);
      else updates.rating = ratingCheck.value;
    }

    if (req.body.comment !== undefined) {
      const commentCheck = validateComment(req.body.comment);
      if (!commentCheck.valid) errors.push(commentCheck.message);
      else updates.comment = commentCheck.value;
    }

    // customer/product are never accepted from the body — intentionally
    // not read from req.body at all above.

    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        message: errors.join(', '),
      });
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No valid fields provided to update',
      });
    }

    Object.assign(review, updates);
    await review.save();
    await review.populate('customer', 'name');

    return res.status(200).json({
      success: true,
      message: 'Review updated successfully',
      data: { review },
    });
  } catch (error) {
    if (error.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        message: Object.values(error.errors)
          .map((e) => e.message)
          .join(', '),
      });
    }
    return next(error);
  }
}

async function deleteReview(req, res, next) {
  try {
    const { reviewId } = req.params;

    if (!isValidObjectId(reviewId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid review ID',
      });
    }

    const review = await Review.findById(reviewId);

    if (!review) {
      return res.status(404).json({
        success: false,
        message: 'Review not found',
      });
    }

    if (review.customer.toString() !== req.customer.id.toString()) {
      return res.status(404).json({
        success: false,
        message: 'Review not found',
      });
    }

    await Review.findByIdAndDelete(reviewId);

    return res.status(200).json({
      success: true,
      message: 'Review deleted successfully',
    });
  } catch (error) {
    return next(error);
  }
}

// --- Admin ---

async function adminListReviews(req, res, next) {
  try {
    const filter = {};
    if (req.query.product) {
      if (!isValidObjectId(req.query.product)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid product ID in filter',
        });
      }
      filter.product = req.query.product;
    }
    if (req.query.rating !== undefined) {
      const ratingCheck = validateRating(req.query.rating);
      if (!ratingCheck.valid) {
        return res.status(400).json({
          success: false,
          message: ratingCheck.message,
        });
      }
      filter.rating = ratingCheck.value;
    }
    if (req.query.isApproved !== undefined) {
      if (req.query.isApproved === 'true') filter.isApproved = true;
      else if (req.query.isApproved === 'false') filter.isApproved = false;
    }

    const { page, limit, skip } = parsePagination(req.query);

    const [reviews, totalCount] = await Promise.all([
      Review.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('customer', 'name email')
        .populate('product', 'name'),
      Review.countDocuments(filter),
    ]);

    return res.status(200).json({
      success: true,
      data: {
        reviews,
        pagination: {
          page,
          limit,
          totalCount,
          totalPages: Math.max(1, Math.ceil(totalCount / limit)),
        },
      },
    });
  } catch (error) {
    return next(error);
  }
}

async function adminGetReviewById(req, res, next) {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid review ID',
      });
    }

    const review = await Review.findById(id)
      .populate('customer', 'name email')
      .populate('product', 'name');

    if (!review) {
      return res.status(404).json({
        success: false,
        message: 'Review not found',
      });
    }

    return res.status(200).json({
      success: true,
      data: { review },
    });
  } catch (error) {
    return next(error);
  }
}

async function adminDeleteReview(req, res, next) {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid review ID',
      });
    }

    const review = await Review.findByIdAndDelete(id);

    if (!review) {
      return res.status(404).json({
        success: false,
        message: 'Review not found',
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Review removed successfully',
    });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  createReview,
  getProductReviews,
  updateReview,
  deleteReview,
  adminListReviews,
  adminGetReviewById,
  adminDeleteReview,
};
