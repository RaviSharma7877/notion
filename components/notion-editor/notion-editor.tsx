"use client"

import React, { useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react"
import { useAppState } from "@/lib/providers/state-provider"
import type { appFoldersType, appWorkspacesType } from "@/lib/providers/state-provider"
import type { FileDto, FolderDto, UserDto, WorkspaceDto } from "@/lib/queries"
import { usePathname, useRouter } from "next/navigation"
// import { useCollaboration } from "@/lib/providers/collaboration-provider"
// import { CollaborationIndicator } from "@/components/collaboration/collaboration-indicator"
// import { CursorOverlay } from "@/components/collaboration/cursor-overlay"
// import { PresencePanel } from "@/components/collaboration/presence-panel"
// import { useCRDTOperations } from "@/hooks/use-crdt-operations"
import { useAuth } from "@/lib/providers/auth-provider"
import { useToast } from "../ui/use-toast"
import { getFile, updateFile, updateFolder, updateWorkspace, listCollaborators, getUser, createCollaborator, deleteCollaborator } from "@/lib/queries"
import { resolveWorkspaceOwnerId } from "@/lib/auth/user"
import { Button } from "../ui/button"
import { Input } from "../ui/input"
import { Badge } from "../ui/badge"
import { Loader2, GripVertical, Share2, XCircleIcon } from "lucide-react"
import Image from "next/image"
import EmojiPicker from "../global/emoji-picker"
import BannerUpload from "../banner-upload/banner-upload"
import type { Block, BlockType, NotionEditorState, TableOfContentsBlock, SyncedBlock } from "@/lib/notion-types"
import { BlockRenderer } from "@/components/notion-editor/block-renderer"
import { CommandPalette } from "@/components/notion-editor/command-palette"
import { BlockToolbar } from "@/components/notion-editor/block-toolbar"
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd"
import CollaboratorSearch from "../global/collaborator-search"
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar"

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
  // const collaboration = useCollaboration()
  const pathname = usePathname()
  const { toast } = useToast()
  
  // const crdt = useCRDTOperations(fileId, workspaceId)

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
  // const [showPresencePanel, setShowPresencePanel] = useState(false)

  // Refs
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pendingUpdateRef = useRef<Partial<WorkspaceDto & FolderDto & FileDto>>({})
  // const pendingContentRef = useRef<number>(0)
  // const documentVersionRef = useRef<number>(0)
  const disposedRef = useRef<boolean>(false)
  const collaboratorMapRef = useRef<Map<string, string>>(new Map())
  const isDraggingRef = useRef<boolean>(false)
  const lastSerializedBlocksRef = useRef<string | null>(null)
  const blocksDirtyRef = useRef<boolean>(false)
  const previousFocusedBlockRef = useRef<string | null>(null)
  const pendingDatabasePersistFrameRef = useRef<number | null>(null)
  const persistBlocksIfDirtyRef = useRef<(reason?: string, immediate?: boolean) => void>(() => {})
  const needsImmediatePersistRef = useRef<boolean>(false)
  const editorStateRef = useRef<NotionEditorState>(editorState)

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
          return {
            ...baseBlock,
            type: "code",
            language: "web",
            previewEnabled: false,
            sources: { html: "", css: "", javascript: "" },
          }
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
          return {
            ...baseBlock,
            type: "synced_block",
            content: "",
            originalBlockId: baseBlock.id,
            isOriginal: true,
          }
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
        blocksDirtyRef.current = true
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

  const buildBlockDefaults = useCallback(
    (type: BlockType): Partial<Block> => {
      const newBlock = createBlock(type)
      const { id, createdAt, updatedAt, ...rest } = newBlock
      return rest
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
        blocksDirtyRef.current = true

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
      if (newBlocks.length !== prev.blocks.length) {
        blocksDirtyRef.current = true
      }
      return {
        ...prev,
        blocks: newBlocks as Block[],
        selectedBlockId: null,
        focusedBlockId: null,
        lastModified: new Date().toISOString(),
      }
    })
  }, [])

  const scheduleDatabasePersist = useCallback(() => {
    if (!blocksDirtyRef.current) return
    if (typeof window === "undefined") {
      persistBlocksIfDirtyRef.current("database-auto-persist")
      return
    }
    if (pendingDatabasePersistFrameRef.current !== null) {
      cancelAnimationFrame(pendingDatabasePersistFrameRef.current)
    }
    pendingDatabasePersistFrameRef.current = window.requestAnimationFrame(() => {
      pendingDatabasePersistFrameRef.current = null
      persistBlocksIfDirtyRef.current("database-auto-persist")
    })
  }, [])

  const updateBlock = useCallback((blockId: string, updates: Partial<Block>) => {
    const isDatabaseBlockUpdate = updates && 'records' in updates
    
    setEditorState((prev): NotionEditorState => {
      const targetBlock = prev.blocks.find((block) => block.id === blockId)
      if (!targetBlock) {
        return prev as NotionEditorState
      }

      let mergedUpdates = updates
      if (targetBlock.type === "synced_block") {
        const syncedTarget = targetBlock as SyncedBlock
        const nextState = { ...syncedTarget, ...updates } as SyncedBlock
        if (nextState.isOriginal && (!nextState.originalBlockId || nextState.originalBlockId.trim().length === 0)) {
          mergedUpdates = { ...updates, originalBlockId: targetBlock.id }
        }
      }

      const newBlocks = prev.blocks.map((block) =>
        block.id === blockId ? { ...block, ...mergedUpdates, updatedAt: new Date().toISOString() } : block,
      )
      
      const isDatabaseBlock = targetBlock.type.startsWith('database_')
      const hasDatabaseRecordsUpdate = isDatabaseBlock && 'records' in mergedUpdates
      
      if (newBlocks !== prev.blocks) {
        blocksDirtyRef.current = true
        
        // Log database block updates
        if (hasDatabaseRecordsUpdate) {
          const updatedBlock = newBlocks.find(b => b.id === blockId)
          console.log("[NotionEditor] Database block updated with records:", {
            blockId,
            blockType: targetBlock.type,
            recordsCount: (mergedUpdates as any).records?.length ?? 0,
            actualRecords: (mergedUpdates as any).records,
            updatedBlockRecords: (updatedBlock as any)?.records
          })
          // Mark that we need immediate persistence for database updates
          needsImmediatePersistRef.current = true
        }
      }

      if (targetBlock.type === "synced_block") {
        const syncedTarget = { ...targetBlock, ...mergedUpdates } as SyncedBlock
        const propagateContent = Object.prototype.hasOwnProperty.call(mergedUpdates, "content")
        const propagateSources = Object.prototype.hasOwnProperty.call(mergedUpdates, "sources")
        const sourceId = syncedTarget.isOriginal
          ? syncedTarget.originalBlockId || syncedTarget.id
          : syncedTarget.originalBlockId || ""

        if (sourceId && (propagateContent || propagateSources)) {
          newBlocks.forEach((block, index) => {
            if (block.id === blockId || block.type !== "synced_block") return
            const candidate = block as SyncedBlock
            const candidateSourceId = candidate.isOriginal
              ? candidate.originalBlockId || candidate.id
              : candidate.originalBlockId || ""
            if (candidateSourceId !== sourceId) return

            const propagated: Partial<Block> = {}
            if (propagateContent) {
              propagated.content = (mergedUpdates as Block).content
            }
            if (propagateSources && Object.prototype.hasOwnProperty.call(mergedUpdates, "sources")) {
              ;(propagated as any).sources = (mergedUpdates as any).sources
            }
            if (Object.keys(propagated).length === 0) return

            newBlocks[index] = {
              ...block,
              ...propagated,
              updatedAt: new Date().toISOString(),
            } as Block
          })
        }
      }

      return {
        ...prev,
        blocks: newBlocks as Block[],
        lastModified: new Date().toISOString(),
      }
    })
  }, [])

  // Keep editorStateRef in sync with editorState
  useEffect(() => {
    editorStateRef.current = editorState
  }, [editorState])

  useEffect(() => {
    if (!blocksDirtyRef.current) return
    
    // Check if we need immediate persistence for database updates
    if (needsImmediatePersistRef.current) {
      needsImmediatePersistRef.current = false
      console.log("[NotionEditor] Immediate persistence triggered for database record update")
      // Use ref which should have the latest callback
      persistBlocksIfDirtyRef.current("database-immediate-persist", true)
    } else {
      // Use deferred persistence for other block types
      scheduleDatabasePersist()
    }
  }, [editorState.blocks, scheduleDatabasePersist])

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

      if (duplicatedBlock.type === "synced_block") {
        const source = blockToDuplicate as SyncedBlock
        const sourceId = source.isOriginal ? source.originalBlockId || source.id : source.originalBlockId
        ;(duplicatedBlock as SyncedBlock).isOriginal = false
        ;(duplicatedBlock as SyncedBlock).originalBlockId = sourceId || blockToDuplicate.id
      }

      setEditorState((prev): NotionEditorState => {
        const blockIndex = prev.blocks.findIndex((block) => block.id === blockId)
        const newBlocks = [...prev.blocks]
        newBlocks.splice(blockIndex + 1, 0, duplicatedBlock)
        blocksDirtyRef.current = true
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

  useEffect(() => {
    if (editorState.blocks.length === 0) return

    const headingBlocks = editorState.blocks.filter(
      (block) => block.type === "heading1" || block.type === "heading2" || block.type === "heading3",
    )

    const collectedHeadings = headingBlocks.map((heading) => {
      const content = typeof heading.content === "string" ? heading.content.trim() : ""
      return {
        id: heading.id,
        level: heading.type === "heading1" ? 1 : heading.type === "heading2" ? 2 : 3,
        content: content.length > 0 ? content : "Untitled heading",
      }
    })

    editorState.blocks.forEach((block) => {
      if (block.type !== "table_of_contents") return
      const tocBlock = block as TableOfContentsBlock
      const storedHeadings = Array.isArray(tocBlock.headings) ? tocBlock.headings : []
      const isDifferent =
        storedHeadings.length !== collectedHeadings.length ||
        storedHeadings.some((heading, index) => {
          const candidate = collectedHeadings[index]
          return (
            !candidate ||
            heading.id !== candidate.id ||
            heading.level !== candidate.level ||
            heading.content !== candidate.content
          )
        })

      if (!Array.isArray(tocBlock.headings) || isDifferent) {
        updateBlock(
          block.id,
          { headings: collectedHeadings.map((heading) => ({ ...heading })) } as Partial<Block>,
        )
      }
    })
  }, [editorState.blocks, updateBlock])

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
      blocksDirtyRef.current = true

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

    const fallback = dirDetails as WorkspaceDto | FolderDto | FileDto
    const merged = {
      ...fallback,
      ...(selectedDir ? (selectedDir as WorkspaceDto | FolderDto | FileDto) : {}),
    }

    const result: WorkspaceDto | FolderDto | FileDto = {
      ...merged,
      title: merged.title ?? fallback.title,
      iconId: merged.iconId ?? fallback.iconId,
      data: merged.data ?? fallback.data ?? null,
      bannerUrl: merged.bannerUrl ?? fallback.bannerUrl ?? null,
    }

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
    const hasPendingChanges = Object.keys(pendingUpdateRef.current).length > 0
    if (hasPendingChanges) {
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
      
      // Log what's being saved, especially for data updates
      if (updatePayload.data) {
        try {
          const parsedData = JSON.parse(updatePayload.data as string)
          const databaseBlocks = parsedData.filter((b: any) => b.type?.startsWith('database_'))
          if (databaseBlocks.length > 0) {
            console.log("[NotionEditor] Saving file with database blocks:", {
              fileId,
              dirType,
              databaseBlocks: databaseBlocks.map((b: any) => ({
                type: b.type,
                id: b.id,
                recordsCount: b.records?.length ?? 0,
                records: b.records
              }))
            })
          }
        } catch (e) {
          // Ignore parse errors
        }
      }
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
      
      console.log("[NotionEditor] Successfully saved to backend:", {
        fileId,
        dirType,
        hadDataUpdate: !!updatePayload.data
      })
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

  const persistBlocksIfDirty = useCallback(
    (reason?: string, immediate = false) => {
      if (!blocksDirtyRef.current) return
      try {
        // CRITICAL: Use ref to get the LATEST blocks, not the closure variable
        const currentBlocks = editorStateRef.current.blocks
        const serialized = JSON.stringify(currentBlocks ?? [])
        if (serialized === lastSerializedBlocksRef.current) {
          blocksDirtyRef.current = false
          return
        }
        
        // Log database blocks being persisted
        const databaseBlocks = currentBlocks.filter(b => b.type.startsWith('database_'))
        if (databaseBlocks.length > 0) {
          console.log("[NotionEditor] Persisting blocks:", {
            reason,
            immediate,
            totalBlocks: currentBlocks.length,
            databaseBlocks: databaseBlocks.map(b => ({
              type: b.type,
              id: b.id,
              recordsCount: (b as any).records?.length ?? 0,
              hasRecords: !!(b as any).records
            }))
          })
        }
        
        lastSerializedBlocksRef.current = serialized
        blocksDirtyRef.current = false
        applyLocalUpdate({ data: serialized } as Partial<WorkspaceDto & FolderDto & FileDto>)
        
        if (immediate) {
          // For database updates, save immediately without delay
          console.log("[NotionEditor] Immediate save - bypassing queue")
          pendingUpdateRef.current = {
            ...pendingUpdateRef.current,
            data: serialized
          }
          // Cancel any pending timer and flush immediately
          if (saveTimerRef.current) {
            clearTimeout(saveTimerRef.current)
            saveTimerRef.current = null
          }
          flushPending().catch(err => console.error("[NotionEditor] Failed to flush immediately:", err))
        } else {
          queueUpdate({ data: serialized })
        }
      } catch (error) {
        console.error("Failed to persist blocks", { error, reason })
      }
    },
    [applyLocalUpdate, queueUpdate, flushPending],
  )

  persistBlocksIfDirtyRef.current = persistBlocksIfDirty

  const handleManualSave = useCallback(async () => {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current)
    }
    setSaving(true)
    persistBlocksIfDirty("manual-save")
    await flushPending()
  }, [flushPending, persistBlocksIfDirty])

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
      if (lastBlock.id === blockId) {
        ensureTrailingBlankAndFocus()
      }
      persistBlocksIfDirty("block-blur")
    },
    [editorState.blocks, ensureTrailingBlankAndFocus, persistBlocksIfDirty],
  )

  useEffect(() => {
    if (editorState.blocks.length === 0) return
    const lastBlock = editorState.blocks[editorState.blocks.length - 1]
    const lastIsEmpty = !lastBlock.content || (typeof lastBlock.content === "string" && lastBlock.content.trim() === "")
    if (!lastIsEmpty) {
      ensureTrailingBlankAndFocus(false)
    }
  }, [editorState.blocks, ensureTrailingBlankAndFocus])

  useEffect(() => {
    const previous = previousFocusedBlockRef.current
    const current = editorState.focusedBlockId
    if (previous && !current) {
      persistBlocksIfDirty("focus-cleared")
    }
    previousFocusedBlockRef.current = current ?? null
  }, [editorState.focusedBlockId, persistBlocksIfDirty])

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
    if (!details.data || isDraggingRef.current) return

    try {
      const raw = details.data
      console.log("[NotionEditor] Loading data from backend:", {
        dataType: typeof raw,
        dataLength: typeof raw === 'string' ? raw.length : 'N/A',
        dataPreview: typeof raw === 'string' ? raw.substring(0, 200) : raw
      })
      
      const parsed = typeof raw === "string" ? JSON.parse(raw) : raw
      const candidateState =
        parsed && !Array.isArray(parsed) && typeof parsed === "object" ? (parsed as Partial<NotionEditorState>) : null
      const nextBlocks = Array.isArray(parsed)
        ? (parsed as Block[])
        : Array.isArray(candidateState?.blocks)
          ? (candidateState?.blocks as Block[])
          : null

      if (!nextBlocks) {
        console.warn("Unsupported editor payload shape; expected blocks array or NotionEditorState")
        return
      }
      
      // Log database blocks being loaded
      const databaseBlocks = nextBlocks.filter(b => b.type?.startsWith('database_'))
      if (databaseBlocks.length > 0) {
        console.log("[NotionEditor] Loading database blocks from backend:", {
          totalBlocks: nextBlocks.length,
          databaseBlocks: databaseBlocks.map(b => ({
            type: b.type,
            id: b.id,
            recordsCount: (b as any).records?.length ?? 0,
            records: (b as any).records,
            properties: (b as any).properties
          }))
        })
      }

      setEditorState((prev) => {
        const blocksChanged = JSON.stringify(prev.blocks) !== JSON.stringify(nextBlocks)

        const hasSelected = candidateState
          ? Object.prototype.hasOwnProperty.call(candidateState, "selectedBlockId")
          : false
        const hasFocused = candidateState
          ? Object.prototype.hasOwnProperty.call(candidateState, "focusedBlockId")
          : false
        const hasComposing = candidateState
          ? Object.prototype.hasOwnProperty.call(candidateState, "isComposing")
          : false
        const hasLastModified = candidateState
          ? Object.prototype.hasOwnProperty.call(candidateState, "lastModified")
          : false

        const nextSelectedBlockId = hasSelected ? candidateState?.selectedBlockId ?? null : prev.selectedBlockId
        const nextFocusedBlockId = hasFocused ? candidateState?.focusedBlockId ?? null : prev.focusedBlockId
        const nextIsComposing = hasComposing ? Boolean(candidateState?.isComposing) : prev.isComposing
        const nextLastModified =
          hasLastModified && typeof candidateState?.lastModified === "string"
            ? candidateState?.lastModified
            : prev.lastModified

        if (
          !blocksChanged &&
          nextSelectedBlockId === prev.selectedBlockId &&
          nextFocusedBlockId === prev.focusedBlockId &&
          nextIsComposing === prev.isComposing &&
          nextLastModified === prev.lastModified
        ) {
          return prev
        }

        lastSerializedBlocksRef.current = null
        blocksDirtyRef.current = false

        return {
          ...prev,
          blocks: nextBlocks as Block[],
          selectedBlockId: nextSelectedBlockId,
          focusedBlockId: nextFocusedBlockId,
          isComposing: nextIsComposing,
          lastModified: nextLastModified,
        }
      })
    } catch (error) {
      console.error("Failed to parse blocks data", error)
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
  const hasInitialContent = useMemo(() => {
    const raw = details.data
    if (!raw) return false
    const examine = (value: unknown): boolean => {
      if (!value) return false
      if (Array.isArray(value)) {
        return value.length > 0
      }
      if (typeof value === "object") {
        const candidate = value as Partial<NotionEditorState>
        if (Array.isArray(candidate.blocks)) {
          return candidate.blocks.length > 0
        }
        return Object.keys(candidate).length > 0
      }
      return typeof value === "string" && value.trim().length > 0
    }
    if (typeof raw === "string") {
      const trimmed = raw.trim()
      if (!trimmed || trimmed === "[]") return false
      try {
        const parsed = JSON.parse(trimmed)
        return examine(parsed)
      } catch {
        return trimmed.length > 0
      }
    }
    return examine(raw)
  }, [details.data])

  useEffect(() => {
    if (hasInitialContent) return
    if (editorState.blocks.length === 0) {
      const defaultBlock = createBlock("paragraph", "")
      setEditorState((prev) => ({
        ...prev,
        blocks: [defaultBlock],
      }))
    }
  }, [editorState.blocks.length, createBlock, hasInitialContent])

  useEffect(() => {
    lastSerializedBlocksRef.current = null
    blocksDirtyRef.current = false
  }, [fileId])

  useEffect(() => {
    return () => {
      disposedRef.current = true
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current)
      }
      if (pendingDatabasePersistFrameRef.current !== null) {
        cancelAnimationFrame(pendingDatabasePersistFrameRef.current)
      }
      persistBlocksIfDirty("unmount")
      flushPending().catch(() => undefined)
    }
  }, [flushPending, persistBlocksIfDirty])

  // Sync local banner state with details when file changes
  useEffect(() => {
    if (details.bannerUrl !== localBannerUrl) {
      setLocalBannerUrl(details.bannerUrl)
    }
  }, [details.bannerUrl, localBannerUrl])

  // Load collaborators for workspace to support Share button
  useEffect(() => {
    if (!workspaceId) return
    let active = true
    const fetchCollaborators = async () => {
      try {
        const page = await listCollaborators({ workspaceId, size: 50 })
        const entries = page.content ?? []
        collaboratorMapRef.current.clear()
        if (!entries.length) {
          if (active) setCollaborators([])
          return
        }
        const users = await Promise.all(
          entries.map(async (entry: { id: string; userId: string }) => {
            try {
              const collaborator = await getUser(entry.userId)
              if (collaborator) {
                const collaboratorKey = resolveWorkspaceOwnerId(collaborator) ?? entry.userId
                collaboratorMapRef.current.set(collaboratorKey, entry.id)
              }
              return collaborator
            } catch {
              return null
            }
          }),
        )
        if (active) setCollaborators(users.filter(Boolean) as UserDto[])
      } catch (error) {
        console.error("Failed to load collaborators", error)
      }
    }
    fetchCollaborators()
    return () => {
      active = false
    }
  }, [workspaceId])

  const handleAddCollaborator = useCallback(
    async (profile: UserDto) => {
      if (dirType !== "workspace") return
      if (!profile.id) return
      const collaboratorKey = resolveWorkspaceOwnerId(profile) ?? profile.id
      if (collaboratorMapRef.current.has(collaboratorKey)) {
        toast({ title: "Collaborator already added", description: "This user already has access to the workspace." })
        return
      }
      try {
        const created = await createCollaborator({ workspaceId: fileId, userId: collaboratorKey })
        collaboratorMapRef.current.set(collaboratorKey, created.id)
        setCollaborators((prev) => [...prev, profile])
        toast({
          title: "Collaborator added",
          description: profile.email ? `${profile.email} now has access.` : "Collaborator added successfully.",
        })
      } catch (error) {
        console.error("Failed to add collaborator", error)
        toast({ title: "Unable to add collaborator", description: "Please try again later.", variant: "destructive" })
      }
    },
    [dirType, fileId, toast],
  )

  const handleRemoveCollaborator = useCallback(
    async (member: UserDto) => {
      if (dirType !== "workspace") return
      const collaboratorKey = resolveWorkspaceOwnerId(member) ?? member.id
      if (!collaboratorKey) return
      const collaboratorId = collaboratorMapRef.current.get(collaboratorKey)
      if (!collaboratorId) return
      try {
        await deleteCollaborator(collaboratorId)
        collaboratorMapRef.current.delete(collaboratorKey)
        setCollaborators((prev) =>
          prev.filter((c) => (resolveWorkspaceOwnerId(c) ?? c.id) !== collaboratorKey)
        )
        toast({ title: "Collaborator removed", description: "Access revoked successfully." })
      } catch (error) {
        console.error("Failed to remove collaborator", error)
        toast({ title: "Unable to remove collaborator", description: "Please try again later.", variant: "destructive" })
      }
    },
    [dirType, toast],
  )

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
            <div className="flex items-center justify-center h-9">
              {collaborators.map((member) => (
                <div key={member.id} className="relative">
                  <div className="mr-1">
                    <Avatar className="-ml-2 h-7 w-7 border-2 border-background/80 bg-background shadow-sm first:ml-0">
                      <AvatarImage src={member.avatarUrl ?? undefined} className="rounded-full" />
                      <AvatarFallback>
                        {(member.email ?? member.fullName ?? "??").substring(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                  </div>
                  {dirType === "workspace" && member.id && member.id !== user?.id && (
                    <button
                      type="button"
                      onClick={() => handleRemoveCollaborator(member)}
                      className="absolute -top-1 -right-1 rounded-full bg-background/90 p-[2px] text-muted-foreground shadow-sm ring-1 ring-border transition hover:text-destructive"
                      aria-label={`Remove ${member.email ?? "collaborator"}`}
                    >
                      <XCircleIcon className="h-3 w-3" />
                    </button>
                  )}
                </div>
              ))}
            </div>
            {dirType === "workspace" && (
              <CollaboratorSearch existingCollaborators={collaborators} getCollaborator={handleAddCollaborator}>
                <Button size="sm" type="button" variant="outline" className="gap-2 h-7 px-3">
                  <Share2 className="h-4 w-4" />
                  Share
                </Button>
              </CollaboratorSearch>
            )}

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
          <img
            src={details.bannerUrl || "/placeholder.svg"}
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
            if (isDraggingRef.current) return
            const target = e.target as HTMLElement
            if (target.closest(".notion-block") || target.closest('button,[role="button"],input,textarea')) return
            const activeElement = document.activeElement as HTMLElement | null
            if (activeElement && typeof activeElement.blur === "function") {
              activeElement.blur()
            }
            setEditorState((prev) => ({
              ...prev,
              selectedBlockId: null,
              focusedBlockId: null,
            }))
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

              const targetId = result.draggableId
              moveBlock(targetId, result.destination.index)
              setEditorState((prev) => ({
                ...prev,
                selectedBlockId: targetId,
                focusedBlockId: targetId,
              }))

              // Focus the editable element inside the moved block after DOM updates
              requestAnimationFrame(() => {
                const node = document.querySelector<HTMLElement>(
                  `[data-block-id="${targetId}"] textarea, [data-block-id="${targetId}"] input`,
                )
                if (node) {
                  try {
                    node.focus()
                  } catch {}
                }
              })
            }}
          >
            <Droppable droppableId="blocks">
              {(provided) => (
                <div
                  {...provided.droppableProps}
                  ref={provided.innerRef}
                  className="space-y-2"
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
                          data-block-id={block.id}
                          onMouseDown={(e) => {
                            // Don't prevent default here - let drag handle work
                            const targetEl = e.target as HTMLElement
                            if (!targetEl.closest('[role="button"],input,textarea,.drag-handle')) {
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
                                onUpdate={(updates) => {
                                  updateBlock(block.id, updates)
                                }}
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
            className="mt-6 mb-[30px] min-h-[160px] cursor-text"
            onDoubleClick={(e) => {
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
                const defaults = buildBlockDefaults(type)
                updateBlock(target.id, { ...defaults, type } as Partial<Block>)
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

      {/* Collaboration presence temporarily disabled */}
    </>
  )
})

NotionEditor.displayName = "NotionEditor"

export default NotionEditor
