import { IFile } from "./iFile";
import { IFolder } from "./iFolder";
import { IFolderContents } from "./iFolderContents";

export interface IFileSystem {
    getFiles(directoryPath: string): Promise<IFile[]>;
    getFolders(directoryPath: string): Promise<IFolder[]>;
    getFolderContents(directoryPath: string): Promise<IFolderContents>;
    listDocxFiles(dirPath: string): Promise<string[]>;
}