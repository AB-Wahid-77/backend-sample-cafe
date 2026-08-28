// src/utils/getGuestId.js
//
// Reads the cart/order OWNER key for a request. The client
// is expected to generate a guest id once per visitor and send it back
// consistently (header: X-Guest-Id). See src/models/Cart.js for the
// full reasoning on why this exists instead of a customer auth system.
//
// PART 5 ADDITION: if the request carries a valid customer JWT
// (req.customer set by src/middleware/optionalCustomerAuth.js), that
// customer's own stable id is used as the owner key instead of the
// X-Guest-Id header — so an authenticated customer's cart/orders are
// tied to their account rather than whatever guest id their browser
// happens to send. The "customer:" prefix keeps this namespace
// distinct from browser-generated guest ids. Anonymous/guest requests
// are completely unaffected — same header, same behavior as before.

function getGuestId(req) {
  if (req.customer && req.customer.id) {
    return `customer:${req.customer.id}`;
  }

  const raw = req.headers['x-guest-id'];
  if (typeof raw !== 'string') return null;
  const guestId = raw.trim();
  return guestId.length > 0 ? guestId : null;
}

module.exports = getGuestId;
