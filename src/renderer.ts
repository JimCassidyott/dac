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
    if (entry.isAccessible == "Accessible") {
      html += `<li> <i class="fas fa-check-circle text-success fa-xs"></i> <i class="fas fa-file text-primary" data-curr-type="file" data-curr-path="${entry.path}" onclick="showAccStatus(this)"></i> ${entry.name}</li>`;
    }
    else  if (entry.isAccessible === "Not Accessible"){
      html += `<li> <i class="fas fa-times-circle text-danger fa-xs"></i> <i class="fas fa-file text-primary" data-curr-type="file" data-curr-path="${entry.path}" onclick="showAccStatus(this)"></i> ${entry.name}</li>`;
    }
    else if (entry.isAccessible == "Untested"){
      html += `<li> <i class="fas fa-question-circle text-warning fa-xs"></i> <i class="fas fa-file text-primary" data-curr-type="file" data-curr-path="${entry.path}" onclick="showAccStatus(this)"></i> ${entry.name}</li>`;
    }
    else if (entry.isAccessible == "Manual Testing Required"){
      html += `<li> <i class="fas fa-exclamation-triangle text-danger fa-xs"></i> <i class="fas fa-file text-primary" data-curr-type="file" data-curr-path="${entry.path}" onclick="showAccStatus(this)"></i> ${entry.name}</li>`;
    }
    else {
      html += `<li> <i class="fas fa-ban text-danger fa-xs"></i> <i class="fas fa-file text-primary" data-curr-type="file" data-curr-path="${entry.path}" onclick="showAccStatus(this)"></i> ${entry.name}</li>`;
    }
  }
  html += '</ul>';

  return html;
}

