// Notion-like Editor Types
export type BlockType = 
  // Text-based blocks
  | 'paragraph'
  | 'heading1'
  | 'heading2' 
  | 'heading3'
  | 'bulleted_list'
  | 'numbered_list'
  | 'todo'
  | 'toggle'
  | 'quote'
  | 'code'
  | 'callout'
  | 'divider'
  | 'table_of_contents'
  | 'page'
  // Database blocks
  | 'database_table'
  | 'database_board'
  | 'database_gallery'
  | 'database_list'
  | 'database_calendar'
  | 'database_timeline'
  | 'database_chart'
  // Media & Embed blocks
  | 'image'
  | 'video'
  | 'audio'
  | 'file'
  | 'bookmark'
  | 'embed'
  // Advanced blocks
  | 'synced_block'
  | 'template_button'
  | 'breadcrumb'
  | 'equation';

export interface BaseBlock {
  id: string;
  type: BlockType;
  content: string;
  children?: Block[];
  metadata?: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

// Text-based blocks
export interface ParagraphBlock extends BaseBlock {
  type: 'paragraph';
  content: string;
}

export interface HeadingBlock extends BaseBlock {
  type: 'heading1' | 'heading2' | 'heading3';
  content: string;
}

export interface ListBlock extends BaseBlock {
  type: 'bulleted_list' | 'numbered_list';
  content: string;
  items?: ListItem[];
}

export interface ListItem {
  id: string;
  content: string;
  children?: Block[];
  checked?: boolean; // for todo items
}

export interface TodoBlock extends BaseBlock {
  type: 'todo';
  content: string;
  checked: boolean;
  children?: Block[];
}

export interface ToggleBlock extends BaseBlock {
  type: 'toggle';
  content: string;
  children?: Block[];
  isOpen: boolean;
}

export interface QuoteBlock extends BaseBlock {
  type: 'quote';
  content: string;
  children?: Block[];
}

export interface CodeBlock extends BaseBlock {
  type: 'code';
  content: string;
  language: string;
}

export interface CalloutBlock extends BaseBlock {
  type: 'callout';
  content: string;
  icon: string;
  color: 'default' | 'blue' | 'green' | 'yellow' | 'red' | 'purple' | 'gray';
  children?: Block[];
}

export interface DividerBlock extends BaseBlock {
  type: 'divider';
  content: '';
}

export interface TableOfContentsBlock extends BaseBlock {
  type: 'table_of_contents';
  content: '';
  headings: HeadingItem[];
}

export interface HeadingItem {
  id: string;
  level: 1 | 2 | 3;
  content: string;
  children?: HeadingItem[];
}

export interface PageBlock extends BaseBlock {
  type: 'page';
  content: string;
  pageId: string;
  pageTitle: string;
}

// Database blocks
export interface DatabaseBlock extends BaseBlock {
  type: 'database_table' | 'database_board' | 'database_gallery' | 'database_list' | 'database_calendar' | 'database_timeline' | 'database_chart';
  content: '';
  databaseId: string;
  viewType: 'table' | 'board' | 'gallery' | 'list' | 'calendar' | 'timeline' | 'chart';
  properties: DatabaseProperty[];
  records: DatabaseRecord[];
}

export interface DatabaseProperty {
  id: string;
  name: string;
  type: 'title' | 'text' | 'number' | 'select' | 'multi_select' | 'date' | 'person' | 'file' | 'checkbox' | 'url' | 'email' | 'phone' | 'formula' | 'relation' | 'rollup' | 'created_time' | 'created_by' | 'last_edited_time' | 'last_edited_by';
  options?: any[];
}

export interface DatabaseRecord {
  id: string;
  properties: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

// Media & Embed blocks
export interface ImageBlock extends BaseBlock {
  type: 'image';
  content: '';
  url: string;
  alt?: string;
  caption?: string;
  width?: number;
  height?: number;
}

export interface VideoBlock extends BaseBlock {
  type: 'video';
  content: '';
  url: string;
  caption?: string;
  provider?: 'youtube' | 'vimeo' | 'direct';
}

export interface AudioBlock extends BaseBlock {
  type: 'audio';
  content: '';
  url: string;
  caption?: string;
}

export interface FileBlock extends BaseBlock {
  type: 'file';
  content: '';
  url: string;
  filename: string;
  size: number;
  mimeType: string;
}

export interface BookmarkBlock extends BaseBlock {
  type: 'bookmark';
  content: '';
  url: string;
  title?: string;
  description?: string;
  image?: string;
}

export interface EmbedBlock extends BaseBlock {
  type: 'embed';
  content: '';
  url: string;
  provider: 'codepen' | 'figma' | 'google_drive' | 'google_maps' | 'twitter' | 'github' | 'other';
  title?: string;
}

// Advanced blocks
export interface SyncedBlock extends BaseBlock {
  type: 'synced_block';
  content: '';
  originalBlockId: string;
  isOriginal: boolean;
}

export interface TemplateButtonBlock extends BaseBlock {
  type: 'template_button';
  content: string;
  templateBlocks: Block[];
}

export interface BreadcrumbBlock extends BaseBlock {
  type: 'breadcrumb';
  content: '';
  path: BreadcrumbItem[];
}

export interface BreadcrumbItem {
  id: string;
  title: string;
  type: 'workspace' | 'folder' | 'file';
}

export interface EquationBlock extends BaseBlock {
  type: 'equation';
  content: string;
  latex: string;
}

// Union type for all blocks
export type Block = 
  | ParagraphBlock
  | HeadingBlock
  | ListBlock
  | TodoBlock
  | ToggleBlock
  | QuoteBlock
  | CodeBlock
  | CalloutBlock
  | DividerBlock
  | TableOfContentsBlock
  | PageBlock
  | DatabaseBlock
  | ImageBlock
  | VideoBlock
  | AudioBlock
  | FileBlock
  | BookmarkBlock
  | EmbedBlock
  | SyncedBlock
  | TemplateButtonBlock
  | BreadcrumbBlock
  | EquationBlock;

// Editor state
export interface NotionEditorState {
  blocks: Block[];
  selectedBlockId: string | null;
  focusedBlockId: string | null;
  isComposing: boolean;
  lastModified: string;
}

// Block actions
export interface BlockAction {
  type: 'create' | 'update' | 'delete' | 'move' | 'duplicate';
  blockId: string;
  data?: Partial<Block>;
  newIndex?: number;
}

// Command palette
export interface CommandItem {
  id: string;
  title: string;
  description: string;
  icon: string;
  keywords: string[];
  action: () => void;
  category: 'text' | 'media' | 'database' | 'advanced' | 'layout';
}

// Database view types
export type DatabaseViewType = 'table' | 'board' | 'gallery' | 'list' | 'calendar' | 'timeline' | 'chart';

export interface DatabaseView {
  id: string;
  name: string;
  type: DatabaseViewType;
  properties: string[];
  filters?: DatabaseFilter[];
  sorts?: DatabaseSort[];
  groupBy?: string;
}

export interface DatabaseFilter {
  property: string;
  operator: 'equals' | 'not_equals' | 'contains' | 'does_not_contain' | 'starts_with' | 'ends_with' | 'is_empty' | 'is_not_empty' | 'greater_than' | 'less_than' | 'greater_than_or_equal_to' | 'less_than_or_equal_to';
  value: any;
}

export interface DatabaseSort {
  property: string;
  direction: 'ascending' | 'descending';
}

// Chart types
export type ChartType = 'vertical_bar' | 'horizontal_bar' | 'line' | 'donut';

export interface ChartConfig {
  type: ChartType;
  xAxis: string;
  yAxis: string;
  groupBy?: string;
  colors?: string[];
}
