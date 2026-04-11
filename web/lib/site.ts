const FALLBACK_SITE_URL = 'http://localhost:3000'

function normalizeSiteUrl(value?: string | null) {
  if (!value) return FALLBACK_SITE_URL

  const trimmed = value.trim()
  if (!trimmed) return FALLBACK_SITE_URL

  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`

  try {
    const url = new URL(withProtocol)
    return url.origin
  } catch {
    return FALLBACK_SITE_URL
  }
}

export function getSiteUrl() {
  return normalizeSiteUrl(process.env.NEXT_PUBLIC_SITE_URL)
}
