// src/controllers/orderController.js

const mongoose = require('mongoose');
const Order = require('../models/Order');
const Cart = require('../models/Cart');
const Product = require('../models/Product');
const generateOrderNumber = require('../utils/generateOrderNumber');
const getGuestId = require('../utils/getGuestId');

// Flat, documented default delivery fee. Not payment processing —
// just the number added to the order total. Change this constant if
// the café's delivery pricing rule changes; it deliberately isn't
// wired through env.js so this Part doesn't touch that file (see
// ENVIRONMENT PRESERVATION rule).
const DELIVERY_FEE = 150;

// A cancelled or completed order is a terminal state — nothing
// (customer or admin) can move it to another status from there.
const CANCELLABLE_STATUSES = ['pending', 'confirmed'];
const TERMINAL_STATUSES = ['completed', 'cancelled'];

function isValidObjectId(id) {
  return mongoose.Types.ObjectId.isValid(id);
}

function round2(value) {
  return Math.round(value * 100) / 100;
}

function validateCustomerDetails(body) {
  const errors = [];
  const customerDetails = body && body.customerDetails;

  if (!customerDetails || typeof customerDetails !== 'object') {
    return { errors: ['customerDetails is required'], value: null };
  }

  const { name, email, phone } = customerDetails;

  if (typeof name !== 'string' || !name.trim()) errors.push('customerDetails.name is required');
  if (typeof email !== 'string' || !email.trim()) errors.push('customerDetails.email is required');
  if (typeof phone !== 'string' || !phone.trim()) errors.push('customerDetails.phone is required');

  if (errors.length > 0) return { errors, value: null };

  return {
    errors: [],
    value: {
      name: name.trim(),
      email: email.trim().toLowerCase(),
      phone: phone.trim(),
    },
  };
}

function validateDeliveryDetails(body) {
  const errors = [];
  const deliveryDetails = body && body.deliveryDetails;

  if (!deliveryDetails || typeof deliveryDetails !== 'object') {
    return { errors: ['deliveryDetails is required'], value: null };
  }

  const { address, city, deliveryNotes } = deliveryDetails;

  if (typeof address !== 'string' || !address.trim()) errors.push('deliveryDetails.address is required');
  if (typeof city !== 'string' || !city.trim()) errors.push('deliveryDetails.city is required');
  if (deliveryNotes !== undefined && typeof deliveryNotes !== 'string') {
    errors.push('deliveryDetails.deliveryNotes must be a string');
  }

  if (errors.length > 0) return { errors, value: null };

  return {
    errors: [],
    value: {
      address: address.trim(),
      city: city.trim(),
      deliveryNotes: (deliveryNotes || '').trim(),
    },
  };
}

async function createOrder(req, res, next) {
  try {
    const guestId = getGuestId(req);
    if (!guestId) {
      return res.status(400).json({
        success: false,
        message: 'X-Guest-Id header is required',
      });
    }

    const { errors: customerErrors, value: customerDetails } = validateCustomerDetails(req.body);
    const { errors: deliveryErrors, value: deliveryDetails } = validateDeliveryDetails(req.body);
    const errors = [...customerErrors, ...deliveryErrors];

    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        message: errors.join(', '),
      });
    }

    const cart = await Cart.findOne({ guestId });

    if (!cart || cart.items.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Cart is empty',
      });
    }

    // Re-verify every product against MongoDB right now — never trust
    // the cart's cached snapshot for the actual order. This re-checks
    // existence, availability, and price independently of what the
    // cart displayed a moment ago.
    const orderItems = [];
    for (const cartItem of cart.items) {
      const product = await Product.findById(cartItem.product);

      if (!product) {
        return res.status(400).json({
          success: false,
          message: `Product "${cartItem.name}" no longer exists`,
        });
      }

      if (!product.isAvailable) {
        return res.status(400).json({
          success: false,
          message: `Product "${product.name}" is no longer available`,
        });
      }

      const itemSubtotal = round2(product.price * cartItem.quantity);

      orderItems.push({
        product: product._id,
        name: product.name,
        price: product.price,
        quantity: cartItem.quantity,
        itemSubtotal,
      });
    }

    const subtotal = round2(orderItems.reduce((sum, item) => sum + item.itemSubtotal, 0));
    const deliveryFee = DELIVERY_FEE;
    const total = round2(subtotal + deliveryFee);

    // Retry a few times in case of a rare race on the unique
    // orderNumber index between two concurrent checkouts.
    let order;
    let lastError;
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const orderNumber = await generateOrderNumber();
      try {
        order = await Order.create({
          orderNumber,
          guestId,
          // PART 5 ADDITION: proper reference when the requester is an
          // authenticated customer; left undefined for guest checkout.
          customer: req.customer ? req.customer.id : undefined,
          items: orderItems,
          subtotal,
          deliveryFee,
          total,
          status: 'pending',
          customerDetails,
          deliveryDetails,
        });
        lastError = null;
        break;
      } catch (err) {
        if (err.code === 11000) {
          lastError = err;
          continue; // order number collision — retry with a fresh count
        }
        throw err;
      }
    }

    if (!order) {
      throw lastError || new Error('Failed to generate a unique order number');
    }

    // Only clear the cart after the order is safely saved.
    cart.items = [];
    await cart.save();

    return res.status(201).json({
      success: true,
      message: 'Order placed successfully',
      data: { order },
    });
  } catch (error) {
    return next(error);
  }
}

