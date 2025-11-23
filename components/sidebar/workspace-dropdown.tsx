'use client';
import { useAppState } from '@/lib/providers/state-provider';
import type { WorkspaceDto } from '@/lib/queries';
import { updateWorkspace } from '@/lib/queries';
import React, { useEffect, useMemo, useState } from 'react';
import SelectedWorkspace from './selected-workspace';
import CustomDialogTrigger from '../global/custom-dialog-trigger';
import WorkspaceCreator from '../global/workspace-creator';
import TooltipComponent from '../global/tooltip-component';
import { twMerge } from 'tailwind-merge';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Separator } from '../ui/separator';
import { Pencil, Trash2, Check, X } from 'lucide-react';
import { useToast } from '../ui/use-toast';

interface WorkspaceDropdownProps {
  privateWorkspaces: WorkspaceDto[];
  sharedWorkspaces: WorkspaceDto[];
  collaboratingWorkspaces: WorkspaceDto[];
  defaultValue: WorkspaceDto | undefined;
  loading?: boolean;
  collapsed?: boolean;
}

const WorkspaceDropdown: React.FC<WorkspaceDropdownProps> = ({
  privateWorkspaces,
  collaboratingWorkspaces,
  sharedWorkspaces,
  defaultValue,
  loading = false,
  collapsed = false,
}) => {
  const { state, dispatch } = useAppState();
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [renamingWorkspace, setRenamingWorkspace] = useState(false);
  const [workspaceDraftTitle, setWorkspaceDraftTitle] = useState('');
  const [pendingWorkspaceAction, setPendingWorkspaceAction] = useState(false);

  const selectedOption = useMemo(() => {
    if (!defaultValue) return undefined;
    const match = state.workspaces.find((workspace) => workspace.id === defaultValue.id);
    return match ?? defaultValue;
  }, [state, defaultValue]);

  useEffect(() => {
    setWorkspaceDraftTitle(selectedOption?.title ?? 'Untitled workspace');
  }, [selectedOption?.title]);

  useEffect(() => {
    if (!isOpen) {
      setRenamingWorkspace(false);
      setPendingWorkspaceAction(false);
      setWorkspaceDraftTitle(selectedOption?.title ?? 'Untitled workspace');
    }
  }, [isOpen, selectedOption?.title]);

  const handleSelect = (option: WorkspaceDto) => {
    void option;
    setIsOpen(false);
  };
  const activeIcon = selectedOption?.iconId ?? '💼';
  const activeTitle = selectedOption?.title ?? 'Select a workspace';

  const handleWorkspaceRename = async () => {
    if (!selectedOption) return;
    const nextTitle = workspaceDraftTitle.trim() || 'Untitled workspace';
    if (nextTitle === (selectedOption.title ?? '')) {
      setRenamingWorkspace(false);
      return;
    }
    try {
      setPendingWorkspaceAction(true);
      dispatch({
        type: 'UPDATE_WORKSPACE',
        payload: { workspaceId: selectedOption.id, workspace: { title: nextTitle } },
      });
      await updateWorkspace(selectedOption.id, {
        title: nextTitle,
        iconId: selectedOption.iconId ?? '💼',
      });
      toast({ title: 'Workspace renamed' });
      setRenamingWorkspace(false);
    } catch (error) {
      console.error('Failed to rename workspace', error);
      toast({ title: 'Unable to rename workspace', description: 'Please try again shortly.', variant: 'destructive' });
      setWorkspaceDraftTitle(selectedOption.title ?? 'Untitled workspace');
    } finally {
      setPendingWorkspaceAction(false);
    }
  };

  const handleWorkspaceTrash = async () => {
    if (!selectedOption) return;
    try {
      setPendingWorkspaceAction(true);
      dispatch({
        type: 'UPDATE_WORKSPACE',
        payload: { workspaceId: selectedOption.id, workspace: { inTrash: true } },
      });
      await updateWorkspace(selectedOption.id, { inTrash: true });
      toast({ title: 'Workspace moved to trash', description: 'You can restore it from the trash view.' });
      setIsOpen(false);
    } catch (error) {
      console.error('Failed to trash workspace', error);
      toast({ title: 'Unable to move workspace', description: 'Please try again.', variant: 'destructive' });
    } finally {
      setPendingWorkspaceAction(false);
    }
  };

  const triggerContent = collapsed ? (
    <TooltipComponent message={activeTitle}>
      <button
        type="button"
        className={twMerge(
          'flex h-10 w-10 items-center justify-center rounded-xl border border-border/50 bg-background/80 text-2xl transition-all hover:scale-105 hover:border-border hover:bg-background',
          loading && 'cursor-not-allowed opacity-60'
        )}
        onClick={() => {
          if (loading) return;
          setIsOpen((prev) => !prev);
        }}
      >
        {activeIcon}
      </button>
    </TooltipComponent>
  ) : (
    <span
      className={loading ? 'cursor-not-allowed opacity-70 block w-full' : 'block w-full'}
      onClick={() => {
        if (loading) return;
        setIsOpen(!isOpen);
      }}
    >
      {selectedOption ? <SelectedWorkspace workspace={selectedOption} /> : 'Select a workspace'}
    </span>
  );

  return (
    <div className={twMerge('relative inline-block text-left', collapsed ? 'w-auto' : 'w-full')}>
      <div className={twMerge('flex', collapsed && 'justify-center')}>{triggerContent}</div>
      {isOpen && (
        <div
          className={twMerge(
            'absolute z-50 max-h-64 overflow-auto rounded-md border border-border bg-popover shadow-md backdrop-blur supports-[backdrop-filter]:bg-popover/70',
            collapsed
              ? 'left-full top-1/2 ml-3 w-[240px] -translate-y-1/2'
              : 'left-0 mt-2 w-full origin-top'
          )}
        >
          <div className="rounded-md flex flex-col">
            {collapsed && selectedOption && (
              <div className="space-y-3 border-b border-border/60 bg-background/80 p-3">
                <div className="flex items-start gap-3">
                  <span className="text-2xl leading-none">{selectedOption.iconId ?? '💼'}</span>
                  <div className="flex flex-1 flex-col gap-2">
                    {renamingWorkspace ? (
                      <div className="flex items-center gap-2">
                        <Input
                          value={workspaceDraftTitle}
                          onChange={(event) => setWorkspaceDraftTitle(event.target.value)}
                          className="h-8 text-sm"
                          autoFocus
                          disabled={pendingWorkspaceAction}
                        />
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8"
                          onClick={handleWorkspaceRename}
                          disabled={pendingWorkspaceAction}
                        >
                          <Check className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8"
                          onClick={() => {
                            setRenamingWorkspace(false);
                            setWorkspaceDraftTitle(selectedOption.title ?? 'Untitled workspace');
                          }}
                          disabled={pendingWorkspaceAction}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ) : (
                      <div className="flex flex-col">
                        <span className="text-sm font-semibold text-foreground">{selectedOption.title}</span>
                        <span className="text-xs text-muted-foreground">Tap an action to manage this workspace</span>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <TooltipComponent message="Rename workspace">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8"
                        onClick={() => setRenamingWorkspace(true)}
                        disabled={pendingWorkspaceAction}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </TooltipComponent>
                    <TooltipComponent message="Move workspace to trash">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={handleWorkspaceTrash}
                        disabled={pendingWorkspaceAction}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TooltipComponent>
                  </div>
                </div>
                <Separator />
              </div>
            )}
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
