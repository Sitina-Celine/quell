// Quick check that the keys are loaded. Never returns the keys themselves.
export default function handler(req, res) {
  const key = process.env.STRIPE_SECRET_KEY || "";
  res.status(200).json({
    ok: true,
    stripeKeyLoaded: Boolean(key),
    testMode: key.startsWith("sk_test_"),
    databaseConnected: Boolean(process.env.DATABASE_URL),
  });
}
