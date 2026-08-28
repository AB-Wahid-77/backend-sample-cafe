// src/controllers/authController.js

const bcrypt = require('bcryptjs');
const Admin = require('../models/Admin');
const generateToken = require('../utils/generateToken');

// Generic message used for every credential failure so we never
// reveal whether the email exists or the password was wrong.
const INVALID_CREDENTIALS_MESSAGE = 'Invalid email or password';

function sanitizeAdmin(admin) {
  return {
    id: admin._id,
    name: admin.name,
    email: admin.email,
    role: admin.role,
  };
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

    // password has `select: false` in the schema, so it must be
    // explicitly requested here for comparison.
    const admin = await Admin.findOne({ email: normalizedEmail }).select('+password');

    if (!admin) {
      return res.status(401).json({
        success: false,
        message: INVALID_CREDENTIALS_MESSAGE,
      });
    }

    if (!admin.isActive) {
      // Deliberately generic — do not reveal that the account is
      // disabled specifically.
      return res.status(401).json({
        success: false,
        message: INVALID_CREDENTIALS_MESSAGE,
      });
    }

    const passwordMatches = await bcrypt.compare(password, admin.password);

    if (!passwordMatches) {
      return res.status(401).json({
        success: false,
        message: INVALID_CREDENTIALS_MESSAGE,
      });
    }

    const token = generateToken(admin);

    return res.status(200).json({
      success: true,
      message: 'Login successful',
      data: {
        token,
        admin: sanitizeAdmin(admin),
      },
    });
  } catch (error) {
    return next(error);
  }
}

function getMe(req, res) {
  // req.admin is attached by authMiddleware, already stripped of
  // the password hash.
  return res.status(200).json({
    success: true,
    data: {
      admin: req.admin,
    },
  });
}

module.exports = { login, getMe };
