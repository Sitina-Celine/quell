// One-click upsell after payment: the charging pad, charged to the card just used.
// If the offer doesn't apply, the shopper goes straight to the thank-you page.

import { useEffect, useState } from "react";
import { money } from "../lib/format.js";
import { clearCode, fetchOrder, sessionIdFromUrl, thankYouUrl } from "../lib/order.js";

export default function Upsell() {
  const sessionId = sessionIdFromUrl();
  const [state, setState] = useState({ status: "loading" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    clearCode();
    if (!sessionId) return void location.replace("/");
    fetchOrder(sessionId)
      .then((order) => {
        if (!order.paid) return setState({ status: "message", text: "We couldn't confirm your payment, so you haven't been charged." });
        if (!order.upsell.canOffer) return location.replace(thankYouUrl(sessionId));
        setState({ status: "ok", order });
      })
      .catch((err) => setState({ status: "message", text: err.message }));
  }, [sessionId]);

  async function accept() {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/accept-upsell", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId }),
      });
      const data = await res.json().catch(() => ({}));
      if (data.added) return location.replace(thankYouUrl(sessionId, "&upsell=added"));
      throw new Error(data.error || "We couldn't add it. Your order is confirmed.");
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  if (state.status !== "ok") {
    return (
      <Shell>
        <p className="status">{state.status === "loading" ? "Loading your order..." : state.text}</p>
        {state.status === "message" && <a className="link" href="/">Back to Quell</a>}
      </Shell>
    );
  }

  const { order } = state;
  const u = order.upsell;
  return (
    <Shell>
      <p className="confirm">Payment received. Order <strong>#{order.orderNumber}</strong> is confirmed.</p>
      <section className="upsell" aria-labelledby="up-title">
        <div className="upsell__media"><img src="/img/detail.jpg" alt="Quell earbuds" /></div>
        <div className="upsell__copy">
          <p className="eyebrow">One-time offer for this order</p>
          <h1 id="up-title">Never plug in again.</h1>
          <p className="lead">{u.note} It ships in the same box, at no extra cost.</p>
          <p className="upsell__price"><strong>{money(u.price)}</strong><s>{money(u.compareAt)}</s><span>Save {money(u.compareAt - u.price)}</span></p>
          {!error && (
            <>
              <button type="button" className="btn btn--primary btn--full" onClick={accept} disabled={busy}>
                {busy ? "Adding..." : `Yes, add it for ${money(u.price)}`}
              </button>
              <p className="small">
                Charged to your {order.card ? `${order.card.brand[0].toUpperCase()}${order.card.brand.slice(1)} ending in ${order.card.last4}` : "card"}. No need to enter it again.
              </p>
            </>
          )}
          {error && <p className="notice" role="alert">{error}</p>}
          <a className="link link--plain" href={thankYouUrl(sessionId)}>{error ? "Continue to my order" : "No thanks, continue to my order"}</a>
        </div>
      </section>
    </Shell>
  );
}

export function Shell({ children }) {
  return (
    <div className="order">
      <header className="nav nav--static">
        <a className="nav__logo" href="/">Quell</a>
        <span className="nav__secure">Secure order</span>
      </header>
      <main className="order__main">{children}</main>
    </div>
  );
}
