'use client';
import type { WorkspaceDto } from '@/lib/queries';
import Image from 'next/image';
import Link from 'next/link';
import React, { useEffect, useMemo, useState } from 'react';
import EmojiPicker from '@/components/global/emoji-picker';
import { updateWorkspace } from '@/lib/queries';
import { useAppState } from '@/lib/providers/state-provider';

interface SelectedWorkspaceProps {
  workspace: WorkspaceDto;
  onClick?: (option: WorkspaceDto) => void;
}

const SelectedWorkspace: React.FC<SelectedWorkspaceProps> = ({
  workspace,
  onClick,
}) => {
  const { state, dispatch } = useAppState();
  const resolved = state.workspaces.find((w) => w.id === workspace.id) ?? workspace;
  const [displayIcon, setDisplayIcon] = useState<string>(resolved.iconId ?? '💼');
  useEffect(() => {
    setDisplayIcon(resolved.iconId ?? '💼');
  }, [resolved.iconId]);
  const workspaceLogo = useMemo(() => {
    if (workspace.logo && workspace.logo.length > 0) {
      return workspace.logo;
    }
    return '/cypresslogo.svg';
  }, [workspace.logo]);

  return (
    <Link
      href={`/dashboard/${resolved.id}`}
      onClick={() => {
        if (onClick) onClick(resolved);
      }}
      className="flex 
      rounded-md 
      hover:bg-muted 
      transition-all 
      flex-row 
      p-2 
      gap-4 
      justify-center 
      cursor-pointer 
      items-center 
      my-2"
    >
      <EmojiPicker
        getValue={async (emoji) => {
          // local + store first
          setDisplayIcon(emoji);
          dispatch({ type: 'UPDATE_WORKSPACE', payload: { workspaceId: workspace.id, workspace: { iconId: emoji } } });
          try {
            await updateWorkspace(resolved.id, { iconId: emoji, title: resolved.title });
          } catch {
            // no-op
          }
        }}
      >
        <span className="text-xl">
          {displayIcon}
        </span>
      </EmojiPicker>
      <div className="flex flex-col">
        <p
          className="text-lg 
        w-[170px] 
        overflow-hidden 
        overflow-ellipsis 
        whitespace-nowrap"
        >
          {workspace.title}
        </p>
      </div>
    </Link>
  );
};

export default SelectedWorkspace;
