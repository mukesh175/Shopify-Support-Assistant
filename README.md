# Zappy — Shopify AI support + order-status widget

A storefront widget that answers customer questions from your knowledge base and
looks up order status — so fewer "where is my order?" tickets reach the merchant.
Built on **Next.js (App Router) + Neon Postgres + Vercel**, using Shopify's
current auth model (**managed installation + token exchange + session tokens**).

## What's inside

| Piece | Path |
|---|---|
| Customer widget (theme app extension) | `extensions/support-widget/` |
| App Proxy endpoint (customer queries) | `src/app/api/proxy/query/route.ts` |
| Embedded admin UI (FAQ manager) | `src/app/`, `src/app/faqs/` |
| FAQ CRUD API (session-token protected) | `src/app/api/faqs/route.ts` |
| Webhooks (uninstall + GDPR, HMAC-verified) | `src/app/api/webhooks/route.ts` |
| Auth (token exchange, session verify, encryption) | `src/lib/auth/` |
| AI service (Gemini → Groq fallback) | `src/lib/ai/answer.ts` |
| Order lookup (Admin GraphQL) | `src/lib/shopify/orders.ts` |
| DB schema (Drizzle) | `src/lib/db/schema.ts` |

## Setup (all free tiers)

### 1. Neon (database)
1. Create a project at neon.tech → copy the **pooled** connection string.
2. It goes into `DATABASE_URL`.

### 2. Shopify app
1. In the Partner Dashboard, create an app (or `shopify app config link`).
2. Copy Client ID / Secret into `.env`.
3. Edit `shopify.app.toml`: set `client_id`, and replace the `your-app.vercel.app`
   URLs with your Vercel domain.

### 3. AI keys (free)
- Gemini: https://aistudio.google.com/apikey → `GEMINI_API_KEY`
- Groq (fallback): https://console.groq.com/keys → `GROQ_API_KEY`

### 4. Local env
```bash
cp .env.example .env      # fill in every value
openssl rand -hex 32      # paste result into TOKEN_ENC_KEY
npm install
npm run db:push           # creates tables in Neon
```

### 5. Deploy to Vercel
1. Push this repo to GitHub, import into Vercel.
2. Add every variable from `.env` into Vercel → Project → Settings → Env Vars.
3. Deploy. Note the production URL and put it in `shopify.app.toml` +
   `SHOPIFY_APP_URL`.
4. `npm run shopify:deploy` to push app config + the widget extension to Shopify.

### 6. Install on your dev store
- `npm run shopify:dev` (installs on your dev store via the CLI), **or** open the
  app's install link from the Partner Dashboard.
- On the storefront: **Online Store → Themes → Customize → App embeds →** enable
  **Zappy**. The widget appears bottom-right.

## Notes & guardrails
- **Vercel Hobby is non-commercial.** Fine for building/testing. Once you have a
  paying merchant, move to Vercel Pro, or host on Netlify/Cloudflare (their free
  tiers allow commercial use).
- **AI free tiers change monthly and can delete models without notice.** The AI
  layer (`src/lib/ai/answer.ts`) is provider-abstracted for exactly this reason —
  add/reorder providers in the `PROVIDERS` array; no other code changes.
- **Expiring offline tokens** (required for public apps from 2026-04-01) are
  handled: tokens are stored with `tokenExpiresAt` and re-fetched via token
  exchange when stale.
- Access tokens are **encrypted at rest** (AES-256-GCM) before hitting Neon.
- Order lookup requires **order number + matching email**, so a customer can only
  see their own order.

## Roadmap (next builds)
- WhatsApp channel + Hindi/regional replies (India-first differentiator).
- Merchant analytics page ("N tickets deflected this month") from `query_logs`.
- Polaris UI polish for App Store submission.
- Vector search over FAQs for larger knowledge bases.
