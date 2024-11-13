import { app, BrowserWindow, dialog, ipcMain, IpcMainInvokeEvent, Menu, MenuItem, MenuItemConstructorOptions, Notification } from "electron";
import * as pathModule from "path";
import { SystemAdapter } from './components/systemAdaptor';
import { IFolderContents } from "./Interfaces/iFolderContents";
import { IFile } from "./Interfaces/iFile";
import { changeIsAccessibleProperty, isAccessible, testAccessiblity } from "./components/accessibilityChecker";
import ProgressBar = require('electron-progressbar');
import { listDocxFiles } from './directory';
import { GCDocsAdapter } from './components/GCDocsAdaptor';

function createWindow() {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    height: 600,
    webPreferences: {
      preload: pathModule.join(__dirname, "preload.js"),
    },
    width: 800,
  });

  // and load the index.html of the app.
  mainWindow.loadFile(pathModule.join(__dirname, "../index.html"));

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
              let progressBar = createProgressBar(`Test documents in ${arg.path.split('/').pop()  || arg.path}`, 
              'Calculating number of documents...');
              let res = await testFolder(arg.path, progressBar);
              if (res.numfiles == 0) {
                mainWindow.webContents.send("context-menu-action", {
                  action: 'run-folder-accessibility-test',
                  path: arg.path,
                  testStatus: "noDocuments"
                });
              }
              else {
                mainWindow.webContents.send("context-menu-action", {
                  action: 'run-folder-accessibility-test',
                  path: arg.path,
                  testStatus: "completed",
                  results: res.results
                });
              }
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
              let ProgressBarText = `Test document ${arg.path.split('/').pop()  || arg.path}`;
              let progressBarDetail = 'Testing...';
              let progressBar = createProgressBar(ProgressBarText, progressBarDetail);
              try {
                let result = await testFile(arg.path);
                updateProgressBarValue(progressBar, 100);
                mainWindow.webContents.send("context-menu-action", { 
                  action: 'run-accessibility-test', 
                  path: arg.path, 
                  testStatus: "completed", 
                  accStatus: result.toString() 
                });
              } catch (error) {
                // Handle the error here
                console.error('Error in accessibility test:', error.message);
                updateProgressBarValue(progressBar, 100);
                new Notification({
                  title: "Error",
                  body: `Failed to run accessibility test: ${error.message}`
                }).show();
              
                mainWindow.webContents.send("context-menu-action", { 
                  action: 'run-accessibility-test', 
                  path: arg.path, 
                  testStatus: "error", 
                  accStatus: `Error: ${error.message}`
                });
              }
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

  const topMenuTemplate: MenuItemConstructorOptions[] = [
    {
      label: 'File',
      submenu: [
        {
          label: 'Open System Folder',
          accelerator: 'CmdOrCtrl+O',
          click: async () => {
            // Show the open folder dialog
            const { canceled, filePaths } = await dialog.showOpenDialog({
              properties: ['openDirectory']
            });
  
            // If the user did not cancel and selected a folder
            if (!canceled && filePaths.length > 0) {
              fileSource = 'SYSTEM'; 
              const selectedFolderPath = filePaths[0];
              let folderContent = await handleGetContent(null, selectedFolderPath);
              mainWindow.webContents.send("top-menu-action", {
                action: 'open-folder',
                content: folderContent
              });
            }
          }
        },
        {
          label: 'Connet to GCDocs',
          accelerator: 'CmdOrCtrl+G',
          click: async () => {
            fileSource = 'GCDOCS';
            let folderContent = await handleGetContent(null, '6345941'); // temp starting point 6345941 
            mainWindow.webContents.send("top-menu-action", {
              action: 'open-folder',
              content: folderContent
            });
          }
        },
        { type: 'separator' },
        {
          label: 'Quit',
          accelerator: 'CmdOrCtrl+Q',
          click: () => {
            app.quit();
          }
        }
      ]
    },
    {
      label: 'View',
      submenu: [
        {
          label: 'Reload Page',
          accelerator: 'CmdOrCtrl+R',
          click: () => {
            if (mainWindow) mainWindow.reload();
          }
        },
        {
          label: 'Toggle Developer Tools',
          accelerator: 'CmdOrCtrl+Shift+I',
          click: () => {
            if (mainWindow) mainWindow.webContents.toggleDevTools();
          }
        }
      ]
    }
  ];

  const topMenu = Menu.buildFromTemplate(topMenuTemplate);
  Menu.setApplicationMenu(topMenu);

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

