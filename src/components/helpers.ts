import * as path from 'path';
import { fromFile } from 'file-type';
import * as fs from 'fs';
import { homedir } from 'os';

/**
 * Asynchronously checks if a file is a Word document (.docx) by verifying its file extension and MIME type.
 *
 * @param {string} filePath The path to the file to be checked.
 * @return {Promise<boolean>} A Promise that resolves to a boolean indicating whether the file is a Word document.
 */
export async function isWordDOC(filePath: string, fileSource: string): Promise<boolean> {
    // Test 1: Check file extension
    // Quick validation to ensure the file has a .docx extension
    // This is a fast initial check before performing more intensive operations
    const fileExtension: string = path.extname(filePath).toLowerCase();
    if (fileExtension !== '.docx') {
        return false;
    }

    if (fileExtension === ".docx" && fileSource === "GCDOCS") { return true; }

    try {
        // Test 2: Validate MIME type
        // This checks the actual file content structure to ensure it's a valid Word document
        // The expected MIME type for Word documents is 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        // This test prevents false positives from files that are just renamed to .docx
        const fileType = await fromFile(filePath);
        return fileType?.mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    } catch (error) {
        // Log any errors that occur during MIME type checking
        // This could happen if the file is corrupted or if there are permission issues
        console.error('Error checking MIME type:', error);
        return false;
    }
}

export async function isPDFDoc(filePath: string): Promise<boolean> {
  // Test 1: Check file extension
  // Quick validation to ensure the file has a .pdf extension
  // This is a fast initial check before performing more intensive operations
  const fileExtension: string = path.extname(filePath).toLowerCase();
  if (fileExtension !== '.pdf') {
    return false;
  }
  return true;
}

export async function isPPTXDoc(filePath: string): Promise<boolean> {
  const fileExtension: string = path.extname(filePath).toLowerCase();
  if (fileExtension !== '.pptx') {
    return false;
  }
  return true;
}

export function getHTMLReportPath(fileName: string): string {
  try {
    if (path.extname(fileName) === '.pdf') { return path.join(createFolderIfNotxist('PDFTestResults'), fileName); }
    if (path.extname(fileName) === '.pptx') { return path.join(createFolderIfNotxist('PPTXTestResults'), fileName); }
  }
  catch (error) { throw error; }
}

function createFolderIfNotxist(folderPath: string): string {
  try {
    const __homedir = homedir();
    const fullPath = path.join(__homedir, 'Downloads', 'DAC', folderPath);
    if (!fs.existsSync(fullPath)) {
      fs.mkdirSync(fullPath, {recursive: true});
    }
    return fullPath;
  }
  catch (error) {
    throw new Error(`Error at createFolderIfNotxist: ${error}`)
  }
}

export enum AccessibilityStatus {
  Accessible = "Accessible",
  NotAccessible = "Not Accessible",
  Untested = "Untested",
  NotApplicable = "Not Applicable",
  ManualTestingRequired = "Manual Testing Required" //pdf specific
}
