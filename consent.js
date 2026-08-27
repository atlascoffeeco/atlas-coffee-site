// consent.js
// Simple cookie consent + Google consent mode v2 for Atlas Coffee

(function () {
  const CONSENT_COOKIE_NAME = "atlas_consent";
  const CONSENT_VERSION = "1"; // increment if you change the shape

  // Default consent state: deny analytics, allow necessary
  function setDefaultConsent() {
    if (typeof gtag === "function") {
      gtag("consent", "default", {
        ad_storage: "denied",
        analytics_storage: "denied",
        ad_user_data: "denied",
        ad_personalization: "denied",
        wait_for_update: 500
      });
    }
  }

  function parseConsentCookie(cookieValue) {
    try {
      const parsed = JSON.parse(cookieValue);
      if (typeof parsed === "object" && parsed !== null) {
        return parsed;
      }
    } catch (e) {
      // ignore
    }
    return null;
  }

  function getConsentFromCookie() {
    const cookie = document.cookie
      .split(";")
      .map(c => c.trim())
      .find(c => c.startsWith(CONSENT_COOKIE_NAME + "="));

    if (!cookie) return null;

    const value = cookie.slice(CONSENT_COOKIE_NAME.length + 1);
    return parseConsentCookie(value);
  }

  function setConsentCookie(consent) {
    const value = JSON.stringify({
      version: CONSENT_VERSION,
      analytics: !!consent.analytics,
      updated_at: new Date().toISOString()
    });

    // 1 year expiry, path=/, secure if available
    const expires = new Date();
    expires.setFullYear(expires.getFullYear() + 1);

    let cookieString = `${CONSENT_COOKIE_NAME}=${encodeURIComponent(
      value
    )}; expires=${expires.toUTCString()}; path=/; SameSite=Lax`;

    if (location.protocol === "https:") {
      cookieString += "; Secure";
    }

    document.cookie = cookieString;
  }

  function updateGoogleConsent(consent) {
    if (typeof gtag !== "function") return;

    gtag("consent", "update", {
      ad_storage: "denied",
      analytics_storage: consent.analytics ? "granted" : "denied",
      ad_user_data: "denied",
      ad_personalization: "denied"
    });
  }

  function createBanner() {
    if (document.getElementById("atlas-cookie-banner")) return;

    const banner = document.createElement("div");
    banner.id = "atlas-cookie-banner";
    banner.setAttribute("role", "region");
    banner.setAttribute("aria-label", "Cookie consent");

    banner.innerHTML = `
      <div class="atlas-cookie-banner-inner">
        <p class="atlas-cookie-banner-text">
          We use strictly necessary cookies to make this site work, and analytics cookies to understand how visitors use it.
          We do not use advertising or tracking cookies.
        </p>
        <div class="atlas-cookie-banner-actions">
          <button type="button" id="atlas-cookie-decline" class="atlas-cookie-button atlas-cookie-button--secondary">
            Decline Cookies
          </button>
          <button type="button" id="atlas-cookie-accept" class="atlas-cookie-button atlas-cookie-button--primary">
            Accept Cookies
          </button>
          <a href="/privacy" class="atlas-cookie-link">Cookie policy</a>
        </div>
      </div>
    `;

    document.body.appendChild(banner);
  }

  function showBannerIfFirstVisit() {
    if (window.atlasCookieBannerInitialised) return;
    window.atlasCookieBannerInitialised = true;

    const existing = getConsentFromCookie();
    if (existing) {
      updateGoogleConsent(existing);
      return;
    }

    if (document.getElementById("atlas-cookie-banner")) {
      return;
    }

    createBanner();

    const declineBtn = document.getElementById("atlas-cookie-decline");
    const acceptBtn = document.getElementById("atlas-cookie-accept");

    function hideBanner() {
      const banner = document.getElementById("atlas-cookie-banner");
      if (banner) banner.remove();
    }

    function handleChoice(analytics) {
      if (document.getElementById("atlas-cookie-banner-handled")) return;
      // Mark that we've handled a choice to avoid double writes
      const marker = document.createElement("meta");
      marker.id = "atlas-cookie-banner-handled";
      document.head.appendChild(marker);

      const consent = { analytics: !!analytics };
      setConsentCookie(consent);
      updateGoogleConsent(consent);
      hideBanner();
    }

    declineBtn.addEventListener("click", () => handleChoice(false));
    acceptBtn.addEventListener("click", () => handleChoice(true));
}

  // Run as early as possible
  setDefaultConsent();

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      showBannerIfFirstVisit();
    });
  } else {
    showBannerIfFirstVisit();
  }

  // Expose a small helper for the settings panel later
  window.AtlasConsent = {
    get: getConsentFromCookie,
    set: function (analytics) {
      const consent = { analytics: !!analytics };
      setConsentCookie(consent);
      updateGoogleConsent(consent);
    }
  };
})();