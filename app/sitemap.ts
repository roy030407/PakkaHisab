/**
 * FILE: app/sitemap.ts
 *
 * WHAT THIS DOES:
 *   Generates sitemap.xml for search engine indexing.
 *   Only includes public pages (landing, privacy, terms).
 *   Dashboard pages are behind auth and excluded.
 *
 * CHANGES THIS SESSION:
 *   - Initial creation for production readiness
 *
 * WHERE IT FITS:
 *   Auto-served by Next.js at /sitemap.xml
 *
 * CALLED BY / IMPORTS FROM:
 *   Search engine crawlers
 */

import type { MetadataRoute } from "next"

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://pakkahisab.com"

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: BASE_URL,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 1,
    },
    {
      url: `${BASE_URL}/privacy`,
      lastModified: new Date("2026-06-14"),
      changeFrequency: "yearly",
      priority: 0.3,
    },
    {
      url: `${BASE_URL}/terms`,
      lastModified: new Date("2026-06-20"),
      changeFrequency: "yearly",
      priority: 0.3,
    },
    {
      url: `${BASE_URL}/login`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.5,
    },
    {
      url: `${BASE_URL}/signup`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.7,
    },
  ]
}
