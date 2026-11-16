const { query, withTransaction } = require("../config/db");

const {
  getAvailabilitySettingsService,
  saveBookingProfileService,
  replaceAvailabilityRulesService,
  getAvailabilityExceptionsService,
  createAvailabilityExceptionService,
  deleteAvailabilityExceptionService,
} = require("../services/27-availability_service");

function getAuthenticatedUserId(req) {
  const embeddedUser = req.user?.user;

  const candidates = [
    embeddedUser?.user_id,
    embeddedUser?.id,
    embeddedUser?.userId,
    typeof embeddedUser === "string" ||
    typeof embeddedUser === "number"
      ? embeddedUser
      : null,
    req.user?.user_id,
    req.user?.id,
    req.user?.userId,
  ];

  const userId = candidates.find(
    (value) =>
      value !== undefined &&
      value !== null &&
      String(value).trim(),
  );

  return userId ? String(userId).trim() : "";
}

function unauthorized(res) {
  return res.status(401).json({
    success: false,
    error: true,
    status: 401,
    message: "Authenticated user is required.",
  });
}

function respondWithError(res, error, fallbackMessage) {
  const duplicateSlug = error?.code === "ER_DUP_ENTRY";

  return res.status(400).json({
    success: false,
    error: true,
    status: 400,
    message: duplicateSlug
      ? "That booking link is already in use. Choose another."
      : error?.message || fallbackMessage,
  });
}

async function get_availability_settings_controller(req, res) {
  try {
    const userId = getAuthenticatedUserId(req);

    if (!userId) {
      return unauthorized(res);
    }

    const result = await getAvailabilitySettingsService(query, userId);

    return res.status(200).json({
      ...result,
      error: false,
      status: 200,
    });
  } catch (error) {
    return respondWithError(
      res,
      error,
      "Unable to load availability settings.",
    );
  }
}

async function save_booking_profile_controller(req, res) {
  try {
    const userId = getAuthenticatedUserId(req);

    if (!userId) {
      return unauthorized(res);
    }

    const result = await saveBookingProfileService(
      query,
      userId,
      req.body,
    );

    return res.status(200).json({
      ...result,
      error: false,
      status: 200,
      message: "Booking profile saved.",
    });
  } catch (error) {
    return respondWithError(
      res,
      error,
      "Unable to save booking profile.",
    );
  }
}

async function replace_availability_rules_controller(req, res) {
  try {
    const userId = getAuthenticatedUserId(req);

    if (!userId) {
      return unauthorized(res);
    }

    const result = await replaceAvailabilityRulesService(
      withTransaction,
      query,
      userId,
      req.body,
    );

    return res.status(200).json({
      ...result,
      error: false,
      status: 200,
      message: "Availability hours saved.",
    });
  } catch (error) {
    return respondWithError(
      res,
      error,
      "Unable to save availability hours.",
    );
  }
}

async function get_availability_exceptions_controller(req, res) {
  try {
    const userId = getAuthenticatedUserId(req);

    if (!userId) {
      return unauthorized(res);
    }

    const result = await getAvailabilityExceptionsService(
      query,
      userId,
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
      "Unable to load availability exceptions.",
    );
  }
}

async function create_availability_exception_controller(req, res) {
  try {
    const userId = getAuthenticatedUserId(req);

    if (!userId) {
      return unauthorized(res);
    }

    const result = await createAvailabilityExceptionService(
      query,
      userId,
      req.body,
    );

    return res.status(201).json({
      ...result,
      error: false,
      status: 201,
      message: "Availability exception saved.",
    });
  } catch (error) {
    return respondWithError(
      res,
      error,
      "Unable to save availability exception.",
    );
  }
}

async function delete_availability_exception_controller(req, res) {
  try {
    const userId = getAuthenticatedUserId(req);

    if (!userId) {
      return unauthorized(res);
    }

    const result = await deleteAvailabilityExceptionService(
      query,
      userId,
      req.params.exceptionId,
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
      "Unable to delete availability exception.",
    );
  }
}

module.exports = {
  get_availability_settings_controller,
  save_booking_profile_controller,
  replace_availability_rules_controller,
  get_availability_exceptions_controller,
  create_availability_exception_controller,
  delete_availability_exception_controller,
};