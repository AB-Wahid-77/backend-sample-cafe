// src/models/Admin.js
//
// Uses the single, existing Mongoose connection established in
// src/config/db.js — this file does not connect to the database
// itself, it only defines a schema/model on the default connection.

const mongoose = require('mongoose');

const adminSchema = new mongoose.Schema(
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
    role: {
      type: String,
      default: 'admin',
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

module.exports = mongoose.model('Admin', adminSchema);
