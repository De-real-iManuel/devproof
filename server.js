require("dotenv").config();
const fs = require("fs");
const path = require("path");
const express = require("express");
const { createTopic, createToken } = require("./hedera");
const { store } = require("./store");
const db = require("./db");

function persistEnv(key, value) {
  const envPath = path.join(__dirname, ".env");
  let content = fs.existsSync(envPath) ? fs.readFileSync(envPath, "utf8") : "";
  const line = `${key}=${value}`;
  if (new RegExp(`^${key}=`, "m").test(content)) {
    content = content.replace(new RegExp(`^${key}=.*`, "m"), line);
  } else {
    content = content.trimEnd() + `\n${line}\n`;
  }
  fs.writeFileSync(envPath, content);
  process.env[key] = value;
}

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

  // Prefer env vars, then DB, then create new
  let topicId = process.env.HEDERA_TOPIC_ID || db.getHederaId("topicId");
  let tokenId = process.env.HEDERA_TOKEN_ID || db.getHederaId("tokenId");

  if (!topicId) {
    console.log("Creating HCS topic...");
    topicId = await createTopic();
    db.setHederaId("topicId", topicId);
    persistEnv("HEDERA_TOPIC_ID", topicId);
  }

  if (!tokenId) {
    console.log("Creating HTS token...");
    tokenId = await createToken();
    db.setHederaId("tokenId", tokenId);
    persistEnv("HEDERA_TOKEN_ID", tokenId);
  }

  // Sync DB so future restarts skip creation even if .env is missing
  if (!db.getHederaId("topicId")) db.setHederaId("topicId", topicId);
  if (!db.getHederaId("tokenId")) db.setHederaId("tokenId", tokenId);

  store.topicId = topicId;
  store.tokenId = tokenId;
  console.log("HCS Topic:", topicId);
  console.log("HTS Token:", tokenId);
})().catch((err) => {
  console.error("Hedera init failed:", err.message);
  process.exit(1);
});
