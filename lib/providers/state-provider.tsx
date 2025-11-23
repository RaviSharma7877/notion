'use client';

import React, {
  Dispatch,
  createContext,
  useContext,
  useEffect,
  useMemo,
  useReducer,
} from 'react';
import { usePathname } from 'next/navigation';
import type { FileDto, FolderDto, WorkspaceDto } from '@/lib/queries';
import { listFiles } from '@/lib/queries';

type AppFile = FileDto & { createdAt?: string | null };
export type appFoldersType = (FolderDto & { createdAt?: string | null }) & {
  files: AppFile[];
};
export type appWorkspacesType = (WorkspaceDto & { createdAt?: string | null }) & {
  folders: appFoldersType[];
};

interface AppState {
  workspaces: appWorkspacesType[] | [];
}

type Action =
  | { type: 'ADD_WORKSPACE'; payload: appWorkspacesType }
  | { type: 'DELETE_WORKSPACE'; payload: string }
  | {
      type: 'UPDATE_WORKSPACE';
      payload: { workspace: Partial<appWorkspacesType>; workspaceId: string };
    }
  | {
      type: 'SET_WORKSPACES';
      payload: { workspaces: appWorkspacesType[] | [] };
    }
  | {
      type: 'SET_FOLDERS';
      payload: { workspaceId: string; folders: [] | appFoldersType[] };
    }
  | {
      type: 'ADD_FOLDER';
      payload: { workspaceId: string; folder: appFoldersType };
    }
  | {
      type: 'ADD_FILE';
      payload: { workspaceId: string; file: AppFile; folderId: string };
    }
  | {
      type: 'DELETE_FILE';
      payload: { workspaceId: string; folderId: string; fileId: string };
    }
  | {
      type: 'DELETE_FOLDER';
      payload: { workspaceId: string; folderId: string };
    }
  | {
      type: 'SET_FILES';
      payload: { workspaceId: string; files: AppFile[]; folderId: string };
    }
  | {
      type: 'UPDATE_FOLDER';
      payload: {
        folder: Partial<appFoldersType>;
        workspaceId: string;
        folderId: string;
      };
    }
  | {
      type: 'UPDATE_FILE';
      payload: {
        file: Partial<AppFile>;
        folderId: string;
        workspaceId: string;
        fileId: string;
      };
    };

const initialState: AppState = { workspaces: [] };

const getTime = (value?: string | null) =>
  value ? new Date(value).getTime() : 0;

