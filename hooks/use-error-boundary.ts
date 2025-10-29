"use client"

import { useState, useCallback } from "react"

export interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
}

export const useErrorBoundary = () => {
  const [state, setState] = useState<ErrorBoundaryState>({
    hasError: false,
    error: null,
  })

  const resetError = useCallback(() => {
    setState({ hasError: false, error: null })
  }, [])

  const captureError = useCallback((error: Error) => {
    console.error("[v0] Error captured:", error)
    setState({ hasError: true, error })
  }, [])

  return {
    ...state,
    resetError,
    captureError,
  }
}
