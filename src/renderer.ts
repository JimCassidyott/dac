// This file is required by the index.html file and will
// be executed in the renderer process for that window.
// No Node.js APIs are available in this process unless
// nodeIntegration is set to true in webPreferences.
// Use preload.js to selectively enable features
// needed in the renderer process.
// const { Chart } = await import('chart.js');


function generateFileTree(entries: any, path: string) {
  let html = '<ul>';
  for (const entry of entries) {
    let currPath = path == "./" ? path + entry.name : path + "/" + entry.name;
    if (entry.isAccessible == true) {
      html += `<li> <i class="fas fa-check-circle text-success fa-xs"></i> <i class="fas fa-file text-primary" data-curr-type="file" data-curr-path="${currPath}" onclick="showAccStatus(this)"></i> ${entry.name}</li>`;
    }
    else {
      html += `<li> <i class="fas fa-times-circle text-danger fa-xs"></i> <i class="fas fa-file text-primary" data-curr-type="file" data-curr-path="${currPath}" onclick="showAccStatus(this)"></i> ${entry.name}</li>`;
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

async function showAccStatus(elem: any) {
  let prevElement = elem.previousElementSibling;
  let rightPanel = document.getElementById("right-panel");
  let fullPath = elem.dataset.currPath;
  let fileName = fullPath.split('/').pop();
  let HTMLReport = `
  <h2>${fileName}</h2>
  `
  if (prevElement && prevElement.tagName == 'I') {
    if (prevElement.classList.contains("fa-check-circle")) {
      HTMLReport += `
      <table id="accessibility-report" class="table">
        <tbody>
          <tr>
            <th>Accessibility status:</th>
            <td>Accessible</td>
          </tr>
        </tbody>
      </table>`;
    }
    else {
      HTMLReport += `
      <table id="accessibility-report" class="table">
        <tbody>
          <tr>
            <th>Accessibility status:</th>
            <td>Not accessible</td>
          </tr>
        </tbody>
      </table>`;      
    }
    rightPanel.innerHTML = HTMLReport;
  }
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
  else if (data.action == "run-accessibility-test") {
    recieveTestResults(data);
  }
  else if (data.action == "run-folder-accessibility-test") {
    recieveFolderTestResults(data);
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
  // TODO: Use walker and get report for file in subfolders as well
  // show report
  const folderName = data.path.split('/').pop()  || data.path;
  let rightPanel = document.getElementById("right-panel");
  let numInAccessibleFiles = data.report.numFiles - data.report.numAccessibleFiles;
  let accessiblePercentage = (data.report.numAccessibleFiles / data.report.numFiles) * 100;
  // Check for NaN, undefined, or division by zero and round to 1 decimal point
  if (!isFinite(accessiblePercentage)) {
      accessiblePercentage = 0;
  } else {
      accessiblePercentage = Math.round(accessiblePercentage * 10) / 10;
  }
  let HTMLReport = `
  <h2>Accessibility report for ${folderName}</h2>
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
        <td>${numInAccessibleFiles}</td>
      </tr>
      <tr>
        <th>File Accessibility Rate:</th>
        <td>${accessiblePercentage}%</td>
      </tr>   
    </tbody>
  </table>
  </br>
  <div class="container">
    <div class="row justify-content-center">
      <canvas id="pieChart" class="pieChartCanvas" width="400" height="400"></canvas>
    </div>
  </div>`;

  rightPanel.innerHTML = HTMLReport;
  function loadChart() {
    const ctx = document.getElementById('pieChart') as HTMLCanvasElement;
    // Check if Chart.js is available (loaded from the <script> tag)
    if (window['Chart']) {
      // Initialize the chart
      const myChart = new window['Chart'](ctx, {
        type: 'pie', 
        data: {
          labels: ['Accessible', 'Not Accessible'],
          datasets: [{
            label: `Number of documents`,
            data: [data.report.numAccessibleFiles, numInAccessibleFiles],
            backgroundColor: [
              'rgb(54, 162, 235)',
              'rgb(255, 99, 132)'
            ],
            hoverOffset: 4
          }]
        }
      });
    } else {
      console.error('Chart.js is not loaded');
    }
  }
  loadChart();
}

function recieveTestResults(data: any) {
  if (!data.path || data.path == "") { 
    new window.Notification("Error", {body: "Something went wrong while updating accessibility status"});
    return; 
  }
  let rightPanel = document.getElementById("right-panel");
  let HTMLReport = `<h2>Accessibility test result for ${data.path.split('/').pop()}</h2>`;
  if (data.testStatus == "error") {
    HTMLReport += `
        <p>Accessibility test incomplete. Tester gave the error: ${data.accStatus}</p>
        <p>Please contact application developers for more infomation.</p>`;
  }
  else {
    receiveChangeAccessibilityStatus(data);
    HTMLReport += `
      <table id="accessibility-report" class="table">
        <tbody>
          <tr>
            <th>Accessibility Test status:</th>
            <td>Completed</td>
          </tr>
          <tr>
            <th>Document accessibility status:</th>
            <td>${data.accStatus}</td>
          </tr>
        </tbody>
      </table>`;
  }
  rightPanel.innerHTML = HTMLReport;
}

function recieveFolderTestResults(data: any) {
  if (!data.path || data.path == "") { 
    new window.Notification("Error", {body: "Something went wrong while updating accessibility status"});
    return; 
  }
  let rightPanel = document.getElementById("right-panel");
  let HTMLReport = `<h2>Accessibility test result for ${data.path.split('/').pop()}</h2>`;
  if (data.testStatus == "noDocuments") {
    HTMLReport += `<p>No documents were found in this folder or any sub-folders</p>`;
  }
  else {
    // TODO: traverse the list of file paths and search the frontend for those paths
    // if they exist update the accessibility icon. 
    HTMLReport += `
    <table class="table">
      <tr>
        <th>Filename</th>
        <th>Accessibility Test status:</th>
        <th>Document accessibility status:</th>
      </tr>`;
    for (let doc = 0; doc < data.results.length; doc++) {
      HTMLReport += `
        <tr>
          <td>${data.results[doc].path}</td>
          <td>${data.results[doc].success ? 'Completed' : 'Error'}</td>
          <td>${data.results[doc].path}</td>
        </tr>`;
    }
    HTMLReport += `</table>`;
  }
  rightPanel.innerHTML = HTMLReport;
}

ShowFolderContents();