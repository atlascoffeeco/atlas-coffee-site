import { onRequestPost as __api_contact_js_onRequestPost } from "/Users/ash/Desktop/atlas-coffee/functions/api/contact.js"
import { onRequest as __api_create_checkout_session_js_onRequest } from "/Users/ash/Desktop/atlas-coffee/functions/api/create-checkout-session.js"
import { onRequest as __api_create_checkout_session_old_js_onRequest } from "/Users/ash/Desktop/atlas-coffee/functions/api/create-checkout-session-old.js"
import { onRequest as __api_get_checkout_session_js_onRequest } from "/Users/ash/Desktop/atlas-coffee/functions/api/get-checkout-session.js"

export const routes = [
    {
      routePath: "/api/contact",
      mountPath: "/api",
      method: "POST",
      middlewares: [],
      modules: [__api_contact_js_onRequestPost],
    },
  {
      routePath: "/api/create-checkout-session",
      mountPath: "/api",
      method: "",
      middlewares: [],
      modules: [__api_create_checkout_session_js_onRequest],
    },
  {
      routePath: "/api/create-checkout-session-old",
      mountPath: "/api",
      method: "",
      middlewares: [],
      modules: [__api_create_checkout_session_old_js_onRequest],
    },
  {
      routePath: "/api/get-checkout-session",
      mountPath: "/api",
      method: "",
      middlewares: [],
      modules: [__api_get_checkout_session_js_onRequest],
    },
  ]