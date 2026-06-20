/**
 * FILE: app/layout.tsx
 *
 * WHAT THIS DOES:
 *   Root Next.js layout - sets HTML metadata, global fonts, and mounts
 *   the Sonner toast provider used across all pages.
 *
 * CHANGES THIS SESSION:
 *   - Updated title/description to PakkaHisab branding
 *   - Added Sonner Toaster for toast notifications
 *
 * WHERE IT FITS:
 *   Wraps every page in the application.
 *
 * CALLED BY / IMPORTS FROM:
 *   Next.js App Router (auto-applied)
 */

import type { Metadata } from "next";
import Script from "next/script";
import { Inter } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const umamiWebsiteId = process.env.NEXT_PUBLIC_UMAMI_WEBSITE_ID;

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || "https://pakkahisab.com"),
  title: {
    default: "PakkaHisab - Your AI CFO",
    template: "%s - PakkaHisab",
  },
  description: "Scan bills, track inventory, manage udhaar, understand profit. AI-powered business management for Indian SME owners.",
  openGraph: {
    title: "PakkaHisab - Your AI CFO",
    description: "Scan bills, track inventory, manage udhaar, understand profit. Built for Bharat ke dukandaar.",
    siteName: "PakkaHisab",
    locale: "en_IN",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "PakkaHisab - Your AI CFO",
    description: "Scan bills, track inventory, manage udhaar, understand profit. Built for Bharat ke dukandaar.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        {umamiWebsiteId && (
          <Script
            defer
            src="https://cloud.umami.is/script.js"
            data-website-id={umamiWebsiteId}
            strategy="afterInteractive"
          />
        )}
      </head>
      <body className={`${inter.className} antialiased`}>
        {children}
        <Toaster />
      </body>
    </html>
  );
}
