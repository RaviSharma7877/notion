'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useCollaborationState } from '@/hooks/use-collaboration-state';
import { CursorPosition } from '@/lib/queries';

interface CursorOverlayProps {
  blockId: string;
  children: React.ReactNode;
}

export const CursorOverlay: React.FC<CursorOverlayProps> = ({ blockId, children }) => {
  const { cursors, collaborators } = useCollaborationState();
  const [blockPosition, setBlockPosition] = useState<{ top: number; left: number; height: number } | null>(null);
  const blockRef = useRef<HTMLDivElement>(null);

  // Update block position when component mounts or updates
  useEffect(() => {
    const updatePosition = () => {
      if (blockRef.current) {
        const rect = blockRef.current.getBoundingClientRect();
        setBlockPosition({
          top: rect.top + window.scrollY,
          left: rect.left + window.scrollX,
          height: rect.height,
        });
      }
    };

    updatePosition();
    window.addEventListener('scroll', updatePosition);
    window.addEventListener('resize', updatePosition);

    return () => {
      window.removeEventListener('scroll', updatePosition);
      window.removeEventListener('resize', updatePosition);
    };
  }, []);

  // Get cursors for this specific block
  const blockCursors = Array.from(cursors.entries()).filter(([_, cursor]) => cursor.blockId === blockId);

  // Get collaborator info for each cursor
  const cursorData = blockCursors.map(([userId, cursor]) => {
    const collaborator = collaborators.find(c => c.userId === userId);
    return {
      userId,
      cursor,
      collaborator: collaborator || {
        userId,
        displayName: `User ${userId.slice(0, 8)}`,
        avatarUrl: null,
        isActive: true,
        lastSeen: Date.now(),
      },
    };
  });

  return (
    <div ref={blockRef} className="relative">
      {children}
      
      {/* Render cursors */}
      {blockPosition && cursorData.map(({ userId, cursor, collaborator }) => (
        <div
          key={userId}
          className="absolute pointer-events-none z-50 transition-all duration-100"
          style={{
            left: `${Math.max(0, Math.min(100, cursor.offset * 8))}px`, // Approximate character width
            top: '0px',
            transform: 'translateY(-2px)',
          }}
        >
          {/* Cursor line */}
          <div
            className="w-0.5 h-5 bg-blue-500 animate-pulse"
            style={{
              boxShadow: '0 0 0 1px rgba(59, 130, 246, 0.3)',
            }}
          />
          
          {/* Collaborator info */}
          <div className="absolute top-6 left-0 flex items-center gap-1 bg-blue-500 text-white text-xs px-2 py-1 rounded-md shadow-lg">
            <Avatar className="w-4 h-4">
              <AvatarImage src={collaborator.avatarUrl || undefined} />
              <AvatarFallback className="text-xs">
                {collaborator.displayName.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <span className="whitespace-nowrap">{collaborator.displayName}</span>
          </div>
        </div>
      ))}
    </div>
  );
};
