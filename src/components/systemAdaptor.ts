import * as fsSync from 'fs';
import * as path from 'path';
import * as fs from 'fs/promises';
import { IFileSystem } from '../Interfaces/IFileSystem';
import { IFile } from '../Interfaces/IFile';
import { IFolder } from '../Interfaces/IFolder';
import { IFolderContents } from '../Interfaces/IFolderContents';
import { AccessibilityStatus } from "../components/helpers";

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
                        fileCount: 0,
                        path: `${directoryPath}/${folder.name}`,
                    };
                });

            return folderList;
        } catch (err: any) {
            throw new Error(`Error: ${err.message}`);
        }
    }

    /**
     * Retrieves the contents of a folder at the specified directory path.
     *
     * @param {string} directoryPath - The path of the directory.
     * @return {Promise<IFolderContents>} A promise that resolves to an array of IFolderContents objects representing the contents of the folder.
     * @throws {Error} If the directory does not exist or access is denied.
     */
    public async getFolderContents(directoryPath: string): Promise<IFolderContents> {
        try {
            // Check if the directory exists and is readable
            await fs.access(directoryPath, fs.constants.R_OK);

            // Get the folders and files in the directory
            const folders = await this.getFolders(directoryPath);
            const files = await this.getFiles(directoryPath);

            // Return the folder contents as an array with a single object
            return {
                    // Name of the directory
                    name: directoryPath,
                    // List of folders in the directory
                    folders: folders,
                    // List of files in the directory
                    files: files
                };
        } catch (err: any) {
            // Handle different error types
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
                        path: `${directoryPath}/${file.name}`, // Path of the file
                        size: "0", // Size in bytes or megabytes
                        mimeType: "", // MIME type of the file, optional
                        isAccessible: AccessibilityStatus.Untested, // Accessibility property
                        customProperties: {} // Custom properties
                    };
                });

            return fileList;
        } catch (err: any) {
            throw new Error(`Error: ${err.message}`);
        }

    }

    /**
     * Lists all files and directories in the given directory separately, including subdirectories.
     *
     * @param {string} dirPath - The path to the directory.
     * @returns {DirectoryContents} - An object containing lists of files and directories.
     */
    public listFilesAndDirectories(dirPath: string): {files: string[], directories: string[]} {
        const result: {files: string[], directories: string[]} = { files: [], directories: [] };

        try {
            const items = fsSync.readdirSync(dirPath);

            items.forEach(item => {
                const fullPath = path.join(dirPath, item);
                const stat = fsSync.statSync(fullPath);

                if (stat.isDirectory()) {
                    result.directories.push(fullPath);
                    // Recursively list files and directories in the subdirectory
                    const subDirContents = this.listFilesAndDirectories(fullPath);
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
    * @returns {Promise<string[]>} - A list of .docx file paths.
    */
    public listDocxFiles(dirPath: string): Promise<string[]> {
        const { files } = this.listFilesAndDirectories(dirPath);
        return Promise.resolve(files
            .filter(file => path.extname(file) === '.docx'));
    }

    /**
    * Lists all .pdf files in the given directory and its subdirectories.
    * Converts the file paths to full file paths.
    *
    * @param {string} dirPath - The path to the directory.
    * @returns {Promise<string[]>} - A list of .pdf file paths.
    */
    public listPDFFiles(dirPath: string): Promise<string[]> {
      const { files } = this.listFilesAndDirectories(dirPath);
      return Promise.resolve(files
          .filter(file => path.extname(file) === '.pdf'));
    }

    /**
    * Lists all .pptx files in the given directory and its subdirectories.
    * Converts the file paths to full file paths.
    *
    * @param {string} dirPath - The path to the directory.
    * @returns {Promise<string[]>} - A list of .pptx file paths.
    */
    public listPPTXFiles(dirPath: string): Promise<string[]> {
      const { files } = this.listFilesAndDirectories(dirPath);
      return Promise.resolve(files
          .filter(file => path.extname(file) === '.pptx'));
    }
}
