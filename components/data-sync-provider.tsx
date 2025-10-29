"use client"

import type React from "react"
import { createContext, useContext, type ReactNode } from "react"
import { useDataOrchestrator, type DataOrchestrationState } from "@/hooks/use-data-orchestrator"

interface DataSyncContextType extends DataOrchestrationState {
  refetch: () => Promise<void>
  isLoading: boolean
  hasError: boolean
}

const DataSyncContext = createContext<DataSyncContextType | undefined>(undefined)

interface DataSyncProviderProps {
  children: ReactNode
  prioritizeChat?: boolean
}

export const DataSyncProvider: React.FC<DataSyncProviderProps> = ({ children, prioritizeChat = true }) => {
  const orchestrator = useDataOrchestrator({ prioritizeChat })

  return <DataSyncContext.Provider value={orchestrator}>{children}</DataSyncContext.Provider>
}

export const useDataSync = () => {
  const context = useContext(DataSyncContext)
  if (!context) {
    throw new Error("useDataSync must be used within DataSyncProvider")
  }
  return context
}
