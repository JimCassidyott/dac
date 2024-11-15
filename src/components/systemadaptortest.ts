import { isAccessible } from "./accessibilityChecker";
import { SystemAdapter } from "./systemAdaptor";
import { isWordDocument } from "./FileSystemReader";
import * as fs from 'fs';

// Get the file name from the command-line arguments
// const fileName = process.argv[2];

// if (!fileName) {
//     console.error("Please provide a file name as a command-line argument.");
//     process.exit(1);
// }

// try {
//     const result = isAccessible(fileName);
//     console.log(`Accessibility check for ${fileName}: ${result} *&*`);
//     result.then((result) => {
//         console.log(`Accessibility check for ${fileName}: ${result} **`);
//     });
// } catch (error) {
//     console.error("Error checking accessibility:", error);
// }

// console.log(isWordDocument('fileSystem.ts'), "should be false");
const sa = new SystemAdapter();

const filePath = '../../x';

// // Test of the System adapter that reads files from the local file system.
// //This code will be used for our demo.
// sa.getFiles(filePath).then(async (files) => {

//     // This code will eventually have to be moved into the FileSystemReader class
//     const wordFiles = [];
//     for (const file of files) {
//         if (await isWordDocument(file.path + '/' + file.name)) {
//             // console.log("acc", await isAccessible(file.path + '/' + fileName), file.path + '/' + fileName, fs.existsSync(file.path + '/' + fileName));
//             file.isAccessible = await isAccessible(file.path + '/' + file.name);
//             wordFiles.push(file);
//         }
//     }
// }).catch((err) => {
//     console.error(err);
// });


// // Use the SystemAdapter to get folders
// sa.getFolders(filePath).then((folders) => {
//     folders.forEach((folder) => {
//         console.log(`Found folder: ${filePath}/${folder.name}`);
//     });
// }).catch((err) => {
//     console.error(err);
// });


// Use the SystemAdapter to get folder contents
// Use the SystemAdapter to get folders
// sa.getFolders(filePath).then((folders) => {
//     folders.forEach((folder) => {
//         console.log(`Found folder: ${filePath}/${folder.name}`);

//         // Use the SystemAdapter to get folder contents
//         sa.getFolderContents(`${filePath}/${folder.name}`).then((contents) => {
//             contents.forEach((content) => {
//                 console.log(`Contents of folder ${folder.name}:`);
//                 for (const [key, value] of Object.entries(content)) {
//                     console.log(`  ${key}: ${value}`);
//                 }
//             });
//         }).catch((err) => {
//             console.error(`Error getting contents of folder ${folder.name}:`, err);
//         });
//     });
// }).catch((err) => {
//     console.error(err);
// });

import { IFolderContents } from "../Interfaces/iFolderContents";
import { IFile } from "../Interfaces/iFile";

async function fetchFolderContents(path: string): Promise<any> {
    try {
        const contents = await sa.getFolderContents(path);

        let c: IFolderContents = contents;
        c.files = filterDocxFiles(c.files);
        c.files = await markFilesAccessibility(c.files);

        return c;

    } catch (err) {
        console.error(`Error getting contents of folder at path ${path}:`, err);
        throw err; // Re-throw the error to handle it further up the call stack if needed
    }
}

function filterDocxFiles(contents: IFile[]): IFile[] {
    return contents.filter(file => file.name.toLowerCase().endsWith('.docx'));
}

async function markFilesAccessibility(contents: IFile[]): Promise<IFile[]> {
    const markedFiles: IFile[] = [];
    for (const file of contents) {
        file.isAccessible = await isAccessible(filePath + '/' + file.name);
        markedFiles.push(file);
    }

    return markedFiles;
}


// Example usage:
fetchFolderContents(filePath).then((contents) => {
    console.log(contents);
}).catch((err) => {
    console.error(err);
})