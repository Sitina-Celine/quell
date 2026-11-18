// "10% off for your email", shown once when a visitor looks like they're leaving:
// on desktop when the mouse moves to the top of the window (towards the tabs),
// on phones after they scroll back up quickly, and never in the first 8 seconds.

import { useEffect, useRef, useState } from "react";
import { DISCOUNT } from "../data/offer.js";
import { visitor } from "../lib/track.js";

const SEEN_KEY = "quell-offer-seen";

export default function EmailOffer({ onCode }) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const dialogRef = useRef(null);

  useEffect(() => {
    try {
      if (sessionStorage.getItem(SEEN_KEY)) return;
    } catch {
      // ignore
    }
    const start = Date.now();
    let lastY = scrollY;
    const ready = () => Date.now() - start > 8000;
    const show = () => {
      if (!ready()) return;
      try {
        sessionStorage.setItem(SEEN_KEY, "1");
      } catch {
        // ignore
      }
      setOpen(true);
      cleanup();
    };
    const onMouse = (e) => e.clientY <= 0 && show();
    const onScroll = () => {
      const y = scrollY;
      if (lastY - y > 140 && y > 600) show();
      lastY = y;
    };
    document.addEventListener("mouseout", onMouse);
    addEventListener("scroll", onScroll, { passive: true });
    function cleanup() {
      document.removeEventListener("mouseout", onMouse);
      removeEventListener("scroll", onScroll);
    }
    return cleanup;
  }, []);

  useEffect(() => {
    const d = dialogRef.current;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  async function submit(e) {
    e.preventDefault();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim())) {
      setError("Enter a valid email address.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), ...visitor() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.code) throw new Error(data.error || "Something went wrong. Please try again.");
      try {
        localStorage.setItem("quell-code", data.code);
      } catch {
        // ignore
      }
      setDone(true);
      onCode(data.code, email.trim());
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <dialog ref={dialogRef} className="offer" aria-labelledby="offer-title" onClose={() => setOpen(false)} onClick={(e) => e.target === dialogRef.current && setOpen(false)}>
      <button type="button" className="offer__close" onClick={() => setOpen(false)} aria-label="Close">&times;</button>
      {done ? (
        <div className="offer__body">
          <p className="eyebrow">You're in</p>
          <h2 id="offer-title">{DISCOUNT.percent}% off, applied.</h2>
          <p>Your code <strong>{DISCOUNT.code}</strong> is already added to your bundle.</p>
          <button type="button" className="btn btn--primary btn--full" onClick={() => { setOpen(false); document.getElementById("buy")?.scrollIntoView({ behavior: "smooth" }); }}>Choose my bundle</button>
        </div>
      ) : (
        <form className="offer__body" onSubmit={submit} noValidate>
          <p className="eyebrow">Before you go</p>
          <h2 id="offer-title">Take {DISCOUNT.percent}% off your first order.</h2>
          <p>Enter your email and we'll apply your code straight away.</p>
          <label className="visually-hidden" htmlFor="offer-email">Email</label>
          <input id="offer-email" type="email" autoComplete="email" placeholder="you@example.com" value={email} onChange={(e) => { setEmail(e.target.value); setError(""); }} aria-invalid={Boolean(error)} />
          {error && <p className="offer__error" role="alert">{error}</p>}
          <button type="submit" className="btn btn--primary btn--full" disabled={busy}>{busy ? "Applying..." : "Get 10% off"}</button>
          <button type="button" className="offer__no" onClick={() => setOpen(false)}>No thanks</button>
        </form>
      )}
    </dialog>
  );
}
