/**
 * FILE: app/(dashboard)/settings/page.tsx
 *
 * WHAT THIS DOES:
 *   Settings hub with two sections:
 *   1. Fixed costs — add/edit/delete recurring business costs
 *      (rent, salaries, electricity, transport, other).
 *   2. Store info — displays current store details, GST config
 *      (editable in a future patch; read-only for now).
 *
 * CHANGES THIS SESSION:
 *   - Initial creation for Phase 1d (fixed costs) + 1e (tax config display)
 *
 * WHERE IT FITS:
 *   Fixed costs feed into profit calculations. Tax config feeds into
 *   GST calculations in Phase 4 (reports).
 *
 * CALLED BY / IMPORTS FROM:
 *   Dashboard navigation
 */

"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PageHeader } from "@/components/shared/PageHeader";
import { EmptyState } from "@/components/shared/EmptyState";
import { LoadingState } from "@/components/shared/LoadingState";

type FixedCost = {
  id: string;
  name: string;
  amount: number;
  frequency: string;
  category: string;
  is_active: boolean;
};

const FREQ_LABELS: Record<string, string> = {
  daily: "Daily",
  weekly: "Weekly",
  monthly: "Monthly",
  yearly: "Yearly",
};

const CAT_LABELS: Record<string, string> = {
  rent: "Rent",
  salaries: "Salaries",
  electricity: "Electricity",
  transport: "Transport",
  other: "Other",
};

const emptyForm = {
  name: "",
  amount: "",
  frequency: "monthly",
  category: "other",
};

function dailyCost(cost: FixedCost): number {
  const multiplier: Record<string, number> = {
    daily: 1,
    weekly: 1 / 7,
    monthly: 1 / 30,
    yearly: 1 / 365,
  };
  return cost.amount * (multiplier[cost.frequency] ?? 1 / 30);
}

export default function SettingsPage() {
  const [costs, setCosts] = useState<FixedCost[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const fetchCosts = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/fixed-costs");
    if (res.ok) {
      const data = await res.json();
      setCosts(data.fixedCosts ?? []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchCosts();
  }, [fetchCosts]);

  function setField<K extends keyof typeof emptyForm>(
    key: K,
    value: string
  ) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const res = await fetch("/api/fixed-costs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.name.trim(),
        amount: parseFloat(form.amount),
        frequency: form.frequency,
        category: form.category,
      }),
    });

    if (res.ok) {
      setShowForm(false);
      setForm({ ...emptyForm });
      fetchCosts();
    } else {
      const data = await res.json();
      setError(data.error ?? "Failed to save.");
    }
    setSaving(false);
  }

  async function handleDelete(id: string) {
    await fetch(`/api/fixed-costs/${id}`, { method: "DELETE" });
    setConfirmDelete(null);
    fetchCosts();
  }

  const totalMonthlyFixed = costs.reduce(
    (sum, c) => sum + dailyCost(c) * 30,
    0
  );
  const totalDailyFixed = costs.reduce((sum, c) => sum + dailyCost(c), 0);

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 space-y-10">
      {/* Fixed Costs Section */}
      <section>
        <div className="flex items-start justify-between">
          <PageHeader
            title="Fixed Costs"
            subtitle="Recurring business expenses used in profit calculations."
          />
          <Button size="sm" onClick={() => setShowForm((v) => !v)}>
            + Add cost
          </Button>
        </div>

        {costs.length > 0 && (
          <div className="mb-4 rounded-lg border border-gray-100 bg-gray-50 px-4 py-3 text-sm text-gray-600">
            <span className="font-medium">₹{totalDailyFixed.toFixed(0)}/day</span>
            {" · "}
            <span>₹{totalMonthlyFixed.toFixed(0)}/month</span>
            {" total fixed cost"}
          </div>
        )}

        {showForm && (
          <div className="mb-5 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <form onSubmit={handleSave} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2 space-y-1">
                  <Label>Cost name *</Label>
                  <Input
                    placeholder="e.g. Shop rent"
                    value={form.name}
                    onChange={(e) => setField("name", e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-1">
                  <Label>Amount (₹) *</Label>
                  <Input
                    type="number"
                    min="1"
                    step="1"
                    placeholder="e.g. 15000"
                    value={form.amount}
                    onChange={(e) => setField("amount", e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-1">
                  <Label>Frequency</Label>
                  <Select
                    value={form.frequency}
                    onValueChange={(v) => setField("frequency", v as string)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(FREQ_LABELS).map(([k, v]) => (
                        <SelectItem key={k} value={k}>
                          {v}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>Category</Label>
                  <Select
                    value={form.category}
                    onValueChange={(v) => setField("category", v as string)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(CAT_LABELS).map(([k, v]) => (
                        <SelectItem key={k} value={k}>
                          {v}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {error && <p className="text-sm text-red-600">{error}</p>}

              <div className="flex gap-3">
                <Button type="submit" disabled={saving}>
                  {saving ? "Saving..." : "Add cost"}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setShowForm(false)}
                >
                  Cancel
                </Button>
              </div>
            </form>
          </div>
        )}

        {loading ? (
          <LoadingState message="Loading costs..." />
        ) : costs.length === 0 ? (
          <EmptyState
            title="No fixed costs yet"
            description="Add rent, salaries, electricity, and other recurring costs so we can calculate your true daily profit."
            action={
              <Button size="sm" onClick={() => setShowForm(true)}>
                Add first cost
              </Button>
            }
          />
        ) : (
          <div className="space-y-2">
            {costs.map((cost) => (
              <div
                key={cost.id}
                className="flex items-center justify-between rounded-lg border border-gray-200 bg-white px-4 py-3"
              >
                <div>
                  <p className="font-medium text-gray-900">{cost.name}</p>
                  <p className="text-sm text-gray-500">
                    {CAT_LABELS[cost.category]} ·{" "}
                    <span className="font-medium text-gray-700">
                      ₹{Number(cost.amount).toLocaleString("en-IN")}
                    </span>
                    /{FREQ_LABELS[cost.frequency].toLowerCase()}
                  </p>
                </div>
                <div className="flex items-center gap-4">
                  <p className="text-sm text-gray-400">
                    ≈ ₹{dailyCost(cost).toFixed(0)}/day
                  </p>
                  {confirmDelete === cost.id ? (
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleDelete(cost.id)}
                        className="rounded px-2 py-1 text-xs text-white bg-red-500 hover:bg-red-600"
                      >
                        Confirm
                      </button>
                      <button
                        onClick={() => setConfirmDelete(null)}
                        className="rounded px-2 py-1 text-xs text-gray-500 hover:bg-gray-100"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setConfirmDelete(cost.id)}
                      className="text-xs text-red-500 hover:underline"
                    >
                      Remove
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* GST Config section placeholder */}
      <section>
        <PageHeader
          title="Tax Configuration"
          subtitle="GST slabs and interstate settings — coming soon."
        />
        <div className="rounded-lg border border-dashed border-gray-200 p-6 text-sm text-gray-400 text-center">
          GST configuration (CGST+SGST / IGST toggle, per-product rates)
          will be configurable here. Currently set to intra-state by default.
        </div>
      </section>
    </div>
  );
}
