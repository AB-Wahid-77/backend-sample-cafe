// src/controllers/customerAuthController.js
//
// Mirrors the response/validation conventions of src/controllers/authController.js
// (admin) but for the separate Customer model. Reuses the existing
// bcryptjs and generateToken (JWT) infrastructure — no second auth
// system.

const bcrypt = require('bcryptjs');
const Customer = require('../models/Customer');
const Order = require('../models/Order');
const generateToken = require('../utils/generateToken');

const INVALID_CREDENTIALS_MESSAGE = 'Invalid email or password';
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function sanitizeCustomer(customer) {
  return {
    id: customer._id,
    name: customer.name,
    email: customer.email,
    phone: customer.phone,
    isActive: customer.isActive,
    createdAt: customer.createdAt,
    updatedAt: customer.updatedAt,
  };
}

async function register(req, res, next) {
  try {
    const { name, email, password, phone } = req.body;

    const errors = [];
    if (typeof name !== 'string' || !name.trim()) errors.push('name is required');
    if (typeof email !== 'string' || !email.trim() || !EMAIL_REGEX.test(email.trim())) {
      errors.push('a valid email is required');
    }
    if (typeof password !== 'string' || password.length < 8) {
      errors.push('password must be at least 8 characters');
    }
    if (phone !== undefined && typeof phone !== 'string') {
      errors.push('phone must be a string');
    }

    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        message: errors.join(', '),
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    const existing = await Customer.findOne({ email: normalizedEmail });
    if (existing) {
      return res.status(409).json({
        success: false,
        message: 'An account with this email already exists',
      });
    }

    const salt = await bcrypt.genSalt(12);
    const hashedPassword = await bcrypt.hash(password, salt);

    const customer = await Customer.create({
      name: name.trim(),
      email: normalizedEmail,
      password: hashedPassword,
      phone: (phone || '').trim(),
      isActive: true,
    });

    return res.status(201).json({
      success: true,
      message: 'Account created successfully',
      data: { customer: sanitizeCustomer(customer) },
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: 'An account with this email already exists',
      });
    }
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

async function login(req, res, next) {
  try {
    const { email, password } = req.body;

    if (!email || !password || typeof email !== 'string' || typeof password !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required',
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    const customer = await Customer.findOne({ email: normalizedEmail }).select('+password');

    if (!customer) {
      return res.status(401).json({
        success: false,
        message: INVALID_CREDENTIALS_MESSAGE,
      });
    }

    if (!customer.isActive) {
      return res.status(401).json({
        success: false,
        message: INVALID_CREDENTIALS_MESSAGE,
      });
    }

    const passwordMatches = await bcrypt.compare(password, customer.password);

    if (!passwordMatches) {
      return res.status(401).json({
        success: false,
        message: INVALID_CREDENTIALS_MESSAGE,
      });
    }

    // generateToken only reads ._id and .role — pass role: 'customer'
    // explicitly to reuse the exact same signing function used for
    // admins without modifying it.
    const token = generateToken({ _id: customer._id, role: 'customer' });

    return res.status(200).json({
      success: true,
      message: 'Login successful',
      data: {
        token,
        customer: sanitizeCustomer(customer),
      },
    });
  } catch (error) {
    return next(error);
  }
}

function getMe(req, res) {
  // req.customer is attached by customerAuthMiddleware, already
  // stripped of the password hash.
  return res.status(200).json({
    success: true,
    data: { customer: req.customer },
  });
}

async function updateMe(req, res, next) {
  try {
    const { name, phone } = req.body;
    const updates = {};

    if (name !== undefined) {
      if (typeof name !== 'string' || !name.trim()) {
        return res.status(400).json({
          success: false,
          message: 'name must be a non-empty string',
        });
      }
      updates.name = name.trim();
    }

    if (phone !== undefined) {
      if (typeof phone !== 'string') {
        return res.status(400).json({
          success: false,
          message: 'phone must be a string',
        });
      }
      updates.phone = phone.trim();
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No valid fields provided to update',
      });
    }

    const customer = await Customer.findByIdAndUpdate(req.customer.id, updates, {
      new: true,
      runValidators: true,
    });

    if (!customer) {
      return res.status(404).json({
        success: false,
        message: 'Customer not found',
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      data: { customer: sanitizeCustomer(customer) },
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

async function changePassword(req, res, next) {
  try {
    const { currentPassword, newPassword } = req.body;

    if (typeof currentPassword !== 'string' || !currentPassword) {
      return res.status(400).json({
        success: false,
        message: 'currentPassword is required',
      });
    }
    if (typeof newPassword !== 'string' || newPassword.length < 8) {
      return res.status(400).json({
        success: false,
        message: 'newPassword must be at least 8 characters',
      });
    }

    const customer = await Customer.findById(req.customer.id).select('+password');

    if (!customer) {
      return res.status(404).json({
        success: false,
        message: 'Customer not found',
      });
    }

    const passwordMatches = await bcrypt.compare(currentPassword, customer.password);
    if (!passwordMatches) {
      return res.status(401).json({
        success: false,
        message: 'Current password is incorrect',
      });
    }

    const salt = await bcrypt.genSalt(12);
    customer.password = await bcrypt.hash(newPassword, salt);
    await customer.save();

    return res.status(200).json({
      success: true,
      message: 'Password changed successfully',
    });
  } catch (error) {
    return next(error);
  }
}

function logout(req, res) {
  // JWTs in this project are stateless (no token blacklist/session
  // store exists anywhere in the codebase). There is nothing for the
  // server to invalidate. "Logout" here simply confirms the request
  // was authenticated; the client is responsible for discarding the
  // token. If real server-side invalidation is needed later, it would
  // require adding a token blacklist/session store, which is out of
  // scope for Part 5.
  return res.status(200).json({
    success: true,
    message: 'Logged out. Please discard your token on the client.',
  });
}

async function getOrderHistory(req, res, next) {
  try {
    const orders = await Order.find({ customer: req.customer.id }).sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: orders.length,
      data: { orders },
    });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  register,
  login,
  getMe,
  updateMe,
  changePassword,
  logout,
  getOrderHistory,
};
