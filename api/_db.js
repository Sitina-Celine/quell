// Database access for the server functions (Neon Postgres over HTTP).
// The underscore means Vercel treats this as shared code, not an endpoint.
//
// Every function here returns plain rows. If DATABASE_URL isn't set,
// tracking quietly does nothing, so the shop still works without a database.

import { neon } from "@neondatabase/serverless";

let cached;

export function getQuery() {
  // Tests can swap in another database (PGlite) through this hook
  if (globalThis.__quellQuery) return globalThis.__quellQuery;
  if (!process.env.DATABASE_URL) return null;
  if (!cached) {
    const sql = neon(process.env.DATABASE_URL);
    cached = (text, params = []) => sql.query(text, params);
  }
  return cached;
}

export const EVENT_NAMES = [
  "page_view",
  "scroll_bundles",
  "bundle_selected",
  "checkout_started",
  "purchase",
  "upsell_accepted",
  "lead_captured",
];

// Saves one event. dedupeKey makes server-side events count once (refreshes, retries).
export async function insertEvent(query, e) {
  await query(
    `INSERT INTO events (session_id, event, variant, utm_source, utm_campaign, value_cents, meta, is_demo, dedupe_key, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, COALESCE($10::timestamptz, now()))
     ON CONFLICT (dedupe_key) DO NOTHING`,
    [
      e.sessionId,
      e.event,
      e.variant || null,
      e.utmSource || null,
      e.utmCampaign || null,
      e.valueCents || 0,
      JSON.stringify(e.meta || {}),
      Boolean(e.isDemo),
      e.dedupeKey || null,
      e.createdAt || null,
    ]
  );
}

// Inserts many events in one round trip (used by the demo seed)
export async function insertEventsBulk(query, events) {
  if (!events.length) return;
  const cols = [[], [], [], [], [], [], [], [], []];
  for (const e of events) {
    cols[0].push(e.sessionId);
    cols[1].push(e.event);
    cols[2].push(e.variant || null);
    cols[3].push(e.utmSource || null);
    cols[4].push(e.utmCampaign || null);
    cols[5].push(e.valueCents || 0);
    cols[6].push(JSON.stringify(e.meta || {}));
    cols[7].push(Boolean(e.isDemo));
    cols[8].push(e.createdAt);
  }
  await query(
    `INSERT INTO events (session_id, event, variant, utm_source, utm_campaign, value_cents, meta, is_demo, created_at)
     SELECT * FROM unnest($1::text[], $2::text[], $3::text[], $4::text[], $5::text[], $6::int[], $7::jsonb[], $8::bool[], $9::timestamptz[])`,
    cols
  );
}
