import * as fs from 'fs/promises';
import { isPDFDoc } from './helpers';
import { PDFDocument } from 'pdf-lib';
import { AccessibilityStatus } from './helpers';
import { getBasicUserInfo } from './user';
import { GCDocsAdapter } from './GCDocsAdaptor';
import { PdfAccessibilityChecker, AccessibilityReport } from './pdfAccessibilityChecker';
import * as path from 'path';

const PDFLIB_EncryptedPDFError_MESSAGE = "Input document to `PDFDocument.load` is encrypted. You can use `PDFDocument.load(..., { ignoreEncryption: true })` if you wish to load the document anyways.";

/**
 * Takes a path to a PDF file and returns a PDFDocument object
 *
 * @param {string} filePath - The path to the PDF document.
 * @return {Promise<PDFDocument>} A Promise that resolves to an PDFDocument object.
 */
async function getPDFDocument(filePath: string): Promise<PDFDocument> {
  if (!isPDFDoc(filePath)) {
    throw new Error("Provided file is not a PDF document.");
  }
  try {
    const existingPdfBytes = await fs.readFile(filePath);

    // Load a PDFDocument without updating its existing metadata
    const pdfDoc = await PDFDocument.load(existingPdfBytes, {
      updateMetadata: false
    });

    return pdfDoc;
  } catch (error) {
    throw error;
  }
}

/**
 * Asynchronously checks the accessibility of a PDF document by reading its keywords field in its metadata.
 *
 * @param {string} filePath - The path to the pdf document.
 * @return {Promise<AccessibilityStatus>} A Promise that resolves to an AccessibilityStatus enum value.
 */
export async function isAccessible(filePath: string, fileSource: string): Promise<AccessibilityStatus> {
  if (fileSource === 'GCDOCS') {
    let adapter = new GCDocsAdapter();
    filePath = await adapter.downloadDocumentContent(filePath);
  }

  try {
    const pdfDoc: PDFDocument = await getPDFDocument(filePath);
    const keywords = pdfDoc.getKeywords();
  
    if (!keywords) {
      return AccessibilityStatus.Untested;
    }
    const metadata = JSON.parse(keywords);
    const accessibilityStatus = metadata.isAccessible;

    if (accessibilityStatus === 'Accessible') {
      return AccessibilityStatus.Accessible;
    } else if (accessibilityStatus === 'Not Accessible') {
      return AccessibilityStatus.NotAccessible;
    } else if (accessibilityStatus === 'Manual Testing Required') {
      return AccessibilityStatus.ManualTestingRequired;
    } else {
      return AccessibilityStatus.Untested;
    }
  } catch (error) {
    console.error('Error parsing metadata:', error);
    return AccessibilityStatus.Untested;
  }
}

/**
 * Asynchronously updates the isAccessible property of a PDF document by reading and updating its keywords field in its metadata.
 * If isAccessible does not exist in the current keywords field, it is added.
 *
 * @param {string} filePath - The path to the pdf document.
 * @param {AccessibilityStatus} accessibilityStatus - The new accessibility status to set.
 * @return {Promise<AccessibilityStatus>} The new accessibility status if successful.
 */
export async function updateIsAccessibleProperty(
  filePath: string,
  accessibilityStatus: AccessibilityStatus
): Promise<AccessibilityStatus> {
  try {
    const pdfDoc: PDFDocument = await getPDFDocument(filePath);
    const keywords = pdfDoc.getKeywords();

    let metadata: Record<string, any> = {};

    if (keywords) {
      try {
        metadata = JSON.parse(keywords);
      } catch (error) {
        console.error('Error parsing existing metadata:', error);
      }
    }

    // Update or add the isAccessible field
    metadata.isAccessible = accessibilityStatus;

    // Add the username of the person updating the property
    const username = getBasicUserInfo().username;
    metadata.accessibilityStatusUpdatedBy = username;

    // Save the updated metadata back to the PDF
    pdfDoc.setKeywords([JSON.stringify(metadata)]);

    const pdfBytes = await pdfDoc.save();
    await fs.writeFile(filePath, pdfBytes);

    return accessibilityStatus;
  } catch (error) {
    if (error.message.includes(PDFLIB_EncryptedPDFError_MESSAGE)) {
      return accessibilityStatus;
    }
    console.error('Error updating isAccessible property:', error);
    throw new Error('Failed to update the isAccessible property of the PDF.');
  }
}

// dummy function to mimic testing a pdf file
export async function testPDFAccessibility(filePath: string, fileSource: string) {
  try{
    if (fileSource === 'GCDOCS') {
      let adapter = new GCDocsAdapter();
      filePath = await adapter.downloadDocumentContent(filePath);
    }
    // do testing here
    let outPath = `./temp/PDFTestResults/${path.basename(filePath).replace(/\.pdf$/i, '')}-accessibility-report.json`;
    let result: AccessibilityReport = await PdfAccessibilityChecker.checkAccessibility(filePath);
    let accStatus: AccessibilityStatus = result.passed ? AccessibilityStatus.ManualTestingRequired : AccessibilityStatus.NotAccessible; 
    
    // once automated testing is done set isAccessible property as AccessibilityStatus.RequiresManualTesting
    let fileIsAccessible = await updateIsAccessibleProperty(filePath, accStatus);
    return {filePath, fileIsAccessible};
  }
  catch (error) {
    console.error(`function testPDFAccessibility: ${error}`);
    throw(error);
  }
}


async function main() {
  const filePath = 'C:\\Users\\hatharasinghageth\\Documents\\Test\\dac\\src\\components\\bad.pdf';

  const test = await isAccessible(filePath, "SYSTEM");
  console.log(`Initial accessibility status: ${test}`);

  console.log("set accessibilty status to AccessibilityStatus.NotAccessible");
  await updateIsAccessibleProperty(filePath, AccessibilityStatus.NotAccessible);
  console.log(`Updated accessibility status: ${await isAccessible(filePath, "SYSTEM")}`);

  console.log("set accessibilty status to AccessibilityStatus.ManualTestingRequired");
  await updateIsAccessibleProperty(filePath, AccessibilityStatus.ManualTestingRequired);
  console.log(`Updated accessibility status: ${await isAccessible(filePath, "SYSTEM")}`);
}

if (require.main === module) {
  main();
}
