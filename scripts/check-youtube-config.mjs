import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const inheritedEnvKeys = new Set(Object.keys(process.env))

function readEnvFile(fileName, override = false) {
  const filePath = path.join(root, fileName)
  if (!fs.existsSync(filePath)) return
  for (const line of fs.readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    const match = line.trim().match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/)
    if (!match) continue
    const [, key, rawValue] = match
    if (inheritedEnvKeys.has(key)) continue
    if (!override && process.env[key]) continue
    process.env[key] = rawValue.replace(/^['"]|['"]$/g, '').trim()
  }
}

readEnvFile('.env')
readEnvFile(`.env.${process.env.NODE_ENV || 'development'}`, true)
readEnvFile('.env.local', true)
readEnvFile(`.env.${process.env.NODE_ENV || 'development'}.local`, true)

function sanitize(message) {
  return String(message || '')
    .replace(/AIza[0-9A-Za-z_-]+/g, '[redacted_api_key]')
    .replace(/([?&]key=)[^&\s]+/g, '$1[redacted]')
}

function reasonFrom(payload) {
  return payload?.error?.errors?.find?.(item => typeof item?.reason === 'string')?.reason
    || payload?.error?.details?.find?.(item => item?.reason || item?.metadata?.reason)?.reason
    || payload?.error?.status
    || null
}

function projectNumberFrom(payload) {
  const match = JSON.stringify(payload || {}).match(/(?:consumer(?:\\?"|\s|:)+projects?\/|projects\/)(\d{4,})/i)
  return match?.[1] || null
}

function output(value, failure = false) {
  const writer = failure ? console.error : console.log
  writer(JSON.stringify(value, null, 2))
  if (failure) process.exitCode = 1
}

const apiKey = process.env.YOUTUBE_API_KEY?.trim()
if (!apiKey || !/^AIza[0-9A-Za-z_-]{20,}$/.test(apiKey)) {
  output({
    success: false,
    endpoint: 'videos.list',
    status: null,
    reason: apiKey ? 'keyInvalid' : 'keyMissing',
    message: 'YOUTUBE_API_KEY est absente ou manifestement invalide.',
    consumerProjectNumber: null,
    requestId: null,
  }, true)
  process.exit()
}

const endpoint = 'https://www.googleapis.com/youtube/v3/videos'
const url = new URL(endpoint)
url.searchParams.set('part', 'id')
url.searchParams.set('id', 'dQw4w9WgXcQ')
url.searchParams.set('fields', 'items/id,error')
url.searchParams.set('key', apiKey)

try {
  const response = await fetch(url, { signal: AbortSignal.timeout(12000) })
  const payload = await response.json().catch(() => ({}))
  const consumerProjectNumber = projectNumberFrom(payload)
  const expected = process.env.YOUTUBE_EXPECTED_PROJECT_NUMBER?.trim()
  const requestId = response.headers.get('x-request-id') || response.headers.get('x-guploader-uploadid')
  const result = {
    success: response.ok && !payload.error,
    endpoint: 'videos.list',
    status: response.status,
    reason: reasonFrom(payload),
    message: sanitize(payload?.error?.message || (response.ok ? 'Configuration YouTube valide.' : 'Diagnostic YouTube en echec.')),
    consumerProjectNumber,
    expectedProjectMatches: expected && consumerProjectNumber ? expected === consumerProjectNumber : null,
    requestId,
    projectIdentityNote: consumerProjectNumber
      ? 'Comparez ce numero au numero du projet Google Cloud attendu.'
      : "Google ne fournit generalement pas l'identite du projet lors d'un appel reussi.",
  }
  output(result, !result.success)
} catch (error) {
  output({
    success: false,
    endpoint: 'videos.list',
    status: null,
    reason: error instanceof Error && error.name === 'TimeoutError' ? 'timeout' : 'networkError',
    message: sanitize(error instanceof Error ? error.message : 'Diagnostic YouTube impossible.'),
    consumerProjectNumber: null,
    requestId: null,
  }, true)
}
