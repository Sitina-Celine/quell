// The sales page: one product, one goal. No menu to wander off into.
// Every section is kept to about one screen so the page stays short.

import { useEffect, useMemo, useRef, useState } from "react";
import { BUNDLES, DEFAULT_BUNDLE, PROTECT, DISCOUNT, HEADLINES } from "../data/offer.js";
import { money } from "../lib/format.js";
import { track, visitor } from "../lib/track.js";
import EmailOffer from "../components/EmailOffer.jsx";

const REVIEWS = [
  { stars: 5, text: "My train ride is finally mine. I charge them on Sunday and forget about them.", who: "Commuter" },
  { stars: 5, text: "They stay in on long runs. The smallest tips were the right fit for me.", who: "Runner" },
  { stars: 4, text: "Open-plan office, zero distractions. I bought a second pair for my partner.", who: "Office worker" },
];

const readCode = () => {
  try {
    return localStorage.getItem("quell-code") || "";
  } catch {
    return "";
  }
};

export default function Sales() {
  const v = useMemo(visitor, []);
  const [bundle, setBundle] = useState(DEFAULT_BUNDLE);
  const [protect, setProtect] = useState(false);
  const [code, setCode] = useState(readCode);
  const [hadCode] = useState(() => Boolean(readCode())); // offer shows only to visitors without a code
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [showSticky, setShowSticky] = useState(false);
  const buyRef = useRef(null);
  const heroRef = useRef(null);

  // Page view, once per visit
  useEffect(() => {
    track("page_view");
    const params = new URLSearchParams(location.search);
    if (params.get("checkout") === "cancelled") {
      setNotice("Checkout cancelled. Your bundle is still selected.");
      history.replaceState(null, "", location.pathname + location.hash);
    }
    const reset = (e) => e.persisted && setBusy(false);
    addEventListener("pageshow", reset);
    return () => removeEventListener("pageshow", reset);
  }, []);

  // "Scrolled to bundles" fires when the buy box comes into view; the phone buy bar
  // shows once the hero's button has scrolled away and hides again at the buy box
  useEffect(() => {
    let seen = false;
    let heroVisible = true;
    let buyVisible = false;
    const update = () => setShowSticky(!heroVisible && !buyVisible);
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (e.target === buyRef.current) {
          buyVisible = e.isIntersecting;
          if (e.isIntersecting && !seen) {
            seen = true;
            track("scroll_bundles");
          }
        } else heroVisible = e.isIntersecting;
      }
      update();
    }, { threshold: 0.25 });
    io.observe(buyRef.current);
    io.observe(heroRef.current);
    return () => io.disconnect();
  }, []);

  const chosen = BUNDLES[bundle];
  const subtotal = chosen.price + (protect ? PROTECT.price : 0);
  const discount = code ? Math.round(subtotal * DISCOUNT.percent) / 100 : 0;
  const total = subtotal - discount;
  const saving = chosen.compareAt - chosen.price + discount;

  function choose(id) {
    setBundle(id);
    track("bundle_selected", { bundle: id });
  }

  async function checkout() {
    setBusy(true);
    setNotice("");
    track("checkout_started", { bundle, protect });
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 20000);
    try {
      const res = await fetch("/api/create-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bundle, protect, code, email, ...v }),
        signal: controller.signal,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.url) throw new Error(data.error || "Checkout couldn't start. Please try again.");
      location.href = data.url;
    } catch (err) {
      setNotice(err.name === "AbortError" ? "Checkout is taking too long. Please try again." : err.message);
      setBusy(false);
    } finally {
      clearTimeout(timer);
    }
  }

  const scrollToBuy = (e) => {
    e?.preventDefault();
    buyRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="page">
      <header className="nav">
        <a className="nav__logo" href="#top">Quell</a>
        <nav className="nav__links" aria-label="Page sections">
          <a href="#why">Why Quell</a>
          <a href="#reviews">Reviews</a>
          <a className="nav__buy" href="#buy" onClick={scrollToBuy}>Buy</a>
        </nav>
      </header>

      <main>
        <section className="hero" id="top" ref={heroRef} aria-labelledby="hero-title">
          <p className="hero__kicker">Quell Earbuds</p>
          <h1 id="hero-title" className="hero__title">{HEADLINES[v.variant]}</h1>
          <p className="hero__lead">Adaptive noise cancelling and forty hours of battery, in a case that fits your pocket.</p>
          <div className="hero__actions">
            <a className="btn btn--primary" href="#buy" onClick={scrollToBuy}>Buy from {money(BUNDLES["1"].price)}</a>
            <a className="link" href="#why">See why Quell</a>
          </div>
          <div className="hero__media">
            <img src="/img/hero.jpg" alt="Quell earbuds in their open charging case" fetchPriority="high" />
          </div>
          <dl className="specs">
            <div><dt>Battery with case</dt><dd>40h</dd></div>
            <div><dt>Noise cancelling</dt><dd>-35dB</dd></div>
            <div><dt>Per earbud</dt><dd>4.6g</dd></div>
            <div><dt>Warranty</dt><dd>2 yr</dd></div>
          </dl>
        </section>

        <section className="why" id="why" aria-labelledby="why-title">
          <div className="head">
            <p className="eyebrow">Why Quell</p>
            <h2 id="why-title">Designed around your day.</h2>
          </div>
          <div className="tiles">
            <article className="tile tile--photo tile--wide">
              <img src="/img/commute.jpg" alt="" loading="lazy" />
              <div className="tile__cap"><p className="tile__k">Adaptive noise cancelling</p><h3>The platform, the carriage, the office. All quieter.</h3></div>
            </article>
            <article className="tile tile--photo tile--tall">
              <img src="/img/detail.jpg" alt="" loading="lazy" />
              <div className="tile__cap tile__cap--top"><p className="tile__k">Fit</p><h3>Three tip sizes. One secure seal.</h3></div>
            </article>
            <article className="tile">
              <p className="tile__k">Battery</p>
              <h3>One charge on Sunday. Quiet until Friday.</h3>
              <p className="tile__num">40h</p>
            </article>
            <article className="tile">
              <p className="tile__k">Peace of mind</p>
              <h3>Covered for two years.</h3>
              <p className="tile__num">2 yr</p>
            </article>
          </div>
        </section>

        <section className="reviews" id="reviews" aria-labelledby="reviews-title">
          <div className="head">
            <span className="demo-tag">Sample reviews for this demo</span>
            <h2 id="reviews-title">Heard on the quiet side.</h2>
          </div>
          <div className="reviews__row">
            {REVIEWS.map((r) => (
              <figure className="review" key={r.who}>
                <p className="review__stars" aria-label={`${r.stars} out of 5 stars`}>{"★".repeat(r.stars)}{"☆".repeat(5 - r.stars)}</p>
                <blockquote>{r.text}</blockquote>
                <figcaption>Sample review · {r.who}</figcaption>
              </figure>
            ))}
          </div>
        </section>

        <section className="buy" id="buy" ref={buyRef} aria-labelledby="buy-title">
          <div className="buy__media"><img src="/img/hero.jpg" alt="" loading="lazy" /></div>
          <div className="buy__box">
            <p className="eyebrow">Buy Quell</p>
            <h2 id="buy-title">Choose your bundle.</h2>

            <div className="bundles" role="radiogroup" aria-label="Bundle">
              {Object.values(BUNDLES).map((b) => (
                <button
                  key={b.id}
                  type="button"
                  role="radio"
                  aria-checked={bundle === b.id}
                  className={`bundle ${bundle === b.id ? "is-on" : ""}`}
                  onClick={() => choose(b.id)}
                >
                  {b.tag && <span className="bundle__tag">{b.tag}</span>}
                  <span className="bundle__name">{b.label}<small>{b.note}</small></span>
                  <span className="bundle__price">{money(b.price)}{b.compareAt > b.price && <s>{money(b.compareAt)}</s>}</span>
                </button>
              ))}
            </div>

            <label className={`bump ${protect ? "is-on" : ""}`}>
              <input type="checkbox" checked={protect} onChange={(e) => setProtect(e.target.checked)} />
              <span><strong>Add {PROTECT.name} for {money(PROTECT.price)}</strong>{PROTECT.note}</span>
            </label>

            <div className="summary">
              <span>
                {code && <span className="summary__code">{DISCOUNT.code} applied, {DISCOUNT.percent}% off · </span>}
                {saving > 0 ? `You save ${money(saving)} · ` : ""}Free shipping
              </span>
              <strong>{money(total)}</strong>
            </div>

            <button type="button" className="btn btn--primary btn--full" onClick={checkout} disabled={busy}>
              {busy ? "Opening secure checkout..." : "Continue to secure checkout"}
            </button>
            {notice && <p className="notice" role="status">{notice}</p>}
            <p className="perks">2-year warranty · Ships within 24 hours · Cards, Apple Pay, Google Pay</p>
          </div>
        </section>
      </main>

      <footer className="foot">
        <span>Quell is a fictional brand created for a portfolio demo.</span>
        <span>Hero photo: Patrick Zahn on Unsplash</span>
      </footer>

      <div className={`sticky ${showSticky ? "is-on" : ""}`} aria-hidden={!showSticky}>
        <span><strong>Quell Earbuds</strong> from {money(BUNDLES["1"].price)}</span>
        <a className="btn btn--primary btn--small" href="#buy" onClick={scrollToBuy} tabIndex={showSticky ? 0 : -1}>Buy</a>
      </div>

      {!hadCode && <EmailOffer onCode={(c, e) => { setCode(c); setEmail(e); }} />}
    </div>
  );
}
