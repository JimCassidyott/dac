import * as fs from 'fs';
import * as path from 'path';

interface DirectoryContents {
    files: string[];
    directories: string[];
}

/**
 * Lists all files and directories in the given directory separately, including subdirectories.
 *
 * @param {string} dirPath - The path to the directory.
 * @returns {DirectoryContents} - An object containing lists of files and directories.
 */
function listFilesAndDirectories(dirPath: string): DirectoryContents {
    const result: DirectoryContents = { files: [], directories: [] };

    try {
        const items = fs.readdirSync(dirPath);

        items.forEach(item => {
            const fullPath = path.join(dirPath, item);
            const stat = fs.statSync(fullPath);

            if (stat.isDirectory()) {
                result.directories.push(fullPath);
                // Recursively list files and directories in the subdirectory
                const subDirContents = listFilesAndDirectories(fullPath);
                result.files.push(...subDirContents.files);
                result.directories.push(...subDirContents.directories);
            } else if (stat.isFile()) {
                result.files.push(fullPath);
            }
        });

        return result;
    } catch (error) {
        console.error(`Error reading directory: ${error.message}`);
        return result;
    }
}

// Example usage
const directoryPath = './x';












































































const { files, directories } = listFilesAndDirectories(directoryPath);
console.log('Files:', files);
console.log('Directories:', directories);