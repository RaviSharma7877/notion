"use client"

import { useState, useEffect, useCallback } from "react"

export interface ChatMessage {
  id: string
  content: string
  timestamp: string
  sender: string
  metadata?: Record<string, any>
}

interface UseChatDataOptions {
  enabled?: boolean
  onSuccess?: (data: ChatMessage[]) => void
  onError?: (error: Error) => void
}

export const useChatData = (options: UseChatDataOptions = {}) => {
  const { enabled = true, onSuccess, onError } = options
  const [data, setData] = useState<ChatMessage[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const fetchChatData = useCallback(async () => {
    if (!enabled) return

    setIsLoading(true)
    setError(null)

    try {
      // Simulate API call - replace with actual endpoint
      const response = await fetch("/api/chat/messages", {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      })

      if (!response.ok) {
        throw new Error(`Failed to fetch chat data: ${response.statusText}`)
      }

      const messages: ChatMessage[] = await response.json()
      setData(messages)
      onSuccess?.(messages)
    } catch (err) {
      const error = err instanceof Error ? err : new Error("Unknown error")
      setError(error)
      onError?.(error)
    } finally {
      setIsLoading(false)
    }
  }, [enabled, onSuccess, onError])

  useEffect(() => {
    fetchChatData()
  }, [fetchChatData])

  return {
    data,
    isLoading,
    error,
    refetch: fetchChatData,
  }
}
