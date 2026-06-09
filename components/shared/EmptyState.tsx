/**
 * FILE: components/shared/EmptyState.tsx
 *
 * WHAT THIS DOES:
 *   Empty state display when a list or section has no data yet.
 *
 * CHANGES THIS SESSION:
 *   - Initial creation
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
}

export function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-gray-200 py-16 text-center">
      <p className="text-sm font-medium text-gray-900">{title}</p>
      {description && (
        <p className="mt-1 text-sm text-gray-500">{description}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
