// src/utils/generateToken.js
//
// Small helper responsible only for signing JWTs. Keeps the shape of
// the token payload in one place instead of duplicated across
// controllers/middleware.

// src/utils/generateToken.js

const jwt = require('jsonwebtoken');
const config = require('../config/env');

function generateToken(admin) {
  const payload = {
    id: admin._id,
    role: admin.role,
  };

  return jwt.sign(payload, config.jwtSecret, {
    expiresIn: config.jwtExpiresIn,
  });
}

module.exports = generateToken;
