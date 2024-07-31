"use strict";
//Compile this code using `npx tsc tree.ts` in the command line '
//Run the compiled code using `node tree.js <directoryPath>` in the command line
//Example: `node tree.js ./test` will list the contents of the test directory
exports.__esModule = true;
var fs = require("fs");
var path = require("path");
var mime = require("mime-types"); // Ensure correct import
function formatSize(size) {
    return size >= 1048576 ? "".concat((size / 1048576).toFixed(2), " MB") : "".concat(size, " bytes");
}
function listDirectoryContents(directoryPath) {
    var folderName = path.basename(directoryPath);
    try {
        var items = fs.readdirSync(directoryPath);
        var contents_1 = {
            name: folderName,
            folders: [],
            files: []
        };
        items.forEach(function (item) {
            var fullPath = path.join(directoryPath, item);
            var stat = fs.statSync(fullPath);
            if (stat.isDirectory()) {
                var subItems = fs.readdirSync(fullPath);
                contents_1.folders.push({ name: item, fileCount: subItems.length });
            }
            else if (stat.isFile()) {
                var ext = path.extname(item).toLowerCase();
                if (ext === '.docx' || ext === '.doc' || ext === '.txt') {
                    var mimeType = mime.lookup(item) || undefined;
                    var file = {
                        name: item,
                        size: formatSize(stat.size),
                        isAccessible: false,
                        customProperties: {} // Initialize custom properties
                    };
                    if (mimeType) {
                        file.mimeType = mimeType;
                    }
                    // Check for custom properties
                    try {
                        var fileContent = fs.readFileSync(fullPath, 'utf-8');
                        var fileMetadata = JSON.parse(fileContent);
                        for (var key in fileMetadata) {
                            if (fileMetadata.hasOwnProperty(key)) {
                                file.customProperties[key] = fileMetadata[key];
                                if (key === 'isAccessible') {
                                    file.isAccessible = fileMetadata[key];
                                }
                            }
                        }
                    }
                    catch (error) {
                        // If there's an error reading or parsing the file, keep isAccessible as false
                    }
                    contents_1.files.push(file);
                }
            }
        });
        // Sort folders and files by name
        contents_1.folders.sort(function (a, b) { return a.name.localeCompare(b.name); });
        contents_1.files.sort(function (a, b) { return a.name.localeCompare(b.name); });
        return contents_1;
    }
    catch (error) {
        if (error.code === 'ENOENT') {
            console.error("Error: Directory ".concat(directoryPath, " does not exist."));
        }
        else if (error.code === 'EACCES') {
            console.error("Error: Permission denied to read directory ".concat(directoryPath, "."));
        }
        else {
            console.error("Error reading directory ".concat(directoryPath, ": ").concat(error.message));
        }
        return { name: folderName, folders: [], files: [] };
    }
}
// Get the directory path from command-line arguments
var directoryPath = process.argv[2];
if (!directoryPath) {
    console.error('Please provide a directory path as a command-line argument.');
    process.exit(1);
}
var folderContents = listDirectoryContents(directoryPath);
console.log(JSON.stringify(folderContents, null, 2));
