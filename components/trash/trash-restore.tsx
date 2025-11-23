"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FileIcon, FolderIcon, RotateCcw, Trash2 } from "lucide-react";

import { appFoldersType, useAppState } from "@/lib/providers/state-provider";
import type { FileDto } from "@/lib/queries";
import { updateFolder, updateFile, deleteFolder, deleteFile } from "@/lib/queries";
import { useToast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

const TrashRestore = () => {
  const router = useRouter();
  const { state, workspaceId, dispatch, folderId: activeFolderId, fileId: activeFileId } = useAppState();
  const { toast } = useToast();
  const [pendingIds, setPendingIds] = useState<Record<string, "restore" | "delete">>({});

  const folders = useMemo(() => {
    if (!workspaceId) {
      return [] as appFoldersType[];
    }
    return (
      state.workspaces
        .find((workspace) => workspace.id === workspaceId)
        ?.folders.filter((folder) => folder.inTrash) ?? []
    );
  }, [state, workspaceId]);

  const files = useMemo(() => {
    if (!workspaceId) {
      return [] as FileDto[];
    }
    const collected: FileDto[] = [];
    state.workspaces
      .find((workspace) => workspace.id === workspaceId)
      ?.folders.forEach((folder) => {
        folder.files.forEach((file) => {
          if (file.inTrash) {
            collected.push(file);
          }
        });
      });
    return collected;
  }, [state, workspaceId]);

  const setPending = (id: string, value: "restore" | "delete" | null) => {
    setPendingIds((prev) => {
      if (value === null) {
        const { [id]: _, ...rest } = prev;
        return rest;
      }
      return { ...prev, [id]: value };
    });
  };

  return (
    <section className="space-y-6">
      <TrashSection
        title="Folders"
        items={folders}
        renderItem={(folder) => (
          <TrashRow
            key={folder.id}
            icon={<FolderIcon className="h-4 w-4" />}
            title={folder.title ?? "Untitled"}
            subtitle="Folder"
            href={`/dashboard/${folder.workspaceId}/${folder.id}`}
            isPending={Boolean(pendingIds[folder.id])}
            onRestore={async () => {
              if (!workspaceId) return;
              setPending(folder.id, "restore");
              try {
                dispatch({
                  type: "UPDATE_FOLDER",
                  payload: { workspaceId, folderId: folder.id, folder: { inTrash: false } },
                });
                await updateFolder(folder.id, { workspaceId, inTrash: false });
                toast({ title: "Folder restored" });
                if (activeFolderId === folder.id) {
                  router.replace(`/dashboard/${workspaceId}/${folder.id}`);
                }
              } catch (error) {
                console.error("Failed to restore folder", error);
                toast({ title: "Unable to restore folder", variant: "destructive" });
              } finally {
                setPending(folder.id, null);
              }
            }}
            onDelete={async () => {
              if (!workspaceId) return;
              setPending(folder.id, "delete");
              try {
                dispatch({ type: "DELETE_FOLDER", payload: { workspaceId, folderId: folder.id } });
                await deleteFolder(folder.id);
                toast({ title: "Folder permanently deleted" });
                if (activeFolderId === folder.id || activeFileId) {
                  router.replace(`/dashboard/${workspaceId}`);
                }
              } catch (error) {
                console.error("Failed to delete folder", error);
                toast({ title: "Unable to delete folder", variant: "destructive" });
              } finally {
                setPending(folder.id, null);
              }
            }}
          />
        )}
      />

      <TrashSection
        title="Files"
        items={files}
        renderItem={(file) => (
          <TrashRow
            key={file.id}
            icon={<FileIcon className="h-4 w-4" />}
            title={file.title ?? "Untitled"}
            subtitle={state.workspaces
              .find((workspace) => workspace.id === file.workspaceId)
              ?.folders.find((folder) => folder.id === file.folderId)?.title ?? "File"}
            href={`/dashboard/${file.workspaceId}/${file.folderId}/${file.id}`}
            isPending={Boolean(pendingIds[file.id])}
            onRestore={async () => {
              if (!workspaceId) return;
              setPending(file.id, "restore");
              try {
                dispatch({
                  type: "UPDATE_FILE",
                  payload: { workspaceId, folderId: file.folderId, fileId: file.id, file: { inTrash: false } },
                });
                await updateFile(file.id, {
                  workspaceId,
                  folderId: file.folderId,
                  inTrash: false,
                  title: file.title,
                  iconId: file.iconId ?? "📄",
                });
                toast({ title: "File restored" });
                if (activeFileId === file.id) {
                  router.replace(`/dashboard/${workspaceId}/${file.folderId}/${file.id}`);
                }
              } catch (error) {
                console.error("Failed to restore file", error);
                toast({ title: "Unable to restore file", variant: "destructive" });
              } finally {
                setPending(file.id, null);
              }
            }}
            onDelete={async () => {
              if (!workspaceId) return;
              setPending(file.id, "delete");
              try {
                dispatch({
                  type: "DELETE_FILE",
                  payload: { workspaceId, folderId: file.folderId, fileId: file.id },
                });
                await deleteFile(file.id);
                toast({ title: "File permanently deleted" });
                if (activeFileId === file.id) {
                  router.replace(`/dashboard/${workspaceId}`);
                }
              } catch (error) {
                console.error("Failed to delete file", error);
                toast({ title: "Unable to delete file", variant: "destructive" });
              } finally {
                setPending(file.id, null);
              }
            }}
          />
        )}
      />

      {!files.length && !folders.length && (
        <div className="flex min-h-[160px] items-center justify-center text-sm text-muted-foreground">
          Nothing in trash yet.
        </div>
      )}
    </section>
  );
};

export default TrashRestore;

interface TrashSectionProps<T> {
  title: string;
  items: T[];
  renderItem: (item: T) => React.ReactNode;
}

const TrashSection = <T,>({ title, items, renderItem }: TrashSectionProps<T>) => {
  if (!items.length) {
    return null;
  }
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">{title}</h3>
        <span className="text-xs text-muted-foreground">{items.length}</span>
      </div>
      <div className="space-y-2">
        {items.map((item) => renderItem(item))}
      </div>
    </div>
  );
};

interface TrashRowProps {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  href: string;
  isPending: boolean;
  onRestore: () => Promise<void>;
  onDelete: () => Promise<void>;
}

const TrashRow: React.FC<TrashRowProps> = ({ icon, title, subtitle, href, isPending, onRestore, onDelete }) => {
  return (
    <div className="group rounded-2xl border border-border/40 bg-background/70 p-3 transition hover:border-border">
      <div className="flex items-center justify-between gap-3">
        <Link href={href} className="flex flex-1 items-center gap-2 overflow-hidden text-left">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-muted/70 text-muted-foreground">
            {icon}
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-foreground">{title}</p>
            {subtitle && <p className="truncate text-xs text-muted-foreground">{subtitle}</p>}
          </div>
        </Link>
        <div className="flex items-center gap-2">
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8"
            onClick={onRestore}
            disabled={isPending}
          >
            <RotateCcw className="h-4 w-4" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8 text-destructive hover:text-destructive"
            onClick={onDelete}
            disabled={isPending}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
      <Separator className="mt-3 opacity-0 transition group-hover:opacity-100" />
    </div>
  );
};
