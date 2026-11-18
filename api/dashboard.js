// Funnel numbers for the analytics dashboard.
// GET /api/dashboard?days=7&demo=1
//   days: 1, 7 or 30     demo: 1 includes the simulated traffic, 0 shows real visits only

import { getQuery } from "./_db.js";
import { HEADLINES } from "../src/data/offer.js";

export const STEPS = [
  ["page_view", "Landed on page"],
  ["scroll_bundles", "Scrolled to bundles"],
  ["bundle_selected", "Chose a bundle"],
  ["checkout_started", "Started checkout"],
  ["purchase", "Paid"],
  ["upsell_accepted", "Accepted upsell"],
];

// Two-proportion z-test: how sure we can be that A and B really differ
export function abConfidence(a, b) {
  if (!a.visitors || !b.visitors) return 0;
  const pa = a.orders / a.visitors;
  const pb = b.orders / b.visitors;
  const pooled = (a.orders + b.orders) / (a.visitors + b.visitors);
  const se = Math.sqrt(pooled * (1 - pooled) * (1 / a.visitors + 1 / b.visitors));
  if (!se) return 0;
  const z = Math.abs(pa - pb) / se;
  // Normal distribution, two-sided (Abramowitz and Stegun approximation)
  const t = 1 / (1 + 0.2316419 * z);
  const d = 0.3989423 * Math.exp((-z * z) / 2);
  const tail = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  return Math.max(0, Math.min(1, 1 - 2 * tail));
}

export async function buildDashboard(query, { days = 7, includeDemo = true } = {}) {
  const params = [days, includeDemo];
  const where = `created_at >= now() - ($1::int * interval '1 day') AND ($2::bool OR is_demo = false)`;

  const [funnelRows, abRows, money, sources, leads, demoCount] = await Promise.all([
    query(`SELECT event, COUNT(DISTINCT session_id)::int AS n FROM events WHERE ${where} GROUP BY event`, params),
    query(
      `SELECT variant,
              COUNT(DISTINCT session_id) FILTER (WHERE event = 'page_view')::int AS visitors,
              COUNT(*) FILTER (WHERE event = 'purchase')::int AS orders
       FROM events WHERE ${where} AND variant IN ('A','B') GROUP BY variant`,
      params
    ),
    query(
      `SELECT COUNT(*) FILTER (WHERE event = 'purchase')::int AS orders,
              COALESCE(SUM(value_cents) FILTER (WHERE event IN ('purchase','upsell_accepted')), 0)::bigint AS revenue,
              COALESCE(SUM((meta->>'bundle_cents')::int) FILTER (WHERE event = 'purchase'), 0)::bigint AS bundle_cents,
              COALESCE(SUM((meta->>'protect_cents')::int) FILTER (WHERE event = 'purchase'), 0)::bigint AS protect_cents,
              COALESCE(SUM((meta->>'discount_cents')::int) FILTER (WHERE event = 'purchase'), 0)::bigint AS discount_cents,
              COALESCE(SUM(value_cents) FILTER (WHERE event = 'upsell_accepted'), 0)::bigint AS upsell_cents,
              COUNT(*) FILTER (WHERE event = 'purchase' AND meta->>'bundle' IN ('2','3'))::int AS multi,
              COUNT(*) FILTER (WHERE event = 'purchase' AND (meta->>'protect_cents')::int > 0)::int AS with_protect
       FROM events WHERE ${where}`,
      params
    ),
    query(
      `SELECT COALESCE(utm_source, 'direct') AS source, COALESCE(MAX(utm_campaign), '') AS campaign,
              COUNT(DISTINCT session_id) FILTER (WHERE event = 'page_view')::int AS visitors,
              COUNT(*) FILTER (WHERE event = 'purchase')::int AS orders,
              COALESCE(SUM(value_cents) FILTER (WHERE event IN ('purchase','upsell_accepted')), 0)::bigint AS revenue
       FROM events WHERE ${where} GROUP BY 1 ORDER BY revenue DESC`,
      params
    ),
    query(`SELECT COUNT(DISTINCT session_id)::int AS n FROM events WHERE ${where} AND event = 'lead_captured'`, params),
    query(`SELECT COUNT(*)::int AS n FROM events WHERE ${where} AND is_demo = true`, params),
  ]);

  const count = Object.fromEntries(funnelRows.map((r) => [r.event, r.n]));
  const visitors = count.page_view || 0;
  const funnel = STEPS.map(([event, label]) => ({ event, label, sessions: count[event] || 0 }));

  const m = money[0] || {};
  const orders = m.orders || 0;
  const num = (v) => Number(v || 0);
  const perOrder = (cents) => (orders ? num(cents) / 100 / orders : 0);
  const base = 79;
  const avgBundle = perOrder(m.bundle_cents);

  const ab = ["A", "B"].map((v) => {
    const row = abRows.find((r) => r.variant === v) || { visitors: 0, orders: 0 };
    return { variant: v, headline: HEADLINES[v], visitors: row.visitors, orders: row.orders, rate: row.visitors ? row.orders / row.visitors : 0 };
  });
  const [a, b] = ab;
  const leader = a.rate === b.rate ? null : a.rate > b.rate ? a : b;
  const loser = leader === a ? b : a;

  return {
    days,
    includeDemo,
    hasDemo: demoCount[0]?.n > 0,
    kpis: {
      visitors,
      orders,
      conversion: visitors ? orders / visitors : 0,
      revenue: num(m.revenue) / 100,
      aov: orders ? num(m.revenue) / 100 / orders : 0,
      revenuePerVisitor: visitors ? num(m.revenue) / 100 / visitors : 0,
      leads: leads[0]?.n || 0,
    },
    funnel,
    ab: {
      variants: ab,
      leader: leader?.variant || null,
      lift: leader && loser.rate ? leader.rate / loser.rate - 1 : 0,
      confidence: abConfidence(a, b),
    },
    aov: {
      base: orders ? base : 0,
      bundles: orders ? Math.max(0, avgBundle - base) : 0,
      protect: perOrder(m.protect_cents),
      upsell: perOrder(m.upsell_cents),
      discount: perOrder(m.discount_cents),
      multiShare: orders ? m.multi / orders : 0,
      protectShare: orders ? m.with_protect / orders : 0,
      upsellShare: orders ? (count.upsell_accepted || 0) / orders : 0,
    },
    sources: sources.filter((s) => s.visitors > 0).map((s) => ({
      source: s.source,
      campaign: s.campaign,
      visitors: s.visitors,
      conversion: s.visitors ? s.orders / s.visitors : 0,
      revenue: num(s.revenue) / 100,
    })),
  };
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }
  const query = getQuery();
  if (!query) {
    res.status(503).json({ error: "The analytics database isn't connected. Add DATABASE_URL and run npm run db:setup." });
    return;
  }
  const days = [1, 7, 30].includes(Number(req.query?.days)) ? Number(req.query.days) : 7;
  const includeDemo = req.query?.demo !== "0";
  try {
    res.status(200).json(await buildDashboard(query, { days, includeDemo }));
  } catch (err) {
    console.error("Dashboard error:", err.message);
    res.status(500).json({ error: "Couldn't load the numbers. Please refresh." });
  }
}
