import {
  amountToFreeDeliveryPounds,
  bagSizeSavingCopy,
  formatPoundsCompact,
  fromPriceLabel,
  getDeliveryFeePoundsForBasket,
  getDeliveryPolicyCopy,
  getFreeDeliveryThresholdPounds,
  getUiProducts,
  isFreeDeliveryBagSize,
  PRODUCTS as CATALOG_PRODUCTS,
  weightGrams
} from "./catalog.js?v=20260831-26";

// Mark the document as JS-enabled for CSS hooks.
document.documentElement.classList.add("js");
window.dataLayer = window.dataLayer || [];


function pushDataLayerEvent(event, ecommerce = {}, extra = {}) {
  window.dataLayer = window.dataLayer || [];


  // Clear previous ecommerce data
  window.dataLayer.push({ ecommerce: null });


  window.dataLayer.push({
    event,
    ecommerce,
    ...extra
  });
}


function toAnalyticsItem(item) {
  const catalogProduct = Object.values(CATALOG_PRODUCTS).find(
    (product) => product.name === String(item.product || "").trim()
  );
  const productId = catalogProduct?.id || String(item.product || "").toLowerCase();
  const weight = String(item.weight || "").toLowerCase();
  const grind = String(item.grind || "").toLowerCase();


  const grindLabel = {
    whole_bean: "Whole bean",
    coarse: "Coarse",
    medium: "Medium",
    fine: "Fine"
  }[grind] || item.grind;


  const itemName = catalogProduct?.displayName || catalogProduct?.name || String(item.product || "");


  return {
    item_id: `${productId}_${weight}_${grind}`,
    item_name: itemName,
    item_variant: `${item.weight} · ${grindLabel}`,
    item_category: "Coffee",
    price: Number(item.unitPrice) || 0,
    quantity: Number(item.quantity) || 1
  };
}


