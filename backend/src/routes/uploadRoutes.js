// src/routes/uploadRoutes.js
//
// Single new route this feature adds: POST /api/v1/uploads/product-image
// — admin-only (reuses the existing authMiddleware exactly as the
// product create/update/delete routes do). Does not touch product
// creation itself; the frontend uploads the image here first, gets
// back a permanent URL, then sends that URL to the existing
// POST/PATCH /products endpoints unchanged.

const express = require('express');
const multer = require('multer');
const authMiddleware = require('../middleware/authMiddleware');
const { upload } = require('../middleware/upload');
const { uploadProductImage } = require('../controllers/uploadController');

const router = express.Router();

function handleUpload(req, res, next) {
  upload.single('image')(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      const message =
        err.code === 'LIMIT_FILE_SIZE'
          ? 'Please select a JPG, PNG, or WebP image under 5 MB.'
          : 'Could not process the uploaded file. Please try again.';
      return res.status(400).json({ success: false, message });
    }
    if (err) {
      // Thrown by fileFilter in middleware/upload.js for a rejected
      // (non-JPG/PNG/WebP) file type — already has a clear message.
      return res.status(err.statusCode || 400).json({ success: false, message: err.message });
    }
    return next();
  });
}

router.post('/product-image', authMiddleware, handleUpload, uploadProductImage);

module.exports = router;
