const express = require("express");
const db = require("../db");
const { store } = require("../store");
const { rewardTokens, createUserTopic } = require("../hedera");

const router = express.Router();

router.get("/stats", (req, res) => {
  const { totalCommits, totalRewards } = db.getStats();
  res.json({
    totalCommits,
    totalRewards,
    tokenId: store.tokenId,
    topicId: store.topicId,
  });
});

router.get("/logs", (req, res) => {
  const limit = parseInt(req.query.limit) || 20;
  res.json(db.getLogs(limit));
});

router.post("/link", async (req, res) => {
  const { githubUser, accountId } = req.body;
  if (!githubUser || !accountId) return res.status(400).json({ error: "githubUser and accountId required" });
  if (!/^0\.0\.\d+$/.test(accountId)) return res.status(400).json({ error: "Invalid Hedera account ID format" });

  const existing = db.getLinkedAccount(githubUser);
  let topicId = existing?.topicId || null;

  if (!topicId) {
    try {
      topicId = await createUserTopic(githubUser);
    } catch (err) {
      return res.status(500).json({ error: "Failed to create user topic: " + err.message });
    }
  }

  db.linkAccount(githubUser, accountId, topicId);
  res.json({ success: true, githubUser, accountId, topicId });
});

router.get("/pending/:githubUser", (req, res) => {
  const { githubUser } = req.params;
  const linked = db.getLinkedAccount(githubUser);
  res.json({
    githubUser,
    pending: db.getPending(githubUser),
    accountId: linked?.accountId || null,
    topicId: linked?.topicId || null,
  });
});

router.post("/claim", async (req, res) => {
  const { githubUser, accountId: bodyAccountId } = req.body;
  if (!githubUser) return res.status(400).json({ error: "githubUser required" });

  let linked = db.getLinkedAccount(githubUser);
  if (!linked && bodyAccountId) {
    db.linkAccount(githubUser, bodyAccountId);
    linked = { accountId: bodyAccountId };
  }

  const accountId = linked?.accountId;
  if (!accountId) return res.status(400).json({ error: "No Hedera account linked. Connect wallet first." });

  const amount = db.getPending(githubUser);
  if (amount === 0) return res.json({ success: true, message: "Nothing to claim" });

  try {
    await rewardTokens(accountId, amount);
    db.clearPending(githubUser);
    res.json({ success: true, claimed: amount, accountId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
