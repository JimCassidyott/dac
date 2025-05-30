import { app, BrowserWindow, dialog, ipcMain, IpcMainInvokeEvent, Menu, MenuItem, MenuItemConstructorOptions, Notification } from "electron";
import * as pathModule from "path";
import { SystemAdapter } from './components/systemAdaptor';
import { IFolderContents } from "./Interfaces/IFolderContents";
import { IFile } from "./Interfaces/IFile";
import { testAccessiblity } from "./components/MSWordAccessibilityChecker";
import ProgressBar = require('electron-progressbar');
import { GCDocsAdapter } from './components/GCDocsAdaptor';
import { isWordDOC, isPDFDoc, isPPTXDoc, AccessibilityStatus, getHTMLReportPath } from './components/helpers';
import * as PDFProperties from './components/PDFProperties';
import * as fs from 'fs';
import { MSOfficeMetadata } from './components/MSOfficeMetadata';
import { testPPTXAccessiblity } from './components/pptxAccessibilityChecker';
import { homedir } from 'os';

let __homedir = homedir();

let mainWindow: Electron.BrowserWindow = null;
function createWindow() {
  // Create the browser window.
  mainWindow = new BrowserWindow({
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
              mainWindow.webContents.send('context-menu-action', {
                action: "get-testing-file-type",
                path: arg.path,
              });              
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
              await MSOfficeMetadata.changeIsAccessibleProperty(arg.path, !(await MSOfficeMetadata.isAccessible(arg.path, fileSource) === AccessibilityStatus.Accessible));
              let nAccessibility = await MSOfficeMetadata.isAccessible(arg.path, fileSource);
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
                  accStatus: result.toString(),
                  resultPath: pathModule.join(__homedir, 'Downloads', 'DAC') 
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
            getGCdocsUrl();
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

  ipcMain.on('url-submitted', async (event, url) => {
    mainWindow.webContents.send("top-menu-action", {
      action: 'open-gcdocs-folder',
    });
    try{
      let nodeID = url.match(/objId=(\d+)/)[1];
      let folderContent = await handleGetContent(null, nodeID);
      mainWindow.webContents.send("top-menu-action", {
        action: 'open-folder',
        content: folderContent
      });
    }
    catch (err) {
      console.error(err);
      mainWindow.webContents.send("top-menu-action", {
        action: 'gcdocs-connection-error',
      });
    }
  });
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
app.on("window-all-closed", async () => {
  // clean up temp files downloaded from GCdocs
  const gcdocsAdapter = new GCDocsAdapter();
  await gcdocsAdapter.cleanUp(); 
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

async function markFilesAccessibility(contents: IFile[], path: string): Promise<IFile[]> {
  const markedFiles: IFile[] = [];
  for (const file of contents) {     
    let adjustedPath = path == './' ? (path + file.name) : (path + "/" + file.name);
    if(await isWordDOC(adjustedPath, fileSource)) {
      file.isAccessible = await MSOfficeMetadata.isAccessible(file.path, fileSource);
      markedFiles.push(file);
    }
    else if (await isPDFDoc(adjustedPath)) {
      file.isAccessible = await PDFProperties.isAccessible(file.path, fileSource);
      markedFiles.push(file);
    }
    else if (await isPPTXDoc(adjustedPath)) {
      file.isAccessible = await MSOfficeMetadata.isAccessible(file.path, fileSource);
      markedFiles.push(file);
    }
    else {
      file.isAccessible = AccessibilityStatus.NotApplicable;
      markedFiles.push(file);
      continue;
    }
  }

  return markedFiles;
}


async function handleGetContent (event: IpcMainInvokeEvent, path: string) {  
  try {
    let normalizedPath = pathModule.normalize(path).replace(/\\/g, '/');
    let adaptor = await getFileSystemAdapter();
    let content  = await adaptor.getFolderContents(normalizedPath);
    let filteredContent: IFolderContents = content;
    filteredContent.files = await markFilesAccessibility(filteredContent.files, normalizedPath);

    return filteredContent;

  } catch (err) {
      console.error(`Error getting contents of folder at path ${path}:`, err);
      throw err; // Re-throw the error to handle it further up the call stack if needed
  }
}

async function handleGetReport(path: string) {
  try{
    let adaptor = await getFileSystemAdapter();
    let wordDocuments = await adaptor.listDocxFiles(path);
    let pdfDocuments = await adaptor.listPDFFiles(path);
    let documents = [...wordDocuments, ...pdfDocuments];
    let report = {
      path: path,
      numFiles: 0, 
      numAccessibleFiles: 0,
      numUntested: 0,
      numManualTestingRequired: 0,
      files: [] as IFile[]
    };
    
    let documentList: IFile[] = await Promise.all(
      documents.map(async (filePath) => { // Create IFile objects with name, path, and fileCount initialized to 0
        let accessibilityStatus = AccessibilityStatus.Untested;
        if (await isWordDOC(filePath, fileSource)) {   
          accessibilityStatus = await MSOfficeMetadata.isAccessible(filePath, fileSource);   
        }
        else if (await isPDFDoc(filePath)) {   
          accessibilityStatus = await PDFProperties.isAccessible(filePath, fileSource);  
        }
        return {
          name: filePath.split('/').pop() || filePath, // Name of the file
          path: filePath, // Path of the file
          size: "0", // Size in bytes or megabytes
          mimeType: "", // MIME type of the file, optional
          isAccessible: accessibilityStatus, // Accessibility property
          customProperties: {} // Custom properties
        };
      })
    );
    report.numFiles = documentList.length;
    report.numAccessibleFiles = documentList.filter(doc => (doc.isAccessible === "Accessible")).length;
    report.numUntested = documentList.filter(doc => (doc.isAccessible === "Untested")).length;
    report.numManualTestingRequired = documentList.filter(doc => (doc.isAccessible === "Manual Testing Required")).length;
    report.files = documentList;
    return report;
  } catch (err) {
      console.error(`Error getting contents of folder at path ${path}:`, err);
      throw err; // Re-throw the error to handle it further up the call stack if needed
  }
}

async function testFile(path: string): Promise<AccessibilityStatus> {
  try {
    let fPath: string = "";
    let fIsAccessible: AccessibilityStatus = null;
    if (await isWordDOC(path, fileSource)) {
      const {filePath, fileIsAccessible} = await testAccessiblity(path, fileSource); 
      await MSOfficeMetadata.changeIsAccessibleProperty(filePath, fileIsAccessible === AccessibilityStatus.Accessible);
      fPath = filePath;
      fIsAccessible = fileIsAccessible;
    }
    else if (await isPDFDoc(path)) {
      const {filePath, fileIsAccessible} = await PDFProperties.testPDFAccessibility(path, fileSource); 
      fPath = filePath;
      fIsAccessible = fileIsAccessible;
    }
    else if (await isPPTXDoc(path)) {
      const {filePath, accessibilityStatus} = await testPPTXAccessiblity(path, fileSource);
      fPath = filePath;
      fIsAccessible = accessibilityStatus;
    }

    if (fileSource === "GCDOCS") {
      let gcdocsAdapter = new GCDocsAdapter();
      let res = await gcdocsAdapter.uploadDocumentContent(fPath, path);
      if (!res) {
        new Notification({
          title: "Error",
          body: `Failed to upload tested document to GCdocs`
        }).show();
      }
      fs.unlink(fPath, (err) => {
        if (err) throw (err);
        console.log(`Successfully deleted file: ${fPath}`);
      });
    }
    return fIsAccessible; 
  } catch (error) {
    // Rethrow the error to be handled by the calling code
    throw new Error(`Accessibility test failed: ${error.message || error}`);
  }
}

async function testFolder(path: string, progressBar: ProgressBar, fileTypes: string[]) {
  let adaptor = await getFileSystemAdapter();
  let testResults = {
    numfiles: 0,
    results: [] as { path: string; success: boolean; passed: AccessibilityStatus | null }[]
  };
  fileTypes.map(item => {
    console.log(item);
  });

  let documents: string[] = [];

  if (fileTypes.includes("word")) {
    let wordDocuments = await adaptor.listDocxFiles(path);
    documents.push(...wordDocuments);
  }

  if (fileTypes.includes("pdf")) {
    let pdfDocuments = await adaptor.listPDFFiles(path);
    documents.push(...pdfDocuments);
  }

  if (fileTypes.includes("powerpoint")) {
    let pdfDocuments = await adaptor.listPPTXFiles(path);
    documents.push(...pdfDocuments);
  }
  
  testResults.numfiles = documents.length;
  
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
        passed: accessibilityStatus  // accessibility status of the file as an AccessibilityStatus object
      });
      
    }
    catch(error){
      console.log(error);
      testResults.results.push({
        path: normalizedPath,
        success: false,  // The test failed to run
        passed: AccessibilityStatus.Untested  // Indicate that the test result is unknown due to failure
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

function getGCdocsUrl() {
  const inputWindow = new BrowserWindow({
    width: 600,
    height: 300,
    modal: true,
    parent: BrowserWindow.getFocusedWindow(),
    webPreferences: {
      preload: pathModule.join(__dirname, "preload.js"),
      contextIsolation: true, 
    },
  });

  inputWindow.loadFile(pathModule.join(__dirname, "../getGCdocsUrlDialog.html")); // Create an HTML file for the form
}

ipcMain.on('start-folder-accessibility-test', async (event, data: {path: string, selectedTypes: string[]}) => {
  const {path, selectedTypes} = data;

  console.log(path);

  let progressBar = createProgressBar(`Test documents in ${path.split('/').pop()  || path}`, 
  'Calculating number of documents...');
  let res = await testFolder(path, progressBar, selectedTypes);
  if (res.numfiles == 0) {
    mainWindow.webContents.send("context-menu-action", {
      action: 'run-folder-accessibility-test',
      path: path,
      testStatus: "noDocuments"
    });
  }
  else {
    mainWindow.webContents.send("context-menu-action", {
      action: 'run-folder-accessibility-test',
      path: path,
      testStatus: "completed",
      results: res.results,
      resultPath: pathModule.join(__homedir, 'Downloads', 'DAC')
    });
  }
});