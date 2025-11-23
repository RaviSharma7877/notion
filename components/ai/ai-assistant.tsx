"use client"

import React, { useCallback, useMemo, useState } from "react"
import { AlertCircle, CheckCircle2, FileText, Loader2, Sparkles, Wand2, Wand2 as WandIcon } from "lucide-react"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"
import { useAiStream } from "@/hooks/use-ai-stream"
import {
  type ComposeRequest,
  type SummaryRequest,
  type TitleRequest,
  type WorkspaceCompositionResult,
  streamComposeWorkspace,
  streamSummarizeFile,
  streamSuggestTitle,
} from "@/lib/queries"

interface AiAssistantProps {
  workspaceId: string
  folderId?: string
  fileId?: string
  workspaceTitle?: string
  className?: string
}

const AssistantMark = ({ className, ...props }: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth={1.8} className={className} {...props}>
    <circle cx="16" cy="16" r="10" strokeOpacity={0.7} />
    <path d="M16 7v5M16 20v5M7 16h5M20 16h5" strokeOpacity={0.6} strokeLinecap="round" />
    <circle cx="16" cy="16" r="4" fill="currentColor" stroke="none" />
  </svg>
)

const STATUS_COPY: Record<string, { label: string; tone: "info" | "success" | "error" | "progress" }> = {
  connecting: { label: "Talking with the assistant…", tone: "progress" },
  streaming: { label: "Working on your request…", tone: "progress" },
  complete: { label: "Done!", tone: "success" },
  error: { label: "Something needs your attention.", tone: "error" },
}

const toneClasses: Record<(typeof STATUS_COPY)[keyof typeof STATUS_COPY]["tone"], string> = {
  info: "bg-sky-500/10 text-sky-500 border border-sky-500/20",
  success: "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20",
  error: "bg-destructive/10 text-destructive border border-destructive/30",
  progress: "bg-primary/10 text-primary border border-primary/20",
}

function StatusPill({ status, isStreaming, error }: { status: string; isStreaming: boolean; error?: string }) {
  if (status === "idle") {
    return (
      <div className="inline-flex w-full items-center justify-between rounded-lg border border-dashed border-border/70 px-3 py-2 text-sm text-muted-foreground">
        Ready when you are
      </div>
    )
  }

  const state = STATUS_COPY[status] ?? STATUS_COPY.connecting
  const IconComponent = state.tone === "success" ? CheckCircle2 : state.tone === "error" ? AlertCircle : AssistantMark

  return (
    <div className={cn("inline-flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-sm", toneClasses[state.tone])}>
      <span className="inline-flex items-center gap-2 font-medium tracking-tight">
        <IconComponent className={cn("size-4", state.tone === "progress" && isStreaming ? "animate-pulse" : "")} />
        {state.label}
      </span>
      {status === "error" && error ? <span className="text-xs">{error}</span> : null}
    </div>
  )
}

function StreamingPanel({ text, isStreaming, placeholder }: { text: string; isStreaming: boolean; placeholder: string }) {
  return (
    <div className="relative rounded-lg border border-border/60 bg-background/70 p-4 shadow-sm">
      <div
        className={cn(
          "pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-500",
          isStreaming ? "opacity-80" : "opacity-0",
        )}
        aria-hidden="true"
      >
        <div className="absolute inset-y-0 left-0 w-1/2 -translate-x-full animate-[shimmer_2s_linear_infinite] bg-gradient-to-r from-transparent via-primary/10 to-transparent" />
      </div>
      <ScrollArea className="h-full max-h-[220px] pr-2">
        <p className={cn("text-sm leading-6 tracking-tight text-muted-foreground", text && "text-foreground")}>{text || placeholder}</p>
      </ScrollArea>
    </div>
  )
}

