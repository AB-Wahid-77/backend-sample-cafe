// src/middleware/optionalAuth.js
//
// A separate, additive middleware for the few Part 4 routes that must
// work for BOTH an unauthenticated guest (identified by X-Guest-Id)
// and an authenticated admin (identified by JWT) — e.g. viewing or
// cancelling an order. This does NOT replace or modify the existing
// authMiddleware.js, which still fully protects the admin-only order
// routes below. If a valid Bearer token is present, req.admin is set
// exactly the way authMiddleware sets it; if not, the request simply
// continues unauthenticated so the guest-ownership check in the
// controller can take over.

const jwt = require('jsonwebtoken');
const Admin = require('../models/Admin');
const config = require('../config/env');

async function optionalAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next();
    }

    const token = authHeader.split(' ')[1];
    if (!token) return next();

    let decoded;
    try {
      decoded = jwt.verify(token, config.jwtSecret);
    } catch (err) {
      // Invalid/expired token on an optional-auth route just means
      // "treat as unauthenticated" — not a hard failure.
      return next();
    }

    const admin = await Admin.findById(decoded.id);
    if (admin && admin.isActive) {
      req.admin = {
        id: admin._id,
        name: admin.name,
        email: admin.email,
        role: admin.role,
      };
    }

    return next();
  } catch (error) {
    return next(error);
  }
}

module.exports = optionalAuth;
