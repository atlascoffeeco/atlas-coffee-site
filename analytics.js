(() => {
  "use strict";

  const GTM_ID = "GTM-TMRKXCQQ";
  const INTERNAL_STORAGE_KEY = "atlas-internal-traffic-v1";
  const PRODUCTION_HOSTS = new Set([
    "atlascoffee.uk",
    "www.atlascoffee.uk"
  ]);

  function readInternalFlag() {
    try {
      return window.localStorage.getItem(INTERNAL_STORAGE_KEY) === "1";
    } catch (error) {
      return false;
    }
  }

  function saveInternalFlag(isInternal) {
    try {
      if (isInternal) {
        window.localStorage.setItem(INTERNAL_STORAGE_KEY, "1");
      } else {
        window.localStorage.removeItem(INTERNAL_STORAGE_KEY);
      }
    } catch (error) {
      // The current page can still honour the URL override.
    }
  }

  function readInternalOverride() {
    const url = new URL(window.location.href);
    const override = url.searchParams.get("atlas_internal");

    if (override !== "1" && override !== "0") {
      return null;
    }

    const isInternal = override === "1";
    saveInternalFlag(isInternal);
    url.searchParams.delete("atlas_internal");
    window.history.replaceState(window.history.state, "", url);

    return isInternal;
  }

  const override = readInternalOverride();
  const isProductionHost = PRODUCTION_HOSTS.has(window.location.hostname);
  const isInternal = override === null ? readInternalFlag() : override;
  const isEnabled = isProductionHost && !isInternal;

  document.documentElement.dataset.atlasAnalytics = isEnabled
    ? "enabled"
    : isInternal
      ? "internal"
      : "non-production";

  window.AtlasAnalytics = Object.freeze({
    enabled: isEnabled,
    internal: isInternal,
    production: isProductionHost
  });

  if (!isEnabled) {
    return;
  }

  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push({
    "gtm.start": new Date().getTime(),
    event: "gtm.js"
  });

  const firstScript = document.getElementsByTagName("script")[0];
  const tagManagerScript = document.createElement("script");

  tagManagerScript.async = true;
  tagManagerScript.src =
    `https://www.googletagmanager.com/gtm.js?id=${encodeURIComponent(GTM_ID)}`;

  firstScript.parentNode.insertBefore(tagManagerScript, firstScript);
})();
