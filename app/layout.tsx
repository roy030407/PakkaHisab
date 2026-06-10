/**
 * FILE: app/layout.tsx
 *
 * WHAT THIS DOES:
 *   Root Next.js layout — sets HTML metadata, global fonts, and mounts
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
import { Inter } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "PakkaHisab - Your AI CFO",
  description: "Scan bills, understand your business, get paid faster.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.className} antialiased`}>
        {children}
        <Toaster />
      </body>
    </html>
  );
}
