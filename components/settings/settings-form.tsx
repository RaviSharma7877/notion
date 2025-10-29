'use client';
import React, { useEffect, useRef, useState } from 'react';
import { useToast } from '../ui/use-toast';
import { useAppState, type appWorkspacesType } from '@/lib/providers/state-provider';
import { useAuth } from '@/lib/providers/auth-provider';
import { useRouter } from 'next/navigation';
import {
  Briefcase,
  CreditCard,
  ExternalLink,
  Lock,
  LogOut,
  Plus,
  Share,
  User as UserIcon,
} from 'lucide-react';
import { Separator } from '../ui/separator';
import { Label } from '../ui/label';
import { Input } from '../ui/input';
import {
  createCollaborator,
  deleteCollaborator,
  deleteWorkspace,
  getUser,
  listCollaborators,
  updateWorkspace,
  uploadWorkspaceLogo,
  type CollaboratorDto,
  type UserDto,
} from '@/lib/queries';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

import CollaboratorSearch from '../global/collaborator-search';
import { Button } from '../ui/button';
import { ScrollArea } from '../ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { Alert, AlertDescription } from '../ui/alert';
import CypressProfileIcon from '../icons/cypressProfileIcon';
import LogoutButton from '../global/logout-button';
import Link from 'next/link';
import { useSubscriptionModal } from '@/lib/providers/subscription-modal-provider';
import { postData } from '@/lib/utils';

