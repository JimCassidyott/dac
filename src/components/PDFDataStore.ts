
import { join } from 'path';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { AccessibilityStatus, createFolderIfNotxist } from './helpers';

const DATA_PATH = join(__dirname.replace("\\src\\components", ""), "data", 'DAC_data.json');

type DACData = Record<string, AccessibilityStatus>;

/**
 * Ensure the data file exists. If not, create it with an empty object.
 */
function ensureDataFileExists() {
  if (!existsSync(DATA_PATH)) {
    createFolderIfNotxist(DATA_PATH.replace('\\DAC_data.json', ""));
    writeFileSync(DATA_PATH, JSON.stringify({}, null, 2), 'utf-8');
  }
}

/**
 * Load the current data from the JSON file.
 */
function loadData(): DACData {
  ensureDataFileExists();
  const raw = readFileSync(DATA_PATH, 'utf-8');
  return JSON.parse(raw);
}

/**
 * Save updated data to the JSON file.
 */
function saveData(data: DACData) {
  writeFileSync(DATA_PATH, JSON.stringify(data, null, 2), 'utf-8');
}

/**
 * Add or update a PDF file's accessibility status.
 */
export function updatePDFStatus(fullPath: string, status: AccessibilityStatus) {
  const data = loadData();
  data[fullPath] = status;
  saveData(data);
}

/**
 * Get the accessibility status of a specific PDF file.
 */
export function getPDFStatus(fullPath: string): AccessibilityStatus | undefined {
  const data = loadData();
  let pdfStatus = data[fullPath];
  if (!pdfStatus) { 
    updatePDFStatus(fullPath, AccessibilityStatus.Untested);
    return AccessibilityStatus.Untested;
  }  
  return data[fullPath];
}


function main() {
  const pdfPath = "C:\\Users\\hatharasinghageth\\Documents\\Test\\dac\\demo_files\\untested\\1383e.pdf";
  console.log(`getPDFStatus(pdfPath): ${getPDFStatus(pdfPath)}`);
  updatePDFStatus(pdfPath, AccessibilityStatus.Accessible)
  console.log(`getPDFStatus(pdfPath): ${getPDFStatus(pdfPath)}`);
}

if (require.main === module) {
  main();
}
