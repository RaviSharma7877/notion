'use client';
import { useAuth } from '@/lib/providers/auth-provider';
import type { UserDto } from '@/lib/queries';
import React, { useEffect, useRef, useState } from 'react';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { Search } from 'lucide-react';
import { Input } from '../ui/input';
import { ScrollArea } from '../ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { Button } from '../ui/button';
import { listUsers } from '@/lib/queries';

interface CollaboratorSearchProps {
  existingCollaborators: UserDto[];
  getCollaborator: (collaborator: UserDto) => void;
  children: React.ReactNode;
}

const CollaboratorSearch: React.FC<CollaboratorSearchProps> = ({
  children,
  existingCollaborators,
  getCollaborator,
}) => {
  const { user } = useAuth();
  const [searchResults, setSearchResults] = useState<UserDto[]>([]);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const onChangeHandler = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.trim();
    if (timerRef.current) clearTimeout(timerRef.current);
    if (!value) {
      setSearchResults([]);
      return;
    }
    timerRef.current = setTimeout(async () => {
      try {
        const page = await listUsers({ q: value, size: 20 });
        setSearchResults(page.content ?? []);
      } catch (error) {
        console.error('Failed to search users', error);
        setSearchResults([]);
      }
    }, 450);
  };

  const addCollaborator = (candidate: UserDto) => {
    getCollaborator(candidate);
  };

  return (
    <Sheet>
      <SheetTrigger asChild className="w-full">
        {children}
      </SheetTrigger>
      <SheetContent className="w-[400px] sm:w-[540px]">
        <SheetHeader>
          <SheetTitle>Search Collaborator</SheetTitle>
          <SheetDescription className="text-sm text-muted-foreground">
            You can also remove collaborators after adding them from the settings tab.
          </SheetDescription>
        </SheetHeader>
        <div
          className="flex justify-center
          items-center
          gap-2
          mt-2
        "
        >
          <Search />
          <Input
            name="name"
            className="dark:bg-background"
            placeholder="Email"
            onChange={onChangeHandler}
          />
        </div>
        <ScrollArea
          className="mt-6
          overflow-y-scroll
          w-full
          rounded-md
        "
        >
          {searchResults
            .filter(
              (result) =>
                !existingCollaborators.some(
                  (existing) => existing.id === result.id
                )
            )
            .filter((result) => result.id !== user?.id)
            .map((candidate) => (
              <div
                key={candidate.id}
                className=" p-4 flex justify-between items-center"
              >
                <div className="flex gap-4 items-center">
                  <Avatar className="w-8 h-8">
                    <AvatarImage src="/avatars/7.png" />
                    <AvatarFallback>CP</AvatarFallback>
                  </Avatar>
                  <div
                    className="text-sm 
                  gap-2 
                  overflow-hidden 
                  overflow-ellipsis 
                  w-[180px] 
                  text-muted-foreground
                  "
                  >
                    {candidate.email}
                  </div>
                </div>
                <Button
                  variant="secondary"
                  onClick={() => addCollaborator(candidate)}
                >
                  Add
                </Button>
              </div>
            ))}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
};

export default CollaboratorSearch;
