// Saves an email from the "10% off" offer and returns the discount code.
// POST /api/lead  { email, sessionId, variant, utmSource }

import { getQuery, insertEvent } from "./_db.js";
import { DISCOUNT } from "../src/data/offer.js";

const EMAIL = /^[^\s@]{1,64}@[^\s@]{1,190}\.[a-z]{2,24}$/i;

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const email = String(req.body?.email || "").trim().toLowerCase();
  if (!EMAIL.test(email)) {
    res.status(400).json({ error: "Enter a valid email address." });
    return;
  }

  const sessionId = String(req.body?.sessionId || "").slice(0, 64) || "unknown";
  const variant = ["A", "B"].includes(req.body?.variant) ? req.body.variant : null;
  const utmSource = typeof req.body?.utmSource === "string" ? req.body.utmSource.slice(0, 40) : null;

  const query = getQuery();
  if (query) {
    try {
      await query(
        `INSERT INTO leads (email, session_id, variant, utm_source) VALUES ($1, $2, $3, $4)
         ON CONFLICT (email) DO NOTHING`,
        [email, sessionId, variant, utmSource]
      );
      await insertEvent(query, {
        sessionId,
        event: "lead_captured",
        variant,
        utmSource,
        dedupeKey: `lead:${email}`,
      });
    } catch (err) {
      // The shopper still gets the code; the lead just isn't stored
      console.error("Lead error:", err.message);
    }
  }

  res.status(200).json({ code: DISCOUNT.code, percent: DISCOUNT.percent });
}
