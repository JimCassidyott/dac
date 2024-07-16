// This file is required by the index.html file and will
// be executed in the renderer process for that window.
// No Node.js APIs are available in this process unless
// nodeIntegration is set to true in webPreferences.
// Use preload.js to selectively enable features
// needed in the renderer process.

const fileSystemEntries = [
    {
        name: "Folder 1",
        type: "folder",
        path: "/folder1",
        children: [
            {
                name: "Subfolder 1",
                type: "folder",
                path: "/folder1/subfolder1",
                children: [
                    {
                        name: "File 1.txt",
                        type: "file",
                        path: "/folder1/subfolder1/file1.txt"
                    }
                ]
            }
        ]
    },
    {
        name: "File 2.txt",
        type: "file",
        path: "/file2.txt"
    }
];

function generateTreeHtml(entries: any) {
    let html = '<ul>';
    for (const entry of entries) {
        if (entry.type === 'folder') {
            html += `<li><i class="fas fa-folder text-warning folder" onclick="toggleFolder(this)"></i> ${entry.name}`;
            html += `<ul class="nested">`;
            html += generateTreeHtml(entry.children);
            html += `</ul></li>`;
        } else {
            html += `<li><i class="fas fa-file text-primary"></i> ${entry.name}</li>`;
        }
    }
    html += '</ul>';
    return html;
}

function toggleFolder(icon: any) {
    icon.classList.toggle("fa-folder");
    icon.classList.toggle("fa-folder-open");
    let nestedList = icon.nextElementSibling.nextElementSibling;
    if (nestedList) {
        nestedList.classList.toggle("active");
    }
}

document.getElementById('file-explorer').innerHTML = generateTreeHtml(fileSystemEntries);

