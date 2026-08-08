const express = require("express");
const {
  unsubscribe_controller,
} = require("../../controllers/19-public-unsubscribe_controller");

const unsubscribe_router = express.Router();

unsubscribe_router.get("/unsubscribe", unsubscribe_controller);
unsubscribe_router.post("/unsubscribe", unsubscribe_controller);

module.exports = unsubscribe_router;