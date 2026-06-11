/**
 * FILE: app/(auth)/login/page.tsx
 *
 * WHAT THIS DOES:
 *   Email + password login. Authenticates via Supabase signInWithPassword
 *   (no emails sent, no rate limits). Includes a one-tap demo accounts
 *   panel that fills credentials for the seeded test stores.
 *
 * CHANGES THIS SESSION:
 *   - Replaced magic link flow with email + password (signInWithPassword)
 *   - Added demo accounts quick-fill panel for testing
 *   - Added export const dynamic = "force-dynamic" to prevent build-time prerender
 *
 * WHERE IT FITS:
 *   Entry point for returning users. Unauthenticated dashboard access
 *   redirects here.
 *
 * CALLED BY / IMPORTS FROM:
 *   Dashboard layout redirect, signup page link
 */

"use client";

export const dynamic = "force-dynamic";

import { useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import Link from "next/link";
import { useRouter } from "next/navigation";

const DEMO_ACCOUNTS = [
  { label: "Kirana store", email: "demo.kirana@pakkahisab.com" },
  { label: "Medical shop", email: "demo.medical@pakkahisab.com" },
  { label: "Hardware store", email: "demo.hardware@pakkahisab.com" },
];
const DEMO_PASSWORD = "demo1234";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showDemo, setShowDemo] = useState(false);
  const router = useRouter();
  const supabase = createSupabaseBrowserClient();

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError("Wrong email or password. Try again.");
      setLoading(false);
    } else {
      router.push("/dashboard");
      router.refresh();
    }
  }

  function fillDemo(demoEmail: string) {
    setEmail(demoEmail);
    setPassword(DEMO_PASSWORD);
    setError(null);
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <CardTitle className="text-xl">PakkaHisab</CardTitle>
          <CardDescription>Log in to your store</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-1">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="Your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
              />
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Logging in..." : "Log in"}
            </Button>
            <p className="text-center text-sm text-gray-500">
              New here?{" "}
              <Link href="/signup" className="font-medium text-slate-700 underline">
                Create account
              </Link>
            </p>
          </form>

          <div className="mt-6 border-t pt-4">
            <button
              type="button"
              onClick={() => setShowDemo((v) => !v)}
              className="w-full text-center text-xs text-gray-400 hover:text-gray-600"
            >
              {showDemo ? "Hide demo accounts" : "Try a demo account"}
            </button>
            {showDemo && (
              <div className="mt-3 space-y-2">
                {DEMO_ACCOUNTS.map((d) => (
                  <button
                    key={d.email}
                    type="button"
                    onClick={() => fillDemo(d.email)}
                    className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-left text-sm hover:border-slate-400 hover:bg-slate-50"
                  >
                    <span className="font-medium text-gray-800">{d.label}</span>
                    <span className="block text-xs text-gray-400">{d.email}</span>
                  </button>
                ))}
                <p className="text-center text-xs text-gray-400">
                  Tap one, then press Log in. Password is pre-filled.
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
