//Compile this code using `npx tsc tree.ts` in the command line '
//Run the compiled code using `node tree.js <directoryPath>` in the command line
//Example: `node tree.js ./test` will list the contents of the test directory

import * as fs from 'fs';
import * as path from 'path';
import * as mime from 'mime-types'; // Ensure correct import

interface File {
    name: string;
    size: string; // Size in bytes or megabytes
    mimeType?: string; // MIME type of the file, optional
    isAccessible: boolean; // Accessibility property
    customProperties: { [key: string]: any }; // Custom properties
}

interface Folder {
    name: string;
    fileCount: number;
}

interface FolderContents {
    name: string;
    folders: Folder[];
    files: File[];
}

function formatSize(size: number): string {
    return size >= 1048576 ? `${(size / 1048576).toFixed(2)} MB` : `${size} bytes`;
}

function listDirectoryContents(directoryPath: string): FolderContents {
    const folderName = path.basename(directoryPath);

    try {
        const items = fs.readdirSync(directoryPath);

        const contents: FolderContents = {
            name: folderName,
            folders: [],
            files: []
        };

        items.forEach(item => {
            const fullPath = path.join(directoryPath, item);
            const stat = fs.statSync(fullPath);

            if (stat.isDirectory()) {
                const subItems = fs.readdirSync(fullPath);
                contents.folders.push({ name: item, fileCount: subItems.length });
            } else if (stat.isFile()) {
                const ext = path.extname(item).toLowerCase();
                if (ext === '.docx' || ext === '.doc' || ext === '.txt') {
                    const mimeType = mime.lookup(item) || undefined;
                    const file: File = {
                        name: item,
                        size: formatSize(stat.size),
                        isAccessible: false, // Default to false
                        customProperties: {} // Initialize custom properties
                    };
                    if (mimeType) {
                        file.mimeType = mimeType;
                    }
                    // Check for custom properties
                    try {
                        const fileContent = fs.readFileSync(fullPath, 'utf-8');
                        const fileMetadata = JSON.parse(fileContent);
                        for (const key in fileMetadata) {
                            if (fileMetadata.hasOwnProperty(key)) {
                                file.customProperties[key] = fileMetadata[key];
                                if (key === 'isAccessible') {
                                    file.isAccessible = fileMetadata[key];
                                }
                            }
                        }
                    } catch (error) {
                        // If there's an error reading or parsing the file, keep isAccessible as false
                    }
                    contents.files.push(file);
                }
            }
        });

        // Sort folders and files by name
        contents.folders.sort((a, b) => a.name.localeCompare(b.name));
        contents.files.sort((a, b) => a.name.localeCompare(b.name));

        return contents;
    } catch (error) {
        if (error.code === 'ENOENT') {
            console.error(`Error: Directory ${directoryPath} does not exist.`);
        } else if (error.code === 'EACCES') {
            console.error(`Error: Permission denied to read directory ${directoryPath}.`);
        } else {
            console.error(`Error reading directory ${directoryPath}: ${error.message}`);
        }
        return { name: folderName, folders: [], files: [] };
    }
}

// Get the directory path from command-line arguments
const directoryPath = process.argv[2];

if (!directoryPath) {
    console.error('Please provide a directory path as a command-line argument.');
    process.exit(1);
}

const folderContents = listDirectoryContents(directoryPath);
console.log(JSON.stringify(folderContents, null, 2));