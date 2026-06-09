/**
 * FILE: components/products/VariantManager.tsx
 *
 * WHAT THIS DOES:
 *   Shows existing variants of a parent product and lets the user add
 *   new variants (e.g. "Thums Up 200ml", "Thums Up 500ml", "Thums Up 2L").
 *   Each variant inherits the parent's category but has its own prices.
 *
 * CHANGES THIS SESSION:
 *   - Initial creation for Phase 1c
 *
 * WHERE IT FITS:
 *   Rendered inside the product edit/add form when the product has or
 *   will have multiple sizes or pack variants.
 *
 * CALLED BY / IMPORTS FROM:
 *   app/(dashboard)/products/page.tsx (product form dialog)
 */

"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface Variant {
  id?: string;
  name: string;
  unit: string;
  purchase_price: number;
  selling_price: number;
  tax_rate: number;
}

interface VariantManagerProps {
  parentId: string;
  existingVariants: Variant[];
  onAdd: (variant: Omit<Variant, "id">) => Promise<void>;
  onDelete: (variantId: string) => Promise<void>;
}

export function VariantManager({
  existingVariants,
  onAdd,
  onDelete,
}: VariantManagerProps) {
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<Omit<Variant, "id">>({
    name: "",
    unit: "piece",
    purchase_price: 0,
    selling_price: 0,
    tax_rate: 0,
  });

  function setField<K extends keyof typeof form>(
    key: K,
    value: (typeof form)[K]
  ) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleAdd() {
    if (!form.name.trim()) return;
    setSaving(true);
    await onAdd(form);
    setForm({
      name: "",
      unit: "piece",
      purchase_price: 0,
      selling_price: 0,
      tax_rate: 0,
    });
    setShowForm(false);
    setSaving(false);
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-gray-700">Variants</p>
        <button
          type="button"
          onClick={() => setShowForm((v) => !v)}
          className="text-xs text-blue-600 hover:underline"
        >
          + Add variant
        </button>
      </div>

      {existingVariants.length > 0 ? (
        <div className="space-y-2">
          {existingVariants.map((v) => (
            <div
              key={v.id}
              className="flex items-center justify-between rounded-md border border-gray-100 bg-gray-50 px-3 py-2"
            >
              <div>
                <p className="text-sm font-medium text-gray-800">{v.name}</p>
                <p className="text-xs text-gray-400">
                  ₹{Number(v.selling_price).toFixed(2)} · {v.unit}
                </p>
              </div>
              {v.id && (
                <button
                  type="button"
                  onClick={() => onDelete(v.id!)}
                  className="text-xs text-red-500 hover:underline"
                >
                  Remove
                </button>
              )}
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs text-gray-400">No variants yet.</p>
      )}

      {showForm && (
        <div className="rounded-md border border-blue-100 bg-blue-50 p-3 space-y-3">
          <div className="space-y-1">
            <Label className="text-xs">Variant name</Label>
            <Input
              placeholder="e.g. Thums Up 500ml"
              value={form.name}
              onChange={(e) => setField("name", e.target.value)}
              className="h-8 text-sm"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-xs">Purchase price (₹)</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={form.purchase_price}
                onChange={(e) =>
                  setField("purchase_price", parseFloat(e.target.value) || 0)
                }
                className="h-8 text-sm"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Selling price (₹)</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={form.selling_price}
                onChange={(e) =>
                  setField("selling_price", parseFloat(e.target.value) || 0)
                }
                className="h-8 text-sm"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              onClick={handleAdd}
              disabled={saving || !form.name.trim()}
              className="h-7 text-xs"
            >
              {saving ? "Adding..." : "Add"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setShowForm(false)}
              className="h-7 text-xs"
            >
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
