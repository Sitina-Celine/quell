// Helpers shared by the upsell and thank-you pages.

export const sessionIdFromUrl = () => new URLSearchParams(location.search).get("session_id");

export const thankYouUrl = (id, extra = "") => `/thank-you.html?session_id=${encodeURIComponent(id)}${extra}`;

// The order is paid, so the email discount has been used
export function clearCode() {
  try {
    localStorage.removeItem("quell-code");
  } catch {
    // ignore
  }
}

export async function fetchOrder(id) {
  const res = await fetch(`/api/order?session_id=${encodeURIComponent(id)}`);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "We couldn't load your order. Please refresh.");
  return data;
}
