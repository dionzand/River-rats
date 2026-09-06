# Setting up the room server, from a phone

The game itself is a static page and needs nothing. **Rooms** — playing on separate phones —
need somewhere to hold the table, because the cards have to be dealt by something neither
player controls. That is one Cloudflare Worker, on the free plan, and this is a one-time setup
you can do entirely in Safari.

Ten minutes, once. Afterwards every push deploys it for you.

## 1. Make a Cloudflare account

[dash.cloudflare.com/sign-up](https://dash.cloudflare.com/sign-up) — email and a password. No
card, no domain, nothing to buy. The free plan covers a card game comfortably.

## 2. Copy your account ID

Open any page of the dashboard. The account ID is a long hex string in the address bar right
after `dash.cloudflare.com/`, and also listed on the Workers overview page. Copy it.

## 3. Make an API token

**My Profile → API Tokens → Create Token → "Edit Cloudflare Workers" template → Continue →
Create Token.** Copy the token now; Cloudflare shows it once.

## 4. Paste both into GitHub

In this repository: **Settings → Secrets and variables → Actions → New repository secret.**
Add two:

| Name | Value |
| --- | --- |
| `CLOUDFLARE_ACCOUNT_ID` | the ID from step 2 |
| `CLOUDFLARE_API_TOKEN` | the token from step 3 |

## 5. Deploy

**Actions → "Deploy room server" → Run workflow.** It runs the tests, then publishes. When it
finishes, the log ends with the address it published to, something like:

```
https://river-rats-rooms.<your-subdomain>.workers.dev
```

## 6. Tell the game where the rooms are

Put that address in `js/config.js` as `ROOM_SERVER`, commit, and the Pages site picks it up.
Until then the game plays exactly as it does now, on one phone.

---

**What it costs:** nothing. The free plan allows 100,000 requests a day; a four-player game is
a few hundred. Durable Objects are included on the free plan in their SQLite form, which is what
`wrangler.toml` asks for.

**What it holds:** one table per room code, in memory, written to the Durable Object's storage
after each change so a room that goes quiet can pick the game up again. Nothing about you — no
account, no email, no name beyond the one you type on the setup screen.
