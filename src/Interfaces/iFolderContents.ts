import { IFile } from "./iFile";
import { IFolder } from "./iFolder";

export interface IFolderContents {
    name: string;
    folders?: IFolder[];
    files?: IFile[];
}

