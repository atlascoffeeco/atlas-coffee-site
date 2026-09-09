(() => {
  "use strict";

  const STORAGE_KEY = "atlas-cookie-consent-v1";

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

  function applySavedConsent() {
    const saved = readCookieConsent() || readStorageConsent();
    if (!saved) {
      return;
    }

    document.documentElement.dataset.atlasConsent = saved.analytics
      ? "granted"
      : "denied";

    if (typeof window.gtag !== "function") {
      return;
    }

    window.gtag("consent", "update", {
      ad_storage: "denied",
      analytics_storage: saved.analytics ? "granted" : "denied",
      ad_user_data: "denied",
      ad_personalization: "denied",
      security_storage: "granted"
    });
  }

  applySavedConsent();
})();
