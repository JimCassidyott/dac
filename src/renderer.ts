// This file is required by the index.html file and will
// be executed in the renderer process for that window.
// No Node.js APIs are available in this process unless
// nodeIntegration is set to true in webPreferences.
// Use preload.js to selectively enable features
// needed in the renderer process.

function generateFileTree(entries: any, path: string) {
  let html = '<ul>';
  for (const entry of entries) {
    let currPath = path == "./" ? path + entry.name : path + "/" + entry.name;
    if (entry.isAccessible == true) {
      html += `<li> <i class="fas fa-check-circle text-success fa-xs"></i> <i class="fas fa-file text-primary" data-curr-type="file" data-curr-path="${currPath}"></i> ${entry.name}</li>`;
    }
    else {
      html += `<li> <i class="fas fa-times-circle text-danger fa-xs"></i> <i class="fas fa-file text-primary" data-curr-type="file" data-curr-path="${currPath}"></i> ${entry.name}</li>`;
    }
  }
  html += '</ul>';

  return html;
}

function generateFolderTree(entries: any, path: string) {
  let html = '<ul>';
  for (const entry of entries) {
    let currPath = path == "./" ? path + entry.name : path + "/" + entry.name;

    html += `<li><i class="fas fa-folder text-warning folder" data-curr-type="folder" data-curr-path="${currPath}" onclick="toggleFolder(this)"></i> ${entry.name}`;
    html += `<ul class="nested">`;
    html += `</ul></li>`;
  }
  html += '</ul>';
  return html;
}

async function toggleFolder(icon: any) {
  icon.classList.toggle("fa-folder");
  icon.classList.toggle("fa-folder-open");
  let nestedList = icon.nextElementSibling;
  let content = await window.electronAPI.getFolderContent(icon.dataset.currPath);  
  nestedList.innerHTML = generateFileTree(content.files, content.name);
  nestedList.innerHTML += generateFolderTree(content.folders, content.name);
  if (nestedList) {
    nestedList.classList.toggle("active");
  }
}

async function ShowFolderContents() {
  let content = await window.electronAPI.getFolderContent("./");  
  document.getElementById('file-explorer').innerHTML = generateFileTree(content.files, content.name);
  document.getElementById('file-explorer').innerHTML += generateFolderTree(content.folders, content.name);
}

window.addEventListener('contextmenu', (event: MouseEvent) => {
  event.preventDefault(); // Prevent the default context menu from appearing

  const clickedElement = document.elementFromPoint(event.clientX, event.clientY);
  
  if (clickedElement && clickedElement instanceof HTMLElement) {
    // console.log('Right-clicked element:', clickedElement);
    window.electron.ipcRenderer.send('show-context-menu', { 
      type: clickedElement.dataset.currType,
      path: clickedElement.dataset.currPath
    });
  }
  else {
    window.electron.ipcRenderer.send('show-context-menu', { type: "other" });
  }
});

window.electronAPI.receive('context-menu-action', (data) => {
  if (data.action == "change-accessibility-status") {
    receiveChangeAccessibilityStatus(data);
  }
  else if (data.action == "get-report") {
    receiveGetReport(data);
    
  }
});

function receiveChangeAccessibilityStatus(data: any) {
  if (!data.path || data.path == "") { 
    new window.Notification("Error", {body: "Something went wrong while updating accessibility status"});
    return; 
  }
  let element = document.querySelector(`i[data-curr-path="${data.path}"`);
  if (element) {
    let prevElement = element.previousElementSibling;
    if (prevElement && prevElement.tagName == 'I') {
      if (data.accStatus == "true") {
        prevElement.className = "fas fa-check-circle text-success fa-xs";

      }
      else {
        prevElement.className = "fas fa-times-circle text-danger fa-xs";
      }
    }
  }
}

function receiveGetReport(data: any) {
  // show report
  let rightPanel = document.getElementById("right-panel");
  let HTMLReport = `
  <h2>Accessibility report for ${data.path}</h2>
  <table id="accessibility-report" class="table">
    <tbody>
      <tr>
        <th>Total Documents:</th>
        <td>${data.report.numFiles}</td>
      </tr>
      <tr>
        <th>Number of Accessible Documents:</th>
        <td>${data.report.numAccessibleFiles}</td>
      </tr>
      <tr>
        <th>Number of Inaccessible Documents:</th>
        <td>${data.report.numFiles - data.report.numAccessibleFiles}</td>
      </tr>
    </tbody>
  </table>`;

  rightPanel.innerHTML = HTMLReport;
}

ShowFolderContents();