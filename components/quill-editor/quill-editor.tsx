'use client';
import { useAppState } from '@/lib/providers/state-provider';
import type {
  appFoldersType,
  appWorkspacesType,
} from '@/lib/providers/state-provider';
import type { FileDto, FolderDto, UserDto, WorkspaceDto } from '@/lib/queries';
import React, {
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import type Quill from 'quill';
import 'quill/dist/quill.snow.css';
import { Button } from '../ui/button';
// import { CollaborationIndicator } from '@/components/collaboration/collaboration-indicator';
// import { CollaborationPanel } from '@/components/collaboration/collaboration-panel';
// import { PresencePanel } from '@/components/collaboration/presence-panel';
import {
  createCollaborator,
  deleteFile,
  deleteFolder,
  deleteBanner as removeBannerAsset,
  getFile,
  getFolder,
  getWorkspace,
  getUser,
  listCollaborators,
  deleteCollaborator,
  updateFile,
  updateFolder,
  updateWorkspace,
} from '@/lib/queries';
import { resolveWorkspaceOwnerId } from '@/lib/auth/user';
import { usePathname, useRouter } from 'next/navigation';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '../ui/tooltip';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { Badge } from '../ui/badge';
import Image from 'next/image';
import EmojiPicker from '../global/emoji-picker';
import BannerUpload from '../banner-upload/banner-upload';
import { Loader2, Share2, XCircleIcon } from 'lucide-react';
// import { useSocket } from '@/lib/providers/socket-provider';
import { useAuth } from '@/lib/providers/auth-provider';
import { Input } from '../ui/input';
import CollaboratorSearch from '../global/collaborator-search';
import { useToast } from '../ui/use-toast';

function colorFromId(id: string): string {
  let hash = 0;
  for (let index = 0; index < id.length; index += 1) {
    hash = id.charCodeAt(index) + ((hash << 5) - hash);
    hash |= 0;
  }
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 70%, 55%)`;
}

// type QuillCursorsModule = {
//   createCursor: (id: string, name: string, color: string) => void;
//   moveCursor: (id: string, range: any | null) => void;
//   removeCursor: (id: string) => void;
// };

export interface QuillEditorHandle {
  flushPending: () => Promise<void>;
}

interface QuillEditorProps {
  dirDetails: FileDto | FolderDto | WorkspaceDto;
  fileId: string;
  dirType: 'workspace' | 'folder' | 'file';
}
const TOOLBAR_OPTIONS = [
  ['bold', 'italic', 'underline', 'strike'], // toggled buttons
  ['blockquote', 'code-block'],

  [{ header: 1 }, { header: 2 }], // custom button values
  [{ list: 'ordered' }, { list: 'bullet' }],
  [{ script: 'sub' }, { script: 'super' }], // superscript/subscript
  [{ indent: '-1' }, { indent: '+1' }], // outdent/indent
  [{ direction: 'rtl' }], // text direction

  [{ size: ['small', false, 'large', 'huge'] }], // custom dropdown
  [{ header: [1, 2, 3, 4, 5, 6, false] }],

  [{ color: [] }, { background: [] }], // dropdown with defaults from theme
  [{ font: [] }],
  [{ align: [] }],

  ['clean'], // remove formatting button
];

const QuillEditor = React.forwardRef<QuillEditorHandle, QuillEditorProps>(
  ({ dirDetails, dirType, fileId }, ref) => {
  const { state, workspaceId, folderId, dispatch } = useAppState();
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const { user } = useAuth();
  const router = useRouter();
  // const { socket } = useSocket();
  const pathname = usePathname();
  const [quill, setQuill] = useState<Quill | null>(null);
  const [isEditorEmpty, setIsEditorEmpty] = useState(true);
  const [collaborators, setCollaborators] = useState<UserDto[]>([]);
  const collaboratorMapRef = useRef<Map<string, string>>(new Map());
  const [deletingBanner, setDeletingBanner] = useState(false);
  const [saving, setSaving] = useState(false);
  const [hasPending, setHasPending] = useState(false);
  // const [showPresencePanel, setShowPresencePanel] = useState(false);
  const pendingUpdateRef = useRef<Partial<WorkspaceDto & FolderDto & FileDto>>({});
  // const pendingContentRef = useRef(0);
  // const documentVersionRef = useRef(0);
  // const joinPayloadRef = useRef<{
  //   documentId: string;
  //   userId: string;
  //   displayName: string;
  //   color: string;
  // } | null>(null);
  // const presenceColorsRef = useRef<Map<string, string>>(new Map());
  // const cursorsRef = useRef<QuillCursorsModule | null>(null);
  const disposedRef = useRef(false);
  const { toast } = useToast();
  const [titleInput, setTitleInput] = useState(dirDetails.title ?? '');

  const syncPendingIndicators = useCallback(() => {
    const hasPendingChanges = Object.keys(pendingUpdateRef.current).length > 0;
    if (hasPendingChanges) {
      setHasPending(true);
      setSaving(true);
    } else {
      setHasPending(false);
      setSaving(false);
    }
  }, []);

  // const ensurePresenceColor = useCallback((id: string) => {
  //   if (!presenceColorsRef.current.has(id)) {
  //     presenceColorsRef.current.set(id, colorFromId(id));
  //   }
  //   return presenceColorsRef.current.get(id)!;
  // }, []);

  const applyLocalUpdate = useCallback(
    (update: Partial<WorkspaceDto & FolderDto & FileDto>) => {
      if (dirType === 'workspace') {
        dispatch({
          type: 'UPDATE_WORKSPACE',
          payload: {
            workspaceId: fileId,
            workspace: update as Partial<appWorkspacesType>,
          },
        });
        return;
      }
      if (dirType === 'folder') {
        if (!workspaceId) return;
        dispatch({
          type: 'UPDATE_FOLDER',
          payload: {
            workspaceId,
            folderId: fileId,
            folder: update as Partial<appFoldersType>,
          },
        });
        return;
      }
      if (!workspaceId || !folderId) return;
      dispatch({
        type: 'UPDATE_FILE',
        payload: {
          workspaceId,
          folderId,
          fileId,
          file: update as Partial<FileDto>,
        },
      });
    },
    [dirType, dispatch, fileId, folderId, workspaceId]
  );

  const details = useMemo(() => {
    let selectedDir;
    if (dirType === 'file') {
      selectedDir = state.workspaces
        .find((workspace) => workspace.id === workspaceId)
        ?.folders.find((folder) => folder.id === folderId)
        ?.files.find((file) => file.id === fileId);
    }
    if (dirType === 'folder') {
      selectedDir = state.workspaces
        .find((workspace) => workspace.id === workspaceId)
        ?.folders.find((folder) => folder.id === fileId);
    }
    if (dirType === 'workspace') {
      selectedDir = state.workspaces.find(
        (workspace) => workspace.id === fileId
      );
    }

    if (selectedDir) {
      return selectedDir;
    }

    return {
      id: dirDetails.id,
      title: dirDetails.title,
      iconId: dirDetails.iconId,
      createdAt: (dirDetails as { createdAt?: string | null }).createdAt,
      data: dirDetails.data,
      inTrash: dirDetails.inTrash,
      bannerUrl: dirDetails.bannerUrl,
      ...(dirType === 'workspace' && {
        logo: (dirDetails as WorkspaceDto).logo,
        workspaceOwner: (dirDetails as WorkspaceDto).workspaceOwner,
      }),
      ...(dirType === 'file' && {
        workspaceId: (dirDetails as FileDto).workspaceId,
        folderId: (dirDetails as FileDto).folderId,
      }),
    } as WorkspaceDto | FolderDto | FileDto;
  }, [state, workspaceId, folderId, dirDetails, dirType, fileId]);

  const breadCrumbs = useMemo(() => {
    if (!pathname || !state.workspaces || !workspaceId) return;
    const segments = pathname
      .split('/')
      .filter((val) => val !== 'dashboard' && val);
    const workspaceDetails = state.workspaces.find(
      (workspace) => workspace.id === workspaceId
    );
    const workspaceBreadCrumb = workspaceDetails
      ? `${workspaceDetails.iconId} ${workspaceDetails.title}`
      : '';
    if (segments.length === 1) {
      return workspaceBreadCrumb;
    }

    const folderSegment = segments[1];
    const folderDetails = workspaceDetails?.folders.find(
      (folder) => folder.id === folderSegment
    );
    const folderBreadCrumb = folderDetails
      ? `/ ${folderDetails.iconId} ${folderDetails.title}`
      : '';

    if (segments.length === 2) {
      return `${workspaceBreadCrumb} ${folderBreadCrumb}`;
    }

    const fileSegment = segments[2];
    const fileDetails = folderDetails?.files.find(
      (file) => file.id === fileSegment
    );
    const fileBreadCrumb = fileDetails
      ? `/ ${fileDetails.iconId} ${fileDetails.title}`
      : '';

    return `${workspaceBreadCrumb} ${folderBreadCrumb} ${fileBreadCrumb}`;
  }, [state, pathname, workspaceId]);

  useEffect(() => {
    setTitleInput(details.title ?? '');
  }, [details.title]);

  const flushPending = useCallback(async () => {
    if (!fileId) return;
    const payload = pendingUpdateRef.current;
    if (!payload || Object.keys(payload).length === 0) {
      if (!disposedRef.current) {
        setHasPending(false);
        setSaving(false);
      }
      return;
    }

    pendingUpdateRef.current = {};

    try {
      if (dirType === 'workspace') {
        await updateWorkspace(fileId, payload as Partial<WorkspaceDto>);
      } else if (dirType === 'folder') {
        await updateFolder(fileId, payload as Partial<FolderDto>);
      } else {
        await updateFile(fileId, payload as Partial<FileDto>);
      }
    } catch (error) {
      console.error('Failed to persist editor changes', error);
      pendingUpdateRef.current = { ...payload, ...pendingUpdateRef.current };
      toast({
        title: 'Unable to save changes',
        description: 'Please try again in a moment.',
        variant: 'destructive',
      });
    } finally {
      if (!disposedRef.current) {
        syncPendingIndicators();
      }
    }
  }, [dirType, fileId, toast]);

  const queueUpdate = useCallback(
    (update: Partial<WorkspaceDto & FolderDto & FileDto>) => {
      pendingUpdateRef.current = {
        ...pendingUpdateRef.current,
        ...update,
      };
      if (!disposedRef.current) {
        syncPendingIndicators();
      }
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
      }
      saveTimerRef.current = setTimeout(() => {
        flushPending().catch(() => undefined);
      }, 850);
    },
    [flushPending, syncPendingIndicators]
  );

  const handleManualSave = useCallback(async () => {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
    }
    setSaving(true);
    await flushPending();
  }, [flushPending]);

  const handleTitleChange = useCallback(
    (value: string) => {
      if (value === titleInput) return;
      setTitleInput(value);
      applyLocalUpdate({ title: value });
      queueUpdate({ title: value });
    },
    [applyLocalUpdate, queueUpdate, titleInput]
  );

  const handleAddCollaborator = useCallback(
    async (profile: UserDto) => {
      if (dirType !== 'workspace') return;
      const collaboratorKey = resolveWorkspaceOwnerId(profile) ?? profile.id;
      if (!collaboratorKey) return;
      if (collaboratorMapRef.current.has(collaboratorKey)) {
        toast({
          title: 'Collaborator already added',
          description: 'This user already has access to the workspace.',
        });
        return;
      }
      try {
        const created = await createCollaborator({
          workspaceId: fileId,
          userId: collaboratorKey,
        });
        collaboratorMapRef.current.set(collaboratorKey, created.id);
        setCollaborators((prev) => [...prev, profile]);
        toast({
          title: 'Collaborator added',
          description: profile.email
            ? `${profile.email} now has access.`
            : 'Collaborator added successfully.',
        });
      } catch (error) {
        console.error('Failed to add collaborator', error);
        toast({
          title: 'Unable to add collaborator',
          description: 'Please try again later.',
          variant: 'destructive',
        });
      }
    },
    [dirType, fileId, toast]
  );

  const handleRemoveCollaborator = useCallback(
    async (userId: string) => {
      if (dirType !== 'workspace') return;
      if (!userId) return;
      const collaboratorId = collaboratorMapRef.current.get(userId);
      if (!collaboratorId) return;
      try {
        await deleteCollaborator(collaboratorId);
        collaboratorMapRef.current.delete(userId);
        setCollaborators((prev) =>
          prev.filter((collaborator) => (resolveWorkspaceOwnerId(collaborator) ?? collaborator.id) !== userId)
        );
        toast({
          title: 'Collaborator removed',
          description: 'Access revoked successfully.',
        });
      } catch (error) {
        console.error('Failed to remove collaborator', error);
        toast({
          title: 'Unable to remove collaborator',
          description: 'Please try again later.',
          variant: 'destructive',
        });
      }
    },
    [dirType, toast]
  );

  useImperativeHandle(
    ref,
    () => ({
      flushPending: async () => {
        if (saveTimerRef.current) {
          clearTimeout(saveTimerRef.current);
        }
        await flushPending();
      },
    }),
    [flushPending]
  );

  useEffect(() => {
    if (!workspaceId) return;

    let active = true;

    const fetchCollaborators = async () => {
      try {
        const page = await listCollaborators({ workspaceId, size: 50 });
        const entries = page.content ?? [];
        collaboratorMapRef.current.clear();
        if (!entries.length) {
          if (active) setCollaborators([]);
          return;
        }
        const users = await Promise.all(
          entries.map(async (entry) => {
            try {
              const collaborator = await getUser(entry.userId);
              if (collaborator) {
                const collaboratorKey = resolveWorkspaceOwnerId(collaborator) ?? entry.userId;
                collaboratorMapRef.current.set(collaboratorKey, entry.id);
              }
              return collaborator;
            } catch (error) {
              console.error('Failed to fetch collaborator profile', error);
              return null;
            }
          })
        );

        if (active) {
          setCollaborators(users.filter(Boolean) as UserDto[]);
        }
      } catch (error) {
        console.error('Failed to load collaborators', error);
      }
    };

    fetchCollaborators();

    return () => {
      active = false;
    };
  }, [workspaceId]);

  useEffect(() => {
    return () => {
      disposedRef.current = true;
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
      }
    };
  }, []);

  //
  const wrapperRef = useCallback((wrapper: HTMLDivElement | null) => {
    if (typeof window !== 'undefined') {
      if (wrapper === null) return;
      wrapper.innerHTML = '';
      const editor = document.createElement('div');
      wrapper.append(editor);
      
      // Load Quill asynchronously
      Promise.all([
        import('quill')
      ]).then(([QuillModule]) => {
        const Quill = QuillModule.default;
        const q = new Quill(editor, {
          theme: 'snow',
          modules: {
            toolbar: TOOLBAR_OPTIONS,
          },
        });
        setQuill(q);
        setIsEditorEmpty(q.getLength() === 1);
      });
    }
  }, []);

  const restoreFileHandler = async () => {
    if (dirType === 'file') {
      if (!folderId || !workspaceId) return;
      dispatch({
        type: 'UPDATE_FILE',
        payload: { file: { inTrash: false }, fileId, folderId, workspaceId },
      });
      await updateFile(fileId, { inTrash: false });
    }
    if (dirType === 'folder') {
      if (!workspaceId) return;
      dispatch({
        type: 'UPDATE_FOLDER',
        payload: { folder: { inTrash: false }, folderId: fileId, workspaceId },
      });
      await updateFolder(fileId, { inTrash: false });
    }
  };

  const deleteFileHandler = async () => {
    if (dirType === 'file') {
      if (!folderId || !workspaceId) return;
      dispatch({
        type: 'DELETE_FILE',
        payload: { fileId, folderId, workspaceId },
      });
      await deleteFile(fileId);
      router.replace(`/dashboard/${workspaceId}`);
    }
    if (dirType === 'folder') {
      if (!workspaceId) return;
      dispatch({
        type: 'DELETE_FOLDER',
        payload: { folderId: fileId, workspaceId },
      });
      await deleteFolder(fileId);
      router.replace(`/dashboard/${workspaceId}`);
    }
  };

  const iconOnChange = (icon: string) => {
    if (!fileId) return;
    applyLocalUpdate({ iconId: icon });
    queueUpdate({ iconId: icon });
  };

  const deleteBannerAsset = async () => {
    if (!fileId) return;
    setDeletingBanner(true);
    try {
      if (dirType === 'file') {
        if (!folderId || !workspaceId) return;
        await removeBannerAsset('file', fileId);
      } else if (dirType === 'folder') {
        if (!workspaceId) return;
        await removeBannerAsset('folder', fileId);
      } else {
        await removeBannerAsset('workspace', fileId);
      }
      applyLocalUpdate({ bannerUrl: '' });
      queueUpdate({ bannerUrl: '' });
    } catch (error) {
      console.error('Failed to remove banner asset', error);
      toast({
        title: 'Unable to remove banner',
        description: 'Please try again later.',
        variant: 'destructive',
      });
    } finally {
      setDeletingBanner(false);
    }
  };

  useEffect(() => {
    if (!fileId) return;

    let active = true;

    const fetchInformation = async () => {
      try {
        if (dirType === 'file') {
          const selected = await getFile(fileId);
          if (!active) return;
          if (!selected) {
            throw new Error('File not found');
          }
          if (workspaceId && quill !== null && selected.data) {
            try {
              quill.setContents(JSON.parse(selected.data));
              setIsEditorEmpty(quill.getLength() === 1);
            } catch (error) {
              console.error('Failed to parse file contents', error);
            }
          }
          if (workspaceId) {
            dispatch({
              type: 'UPDATE_FILE',
              payload: {
                file: { data: selected.data },
                fileId,
                folderId: selected.folderId,
                workspaceId,
              },
            });
          }
        } else if (dirType === 'folder') {
          const selected = await getFolder(fileId);
          if (!active) return;
          if (!selected) {
            throw new Error('Folder not found');
          }
          if (quill !== null && selected.data) {
            try {
              quill.setContents(JSON.parse(selected.data));
              setIsEditorEmpty(quill.getLength() === 1);
            } catch (error) {
              console.error('Failed to parse folder contents', error);
            }
          }
          dispatch({
            type: 'UPDATE_FOLDER',
            payload: {
              folderId: fileId,
              folder: { data: selected.data },
              workspaceId: selected.workspaceId,
            },
          });
        } else {
          const selected = await getWorkspace(fileId);
          if (!active) return;
           if (!selected) {
            throw new Error('Workspace not found');
          }
          if (quill !== null && selected.data) {
            try {
              quill.setContents(JSON.parse(selected.data));
              setIsEditorEmpty(quill.getLength() === 1);
            } catch (error) {
              console.error('Failed to parse workspace contents', error);
            }
          }
          dispatch({
            type: 'UPDATE_WORKSPACE',
            payload: {
              workspace: { data: selected.data },
              workspaceId: fileId,
            },
          });
        }
      } catch (error) {
        console.error('Failed to load editor details', error);
        if (dirType === 'file' && workspaceId) {
          router.replace(`/dashboard/${workspaceId}`);
        } else {
          router.replace('/dashboard');
        }
      }
    };

    fetchInformation();

    return () => {
      active = false;
    };
  }, [fileId, workspaceId, quill, dirType, dispatch, router]);


  // Local text-change handler to save content (collaboration disabled)
  useEffect(() => {
    if (quill === null || !fileId) return;

    const quillHandler = (_delta: any, _oldDelta: any, source: string) => {
      if (source !== 'user') return;
      const contents = quill.getContents();
      const serializedContents =
        contents && quill.getLength() !== 1 ? JSON.stringify(contents) : null;

      applyLocalUpdate({ data: serializedContents });
      queueUpdate({ data: serializedContents as any });
      setIsEditorEmpty(quill.getLength() === 1);
    };

    quill.on('text-change', quillHandler);
    return () => {
      quill.off('text-change', quillHandler);
    };
  }, [quill, fileId, applyLocalUpdate, queueUpdate]);

  return (
    <>
      <div className="relative">
        {details.inTrash && (
          <article
            className="py-2 
          z-40 
          bg-[#EB5757] 
          flex  
          md:flex-row 
          flex-col 
          justify-center 
          items-center 
          gap-4 
          flex-wrap"
          >
            <div
              className="flex 
            flex-col 
            md:flex-row 
            gap-2 
            justify-center 
            items-center"
            >
              <span className="text-white">
                This {dirType} is in the trash.
              </span>
              <Button
                size="sm"
                variant="outline"
                className="bg-transparent
                border-white
                text-white
                hover:bg-white
                hover:text-[#EB5757]
                "
                onClick={restoreFileHandler}
              >
                Restore
              </Button>

              <Button
                size="sm"
                variant="outline"
                className="bg-transparent
                border-white
                text-white
                hover:bg-white
                hover:text-[#EB5757]
                "
                onClick={deleteFileHandler}
              >
                Delete
              </Button>
            </div>
            <span className="text-sm text-white">{details.inTrash}</span>
          </article>
        )}
        <div className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col gap-1 text-sm text-muted-foreground">
            <span>{breadCrumbs}</span>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-3">
            <div className="flex items-center justify-center h-10">
              {collaborators.map((member) => (
                <div
                  key={member.id}
                  className="relative"
                >
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Avatar className="-ml-3 h-8 w-8 border-2 border-background/80 bg-background shadow-sm first:ml-0">
                          <AvatarImage
                            src={member.avatarUrl ?? undefined}
                            className="rounded-full"
                          />
                          <AvatarFallback>
                            {(member.email ?? member.fullName ?? '??')
                              .substring(0, 2)
                              .toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                      </TooltipTrigger>
                      <TooltipContent className="flex items-center gap-2">
                        <span>{member.email ?? member.fullName ?? 'Collaborator'}</span>
                        {dirType === 'workspace' && member.id && member.id !== user?.id && (
                          <Button
                            type="button"
                            variant="link"
                            size="sm"
                            className="h-auto p-0 text-destructive"
                            onClick={() =>
                              handleRemoveCollaborator(resolveWorkspaceOwnerId(member) ?? member.id ?? '')
                            }
                          >
                            Remove
                          </Button>
                        )}
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                  {dirType === 'workspace' && member.id && member.id !== user?.id && (
                    <button
                      type="button"
                      onClick={() =>
                        handleRemoveCollaborator(resolveWorkspaceOwnerId(member) ?? member.id ?? '')
                      }
                      className="absolute -top-1 -right-1 rounded-full bg-background/90 p-[2px] text-muted-foreground shadow-sm ring-1 ring-border transition hover:text-destructive"
                      aria-label={`Remove ${member.email ?? 'collaborator'}`}
                    >
                      <XCircleIcon className="h-3 w-3" />
                    </button>
                  )}
                </div>
              ))}
            </div>
            {dirType === 'workspace' && (
              <CollaboratorSearch
                existingCollaborators={collaborators}
                getCollaborator={handleAddCollaborator}
              >
                <Button
                  size="sm"
                  type="button"
                  variant="outline"
                  className="gap-2"
                >
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
              className="flex items-center gap-2"
            >
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Saving
                </>
              ) : (
                'Save'
              )}
            </Button>
            <Badge
              variant={saving ? 'secondary' : 'outline'}
              className={
                saving
                  ? 'bg-orange-500 text-white shadow-none'
                  : hasPending
                    ? 'text-foreground'
                    : 'border-emerald-500 text-emerald-600'
              }
            >
              {saving ? 'Saving…' : hasPending ? 'Pending changes' : 'Saved'}
            </Badge>
          </div>
        </div>
      </div>
      {details.bannerUrl && (
        <div className="relative w-full h-[200px]">
          <Image
            src={details.bannerUrl}
            fill
            className="w-full md:h-48
            h-20
            object-cover"
            alt="Banner Image"
          />
        </div>
      )}
      <div
        className="flex 
        justify-center
        items-center
        flex-col
        mt-2
        relative
      "
      >
        <div
          className="w-full 
        self-center 
        max-w-[800px] 
        flex 
        flex-col
         px-7 
         lg:my-8"
        >
          <div className="text-[80px]">
            <EmojiPicker getValue={iconOnChange}>
              <div
                className="w-[100px]
                cursor-pointer
                transition-colors
                h-[100px]
                flex
                items-center
                justify-center
                hover:bg-muted
                rounded-xl"
              >
                {details.iconId}
              </div>
            </EmojiPicker>
          </div>
          <div className="flex ">
            <BannerUpload
              id={fileId}
              dirType={dirType}
              className="mt-2
              text-sm
              text-muted-foreground
              p-2
              hover:text-card-foreground
              transition-all
              rounded-md"
            >
              {details.bannerUrl ? 'Update Banner' : 'Add Banner'}
            </BannerUpload>
            {details.bannerUrl && (
              <Button
                disabled={deletingBanner}
                onClick={deleteBannerAsset}
                variant="ghost"
                className="gap-2 hover:bg-background
                flex
                item-center
                justify-center
                mt-2
                text-sm
                text-muted-foreground
                w-36
                p-2
                rounded-md"
              >
                <XCircleIcon size={16} />
                <span className="whitespace-nowrap font-normal">
                  Remove Banner
                </span>
              </Button>
            )}
          </div>
          <Input
            value={titleInput}
            onChange={(event) => handleTitleChange(event.target.value)}
            aria-label={`${dirType} title`}
            className="mt-6 w-full max-w-xl border-none bg-transparent px-0 text-3xl font-semibold text-foreground shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
            placeholder="Untitled"
          />
          <span className="text-muted-foreground text-sm">
            {dirType.toUpperCase()}
          </span>
        </div>
        <div
          id="container"
          className="max-w-[800px] relative w-full"
          ref={wrapperRef}
        >
          {isEditorEmpty && (
            <div className="pointer-events-none absolute left-0 top-0 w-full select-none text-muted-foreground/80">
              <div className="px-4 py-3 text-sm">
                Write, press 'space' for AI, '/' for commands...
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Collaboration UI temporarily disabled */}
    </>
  );
  }
);

QuillEditor.displayName = 'QuillEditor';

export default QuillEditor;
