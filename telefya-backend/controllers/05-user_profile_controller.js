const { query } = require("../config/db");

function getAuthenticatedUserId(req) {
  return (
    req.user?.user ||
    req.user?.user_id ||
    req.user?.id ||
    req.userId ||
    req.auth?.user_id ||
    null
  );
}

function toPublicProfileImagePath(value) {
  if (!value) return null;

  const imagePath = String(value).trim();

  if (!imagePath) return null;

  if (/^https?:\/\//i.test(imagePath)) {
    return imagePath;
  }

  const normalized = imagePath.replace(/\\/g, "/");
  const publicImagesIndex = normalized.indexOf("/public/images2/");
  const imagesIndex = normalized.indexOf("/images2/");

  if (publicImagesIndex >= 0) {
    return normalized.slice(publicImagesIndex + "/public".length);
  }

  if (imagesIndex >= 0) {
    return normalized.slice(imagesIndex);
  }

  return null;
}

async function get_user_profile_controller(req, res) {
  try {
    res.set({
      "Cache-Control": "private, no-store, no-cache, max-age=0, must-revalidate",
      Pragma: "no-cache",
      Expires: "0",
      Vary: "Authorization",
    });

    const userId = getAuthenticatedUserId(req);

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: true,
        message: "Unauthorized user.",
        status: 401,
      });
    }

    const users = await query(
      `SELECT
        id,
        user_id,
        first_name,
        last_name,
        email,
        phone_number,
        country,
        state,
        city,
        date_of_birth,
        is_verified,
        profile_image,
        created_at,
        updated_at
      FROM users
      WHERE user_id = ?
      LIMIT 1`,
      [userId],
    );

    const user = users[0];

    if (!user) {
      return res.status(404).json({
        success: false,
        error: true,
        message: "User not found.",
        status: 404,
      });
    }

    const profileImage = toPublicProfileImagePath(user.profile_image);

    return res.status(200).json({
      success: true,
      error: false,
      message: "User profile retrieved successfully.",
      status: 200,
      data: {
        ...user,
        profile_image: profileImage,
        profile_image_url: profileImage,
      },
    });
  } catch (error) {
    console.error("Get profile error:", error);

    return res.status(500).json({
      success: false,
      error: true,
      message: error?.message || "Unable to retrieve profile.",
      status: 500,
    });
  }
}

module.exports = get_user_profile_controller;