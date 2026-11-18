// Records a funnel event sent from the browser.
// POST /api/track  { sessionId, event, variant, utmSource, utmCampaign, meta }
// Purchases and upsells are NOT accepted here: the server records those itself
// from Stripe, so nobody can fake revenue by calling this endpoint.

import { getQuery, insertEvent } from "./_db.js";

const BROWSER_EVENTS = new Set(["page_view", "scroll_bundles", "bundle_selected", "checkout_started"]);
const clean = (v, max = 64) => (typeof v === "string" ? v.slice(0, max).replace(/[^\w\-.:@]/g, "") : null);

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  // sendBeacon posts text, so the body may arrive as a string
  let body = req.body;
  if (typeof body === "string") {
    try {
      body = JSON.parse(body);
    } catch {
      body = {};
    }
  }

  const sessionId = clean(body?.sessionId);
  const event = body?.event;
  if (!sessionId || !BROWSER_EVENTS.has(event)) {
    res.status(400).json({ error: "Invalid event" });
    return;
  }

  const query = getQuery();
  if (!query) {
    res.status(202).json({ ok: true, stored: false });
    return;
  }

  try {
    const meta = {};
    if (["1", "2", "3"].includes(body?.meta?.bundle)) meta.bundle = body.meta.bundle;
    if (typeof body?.meta?.protect === "boolean") meta.protect = body.meta.protect;

    await insertEvent(query, {
      sessionId,
      event,
      variant: ["A", "B"].includes(body?.variant) ? body.variant : null,
      utmSource: clean(body?.utmSource, 40),
      utmCampaign: clean(body?.utmCampaign, 60),
      meta,
      // Only count a page view and the bundle scroll once per visit
      dedupeKey: event === "page_view" || event === "scroll_bundles" ? `${event}:${sessionId}` : null,
    });
    res.status(200).json({ ok: true, stored: true });
  } catch (err) {
    console.error("Track error:", err.message);
    res.status(500).json({ error: "Could not record event" });
  }
}
