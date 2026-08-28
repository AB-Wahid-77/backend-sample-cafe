// src/controllers/reservationController.js
//
// Follows the same response/validation conventions as
// orderController.js. Reuses getGuestId() (Part 4/5) for ownership —
// no second guest/identity mechanism.

const mongoose = require('mongoose');
const Reservation = require('../models/Reservation');
const generateReservationNumber = require('../utils/generateReservationNumber');
const getGuestId = require('../utils/getGuestId');

// --- Business rules (documented here since there's nowhere else in
// the project these numbers could live) ---

// The café's simple booking window. No timezone system is introduced
// (per the prompt) — this is a plain local-time-of-day check against
// the HH:mm string supplied.
const OPENING_TIME = '08:00';
const CLOSING_TIME = '22:00';

// CAPACITY RULE: the backend has no real table/floor-plan inventory
// anywhere in this project. Rather than pretend to know actual table
// availability, Part 6 enforces a simple, clearly-documented cap: at
// most this many non-cancelled/non-rejected reservations may exist
// for the same {date, time} slot. This is a placeholder business rule,
// stated clearly, not a claim of physical table-tracking.
const MAX_RESERVATIONS_PER_SLOT = 8;

const ACTIVE_STATUSES_FOR_CAPACITY = ['pending', 'confirmed'];
const CUSTOMER_CANCELLABLE_STATUSES = ['pending', 'confirmed'];

// Admin-driven status transition map. Anything not listed as a key is
// a terminal state (rejected, cancelled, completed, no_show) and
// cannot transition further.
const ALLOWED_TRANSITIONS = {
  pending: ['confirmed', 'rejected', 'cancelled'],
  confirmed: ['completed', 'cancelled', 'no_show'],
};

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const TIME_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/;

function isValidObjectId(id) {
  return mongoose.Types.ObjectId.isValid(id);
}

function todayDateString() {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function isValidCalendarDate(dateStr) {
  if (!DATE_REGEX.test(dateStr)) return false;
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  // Catches things like 2026-02-30 rolling over into March.
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

function isTimeWithinHours(timeStr) {
  return timeStr >= OPENING_TIME && timeStr <= CLOSING_TIME;
}

function validateReservationInput(body) {
  const errors = [];
  const { date, time, partySize, specialRequest } = body;

  if (typeof date !== 'string' || !isValidCalendarDate(date)) {
    errors.push('date must be a valid date in YYYY-MM-DD format');
  } else if (date < todayDateString()) {
    errors.push('date must be today or a future date');
  }

  if (typeof time !== 'string' || !TIME_REGEX.test(time)) {
    errors.push('time must be in HH:mm 24-hour format');
  } else if (!isTimeWithinHours(time)) {
    errors.push(`time must be between ${OPENING_TIME} and ${CLOSING_TIME}`);
  }

  const size = Number(partySize);
  if (partySize === undefined || partySize === null || Number.isNaN(size) || !Number.isInteger(size) || size < 1) {
    errors.push('partySize must be a whole number greater than 0');
  } else if (size > Reservation.MAX_PARTY_SIZE) {
    errors.push(`partySize cannot exceed ${Reservation.MAX_PARTY_SIZE}`);
  }

  if (specialRequest !== undefined) {
    if (typeof specialRequest !== 'string') {
      errors.push('specialRequest must be a string');
    } else if (specialRequest.length > 300) {
      errors.push('specialRequest cannot exceed 300 characters');
    }
  }

  return {
    errors,
    value: {
      date,
      time,
      partySize: size,
      specialRequest: (specialRequest || '').trim(),
    },
  };
}

function validateGuestCustomerDetails(body) {
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

async function createReservation(req, res, next) {
  try {
    const guestId = getGuestId(req);
    if (!guestId) {
      return res.status(400).json({
        success: false,
        message: 'X-Guest-Id header is required',
      });
    }

    const { errors: fieldErrors, value: fields } = validateReservationInput(req.body);

    // For an authenticated customer, contact details always come from
    // their account — never trusted from the request body, even if
    // supplied. Only guests must supply customerDetails.
    let customerDetails;
    let customerRef;
    const errors = [...fieldErrors];

    if (req.customer) {
      customerRef = req.customer.id;
      customerDetails = {
        name: req.customer.name,
        email: req.customer.email,
        phone: req.customer.phone,
      };
      if (!customerDetails.phone) {
        errors.push('Your account has no phone number on file — add one via PATCH /api/v1/auth/customer/me before booking');
      }
    } else {
      const { errors: detailErrors, value: guestDetails } = validateGuestCustomerDetails(req.body);
      errors.push(...detailErrors);
      customerDetails = guestDetails;
    }

    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        message: errors.join(', '),
      });
    }

    // Simple capacity check (see MAX_RESERVATIONS_PER_SLOT above).
    const activeCountForSlot = await Reservation.countDocuments({
      date: fields.date,
      time: fields.time,
      status: { $in: ACTIVE_STATUSES_FOR_CAPACITY },
    });

    if (activeCountForSlot >= MAX_RESERVATIONS_PER_SLOT) {
      return res.status(409).json({
        success: false,
        message: 'This time slot is fully booked. Please choose a different date or time.',
      });
    }

    let reservation;
    let lastError;
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const reservationNumber = await generateReservationNumber();
      try {
        reservation = await Reservation.create({
          reservationNumber,
          guestId,
          customer: customerRef,
          customerDetails,
          date: fields.date,
          time: fields.time,
          partySize: fields.partySize,
          specialRequest: fields.specialRequest,
          status: 'pending',
        });
        lastError = null;
        break;
      } catch (err) {
        if (err.code === 11000) {
          lastError = err;
          continue; // reservation number collision — retry with a fresh count
        }
        throw err;
      }
    }

    if (!reservation) {
      throw lastError || new Error('Failed to generate a unique reservation number');
    }

    return res.status(201).json({
      success: true,
      message: 'Reservation requested successfully',
      data: { reservation },
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

async function listMyReservations(req, res, next) {
  try {
    const guestId = getGuestId(req);
    if (!guestId) {
      return res.status(400).json({
        success: false,
        message: 'X-Guest-Id header is required',
      });
    }

    const reservations = await Reservation.find({ guestId }).sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: reservations.length,
      data: { reservations },
    });
  } catch (error) {
    return next(error);
  }
}

async function getReservationById(req, res, next) {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid reservation ID',
      });
    }

    const reservation = await Reservation.findById(id);

    if (!reservation) {
      return res.status(404).json({
        success: false,
        message: 'Reservation not found',
      });
    }

    const guestId = getGuestId(req);
    const isOwner = guestId && reservation.guestId === guestId;
    const isAdmin = Boolean(req.admin);

    if (!isOwner && !isAdmin) {
      // Same shape as "not found" — don't reveal existence to a
      // non-owner (mirrors orderController.getOrderById).
      return res.status(404).json({
        success: false,
        message: 'Reservation not found',
      });
    }

    return res.status(200).json({
      success: true,
      data: { reservation },
    });
  } catch (error) {
    return next(error);
  }
}