function generateFolderTree(entries: any, path: string) {
  let html = '<ul>';
  for (const entry of entries) {    
    html += `<li><i class="fas fa-folder text-warning folder" data-curr-type="folder" data-curr-path="${entry.path}" onclick="toggleFolder(this)"></i> ${entry.name}`;
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
    else if (prevElement.classList.contains("fa-times-circle")) {
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
    else {
      HTMLReport += `
      <table id="accessibility-report" class="table">
        <tbody>
          <tr>
            <th>Accessibility status:</th>
            <td>Not Tested</td>
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
  nestedList.classList.toggle("active");
  displayLoading(nestedList);
  let content = await window.electronAPI.getFolderContent(icon.dataset.currPath);  
  nestedList.innerHTML = generateFileTree(content.files, content.name);
  nestedList.innerHTML += generateFolderTree(content.folders, content.name);

}

async function ShowFolderContents() {
  displayLoading(document.getElementById("file-explorer"));
  let content = await window.electronAPI.getFolderContent("/");
  let html = 
    `
    <ul>
      <li><i class="fas text-warning folder fa-folder-open" data-curr-type="folder" data-curr-path="/" onclick="toggleFolder(this)"></i> /
      <ul class="nested active">`;
  html += generateFileTree(content.files, content.name);
  html += generateFolderTree(content.folders, content.name);
  html += `</ul></li></ul>`;
  document.getElementById('file-explorer').innerHTML = html;
}

window.addEventListener('contextmenu', (event: MouseEvent) => {
  event.preventDefault(); // Prevent the default context menu from appearing

  const clickedElement = document.elementFromPoint(event.clientX, event.clientY);
  
  if (clickedElement && clickedElement instanceof HTMLElement) {
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
  else if (data.action == "get-testing-file-type") {
    recieveGetTestingFileType(data);
  }
});

window.electronAPI.receive('top-menu-action', (data) => {  
  document.getElementById("right-panel").innerHTML = `
    <div class="card">
      <h2 class="card-header h5">Document Accessibility Checker (DAC)</h2>
      <div class="card-body">
        <p class="card-text">
          The Document Accessibility Checker provides a place to test and view the accessibility complience status of documents.
        </p>
        <p class="card-text">
          This application enables users to test the accessibility of their Word, PDF, or PowerPoint documents in compliance with 
          the Web Content Accessibility Guidelines (WCAG). Users can open folders on their computer or in GCdocs through the application and test the documents contained within these folders.

          The application supports both individual document testing and batch testing of all documents within a selected folder and its subfolders. 
        </p>
        <p class="card-text">
          <b>Important:</b> The PDF testing performed by this application alone is not sufficient to determine whether a PDF file is fully accessible. 
          Most PDF files require manual testing to confirm compliance with accessibility standards.

          When a PDF file is tested using this application, it undergoes automated checks and is then marked as <b>"Manual Testing Required."</b> 
          The user must conduct manual testing before manually marking the file as accessible using the context menu option.
        </p>
      </div>
      </div>
    </div>
  `;

  if (data.action == "open-folder") {
    let html = 
    `
    <ul>
      <li><i class="fas text-warning folder fa-folder-open" data-curr-type="folder" data-curr-path="${data.content.name}" onclick="toggleFolder(this)"></i> ${data.content.name.split('/').pop()  || data.content.name}
      <ul class="nested active">`;
    html += generateFileTree(data.content.files, data.content.name);
    html += generateFolderTree(data.content.folders, data.content.name);
    html += `</ul></li></ul>`;
    document.getElementById('file-explorer').innerHTML = html;
  }

  if (data.action == "gcdocs-connection-error") {
    new window.Notification("Error", {body: "Something went wrong while connecting to GCdocs"});
    let rightPanel = document.getElementById("right-panel");
    document.getElementById('file-explorer').innerHTML = null;
    rightPanel.innerHTML = `<p class="text-danger">Something went wrong while attempting to connect to GCdocs please make youre you entered a valid URL.</p>`
  }
  
  if (data.action == "open-gcdocs-folder") { displayLoading(document.getElementById("file-explorer")); }
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
      if (data.accStatus == "Accessible") {
        prevElement.className = "fas fa-check-circle text-success fa-xs";

      }
      else if (data.accStatus === "Manual Testing Required") {
        prevElement.className = "fas fa-exclamation-triangle text-danger fa-xs";
      }
      else {
        prevElement.className = "fas fa-times-circle text-danger fa-xs";
      }
    }
  }
}

function receiveGetReport(data: any) {
  // show report
  const folderName = data.path.split('/').pop()  || data.path;
  let rightPanel = document.getElementById("right-panel");
  let numInAccessibleFiles = data.report.numFiles - (data.report.numAccessibleFiles + data.report.numUntested + data.report.numManualTestingRequired);
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
        <th>Number of Documents Requiring Manual Testing:</th>
        <td>${data.report.numManualTestingRequired}</td>
      </tr>
      <tr>
        <th>Number of Untested Documents:</th>
        <td>${data.report.numUntested}</td>
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
          labels: ['Accessible', 'Not Accessible', 'Manual Testing Required', 'Untested'],
          datasets: [{
            label: `Number of documents`,
            data: [data.report.numAccessibleFiles, numInAccessibleFiles, data.report.numManualTestingRequired, data.report.numUntested],
            backgroundColor: [
              'rgb(54, 162, 235)',
              'rgb(255, 99, 132)',
              'rgb(255,140,0)',
              'rgb(255, 191, 0)'
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
  let HTMLReport = `
    <div class="alert alert-warning" role="alert">
      [Note] Test results are saved to ${data.resultPath}
    </div>
    <h2>Accessibility test result for ${data.path.split('/').pop()}</h2>`;
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
  let HTMLReport = `
  <div class="alert alert-warning" role="alert">
  [Note] Test results are saved to ${data.resultPath}
  </div>
  <h2>Accessibility test result for ${data.path.split('/').pop()}</h2>`;
  if (data.testStatus == "noDocuments") {
    HTMLReport += `<p>No documents were found in this folder or any sub-folders</p>`;
  }
  else {
    HTMLReport += `
    <table class="table">
      <tr>
        <th>Filename</th>
        <th>Accessibility Test status:</th>
        <th>Document accessibility status:</th>
      </tr>`;
    for (let doc = 0; doc < data.results.length; doc++) {
      let iconData = {path: `${data.results[doc].path}`, accStatus: `${data.results[doc].passed}`}; 
      receiveChangeAccessibilityStatus(iconData);
      HTMLReport += `
        <tr>
          <td>${data.results[doc].path}</td>
          <td>${data.results[doc].success ? 'Completed' : 'Error'}</td>
          <td>${data.results[doc].passed}</td>
        </tr>`;
    }
    HTMLReport += `</table>`;
  }
  rightPanel.innerHTML = HTMLReport;
}

ShowFolderContents();

function recieveGetTestingFileType(data: any) {
  // Remove existing popup if present
  const existingPopup = document.getElementById('file-type-popup');
  if (existingPopup) existingPopup.remove();
  let rightPanel = document.getElementById("right-panel");
  rightPanel.innerHTML = "";

  // Create Popup
  const popup = document.createElement('div');
  popup.id = 'file-type-popup';

  popup.innerHTML = `
  <div class="card shadow-lg border rounded-3">
    <div class="card-body">
      <h2 class="card-title mb-4">Select the File Types You Would Like to Test</h2>
      <form id="file-type-form">
        <div class="mb-3 form-check">
          <input type="checkbox" class="form-check-input" value="word" id="wordCheckBox">
          <label class="form-check-label" for="wordCheckBox">Word Documents (.docx)</label>
        </div>
        <div class="mb-3 form-check">
          <input type="checkbox" class="form-check-input" value="powerpoint" id="powerPointCheckBox">
          <label class="form-check-label" for="powerPointCheckBox">PowerPoint Documents (.pptx)</label>
        </div>
        <div class="mb-3 form-check">
          <input type="checkbox" class="form-check-input" value="pdf" id="pdfCheckBox">
          <label class="form-check-label" for="pdfCheckBox">PDF Documents (.pdf)</label>
        </div>
        <div class="d-grid gap-2 d-md-block">
          <button type="button" id="start-folder-test" class="btn btn-primary px-4">Submit</button>
          <button type="button" id="close-popup" class="btn btn-secondary px-4">Cancel</button>
        </div>
      </form>
    </div>
  </div>
`;

  rightPanel.appendChild(popup);

  // Close Button Event
  document.getElementById('close-popup')?.addEventListener('click', () => {
    popup.remove();
  });

  // Start Test Button Event
  document.getElementById('start-folder-test')?.addEventListener('click', () => {
    const selectedTypes = Array.from(
      document.querySelectorAll('#file-type-form input[type="checkbox"]:checked')
    ).map((input) => (input as HTMLInputElement).value);

    if (selectedTypes.length === 0) {
      alert('Please select at least one file type.');
      return;
    }
    console.log(selectedTypes);
    window.electron.ipcRenderer.send('start-folder-accessibility-test', { path: data.path, selectedTypes });
    popup.remove();
  });
}

// window.electronAPI.receive("loading-event", (data) => {
//   if (data.action === "display-loading") { recieveDisplayLoading(); }
// });

function displayLoading(element: HTMLElement) {
  element.innerHTML = `
  <div class="d-flex align-items-center">
    <div class="spinner-border text-primary mr-2" role="status" aria-hidden="true"></div>
    <p class="mb-0">Loading...</p>
  </div>
  `; 
}