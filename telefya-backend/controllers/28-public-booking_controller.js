const {
  query,
  withTransaction,
} = require("../config/db");

const {
  getPublicBookingProfileService,
  getPublicBookingSlotsService,
} = require("../services/28-public-booking_service");

const {
  createPublicBookingService,
} = require("../services/29-booking-confirmation_service");

const {
  getRequestIp,
  recordMeetingAudit,
} = require("../services/30-meeting-audit_service");
const {
  publishCalendarChange,
} = require("../services/31-calendar-realtime_service");
const {
  queueGoogleMeetingSync,
} = require("../services/34-google-calendar-sync_service");

function respondWithError(res, error, fallbackMessage) {
  const message = error?.message || fallbackMessage;

  const isNotFound =
    message === "Booking page not found.";

  const isUnavailable =
    error?.code === "SLOT_UNAVAILABLE" ||
    error?.code === "ER_DUP_ENTRY" ||
    error?.code === "ER_LOCK_DEADLOCK";

  return res.status(isNotFound ? 404 : isUnavailable ? 409 : 400).json({
    success: false,
    error: true,
    status: isNotFound ? 404 : isUnavailable ? 409 : 400,
    message: isUnavailable
      ? "That time is no longer available. Please choose another time."
      : message,
  });
}

async function get_public_booking_profile_controller(req, res) {
  try {
    const result = await getPublicBookingProfileService(
      query,
      req.params.slug,
    );

    return res.status(200).json({
      ...result,
      error: false,
      status: 200,
    });
  } catch (error) {
    return respondWithError(
      res,
      error,
      "Unable to load this booking page.",
    );
  }
}

async function get_public_booking_slots_controller(req, res) {
  try {
    const result = await getPublicBookingSlotsService(
      query,
      req.params.slug,
      req.query,
    );

    return res.status(200).json({
      ...result,
      error: false,
      status: 200,
    });
  } catch (error) {
    return respondWithError(
      res,
      error,
      "Unable to load available times.",
    );
  }
}

async function create_public_booking_controller(req, res) {
  try {
    const result = await createPublicBookingService(
      withTransaction,
      query,
      req.params.slug,
      req.body,
    );

    recordMeetingAudit(query, {
      bookingId: result.data?.bookingId,
      actorType: "guest",
      eventType: "PUBLIC_BOOKING_CREATED",
      ipAddress: getRequestIp(req),
      metadata: {
        bookingSlug: result.data?.bookingSlug,
        hostName: result.data?.hostName,
        meetingTitle: result.data?.meetingTitle,
        startsAt: result.data?.startsAt,
        endsAt: result.data?.endsAt,
        timeZone: result.data?.timeZone,
      },
    });

    publishCalendarChange(query, {
      meetingId: result.data?.meetingId,
      eventType: "public_booking_created",
    });

    return res.status(201).json({
      ...result,
      error: false,
      status: 201,
    });
  } catch (error) {
    return respondWithError(
      res,
      error,
      "Unable to create this booking.",
    );
  }
}

module.exports = {
  get_public_booking_profile_controller,
  get_public_booking_slots_controller,
  create_public_booking_controller,
};

