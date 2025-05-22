import { execSync } from 'child_process';
import * as fs from 'fs';
import * as pa11y from 'pa11y';
import { GCDocsAdapter } from './GCDocsAdaptor';
const cheerio = require('cheerio');
import { MSWordComments } from './MSWordComments';
import { HeadingError } from './Headings';
import { testHeadings } from './MSWordHeaders';
import { AccessibilityStatus } from './helpers';
import { app } from 'electron';
import { join } from 'path';
import puppeteer = require('puppeteer');



const errorCodesToIgnore = [
    'WCAG2AAA.Principle3.Guideline3_1.3_1_1.H57.3.Lang',
    'WCAG2AAA.Principle3.Guideline3_1.3_1_1.H57.3.XmlLang',
];

const pa11yOptions = {
    standard: 'WCAG2AAA', // You can change this to other standards like 'Section508' or 'WCAG21AA'
};

/**
 * Runs a Pandoc command synchronously. Throws an exception if the command
 * doesn't run successfully.
 *
 * @param {string} command - The Pandoc command to run.
 */
function convertDocxToHtml(inputFilePath: string, outputFilePath: string): void {
    const command = `pandoc "${inputFilePath}" -f docx -t html -o "${outputFilePath}" --standalone --metadata title=deleteme`;
    try {
        execSync(command);
    } catch (error) {
        throw new Error(`Error running Pandoc command: ${error.message}`);
    }
}

/**
 * Checks if a given input file is accessible by converting it to HTML and
 * running accessibility checks on the resulting HTML.
 *
 * @param {string} inputFilePath - The path to the input file.
 * @param {string} fileSource - string 'SYSTEM' | 'GCDOCS' indicating where the source of the file is
 * @return {Promise<{filePath: string, fileIsAccessible: boolean}>} A promise that resolves to an object containing a AccessibilityStatus object indicating
 * whether the input file is accessible and a string indicating the path to the file that was tested.
 */
export async function testAccessiblity(filePath: string, fileSource: string): Promise<{ filePath: string, fileIsAccessible: AccessibilityStatus }> {
    try {
        // Check if the input file exists
        if (fileSource === 'GCDOCS') {
            let adapter = new GCDocsAdapter();
            filePath = await adapter.downloadDocumentContent(filePath);

        }
        if (!fs.existsSync(filePath)) {
            throw new Error(`Input file does not exist: ${filePath}`);
        }
        const outputFilePath = filePath + '.html';
        // Run the Pandoc command synchronously
        convertDocxToHtml(filePath, outputFilePath);
        const chromiumPath = getChromiumPath();
        const browser = await puppeteer.launch({
            executablePath: chromiumPath,
            headless: true,
        });
        // Use pa11y to check the HTML file for accessibility issues
        const results = await pa11y(outputFilePath, {...pa11yOptions, browser,} as any);
        await browser.close();
        const filteredResults = results.issues.filter(issue => !errorCodesToIgnore.includes(issue.code));
        for (let i = 0; i < filteredResults.length; i++) {
            const issue = filteredResults[i];
            const htmlContext = issue.context;

            // Parse the context using cheerio to extract text content
            const $ = cheerio.load(htmlContext);
            const targetText = $(htmlContext).text();
            const msWordComments = new MSWordComments();
            await msWordComments.addComment(filePath, targetText, `${issue.code} \n${issue.message}`);
        }

        let fileIsAccessible = filteredResults.length === 0 ? AccessibilityStatus.Accessible : AccessibilityStatus.NotAccessible;
        let headingErrors = await testHeadings(filePath);
        fs.unlink(outputFilePath, (err) => {
          if (err) throw (err);
          console.log(`Successfully deleted file: ${outputFilePath}`);
        });
        return { filePath, fileIsAccessible };
    } catch (error) {
        // Check if error is related to headers and add a comment
        const msWordComments = new MSWordComments();

        if (error instanceof HeadingError) {
            const headerIssueMessage = `Error Code ${error.errorCode}: ${error.message}`;
            await msWordComments.addComment(
                filePath,
                'Header Issue Detected', // Target location placeholder
                headerIssueMessage
            );
            console.log(`Added comment for header issue: ${headerIssueMessage}`);
        } else {
            console.error('An unexpected error occurred:', error);
        }
        console.error(`Error during conversion or accessibility check: ${error.message}`);
        throw error;
    }
}

function getChromiumPath(): string {
    console.log(`isDevMode: ${isDevMode()}`)
  if (isDevMode()) {
    // Dev environment — use Puppeteer's built-in executable path
    return puppeteer.executablePath();
  } else {
    const base = join(app.getAppPath(), '..');
    const platforms = fs.readdirSync(base);
    const win64Folder = platforms.find(p => p.includes('win64'));
    if (!win64Folder) throw new Error('No Chromium folder found in resources');
    return join(base, win64Folder, 'chrome.exe'); 
  }
}

function isDevMode(): boolean {
  return process.env.ELECTRON_IS_DEV === '1'
    || process.defaultApp === true
    || /[\\/]electron[\\/]/.test(process.execPath);
}

// async function exampleUsage() {
//     const filePath = 'C:\\Users\\jimca\\Documents\\x\\jim.docx';
//     const isAccessible = true; // or false, depending on the desired value

//     try {
//         await changeIsAccessibleProperty(filePath, isAccessible);
//         console.log('The isAccessible property has been updated successfully.');
//     } catch (error) {
//         console.error('Error updating the isAccessible property:', error);
//     }
// }

// exampleUsage();