const appReducer = (
  state: AppState = initialState,
  action: Action
): AppState => {
  switch (action.type) {
    case 'ADD_WORKSPACE':
      return {
        ...state,
        workspaces: [
          ...state.workspaces,
          { ...action.payload, folders: action.payload.folders ?? [] },
        ],
      };
    case 'DELETE_WORKSPACE':
      return {
        ...state,
        workspaces: state.workspaces.filter(
          (workspace) => workspace.id !== action.payload
        ),
      };
    case 'UPDATE_WORKSPACE':
      return {
        ...state,
        workspaces: state.workspaces.map((workspace) => {
          if (workspace.id === action.payload.workspaceId) {
            return {
              ...workspace,
              ...action.payload.workspace,
            };
          }
          return workspace;
        }),
      };
    case 'SET_WORKSPACES':
      return {
        ...state,
        workspaces: action.payload.workspaces.map((workspace) => ({
          ...workspace,
          folders: workspace.folders ?? [],
        })),
      };
    case 'SET_FOLDERS':
      return {
        ...state,
        workspaces: state.workspaces.map((workspace) => {
          if (workspace.id === action.payload.workspaceId) {
            return {
              ...workspace,
              folders: (action.payload.folders ?? []).sort(
                (a, b) => getTime(a.createdAt) - getTime(b.createdAt)
              ),
            };
          }
          return workspace;
        }),
      };
    case 'ADD_FOLDER':
      return {
        ...state,
        workspaces: state.workspaces.map((workspace) => {
          return {
            ...workspace,
            folders: [...(workspace.folders ?? []), action.payload.folder].sort(
              (a, b) => getTime(a.createdAt) - getTime(b.createdAt)
            ),
          };
        }),
      };
    case 'UPDATE_FOLDER':
      return {
        ...state,
        workspaces: state.workspaces.map((workspace) => {
          if (workspace.id === action.payload.workspaceId) {
            return {
              ...workspace,
              folders: workspace.folders.map((folder) => {
                if (folder.id === action.payload.folderId) {
                  return { ...folder, ...action.payload.folder };
                }
                return folder;
              }),
            };
          }
          return workspace;
        }),
      };
    case 'DELETE_FOLDER':
      return {
        ...state,
        workspaces: state.workspaces.map((workspace) => {
          if (workspace.id === action.payload.workspaceId) {
            return {
              ...workspace,
              folders: (workspace.folders ?? []).filter(
                (folder) => folder.id !== action.payload.folderId
              ),
            };
          }
          return workspace;
        }),
      };
    case 'SET_FILES':
      return {
        ...state,
        workspaces: state.workspaces.map((workspace) => {
          if (workspace.id === action.payload.workspaceId) {
            return {
              ...workspace,
              folders: (workspace.folders ?? []).map((folder) => {
                if (folder.id === action.payload.folderId) {
                  return {
                    ...folder,
                    files: action.payload.files,
                  };
                }
                return folder;
              }),
            };
          }
          return workspace;
        }),
      };
    case 'ADD_FILE':
      return {
        ...state,
        workspaces: state.workspaces.map((workspace) => {
          if (workspace.id === action.payload.workspaceId) {
            return {
              ...workspace,
              folders: (workspace.folders ?? []).map((folder) => {
                if (folder.id === action.payload.folderId) {
                  return {
                    ...folder,
                    files: [...(folder.files ?? []), action.payload.file].sort(
                      (a, b) => getTime(a.createdAt) - getTime(b.createdAt)
                    ),
                  };
                }
                return folder;
              }),
            };
          }
          return workspace;
        }),
      };
    case 'DELETE_FILE':
      return {
        ...state,
        workspaces: state.workspaces.map((workspace) => {
          if (workspace.id === action.payload.workspaceId) {
            return {
              ...workspace,
              folders: (workspace.folders ?? []).map((folder) => {
                if (folder.id === action.payload.folderId) {
                  return {
                    ...folder,
                    files: (folder.files ?? []).filter(
                      (file) => file.id !== action.payload.fileId
                    ),
                  };
                }
                return folder;
              }),
            };
          }
          return workspace;
        }),
      };
    case 'UPDATE_FILE':
      return {
        ...state,
        workspaces: state.workspaces.map((workspace) => {
          if (workspace.id === action.payload.workspaceId) {
            return {
              ...workspace,
              folders: (workspace.folders ?? []).map((folder) => {
                if (folder.id === action.payload.folderId) {
                  return {
                    ...folder,
                    files: (folder.files ?? []).map((file) => {
                      if (file.id === action.payload.fileId) {
                        return {
                          ...file,
                          ...action.payload.file,
                        };
                      }
                      return file;
                    }),
                  };
                }
                return folder;
              }),
            };
          }
          return workspace;
        }),
      };
    default:
      return initialState;
  }
};

const AppStateContext = createContext<
  | {
      state: AppState;
      dispatch: Dispatch<Action>;
      workspaceId: string | undefined;
      folderId: string | undefined;
      fileId: string | undefined;
    }
  | undefined
>(undefined);

interface AppStateProviderProps {
  children: React.ReactNode;
}

const AppStateProvider: React.FC<AppStateProviderProps> = ({ children }) => {
  const [state, dispatch] = useReducer(appReducer, initialState);
  const pathname = usePathname();

  const workspaceId = useMemo(() => {
    const urlSegments = pathname?.split('/').filter(Boolean);
    if (urlSegments)
      if (urlSegments.length > 1) {
        return urlSegments[1];
      }
  }, [pathname]);

  const folderId = useMemo(() => {
    const urlSegments = pathname?.split('/').filter(Boolean);
    if (urlSegments)
      if (urlSegments?.length > 2) {
        return urlSegments[2];
      }
  }, [pathname]);

  const fileId = useMemo(() => {
    const urlSegments = pathname?.split('/').filter(Boolean);
    if (urlSegments)
      if (urlSegments?.length > 3) {
        return urlSegments[3];
      }
  }, [pathname]);

  useEffect(() => {
    if (!folderId || !workspaceId) return;
    const fetchFiles = async () => {
      try {
        const response = await listFiles({ folderId, workspaceId, size: 100 });
        const files = response.content ?? [];
        dispatch({
          type: 'SET_FILES',
          payload: { workspaceId, files, folderId },
        });
      } catch (error) {
        console.error('Failed to fetch files', error);
      }
    };
    fetchFiles();
  }, [folderId, workspaceId]);

  useEffect(() => {
    console.log('App State Changed', state);
  }, [state]);

  return (
    <AppStateContext.Provider
      value={{ state, dispatch, workspaceId, folderId, fileId }}
    >
      {children}
    </AppStateContext.Provider>
  );
};

export default AppStateProvider;

export const useAppState = () => {
  const context = useContext(AppStateContext);
  if (!context) {
    throw new Error('useAppState must be used within an AppStateProvider');
  }
  return context;
};
