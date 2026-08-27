// src/routes/adminReservationRoutes.js
//
// Admin reservation management. Reuses the existing authMiddleware
// exactly as-is — no second admin authentication system.

const express = require('express');
const {
  adminListReservations,
  adminGetReservationById,
  adminUpdateReservationStatus,
} = require('../controllers/reservationController');
const authMiddleware = require('../middleware/authMiddleware');

const router = express.Router();

router.use(authMiddleware);

router.get('/', adminListReservations);
router.get('/:id', adminGetReservationById);
router.patch('/:id/status', adminUpdateReservationStatus);

module.exports = router;
