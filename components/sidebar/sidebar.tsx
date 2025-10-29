'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { twMerge } from 'tailwind-merge';

import {
  getWorkspace,
  listCollaborators,
  listFolders,
  listWorkspaces,
  type FolderDto,
  type SubscriptionDto,
  type WorkspaceDto,
} from '@/lib/queries';
import { useAuth } from '@/lib/providers/auth-provider';
import { useAppState } from '@/lib/providers/state-provider';

import WorkspaceDropdown from './workspace-dropdown';
import PlanUsage from './plan-usage';
import NativeNavigation from './native-navigation';
import { ScrollArea } from '../ui/scroll-area';
import FoldersDropdownList from './folders-dropdown-list';
import UserCard from './user-card';

interface SidebarProps {
  workspaceId?: string;
  className?: string;
}

const Sidebar: React.FC<SidebarProps> = ({ workspaceId: workspaceIdFromProps, className }) => {
  const router = useRouter();
  const params = useParams<{ workspaceId?: string }>();
  const { user, subscription, initializing } = useAuth();
  const { dispatch, state } = useAppState();
  const stateRef = useRef(state);
  const [loading, setLoading] = useState(true);
  const [privateWorkspaces, setPrivateWorkspaces] = useState<WorkspaceDto[]>([]);
  const [sharedWorkspaces, setSharedWorkspaces] = useState<WorkspaceDto[]>([]);
  const [collaboratingWorkspaces, setCollaboratingWorkspaces] = useState<WorkspaceDto[]>([]);
  const [workspaceFolders, setWorkspaceFolders] = useState<FolderDto[]>([]);

  const workspaceId = workspaceIdFromProps ?? params?.workspaceId;


  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    let active = true;

    const loadResources = async () => {
      if (!user) {
        if (!initializing) {
          router.replace('/login');
        }
        return;
      }

      setLoading(true);

      try {
        const ownedPage = await listWorkspaces({ owner: user.id, size: 100 });
        const owned = ownedPage.content ?? [];

        const collaboratorIndicators = await Promise.all(
          owned.map(async (workspace) => {
            try {
              const page = await listCollaborators({ workspaceId: workspace.id, size: 1 });
              const hasCollaborators = (page.content?.length ?? 0) > 0;
              return { workspace, hasCollaborators };
            } catch (error) {
              console.error('Failed to evaluate collaborators', error);
              return { workspace, hasCollaborators: false };
            }
          })
        );

        const privates = collaboratorIndicators
          .filter((entry) => !entry.hasCollaborators)
          .map((entry) => entry.workspace);
        const shared = collaboratorIndicators
          .filter((entry) => entry.hasCollaborators)
          .map((entry) => entry.workspace);

        const collaboratorPage = await listCollaborators({ userId: user.id, size: 100 });
        const collaboratorWorkspaceIds = new Set(
          (collaboratorPage.content ?? []).map((collaborator) => collaborator.workspaceId)
        );

        const collaboratorWorkspaces = await Promise.all(
          Array.from(collaboratorWorkspaceIds)
            .filter((id): id is string => typeof id === 'string')
            .filter((id) => !owned.some((workspace) => workspace.id === id))
            .map(async (id) => {
              try {
                return await getWorkspace(id);
              } catch (error) {
                console.error('Failed to fetch collaborating workspace', error);
                return null;
              }
            })
        );

        const collaborating = collaboratorWorkspaces.filter(Boolean) as WorkspaceDto[];

        if (!active) return;

        setPrivateWorkspaces(privates);
        setSharedWorkspaces(shared);
        setCollaboratingWorkspaces(collaborating);

        const allWorkspaces = [...privates, ...shared, ...collaborating];
        const existingWorkspaces = stateRef.current.workspaces ?? [];
        const hasSameIds =
          existingWorkspaces.length === allWorkspaces.length &&
          allWorkspaces.every((workspace) =>
            existingWorkspaces.some((item) => item.id === workspace.id)
          );

        if (!hasSameIds) {
          dispatch({
            type: 'SET_WORKSPACES',
            payload: {
              workspaces: allWorkspaces.map((workspace) => ({
                ...workspace,
                folders:
                  stateRef.current.workspaces
                    ?.find((item) => item.id === workspace.id)
                    ?.folders ?? [],
              })),
            },
          });
        }

        if (workspaceId) {
          try {
            const folderPage = await listFolders({ workspaceId, size: 100 });
            const folders = folderPage.content ?? [];
            if (!active) return;
            setWorkspaceFolders(folders);
            dispatch({
              type: 'SET_FOLDERS',
              payload: {
                workspaceId,
                folders: folders.map((folder) => ({
                  ...folder,
                  files:
                    stateRef.current.workspaces
                      .find((workspace) => workspace.id === workspaceId)
                      ?.folders.find((item) => item.id === folder.id)?.files ?? [],
                })),
              },
            });
          } catch (error) {
            console.error('Failed to load workspace folders', error);
          }
        }
      } catch (error) {
        console.error('Failed to load sidebar resources', error);
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    loadResources();

    return () => {
      active = false;
    };
  }, [user, initializing, router, workspaceId, dispatch]);

  const subscriptionForPlanUsage = useMemo<SubscriptionDto | null>(
    () => subscription ?? null,
    [subscription]
  );

  if (!user) {
    return null;
  }

  return (
    <aside
      className={twMerge(
        'hidden sm:flex sm:flex-col w-[280px] shrink-0 p-4 md:gap-4 !justify-between',
        className
      )}
    >
      <div>
        <WorkspaceDropdown
          privateWorkspaces={privateWorkspaces}
          sharedWorkspaces={sharedWorkspaces}
          collaboratingWorkspaces={collaboratingWorkspaces}
          defaultValue={[...privateWorkspaces, ...sharedWorkspaces, ...collaboratingWorkspaces].find(
            (workspace) => workspace.id === workspaceId
          )}
          loading={loading}
        />
        <PlanUsage
          foldersLength={workspaceFolders.length}
          subscription={subscriptionForPlanUsage}
        />
        <NativeNavigation myWorkspaceId={workspaceId} />
        <ScrollArea
          className="overflow-scroll relative
          h-[450px]
        "
        >
          <div
            className="pointer-events-none 
          w-full 
          absolute 
          bottom-0 
          h-20 
          bg-gradient-to-t 
          from-background 
          to-transparent 
          z-40"
          />
          <FoldersDropdownList
            workspaceId={workspaceId}
            workspaceFolders={workspaceFolders}
            subscription={subscriptionForPlanUsage}
          />
        </ScrollArea>
      </div>
      <UserCard subscription={subscriptionForPlanUsage} />
    </aside>
  );
};

export default Sidebar;
