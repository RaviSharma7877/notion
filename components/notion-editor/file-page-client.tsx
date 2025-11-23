"use client"

import React, { useCallback, useEffect, useMemo, useState } from "react"
import NotionEditor from "@/components/notion-editor/notion-editor"
import type { FileDto } from "@/lib/queries"
import { getFile } from "@/lib/queries"
import { Button } from "@/components/ui/button"
import { useAppState } from "@/lib/providers/state-provider"
import AiAssistant from "@/components/ai/ai-assistant"

interface FilePageClientProps {
  workspaceId: string
  folderId: string
  fileId: string
}

type LoadStatus = "idle" | "loading" | "error" | "success"

const FilePageClient: React.FC<FilePageClientProps> = ({ workspaceId, folderId, fileId }) => {
  const { dispatch, state } = useAppState()
  const [status, setStatus] = useState<LoadStatus>("loading")
  const [file, setFile] = useState<FileDto | null>(null)
  const [errorMessage, setErrorMessage] = useState<string>("")

  const fetchFile = useCallback(async () => {
    setStatus("loading")
    try {
      const result = await getFile(fileId)
      console.log("[FilePageClient] Received file from backend:", result)
      
      // Log database data if present
      if (result?.data) {
        try {
          const parsedData = typeof result.data === 'string' ? JSON.parse(result.data) : result.data
          const databaseBlocks = Array.isArray(parsedData) 
            ? parsedData.filter((b: any) => b.type?.startsWith('database_'))
            : []
          if (databaseBlocks.length > 0) {
            console.log("[FilePageClient] File has database blocks:", {
              databaseBlocks: databaseBlocks.map((b: any) => ({
                type: b.type,
                id: b.id,
                recordsCount: b.records?.length ?? 0,
                hasRecords: !!b.records,
                records: b.records
              }))
            })
          }
        } catch (e) {
          console.error("[FilePageClient] Failed to parse data:", e)
        }
      }
      
      if (!result) {
        throw new Error("Missing file")
      }
      setFile(result)
      dispatch({
        type: "UPDATE_FILE",
        payload: {
          workspaceId: result.workspaceId ?? workspaceId,
          folderId: result.folderId ?? folderId,
          fileId: result.id,
          file: result,
        },
      })
      setStatus("success")
    } catch (error) {
      console.error("Failed to load file", error)
      setErrorMessage(error instanceof Error ? error.message : "Unable to load this file right now.")
      setStatus("error")
    }
  }, [dispatch, fileId, folderId, workspaceId])

  useEffect(() => {
    fetchFile()
  }, [fetchFile])

  const workspaceTitle = useMemo(() => {
    if (!file) return undefined
    const targetWorkspaceId = file.workspaceId ?? workspaceId
    const workspace = state.workspaces.find((entry) => entry.id === targetWorkspaceId)
    return workspace?.title
  }, [file, state.workspaces, workspaceId])

  if (status === "loading" || status === "idle") {
    return (
      <div className="flex h-full min-h-[60vh] flex-col items-center justify-center gap-6" data-testid="file-loading">
        <div className="relative h-16 w-16">
          <div className="absolute inset-0 animate-spin rounded-full border-4 border-muted border-t-primary" />
          <div className="absolute inset-3 rounded-full bg-muted/40" />
        </div>
        <div className="flex flex-col items-center gap-2 text-sm text-muted-foreground">
          <span>Loading your document…</span>
          <span className="text-xs text-muted-foreground/80">Please hold on while we fetch the latest content.</span>
        </div>
      </div>
    )
  }

  if (status === "error") {
    return (
      <div className="flex h-full min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
        <div className="space-y-2">
          <h2 className="text-lg font-semibold text-foreground">We couldn’t open this file</h2>
          <p className="max-w-sm text-sm text-muted-foreground">{errorMessage}</p>
        </div>
        <Button variant="default" size="sm" onClick={fetchFile}>
          Try again
        </Button>
      </div>
    )
  }

  if (!file) {
    return null
  }

  return (
    <>
      <div className="relative">
        <NotionEditor dirType="file" fileId={fileId} dirDetails={file} />
      </div>
      <AiAssistant workspaceId={workspaceId} folderId={folderId} fileId={fileId} workspaceTitle={workspaceTitle ?? file.title} />
    </>
  )
}

export default FilePageClient
