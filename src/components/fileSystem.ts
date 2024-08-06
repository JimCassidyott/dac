// fileAdaptors.ts
// import * as fs from 'fs';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as mime from 'mime-types'; // Ensure correct import


export interface IFile {
    name: string;
    size: string; // Size in bytes or megabytes
    mimeType?: string; // MIME type of the file, optional
    isAccessible: boolean; // Accessibility property
    customProperties: { [key: string]: any }; // Custom properties
}


interface IFolder {
    name: string;
    fileCount: number;
}

interface IFolderContents {
    name: string;
    folders: IFolder[];
    files: IFile[];
}

// IFileSystem.ts
export interface IFileSystem {
    getFiles(directoryPath: string): Promise<IFile[]>;
    getFolders(directoryPath: string): Promise<IFolder[]>;
    getFolderContents(directoryPath: string): Promise<IFolderContents[]>;
}

/**
 * An implementation of the IFileSystem interface for interacting with theSystem file system.
 */
class GCDocsAdapter implements IFileSystem {
    public async getFiles(directoryPath: string): Promise<IFile[]> {
        // Implementation specific to GC Docs file system
        // ...

        // Return the list of files
        return [];
    }

    public async getFolders(directoryPath: string): Promise<IFolder[]> {
        // Implementation specific to GC Docs file system
        // ...

        // Return the list of folders
        return [];
    }

    public async getFolderContents(directoryPath: string): Promise<IFolderContents[]> {
        // Implementation specific to GC Docs file system
        // ...

        // Return the list of folder contents
        return [];
    }
}


/**
 * An implementation of the IFileSystem interface for interacting with the System file system.
 */
class SystemAdapter implements IFileSystem {
    public async getFiles(directoryPath: string): Promise<IFile[]> {
        // Implementation specific toSystem file system
        // ...

        // Return the list of files
        return [];
    }

    public async getFolders(directoryPath: string): Promise<IFolder[]> {
        // Implementation specific toSystem file system
        // ...
        try {
            await fs.access(directoryPath, fs.constants.R_OK | fs.constants.W_OK);
            // Read the directory contents
            const files = await fs.readdir(directoryPath, { withFileTypes: true });

            // Filter out the folders
            const folders: IFolder[] = files
                .filter((file) => file.isDirectory())
                .map((folder) => ({
                    name: folder.name,
                    path: path.join(directoryPath, folder.name),
                    fileCount: 0
                }));

            // Sort folders alphabetically by name
            folders.sort((a, b) => a.name.localeCompare(b.name));

            return folders;

        } catch (err: any) {
            if (err.code === 'ENOENT') {
                throw new Error(`Directory does not exist: ${directoryPath}`);
            } else if (err.code === 'EACCES') {
                throw new Error(`Permission denied: ${directoryPath}`);
            } else {
                throw new Error(`Error accessing directory: ${err.message}`);
            }
        }


        // Return the list of folders
        return [];
    }

    public async getFolderContents(directoryPath: string): Promise<IFolderContents[]> {
        // Implementation specific toSystem file system
        // ...

        // Return the list of folder contents
        return [];
    }
}


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
