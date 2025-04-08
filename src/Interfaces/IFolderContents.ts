import { IFile } from "./IFile";
import { IFolder } from "./IFolder";

export interface IFolderContents {
    name: string;
    folders: IFolder[];
    files: IFile[];
}