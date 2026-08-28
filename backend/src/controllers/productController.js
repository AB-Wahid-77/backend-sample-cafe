// src/controllers/productController.js

const mongoose = require('mongoose');
const Product = require('../models/Product');
const { cloudinary, isCloudinaryConfigured } = require('../config/cloudinary');
const { UPLOAD_FOLDER } = require('./uploadController');

// Best-effort Cloudinary cleanup on product delete. There is no
// separate "imagePublicId" field on the Product model (the task
// explicitly asks not to invent one) — the public_id is derived from
// the existing `image` URL string instead, only when that URL is
// actually one of ours (under UPLOAD_FOLDER). Old/unrelated image
// URLs (e.g. picsum fallback links from before this feature existed)
// are silently left alone. Any failure here is logged and swallowed
// — it must never block the product delete itself.
function extractCloudinaryPublicId(imageUrl) {
  if (typeof imageUrl !== 'string' || !imageUrl.includes('res.cloudinary.com')) return null;
  const marker = `/${UPLOAD_FOLDER}/`;
  const idx = imageUrl.indexOf(marker);
  if (idx === -1) return null;
  const afterFolder = imageUrl.slice(idx + 1); // "amber-and-ash/products/abc123.jpg"
  const withoutExtension = afterFolder.replace(/\.[a-zA-Z0-9]+($|\?.*$)/, '');
  return withoutExtension || null;
}

async function deleteCloudinaryImageIfOwned(imageUrl) {
  if (!isCloudinaryConfigured()) return;
  const publicId = extractCloudinaryPublicId(imageUrl);
  if (!publicId) return;
  try {
    await cloudinary.uploader.destroy(publicId);
  } catch (err) {
    console.warn('⚠️  Could not delete Cloudinary image (non-blocking):', err.message);
  }
}

function isValidObjectId(id) {
  return mongoose.Types.ObjectId.isValid(id);
}

function validateProductInput(body, { partial = false } = {}) {
  const errors = [];
  const data = {};

  // name
  if (!partial || body.name !== undefined) {
    if (typeof body.name !== 'string' || !body.name.trim()) {
      errors.push('name is required');
    } else {
      data.name = body.name.trim();
    }
  }

  // description
  if (!partial || body.description !== undefined) {
    if (typeof body.description !== 'string' || !body.description.trim()) {
      errors.push('description is required');
    } else {
      data.description = body.description.trim();
    }
  }

  // price
  if (!partial || body.price !== undefined) {
    const price = Number(body.price);
    if (body.price === undefined || body.price === null || Number.isNaN(price) || price < 0) {
      errors.push('price must be a number greater than or equal to 0');
    } else {
      data.price = price;
    }
  }

  // category
  if (!partial || body.category !== undefined) {
    if (typeof body.category !== 'string' || !body.category.trim()) {
      errors.push('category is required');
    } else {
      data.category = body.category.trim();
    }
  }

  // image (optional)
  if (body.image !== undefined) {
    if (body.image !== null && typeof body.image !== 'string') {
      errors.push('image must be a string URL/path');
    } else {
      data.image = body.image || '';
    }
  }

  // isAvailable (optional, but must be boolean when supplied)
  if (body.isAvailable !== undefined) {
    if (typeof body.isAvailable !== 'boolean') {
      errors.push('isAvailable must be true or false');
    } else {
      data.isAvailable = body.isAvailable;
    }
  }

  return { errors, data };
}

async function createProduct(req, res, next) {
  try {
    const { errors, data } = validateProductInput(req.body);

    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        message: errors.join(', '),
      });
    }

    const product = await Product.create(data);

    return res.status(201).json({
      success: true,
      message: 'Product created successfully',
      data: { product },
    });
  } catch (error) {
    if (error.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        message: Object.values(error.errors)
          .map((e) => e.message)
          .join(', '),
      });
    }
    return next(error);
  }
}

async function getProducts(req, res, next) {
  try {
    const { category, search, isAvailable } = req.query;
    const filter = {};

    if (category) {
      filter.category = category;
    }

    if (isAvailable !== undefined) {
      if (isAvailable === 'true') {
        filter.isAvailable = true;
      } else if (isAvailable === 'false') {
        filter.isAvailable = false;
      }
      // any other value is ignored rather than erroring, to keep
      // the filtering simple.
    }

    if (search) {
      // Simple, practical search: case-insensitive match on name or
      // description. Avoids requiring the text index to be built,
      // and works for partial matches like the frontend would need.
      const regex = new RegExp(search.trim(), 'i');
      filter.$or = [{ name: regex }, { description: regex }];
    }

    const products = await Product.find(filter).sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: products.length,
      data: { products },
    });
  } catch (error) {
    return next(error);
  }
}

async function getProductById(req, res, next) {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid product ID',
      });
    }

    const product = await Product.findById(id);

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found',
      });
    }

    return res.status(200).json({
      success: true,
      data: { product },
    });
  } catch (error) {
    return next(error);
  }
}

async function updateProduct(req, res, next) {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid product ID',
      });
    }

    // _id, createdAt, updatedAt are never accepted from the client —
    // only the fields below are considered.
    const { errors, data } = validateProductInput(req.body, { partial: true });

    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        message: errors.join(', '),
      });
    }

    if (Object.keys(data).length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No valid fields provided to update',
      });
    }

    const product = await Product.findByIdAndUpdate(id, data, {
      new: true,
      runValidators: true,
    });

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found',
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Product updated successfully',
      data: { product },
    });
  } catch (error) {
    if (error.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        message: Object.values(error.errors)
          .map((e) => e.message)
          .join(', '),
      });
    }
    return next(error);
  }
}

async function deleteProduct(req, res, next) {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid product ID',
      });
    }

    const product = await Product.findByIdAndDelete(id);

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found',
      });
    }

    // Non-blocking — the product is already deleted from MongoDB
    // (and therefore off the public menu) regardless of whether this
    // succeeds.
    await deleteCloudinaryImageIfOwned(product.image);

    return res.status(200).json({
      success: true,
      message: 'Product deleted successfully',
    });
  } catch (error) {
    return next(error);
  }
}

async function toggleProductAvailability(req, res, next) {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid product ID',
      });
    }

    if (typeof req.body.isAvailable !== 'boolean') {
      return res.status(400).json({
        success: false,
        message: 'isAvailable must be true or false',
      });
    }

    const product = await Product.findByIdAndUpdate(
      id,
      { isAvailable: req.body.isAvailable },
      { new: true, runValidators: true }
    );

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found',
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Product availability updated successfully',
      data: { product },
    });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  createProduct,
  getProducts,
  getProductById,
  updateProduct,
  deleteProduct,
  toggleProductAvailability,
};
