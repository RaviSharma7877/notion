'use client'
import type React from "react"
import { useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import clsx from "clsx"
import { Plus, Trash2 } from "lucide-react"

import {
  createFile,
  type FileCreateInput,
  type FileDto,
  updateFile,
  updateFolder,
  listFiles,
} from "@/lib/queries"
import { useAuth } from "@/lib/providers/auth-provider"
import { useAppState } from "@/lib/providers/state-provider"

import EmojiPicker from "../global/emoji-picker"
import TooltipComponent from "../global/tooltip-component"
import { AccordionContent, AccordionItem, AccordionTrigger } from "../ui/accordion"
import { useToast } from "../ui/use-toast"
import { Button } from "@/components/ui/button"

interface DropdownProps {
  title: string
  id: string // folderId OR `${folderId}folder${fileId}`
  listType: "folder" | "file"
  iconId: string
  children?: React.ReactNode
  disabled?: boolean
}

const CLICK_DELAY_MS = 220
const SUPPRESS_SYNC_MS = 600 // window to prefer local emoji after a pick

const Dropdown: React.FC<DropdownProps> = ({ title, id, listType, iconId }) => {
  const router = useRouter()
  const { toast } = useToast()
  const { user } = useAuth()
  const { state, dispatch, workspaceId } = useAppState()

  const [isEditing, setIsEditing] = useState(false)
  const [draftTitle, setDraftTitle] = useState<string>("")
  const [displayTitle, setDisplayTitle] = useState<string>(title)
  const inputRef = useRef<HTMLInputElement>(null)
  const clickTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const isFolder = listType === "folder"

  // Local files (only used for folders)
  const [files, setFiles] = useState<FileDto[]>([])
  const [loadingFiles, setLoadingFiles] = useState(false)
  const [filesError, setFilesError] = useState<string | null>(null)

  // Live folder slice from store (for instant title/icon)
  const folderState = useMemo(() => {
    if (!isFolder) return null
    return state.workspaces.find((w) => w.id === workspaceId)?.folders.find((f) => f.id === id) ?? null
  }, [state, isFolder, workspaceId, id])

  // ---- Realtime Emoji (local-first with brief sync suppression)
  const [displayIcon, setDisplayIcon] = useState<string>(iconId)
  const suppressSyncUntilRef = useRef<number>(0)

  // Keep local state in sync with store/prop, unless we just picked an emoji
  useEffect(() => {
    const now = Date.now()
    if (now < suppressSyncUntilRef.current) return // skip sync: user just picked
    const externalIcon = isFolder ? (folderState?.iconId ?? iconId) : iconId
    if (externalIcon !== displayIcon) setDisplayIcon(externalIcon)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [iconId, isFolder, folderState?.iconId])

  // Keep title in sync with store changes
  useEffect(() => {
    const externalTitle = isFolder ? (folderState?.title ?? title) : title
    if (externalTitle !== displayTitle) setDisplayTitle(externalTitle)
  }, [isFolder, folderState?.title, title, displayTitle])

  // Fetch files for this folder
  const fetchFiles = async () => {
    if (!isFolder || !workspaceId) return
    try {
      setLoadingFiles(true)
      setFilesError(null)
      const page = await listFiles({ workspaceId, folderId: id, size: 200, page: 0, sort: "createdAt,DESC" })
      setFiles(page.content ?? [])
    } catch (err: any) {
      setFilesError(err?.message || "Failed to load files")
    } finally {
      setLoadingFiles(false)
    }
  }

  useEffect(() => { fetchFiles() /* eslint-disable-next-line */ }, [isFolder, workspaceId, id])
  useEffect(() => {
    const onFocus = () => fetchFiles()
    window.addEventListener("focus", onFocus)
    return () => window.removeEventListener("focus", onFocus)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isFolder, workspaceId, id])

  // Focus/select on edit
  useEffect(() => {
    if (isEditing && inputRef.current) {
      setTimeout(() => {
        inputRef.current?.focus()
        inputRef.current?.select()
      }, 0)
    }
  }, [isEditing])

  // Titles
  const folderTitle: string | undefined = useMemo(() => {
    if (!isFolder) return undefined
    const stateTitle = folderState?.title
    if (!stateTitle || stateTitle === title) return title
    return stateTitle
  }, [isFolder, folderState, title])

  const fileTitle: string | undefined = useMemo(() => {
    if (isFolder) return undefined
    const [derivedFolderId, fileId] = id.split("folder")
    const stateTitle = state.workspaces
      .find((w) => w.id === workspaceId)
      ?.folders.find((f) => f.id === derivedFolderId)
      ?.files.find((file) => file.id === fileId)?.title
    if (!stateTitle || stateTitle === title) return title
    return stateTitle
  }, [state, isFolder, workspaceId, id, title])

  const currentTitle = displayTitle

  // Navigation
  const navigateToFile = (targetId: string) => {
    if (!workspaceId) return
    const [parentFolderId, fileId] = targetId.split("folder")
    if (!parentFolderId || !fileId) return
    router.push(`/dashboard/${workspaceId}/${parentFolderId}/${fileId}`)
  }

  // Rename
  const handleDoubleClick = (e: React.MouseEvent<HTMLInputElement>) => {
    e.stopPropagation()
    if (clickTimerRef.current) { clearTimeout(clickTimerRef.current); clickTimerRef.current = null }
    setDraftTitle(displayTitle || "")
    setIsEditing(true)
  }

  const persistRename = async (finalTitle: string) => {
    const final = (finalTitle ?? "").trim()
    const existing = (displayTitle ?? "").trim()

    // ✅ Skip if nothing changed
    if (final === existing) return

    const value = final || "Untitled"
    const segments = id.split("folder")

    if (segments.length === 1 && isFolder) {
      if (!workspaceId) return
      // Update local state immediately
      setDisplayTitle(value)
      // Optimistic store update
      console.log('Dispatching UPDATE_FOLDER:', { workspaceId, folderId: id, folder: { title: value } })
      dispatch({ type: "UPDATE_FOLDER", payload: { workspaceId, folderId: id, folder: { title: value } } })
      try {
        const ensuredIcon = (folderState?.iconId ?? displayIcon ?? "📁")
        await updateFolder(id, { title: value, workspaceId, iconId: ensuredIcon })
        toast({ title: "Success", description: "Folder title changed." })
        // no refresh here; state already updated optimistically
      } catch {
        toast({ title: "Error", variant: "destructive", description: "Could not update the title for this folder" })
      }
    }

    if (segments.length === 2 && !isFolder) {
      const fileId = segments[1]
      if (!fileId || !workspaceId) return
      const fileFolderId = segments[0]

      // Update local state immediately
      setDisplayTitle(value)
      console.log('Dispatching UPDATE_FILE:', { workspaceId, folderId: fileFolderId, fileId, file: { title: value } })
      dispatch({ type: "UPDATE_FILE", payload: { workspaceId, folderId: fileFolderId, fileId, file: { title: value } } })
      try {
        // find current icon from local files state or global state
        const currentIcon = (files.find((f) => f.id === fileId)?.iconId)
          ?? (state.workspaces.find((w) => w.id === workspaceId)?.folders.find((f) => f.id === fileFolderId)?.files.find((f) => f.id === fileId)?.iconId)
          ?? displayIcon
          ?? "📄"
        await updateFile(fileId, { title: value, workspaceId, folderId: fileFolderId, iconId: currentIcon })
        toast({ title: "Success", description: "File title changed." })
        // no refresh here; state already updated optimistically
      } catch {
        toast({ title: "Error", variant: "destructive", description: "Could not update the title for this file" })
      }
    }
  }

  const handleBlur = async () => {
    if (!isEditing) return
    setIsEditing(false)
    await persistRename(draftTitle)
  }

  // Emoji change — instant UI + store + API (with sync suppression)
  const onChangeEmoji = async (selectedEmoji: string) => {
    if (!workspaceId) return

    // 1) Instant UI in this row
    setDisplayIcon(selectedEmoji)
    suppressSyncUntilRef.current = Date.now() + SUPPRESS_SYNC_MS

    if (isFolder) {
      // 2) Update store so other views of the same folder update too
      dispatch({ type: "UPDATE_FOLDER", payload: { workspaceId, folderId: id, folder: { iconId: selectedEmoji } } })
      // 3) Persist
      try {
        const ensuredTitle = (folderTitle ?? title ?? "Untitled").trim() || "Untitled"
        await updateFolder(id, { iconId: selectedEmoji, workspaceId, title: ensuredTitle })
        toast({ title: "Success", description: "Updated emoji for the folder" })
      } catch {
        toast({ title: "Error", variant: "destructive", description: "Could not update the emoji for this folder" })
      }
      return
    }

    // File case
    const [fileFolderId, fileId] = id.split("folder")
    if (!fileFolderId || !fileId) return

    setFiles((prev) => prev.map((f) => (f.id === fileId ? { ...f, iconId: selectedEmoji } : f)))
    dispatch({ type: "UPDATE_FILE", payload: { workspaceId, folderId: fileFolderId, fileId, file: { iconId: selectedEmoji } } })
    try {
      const ensuredTitle = (fileTitle ?? title ?? "Untitled").trim() || "Untitled"
      await updateFile(fileId, { iconId: selectedEmoji, workspaceId, folderId: fileFolderId, title: ensuredTitle })
      toast({ title: "Success", description: "Updated emoji for the file" })
    } catch {
      toast({ title: "Error", variant: "destructive", description: "Could not update the emoji for this file" })
    }
  }

  // Trash
  const moveToTrash = async () => {
    if (!workspaceId || !user?.email) return
    const segments = id.split("folder")
    const reason = `Deleted by ${user.email}`

    if (isFolder && segments.length === 1) {
      dispatch({ type: "UPDATE_FOLDER", payload: { workspaceId, folderId: id, folder: { inTrash: true } } })
      try {
        const ensuredTitle = (folderTitle ?? title ?? "Untitled").trim() || "Untitled"
        await updateFolder(id, { inTrash: true, workspaceId, title: ensuredTitle })
        toast({ title: "Success", description: "Moved folder to trash." })
        setFiles([])
      } catch {
        toast({ title: "Error", variant: "destructive", description: "Could not move the folder to trash" })
      }
    }

    if (!isFolder && segments.length === 2) {
      const fileFolderId = segments[0]
      const fileId = segments[1]

      dispatch({ type: "UPDATE_FILE", payload: { workspaceId, folderId: fileFolderId, fileId, file: { inTrash: true } } })
      try {
        const ensuredTitle = (fileTitle ?? title ?? "Untitled").trim() || "Untitled"
        await updateFile(fileId, { inTrash: true, workspaceId, folderId: fileFolderId, title: ensuredTitle })
        toast({ title: "Success", description: "Moved file to trash." })
        setFiles((prev) => prev.filter((f) => f.id !== fileId))
      } catch {
        toast({ title: "Error", variant: "destructive", description: "Could not move the file to trash" })
      }
    }
  }

  // Add file
  const addNewFile = async () => {
    if (!isFolder || !workspaceId) return
    const payload: FileCreateInput = {
      title: "Untitled",
      iconId: "📄",
      data: null,
      inTrash: false,
      bannerUrl: null,
      workspaceId,
      folderId: id,
    }
    try {
      const createdFile: FileDto = await createFile(payload)
      setFiles((prev) => [{ ...createdFile, createdAt: (createdFile as any).createdAt ?? new Date().toISOString() } as any, ...prev])
      dispatch({ type: "ADD_FILE", payload: { workspaceId, folderId: id, file: { ...createdFile } as any } })
      toast({ title: "Success", description: "File created." })
    } catch {
      toast({ title: "Error", variant: "destructive", description: "Could not create a file" })
    }
  }

  const rowGroup = "group dark:text-white whitespace-nowrap flex justify-between items-center w-full relative"
  const itemClasses = clsx("relative", {
    "border-none text-md": isFolder,
    "border-none ml-6 text-[16px] py-1": !isFolder,
  })
  const actionsClasses =
    "absolute right-1 top-1/2 -translate-y-1/2 flex items-center gap-1 opacity-0 group-hover:opacity-100 pointer-events-none group-hover:pointer-events-auto transition-opacity"

  const handleTriggerClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (!isFolder) e.preventDefault()
  }

  const handleFileInputClick = (e: React.MouseEvent<HTMLInputElement>) => {
    e.stopPropagation()
    e.preventDefault()
    if (isEditing) return
    if (clickTimerRef.current) { clearTimeout(clickTimerRef.current); clickTimerRef.current = null }
    clickTimerRef.current = setTimeout(() => { navigateToFile(id); clickTimerRef.current = null }, CLICK_DELAY_MS)
  }

  const handleFileInputDoubleClick = (e: React.MouseEvent<HTMLInputElement>) => {
    e.stopPropagation()
    e.preventDefault()
    if (clickTimerRef.current) { clearTimeout(clickTimerRef.current); clickTimerRef.current = null }
    setDraftTitle(displayTitle || "")
    setIsEditing(true)
  }

  return (
    <AccordionItem value={id} className={itemClasses}>
      <AccordionTrigger
        onClick={handleTriggerClick}
        className={clsx(
          "hover:no-underline p-2 text-sm rounded-lg transition-colors",
          "data-[state=open]:bg-muted/40",
          !isFolder && "[&>svg]:hidden",
          isFolder ? "cursor-pointer dark:text-muted-foreground hover:bg-muted/30" : "cursor-default dark:text-muted-foreground",
        )}
      >
        <div className={rowGroup}>
          {isFolder ? (
            <div className={clsx("flex items-center overflow-hidden gap-1", "pl-1")}>
              <div className="relative flex-shrink-0">
                <EmojiPicker getValue={onChangeEmoji}>
                  {/* key forces immediate repaint */}
                  <span key={displayIcon}>{displayIcon || "📁"}</span>
                </EmojiPicker>
              </div>

              <input
                ref={inputRef}
                type="text"
                value={isEditing ? draftTitle : displayTitle}
                className={clsx(
                  "outline-none overflow-hidden flex-1 truncate min-w-0",
                  "text-[0.95rem]",
                  isEditing ? "bg-muted rounded px-2 py-1 cursor-text" : "bg-transparent cursor-pointer text-Neutrals/neutrals-7",
                )}
                readOnly={!isEditing}
                onDoubleClick={handleDoubleClick}
                onChange={(e) => { if (isEditing) setDraftTitle(e.target.value) }}
                onBlur={handleBlur}
                onClick={(e) => e.stopPropagation()}
                onMouseDown={(e) => e.stopPropagation()}
                onKeyDown={(e) => {
                  if (e.key === "Enter") (e.target as HTMLInputElement).blur()
                  else if (e.key === "Escape") {
                    setDraftTitle(displayTitle)
                    setIsEditing(false)
                  }
                }}
                placeholder="Untitled folder"
              />
            </div>
          ) : (
            <div className={clsx("flex items-center overflow-hidden gap-1")}>
              <div className="relative flex-shrink-0">
                <EmojiPicker getValue={onChangeEmoji}>
                  <span key={displayIcon}>{displayIcon || "📄"}</span>
                </EmojiPicker>
              </div>

              <input
                ref={inputRef}
                type="text"
                value={isEditing ? draftTitle : displayTitle}
                className={clsx(
                  "outline-none overflow-hidden flex-1 truncate min-w-0",
                  "text-[0.95rem]",
                  isEditing ? "bg-muted rounded px-2 py-1 cursor-text" : "bg-transparent cursor-pointer text-Neutrals/neutrals-7",
                )}
                readOnly={!isEditing}
                onClick={handleFileInputClick}
                onDoubleClick={handleFileInputDoubleClick}
                onChange={(e) => { if (isEditing) setDraftTitle(e.target.value) }}
                onBlur={handleBlur}
                onMouseDown={(e) => e.stopPropagation()}
                onKeyDown={(e) => {
                  if (e.key === "Enter") (e.target as HTMLInputElement).blur()
                  else if (e.key === "Escape") {
                    setDraftTitle(displayTitle)
                    setIsEditing(false)
                  }
                }}
                placeholder="Untitled file"
              />
            </div>
          )}

          <div className={actionsClasses} data-prevent-navigation="true">
            {isFolder && !isEditing && (
              <TooltipComponent message="Add file">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label="Add file"
                  className="h-7 w-7 rounded-full"
                  onClick={(e) => { e.stopPropagation(); e.preventDefault(); addNewFile() }}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </TooltipComponent>
            )}

            <TooltipComponent message="Delete">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Delete"
                className="h-7 w-7 rounded-full text-destructive hover:text-destructive"
                onClick={(e) => { e.stopPropagation(); e.preventDefault(); moveToTrash() }}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </TooltipComponent>
          </div>
        </div>
      </AccordionTrigger>

      {isFolder && (
        <AccordionContent>
          {loadingFiles && <div className="ml-6 py-1 text-xs text-muted-foreground">Loading files…</div>}
          {filesError && <div className="ml-6 py-1 text-xs text-destructive">{filesError}</div>}

          {files.filter((file) => !file.inTrash).map((file) => {
            const customFileId = `${id}folder${file.id}`
            return (
              <Dropdown
                key={file.id}
                title={file.title}
                listType="file"
                id={customFileId}
                iconId={file.iconId}
              />
            )
          })}
        </AccordionContent>
      )}
    </AccordionItem>
  )
}

export default Dropdown
