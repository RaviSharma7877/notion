'use client';
import { useAuth } from '@/lib/providers/auth-provider';
import type { UserDto, WorkspaceCreateInput, WorkspaceDto } from '@/lib/queries';
import { useRouter } from 'next/navigation';
import React, { useState } from 'react';
import { Label } from '../ui/label';
import { Input } from '../ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { SelectGroup } from '@radix-ui/react-select';
import { Lock, Plus, Share } from 'lucide-react';
import { Button } from '../ui/button';
import { createCollaborator, createWorkspace } from '@/lib/queries';
import CollaboratorSearch from './collaborator-search';
import { ScrollArea } from '../ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { useToast } from '../ui/use-toast';

const WorkspaceCreator = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const router = useRouter();
  const [permissions, setPermissions] = useState('shared');
  const [title, setTitle] = useState('');
  const [collaborators, setCollaborators] = useState<UserDto[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const addCollaborator = (candidate: UserDto) => {
    if (collaborators.some((entry) => entry.id === candidate.id)) {
      return;
    }
    setCollaborators([...collaborators, candidate]);
  };

  const removeCollaborator = (candidate: UserDto) => {
    setCollaborators(collaborators.filter((entry) => entry.id !== candidate.id));
  };

  const createItem = async () => {
    setIsLoading(true);
    if (!user?.id) {
      toast({
        title: 'Unable to create workspace',
        description: 'You must be signed in to create a workspace.',
        variant: 'destructive',
      });
      setIsLoading(false);
      return;
    }

    try {
      const payload: WorkspaceCreateInput = {
        title,
        iconId: '💼',
        data: null,
        inTrash: false,
        workspaceOwner: user.id,
        logo: null,
        bannerUrl: null,
      };

      const createdWorkspace: WorkspaceDto = await createWorkspace(payload);

      if (permissions === 'shared' && collaborators.length > 0) {
        await Promise.all(
          collaborators.map((collaborator) =>
            createCollaborator({
              workspaceId: createdWorkspace.id,
              userId: collaborator.id,
            }).catch((error) => {
              console.error('Failed to add collaborator', error);
            })
          )
        );
      }

      toast({ title: 'Success', description: 'Created the workspace' });
      router.refresh();
      setTitle('');
      setCollaborators([]);
      setPermissions('private');
    } catch (error) {
      console.error('Failed to create workspace', error);
      toast({
        title: 'Unable to create workspace',
        description: 'Something went wrong. Please try again later.',
        variant: 'destructive',
      });
    }
    setIsLoading(false);
  };

  return (
    <div className="flex gap-4 flex-col">
      <div>
        <Label
          htmlFor="name"
          className="text-sm text-muted-foreground"
        >
          Name
        </Label>
        <div
          className="flex 
        justify-center 
        items-center 
        gap-2
        "
        >
          <Input
            name="name"
            value={title}
            placeholder="Workspace Name"
            onChange={(e) => {
              setTitle(e.target.value);
            }}
          />
        </div>
      </div>
      <>
        <Label
          htmlFor="permissions"
          className="text-sm
          text-muted-foreground"
        >
          Permission
        </Label>
        <Select
          onValueChange={(val) => {
            setPermissions(val);
          }}
          defaultValue={permissions}
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
      </>
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
      <Button
        type="button"
        disabled={
          !title ||
          (permissions === 'shared' && collaborators.length === 0) ||
          isLoading
        }
        variant={'secondary'}
        onClick={createItem}
      >
        Create
      </Button>
    </div>
  );
};

export default WorkspaceCreator;
