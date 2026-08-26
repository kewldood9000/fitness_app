let cachedToken
let tokenExpiresAt = 0

function json(body, status, origin) {
  const headers = {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store',
    Vary: 'Origin'
  }
  if (origin) headers['Access-Control-Allow-Origin'] = origin
  return new Response(JSON.stringify(body), { status, headers })
}

function allowedOrigin(request, env) {
  const origin = request.headers.get('Origin') || ''
  const allowed = String(env.ALLOWED_ORIGINS || '').split(',').map((item) => item.trim()).filter(Boolean)
  return allowed.includes(origin) ? origin : undefined
}

async function accessToken(env) {
  if (cachedToken && Date.now() < tokenExpiresAt) return cachedToken
  const authorization = btoa(`${env.FATSECRET_CLIENT_ID}:${env.FATSECRET_CLIENT_SECRET}`)
  const response = await fetch('https://oauth.fatsecret.com/connect/token', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${authorization}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: new URLSearchParams({ grant_type: 'client_credentials', scope: 'barcode' })
  })
  if (!response.ok) throw new Error(`FatSecret token request failed (${response.status}).`)
  const payload = await response.json()
  if (!payload.access_token) throw new Error('FatSecret did not return an access token.')
  cachedToken = payload.access_token
  tokenExpiresAt = Date.now() + Math.max(60, Number(payload.expires_in || 3600) - 60) * 1000
  return cachedToken
}

export default {
  async fetch(request, env) {
    const origin = allowedOrigin(request, env)
    if (request.method === 'OPTIONS') {
      if (!origin) return json({ error: 'Origin not allowed.' }, 403)
      return new Response(null, { status: 204, headers: { 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Methods': 'GET, OPTIONS', 'Access-Control-Allow-Headers': 'Accept', 'Access-Control-Max-Age': '86400', Vary: 'Origin' } })
    }
    if (request.method !== 'GET') return json({ error: 'Method not allowed.' }, 405, origin)
    if (!origin) return json({ error: 'Origin not allowed.' }, 403)
    if (!env.FATSECRET_CLIENT_ID || !env.FATSECRET_CLIENT_SECRET) return json({ error: 'FatSecret credentials are not configured.' }, 503, origin)

    const barcode = new URL(request.url).searchParams.get('barcode')?.replace(/\D/g, '') || ''
    if (!/^\d{13}$/.test(barcode)) return json({ error: 'barcode must be a 13-digit GTIN.' }, 400, origin)

    try {
      const token = await accessToken(env)
      const url = new URL('https://platform.fatsecret.com/rest/food/barcode/find-by-id/v2')
      url.searchParams.set('barcode', barcode)
      url.searchParams.set('format', 'json')
      url.searchParams.set('region', env.FATSECRET_REGION || 'US')
      url.searchParams.set('language', env.FATSECRET_LANGUAGE || 'en')
      url.searchParams.set('flag_default_serving', 'true')
      const response = await fetch(url, { headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' } })
      const body = await response.text()
      return new Response(body, { status: response.status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'Access-Control-Allow-Origin': origin, Vary: 'Origin' } })
    } catch (error) {
      return json({ error: error instanceof Error ? error.message : 'FatSecret proxy failed.' }, 502, origin)
    }
  }
}
