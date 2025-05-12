import { IFile } from "./IFile";
import { IFolder } from "./IFolder";
import { IFolderContents } from "./IFolderContents";

export interface IFileSystem {
    getFiles(directoryPath: string): Promise<IFile[]>;
    getFolders(directoryPath: string): Promise<IFolder[]>;
    getFolderContents(directoryPath: string): Promise<IFolderContents>;
    listDocxFiles(dirPath: string): Promise<string[]>;
    listPDFFiles(dirPath: string): Promise<string[]>;
    listPPTXFiles(dirPath: string): Promise<string[]>;
}