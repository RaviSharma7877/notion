'use client';
import { useAppState } from '@/lib/providers/state-provider';
import type { WorkspaceDto } from '@/lib/queries';
import React, { useMemo, useState } from 'react';
import SelectedWorkspace from './selected-workspace';
import CustomDialogTrigger from '../global/custom-dialog-trigger';
import WorkspaceCreator from '../global/workspace-creator';

interface WorkspaceDropdownProps {
  privateWorkspaces: WorkspaceDto[];
  sharedWorkspaces: WorkspaceDto[];
  collaboratingWorkspaces: WorkspaceDto[];
  defaultValue: WorkspaceDto | undefined;
  loading?: boolean;
}

const WorkspaceDropdown: React.FC<WorkspaceDropdownProps> = ({
  privateWorkspaces,
  collaboratingWorkspaces,
  sharedWorkspaces,
  defaultValue,
  loading = false,
}) => {
  const { state } = useAppState();
  const [isOpen, setIsOpen] = useState(false);

  const selectedOption = useMemo(() => {
    if (!defaultValue) return undefined;
    const match = state.workspaces.find((workspace) => workspace.id === defaultValue.id);
    return match ?? defaultValue;
  }, [state, defaultValue]);

  const handleSelect = (option: WorkspaceDto) => {
    void option;
    setIsOpen(false);
  };

  return (
    <div className="relative inline-block text-left w-full">
      <div>
        <span
          className={loading ? 'cursor-not-allowed opacity-70' : ''}
          onClick={() => {
            if (loading) return;
            setIsOpen(!isOpen);
          }}
        >
          {selectedOption ? (
            <SelectedWorkspace workspace={selectedOption} />
          ) : (
            'Select a workspace'
          )}
        </span>
      </div>
      {isOpen && (
        <div className="origin-top-right absolute mt-2 w-full rounded-md shadow-md z-50 max-h-64 bg-popover backdrop-blur supports-[backdrop-filter]:bg-popover/70 group overflow-auto border border-border">
          <div className="rounded-md flex flex-col">
            <div className="p-2 space-y-2">
              {!!privateWorkspaces.length && (
                <>
                  <p className="text-xs font-medium text-muted-foreground px-1">Private</p>
                  {privateWorkspaces.map((option) => (
                    <SelectedWorkspace
                      key={option.id}
                      workspace={option}
                      onClick={handleSelect}
                    />
                  ))}
                </>
              )}
              {!!sharedWorkspaces.length && (
                <>
                  <p className="text-xs font-medium text-muted-foreground px-1">Shared</p>
                  {sharedWorkspaces.map((option) => (
                    <SelectedWorkspace
                      key={option.id}
                      workspace={option}
                      onClick={handleSelect}
                    />
                  ))}
                </>
              )}
              {!!collaboratingWorkspaces.length && (
                <>
                  <p className="text-xs font-medium text-muted-foreground px-1">Collaborating</p>
                  {collaboratingWorkspaces.map((option) => (
                    <SelectedWorkspace
                      key={option.id}
                      workspace={option}
                      onClick={handleSelect}
                    />
                  ))}
                </>
              )}
            </div>
            <CustomDialogTrigger
              header="Create A Workspace"
              content={<WorkspaceCreator />}
              description="Workspaces give you the power to collaborate with others. You can change your workspace privacy settings after creating the workspace too."
            >
              <button type="button" className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-sm hover:bg-muted">
                <span className="inline-flex h-5 w-5 items-center justify-center rounded-full border text-xs">+</span>
                <span>Create workspace</span>
              </button>
            </CustomDialogTrigger>
          </div>
        </div>
      )}
    </div>
  );
};

export default WorkspaceDropdown;
