// src/config/db.js
//
// The ONLY place in the application that talks to Mongoose's
// connect/disconnect API. Every other module (server.js, app.js,
// controllers, routes, future models) must go through this file
// instead of calling mongoose.connect() directly.

const mongoose = require('mongoose');
const config = require('./env');

async function connectDatabase() {
  try {
    // Mongoose 8's default options are already sensible, so no extra
    // flags are required here. Keeping this call minimal makes it
    // easy to extend later (e.g. connection pooling options) without
    // duplicating connection logic elsewhere.
    await mongoose.connect(config.mongodbUri);

    console.log(`✅ MongoDB connected: ${mongoose.connection.host}`);

    return mongoose.connection;
  } catch (error) {
    console.error('❌ MongoDB connection failed:', error.message);
    // Do not let the app pretend the database is up. Fail the startup.
    throw error;
  }
}

module.exports = connectDatabase;
