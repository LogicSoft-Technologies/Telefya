const express = require("express");

const {
  get_public_meeting_preview_controller,
} = require("../../controllers/25-public-meeting-preview_controller");

const meeting_preview_router = express.Router();

meeting_preview_router.get(
  "/meetings/:roomId/preview",
  get_public_meeting_preview_controller,
);

module.exports = meeting_preview_router;