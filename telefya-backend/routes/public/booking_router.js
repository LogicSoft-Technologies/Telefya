const express = require("express");
const rateLimit = require("express-rate-limit");

const {
  get_public_booking_profile_controller,
  get_public_booking_slots_controller,
  create_public_booking_controller,
} = require("../../controllers/28-public-booking_controller");

const booking_router = express.Router();

const publicBookingReadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: true,
    status: 429,
    message: "Too many booking-page requests. Please try again shortly.",
  },
});

const publicBookingWriteLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: true,
    status: 429,
    message: "Too many booking attempts. Please try again later.",
  },
});

booking_router.get(
  "/book/:slug",
  publicBookingReadLimiter,
  get_public_booking_profile_controller,
);

booking_router.get(
  "/book/:slug/slots",
  publicBookingReadLimiter,
  get_public_booking_slots_controller,
);

booking_router.post(
  "/book/:slug",
  publicBookingWriteLimiter,
  create_public_booking_controller,
);

module.exports = booking_router;