require("dotenv").config();
const express = require("express");
const { createTopic, createToken } = require("./hedera");
const { store } = require("./store");

const app = express();

// Capture raw body for webhook signature verification
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
  console.log("Initializing Hedera resources...");
  store.topicId = await createTopic();
  console.log("HCS Topic:", store.topicId);
  store.tokenId = await createToken();
  console.log("HTS Token:", store.tokenId);
  console.log(`Allowed user: ${process.env.ALLOWED_GITHUB_USER}`);
})().catch((err) => {
  console.error("Hedera init failed:", err.message);
  process.exit(1);
});
