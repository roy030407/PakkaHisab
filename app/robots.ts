/**
 * FILE: app/robots.ts
 *
 * WHAT THIS DOES:
 *   Generates robots.txt for search engine crawlers.
 *   Allows indexing of public pages, blocks dashboard and API routes.
 *
 * CHANGES THIS SESSION:
 *   - Initial creation for production readiness
 *
 * WHERE IT FITS:
 *   Auto-served by Next.js at /robots.txt
 *
 * CALLED BY / IMPORTS FROM:
 *   Search engine crawlers
 */

import type { MetadataRoute } from "next"

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://pakkahisab.com"

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/privacy", "/terms", "/login", "/signup"],
        disallow: ["/dashboard", "/api/", "/scan", "/entry", "/inventory",
                   "/products", "/customers", "/reports", "/advisor",
                   "/settings", "/voice", "/reconcile", "/ledger"],
      },
    ],
    sitemap: `${BASE_URL}/sitemap.xml`,
  }
}
