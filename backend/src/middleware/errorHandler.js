// src/middleware/errorHandler.js
//
// Centralized error handler. Every error in the application should
// eventually flow through here (via next(err) or a thrown error in
// an async route handled by an async wrapper in a later part).

const config = require('../config/env');

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  const statusCode = err.statusCode && err.statusCode >= 400 ? err.statusCode : 500;

  console.error('❌ Error:', err.message);

  const response = {
    success: false,
    message: err.message || 'Internal server error',
  };

  // Never leak stack traces outside of development.
  if (!config.isProduction && err.stack) {
    response.stack = err.stack;
  }

  res.status(statusCode).json(response);
}

module.exports = errorHandler;
