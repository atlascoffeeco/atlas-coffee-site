// consent.js – debug version
(function () {
  const CONSENT_COOKIE_NAME = "atlas_consent";
  const CONSENT_VERSION = "1";

  // Default consent: deny analytics
  function setDefaultConsent() {
    window.dataLayer = window.dataLayer || [];

    window.dataLayer.push({
      event: "default_consent",
      consent_state: {
        ad_storage: "denied",
        analytics_storage: "denied",
        ad_user_data: "denied",
        ad_personalization: "denied"
      }
    });

    console.log("[atlas consent] default consent pushed to dataLayer");
  }

  function parseConsentCookie(cookieValue) {
    try {
      const parsed = JSON.parse(cookieValue);
      if (typeof parsed === "object" && parsed !== null) {
        return parsed;
      }
    } catch (e) {
      console.warn("[atlas consent] failed to parse cookie", e);
    }
    return null;
  }

  function getConsentFromCookie() {
    const cookie = document.cookie
      .split(";")
      .map(c => c.trim())
      .find(c => c.startsWith(CONSENT_COOKIE_NAME + "="));

    if (!cookie) {
      console.log("[atlas consent] no consent cookie found");
      return null;
    }

    const value = cookie.slice(CONSENT_COOKIE_NAME.length + 1);
    const parsed = parseConsentCookie(decodeURIComponent(value));
    console.log("[atlas consent] read cookie:", parsed);
    return parsed;
  }

  function setConsentCookie(consent) {
    const value = JSON.stringify({
      version: CONSENT_VERSION,
      analytics: !!consent.analytics,
      updated_at: new Date().toISOString()
    });

    const expires = new Date();
    expires.setFullYear(expires.getFullYear() + 1);

    let cookieString = `${CONSENT_COOKIE_NAME}=${encodeURIComponent(value)}; expires=${expires.toUTCString()}; path=/; SameSite=Lax`;

    if (location.protocol === "https:") {
      cookieString += "; Secure";
    }

    console.log("[atlas consent] setting cookie:", cookieString);
    document.cookie = cookieString;
  }

  function updateGoogleConsent(consent) {
    if (typeof gtag !== "function") {
      console.warn("[atlas consent] gtag not available yet");
      return;
    }

    gtag("consent", "update", {
      ad_storage: "denied",
      analytics_storage: consent.analytics ? "granted" : "denied",
      ad_user_data: "denied",
      ad_personalization: "denied"
    });

    console.log("[atlas consent] updated Google consent:", consent);
  }

  function createBanner() {
    if (document.getElementById("atlas-cookie-banner")) {
      console.log("[atlas consent] banner already in DOM, skipping create");
      return;
    }

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
            Decline cookies
          </button>
          <button type="button" id="atlas-cookie-accept" class="atlas-cookie-button atlas-cookie-button--primary">
            Accept cookies
          </button>
          <a href="/privacy" class="atlas-cookie-link">Cookie policy</a>
        </div>
      </div>
    `;

    document.body.appendChild(banner);
    console.log("[atlas consent] banner created");
  }

  function showBannerIfFirstVisit() {
    console.log("[atlas consent] showBannerIfFirstVisit running");

    const existing = getConsentFromCookie();
    if (existing) {
      console.log("[atlas consent] consent already set, updating Google and not showing banner");
      updateGoogleConsent(existing);
      return;
    }

    if (document.getElementById("atlas-cookie-banner")) {
      console.log("[atlas consent] banner already in DOM, skipping");
      return;
    }

    createBanner();

    const declineBtn = document.getElementById("atlas-cookie-decline");
    const acceptBtn = document.getElementById("atlas-cookie-accept");

    function hideBanner() {
      const banner = document.getElementById("atlas-cookie-banner");
      if (banner) {
        banner.remove();
        console.log("[atlas consent] banner removed");
      }
    }

    function handleChoice(analytics) {
      console.log("[atlas consent] choice made, analytics:", analytics);
      const consent = { analytics: !!analytics };
      setConsentCookie(consent);
      updateGoogleConsent(consent);
      hideBanner();
    }

    declineBtn.addEventListener("click", () => {
      console.log("[atlas consent] decline clicked");
      handleChoice(false);
    });

    acceptBtn.addEventListener("click", () => {
      console.log("[atlas consent] accept clicked");
      handleChoice(true);
    });
  }

  // Run
  // setDefaultConsent();

  // if (document.readyState === "loading") {
  //   document.addEventListener("DOMContentLoaded", () => {
  //     showBannerIfFirstVisit();
  //   });
  // } else {
  //   showBannerIfFirstVisit();
  // }

  window.AtlasConsent = {
    get: getConsentFromCookie,
    set: function (analytics) {
      const consent = { analytics: !!analytics };
      setConsentCookie(consent);
      updateGoogleConsent(consent);
    }
  };
})();