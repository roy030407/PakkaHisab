/**
 * FILE: components/shared/LoadingState.tsx
 *
 * WHAT THIS DOES:
 *   Centered loading spinner for async operations.
 *
 * CHANGES THIS SESSION:
 *   - Initial creation
 *
 * WHERE IT FITS:
 *   Used anywhere data is being fetched before first render.
 *
 * CALLED BY / IMPORTS FROM:
 *   Pages and components with async data
 */

interface LoadingStateProps {
  message?: string;
}

export function LoadingState({ message = "Loading..." }: LoadingStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-gray-400">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-slate-600" />
      <p className="mt-4 text-sm">{message}</p>
    </div>
  );
}
