// src/models/Reservation.js
//
// Uses the single, existing Mongoose connection — no mongoose.connect()
// here. Reuses the same guestId/customer ownership convention already
// established for Cart/Order (see src/utils/getGuestId.js and
// src/models/Order.js) rather than inventing a second one.
//
// CAPACITY RULE (documented per Part 6 prompt): the current backend
// has no table/floor-plan inventory anywhere, so Part 6 does not
// pretend to know real table availability. Instead it enforces a
// simple, configurable per-slot cap: at most MAX_RESERVATIONS_PER_SLOT
// non-cancelled/non-rejected reservations may exist for the same
// {date, time} pair. This lives in reservationController.js (where
// the check runs), not here — see the comment there for the exact
// number and rationale.

const mongoose = require('mongoose');

const RESERVATION_STATUSES = ['pending', 'confirmed', 'rejected', 'cancelled', 'completed', 'no_show'];

// Sensible upper bound for a café table booking — prevents someone
// from requesting an unreasonable party size (e.g. 99999).
const MAX_PARTY_SIZE = 20;

const customerDetailsSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true, lowercase: true },
    phone: { type: String, required: true, trim: true },
  },
  { _id: false }
);

const reservationSchema = new mongoose.Schema(
  {
    reservationNumber: {
      type: String,
      required: true,
      unique: true,
    },
    // Optional proper reference when the requester is an authenticated
    // customer — same pattern as Order.customer (Part 5).
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Customer',
      default: null,
    },
    // Same guestId ownership convention as Cart/Order. Holds
    // "customer:<id>" for authenticated customers (via getGuestId) or
    // the browser-generated X-Guest-Id for anonymous guests.
    guestId: {
      type: String,
      required: true,
      trim: true,
    },
    customerDetails: { type: customerDetailsSchema, required: true },
    // Stored as YYYY-MM-DD (date-only, no time-of-day/timezone
    // component) — matches the plain date string the café's booking
    // form collects, avoids inventing a timezone system per the
    // prompt's explicit "no complicated timezone system" instruction.
    date: {
      type: String,
      required: true,
    },
    // Stored as HH:mm (24-hour), validated against the café's simple
    // operating-hours window in the controller.
    time: {
      type: String,
      required: true,
    },
    partySize: {
      type: Number,
      required: true,
      min: [1, 'Party size must be at least 1'],
      max: [MAX_PARTY_SIZE, `Party size cannot exceed ${MAX_PARTY_SIZE}`],
      validate: {
        validator: Number.isInteger,
        message: 'Party size must be a whole number',
      },
    },
    specialRequest: {
      type: String,
      trim: true,
      maxlength: [300, 'specialRequest cannot exceed 300 characters'],
      default: '',
    },
    status: {
      type: String,
      enum: { values: RESERVATION_STATUSES, message: '{VALUE} is not a valid reservation status' },
      default: 'pending',
    },
  },
  { timestamps: true }
);

reservationSchema.index({ customer: 1 });
reservationSchema.index({ date: 1 });
reservationSchema.index({ status: 1 });
reservationSchema.index({ guestId: 1 });

reservationSchema.statics.STATUSES = RESERVATION_STATUSES;
reservationSchema.statics.MAX_PARTY_SIZE = MAX_PARTY_SIZE;

module.exports = mongoose.model('Reservation', reservationSchema);
