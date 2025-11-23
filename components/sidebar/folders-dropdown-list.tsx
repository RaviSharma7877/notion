'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { PlusIcon, Pencil, Trash2, Check, X, ExternalLink } from 'lucide-react';

import {
  type FolderCreateInput,
  type FileCreateInput,
  type FolderDto,
  type SubscriptionDto,
  type FileDto,
  createFolder,
  createFile,
  updateFolder,
  updateFile,
  listFiles,
} from '@/lib/queries';
import {
  useAppState,
  type appFoldersType,
} from '@/lib/providers/state-provider';
import { useSubscriptionModal } from '@/lib/providers/subscription-modal-provider';

import TooltipComponent from '../global/tooltip-component';
import { useToast } from '../ui/use-toast';
import { Accordion } from '../ui/accordion';
import Dropdown from './Dropdown';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Separator } from '../ui/separator';

interface FoldersDropdownListProps {
  workspaceFolders: FolderDto[];
  workspaceId?: string;
  subscription: SubscriptionDto | null;
  collapsed?: boolean;
  onExpandRequest?: () => void;
}

const FoldersDropdownList: React.FC<FoldersDropdownListProps> = ({
  workspaceFolders,
  workspaceId,
  subscription,
  collapsed = false,
  onExpandRequest,
}) => {
  const { state, dispatch, folderId } = useAppState();
  const { setOpen } = useSubscriptionModal();
  const { toast } = useToast();

  const folders = useMemo<appFoldersType[]>(() => {
    if (!workspaceId) {
      return [];
    }
    return (
      state.workspaces.find((workspace) => workspace.id === workspaceId)?.folders ?? []
    );
  }, [state, workspaceId]);

  const normalizedSubscriptionStatus = useMemo(
    () => (subscription?.status ?? '').toUpperCase(),
    [subscription?.status]
  );

  useEffect(() => {
    if (!workspaceId || !workspaceFolders.length) {
      return;
    }

    const existingWorkspace = state.workspaces.find(
      (workspace) => workspace.id === workspaceId
    );
    const existingFolders = existingWorkspace?.folders ?? [];

    const normalizedFolders = workspaceFolders.map((folder) => ({
      ...folder,
      files:
        existingFolders.find((f) => f.id === folder.id)?.files ?? [],
    }));

    const hasChanges =
      normalizedFolders.length !== existingFolders.length ||
      normalizedFolders.some((folder) => {
        const existing = existingFolders.find((item) => item.id === folder.id);
        if (!existing) {
          return true;
        }

        return (
          existing.title !== folder.title ||
          existing.iconId !== folder.iconId ||
          existing.data !== folder.data ||
          existing.inTrash !== folder.inTrash ||
          existing.bannerUrl !== folder.bannerUrl
        );
      });

    if (!hasChanges) {
      return;
    }

    dispatch({
      type: 'SET_FOLDERS',
      payload: {
        workspaceId,
        folders: normalizedFolders,
      },
    });
  }, [workspaceFolders, workspaceId, dispatch, state.workspaces]);

  const addFolderHandler = async () => {
    if (!workspaceId) return;

    if (folders.length >= 3 && normalizedSubscriptionStatus !== 'ACTIVE') {
      setOpen(true);
      return;
    }

    try {
      const payload: FolderCreateInput = {
        title: 'Untitled',
        iconId: '📄',
        data: null,
        inTrash: false,
        workspaceId,
        bannerUrl: null,
      };

      const createdFolder = await createFolder(payload);
      dispatch({
        type: 'ADD_FOLDER',
        payload: { workspaceId, folder: { ...createdFolder, files: [] } },
      });

      toast({
        title: 'Success',
        description: 'Created folder.',
      });
    } catch (error) {
      console.error('Could not create folder', error);
      toast({
        title: 'Error',
        variant: 'destructive',
        description: 'Could not create the folder',
      });
    }
  };

  const visibleFolders = folders.filter((folder) => !folder.inTrash);

  if (collapsed) {
    return (
      <div className="flex w-full flex-col items-center gap-4 py-4">
        <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Folders</span>
        <div className="grid grid-cols-2 gap-3">
          {visibleFolders.length === 0 && (
            <span className="col-span-2 px-4 text-center text-[11px] text-muted-foreground">
              No folders yet
            </span>
          )}
          {visibleFolders.map((folder) => (
            <CollapsedFolderCard
              key={folder.id}
              folder={folder}
              workspaceId={workspaceId}
              onExpandRequest={onExpandRequest}
            />
          ))}
        </div>
        <TooltipComponent message="Create Folder">
          <button
            type="button"
            onClick={() => {
              if (onExpandRequest) {
                onExpandRequest();
              }
              void addFolderHandler();
            }}
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-dashed border-border/60 text-muted-foreground transition hover:border-border hover:text-foreground"
          >
            <PlusIcon size={16} />
          </button>
        </TooltipComponent>
      </div>
    );
  }

  return (
    <>
      <div
        className="flex
        sticky 
        z-20 
        top-0 
        bg-background 
        w-full  
        h-10 
        group/title 
        justify-between 
        items-center 
        pr-4 
        text-Neutrals/neutrals-8
  "
      >
        <span
          className="text-Neutrals-8 
        font-bold 
        text-xs"
        >
          FOLDERS
        </span>
        <TooltipComponent message="Create Folder">
          <PlusIcon
            onClick={addFolderHandler}
            size={16}
            className="group-hover/title:inline-block
            hidden 
            cursor-pointer
            hover:dark:text-white
          "
          />
        </TooltipComponent>
      </div>
      <Accordion
        type="multiple"
        defaultValue={[folderId || '']}
        className="pb-20"
      >
        {visibleFolders.map((folder) => (
          <Dropdown
            key={folder.id}
            title={folder.title}
            listType="folder"
            id={folder.id}
            iconId={folder.iconId}
          />
        ))}
      </Accordion>
    </>
  );
};

