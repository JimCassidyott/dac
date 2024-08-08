export interface IFile {
    name: string;
    size: string; // Size in bytes or megabytes
    mimeType: string; // MIME type of the file, optional
    isAccessible: boolean; // Accessibility property
    customProperties: { [key: string]: any }; // Custom properties
}
