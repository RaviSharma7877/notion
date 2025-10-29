"use client"

import type React from "react"
import { type ReactNode, Suspense } from "react"
import { LoadingSkeleton } from "./loading-skeleton"
import { ErrorBoundary } from "./error-boundary"

interface AsyncBoundaryProps {
  children: ReactNode
  fallback?: ReactNode
  errorFallback?: (error: Error, reset: () => void) => ReactNode
  loadingVariant?: "text" | "card" | "table" | "chart"
}

export const AsyncBoundary: React.FC<AsyncBoundaryProps> = ({
  children,
  fallback,
  errorFallback,
  loadingVariant = "text",
}) => {
  return (
    <ErrorBoundary fallback={errorFallback}>
      <Suspense fallback={fallback || <LoadingSkeleton variant={loadingVariant} />}>{children}</Suspense>
    </ErrorBoundary>
  )
}
