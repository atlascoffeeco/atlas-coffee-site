document.documentElement.classList.add("js");
window.dataLayer = window.dataLayer || [];

document.addEventListener("DOMContentLoaded", () => {
  const BASKET_STORAGE_KEY = "atlas-basket";
  const basket = readBasket();

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

  setupMobileMenu();
  setupReveal();
  setupBasketDrawer();
  setupShopProductForms();
  renderBasket();

  function readBasket() {
    try {
      const raw = localStorage.getItem(BASKET_STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  function saveBasket() {
    try {
      localStorage.setItem(BASKET_STORAGE_KEY, JSON.stringify(basket));
    } catch {}
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

  function closeBasket() {
    if (!basketPopover) return;

    basketPopover.classList.remove("is-open");
    basketPopover.setAttribute("aria-hidden", "true");
    document.body.classList.remove("basket-open");
    basketToggles.forEach((toggle) => toggle.setAttribute("aria-expanded", "false"));
  }

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
        ? `${count} item${count === 1 ? "" : "s"} · ${formatMoney(total)}`
        : "No items selected yet";
    }

    if (!basketItemsEl || !basketTotalEl) return;

    if (!basket.length) {
      basketItemsEl.innerHTML = '<p class="shop-basket-empty">Your basket is currently empty.</p>';
      basketTotalEl.textContent = formatMoney(0);
      return;
    }

    basketItemsEl.innerHTML = basket.map((item, index) => `
      <div class="shop-basket-item">
        <div class="shop-basket-item__copy">
          <strong>${item.product}</strong>
          <span>${item.weight} · ${prettyGrind(item.grind)} · Quantity ${item.quantity}</span>
        </div>
        <div class="shop-basket-item__actions">
          <strong>${formatMoney(item.lineTotal)}</strong>
          <button type="button" class="shop-basket-remove" data-remove-index="${index}">Remove</button>
        </div>
      </div>
    `).join("");

    basketTotalEl.textContent = formatMoney(total);

    basketItemsEl.querySelectorAll("[data-remove-index]").forEach((button) => {
      button.addEventListener("click", () => {
        basket.splice(Number(button.dataset.removeIndex), 1);
        saveBasket();
        renderBasket();
      });
    });
  }

  function setupShopProductForms() {
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

    if (!document.querySelector("[data-add-to-basket]")) return;

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
        noteEl.textContent = "Delivery is added at checkout. Local collection is also available.";
      }
    }

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

    checkoutButton?.addEventListener("click", () => {
      if (!basket.length) {
        openBasket();
        if (basketItemsEl) {
          basketItemsEl.innerHTML = '<p class="shop-basket-empty">Add at least one coffee before proceeding to checkout.</p>';
        }
        return;
      }

      if (basketItemsEl) {
        basketItemsEl.insertAdjacentHTML(
          "beforeend",
          '<p class="shop-basket-checkout-note">Basket captured for front-end review. Next step is wiring this basket drawer to your live checkout session endpoint.</p>'
        );
      }
    });
  }
});