// src/utils/generateOrderNumber.js
//
// Produces customer-facing order numbers like "AA-2026-000001".
// Sequence is per calendar year, based on how many orders already
// exist for that year. Order.orderNumber has a unique index, so on
// the rare chance of a race between two concurrent checkouts landing
// on the same sequence number, the duplicate-key error surfaces to
// the caller, which retries with a fresh count (see orderController).

const Order = require('../models/Order');

async function generateOrderNumber() {
  const year = new Date().getFullYear();
  const count = await Order.countDocuments({
    orderNumber: { $regex: `^AA-${year}-` },
  });
  const sequence = String(count + 1).padStart(6, '0');
  return `AA-${year}-${sequence}`;
}

module.exports = generateOrderNumber;
