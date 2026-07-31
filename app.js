// Mark the document as JS-enabled for any CSS hooks
document.documentElement.classList.add("js");

// Ensure the Google Tag Manager data layer always exists
window.dataLayer = window.dataLayer || [];

document.addEventListener("DOMContentLoaded", () => {
  // Local storage keys used to persist basket and fulfilment preference
  const BASKET_STORAGE_KEY = "atlas-basket";
  const FULFILMENT_STORAGE_KEY = "atlas-fulfilment";

  // Shared product pricing in GBP for front-end display only
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

  // Read any saved basket items and fulfilment choice as soon as the page loads
  const basket = readBasket();
  let fulfilment = readFulfilment();

  // Shared UI references used across the site
  const mobileToggle = document.querySelector("[data-mobile-toggle]");
  const mobilePanel = document.querySelector("[data-mobile-panel]");
  const revealItems = document.querySelectorAll(".reveal");
  const basketPopover = document.getElementById("basket-popover");
  const basketToggles = document.querySelectorAll("[data-basket-trigger], [data-open-basket]");
  const basketCloseButtons = document.querySelectorAll("[data-basket-close]");
  const basketCountEls = document.querySelectorAll("[data-basket-count], #basket-count");
  const basketStateEls = document.querySelectorAll("[data-has-items]");
  const basketItemsEl = document.getElementById("basket-items");
  const basketTotalEl = document.getElementById("basket-total");
  const mobileBasketSummaryEl = document.getElementById("mobile-basket-summary");
  const checkoutButton = document.getElementById("checkout-button");
  const mobileBasketBarToggle = document.getElementById("mobile-basket-bar-toggle");
  const fulfilmentInputs = document.querySelectorAll('input[name="basket-fulfilment"]');
  const fulfilmentNoteEl = document.getElementById("basket-fulfilment-note");
  const checkoutNoteEl = document.getElementById("basket-checkout-note");

  // Sync saved fulfilment state into the radio inputs on load
  syncFulfilmentInputs();

  // Set up all shared behaviors used across the site
  setupMobileMenu();
  setupReveal();
  setupBasketDrawer();
  setupFulfilmentSelector();
  setupShopProductForms();
  renderBasket();

  // Read basket safely from localStorage
  function readBasket() {
    try {
      const raw = localStorage.getItem(BASKET_STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  // Save the current basket safely into localStorage
  function saveBasket() {
    try {
      localStorage.setItem(BASKET_STORAGE_KEY, JSON.stringify(basket));
    } catch {}
  }

  // Read fulfilment safely from localStorage
  function readFulfilment() {
    try {
      const saved = localStorage.getItem(FULFILMENT_STORAGE_KEY);
      return saved === "collection" ? "collection" : "delivery";
    } catch {
      return "delivery";
    }
  }

  // Save fulfilment safely into localStorage
  function saveFulfilment() {
    try {
      localStorage.setItem(FULFILMENT_STORAGE_KEY, fulfilment);
    } catch {}
  }

  // Format prices as GBP for display in the UI
  function formatMoney(value) {
    return new Intl.NumberFormat("en-GB", {
      style: "currency",
      currency: "GBP"
    }).format(value);
  }

  // Convert internal grind values into readable labels
  function prettyGrind(value) {
    return {
      whole_bean: "Whole bean",
      coarse: "Coarse",
      medium: "Medium",
      fine: "Fine"
    }[value] || value;
  }

  // Convert fulfilment values into readable labels
  function prettyFulfilment(value) {
    return value === "collection" ? "Local collection" : "Delivery";
  }

  // Keep the basket fulfilment radio buttons in sync with state
  function syncFulfilmentInputs() {
    fulfilmentInputs.forEach((input) => {
      input.checked = input.value === fulfilment;
    });
  }

  // Update fulfilment guidance shown in the basket drawer
  function updateFulfilmentUI() {
    if (fulfilmentNoteEl) {
      fulfilmentNoteEl.textContent =
        fulfilment === "collection"
          ? "Collection is free in Redditch. We’ll contact you after payment to arrange pickup."
          : "Delivery is calculated in Stripe checkout. Switch to local collection to skip the delivery charge.";
    }

    if (checkoutNoteEl) {
      checkoutNoteEl.textContent =
        fulfilment === "collection"
          ? "Your order will be marked for local collection after payment."
          : "Delivery charges will be applied during checkout.";
    }
  }

  // Shared mobile menu behavior for pages using the common header
  function setupMobileMenu() {
    if (!mobileToggle || !mobilePanel) return;

    const setMobileMenu = (open) => {
      mobileToggle.setAttribute("aria-expanded", String(open));
      mobilePanel.classList.toggle("is-open", open);
      mobileToggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
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

  // Reveal-on-scroll animation for elements with the .reveal class
  function setupReveal() {
    if (!revealItems.length) return;

    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

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

  // Open the basket drawer, or fall back to the shop page if no drawer exists
  function openBasket() {
    if (basketPopover) {
      basketPopover.classList.add("is-open");
      basketPopover.setAttribute("aria-hidden", "false");
      document.body.classList.add("basket-open");
    } else {
      window.location.href = "./shop.html#basket";
    }

    basketToggles.forEach((toggle) => toggle.setAttribute("aria-expanded", "true"));
  }

  // Close the basket drawer
  function closeBasket() {
    if (!basketPopover) return;

    basketPopover.classList.remove("is-open");
    basketPopover.setAttribute("aria-hidden", "true");
    document.body.classList.remove("basket-open");
    basketToggles.forEach((toggle) => toggle.setAttribute("aria-expanded", "false"));
  }

  // Attach drawer open/close interactions
  function setupBasketDrawer() {
    basketToggles.forEach((button) => button.addEventListener("click", openBasket));
    basketCloseButtons.forEach((button) => button.addEventListener("click", closeBasket));
    mobileBasketBarToggle?.addEventListener("click", openBasket);

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") closeBasket();
    });

    if (window.location.hash === "#basket" && basketPopover) {
      openBasket();
    }
  }

  // Attach fulfilment change interactions
  function setupFulfilmentSelector() {
    updateFulfilmentUI();

    fulfilmentInputs.forEach((input) => {
      input.addEventListener("change", () => {
        if (!input.checked) return;
        fulfilment = input.value === "collection" ? "collection" : "delivery";
        saveFulfilment();
        syncFulfilmentInputs();
        updateFulfilmentUI();
      });
    });
  }

  // Render the current basket contents and totals into the drawer UI
  function renderBasket() {
    const count = basket.reduce((sum, item) => sum + item.quantity, 0);
    const total = basket.reduce((sum, item) => sum + item.lineTotal, 0);

    basketCountEls.forEach((el) => {
      el.textContent = String(count);
    });

    basketStateEls.forEach((el) => {
      el.setAttribute("data-has-items", count > 0 ? "true" : "false");
    });

    if (mobileBasketSummaryEl) {
      mobileBasketSummaryEl.textContent = basket.length
        ? `${count} item${count === 1 ? "" : "s"} · ${formatMoney(total)} · ${prettyFulfilment(fulfilment)}`
        : "No items selected yet";
    }

    if (!basketItemsEl || !basketTotalEl) {
      updateFulfilmentUI();
      return;
    }

    if (!basket.length) {
      basketItemsEl.innerHTML = '<p class="shop-basket-empty">Your basket is currently empty.</p>';
      basketTotalEl.textContent = formatMoney(0);
      updateFulfilmentUI();
      return;
    }

    basketItemsEl.innerHTML = basket.map((item, index) => `
      <div class="shop-basket-item">
        <div class="shop-basket-item__copy">
          <strong>${escapeHtml(item.product)}</strong>
          <span>${escapeHtml(item.weight)} · ${escapeHtml(prettyGrind(item.grind))} · Quantity ${item.quantity}</span>
        </div>
        <div class="shop-basket-item__actions">
          <strong>${formatMoney(item.lineTotal)}</strong>
          <button type="button" class="shop-basket-remove" data-remove-index="${index}">Remove</button>
        </div>
      </div>
    `).join("");

    basketTotalEl.textContent = formatMoney(total);
    updateFulfilmentUI();

    basketItemsEl.querySelectorAll("[data-remove-index]").forEach((button) => {
      button.addEventListener("click", () => {
        basket.splice(Number(button.dataset.removeIndex), 1);
        saveBasket();
        renderBasket();
      });
    });
  }

  // Product-specific add-to-basket logic used on the shop page
  function setupShopProductForms() {
    if (!document.querySelector("[data-add-to-basket]")) return;

    // Update the visible summary and subtotal for each product panel
    function updateProductPanel(prefix, priceMap) {
      const weightEl = document.getElementById(`${prefix}-weight`);
      const grindEl = document.getElementById(`${prefix}-grind`);
      const quantityEl = document.getElementById(`${prefix}-quantity`);
      const summaryEl = document.getElementById(`${prefix}-summary-line`);
      const priceEl = document.getElementById(`${prefix}-price`);
      const noteEl = document.getElementById(`${prefix}-note`);

      if (!weightEl || !grindEl || !quantityEl || !summaryEl || !priceEl) return;

      const quantity = Math.max(1, Math.min(10, Number(quantityEl.value) || 1));
      quantityEl.value = quantity;

      const unitPrice = priceMap[weightEl.value];
      const subtotal = unitPrice * quantity;

      summaryEl.textContent = `${weightEl.value} · ${prettyGrind(grindEl.value)} · Quantity: ${quantity}`;
      priceEl.textContent = formatMoney(subtotal);

      if (noteEl) {
        noteEl.textContent = "Choose delivery or local collection later in the basket before checkout.";
      }
    }

    // Attach change listeners for each product form
    [["serra", PRODUCTS.serra.prices], ["peru", PRODUCTS.peru.prices]].forEach(([prefix, prices]) => {
      ["weight", "grind", "quantity"].forEach((field) => {
        const el = document.getElementById(`${prefix}-${field}`);
        if (el) {
          el.addEventListener(field === "quantity" ? "input" : "change", () => {
            updateProductPanel(prefix, prices);
          });
        }
      });

      updateProductPanel(prefix, prices);
    });

    // Add a selected product configuration into the shared basket
    document.querySelectorAll("[data-add-to-basket]").forEach((button) => {
      button.addEventListener("click", () => {
        const key = button.getAttribute("data-add-to-basket");
        const product = PRODUCTS[key];
        if (!product) return;

        const prefix = key === "serra" ? "serra" : "peru";
        const weight = document.getElementById(`${prefix}-weight`).value;
        const grind = document.getElementById(`${prefix}-grind`).value;
        const quantity = Math.max(1, Math.min(10, Number(document.getElementById(`${prefix}-quantity`).value) || 1));
        const unitPrice = product.prices[weight];

        basket.push({
          product: product.name,
          weight,
          grind,
          quantity,
          unitPrice,
          lineTotal: unitPrice * quantity
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

    // Send the basket to the live checkout session endpoint when the drawer checkout button is clicked
    checkoutButton?.addEventListener("click", async () => {
      // Prevent checkout if the basket is empty
      if (!basket.length) {
        openBasket();
        if (basketItemsEl) {
          basketItemsEl.innerHTML = '<p class="shop-basket-empty">Add at least one coffee before proceeding to checkout.</p>';
        }
        return;
      }

      // Prevent duplicate clicks and preserve the original button label
      const originalText = checkoutButton.textContent;
      checkoutButton.disabled = true;
      checkoutButton.textContent = "Redirecting...";

      try {
        // Build the server payload from the basket contents
        const payload = {
          fulfilment,
          items: basket.map((item) => ({
            product: item.product,
            weight: item.weight,
            grind: item.grind,
            quantity: item.quantity
          }))
        };

        // Request a live Stripe Checkout Session from the Cloudflare Pages Function
        const response = await fetch("/api/create-checkout-session", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify(payload)
        });

        // Read the raw response first so bad JSON can be handled cleanly
        const rawText = await response.text();
        let data = {};

        try {
          data = rawText ? JSON.parse(rawText) : {};
        } catch {
          throw new Error(`Invalid response from checkout endpoint: ${rawText || "empty response"}`);
        }

        // Stripe session creation must return a checkout URL
        if (!response.ok || !data.url) {
          throw new Error(data.error || "Unable to create checkout session.");
        }

        // Optionally push a begin_checkout event before leaving the site
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

        // Clear the basket before redirecting into hosted checkout
        basket.length = 0;
        saveBasket();
        renderBasket();

        // Send the customer to Stripe Checkout
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

  // Basic HTML escaping for any user-facing interpolated text
  function escapeHtml(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }
});