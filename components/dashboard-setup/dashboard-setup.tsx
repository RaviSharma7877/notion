'use client';
import React, { useState } from 'react';
import { SubmitHandler, useForm } from 'react-hook-form';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  type SubscriptionDto,
  type UserDto,
  type WorkspaceCreateInput,
  createWorkspace,
} from '@/lib/queries';
import { useToast } from '@/components/ui/use-toast';
import { useRouter } from 'next/navigation';
import { useAppState } from '@/lib/providers/state-provider';
import { CreateWorkspaceFormSchema } from '@/lib/types';
import { z } from 'zod';
import EmojiPicker from '@/components/global/emoji-picker';
import Loader from '@/components/global/Loader';
import { resolveWorkspaceOwnerId } from '@/lib/auth/user';

interface DashboardSetupProps {
  user: UserDto;
  subscription: SubscriptionDto | null;
}

const DashboardSetup: React.FC<DashboardSetupProps> = ({
  subscription,
  user,
}) => {
  const { toast } = useToast();
  const router = useRouter();
  const { dispatch } = useAppState();
  const [selectedEmoji, setSelectedEmoji] = useState('💼');
  const {
    register,
    handleSubmit,
    reset,
    formState: { isSubmitting: isLoading, errors },
  } = useForm<z.infer<typeof CreateWorkspaceFormSchema>>({
    mode: 'onChange',
    defaultValues: {
      logo: undefined,
      workspaceName: '',
    },
  });

  const onSubmit: SubmitHandler<z.infer<typeof CreateWorkspaceFormSchema>> = async (value) => {
    const file = value.logo?.[0];

    if (file) {
      toast({
        title: 'Logo upload not yet supported',
        description: 'We will add workspace logo uploads soon. The workspace will be created without a logo.',
      });
    }

    try {
      const workspaceOwnerId = resolveWorkspaceOwnerId(user);
      if (!workspaceOwnerId) {
        throw new Error('Missing workspace owner identifier');
      }

      const payload: WorkspaceCreateInput = {
        title: value.workspaceName,
        iconId: selectedEmoji,
        data: null,
        inTrash: false,
        bannerUrl: null,
        logo: null,
        workspaceOwner: workspaceOwnerId,
      };

      const createdWorkspace = await createWorkspace(payload);

      dispatch({
        type: 'ADD_WORKSPACE',
        payload: { ...createdWorkspace, folders: [] },
      });

      toast({
        title: 'Workspace Created',
        description: `${createdWorkspace.title} has been created successfully.`,
      });

      router.replace(`/dashboard/${createdWorkspace.id}`);
    } catch (error) {
      console.error('Could not create workspace', error);
      toast({
        variant: 'destructive',
        title: 'Could not create your workspace',
        description:
          "Oops! Something went wrong, and we couldn't create your workspace. Try again or come back later.",
      });
    } finally {
      reset();
    }
  };

  return (
    <Card
      className="w-[800px]
      h-screen
      sm:h-auto
  "
    >
      <CardHeader>
        <CardTitle>Create A Workspace</CardTitle>
        <CardDescription>
          Lets create a private workspace to get you started.You can add
          collaborators later from the workspace settings tab.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)}>
          <div className="flex flex-col gap-4">
            <div
              className="flex
            items-center
            gap-4"
            >
              <div className="text-5xl">
                <EmojiPicker getValue={(emoji) => setSelectedEmoji(emoji)}>
                  {selectedEmoji}
                </EmojiPicker>
              </div>
              <div className="w-full ">
                <Label
                  htmlFor="workspaceName"
                  className="text-sm
                  text-muted-foreground
                "
                >
                  Name
                </Label>
                <Input
                  id="workspaceName"
                  type="text"
                  placeholder="Workspace Name"
                  disabled={isLoading}
                  {...register('workspaceName', {
                    required: 'Workspace name is required',
                  })}
                />
                <small className="text-red-600">
                  {errors?.workspaceName?.message?.toString()}
                </small>
              </div>
            </div>
            <div>
              <Label
                htmlFor="logo"
                className="text-sm
                  text-muted-foreground
                "
              >
                Workspace Logo
              </Label>
              <Input
                id="logo"
                type="file"
                accept="image/*"
                placeholder="Workspace Name"
                // disabled={isLoading || subscription?.status !== 'active'}
                {...register('logo', {
                  required: false,
                })}
              />
              <small className="text-red-600">
                {errors?.logo?.message?.toString()}
              </small>
              {subscription?.status !== 'ACTIVE' && (
                <small
                  className="
                  text-muted-foreground
                  block
              "
                >
                  To customize your workspace, you need to be on a Pro Plan
                </small>
              )}
            </div>
            <div className="self-end">
              <Button
                disabled={isLoading}
                type="submit"
              >
                {!isLoading ? 'Create Workspace' : <Loader />}
              </Button>
            </div>
          </div>
        </form>
      </CardContent>
    </Card>
  );
};

export default DashboardSetup;
