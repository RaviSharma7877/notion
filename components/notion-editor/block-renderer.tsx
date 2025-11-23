"use client"

import type React from "react"
import { useState, useRef, useEffect, useCallback } from "react"
import type {
  Block,
  BlockType,
  DatabaseBlock,
  EmbedBlock,
  CodeBlock,
  TableOfContentsBlock,
  BookmarkBlock,
  SyncedBlock,
} from "@/lib/notion-types"
import { Button } from "../ui/button"
import { Input } from "../ui/input"
import { Textarea } from "../ui/textarea"
import { Checkbox } from "../ui/checkbox"
import { Card, CardContent } from "../ui/card"
import { Badge } from "../ui/badge"
import { Separator } from "../ui/separator"
import {
  ChevronDown,
  ChevronRight,
  ChevronUp,
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
  RefreshCw,
  Copy,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { DatabaseView } from "./database-view"

const CODE_LANGUAGES = [
  { value: "web" as const, label: "Web (HTML / CSS / JS)" },
  { value: "html" as const, label: "HTML" },
  { value: "css" as const, label: "CSS" },
  { value: "javascript" as const, label: "JavaScript" },
]

type CodeLanguage = (typeof CODE_LANGUAGES)[number]["value"]

type WebSourceKey = "html" | "css" | "javascript"

type WebSources = Record<WebSourceKey, string>

const BASE_CODE_PREVIEW_STYLES = `
:root {
  color-scheme: light;
  font-family: 'Inter', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
}
* {
  box-sizing: border-box;
}
body {
  margin: 0;
  background: #f8fafc;
  color: #0f172a;
  padding: 24px;
  line-height: 1.6;
}
.preview-container {
  max-width: 560px;
  margin: 0 auto;
  background: #ffffff;
  border-radius: 16px;
  padding: 24px;
  box-shadow: 0 22px 45px rgba(15, 23, 42, 0.08);
}
.preview-container h2 {
  margin: 0 0 8px;
  font-size: 20px;
}
.preview-container p {
  margin: 0 0 12px;
  color: #475569;
}
.preview-layout {
  display: grid;
  gap: 16px;
}
.preview-button {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  background: #6366f1;
  color: #ffffff;
  border-radius: 9999px;
  padding: 10px 18px;
  border: none;
  font-weight: 600;
  cursor: pointer;
  transition: filter 0.2s ease;
  box-shadow: 0 12px 30px rgba(99, 102, 241, 0.3);
}
.preview-button:hover {
  filter: brightness(1.05);
}
.preview-tag {
  display: inline-flex;
  padding: 6px 12px;
  border-radius: 9999px;
  background: rgba(99, 102, 241, 0.12);
  color: #4338ca;
  font-weight: 600;
  font-size: 12px;
}
.console {
  font-family: 'JetBrains Mono', 'Fira Code', monospace;
  background: #0f172a;
  color: #f8fafc;
  padding: 20px;
  border-radius: 16px;
  min-height: 140px;
  overflow-y: auto;
}
.console .hint {
  color: rgba(148, 163, 184, 0.85);
  font-size: 12px;
  margin-bottom: 8px;
}
.console .error {
  color: #fb7185;
}
`

const CSS_SAMPLE_MARKUP = `
<div class="preview-container">
  <h2>Style this card</h2>
  <p>Write CSS in the editor to customise the appearance of this preview.</p>
  <div class="preview-layout">
    <button class="preview-button">Primary action</button>
    <span class="preview-tag">Badge</span>
  </div>
</div>
`

const wrapPreviewDocument = (headExtra: string, bodyContent: string) =>
  `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/><style>${BASE_CODE_PREVIEW_STYLES}</style>${headExtra}</head><body>${bodyContent}</body></html>`

const escapeForScriptTag = (value: string) => value.replace(/<\/script/gi, "<\\/script")

const escapeForStyleTag = (value: string) => value.replace(/<\/style/gi, "<\\/style")

const createBookmarkAccent = (seed: string) => {
  const value = seed || "bookmark"
  let hash = 0
  for (let index = 0; index < value.length; index += 1) {
    hash = value.charCodeAt(index) + ((hash << 5) - hash)
    hash |= 0
  }
  const hue = Math.abs(hash) % 360
  return {
    primary: `hsl(${hue}, 72%, 52%)`,
    soft: `hsla(${hue}, 78%, 88%, 0.65)`,
  }
}

const normaliseUrl = (input: string): string => {
  const trimmed = input.trim()
  if (!trimmed) return ""
  if (/^https?:\/\//i.test(trimmed)) return trimmed
  return `https://${trimmed}`
}

const buildCodePreviewDocument = (language: CodeLanguage, rawSource: string, webSources?: WebSources) => {
  const source = rawSource ?? ""
  switch (language) {
    case "web": {
      const sources: WebSources = webSources ?? {
        html: source,
        css: "",
        javascript: "",
      }
      const htmlMarkup = sources.html && sources.html.trim().length > 0 ? sources.html : CSS_SAMPLE_MARKUP
      const cssPart = sources.css ? `<style>${escapeForStyleTag(sources.css)}</style>` : ""
      const jsPart = sources.javascript ? `<script>${escapeForScriptTag(sources.javascript)}</script>` : ""
      return wrapPreviewDocument(cssPart, `${htmlMarkup}${jsPart}`)
    }
    case "html": {
      const trimmed = source.trim()
      if (!trimmed) {
        return wrapPreviewDocument("", CSS_SAMPLE_MARKUP)
      }
      if (/<!doctype html/i.test(trimmed) || /<html[\s>]/i.test(trimmed)) {
        return source
      }
      return wrapPreviewDocument("", trimmed)
    }
    case "css": {
      const escaped = escapeForStyleTag(source)
      const head = `<style>${escaped}</style>`
      return wrapPreviewDocument(head, CSS_SAMPLE_MARKUP)
    }
    case "javascript": {
      const escaped = escapeForScriptTag(source)
      const script = `\n(function () {\n  const output = document.querySelector('.console-output');\n  const append = (text, cls) => {\n    const line = document.createElement('div');\n    if (cls) line.className = cls;\n    line.textContent = text;\n    output.appendChild(line);\n  };\n  const stringify = (value) => {\n    try {\n      return typeof value === 'object' ? JSON.stringify(value) : String(value);\n    } catch (err) {\n      return String(value);\n    }\n  };\n  const originalLog = console.log;\n  console.log = (...args) => {\n    originalLog.apply(console, args);\n    append(args.map(stringify).join(' '));\n  };\n  window.addEventListener('error', (event) => {\n    append(event.error ? (event.error.stack || event.error.message) : event.message, 'error');\n  }, { once: true });\n  try {\n${escaped}\n  } catch (error) {\n    append(error && error.stack ? error.stack : String(error), 'error');\n  } finally {\n    console.log = originalLog;\n  }\n})();\n`
      const body = `\n<div class="preview-container">\n  <h2>JavaScript playground</h2>\n  <p>console.log output will appear below.</p>\n</div>\n<div class="console console-output">\n  <div class="hint">Write JavaScript in the editor and click Preview to run it.</div>\n</div>\n<script>${script}</script>\n`
      return wrapPreviewDocument("", body)
    }
    default:
      return wrapPreviewDocument("", CSS_SAMPLE_MARKUP)
  }
}

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
  const [activeWebTab, setActiveWebTab] = useState<WebSourceKey>("html")
  const [showBookmarkEditor, setShowBookmarkEditor] = useState(false)
  const [showSyncedOptions, setShowSyncedOptions] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const beginEditing = useCallback(() => {
    onSelect()
    onFocus()
    setIsEditing(true)
  }, [onSelect, onFocus])

  const shouldIgnoreBlockActivation = useCallback((target: HTMLElement | null) => {
    if (!target) return false
    if (target.closest(".drag-handle")) return true
    if (target.closest("textarea")) return true
    if (target.closest("input")) return true
    if (target.closest("button")) return true
    if (target.closest("a")) return true
    if (target.closest("select")) return true
    if (target.closest("[data-ignore-block-activation]")) return true
    return false
  }, [])

  const handleWrapperClick = useCallback(
    (event: React.MouseEvent) => {
      if (shouldIgnoreBlockActivation(event.target as HTMLElement | null)) return
      onSelect()
    },
    [onSelect, shouldIgnoreBlockActivation],
  )

  const handleWrapperDoubleClick = useCallback(
    (event: React.MouseEvent) => {
      if (shouldIgnoreBlockActivation(event.target as HTMLElement | null)) return
      event.preventDefault()
      beginEditing()
    },
    [beginEditing, shouldIgnoreBlockActivation],
  )

  useEffect(() => {
    setActiveWebTab("html")
    setShowBookmarkEditor(false)
    setShowSyncedOptions(false)
  }, [block.id])

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

  useEffect(() => {
    if (block.type !== "code") return
    const code = block as CodeBlock
    if (!isEditing) return
    if (code.language === "web") {
      const sources: WebSources = code.sources ?? {
        html: code.content || "",
        css: "",
        javascript: "",
      }
      setEditContent(sources[activeWebTab])
    } else {
      setEditContent(code.content)
    }
  }, [isEditing, block, activeWebTab])

  useEffect(() => {
    if (block.type !== "synced_block") return
    const synced = block as SyncedBlock
    if (synced.isOriginal === undefined) {
      onUpdate({ isOriginal: true, originalBlockId: block.id } as Partial<Block>)
    } else if (synced.isOriginal && (!synced.originalBlockId || synced.originalBlockId.trim().length === 0)) {
      onUpdate({ originalBlockId: block.id } as Partial<Block>)
    }
  }, [block, onUpdate])

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
            onClick={handleWrapperClick}
            onDoubleClick={handleWrapperDoubleClick}
            onMouseDown={(e) => {
              // Don't stop propagation if clicking on drag handle
              if (!(e.target as Element).closest(".drag-handle")) {
                e.stopPropagation()
              }
            }}
          >
            {isEditing ? (
              <Textarea
                ref={textareaRef}
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                onKeyDown={handleKeyDown}
                onBlur={handleBlur}
                onFocus={onFocus}
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
            onClick={handleWrapperClick}
            onDoubleClick={handleWrapperDoubleClick}
          >
            {isEditing ? (
              <Input
                ref={inputRef}
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                onKeyDown={handleKeyDown}
                onBlur={handleBlur}
                onFocus={onFocus}
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
            onClick={handleWrapperClick}
            onDoubleClick={handleWrapperDoubleClick}
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
                onFocus={onFocus}
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
            onClick={handleWrapperClick}
            onDoubleClick={handleWrapperDoubleClick}
          >
            <Checkbox
              checked={block.checked || false}
              onCheckedChange={(checked) => onUpdate({ checked: checked as boolean })}
              onClick={(e) => e.stopPropagation()}
              className="mt-1 h-4 w-4"
            />
            {isEditing ? (
              <Textarea
                ref={textareaRef}
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                onKeyDown={handleKeyDown}
                onBlur={handleBlur}
                onFocus={onFocus}
                className="min-h-6 resize-none border-0 outline-none ring-0 focus-visible:ring-0 shadow-none p-0 text-[16px] leading-[24px] flex-1 rounded-none"
                placeholder="Type '/' for commands, or start writing..."
              />
            ) : (
              <div
                className={cn(
                  "text-[16px] leading-[24px] flex-1 cursor-text",
                  block.checked && "line-through text-muted-foreground",
                )}
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
            onClick={handleWrapperClick}
            onDoubleClick={handleWrapperDoubleClick}
          >
            <div className="flex items-start gap-2">
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0"
                onClick={(e) => {
                  e.stopPropagation()
                  onUpdate({ isOpen: !block.isOpen })
                }}
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
                onFocus={onFocus}
                className="border-0 outline-none ring-0 focus-visible:ring-0 shadow-none p-0 text-[16px] leading-[24px] flex-1 rounded-none"
                placeholder="Type '/' for commands, or start writing..."
              />
            ) : (
                <div className="text-[16px] leading-[24px] flex-1 cursor-text">
                  {block.content || (
                    <span className="text-muted-foreground border-none shadow-none focus-visible:ring-0 p-0 rounded-none">
                      Type '/' for commands, or start writing...
                    </span>
                  )}
                </div>
              )}
            </div>
            {block.isOpen && (
              <div className="ml-6 mt-2 space-y-[2px]">
                {block.children && block.children.length > 0 ? (
                  block.children.map((child) => (
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
                  ))
                ) : (
                  <div className="text-xs text-muted-foreground italic">
                    Toggle is empty. Press Enter to add blocks below or drag content into this toggle.
                  </div>
                )}
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
            onClick={handleWrapperClick}
            onDoubleClick={handleWrapperDoubleClick}
          >
            {isEditing ? (
              <Textarea
                ref={textareaRef}
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                onKeyDown={handleKeyDown}
                onBlur={handleBlur}
                onFocus={onFocus}
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

      case "code": {
        const codeBlock = block as CodeBlock
        const selectedLanguage = (CODE_LANGUAGES.find((lang) => lang.value === codeBlock.language)?.value || "web") as CodeLanguage
        const previewEnabled = codeBlock.previewEnabled ?? false
        const webSources: WebSources = codeBlock.sources ?? {
          html: codeBlock.content || "",
          css: "",
          javascript: "",
        }
        const tabLabels: Record<WebSourceKey, string> = {
          html: "HTML",
          css: "CSS",
          javascript: "JS",
        }

        const handleLanguageChange = (nextLanguage: CodeLanguage) => {
          if (nextLanguage === selectedLanguage) return
          setActiveWebTab("html")
          if (nextLanguage === "web") {
            const initialSources = codeBlock.sources ?? webSources
            setEditContent(initialSources.html)
            onUpdate({ language: nextLanguage, sources: initialSources, content: initialSources.html })
          } else {
            const nextKey = nextLanguage as WebSourceKey
            const fromSources = webSources[nextKey] || codeBlock.content || ""
            setEditContent(fromSources)
            onUpdate({ language: nextLanguage, content: fromSources })
          }
        }

        const handleWebSourceChange = (tab: WebSourceKey, value: string) => {
          const updated = { ...webSources, [tab]: value }
          setEditContent(value)
          onUpdate({ sources: updated, content: updated.html })
        }

        const previewSource = selectedLanguage === "web"
          ? webSources[activeWebTab]
          : (isEditing ? editContent : block.content) || ""
        const previewDocument = previewEnabled
          ? buildCodePreviewDocument(
              selectedLanguage,
              selectedLanguage === "web" ? webSources.html : previewSource,
              selectedLanguage === "web" ? webSources : undefined,
            )
          : null

        return (
          <div
            className={cn(
              "group relative overflow-hidden rounded border border-[rgba(55,53,47,0.09)] dark:border-[rgba(212,212,212,0.15)] bg-[#F5F5F5] dark:bg-[#2F2F2F]",
              isSelected && "ring-1 ring-muted-foreground/20",
            )}
            onClick={handleWrapperClick}
            onDoubleClick={handleWrapperDoubleClick}
          >
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 bg-muted/10 px-3 py-2 text-xs uppercase tracking-wide">
              <div className="flex items-center gap-2 text-muted-foreground/80">
                <span>Language</span>
                <select
                  value={selectedLanguage}
                  className="rounded border border-border bg-background px-2 py-1 text-xs capitalize focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  onClick={(e) => e.stopPropagation()}
                  onChange={(e) => {
                    e.stopPropagation()
                    handleLanguageChange(e.target.value as CodeLanguage)
                  }}
                >
                  {CODE_LANGUAGES.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-7 px-2 text-[11px]"
                  onClick={(e) => {
                    e.stopPropagation()
                    navigator.clipboard.writeText(previewSource).catch(() => undefined)
                  }}
                >
                  Copy
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={previewEnabled ? "default" : "outline"}
                  className="h-7 px-2 text-[11px]"
                  onClick={(e) => {
                    e.stopPropagation()
                    onUpdate({ previewEnabled: !previewEnabled })
                  }}
                >
                  {previewEnabled ? "Hide Preview" : "Preview"}
                </Button>
              </div>
            </div>
            {selectedLanguage === "web" && (
              <div className="flex items-center gap-1 border-b border-border/60 bg-muted/5 px-3 py-2 text-[11px] uppercase tracking-wide">
                {(["html", "css", "javascript"] as WebSourceKey[]).map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    className={cn(
                      "rounded px-2 py-1 transition-colors",
                      activeWebTab === tab
                        ? "bg-primary text-primary-foreground"
                        : "bg-transparent text-muted-foreground hover:bg-muted/40",
                    )}
                    onClick={(e) => {
                      e.stopPropagation()
                      setActiveWebTab(tab)
                      if (isEditing) {
                        const nextValue = webSources[tab]
                        setEditContent(nextValue)
                      }
                    }}
                  >
                    {tabLabels[tab]}
                  </button>
                ))}
              </div>
            )}
            {isEditing ? (
              selectedLanguage === "web" ? (
                <Textarea
                  ref={textareaRef}
                  value={editContent}
                  onChange={(e) => handleWebSourceChange(activeWebTab, e.target.value)}
                  onKeyDown={handleKeyDown}
                  onBlur={() => {
                    setIsEditing(false)
                    if (onBlur) onBlur()
                  }}
                  onFocus={onFocus}
                  spellCheck={false}
                  className="min-h-[140px] resize-none border-0 outline-none ring-0 focus-visible:ring-0 shadow-none bg-transparent font-mono text-[14px] leading-[20px] p-3"
                  placeholder={`Write ${tabLabels[activeWebTab]} here`}
                />
              ) : (
                <Textarea
                  ref={textareaRef}
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  onKeyDown={handleKeyDown}
                  onBlur={handleBlur}
                  onFocus={onFocus}
                  spellCheck={false}
                  className="min-h-[140px] resize-none border-0 outline-none ring-0 focus-visible:ring-0 shadow-none bg-transparent font-mono text-[14px] leading-[20px] p-3"
                  placeholder="Write your code here"
                />
              )
            ) : (
              selectedLanguage === "web" ? (
                <pre className="overflow-x-auto p-3 text-[14px] leading-[20px] whitespace-pre-wrap font-mono">
                  {webSources[activeWebTab] || (
                    <span className="text-muted-foreground">
                      Write your {tabLabels[activeWebTab]} code and toggle preview.
                    </span>
                  )}
                </pre>
              ) : (
                <pre className="overflow-x-auto p-3 text-[14px] leading-[20px] whitespace-pre-wrap font-mono">
                  {block.content || (
                    <span className="text-muted-foreground">
                      Write your {selectedLanguage.toUpperCase()} code and toggle preview.
                    </span>
                  )}
                </pre>
              )
            )}
            {previewEnabled && previewDocument && (
              <div className="border-t border-border/60 bg-background/70" onClick={(e) => e.stopPropagation()}>
                <iframe
                  title="Code preview"
                  srcDoc={previewDocument}
                  className="h-72 w-full border-0"
                  sandbox="allow-scripts"
                />
              </div>
            )}
          </div>
        )
      }

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
            onClick={handleWrapperClick}
            onDoubleClick={handleWrapperDoubleClick}
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
                  onFocus={onFocus}
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

      case "bookmark": {
        const bookmarkBlock = block as BookmarkBlock
        const rawUrl = bookmarkBlock.url?.trim() ?? ""
        let normalisedHref: string | null = null
        let parsedUrl: URL | null = null
        let displayDomain = ""
        if (rawUrl) {
          const candidate = normaliseUrl(rawUrl)
          try {
            parsedUrl = new URL(candidate)
            normalisedHref = parsedUrl.href
            displayDomain = parsedUrl.hostname.replace(/^www\./, "")
          } catch {
            displayDomain = rawUrl
          }
        }

        const previewTitle = bookmarkBlock.title?.trim() || displayDomain || "Saved link"
        const previewDescription = bookmarkBlock.description?.trim()
          || (displayDomain ? `Content from ${displayDomain}` : "Add a description to this bookmark.")
        const accent = createBookmarkAccent(displayDomain || previewTitle || block.id)
        const fallbackInitial = previewTitle.charAt(0).toUpperCase()
        const faviconUrl = parsedUrl ? `https://www.google.com/s2/favicons?sz=96&domain_url=${parsedUrl.origin}` : null
        const imageUrl = bookmarkBlock.image?.trim()

        const handleUrlChange = (value: string) => {
          onUpdate({ url: value } as Partial<Block>)
        }

        const handleUrlBlur = (value: string) => {
          const candidate = value.trim()
          if (!candidate) return
          const normalised = normaliseUrl(candidate)
          const updates: Partial<BookmarkBlock> = { url: normalised }

          try {
            const urlObject = new URL(normalised)
            const hostname = urlObject.hostname.replace(/^www\./, "")
            if (!bookmarkBlock.title || bookmarkBlock.title.trim().length === 0 || bookmarkBlock.title === bookmarkBlock.url) {
              updates.title = hostname
            }
            if (!bookmarkBlock.image || bookmarkBlock.image.trim().length === 0) {
              updates.image = `https://www.google.com/s2/favicons?sz=200&domain_url=${urlObject.origin}`
            }
          } catch {
            // Ignore parsing errors
          }

          onUpdate(updates as Partial<Block>)
        }

        const handleTitleChange = (value: string) => {
          onUpdate({ title: value } as Partial<Block>)
        }

        const handleDescriptionChange = (value: string) => {
          onUpdate({ description: value } as Partial<Block>)
        }

        const handleImageChange = (value: string) => {
          onUpdate({ image: value } as Partial<Block>)
        }

        return (
          <Card
            className={cn(
              "overflow-hidden border border-border/70 transition-shadow hover:shadow-md",
              isSelected && "ring-1 ring-primary/30",
            )}
            onClick={() => onSelect()}
          >
            <div className="relative h-40 w-full overflow-hidden">
              {imageUrl ? (
                <img src={imageUrl} alt={previewTitle} className="h-full w-full object-cover" />
              ) : (
                <div
                  className="flex h-full w-full items-center justify-center"
                  style={{
                    background: `linear-gradient(135deg, ${accent.primary} 0%, ${accent.soft} 100%)`,
                  }}
                >
                  <span className="text-4xl font-semibold text-white/80">{fallbackInitial}</span>
                </div>
              )}
              {faviconUrl && (
                <span className="absolute left-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-background/80 backdrop-blur">
                  <img src={faviconUrl} alt="favicon" className="h-6 w-6" />
                </span>
              )}
            </div>

            <CardContent className="space-y-4 p-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <ExternalLink className="h-3 w-3 text-muted-foreground" />
                  <span className="text-xs uppercase tracking-wide text-muted-foreground/80">
                    {displayDomain || "Add a URL"}
                  </span>
                </div>
                <h3 className="text-base font-semibold leading-6 text-foreground">{previewTitle}</h3>
                <p className="text-sm text-muted-foreground line-clamp-3">{previewDescription}</p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  className="gap-2"
                  variant="default"
                  disabled={!normalisedHref}
                  onClick={(e) => {
                    e.stopPropagation()
                    if (normalisedHref) window.open(normalisedHref, "_blank", "noopener,noreferrer")
                  }}
                >
                  Visit link
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={(e) => {
                    e.stopPropagation()
                    setShowBookmarkEditor((prev) => !prev)
                  }}
                >
                  {showBookmarkEditor ? "Hide details" : "Edit details"}
                </Button>
              </div>

              {showBookmarkEditor && (
                <div className="grid gap-3 border-t border-border/60 pt-4">
                  <div className="space-y-1">
                    <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">URL</span>
                    <Input
                      value={bookmarkBlock.url || ""}
                      onChange={(e) => handleUrlChange(e.target.value)}
                      onBlur={(e) => handleUrlBlur(e.target.value)}
                      placeholder="https://example.com/article"
                    />
                  </div>
                  <div className="space-y-1">
                    <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Title</span>
                    <Input
                      value={bookmarkBlock.title || ""}
                      onChange={(e) => handleTitleChange(e.target.value)}
                      placeholder="Bookmark title"
                    />
                  </div>
                  <div className="space-y-1">
                    <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Description</span>
                    <Textarea
                      value={bookmarkBlock.description || ""}
                      onChange={(e) => handleDescriptionChange(e.target.value)}
                      rows={3}
                      placeholder="Short summary of the link"
                    />
                  </div>
                  <div className="space-y-1">
                    <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                      Cover image URL
                    </span>
                    <Input
                      value={bookmarkBlock.image || ""}
                      onChange={(e) => handleImageChange(e.target.value)}
                      placeholder="https://domain.com/cover.png"
                    />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )
      }

      case "embed": {
        const embedUrl = block.url || ""
        const provider = block.provider || "other"

        const renderEmbedPreview = () => {
          if (!embedUrl) {
            return (
              <div className="aspect-video flex items-center justify-center text-sm text-muted-foreground bg-muted/20 rounded">
                Paste an embeddable link to preview it here
              </div>
            )
          }

          const normalizedUrl = embedUrl.startsWith("http") ? embedUrl : `https://${embedUrl}`

          if (normalizedUrl.includes("codepen.io")) {
            return (
              <iframe
                title={block.title || "CodePen"}
                src={`${normalizedUrl}${normalizedUrl.includes("embed") ? "" : (normalizedUrl.endsWith("/") ? "" : "/") + "embed"}`}
                className="w-full rounded border border-border/40"
                height={420}
                allow="accelerometer; clipboard-write; encrypted-media; gyroscope"
              />
            )
          }

          if (normalizedUrl.includes("figma.com")) {
            const src = normalizedUrl.includes("embed")
              ? normalizedUrl
              : `${normalizedUrl}${normalizedUrl.includes("?") ? "&" : "?"}embed_host=share`
            return (
              <iframe
                title={block.title || "Figma"}
                src={src}
                className="w-full rounded border border-border/40"
                height={420}
                allowFullScreen
              />
            )
          }

          if (normalizedUrl.includes("google.com/maps")) {
            const src = normalizedUrl.includes("/embed") ? normalizedUrl : normalizedUrl.replace("/maps/", "/maps/embed/")
            return (
              <iframe
                title={block.title || "Google Maps"}
                src={src}
                className="w-full rounded border border-border/40"
                height={420}
                allowFullScreen
                loading="lazy"
              />
            )
          }

          if (normalizedUrl.includes("calendar.google.com")) {
            return (
              <iframe
                title={block.title || "Google Calendar"}
                src={normalizedUrl}
                className="w-full rounded border border-border/40"
                height={420}
                frameBorder={0}
                scrolling="no"
              />
            )
          }

          return (
            <iframe
              title={block.title || "Embed"}
              src={normalizedUrl}
              className="w-full rounded border border-border/40"
              height={420}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          )
        }

        return (
          <div
            className={cn("py-2 px-2 rounded hover:bg-muted/20", isSelected && "bg-muted/30")}
            onClick={() => onSelect()}
          >
            <Card>
              <CardContent className="p-4 space-y-4">
                <div className="flex items-center gap-2">
                  <Link className="h-4 w-4" />
                  <span className="text-sm font-medium">Embed</span>
                </div>
                {renderEmbedPreview()}
                <div className="grid gap-2">
                  <Input
                    placeholder="https://"
                    value={embedUrl}
                    onChange={(e) => onUpdate({ url: e.target.value })}
                  />
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-muted-foreground">Provider</label>
                      <select
                        value={provider}
                        onChange={(e) => onUpdate({ provider: e.target.value as EmbedBlock["provider"] })}
                        className="w-full rounded border border-input bg-background px-3 py-2 text-sm"
                      >
                        <option value="other">Generic Embed</option>
                        <option value="codepen">CodePen</option>
                        <option value="figma">Figma</option>
                        <option value="google_maps">Google Maps</option>
                        <option value="google_calendar">Google Calendar</option>
                        <option value="google_drive">Google Drive</option>
                        <option value="twitter">Twitter/X</option>
                        <option value="github">GitHub Gist</option>
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-muted-foreground">Title</label>
                      <Input
                        placeholder="Optional caption"
                        value={block.title || ""}
                        onChange={(e) => onUpdate({ title: e.target.value })}
                      />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )
      }

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

      case "table_of_contents": {
        const tocBlock = block as TableOfContentsBlock
        const headings = tocBlock.headings ?? []
        const accentPalette = ["#6366F1", "#8B5CF6", "#EC4899", "#F97316", "#10B981", "#0EA5E9"]
        const indentMap: Record<1 | 2 | 3, string> = {
          1: "pl-1",
          2: "pl-6",
          3: "pl-10",
        }
        const title = (typeof block.content === "string" && block.content.trim().length > 0)
          ? block.content.trim()
          : "Table of contents"
        const headingCountLabel = `${headings.length} section${headings.length === 1 ? "" : "s"}`

        const handleTitleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
          if (event.key === "Enter") {
            event.preventDefault()
            onUpdate({ content: editContent })
            setIsEditing(false)
          }
          if (event.key === "Escape") {
            event.preventDefault()
            setEditContent(typeof block.content === "string" ? block.content : "")
            setIsEditing(false)
          }
        }

        const scrollToHeading = (headingId: string, color: string) => {
          const target = document.querySelector<HTMLElement>(`[data-block-id="${headingId}"]`)
          if (target) {
            target.scrollIntoView({ behavior: "smooth", block: "center" })
            const originalBoxShadow = target.style.boxShadow
            const originalTransition = target.style.transition
            target.style.transition = "box-shadow 0.4s ease"
            target.style.boxShadow = `0 0 0 3px ${color}55`
            window.setTimeout(() => {
              target.style.boxShadow = originalBoxShadow
              target.style.transition = originalTransition
            }, 1400)
          }
        }

        return (
          <Card
            className={cn(
              "overflow-hidden border border-border/70 backdrop-blur-sm",
              isSelected && "ring-1 ring-primary/30",
            )}
            onClick={handleWrapperClick}
            onDoubleClick={handleWrapperDoubleClick}
          >
            <CardContent className="space-y-4 p-4">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                {isEditing ? (
                  <Input
                    ref={inputRef}
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    onKeyDown={handleTitleKeyDown}
                    onBlur={handleBlur}
                    className="h-8 text-sm font-semibold"
                    placeholder="Table of contents title"
                  />
                ) : (
                  <div className="flex items-center gap-2">
                    <List className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-semibold text-foreground sm:text-base">{title}</span>
                  </div>
                )}
                <Badge variant="secondary" className="w-fit text-[10px] uppercase tracking-wide">
                  {headingCountLabel}
                </Badge>
              </div>

              {headings.length === 0 ? (
                <div className="rounded-lg border border-dashed border-border/60 bg-muted/20 px-4 py-6 text-center text-sm text-muted-foreground">
                  <p className="mb-1 font-medium text-foreground">No headings detected</p>
                  <p>Add Heading 1, Heading 2, or Heading 3 blocks to populate this table of contents automatically.</p>
                </div>
              ) : (
                <ul className="space-y-1">
                  {headings.map((heading, index) => {
                    const color = accentPalette[index % accentPalette.length]
                    const indentClass = indentMap[heading.level as 1 | 2 | 3] ?? indentMap[1]
                    const headingLabel = heading.level === 1 ? "Heading 1" : heading.level === 2 ? "Heading 2" : "Heading 3"
                    const headingTitle = heading.content && heading.content.trim().length > 0
                      ? heading.content
                      : "Untitled heading"

                    return (
                      <li key={`${heading.id}-${index}`}>
                        <button
                          type="button"
                          className={cn(
                            "flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm transition-colors hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60",
                            indentClass,
                          )}
                          onClick={(e) => {
                            e.stopPropagation()
                            scrollToHeading(heading.id, color)
                          }}
                        >
                          <span
                            className="relative h-2 w-2 flex-shrink-0 overflow-hidden rounded-full"
                            style={{ backgroundColor: color }}
                          />
                          <div className="flex flex-col">
                            <span className="font-medium text-foreground">{headingTitle}</span>
                            <span className="text-[11px] uppercase tracking-wide text-muted-foreground/70">{headingLabel}</span>
                          </div>
                        </button>
                      </li>
                    )
                  })}
                </ul>
              )}
            </CardContent>
          </Card>
        )
      }

      // Advanced blocks
      case "synced_block": {
        const syncedBlock = block as SyncedBlock
        const isOriginal = syncedBlock.isOriginal !== false
        const sourceId = isOriginal
          ? syncedBlock.originalBlockId || block.id
          : syncedBlock.originalBlockId || ""
        const accent = createBookmarkAccent(sourceId || block.id)

        const handleCopySourceId = () => {
          const idToCopy = sourceId || block.id
          if (!idToCopy) return
          navigator.clipboard.writeText(idToCopy).catch(() => undefined)
        }

        const handleDetachFromSync = () => {
          onUpdate({ isOriginal: true, originalBlockId: block.id } as Partial<Block>)
          setShowSyncedOptions(false)
        }

        const handleSourceIdChange = (value: string) => {
          onUpdate({ originalBlockId: value.trim(), isOriginal: false } as Partial<Block>)
        }

        const handleJumpToSource = () => {
          if (!sourceId) return
          const target = document.querySelector<HTMLElement>(`[data-block-id="${sourceId}"]`)
          if (target) {
            target.scrollIntoView({ behavior: "smooth", block: "center" })
            const originalBoxShadow = target.style.boxShadow
            const originalTransition = target.style.transition
            target.style.transition = "box-shadow 0.4s ease"
            target.style.boxShadow = `0 0 0 3px ${accent.primary}55`
            window.setTimeout(() => {
              target.style.boxShadow = originalBoxShadow
              target.style.transition = originalTransition
            }, 1400)
          }
        }

        return (
          <Card
            className={cn(
              "overflow-hidden border border-border/70 transition-shadow hover:shadow-md",
              isSelected && "ring-1 ring-primary/30",
            )}
            onClick={() => {
              onSelect()
              setIsEditing(true)
            }}
          >
            <CardContent className="space-y-4 p-4">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex items-center gap-2">
                  <span
                    className="flex h-8 w-8 items-center justify-center rounded-full"
                    style={{ backgroundColor: `${accent.primary}15`, color: accent.primary }}
                  >
                    <RefreshCw className="h-4 w-4" />
                  </span>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-foreground">Synced block</span>
                      <Badge variant={isOriginal ? "default" : "outline"} className="text-[10px] uppercase tracking-wide">
                        {isOriginal ? "Original" : "Reference"}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {isOriginal
                        ? "Content updates sync to every reference"
                        : sourceId
                        ? `Linked to ${sourceId.slice(0, 6)}…`
                        : "Paste the source block ID to connect"}
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="h-8 gap-1 text-xs"
                    onClick={(e) => {
                      e.stopPropagation()
                      handleCopySourceId()
                    }}
                  >
                    <Copy className="h-3 w-3" /> Copy ID
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-8 gap-1 text-xs"
                    onClick={(e) => {
                      e.stopPropagation()
                      setShowSyncedOptions((prev) => !prev)
                    }}
                  >
                    {showSyncedOptions ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                    Options
                  </Button>
                </div>
              </div>

              {isEditing ? (
                <Textarea
                  ref={textareaRef}
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  onKeyDown={handleKeyDown}
                  onBlur={handleBlur}
                  className="min-h-[120px] resize-none rounded-md border border-dashed border-border/70 bg-background/60 p-3 text-sm"
                  placeholder="Content that syncs across pages"
                />
              ) : (
                <div className="rounded-md border border-border/60 bg-muted/10 p-3 text-sm text-foreground">
                  {syncedBlock.content ? (
                    <div className="whitespace-pre-wrap leading-6">{syncedBlock.content}</div>
                  ) : (
                    <span className="text-muted-foreground">Click to add synced content…</span>
                  )}
                </div>
              )}

              {showSyncedOptions && (
                <div className="space-y-3 rounded-lg border border-border/60 bg-muted/10 p-3 text-xs text-muted-foreground">
                  {isOriginal ? (
                    <>
                      <p>
                        This is the <strong>source</strong> synced block. Duplicate it to create references that stay in
                        sync.
                      </p>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="h-8 gap-1 text-xs"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleJumpToSource()
                          }}
                        >
                          Jump to block
                        </Button>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="space-y-2">
                        <div className="space-y-1">
                          <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground/80">
                            Source block ID
                          </span>
                          <Input
                            value={syncedBlock.originalBlockId || ""}
                            onChange={(e) => handleSourceIdChange(e.target.value)}
                            placeholder="Paste the original block ID"
                            onClick={(e) => e.stopPropagation()}
                          />
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            className="h-8 gap-1 text-xs"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleJumpToSource()
                            }}
                            disabled={!syncedBlock.originalBlockId}
                          >
                            Jump to source
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            className="h-8 gap-1 text-xs text-destructive"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleDetachFromSync()
                            }}
                          >
                            Detach from sync
                          </Button>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        )
      }

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
