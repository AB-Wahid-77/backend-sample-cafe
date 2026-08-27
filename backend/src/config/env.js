// src/config/env.js

const dotenv = require('dotenv');

dotenv.config();

const REQUIRED_VARS = ['PORT', 'NODE_ENV', 'MONGODB_URI', 'JWT_SECRET'];

function validateEnv() {
  const missing = REQUIRED_VARS.filter((key) => {
    const value = process.env[key];
    return value === undefined || value === null || value.trim() === '';
  });

  if (missing.length > 0) {
    console.error('❌ Missing required environment variable(s):', missing.join(', '));
    console.error('   Check your .env file against .env.example.');
    process.exit(1);
  }
}

validateEnv();

const config = {
  port: process.env.PORT,
  nodeEnv: process.env.NODE_ENV,
  mongodbUri: process.env.MONGODB_URI,
  jwtSecret: process.env.JWT_SECRET,          // <-- Added this
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '1d', // <-- Added this
  isProduction: process.env.NODE_ENV === 'production',
  // Product image uploads — intentionally NOT in REQUIRED_VARS above.
  // The server still boots without these; only the upload endpoint
  // (src/routes/uploadRoutes.js) fails, with a clear message, until
  // they're set.
  cloudinaryCloudName: process.env.CLOUDINARY_CLOUD_NAME,
  cloudinaryApiKey: process.env.CLOUDINARY_API_KEY,
  cloudinaryApiSecret: process.env.CLOUDINARY_API_SECRET,
};

module.exports = config;