let fileSource = 'SYSTEM';

async function getFileSystemAdapter(){
  if (fileSource === 'SYSTEM') {
    return new SystemAdapter();
  }
  else if (fileSource === 'GCDOCS') {
    return new GCDocsAdapter();
  }
  else {
    throw new Error('Invalid file source');
  }
}

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
    let normalizedPath = pathModule.normalize(path).replace(/\\/g, '/');
    let adaptor = await getFileSystemAdapter();
    let content  = await adaptor.getFolderContents(normalizedPath);
    let filteredContent: IFolderContents = content[0];
    filteredContent.files = filterDocxFiles(filteredContent.files);
    filteredContent.files = await markFilesAccessibility(filteredContent.files, normalizedPath);

    return filteredContent;

  } catch (err) {
      console.error(`Error getting contents of folder at path ${path}:`, err);
      throw err; // Re-throw the error to handle it further up the call stack if needed
  }
}

async function handleGetReport(path: string) {
  try{
    let documents = listDocxFiles(path);
    let report = {
      path: path,
      numFiles: 0, 
      numAccessibleFiles: 0,
      files: [] as IFile[]
    };
    let documentList: IFile[] = await Promise.all(
      documents.map(async (filePath) => { // Create IFile objects with name, path, and fileCount initialized to 0
        return {
          name: filePath.split('/').pop() || filePath, // Name of the file
          path: filePath, // Path of the file
          size: "0", // Size in bytes or megabytes
          mimeType: "", // MIME type of the file, optional
          isAccessible: await isAccessible(filePath), // Accessibility property
          customProperties: {} // Custom properties
        };
      })
    );
      report.numFiles = documentList.length;
      report.numAccessibleFiles = documentList.filter(doc => doc.isAccessible).length;
      report.files = documentList;
  
    return report;
  } catch (err) {
      console.error(`Error getting contents of folder at path ${path}:`, err);
      throw err; // Re-throw the error to handle it further up the call stack if needed
  }
}

async function testFile(path: string): Promise<boolean> {
  try {
    const fileIsAccessible = await testAccessiblity(path); 
    changeIsAccessibleProperty(path, fileIsAccessible === true);
    return fileIsAccessible; 
  } catch (error) {
    // Rethrow the error to be handled by the calling code
    throw new Error(`Accessibility test failed: ${error.message || error}`);
  }
}

async function testFolder(path: string, progressBar: ProgressBar) {
  let documents = listDocxFiles(path);
  let testResults = {
    numfiles: documents.length,
    results: [] as { path: string; success: boolean; passed: boolean | null }[]
  };
  if (documents.length == 0) {
    updateProgressBarValue(progressBar, 100);
    return testResults;
  }
  for (let i = 0; i < documents.length; i++) {
    progressBar.detail = `Testing file ${i+1} out of ${documents.length}...`;
    updateProgressBarValue(progressBar, ((1/documents.length) * 100));
    let normalizedPath = pathModule.normalize(documents[i]).replace(/\\/g, '/');
    try{
      let accessibilityStatus = await testFile(documents[i]);
      testResults.results.push({
        path: normalizedPath,
        success: true,  // The test ran successfully
        passed: accessibilityStatus  // Assuming testFile returns true if passed
      });
      
    }
    catch(error){
      console.log(error);
      testResults.results.push({
        path: normalizedPath,
        success: false,  // The test failed to run
        passed: false  // Indicate that the test result is unknown due to failure
      });
    }
  }
  updateProgressBarValue(progressBar, 100);
  return testResults;
}

function createProgressBar(textStr: string, detailStr: string): ProgressBar {
  let progressBar = new ProgressBar({
    title: 'Accessibility Test',
    text: textStr,
    detail: detailStr,
    indeterminate: false,
    browserWindow: {
      webPreferences: {
        nodeIntegration: true,  // Allows Node.js modules
        contextIsolation: false  // Ensures compatibility with older Electron versions
      }
    }
  });
  progressBar
    .on('completed', () => {
      progressBar.detail = 'Test completed!';
    })
    .on('aborted', () => {
      console.log('Progress bar aborted');
    });
  return progressBar
}

function updateProgressBarValue(progressBar: ProgressBar, increment: number) {
  progressBar.value += increment;
}