export const dynamic = 'force-dynamic';

import React from 'react';
import NotionEditor from '@/components/notion-editor/notion-editor';
import { getFile, type FileDto } from '@/lib/queries';

interface FilePageProps {
  params:
    | Promise<{ workspaceId: string; folderId: string; fileId: string }>
    | { workspaceId: string; folderId: string; fileId: string };
}

const File = async ({ params }: FilePageProps) => {
  const { workspaceId, folderId, fileId } = await Promise.resolve(params);

  let file: FileDto | null = null;
  try {
    file = await getFile(fileId);
  } catch (error) {
    console.error('Failed to load file via getFile:', error);
  }

  // Fallback if not found / API error
  if (!file) {
    file = {
      id: fileId,
      title: 'Untitled',
      iconId: '📄',
      data: null,
      inTrash: false,
      bannerUrl: null,
      workspaceId,
      folderId,
    };
  }

  return (
    <div className="relative">
      <NotionEditor dirType="file" fileId={fileId} dirDetails={file} />
    </div>
  );
};

export default File;
