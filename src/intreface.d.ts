import { Chart } from 'chart.js';
import { IFolderContents } from './Interfaces/iFolderContents';

export interface ElectronAPI {
  getFolderContent(path: string) : IFolderContents,
  receive: (channel: string, callback: (data: any) => void) => void;
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

declare global {
  interface Window {
    Chart: typeof Chart;
  }
}