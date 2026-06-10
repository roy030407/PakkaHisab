/**
 * FILE: components/shared/AppErrorBoundary.tsx
 *
 * WHAT THIS DOES:
 *   React error boundary (client component) that catches render errors anywhere
 *   in the subtree and shows a plain-language fallback with a retry button.
 *   Never exposes technical stack traces to the merchant.
 *
 * CHANGES THIS SESSION:
 *   - Initial creation
 *
 * WHERE IT FITS:
 *   Wrap individual page sections or the entire page body. Does not catch
 *   async errors (those are handled by API error states in each component).
 *
 * CALLED BY / IMPORTS FROM:
 *   Any page that wants fallback error UI
 */
'use client'
import React from 'react'
import { AlertCircle } from 'lucide-react'

interface Props {
  children: React.ReactNode
  fallback?: React.ReactNode
}

interface State { hasError: boolean }

export class AppErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(): State {
    return { hasError: true }
  }

  override render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback
      return (
        <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
          <AlertCircle size={32} className="text-red-400 mb-3" />
          <p className="text-sm font-medium text-gray-900">Something went wrong</p>
          <p className="text-xs text-gray-500 mt-1 mb-4">
            We couldn&apos;t load this section. Try refreshing the page.
          </p>
          <button
            onClick={() => this.setState({ hasError: false })}
            className="text-xs text-slate-700 underline underline-offset-2">
            Try again
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
