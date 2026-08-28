// src/models/Product.js
//
// Uses the single, existing Mongoose connection established in
// src/config/db.js — this file does not connect to the database
// itself, it only defines a schema/model on the default connection.

const mongoose = require('mongoose');

// Matches the café's current menu categories.
const PRODUCT_CATEGORIES = [
  'Coffee',
  'Tea',
  'Dessert',
  'Snacks',
  'Cold Drinks',
  'Special Drinks',
];

const productSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
    },
    description: {
      type: String,
      required: [true, 'Description is required'],
      trim: true,
    },
    price: {
      type: Number,
      required: [true, 'Price is required'],
      min: [0, 'Price must be greater than or equal to 0'],
    },
    category: {
      type: String,
      required: [true, 'Category is required'],
      trim: true,
      enum: {
        values: PRODUCT_CATEGORIES,
        message: '{VALUE} is not a supported category',
      },
    },
    image: {
      // URL/path only — no file upload handling in Part 3.
      type: String,
      trim: true,
      default: '',
    },
    isAvailable: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true, // adds createdAt / updatedAt
  }
);

// Useful, non-excessive indexes for the query patterns Part 3
// actually needs (filter by category/availability, text search by name).
productSchema.index({ category: 1 });
productSchema.index({ isAvailable: 1 });
productSchema.index({ name: 'text' });

productSchema.statics.CATEGORIES = PRODUCT_CATEGORIES;

module.exports = mongoose.model('Product', productSchema);
