# Quell: a measured sales funnel

**Turn the world down.**

A complete direct-to-consumer sales funnel for one product, built the way paid-traffic brands sell: one focused page, an A/B-tested headline, email capture, bundles, an order bump, a one-click upsell, and an analytics dashboard that measures every step.

Quell is a fictional brand created for a portfolio demo. Author: Celine Sitina.

## The funnel

```
Ad (UTM-tagged link)
  -> Sales page        A/B test on the headline, bundle choice, order bump
     -> leaving?       10% off for an email (lead capture, real Stripe coupon)
  -> Stripe Checkout   card saved for the one-click upsell
  -> Upsell            wireless charging pad, charged with one click
  -> Thank-you         order read from Stripe
Every step -> events table (Neon Postgres) -> /dashboard.html
```

| Step | What happens | What is measured |
|---|---|---|
| Sales page | Hero, Why Quell, reviews, bundle box | Page view, scrolled to bundles, bundle chosen |
| Email offer | Shown once when a visitor looks like leaving | Lead captured |
| Buy box | 1, 2 or 3 pairs, plus Quell Protect ($9) | Checkout started |
| Stripe Checkout | Free US shipping, discount applied if the visitor has one | Purchase (recorded by the server from Stripe) |
| Upsell | Charging pad, $19 (usually $29) | Upsell accepted (recorded by the server) |

## The analytics dashboard

`/dashboard.html` shows, for today, 7 or 30 days:

- **Headline numbers:** visitors, conversion rate, average order value, revenue, emails captured.
- **Funnel:** how many visitors reach each step, with the biggest drop-off flagged.
- **A/B test:** conversion for each headline, with a two-proportion z-test so the page only calls a winner when the difference is unlikely to be chance.
- **What builds the average order:** base price, plus what bundles, the order bump and the upsell each add.
- **By traffic source:** visitors, conversion and revenue per ad campaign, from UTM tags.

A new shop has no traffic, so `npm run db:seed` adds about 12,000 simulated visits. Every simulated row is flagged `is_demo`, the dashboard labels it, and a switch hides it to show real visits only.

## Design decisions

- **One page, no menu to the rest of a store.** Every link leads down the page or to checkout.
- **Short page.** Each section is held to about one screen; the hero fits headline, product and specs without scrolling. About 3 screens on desktop.
- **Server-side truth.** Prices come from `src/data/offer.js` on the server. Purchases and upsells are recorded by the server from Stripe, never by the browser, so revenue on the dashboard can't be faked.
- **No double counting.** Page views, purchases, upsells and leads carry a dedupe key. The upsell charge uses a Stripe idempotency key.
- **Honest social proof.** Reviews are labelled as samples. A live store would connect a verified-review app.
- **Works without a database.** If `DATABASE_URL` is missing, tracking quietly does nothing and the shop still sells.

## Tech stack

| Part | Choice |
|---|---|
| Interface | React 19 and Vite, four pages |
| Payments | Stripe Checkout, PaymentIntents for the off-session upsell, Coupons for the email discount |
| Server code | Vercel serverless functions in `/api` |
| Analytics store | Neon Postgres (serverless HTTP driver), plain SQL |
| Hosting | Vercel |

## Project structure

```
api/
  create-checkout.js   Builds the Stripe Checkout Session from the bundle choice
  order.js             Order summary for the upsell and thank-you pages; records the purchase
  accept-upsell.js     One-click charge for the charging pad; records the upsell
  track.js             Browser funnel events
  lead.js              Email capture, returns the discount code
  dashboard.js         All dashboard numbers, including the A/B significance test
  _db.js, _order.js    Shared helpers
  health.js            Checks the keys are loaded
scripts/
  schema.sql           Tables: events, leads
  setup-db.js          npm run db:setup
  demo-data.js         Simulated traffic generator (seeded, repeatable)
  seed-demo.js         npm run db:seed
src/
  pages/               Sales, Upsell, ThankYou, Dashboard
  components/          EmailOffer
  lib/                 track.js (session, A/B variant, UTM), order.js, format.js
  data/offer.js        Bundles, order bump, upsell, discount, headlines
  styles/              base, sales, order, dashboard
```

## Running it locally

You need Node.js 20.19 or newer, a free Stripe account (sandbox) and a free Neon database.

1. `npm install`
2. Create `.env.local`:

   ```
   STRIPE_SECRET_KEY=sk_test_...
   DATABASE_URL=postgresql://...
   ```

   This file is in `.gitignore` and must never be committed.
3. `npm run db:setup` creates the tables. `npm run db:seed` adds the demo traffic.
4. `npm run dev`, then open http://localhost:5173 and http://localhost:5173/dashboard.html

Useful while testing:

- `?variant=A` or `?variant=B` forces a headline.
- `?utm_source=tiktok&utm_campaign=commute_video` simulates arriving from an ad.
- Card `4242 4242 4242 4242`, any future date, any 3-digit code.

## Deploying

Import the GitHub repository into Vercel, add `STRIPE_SECRET_KEY` and `DATABASE_URL` under Settings, Environment Variables, and deploy. (Vercel's Neon integration can create the database and add `DATABASE_URL` for you.)

## What a production launch would add

- A Stripe webhook as a second path for recording purchases, in case a buyer closes the tab before the order page loads.
- Real review collection, and email flows (abandoned checkout, refill reminders) from the captured leads.
- Protecting the dashboard behind a login.

## Credits

Hero photo by Patrick Zahn, commuter photo by Finn Mund, both on Unsplash. Product names and brands shown in stock photos belong to their owners; Quell is not affiliated with any of them.
