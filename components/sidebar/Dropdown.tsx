'use client';

import React, { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import clsx from 'clsx';
import { PlusIcon, Trash } from 'lucide-react';

import {
  createFile,
  type FileCreateInput,
  type FileDto,
  updateFile,
  updateFolder,
} from '@/lib/queries';
import { useAuth } from '@/lib/providers/auth-provider';
import { useAppState } from '@/lib/providers/state-provider';

import EmojiPicker from '../global/emoji-picker';
import TooltipComponent from '../global/tooltip-component';
import { AccordionContent, AccordionItem, AccordionTrigger } from '../ui/accordion';
import { useToast } from '../ui/use-toast';

interface DropdownProps {
  title: string;
  id: string;
  listType: 'folder' | 'file';
  iconId: string;
  children?: React.ReactNode;
  disabled?: boolean;
}

const Dropdown: React.FC<DropdownProps> = ({
  title,
  id,
  listType,
  iconId,
}) => {
  const router = useRouter();
  const { toast } = useToast();
  const { user } = useAuth();
  const { state, dispatch, workspaceId, folderId } = useAppState();
  const [isEditing, setIsEditing] = useState(false);

  const folderTitle: string | undefined = useMemo(() => {
    if (listType !== 'folder') return undefined;
    const stateTitle = state.workspaces
      .find((workspace) => workspace.id === workspaceId)
      ?.folders.find((folder) => folder.id === id)?.title;
    if (!stateTitle || stateTitle === title) return title;
    return stateTitle;
  }, [state, listType, workspaceId, id, title]);

  const fileTitle: string | undefined = useMemo(() => {
    if (listType !== 'file') return undefined;
    const [derivedFolderId, fileId] = id.split('folder');
    const stateTitle = state.workspaces
      .find((workspace) => workspace.id === workspaceId)
      ?.folders.find((folder) => folder.id === derivedFolderId)
      ?.files.find((file) => file.id === fileId)?.title;
    if (!stateTitle || stateTitle === title) return title;
    return stateTitle;
  }, [state, listType, workspaceId, id, title]);

  const navigateTo = (targetId: string, type: 'folder' | 'file') => {
    if (!workspaceId) return;
    if (type === 'folder') {
      router.push(`/dashboard/${workspaceId}/${targetId}`);
      return;
    }
    if (!folderId) return;
    const [, fileId] = targetId.split('folder');
    if (!fileId) return;
    router.push(`/dashboard/${workspaceId}/${folderId}/${fileId}`);
  };

  const handleDoubleClick = () => {
    setIsEditing(true);
  };

  const handleBlur = async () => {
    if (!isEditing) {
      return;
    }
    setIsEditing(false);
    const segments = id.split('folder');

    if (segments.length === 1) {
      if (!folderTitle || !workspaceId) {
        return;
      }
      dispatch({
        type: 'UPDATE_FOLDER',
        payload: {
          workspaceId,
          folderId: id,
          folder: { title: folderTitle },
        },
      });
      try {
        await updateFolder(id, { title: folderTitle });
        toast({
          title: 'Success',
          description: 'Folder title changed.',
        });
      } catch (error) {
        console.error('Failed to update folder title', error);
        toast({
          title: 'Error',
          variant: 'destructive',
          description: 'Could not update the title for this folder',
        });
      }
    }

    if (segments.length === 2) {
      const fileId = segments[1];
      if (!fileId || !fileTitle || !workspaceId || !folderId) {
        return;
      }
      dispatch({
        type: 'UPDATE_FILE',
        payload: {
          workspaceId,
          folderId,
          fileId,
          file: { title: fileTitle },
        },
      });
      try {
        await updateFile(fileId, { title: fileTitle });
        toast({
          title: 'Success',
          description: 'File title changed.',
        });
      } catch (error) {
        console.error('Failed to update file title', error);
        toast({
          title: 'Error',
          variant: 'destructive',
          description: 'Could not update the title for this file',
        });
      }
    }
  };

  const onChangeEmoji = async (selectedEmoji: string) => {
    if (!workspaceId || listType !== 'folder') {
      return;
    }

    dispatch({
      type: 'UPDATE_FOLDER',
      payload: {
        workspaceId,
        folderId: id,
        folder: { iconId: selectedEmoji },
      },
    });

    try {
      await updateFolder(id, { iconId: selectedEmoji });
      toast({
        title: 'Success',
        description: 'Updated emoji for the folder',
      });
    } catch (error) {
      console.error('Failed to update folder emoji', error);
      toast({
        title: 'Error',
        variant: 'destructive',
        description: 'Could not update the emoji for this folder',
      });
    }
  };

  const folderTitleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!workspaceId || listType !== 'folder') return;
    dispatch({
      type: 'UPDATE_FOLDER',
      payload: {
        workspaceId,
        folderId: id,
        folder: { title: event.target.value },
      },
    });
  };

  const fileTitleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!workspaceId || !folderId || listType !== 'file') return;
    const [, fileId] = id.split('folder');
    if (!fileId) return;
    dispatch({
      type: 'UPDATE_FILE',
      payload: {
        workspaceId,
        folderId,
        fileId,
        file: { title: event.target.value },
      },
    });
  };

  const moveToTrash = async () => {
    if (!workspaceId || !user?.email) {
      return;
    }
    const segments = id.split('folder');
    const reason = `Deleted by ${user.email}`;

    if (listType === 'folder' && segments.length === 1) {
      dispatch({
        type: 'UPDATE_FOLDER',
        payload: {
          workspaceId,
          folderId: id,
          folder: { inTrash: reason },
        },
      });
      try {
        await updateFolder(id, { inTrash: reason });
        toast({
          title: 'Success',
          description: 'Moved folder to trash.',
        });
      } catch (error) {
        console.error('Failed to move folder to trash', error);
        toast({
          title: 'Error',
          variant: 'destructive',
          description: 'Could not move the folder to trash',
        });
      }
    }

    if (listType === 'file' && segments.length === 2) {
      const fileFolderId = segments[0];
      const fileId = segments[1];
      dispatch({
        type: 'UPDATE_FILE',
        payload: {
          workspaceId,
          folderId: fileFolderId,
          fileId,
          file: { inTrash: reason },
        },
      });
      try {
        await updateFile(fileId, { inTrash: reason });
        toast({
          title: 'Success',
          description: 'Moved file to trash.',
        });
      } catch (error) {
        console.error('Failed to move file to trash', error);
        toast({
          title: 'Error',
          variant: 'destructive',
          description: 'Could not move the file to trash',
        });
      }
    }
  };

  const addNewFile = async () => {
    if (listType !== 'folder' || !workspaceId) {
      return;
    }
    const payload: FileCreateInput = {
      title: 'Untitled',
      iconId: '📄',
      data: null,
      inTrash: false,
      bannerUrl: null,
      workspaceId,
      folderId: id,
    };

    try {
      const createdFile: FileDto = await createFile(payload);
      dispatch({
        type: 'ADD_FILE',
        payload: {
          workspaceId,
          folderId: id,
          file: { ...createdFile, createdAt: createdFile.createdAt ?? new Date().toISOString() },
        },
      });
      toast({
        title: 'Success',
        description: 'File created.',
      });
    } catch (error) {
      console.error('Failed to create file', error);
      toast({
        title: 'Error',
        variant: 'destructive',
        description: 'Could not create a file',
      });
    }
  };

  const isFolder = listType === 'folder';

  const groupIdentifies = clsx(
    'dark:text-white whitespace-nowrap flex justify-between items-center w-full relative',
    {
      'group/folder': isFolder,
      'group/file': !isFolder,
    }
  );

  const listStyles = useMemo(
    () =>
      clsx('relative', {
        'border-none text-md': isFolder,
        'border-none ml-6 text-[16px] py-1': !isFolder,
      }),
    [isFolder]
  );

  const hoverStyles = useMemo(
    () =>
      clsx(
        'h-full hidden rounded-sm absolute right-0 items-center justify-center',
        {
          'group-hover/file:block': listType === 'file',
          'group-hover/folder:block': listType === 'folder',
        }
      ),
    [listType]
  );

  return (
    <AccordionItem
      value={id}
      className={listStyles}
      onClick={(event) => {
        event.stopPropagation();
        navigateTo(id, listType);
      }}
    >
      <AccordionTrigger
        id={listType}
        className="hover:no-underline 
        p-2 
        dark:text-muted-foreground 
        text-sm"
        disabled={listType === 'file'}
      >
        <div className={groupIdentifies}>
          <div
            className="flex 
          gap-4 
          items-center 
          justify-center 
          overflow-hidden"
          >
            <div className="relative">
              <EmojiPicker getValue={onChangeEmoji}>{iconId}</EmojiPicker>
            </div>
            <input
              type="text"
              value={listType === 'folder' ? folderTitle : fileTitle}
              className={clsx(
                'outline-none overflow-hidden w-[140px] text-Neutrals/neutrals-7',
                {
                  'bg-muted cursor-text': isEditing,
                  'bg-transparent cursor-pointer': !isEditing,
                }
              )}
              readOnly={!isEditing}
              onDoubleClick={handleDoubleClick}
              onBlur={handleBlur}
              onChange={listType === 'folder' ? folderTitleChange : fileTitleChange}
            />
          </div>
          <div className={hoverStyles}>
            <TooltipComponent message="Delete">
              <Trash
                onClick={(event) => {
                  event.stopPropagation();
                  moveToTrash();
                }}
                size={15}
                className="hover:dark:text-white dark:text-Neutrals/neutrals-7 transition-colors"
              />
            </TooltipComponent>
            {listType === 'folder' && !isEditing && (
              <TooltipComponent message="Add File">
                <PlusIcon
                  onClick={(event) => {
                    event.stopPropagation();
                    addNewFile();
                  }}
                  size={15}
                  className="hover:dark:text-white dark:text-Neutrals/neutrals-7 transition-colors"
                />
              </TooltipComponent>
            )}
          </div>
        </div>
      </AccordionTrigger>
      <AccordionContent>
        {state.workspaces
          .find((workspace) => workspace.id === workspaceId)
          ?.folders.find((folder) => folder.id === id)
          ?.files.filter((file) => !file.inTrash)
          .map((file) => {
            const customFileId = `${id}folder${file.id}`;
            return (
              <Dropdown
                key={file.id}
                title={file.title}
                listType="file"
                id={customFileId}
                iconId={file.iconId}
              />
            );
          })}
      </AccordionContent>
    </AccordionItem>
  );
};

export default Dropdown;
