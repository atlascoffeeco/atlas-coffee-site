// Mark the document as JS-enabled for any CSS hooks
document.documentElement.classList.add("js");

// Ensure the Google Tag Manager data layer always exists
window.dataLayer = window.dataLayer || [];

document.addEventListener("DOMContentLoaded", () => {
  const BASKET_STORAGE_KEY = "atlas-basket";
  const FULFILMENT_STORAGE_KEY = "atlas-fulfilment";
  const DELIVERY_FEE = 4.5;

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

const HOME_FEATURED_PRODUCTS = [
  {
    id: "serra",
    name: "Serra Negra",
    copy: "A smooth Brazilian coffee with praline sweetness, soft milk chocolate, and a balanced finish that works beautifully as an everyday brew.",
    origin: "Brazil",
    use: "Everyday brewing",
    profile: "Sweet & balanced",
    price: "From £10.95",
    image: "/assets/serra-negra-bag.webp",
    fallbackImage: "/assets/serra-negra-bag.png",
    imageAlt: "Serra Negra Brazilian coffee bag from Atlas Coffee",
    link: "/shop#serra-negra"
  },
  {
    id: "peru",
    name: "Peru Cajamarca",
    copy: "Cleaner and brighter in the cup, with layered sweetness and a more lifted finish from first sip to last.",
    origin: "Peru",
    use: "Morning filter",
    profile: "Bright & layered",
    price: "From £13.95",
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

  const basket = readBasket();
  let fulfilment = readFulfilment();

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
  setupShopProductForms();
  setupHomepageFeaturedCoffee();
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
          ? "Collection is free in Redditch. We’ll contact you after payment to arrange pickup."
          : "Delivery is added securely at checkout. Switch to local collection to skip the delivery charge.";
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

  function getBasketGrandTotal() {
    return getBasketSubtotal() + getBasketDeliveryFee();
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
      mobileBuyBar.style.display = basket.length ? "block" : "none";
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
      basketItemsEl.innerHTML = '<p class="shop-basket-empty">Your basket is currently empty.</p>';
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
        <button type="button" class="shop-basket-remove" data-remove-index="${index}">Remove</button>
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

    checkoutButton?.addEventListener("click", async () => {
      if (!basket.length) {
        openBasket();
        if (basketItemsEl) {
          basketItemsEl.innerHTML = '<p class="shop-basket-empty">Add at least one coffee before proceeding to checkout.</p>';
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
          throw new Error(`Invalid response from checkout endpoint: ${rawText || "empty response"}`);
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
  const nameEl = document.querySelector("[data-featured-name]");
  const copyEl = document.querySelector("[data-featured-copy]");
  const originEl = document.querySelector("[data-featured-origin]");
  const useEl = document.querySelector("[data-featured-use]");
  const profileEl = document.querySelector("[data-featured-profile]");
  const priceEl = document.querySelector("[data-featured-price]");
  const linkEl = document.querySelector("[data-featured-link]");
  const imageEl = document.querySelector("[data-featured-image]");

  if (
    !nameEl ||
    !copyEl ||
    !originEl ||
    !useEl ||
    !profileEl ||
    !priceEl ||
    !linkEl ||
    !imageEl
  ) {
    return;
  }

  // Permanently feature Peru Cajamarca.
  const selected = HOME_FEATURED_PRODUCTS.find(
    (product) => product.id === "peru"
  );

  nameEl.textContent = selected.name;
  copyEl.textContent = selected.copy;
  originEl.textContent = selected.origin;
  useEl.textContent = selected.use;
  profileEl.textContent = selected.profile;
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