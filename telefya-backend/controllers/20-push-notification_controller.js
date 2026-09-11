const { query } = require("../config/db");

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

function isValidExpoPushToken(value) {
  return /^(ExpoPushToken|ExponentPushToken)\[[^\]]+\]$/.test(
    String(value ?? "").trim(),
  );
}

async function register_push_device_controller(req, res) {
  try {
    const userId = String(
      getAuthenticatedUserId(req) ?? "",
    ).trim();

    const expoPushToken = String(
      req.body?.expoPushToken ?? "",
    ).trim();

    const platform = String(
      req.body?.platform ?? "",
    ).trim();

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized user.",
      });
    }

    if (!isValidExpoPushToken(expoPushToken)) {
      return res.status(400).json({
        success: false,
        message: "A valid Expo push token is required.",
      });
    }

    if (!["android", "ios"].includes(platform)) {
      return res.status(400).json({
        success: false,
        message: "Platform must be android or ios.",
      });
    }

    await query(
      `
        INSERT INTO user_push_devices (
          user_id,
          expo_push_token,
          platform,
          enabled,
          last_seen_at
        )
        VALUES (?, ?, ?, TRUE, CURRENT_TIMESTAMP)
        ON DUPLICATE KEY UPDATE
          user_id = VALUES(user_id),
          platform = VALUES(platform),
          enabled = TRUE,
          last_seen_at = CURRENT_TIMESTAMP
      `,
      [userId, expoPushToken, platform],
    );

    return res.status(200).json({
      success: true,
      message: "Push notifications enabled for this device.",
    });
  } catch (error) {
    console.error("[push] Registration failed:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to register this device for notifications.",
    });
  }
}

async function unregister_push_device_controller(req, res) {
  try {
    const userId = String(
      getAuthenticatedUserId(req) ?? "",
    ).trim();

    const expoPushToken = String(
      req.body?.expoPushToken ?? "",
    ).trim();

    if (!userId || !isValidExpoPushToken(expoPushToken)) {
      return res.status(400).json({
        success: false,
        message: "A valid registered device token is required.",
      });
    }

    await query(
      `
        UPDATE user_push_devices
        SET enabled = FALSE
        WHERE user_id = ?
          AND expo_push_token = ?
      `,
      [userId, expoPushToken],
    );

    return res.status(200).json({
      success: true,
      message: "Push notifications disabled for this device.",
    });
  } catch (error) {
    console.error("[push] Unregistration failed:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to unregister this device.",
    });
  }
}

module.exports = {
  register_push_device_controller,
  unregister_push_device_controller,
};