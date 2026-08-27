// src/middleware/optionalCustomerAuth.js
//
// Additive, optional-auth counterpart to customerAuthMiddleware.js —
// same relationship as the existing src/middleware/optionalAuth.js has
// to authMiddleware.js (admin). Used on cart/order routes that must
// keep working for anonymous guests (X-Guest-Id header) while also
// letting an authenticated customer use the same endpoints under
// their own account. If a valid customer Bearer token is present,
// req.customer is set exactly the way customerAuthMiddleware sets it;
// otherwise the request just continues unauthenticated so the
// existing guest-id flow takes over (see src/utils/getGuestId.js).

const jwt = require('jsonwebtoken');
const Customer = require('../models/Customer');
const config = require('../config/env');

async function optionalCustomerAuth(req, res, next) {
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

    if (decoded.role !== 'customer') {
      return next();
    }

    const customer = await Customer.findById(decoded.id);
    if (customer && customer.isActive) {
      req.customer = {
        id: customer._id,
        name: customer.name,
        email: customer.email,
        phone: customer.phone,
        isActive: customer.isActive,
        createdAt: customer.createdAt,
        updatedAt: customer.updatedAt,
      };
    }

    return next();
  } catch (error) {
    return next(error);
  }
}

module.exports = optionalCustomerAuth;
