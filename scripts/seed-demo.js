// Fills the database with simulated traffic for the dashboard.
// Run:  npm run db:seed
// Safe to run again: it deletes the old demo rows first. Real visits are never touched.

import { neon } from "@neondatabase/serverless";
import { loadEnvFile } from "./env.js";
import { buildDemoEvents } from "./demo-data.js";
import { insertEventsBulk } from "../api/_db.js";

loadEnvFile();
if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is missing. Add it to .env.local first.");
  process.exit(1);
}

const sql = neon(process.env.DATABASE_URL);
const query = (text, params = []) => sql.query(text, params);

const { events, leads } = buildDemoEvents();

await query("DELETE FROM events WHERE is_demo = true");
await query("DELETE FROM leads WHERE email LIKE 'demo%@example.com'");

const BATCH = 2000;
for (let i = 0; i < events.length; i += BATCH) {
  await insertEventsBulk(query, events.slice(i, i + BATCH));
  process.stdout.write(`\rEvents: ${Math.min(i + BATCH, events.length)} / ${events.length}`);
}

await query(
  `INSERT INTO leads (email, session_id, variant, utm_source)
   SELECT * FROM unnest($1::text[], $2::text[], $3::text[], $4::text[])
   ON CONFLICT (email) DO NOTHING`,
  [leads.map((l) => l.email), leads.map((l) => l.sessionId), leads.map((l) => l.variant), leads.map((l) => l.utmSource)]
);

console.log(`\nDemo data ready: ${events.length} events, ${leads.length} leads.`);
