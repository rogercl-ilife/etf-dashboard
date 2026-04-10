declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void
  }
}

export function trackPageView(url: string) {
  if (typeof window === 'undefined' || typeof window.gtag !== 'function') return
  window.gtag('event', 'page_view', {
    page_path: url,
  })
}

export function trackEvent(eventName: string, params?: Record<string, unknown>) {
  if (typeof window === 'undefined' || typeof window.gtag !== 'function') return
  window.gtag('event', eventName, params || {})
}

export {}
