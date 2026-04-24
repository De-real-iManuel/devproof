const fs = require("fs");
const path = require("path");
const initSqlJs = require("sql.js");

const DB_PATH = process.env.DB_PATH || path.join(__dirname, "devproof.db");

let db;

async function getDb() {
  if (db) return db;
  const SQL = await initSqlJs();
  if (fs.existsSync(DB_PATH)) {
    db = new SQL.Database(fs.readFileSync(DB_PATH));
  } else {
    db = new SQL.Database();
  }
  db.run(`
    CREATE TABLE IF NOT EXISTS linked_accounts (
      github_user TEXT PRIMARY KEY,
      account_id TEXT NOT NULL,
      topic_id TEXT
    );
    CREATE TABLE IF NOT EXISTS pending_rewards (
      github_user TEXT PRIMARY KEY,
      amount INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user TEXT, repo TEXT, commits INTEGER, reward INTEGER,
      hedera_account TEXT, timestamp TEXT
    );
    CREATE TABLE IF NOT EXISTS stats (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      total_commits INTEGER DEFAULT 0,
      total_rewards INTEGER DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS hedera_ids (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
    INSERT OR IGNORE INTO stats (id, total_commits, total_rewards) VALUES (1, 0, 0);
  `);
  save();
  return db;
}

function save() {
  if (!db) return;
  fs.writeFileSync(DB_PATH, Buffer.from(db.export()));
}

// Linked accounts
function linkAccount(githubUser, accountId, topicId = null) {
  getDb();
  db.run(
    `INSERT INTO linked_accounts (github_user, account_id, topic_id) VALUES (?, ?, ?)
     ON CONFLICT(github_user) DO UPDATE SET account_id=excluded.account_id, topic_id=COALESCE(excluded.topic_id, topic_id)`,
    [githubUser, accountId, topicId]
  );
  save();
}

function getLinkedAccount(githubUser) {
  getDb();
  const res = db.exec(`SELECT account_id, topic_id FROM linked_accounts WHERE github_user = ?`, [githubUser]);
  if (!res.length) return null;
  const [accountId, topicId] = res[0].values[0];
  return { accountId, topicId };
}

function updateTopicId(githubUser, topicId) {
  getDb();
  db.run(`UPDATE linked_accounts SET topic_id = ? WHERE github_user = ?`, [topicId, githubUser]);
  save();
}

// Pending rewards
function getPending(githubUser) {
  getDb();
  const res = db.exec(`SELECT amount FROM pending_rewards WHERE github_user = ?`, [githubUser]);
  return res.length ? res[0].values[0][0] : 0;
}

function addPending(githubUser, amount) {
  getDb();
  db.run(
    `INSERT INTO pending_rewards (github_user, amount) VALUES (?, ?)
     ON CONFLICT(github_user) DO UPDATE SET amount = amount + excluded.amount`,
    [githubUser, amount]
  );
  save();
}

function clearPending(githubUser) {
  getDb();
  db.run(`UPDATE pending_rewards SET amount = 0 WHERE github_user = ?`, [githubUser]);
  save();
}

// Logs
function addLog(entry) {
  getDb();
  db.run(
    `INSERT INTO logs (user, repo, commits, reward, hedera_account, timestamp) VALUES (?, ?, ?, ?, ?, ?)`,
    [entry.user, entry.repo, entry.commits, entry.reward, entry.hederaAccount || "pending", entry.timestamp]
  );
  // Keep only last 50
  db.run(`DELETE FROM logs WHERE id NOT IN (SELECT id FROM logs ORDER BY id DESC LIMIT 50)`);
  save();
  console.log(`[log] ${entry.user} | ${entry.commits} commits | +${entry.reward} DVP`);
}

function getLogs(limit = 20) {
  getDb();
  const res = db.exec(`SELECT user, repo, commits, reward, hedera_account, timestamp FROM logs ORDER BY id DESC LIMIT ?`, [limit]);
  if (!res.length) return [];
  return res[0].values.map(([user, repo, commits, reward, hederaAccount, timestamp]) =>
    ({ user, repo, commits, reward, hederaAccount, timestamp })
  );
}

// Stats
function getStats() {
  getDb();
  const res = db.exec(`SELECT total_commits, total_rewards FROM stats WHERE id = 1`);
  if (!res.length) return { totalCommits: 0, totalRewards: 0 };
  const [totalCommits, totalRewards] = res[0].values[0];
  return { totalCommits, totalRewards };
}

function incrementStats(commits, rewards) {
  getDb();
  db.run(`UPDATE stats SET total_commits = total_commits + ?, total_rewards = total_rewards + ? WHERE id = 1`, [commits, rewards]);
  save();
}

// Hedera IDs (tokenId, topicId)
function getHederaId(key) {
  getDb();
  const res = db.exec(`SELECT value FROM hedera_ids WHERE key = ?`, [key]);
  return res.length ? res[0].values[0][0] : null;
}

function setHederaId(key, value) {
  getDb();
  db.run(`INSERT INTO hedera_ids (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value`, [key, value]);
  save();
}

module.exports = { getDb, linkAccount, getLinkedAccount, updateTopicId, getPending, addPending, clearPending, addLog, getLogs, getStats, incrementStats, getHederaId, setHederaId };
