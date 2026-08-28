// src/routes/reservationRoutes.js
//
// Customer-facing reservation routes. Works for both guests
// (X-Guest-Id header) and authenticated customers (JWT), same
// ownership pattern as Cart/Order — see optionalCustomerAuth and
// getGuestId. GET/:id and cancel also accept an admin token via
// optionalAuth (mirrors orderRoutes.js).

const express = require('express');
const {
  createReservation,
  listMyReservations,
  getReservationById,
  cancelReservation,
} = require('../controllers/reservationController');
const optionalAuth = require('../middleware/optionalAuth');
const optionalCustomerAuth = require('../middleware/optionalCustomerAuth');

const router = express.Router();

router.use(optionalCustomerAuth);

router.post('/', createReservation);
router.get('/', listMyReservations);
router.get('/:id', optionalAuth, getReservationById);
router.patch('/:id/cancel', optionalAuth, cancelReservation);

module.exports = router;
