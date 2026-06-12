/**
 * FILE: app/(auth)/onboarding/page.tsx
 *
 * WHAT THIS DOES:
 *   Store setup form for new merchants. Collects store name, type,
 *   owner name, city, optional GST number, and preferred language.
 *   After store type is selected, offers to pre-load a sample product
 *   catalog for that store type. Creates the stores DB record on submit.
 *
 * CHANGES THIS SESSION:
 *   - Complete rewrite: replaced business/industry/revenue fields with
 *     store-specific fields (storeType, ownerName, city, gstNumber)
 *   - Added sample store offer after storeType selection
 *   - Now calls /api/stores instead of /api/businesses
 *   - Khata Green restyle: emerald accents, brand mark, radial glow backdrop
 *
 * WHERE IT FITS:
 *   Shown immediately after signup (and on dashboard access if no store
 *   record exists). Redirects to /dashboard on success.
 *
 * CALLED BY / IMPORTS FROM:
 *   Dashboard layout redirect, direct post-signup redirect
 */

"use client";

import { useState } from "react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useRouter } from "next/navigation";
import type { StoreOnboardingFormData, StoreType } from "@/types";

const STORE_TYPE_LABELS: Record<StoreType, string> = {
  kirana: "Kirana / General Store",
  medical: "Medical Shop / Pharmacy",
  hardware: "Hardware Store",
  restaurant: "Restaurant / Food",
  clothing: "Clothing / Garments",
  pharmacy: "Pharmacy (standalone)",
  electronics: "Electronics",
  other: "Other",
};

export default function OnboardingPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<StoreOnboardingFormData>({
    name: "",
    type: "kirana",
    ownerName: "",
    city: "",
    gstNumber: "",
    preferredLanguage: "en",
    wantsSampleStore: false,
  });

  const [storeTypeSelected, setStoreTypeSelected] = useState(false);

  function set<K extends keyof StoreOnboardingFormData>(
    key: K,
    value: StoreOnboardingFormData[K]
  ) {
    setForm((prev) => ({ ...prev, [key]: value }));
    if (key === "type") setStoreTypeSelected(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const res = await fetch("/api/stores", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });

    if (res.ok) {
      // Trigger sample data seeding if merchant opted in
      if (form.wantsSampleStore) {
        // Fire-and-forget — don't block navigation if seed fails
        fetch("/api/stores/seed", { method: "POST" }).catch(() => {});
      }
      router.push("/dashboard");
      router.refresh();
    } else {
      const data = await res.json();
      setError(data.error ?? "Something went wrong. Please try again.");
    }
    setLoading(false);
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-white [background-image:radial-gradient(ellipse_at_top,#ecfdf5_0%,transparent_55%)] px-4 py-12">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Set up your store</CardTitle>
          <CardDescription>
            Tell us about your business so PakkaHisab can give you relevant
            insights in your language.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Store name */}
            <div className="space-y-1">
              <Label htmlFor="name">Store name</Label>
              <Input
                id="name"
                placeholder="e.g. Sharma General Store"
                value={form.name}
                onChange={(e) => set("name", e.target.value)}
                required
              />
            </div>

            {/* Store type */}
            <div className="space-y-1">
              <Label>Store type</Label>
              <Select
                value={form.type}
                onValueChange={(v) => set("type", v as StoreType)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(STORE_TYPE_LABELS) as StoreType[]).map(
                    (key) => (
                      <SelectItem key={key} value={key}>
                        {STORE_TYPE_LABELS[key]}
                      </SelectItem>
                    )
                  )}
                </SelectContent>
              </Select>
            </div>

            {/* Sample store offer — shown after store type is touched */}
            {storeTypeSelected && (
              <div className="rounded-lg border border-blue-100 bg-blue-50 p-4">
                <p className="text-sm font-medium text-blue-900">
                  Would you like to start with a sample store?
                </p>
                <p className="mt-1 text-xs text-blue-700">
                  We&apos;ll pre-load a product catalog, categories, and common
                  costs for a{" "}
                  {STORE_TYPE_LABELS[form.type].toLowerCase()}. You can edit or
                  delete anything.
                </p>
                <div className="mt-3 flex gap-3">
                  <button
                    type="button"
                    onClick={() => set("wantsSampleStore", true)}
                    className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
                      form.wantsSampleStore
                        ? "bg-blue-600 text-white"
                        : "border border-blue-300 text-blue-700 hover:bg-blue-100"
                    }`}
                  >
                    Yes, load sample data
                  </button>
                  <button
                    type="button"
                    onClick={() => set("wantsSampleStore", false)}
                    className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
                      !form.wantsSampleStore
                        ? "bg-gray-700 text-white"
                        : "border border-gray-300 text-gray-600 hover:bg-gray-100"
                    }`}
                  >
                    Start empty
                  </button>
                </div>
              </div>
            )}

            {/* Owner name */}
            <div className="space-y-1">
              <Label htmlFor="ownerName">Your name</Label>
              <Input
                id="ownerName"
                placeholder="e.g. Ramesh Sharma"
                value={form.ownerName}
                onChange={(e) => set("ownerName", e.target.value)}
                required
              />
            </div>

            {/* City */}
            <div className="space-y-1">
              <Label htmlFor="city">City</Label>
              <Input
                id="city"
                placeholder="e.g. Hyderabad"
                value={form.city}
                onChange={(e) => set("city", e.target.value)}
                required
              />
            </div>

            {/* GST number (optional) */}
            <div className="space-y-1">
              <Label htmlFor="gstNumber">
                GST number{" "}
                <span className="font-normal text-gray-400">(optional)</span>
              </Label>
              <Input
                id="gstNumber"
                placeholder="e.g. 36AABCT1332L1ZU"
                value={form.gstNumber ?? ""}
                onChange={(e) => set("gstNumber", e.target.value)}
                maxLength={15}
              />
            </div>

            {/* Preferred language */}
            <div className="space-y-1">
              <Label>Preferred language for AI insights</Label>
              <Select
                value={form.preferredLanguage}
                onValueChange={(v) =>
                  set(
                    "preferredLanguage",
                    v as StoreOnboardingFormData["preferredLanguage"]
                  )
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="en">English</SelectItem>
                  <SelectItem value="hi">Hindi (हिंदी)</SelectItem>
                  <SelectItem value="te">Telugu (తెలుగు)</SelectItem>
                  <SelectItem value="ta">Tamil (தமிழ்)</SelectItem>
                  <SelectItem value="mr">Marathi (मराठी)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Setting up your store..." : "Get started"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
