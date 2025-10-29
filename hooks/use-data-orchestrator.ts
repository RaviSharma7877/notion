"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import type { ChatMessage } from "./use-chat-data"

export interface DataOrchestrationState {
  chatData: ChatMessage[]
  chartData: any[]
  isLoadingChat: boolean
  isLoadingChart: boolean
  chatError: Error | null
  chartError: Error | null
}

interface UseDataOrchestratorOptions {
  onChatDataReady?: (data: ChatMessage[]) => void
  onChartDataReady?: (data: any[]) => void
  prioritizeChat?: boolean
}

export const useDataOrchestrator = (options: UseDataOrchestratorOptions = {}) => {
  const { onChatDataReady, onChartDataReady, prioritizeChat = true } = options
  const [state, setState] = useState<DataOrchestrationState>({
    chatData: [],
    chartData: [],
    isLoadingChat: false,
    isLoadingChart: false,
    chatError: null,
    chartError: null,
  })

  const chatFetchedRef = useRef(false)
  const chartFetchedRef = useRef(false)

  const fetchChatData = useCallback(async () => {
    if (chatFetchedRef.current) return

    setState((prev) => ({ ...prev, isLoadingChat: true, chatError: null }))

    try {
      const response = await fetch("/api/chat/messages", {
        method: "GET",
        headers: { "Content-Type": "application/json" },
      })

      if (!response.ok) throw new Error(`Failed to fetch chat: ${response.statusText}`)

      const data: ChatMessage[] = await response.json()
      setState((prev) => ({ ...prev, chatData: data, isLoadingChat: false }))
      onChatDataReady?.(data)
      chatFetchedRef.current = true

      // Only fetch chart data after chat data is ready (if prioritizing chat)
      if (prioritizeChat) {
        await fetchChartData()
      }
    } catch (error) {
      const err = error instanceof Error ? error : new Error("Unknown error")
      setState((prev) => ({ ...prev, chatError: err, isLoadingChat: false }))
      console.error("[v0] Chat data fetch error:", err)
    }
  }, [onChatDataReady, prioritizeChat])

  const fetchChartData = useCallback(async () => {
    if (chartFetchedRef.current) return

    // Wait for chat data if prioritizing
    if (prioritizeChat && !chatFetchedRef.current) {
      console.log("[v0] Waiting for chat data before fetching chart data...")
      return
    }

    setState((prev) => ({ ...prev, isLoadingChart: true, chartError: null }))

    try {
      const response = await fetch("/api/chart/data", {
        method: "GET",
        headers: { "Content-Type": "application/json" },
      })

      if (!response.ok) throw new Error(`Failed to fetch chart: ${response.statusText}`)

      const data = await response.json()
      setState((prev) => ({ ...prev, chartData: data, isLoadingChart: false }))
      onChartDataReady?.(data)
      chartFetchedRef.current = true
    } catch (error) {
      const err = error instanceof Error ? error : new Error("Unknown error")
      setState((prev) => ({ ...prev, chartError: err, isLoadingChart: false }))
      console.error("[v0] Chart data fetch error:", err)
    }
  }, [onChartDataReady, prioritizeChat])

  useEffect(() => {
    if (prioritizeChat) {
      // Fetch chat first, then chart
      fetchChatData()
    } else {
      // Fetch both in parallel
      fetchChatData()
      fetchChartData()
    }
  }, [fetchChatData, fetchChartData, prioritizeChat])

  const refetch = useCallback(async () => {
    chatFetchedRef.current = false
    chartFetchedRef.current = false
    await fetchChatData()
  }, [fetchChatData])

  return {
    ...state,
    refetch,
    isLoading: state.isLoadingChat || state.isLoadingChart,
    hasError: !!state.chatError || !!state.chartError,
  }
}
