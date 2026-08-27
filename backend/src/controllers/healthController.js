// src/controllers/healthController.js

const mongoose = require('mongoose');
const config = require('../config/env');

// Mongoose readyState values: 0 = disconnected, 1 = connected,
// 2 = connecting, 3 = disconnecting. We map this to a human-readable
// status instead of ever hard-coding "connected".
const READY_STATE_MAP = {
  0: 'disconnected',
  1: 'connected',
  2: 'connecting',
  3: 'disconnecting',
};

function getHealth(req, res) {
  const dbStatus = READY_STATE_MAP[mongoose.connection.readyState] || 'unknown';

  res.status(200).json({
    success: true,
    message: 'Amber & Ash API is running',
    database: dbStatus,
    environment: config.nodeEnv,
  });
}

module.exports = { getHealth };
