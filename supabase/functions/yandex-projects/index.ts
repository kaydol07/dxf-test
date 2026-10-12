import { createClient } from 'npm:@supabase/supabase-js@2'

const ROOT = 'disk:/PROJELER'
const CONTRACTORS = ['ERKSİS', 'ASTAN', 'ASMİN', 'ERBU', 'AZRAM']
const ALLOWED_EXTENSIONS = ['.dxf', '.dxfproj', '.zip', '.kml', '.kmz']
const VIEWER_EXTENSIONS = ALLOWED_EXTENSIONS
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

function validDiskPath(value: unknown, role: string, contractorCode: string | null): value is string {
  if (typeof value !== 'string' || !value.startsWith(`${ROOT}/`) || value.includes('..')
      || value.includes('\\') || value.length >= 1024) return false
  const parts = value.slice(`${ROOT}/`.length).split('/')
  if (parts.length !== 1 && parts.length !== 2) return false
  const extension = ALLOWED_EXTENSIONS.find(item => value.toLowerCase().endsWith(item))
  if (!extension) return false
  if (role === 'contractor') {
    return Boolean(contractorCode && VIEWER_EXTENSIONS.includes(extension)
      && parts.length === 2 && parts[0] === contractorCode)
  }
  if (!['beda', 'aedas'].includes(role)) return false
  return parts.length === 1 || CONTRACTORS.includes(parts[0])
}

function validUploadPath(value: unknown, role: string): value is string {
  if (role !== 'beda' || typeof value !== 'string' || !value.startsWith(`${ROOT}/`) || value.includes('..') || value.includes('\\') || value.length >= 1024) return false
  const parts = value.slice(`${ROOT}/`.length).split('/')
  return parts.length === 2 && CONTRACTORS.includes(parts[0]) && /\.dxfproj\.zip$/i.test(parts[1])
}

async function diskResource(path: string, headers: HeadersInit) {
  const url = new URL('https://cloud-api.yandex.net/v1/disk/resources')
  url.searchParams.set('path', path)
  url.searchParams.set('limit', '100')
  url.searchParams.set('sort', 'name')
  return fetch(url, { headers })
}

async function createDiskFolder(path: string, headers: HeadersInit) {
  const url = new URL('https://cloud-api.yandex.net/v1/disk/resources')
  url.searchParams.set('path', path)
  return fetch(url, { method: 'PUT', headers })
}