const SettingsForm = () => {
  const { toast } = useToast();
  const { user, subscription } = useAuth();
  const { setOpen } = useSubscriptionModal();
  const router = useRouter();
  const { state, workspaceId, dispatch } = useAppState();
  const isProPlan = (subscription?.status ?? '').toUpperCase() === 'ACTIVE';
  const [permissions, setPermissions] = useState('private');
  const [collaborators, setCollaborators] = useState<UserDto[]>([]);
  const [openAlertMessage, setOpenAlertMessage] = useState(false);
  const [workspaceDetails, setWorkspaceDetails] = useState<appWorkspacesType | undefined>();
  const titleTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [loadingPortal, setLoadingPortal] = useState(false);
  const collaboratorMapRef = useRef<Map<string, string>>(new Map());

  //WIP PAYMENT PORTAL

  const redirectToCustomerPortal = async () => {
    setLoadingPortal(true);
    try {
      const { url } = await postData({
        url: '/api/create-portal-link',
      });
      window.location.assign(url);
    } catch (error) {
      console.error(error);
    } finally {
      setLoadingPortal(false);
    }
  };
  //addcollborators
  const addCollaborator = async (profile: UserDto) => {
    if (!workspaceId) return;
    if (!isProPlan && collaborators.length >= 2) {
      setOpen(true);
      return;
    }
    if (collaborators.some((collaborator) => collaborator.id === profile.id)) {
      toast({
        title: 'Already a collaborator',
        description: 'This user is already part of the workspace.',
      });
      return;
    }
    try {
      const created = await createCollaborator({
        workspaceId,
        userId: profile.id,
      });
      collaboratorMapRef.current.set(profile.id, created.id);
      setCollaborators((prev) => [...prev, profile]);
    } catch (error) {
      console.error('Failed to add collaborator', error);
      toast({
        title: 'Error',
        variant: 'destructive',
        description: 'Could not add the collaborator.',
      });
    }
  };

  //remove collaborators
  const removeCollaborator = async (collaboratorUser: UserDto) => {
    if (!workspaceId) return;
    const collaboratorId = collaboratorMapRef.current.get(collaboratorUser.id);

    if (!collaboratorId) {
      return;
    }

    try {
      await deleteCollaborator(collaboratorId);
      collaboratorMapRef.current.delete(collaboratorUser.id);
      setCollaborators((prev) => {
        const next = prev.filter((collaborator) => collaborator.id !== collaboratorUser.id);
        if (!next.length) {
          setPermissions('private');
        }
        return next;
      });
    } catch (error) {
      console.error('Failed to remove collaborator', error);
      toast({
        title: 'Error',
        variant: 'destructive',
        description: 'Could not remove the collaborator.',
      });
    }
  };

  //on change
  const workspaceNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!workspaceId || !e.target.value) return;
    const newTitle = e.target.value;
    dispatch({
      type: 'UPDATE_WORKSPACE',
      payload: { workspace: { title: newTitle }, workspaceId },
    });
    if (titleTimerRef.current) clearTimeout(titleTimerRef.current);
    titleTimerRef.current = setTimeout(async () => {
      try {
        await updateWorkspace(workspaceId, { title: newTitle });
      } catch (error) {
        console.error('Failed to update workspace name', error);
      }
    }, 500);
  };

  const onChangeWorkspaceLogo = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    if (!workspaceId) return;
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingLogo(true);
    try {
      const logoPath = await uploadWorkspaceLogo(workspaceId, file);
      dispatch({
        type: 'UPDATE_WORKSPACE',
        payload: { workspace: { logo: logoPath }, workspaceId },
      });
      await updateWorkspace(workspaceId, { logo: logoPath });
      toast({
        title: 'Success',
        description: 'Workspace logo updated.',
      });
    } catch (error) {
      console.error('Failed to upload workspace logo', error);
      toast({
        title: 'Error',
        variant: 'destructive',
        description: 'Could not upload the workspace logo.',
      });
    } finally {
      setUploadingLogo(false);
    }
  };

  const onClickAlertConfirm = async () => {
    if (!workspaceId) return;
    if (collaborators.length > 0) {
      await Promise.all(
        collaborators.map(async (collaborator) => {
          const collaboratorId = collaboratorMapRef.current.get(collaborator.id);
          if (!collaboratorId) return;
          try {
            await deleteCollaborator(collaboratorId);
          } catch (error) {
            console.error('Failed to remove collaborator during permission change', error);
          }
        })
      );
      collaboratorMapRef.current.clear();
      setCollaborators([]);
    }
    setPermissions('private');
    setOpenAlertMessage(false);
  };

  const onPermissionsChange = (val: string) => {
    if (val === 'private') {
      setOpenAlertMessage(true);
    } else setPermissions(val);
  };

  //CHALLENGE fetching avatar details
  //WIP Payment Portal redirect

  useEffect(() => {
    const showingWorkspace = state.workspaces.find(
      (workspace) => workspace.id === workspaceId
    );
    if (showingWorkspace) setWorkspaceDetails(showingWorkspace);
  }, [workspaceId, state]);

  useEffect(() => {
    if (!workspaceId) return;
    const fetchCollaborators = async () => {
      try {
        const page = await listCollaborators({ workspaceId, size: 100 });
        const entries: CollaboratorDto[] = page.content ?? [];

        if (!entries.length) {
          collaboratorMapRef.current.clear();
          setCollaborators([]);
          setPermissions('private');
          return;
        }

        collaboratorMapRef.current.clear();
        const users = await Promise.all(
          entries.map(async (entry) => {
            try {
              const collaboratorUser = await getUser(entry.userId);
              collaboratorMapRef.current.set(entry.userId, entry.id);
              return collaboratorUser;
            } catch (error) {
              console.error('Failed to fetch collaborator user', error);
              return null;
            }
          })
        );

        const validUsers = users.filter(Boolean) as UserDto[];

        if (validUsers.length) {
          setPermissions('shared');
          setCollaborators(validUsers);
        } else {
          collaboratorMapRef.current.clear();
          setCollaborators([]);
          setPermissions('private');
        }
      } catch (error) {
        console.error('Failed to load collaborators', error);
      }
    };
    fetchCollaborators();
  }, [workspaceId]);

  return (
    <div className="flex gap-4 flex-col">
      <p className="flex items-center gap-2 mt-6">
        <Briefcase size={20} />
        Workspace
      </p>
      <Separator />
      <div className="flex flex-col gap-2">
        <Label
          htmlFor="workspaceName"
          className="text-sm text-muted-foreground"
        >
          Name
        </Label>
        <Input
          name="workspaceName"
          value={workspaceDetails ? workspaceDetails.title : ''}
          placeholder="Workspace Name"
          onChange={workspaceNameChange}
        />
        <Label
          htmlFor="workspaceLogo"
          className="text-sm text-muted-foreground"
        >
          Workspace Logo
        </Label>
        <Input
          name="workspaceLogo"
          type="file"
          accept="image/*"
          placeholder="Workspace Logo"
          onChange={onChangeWorkspaceLogo}
          disabled={uploadingLogo || !isProPlan}
        />
        {!isProPlan && (
          <small className="text-muted-foreground">
            To customize your workspace, you need to be on a Pro Plan
          </small>
        )}
      </div>
      <>
        <Label htmlFor="permissions">Permissions</Label>
        <Select
          onValueChange={onPermissionsChange}
          value={permissions}
        >
          <SelectTrigger className="w-full h-26 -mt-3">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectItem value="private">
                <div
                  className="p-2
                  flex
                  gap-4
                  justify-center
                  items-center
                "
                >
                  <Lock />
                  <article className="text-left flex flex-col">
                    <span>Private</span>
                    <p>
                      Your workspace is private to you. You can choose to share
                      it later.
                    </p>
                  </article>
                </div>
              </SelectItem>
              <SelectItem value="shared">
                <div className="p-2 flex gap-4 justify-center items-center">
                  <Share></Share>
                  <article className="text-left flex flex-col">
                    <span>Shared</span>
                    <span>You can invite collaborators.</span>
                  </article>
                </div>
              </SelectItem>
            </SelectGroup>
          </SelectContent>
        </Select>

        {permissions === 'shared' && (
          <div>
            <CollaboratorSearch
              existingCollaborators={collaborators}
              getCollaborator={(user) => {
                addCollaborator(user);
              }}
            >
              <Button
                type="button"
                className="text-sm mt-4"
              >
                <Plus />
                Add Collaborators
              </Button>
            </CollaboratorSearch>
            <div className="mt-4">
              <span className="text-sm text-muted-foreground">
                Collaborators {collaborators.length || ''}
              </span>
              <ScrollArea
                className="
            h-[120px]
            overflow-y-scroll
            w-full
            rounded-md
            border
            border-muted-foreground/20"
              >
                {collaborators.length ? (
                  collaborators.map((c) => (
                    <div
                      className="p-4 flex
                      justify-between
                      items-center
                "
                      key={c.id}
                    >
                      <div className="flex gap-4 items-center">
                        <Avatar>
                          <AvatarImage src="/avatars/7.png" />
                          <AvatarFallback>PJ</AvatarFallback>
                        </Avatar>
                        <div
                          className="text-sm 
                          gap-2
                          text-muted-foreground
                          overflow-hidden
                          overflow-ellipsis
                          sm:w-[300px]
                          w-[140px]
                        "
                        >
                          {c.email}
                        </div>
                      </div>
                      <Button
                        variant="secondary"
                        onClick={() => removeCollaborator(c)}
                      >
                        Remove
                      </Button>
                    </div>
                  ))
                ) : (
                  <div
                    className="absolute
                  right-0 left-0
                  top-0
                  bottom-0
                  flex
                  justify-center
                  items-center
                "
                  >
                    <span className="text-muted-foreground text-sm">
                      You have no collaborators
                    </span>
                  </div>
                )}
              </ScrollArea>
            </div>
          </div>
        )}
        <Alert variant={'destructive'}>
          <AlertDescription>
            Warning! deleting you workspace will permanantly delete all data
            related to this workspace.
          </AlertDescription>
          <Button
            type="submit"
            size={'sm'}
            variant={'destructive'}
            className="mt-4 
            text-sm
            bg-destructive/40 
            border-2 
            border-destructive"
            onClick={async () => {
              if (!workspaceId) return;
              await deleteWorkspace(workspaceId);
              toast({ title: 'Successfully deleted your workspae' });
              dispatch({ type: 'DELETE_WORKSPACE', payload: workspaceId });
              router.replace('/dashboard');
            }}
          >
            Delete Workspace
          </Button>
        </Alert>
        <p className="flex items-center gap-2 mt-6">
          <UserIcon size={20} /> Profile
        </p>
        <Separator />
        <div className="flex items-center">
          <Avatar>
            <AvatarImage src={''} />
            <AvatarFallback>
              <CypressProfileIcon />
            </AvatarFallback>
          </Avatar>
          <div className="flex flex-col ml-6">
            <small className="text-muted-foreground cursor-not-allowed">
              {user ? user.email : ''}
            </small>
            <Label
              htmlFor="profilePicture"
              className="text-sm text-muted-foreground"
            >
              Profile Picture
            </Label>
            <Input
              name="profilePicture"
              type="file"
              accept="image/*"
              placeholder="Profile Picture"
              // onChange={onChangeProfilePicture}
            />
          </div>
        </div>
        <LogoutButton>
          <div className="flex items-center">
            <LogOut />
          </div>
        </LogoutButton>
        <p className="flex items-center gap-2 mt-6">
          <CreditCard size={20} /> Billing & Plan
        </p>
        <Separator />
        <p className="text-muted-foreground">
          You are currently on a {isProPlan ? 'Pro' : 'Free'} Plan
        </p>
        <Link
          href="/"
          target="_blank"
          className="text-muted-foreground flex flex-row items-center gap-2"
        >
          View Plans <ExternalLink size={16} />
        </Link>
        {isProPlan ? (
          <div>
            <Button
              type="button"
              size="sm"
              variant={'secondary'}
              disabled={loadingPortal}
              className="text-sm"
              onClick={redirectToCustomerPortal}
            >
              Manage Subscription
            </Button>
          </div>
        ) : (
          <div>
            <Button
              type="button"
              size="sm"
              variant={'secondary'}
              className="text-sm"
              onClick={() => setOpen(true)}
            >
              Start Plan
            </Button>
          </div>
        )}
      </>
      <AlertDialog open={openAlertMessage}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDescription>
              Changing a Shared workspace to a Private workspace will remove all
              collaborators permanantly.
            </AlertDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setOpenAlertMessage(false)}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction onClick={onClickAlertConfirm}>
              Continue
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default SettingsForm;
