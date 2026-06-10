/**
 * FILE: app/(auth)/signup/page.tsx
 *
 * WHAT THIS DOES:
 *   Magic-link signup. User enters email, Supabase sends a sign-in link,
 *   clicking it calls /api/auth/callback which creates the session.
 *   New users land on /onboarding; existing users go to /dashboard.
 *
 * CHANGES THIS SESSION:
 *   - Initial creation
 *   - Switch from OTP code entry to magic link flow; add emailRedirectTo
 *
 * WHERE IT FITS:
 *   Entry point for first-time users. The callback route detects new vs
 *   returning users via the dashboard layout's business record check.
 *
 * CALLED BY / IMPORTS FROM:
 *   Login page link, direct navigation
 */

"use client";

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

type Step = "email" | "sent";

export default function SignupPage() {
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const supabase = createSupabaseBrowserClient();

  async function handleSendLink(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: true,
        emailRedirectTo: `${window.location.origin}/api/auth/callback`,
      },
    });

    if (error) {
      setError("Could not send sign-up link. Try again.");
    } else {
      setStep("sent");
    }
    setLoading(false);
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <CardTitle className="text-xl">Create your account</CardTitle>
          <CardDescription>
            {step === "email"
              ? "Enter your email to get started"
              : `Check your inbox — we sent a link to ${email}`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {step === "email" ? (
            <form onSubmit={handleSendLink} className="space-y-4">
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
              {error && <p className="text-sm text-red-600">{error}</p>}
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Sending..." : "Send sign-up link"}
              </Button>
              <p className="text-center text-sm text-gray-500">
                Already have an account?{" "}
                <Link href="/login" className="font-medium text-slate-700 underline">
                  Log in
                </Link>
              </p>
            </form>
          ) : (
            <div className="space-y-4 text-center">
              <p className="text-sm text-gray-600">
                Click the <strong>Confirm your signup</strong> link in the
                email to create your account. The link expires in 1 hour.
              </p>
              <button
                type="button"
                onClick={() => { setStep("email"); setError(null); }}
                className="text-sm text-gray-500 underline"
              >
                Use a different email
              </button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
