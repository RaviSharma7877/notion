'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

import DashboardSetup from '@/components/dashboard-setup/dashboard-setup';
import Loader from '@/components/global/Loader';
import { Button } from '@/components/ui/button';
import {
  listSubscriptions,
  listWorkspaces,
  type SubscriptionDto,
  type WorkspaceDto,
  updateWorkspace,
} from '@/lib/queries';
import { useAuth } from '@/lib/providers/auth-provider';
import EmojiPicker from '@/components/global/emoji-picker';
import { resolveWorkspaceOwnerId } from '@/lib/auth/user';

const DashboardPage = () => {
  const { user, initializing } = useAuth();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [workspaces, setWorkspaces] = useState<WorkspaceDto[]>([]);
  const [subscription, setSubscription] = useState<SubscriptionDto | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  const fetchWorkspaceRef = useRef(false);
  const fetchSubscriptionRef = useRef(false);
  const lastUserIdRef = useRef<string | null>(null);
  const [retrySignal, setRetrySignal] = useState(0);

  useEffect(() => {
    if (!initializing && !user) {
      fetchWorkspaceRef.current = false;
      fetchSubscriptionRef.current = false;
      lastUserIdRef.current = null;
      setWorkspaces([]);
      setSubscription(null);
      setLoading(false);
      setErrorMessage(null);
      router.replace('/login');
      return;
    }

    if (!user) {
      return;
    }

    const ownerId = resolveWorkspaceOwnerId(user) ?? null;
    if (lastUserIdRef.current !== ownerId) {
      fetchWorkspaceRef.current = false;
      fetchSubscriptionRef.current = false;
      lastUserIdRef.current = ownerId;
    }

    if (fetchWorkspaceRef.current) {
      return;
    }

    fetchWorkspaceRef.current = true;
    let active = true;

    setLoading(true);
    setErrorMessage(null);

    const load = async () => {
      try {
        if (!ownerId) {
          throw new Error('Missing workspace owner identifier');
        }

        const page = await listWorkspaces({ owner: ownerId, size: 100 });
        if (!active) return;

        setWorkspaces(page.content ?? []);
        setLoading(false);
      } catch (error) {
        console.error('Failed to load workspaces', error);
        if (!active) return;
        setErrorMessage('Unable to load your workspaces right now.');
        setLoading(false);
      }
    };

    load();

    return () => {
      active = false;
      fetchWorkspaceRef.current = false;
    };
  }, [user, initializing, router, retrySignal]);

  const shouldLoadSubscription = useMemo(() => {
    if (!user) {
      return false;
    }
    return showCreate || (!loading && workspaces.length === 0);
  }, [user, showCreate, loading, workspaces.length]);

  useEffect(() => {
    if (!user || initializing || !shouldLoadSubscription || fetchSubscriptionRef.current) {
      return;
    }

    fetchSubscriptionRef.current = true;
    let active = true;

    const loadSubscription = async () => {
      try {
        const subscriptionPage = await listSubscriptions({ size: 100 });
        if (!active) return;

        const subscriptionOwnerId = user.userId ?? resolveWorkspaceOwnerId(user) ?? user.id;
        const matchingSubscription =
          subscriptionPage.content?.find((item) => String(item.userId) === String(subscriptionOwnerId ?? '')) ?? null;
        setSubscription(matchingSubscription);
      } catch (error) {
        console.error('Failed to load subscription information', error);
      }
    };

    loadSubscription();

    return () => {
      active = false;
      fetchSubscriptionRef.current = false;
    };
  }, [user, initializing, shouldLoadSubscription]);

  const onRetry = () => {
    if (!user) return;
    fetchWorkspaceRef.current = false;
    setRetrySignal((value) => value + 1);
  };

  const workspaceCards = useMemo(() => {
    if (!workspaces.length) {
      return null;
    }

    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {workspaces.map((workspace) => (
          <button
            key={workspace.id}
            className="flex flex-col gap-3 rounded-lg border border-border bg-card p-5 text-left shadow-sm transition-colors hover:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            onClick={() => router.push(`/dashboard/${workspace.id}`)}
            type="button"
          >
            <div className="text-3xl" aria-hidden>
              <EmojiPicker
                getValue={async (emoji) => {
                  // Optimistic UI update
                  setWorkspaces((prev) =>
                    prev.map((w) => (w.id === workspace.id ? { ...w, iconId: emoji } : w))
                  );
                  try {
                    await updateWorkspace(workspace.id, { iconId: emoji });
                  } catch {
                    // revert on failure
                    setWorkspaces((prev) =>
                      prev.map((w) => (w.id === workspace.id ? { ...w, iconId: workspace.iconId } : w))
                    );
                  }
                }}
              >
                <span>{workspace.iconId ?? '💼'}</span>
              </EmojiPicker>
            </div>
            <span className="text-base font-semibold text-foreground">{workspace.title}</span>
          </button>
        ))}
      </div>
    );
  }, [router, workspaces]);

  if (!user) {
    if (initializing) {
      return (
        <div className="flex min-h-screen w-full items-center justify-center bg-background">
          <Loader />
        </div>
      );
    }
    return null;
  }

  if (loading) {
    return (
      <div className="flex min-h-screen w-full items-center justify-center bg-background">
        <Loader />
      </div>
    );
  }

  if (errorMessage) {
    return (
      <div className="flex min-h-screen w-full flex-col items-center justify-center bg-background text-center">
        <p className="text-lg font-medium text-foreground">{errorMessage}</p>
        <p className="mt-2 text-sm text-muted-foreground">
          Please try again in a moment or contact support if the issue persists.
        </p>
        <Button
          className="mt-6"
          onClick={onRetry}
          type="button"
        >
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full bg-background">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-6 py-12">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-semibold text-foreground">Your workspaces</h1>
          <p className="text-sm text-muted-foreground">
            Select a workspace to jump back in or{' '}
            <button
              className="text-primary underline underline-offset-4"
              onClick={() => setShowCreate(true)}
              type="button"
            >
              create a new one
            </button>
            .
          </p>
        </div>

        {workspaceCards}

        {workspaces.length === 0 && (
          <div className="flex flex-col items-center gap-4 rounded-lg border border-dashed border-border p-10 text-center">
            <p className="text-lg font-medium text-foreground">
              You don&apos;t have any workspaces yet.
            </p>
            <p className="text-sm text-muted-foreground">
              Create your first workspace to start organizing your notes.
            </p>
            <Button onClick={() => setShowCreate(true)} type="button">
              Create workspace
            </Button>
          </div>
        )}

        {showCreate && (
          <div className="flex w-full justify-center">
            <div className="flex w-full max-w-[820px] flex-col gap-4">
              <div className="flex justify-end">
                <Button
                  onClick={() => setShowCreate(false)}
                  type="button"
                  variant="ghost"
                >
                  Cancel
                </Button>
              </div>
              <DashboardSetup
                user={user}
                subscription={subscription}
              />
            </div>
          </div>
        )}

        {workspaces.length > 0 && !showCreate && (
          <div className="flex items-center justify-between rounded-lg border border-border bg-card px-5 py-4 text-sm text-muted-foreground">
            <span>Need a fresh space for a new project?</span>
            <Button onClick={() => setShowCreate(true)} type="button" variant="secondary">
              Create workspace
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default DashboardPage;
