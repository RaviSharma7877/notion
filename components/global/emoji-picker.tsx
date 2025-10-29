'use client';
import React, { useState } from 'react';
import dynamic from 'next/dynamic';
import type { EmojiClickData } from 'emoji-picker-react';

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';

interface EmojiPickerProps {
  children: React.ReactNode;
  getValue?: (emoji: string) => void;
}

const EmojiTriggerButton = React.forwardRef<HTMLSpanElement, React.HTMLAttributes<HTMLSpanElement>>(
  ({ className, onKeyDown, onClick, ...props }, ref) => {
    const handleKeyDown = (event: React.KeyboardEvent<HTMLSpanElement>) => {
      onKeyDown?.(event);
      if (!event.defaultPrevented && (event.key === 'Enter' || event.key === ' ')) {
        event.preventDefault();
        onClick?.(event as unknown as React.MouseEvent<HTMLSpanElement>);
      }
    };

    return (
      <span
        ref={ref}
        role="button"
        tabIndex={0}
        className={cn(
          'cursor-pointer select-none bg-transparent border-0 p-0 leading-none outline-none',
          className,
        )}
        onKeyDown={handleKeyDown}
        onClick={onClick}
        {...props}
      />
    );
  },
);
EmojiTriggerButton.displayName = 'EmojiTrigger';

// Import the picker with SSR disabled (prevents hydration/runtime crashes)
const Picker = dynamic(() => import('emoji-picker-react'), {
  ssr: false,
  // Optional: small placeholder while it loads
  loading: () => <div className="p-2 text-sm text-muted-foreground">Loading…</div>,
});

const EmojiPicker: React.FC<EmojiPickerProps> = ({ children, getValue }) => {
  const [open, setOpen] = useState(false);

  const onClick = (selectedEmoji: EmojiClickData) => {
    getValue?.(selectedEmoji.emoji);
    // Close the popover after selecting an emoji
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <EmojiTriggerButton>
          {children}
        </EmojiTriggerButton>
      </PopoverTrigger>

      <PopoverContent
        align="start"
        sideOffset={6}
        className="p-0 border-none w-auto"
      >
        {/* emoji-picker-react only on the client (SSR off). */}
        {/* lazyLoadEmojis avoids heavy upfront work. */}
        {/* emojiStyle can be set if you want native/Apple/Google styles. */}
        <Picker onEmojiClick={onClick} lazyLoadEmojis />
      </PopoverContent>
    </Popover>
  );
};

export default EmojiPicker;