async function getOrderById(req, res, next) {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid order ID',
      });
    }

    const order = await Order.findById(id);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found',
      });
    }

    const guestId = getGuestId(req);
    const isOwner = guestId && order.guestId === guestId;
    const isAdmin = Boolean(req.admin);

    if (!isOwner && !isAdmin) {
      // Same message/shape as "not found" so we don't reveal whether
      // the order exists to someone who isn't authorized to see it.
      return res.status(404).json({
        success: false,
        message: 'Order not found',
      });
    }

    return res.status(200).json({
      success: true,
      data: { order },
    });
  } catch (error) {
    return next(error);
  }
}

async function cancelOrder(req, res, next) {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid order ID',
      });
    }

    const order = await Order.findById(id);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found',
      });
    }

    const guestId = getGuestId(req);
    const isOwner = guestId && order.guestId === guestId;
    const isAdmin = Boolean(req.admin);

    if (!isOwner && !isAdmin) {
      return res.status(404).json({
        success: false,
        message: 'Order not found',
      });
    }

    if (!CANCELLABLE_STATUSES.includes(order.status)) {
      return res.status(400).json({
        success: false,
        message: `Order cannot be cancelled from status "${order.status}"`,
      });
    }

    order.status = 'cancelled';
    await order.save();

    return res.status(200).json({
      success: true,
      message: 'Order cancelled',
      data: { order },
    });
  } catch (error) {
    return next(error);
  }
}

// --- Admin ---

async function adminListOrders(req, res, next) {
  try {
    const filter = {};
    if (req.query.status) {
      filter.status = req.query.status;
    }

    const orders = await Order.find(filter).sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: orders.length,
      data: { orders },
    });
  } catch (error) {
    return next(error);
  }
}

async function adminGetOrderById(req, res, next) {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid order ID',
      });
    }

    const order = await Order.findById(id);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found',
      });
    }

    return res.status(200).json({
      success: true,
      data: { order },
    });
  } catch (error) {
    return next(error);
  }
}

async function adminUpdateOrderStatus(req, res, next) {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid order ID',
      });
    }

    if (!Order.STATUSES.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `status must be one of: ${Order.STATUSES.join(', ')}`,
      });
    }

    const order = await Order.findById(id);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found',
      });
    }

    if (TERMINAL_STATUSES.includes(order.status)) {
      return res.status(400).json({
        success: false,
        message: `Order is already "${order.status}" and cannot change status further`,
      });
    }

    order.status = status;
    await order.save();

    return res.status(200).json({
      success: true,
      message: 'Order status updated',
      data: { order },
    });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  createOrder,
  getOrderById,
  cancelOrder,
  adminListOrders,
  adminGetOrderById,
  adminUpdateOrderStatus,
};
