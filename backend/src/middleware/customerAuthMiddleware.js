// src/middleware/customerAuthMiddleware.js
//
// Protects customer-only routes by requiring a valid JWT in the
// Authorization header (Bearer scheme). Mirrors the structure of the
// existing src/middleware/authMiddleware.js (admin) but resolves
// against the Customer collection instead, and additionally checks
// the token's role claim so an admin token is rejected here even in
// the (extremely unlikely) case its id collided with a customer's.
// On success, attaches a safe (no password) customer object to
// req.customer. Uses the SAME jwt.verify + config.jwtSecret as the
// existing admin middleware — no second JWT system.

const jwt = require('jsonwebtoken');
const Customer = require('../models/Customer');
const config = require('../config/env');

async function customerAuthMiddleware(req, res, next) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Not authorized, no token provided',
      });
    }

    const token = authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Not authorized, no token provided',
      });
    }

    let decoded;
    try {
      decoded = jwt.verify(token, config.jwtSecret);
    } catch (err) {
      return res.status(401).json({
        success: false,
        message: 'Not authorized, invalid or expired token',
      });
    }

    if (decoded.role !== 'customer') {
      return res.status(401).json({
        success: false,
        message: 'Not authorized, customer access required',
      });
    }

    const customer = await Customer.findById(decoded.id);

    if (!customer) {
      return res.status(401).json({
        success: false,
        message: 'Not authorized, customer no longer exists',
      });
    }

    if (!customer.isActive) {
      return res.status(401).json({
        success: false,
        message: 'Not authorized, account is inactive',
      });
    }

    req.customer = {
      id: customer._id,
      name: customer.name,
      email: customer.email,
      phone: customer.phone,
      isActive: customer.isActive,
      createdAt: customer.createdAt,
      updatedAt: customer.updatedAt,
    };

    return next();
  } catch (error) {
    return next(error);
  }
}

module.exports = customerAuthMiddleware;
