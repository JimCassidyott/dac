// This file is required by the index.html file and will
// be executed in the renderer process for that window.
// No Node.js APIs are available in this process unless
// nodeIntegration is set to true in webPreferences.
// Use preload.js to selectively enable features
// needed in the renderer process.

function generateFileTree(entries: any) {
  let html = '<ul>';
  for (const entry of entries) {
    if (entry.isAccessible == true) {
      html += `<li> <i class="fas fa-check-circle text-success fa-xs"></i> <i class="fas fa-file text-primary"></i> ${entry.name}</li>`;
    }
    else {
      html += `<li> <i class="fas fa-times-circle text-danger fa-xs"></i> <i class="fas fa-file text-primary"></i> ${entry.name}</li>`;
    }
  }
  html += '</ul>';

  return html;
}

function generateFolderTree(entries: any, path: string) {
  let html = '<ul>';
  for (const entry of entries) {
    let currPath = path == "./" ? path + entry.name : path + "/" + entry.name;

    html += `<li><i class="fas fa-folder text-warning folder" data-curr-path="${currPath}" onclick="toggleFolder(this)"></i> ${entry.name}`;
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
  nestedList.innerHTML = generateFileTree(content.files);
  nestedList.innerHTML += generateFolderTree(content.folders, content.name);
  if (nestedList) {
    nestedList.classList.toggle("active");
  }
}

async function ShowFolderContents() {
  let content = await window.electronAPI.getFolderContent("./");  
  document.getElementById('file-explorer').innerHTML = generateFileTree(content.files);
  document.getElementById('file-explorer').innerHTML += generateFolderTree(content.folders, content.name);
}

ShowFolderContents();