// Thin wrapper around GA4's gtag.js. Every export is a safe no-op when
// VITE_GA_MEASUREMENT_ID isn't set (local dev, or before it's configured in
// production), so nothing here needs a feature flag anywhere else.
const GA_ID = import.meta.env.VITE_GA_MEASUREMENT_ID

let loaded = false

function ensureLoaded() {
  if (loaded || !GA_ID) return
  loaded = true

  const script = document.createElement('script')
  script.async = true
  script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_ID}`
  document.head.appendChild(script)

  window.dataLayer = window.dataLayer || []
  window.gtag = function gtag() { window.dataLayer.push(arguments) }
  window.gtag('js', new Date())
  // We fire page_view ourselves on route changes (this is a client-routed
  // SPA), so the automatic one on load would double-count the first page.
  window.gtag('config', GA_ID, { send_page_view: false })
}

export function trackPageView(path) {
  if (!GA_ID) return
  ensureLoaded()
  window.gtag('event', 'page_view', { page_path: path })
}

// Ties later events to a stable per-account id (GA4's User-ID feature) so
// "new users" reflects distinct accounts rather than distinct browsers.
// Only ever an opaque internal id - never email/name.
export function identifyUser(userId) {
  if (!GA_ID) return
  ensureLoaded()
  window.gtag('set', { user_id: String(userId) })
}

export function trackAuthEvent(isNewUser) {
  if (!GA_ID) return
  ensureLoaded()
  window.gtag('event', isNewUser ? 'sign_up' : 'login', { method: 'google' })
}

export function clearUser() {
  if (!GA_ID) return
  ensureLoaded()
  window.gtag('set', { user_id: null })
}