function startShopPage() {
  const BASKET_STORAGE_KEY = "atlas-basket";
  const FULFILMENT_STORAGE_KEY = "atlas-fulfilment";
  const MAX_QUANTITY = 10;
  const PRODUCTS = getUiProducts();


  const HOME_FEATURED_ID = "serra";
  const HOME_FEATURED_PRODUCTS = [
    {
      id: "serra",
      name: "Serra",
      copy: "Prefer chocolatey and smooth? This Brazilian is praline, milk chocolate, and toasted nuts — an everyday cup with a gentle lift.",
      origin: "Brazil · Natural",
      notes: "Praline · Milk chocolate · Toasted nuts",
      price: fromPriceLabel("serra"),
      image: "/assets/serra-negra-bag.webp",
      fallbackImage: "/assets/serra-negra-bag.png",
      imageAlt: "Serra coffee bag from Atlas Coffee",
      link: "/shop#serra-negra",
      otherCopy: "Bright, lifted, and clean. Panela sweetness, vanilla, cooked citrus, and a fresh-fruit finish."
    },
    {
      id: "peru",
      name: "Cajamarca",
      copy: "Bright, lifted, and clean. Panela sweetness, vanilla, cooked citrus, and a fresh-fruit finish.",
      origin: "Peru · Washed",
      notes: "Panela · Vanilla · Plum · Sweet cherry",
      price: fromPriceLabel("peru"),
      image: "/assets/cajamarca-bag.webp",
      fallbackImage: "/assets/cajamarca-bag.png",
      imageAlt: "Cajamarca coffee bag from Atlas Coffee",
      link: "/shop#peru-product",
      otherCopy: "Prefer chocolatey and smooth? This Brazilian is praline, milk chocolate, and toasted nuts — an everyday cup with a gentle lift."
    }
  ];


  const mobileBasketBarMarkup = `
    <div class="mobile-buy-bar" aria-hidden="true">
      <div class="container mobile-buy-bar__inner">
        <div class="mobile-buy-bar__meta">
          <strong>Your basket</strong>
          <span id="mobile-basket-summary">No items selected yet</span>
        </div>
        <button class="button mobile-buy-bar__button" type="button" id="mobile-basket-bar-toggle">View basket</button>
      </div>
    </div>
  `;


  function ensureMobileBasketBar() {
    if (document.getElementById("mobile-basket-bar-toggle")) return;
    const footer = document.querySelector(".site-footer");
    if (footer) footer.insertAdjacentHTML("beforebegin", mobileBasketBarMarkup);
  }


  ensureMobileBasketBar();


  const basket = readBasket();
  let fulfilment = readFulfilment();


  if (basket.length) {
    try { localStorage.setItem(BASKET_STORAGE_KEY, JSON.stringify(basket)); } catch { }
  }


  const revealItems = document.querySelectorAll(".reveal");
  const basketPopover = document.getElementById("basket-popover");
  const basketDrawer = document.querySelector(".shop-basket-drawer");
  const basketToggles = document.querySelectorAll("[data-basket-trigger], [data-open-basket]");
  const basketCloseButtons = document.querySelectorAll(".shop-basket-drawer__close[data-basket-close]");
  const basketBackdrop = document.querySelector(".shop-basket-popover__backdrop");
  const basketHandle = document.querySelector("[data-basket-handle]");
  const basketHeader = document.querySelector(".shop-basket-drawer__header");
  const basketCountEls = document.querySelectorAll("[data-basket-count], #basket-count");
  const basketStateEls = document.querySelectorAll("[data-has-items]");
  const basketItemsEl = document.getElementById("basket-items");
  const basketTotalEl = document.getElementById("basket-total");
  const basketTotalLabelEl = document.querySelector(".shop-basket-total .shop-basket-total-label");
  const basketTotalNoteEl = document.getElementById("basket-total-note");
  const mobileBasketSummaryEl = document.getElementById("mobile-basket-summary");
  const checkoutButton = document.getElementById("checkout-button");
  const mobileBasketBarToggle = document.getElementById("mobile-basket-bar-toggle");
  const fulfilmentInputs = document.querySelectorAll('input[name="basket-fulfilment"]');
  const fulfilmentNoteEl = document.getElementById("basket-fulfilment-note");


  syncFulfilmentInputs();
  setupReveal();
  setupBasketDrawer();
  setupFulfilmentSelector();
  setupCollectionInfoPopover();
  setupShopProductForms();
  setupProductViewTracking();
  setupHomepageFeaturedCoffee();
  setupGrindGuide();
  applyCatalogPrices();
  renderBasket();


  function readBasket() {
    try {
      const raw = localStorage.getItem(BASKET_STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? mergeBasketItems(parsed) : [];
    } catch { return []; }
  }


  function getBasketItemKey(item) {
    return [String(item.product || ""), String(item.weight || ""), String(item.grind || "")].join("::");
  }


  function mergeBasketItems(items) {
    const merged = new Map();
    items.forEach((item) => {
      if (!item || typeof item !== "object") return;
      const quantity = Math.max(1, Math.min(MAX_QUANTITY, Number(item.quantity) || 1));
      const catalogProduct = Object.values(PRODUCTS).find((product) => product.name === String(item.product));
      const catalogPrice = catalogProduct?.prices[String(item.weight)];
      const unitPrice = Number.isFinite(catalogPrice) ? catalogPrice : Number(item.unitPrice);
      if (!item.product || !item.weight || !item.grind || !Number.isFinite(unitPrice) || unitPrice < 0) return;
      const cleanItem = {
        product: String(item.product), weight: String(item.weight), grind: String(item.grind),
        quantity, unitPrice, lineTotal: unitPrice * quantity
      };
      const key = getBasketItemKey(cleanItem);
      const existing = merged.get(key);
      if (!existing) merged.set(key, cleanItem);
      else {
        existing.quantity = Math.min(MAX_QUANTITY, existing.quantity + cleanItem.quantity);
        existing.lineTotal = existing.unitPrice * existing.quantity;
      }
    });
    return Array.from(merged.values());
  }


  function addBasketItem(item) {
    const existing = basket.find((basketItem) => getBasketItemKey(basketItem) === getBasketItemKey(item));
    if (existing) {
      existing.quantity = Math.min(MAX_QUANTITY, existing.quantity + item.quantity);
      existing.lineTotal = existing.unitPrice * existing.quantity;
    } else {
      basket.push({ ...item, lineTotal: item.unitPrice * item.quantity });
    }


    // Send add_to_cart event
    pushDataLayerEvent(
      "add_to_cart",
      {
        currency: "GBP",
        value: Number(item.unitPrice) * Number(item.quantity),
        items: [toAnalyticsItem(item)]
      },
      {
        fulfilment_method: fulfilment
      }
    );
  }


  function saveBasket() {
    try { localStorage.setItem(BASKET_STORAGE_KEY, JSON.stringify(basket)); } catch { }
  }


  function readFulfilment() {
    try { return localStorage.getItem(FULFILMENT_STORAGE_KEY) === "collection" ? "collection" : "delivery"; }
    catch { return "delivery"; }
  }


  function saveFulfilment() {
    try { localStorage.setItem(FULFILMENT_STORAGE_KEY, fulfilment); } catch { }
  }


  function formatMoney(value) {
    return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(value);
  }


  function applyCatalogPrices() {
    document.querySelectorAll("[data-from-price]").forEach((el) => {
      const label = fromPriceLabel(el.getAttribute("data-from-price"));
      if (label) el.textContent = label;
    });

    document.querySelectorAll("[data-delivery-copy]").forEach((el) => {
      el.textContent = getDeliveryPolicyCopy();
    });
  }


  function prettyGrind(value) {
    return { whole_bean: "Whole bean", coarse: "Coarse", medium: "Medium", fine: "Fine" }[value] || value;
  }


  function prettyFulfilment(value) {
    return value === "collection" ? "Local collection" : "Delivery";
  }

  function productDisplayName(item) {
    const match = Object.values(PRODUCTS).find((product) => product.name === item.product);
    return match?.displayName || item.product;
  }


  function getBasketSubtotal() {
    return basket.reduce((sum, item) => sum + item.lineTotal, 0);
  }


  function getBasketDeliveryFee() {
    return getDeliveryFeePoundsForBasket(basket, fulfilment);
  }


  function syncFulfilmentInputs() {
    fulfilmentInputs.forEach((input) => { input.checked = input.value === fulfilment; });
  }


  function updateFulfilmentUI() {
    const deliveryFee = getBasketDeliveryFee();
    const remaining = amountToFreeDeliveryPounds(basket);

    if (fulfilmentNoteEl) {
      if (fulfilment === "collection") {
        fulfilmentNoteEl.textContent = "We’ll contact you after payment to arrange pickup in Redditch.";
      } else if (!basket.length) {
        fulfilmentNoteEl.textContent = getDeliveryPolicyCopy();
      } else if (deliveryFee === 0) {
        fulfilmentNoteEl.textContent = "UK delivery is free on this order.";
      } else {
        fulfilmentNoteEl.textContent = `Add ${formatMoney(remaining)} more for free delivery, or choose 500g or 1kg.`;
      }
    }
    if (basketTotalLabelEl) {
      basketTotalLabelEl.textContent = fulfilment === "collection" || deliveryFee === 0 ? "Total" : "Total incl. delivery";
    }
    if (basketTotalNoteEl) {
      basketTotalNoteEl.textContent = basket.length
        ? fulfilment === "collection"
          ? "Collection selected. No delivery charge added."
          : deliveryFee === 0
            ? "UK delivery is free on this order."
            : `Includes ${formatMoney(deliveryFee)} delivery.`
        : "";
    }
  }


  function setupReveal() {
    if (!revealItems.length) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!reduced && "IntersectionObserver" in window) {
      const observer = new IntersectionObserver((entries) => entries.forEach((entry) => {
        if (entry.isIntersecting) { entry.target.classList.add("revealed"); observer.unobserve(entry.target); }
      }), { threshold: 0.12 });
      revealItems.forEach((item) => observer.observe(item));
    } else revealItems.forEach((item) => item.classList.add("revealed"));
  }


  function setupProductViewTracking() {
    const productCards = document.querySelectorAll("[data-product-view]");
    if (!productCards.length) return;

    const viewedProducts = new Set();

    function trackProductView(productKey) {
      if (viewedProducts.has(productKey)) return;

      const product = PRODUCTS[productKey];
      if (!product) return;

      viewedProducts.add(productKey);

      const lowestPrice = Math.min(...Object.values(product.prices));

      pushDataLayerEvent(
        "view_item",
        {
          currency: "GBP",
          value: lowestPrice,
          items: [
            {
              item_id: `${product.id}_default`,
              item_name: product.name,
              item_category: "Coffee",
              price: lowestPrice,
              quantity: 1
            }
          ]
        }
      );
    }

    if (!("IntersectionObserver" in window)) {
      productCards.forEach((card) => {
        trackProductView(card.dataset.productView);
      });
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting || entry.intersectionRatio < 0.5) return;

          trackProductView(entry.target.dataset.productView);
          observer.unobserve(entry.target);
        });
      },
      { threshold: 0.5 }
    );

    productCards.forEach((card) => observer.observe(card));
  }


  function openBasket() {
    if (!basketPopover) { window.location.href = "/shop"; return; }
    renderBasket();
    basketPopover.classList.add("is-open");
    basketPopover.setAttribute("aria-hidden", "false");
    document.body.classList.add("basket-open");
    if (basketDrawer) { basketDrawer.classList.remove("is-dragging"); basketDrawer.style.removeProperty("transform"); }
    basketToggles.forEach((toggle) => toggle.setAttribute("aria-expanded", "true"));
    requestAnimationFrame(renderBasket);
  }


  function minimiseBasket() {
    if (!basketPopover) return;
    if (basket.length) {
      basketPopover.classList.remove("is-open");
      basketPopover.setAttribute("aria-hidden", "true");
      document.body.classList.remove("basket-open");
      basketToggles.forEach((toggle) => toggle.setAttribute("aria-expanded", "false"));
    } else closeBasket();
  }


  function closeBasket() {
    if (!basketPopover) return;
    basketPopover.classList.remove("is-open");
    basketPopover.setAttribute("aria-hidden", "true");
    document.body.classList.remove("basket-open");
    if (basketDrawer) { basketDrawer.classList.remove("is-dragging"); basketDrawer.style.removeProperty("transform"); }
    basketToggles.forEach((toggle) => toggle.setAttribute("aria-expanded", "false"));
  }


  function setupBasketDrawer() {
    basketToggles.forEach((button) => button.addEventListener("click", openBasket));
    basketCloseButtons.forEach((button) => button.addEventListener("click", closeBasket));
    mobileBasketBarToggle?.addEventListener("click", openBasket);
    basketBackdrop?.addEventListener("click", () => window.matchMedia("(max-width: 859px)").matches ? minimiseBasket() : closeBasket());
    basketHandle?.addEventListener("click", minimiseBasket);
    document.addEventListener("keydown", (event) => { if (event.key === "Escape") closeBasket(); });
    setupBasketDrag();
    if (window.location.hash === "#basket" && basketPopover) openBasket();
  }


  function setupBasketDrag() {
    const dragRegion = basketHandle || basketHeader;
    if (!dragRegion || !basketDrawer) return;
    let startY = 0, currentY = 0, startTime = 0, pointerId = null, dragging = false;
    const isMobileSheet = () => window.matchMedia("(max-width: 859px)").matches;
    const resetDrag = () => { basketDrawer.classList.remove("is-dragging"); basketDrawer.style.removeProperty("transform"); dragging = false; pointerId = null; };
    dragRegion.addEventListener("pointerdown", (event) => {
      if (!isMobileSheet() || !basketPopover?.classList.contains("is-open")) return;
      if (event.target.closest(".shop-basket-drawer__close, .shop-basket-info, a, input, select")) return;
      pointerId = event.pointerId; startY = currentY = event.clientY; startTime = performance.now(); dragging = true;
      basketDrawer.classList.add("is-dragging");
      dragRegion.setPointerCapture?.(pointerId);
    });
    dragRegion.addEventListener("pointermove", (event) => {
      if (!dragging || event.pointerId !== pointerId) return;
      currentY = event.clientY;
      basketDrawer.style.transform = `translateY(${Math.max(0, currentY - startY)}px)`;
    });
    dragRegion.addEventListener("pointerup", (event) => {
      if (!dragging || event.pointerId !== pointerId) return;
      const distance = Math.max(0, currentY - startY);
      const velocity = distance / Math.max(1, performance.now() - startTime);
      if (distance >= 70 || (distance >= 35 && velocity >= 0.45)) { resetDrag(); minimiseBasket(); }
      else resetDrag();
    });
    dragRegion.addEventListener("pointercancel", resetDrag);
    dragRegion.addEventListener("lostpointercapture", () => { if (dragging) resetDrag(); });
  }


  function setupCollectionInfoPopover() {
    const infoButton = document.querySelector(".shop-basket-info");
    const popover = document.getElementById("collection-info-popover");
    const closeButton = document.querySelector(".shop-basket-info-popover__close");


    if (!infoButton || !popover || !closeButton) return;


    let lastFocusedElement = null;


    function openInfoPopover() {
      lastFocusedElement = document.activeElement;
      popover.hidden = false;
      infoButton.setAttribute("aria-expanded", "true");
      document.body.classList.add("collection-info-open");
      requestAnimationFrame(() => { closeButton.focus(); });
    }


    function closeInfoPopover() {
      popover.hidden = true;
      infoButton.setAttribute("aria-expanded", "false");
      document.body.classList.remove("collection-info-open");
      if (lastFocusedElement && typeof lastFocusedElement.focus === "function") lastFocusedElement.focus();
    }


    infoButton.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (popover.hidden) openInfoPopover();
    });


    closeButton.addEventListener("click", closeInfoPopover);
    document.addEventListener("keydown", (event) => { if (event.key === "Escape" && !popover.hidden) closeInfoPopover(); });
  }


  function setupFulfilmentSelector() {
    updateFulfilmentUI();
    fulfilmentInputs.forEach((input) => input.addEventListener("change", () => {
      if (!input.checked) return;
      fulfilment = input.value === "collection" ? "collection" : "delivery";
      saveFulfilment(); syncFulfilmentInputs(); updateFulfilmentUI(); renderBasket();
    }));
  }


  function setBasketItemQuantity(index, nextQuantity) {
    const item = basket[index];
    if (!item) return;

    const next = Math.max(1, Math.min(MAX_QUANTITY, Number(nextQuantity) || 1));
    if (next === item.quantity) return;

    const delta = next - item.quantity;
    pushDataLayerEvent(
      delta > 0 ? "add_to_cart" : "remove_from_cart",
      {
        currency: "GBP",
        value: Number(item.unitPrice) * Math.abs(delta),
        items: [toAnalyticsItem({ ...item, quantity: Math.abs(delta) })]
      },
      {
        fulfilment_method: fulfilment
      }
    );

    item.quantity = next;
    item.lineTotal = item.unitPrice * next;
    saveBasket();
    renderBasket({ qtyFocus: { index, delta } });
  }


  function renderBasket(options = {}) {
    const count = basket.reduce((sum, item) => sum + item.quantity, 0);
    const grandTotal = getBasketSubtotal() + getBasketDeliveryFee();
    if (checkoutButton) checkoutButton.disabled = basket.length === 0;
    const mobileBuyBar = document.querySelector(".mobile-buy-bar");
    if (mobileBuyBar) { mobileBuyBar.hidden = !basket.length; mobileBuyBar.setAttribute("aria-hidden", String(!basket.length)); }
    basketCountEls.forEach((el) => { el.textContent = String(count); });
    basketStateEls.forEach((el) => el.setAttribute("data-has-items", count > 0 ? "true" : "false"));
    if (mobileBasketSummaryEl) mobileBasketSummaryEl.textContent = basket.length ? `${count} item${count === 1 ? "" : "s"} · ${formatMoney(grandTotal)} · ${prettyFulfilment(fulfilment)}` : "No items selected yet";
    if (!basketItemsEl || !basketTotalEl) { updateFulfilmentUI(); return; }
    if (!basket.length) {
      basketItemsEl.innerHTML = `
        <div class="shop-basket-empty">
          <svg class="shop-basket-empty__icon" viewBox="0 0 24 24" width="56" height="56" aria-hidden="true" focusable="false">
            <g fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
              <path d="M7.3 10.6c0-4.25 3.6-4.25 3.6 0"/>
              <path d="M13.1 10.6c0-4.25 3.6-4.25 3.6 0"/>
              <path d="M5.15 10.6h13.7l-1.12 9.55A1.55 1.55 0 0 1 16.2 21.7H7.8A1.55 1.55 0 0 1 6.27 20.15L5.15 10.6z"/>
            </g>
          </svg>
          <p>Your basket is currently empty.</p>
          <div class="shop-basket-empty__actions">
            <a class="button" href="./shop">Shop coffee</a>
          </div>
        </div>
      `;
      basketTotalEl.textContent = formatMoney(0);
      updateFulfilmentUI();
      return;
    }
    basketItemsEl.innerHTML = basket.map((item, index) => `
      <div class="shop-basket-item">
        <div class="shop-basket-item__heading">
          <strong class="shop-basket-item__name">${escapeHtml(productDisplayName(item))}</strong>
          <div class="shop-basket-item__qty" role="group" aria-label="Quantity for ${escapeHtml(productDisplayName(item))}">
            <button type="button" class="shop-basket-item__qty-btn" data-qty-index="${index}" data-qty-delta="-1" aria-label="Decrease quantity of ${escapeHtml(productDisplayName(item))}" ${item.quantity <= 1 ? "disabled" : ""}>−</button>
            <span class="shop-basket-item__qty-value" aria-live="polite">× ${item.quantity}</span>
            <button type="button" class="shop-basket-item__qty-btn" data-qty-index="${index}" data-qty-delta="1" aria-label="Increase quantity of ${escapeHtml(productDisplayName(item))}" ${item.quantity >= MAX_QUANTITY ? "disabled" : ""}>+</button>
          </div>
        </div>
        <strong class="shop-basket-item__price">${formatMoney(item.lineTotal)}</strong>
        <p class="shop-basket-item__meta">${escapeHtml(item.weight)} · ${escapeHtml(prettyGrind(item.grind))}</p>
        <button type="button" class="shop-basket-remove" data-remove-index="${index}" aria-label="Remove ${escapeHtml(productDisplayName(item))} from basket">
          <svg class="shop-basket-remove__icon" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" focusable="false">
            <path fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" d="M4 7h16M9 7V5.8A1.8 1.8 0 0 1 10.8 4h2.4A1.8 1.8 0 0 1 15 5.8V7m3 0v12.2A1.8 1.8 0 0 1 16.2 21H7.8A1.8 1.8 0 0 1 6 19.2V7m3.5 4v6.5m5-6.5v6.5"/>
          </svg>
        </button>
      </div>`).join("");
    basketTotalEl.textContent = formatMoney(grandTotal);
    updateFulfilmentUI();
    basketItemsEl.querySelectorAll("[data-qty-index]").forEach((button) => button.addEventListener("click", () => {
      const index = Number(button.dataset.qtyIndex);
      const delta = Number(button.dataset.qtyDelta);
      const item = basket[index];
      if (!item || !delta) return;
      setBasketItemQuantity(index, item.quantity + delta);
    }));
    const qtyFocus = options.qtyFocus;
    if (qtyFocus && Number.isInteger(qtyFocus.index)) {
      const selector = `[data-qty-index="${qtyFocus.index}"][data-qty-delta="${qtyFocus.delta}"]`;
      const focusButton = basketItemsEl.querySelector(selector) || basketItemsEl.querySelector(`[data-qty-index="${qtyFocus.index}"]`);
      if (focusButton && !focusButton.disabled) focusButton.focus();
    }
    basketItemsEl.querySelectorAll("[data-remove-index]").forEach((button) => button.addEventListener("click", () => {
      const index = Number(button.dataset.removeIndex);
      const item = basket[index];
      if (!item) return;


      // Send remove_from_cart event
      pushDataLayerEvent(
        "remove_from_cart",
        {
          currency: "GBP",
          value: Number(item.unitPrice) * Number(item.quantity),
          items: [toAnalyticsItem(item)]
        },
        {
          fulfilment_method: fulfilment
        }
      );


      basket.splice(index, 1);
      saveBasket();
      renderBasket();
    }));
  }


  function setupShopProductForms() {
    function clampQuantity(value) {
      return Math.max(1, Math.min(MAX_QUANTITY, Number.parseInt(String(value), 10) || 1));
    }

    function syncQtyStepper(quantityEl, quantity) {
      quantityEl.setAttribute("aria-valuenow", String(quantity));
      const stepper = quantityEl.closest(".shop-qty-stepper");
      if (!stepper) return;
      const minus = stepper.querySelector('[data-qty-delta="-1"]');
      const plus = stepper.querySelector('[data-qty-delta="1"]');
      if (minus) minus.disabled = quantity <= 1;
      if (plus) plus.disabled = quantity >= MAX_QUANTITY;
    }

    function updateProductPanel(prefix, priceMap) {
      const weightEl = document.getElementById(`${prefix}-weight`);
      const grindEl = document.getElementById(`${prefix}-grind`);
      const quantityEl = document.getElementById(`${prefix}-quantity`);
      const summaryEl = document.getElementById(`${prefix}-summary-line`);
      const priceEl = document.getElementById(`${prefix}-price`);
      const noteEl = document.getElementById(`${prefix}-note`);


      if (!weightEl || !grindEl || !quantityEl || !summaryEl || !priceEl) return;


      const editing = document.activeElement === quantityEl && quantityEl.value === "";
      const quantity = clampQuantity(quantityEl.value);
      if (!editing) quantityEl.value = String(quantity);
      syncQtyStepper(quantityEl, quantity);

      const lineTotal = priceMap[weightEl.value] * quantity;
      const grams = weightGrams(weightEl.value);
      const per100 = grams ? lineTotal / quantity / (grams / 100) : 0;
      const valueEl = document.getElementById(`${prefix}-bag-value`);
      if (valueEl) {
        const saving = bagSizeSavingCopy(priceMap, weightEl.value);
        const weekly = weightEl.value === "250g" ? " 500g is the usual weekly bag." : "";
        const per100Copy = per100 ? `£${formatPoundsCompact(per100)} per 100g.` : "";
        valueEl.textContent = [per100Copy, saving ? `${saving}.` : "", weekly].filter(Boolean).join(" ");
      }

      summaryEl.textContent = `${weightEl.value} · ${prettyGrind(grindEl.value)} · Quantity: ${quantity}`;
      priceEl.textContent = formatMoney(lineTotal);
      const hintEl = document.getElementById(`${prefix}-delivery-hint`);
      if (hintEl) {
        const qualifies = isFreeDeliveryBagSize(weightEl.value) || lineTotal >= getFreeDeliveryThresholdPounds();
        hintEl.textContent = qualifies
          ? "UK delivery is free on this selection."
          : getDeliveryPolicyCopy();
      }
      if (noteEl) noteEl.textContent = "Choose delivery or local collection later in the basket before checkout.";
    }

    function setupQtyStepper(prefix, prices) {
      const quantityEl = document.getElementById(`${prefix}-quantity`);
      if (!quantityEl) return;
      const stepper = quantityEl.closest(".shop-qty-stepper");
      if (!stepper) return;

      stepper.querySelectorAll("[data-qty-delta]").forEach((button) => {
        button.addEventListener("click", () => {
          const delta = Number(button.dataset.qtyDelta);
          if (!delta) return;
          quantityEl.value = String(clampQuantity(Number(quantityEl.value) + delta));
          updateProductPanel(prefix, prices);
        });
      });

      quantityEl.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          quantityEl.blur();
          return;
        }
        if (event.key === "ArrowUp" || event.key === "ArrowDown") {
          event.preventDefault();
          const delta = event.key === "ArrowUp" ? 1 : -1;
          quantityEl.value = String(clampQuantity(Number(quantityEl.value) + delta));
          updateProductPanel(prefix, prices);
        }
      });

      quantityEl.addEventListener("input", () => {
        quantityEl.value = String(quantityEl.value).replace(/[^\d]/g, "");
      });

      quantityEl.addEventListener("blur", () => {
        quantityEl.value = String(clampQuantity(quantityEl.value));
        updateProductPanel(prefix, prices);
      });
    }

    function setupDuoForm() {
      const button = document.querySelector("[data-add-duo]");
      if (!button) return;

      const serra = PRODUCTS.serra;
      const peru = PRODUCTS.peru;
      if (!serra || !peru) return;

      const duoPrice = serra.prices["250g"] + peru.prices["250g"];
      const priceEl = document.getElementById("duo-price");
      if (priceEl) priceEl.textContent = formatMoney(duoPrice);

      button.addEventListener("click", () => {
        const serraGrind = document.getElementById("duo-serra-grind")?.value || "whole_bean";
        const peruGrind = document.getElementById("duo-peru-grind")?.value || "whole_bean";

        addBasketItem({
          product: serra.name,
          weight: "250g",
          grind: serraGrind,
          quantity: 1,
          unitPrice: serra.prices["250g"]
        });
        addBasketItem({
          product: peru.name,
          weight: "250g",
          grind: peruGrind,
          quantity: 1,
          unitPrice: peru.prices["250g"]
        });

        saveBasket();
        renderBasket();
        openBasket();

        const originalText = button.textContent;
        button.textContent = "Added";
        window.setTimeout(() => { button.textContent = originalText; }, 1200);
      });
    }


    const hasProductForms = document.querySelector("[data-add-to-basket]");


    if (hasProductForms) {
      [["serra", PRODUCTS.serra.prices], ["peru", PRODUCTS.peru.prices]].forEach(([prefix, prices]) => {
        ["weight", "grind", "quantity"].forEach((field) => {
          const element = document.getElementById(`${prefix}-${field}`);
          if (!element) return;
          element.addEventListener(field === "quantity" ? "input" : "change", () => updateProductPanel(prefix, prices));
        });
        setupQtyStepper(prefix, prices);
        updateProductPanel(prefix, prices);
      });

      setupDuoForm();

      document.querySelectorAll("[data-add-to-basket]").forEach((button) => {
        button.addEventListener("click", () => {
          const key = button.getAttribute("data-add-to-basket");
          const product = PRODUCTS[key];
          if (!product) return;


          const prefix = key === "serra" ? "serra" : "peru";
          const weightEl = document.getElementById(`${prefix}-weight`);
          const grindEl = document.getElementById(`${prefix}-grind`);
          const quantityEl = document.getElementById(`${prefix}-quantity`);
          if (!weightEl || !grindEl || !quantityEl) return;


          const quantity = clampQuantity(quantityEl.value);
          const unitPrice = product.prices[weightEl.value];


          addBasketItem({
            product: product.name,
            weight: weightEl.value,
            grind: grindEl.value,
            quantity,
            unitPrice
          });


          saveBasket();
          renderBasket();
          openBasket();


          const originalText = button.textContent;
          button.textContent = "Added";
          window.setTimeout(() => { button.textContent = originalText; }, 1200);
        });
      });
    }


    // This listener deliberately sits outside the product-form block so the shared basket works on every page.
    checkoutButton?.addEventListener("click", async () => {
      if (!basket.length) {
        openBasket();
        if (basketItemsEl) {
          basketItemsEl.innerHTML = `
            <div class="shop-basket-empty">
              <p>Add at least one coffee before proceeding to checkout.</p>
            </div>
          `;
        }
        return;
      }


      pushDataLayerEvent(
        "begin_checkout",
        {
          currency: "GBP",
          value: getBasketSubtotal() + getBasketDeliveryFee(),
          shipping: getBasketDeliveryFee(),
          items: basket.map(toAnalyticsItem)
        },
        {
          fulfilment_method: fulfilment
        }
      );


      const checkoutLabel = checkoutButton.querySelector(".shop-basket-checkout__label");
      const originalText = checkoutLabel ? checkoutLabel.textContent : checkoutButton.textContent;

      checkoutButton.disabled = true;
      checkoutButton.setAttribute("aria-busy", "true");
      if (checkoutLabel) checkoutLabel.textContent = "Opening secure checkout…";
      else checkoutButton.textContent = "Opening secure checkout…";


      try {
        const payload = {
          fulfilment,
          items: basket.map((item) => ({
            product: item.product,
            weight: item.weight,
            grind: item.grind,
            quantity: item.quantity
          }))
        };


        const response = await fetch("/api/create-checkout-session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });


        const rawText = await response.text();
        let data = {};


        try {
          data = rawText ? JSON.parse(rawText) : {};
        } catch {
          throw new Error(`Invalid response from checkout endpoint: ${rawText || "empty response"}`);
        }


        if (!response.ok || !data.url) {
          throw new Error(data.error || "Unable to create checkout session.");
        }


        // window.dataLayer.push({
        //   event: "begin_checkout",
        //   ecommerce: {
        //     currency: "GBP",
        //     value: getBasketSubtotal(),
        //     items: basket.map((item) => ({
        //       item_name: item.product,
        //       item_variant: `${item.weight} / ${prettyGrind(item.grind)}`,
        //       price: item.unitPrice,
        //       quantity: item.quantity
        //     }))
        //   },
        //   fulfilment
        // });


        // Keep the basket intact while checkout loads.
        window.location.href = data.url;
      } catch (error) {
        if (basketItemsEl) {
          const existingNote = basketItemsEl.querySelector(".shop-basket-checkout-note");
          if (existingNote) existingNote.remove();
          basketItemsEl.insertAdjacentHTML(
            "beforeend",
            `<p class="shop-basket-checkout-note">${escapeHtml(error.message || "Something went wrong. Please try again.")}</p>`
          );
        }


        checkoutButton.disabled = false;
        checkoutButton.removeAttribute("aria-busy");
        if (checkoutLabel) checkoutLabel.textContent = originalText;
        else checkoutButton.textContent = originalText;
      }
    });
  }


  function setupHomepageFeaturedCoffee() {
    const featured = HOME_FEATURED_PRODUCTS.find((product) => product.id === HOME_FEATURED_ID);
    const other = HOME_FEATURED_PRODUCTS.find((product) => product.id !== HOME_FEATURED_ID);
    if (!featured) return;

    const nameEl = document.querySelector("[data-featured-name]");
    const copyEl = document.querySelector("[data-featured-copy]");
    const notesEl = document.querySelector("[data-featured-notes]");
    const priceEl = document.querySelector("[data-featured-price]");
    const linkEl = document.querySelector("[data-featured-link]");
    const imageEl = document.querySelector("[data-featured-image]");
    const originEl = document.querySelector("[data-featured-origin]");
    const fulfilmentEl = document.querySelector("[data-featured-fulfilment]");

    if (nameEl) nameEl.textContent = featured.name;
    if (copyEl) copyEl.textContent = featured.copy;
    if (notesEl) notesEl.textContent = featured.notes;
    if (priceEl) priceEl.textContent = featured.price;
    if (originEl) originEl.textContent = featured.origin;
    if (linkEl) {
      linkEl.href = featured.link;
      linkEl.textContent = `Shop ${featured.name}`;
    }
    if (imageEl) {
      imageEl.src = featured.image;
      imageEl.alt = featured.imageAlt;
      imageEl.onerror = () => {
        imageEl.onerror = null;
        imageEl.src = featured.fallbackImage;
      };
    }
    if (fulfilmentEl) {
      fulfilmentEl.textContent = `${getDeliveryPolicyCopy()}. Free collection in Redditch`;
    }

    if (!other) return;

    const otherNameEl = document.querySelector("[data-other-name]");
    const otherCopyEl = document.querySelector("[data-other-copy]");
    const otherPriceEl = document.querySelector("[data-other-price]");
    const otherLinkEl = document.querySelector("[data-other-link]");

    if (otherNameEl) otherNameEl.textContent = other.name;
    if (otherCopyEl) otherCopyEl.textContent = featured.otherCopy || other.copy;
    if (otherPriceEl) otherPriceEl.textContent = other.price;
    if (otherLinkEl) {
      otherLinkEl.href = other.link;
      otherLinkEl.textContent = `Shop ${other.name}`;
    }
  }


  function setupGrindGuide() {
    const dialog = document.querySelector("#grind-guide-dialog");
    const triggers = document.querySelectorAll("[data-grind-guide-trigger]");

    if (!dialog || !triggers.length) return;

    const closeButtons = dialog.querySelectorAll("[data-grind-guide-close]");
    const closeButton = dialog.querySelector(".grind-guide-dialog__close");
    let previouslyFocusedElement = null;

    function openGrindGuide(event) {
      event.preventDefault();
      event.stopPropagation();
      previouslyFocusedElement = event.currentTarget;
      dialog.removeAttribute("hidden");
      dialog.classList.add("is-open");
      document.body.classList.add("grind-guide-open");

      window.setTimeout(() => {
        closeButton?.focus();
      }, 0);
    }

    function closeGrindGuide(event) {
      event?.preventDefault();
      event?.stopPropagation();
      dialog.setAttribute("hidden", "");
      dialog.classList.remove("is-open");
      document.body.classList.remove("grind-guide-open");
      previouslyFocusedElement?.focus();
    }

    triggers.forEach((trigger) => {
      trigger.addEventListener("click", openGrindGuide);
    });

    closeButtons.forEach((button) => {
      button.addEventListener("click", closeGrindGuide);
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && dialog.classList.contains("is-open")) {
        closeGrindGuide(event);
      }
    });
  }


  function escapeHtml(value) {
    return String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
  }

}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", startShopPage);
} else {
  startShopPage();
}
