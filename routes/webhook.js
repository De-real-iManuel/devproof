const express = require("express");
const crypto = require("crypto");
const { logToHCS, rewardTokens, mintToTreasury } = require("../hedera");
const { store } = require("../store");
const db = require("../db");

const router = express.Router();
const TOKENS_PER_COMMIT = 10;

function verifySignature(req) {
  const sig = req.headers["x-hub-signature-256"];
  if (!sig) return false;
  const hmac = crypto.createHmac("sha256", process.env.GITHUB_WEBHOOK_SECRET);
  const digest = "sha256=" + hmac.update(req.rawBody).digest("hex");
  return crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(digest));
}

router.post("/", async (req, res) => {
  if (!verifySignature(req)) return res.status(401).json({ error: "Invalid signature" });

  const event = req.headers["x-github-event"];
  if (event !== "push") return res.status(200).json({ ignored: true });

  const { commits = [], repository, pusher } = req.body;
  const username = pusher?.name;
  const repo = repository?.full_name;

  if (!username) return res.status(400).json({ error: "No pusher" });
  if (commits.length === 0) return res.status(400).json({ error: "No commits" });

  console.log(`[webhook] push from ${username} on ${repo} — ${commits.length} commit(s)`);
  const reward = commits.length * TOKENS_PER_COMMIT;
  const timestamp = new Date().toISOString();
  const linked = db.getLinkedAccount(username);
  const hederaAccount = linked?.accountId || null;

  try {
    await logToHCS(username, { user: username, repo, commits: commits.length, timestamp });

    if (hederaAccount) {
      await rewardTokens(hederaAccount, reward);
    } else {
      await mintToTreasury(reward);
      db.addPending(username, reward);
    }

    db.incrementStats(commits.length, reward);
    db.addLog({ user: username, repo, commits: commits.length, reward, hederaAccount, timestamp });

    res.json({ success: true, reward, hederaAccount: hederaAccount || "pending" });
  } catch (err) {
    console.error("Hedera error:", err.message);
    res.status(500).json({ error: "Hedera operation failed" });
  }
});

module.exports = router;
