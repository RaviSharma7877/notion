'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';

import QuillEditor, { QuillEditorHandle } from '@/components/quill-editor/quill-editor';
import Loader from '@/components/global/Loader';
import { Button } from '@/components/ui/button';
import { getWorkspace, type WorkspaceDto } from '@/lib/queries';
import { useAppState } from '@/lib/providers/state-provider';

const WorkspacePage: React.FC = () => {
  const { state } = useAppState();
  const router = useRouter();
  const params = useParams<{ workspaceId?: string }>();
  const workspaceId = params?.workspaceId;

  const [workspace, setWorkspace] = useState<WorkspaceDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const editorRef = useRef<QuillEditorHandle | null>(null);
  const fetchRef = useRef(false);
  const lastWorkspaceIdRef = useRef<string | null>(null);

  const workspaceFromState = useMemo(() => {
    if (!workspaceId) {
      return null;
    }
    return state.workspaces.find((item) => item.id === workspaceId) ?? null;
  }, [state.workspaces, workspaceId]);

  useEffect(() => {
    if (!workspaceId) {
      setWorkspace(null);
      setErrorMessage('Workspace not specified.');
      setLoading(false);
      return;
    }

    if (lastWorkspaceIdRef.current !== workspaceId) {
      lastWorkspaceIdRef.current = workspaceId;
      fetchRef.current = false;
      setWorkspace(null);
      setErrorMessage(null);
    }

    if (workspaceFromState) {
      setWorkspace(workspaceFromState);
      setLoading(false);
      return;
    }

    if (fetchRef.current) {
      return;
    }

    fetchRef.current = true;
    let active = true;

    const load = async () => {
      setLoading(true);
      try {
        const data = await getWorkspace(workspaceId);
        if (!active) {
          return;
        }

        setWorkspace(data);
        setErrorMessage(null);
      } catch (error) {
        console.error('Failed to load workspace', error);
        if (!active) {
          return;
        }
        setWorkspace(null);
        setErrorMessage('We could not open this workspace right now.');
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    load();

    return () => {
      active = false;
      fetchRef.current = false;
    };
  }, [workspaceId, workspaceFromState]);

  const flushEditor = useCallback(async () => {
    await editorRef.current?.flushPending();
  }, []);

  useEffect(() => {
    return () => {
      void flushEditor();
    };
  }, [flushEditor]);

  const handleBackToDashboard = async () => {
    await flushEditor();
    router.replace('/dashboard');
  };

  if (loading) {
    return (
      <div className="flex min-h-screen w-full items-center justify-center bg-background">
        <Loader />
      </div>
    );
  }

  if (errorMessage || !workspace) {
    return (
      <div className="flex min-h-screen w-full flex-col items-center justify-center gap-4 bg-background text-center">
        <p className="text-lg font-medium text-foreground">{errorMessage ?? 'Workspace not found.'}</p>
        <p className="text-sm text-muted-foreground">
          The workspace may have been deleted or you might not have access to it.
        </p>
        <Button onClick={() => void handleBackToDashboard()} type="button">
          Go back to dashboard
        </Button>
      </div>
    );
  }

  return (
    <div className="relative h-full w-full">
      <QuillEditor
        ref={editorRef}
        dirType="workspace"
        fileId={workspace.id}
        dirDetails={workspace}
      />
    </div>
  );
};

export default WorkspacePage;
