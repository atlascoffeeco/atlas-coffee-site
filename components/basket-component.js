// Shared Atlas basket markup.
// Every page uses this one component instead of duplicating the drawer HTML.

window.AtlasBasket = {
  mount() {
    const mountPoint = document.querySelector("[data-basket-mount]");

    if (!mountPoint) return;

    // Prevent accidental duplicate rendering.
    if (mountPoint.dataset.basketMounted === "true") return;

    mountPoint.dataset.basketMounted = "true";

    mountPoint.innerHTML = `
      <!-- Shared basket drawer -->
      <div
        class="shop-basket-popover"
        id="basket-popover"
        aria-hidden="true"
      >
        <!--
          Desktop: clicking the backdrop closes the drawer.
          Mobile: app.js minimises a populated basket.
        -->
        <button
          class="shop-basket-popover__backdrop"
          type="button"
          tabindex="-1"
          aria-label="Close basket"
        ></button>

        <aside
          class="shop-basket-drawer"
          role="dialog"
          aria-modal="true"
          aria-labelledby="basket-title"
        >
          <!-- Drawer header and mobile drag region -->
          <div class="shop-basket-drawer__header">
            <button
              class="shop-basket-drawer__handle"
              type="button"
              data-basket-handle
              aria-label="Minimise basket"
            >
              <span aria-hidden="true"></span>
            </button>

            <div class="shop-basket-drawer__heading">
              <span class="eyebrow">Basket</span>
              <h2 id="basket-title">Your selected coffees.</h2>
            </div>

            <button
              class="shop-basket-drawer__close"
              type="button"
              data-basket-close
              aria-label="Close basket"
            >
              Close
            </button>
          </div>

          <!-- Products are rendered here by app.js -->
          <div class="shop-basket-drawer__body">
            <div
              id="basket-items"
              class="shop-basket-list"
              aria-live="polite"
              aria-relevant="additions removals"
            >
              <p class="shop-basket-empty">
                Your basket is currently empty.
              </p>
            </div>
          </div>

          <!-- Fulfilment and checkout controls -->
          <div class="shop-basket-drawer__footer">
            <div
              class="shop-basket-fulfilment"
              aria-labelledby="basket-fulfilment-label"
            >
              <span
                class="shop-basket-total-label"
                id="basket-fulfilment-label"
              >
                Fulfilment
              </span>

              <div
                class="shop-basket-fulfilment__options"
                role="radiogroup"
                aria-label="Choose fulfilment"
              >
                <label class="shop-basket-fulfilment__option">
                  <input
                    type="radio"
                    name="basket-fulfilment"
                    id="basket-fulfilment-delivery"
                    value="delivery"
                    checked
                  >

                  <span>
                    <strong>Delivery</strong>
                    <small>Shipping is added at checkout.</small>
                  </span>
                </label>

                <label class="shop-basket-fulfilment__option">
                  <input
                    type="radio"
                    name="basket-fulfilment"
                    id="basket-fulfilment-collection"
                    value="collection"
                  >

                  <span>
                    <strong>Local collection</strong>
                    <small>
                      Free collection in Redditch. We’ll contact you after payment.
                    </small>
                  </span>
                </label>
              </div>

              <p
                class="shop-basket-note"
                id="basket-fulfilment-note"
              >
                Delivery is calculated at checkout. Switch to local collection
                to skip the delivery charge.
              </p>
            </div>

            <div class="shop-basket-total">
              <span class="shop-basket-total-label">
                Estimated total
              </span>

              <strong id="basket-total">
                £0.00
              </strong>
            </div>

            <button
              class="button shop-basket-checkout"
              type="button"
              id="checkout-button"
            >
              Proceed to checkout
            </button>

            <p
              class="shop-basket-note"
              id="basket-checkout-note"
            >
              Checkout is handled securely. Your fulfilment choice will be
              included with the order.
            </p>
          </div>
        </aside>
      </div>

      <!-- Shared collapsed mobile basket bar -->
      <div
        class="mobile-buy-bar"
        aria-hidden="true"
        hidden
      >
        <div class="container mobile-buy-bar__inner">
          <div class="mobile-buy-bar__meta">
            <strong>Your basket</strong>

            <span
              id="mobile-basket-summary"
              aria-live="polite"
            >
              No items selected yet
            </span>
          </div>

          <button
            class="button mobile-buy-bar__button"
            type="button"
            id="mobile-basket-bar-toggle"
            aria-controls="basket-popover"
            aria-label="View your basket"
          >
            View basket
          </button>
        </div>
      </div>
    `;
  }
};