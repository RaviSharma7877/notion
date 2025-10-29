"use client"

import type React from "react"
import { useState, useRef, useEffect } from "react"
import type { Block, BlockType, DatabaseBlock } from "@/lib/notion-types"
import { Button } from "../ui/button"
import { Input } from "../ui/input"
import { Textarea } from "../ui/textarea"
import { Checkbox } from "../ui/checkbox"
import { Card, CardContent } from "../ui/card"
import { Separator } from "../ui/separator"
import {
  ChevronDown,
  ChevronRight,
  Code,
  Quote,
  List,
  Hash,
  CheckSquare,
  ImageIcon,
  Video,
  File,
  Link,
  Calculator,
  Calendar,
  BarChart3,
  Table,
  Battery as Gallery,
  Clock,
  ExternalLink,
  Play,
  Volume2,
  Download,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { DatabaseView } from "./database-view"

interface BlockRendererProps {
  block: Block
  isSelected: boolean
  isFocused: boolean
  onUpdate: (updates: Partial<Block>) => void
  onDelete: () => void
  onDuplicate: () => void
  onSelect: () => void
  onFocus: () => void
  onAddBelow?: (type?: BlockType) => void
  onBlur?: () => void
}

export const BlockRenderer: React.FC<BlockRendererProps> = ({
  block,
  isSelected,
  isFocused,
  onUpdate,
  onDelete,
  onDuplicate,
  onSelect,
  onFocus,
  onAddBelow,
  onBlur,
}) => {
  const [isEditing, setIsEditing] = useState(false)
  const [editContent, setEditContent] = useState(block.content)
  const inputRef = useRef<HTMLInputElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (isEditing && inputRef.current) {
      const el = inputRef.current
      el.focus()
      const len = (editContent || "").length
      if (!editContent || editContent.length === 0) {
        // For empty inputs, selecting is fine
        try {
          el.select()
        } catch {}
      } else {
        try {
          el.setSelectionRange(len, len)
        } catch {}
      }
    }
  }, [isEditing, editContent])

  useEffect(() => {
    if (isEditing && textareaRef.current) {
      const el = textareaRef.current
      el.focus()
      const len = (editContent || "").length
      try {
        el.setSelectionRange(len, len)
      } catch {}
    }
  }, [isEditing, editContent])

  // Auto-enter edit mode when this block becomes focused by the editor
  useEffect(() => {
    if (isFocused && !isEditing) {
      setIsEditing(true)
    }
  }, [isFocused, isEditing])

  const handleContentChange = (newContent: string) => {
    setEditContent(newContent)
    onUpdate({ content: newContent })
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      const trimmedContent = typeof editContent === "string" ? editContent.trim() : ""
      const isListBlock =
        block.type === "bulleted_list" ||
        block.type === "numbered_list" ||
        block.type === "todo" ||
        block.type === "toggle"

      if (isListBlock && trimmedContent.length === 0) {
        onUpdate({ type: "paragraph", content: "" })
        setEditContent("")
        return
      }

      // Persist latest edits before exiting edit mode and adding a new block
      onUpdate({ content: editContent })
      setIsEditing(false)

      if (onAddBelow) onAddBelow(isListBlock ? block.type : undefined)
    }
    if (e.key === "Escape") {
      setIsEditing(false)
      setEditContent(block.content)
    }
  }

  const handleBlur = () => {
    setIsEditing(false)
    onUpdate({ content: editContent })
    if (onBlur) {
      onBlur()
    }
  }

  const getBlockIcon = (type: BlockType) => {
    switch (type) {
      case "heading1":
      case "heading2":
      case "heading3":
        return <Hash className="h-4 w-4" />
      case "bulleted_list":
      case "numbered_list":
        return <List className="h-4 w-4" />
      case "todo":
        return <CheckSquare className="h-4 w-4" />
      case "toggle":
        return <ChevronRight className="h-4 w-4" />
      case "quote":
        return <Quote className="h-4 w-4" />
      case "code":
        return <Code className="h-4 w-4" />
      case "image":
        return <ImageIcon className="h-4 w-4" />
      case "video":
        return <Video className="h-4 w-4" />
      case "file":
        return <File className="h-4 w-4" />
      case "bookmark":
        return <Link className="h-4 w-4" />
      case "equation":
        return <Calculator className="h-4 w-4" />
      case "database_table":
        return <Table className="h-4 w-4" />
      case "database_board":
        return <BarChart3 className="h-4 w-4" />
      case "database_gallery":
        return <Gallery className="h-4 w-4" />
      case "database_list":
        return <List className="h-4 w-4" />
      case "database_calendar":
        return <Calendar className="h-4 w-4" />
      case "database_timeline":
        return <Clock className="h-4 w-4" />
      case "database_chart":
        return <BarChart3 className="h-4 w-4" />
      default:
        return null
    }
  }

  const renderBlockContent = () => {
    switch (block.type) {
      case "paragraph":
        return (
          <div
            className={cn("min-h-6 py-0 px-2 rounded hover:bg-muted/40 transition-colors", isSelected && "bg-muted/50")}
            onClick={() => {
              onSelect()
              setIsEditing(true)
            }}
          >
            {isEditing ? (
              <Textarea
                ref={textareaRef}
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                onKeyDown={handleKeyDown}
                onBlur={handleBlur}
                className="min-h-6 resize-none border-0 outline-none ring-0 focus-visible:ring-0 shadow-none p-0 text-[16px] leading-[24px] rounded-none"
                placeholder="Type '/' for commands, or start writing..."
              />
            ) : (
              <div className="text-[16px] leading-[24px]">
                {block.content || (
                  <span className="text-muted-foreground border-none shadow-none focus-visible:ring-0 p-0 rounded-none">
                    Type '/' for commands, or start writing...
                  </span>
                )}
              </div>
            )}
          </div>
        )

      case "heading1":
      case "heading2":
      case "heading3":
        const headingSize = {
          heading1: "text-[26px] leading-[1.25] font-semibold",
          heading2: "text-[21px] leading-[1.3] font-semibold",
          heading3: "text-[18px] leading-[1.3] font-medium",
        }
        return (
          <div
            className={cn(
              "min-h-8 py-1.5 px-2 rounded hover:bg-muted/30 transition-colors",
              isSelected && "bg-muted/40",
            )}
            onClick={() => {
              onSelect()
              setIsEditing(true)
            }}
          >
            {isEditing ? (
              <Input
                ref={inputRef}
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                onKeyDown={handleKeyDown}
                onBlur={handleBlur}
                className={cn(
                  "border-0 outline-none ring-0 focus-visible:ring-0 shadow-none p-0 font-bold rounded-none",
                  headingSize[block.type],
                )}
                placeholder="Type '/' for commands, or start writing..."
              />
            ) : (
              <div className={cn("", headingSize[block.type])}>
                {block.content || (
                  <span className="text-muted-foreground">Type '/' for commands, or start writing...</span>
                )}
              </div>
            )}
          </div>
        )

      case "bulleted_list":
      case "numbered_list":
        return (
          <div
            className={cn(
              "min-h-6 py-0 px-2 flex items-start gap-2 rounded hover:bg-muted/30 transition-colors",
              isSelected && "bg-muted/40",
            )}
            onClick={() => {
              onSelect()
              setIsEditing(true)
            }}
          >
            <div className="pt-1 w-6 text-left select-none text-muted-foreground">
              {block.type === "bulleted_list" ? "•" : `${(block as any).listIndex || 1}.`}
            </div>
            {isEditing ? (
              <Textarea
                ref={textareaRef}
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                onKeyDown={handleKeyDown}
                onBlur={handleBlur}
                className="min-h-6 resize-none border-0 outline-none ring-0 focus-visible:ring-0 shadow-none p-0 text-[16px] leading-[24px] flex-1 rounded-none"
                placeholder="Type '/' for commands, or start writing..."
              />
            ) : (
              <div className="text-[16px] leading-[24px] flex-1">
                {block.content || (
                  <span className="text-muted-foreground border-none shadow-none focus-visible:ring-0 p-0 rounded-none">
                    Type '/' for commands, or start writing...
                  </span>
                )}
              </div>
            )}
          </div>
        )

      case "todo":
        return (
          <div
            className={cn(
              "min-h-6 py-0 px-2 rounded flex items-start gap-2 hover:bg-muted/30 transition-colors",
              isSelected && "bg-muted/40",
            )}
            onClick={() => onSelect()}
          >
            <Checkbox
              checked={block.checked || false}
              onCheckedChange={(checked) => onUpdate({ checked: checked as boolean })}
              className="mt-1 h-4 w-4"
            />
            {isEditing ? (
              <Textarea
                ref={textareaRef}
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                onKeyDown={handleKeyDown}
                onBlur={handleBlur}
                className="min-h-6 resize-none border-0 outline-none ring-0 focus-visible:ring-0 shadow-none p-0 text-[16px] leading-[24px] flex-1 rounded-none"
                placeholder="Type '/' for commands, or start writing..."
              />
            ) : (
              <div
                className={cn(
                  "text-[16px] leading-[24px] flex-1 cursor-text",
                  block.checked && "line-through text-muted-foreground",
                )}
                onClick={() => setIsEditing(true)}
              >
                {block.content || (
                  <span className="text-muted-foreground border-none shadow-none focus-visible:ring-0 p-0 rounded-none">
                    Type '/' for commands, or start writing...
                  </span>
                )}
              </div>
            )}
          </div>
        )

      case "toggle":
        return (
          <div
            className={cn("min-h-6 py-1 px-2 rounded hover:bg-muted/30 transition-colors", isSelected && "bg-muted/40")}
            onClick={() => onSelect()}
          >
            <div className="flex items-start gap-2">
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0"
                onClick={() => onUpdate({ isOpen: !block.isOpen })}
              >
                {block.isOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
              </Button>
              {isEditing ? (
                <Input
                  ref={inputRef}
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  onKeyDown={handleKeyDown}
                  onBlur={handleBlur}
                  className="border-0 outline-none ring-0 focus-visible:ring-0 shadow-none p-0 text-[16px] leading-[24px] flex-1 rounded-none"
                  placeholder="Type '/' for commands, or start writing..."
                />
              ) : (
                <div className="text-[16px] leading-[24px] flex-1 cursor-text" onClick={() => setIsEditing(true)}>
                  {block.content || (
                    <span className="text-muted-foreground border-none shadow-none focus-visible:ring-0 p-0 rounded-none">
                      Type '/' for commands, or start writing...
                    </span>
                  )}
                </div>
              )}
            </div>
            {block.isOpen && block.children && (
              <div className="ml-6 mt-2 space-y-[2px]">
                {block.children.map((child) => (
                  <BlockRenderer
                    key={child.id}
                    block={child}
                    isSelected={false}
                    isFocused={false}
                    onUpdate={(updates) =>
                      onUpdate({
                        children: block.children?.map((c) => (c.id === child.id ? ({ ...c, ...updates } as Block) : c)),
                      })
                    }
                    onDelete={() => onUpdate({ children: block.children?.filter((c) => c.id !== child.id) })}
                    onDuplicate={() => {}}
                    onSelect={() => {}}
                    onFocus={() => {}}
                  />
                ))}
              </div>
            )}
          </div>
        )

      case "quote":
        return (
          <div
            className={cn(
              "min-h-6 rounded border-l-[3px] border-current bg-transparent py-[0.2em] px-[0.9em]",
              isSelected && "bg-muted/10",
            )}
            onClick={() => {
              onSelect()
              setIsEditing(true)
            }}
          >
            {isEditing ? (
              <Textarea
                ref={textareaRef}
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                onKeyDown={handleKeyDown}
                onBlur={handleBlur}
                className="min-h-6 resize-none border-0 outline-none ring-0 focus-visible:ring-0 shadow-none p-0 text-[19px] leading-[28px] bg-transparent rounded-none"
                placeholder="Quote"
              />
            ) : (
              <div className="text-[19px] leading-[28px]">
                {block.content || (
                  <span className="text-muted-foreground border-none shadow-none focus-visible:ring-0 p-0 rounded-none">
                    Quote
                  </span>
                )}
              </div>
            )}
          </div>
        )

      case "code":
        return (
          <div
            className={cn(
              "group relative rounded border border-[rgba(55,53,47,0.09)] dark:border-[rgba(212,212,212,0.15)] bg-[#F3F3F3] dark:bg-[#2F2F2F]",
              isSelected && "ring-1 ring-muted-foreground/20",
            )}
            onClick={() => {
              onSelect()
              setIsEditing(true)
            }}
          >
            <span className="absolute top-2 left-3 text-[10px] uppercase tracking-wide px-2 py-[2px] rounded bg-black/5 dark:bg-white/10">
              {block.language || "javascript"}
            </span>
            <button
              type="button"
              className="absolute top-2 right-2 text-xs opacity-0 group-hover:opacity-100 transition-opacity px-2 py-[2px] rounded bg-black/5 dark:bg-white/10"
              onClick={(e) => {
                e.stopPropagation()
                navigator.clipboard.writeText(block.content || "").catch(() => undefined)
              }}
            >
              Copy
            </button>
            {isEditing ? (
              <Textarea
                ref={textareaRef}
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                onKeyDown={handleKeyDown}
                onBlur={handleBlur}
                className="min-h-[120px] resize-none border-0 outline-none ring-0 focus-visible:ring-0 shadow-none p-2 pt-7 text-[14px] leading-[20px] bg-transparent font-mono rounded"
                placeholder="Code"
              />
            ) : (
              <pre className="p-2 pt-7 text-[14px] leading-[20px] whitespace-pre-wrap font-mono">
                {block.content || (
                  <span className="text-muted-foreground border-none shadow-none focus-visible:ring-0 p-0 rounded-none">
                    Code
                  </span>
                )}
              </pre>
            )}
          </div>
        )

      case "callout":
        const calloutColors = {
          default: "bg-white dark:bg-[#191919] border border-[rgba(55,53,47,0.16)]",
          blue: "bg-[#E9F3F7] dark:bg-[#1F282D]",
          green: "bg-[#ECF6EC] dark:bg-[#1E2A1E]",
          yellow: "bg-[#FBF3DB] dark:bg-[#2A2519]",
          red: "bg-[#FBE4E4] dark:bg-[#2A1D1D]",
          purple: "bg-[#F3EEFC] dark:bg-[#211F2C]",
          gray: "bg-[#F1F1EF] dark:bg-[#2A2A29]",
        } as Record<string, string>
        return (
          <div
            className={cn(
              "min-h-6 rounded-[3px] py-4 pr-4 pl-3 transition-colors",
              calloutColors[block.color || "default"],
              isSelected && "ring-1 ring-muted-foreground/20",
            )}
            onClick={() => {
              onSelect()
              setIsEditing(true)
            }}
          >
            <div className="flex items-start gap-3">
              <div className="text-[20px] leading-none">{block.icon || "💡"}</div>
              {isEditing ? (
                <Textarea
                  ref={textareaRef}
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  onKeyDown={handleKeyDown}
                  onBlur={handleBlur}
                  className="min-h-6 resize-none border-0 outline-none ring-0 focus-visible:ring-0 shadow-none p-0 text-[16px] leading-[24px] bg-transparent flex-1 rounded-none"
                  placeholder="Callout"
                />
              ) : (
                <div className="text-[16px] leading-[24px] flex-1">
                  {block.content || (
                    <span className="text-muted-foreground border-none shadow-none focus-visible:ring-0 p-0 rounded-none">
                      Callout
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
        )

      case "divider":
        return (
          <div className={cn("py-3 px-2 rounded", isSelected && "bg-muted/20")} onClick={() => onSelect()}>
            <Separator />
          </div>
        )

      case "image":
        return (
          <div
            className={cn("py-2 px-2 rounded hover:bg-muted/20", isSelected && "bg-muted/30")}
            onClick={() => onSelect()}
            onDragOver={(e) => {
              e.preventDefault()
            }}
            onDrop={(e) => {
              e.preventDefault()
              const file = e.dataTransfer.files?.[0]
              if (file && file.type.startsWith("image/")) {
                const url = URL.createObjectURL(file)
                onUpdate({ url, filename: file.name })
              }
            }}
          >
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <ImageIcon className="h-4 w-4" />
                  <span className="text-sm font-medium border-none shadow-none focus-visible:ring-0 p-0 rounded-none">
                    Image
                  </span>
                </div>
                {block.url ? (
                  <div className="space-y-2">
                    <img
                      src={block.url || "/placeholder.svg"}
                      alt={block.alt || ""}
                      className="max-w-full h-auto rounded"
                    />
                    {block.caption && (
                      <p className="text-sm text-muted-foreground border-none shadow-none focus-visible:ring-0 p-0 rounded-none">
                        {block.caption}
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Input
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0]
                        if (file) {
                          const url = URL.createObjectURL(file)
                          onUpdate({ url, filename: file.name })
                        }
                      }}
                    />
                    <Input
                      placeholder="Image URL"
                      value={block.url || ""}
                      onChange={(e) => onUpdate({ url: e.target.value })}
                    />
                    <Input
                      placeholder="Alt text"
                      value={block.alt || ""}
                      onChange={(e) => onUpdate({ alt: e.target.value })}
                    />
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )

      case "video":
        const renderVideoPlayer = (block: any) => {
          const getVideoSource = () => {
            if (!block.url) return null

            // YouTube
            if (block.url.includes("youtube.com") || block.url.includes("youtu.be")) {
              const videoId = block.url.includes("youtu.be")
                ? block.url.split("/").pop()
                : new URL(block.url).searchParams.get("v")
              return (
                <iframe
                  width="100%"
                  height="400"
                  src={`https://www.youtube.com/embed/${videoId}`}
                  title="YouTube video player"
                  frameBorder="0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  className="rounded"
                />
              )
            }

            // Vimeo
            if (block.url.includes("vimeo.com")) {
              const videoId = block.url.split("/").pop()
              return (
                <iframe
                  src={`https://player.vimeo.com/video/${videoId}`}
                  width="100%"
                  height="400"
                  frameBorder="0"
                  allow="autoplay; fullscreen; picture-in-picture"
                  allowFullScreen
                  className="rounded"
                />
              )
            }

            // Direct video file
            return (
              <video controls className="w-full rounded bg-black" controlsList="nodownload">
                <source src={block.url} type="video/mp4" />
                Your browser does not support the video tag.
              </video>
            )
          }

          return (
            <div className="space-y-2">
              <div className="bg-black rounded overflow-hidden">
                {block.url ? (
                  getVideoSource()
                ) : (
                  <div className="aspect-video bg-muted flex items-center justify-center">
                    <Play className="h-12 w-12 text-muted-foreground" />
                  </div>
                )}
              </div>
              {block.caption && <p className="text-sm text-muted-foreground">{block.caption}</p>}
            </div>
          )
        }

        return (
          <div
            className={cn("py-2 px-2 rounded hover:bg-muted/20", isSelected && "bg-muted/30")}
            onClick={() => onSelect()}
          >
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-4">
                  <Video className="h-4 w-4" />
                  <span className="text-sm font-medium">Video</span>
                </div>
                {renderVideoPlayer(block)}
                <div className="mt-4 space-y-2">
                  <Input
                    placeholder="Video URL (YouTube, Vimeo, or direct link)"
                    value={block.url || ""}
                    onChange={(e) => onUpdate({ url: e.target.value })}
                  />
                  <Input
                    placeholder="Caption"
                    value={block.caption || ""}
                    onChange={(e) => onUpdate({ caption: e.target.value })}
                  />
                  <Input
                    type="file"
                    accept="video/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      if (file) {
                        const url = URL.createObjectURL(file)
                        onUpdate({ url, filename: file.name })
                      }
                    }}
                  />
                </div>
              </CardContent>
            </Card>
          </div>
        )

      case "audio":
        return (
          <div
            className={cn("py-2 px-2 rounded hover:bg-muted/20", isSelected && "bg-muted/30")}
            onClick={() => onSelect()}
            onDragOver={(e) => {
              e.preventDefault()
            }}
            onDrop={(e) => {
              e.preventDefault()
              const file = e.dataTransfer.files?.[0]
              if (file && file.type.startsWith("audio/")) {
                const url = URL.createObjectURL(file)
                onUpdate({ url, filename: file.name })
              }
            }}
          >
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Volume2 className="h-4 w-4" />
                  <span className="text-sm font-medium">Audio</span>
                </div>
                {block.url ? (
                  <div className="space-y-2">
                    <audio controls className="w-full">
                      <source src={block.url} />
                    </audio>
                    {block.caption && <p className="text-sm text-muted-foreground">{block.caption}</p>}
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Input
                      type="file"
                      accept="audio/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0]
                        if (file) {
                          const url = URL.createObjectURL(file)
                          onUpdate({ url, filename: file.name })
                        }
                      }}
                    />
                    <Input
                      placeholder="Audio URL"
                      value={block.url || ""}
                      onChange={(e) => onUpdate({ url: e.target.value })}
                    />
                    <Input
                      placeholder="Caption"
                      value={block.caption || ""}
                      onChange={(e) => onUpdate({ caption: e.target.value })}
                    />
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )

      case "file":
        return (
          <div
            className={cn("py-2 px-2 rounded hover:bg-muted/20", isSelected && "bg-muted/30")}
            onClick={() => onSelect()}
            onDragOver={(e) => {
              e.preventDefault()
            }}
            onDrop={(e) => {
              e.preventDefault()
              const file = e.dataTransfer.files?.[0]
              if (file) {
                const url = URL.createObjectURL(file)
                onUpdate({ url, filename: file.name, size: file.size, mimeType: file.type })
              }
            }}
          >
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <File className="h-5 w-5 text-muted-foreground" />
                  <div className="flex-1">
                    <p className="font-medium">{block.filename || "Untitled"}</p>
                    <p className="text-sm text-muted-foreground">
                      {block.size ? `${(block.size / 1024).toFixed(1)} KB` : "Unknown size"}
                    </p>
                  </div>
                  <Button variant="ghost" size="sm">
                    <Download className="h-4 w-4" />
                  </Button>
                </div>
                <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-2">
                  <Input
                    type="file"
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      if (file) {
                        const url = URL.createObjectURL(file)
                        onUpdate({ url, filename: file.name, size: file.size, mimeType: file.type })
                      }
                    }}
                  />
                  <Input
                    placeholder="File URL"
                    value={block.url || ""}
                    onChange={(e) => onUpdate({ url: e.target.value })}
                  />
                  <Input
                    placeholder="Filename"
                    value={block.filename || ""}
                    onChange={(e) => onUpdate({ filename: e.target.value })}
                  />
                </div>
              </CardContent>
            </Card>
          </div>
        )

      case "bookmark":
        return (
          <div
            className={cn("py-2 px-2 rounded hover:bg-muted/20", isSelected && "bg-muted/30")}
            onClick={() => onSelect()}
          >
            <Card>
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  {block.image && (
                    <img src={block.image || "/placeholder.svg"} alt="" className="w-16 h-16 object-cover rounded" />
                  )}
                  <div className="flex-1">
                    <h4 className="font-medium">{block.title || "Untitled"}</h4>
                    <p className="text-sm text-muted-foreground line-clamp-2">{block.description || block.url}</p>
                    <div className="flex items-center gap-2 mt-2">
                      <Link className="h-3 w-3 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground truncate">{block.url}</span>
                      <ExternalLink className="h-3 w-3 text-muted-foreground" />
                    </div>
                  </div>
                </div>
                <div className="mt-3 space-y-2">
                  <Input
                    placeholder="Bookmark URL"
                    value={block.url || ""}
                    onChange={(e) => onUpdate({ url: e.target.value })}
                  />
                  <Input
                    placeholder="Title"
                    value={block.title || ""}
                    onChange={(e) => onUpdate({ title: e.target.value })}
                  />
                  <Input
                    placeholder="Description"
                    value={block.description || ""}
                    onChange={(e) => onUpdate({ description: e.target.value })}
                  />
                </div>
              </CardContent>
            </Card>
          </div>
        )

      case "equation":
        return (
          <div
            className={cn("min-h-6 py-2 px-4 rounded hover:bg-muted/20", isSelected && "bg-muted/30")}
            onClick={() => {
              onSelect()
              setIsEditing(true)
            }}
          >
            <div className="flex items-center gap-2 mb-2">
              <Calculator className="h-4 w-4" />
              <span className="text-sm font-medium">Equation</span>
            </div>
            {isEditing ? (
              <Input
                ref={inputRef}
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                onKeyDown={handleKeyDown}
                onBlur={handleBlur}
                className="border-0 outline-none ring-0 focus-visible:ring-0 shadow-none p-0 text-base bg-transparent font-mono rounded-none"
                placeholder="LaTeX equation"
              />
            ) : (
              <div className="text-base font-mono">
                {block.content || <span className="text-muted-foreground">LaTeX equation</span>}
              </div>
            )}
          </div>
        )

      case "table_of_contents":
        return (
          <div
            className={cn("py-2 px-4 rounded hover:bg-muted/20", isSelected && "bg-muted/30")}
            onClick={() => onSelect()}
          >
            <div className="flex items-center gap-2 mb-2">
              <List className="h-4 w-4" />
              <span className="text-sm font-medium">Table of Contents</span>
            </div>
            <div className="text-sm text-muted-foreground">
              {block.headings && block.headings.length > 0 ? (
                <ul className="space-y-1">
                  {block.headings.map((heading, index) => (
                    <li key={index} className={`ml-${heading.level * 4}`}>
                      {heading.content}
                    </li>
                  ))}
                </ul>
              ) : (
                "No headings found"
              )}
            </div>
          </div>
        )

      // Advanced blocks
      case "synced_block":
        return (
          <div
            className={cn("py-2 px-2 rounded border hover:bg-muted/10", isSelected && "bg-muted/20")}
            onClick={() => {
              onSelect()
              setIsEditing(true)
            }}
          >
            <div className="text-sm text-muted-foreground mb-1">Synced block</div>
            {isEditing ? (
              <Textarea
                ref={textareaRef}
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                onKeyDown={handleKeyDown}
                onBlur={handleBlur}
                className="min-h-6 resize-none border-0 outline-none ring-0 focus-visible:ring-0 shadow-none p-0 text-base"
                placeholder="Content that syncs across pages"
              />
            ) : (
              <div className="text-base">{block.content || "Content that syncs across pages"}</div>
            )}
          </div>
        )

      case "template_button":
        return (
          <div
            className={cn("py-2 px-2 rounded border hover:bg-muted/10", isSelected && "bg-muted/20")}
            onClick={() => onSelect()}
          >
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline">
                Add template
              </Button>
              <span className="text-sm text-muted-foreground">Quickly insert predefined content</span>
            </div>
          </div>
        )

      case "breadcrumb":
        return (
          <div
            className={cn("py-2 px-2 rounded hover:bg-muted/20", isSelected && "bg-muted/30")}
            onClick={() => onSelect()}
          >
            <div className="text-sm text-muted-foreground">Home / Page / Subpage</div>
          </div>
        )

      case "database_table":
      case "database_board":
      case "database_gallery":
      case "database_list":
      case "database_calendar":
      case "database_timeline":
      case "database_chart":
        return (
          <div
            className={cn("py-2 px-2 rounded hover:bg-muted/20", isSelected && "bg-muted/30")}
            onClick={() => onSelect()}
          >
            <DatabaseView block={block as DatabaseBlock} onUpdate={(updates) => onUpdate(updates)} />
          </div>
        )

      default:
        return (
          <div
            className={cn("min-h-6 py-1 px-2 rounded hover:bg-muted/30 transition-colors", isSelected && "bg-muted/40")}
            onClick={() => {
              onSelect()
              setIsEditing(true)
            }}
          >
            {isEditing ? (
              <Textarea
                ref={textareaRef}
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                onKeyDown={handleKeyDown}
                onBlur={handleBlur}
                className="min-h-6 resize-none border-0 outline-none ring-0 focus-visible:ring-0 shadow-none p-0 text-[16px] leading-[24px] rounded-none"
                placeholder="Type something..."
              />
            ) : (
              <div className="text-[16px] leading-[24px]">
                {block.content || <span className="text-muted-foreground">Type something...</span>}
              </div>
            )}
          </div>
        )
    }
  }

  return (
    <div className={cn("relative group", isSelected && "")} onFocus={onFocus}>
      {renderBlockContent()}
    </div>
  )
}
