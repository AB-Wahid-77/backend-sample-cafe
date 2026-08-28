// src/middleware/notFound.js
//
// Catches any request that didn't match a route above it and returns
// a consistent JSON 404 instead of Express's default HTML page.

function notFound(req, res, next) {
  res.status(404).json({
    success: false,
    message: 'Route not found',
  });
}

module.exports = notFound;
