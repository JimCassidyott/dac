import { IFile } from '../Interfaces/iFile';
import { IFolder } from '../Interfaces/iFolder';
import { IFolderContents } from '../Interfaces/iFolderContents';
import { IFileSystem } from '../Interfaces/IFileSystem';
export class FileSystem {
    fileSystemAdapter: IFileSystem;

    /**
     * Initializes a new instance of the FileSystem class with the provided file system adapter.
     *
     * @param {IFileSystem} fileSystemAdapter - The file system adapter to be used by the FileSystem instance.
     * @return {void}
     */
    constructor(fileSystemAdapter: IFileSystem) {
        this.fileSystemAdapter = fileSystemAdapter;
    }

    /**    
     * Retrieves a list of files within the specified directory.
     *
     * @param {string} directoryPath - The path to the directory to retrieve files from.
     * @return {Promise<IFile[]>} A promise that resolves to an array of IFile objects representing the files.
     */
    // Implement the IFileSystem interface methods as private
    public async getFiles(directoryPath: string): Promise<IFile[]> {
        // Implementation to get files
        // Delegate the implementation to the file system adapter
        return this.fileSystemAdapter.getFiles(directoryPath);
    }

    /**
     * Retrieves a list of folder names within the specified directory.
     *
     * @param {string} directoryPath - The path to the directory to retrieve folders from.
     * @return {Promise<string[]>} A promise that resolves to an array of folder names.
     */
    public async getFolders(directoryPath: string): Promise<IFolder[]> {
        // Implementation to get folders
        return this.fileSystemAdapter.getFolders(directoryPath);
    }

    /**
     * Retrieves the contents of a folder at the specified directory path.
     *
     * @param {string} directoryPath - The path of the directory.
     * @return {Promise<IFolderContents[]>} A promise that resolves to an array of strings representing the contents of the folder.
     */
    public async getFolderContents(directoryPath: string): Promise<IFolderContents[]> {
        // Implementation to get folders
        return this.fileSystemAdapter.getFolderContents(directoryPath);
    }

    /**
     * Formats the given size in bytes into a human-readable string representation.
     *
     * @param {number} size - The size in bytes to be formatted.
     * @return {Promise<string>} A promise that resolves to the formatted size string.
     */
    public async formatSize(size: number): Promise<string> {
        return size >= 1048576 ? `${(size / 1048576).toFixed(2)} MB` : `${size} bytes`;
    }
}