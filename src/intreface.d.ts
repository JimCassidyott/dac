import { IFile } from './Interfaces/iFile';
import { FileSystem } from './components/fileSystem';


export interface MyAPI {
  desktop: Array<string>,
}



declare global {
  interface Window {
    myAPI: MyAPI,
  }
}