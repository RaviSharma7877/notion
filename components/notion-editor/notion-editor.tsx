"use client"

import React, { useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react"
import { useAppState } from "@/lib/providers/state-provider"
import type { appFoldersType, appWorkspacesType } from "@/lib/providers/state-provider"
import type { FileDto, FolderDto, UserDto, WorkspaceDto } from "@/lib/queries"
import { usePathname, useRouter } from "next/navigation"
import { useSocket } from "@/lib/providers/socket-provider"
import { useAuth } from "@/lib/providers/auth-provider"
import { useToast } from "../ui/use-toast"
import { getFile, updateFile, updateFolder, updateWorkspace } from "@/lib/queries"
import { Button } from "../ui/button"
import { Input } from "../ui/input"
import { Badge } from "../ui/badge"
import { Loader2, GripVertical } from "lucide-react"
import Image from "next/image"
import EmojiPicker from "../global/emoji-picker"
import BannerUpload from "../banner-upload/banner-upload"
import type { Block, BlockType, NotionEditorState } from "@/lib/notion-types"
import { BlockRenderer } from "@/components/notion-editor/block-renderer"
import { CommandPalette } from "@/components/notion-editor/command-palette"
import { BlockToolbar } from "@/components/notion-editor/block-toolbar"
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd"

export interface NotionEditorHandle {
  flushPending: () => Promise<void>
  addBlock: (type: BlockType, afterBlockId?: string) => void
  deleteBlock: (blockId: string) => void
  updateBlock: (blockId: string, updates: Partial<Block>) => void
  duplicateBlock: (blockId: string) => void
}

interface NotionEditorProps {
  dirDetails: FileDto | FolderDto | WorkspaceDto
  fileId: string
  dirType: "workspace" | "folder" | "file"
}

function colorFromId(id: string): string {
  let hash = 0
  for (let index = 0; index < id.length; index += 1) {
    hash = id.charCodeAt(index) + ((hash << 5) - hash)
    hash |= 0
  }
  const hue = Math.abs(hash) % 360
  return `hsl(${hue}, 70%, 55%)`
}

const NotionEditor = React.forwardRef<NotionEditorHandle, NotionEditorProps>(({ dirDetails, dirType, fileId }, ref) => {
  const { state, workspaceId, folderId, dispatch } = useAppState()
  const { user } = useAuth()
  const router = useRouter()
  const { socket } = useSocket()
  const pathname = usePathname()
  const { toast } = useToast()

  // State management
  const [editorState, setEditorState] = useState<NotionEditorState>({
    blocks: [],
    selectedBlockId: null,
    focusedBlockId: null,
    isComposing: false,
    lastModified: new Date().toISOString(),
  })

  const [titleInput, setTitleInput] = useState(dirDetails.title ?? "")
  const [collaborators, setCollaborators] = useState<UserDto[]>([])
  const [displayIcon, setDisplayIcon] = useState<string>(dirDetails.iconId ?? "")
  const [deletingBanner, setDeletingBanner] = useState(false)
  const [saving, setSaving] = useState(false)
  const [hasPending, setHasPending] = useState(false)
  const [showCommandPalette, setShowCommandPalette] = useState(false)
  const [commandTargetBlockId, setCommandTargetBlockId] = useState<string | null>(null)
  const [bannerRefreshKey, setBannerRefreshKey] = useState(0)
  const [localBannerUrl, setLocalBannerUrl] = useState<string | null>(null)

  // Refs
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pendingUpdateRef = useRef<Partial<WorkspaceDto & FolderDto & FileDto>>({})
  const pendingContentRef = useRef<number>(0)
  const documentVersionRef = useRef<number>(0)
  const disposedRef = useRef<boolean>(false)
  const collaboratorMapRef = useRef<Map<string, string>>(new Map())
  const isDraggingRef = useRef<boolean>(false)

  // Generate unique ID for blocks
  const generateId = useCallback(() => {
    return Math.random().toString(36).substr(2, 9)
  }, [])

  // Create a new block
  const createBlock = useCallback(
    (type: BlockType, content = ""): Block => {
      const now = new Date().toISOString()
      const baseBlock = {
        id: generateId(),
        type,
        content,
        createdAt: now,
        updatedAt: now,
      }

      switch (type) {
        case "paragraph":
          return { ...baseBlock, type: "paragraph" }
        case "heading1":
        case "heading2":
        case "heading3":
          return { ...baseBlock, type }
        case "bulleted_list":
        case "numbered_list":
          return { ...baseBlock, type, items: [] }
        case "todo":
          return { ...baseBlock, type: "todo", checked: false }
        case "toggle":
          return { ...baseBlock, type: "toggle", isOpen: false, children: [] }
        case "quote":
          return { ...baseBlock, type: "quote" }
        case "code":
          return { ...baseBlock, type: "code", language: "javascript" }
        case "callout":
          return { ...baseBlock, type: "callout", icon: "💡", color: "default" }
        case "divider":
          return { ...baseBlock, type: "divider", content: "" }
        case "table_of_contents":
          return { ...baseBlock, type: "table_of_contents", content: "", headings: [] }
        case "page":
          return { ...baseBlock, type: "page", pageId: "", pageTitle: "" }
        case "image":
          return { ...baseBlock, type: "image", content: "", url: "", alt: "", caption: "" }
        case "video":
          return { ...baseBlock, type: "video", content: "", url: "", provider: "direct", caption: "" }
        case "audio":
          return { ...baseBlock, type: "audio", content: "", url: "", caption: "" }
        case "file":
          return { ...baseBlock, type: "file", content: "", url: "", filename: "", size: 0, mimeType: "" }
        case "bookmark":
          return { ...baseBlock, type: "bookmark", content: "", url: "", title: "", description: "", image: "" }
        case "embed":
          return { ...baseBlock, type: "embed", content: "", url: "", provider: "other", title: "" }
        case "synced_block":
          return { ...baseBlock, type: "synced_block", content: "", originalBlockId: "", isOriginal: true }
        case "template_button":
          return { ...baseBlock, type: "template_button", templateBlocks: [] }
        case "breadcrumb":
          return { ...baseBlock, type: "breadcrumb", content: "", path: [] }
        case "equation":
          return { ...baseBlock, type: "equation", latex: "" }
        case "database_table":
          return {
            ...baseBlock,
            type: "database_table",
            content: "",
            databaseId: generateId(),
            viewType: "table",
            properties: [{ id: generateId(), name: "Title", type: "title" }],
            records: [],
          } as Block
        case "database_board":
          return {
            ...baseBlock,
            type: "database_board",
            content: "",
            databaseId: generateId(),
            viewType: "board",
            properties: [
              { id: generateId(), name: "Title", type: "title" },
              { id: generateId(), name: "Status", type: "select", options: ["To Do", "In Progress", "Done"] },
            ],
            records: [],
          } as Block
        case "database_gallery":
          return {
            ...baseBlock,
            type: "database_gallery",
            content: "",
            databaseId: generateId(),
            viewType: "gallery",
            properties: [{ id: generateId(), name: "Title", type: "title" }],
            records: [],
          } as Block
        case "database_list":
          return {
            ...baseBlock,
            type: "database_list",
            content: "",
            databaseId: generateId(),
            viewType: "list",
            properties: [{ id: generateId(), name: "Title", type: "title" }],
            records: [],
          } as Block
        case "database_calendar":
          return {
            ...baseBlock,
            type: "database_calendar",
            content: "",
            databaseId: generateId(),
            viewType: "calendar",
            properties: [
              { id: generateId(), name: "Title", type: "title" },
              { id: generateId(), name: "Date", type: "date" },
            ],
            records: [],
          } as Block
        case "database_timeline":
          return {
            ...baseBlock,
            type: "database_timeline",
            content: "",
            databaseId: generateId(),
            viewType: "timeline",
            properties: [
              { id: generateId(), name: "Title", type: "title" },
              { id: generateId(), name: "Start", type: "date" },
              { id: generateId(), name: "End", type: "date" },
            ],
            records: [],
          } as Block
        case "database_chart":
          return {
            ...baseBlock,
            type: "database_chart",
            content: "",
            databaseId: generateId(),
            viewType: "chart",
            properties: [
              { id: generateId(), name: "Title", type: "title" },
              { id: generateId(), name: "Value", type: "number" },
            ],
            records: [],
          } as Block
        default:
          return { ...baseBlock, type: "paragraph" }
      }
    },
    [generateId],
  )

  // Block management functions
  const addBlock = useCallback(
    (type: BlockType, afterBlockId?: string) => {
      const newBlock = createBlock(type)
      setEditorState((prev): NotionEditorState => {
        const newBlocks = [...prev.blocks]
        if (afterBlockId) {
          const index = newBlocks.findIndex((block) => block.id === afterBlockId)
          if (index !== -1) {
            newBlocks.splice(index + 1, 0, newBlock)
          } else {
            newBlocks.push(newBlock)
          }
        } else {
          newBlocks.push(newBlock)
        }
        return {
          ...prev,
          blocks: newBlocks as Block[],
          selectedBlockId: newBlock.id,
          focusedBlockId: newBlock.id,
          lastModified: new Date().toISOString(),
        }
      })
    },
    [createBlock],
  )

  const addParagraphBelow = useCallback(
    (afterBlockId: string, type?: BlockType, focusNewBlock = true) => {
      setEditorState((prev): NotionEditorState => {
        const newBlocks = [...prev.blocks]
        const afterIndex = newBlocks.findIndex((block) => block.id === afterBlockId)
        const nextType: BlockType =
          type === "bulleted_list" || type === "numbered_list" || type === "todo" || type === "toggle"
            ? type
            : "paragraph"
        const newBlock = createBlock(nextType)

        if (nextType === "numbered_list") {
          const currentBlock = afterIndex !== -1 ? newBlocks[afterIndex] : undefined
          const currentIndex = (currentBlock as any)?.listIndex || 1
          ;(newBlock as any).listIndex = currentIndex + 1
        }

        if (afterIndex !== -1) {
          newBlocks.splice(afterIndex + 1, 0, newBlock)
        } else {
          newBlocks.push(newBlock)
        }

        const focusTargetId = focusNewBlock || afterIndex === -1 ? newBlock.id : afterBlockId

        return {
          ...prev,
          blocks: newBlocks as Block[],
          selectedBlockId: focusTargetId,
          focusedBlockId: focusTargetId,
          lastModified: new Date().toISOString(),
        }
      })
    },
    [createBlock],
  )

  const deleteBlock = useCallback((blockId: string) => {
    setEditorState((prev): NotionEditorState => {
      const newBlocks = prev.blocks.filter((block) => block.id !== blockId)
      return {
        ...prev,
        blocks: newBlocks as Block[],
        selectedBlockId: null,
        focusedBlockId: null,
        lastModified: new Date().toISOString(),
      }
    })
  }, [])

  const updateBlock = useCallback((blockId: string, updates: Partial<Block>) => {
    setEditorState((prev): NotionEditorState => {
      const newBlocks = prev.blocks.map((block) =>
        block.id === blockId ? { ...block, ...updates, updatedAt: new Date().toISOString() } : block,
      )
      return {
        ...prev,
        blocks: newBlocks as Block[],
        lastModified: new Date().toISOString(),
      }
    })
  }, [])

  const duplicateBlock = useCallback(
    (blockId: string) => {
      const blockToDuplicate = editorState.blocks.find((block) => block.id === blockId)
      if (!blockToDuplicate) return

      const duplicatedBlock = {
        ...blockToDuplicate,
        id: generateId(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }

      setEditorState((prev): NotionEditorState => {
        const blockIndex = prev.blocks.findIndex((block) => block.id === blockId)
        const newBlocks = [...prev.blocks]
        newBlocks.splice(blockIndex + 1, 0, duplicatedBlock)
        return {
          ...prev,
          blocks: newBlocks as Block[],
          selectedBlockId: duplicatedBlock.id,
          focusedBlockId: duplicatedBlock.id,
          lastModified: new Date().toISOString(),
        }
      })
    },
    [editorState.blocks, generateId],
  )

  const moveBlock = useCallback((blockId: string, newIndex: number) => {
    setEditorState((prev): NotionEditorState => {
      const newBlocks = [...prev.blocks]
      const currentIndex = newBlocks.findIndex((block) => block.id === blockId)

      if (currentIndex === -1 || newIndex < 0 || newIndex > newBlocks.length) {
        return prev as NotionEditorState
      }

      const blockToMove = newBlocks[currentIndex]
      const isEmpty =
        !blockToMove.content || (typeof blockToMove.content === "string" && blockToMove.content.trim() === "")
      if (isEmpty && currentIndex === newIndex) {
        return prev as NotionEditorState
      }

      if (blockToMove.type === "paragraph" && isEmpty) {
        console.log("[v0] Skipping move of empty paragraph block")
        return prev as NotionEditorState
      }

      const [movedBlock] = newBlocks.splice(currentIndex, 1)
      newBlocks.splice(newIndex, 0, movedBlock)

      const updatedState = {
        ...prev,
        blocks: newBlocks as Block[],
        lastModified: new Date().toISOString(),
      }

      // Queue the update to persist the new block order
      pendingUpdateRef.current = {
        ...pendingUpdateRef.current,
        data: JSON.stringify(newBlocks),
      }

      return updatedState
    })
  }, [])

  // Expose methods via ref
  useImperativeHandle(
    ref,
    () => ({
      flushPending: async () => {
        if (saveTimerRef.current) {
          clearTimeout(saveTimerRef.current)
        }
        await flushPending()
      },
      addBlock,
      deleteBlock,
      updateBlock,
      duplicateBlock,
    }),
    [addBlock, deleteBlock, updateBlock, duplicateBlock],
  )

  // Rest of the component logic (similar to QuillEditor but adapted for blocks)
  const details = useMemo(() => {
    let selectedDir
    if (dirType === "file") {
      selectedDir = state.workspaces
        .find((workspace) => workspace.id === workspaceId)
        ?.folders.find((folder) => folder.id === folderId)
        ?.files.find((file) => file.id === fileId)
    }
    if (dirType === "folder") {
      selectedDir = state.workspaces
        .find((workspace) => workspace.id === workspaceId)
        ?.folders.find((folder) => folder.id === fileId)
    }
    if (dirType === "workspace") {
      selectedDir = state.workspaces.find((workspace) => workspace.id === fileId)
    }

    const result = selectedDir
      ? (selectedDir as WorkspaceDto | FolderDto | FileDto)
      : (dirDetails as WorkspaceDto | FolderDto | FileDto)

    // Use local banner URL if available, otherwise use the result
    const finalResult = localBannerUrl !== null ? { ...result, bannerUrl: localBannerUrl } : result

    console.log("Details memo updated:", {
      bannerUrl: finalResult.bannerUrl,
      fileId,
      fromState: !!selectedDir,
      bannerRefreshKey,
      localBannerUrl,
    })

    return finalResult
  }, [state.workspaces, workspaceId, folderId, dirDetails, dirType, fileId, bannerRefreshKey, localBannerUrl])

  const breadCrumbs = useMemo(() => {
    if (!pathname || !state.workspaces || !workspaceId) return
    const segments = pathname.split("/").filter((val) => val !== "dashboard" && val)
    const workspaceDetails = state.workspaces.find((workspace) => workspace.id === workspaceId)
    const workspaceBreadCrumb = workspaceDetails ? `${workspaceDetails.iconId} ${workspaceDetails.title}` : ""
    if (segments.length === 1) {
      return workspaceBreadCrumb
    }

    const folderSegment = segments[1]
    const folderDetails = workspaceDetails?.folders.find((folder) => folder.id === folderSegment)
    const folderBreadCrumb = folderDetails ? `/ ${folderDetails.iconId} ${folderDetails.title}` : ""

    if (segments.length === 2) {
      return `${workspaceBreadCrumb} ${folderBreadCrumb}`
    }

    const fileSegment = segments[2]
    const fileDetails = folderDetails?.files.find((file) => file.id === fileSegment)
    const fileBreadCrumb = fileDetails ? `/ ${fileDetails.iconId} ${fileDetails.title}` : ""

    return `${workspaceBreadCrumb} ${folderBreadCrumb} ${fileBreadCrumb}`
  }, [state.workspaces, pathname, workspaceId, folderId, fileId])

  // Update and save functions (similar to QuillEditor)
  const applyLocalUpdate = useCallback(
    (update: Partial<WorkspaceDto & FolderDto & FileDto>) => {
      if (dirType === "workspace") {
        dispatch({
          type: "UPDATE_WORKSPACE",
          payload: {
            workspaceId: fileId,
            workspace: update as Partial<appWorkspacesType>,
          },
        })
        return
      }
      if (dirType === "folder") {
        if (!workspaceId) return
        dispatch({
          type: "UPDATE_FOLDER",
          payload: {
            workspaceId,
            folderId: fileId,
            folder: update as Partial<appFoldersType>,
          },
        })
        return
      }
      if (!workspaceId || !folderId) return
      dispatch({
        type: "UPDATE_FILE",
        payload: {
          workspaceId,
          folderId,
          fileId,
          file: update as Partial<FileDto>,
        },
      })
    },
    [dirType, dispatch, fileId, folderId, workspaceId],
  )

  const syncPendingIndicators = useCallback(() => {
    const hasMetadataPending = Object.keys(pendingUpdateRef.current).length > 0
    const hasContentPending = pendingContentRef.current > 0
    if (hasMetadataPending || hasContentPending) {
      setHasPending(true)
      setSaving(true)
    } else {
      setHasPending(false)
      setSaving(false)
    }
  }, [])

  const flushPending = useCallback(async () => {
    if (!fileId) return
    const payload = pendingUpdateRef.current
    if (!payload || Object.keys(payload).length === 0) {
      if (!disposedRef.current) {
        setHasPending(false)
        setSaving(false)
      }
      return
    }

    pendingUpdateRef.current = {}

    try {
      // Ensure required fields for validation
      const ensuredTitle = (payload.title as string) || titleInput || details.title || "Untitled"
      const ensuredIconId = (payload.iconId as string) || displayIcon || details.iconId || "📄"

      const updatePayload = { ...payload, title: ensuredTitle, iconId: ensuredIconId }
      console.log("Updating file with payload:", updatePayload)

      if (dirType === "workspace") {
        await updateWorkspace(fileId, updatePayload as Partial<WorkspaceDto>)
      } else if (dirType === "folder") {
        if (!workspaceId) return
        await updateFolder(fileId, { ...updatePayload, workspaceId } as Partial<FolderDto>)
      } else {
        if (!workspaceId || !folderId) return
        await updateFile(fileId, { ...updatePayload, workspaceId, folderId } as Partial<FileDto>)
      }
    } catch (error) {
      console.error("Failed to persist editor changes", error)
      pendingUpdateRef.current = { ...payload, ...pendingUpdateRef.current }
      toast({
        title: "Unable to save changes",
        description: "Please try again in a moment.",
        variant: "destructive",
      })
    } finally {
      if (!disposedRef.current) {
        syncPendingIndicators()
      }
    }
  }, [dirType, fileId, toast, syncPendingIndicators])

  const queueUpdate = useCallback(
    (update: Partial<WorkspaceDto & FolderDto & FileDto>) => {
      pendingUpdateRef.current = {
        ...pendingUpdateRef.current,
        ...update,
      }
      if (!disposedRef.current) {
        syncPendingIndicators()
      }
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current)
      }
      saveTimerRef.current = setTimeout(() => {
        flushPending().catch(() => undefined)
      }, 850)
    },
    [flushPending, syncPendingIndicators],
  )

  const handleManualSave = useCallback(async () => {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current)
    }
    setSaving(true)
    await flushPending()
  }, [flushPending])

  // Ensure there is exactly one trailing blank paragraph
  const ensureTrailingBlankAndFocus = useCallback(
    (focusNewBlank = true) => {
      if (isDraggingRef.current) return
      const blocks = editorState.blocks
      if (!blocks || blocks.length === 0) {
        addBlock("paragraph")
        return
      }
      const last = blocks[blocks.length - 1]
      const lastIsEmpty = !last.content || (typeof last.content === "string" && last.content.trim() === "")
      if (lastIsEmpty) {
        if (focusNewBlank) {
          setEditorState((prev) => ({ ...prev, selectedBlockId: last.id, focusedBlockId: last.id }))
        }
      } else {
        addParagraphBelow(last.id, "paragraph", focusNewBlank)
      }
    },
    [editorState.blocks, addBlock, addParagraphBelow],
  )

  const handleBlockBlur = useCallback(
    (blockId: string) => {
      if (isDraggingRef.current) return
      const blocks = editorState.blocks
      if (!blocks || blocks.length === 0) return

      const lastBlock = blocks[blocks.length - 1]
      if (lastBlock.id !== blockId) return

      ensureTrailingBlankAndFocus()
    },
    [editorState.blocks, ensureTrailingBlankAndFocus],
  )

  useEffect(() => {
    if (editorState.blocks.length === 0) return
    const lastBlock = editorState.blocks[editorState.blocks.length - 1]
    const lastIsEmpty = !lastBlock.content || (typeof lastBlock.content === "string" && lastBlock.content.trim() === "")
    if (!lastIsEmpty) {
      ensureTrailingBlankAndFocus(false)
    }
  }, [editorState.blocks, ensureTrailingBlankAndFocus])

  const handleTitleChange = useCallback(
    (value: string) => {
      if (value === titleInput) return
      setTitleInput(value)
      applyLocalUpdate({ title: value })
      queueUpdate({ title: value })
    },
    [applyLocalUpdate, queueUpdate, titleInput],
  )

  // Load blocks from data
  useEffect(() => {
    if (details.data && !isDraggingRef.current) {
      try {
        const parsedBlocks = JSON.parse(details.data) as Block[]
        if (Array.isArray(parsedBlocks)) {
          setEditorState((prev) => {
            // Only update if blocks have actually changed
            const blocksChanged = JSON.stringify(prev.blocks) !== JSON.stringify(parsedBlocks)
            if (blocksChanged) {
              return {
                ...prev,
                blocks: parsedBlocks as Block[],
              }
            }
            return prev
          })
        }
      } catch (error) {
        console.error("Failed to parse blocks data", error)
      }
    }
  }, [details.data])

  // Keep title input in sync with store changes (e.g., sidebar edits)
  useEffect(() => {
    const nextTitle = details.title ?? ""
    if (nextTitle !== titleInput) {
      setTitleInput(nextTitle)
    }
  }, [details.title, titleInput])

  // Debug: Log when details change
  useEffect(() => {
    console.log("NotionEditor details changed:", {
      title: details.title,
      iconId: details.iconId,
      dirType,
      fileId,
      fromState: state.workspaces
        .find((w) => w.id === workspaceId)
        ?.folders.find((f) => f.id === folderId)
        ?.files.find((f) => f.id === fileId),
    })
  }, [details.title, details.iconId, dirType, fileId, workspaceId, folderId, state.workspaces])

  // Keep icon in sync with store changes (e.g., sidebar edits)
  useEffect(() => {
    const nextIcon = details.iconId ?? ""
    if (nextIcon !== displayIcon) {
      setDisplayIcon(nextIcon)
    }
  }, [details.iconId, displayIcon])

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "/" && !showCommandPalette) {
        e.preventDefault()
        setCommandTargetBlockId((prev) => editorState.focusedBlockId ?? prev)
        setShowCommandPalette(true)
      }
      if (e.key === "Escape") {
        setShowCommandPalette(false)
      }
    }

    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [showCommandPalette])

  // Initialize with a default paragraph block if empty
  useEffect(() => {
    if (editorState.blocks.length === 0) {
      const defaultBlock = createBlock("paragraph", "")
      setEditorState((prev) => ({
        ...prev,
        blocks: [defaultBlock],
      }))
    }
  }, [editorState.blocks.length, createBlock])

  // Sync local banner state with details when file changes
  useEffect(() => {
    if (details.bannerUrl !== localBannerUrl) {
      setLocalBannerUrl(details.bannerUrl)
    }
  }, [details.bannerUrl, localBannerUrl])

  return (
    <>
      <div className="relative">
        {details.inTrash && (
          <article className="py-2 z-40 bg-[#EB5757] flex md:flex-row flex-col justify-center items-center gap-4 flex-wrap">
            <div className="flex flex-col md:flex-row gap-2 justify-center items-center">
              <span className="text-white">This {dirType} is in the trash.</span>
              <Button
                size="sm"
                variant="outline"
                className="bg-transparent border-white text-white hover:bg-white hover:text-[#EB5757]"
                onClick={() => {
                  /* restore logic */
                }}
              >
                Restore
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="bg-transparent border-white text-white hover:bg-white hover:text-[#EB5757]"
                onClick={() => {
                  /* delete logic */
                }}
              >
                Delete
              </Button>
            </div>
            <span className="text-sm text-white">{details.inTrash}</span>
          </article>
        )}

        <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between border-b border-border/50 bg-background/60 backdrop-blur supports-backdrop-filter:bg-background/60">
          <div className="flex flex-col gap-1 text-xs text-muted-foreground">
            <span>{breadCrumbs}</span>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Button
              size="sm"
              type="button"
              variant="secondary"
              disabled={!hasPending && !saving}
              onClick={handleManualSave}
              className="h-7 px-3 flex items-center gap-2"
            >
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Saving
                </>
              ) : (
                "Save"
              )}
            </Button>
            <Badge
              variant={saving ? "secondary" : "outline"}
              className={
                saving
                  ? "bg-orange-500 text-white shadow-none h-6"
                  : hasPending
                    ? "text-foreground h-6"
                    : "border-emerald-500 text-emerald-600 h-6"
              }
            >
              {saving ? "Saving…" : hasPending ? "Pending changes" : "Saved"}
            </Badge>
          </div>
        </div>
      </div>

      {details.bannerUrl && (
        <div className="relative w-full h-[200px]">
          <Image
            src={details.bannerUrl || "/placeholder.svg"}
            fill
            className="w-full md:h-48 h-20 object-cover"
            alt="Banner Image"
          />
          <div className="absolute right-4 top-2 flex gap-2">
            <BannerUpload
              id={fileId}
              dirType={dirType}
              className="text-xs px-2 py-1 rounded-md bg-white/70 hover:bg-white text-foreground"
              onBannerUpdate={(bannerUrl) => {
                // Update local banner state immediately
                setLocalBannerUrl(bannerUrl)
                // Force re-render of banner display
                setBannerRefreshKey((prev) => prev + 1)
              }}
            >
              Change
            </BannerUpload>
            <Button
              size="sm"
              variant="secondary"
              className="text-xs px-2 py-1 bg-white/70 hover:bg-white"
              disabled={deletingBanner}
              onClick={async () => {
                try {
                  setDeletingBanner(true)
                  if (dirType === "file") {
                    if (!workspaceId || !folderId) return
                    // Get current file data to include required fields
                    const currentFile = await getFile(fileId)
                    await updateFile(fileId, {
                      ...currentFile,
                      bannerUrl: null,
                      workspaceId,
                      folderId,
                    })
                    // Update local state immediately
                    setLocalBannerUrl(null)
                    dispatch({
                      type: "UPDATE_FILE",
                      payload: {
                        file: { bannerUrl: null },
                        fileId,
                        folderId,
                        workspaceId,
                      },
                    })
                    // Force re-render of banner display
                    setBannerRefreshKey((prev) => prev + 1)
                    console.log("Banner deleted successfully - bannerUrl set to null")
                    console.log("State after delete:", { fileId, folderId, workspaceId })
                  }
                } catch (error) {
                  console.error("Failed to delete banner", error)
                  alert("Failed to delete banner: " + (error instanceof Error ? error.message : "Unknown error"))
                } finally {
                  setDeletingBanner(false)
                }
              }}
            >
              {deletingBanner ? "Removing…" : "Remove"}
            </Button>
          </div>
        </div>
      )}

      <div className="flex justify-center items-center flex-col mt-2 relative">
        <div className="w-full self-center max-w-[900px] flex flex-col px-6 lg:my-8 font-sans text-[16px] leading-[24px] text-[#373530] dark:text-[#D4D4D4]">
          <div className="text-[64px] leading-none">
            <EmojiPicker
              getValue={(icon) => {
                // Local immediate update
                setDisplayIcon(icon)
                applyLocalUpdate({ iconId: icon })
                // Persist with required fields
                const ensuredTitle = titleInput || details.title || "Untitled"
                if (dirType === "workspace") {
                  queueUpdate({ iconId: icon, title: ensuredTitle })
                } else if (dirType === "folder") {
                  if (!workspaceId) return
                  queueUpdate({ iconId: icon, title: ensuredTitle, workspaceId })
                } else {
                  if (!workspaceId || !folderId) return
                  queueUpdate({ iconId: icon, title: ensuredTitle, workspaceId, folderId })
                }
              }}
            >
              <div className="w-[84px] h-[84px] cursor-pointer transition-colors flex items-center justify-center hover:bg-muted rounded-lg">
                {displayIcon}
              </div>
            </EmojiPicker>
          </div>

          <div className="flex">
            <BannerUpload
              id={fileId}
              dirType={dirType}
              className="mt-2 text-xs text-muted-foreground px-2 py-1 hover:text-card-foreground transition-all rounded-md"
              onBannerUpdate={(bannerUrl) => {
                // Update local banner state immediately
                setLocalBannerUrl(bannerUrl)
                // Force re-render of banner display
                setBannerRefreshKey((prev) => prev + 1)
              }}
            >
              {details.bannerUrl ? "Update Banner" : "Add Banner"}
            </BannerUpload>
          </div>

          <Input
            value={titleInput}
            onChange={(event) => handleTitleChange(event.target.value)}
            aria-label={`${dirType} title`}
            className="mt-4 w-full max-w-3xl border-none bg-transparent px-0 text-[32px] leading-tight font-semibold text-foreground shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
            placeholder="Untitled"
          />
          <span className="text-muted-foreground text-xs mt-1">{dirType.toUpperCase()}</span>
        </div>

        <div
          className="max-w-[900px] relative w-full pb-32 sm:pb-40 cursor-text"
          onMouseDown={(e) => {
            const target = e.target as HTMLElement
            if (target.closest(".notion-block") || target.closest('button,[role="button"],input,textarea')) return
            if (isDraggingRef.current) return
            e.preventDefault()
            ensureTrailingBlankAndFocus()
          }}
          aria-label="Document container"
        >
          <DragDropContext
            onDragStart={() => {
              isDraggingRef.current = true
              const activeElement = document.activeElement as HTMLElement
              if (activeElement && activeElement !== document.body) {
                activeElement.blur()
              }
            }}
            onDragEnd={(result) => {
              isDraggingRef.current = false
              if (!result.destination) {
                console.log("[v0] Drag cancelled - no valid destination")
                return
              }

              if (result.destination.index < 0 || result.destination.index > editorState.blocks.length) {
                console.log("[v0] Drag cancelled - invalid destination index")
                return
              }

              moveBlock(result.draggableId, result.destination.index)
              setEditorState((prev) => ({
                ...prev,
                selectedBlockId: result.draggableId,
                focusedBlockId: result.draggableId,
              }))
            }}
          >
            <Droppable droppableId="blocks">
              {(provided) => (
                <div
                  {...provided.droppableProps}
                  ref={provided.innerRef}
                  className="space-y-2"
                  onMouseDown={(e) => {
                    const target = e.target as HTMLElement
                    if (target.closest(".notion-block")) return
                    if (isDraggingRef.current) return
                    e.preventDefault()
                    ensureTrailingBlankAndFocus()
                  }}
                  aria-label="Document area"
                >
                  {editorState.blocks.map((block, index) => (
                    <Draggable key={block.id} draggableId={block.id} index={index}>
                      {(provided, snapshot) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.draggableProps}
                          style={provided.draggableProps.style}
                          className={`group relative notion-block ${snapshot.isDragging ? "opacity-50" : ""}`}
                          onMouseDown={(e) => {
                            // Don't prevent default here - let drag handle work
                            if (!e.target.closest('[role="button"],input,textarea,.drag-handle')) {
                              e.stopPropagation()
                            }
                          }}
                        >
                          <div className="flex items-center gap-1">
                            <div
                              {...provided.dragHandleProps}
                              className="opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing p-1 rounded text-muted-foreground/80 hover:bg-muted h-6 w-6 flex items-center justify-center drag-handle"
                              onMouseDown={(e) => {
                                // This lets the drag library handle the drag initiation
                              }}
                              aria-label="Drag block"
                            >
                              <GripVertical className="h-4 w-4 text-muted-foreground" />
                            </div>
                            <div className="flex-1">
                              <BlockRenderer
                                block={block}
                                isSelected={editorState.selectedBlockId === block.id}
                                isFocused={editorState.focusedBlockId === block.id}
                                onUpdate={(updates) => updateBlock(block.id, updates)}
                                onDelete={() => deleteBlock(block.id)}
                                onDuplicate={() => duplicateBlock(block.id)}
                                onSelect={() => setEditorState((prev) => ({ ...prev, selectedBlockId: block.id }))}
                                onFocus={() => setEditorState((prev) => ({ ...prev, focusedBlockId: block.id }))}
                                onAddBelow={(nextType) => addParagraphBelow(block.id, nextType)}
                                onBlur={() => handleBlockBlur(block.id)}
                              />
                            </div>
                          </div>
                          <BlockToolbar
                            block={block}
                            onAddBlock={(type) => addBlock(type, block.id)}
                            onDelete={() => deleteBlock(block.id)}
                            onDuplicate={() => duplicateBlock(block.id)}
                            isVisible={false}
                            onOpenCommands={() => {
                              setCommandTargetBlockId(block.id)
                              setShowCommandPalette(true)
                            }}
                          />
                        </div>
                      )}
                    </Draggable>
                  ))}
                  {provided.placeholder}
                </div>
              )}
            </Droppable>
          </DragDropContext>

          {/* Click-catcher area to continue writing on background click */}
          <div
            className="mt-6 mb-16 min-h-[160px] cursor-text"
            onMouseDown={(e) => {
              if (isDraggingRef.current) return
              e.preventDefault()
              ensureTrailingBlankAndFocus()
            }}
            aria-label="Continue writing"
          />

          {editorState.blocks.length === 0 && (
            <div className="pointer-events-none absolute left-0 top-0 w-full select-none text-muted-foreground/80">
              <div className="px-4 py-3 text-sm">Type '/' for commands, or start writing...</div>
            </div>
          )}
        </div>
      </div>

      {showCommandPalette && (
        <CommandPalette
          onClose={() => setShowCommandPalette(false)}
          onSelectBlock={(type) => {
            if (commandTargetBlockId) {
              const target = editorState.blocks.find((b) => b.id === commandTargetBlockId)
              if (target && target.type === "paragraph" && (!target.content || target.content.trim() === "")) {
                updateBlock(target.id, { type: type as any } as Partial<Block>)
              } else {
                addBlock(type, commandTargetBlockId)
              }
            } else {
              addBlock(type)
            }
            setShowCommandPalette(false)
            setCommandTargetBlockId(null)
          }}
        />
      )}
    </>
  )
})

NotionEditor.displayName = "NotionEditor"

export default NotionEditor
