const mobileToggle =
  document.querySelector(".mobile-menu-toggle") ||
  document.querySelector("[data-mobile-toggle]");

const mobilePanel =
  document.querySelector(".mobile-panel") ||
  document.querySelector("[data-mobile-panel]");

if (mobileToggle && mobilePanel) {
  const mobileLinks = mobilePanel.querySelectorAll("a");

  function setMobileMenu(open) {
    mobileToggle.setAttribute("aria-expanded", String(open));
    mobileToggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
    mobilePanel.classList.toggle("is-open", open);
  }

  mobileToggle.addEventListener("click", () => {
    const isOpen = mobileToggle.getAttribute("aria-expanded") === "true";
    setMobileMenu(!isOpen);
  });

  mobileLinks.forEach((link) => {
    link.addEventListener("click", () => setMobileMenu(false));
  });

  window.addEventListener("resize", () => {
    if (window.innerWidth > 860) {
      setMobileMenu(false);
    }
  });
}

const revealItems = document.querySelectorAll(".reveal");

if ("IntersectionObserver" in window && revealItems.length) {
  const revealObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("revealed");
          revealObserver.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.15 }
  );

  revealItems.forEach((item) => revealObserver.observe(item));
} else {
  revealItems.forEach((item) => item.classList.add("revealed"));
}

const cartOpenButtons = Array.from(document.querySelectorAll("[data-cart-open]"));
const cartCloseButton = document.querySelector("[data-cart-close]");
const cartDrawer = document.getElementById("cart-drawer");
const cartBackdrop = document.getElementById("cart-backdrop");
const basketLines = document.getElementById("basket-lines");
const basketEmpty = document.getElementById("basket-empty");
const basketItemCount = document.getElementById("basket-item-count");
const basketSubtotal = document.getElementById("basket-subtotal");
const cartCountPill = document.getElementById("cart-count-pill");
const cartCountInline = document.getElementById("cart-count-inline");
const basketStickyBar = document.getElementById("basket-sticky-bar");
const basketStickyCount = document.getElementById("basket-sticky-count");
const basketStickySubtotal = document.getElementById("basket-sticky-subtotal");
const basketFulfilment = document.getElementById("basket-fulfilment");
const basketFulfilmentNote = document.getElementById("basket-fulfilment-note");
const basketCheckoutButton = document.getElementById("basket-checkout-button");

const PRICE_MAP = {
  "Serra Negra": {
    "250g": 10.95,
    "500g": 19.5,
    "1kg": 35.95
  },
  "Peru Cajamarca": {
    "250g": 11.95,
    "500g": 20.95,
    "1kg": 38.95
  }
};

const DELIVERY_FEE = 4.5;

const basketState = {
  items: [],
  fulfilment: basketFulfilment ? basketFulfilment.value : "delivery"
};

let isCartOpen = false;
let lastFocusedTrigger = null;
let previousBodyOverflow = "";

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
  return value === "collection" ? "Collection" : "Delivery";
}

function getLineItemKey(product, weight, grind) {
  return `${product}__${weight}__${grind}`;
}

function getBasketItemCount() {
  return basketState.items.reduce((total, item) => total + item.quantity, 0);
}

function updateFulfilmentNote() {
  if (!basketFulfilmentNote) return;

  if (basketState.fulfilment === "delivery") {
    basketFulfilmentNote.textContent =
      `Delivery is added securely at checkout from ${formatMoney(DELIVERY_FEE)}.`;
  } else {
    basketFulfilmentNote.textContent =
      "Collection is available from Church Hill North, Redditch. Collection details will be shared after payment.";
  }
}

function updateCartVisibility() {
  const itemCount = getBasketItemCount();
  const hasItems = itemCount > 0;

  if (basketEmpty) {
    basketEmpty.hidden = hasItems;
  }

  if (basketLines) {
    basketLines.hidden = !hasItems;
  }

  if (basketCheckoutButton) {
    basketCheckoutButton.disabled = !hasItems;

    if (!hasItems) {
      basketCheckoutButton.setAttribute("disabled", "");
    } else {
      basketCheckoutButton.removeAttribute("disabled");
    }

    basketCheckoutButton.setAttribute("aria-disabled", String(!hasItems));
    basketCheckoutButton.textContent = "Checkout";
  }

  if (basketStickyBar) {
    basketStickyBar.hidden = !hasItems;
  }
}

