// Mark the document as JS-enabled for CSS hooks.
document.documentElement.classList.add("js");

// Ensure the Google Tag Manager data layer always exists.
window.dataLayer = window.dataLayer || [];

document.addEventListener("DOMContentLoaded", () => {
  const BASKET_STORAGE_KEY = "atlas-basket";
  const FULFILMENT_STORAGE_KEY = "atlas-fulfilment";
  const DELIVERY_FEE = 4.5;
  const MAX_QUANTITY = 10;

  const PRODUCTS = {
    serra: {
      id: "serra",
      name: "Serra Negra",
      prices: { "250g": 10.95, "500g": 19.5, "1kg": 35.95 }
    },
    peru: {
      id: "peru",
      name: "Peru Cajamarca",
      prices: { "250g": 13.95, "500g": 26.95, "1kg": 49.95 }
    }
  };

  // Content used by the homepage featured-coffee card.
  const HOME_FEATURED_PRODUCTS = [
    {
      id: "serra",
      name: "Serra Negra",
      copy: "A smooth Brazilian coffee with praline sweetness, soft milk chocolate, and a balanced finish that works beautifully as an everyday brew.",
      origin: "Brazil",
      use: "Everyday brewing",
      profile: "Sweet & balanced",
      notes: "Praline · Milk chocolate · Toasted nuts",
      price: "From £10.95",
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
      price: "From £13.95",
      image: "/assets/cajamarca-bag.webp",
      fallbackImage: "/assets/cajamarca-bag.png",
      imageAlt: "Peru Cajamarca coffee bag from Atlas Coffee",
      link: "/shop#peru-product"
    }
  ];

  // The mobile basket bar is added only on pages that do not already contain it.
  const mobileBasketBarMarkup = `
    <div class="mobile-buy-bar" aria-hidden="true">
      <div class="container mobile-buy-bar__inner">
        <div class="mobile-buy-bar__meta">
          <strong>Your basket</strong>
          <span id="mobile-basket-summary">No items selected yet</span>
        </div>
        <button class="button mobile-buy-bar__button" type="button" id="mobile-basket-bar-toggle">
          View basket
        </button>
      </div>
    </div>
  `;

  function ensureMobileBasketBar() {
    if (document.getElementById("mobile-basket-bar-toggle")) return;

    const footer = document.querySelector(".site-footer");
    if (!footer) return;

    footer.insertAdjacentHTML("beforebegin", mobileBasketBarMarkup);
  }

  ensureMobileBasketBar();

  // readBasket() normalises and merges any older duplicate rows in localStorage.
  const basket = readBasket();
  let fulfilment = readFulfilment();

  // Persist the cleaned basket so duplicates are not recreated on the next page load.
  if (basket.length) {
    try {
      localStorage.setItem(BASKET_STORAGE_KEY, JSON.stringify(basket));
    } catch { }
  }

  // Cache DOM references before any setup function is called.
  const mobileToggle = document.querySelector("[data-mobile-toggle]");
  const mobilePanel = document.querySelector("[data-mobile-panel]");
  const revealItems = document.querySelectorAll(".reveal");
  const basketPopover = document.getElementById("basket-popover");
  const basketDrawer = document.querySelector(".shop-basket-drawer");
  const basketToggles = document.querySelectorAll(
    "[data-basket-trigger], [data-open-basket]"
  );
  const basketCloseButtons = document.querySelectorAll(
    ".shop-basket-drawer__close[data-basket-close]"
  );
  const basketBackdrop = document.querySelector(
    ".shop-basket-popover__backdrop"
  );
  const basketHandle = document.querySelector("[data-basket-handle]");
const basketHeader = document.querySelector(
  ".shop-basket-drawer__header"
);
  const basketCountEls = document.querySelectorAll(
    "[data-basket-count], #basket-count"
  );
  const basketStateEls = document.querySelectorAll("[data-has-items]");
  const basketItemsEl = document.getElementById("basket-items");
  const basketTotalEl = document.getElementById("basket-total");
  const basketTotalLabelEl = document.querySelector(
    ".shop-basket-total .shop-basket-total-label"
  );
  const basketTotalNoteEl = document.getElementById("basket-total-note");
  const mobileBasketSummaryEl = document.getElementById("mobile-basket-summary");
  const checkoutButton = document.getElementById("checkout-button");
  const mobileBasketBarToggle = document.getElementById("mobile-basket-bar-toggle");
  const fulfilmentInputs = document.querySelectorAll(
    'input[name="basket-fulfilment"]'
  );
  const fulfilmentNoteEl = document.getElementById("basket-fulfilment-note");
  const checkoutNoteEl = document.getElementById("basket-checkout-note");

  syncFulfilmentInputs();

  setupMobileMenu();
  setupReveal();
  setupBasketDrawer();
  setupFulfilmentSelector();
  setupShopProductForms();
  setupHomepageFeaturedCoffee();
  renderBasket();

  function readBasket() {
    try {
      const raw = localStorage.getItem(BASKET_STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : [];

      if (!Array.isArray(parsed)) return [];

      return mergeBasketItems(parsed);
    } catch {
      return [];
    }
  }

  // Product, weight, and grind together identify one basket line.
  function getBasketItemKey(item) {
    return [
      String(item.product || ""),
      String(item.weight || ""),
      String(item.grind || "")
    ].join("::");
  }

  // Remove invalid records and merge duplicate selections from localStorage.
  function mergeBasketItems(items) {
    const merged = new Map();

    items.forEach((item) => {
      if (!item || typeof item !== "object") return;

      const quantity = Math.max(
        1,
        Math.min(MAX_QUANTITY, Number(item.quantity) || 1)
      );
      const unitPrice = Number(item.unitPrice);

      if (
        !item.product ||
        !item.weight ||
        !item.grind ||
        !Number.isFinite(unitPrice) ||
        unitPrice < 0
      ) {
        return;
      }

      const cleanItem = {
        product: String(item.product),
        weight: String(item.weight),
        grind: String(item.grind),
        quantity,
        unitPrice,
        lineTotal: unitPrice * quantity
      };

      const key = getBasketItemKey(cleanItem);
      const existing = merged.get(key);

      if (!existing) {
        merged.set(key, cleanItem);
        return;
      }

      existing.quantity = Math.min(
        MAX_QUANTITY,
        existing.quantity + cleanItem.quantity
      );
      existing.lineTotal = existing.unitPrice * existing.quantity;
    });

    return Array.from(merged.values());
  }

  // Add a new line or increase the quantity of an identical selection.
  function addBasketItem(item) {
    const key = getBasketItemKey(item);
    const existing = basket.find(
      (basketItem) => getBasketItemKey(basketItem) === key
    );

    if (existing) {
      existing.quantity = Math.min(
        MAX_QUANTITY,
        existing.quantity + item.quantity
      );
      existing.lineTotal = existing.unitPrice * existing.quantity;
      return;
    }

    basket.push({
      ...item,
      lineTotal: item.unitPrice * item.quantity
    });
  }

  function saveBasket() {
    try {
      localStorage.setItem(BASKET_STORAGE_KEY, JSON.stringify(basket));
    } catch { }
  }

  function readFulfilment() {
    try {
      const saved = localStorage.getItem(FULFILMENT_STORAGE_KEY);
      return saved === "collection" ? "collection" : "delivery";
    } catch {
      return "delivery";
    }
  }

  function saveFulfilment() {
    try {
      localStorage.setItem(FULFILMENT_STORAGE_KEY, fulfilment);
    } catch { }
  }

  function formatMoney(value) {
    return new Intl.NumberFormat("en-GB", {
      style: "currency",
      currency: "GBP"
    }).format(value);
  }

  function prettyGrind(value) {
    return {
      whole_bean: "Whole bean",
      coarse: "Coarse",
      medium: "Medium",
      fine: "Fine"
    }[value] || value;
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
    fulfilmentInputs.forEach((input) => {
      input.checked = input.value === fulfilment;
    });
  }

  function updateFulfilmentUI() {
    if (fulfilmentNoteEl) {
      fulfilmentNoteEl.textContent =
        fulfilment === "collection"
          ? "Collection is free in South Birmingham. We’ll contact you after payment to arrange pickup."
          : "Switch to local collection to skip the delivery charge.";
    }

    if (checkoutNoteEl) {
      checkoutNoteEl.textContent =
        fulfilment === "collection"
          ? "Your order will be marked for local collection after payment."
          : `Delivery charges of ${formatMoney(DELIVERY_FEE)} will be applied during checkout.`;
    }

    if (basketTotalLabelEl) {
      basketTotalLabelEl.textContent =
        fulfilment === "collection" ? "Total" : "Total incl. delivery";
    }

    if (basketTotalNoteEl) {
      basketTotalNoteEl.textContent = basket.length
        ? fulfilment === "collection"
          ? "Collection selected. No delivery charge added."
          : `Includes ${formatMoney(DELIVERY_FEE)} delivery.`
        : "";
    }
  }

  function setupMobileMenu() {
    if (!mobileToggle || !mobilePanel) return;

    const setMobileMenu = (open) => {
      mobileToggle.setAttribute("aria-expanded", String(open));
      mobilePanel.classList.toggle("is-open", open);
      mobileToggle.setAttribute(
        "aria-label",
        open ? "Close menu" : "Open menu"
      );
    };

    mobileToggle.addEventListener("click", () => {
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

    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    if (!prefersReducedMotion && "IntersectionObserver" in window) {
      const observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("revealed");
            observer.unobserve(entry.target);
          }
        });
      }, { threshold: 0.12 });

      revealItems.forEach((item) => observer.observe(item));
    } else {
      revealItems.forEach((item) => item.classList.add("revealed"));
    }
  }

  // Open the drawer and reset any inline transform left by a previous drag.
  function openBasket() {
  if (basketPopover) {
    renderBasket();
    basketPopover.classList.add("is-open");
    basketPopover.setAttribute("aria-hidden", "false");
    document.body.classList.add("basket-open");

    if (basketDrawer) {
      basketDrawer.classList.remove("is-dragging");
      basketDrawer.style.removeProperty("transform");
    }

    requestAnimationFrame(() => renderBasket());
  } else {
    window.location.href = "./shop.html#basket";
  }

  basketToggles.forEach((toggle) => {
    toggle.setAttribute("aria-expanded", "true");
  });
}

  // On mobile, minimise a populated basket to the sticky basket bar.
  // An empty basket closes completely because there is nothing to preserve.
  function minimiseBasket() {
    if (!basketPopover) return;

    if (basket.length > 0) {
      basketPopover.classList.remove("is-open");
      basketPopover.setAttribute("aria-hidden", "true");
      document.body.classList.remove("basket-open");

      basketToggles.forEach((toggle) => {
        toggle.setAttribute("aria-expanded", "false");
      });

      return;
    }

    closeBasket();
  }

  // Explicit Close and Escape dismiss the drawer completely.
  function closeBasket() {
    if (!basketPopover) return;

    basketPopover.classList.remove("is-open");
    basketPopover.setAttribute("aria-hidden", "true");
    document.body.classList.remove("basket-open");

    if (basketDrawer) {
      basketDrawer.classList.remove("is-dragging");
      basketDrawer.style.removeProperty("transform");
    }

    basketToggles.forEach((toggle) => {
      toggle.setAttribute("aria-expanded", "false");
    });
  }

  function setupBasketDrawer() {
    basketToggles.forEach((button) => {
      button.addEventListener("click", openBasket);
    });

    basketCloseButtons.forEach((button) => {
      button.addEventListener("click", closeBasket);
    });

    mobileBasketBarToggle?.addEventListener("click", openBasket);

    // Mobile backdrop tap minimises a populated basket; desktop tap closes it.
    basketBackdrop?.addEventListener("click", () => {
      if (window.matchMedia("(max-width: 859px)").matches) {
        minimiseBasket();
      } else {
        closeBasket();
      }
    });

    // The handle is both a keyboard-accessible minimise button and drag target.
    basketHandle?.addEventListener("click", minimiseBasket);

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") closeBasket();
    });

    setupBasketDrag();

    if (window.location.hash === "#basket" && basketPopover) {
      openBasket();
    }
  }

  // Drag only from the handle, leaving the item list free to scroll normally.
  function setupBasketDrag() {
  /*
   * Use the visible handle when available.
   * Fall back to the complete basket header so the gesture still works
   * if the handle is hidden or not rendered.
   */
  const dragRegion = basketHandle || basketHeader;

  if (!dragRegion || !basketDrawer) return;

  let startY = 0;
  let currentY = 0;
  let startTime = 0;
  let pointerId = null;
  let dragging = false;

  const isMobileSheet = () =>
    window.matchMedia("(max-width: 859px)").matches;

  const resetDrag = () => {
    basketDrawer.classList.remove("is-dragging");
    basketDrawer.style.removeProperty("transform");
    dragging = false;
    pointerId = null;
  };

  dragRegion.addEventListener("pointerdown", (event) => {
    if (!isMobileSheet()) return;
    if (!basketPopover?.classList.contains("is-open")) return;

    /*
     * Do not start a drag when the user is pressing the Close button
     * or the handle's own button click is being handled normally.
     */
    if (
      event.target.closest(".shop-basket-drawer__close") ||
      event.target.closest("a") ||
      event.target.closest("input") ||
      event.target.closest("select")
    ) {
      return;
    }

    pointerId = event.pointerId;
    startY = event.clientY;
    currentY = startY;
    startTime = performance.now();
    dragging = true;

    basketDrawer.classList.add("is-dragging");

    if (dragRegion.setPointerCapture) {
      dragRegion.setPointerCapture(pointerId);
    }
  });

  dragRegion.addEventListener("pointermove", (event) => {
    if (!dragging || event.pointerId !== pointerId) return;

    currentY = event.clientY;
    const distance = Math.max(0, currentY - startY);

    basketDrawer.style.transform = `translateY(${distance}px)`;
  });

  dragRegion.addEventListener("pointerup", (event) => {
    if (!dragging || event.pointerId !== pointerId) return;

    const distance = Math.max(0, currentY - startY);
    const elapsed = Math.max(1, performance.now() - startTime);
    const velocity = distance / elapsed;

    const shouldMinimise =
      distance >= 70 ||
      (distance >= 35 && velocity >= 0.45);

    if (shouldMinimise) {
      resetDrag();
      minimiseBasket();
      return;
    }

    resetDrag();
  });

  dragRegion.addEventListener("pointercancel", resetDrag);

  dragRegion.addEventListener("lostpointercapture", () => {
    if (dragging) resetDrag();
  });
}

  function setupFulfilmentSelector() {
    updateFulfilmentUI();

    fulfilmentInputs.forEach((input) => {
      input.addEventListener("change", () => {
        if (!input.checked) return;

        fulfilment = input.value === "collection" ? "collection" : "delivery";
        saveFulfilment();
        syncFulfilmentInputs();
        updateFulfilmentUI();
        renderBasket();
      });
    });
  }

  function renderBasket() {
    const count = basket.reduce((sum, item) => sum + item.quantity, 0);
    const subtotal = getBasketSubtotal();
    const delivery = getBasketDeliveryFee();
    const grandTotal = subtotal + delivery;

    if (checkoutButton) {
      checkoutButton.disabled = basket.length === 0;
    }

    const mobileBuyBar = document.querySelector(".mobile-buy-bar");

if (mobileBuyBar) {
  const hasItems = basket.length > 0;

  mobileBuyBar.hidden = !hasItems;
  mobileBuyBar.setAttribute("aria-hidden", String(!hasItems));
}

    basketCountEls.forEach((el) => {
      el.textContent = String(count);
    });

    basketStateEls.forEach((el) => {
      el.setAttribute("data-has-items", count > 0 ? "true" : "false");
    });

    if (mobileBasketSummaryEl) {
      mobileBasketSummaryEl.textContent = basket.length
        ? `${count} item${count === 1 ? "" : "s"} · ${formatMoney(grandTotal)} · ${prettyFulfilment(fulfilment)}`
        : "No items selected yet";
    }

    if (!basketItemsEl || !basketTotalEl) {
      updateFulfilmentUI();
      return;
    }

    if (!basket.length) {
      basketItemsEl.innerHTML =
        '<p class="shop-basket-empty">Your basket is currently empty.</p>';
      basketTotalEl.textContent = formatMoney(0);
      updateFulfilmentUI();
      return;
    }

    basketItemsEl.innerHTML = basket.map((item, index) => `
      <div class="shop-basket-item">
        <div class="shop-basket-item__copy">
          <div class="shop-basket-item__title-row">
            <strong>${escapeHtml(item.product)}</strong>
            <strong class="shop-basket-item__price">${formatMoney(item.lineTotal)}</strong>
          </div>
          <span>${escapeHtml(item.weight)} · ${escapeHtml(prettyGrind(item.grind))} · Quantity ${item.quantity}</span>
        </div>
        <button
          type="button"
          class="shop-basket-remove"
          data-remove-index="${index}"
          aria-label="Remove ${escapeHtml(item.product)} from basket"
        >
          Remove
        </button>
      </div>
    `).join("");

    basketTotalEl.textContent = formatMoney(grandTotal);
    updateFulfilmentUI();

    basketItemsEl.querySelectorAll("[data-remove-index]").forEach((button) => {
      button.addEventListener("click", () => {
        basket.splice(Number(button.dataset.removeIndex), 1);
        saveBasket();
        renderBasket();
      });
    });
  }

  function setupShopProductForms() {
    if (!document.querySelector("[data-add-to-basket]")) return;

    function updateProductPanel(prefix, priceMap) {
      const weightEl = document.getElementById(`${prefix}-weight`);
      const grindEl = document.getElementById(`${prefix}-grind`);
      const quantityEl = document.getElementById(`${prefix}-quantity`);
      const summaryEl = document.getElementById(`${prefix}-summary-line`);
      const priceEl = document.getElementById(`${prefix}-price`);
      const noteEl = document.getElementById(`${prefix}-note`);

      if (!weightEl || !grindEl || !quantityEl || !summaryEl || !priceEl) return;

      const quantity = Math.max(
        1,
        Math.min(MAX_QUANTITY, Number(quantityEl.value) || 1)
      );
      quantityEl.value = quantity;

      const unitPrice = priceMap[weightEl.value];
      const subtotal = unitPrice * quantity;

      summaryEl.textContent = `${weightEl.value} · ${prettyGrind(grindEl.value)} · Quantity: ${quantity}`;
      priceEl.textContent = formatMoney(subtotal);

      if (noteEl) {
        noteEl.textContent =
          "Choose delivery or local collection later in the basket before checkout.";
      }
    }

    [["serra", PRODUCTS.serra.prices], ["peru", PRODUCTS.peru.prices]].forEach(
      ([prefix, prices]) => {
        ["weight", "grind", "quantity"].forEach((field) => {
          const el = document.getElementById(`${prefix}-${field}`);

          if (el) {
            el.addEventListener(
              field === "quantity" ? "input" : "change",
              () => updateProductPanel(prefix, prices)
            );
          }
        });

        updateProductPanel(prefix, prices);
      }
    );

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

        const weight = weightEl.value;
        const grind = grindEl.value;
        const quantity = Math.max(
          1,
          Math.min(MAX_QUANTITY, Number(quantityEl.value) || 1)
        );
        const unitPrice = product.prices[weight];

        addBasketItem({
          product: product.name,
          weight,
          grind,
          quantity,
          unitPrice
        });

        saveBasket();
        renderBasket();
        openBasket();

        const original = button.textContent;
        button.textContent = "Added";

        window.setTimeout(() => {
          button.textContent = original;
        }, 1200);
      });
    });

    checkoutButton?.addEventListener("click", async () => {
      if (!basket.length) {
        openBasket();

        if (basketItemsEl) {
          basketItemsEl.innerHTML =
            '<p class="shop-basket-empty">Add at least one coffee before proceeding to checkout.</p>';
        }

        return;
      }

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
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify(payload)
        });

        const rawText = await response.text();
        let data = {};

        try {
          data = rawText ? JSON.parse(rawText) : {};
        } catch {
          throw new Error(
            `Invalid response from checkout endpoint: ${rawText || "empty response"}`
          );
        }

        if (!response.ok || !data.url) {
          throw new Error(data.error || "Unable to create checkout session.");
        }

        window.dataLayer.push({
          event: "begin_checkout",
          ecommerce: {
            currency: "GBP",
            value: basket.reduce((sum, item) => sum + item.lineTotal, 0),
            items: basket.map((item) => ({
              item_name: item.product,
              item_variant: `${item.weight} / ${prettyGrind(item.grind)}`,
              price: item.unitPrice,
              quantity: item.quantity
            }))
          },
          fulfilment
        });

        basket.length = 0;
        saveBasket();
        renderBasket();
        window.location.href = data.url;
      } catch (error) {
        if (basketItemsEl) {
          const existingNote = basketItemsEl.querySelector(
            ".shop-basket-checkout-note"
          );
          if (existingNote) existingNote.remove();

          basketItemsEl.insertAdjacentHTML(
            "beforeend",
            `<p class="shop-basket-checkout-note">${escapeHtml(
              error.message || "Something went wrong. Please try again."
            )}</p>`
          );
        }

        checkoutButton.disabled = false;
        checkoutButton.textContent = originalText;
      }
    });
  }

  function setupHomepageFeaturedCoffee() {
    const nameEl = document.querySelector("[data-featured-name]");
    const copyEl = document.querySelector("[data-featured-copy]");
    const notesEl = document.querySelector("[data-featured-notes]");
    const priceEl = document.querySelector("[data-featured-price]");
    const linkEl = document.querySelector("[data-featured-link]");
    const imageEl = document.querySelector("[data-featured-image]");

    // The homepage uses the new tasting-notes row rather than the old specs row.
    if (!nameEl || !copyEl || !notesEl || !priceEl || !linkEl || !imageEl) {
      return;
    }

    // Permanently feature Peru Cajamarca.
    const selected = HOME_FEATURED_PRODUCTS.find(
      (product) => product.id === "peru"
    );

    if (!selected) return;

    nameEl.textContent = selected.name;
    copyEl.textContent = selected.copy;
    notesEl.textContent = selected.notes;
    priceEl.textContent = selected.price;
    linkEl.href = selected.link;
    imageEl.src = selected.image;
    imageEl.alt = selected.imageAlt;

    imageEl.onerror = () => {
      imageEl.onerror = null;
      imageEl.src = selected.fallbackImage;
    };
  }

  function escapeHtml(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }
});