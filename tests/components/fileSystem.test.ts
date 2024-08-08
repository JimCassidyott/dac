
// import { SystemAdapter } from '../../src/components/fileSystem';

// import * as fs from 'fs/promises';

// jest.mock('fs/promises');
// const sa = new SystemAdapter();

// describe('getFiles', () => {
//     const mockFs = fs as jest.Mocked<typeof fs>;

//     it('should retrieve .docx files successfully', async () => {
//         mockFs.access.mockResolvedValueOnce(undefined);
//         mockFs.readdir.mockResolvedValueOnce([
//             { name: 'file1.docx', isFile: () => true },
//             { name: 'file2.docx', isFile: () => true },
//             { name: 'file3.txt', isFile: () => true },
//             { name: 'folder', isFile: () => false }
//         ] as any);

//         const files = await sa.getFiles('/path/to/directory');
//         expect(files).toEqual([
//             { name: 'file1.docx', size: '0', mimeType: 'mimetype', isAccessible: true, customProperties: {} },
//             { name: 'file2.docx', size: '0', mimeType: 'mimetype', isAccessible: true, customProperties: {} }
//         ]);
//     });

//     it('should throw an error if the directory does not exist', async () => {
//         mockFs.access.mockRejectedValueOnce({ code: 'ENOENT' });

//         await expect(sa.getFiles('/non/existent/directory')).rejects.toThrow('Directory does not exist: /non/existent/directory');
//     });

//     it('should throw an error if permission is denied', async () => {
//         mockFs.access.mockRejectedValueOnce({ code: 'EACCES' });

//         await expect(sa.getFiles('/restricted/directory')).rejects.toThrow('Permission denied: /restricted/directory');
//     });

//     it('should return an empty array if no .docx files are found', async () => {
//         mockFs.access.mockResolvedValueOnce(undefined);
//         mockFs.readdir.mockResolvedValueOnce([
//             { name: 'file1.txt', isFile: () => true },
//             { name: 'file2.pdf', isFile: () => true }
//         ] as any);

//         const files = await sa.getFiles('/path/to/directory');
//         expect(files).toEqual([]);
//     });
// });