function renderCartLines() {
  if (!basketLines) return;

  if (!basketState.items.length) {
    basketLines.innerHTML = "";
    updateCartVisibility();
    return;
  }

  basketLines.innerHTML = basketState.items
    .map((item, index) => {
      const lineTotal = item.price * item.quantity;

      return `
        <article class="basket-line" data-line-index="${index}">
          <div class="basket-line__main">
            <div class="basket-line__copy">
              <h3>${item.product}</h3>
              <p>${item.weight} · ${prettyGrind(item.grind)} · Qty ${item.quantity}</p>
            </div>
            <strong>${formatMoney(lineTotal)}</strong>
          </div>
          <button class="basket-line__remove" type="button" data-remove-line="${index}" aria-label="Remove ${item.product} from basket">
            Remove
          </button>
        </article>
      `;
    })
    .join("");

  updateCartVisibility();
}

function updateCartTotals() {
  const itemCount = getBasketItemCount();
  const subtotalValue = basketState.items.reduce(
    (total, item) => total + item.price * item.quantity,
    0
  );

  if (basketItemCount) basketItemCount.textContent = String(itemCount);
  if (basketSubtotal) basketSubtotal.textContent = formatMoney(subtotalValue);
  if (cartCountPill) cartCountPill.textContent = String(itemCount);
  if (cartCountInline) cartCountInline.textContent = String(itemCount);

  if (basketStickyCount) {
    basketStickyCount.textContent = `${itemCount} ${itemCount === 1 ? "item" : "items"}`;
  }

  if (basketStickySubtotal) {
    basketStickySubtotal.textContent = `${formatMoney(subtotalValue)} subtotal`;
  }

  updateCartVisibility();
}

function syncCartUI() {
  renderCartLines();
  updateCartTotals();
  updateCartVisibility();
  updateFulfilmentNote();
}

function openCart(trigger = null) {
  if (!cartDrawer || !cartBackdrop) return;

  lastFocusedTrigger = trigger || document.activeElement;
  isCartOpen = true;

  cartDrawer.classList.add("is-open");
  cartBackdrop.hidden = false;
  cartDrawer.setAttribute("aria-hidden", "false");

  cartOpenButtons.forEach((button) => {
    button.setAttribute("aria-expanded", "true");
  });

  previousBodyOverflow = document.body.style.overflow;
  document.body.style.overflow = "hidden";

  window.requestAnimationFrame(() => {
    if (cartCloseButton) {
      cartCloseButton.focus();
    } else {
      cartDrawer.focus();
    }
  });
}

function closeCart() {
  if (!cartDrawer || !cartBackdrop) return;

  isCartOpen = false;

  cartDrawer.classList.remove("is-open");
  cartBackdrop.hidden = true;
  cartDrawer.setAttribute("aria-hidden", "true");

  cartOpenButtons.forEach((button) => {
    button.setAttribute("aria-expanded", "false");
  });

  document.body.style.overflow = previousBodyOverflow || "";

  if (lastFocusedTrigger && typeof lastFocusedTrigger.focus === "function") {
    lastFocusedTrigger.focus();
  }
}

function addToCart({ product, weight, grind, quantity }) {
  const price = PRICE_MAP[product]?.[weight];

  if (!price) return;

  const key = getLineItemKey(product, weight, grind);
  const existing = basketState.items.find((item) => item.key === key);

  if (existing) {
    existing.quantity = Math.min(10, existing.quantity + quantity);
  } else {
    basketState.items.push({
      key,
      product,
      weight,
      grind,
      quantity,
      price
    });
  }

  syncCartUI();
}

function removeCartItem(index) {
  basketState.items.splice(index, 1);
  syncCartUI();
}

cartOpenButtons.forEach((button) => {
  button.addEventListener("click", () => {
    if (isCartOpen) {
      closeCart();
    } else {
      openCart(button);
    }
  });
});

if (cartCloseButton) {
  cartCloseButton.addEventListener("click", closeCart);
}

if (cartBackdrop) {
  cartBackdrop.addEventListener("click", closeCart);
}

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && isCartOpen) {
    closeCart();
  }
});

if (basketFulfilment) {
  basketFulfilment.addEventListener("change", () => {
    basketState.fulfilment = basketFulfilment.value;
    updateFulfilmentNote();
  });
}

if (basketLines) {
  basketLines.addEventListener("click", (event) => {
    const removeButton = event.target.closest("[data-remove-line]");
    if (!removeButton) return;

    const index = Number(removeButton.getAttribute("data-remove-line"));
    if (Number.isNaN(index)) return;

    removeCartItem(index);
  });
}

