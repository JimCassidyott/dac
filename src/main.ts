import { app, BrowserWindow, ipcMain, IpcMainInvokeEvent, Menu, MenuItem } from "electron";
import * as path from "path";
import { SystemAdapter } from './components/systemAdaptor';
import { IFolderContents } from "./Interfaces/iFolderContents";
import { IFile } from "./Interfaces/iFile";
import { changeIsAccessibleProperty, isAccessible } from "./components/accessibilityChecker";

const systemAdaptor = new SystemAdapter();

function filterDocxFiles(contents: IFile[]): IFile[] {
  return contents.filter(file => file.name.toLowerCase().endsWith('.docx'));
}

async function markFilesAccessibility(contents: IFile[], path: string): Promise<IFile[]> {
  const markedFiles: IFile[] = [];
  for (const file of contents) {     
    let adjustedPath = path == './' ? (path + file.name) : (path + "/" + file.name);
    file.isAccessible = await isAccessible(adjustedPath);
    markedFiles.push(file);
  }

  return markedFiles;
}

async function handleGetContent (event: IpcMainInvokeEvent, path: string) {  
  try {
    let content  = await systemAdaptor.getFolderContents(path);
    let filteredContent: IFolderContents = content[0];
    filteredContent.files = filterDocxFiles(filteredContent.files);
    filteredContent.files = await markFilesAccessibility(filteredContent.files, path);

    return filteredContent;

  } catch (err) {
      console.error(`Error getting contents of folder at path ${path}:`, err);
      throw err; // Re-throw the error to handle it further up the call stack if needed
  }
}

function createWindow() {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
    },
    width: 800,
  });

  // and load the index.html of the app.
  mainWindow.loadFile(path.join(__dirname, "../index.html"));

  ipcMain.on('show-context-menu', (event, arg) => {
    if (arg.type == "file" || arg.type == "folder"){
      const contextMenu = Menu.buildFromTemplate([
        {
          label: 'Get Report',
          click: () => {
            console.log('Right clicked on element:', arg.elementId);
          },
        },
      ]);  
      contextMenu.popup({
        window: mainWindow!,
      });
    }

  });
  // Open the DevTools.
  mainWindow.webContents.openDevTools();
}



// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  ipcMain.handle('fs:getFolderContent', handleGetContent);
  createWindow();

  app.on("activate", function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

// In this file you can include the rest of your app"s specific main process
// code. You can also put them in separate files and require them here.
