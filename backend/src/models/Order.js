// src/models/Order.js
//
// Uses the single, existing Mongoose connection — no mongoose.connect()
// here. Order items store a NAME/PRICE SNAPSHOT taken at order-creation
// time, deliberately decoupled from the live Product document, so a
// later Product price change never rewrites history for past orders.

const mongoose = require('mongoose');

const ORDER_STATUSES = ['pending', 'confirmed', 'preparing', 'ready', 'completed', 'cancelled'];

const orderItemSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
    },
    // Snapshots — locked in at order creation, never re-derived.
    name: { type: String, required: true },
    price: { type: Number, required: true, min: 0 },
    quantity: { type: Number, required: true, min: 1 },
    itemSubtotal: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

const customerDetailsSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true, lowercase: true },
    phone: { type: String, required: true, trim: true },
  },
  { _id: false }
);

const deliveryDetailsSchema = new mongoose.Schema(
  {
    address: { type: String, required: true, trim: true },
    city: { type: String, required: true, trim: true },
    deliveryNotes: { type: String, trim: true, default: '' },
  },
  { _id: false }
);

const orderSchema = new mongoose.Schema(
  {
    orderNumber: {
      type: String,
      required: true,
      unique: true,
    },
    // Same guest-scoping mechanism as Cart — see src/models/Cart.js
    // for the reasoning. Lets a guest retrieve/cancel their own order
    // without a customer account existing yet. When the order was
    // placed by an authenticated customer, this holds
    // "customer:<customer id>" (see src/utils/getGuestId.js) so the
    // existing ownership check logic keeps working unchanged.
    guestId: {
      type: String,
      required: true,
      trim: true,
    },
    // PART 5 ADDITION: optional proper reference to the Customer who
    // placed the order, when authenticated. Undefined/null for orders
    // placed as a guest — existing Part 4 orders remain valid since
    // this field is not required. Enables a clean
    // Order.find({ customer: id }) for customer order history without
    // relying on string-parsing guestId.
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Customer',
      default: null,
    },
    items: {
      type: [orderItemSchema],
      required: true,
      validate: {
        validator: (items) => Array.isArray(items) && items.length > 0,
        message: 'An order must contain at least one item',
      },
    },
    subtotal: { type: Number, required: true, min: 0 },
    deliveryFee: { type: Number, required: true, min: 0 },
    total: { type: Number, required: true, min: 0 },
    status: {
      type: String,
      enum: { values: ORDER_STATUSES, message: '{VALUE} is not a valid order status' },
      default: 'pending',
    },
    customerDetails: { type: customerDetailsSchema, required: true },
    deliveryDetails: { type: deliveryDetailsSchema, required: true },
  },
  { timestamps: true }
);

orderSchema.index({ guestId: 1 });
orderSchema.index({ status: 1 });

orderSchema.statics.STATUSES = ORDER_STATUSES;

module.exports = mongoose.model('Order', orderSchema);
