/**
 * FILE: components/shared/ErrorState.tsx
 *
 * WHAT THIS DOES:
 *   Error display with optional retry action for failed data fetches.
 *
 * CHANGES THIS SESSION:
 *   - Initial creation
 *
 * WHERE IT FITS:
 *   Used wherever async operations can fail.
 *
 * CALLED BY / IMPORTS FROM:
 *   Any component that fetches remote data
 */

interface ErrorStateProps {
  message?: string;
  onRetry?: () => void;
}

export function ErrorState({
  message = "Something went wrong.",
  onRetry,
}: ErrorStateProps) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-red-100 bg-red-50 py-12 text-center">
      <p className="text-sm font-medium text-red-700">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-3 text-sm text-red-600 underline underline-offset-2"
        >
          Try again
        </button>
      )}
    </div>
  );
}
