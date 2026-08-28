// src/routes/cartRoutes.js
//
// No auth REQUIRED — carts are scoped by the X-Guest-Id header (see
// src/utils/getGuestId.js and src/models/Cart.js for the reasoning).
//
// PART 5 ADDITION: optionalCustomerAuth runs first so that if the
// request carries a valid customer JWT, req.customer is set and
// getGuestId() (used inside cartController) resolves ownership to the
// customer's own account instead of the X-Guest-Id header. Anonymous
// guest requests are completely unaffected.

const express = require('express');
const {
  getCart,
  addItem,
  updateItemQuantity,
  removeItem,
  clearCart,
} = require('../controllers/cartController');
const optionalCustomerAuth = require('../middleware/optionalCustomerAuth');

const router = express.Router();

router.use(optionalCustomerAuth);

router.get('/', getCart);
router.post('/items', addItem);
router.patch('/items/:productId', updateItemQuantity);
router.delete('/items/:productId', removeItem);
router.delete('/', clearCart);

module.exports = router;
