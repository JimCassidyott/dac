import * as fs from 'fs/promises';
import { isPDFDoc } from './helpers';
import { PDFDocument } from 'pdf-lib';
import { AccessibilityStatus } from './accessibilityChecker';
import { getBasicUserInfo } from './user';

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
export async function isAccessible(filePath: string): Promise<AccessibilityStatus> {
  const pdfDoc: PDFDocument = await getPDFDocument(filePath);
  const keywords = pdfDoc.getKeywords();

  if (!keywords) {
    return AccessibilityStatus.Untested;
  }

  try {
    const metadata = JSON.parse(keywords);
    const accessibilityStatus = metadata.isAccessible;

    if (accessibilityStatus === 'Accessible') {
      return AccessibilityStatus.Accessible;
    } else if (accessibilityStatus === 'NotAccessible') {
      return AccessibilityStatus.NotAccessible;
    } else if (accessibilityStatus === 'ManualTesting') {
      return AccessibilityStatus.RequiresManualTesting;
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
    console.error('Error updating isAccessible property:', error);
    throw new Error('Failed to update the isAccessible property of the PDF.');
  }
}

// dummy function to mimic testing a pdf file
export async function testPDFAccessibility(filePath: string) {
  try{
    // do testing here
  
    // once automated testing is done set isAccessible property as AccessibilityStatus.RequiresManualTesting
    let fileIsAccessible = await updateIsAccessibleProperty(filePath, AccessibilityStatus.RequiresManualTesting);
    return {filePath, fileIsAccessible};
  }
  catch (error) {
    console.error(`function testPDFAccessibility: ${error}`);
    throw(error);
  }
}


async function main() {
  const filePath = '/home/tharindu/Downloads/new.pdf';

  const test = await isAccessible(filePath);
  console.log(`Initial accessibility status: ${test}`);

  await updateIsAccessibleProperty(filePath, AccessibilityStatus.RequiresManualTesting);

  const updatedTest = await isAccessible(filePath);
  console.log(`Updated accessibility status: ${updatedTest}`);
}

if (require.main === module) {
  main();
}
