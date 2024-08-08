// import * as fs from 'fs';
import * as fs from 'fs/promises';
import { IFileSystem } from '../Interfaces/IFileSystem';
import { IFile } from '../Interfaces/iFile';
import { IFolder } from '../Interfaces/iFolder';

/**
 * An implementation of the IFileSystem interface for interacting with the System file system.
 */
export class SystemAdapter implements IFileSystem {
    getFolders(directoryPath: string): Promise<IFolder[]> {
        throw new Error('Method not implemented.');
    }
    getFolderContents(directoryPath: string): Promise<IFile[]> {
        throw new Error('Method not implemented.');
    }
    /**
     * Retrieves a list of files within the specified directory.
     * 
     * @param directoryPath - The path to the directory to retrieve files from.
     * @returns A promise that resolves to an array of IFile objects representing the files.
     * @throws {Error} If the directory does not exist or access is denied.
     */
    public async getFiles(directoryPath: string): Promise<IFile[]> {
        // Check if the directory exists and is readable
        try {
            fs.access(directoryPath, fs.constants.R_OK);

            // Read the directory contents
            const files = await fs.readdir(directoryPath, { withFileTypes: true });

            // Filter out the .docx files and folders
            // Filter out the .docx files
            // Filter out the folders
            const fileList: IFile[] = files
                .filter((file) => file.isFile()) // Filter out non-files
                .map((file) => { // Create IFile objects with name, path, and fileCount initialized to 0
                    return {
                        name: file.name, // Name of the file
                        size: "0", // Size in bytes or megabytes
                        mimeType: "mimetype", // MIME type of the file, optional
                        isAccessible: true, // Accessibility property
                        customProperties: {} // Custom properties
                    };
                });

            // Return the list of files
            return fileList;
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


}
