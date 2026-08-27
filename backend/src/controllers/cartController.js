// src/controllers/cartController.js

const mongoose = require('mongoose');
const Cart = require('../models/Cart');
const Product = require('../models/Product');
const getGuestId = require('../utils/getGuestId');

function isValidObjectId(id) {
  return mongoose.Types.ObjectId.isValid(id);
}

function requireGuestId(req, res) {
  const guestId = getGuestId(req);
  if (!guestId) {
    res.status(400).json({
      success: false,
      message: 'X-Guest-Id header is required',
    });
    return null;
  }
  return guestId;
}

function isPositiveInteger(value) {
  return typeof value === 'number' && Number.isInteger(value) && value > 0;
}

async function getCart(req, res, next) {
  try {
    const guestId = requireGuestId(req, res);
    if (!guestId) return;

    const cart = await Cart.findOne({ guestId });

    if (!cart) {
      // No persisted cart yet — return the empty shape rather than 404,
      // since "no cart yet" is a normal state, not an error.
      return res.status(200).json({
        success: true,
        data: { cart: { guestId, items: [], subtotal: 0 } },
      });
    }

    return res.status(200).json({
      success: true,
      data: { cart },
    });
  } catch (error) {
    return next(error);
  }
}

async function addItem(req, res, next) {
  try {
    const guestId = requireGuestId(req, res);
    if (!guestId) return;

    const { productId, quantity } = req.body;

    if (!productId || !isValidObjectId(productId)) {
      return res.status(400).json({
        success: false,
        message: 'A valid productId is required',
      });
    }

    if (!isPositiveInteger(quantity)) {
      return res.status(400).json({
        success: false,
        message: 'Quantity must be a whole number greater than 0',
      });
    }

    const product = await Product.findById(productId);

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found',
      });
    }

    if (!product.isAvailable) {
      return res.status(400).json({
        success: false,
        message: 'Product is not currently available',
      });
    }

    let cart = await Cart.findOne({ guestId });
    if (!cart) {
      cart = new Cart({ guestId, items: [] });
    }

    const existingItem = cart.items.find((item) => item.product.toString() === productId);

    if (existingItem) {
      existingItem.quantity += quantity;
      // Refresh the snapshot to the current authoritative price/name.
      existingItem.price = product.price;
      existingItem.name = product.name;
    } else {
      cart.items.push({
        product: product._id,
        name: product.name,
        price: product.price, // authoritative price from MongoDB, never from the request
        quantity,
      });
    }

    await cart.save();

    return res.status(200).json({
      success: true,
      message: 'Item added to cart',
      data: { cart },
    });
  } catch (error) {
    return next(error);
  }
}

async function updateItemQuantity(req, res, next) {
  try {
    const guestId = requireGuestId(req, res);
    if (!guestId) return;

    const { productId } = req.params;
    const { quantity } = req.body;

    if (!isValidObjectId(productId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid product ID',
      });
    }

    if (!isPositiveInteger(quantity)) {
      return res.status(400).json({
        success: false,
        message: 'Quantity must be a whole number greater than 0',
      });
    }

    const cart = await Cart.findOne({ guestId });

    if (!cart) {
      return res.status(404).json({
        success: false,
        message: 'Cart not found',
      });
    }

    const item = cart.items.find((i) => i.product.toString() === productId);

    if (!item) {
      return res.status(404).json({
        success: false,
        message: 'Item not found in cart',
      });
    }

    item.quantity = quantity;
    await cart.save();

    return res.status(200).json({
      success: true,
      message: 'Cart item updated',
      data: { cart },
    });
  } catch (error) {
    return next(error);
  }
}

async function removeItem(req, res, next) {
  try {
    const guestId = requireGuestId(req, res);
    if (!guestId) return;

    const { productId } = req.params;

    if (!isValidObjectId(productId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid product ID',
      });
    }

    const cart = await Cart.findOne({ guestId });

    if (!cart) {
      return res.status(404).json({
        success: false,
        message: 'Cart not found',
      });
    }

    const originalLength = cart.items.length;
    cart.items = cart.items.filter((item) => item.product.toString() !== productId);

    if (cart.items.length === originalLength) {
      return res.status(404).json({
        success: false,
        message: 'Item not found in cart',
      });
    }

    await cart.save();

    return res.status(200).json({
      success: true,
      message: 'Item removed from cart',
      data: { cart },
    });
  } catch (error) {
    return next(error);
  }
}

async function clearCart(req, res, next) {
  try {
    const guestId = requireGuestId(req, res);
    if (!guestId) return;

    const cart = await Cart.findOne({ guestId });

    if (cart) {
      cart.items = [];
      await cart.save();
    }

    return res.status(200).json({
      success: true,
      message: 'Cart cleared',
      data: { cart: { guestId, items: [], subtotal: 0 } },
    });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  getCart,
  addItem,
  updateItemQuantity,
  removeItem,
  clearCart,
};
