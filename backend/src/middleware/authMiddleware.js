// src/middleware/authMiddleware.js
//
// Protects routes by requiring a valid JWT in the Authorization
// header (Bearer scheme). On success, attaches a safe (no password)
// admin object to req.admin.

const jwt = require('jsonwebtoken');
const Admin = require('../models/Admin');
const config = require('../config/env');

async function authMiddleware(req, res, next) {
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
      // Covers malformed, invalid signature, and expired tokens —
      // never leak the JWT secret or verification internals.
      return res.status(401).json({
        success: false,
        message: 'Not authorized, invalid or expired token',
      });
    }

    const admin = await Admin.findById(decoded.id);

    if (!admin) {
      return res.status(401).json({
        success: false,
        message: 'Not authorized, admin no longer exists',
      });
    }

    if (!admin.isActive) {
      return res.status(401).json({
        success: false,
        message: 'Not authorized, account is inactive',
      });
    }

    // Attach only safe fields — password is excluded by the schema's
    // select: false by default (findById doesn't request it).
    req.admin = {
      id: admin._id,
      name: admin.name,
      email: admin.email,
      role: admin.role,
    };

    return next();
  } catch (error) {
    return next(error);
  }
}

module.exports = authMiddleware;
