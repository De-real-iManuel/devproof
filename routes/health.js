const express = require("express");
const { store } = require("../store");
const router = express.Router();

router.get("/health", (req, res) => {
  res.json({
    status: "ok",
    uptime: process.uptime(),
    tokenReady: !!store.tokenId,
    topicReady: !!store.topicId,
  });
});

module.exports = router;