export default FoldersDropdownList;

interface CollapsedFolderCardProps {
  folder: appFoldersType;
  workspaceId?: string;
  onExpandRequest?: () => void;
}

const CollapsedFolderCard: React.FC<CollapsedFolderCardProps> = ({ folder, workspaceId, onExpandRequest }) => {
  const router = useRouter();
  const { dispatch } = useAppState();
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [renamingFolder, setRenamingFolder] = useState(false);
  const [folderTitle, setFolderTitle] = useState(folder.title ?? 'Untitled');
  const [pendingFolderAction, setPendingFolderAction] = useState(false);
  const [activeFileEdit, setActiveFileEdit] = useState<string | null>(null);
  const [fileDraftTitle, setFileDraftTitle] = useState('');
  const [pendingFileAction, setPendingFileAction] = useState(false);
  const [filesState, setFilesState] = useState<FileDto[]>(() => folder.files?.filter((file) => !file.inTrash) ?? []);
  const [filesLoading, setFilesLoading] = useState(false);
  const [filesError, setFilesError] = useState<string | null>(null);

  useEffect(() => {
    setFolderTitle(folder.title ?? 'Untitled');
  }, [folder.title]);

  useEffect(() => {
    setFilesState(folder.files?.filter((file) => !file.inTrash) ?? []);
  }, [folder.files]);

  useEffect(() => {
    if (!isOpen || !workspaceId) return;
    let active = true;
    const loadFiles = async () => {
      try {
        setFilesLoading(true);
        setFilesError(null);
        const page = await listFiles({ workspaceId, folderId: folder.id, size: 200, sort: 'createdAt,DESC' });
        if (!active) return;
        setFilesState((page.content ?? []).filter((file) => !file.inTrash));
      } catch (error) {
        console.error('Failed to load files for collapsed view', error);
        if (active) {
          setFilesError('Could not load files');
        }
      } finally {
        if (active) {
          setFilesLoading(false);
        }
      }
    };
    void loadFiles();
    return () => {
      active = false;
    };
  }, [isOpen, workspaceId, folder.id]);

  const files = useMemo(() => filesState, [filesState]);

  const handleFolderRename = async () => {
    if (!workspaceId) return;
    const nextTitle = folderTitle.trim() || 'Untitled';
    if (nextTitle === (folder.title ?? '')) {
      setRenamingFolder(false);
      return;
    }
    try {
      setPendingFolderAction(true);
      dispatch({ type: 'UPDATE_FOLDER', payload: { workspaceId, folderId: folder.id, folder: { title: nextTitle } } });
      await updateFolder(folder.id, { workspaceId, title: nextTitle, iconId: folder.iconId ?? '📁' });
      toast({ title: 'Folder updated', description: 'Your folder name has been saved.' });
      setRenamingFolder(false);
      setFilesState((prev) => [...prev]);
    } catch (error) {
      console.error('Failed to rename folder', error);
      toast({ title: 'Unable to rename', description: 'Please try again in a moment.', variant: 'destructive' });
      setFolderTitle(folder.title ?? 'Untitled');
    } finally {
      setPendingFolderAction(false);
    }
  };

  const handleFolderTrash = async () => {
    if (!workspaceId) return;
    try {
      setPendingFolderAction(true);
      dispatch({ type: 'UPDATE_FOLDER', payload: { workspaceId, folderId: folder.id, folder: { inTrash: true } } });
      await updateFolder(folder.id, { workspaceId, inTrash: true, iconId: folder.iconId ?? '📁', title: folder.title });
      toast({ title: 'Folder moved to trash' });
      setIsOpen(false);
    } catch (error) {
      console.error('Failed to trash folder', error);
      toast({ title: 'Unable to move folder', description: 'Please try again.', variant: 'destructive' });
    } finally {
      setPendingFolderAction(false);
    }
  };

  const handleAddFile = async () => {
    if (!workspaceId) return;
    if (pendingFolderAction) return;
    try {
      setPendingFolderAction(true);
      const payload: FileCreateInput = {
        title: 'Untitled',
        iconId: '📄',
        data: null,
        inTrash: false,
        bannerUrl: null,
        workspaceId,
        folderId: folder.id,
      };
      const created = await createFile(payload);
      if (!created) {
        toast({ title: 'Unable to create file', description: 'Please try again.', variant: 'destructive' });
        return;
      }
      const fallbackTimestamp = new Date().toISOString();
      const safeFile: FileDto = {
        ...created,
        createdAt: (created as any)?.createdAt ?? fallbackTimestamp,
        updatedAt: (created as any)?.updatedAt ?? fallbackTimestamp,
      };
      dispatch({ type: 'ADD_FILE', payload: { workspaceId, folderId: folder.id, file: safeFile } });
      setFilesState((prev) => [safeFile, ...prev]);
      toast({ title: 'File created', description: 'A new file has been added to this folder.' });
    } catch (error) {
      console.error('Failed to create file', error);
      toast({ title: 'Unable to create file', description: 'Please try again.', variant: 'destructive' });
    } finally {
      setPendingFolderAction(false);
    }
  };

  const handleOpenFile = (fileId: string) => {
    if (!workspaceId) return;
    router.push(`/dashboard/${workspaceId}/${folder.id}/${fileId}`);
    setIsOpen(false);
  };

  const startRenameFile = (fileId: string, currentTitle: string) => {
    setActiveFileEdit(fileId);
    setFileDraftTitle(currentTitle ?? 'Untitled');
  };

  const handleFileRename = async (fileId: string) => {
    if (!workspaceId) return;
    const nextTitle = fileDraftTitle.trim() || 'Untitled';
    const current = files.find((file) => file.id === fileId);
    if (!current) {
      setActiveFileEdit(null);
      return;
    }
    if (nextTitle === current.title) {
      setActiveFileEdit(null);
      return;
    }
    try {
      setPendingFileAction(true);
      dispatch({
        type: 'UPDATE_FILE',
        payload: { workspaceId, folderId: folder.id, fileId, file: { title: nextTitle } },
      });
      await updateFile(fileId, {
        title: nextTitle,
        workspaceId,
        folderId: folder.id,
        iconId: current.iconId ?? '📄',
      });
      setFilesState((prev) =>
        prev.map((file) => (file.id === fileId ? { ...file, title: nextTitle } : file))
      );
      toast({ title: 'File updated' });
    } catch (error) {
      console.error('Failed to rename file', error);
      toast({ title: 'Unable to rename file', description: 'Please try again.', variant: 'destructive' });
    } finally {
      setActiveFileEdit(null);
      setPendingFileAction(false);
    }
  };

  const handleFileTrash = async (fileId: string) => {
    if (!workspaceId) return;
    const current = files.find((file) => file.id === fileId);
    if (!current) return;
    try {
      setPendingFileAction(true);
      dispatch({
        type: 'UPDATE_FILE',
        payload: { workspaceId, folderId: folder.id, fileId, file: { inTrash: true } },
      });
      await updateFile(fileId, {
        inTrash: true,
        workspaceId,
        folderId: folder.id,
        title: current.title,
        iconId: current.iconId ?? '📄',
      });
      setFilesState((prev) => prev.filter((file) => file.id !== fileId));
      toast({ title: 'File moved to trash' });
    } catch (error) {
      console.error('Failed to trash file', error);
      toast({ title: 'Unable to move file', description: 'Please try again.', variant: 'destructive' });
    } finally {
      setPendingFileAction(false);
    }
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="flex h-12 w-12 items-center justify-center rounded-2xl border border-border/40 bg-gradient-to-br from-background/95 via-muted/60 to-background/95 text-2xl shadow-sm transition hover:-translate-y-0.5 hover:scale-[1.02] hover:border-border"
        >
          {folder.iconId ?? '📁'}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-72 rounded-2xl border border-border/40 bg-gradient-to-b from-background/95 via-muted/60 to-background/90 p-4 shadow-xl">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-start gap-3">
            <span className="text-2xl leading-none">{folder.iconId ?? '📁'}</span>
            <div className="flex flex-col">
              {renamingFolder ? (
                <div className="flex items-center gap-2">
                  <Input
                    value={folderTitle}
                    onChange={(event) => setFolderTitle(event.target.value)}
                    className="h-8 text-sm"
                    autoFocus
                    disabled={pendingFolderAction}
                  />
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8"
                    onClick={handleFolderRename}
                    disabled={pendingFolderAction}
                  >
                    <Check className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8"
                    onClick={() => {
                      setRenamingFolder(false);
                      setFolderTitle(folder.title ?? 'Untitled');
                    }}
                    disabled={pendingFolderAction}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <>
                  <h4 className="text-sm font-semibold text-foreground">{folder.title}</h4>
                  <p className="text-xs text-muted-foreground">{files.length} file{files.length === 1 ? '' : 's'}</p>
                </>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1">
            <TooltipComponent message="Rename folder">
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8"
                onClick={() => setRenamingFolder(true)}
                disabled={pendingFolderAction}
              >
                <Pencil className="h-4 w-4" />
              </Button>
            </TooltipComponent>
            <TooltipComponent message="Move to trash">
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8 text-destructive hover:text-destructive"
                onClick={handleFolderTrash}
                disabled={pendingFolderAction}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </TooltipComponent>
          </div>
        </div>
        <Separator className="my-3" />
        <div className="flex items-center justify-between">
          <span className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Files</span>
          <Button size="sm" variant="secondary" className="h-7 px-2 text-xs" onClick={handleAddFile} disabled={pendingFolderAction}>
            <PlusIcon className="mr-1 h-3 w-3" />
            New file
          </Button>
        </div>
        <div className="mt-3 space-y-1.5">
          {filesLoading && <p className="rounded-lg border border-dashed border-border/60 bg-background/60 p-3 text-xs text-muted-foreground">Loading files…</p>}
          {!filesLoading && filesError && (
            <p className="rounded-lg border border-dashed border-destructive/40 bg-background/60 p-3 text-xs text-destructive">
              {filesError}
            </p>
          )}
          {!filesLoading && !filesError && files.length === 0 && (
            <p className="rounded-lg border border-dashed border-border/60 bg-background/60 p-3 text-xs text-muted-foreground">No files yet. Create your first file to get started.</p>
          )}
          {files.map((file) => (
            <div key={file.id} className="group flex items-center gap-2 rounded-xl border border-transparent bg-background/60 px-2 py-2 transition hover:border-border">
              <button
                type="button"
                className="flex flex-1 items-center gap-2 text-left"
                onClick={() => handleOpenFile(file.id)}
              >
                <span className="text-lg leading-none">{file.iconId ?? '📄'}</span>
                {activeFileEdit === file.id ? (
                  <Input
                    value={fileDraftTitle}
                    onChange={(event) => setFileDraftTitle(event.target.value)}
                    className="h-8 text-sm"
                    autoFocus
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault();
                        void handleFileRename(file.id);
                      }
                      if (event.key === 'Escape') {
                        setActiveFileEdit(null);
                        setFileDraftTitle('');
                      }
                    }}
                    disabled={pendingFileAction}
                  />
                ) : (
                  <span className="truncate text-sm font-medium text-foreground">{file.title ?? 'Untitled'}</span>
                )}
              </button>
              {activeFileEdit === file.id ? (
                <div className="flex items-center gap-1">
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7"
                    onClick={() => handleFileRename(file.id)}
                    disabled={pendingFileAction}
                  >
                    <Check className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7"
                    onClick={() => {
                      setActiveFileEdit(null);
                      setFileDraftTitle('');
                    }}
                    disabled={pendingFileAction}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <div className="flex items-center gap-1 opacity-0 transition group-hover:opacity-100">
                  <TooltipComponent message="Open">
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handleOpenFile(file.id)}>
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                  </TooltipComponent>
                  <TooltipComponent message="Rename">
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => startRenameFile(file.id, file.title ?? 'Untitled')}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                  </TooltipComponent>
                  <TooltipComponent message="Move to trash">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 text-destructive hover:text-destructive"
                      onClick={() => handleFileTrash(file.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TooltipComponent>
                </div>
              )}
            </div>
          ))}
        </div>
        {onExpandRequest && (
          <Button
            variant="ghost"
            className="mt-4 w-full justify-center text-xs text-muted-foreground hover:text-foreground"
            onClick={() => {
              onExpandRequest();
              setIsOpen(false);
            }}
          >
            Open detailed sidebar
          </Button>
        )}
      </PopoverContent>
    </Popover>
  );
};
