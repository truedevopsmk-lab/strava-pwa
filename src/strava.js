export const STRAVA_CLIENT_ID = import.meta.env.VITE_STRAVA_CLIENT_ID || 'YOUR_CLIENT_ID'
const REDIRECT_URI = `${window.location.origin}${import.meta.env.BASE_URL}`
const SCOPES = 'activity:read_all'

function base64url(buffer) {
  return btoa(String.fromCharCode(...new Uint8Array(buffer)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}
async function generatePKCE() {
  const verifier = base64url(crypto.getRandomValues(new Uint8Array(32)))
  const hashed = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))
  return { verifier, challenge: base64url(hashed) }
}
export async function initiateAuth() {
  const { verifier, challenge } = await generatePKCE()
  sessionStorage.setItem('pkce_verifier', verifier)
  const params = new URLSearchParams({
    client_id: STRAVA_CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    response_type: 'code',
    approval_prompt: 'auto',
    scope: SCOPES,
    code_challenge: challenge,
    code_challenge_method: 'S256',
  })
  window.location.href = `https://www.strava.com/oauth/authorize?${params}`
}
export async function exchangeCode(code) {
  const res = await fetch('https://www.strava.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: STRAVA_CLIENT_ID,
      client_secret: import.meta.env.VITE_STRAVA_CLIENT_SECRET || '',
      code,
      grant_type: 'authorization_code',
      redirect_uri: REDIRECT_URI,
    })
  })
  if (!res.ok) throw new Error('Token exchange failed')
  const data = await res.json()
  saveTokens(data)
  return data
}
export async function refreshToken() {
  const tokens = getTokens()
  if (!tokens?.refresh_token) return null
  const res = await fetch('https://www.strava.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: STRAVA_CLIENT_ID,
      client_secret: import.meta.env.VITE_STRAVA_CLIENT_SECRET || '',
      refresh_token: tokens.refresh_token,
      grant_type: 'refresh_token',
    })
  })
  if (!res.ok) return null
  const data = await res.json()
  saveTokens({ ...tokens, ...data })
  return data
}
export function saveTokens(data) {
  localStorage.setItem('strava_tokens', JSON.stringify({
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_at: data.expires_at,
    athlete: data.athlete,
  }))
}
export function getTokens() {
  try { return JSON.parse(localStorage.getItem('strava_tokens')) } catch { return null }
}
export function clearTokens() { localStorage.removeItem('strava_tokens') }
export async function getValidToken() {
  let tokens = getTokens()
  if (!tokens) return null
  if (Date.now() / 1000 > tokens.expires_at - 60) {
    const refreshed = await refreshToken()
    if (!refreshed) { clearTokens(); return null }
    tokens = getTokens()
  }
  return tokens?.access_token
}
async function stravaFetch(path, params = {}) {
  const token = await getValidToken()
  if (!token) throw new Error('Not authenticated')
  const url = new URL(`https://www.strava.com/api/v3${path}`)
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v))
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
  if (!res.ok) throw new Error(`Strava API error: ${res.status}`)
  return res.json()
}
export async function fetchAthlete() { return stravaFetch('/athlete') }
export async function fetchStats(athleteId) { return stravaFetch(`/athletes/${athleteId}/stats`) }
export async function fetchAllActivities(onProgress, afterTimestamp = 0) {
  const all = []
  let page = 1
  while (true) {
    const batch = await stravaFetch('/athlete/activities', { per_page: 200, page, after: afterTimestamp })
    if (!batch.length) break
    all.push(...batch)
    onProgress?.(all.length)
    if (batch.length < 200) break
    page++
  }
  return all
}
