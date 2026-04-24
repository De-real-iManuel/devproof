# ⛓ DevProof

> Built on my birthday — April 24, 2026 🎂

Reward GitHub commits with Hedera tokens (DVP). A fun side project that turns coding activity into on-chain proof of work.

## Stack
- Node.js + Express
- Hedera SDK (HCS + HTS)
- GitHub Webhooks
- WalletConnect

## How it works
1. Push a commit to GitHub
2. Webhook fires → verified against secret
3. Activity logged to your personal HCS topic
4. DVP tokens minted and sent to your Hedera wallet

## Live
🚀 [devproof-app.fly.dev](https://devproof-app.fly.dev)

## Setup

```bash
cp .env.example .env
# fill in your values
npm install
npm start
```

## Environment Variables

| Variable | Description |
|---|---|
| `HEDERA_ACCOUNT_ID` | Your Hedera account |
| `HEDERA_PRIVATE_KEY` | Your Hedera private key |
| `HEDERA_NETWORK` | `testnet` or `mainnet` (default: testnet) |
| `GITHUB_WEBHOOK_SECRET` | Secret set in GitHub webhook settings |
| `ALLOWED_GITHUB_USER` | GitHub username to accept commits from |
| `PORT` | Server port (default 8000) |

## API

| Endpoint | Method | Description |
|---|---|---|
| `/webhook` | POST | GitHub push event receiver |
| `/stats` | GET | Total commits and rewards |
| `/logs` | GET | Recent activity |
| `/link` | POST | Link GitHub user to Hedera account |
| `/pending/:user` | GET | Check unclaimed rewards |
| `/claim` | POST | Claim pending DVP tokens |

## Reward Logic
- Each commit = 10 DVP tokens
- Tokens are minted on-demand (infinite supply, no treasury drain)
- If no wallet linked, rewards are held as pending until claimed
