export const dynamic = 'force-dynamic';

import React from 'react';
import FilePageClient from '@/components/notion-editor/file-page-client';

interface FilePageProps {
  params:
    | Promise<{ workspaceId: string; folderId: string; fileId: string }>
    | { workspaceId: string; folderId: string; fileId: string };
}

const File = async ({ params }: FilePageProps) => {
  const { workspaceId, folderId, fileId } = await Promise.resolve(params);
  return (
    <FilePageClient workspaceId={workspaceId} folderId={folderId} fileId={fileId} />
  );
};

export default File;
