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
 *   - scanLimiter:  10 req / 60s per user - bill scanning is expensive (Vision API)
 *   - aiLimiter:    20 req / 60s per user - AI chat + insights
 *
 * CHANGES THIS SESSION:
 *   - Initial creation for Phase 7 security
 *   - Fix: replace boolean flag with Promise singleton to prevent concurrent cold-start race
 *
 * WHERE IT FITS:
 *   Imported by /api/scan and /api/ai/* routes.
 *
 * CALLED BY / IMPORTS FROM:
 *   app/api/scan/route.ts, app/api/ai/chat/route.ts, app/api/ai/insight/route.ts
 */

// Dynamic imports to avoid build-time errors when packages are not installed
type LimitResult = { success: boolean; limit?: number; remaining?: number }

type Limiters = {
  scan: (id: string) => Promise<LimitResult>
  ai:   (id: string) => Promise<LimitResult>
} | null

// Promise singleton - concurrent callers all await the same init, preventing
// the race where _initialized=true but limiters are still null.
let _initPromise: Promise<Limiters> | null = null

function createLimiters(): Promise<Limiters> {
  const url   = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) return Promise.resolve(null)

  return (async () => {
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

      return {
        scan: (id) => scanRL.limit(id),
        ai:   (id) => aiRL.limit(id),
      }
    } catch {
      // Redis unavailable - fall through to no-op fallback
      return null
    }
  })()
}

function getLimiters(): Promise<Limiters> {
  if (!_initPromise) _initPromise = createLimiters()
  return _initPromise
}

export async function scanRateLimit(userId: string): Promise<LimitResult> {
  const limiters = await getLimiters()
  if (!limiters) return { success: true }
  return limiters.scan(userId)
}

export async function aiRateLimit(userId: string): Promise<LimitResult> {
  const limiters = await getLimiters()
  if (!limiters) return { success: true }
  return limiters.ai(userId)
}
