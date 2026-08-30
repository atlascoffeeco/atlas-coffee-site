import { getDeliveryFeePounds, getUiProducts, fromPriceLabel } from "./catalog.js?v=20260830-2";

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
  const productId = String(item.product || "").toLowerCase();
  const weight = String(item.weight || "").toLowerCase();
  const grind = String(item.grind || "").toLowerCase();


  const grindLabel = {
    whole_bean: "Whole bean",
    coarse: "Coarse",
    medium: "Medium",
    fine: "Fine"
  }[grind] || item.grind;


  const itemName =
    productId === "peru"
      ? "Peru Cajamarca"
      : "Serra Negra";


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
  const DELIVERY_FEE = getDeliveryFeePounds();
  const MAX_QUANTITY = 10;
  const PRODUCTS = getUiProducts();


  const HOME_FEATURED_PRODUCTS = [
    {
      id: "serra",
      name: "Serra Negra",
      copy: "A smooth Brazilian coffee with praline sweetness, soft milk chocolate, and a balanced finish that works beautifully as an everyday brew.",
      origin: "Brazil",
      use: "Everyday brewing",
      profile: "Sweet & balanced",
      notes: "Praline · Milk chocolate · Toasted nuts",
      price: fromPriceLabel("serra"),
      image: "/assets/serra-negra-bag.webp",
      fallbackImage: "/assets/serra-negra-bag.png",
      imageAlt: "Serra Negra Brazilian coffee bag from Atlas Coffee",
      link: "/shop#serra-negra"
    },
    {
      id: "peru",
      name: "Peru Cajamarca",
      copy: "A bright, lifted Peruvian with mellow panela sweetness, vanilla, cooked citrus, and a fresh-fruit finish. Clean and balanced.",
      origin: "Peru",
      use: "Morning filter",
      profile: "Bright & layered",
      notes: "Panela · Vanilla · Plum · Sweet Cherry",
      price: fromPriceLabel("peru"),
      image: "/assets/cajamarca-bag.webp",
      fallbackImage: "/assets/cajamarca-bag.png",
      imageAlt: "Peru Cajamarca coffee bag from Atlas Coffee",
      link: "/shop#peru-product"
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


  const mobileToggle = document.querySelector("[data-mobile-toggle]");
  const mobilePanel = document.querySelector("[data-mobile-panel]");
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
  const checkoutNoteEl = document.getElementById("basket-checkout-note");


  syncFulfilmentInputs();
  setupMobileMenu();
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
      const unitPrice = Number(item.unitPrice);
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
      el.textContent = `${formatMoney(DELIVERY_FEE)} UK delivery`;
    });
  }


  function prettyGrind(value) {
    return { whole_bean: "Whole bean", coarse: "Coarse", medium: "Medium", fine: "Fine" }[value] || value;
  }


  function prettyFulfilment(value) {
    return value === "collection" ? "Local collection" : "Delivery";
  }


  function getBasketSubtotal() {
    return basket.reduce((sum, item) => sum + item.lineTotal, 0);
  }


  function getBasketDeliveryFee() {
    return basket.length && fulfilment === "delivery" ? DELIVERY_FEE : 0;
  }


  function syncFulfilmentInputs() {
    fulfilmentInputs.forEach((input) => { input.checked = input.value === fulfilment; });
  }


  function updateFulfilmentUI() {
    if (fulfilmentNoteEl) {
      fulfilmentNoteEl.textContent = fulfilment === "collection"
        ? "We’ll contact you after payment to arrange pickup in Redditch."
        : "Switch to local collection to skip the delivery charge.";
    }
    if (checkoutNoteEl) {
      checkoutNoteEl.textContent = fulfilment === "collection"
        ? "Your order will be marked for local collection in Redditch after payment."
        : `Delivery charges of ${formatMoney(DELIVERY_FEE)} will be applied during checkout.`;
    }
    if (basketTotalLabelEl) basketTotalLabelEl.textContent = fulfilment === "collection" ? "Total" : "Total incl. delivery";
    if (basketTotalNoteEl) {
      basketTotalNoteEl.textContent = basket.length
        ? fulfilment === "collection" ? "Collection selected. No delivery charge added." : `Includes ${formatMoney(DELIVERY_FEE)} delivery.`
        : "";
    }
  }


  // Only this mobile-menu function has been updated.
  function setupMobileMenu() {
    if (!mobileToggle || !mobilePanel) return;


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
    if (!basketPopover) { window.location.href = "./shop.html#basket"; return; }
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


  function renderBasket() {
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
        <div class="shop-basket-item__copy">
          <div class="shop-basket-item__title-row"><strong>${escapeHtml(item.product)}</strong><strong class="shop-basket-item__price">${formatMoney(item.lineTotal)}</strong></div>
          <span>${escapeHtml(item.weight)} · ${escapeHtml(prettyGrind(item.grind))} · Quantity ${item.quantity}</span>
        </div>
        <button type="button" class="shop-basket-remove" data-remove-index="${index}" aria-label="Remove ${escapeHtml(item.product)} from basket">Remove</button>
      </div>`).join("");
    basketTotalEl.textContent = formatMoney(grandTotal);
    updateFulfilmentUI();
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
    function updateProductPanel(prefix, priceMap) {
      const weightEl = document.getElementById(`${prefix}-weight`);
      const grindEl = document.getElementById(`${prefix}-grind`);
      const quantityEl = document.getElementById(`${prefix}-quantity`);
      const summaryEl = document.getElementById(`${prefix}-summary-line`);
      const priceEl = document.getElementById(`${prefix}-price`);
      const noteEl = document.getElementById(`${prefix}-note`);


      if (!weightEl || !grindEl || !quantityEl || !summaryEl || !priceEl) return;


      const quantity = Math.max(1, Math.min(MAX_QUANTITY, Number(quantityEl.value) || 1));
      quantityEl.value = quantity;
      summaryEl.textContent = `${weightEl.value} · ${prettyGrind(grindEl.value)} · Quantity: ${quantity}`;
      priceEl.textContent = formatMoney(priceMap[weightEl.value] * quantity);
      if (noteEl) noteEl.textContent = "Choose delivery or local collection later in the basket before checkout.";
    }


    const hasProductForms = document.querySelector("[data-add-to-basket]");


    if (hasProductForms) {
      [["serra", PRODUCTS.serra.prices], ["peru", PRODUCTS.peru.prices]].forEach(([prefix, prices]) => {
        ["weight", "grind", "quantity"].forEach((field) => {
          const element = document.getElementById(`${prefix}-${field}`);
          if (!element) return;
          element.addEventListener(field === "quantity" ? "input" : "change", () => updateProductPanel(prefix, prices));
        });
        updateProductPanel(prefix, prices);
      });


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


          const quantity = Math.max(1, Math.min(MAX_QUANTITY, Number(quantityEl.value) || 1));
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


      const originalText = checkoutButton.textContent;


      checkoutButton.disabled = true;
      checkoutButton.textContent = "Redirecting...";


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
        checkoutButton.textContent = originalText;
      }
    });
  }


  function setupHomepageFeaturedCoffee() {
    const nameEl = document.querySelector("[data-featured-name]"), copyEl = document.querySelector("[data-featured-copy]"), notesEl = document.querySelector("[data-featured-notes]"), priceEl = document.querySelector("[data-featured-price]"), linkEl = document.querySelector("[data-featured-link]"), imageEl = document.querySelector("[data-featured-image]");
    if (!nameEl || !copyEl || !notesEl || !priceEl || !linkEl || !imageEl) return;
    const selected = HOME_FEATURED_PRODUCTS.find((product) => product.id === "peru");
    if (!selected) return;
    nameEl.textContent = selected.name; copyEl.textContent = selected.copy; notesEl.textContent = selected.notes; priceEl.textContent = selected.price; linkEl.href = selected.link; imageEl.src = selected.image; imageEl.alt = selected.imageAlt;
    imageEl.onerror = () => { imageEl.onerror = null; imageEl.src = selected.fallbackImage; };
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