document.querySelectorAll("[data-coffee-form]").forEach((form) => {
  const product = form.dataset.product;
  const weight = form.querySelector('select[name="weight"]');
  const grind = form.querySelector('select[name="grind"]');
  const quantity = form.querySelector('input[name="quantity"]');
  const selectedPrice = form.querySelector("[data-selected-price]");
  const selectionSummary = form.querySelector("[data-selection-summary]");

  function updateCardSummary() {
    const chosenWeight = weight.value;
    const chosenGrind = grind.value;
    const chosenQty = Math.max(1, Math.min(10, Number(quantity.value) || 1));
    quantity.value = chosenQty;

    const unitPrice = PRICE_MAP[product]?.[chosenWeight] || 0;

    if (selectedPrice) {
      selectedPrice.textContent = formatMoney(unitPrice);
    }

    if (selectionSummary) {
      selectionSummary.textContent = `${chosenWeight} · ${prettyGrind(chosenGrind)} · Qty ${chosenQty}`;
    }
  }

  weight?.addEventListener("change", updateCardSummary);
  grind?.addEventListener("change", updateCardSummary);
  quantity?.addEventListener("input", updateCardSummary);

  form.addEventListener("submit", (event) => {
    event.preventDefault();

    const chosenQty = Math.max(1, Math.min(10, Number(quantity.value) || 1));

    addToCart({
      product,
      weight: weight.value,
      grind: grind.value,
      quantity: chosenQty
    });

    openCart(form.querySelector('button[type="submit"]'));
  });

  updateCardSummary();
});

if (basketCheckoutButton) {
  basketCheckoutButton.addEventListener("click", async () => {
    if (!getBasketItemCount()) {
      syncCartUI();
      return;
    }

    basketCheckoutButton.disabled = true;
    basketCheckoutButton.setAttribute("disabled", "");
    basketCheckoutButton.setAttribute("aria-disabled", "true");
    basketCheckoutButton.textContent = "Redirecting...";

    try {
      const response = await fetch("/api/create-checkout-session", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          items: basketState.items.map((item) => ({
            product: item.product,
            weight: item.weight,
            grind: item.grind,
            quantity: item.quantity
          })),
          fulfilment: basketState.fulfilment
        })
      });

      const rawText = await response.text();
      let data = {};

      try {
        data = rawText ? JSON.parse(rawText) : {};
      } catch (parseError) {
        throw new Error(`Invalid response from checkout endpoint: ${rawText || "empty response"}`);
      }

      if (!response.ok || !data.url) {
        throw new Error(data.error || "Unable to create checkout session.");
      }

      window.location.href = data.url;
    } catch (error) {
      syncCartUI();
      window.alert(error.message || "Something went wrong. Please try again.");
    }
  });
}

syncCartUI();

const contactForm = document.getElementById("contact-form");

if (contactForm) {
  const status = document.getElementById("contact-status");
  const submitButton = document.getElementById("contact-submit");

  function getTurnstileToken() {
    return (
      contactForm.querySelector('input[name="cf-turnstile-response"]')?.value?.trim() ||
      document.querySelector('input[name="cf-turnstile-response"]')?.value?.trim() ||
      ""
    );
  }

  contactForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const formData = new FormData(contactForm);
    const payload = {
      name: formData.get("name")?.toString().trim() || "",
      email: formData.get("email")?.toString().trim() || "",
      subject: formData.get("subject")?.toString().trim() || "",
      message: formData.get("message")?.toString().trim() || ""
    };

    const honeypot = formData.get("website")?.toString().trim() || "";
    const turnstileToken = getTurnstileToken();

    if (honeypot) {
      status.textContent = "Submission blocked.";
      return;
    }

    if (!payload.name || !payload.email || !payload.subject || !payload.message) {
      status.textContent = "Please complete all fields.";
      return;
    }

    if (!turnstileToken) {
      status.textContent = "Please complete the spam check.";
      return;
    }

    submitButton.disabled = true;
    submitButton.textContent = "Sending...";
    status.textContent = "";

    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          ...payload,
          website: honeypot,
          turnstileToken
        })
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Unable to send message.");
      }

      contactForm.reset();
      status.textContent = "Thanks — your message has been sent.";

      if (window.turnstile) {
        window.turnstile.reset();
      }
    } catch (error) {
      status.textContent = error.message || "Something went wrong. Please try again.";

      if (window.turnstile) {
        window.turnstile.reset();
      }
    } finally {
      submitButton.disabled = false;
      submitButton.textContent = "Send message";
    }
  });
}