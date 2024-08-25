import { IFolderContents } from './Interfaces/iFolderContents';

export interface ElectronAPI {
  getFolderContent(path: string) : IFolderContents
}

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}