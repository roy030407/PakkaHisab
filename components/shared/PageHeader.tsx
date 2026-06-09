/**
 * FILE: components/shared/PageHeader.tsx
 *
 * WHAT THIS DOES:
 *   Consistent page title + optional subtitle block used across all
 *   dashboard pages.
 *
 * CHANGES THIS SESSION:
 *   - Initial creation
 *
 * WHERE IT FITS:
 *   Imported by every page in (dashboard)/* for consistent header styling.
 *
 * CALLED BY / IMPORTS FROM:
 *   Dashboard pages
 */

interface PageHeaderProps {
  title: string;
  subtitle?: string;
}

export function PageHeader({ title, subtitle }: PageHeaderProps) {
  return (
    <div className="mb-6">
      <h1 className="text-2xl font-semibold text-gray-900">{title}</h1>
      {subtitle && <p className="mt-1 text-sm text-gray-500">{subtitle}</p>}
    </div>
  );
}
