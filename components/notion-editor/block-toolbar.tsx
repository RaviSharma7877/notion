'use client';

import React from 'react';
import { Block, BlockType } from '@/lib/notion-types';
import { Button } from '../ui/button';
import { Plus } from 'lucide-react';

interface BlockToolbarProps {
  block: Block;
  onAddBlock: (type: BlockType) => void;
  onDelete: () => void;
  onDuplicate: () => void;
  isVisible: boolean;
  onOpenCommands: () => void;
}

export const BlockToolbar: React.FC<BlockToolbarProps> = ({
  block,
  onAddBlock,
  onDelete,
  onDuplicate,
  isVisible,
  onOpenCommands,
}) => {
  // Always render to ensure + button appears on hover, but keep it visually hidden when not visible

  return (
    <div className={`absolute -left-8 top-1/2 -translate-y-1/2 flex items-center gap-1 transition-opacity pointer-events-auto ${isVisible ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
      <Button
        variant="ghost"
        size="sm"
        className="h-6 w-6 p-0 hover:bg-muted text-muted-foreground"
        onClick={(e) => { e.stopPropagation(); onOpenCommands(); }}
        onMouseDown={(e) => { e.stopPropagation(); }}
        title="Add block"
      >
        <Plus className="h-3 w-3" />
      </Button>
    </div>
  );
};
