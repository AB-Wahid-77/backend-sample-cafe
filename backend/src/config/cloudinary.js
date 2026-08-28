// src/config/cloudinary.js
//
// Configures the Cloudinary SDK from environment variables (see
// config/env.js / .env.example). Used only by the product-image
// upload feature (routes/uploadRoutes.js). Does not touch any other
// part of the app — importing this file has no side effects beyond
// setting Cloudinary's global config object.

const cloudinary = require('cloudinary').v2;
const config = require('./env');

function isCloudinaryConfigured() {
  return Boolean(
    config.cloudinaryCloudName && config.cloudinaryApiKey && config.cloudinaryApiSecret
  );
}

if (isCloudinaryConfigured()) {
  cloudinary.config({
    cloud_name: config.cloudinaryCloudName,
    api_key: config.cloudinaryApiKey,
    api_secret: config.cloudinaryApiSecret,
    secure: true,
  });
} else {
  // Do not throw here — the server should still boot (e.g. for
  // anyone who hasn't set up image uploads yet). The upload route
  // itself checks isCloudinaryConfigured() and returns a clear 500
  // instead of a confusing Cloudinary SDK error.
  console.warn(
    '⚠️  Cloudinary is not configured (CLOUDINARY_CLOUD_NAME/API_KEY/API_SECRET missing). ' +
      'Product image uploads will fail until these are set in .env.'
  );
}

module.exports = { cloudinary, isCloudinaryConfigured };
