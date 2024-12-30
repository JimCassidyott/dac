import * as path from 'path';
import { isWordDOC } from './helpers';

// import { FileSystemReader } from './path/to/FileSystemReader';
// import { SystemAdapter } from './path/to/SystemAdapter';

// const systemAdapter = new SystemAdapter();
// const fileSystemReader = new FileSystemReader(systemAdapter);

// fileSystemReader.readFolders('/path/to/directory')
//     .then(folders => {
//         console.log(folders);
//     })
//     .catch(err => {
//         console.error(err);
//     });

/**
 * Asynchronously checks if a file is a Word document (.docx).
 * This is an alias for isWordDOC from helpers which performs both extension and MIME type validation.
 *
 * @param {string} filePath - The path to the file to be checked.
 * @returns {Promise<boolean>} - A Promise that resolves to a boolean indicating whether the file is a Word document.
 */
export async function isWordDocument(filePath: string): Promise<boolean> {
    return isWordDOC(filePath);
}