function CompositionSummary({
  plan,
  isStreaming,
  rawText,
}: {
  plan: WorkspaceCompositionResult | null
  isStreaming: boolean
  rawText: string
}) {
  if (!plan) {
    return (
      <StreamingPanel
        text={rawText}
        isStreaming={isStreaming}
        placeholder="Ask for a new workspace, folder, or document structure—results stream here for quick review."
      />
    )
  }

  const cards = [
    { title: plan.workspaceTitle, caption: plan.workspaceCreated ? "Workspace created" : "Workspace updated" },
    { title: plan.folderTitle, caption: plan.folderCreated ? "Folder created" : "Folder updated" },
    { title: plan.fileTitle, caption: "Document drafted" },
  ]

  return (
    <div className="space-y-3">
      <div className={cn("rounded-lg border border-primary/30 bg-primary/5 p-4", isStreaming && "animate-pulse")}>
        <div className="flex items-center gap-3 text-sm text-primary">
          <AssistantMark className="size-5" />
          <span>Preview the structure before applying it to your workspace.</span>
        </div>
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        {cards.map((item) => (
          <div
            key={item.title}
            className={cn(
              "rounded-md border border-border/60 bg-background/80 p-3 shadow-sm transition-all duration-200",
              isStreaming ? "animate-pulse" : "hover:-translate-y-0.5 hover:border-primary/40 hover:shadow",
            )}
          >
            <p className="text-sm font-semibold text-foreground">{item.title}</p>
            <p className="mt-1 text-xs text-muted-foreground">{item.caption}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

const AiAssistant: React.FC<AiAssistantProps> = ({ workspaceId, folderId, fileId, workspaceTitle, className }) => {
  const [open, setOpen] = useState(false)
  const [summaryWords, setSummaryWords] = useState(220)
  const [maxTitleLength, setMaxTitleLength] = useState(48)
  const [instructions, setInstructions] = useState("")

  const summaryFactory = useCallback(
    (payload: SummaryRequest, handlers: Parameters<typeof streamSummarizeFile>[1]) => streamSummarizeFile(payload, handlers),
    [],
  )
  const titleFactory = useCallback(
    (payload: TitleRequest, handlers: Parameters<typeof streamSuggestTitle>[1]) => streamSuggestTitle(payload, handlers),
    [],
  )
  const composeFactory = useCallback(
    (payload: ComposeRequest, handlers: Parameters<typeof streamComposeWorkspace>[1]) => streamComposeWorkspace(payload, handlers),
    [],
  )

  const summaryStream = useAiStream<SummaryRequest>(summaryFactory, {
    transformChunk: (chunk) => chunk.replace(/\s+/g, " ").replace(/\s([,.!?])/g, "$1"),
  })
  const titleStream = useAiStream<TitleRequest>(titleFactory, {
    transformChunk: (chunk) => chunk.replace(/\s+/g, " ").trim(),
  })
  const composeStream = useAiStream<ComposeRequest>(composeFactory)

  const compositionSnapshot = useMemo(() => {
    if (composeStream.status === "complete") {
      const trimmed = composeStream.text.trim()
      if (!trimmed) {
        return { plan: null as WorkspaceCompositionResult | null, error: null as string | null }
      }
      try {
        const parsed = JSON.parse(trimmed) as WorkspaceCompositionResult
        return { plan: parsed, error: null as string | null }
      } catch (error) {
        console.error("Failed to parse composition stream", error)
        return { plan: null, error: "The assistant response could not be parsed. Please try again." }
      }
    }
    if (composeStream.status === "connecting") {
      return { plan: null as WorkspaceCompositionResult | null, error: null as string | null }
    }
    return { plan: null as WorkspaceCompositionResult | null, error: null as string | null }
  }, [composeStream.status, composeStream.text])

  const compositionPlan = compositionSnapshot.plan
  const compositionParseError = compositionSnapshot.error

  const canSummarize = Boolean(fileId)
  const canSuggestTitle = Boolean(workspaceId)
  const canCompose = Boolean(instructions.trim())

  const summaryPlaceholder = "A crisp summary appears here while the assistant streams it into place."

  const refinedTitlePlaceholder = workspaceTitle
    ? `Click "Suggest improved title" to polish "${workspaceTitle}".`
    : "Trigger the assistant to rework your current workspace title."

  const handleSummarize = () => {
    if (!fileId) return
    summaryStream.start({ fileId, maxWords: summaryWords })
  }

  const handleSuggestTitle = () => {
    if (!workspaceId) return
    titleStream.start({ workspaceId, maxLen: maxTitleLength })
  }

  const handleCompose = () => {
    if (!instructions.trim()) return
    const payload: ComposeRequest = {
      instructions: instructions.trim(),
    }
    if (workspaceId) payload.workspaceId = workspaceId
    if (folderId) payload.folderId = folderId
    composeStream.start(payload)
  }

  const disabledCopy = !(summaryStream.text || titleStream.text || compositionPlan || composeStream.text)

  const handleCopy = async () => {
    if (disabledCopy || typeof navigator === "undefined" || typeof navigator.clipboard === "undefined") return
    try {
      const chunks = [
        summaryStream.text ? `Summary:\n${summaryStream.text}` : null,
        titleStream.text ? `Suggested Title:\n${titleStream.text}` : null,
        compositionPlan
          ? `Workspace Plan:\n${JSON.stringify(compositionPlan, null, 2)}`
          : composeStream.text
            ? `Workspace Plan:\n${composeStream.text}`
            : null,
      ].filter(Boolean)
      if (chunks.length > 0) {
        await navigator.clipboard.writeText(chunks.join("\n\n"))
      }
    } catch (error) {
      console.error("Failed to copy AI output", error)
    }
  }

  return (
    <div className={cn("pointer-events-none fixed bottom-6 right-6 z-40 flex flex-col items-end gap-3", className)}>
      <div className="pointer-events-auto">
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button
              size="lg"
              className="group relative gap-2 rounded-full bg-primary px-6 py-5 text-base font-semibold text-primary-foreground shadow-[0_18px_40px_-18px_rgba(59,130,246,0.75)] transition-transform duration-200 hover:-translate-y-1 hover:shadow-[0_20px_55px_-15px_rgba(59,130,246,0.8)]"
            >
              <span className="absolute inset-0 rounded-full border border-primary/50 opacity-0 transition-opacity group-hover:opacity-100" />
              <AssistantMark className="size-5 text-primary-foreground" />
              <span>AI Assistant</span>
              <Sparkles className="size-4 text-primary-foreground/80 transition-transform duration-200 group-hover:rotate-12" />
            </Button>
          </SheetTrigger>
          <SheetContent
            side="right"
            className="w-full max-w-[420px] border-l border-border/50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80"
          >
            <SheetHeader className="space-y-2 border-b border-border/60 pb-4">
              <SheetTitle className="flex items-center gap-3 text-xl font-semibold text-foreground">
                <span className="flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <AssistantMark className="size-6" />
                </span>
                AI Assistant
              </SheetTitle>
              <SheetDescription className="text-sm text-muted-foreground">
                Keep your notes tidy with quick summaries, sharper titles, and workspace scaffolds that stream live.
              </SheetDescription>
            </SheetHeader>

            <div className="mt-5 space-y-5">
              <div className="rounded-lg border border-dashed border-border/70 bg-muted/30 px-4 py-3 text-xs text-muted-foreground">
                Select a tool below, trigger it, and watch responses appear without leaving your document.
              </div>

              <Tabs defaultValue="summarize" className="space-y-4">
                <TabsList className="grid w-full grid-cols-3 gap-1 rounded-lg bg-muted p-1">
                  <TabsTrigger value="summarize">
                    <FileText className="size-4" />
                    Summarize
                  </TabsTrigger>
                  <TabsTrigger value="title">
                    <WandIcon className="size-4" />
                    Title
                  </TabsTrigger>
                  <TabsTrigger value="compose">
                    <Wand2 className="size-4" />
                    Compose
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="summarize">
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-foreground">Maximum words</label>
                      <Input
                        type="number"
                        min={20}
                        max={500}
                        step={10}
                        value={summaryWords}
                        onChange={(event) => setSummaryWords(Number.parseInt(event.target.value, 10) || 120)}
                      />
                    </div>
                    <Button disabled={!canSummarize || summaryStream.isStreaming} className="w-full justify-center" onClick={handleSummarize}>
                      <Loader2 className={cn("size-4", summaryStream.isStreaming && "animate-spin")} />
                      {summaryStream.isStreaming ? "Summarizing…" : "Summarize this file"}
                    </Button>
                    <StatusPill status={summaryStream.status} isStreaming={summaryStream.isStreaming} error={summaryStream.error} />
                    <StreamingPanel text={summaryStream.text} isStreaming={summaryStream.isStreaming} placeholder={summaryPlaceholder} />
                  </div>
                </TabsContent>

                <TabsContent value="title">
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-foreground">Maximum characters</label>
                      <Input
                        type="number"
                        min={12}
                        max={80}
                        step={2}
                        value={maxTitleLength}
                        onChange={(event) => setMaxTitleLength(Number.parseInt(event.target.value, 10) || 48)}
                      />
                    </div>
                    <Button disabled={!canSuggestTitle || titleStream.isStreaming} className="w-full justify-center" onClick={handleSuggestTitle}>
                      <Loader2 className={cn("size-4", titleStream.isStreaming && "animate-spin")} />
                      {titleStream.isStreaming ? "Refining…" : "Suggest improved title"}
                    </Button>
                    <StatusPill status={titleStream.status} isStreaming={titleStream.isStreaming} error={titleStream.error} />
                    <StreamingPanel text={titleStream.text} isStreaming={titleStream.isStreaming} placeholder={refinedTitlePlaceholder} />
                  </div>
                </TabsContent>

                <TabsContent value="compose">
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-foreground">Instructions</label>
                      <Textarea
                        placeholder='Example: "Outline an onboarding workspace with a project overview folder and a task checklist file."'
                        value={instructions}
                        onChange={(event) => setInstructions(event.target.value)}
                        rows={4}
                      />
                    </div>
                    <Button disabled={!canCompose || composeStream.isStreaming} className="w-full justify-center" onClick={handleCompose}>
                      <Loader2 className={cn("size-4", composeStream.isStreaming && "animate-spin")} />
                      {composeStream.isStreaming ? "Scaffolding…" : "Compose workspace"}
                    </Button>
                    <StatusPill
                      status={composeStream.status}
                      isStreaming={composeStream.isStreaming}
                      error={composeStream.error ?? compositionParseError ?? undefined}
                    />
                    <CompositionSummary plan={compositionPlan} isStreaming={composeStream.isStreaming} rawText={composeStream.text} />
                  </div>
                </TabsContent>
              </Tabs>

              <div className="flex items-center justify-between rounded-lg border border-border/60 bg-background/80 px-4 py-3 text-xs text-muted-foreground">
                <span>All responses stream securely from your AI service.</span>
                <Button variant="ghost" size="sm" disabled={disabledCopy} onClick={handleCopy}>
                  Copy all
                </Button>
              </div>
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </div>
  )
}

export default AiAssistant