Deno.serve(async request => {
  const cors = corsHeaders(request.headers.get('Origin'))
  if (request.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (request.method !== 'POST') return json({ error: 'POST is required.' }, 405, cors)

  const authorization = request.headers.get('Authorization')
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  let publishableKey = Deno.env.get('SUPABASE_ANON_KEY') || ''
  const publishableKeysJson = Deno.env.get('SUPABASE_PUBLISHABLE_KEYS')
  if (publishableKeysJson) {
    try {
      const keys = JSON.parse(publishableKeysJson)
      publishableKey = keys.default || Object.values(keys)[0] || publishableKey
    } catch {
      return json({ error: 'Supabase publishable key configuration is invalid.' }, 500, cors)
    }
  }
  if (!authorization || !supabaseUrl || !publishableKey) return json({ error: 'Authenticated Supabase setup is missing.' }, 401, cors)

  const supabase = createClient(supabaseUrl, publishableKey, { global: { headers: { Authorization: authorization } }, auth: { persistSession: false } })
  const { data: userData, error: authError } = await supabase.auth.getUser()
  if (authError || !userData.user) return json({ error: 'Sign in is required.' }, 401, cors)

  const { data: profile, error: profileError } = await supabase.from('user_profiles').select('role,contractor_code').eq('user_id', userData.user.id).maybeSingle()
  if (profileError || !profile || !['beda', 'aedas', 'contractor'].includes(profile.role)
      || (profile.role === 'contractor' && !CONTRACTORS.includes(profile.contractor_code))) {
    return json({ error: 'This account has no valid project access profile.' }, 403, cors)
  }

  let payload: { action?: string; path?: string }
  try { payload = await request.json() } catch { return json({ error: 'Invalid JSON body.' }, 400, cors) }
  const yandexToken = Deno.env.get('YANDEX_DISK_OAUTH_TOKEN')
  if (!yandexToken) return json({ error: 'Yandex Disk connection has not been configured.' }, 503, cors)
  const apiHeaders = { Authorization: `OAuth ${yandexToken}` }

  if (payload.action === 'ensure-folders') {
    if (profile.role !== 'beda') return json({ error: 'Only BEDA can prepare contractor folders.' }, 403, cors)
    const root = await diskResource(ROOT, apiHeaders)
    if (root.status === 404) {
      const createdRoot = await createDiskFolder(ROOT, apiHeaders)
      if (!createdRoot.ok && createdRoot.status !== 409) return json({ error: `Yandex Disk could not create ${ROOT} (HTTP ${createdRoot.status}).` }, 502, cors)
    } else if (!root.ok) {
      return json({ error: `Yandex Disk could not read ${ROOT} (HTTP ${root.status}).` }, 502, cors)
    } else {
      const rootMetadata = await root.json()
      if (rootMetadata.type !== 'dir') return json({ error: `${ROOT} exists in Yandex Disk but is not a folder.` }, 409, cors)
    }
    const folders = []
    for (const code of CONTRACTORS) {
      const path = `${ROOT}/${code}`
      const existing = await diskResource(path, apiHeaders)
      if (existing.ok) {
        const metadata = await existing.json()
        if (metadata.type !== 'dir') return json({ error: `${code} exists in Yandex Disk but is not a folder.` }, 409, cors)
        folders.push({ code, exists: true })
        continue
      }
      if (existing.status !== 404) return json({ error: `Could not check the ${code} folder (HTTP ${existing.status}).` }, 502, cors)
      const created = await createDiskFolder(path, apiHeaders)
      if (!created.ok && created.status !== 409) return json({ error: `Could not create the ${code} folder (HTTP ${created.status}).` }, 502, cors)
      folders.push({ code, created: true })
    }
    return json({ folder: ROOT, folders }, 200, cors)
  }

  if (payload.action === 'list') {
    const folderPaths = profile.role === 'contractor'
      ? [`${ROOT}/${profile.contractor_code}`]
      : [ROOT, ...CONTRACTORS.map(code => `${ROOT}/${code}`)]
    const files = []
    for (const folder of folderPaths) {
      const upstream = await diskResource(folder, apiHeaders)
      if (upstream.status === 404 && folder !== ROOT) continue
      if (!upstream.ok) return json({ error: `Yandex Disk could not read ${folder} (HTTP ${upstream.status}).` }, 502, cors)
      const listing = await upstream.json()
      const contractorCode = folder === ROOT ? null : folder.slice(`${ROOT}/`.length)
      for (const item of listing?._embedded?.items || []) {
        const name = String(item.name || '')
        const extension = ALLOWED_EXTENSIONS.find(value => name.toLowerCase().endsWith(value))
        if (item.type !== 'file' || !extension) continue
        if (profile.role !== 'beda' && !VIEWER_EXTENSIONS.includes(extension)) continue
        files.push({ name, path: item.path, size: item.size || 0, modified: item.modified || null,
          mimeType: item.mime_type || 'application/octet-stream', contractorCode })
      }
    }
    return json({ folder: profile.role === 'contractor' ? `${ROOT}/${profile.contractor_code}` : ROOT, files }, 200, cors)
  }

  if (payload.action === 'create-upload') {
    if (!validUploadPath(payload.path, profile.role)) return json({ error: 'Only BEDA can save project packages to a contractor folder.' }, 403, cors)
    const uploadUrl = new URL('https://cloud-api.yandex.net/v1/disk/resources/upload')
    uploadUrl.searchParams.set('path', payload.path)
    uploadUrl.searchParams.set('overwrite', 'true')
    const upstream = await fetch(uploadUrl, { headers: apiHeaders })
    if (!upstream.ok) return json({ error: `Yandex Disk could not prepare package upload (HTTP ${upstream.status}).` }, 502, cors)
    const body = await upstream.json()
    if (typeof body?.href !== 'string' || !body.href.startsWith('https://')) return json({ error: 'Yandex Disk returned an invalid upload URL.' }, 502, cors)
    return json({ href: body.href, path: payload.path }, 200, cors)
  }

  if (payload.action === 'download') {
    if (!validDiskPath(payload.path, profile.role, profile.contractor_code)) return json({ error: 'This account cannot download that file or folder path.' }, 403, cors)
    const linkUrl = new URL('https://cloud-api.yandex.net/v1/disk/resources/download')
    linkUrl.searchParams.set('path', payload.path)
    const linkResponse = await fetch(linkUrl, { headers: apiHeaders })
    if (!linkResponse.ok) return json({ error: `Yandex Disk could not prepare the file (HTTP ${linkResponse.status}).` }, 502, cors)
    const { href } = await linkResponse.json()
    if (typeof href !== 'string' || !href.startsWith('https://')) return json({ error: 'Yandex Disk returned an invalid download URL.' }, 502, cors)
    const fileResponse = await fetch(href)
    if (!fileResponse.ok || !fileResponse.body) return json({ error: `Project file download failed (HTTP ${fileResponse.status}).` }, 502, cors)
    // Return concrete bytes instead of a remote ReadableStream. The hosted function
    // gateway can terminate a chained upstream stream before browser CORS headers
    // are written, which surfaces in the app as a generic "Failed to fetch".
    const fileBytes = await fileResponse.arrayBuffer()
    const name = payload.path.split('/').at(-1) || 'project-file'
    return new Response(fileBytes, {
      status: 200,
      headers: {
        ...cors,
        'Content-Type': 'application/octet-stream',
        'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(name)}`,
        'Cache-Control': 'no-store'
      }
    })
  }

  return json({ error: 'Action must be list, download, create-upload, or ensure-folders.' }, 400, cors)
})
