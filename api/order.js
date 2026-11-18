// GET /api/order?session_id=cs_...  Returns a safe order summary and records the purchase.
import { getStripe, isValidSessionId, loadSession, summarise, recordPurchase } from "./_order.js";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }
  const id = req.query?.session_id;
  if (!isValidSessionId(id)) {
    res.status(400).json({ error: "We couldn't find that order." });
    return;
  }
  try {
    const session = await loadSession(getStripe(), id);
    await recordPurchase(session);
    res.status(200).json(summarise(session));
  } catch (err) {
    console.error("Order lookup error:", err.message);
    const missing = err.code === "resource_missing";
    res.status(missing ? 404 : 500).json({ error: missing ? "We couldn't find that order." : "We couldn't load your order. Please refresh." });
  }
}
