const { query } = require("../config/db");

const {
  buildCallbackUrl,
  createGoogleAuthorizationService,
  processGoogleCallbackService,
  listCalendarConnectionsService,
  disconnectGoogleCalendarService,
} = require("../services/33-google-calendar-oauth_service");

const {
  queueGoogleBackfillForUser,
} = require("../services/34-google-calendar-sync_service");

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

async function list_calendar_connections_controller(req, res) {
  try {
    const userId = getAuthenticatedUserId(req);

    if (!userId) {
      return unauthorized(res);
    }

    const result = await listCalendarConnectionsService(
      query,
      userId,
    );

    return res.status(200).json({
      ...result,
      error: false,
      status: 200,
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      error: true,
      status: 400,
      message:
        error?.message ||
        "Unable to load calendar connections.",
    });
  }
}

async function start_google_calendar_connection_controller(
  req,
  res,
) {
  try {
    const userId = getAuthenticatedUserId(req);

    if (!userId) {
      return unauthorized(res);
    }

    const result = await createGoogleAuthorizationService(
      query,
      userId,
    );

    return res.status(200).json({
      ...result,
      error: false,
      status: 200,
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      error: true,
      status: 400,
      message:
        error?.message ||
        "Unable to start Google Calendar connection.",
    });
  }
}

async function google_calendar_callback_controller(req, res) {
  try {
    const result = await processGoogleCallbackService(
      query,
      req.query,
    );

    queueGoogleBackfillForUser(query, result.userId);

    return res.redirect(302, result.redirectUrl);
  } catch (error) {
    console.warn(
      "[google-calendar] OAuth callback failed:",
      error?.message || error,
    );

    return res.redirect(
      302,
      buildCallbackUrl(
        "google_error",
        "Google Calendar could not be connected. Please try again.",
      ),
    );
  }
}

async function disconnect_google_calendar_controller(req, res) {
  try {
    const userId = getAuthenticatedUserId(req);

    if (!userId) {
      return unauthorized(res);
    }

    const result = await disconnectGoogleCalendarService(
      query,
      userId,
    );

    return res.status(200).json({
      ...result,
      error: false,
      status: 200,
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      error: true,
      status: 400,
      message:
        error?.message ||
        "Unable to disconnect Google Calendar.",
    });
  }
}

module.exports = {
  list_calendar_connections_controller,
  start_google_calendar_connection_controller,
  google_calendar_callback_controller,
  disconnect_google_calendar_controller,
};