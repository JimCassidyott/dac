// All of the Node.js APIs are available in the preload process.
// It has the same sandbox as a Chrome extension.
import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  getFolderContent: (path: string) => ipcRenderer.invoke('fs:getFolderContent', path),
  receive: (channel: string, callback: (data: any) => void) => {
    ipcRenderer.on(channel, (event: IpcRendererEvent, data: any) => callback(data));
  }
});

window.addEventListener("DOMContentLoaded", () => {
  const replaceText = (selector: string, text: string) => {
    const element = document.getElementById(selector);
    if (element) {
      element.innerText = text;
    }
  };

  for (const type of ["chrome", "node", "electron"]) {
    replaceText(`${type}-version`, process.versions[type as keyof NodeJS.ProcessVersions]);
  }
});

contextBridge.exposeInMainWorld('electron', {
  ipcRenderer: ipcRenderer,
});

//Here you may have to add components and Apis that talk to the file system.
//For example, you can use the fs module to read the file system and display the contents in the renderer process.
//You can also use the ipcRenderer module to communicate between the main and renderer processes.
//You can also use the remote module to access the main process from the renderer process.
//You can also use the dialog module to display native system dialogs.
//You can also use the shell module to open external URLs.
