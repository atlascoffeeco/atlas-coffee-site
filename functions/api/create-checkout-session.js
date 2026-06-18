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

const coffeeForm = document.getElementById("coffee-form");

if (coffeeForm) {
  const PRICE_MAP = {
    "250g": { amount: 10.95 },
    "500g": { amount: 19.5 },
    "1kg": { amount: 35.95 }
  };

  const DELIVERY_FEE = 4.50;

  const weight = document.getElementById("weight");
  const grind = document.getElementById("grind");
  const fulfilment = document.getElementById("fulfilment");
  const quantity = document.getElementById("quantity");
  const subtotal = document.getElementById("serra-total");
  const summary = document.getElementById("serra-summary");
  const priceDisplay = document.getElementById("serra-price-display");
  const fulfilmentNote = document.getElementById("serra-fulfilment-note");
  const buyButton = document.getElementById("buy-button");
  const message = document.getElementById("purchase-message");

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

  function updateCoffeeSummary() {
    const chosenWeight = weight.value;
    const chosenQty = Math.max(1, Math.min(10, Number(quantity.value) || 1));
    quantity.value = chosenQty;

    const unitPrice = PRICE_MAP[chosenWeight].amount;
    const orderSubtotal = unitPrice * chosenQty;

    priceDisplay.textContent = formatMoney(unitPrice);
    subtotal.textContent = `Subtotal: ${formatMoney(orderSubtotal)}`;
    summary.textContent = `${chosenWeight} · ${prettyGrind(grind.value)} · ${prettyFulfilment(fulfilment.value)} · Qty ${chosenQty}`;

    if (fulfilment.value === "delivery") {
      fulfilmentNote.textContent = `Delivery: ${formatMoney(DELIVERY_FEE)} postage and packaging added securely at checkout.`;
    } else {
      fulfilmentNote.textContent =
        "Collection: free from Church Hill North, Redditch. Collection details will be shared after payment.";
    }
  }

  weight.addEventListener("change", updateCoffeeSummary);
  grind.addEventListener("change", updateCoffeeSummary);
  fulfilment.addEventListener("change", updateCoffeeSummary);
  quantity.addEventListener("input", updateCoffeeSummary);

  coffeeForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const chosenQty = Math.max(1, Math.min(10, Number(quantity.value) || 1));

    buyButton.disabled = true;
    buyButton.textContent = "Redirecting...";
    message.style.display = "none";
    message.textContent = "";

    try {
      const response = await fetch("/api/create-checkout-session", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          product: "Serra Negra",
          weight: weight.value,
          grind: grind.value,
          fulfilment: fulfilment.value,
          quantity: chosenQty
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
      message.textContent = error.message || "Something went wrong. Please try again.";
      message.style.display = "block";
      buyButton.disabled = false;
      buyButton.textContent = "Buy Serra Negra";
    }
  });

  updateCoffeeSummary();
}

const contactForm = document.getElementById("contact-form");

if (contactForm) {
  const status = document.getElementById("contact-status");
  const submitButton = document.getElementById("contact-submit");

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
    const turnstileToken = formData.get("cf-turnstile-response")?.toString().trim() || "";

    if (honeypot) {
      status.textContent = "Submission blocked.";
      return;
    }

    if (!payload.name || !payload.email || !payload.subject || !payload.message) {
      status.textContent = "Please complete all fields.";
      return;
    }

    if (!turnstileToken) {
      status.textContent = "Please complete the spam check first.";
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