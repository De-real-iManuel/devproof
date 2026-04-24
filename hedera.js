const {
  Client,
  PrivateKey,
  AccountId,
  TopicCreateTransaction,
  TopicMessageSubmitTransaction,
  TokenCreateTransaction,
  TokenMintTransaction,
  TransferTransaction,
  TokenType,
  TokenSupplyType,
} = require("@hashgraph/sdk");
const { store } = require("./store");

let client;

function getClient() {
  if (!client) {
    client = Client.forTestnet();
    client.setOperator(
      AccountId.fromString(process.env.HEDERA_ACCOUNT_ID),
      PrivateKey.fromString(process.env.HEDERA_PRIVATE_KEY)
    );
  }
  return client;
}

async function createTopic() {
  const tx = await new TopicCreateTransaction()
    .setTopicMemo("DevProof:global")
    .execute(getClient());
  const receipt = await tx.getReceipt(getClient());
  return receipt.topicId.toString();
}

async function createUserTopic(username) {
  const tx = await new TopicCreateTransaction()
    .setTopicMemo(`DevProof:${username}`)
    .execute(getClient());
  const receipt = await tx.getReceipt(getClient());
  const topicId = receipt.topicId.toString();
  console.log(`[hedera] HCS topic created: ${topicId} for user: ${username}`);
  store.userTopics[username] = topicId;
  return topicId;
}

async function createToken() {
  const operatorKey = PrivateKey.fromString(process.env.HEDERA_PRIVATE_KEY);
  const tx = await new TokenCreateTransaction()
    .setTokenName("DevProof Token")
    .setTokenSymbol("DVP")
    .setTokenType(TokenType.FungibleCommon)
    .setDecimals(0)
    .setInitialSupply(0)
    .setSupplyType(TokenSupplyType.Infinite)
    .setTreasuryAccountId(AccountId.fromString(process.env.HEDERA_ACCOUNT_ID))
    .setAdminKey(operatorKey)
    .setSupplyKey(operatorKey)
    .freezeWith(getClient())
    .sign(operatorKey);

  const receipt = await (await tx.execute(getClient())).getReceipt(getClient());
  return receipt.tokenId.toString();
}

async function logToHCS(username, payload) {
  const topicId = store.userTopics[username] || store.topicId;
  await new TopicMessageSubmitTransaction()
    .setTopicId(topicId)
    .setMessage(JSON.stringify(payload))
    .execute(getClient());
}

async function mintToTreasury(amount) {
  const operatorKey = PrivateKey.fromString(process.env.HEDERA_PRIVATE_KEY);
  const mintTx = await new TokenMintTransaction()
    .setTokenId(store.tokenId)
    .setAmount(amount)
    .freezeWith(getClient())
    .sign(operatorKey);
  await (await mintTx.execute(getClient())).getReceipt(getClient());
}

async function rewardTokens(toAccountId, amount) {
  const operatorKey = PrivateKey.fromString(process.env.HEDERA_PRIVATE_KEY);

  const mintTx = await new TokenMintTransaction()
    .setTokenId(store.tokenId)
    .setAmount(amount)
    .freezeWith(getClient())
    .sign(operatorKey);
  await (await mintTx.execute(getClient())).getReceipt(getClient());

  const transferTx = await new TransferTransaction()
    .addTokenTransfer(store.tokenId, process.env.HEDERA_ACCOUNT_ID, -amount)
    .addTokenTransfer(store.tokenId, toAccountId, amount)
    .execute(getClient());
  await transferTx.getReceipt(getClient());
}

module.exports = { createTopic, createUserTopic, createToken, logToHCS, rewardTokens, mintToTreasury };
