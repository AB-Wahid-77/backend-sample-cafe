// src/models/Review.js
//
// Uses the single, existing Mongoose connection — no mongoose.connect()
// here. References the existing Customer and Product models rather
// than duplicating their data.

const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema(
  {
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Customer',
      required: true,
    },
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
    },
    rating: {
      type: Number,
      required: [true, 'Rating is required'],
      min: [1, 'Rating must be at least 1'],
      max: [5, 'Rating cannot exceed 5'],
      validate: {
        validator: Number.isInteger,
        message: 'Rating must be a whole number',
      },
    },
    comment: {
      type: String,
      trim: true,
      maxlength: [1000, 'Comment cannot exceed 1000 characters'],
      default: '',
    },
    // Simple moderation flag (per prompt: default true, not an
    // elaborate moderation engine). Public listing only shows
    // isApproved: true reviews; admin can flip this or delete outright.
    isApproved: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

// One review per customer per product — enforced at the database
// level, not just in the controller.
reviewSchema.index({ customer: 1, product: 1 }, { unique: true });
reviewSchema.index({ product: 1, createdAt: -1 });
reviewSchema.index({ isApproved: 1 });

module.exports = mongoose.model('Review', reviewSchema);
