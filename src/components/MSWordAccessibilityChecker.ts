import { execSync } from 'child_process';
import * as fs from 'fs';
import * as pa11y from 'pa11y';
import { GCDocsAdapter } from './GCDocsAdaptor';
const cheerio = require('cheerio');
import { MSWordComments } from './MSWordComments';
import { HeadingError, HeadingErrorCode } from './Headings';
import { testHeadings } from './MSWordHeaders';
import { AccessibilityStatus, getHTMLReportPath } from './helpers';
import { app } from 'electron';
import { join, basename } from 'path';
import puppeteer = require('puppeteer');

interface HeadingErrorData {
  errorCode: HeadingErrorCode;
  message: string;
}

interface ResultIssue {
  code: string;
  context: string;
  message: string;
  selector: string;
  type: string;
  typeCode: number;
}

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
        const filteredResults: ResultIssue[] = results.issues.filter(issue => !errorCodesToIgnore.includes(issue.code));
        let headingErrors: HeadingError[] = [];
        for (let i = 0; i < filteredResults.length; i++) {
            const issue = filteredResults[i];
            console.log(issue);
            const htmlContext = issue.context;

            // Parse the context using cheerio to extract text content
            const $ = cheerio.load(htmlContext);
            let targetText = $(htmlContext).text();
            if (targetText.endsWith('...')) {
                targetText = targetText.slice(0, -3);
            }
            try {
                const msWordComments = new MSWordComments();
                console.log(targetText)
                await msWordComments.addComment(filePath, targetText, `${issue.code} \n${issue.message}`);
            }
            catch (error) {
                console.error(error);
            }
        }

        let fileIsAccessible = filteredResults.length === 0 ? AccessibilityStatus.Accessible : AccessibilityStatus.NotAccessible;
        fs.unlink(outputFilePath, (err) => {
            if (err) throw (err);
            console.log(`Successfully deleted file: ${outputFilePath}`);
        });
        try {
            await testHeadings(filePath);
        }
        catch (error) {
            if (error instanceof HeadingError) {
                headingErrors.push(error);
            }
        }
        generateWordAccessibilityHtmlReport(filePath,
            filteredResults,
            headingErrors.map(e => ({
                errorCode: e.errorCode,
                message: e.message
            }))
        );
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

function generateWordAccessibilityHtmlReport(
  filePath: string,
  issues: ResultIssue[],
  headingErrors: HeadingErrorData[]
): void {
  const fileName = basename(filePath);
  const passed = issues.length === 0 && headingErrors.length === 0;

  const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <title>Accessibility Report for ${fileName}</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 2em; line-height: 1.6; }
        h1 { border-bottom: 2px solid #333; }
        .status { font-size: 1.2em; font-weight: bold; margin: 1em 0; }
        .pass { color: green; }
        .fail { color: red; }
        .issue, .heading-issue {
          border: 1px solid #ccc;
          border-left: 4px solid #e74c3c;
          padding: 1em;
          margin: 1em 0;
        }
        .code { font-family: monospace; background: #f5f5f5; padding: 0.2em 0.4em; }
        .context { background: #f9f9f9; padding: 0.5em; margin-top: 0.5em; border: 1px dashed #ccc; white-space: pre-wrap; }
        footer { margin-top: 3em; font-style: italic; }
      </style>
    </head>
    <body>
      <h1>Accessibility Compliance Report for ${fileName}</h1>
      <div class="filepath"><strong>File path:</strong> ${filePath}</div>
      <div class="status ${passed ? 'pass' : 'fail'}">
        ${passed ? '✅ Passed: No accessibility issues found.' : '❌ Failed: Accessibility issues detected.'}
      </div>

      ${issues.length > 0 ? `<h2>Detected Issues (from pa11y)</h2>` : ''}
      ${issues.map(issue => `
        <div class="issue">
          <div><strong>Code:</strong> <span class="code">${issue.code}</span></div>
          <div><strong>Message:</strong> ${issue.message}</div>
          <div><strong>Selector:</strong> ${issue.selector}</div>
          <div><strong>Type:</strong> ${issue.type}</div>
          <div class="context"><strong>Context:</strong><br/>${issue.context}</div>
        </div>
      `).join('')}

      ${headingErrors.length > 0 ? `<h2>Heading Structure Issues</h2>` : ''}
      ${headingErrors.map(err => `
        <div class="heading-issue">
          <div><strong>Error Code:</strong> <span class="code">${err.errorCode}</span></div>
          <div><strong>Message:</strong> ${err.message}</div>
        </div>
      `).join('')}

      <footer>Report generated at ${new Date().toLocaleString()}</footer>
    </body>
    </html>
  `;

  const outputPath = getHTMLReportPath(fileName).replace(/\.docx$/i, '-accessibility-report.html');
  
  fs.writeFileSync(outputPath, html, 'utf-8');
  console.log(`✅ Word accessibility report saved to: ${outputPath}`);
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