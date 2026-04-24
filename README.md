# ⛓ DevProof

Reward GitHub commits with Hedera tokens (DVP).

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
| `HEDERA_ACCOUNT_ID` | Your Hedera testnet account |
| `HEDERA_PRIVATE_KEY` | Your Hedera private key |
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
