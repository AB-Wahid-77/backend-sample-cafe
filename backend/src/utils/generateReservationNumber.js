// src/utils/generateReservationNumber.js
//
// Produces customer-facing reservation numbers like "AA-R-2026-000001".
// Same pattern as src/utils/generateOrderNumber.js: per-calendar-year
// sequence based on existing count, unique-index-backed with retry on
// collision (see reservationController.js).

const Reservation = require('../models/Reservation');

async function generateReservationNumber() {
  const year = new Date().getFullYear();
  const count = await Reservation.countDocuments({
    reservationNumber: { $regex: `^AA-R-${year}-` },
  });
  const sequence = String(count + 1).padStart(6, '0');
  return `AA-R-${year}-${sequence}`;
}

module.exports = generateReservationNumber;
