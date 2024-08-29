import { IFolderContents } from './Interfaces/iFolderContents';

export interface ElectronAPI {
  getFolderContent(path: string) : IFolderContents
}

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}

declare global {
  interface Window {
    electron: {
      ipcRenderer: import('electron').IpcRenderer;
    };
  }
}