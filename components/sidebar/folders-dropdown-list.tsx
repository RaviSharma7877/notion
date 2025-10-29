'use client';

import React, { useEffect, useMemo } from 'react';
import { PlusIcon } from 'lucide-react';

import {
  type FolderCreateInput,
  type FolderDto,
  type SubscriptionDto,
  createFolder,
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

interface FoldersDropdownListProps {
  workspaceFolders: FolderDto[];
  workspaceId?: string;
  subscription: SubscriptionDto | null;
}

const FoldersDropdownList: React.FC<FoldersDropdownListProps> = ({
  workspaceFolders,
  workspaceId,
  subscription,
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
        {folders
          .filter((folder) => !folder.inTrash)
          .map((folder) => (
            <Dropdown
              key={folder.id}
              title={folder.title}
              listType="folder"
              id={folder.id}
              iconId={folder.iconId}
              // workspaceId={workspaceId}
            />
          ))}
      </Accordion>
    </>
  );
};

export default FoldersDropdownList;
