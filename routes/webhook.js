const express = require("express");
const crypto = require("crypto");
const { logToHCS, rewardTokens, mintToTreasury } = require("../hedera");
const { store, addLog } = require("../store");

const router = express.Router();
const TOKENS_PER_COMMIT = 10; // 10 DVP per commit

function verifySignature(req) {
  const sig = req.headers["x-hub-signature-256"];
  if (!sig) return false;
  const hmac = crypto.createHmac("sha256", process.env.GITHUB_WEBHOOK_SECRET);
  const digest = "sha256=" + hmac.update(req.rawBody).digest("hex");
  return crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(digest));
}

async function mintReward(username, hederaAccount, amount) {
  if (hederaAccount) {
    await rewardTokens(hederaAccount, amount); // mint + transfer directly
  } else {
    await mintToTreasury(amount); // mint to treasury, track as pending
    store.pendingRewards[username] = (store.pendingRewards[username] || 0) + amount;
  }
}

router.post("/", async (req, res) => {
  if (!verifySignature(req)) return res.status(401).json({ error: "Invalid signature" });

  const event = req.headers["x-github-event"];
  if (event !== "push") {
    console.log(`[webhook] ignored event: ${event}`);
    return res.status(200).json({ ignored: true });
  }

  const { commits = [], repository, pusher } = req.body;
  const username = pusher?.name;
  const repo = repository?.full_name;

  if (username !== process.env.ALLOWED_GITHUB_USER)
    return res.status(403).json({ error: "User not allowed" });

  if (commits.length === 0)
    return res.status(400).json({ error: "No commits" });

  const payload = { user: username, repo, commits: commits.length, timestamp: new Date().toISOString() };
  const reward = commits.length * TOKENS_PER_COMMIT;

  // Look up if this GitHub user has a linked Hedera account
  const hederaAccount = store.linkedAccounts?.[username];

  try {
    await logToHCS(username, payload);
    await mintReward(username, hederaAccount, reward);
    store.totalCommits += commits.length;
    store.totalRewards += reward;
    addLog({ ...payload, reward, hederaAccount: hederaAccount || "pending" });
    res.json({ success: true, reward, hederaAccount: hederaAccount || "pending" });
  } catch (err) {
    console.error("Hedera error:", err.message);
    res.status(500).json({ error: "Hedera operation failed" });
  }
});

module.exports = router;
