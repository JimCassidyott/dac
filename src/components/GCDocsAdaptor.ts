import * as fs from 'fs/promises';
import * as path from 'path';
import * as mime from 'mime-types'; // Ensure correct import
import { IFileSystem } from '../Interfaces/IFileSystem';
import { IFile } from '../Interfaces/IFile';
import { IFolder } from '../Interfaces/IFolder';
import { IFolderContents } from '../Interfaces/IFolderContents';
import FormData = require('form-data');
import * as fsSync from 'fs';
import { request } from 'undici';
import { AccessibilityStatus } from "../components/helpers";
import { isPDFDoc, isWordDOC } from './helpers';

/**
 * An implementation of the IFileSystem interface for interacting with theSystem file system.
 */
 export class GCDocsAdapter implements IFileSystem {
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
            process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = '0';
            const GCdocsAPIURL = 'https://dev.gcdocs.gc.ca/csc-scc/llisapi.dll/api/v1/auth';
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
            console.error(`error at auth ${error}`)
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
                .filter((item: { type: number; name: string }) => (item.type == 144)) //type 144 should be documents but i guess GCdocs
                .map((item: { name: string; id: number; mime_type: string; size: number }) => {                                  
                    return {                                                                                                    
                        name: item.name, // Name of the file
                        path: `${item.id}/${item.name}`, // Path of the file
                        size: item.size, // Size in bytes or megabytes
                        mimeType: item.mime_type, // MIME type of the file, optional
                        isAccessible: AccessibilityStatus.Untested, // Accessibility property
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
     * @return {Promise<IFolderContents>} A promise that resolves to an array of IFolderContents objects representing the contents of the folder.
     */
    public async getFolderContents(directoryPath: string): Promise<IFolderContents> {
        const dirURL = `https://dev.gcdocs.gc.ca/csc-scc/llisapi.dll/api/v1/nodes/${directoryPath}/nodes`;
        try{

            let folders = await this.getFolders(dirURL);
            let files = await this.getFiles(dirURL);
            return {
                    name: directoryPath,
                    folders: folders,
                    files: files
                };
            
        }
        catch(error) {
            throw error;
        }
    }

    /**
     * Lists all files and directories in the given directory separately, including subdirectories.
     *
     * @param {string} dirPath - The path to the directory.
     * @returns {Promise<{files: string[], directories: string[]}>} - An object containing lists of files and directories.
     */
     public async listFilesAndDirectories(dirPath: string): Promise<{files: string[], directories: string[]}> {
        const result: {files: string[], directories: string[]} = { files: [], directories: [] };

        try {            
            const items: IFolderContents = await this.getFolderContents(dirPath);
            result.files.push(...items.files.map(file => file.path.toString()));
            for (const item of items.folders){
                result.directories.push(item.path);
                const subDirContents = await this.listFilesAndDirectories(item.path);
                result.files.push(...subDirContents.files);
                result.directories.push(...subDirContents.directories);
            }

            return result;
        } catch (error) {
            console.error(`Error reading directory: ${error.message}`);
            return result;
        }
    }

    public async listDocxFiles(dirPath: string): Promise<string[]> {
        const { files } = await this.listFilesAndDirectories(dirPath);
        const results = await Promise.all(
            files.map(async (file) => ({
                file,
                isWordDoc: await isWordDOC(file, "GCDOCS")
            }))
        );
        const docxFiles = results.filter(result => result.isWordDoc).map(result => result.file);
        return docxFiles; 
    }

    public async listPDFFiles(dirPath: string): Promise<string[]> {
        let { files } = await this.listFilesAndDirectories(dirPath);
        const results = await Promise.all(
            files.map(async (file) => ({
                file,
                isPDFDoc: await isPDFDoc(file)
            }))
        );
        const pdfFiles = results.filter(result => result.isPDFDoc).map(result => result.file);
        return pdfFiles; 
    }

    /**
     * Download the document at the given node and save it at /src/temp/GCdocsDownloadedDocuments/
     *
     * @param {string} nodeID - The path to the node.
     * @returns {Promise<string>} - Path to the saved file.
     */
    public async downloadDocumentContent(nodeID: string): Promise<string> {
        let nodeURL = `https://dev.gcdocs.gc.ca/csc-scc/llisapi.dll/api/v1/nodes/${nodeID.toString().split("/")[0]}/content`;
        try{
            const response = await fetch(nodeURL, {
                method: 'GET',
                headers: await this.getAuthHeaders(),
            });
            
            if (!response.ok) {   
                let errorData = await response.text();
                throw new Error(`Failed to fetch folder content ${errorData}`);
            }
            let buffer = await response.arrayBuffer();
            let fName = await response.headers.get('content-disposition').match(/filename="?([^"]+)"?/)?.[1];
            await fs.writeFile(`./temp/GCdocsDownloadedDocuments/${fName}`,Buffer.from(buffer));
            return `./temp/GCdocsDownloadedDocuments/${fName}`;
        }
        catch(error) {
            throw error;
        }
    }

    /**
     * upload a document that was downloaded from GCdocs for testing 
     *
     * @param {string} filePath - path to the local file to be uploaded. 
     * @param {string} nodeID - The path to the node.
     * @returns {Promise<boolean | Error>} - true if it successfully uploads the document, throw error otherwise. 
     */
    public async uploadDocumentContent(filePath: string, nodeID: string): Promise<boolean | Error>{
        let nodeURL = `https://dev.gcdocs.gc.ca/csc-scc/llisapi.dll/api/v1/nodes/${nodeID.toString().split("/")[0]}/versions`;
        try{
            let formData = new FormData();

            formData.append("file", fsSync.createReadStream(filePath));
            formData.append("description", "DAC: accessibility tested file");
            const contentLength = await new Promise<number>((resolve, reject) => {
                formData.getLength((err, length) => {
                    if (err) reject(err);
                    resolve(length);
                })
            });

            //call getAuthHeaders() to make sure OTCSTicket is set and valid, use this.OTCSTocket in headers {} bc we are using formdata.getHeaders() (different content type)
            await this.getAuthHeaders();
            const headers = {
                "OTCSTicket": this.OTCSTicket,
                // "User-Agent": `DAC/0.8 (Node.js v${process.version})`,
                "Accept-Encoding": "gzip, deflate",
                "Accept": "*/*",
                "Connection": "keep-alive",
                "Content-Length": contentLength.toString(),
                ...formData.getHeaders()
            }

            //use request from undici instead of fetch bc fetch throws type error when Content-Length header is manually added
            const response = await request(nodeURL, {
                method: "POST",
                body: formData,
                headers
            })

            if (response.statusCode != 200) {   
                let errorData = await response.body.json();
                throw new Error(`Failed to fetch folder content ${errorData}`);
            }
            
            return true;
        }
        catch (error){
            // throw error;
            console.error(error);
            return false;
        }
    }
}

