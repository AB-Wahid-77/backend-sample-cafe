// src/routes/index.js
//
// Central router mount point. All API routes are versioned under
// /api/v1. Future parts (products, orders, reservations, etc.) will
// register their routers here — this file should not need to be
// rebuilt, only extended.

const express = require('express');
const healthRoutes = require('./healthRoutes');
const authRoutes= require('./authRoutes');
const productRoutes = require('./productRoutes');
const cartRoutes = require('./cartRoutes');
const orderRoutes = require('./orderRoutes');
const adminOrderRoutes = require('./adminOrderRoutes');
const customerAuthRoutes = require('./customerAuthRoutes');
const reservationRoutes = require('./reservationRoutes');
const adminReservationRoutes = require('./adminReservationRoutes');
const reviewRoutes = require('./reviewRoutes');
const reviewByIdRoutes = require('./reviewByIdRoutes');
const adminReviewRoutes = require('./adminReviewRoutes');
// Product image uploads — admin-only, see routes/uploadRoutes.js.
const uploadRoutes = require('./uploadRoutes');

const router = express.Router();

router.use('/', healthRoutes);
router.use('/auth', authRoutes);
// PART 5: mounted separately from the existing admin authRoutes above
// so admin login/me at /api/v1/auth/* are completely untouched.
router.use('/auth/customer', customerAuthRoutes);
router.use('/products', productRoutes);
// PART 7: nested under /products/:productId/reviews — mounted after
// the plain /products mount; productRoutes.js has no route pattern
// that matches a two-segment "/:id/reviews" path (only "/:id" and
// "/:id/availability"), so it falls through here untouched, same
// fallthrough pattern already proven for /auth/customer above.
router.use('/products/:productId/reviews', reviewRoutes);
router.use('/cart', cartRoutes);
router.use('/orders', orderRoutes);
router.use('/admin/orders', adminOrderRoutes);
// PART 6
router.use('/reservations', reservationRoutes);
router.use('/admin/reservations', adminReservationRoutes);
// PART 7
router.use('/reviews', reviewByIdRoutes);
router.use('/admin/reviews', adminReviewRoutes);
router.use('/uploads', uploadRoutes);

module.exports = router;
