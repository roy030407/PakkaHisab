/**
 * FILE: components/shared/EmptyState.tsx
 *
 * WHAT THIS DOES:
 *   Empty state display when a list or section has no data yet.
 *
 * CHANGES THIS SESSION:
 *   - Initial creation
 *   - Added inline SVG illustration variants for Khata Green redesign
 *
 * WHERE IT FITS:
 *   Used in transaction lists, receivables, and any data-driven UI.
 *
 * CALLED BY / IMPORTS FROM:
 *   Dashboard data components
 */

interface EmptyStateProps {
  title: string;
  description?: string;
  action?: React.ReactNode;
  illustration?: "box" | "customers" | "reports" | "chat" | "scan";
}

const STROKES = { main: "#047857", soft: "#a7f3d0", accent: "#f59e0b" }

function Illustration({ kind }: { kind: NonNullable<EmptyStateProps["illustration"]> }) {
  const common = { fill: "none", strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const }
  switch (kind) {
    case "box":
      return (
        <svg width="72" height="72" viewBox="0 0 72 72" aria-hidden>
          <path d="M14 28 36 18l22 10v24L36 62 14 52z" stroke={STROKES.main} {...common} />
          <path d="M14 28l22 10 22-10M36 38v24" stroke={STROKES.soft} {...common} />
          <path d="M50 14l4-6M58 18l6-4" stroke={STROKES.accent} {...common} />
        </svg>
      )
    case "customers":
      return (
        <svg width="72" height="72" viewBox="0 0 72 72" aria-hidden>
          <circle cx="28" cy="26" r="8" stroke={STROKES.main} {...common} />
          <path d="M12 56c0-9 7-14 16-14s16 5 16 14" stroke={STROKES.main} {...common} />
          <circle cx="50" cy="30" r="6" stroke={STROKES.soft} {...common} />
          <path d="M44 54c1-7 6-10 12-10" stroke={STROKES.soft} {...common} />
        </svg>
      )
    case "reports":
      return (
        <svg width="72" height="72" viewBox="0 0 72 72" aria-hidden>
          <rect x="14" y="14" width="44" height="44" rx="6" stroke={STROKES.soft} {...common} />
          <path d="M24 46V34M36 46V26M48 46v-8" stroke={STROKES.main} {...common} />
          <path d="M22 22h8" stroke={STROKES.accent} {...common} />
        </svg>
      )
    case "chat":
      return (
        <svg width="72" height="72" viewBox="0 0 72 72" aria-hidden>
          <path d="M14 20h44v26H30l-10 10V46h-6z" stroke={STROKES.main} {...common} />
          <path d="M26 30h20M26 37h12" stroke={STROKES.soft} {...common} />
          <path d="M56 12l2-4M62 16l4-2" stroke={STROKES.accent} {...common} />
        </svg>
      )
    case "scan":
      return (
        <svg width="72" height="72" viewBox="0 0 72 72" aria-hidden>
          <path d="M14 24v-8h8M58 24v-8h-8M14 48v8h8M58 48v8h-8" stroke={STROKES.main} {...common} />
          <rect x="26" y="26" width="20" height="24" rx="3" stroke={STROKES.soft} {...common} />
          <path d="M30 34h12M30 40h8" stroke={STROKES.soft} {...common} />
          <path d="M12 36h48" stroke={STROKES.accent} {...common} />
        </svg>
      )
  }
}

export function EmptyState({ title, description, action, illustration }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-emerald-200 bg-emerald-50/30 py-14 text-center">
      {illustration && <div className="mb-4">{<Illustration kind={illustration} />}</div>}
      <p className="text-sm font-semibold text-gray-900">{title}</p>
      {description && (
        <p className="mt-1 max-w-xs text-sm text-gray-500">{description}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
