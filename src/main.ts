import { app, BrowserWindow, ipcMain, IpcMainInvokeEvent, Menu, MenuItem } from "electron";
import * as path from "path";
import { SystemAdapter } from './components/systemAdaptor';
import { IFolderContents } from "./Interfaces/iFolderContents";
import { IFile } from "./Interfaces/iFile";
import { changeIsAccessibleProperty, isAccessible } from "./components/accessibilityChecker";

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
      const contextMenu = Menu.buildFromTemplate([]);
      if (arg.type == "folder") {
        let getReportMenuItem = new MenuItem(
          {
            label: 'Get Report',
            click: async () => {
              let report = await handleGetReport(arg.path);
              mainWindow.webContents.send('context-menu-action', {action: "get-report", path: arg.path, report: report});
            },
          },
        );
        let runAccessibilityTest = new MenuItem(
          {
            label: 'Run accessibility test',
            click: async () => {
            // call tester
            }
          }
        );
        contextMenu.append(getReportMenuItem);
        contextMenu.append(runAccessibilityTest);
      }
      else if (arg.type == "file") {
        let changeAccessibilityStatus = new MenuItem(
          {
            label: 'Change accessibility status',
            click: async () => {
              await changeIsAccessibleProperty(arg.path, !await isAccessible(arg.path));
              let nAccessibility = await isAccessible(arg.path);
              mainWindow.webContents.send('context-menu-action', {action: 'change-accessibility-status', path: arg.path, accStatus: nAccessibility.toString()});
            }
          }
        );
        let runAccessibilityTest = new MenuItem(
          {
            label: 'Run accessibility test',
            click: async () => {
              let result = await testFile(arg.path);
            }
          }
        );
        contextMenu.append(runAccessibilityTest);
        contextMenu.append(changeAccessibilityStatus);
      }    
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

async function handleGetReport(path: string) {
  try {
    let content  = await systemAdaptor.getFolderContents(path);
    let filteredContent: IFolderContents = content[0];
    let report = {
      path: path,
      numFiles: 0, 
      numAccessibleFiles: 0,
      files: [] as IFile[]
    };
    filteredContent.files = filterDocxFiles(filteredContent.files);
    filteredContent.files = await markFilesAccessibility(filteredContent.files, path);
    
    report.numFiles = filteredContent.files.length;
    report.numAccessibleFiles = filteredContent.files.filter(file => file.isAccessible).length;
    report.files = filteredContent.files;

    return report;

  } catch (err) {
      console.error(`Error getting contents of folder at path ${path}:`, err);
      throw err; // Re-throw the error to handle it further up the call stack if needed
  }
}

async function testFile(path: string) {
  // call tester 
}