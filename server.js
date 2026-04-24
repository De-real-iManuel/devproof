require("dotenv").config();
const express = require("express");
const { createTopic, createToken } = require("./hedera");
const { store } = require("./store");
const db = require("./db");

const app = express();

app.use((req, res, next) => {
  let data = "";
  req.on("data", (chunk) => (data += chunk));
  req.on("end", () => {
    req.rawBody = data;
    req.body = data ? JSON.parse(data) : {};
    next();
  });
});

app.use(express.static("public"));
app.use("/webhook", require("./routes/webhook"));
app.use("/", require("./routes/health"));
app.use("/", require("./routes/api"));

const PORT = process.env.PORT || 8000;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`DevProof running on port ${PORT}`);
});

(async () => {
  await db.getDb();

  // Reuse persisted IDs to avoid creating new topic/token on every restart
  let topicId = db.getHederaId("topicId");
  let tokenId = db.getHederaId("tokenId");

  if (!topicId) {
    console.log("Creating HCS topic...");
    topicId = await createTopic();
    db.setHederaId("topicId", topicId);
  }

  if (!tokenId) {
    console.log("Creating HTS token...");
    tokenId = await createToken();
    db.setHederaId("tokenId", tokenId);
  }

  store.topicId = topicId;
  store.tokenId = tokenId;
  console.log("HCS Topic:", topicId);
  console.log("HTS Token:", tokenId);
})().catch((err) => {
  console.error("Hedera init failed:", err.message);
  process.exit(1);
});
