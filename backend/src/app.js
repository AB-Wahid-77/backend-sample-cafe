// src/app.js
//
// Configures the Express application: middleware, routes, and error
// handling. This file builds and exports the app — it does NOT call
// app.listen(). Starting the HTTP server is server.js's job.

const express = require('express');
const cors = require('cors');

const apiRoutes = require('./routes');
const notFound = require('./middleware/notFound');
const errorHandler = require('./middleware/errorHandler');

const app = express();

// --- Core middleware ---
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// CORS: open for local development. Restrict `origin` to the
// production frontend URL when that's known — this is the one line
// to change later.
app.use(cors());

// --- Root route ---
app.get('/', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Amber & Ash API',
  });
});

// --- Versioned API routes ---
app.use('/api/v1', apiRoutes);

// --- 404 handler (must come after all valid routes) ---
app.use(notFound);

// --- Centralized error handler (must be last) ---
app.use(errorHandler);

module.exports = app;
