import { AccessibilityStatus } from "../components/helpers";

export interface IFile {
    name: string;
    path: string;
    size: string; // Size in bytes or megabytes
    mimeType: string; // MIME type of the file, optional
    isAccessible: AccessibilityStatus; // Accessibility property
    customProperties: { [key: string]: any }; // Custom properties
}