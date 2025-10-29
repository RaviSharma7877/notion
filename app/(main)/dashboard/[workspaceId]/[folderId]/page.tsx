export const dynamic = 'force-dynamic';

import React from 'react';
import QuillEditor from '@/components/quill-editor/quill-editor';
import { listFolders, type FolderDto } from '@/lib/queries';

interface FolderPageProps {
  params: Promise<{ workspaceId: string; folderId: string }> | { workspaceId: string; folderId: string };
}

const Folder = async ({ params }: FolderPageProps) => {
  const { workspaceId, folderId } = await Promise.resolve(params);
  let folder: FolderDto | null = null;
  try {
    const page = await listFolders({ workspaceId, size: 100 });
    folder = page.content.find((item) => item.id === folderId) ?? null;
  } catch (error) {
    console.error('Failed to load folder', error);
  }
  if (!folder) {
    folder = {
      id: folderId,
      title: 'Untitled',
      iconId: '📁',
      data: null,
      inTrash: false,
      bannerUrl: null,
      workspaceId,
    };
  }

  return (
    <div className="relative ">
      <QuillEditor
        dirType="folder"
        fileId={folderId}
        dirDetails={folder!}
      />
    </div>
  );
};

export default Folder;
