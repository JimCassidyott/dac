import * as fs from 'fs/promises';
import * as path from 'path';
import * as mime from 'mime-types'; // Ensure correct import
import { IFileSystem } from '../Interfaces/IFileSystem';
import { IFile } from '../Interfaces/iFile';
import { IFolder } from '../Interfaces/iFolder';
import { IFolderContents } from '../Interfaces/iFolderContents';

/**
 * An implementation of the IFileSystem interface for interacting with theSystem file system.
 */
 export class GCDocsAdapter implements IFileSystem {
    // private authUrl: string;
    private OTCSTicket: string | null;

    constructor() {
        this.OTCSTicket = null;
    }

    /**
     * Authenticates to the GCdocs API and sets the OTCSTicket
     *
     * @return {Promise<void>}
     */
    private async authenticate(): Promise<void> {
        try{
            const username = process.env.GCDOCS_USERNAME;
            const password = process.env.GCDOCS_PASSWORD;
            const GCdocsAPIURL = 'https://dev.gcdocs.gc.ca/csc-scc/llisapi.dll/api/v1/auth';
            const postData = {username: username, password: password};
            const response = await fetch(GCdocsAPIURL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: new URLSearchParams({
                    username: username,
                    password: password
                }).toString(),
            });
            if (!response.ok) {
                let errorData = await response.text();
                throw new Error(`failed to authentiate: ${response.statusText}\n errorData: ${errorData}`);
            }
            let result = await response.json();
            this.OTCSTicket = result.ticket;
        }
        catch(error){
            console.error(error)
            throw error;            
        }
    }

    private async getAuthHeaders(): Promise<Headers> {
        if (!this.OTCSTicket) {
            await this.authenticate();
        }
        const headers = new Headers();
        headers.append('OTCSTicket', this.OTCSTicket);
        headers.append('Content-Type', 'application/x-www-form-urlencoded')
        return headers;
    }

    public async getFiles(directoryPath: string): Promise<IFile[]> {
        try{
            const response = await fetch(directoryPath, {
                method: 'GET',
                headers: await this.getAuthHeaders(),
            });
            
            if (!response.ok) {   
                let errorData = await response.text();
                throw new Error(`Failed to fetch folder content ${errorData}`);
            }
            let jsonResponse = await response.json();
            
            const fileList: IFile[] = jsonResponse.data
                .filter((item: { type: number; }) => item.type == 144)
                .map((item: { name: string; id: number; mime_type: string; size: number }) => {
                    return {
                        name: item.name, // Name of the file
                        path: item.id, // Path of the file
                        size: item.size, // Size in bytes or megabytes
                        mimeType: item.mime_type, // MIME type of the file, optional
                        isAccessible: false, // Accessibility property
                        customProperties: {} // Custom properties
                    };
                });

            return fileList;
        }
        catch(error) {
            throw error;
        }
    }

    /**
     * Retrieves a list of folders within the specified directory.
     *
     * @param {string} directoryPath - The path to the directory to retrieve folders from.
     * @return {Promise<IFolder[]>} A promise that resolves to an array of IFolder objects representing the folders.
     */
    public async getFolders(directoryPath: string): Promise<IFolder[]> {
        // Implementation specific to GC Docs file system
        try{
            const response = await fetch(directoryPath, {
                method: 'GET',
                headers: await this.getAuthHeaders(),
            });
            
            if (!response.ok) {   
                let errorData = await response.text();
                throw new Error(`Failed to fetch folder content ${errorData}`);
            }
            let jsonResponse = await response.json();

            let folderList: IFolder[] = jsonResponse.data
                .filter((item: { type: number; }) => item.type == 0) // type 0 is for folders
                .map((item: {name: string; id: number }) => {
                    return {
                        name: item.name,
                        fileCount: 0,
                        path: item.id
                    };
                });
            return folderList;
        }
        catch(error) {
            throw error;
        }
    }

    /**
     * Retrieves the contents of a folder at the specified directory path.
     *
     * @param {string} directoryPath - The path of the directory.
     * @return {Promise<IFolderContents[]>} A promise that resolves to an array of IFolderContents objects representing the contents of the folder.
     */
    public async getFolderContents(directoryPath: string): Promise<IFolderContents[]> {
        const dirURL = `https://dev.gcdocs.gc.ca/csc-scc/llisapi.dll/api/v1/nodes/${directoryPath}/nodes`;
        try{

            let folders = await this.getFolders(dirURL);
            let files = await this.getFiles(dirURL);
            return [
                {
                    name: dirURL,
                    folders: folders,
                    files: files

                }
            ]
            
        }
        catch(error) {
            throw error;
        }
    }
}

