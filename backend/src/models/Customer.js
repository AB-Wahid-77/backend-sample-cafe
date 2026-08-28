// src/models/Customer.js
//
// A separate model from Admin — customers and admins are distinct
// user types with distinct auth flows. Uses the single, existing
// Mongoose connection from src/config/db.js; no mongoose.connect()
// here.

const mongoose = require('mongoose');

const customerSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      select: false, // never returned by default in queries
    },
    phone: {
      type: String,
      trim: true,
      default: '',
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true, // adds createdAt / updatedAt
  }
);

module.exports = mongoose.model('Customer', customerSchema);
