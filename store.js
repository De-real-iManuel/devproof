// In-memory store — persists for the lifetime of the process
const store = {
  totalCommits: 0,
  totalRewards: 0,
  tokenId: null,
  topicId: null,        // global fallback topic
  logs: [],
  linkedAccounts: {},   // { githubUsername: hederaAccountId }
  pendingRewards: {},   // { githubUsername: tokenAmount }
  userTopics: {},       // { githubUsername: topicId }
};

function addLog(entry) {
  store.logs.unshift({ ...entry, timestamp: new Date().toISOString() });
  if (store.logs.length > 50) store.logs.pop();
}

module.exports = { store, addLog };
