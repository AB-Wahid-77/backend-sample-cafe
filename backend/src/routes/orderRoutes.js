// src/routes/orderRoutes.js
//
// Customer-facing order routes. Creation requires only the X-Guest-Id
// header, OR a valid customer JWT (no admin auth). Retrieval/
// cancellation use optionalAuth + optionalCustomerAuth so the owning
// guest, the owning customer, OR an admin can access them — ownership
// is enforced inside the controller (see
// src/controllers/orderController.js).
//
// PART 5 ADDITION: optionalCustomerAuth applied on every route here so
// a logged-in customer's orders are tied to their account (via
// getGuestId() resolving to their customer id — see
// src/utils/getGuestId.js) without changing anything for guests.

const express = require('express');
const { createOrder, getOrderById, cancelOrder } = require('../controllers/orderController');
const optionalAuth = require('../middleware/optionalAuth');
const optionalCustomerAuth = require('../middleware/optionalCustomerAuth');

const router = express.Router();

router.use(optionalCustomerAuth);

router.post('/', createOrder);
router.get('/:id', optionalAuth, getOrderById);
router.patch('/:id/cancel', optionalAuth, cancelOrder);

module.exports = router;
