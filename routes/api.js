const express = require("express");
const { store } = require("../store");
const { rewardTokens, createUserTopic } = require("../hedera");

const router = express.Router();

router.get("/stats", (req, res) => {
  res.json({
    totalCommits: store.totalCommits,
    totalRewards: store.totalRewards,
    tokenId: store.tokenId,
    topicId: store.topicId,
    linkedUsers: Object.keys(store.linkedAccounts).length,
  });
});

router.get("/logs", (req, res) => {
  const limit = parseInt(req.query.limit) || 20;
  res.json(store.logs.slice(0, limit));
});

// Link GitHub username to Hedera account — creates a dedicated HCS topic for the user
router.post("/link", async (req, res) => {
  const { githubUser, accountId } = req.body;
  if (!githubUser || !accountId) return res.status(400).json({ error: "githubUser and accountId required" });
  if (!/^0\.0\.\d+$/.test(accountId)) return res.status(400).json({ error: "Invalid Hedera account ID format" });

  store.linkedAccounts[githubUser] = accountId;

  // Create a per-user topic if one doesn't exist yet
  if (!store.userTopics[githubUser]) {
    try {
      await createUserTopic(githubUser);
    } catch (err) {
      return res.status(500).json({ error: "Failed to create user topic: " + err.message });
    }
  }

  res.json({
    success: true,
    githubUser,
    accountId,
    topicId: store.userTopics[githubUser],
  });
});

// Check pending rewards + user topic for a GitHub user
router.get("/pending/:githubUser", (req, res) => {
  const { githubUser } = req.params;
  res.json({
    githubUser,
    pending: store.pendingRewards[githubUser] || 0,
    accountId: store.linkedAccounts[githubUser] || null,
    topicId: store.userTopics[githubUser] || null,
  });
});

// Claim pending rewards — transfers from treasury to linked account
router.post("/claim", async (req, res) => {
  const { githubUser } = req.body;
  if (!githubUser) return res.status(400).json({ error: "githubUser required" });

  const accountId = store.linkedAccounts[githubUser];
  if (!accountId) return res.status(400).json({ error: "No Hedera account linked. Connect wallet first." });

  const amount = store.pendingRewards[githubUser] || 0;
  if (amount === 0) return res.json({ success: true, message: "Nothing to claim" });

  try {
    await rewardTokens(accountId, amount);
    store.pendingRewards[githubUser] = 0;
    res.json({ success: true, claimed: amount, accountId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
