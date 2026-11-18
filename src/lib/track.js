// Visitor identity and funnel tracking in the browser.
//
// - sessionId: a random id kept for this browser, so steps can be joined into one journey
// - variant:   the A/B headline this visitor sees, chosen once and then kept
// - utm:       which ad or campaign brought them, taken from the first page they landed on
// Events go to /api/track with sendBeacon, which still delivers when the page is closing.

const read = (store, key) => {
  try {
    return store.getItem(key);
  } catch {
    return null;
  }
};
const write = (store, key, value) => {
  try {
    store.setItem(key, value);
  } catch {
    // Storage blocked: tracking still works for this page view
  }
};

function randomId() {
  return (crypto.randomUUID?.() || `${Date.now()}-${Math.random()}`).replace(/[^\w-]/g, "").slice(0, 36);
}

export function getSessionId() {
  let id = read(localStorage, "quell-sid");
  if (!id) {
    id = randomId();
    write(localStorage, "quell-sid", id);
  }
  return id;
}

// ?variant=A or ?variant=B forces a version, handy for screenshots and QA
export function getVariant() {
  const forced = new URLSearchParams(location.search).get("variant");
  if (forced === "A" || forced === "B") {
    write(localStorage, "quell-variant", forced);
    return forced;
  }
  let v = read(localStorage, "quell-variant");
  if (v !== "A" && v !== "B") {
    v = Math.random() < 0.5 ? "A" : "B";
    write(localStorage, "quell-variant", v);
  }
  return v;
}

export function getUtm() {
  const saved = read(sessionStorage, "quell-utm");
  if (saved) return JSON.parse(saved);
  const p = new URLSearchParams(location.search);
  const utm = { utmSource: p.get("utm_source") || "", utmCampaign: p.get("utm_campaign") || "" };
  write(sessionStorage, "quell-utm", JSON.stringify(utm));
  return utm;
}

export function visitor() {
  return { sessionId: getSessionId(), variant: getVariant(), ...getUtm() };
}

export function track(event, meta = {}) {
  const body = JSON.stringify({ event, meta, ...visitor() });
  try {
    if (navigator.sendBeacon?.("/api/track", new Blob([body], { type: "application/json" }))) return;
  } catch {
    // fall through to fetch
  }
  fetch("/api/track", { method: "POST", headers: { "Content-Type": "application/json" }, body, keepalive: true }).catch(() => {});
}
