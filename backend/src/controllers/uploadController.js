// src/controllers/uploadController.js
//
// Handles POST /api/v1/uploads/product-image. Admin-only (see
// routes/uploadRoutes.js — authMiddleware is applied there exactly
// as it is on the existing product create/update/delete routes).
//
// Flow: multer (middleware/upload.js) puts the validated file in
// req.file.buffer -> this streams that buffer to Cloudinary -> we
// return the permanent secure_url. Nothing is written to disk and
// nothing is stored in MongoDB here — the frontend takes the
// returned URL and sends it to the EXISTING product create/update
// endpoints as the product's `image` field, unchanged.

const streamifier = require('streamifier');
const { cloudinary, isCloudinaryConfigured } = require('../config/cloudinary');

const UPLOAD_FOLDER = 'amber-and-ash/products';

function streamUpload(buffer) {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      { folder: UPLOAD_FOLDER, resource_type: 'image' },
      (error, result) => {
        if (error) return reject(error);
        return resolve(result);
      }
    );
    streamifier.createReadStream(buffer).pipe(uploadStream);
  });
}

async function uploadProductImage(req, res, next) {
  try {
    if (!isCloudinaryConfigured()) {
      return res.status(500).json({
        success: false,
        message:
          'Image uploads are not configured on the server yet (missing Cloudinary credentials).',
      });
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No image file was received. Please choose a JPG, PNG, or WebP image.',
      });
    }

    const result = await streamUpload(req.file.buffer);

    return res.status(201).json({
      success: true,
      message: 'Image uploaded successfully',
      data: {
        url: result.secure_url,
        publicId: result.public_id,
      },
    });
  } catch (error) {
    // Never leak Cloudinary/internal error details to the client.
    console.error('❌ Cloudinary upload error:', error.message);
    return res.status(502).json({
      success: false,
      message: 'Image upload failed. Please try again.',
    });
  }
}

module.exports = { uploadProductImage, UPLOAD_FOLDER };
