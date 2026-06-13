/**
 * FILE: components/products/ProductCard.tsx
 *
 * WHAT THIS DOES:
 *   Displays a single product with name, item number, prices, margin,
 *   and variant count. Inline +/- for pinning. Tap to expand for edit.
 *
 * CHANGES THIS SESSION:
 *   - Initial creation for Phase 1c
 *   - Fixed price display: show " - " instead of "₹0.00" when price not set
 *   - Khata Green restyle
 *
 * WHERE IT FITS:
 *   Used in the products page list and the variant manager.
 *
 * CALLED BY / IMPORTS FROM:
 *   app/(dashboard)/products/page.tsx
 */

"use client";

import { useState } from "react";

interface ProductCardProps {
  product: {
    id: string;
    item_number: number;
    name: string;
    brand?: string | null;
    category?: string | null;
    unit: string;
    purchase_price: number;
    selling_price: number;
    tax_rate: number;
    is_pinned: boolean;
    variants?: { id: string; name: string }[];
  };
  onEdit: (id: string) => void;
  onTogglePin: (id: string, pinned: boolean) => void;
  onDelete: (id: string) => void;
}

function fmt(v: number | string | null | undefined): string {
  const n = Number(v)
  if (!isFinite(n) || n === 0) return " - "
  return n.toFixed(2)
}

export function ProductCard({
  product,
  onEdit,
  onTogglePin,
  onDelete,
}: ProductCardProps) {
  const [confirmDelete, setConfirmDelete] = useState(false);

  const sp = Number(product.selling_price)
  const pp = Number(product.purchase_price)

  const margin =
    isFinite(sp) && sp > 0
      ? Math.round(((sp - pp) / sp) * 100)
      : 0;

  const marginColor =
    margin >= 20
      ? "text-green-600"
      : margin >= 10
      ? "text-amber-600"
      : "text-red-600";

  return (
    <div className="card-lift rounded-lg border border-gray-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="shrink-0 rounded bg-gray-100 px-1.5 py-0.5 text-xs font-mono text-gray-500">
              #{product.item_number}
            </span>
            {product.is_pinned && (
              <span className="shrink-0 rounded bg-emerald-100 px-1.5 py-0.5 text-xs text-emerald-700">
                pinned
              </span>
            )}
          </div>
          <p className="mt-1 truncate font-medium text-gray-900">
            {product.name}
          </p>
          {product.brand && (
            <p className="truncate text-sm text-gray-500">{product.brand}</p>
          )}
          {product.category && (
            <p className="mt-0.5 text-xs text-gray-400">{product.category}</p>
          )}
        </div>

        <div className="shrink-0 text-right">
          <p className="text-base font-semibold text-gray-900">
            {fmt(product.selling_price) === " - " ? (
              <span className="text-sm text-gray-400 italic">Price not set</span>
            ) : (
              <>₹{fmt(product.selling_price)}</>
            )}
          </p>
          <p className="text-xs text-gray-400">
            cost {fmt(product.purchase_price) === " - " ? " - " : `₹${fmt(product.purchase_price)}`}
          </p>
          {isFinite(sp) && sp > 0 && (
            <p className={`text-xs font-medium ${marginColor}`}>
              {margin}% margin
            </p>
          )}
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between">
        <div className="flex gap-3 text-xs text-gray-400">
          <span>{product.unit}</span>
          {product.tax_rate > 0 && <span>GST {product.tax_rate}%</span>}
          {product.variants && product.variants.length > 0 && (
            <span>{product.variants.length} variant(s)</span>
          )}
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={() => onTogglePin(product.id, !product.is_pinned)}
            className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
            title={product.is_pinned ? "Unpin" : "Pin to top"}
          >
            {product.is_pinned ? "📌" : "📍"}
          </button>
          <button
            onClick={() => onEdit(product.id)}
            className="rounded px-2 py-1 text-xs text-emerald-700 hover:bg-emerald-50"
          >
            Edit
          </button>
          {confirmDelete ? (
            <div className="flex gap-1">
              <button
                onClick={() => onDelete(product.id)}
                className="rounded px-2 py-1 text-xs text-white bg-red-500 hover:bg-red-600"
              >
                Confirm
              </button>
              <button
                onClick={() => setConfirmDelete(false)}
                className="rounded px-2 py-1 text-xs text-gray-500 hover:bg-gray-100"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={() => setConfirmDelete(true)}
              className="rounded px-2 py-1 text-xs text-red-500 hover:bg-red-50"
            >
              Delete
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
