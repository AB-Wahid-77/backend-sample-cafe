// src/models/Cart.js
//
// Uses the single, existing Mongoose connection established in
// src/config/db.js — this file does not connect to the database
// itself, it only defines a schema/model on the default connection.
//
// OWNERSHIP: there is no customer authentication in this backend yet
// (see Part 4 prompt — customer auth is explicitly out of scope).
// Carts are keyed by a client-supplied `guestId` — an opaque string
// the frontend generates once per visitor (e.g. via
// crypto.randomUUID() in the browser) and persists in localStorage,
// sending it back as the `X-Guest-Id` header on every cart/order
// request. This is intentionally NOT an authentication system: it
// doesn't prove identity, it just scopes a cart/order to "whoever
// holds this id" the same way an anonymous shopping cart works on
// most e-commerce sites. When customer accounts are added later,
// a cart's guestId can be merged into / re-associated with a real
// customer id without changing this schema's shape.

const mongoose = require('mongoose');

const cartItemSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
    },
    // Snapshots taken from the Product at the moment the item was
    // added/updated — used for display only. Order creation always
    // re-reads the authoritative price from Product at checkout time;
    // it never trusts these cached values.
    name: {
      type: String,
      required: true,
    },
    price: {
      type: Number,
      required: true,
      min: 0,
    },
    quantity: {
      type: Number,
      required: true,
      min: [1, 'Quantity must be greater than 0'],
      validate: {
        validator: Number.isInteger,
        message: 'Quantity must be a whole number',
      },
    },
  },
  { _id: false }
);

const cartSchema = new mongoose.Schema(
  {
    guestId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    items: {
      type: [cartItemSchema],
      default: [],
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Computed, not persisted — always derived from current items so it
// can never drift out of sync with them.
cartSchema.virtual('subtotal').get(function getSubtotal() {
  const total = this.items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  return Math.round(total * 100) / 100;
});

module.exports = mongoose.model('Cart', cartSchema);
