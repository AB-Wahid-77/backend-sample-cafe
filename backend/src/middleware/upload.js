// src/middleware/upload.js
//
// Multer middleware for the product-image upload endpoint
// (routes/uploadRoutes.js) only. Uses memory storage — the file is
// held in a buffer just long enough to stream to Cloudinary in
// uploadController.js; it is never written to disk and never saved
// to MongoDB as binary/Base64.

const multer = require('multer');

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

const storage = multer.memoryStorage();

function fileFilter(req, file, cb) {
  if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    const err = new Error('Please select a JPG, PNG, or WebP image under 5 MB.');
    err.statusCode = 400;
    return cb(err);
  }
  return cb(null, true);
}

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: MAX_FILE_SIZE_BYTES, files: 1 },
});

module.exports = { upload, ALLOWED_MIME_TYPES, MAX_FILE_SIZE_BYTES };
