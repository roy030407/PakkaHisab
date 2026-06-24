/**
 * FILE: app/(dashboard)/products/page.tsx
 *
 * WHAT THIS DOES:
 *   Product catalog management page. List, search, add, edit, delete
 *   products. Pin frequently used products to the top. Add variants
 *   (multiple sizes/packs) under a parent product.
 *
 * CHANGES THIS SESSION:
 *   - Initial creation for Phase 1c
 *   - Khata Green restyle
 *
 * WHERE IT FITS:
 *   Core catalog management UI. Products created here are used across
 *   bill scanning, quick entry, and inventory tracking.
 *
 * CALLED BY / IMPORTS FROM:
 *   Dashboard navigation (Phase 4 nav)
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
import { ProductCard } from "@/components/products/ProductCard";
import { VariantManager } from "@/components/products/VariantManager";
import { PageHeader } from "@/components/shared/PageHeader";
import { EmptyState } from "@/components/shared/EmptyState";
import { LoadingState } from "@/components/shared/LoadingState";
import { StockTabs } from "@/components/shared/StockTabs";

type Product = {
  id: string;
  item_number: number;
  parent_product_id: string | null;
  name: string;
  brand: string | null;
  category: string | null;
  subcategory: string | null;
  unit: string;
  purchase_price: number;
  selling_price: number;
  tax_rate: number;
  is_active: boolean;
  is_pinned: boolean;
  variants?: { id: string; name: string; selling_price: number; unit: string; purchase_price: number; tax_rate: number }[];
};

const UNITS = ["piece", "kg", "litre", "box", "dozen", "other"];
const GST_RATES = [0, 5, 12, 18, 28];

const emptyForm = {
  name: "",
  brand: "",
  category: "",
  subcategory: "",
  unit: "piece",
  purchasePrice: "",
  sellingPrice: "",
  taxRate: "0",
  shelfLifeDays: "",
  isPinned: false,
  addVariants: false,
  parentProductId: "",
};

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [frequentIds, setFrequentIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetch("/api/products/frequent")
      .then(r => r.json())
      .then(d => setFrequentIds(new Set((d.products ?? []).map((p: { id: string }) => p.id))))
      .catch(() => {});
  }, []);

  const fetchProducts = useCallback(async (q?: string) => {
    setLoading(true);
    const url = q ? `/api/products?q=${encodeURIComponent(q)}&parent_only=true` : "/api/products?parent_only=true";
    const res = await fetch(url);
    if (res.ok) {
      const data = await res.json();
      setProducts(data.products ?? []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  useEffect(() => {
    const timer = setTimeout(() => fetchProducts(search || undefined), 300);
    return () => clearTimeout(timer);
  }, [search, fetchProducts]);

  function setField<K extends keyof typeof emptyForm>(
    key: K,
    value: (typeof emptyForm)[K]
  ) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function openAdd() {
    setForm({ ...emptyForm });
    setEditingId(null);
    setError(null);
    setShowForm(true);
  }

  async function openEdit(id: string) {
    const res = await fetch(`/api/products/${id}`);
    if (!res.ok) return;
    const { product } = await res.json();
    setForm({
      name: product.name,
      brand: product.brand ?? "",
      category: product.category ?? "",
      subcategory: product.subcategory ?? "",
      unit: product.unit,
      purchasePrice: String(product.purchase_price),
      sellingPrice: String(product.selling_price),
      taxRate: String(product.tax_rate),
      shelfLifeDays: product.shelf_life_days ? String(product.shelf_life_days) : "",
      isPinned: product.is_pinned,
      addVariants: (product.variants?.length ?? 0) > 0,
      parentProductId: "",
    });
    setEditingId(id);
    setError(null);
    setShowForm(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const payload = {
      name: form.name.trim(),
      brand: form.brand || undefined,
      category: form.category || undefined,
      subcategory: form.subcategory || undefined,
      unit: form.unit,
      purchasePrice: parseFloat(form.purchasePrice) || 0,
      sellingPrice: parseFloat(form.sellingPrice) || 0,
      taxRate: parseFloat(form.taxRate) || 0,
      shelfLifeDays: form.shelfLifeDays ? parseInt(form.shelfLifeDays) : undefined,
      isPinned: form.isPinned,
    };

    const res = editingId
      ? await fetch(`/api/products/${editingId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })
      : await fetch("/api/products", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

    if (res.ok) {
      setShowForm(false);
      fetchProducts(search || undefined);
    } else {
      const data = await res.json();
      setError(data.error ?? "Failed to save product.");
    }
    setSaving(false);
  }

  async function handleDelete(id: string) {
    await fetch(`/api/products/${id}`, { method: "DELETE" });
    fetchProducts(search || undefined);
  }

  async function handleTogglePin(id: string, pinned: boolean) {
    await fetch(`/api/products/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isPinned: pinned }),
    });
    fetchProducts(search || undefined);
  }

  // Variant operations (only available when editing an existing product)
  async function handleAddVariant(variant: {
    name: string;
    unit: string;
    purchase_price: number;
    selling_price: number;
    tax_rate: number;
  }) {
    if (!editingId) return;
    await fetch("/api/products", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...variant,
        purchasePrice: variant.purchase_price,
        sellingPrice: variant.selling_price,
        taxRate: variant.tax_rate,
        parentProductId: editingId,
      }),
    });
    // Refresh the edit form to show the new variant
    openEdit(editingId);
  }

  async function handleDeleteVariant(variantId: string) {
    await fetch(`/api/products/${variantId}`, { method: "DELETE" });
    if (editingId) openEdit(editingId);
  }

  const editingProduct = editingId
    ? products.find((p) => p.id === editingId)
    : null;

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="mb-4">
        <StockTabs />
      </div>
      <div className="flex items-center justify-between">
        <PageHeader
          title="Products"
          subtitle="Your product catalog, the foundation for bills, inventory, and reports."
        />
        <Button onClick={openAdd} size="sm">
          + Add product
        </Button>
      </div>

      {/* Search */}
      <div className="mt-4 mb-6">
        <Input
          placeholder="Search by name, brand, or item number..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-sm"
        />
      </div>

      {/* Add / Edit form */}
      {showForm && (
        <div className="mb-6 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-base font-semibold text-gray-900">
            {editingId ? "Edit product" : "Add product"}
          </h2>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2 space-y-1">
                <Label>Product name *</Label>
                <Input
                  placeholder="e.g. Thums Up"
                  value={form.name}
                  onChange={(e) => setField("name", e.target.value)}
                  required
                />
              </div>
              <div className="space-y-1">
                <Label>Brand</Label>
                <Input
                  placeholder="e.g. Coca-Cola"
                  value={form.brand}
                  onChange={(e) => setField("brand", e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label>Category</Label>
                <Input
                  placeholder="e.g. Beverages"
                  value={form.category}
                  onChange={(e) => setField("category", e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label>Purchase price (₹)</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  value={form.purchasePrice}
                  onChange={(e) => setField("purchasePrice", e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label>Selling price (₹)</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  value={form.sellingPrice}
                  onChange={(e) => setField("sellingPrice", e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label>Unit</Label>
                <Select
                  value={form.unit}
                  onValueChange={(v) => setField("unit", v as string)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {UNITS.map((u) => (
                      <SelectItem key={u} value={u}>
                        {u}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>GST rate (%)</Label>
                <Select
                  value={form.taxRate}
                  onValueChange={(v) => setField("taxRate", v as string)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {GST_RATES.map((r) => (
                      <SelectItem key={r} value={String(r)}>
                        {r}%
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Variant manager - only shown when editing an existing product */}
            {editingId && (
              <VariantManager
                parentId={editingId}
                existingVariants={editingProduct?.variants ?? []}
                onAdd={handleAddVariant}
                onDelete={handleDeleteVariant}
              />
            )}

            {/* New product: offer to add variants after save */}
            {!editingId && (
              <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.addVariants}
                  onChange={(e) =>
                    setField("addVariants", e.target.checked as unknown as boolean)
                  }
                  className="rounded"
                />
                This product comes in multiple sizes or variants
                <span className="text-gray-400">(you can add them after saving)</span>
              </label>
            )}

            {error && <p className="text-sm text-red-600">{error}</p>}

            <div className="flex gap-3 pt-2">
              <Button type="submit" disabled={saving}>
                {saving ? "Saving..." : editingId ? "Save changes" : "Add product"}
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

      {/* Product list */}
      {loading ? (
        <LoadingState message="Loading products..." />
      ) : products.length === 0 ? (
        <EmptyState
          illustration="box"
          title={search ? "No products match your search" : "No products yet"}
          description={
            search
              ? "Try a different name, brand, or item number."
              : "Add your first product to get started."
          }
          action={
            !search ? (
              <Button size="sm" onClick={openAdd}>
                Add product
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {[...products]
            .sort((a, b) => {
              const aFreq = frequentIds.has(a.id) ? 1 : 0;
              const bFreq = frequentIds.has(b.id) ? 1 : 0;
              return bFreq - aFreq;
            })
            .map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              onEdit={openEdit}
              onTogglePin={handleTogglePin}
              onDelete={handleDelete}
              highlighted={frequentIds.has(product.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
