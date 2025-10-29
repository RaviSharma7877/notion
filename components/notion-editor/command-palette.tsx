'use client';

import React, { useState, useEffect, useRef } from 'react';
import { BlockType, CommandItem } from '@/lib/notion-types';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import { Card, CardContent } from '../ui/card';
import { 
  Hash, 
  List, 
  CheckSquare, 
  Quote, 
  Code, 
  Image as ImageIcon,
  Video,
  File,
  Link,
  Calculator,
  Database,
  Calendar,
  BarChart3,
  Grid3X3,
  Table,
  Clock,
  MapPin,
  ExternalLink,
  Play,
  Volume2,
  Download,
  Eye,
  EyeOff,
  Minus,
  BookOpen,
  Copy,
  RefreshCw,
  Navigation,
  
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface CommandPaletteProps {
  onClose: () => void;
  onSelectBlock: (type: BlockType) => void;
}

const commandItems: CommandItem[] = [
  // Text blocks
  {
    id: 'paragraph',
    title: 'Text',
    description: 'Just start typing with plain text.',
    icon: '📝',
    keywords: ['text', 'paragraph', 'write'],
    action: () => {},
    category: 'text'
  },
  {
    id: 'heading1',
    title: 'Heading 1',
    description: 'Big section heading.',
    icon: 'H1',
    keywords: ['heading', 'title', 'h1', 'big'],
    action: () => {},
    category: 'text'
  },
  {
    id: 'heading2',
    title: 'Heading 2',
    description: 'Medium section heading.',
    icon: 'H2',
    keywords: ['heading', 'title', 'h2', 'medium'],
    action: () => {},
    category: 'text'
  },
  {
    id: 'heading3',
    title: 'Heading 3',
    description: 'Small section heading.',
    icon: 'H3',
    keywords: ['heading', 'title', 'h3', 'small'],
    action: () => {},
    category: 'text'
  },
  {
    id: 'bulleted_list',
    title: 'Bulleted List',
    description: 'Create a simple bulleted list.',
    icon: '•',
    keywords: ['list', 'bullet', 'unordered'],
    action: () => {},
    category: 'text'
  },
  {
    id: 'numbered_list',
    title: 'Numbered List',
    description: 'Create a list with numbering.',
    icon: '1.',
    keywords: ['list', 'number', 'ordered'],
    action: () => {},
    category: 'text'
  },
  {
    id: 'todo',
    title: 'To-do',
    description: 'Track tasks with a to-do list.',
    icon: '☐',
    keywords: ['todo', 'task', 'checkbox', 'check'],
    action: () => {},
    category: 'text'
  },
  {
    id: 'toggle',
    title: 'Toggle List',
    description: 'Create a collapsible list.',
    icon: '▼',
    keywords: ['toggle', 'collapsible', 'hide', 'show'],
    action: () => {},
    category: 'text'
  },
  {
    id: 'quote',
    title: 'Quote',
    description: 'Capture a quote.',
    icon: '"',
    keywords: ['quote', 'citation', 'reference'],
    action: () => {},
    category: 'text'
  },
  {
    id: 'code',
    title: 'Code',
    description: 'Capture a code snippet.',
    icon: '</>',
    keywords: ['code', 'snippet', 'programming'],
    action: () => {},
    category: 'text'
  },
  {
    id: 'callout',
    title: 'Callout',
    description: 'Make writing stand out.',
    icon: '💡',
    keywords: ['callout', 'highlight', 'important', 'note'],
    action: () => {},
    category: 'text'
  },
  {
    id: 'divider',
    title: 'Divider',
    description: 'Visually divide blocks.',
    icon: '—',
    keywords: ['divider', 'line', 'separator'],
    action: () => {},
    category: 'text'
  },
  {
    id: 'table_of_contents',
    title: 'Table of Contents',
    description: 'Generate a table of contents.',
    icon: '📋',
    keywords: ['toc', 'contents', 'navigation'],
    action: () => {},
    category: 'text'
  },
  {
    id: 'page',
    title: 'Page',
    description: 'Embed another page.',
    icon: '📄',
    keywords: ['page', 'embed', 'link'],
    action: () => {},
    category: 'text'
  },

  // Media blocks
  {
    id: 'image',
    title: 'Image',
    description: 'Upload or embed an image.',
    icon: '🖼️',
    keywords: ['image', 'photo', 'picture', 'upload'],
    action: () => {},
    category: 'media'
  },
  {
    id: 'video',
    title: 'Video',
    description: 'Embed a video.',
    icon: '🎥',
    keywords: ['video', 'youtube', 'vimeo', 'embed'],
    action: () => {},
    category: 'media'
  },
  {
    id: 'audio',
    title: 'Audio',
    description: 'Upload or embed audio.',
    icon: '🎵',
    keywords: ['audio', 'music', 'sound', 'upload'],
    action: () => {},
    category: 'media'
  },
  {
    id: 'file',
    title: 'File',
    description: 'Upload any type of file.',
    icon: '📎',
    keywords: ['file', 'upload', 'document', 'attachment'],
    action: () => {},
    category: 'media'
  },
  {
    id: 'bookmark',
    title: 'Bookmark',
    description: 'Save a link as a bookmark.',
    icon: '🔖',
    keywords: ['bookmark', 'link', 'url', 'save'],
    action: () => {},
    category: 'media'
  },
  {
    id: 'embed',
    title: 'Embed',
    description: 'Embed from external services.',
    icon: '🔗',
    keywords: ['embed', 'external', 'service', 'widget'],
    action: () => {},
    category: 'media'
  },

  // Database blocks
  {
    id: 'database_table',
    title: 'Table',
    description: 'Create a database table view.',
    icon: '📊',
    keywords: ['table', 'database', 'spreadsheet', 'data'],
    action: () => {},
    category: 'database'
  },
  {
    id: 'database_board',
    title: 'Board',
    description: 'Create a Kanban board.',
    icon: '📋',
    keywords: ['board', 'kanban', 'cards', 'columns'],
    action: () => {},
    category: 'database'
  },
  {
    id: 'database_gallery',
    title: 'Gallery',
    description: 'Create a visual gallery.',
    icon: '🖼️',
    keywords: ['gallery', 'visual', 'cards', 'images'],
    action: () => {},
    category: 'database'
  },
  {
    id: 'database_list',
    title: 'List',
    description: 'Create a simple list view.',
    icon: '📝',
    keywords: ['list', 'simple', 'rows', 'items'],
    action: () => {},
    category: 'database'
  },
  {
    id: 'database_calendar',
    title: 'Calendar',
    description: 'Create a calendar view.',
    icon: '📅',
    keywords: ['calendar', 'date', 'schedule', 'events'],
    action: () => {},
    category: 'database'
  },
  {
    id: 'database_timeline',
    title: 'Timeline',
    description: 'Create a timeline view.',
    icon: '⏰',
    keywords: ['timeline', 'chronological', 'time', 'sequence'],
    action: () => {},
    category: 'database'
  },
  {
    id: 'database_chart',
    title: 'Chart',
    description: 'Create a chart view.',
    icon: '📈',
    keywords: ['chart', 'graph', 'visualization', 'data'],
    action: () => {},
    category: 'database'
  },

  // Advanced blocks
  {
    id: 'synced_block',
    title: 'Synced Block',
    description: 'Sync content across pages.',
    icon: '🔄',
    keywords: ['sync', 'duplicate', 'copy', 'shared'],
    action: () => {},
    category: 'advanced'
  },
  {
    id: 'template_button',
    title: 'Template Button',
    description: 'Create a template button.',
    icon: '🔘',
    keywords: ['template', 'button', 'automation', 'quick'],
    action: () => {},
    category: 'advanced'
  },
  {
    id: 'breadcrumb',
    title: 'Breadcrumb',
    description: 'Show navigation path.',
    icon: '🧭',
    keywords: ['breadcrumb', 'navigation', 'path', 'location'],
    action: () => {},
    category: 'advanced'
  },
  {
    id: 'equation',
    title: 'Equation',
    description: 'Write mathematical equations.',
    icon: '∑',
    keywords: ['equation', 'math', 'formula', 'latex'],
    action: () => {},
    category: 'advanced'
  }
];

// categories list removed to simplify palette UI

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  onClose,
  onSelectBlock,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, []);

  const filteredItems = commandItems.filter(item => {
    const q = searchQuery.toLowerCase();
    return (
      item.title.toLowerCase().includes(q) ||
      item.description.toLowerCase().includes(q) ||
      item.keywords.some(keyword => keyword.toLowerCase().includes(q))
    );
  });

  const handleKeyDown = (e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => Math.min(prev + 1, filteredItems.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => Math.max(prev - 1, 0));
        break;
      case 'Enter':
        e.preventDefault();
        if (filteredItems[selectedIndex]) {
          onSelectBlock(filteredItems[selectedIndex].id as BlockType);
        }
        break;
      case 'Escape':
        e.preventDefault();
        onClose();
        break;
    }
  };

  useEffect(() => {
    if (listRef.current) {
      const selectedElement = listRef.current.children[selectedIndex] as HTMLElement;
      if (selectedElement) {
        selectedElement.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [selectedIndex]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [searchQuery]);

  // Close on outside click
  const handleBackdropClick = () => {
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={handleBackdropClick}>
      <Card className="w-full max-w-md mx-2 max-h-[60vh] overflow-hidden shadow-lg border border-border/60" ref={containerRef} onClick={(e) => e.stopPropagation()}>
        <CardContent className="p-0">
          <div className="p-2 border-b bg-background/90">
            <Input
              ref={inputRef}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Search commands..."
              className="border-none shadow-none focus-visible:ring-0 text-xs h-8"
            />
          </div>

          <div className="max-h-[45vh] overflow-y-auto" ref={listRef}>
            {filteredItems.length === 0 ? (
              <div className="p-4 text-center text-muted-foreground text-xs">
                No commands found
              </div>
            ) : (
              <div className="p-1 space-y-0.5">
                {filteredItems.map((item, index) => (
                  <div
                    key={item.id}
                    className={cn(
                      "flex items-center gap-2 p-2 rounded cursor-pointer transition-colors",
                      index === selectedIndex ? "bg-muted" : "hover:bg-muted/60"
                    )}
                    onClick={() => onSelectBlock(item.id as BlockType)}
                  >
                    <div className="text-base w-6 text-center">
                      {item.icon}
                    </div>
                    <div className="flex-1">
                      <div className="font-medium text-sm">{item.title}</div>
                      <div className="text-xs text-muted-foreground line-clamp-1">
                        {item.description}
                      </div>
                    </div>
                    <Badge variant="outline" className="text-[10px] capitalize">
                      {item.category}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="p-2 border-t bg-muted/20 text-[10px] text-muted-foreground">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span>↑↓ navigate</span>
                <span>↵ select</span>
                <span>esc close</span>
              </div>
              <div>
                {filteredItems.length} result{filteredItems.length !== 1 ? 's' : ''}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
