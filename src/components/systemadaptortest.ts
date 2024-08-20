import { isAccessible } from "./accessibilityChecker";
import { SystemAdapter } from "./systemAdaptor";
import { isWordDocument } from "./FileSystemReader";

// Get the file name from the command-line arguments
const fileName = process.argv[2];

if (!fileName) {
    console.error("Please provide a file name as a command-line argument.");
    process.exit(1);
}

try {
    const result = isAccessible(fileName);
    result.then((result) => {
        console.log(`Accessibility check for ${fileName}: ${result}`);
    });
} catch (error) {
    console.error("Error checking accessibility:", error);
}


console.log(isWordDocument('fileSystem.ts'), "should be false");
const sa = new SystemAdapter();

const filePath = '../../x';

// Test of the System adapter that reads files from the local file system.
//This code will be used for our demo.
sa.getFiles(filePath).then(async (files) => {

    // This code will eventually have to be moved into the FileSystemReader class
    const wordFiles = [];
    for (const file of files) {
        if (await isWordDocument(file.name)) {
            wordFiles.push(file);
        }
    }

    wordFiles.forEach((file) => {
        if (file.name.endsWith('.docx')) {
            console.log(`Found .docx file: ${filePath}/${file.name}`);
        } else {
            console.log(`Found file: ${filePath}/${file.name}`);
        }
    });
}).catch((err) => {
    console.error(err);
});


// Use the SystemAdapter to get folders
sa.getFolders(filePath).then((folders) => {
    folders.forEach((folder) => {
        console.log(`Found folder: ${filePath}/${folder.name}`);
    });
}).catch((err) => {
    console.error(err);
});


// Use the SystemAdapter to get folder contents
// Use the SystemAdapter to get folders
sa.getFolders(filePath).then((folders) => {
    folders.forEach((folder) => {
        console.log(`Found folder: ${filePath}/${folder.name}`);

        // Use the SystemAdapter to get folder contents
        sa.getFolderContents(`${filePath}/${folder.name}`).then((contents) => {
            contents.forEach((content) => {
                console.log(`Contents of folder ${folder.name}:`);
                for (const [key, value] of Object.entries(content)) {
                    console.log(`  ${key}: ${value}`);
                }
            });
        }).catch((err) => {
            console.error(`Error getting contents of folder ${folder.name}:`, err);
        });
    });
}).catch((err) => {
    console.error(err);
});