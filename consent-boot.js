(() => {
  "use strict";

  const STORAGE_KEY = "atlas-cookie-consent-v1";

  function applySavedConsent() {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);

      if (!raw) {
        return;
      }

      const parsed = JSON.parse(raw);

      if (!parsed || typeof parsed.analytics !== "boolean") {
        return;
      }

      document.documentElement.dataset.atlasConsent = parsed.analytics
        ? "granted"
        : "denied";

      if (typeof window.gtag !== "function") {
        return;
      }

      window.gtag("consent", "update", {
        ad_storage: "denied",
        analytics_storage: parsed.analytics ? "granted" : "denied",
        ad_user_data: "denied",
        ad_personalization: "denied",
        security_storage: "granted"
      });
    } catch (error) {
      // Keep the default denied consent if storage is unavailable.
    }
  }

  applySavedConsent();
})();