async function cancelReservation(req, res, next) {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid reservation ID',
      });
    }

    const reservation = await Reservation.findById(id);

    if (!reservation) {
      return res.status(404).json({
        success: false,
        message: 'Reservation not found',
      });
    }

    const guestId = getGuestId(req);
    const isOwner = guestId && reservation.guestId === guestId;
    const isAdmin = Boolean(req.admin);

    if (!isOwner && !isAdmin) {
      return res.status(404).json({
        success: false,
        message: 'Reservation not found',
      });
    }

    if (!CUSTOMER_CANCELLABLE_STATUSES.includes(reservation.status)) {
      return res.status(400).json({
        success: false,
        message: `Reservation cannot be cancelled from status "${reservation.status}"`,
      });
    }

    reservation.status = 'cancelled';
    await reservation.save();

    return res.status(200).json({
      success: true,
      message: 'Reservation cancelled',
      data: { reservation },
    });
  } catch (error) {
    return next(error);
  }
}

// --- Admin ---

async function adminListReservations(req, res, next) {
  try {
    const filter = {};
    if (req.query.status) {
      filter.status = req.query.status;
    }
    if (req.query.date) {
      filter.date = req.query.date;
    }

    const reservations = await Reservation.find(filter).sort({ date: 1, time: 1 });

    return res.status(200).json({
      success: true,
      count: reservations.length,
      data: { reservations },
    });
  } catch (error) {
    return next(error);
  }
}

async function adminGetReservationById(req, res, next) {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid reservation ID',
      });
    }

    const reservation = await Reservation.findById(id);

    if (!reservation) {
      return res.status(404).json({
        success: false,
        message: 'Reservation not found',
      });
    }

    return res.status(200).json({
      success: true,
      data: { reservation },
    });
  } catch (error) {
    return next(error);
  }
}

async function adminUpdateReservationStatus(req, res, next) {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid reservation ID',
      });
    }

    if (!Reservation.STATUSES.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `status must be one of: ${Reservation.STATUSES.join(', ')}`,
      });
    }

    const reservation = await Reservation.findById(id);

    if (!reservation) {
      return res.status(404).json({
        success: false,
        message: 'Reservation not found',
      });
    }

    const allowedNextStatuses = ALLOWED_TRANSITIONS[reservation.status] || [];

    if (!allowedNextStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Cannot change status from "${reservation.status}" to "${status}"`,
      });
    }

    reservation.status = status;
    await reservation.save();

    return res.status(200).json({
      success: true,
      message: 'Reservation status updated',
      data: { reservation },
    });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  createReservation,
  listMyReservations,
  getReservationById,
  cancelReservation,
  adminListReservations,
  adminGetReservationById,
  adminUpdateReservationStatus,
};
