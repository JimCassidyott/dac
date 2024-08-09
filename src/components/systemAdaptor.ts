// import * as fs from 'fs';
import * as fs from 'fs/promises';
import { IFileSystem } from '../Interfaces/IFileSystem';
import { IFile } from '../Interfaces/iFile';
import { IFolder } from '../Interfaces/iFolder';
import { isAccessible } from './accessibilityChecker';
import { IFolderContents } from '../Interfaces/iFolderContents';


/**
 * An implementation of the IFileSystem interface for interacting with the System file system.
 */
export class SystemAdapter implements IFileSystem {
    async getFolders(directoryPath: string): Promise<IFolder[]> {
        try {
            await fs.access(directoryPath, fs.constants.R_OK);

            // Read the directory contents
            const folderContents = await fs.readdir(directoryPath, { withFileTypes: true });
            const folderList: IFolder[] = folderContents
                .filter((item) => item.isDirectory()) // Filter out non-files
                .map((folder) => { // Create IFile objects with name, path, and fileCount initialized to 0
                    return {
                        name: folder.name,
                        fileCount: 0
                    };
                });

            return folderList;
        } catch (err: any) {
            throw new Error(`Error: ${err.message}`);
        }
    }

    public async getFolderContents(directoryPath: string): Promise<IFolderContents[]> {
        try {
            await fs.access(directoryPath, fs.constants.R_OK);

            const folders = await this.getFolders(directoryPath);
            const files = await this.getFiles(directoryPath);

            return [{
                name: directoryPath,
                folders: folders,
                files: files
            }];
        } catch (err: any) {
            if (err.code === 'ENOENT') {
                // If the directory does not exist, throw an error
                throw new Error(`Directory does not exist: ${directoryPath}`);
            } else if (err.code === 'EACCES') {
                // If access is denied, throw an error
                throw new Error(`Permission denied: ${directoryPath}`);
            } else {
                // If any other error occurs, throw a generic error
                throw new Error(`Error accessing directory: ${err.message}`);
            }
        }
    }

    /**
     * Retrieves a list of files within the specified directory.
     * 
     * @param directoryPath - The path to the directory to retrieve files from.
     * @returns A promise that resolves to an array of IFile objects representing the files.
     * @throws {Error} If the directory does not exist or access is denied.
     * 
     * Note: Our final requirement is to get a list of docx files and to indicate
     *       if they are accessible or not, the mime type and all of the custom properties. 
     *       This data will be fetched by the code that uses this adapter. That's the right place for it.
     *       This adapter should only return the list of files in the system directory.
     *       Another adapter will be used to fetch the contents of folders in gc docs.
     *       This adapter will be used to fetch the contents of folders in gc docs.
     *       Each of these adapters will require the code to check accessibility etc. 
     *       It is better to have that live in one place: fileSystem.ts
     */
    public async getFiles(directoryPath: string): Promise<IFile[]> {
        // Check if the directory exists and is readable
        try {
            await fs.access(directoryPath, fs.constants.R_OK);

            // Read the directory contents
            const folderContents = await fs.readdir(directoryPath, { withFileTypes: true });

            // Filter out the .docx files and folders
            // Filter out the .docx files
            // Filter out the folders
            const fileList: IFile[] = folderContents
                .filter((item) => item.isFile()) // Filter out non-files
                .map((file) => { // Create IFile objects with name, path, and fileCount initialized to 0
                    return {
                        name: file.name, // Name of the file
                        size: "0", // Size in bytes or megabytes
                        mimeType: "", // MIME type of the file, optional
                        isAccessible: true, // Accessibility property
                        customProperties: {} // Custom properties
                    };
                });

            return fileList;
        } catch (err: any) {
            throw new Error(`Error: ${err.message}`);
        }

    }
}
