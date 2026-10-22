import { createClient } from 'npm:@supabase/supabase-js@2'

const CONTRACTORS = ['ERKSİS', 'ASTAN', 'ASMİN', 'ERBU', 'AZRAM']
const allowedOrigins = (Deno.env.get('APP_ALLOWED_ORIGINS') || 'http://127.0.0.1:4173,http://localhost:4173,http://127.0.0.1:4174,http://localhost:4174,https://kaydol07.github.io')
  .split(',').map(value => value.trim()).filter(Boolean)

function environmentKey(collectionName: string, singleName: string, legacyName: string): string {
  const collection = Deno.env.get(collectionName)
  if (collection) {
    try {
      const parsed: unknown = JSON.parse(collection)
      if (typeof parsed === 'string' && parsed.trim()) return parsed.trim()
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        const record = parsed as Record<string, unknown>
        const defaultKey = record.default
        if (typeof defaultKey === 'string' && defaultKey.trim()) return defaultKey.trim()
        /* Supabase's current JSON dictionary is keyed by API-key id, so it
           may not have a literal `default` entry. This collection is already
           scoped to one key class, therefore selecting one non-empty value
           cannot mix a publishable key with a secret key. */
        const collectionKey = Object.values(record).find(value => typeof value === 'string' && value.trim())
        if (typeof collectionKey === 'string') return collectionKey.trim()
      }
    } catch {
      // Fall back to an individual key instead of treating malformed JSON as a key.
    }
  }
  return Deno.env.get(singleName)?.trim() || Deno.env.get(legacyName)?.trim() || ''
}

function corsHeaders(origin: string | null) {
  const allowedOrigin = origin && allowedOrigins.includes(origin) ? origin : allowedOrigins[0]
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin'
  }
}

function json(body: unknown, status: number, cors: Record<string, string>) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' } })
}

Deno.serve(async request => {
  const cors = corsHeaders(request.headers.get('Origin'))
  try {
    if (request.method === 'OPTIONS') return new Response('ok', { headers: cors })
    if (request.method !== 'POST') return json({ error: 'POST is required.' }, 405, cors)

  const authorization = request.headers.get('Authorization')
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  /* Support current key collections and older individual key names. The
     current collection gets priority so legacy keys can be retired safely. */
  const publishableKey = environmentKey('SUPABASE_PUBLISHABLE_KEYS', 'SUPABASE_PUBLISHABLE_KEY', 'SUPABASE_ANON_KEY')
  const serviceRoleKey = environmentKey('SUPABASE_SECRET_KEYS', 'SUPABASE_SECRET_KEY', 'SUPABASE_SERVICE_ROLE_KEY')
  if (!authorization || !supabaseUrl || !publishableKey || !serviceRoleKey) return json({ error: 'Kimlik doğrulama yapılandırması eksik.' }, 500, cors)

  const callerClient = createClient(supabaseUrl, publishableKey, {
    global: { headers: { Authorization: authorization } }, auth: { persistSession: false }
  })
  const { data: callerData, error: callerError } = await callerClient.auth.getUser()
  if (callerError || !callerData.user) return json({ error: 'Oturum açılması gerekir.' }, 401, cors)

  const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } })
  const { data: callerProfile, error: profileError } = await admin.from('user_profiles')
    .select('role').eq('user_id', callerData.user.id).maybeSingle()
  if (profileError || String(callerProfile?.role || '').trim().toLowerCase() !== 'beda') return json({ error: 'Bu işlem yalnızca BEDA hesabına açıktır.' }, 403, cors)

  let payload: { contractorCode?: unknown, password?: unknown }
  try { payload = await request.json() } catch { return json({ error: 'Geçersiz istek.' }, 400, cors) }
  const contractorCode = String(payload.contractorCode || '')
  const password = typeof payload.password === 'string' ? payload.password : ''
  if (!CONTRACTORS.includes(contractorCode)) return json({ error: 'Geçerli bir taşeron hesabı seç.' }, 400, cors)
  if (password.length < 8 || password.length > 128) return json({ error: 'Şifre 8–128 karakter olmalıdır.' }, 400, cors)

  const { data: targetProfile, error: targetError } = await admin.from('user_profiles')
    .select('user_id').eq('role', 'contractor').eq('contractor_code', contractorCode).maybeSingle()
  if (targetError || !targetProfile?.user_id) return json({ error: 'Taşeron hesabı bulunamadı.' }, 404, cors)

  const { error: updateError } = await admin.auth.admin.updateUserById(targetProfile.user_id, { password })
  if (updateError) return json({ error: 'Şifre güncellenemedi.' }, 500, cors)
    return json({ ok: true }, 200, cors)
  } catch (error) {
    console.error('manage-contractor-password failed', error)
    return json({ error: 'Şifre servisi geçici olarak yanıt veremedi. Daha sonra yeniden deneyin.' }, 500, cors)
  }
})
