// Builds realistic simulated traffic for the dashboard.
// Every row is marked is_demo = true, and the dashboard labels it as demo data.
//
// Each simulated visitor walks the funnel step by step; at each step there's
// a chance they leave. Headline A is set to convert better than B,
// so the A/B panel has a clear (made-up) winner to show.

import { BUNDLES, PROTECT, UPSELL } from "../src/data/offer.js";

const SOURCES = [
  { source: "tiktok", campaign: "commute_video", share: 0.41, buyBoost: 1.12 },
  { source: "instagram", campaign: "gym_reel", share: 0.31, buyBoost: 0.92 },
  { source: "google", campaign: "search", share: 0.18, buyBoost: 1.0 },
  { source: "email", campaign: "quell10", share: 0.1, buyBoost: 0.55 },
];

// A small seeded random generator, so the demo data is the same every time
function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick(r, items, weightKey) {
  let x = r();
  for (const item of items) {
    x -= item[weightKey];
    if (x <= 0) return item;
  }
  return items[items.length - 1];
}

export function buildDemoEvents({ visitors = 12480, days = 7, now = Date.now(), seed = 42 } = {}) {
  const r = rng(seed);
  const events = [];
  const leads = [];

  for (let i = 0; i < visitors; i++) {
    const sessionId = `demo-${seed}-${i}`;
    const variant = r() < 0.5 ? "A" : "B";
    const src = pick(r, SOURCES, "share");
    let t = now - r() * days * 86400000;
    const base = { sessionId, variant, utmSource: src.source, utmCampaign: src.campaign, isDemo: true };
    const add = (event, extra = {}) => {
      t += 4000 + r() * 90000;
      events.push({ ...base, event, createdAt: new Date(Math.min(t, now)).toISOString(), ...extra });
    };

    add("page_view");

    // Some leavers give their email for 10% off
    const scrolled = r() < 0.46;
    if (!scrolled) {
      if (r() < 0.12) {
        add("lead_captured");
        leads.push({ email: `demo${i}@example.com`, sessionId, variant, utmSource: src.source });
      }
      continue;
    }
    add("scroll_bundles");

    const chooseRate = 0.2 * (variant === "A" ? 1.1 : 0.9) * src.buyBoost;
    if (r() >= chooseRate) {
      if (r() < 0.1) {
        add("lead_captured");
        leads.push({ email: `demo${i}@example.com`, sessionId, variant, utmSource: src.source });
      }
      continue;
    }
    const bundle = pick(r, [
      { id: "1", w: 0.42 },
      { id: "2", w: 0.43 },
      { id: "3", w: 0.15 },
    ], "w");
    add("bundle_selected", { meta: { bundle: bundle.id } });

    if (r() >= 0.7) continue;
    const protect = r() < 0.42;
    add("checkout_started", { meta: { bundle: bundle.id, protect } });

    if (r() >= (variant === "A" ? 0.52 : 0.46)) continue;
    const bundleCents = BUNDLES[bundle.id].price * 100;
    const protectCents = protect ? PROTECT.price * 100 : 0;
    add("purchase", {
      valueCents: bundleCents + protectCents,
      meta: { bundle: bundle.id, bundle_cents: bundleCents, protect_cents: protectCents, discount_cents: 0 },
    });

    if (r() < 0.36) add("upsell_accepted", { valueCents: UPSELL.price * 100 });
  }

  return { events, leads };
}
