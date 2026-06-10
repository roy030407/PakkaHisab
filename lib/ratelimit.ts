/**
 * FILE: lib/ratelimit.ts
 *
 * WHAT THIS DOES:
 *   Rate limiting helper with graceful fallback. Uses @upstash/ratelimit +
 *   @upstash/redis when UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN
 *   are configured; otherwise returns { success: true } so local dev and
 *   deployments without Redis are unaffected.
 *
 *   Two limiters:
 *   - scanLimiter:  10 req / 60s per user — bill scanning is expensive (Vision API)
 *   - aiLimiter:    20 req / 60s per user — AI chat + insights
 *
 * CHANGES THIS SESSION:
 *   - Initial creation for Phase 7 security
 *
 * WHERE IT FITS:
 *   Imported by /api/scan and /api/ai/* routes.
 *
 * CALLED BY / IMPORTS FROM:
 *   app/api/scan/route.ts, app/api/ai/chat/route.ts, app/api/ai/insight/route.ts
 */

// Dynamic imports to avoid build-time errors when packages are not installed
type LimitResult = { success: boolean; limit?: number; remaining?: number }

let _scanLimiter: ((id: string) => Promise<LimitResult>) | null = null
let _aiLimiter:   ((id: string) => Promise<LimitResult>) | null = null
let _initialized = false

async function init() {
  if (_initialized) return
  _initialized = true

  const url   = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) return  // graceful no-op in dev / un-configured envs

  try {
    const { Ratelimit } = await import('@upstash/ratelimit')
    const { Redis }     = await import('@upstash/redis')

    const redis = new Redis({ url, token })

    const scanRL = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(10, '60 s'),
      analytics: false,
      prefix: 'pakkahisab:scan',
    })
    const aiRL = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(20, '60 s'),
      analytics: false,
      prefix: 'pakkahisab:ai',
    })

    _scanLimiter = (id) => scanRL.limit(id)
    _aiLimiter   = (id) => aiRL.limit(id)
  } catch {
    // Redis unavailable — fall through to no-op fallback
  }
}

export async function scanRateLimit(userId: string): Promise<LimitResult> {
  await init()
  if (!_scanLimiter) return { success: true }
  return _scanLimiter(userId)
}

export async function aiRateLimit(userId: string): Promise<LimitResult> {
  await init()
  if (!_aiLimiter) return { success: true }
  return _aiLimiter(userId)
}
