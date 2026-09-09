(() => {
  "use strict";

  const STORAGE_KEY = "atlas-cookie-consent-v1";
  const COOKIE_NAME = "atlas_consent";

  function cookieOptions(maxAgeSeconds) {
    const parts = ["Path=/", `Max-Age=${maxAgeSeconds}`, "SameSite=Lax"];

    if (location.protocol === "https:") {
      parts.push("Secure");
    }

    const host = location.hostname;
    if (host === "atlascoffee.uk" || host.endsWith(".atlascoffee.uk")) {
      parts.push("Domain=.atlascoffee.uk");
    }

    return parts.join("; ");
  }

  function readCookieConsent() {
    const match = document.cookie.match(/(?:^|; )atlas_consent=(1|0)(?:;|$)/);
    if (!match) {
      return null;
    }
    return { analytics: match[1] === "1" };
  }

  function readStorageConsent() {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        return null;
      }
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed.analytics !== "boolean") {
        return null;
      }
      return { analytics: parsed.analytics };
    } catch (error) {
      return null;
    }
  }

  function readConsent() {
    return readCookieConsent() || readStorageConsent();
  }

  function saveConsent(consent) {
    const value = {
      analytics: Boolean(consent.analytics),
      updatedAt: new Date().toISOString()
    };

    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
    } catch (error) {
      console.warn("[Atlas consent] Could not save consent preference.", error);
    }

    document.cookie = `${COOKIE_NAME}=${value.analytics ? "1" : "0"}; ${cookieOptions(60 * 60 * 24 * 365)}`;

    return value;
  }

  function sendConsentUpdate(consent) {
    window.dataLayer = window.dataLayer || [];
    document.documentElement.dataset.atlasConsent = consent.analytics
      ? "granted"
      : "denied";

    if (typeof window.gtag === "function") {
      window.gtag("consent", "update", {
        ad_storage: "denied",
        analytics_storage: consent.analytics ? "granted" : "denied",
        ad_user_data: "denied",
        ad_personalization: "denied",
        security_storage: "granted"
      });
    }
  }

  function removeBanner() {
    document.getElementById("atlas-cookie-banner")?.remove();
  }

  function renderBanner() {
    if (document.getElementById("atlas-cookie-banner")) {
      return;
    }

    const banner = document.createElement("section");

    banner.id = "atlas-cookie-banner";
    banner.className = "atlas-cookie-banner";
    banner.setAttribute("role", "dialog");
    banner.setAttribute("aria-modal", "false");
    banner.setAttribute("aria-labelledby", "atlas-cookie-title");
    banner.setAttribute("aria-describedby", "atlas-cookie-description");

    banner.innerHTML = `
      <div class="atlas-cookie-banner__inner">
        <div class="atlas-cookie-banner__content">
          <h2 id="atlas-cookie-title">Your cookie preferences</h2>
          <p id="atlas-cookie-description">
            We use essential cookies to run the site. Accept analytics cookies to help us improve it.
          </p>
        </div>

        <div class="atlas-cookie-banner__actions">
          <button
            class="atlas-cookie-button atlas-cookie-button--secondary"
            type="button"
            data-atlas-consent="decline"
          >
            Decline cookies
          </button>

          <button
            class="atlas-cookie-button atlas-cookie-button--primary"
            type="button"
            data-atlas-consent="accept"
          >
            Accept cookies
          </button>

          <a class="atlas-cookie-banner__link" href="/privacy">
            Cookie policy
          </a>
        </div>
      </div>
    `;

    document.body.appendChild(banner);

    banner.querySelectorAll("[data-atlas-consent]").forEach((button) => {
      button.addEventListener("click", (event) => {
        event.preventDefault();
        const analytics = button.dataset.atlasConsent === "accept";
        const consent = saveConsent({ analytics });
        sendConsentUpdate(consent);
        removeBanner();
      });
    });
  }

  function isLegalPage() {
    const page = document.body?.getAttribute("data-page") || "";
    return page === "privacy" || page === "terms" || page === "delivery-returns";
  }

  function applySavedChoice() {
    const savedConsent = readConsent();
    if (!savedConsent) {
      return false;
    }
    sendConsentUpdate(savedConsent);
    removeBanner();
    return true;
  }

  function initialiseConsentBanner() {
    if (applySavedChoice()) {
      return;
    }

    if (isLegalPage()) {
      removeBanner();
      return;
    }

    renderBanner();
  }

  window.AtlasConsent = {
    get() {
      return readConsent();
    },

    setAnalytics(allowed) {
      const consent = saveConsent({
        analytics: Boolean(allowed)
      });

      sendConsentUpdate(consent);
      removeBanner();

      return consent;
    },

    reset() {
      try {
        window.localStorage.removeItem(STORAGE_KEY);
      } catch (error) {
        console.warn("[Atlas consent] Could not reset consent preference.", error);
      }

      document.cookie = `${COOKIE_NAME}=; ${cookieOptions(0)}`;
      delete document.documentElement.dataset.atlasConsent;
      renderBanner();
    }
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initialiseConsentBanner, {
      once: true
    });
  } else {
    initialiseConsentBanner();
  }

  window.addEventListener("pageshow", () => {
    applySavedChoice();
  });
})();
