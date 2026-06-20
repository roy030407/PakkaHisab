/**
 * FILE: app/api/health/route.ts
 *
 * WHAT THIS DOES:
 *   Health check endpoint for uptime monitoring services.
 *   Returns 200 OK with a timestamp. No auth required.
 *
 * CHANGES THIS SESSION:
 *   - Initial creation for production readiness
 *
 * WHERE IT FITS:
 *   Pinged by external uptime monitors (BetterStack, UptimeRobot, etc.)
 *
 * CALLED BY / IMPORTS FROM:
 *   External monitoring service
 */

export async function GET() {
  return Response.json({ status: "ok", timestamp: new Date().toISOString() })
}
