"use client";

export type StorefrontEventType =
  | "PAGE_VIEW"
  | "PRODUCT_VIEW"
  | "FAVORITE_ADD"
  | "FAVORITE_REMOVE"
  | "ADD_TO_CART"
  | "CHECKOUT_START";

const consentCookieName = "cookie_consent_v1";
const visitorStorageKey = "storefront_analytics_visitor_v1";
const consentChangeEvent = "cookie-consent-change";

function hasAnalyticsConsent() {
  if (typeof document === "undefined") return false;
  const value = document.cookie
    .split("; ")
    .find((cookie) => cookie.startsWith(`${consentCookieName}=`))
    ?.slice(consentCookieName.length + 1);
  if (!value) return false;

  try {
    const consent: unknown = JSON.parse(decodeURIComponent(value));
    return typeof consent === "object" && consent !== null
      && "analytics" in consent && consent.analytics === true;
  } catch {
    return false;
  }
}

export function subscribeToAnalyticsConsent(onChange: () => void) {
  window.addEventListener(consentChangeEvent, onChange);
  return () => window.removeEventListener(consentChangeEvent, onChange);
}

export function getAnalyticsConsentSnapshot() {
  return hasAnalyticsConsent();
}

function getVisitorId() {
  const existingId = localStorage.getItem(visitorStorageKey);
  if (existingId) return existingId;
  const visitorId = crypto.randomUUID();
  localStorage.setItem(visitorStorageKey, visitorId);
  return visitorId;
}

export function clearAnalyticsVisitorId() {
  try {
    localStorage.removeItem(visitorStorageKey);
  } catch (error) {
    console.error("Unable to clear anonymous storefront analytics identifier:", error);
  }
}

export function trackStorefrontEvent(
  eventType: StorefrontEventType,
  options: { path?: string; productId?: number } = {},
) {
  if (!hasAnalyticsConsent()) return;

  let visitorId: string;
  try {
    visitorId = getVisitorId();
  } catch (error) {
    console.error("Unable to initialize anonymous storefront analytics:", error);
    return;
  }

  void fetch("/api/analytics/events", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    keepalive: true,
    body: JSON.stringify({ visitorId, eventType, ...options }),
  }).then((response) => {
    if (!response.ok) throw new Error(`Analytics request failed with status ${response.status}`);
  }).catch((error: unknown) => {
    console.error("Unable to record storefront analytics:", error);
  });
}
