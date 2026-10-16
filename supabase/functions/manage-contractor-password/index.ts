import { createClient } from 'npm:@supabase/supabase-js@2'

const CONTRACTORS = ['ERKSİS', 'ASTAN', 'ASMİN', 'ERBU', 'AZRAM']
const allowedOrigins = (Deno.env.get('APP_ALLOWED_ORIGINS') || 'http://127.0.0.1:4173,http://localhost:4173,http://127.0.0.1:4174,http://localhost:4174,https://kaydol07.github.io')
  .split(',').map(value => value.trim()).filter(Boolean)

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
  /* Older Supabase projects expose SUPABASE_ANON_KEY, newer projects expose
     a publishable key. Accept either so the authenticated caller lookup does
     not fail after a project-key migration. */
  const publishableKey = Deno.env.get('SUPABASE_ANON_KEY') || Deno.env.get('SUPABASE_PUBLISHABLE_KEY')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!authorization || !supabaseUrl || !publishableKey || !serviceRoleKey) return json({ error: 'Kimlik doğrulama yapılandırması eksik.' }, 500, cors)

  const callerClient = createClient(supabaseUrl, publishableKey, {
    global: { headers: { Authorization: authorization } }, auth: { persistSession: false }
  })
  const { data: callerData, error: callerError } = await callerClient.auth.getUser()
  if (callerError || !callerData.user) return json({ error: 'Oturum açılması gerekir.' }, 401, cors)

  const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } })
  const { data: callerProfile, error: profileError } = await admin.from('user_profiles')
    .select('role').eq('user_id', callerData.user.id).maybeSingle()
  if (profileError || callerProfile?.role !== 'beda') return json({ error: 'Bu işlem yalnızca BEDA hesabına açıktır.' }, 403, cors)

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
