(function () {
  const page = document.body.getAttribute("data-page") || "";
  const withBasket = document.body.getAttribute("data-chrome-basket") !== "false";

  function current(id) {
    return page === id ? ' aria-current="page"' : "";
  }

  function navAnchors() {
    return (
      '<a href="/"' + current("home") + ">Home</a>" +
      '<a href="/shop"' + current("shop") + ">Shop Coffee</a>" +
      '<a href="/why-atlas"' + current("why-atlas") + ">Why Atlas</a>" +
      '<a href="/contact"' + current("contact") + ">Contact Us</a>"
    );
  }

  function headerMarkup() {
    const actions = withBasket
      ? (
        '<button class="ghost-button basket-link" type="button" id="basket-toggle" data-basket-trigger data-has-items="false" aria-haspopup="dialog" aria-expanded="false" aria-controls="basket-popover">' +
          '<span class="basket-link__icon-wrap" aria-hidden="true">' +
            '<img src="/assets/basket-outlined-shopping-svgrepo-com.svg" alt="" class="basket-link__icon" width="20" height="20">' +
            '<span class="basket-link__dot" aria-hidden="true"></span>' +
          "</span>" +
          '<span class="basket-link__label">Basket</span>' +
          '<span class="basket-link__count" data-basket-count>0</span>' +
        "</button>"
      )
      : '<a class="button" href="/shop">Shop coffee</a>';

    return (
      '<a class="skip-link" href="#content">Skip to content</a>' +
      '<header class="site-header">' +
        '<div class="container nav-shell">' +
          '<a class="brand" href="/" aria-label="Atlas Coffee home">' +
            '<img src="/assets/logo.jpg" alt="Atlas Coffee logo" width="80" height="80" loading="eager" fetchpriority="high" decoding="async">' +
            '<span class="brand-lockup">' +
              "<span>Atlas Coffee Company</span>" +
              "<small>Independent coffee roasters</small>" +
            "</span>" +
          "</a>" +
          '<nav class="nav-links" aria-label="Primary navigation">' +
            navAnchors() +
          "</nav>" +
          '<div class="actions">' +
            actions +
            '<button class="mobile-menu-toggle" type="button" data-mobile-toggle aria-expanded="false" aria-controls="mobile-panel" aria-label="Open menu">' +
              '<span aria-hidden="true"></span>' +
              '<span aria-hidden="true"></span>' +
              '<span aria-hidden="true"></span>' +
            "</button>" +
          "</div>" +
        "</div>" +
        '<div class="container mobile-panel" id="mobile-panel" data-mobile-panel>' +
          navAnchors() +
          (withBasket ? "" : '<a class="button" href="/shop">Shop coffee</a>') +
        "</div>" +
      "</header>"
    );
  }

  function basketMarkup() {
    return (
      '<div class="shop-basket-popover" id="basket-popover" aria-hidden="true">' +
        '<button class="shop-basket-popover__backdrop" type="button" tabindex="-1" aria-label="Close basket"></button>' +
        '<aside class="shop-basket-drawer" role="dialog" aria-modal="true" aria-labelledby="basket-title" data-has-items="false">' +
          '<div class="shop-basket-drawer__header">' +
            '<button class="shop-basket-drawer__handle" type="button" data-basket-handle aria-label="Minimise basket">' +
              '<span aria-hidden="true"></span>' +
            "</button>" +
            '<div class="shop-basket-drawer__heading">' +
              '<span class="eyebrow">Basket</span>' +
              '<h2 id="basket-title">Your selected coffees.</h2>' +
            "</div>" +
            '<button class="shop-basket-drawer__close" type="button" data-basket-close aria-label="Close basket">Close</button>' +
          "</div>" +
          '<div class="shop-basket-drawer__body">' +
            '<div id="basket-items" class="shop-basket-list" aria-live="polite" aria-relevant="additions removals">' +
              '<div class="shop-basket-empty">' +
                '<svg class="shop-basket-empty__icon" viewBox="0 0 24 24" width="56" height="56" aria-hidden="true" focusable="false">' +
                  '<g fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">' +
                    '<path d="M7.3 10.6c0-4.25 3.6-4.25 3.6 0"/>' +
                    '<path d="M13.1 10.6c0-4.25 3.6-4.25 3.6 0"/>' +
                    '<path d="M5.15 10.6h13.7l-1.12 9.55A1.55 1.55 0 0 1 16.2 21.7H7.8A1.55 1.55 0 0 1 6.27 20.15L5.15 10.6z"/>' +
                  "</g>" +
                "</svg>" +
                "<p>Your basket is currently empty.</p>" +
                '<div class="shop-basket-empty__actions">' +
                  '<a class="button" href="/shop">Shop coffee</a>' +
                "</div>" +
              "</div>" +
            "</div>" +
          "</div>" +
          '<div class="shop-basket-drawer__footer">' +
            '<div class="shop-basket-fulfilment" aria-labelledby="basket-fulfilment-label">' +
              '<span class="shop-basket-total-label" id="basket-fulfilment-label">Fulfilment</span>' +
              '<div class="shop-basket-fulfilment__options" role="radiogroup" aria-label="Choose fulfilment">' +
                '<label class="shop-basket-fulfilment__option">' +
                  '<input type="radio" name="basket-fulfilment" id="basket-fulfilment-delivery" value="delivery" checked>' +
                  '<span><strong>Delivery</strong><small data-delivery-copy>£4.50 UK delivery under £25 · Free on 500g, 1kg, and £25+</small></span>' +
                "</label>" +
                '<label class="shop-basket-fulfilment__option">' +
                  '<input type="radio" name="basket-fulfilment" id="basket-fulfilment-collection" value="collection">' +
                  '<span class="shop-basket-fulfilment__copy">' +
                    '<strong class="shop-basket-fulfilment__title">' +
                      "Local collection" +
                      '<button type="button" class="shop-basket-info" aria-label="More information about local collection" aria-expanded="false" aria-controls="collection-info-popover">i</button>' +
                    "</strong>" +
                    "<small>Free collection in Redditch.</small>" +
                  "</span>" +
                "</label>" +
              "</div>" +
              '<p class="shop-basket-note" id="basket-fulfilment-note">' +
                "£4.50 UK delivery under £25 · Free on 500g, 1kg, and £25+" +
              "</p>" +
            "</div>" +
            '<div class="shop-basket-total">' +
              '<span class="shop-basket-total-label">Estimated total</span>' +
              '<strong id="basket-total">£0.00</strong>' +
            "</div>" +
            '<button class="button shop-basket-checkout" type="button" id="checkout-button">' +
              '<svg class="shop-basket-checkout__lock" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false">' +
                '<path fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" d="M7 11V8.2A5 5 0 0 1 17 8.2V11"/>' +
                '<rect x="5" y="11" width="14" height="10" rx="2" fill="none" stroke="currentColor" stroke-width="1.8"/>' +
              "</svg>" +
              '<span class="shop-basket-checkout__label">Proceed to checkout</span>' +
            "</button>" +
          "</div>" +
        "</aside>" +
      "</div>" +
      '<div class="mobile-buy-bar" aria-hidden="true" hidden>' +
        '<div class="container mobile-buy-bar__inner">' +
          '<div class="mobile-buy-bar__meta">' +
            "<strong>Your basket</strong>" +
            '<span id="mobile-basket-summary" aria-live="polite">No items selected yet</span>' +
          "</div>" +
          '<button class="button mobile-buy-bar__button" type="button" id="mobile-basket-bar-toggle" aria-controls="basket-popover" aria-label="View your basket">View basket</button>' +
        "</div>" +
      "</div>" +
      '<div class="shop-basket-info-popover" id="collection-info-popover" role="dialog" aria-modal="true" aria-labelledby="collection-info-title" hidden>' +
        '<div class="shop-basket-info-popover__panel">' +
          '<button class="shop-basket-info-popover__close" type="button" aria-label="Close local collection information">×</button>' +
          '<h2 id="collection-info-title">Local collection</h2>' +
          "<p>Collection is from our small roasting space in Redditch. We’ll send you the exact address after payment.</p>" +
          "<p>Choose collection if you’re local and able to come by. We’ll arrange a time that works for you.</p>" +
        "</div>" +
      "</div>"
    );
  }

  function footerMarkup() {
    return (
      '<footer class="site-footer">' +
        '<div class="container footer-grid">' +
          "<div>" +
            '<div class="brand">' +
              '<img src="/assets/logo.jpg" alt="Atlas Coffee logo" width="80" height="80" loading="lazy" decoding="async">' +
              '<span class="brand-lockup">' +
                "<span>Atlas Coffee</span>" +
                "<small>Freshly roasted single-origin coffee.</small>" +
              "</span>" +
            "</div>" +
          "</div>" +
          "<div>" +
            "<strong>Pages</strong>" +
            '<ul class="footer-links">' +
              "<li><a href=\"/\"" + current("home") + ">Home</a></li>" +
              "<li><a href=\"/shop\"" + current("shop") + ">Shop Coffee</a></li>" +
              "<li><a href=\"/why-atlas\"" + current("why-atlas") + ">Why Atlas</a></li>" +
              "<li><a href=\"/contact\"" + current("contact") + ">Contact Us</a></li>" +
            "</ul>" +
          "</div>" +
          "<div>" +
            "<strong>Legal</strong>" +
            '<ul class="footer-links">' +
              "<li><a href=\"/privacy\"" + current("privacy") + ">Privacy Policy</a></li>" +
              "<li><a href=\"/terms\"" + current("terms") + ">Terms &amp; Conditions</a></li>" +
              "<li><a href=\"/delivery-returns\"" + current("delivery-returns") + ">Delivery &amp; Returns</a></li>" +
            "</ul>" +
          "</div>" +
        "</div>" +
      "</footer>"
    );
  }

  function nodesFromMarkup(markup) {
    const wrap = document.createElement("div");
    wrap.innerHTML = markup;
    return Array.from(wrap.childNodes);
  }

  function setupMobileMenu() {
    if (window.__atlasMobileMenuBound) return;

    const mobileToggle = document.querySelector("[data-mobile-toggle]");
    const mobilePanel = document.querySelector("[data-mobile-panel]");
    if (!mobileToggle || !mobilePanel) return;

    window.__atlasMobileMenuBound = true;

    const setMobileMenu = (open) => {
      mobileToggle.setAttribute("aria-expanded", String(open));
      mobileToggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
      mobilePanel.classList.toggle("is-open", open);
    };

    mobileToggle.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      const isOpen = mobileToggle.getAttribute("aria-expanded") === "true";
      setMobileMenu(!isOpen);
    });

    mobilePanel.querySelectorAll("a").forEach((link) => {
      link.addEventListener("click", () => setMobileMenu(false));
    });

    window.addEventListener("resize", () => {
      if (window.innerWidth > 860) setMobileMenu(false);
    });
  }

  const headerMount = document.querySelector("[data-site-header]");
  if (headerMount && headerMount.getAttribute("data-mounted") !== "true") {
    headerMount.setAttribute("data-mounted", "true");
    const headerNodes = nodesFromMarkup(headerMarkup());
    headerMount.replaceWith(...headerNodes);

    if (withBasket) {
      const headerEl = document.querySelector(".site-header");
      if (headerEl && !document.getElementById("basket-popover")) {
        headerEl.after(...nodesFromMarkup(basketMarkup()));
      }
    }

    setupMobileMenu();
  }

  const footerMount = document.querySelector("[data-site-footer]");
  if (footerMount && footerMount.getAttribute("data-mounted") !== "true") {
    footerMount.setAttribute("data-mounted", "true");
    footerMount.replaceWith(...nodesFromMarkup(footerMarkup()));
  }
})();
