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

/**
 * Lists all .docx files in the given directory and its subdirectories.
 * Converts the file paths to full file paths.
 *
 * @param {string} dirPath - The path to the directory.
 * @returns {string[]} - A list of .docx files with full file paths.
 */
function listDocxFiles(dirPath: string): string[] {
    const { files } = listFilesAndDirectories(dirPath);
    return files
        .filter(file => path.extname(file) === '.docx')
        .map(file => path.resolve(file));
}
// Example usage
const directoryPath = '../../../x';

const { files, directories } = listFilesAndDirectories(directoryPath);
console.log('Files:', files);
console.log('Directories:', directories);

const docxFiles = listDocxFiles(directoryPath);
console.log('DOCX Files:', docxFiles);