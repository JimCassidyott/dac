import * as path from 'path';

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
 * Asynchronously checks if a file is a Word document (.docx) by verifying its file extension.
 *
 * @param {string} filePath - The path to the file to be checked.
 * @returns {Promise<boolean>} - A Promise that resolves to a boolean indicating whether the file is a Word document.
 */
export async function isWordDocument(filePath: string): Promise<boolean> {
    const fileExtension: string = path.extname(filePath).toLowerCase();
    return fileExtension === '.docx';
}