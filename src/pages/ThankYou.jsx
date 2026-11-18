import { useEffect, useState } from "react";
import { money } from "../lib/format.js";
import { clearCode, fetchOrder, sessionIdFromUrl } from "../lib/order.js";
import { Shell } from "./Upsell.jsx";

export default function ThankYou() {
  const [state, setState] = useState({ status: "loading" });

  useEffect(() => {
    clearCode();
    const id = sessionIdFromUrl();
    if (!id) return void location.replace("/");
    fetchOrder(id)
      .then((order) => setState(order.paid ? { status: "ok", order } : { status: "message", text: "We couldn't confirm your payment, so you haven't been charged." }))
      .catch((err) => setState({ status: "message", text: err.message }));
  }, []);

  if (state.status !== "ok") {
    return (
      <Shell>
        <p className="status">{state.status === "loading" ? "Loading your order..." : state.text}</p>
      </Shell>
    );
  }

  const { order } = state;
  const a = order.address;
  const lines = [...order.items];
  if (order.upsell.added) lines.push({ name: `${order.upsell.name} (added after checkout)`, qty: 1, total: order.upsell.price });

  return (
    <Shell>
      <section className="thanks">
        <p className="eyebrow">Order confirmed</p>
        <h1>{order.firstName ? `Thank you, ${order.firstName}.` : "Thank you."}</h1>
        <p className="lead">Order #{order.orderNumber} ships within 24 hours.{order.email && ` Updates go to ${order.email}.`}</p>
      </section>
      <div className="receipt">
        <section className="card" aria-labelledby="sum-title">
          <h2 id="sum-title">Summary</h2>
          <ul className="lines">
            {lines.map((l, i) => (
              <li key={i}><span>{l.name}</span><span>{money(l.total)}</span></li>
            ))}
          </ul>
          <dl className="totals">
            {order.discount > 0 && <div><dt>Discount</dt><dd>-{money(order.discount)}</dd></div>}
            <div><dt>Shipping</dt><dd>Free</dd></div>
            <div className="totals__total"><dt>Total paid</dt><dd>{money(order.total)}</dd></div>
          </dl>
        </section>
        <section className="card" aria-labelledby="del-title">
          <h2 id="del-title">Delivery</h2>
          {a && <address>{a.name}<br />{a.line1}{a.line2 && <><br />{a.line2}</>}<br />{a.city}, {a.state} {a.postalCode}</address>}
          <p className="muted">Standard shipping, 3 to 5 business days</p>
          {order.card && <p className="muted">Paid with {order.card.brand[0].toUpperCase() + order.card.brand.slice(1)} ending in {order.card.last4}</p>}
          <a className="btn btn--secondary btn--full" href="/">Back to Quell</a>
        </section>
      </div>
    </Shell>
  );
}
