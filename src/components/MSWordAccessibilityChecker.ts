const AdmZip = require('adm-zip'); // Using require here is important. If you use import, it will throw an error.
import { Builder, parseStringPromise } from 'xml2js';
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as pa11y from 'pa11y';
import { GCDocsAdapter } from './GCDocsAdaptor';
const cheerio = require('cheerio');
import { MSWordComments } from './MSWordComments';
import { Heading, HeadingError, HeadingErrorCode } from './Headings';
import { testHeadings } from './MSWordHeaders';
import { isWordDOC, AccessibilityStatus } from './helpers';
import { MSOfficeMetadata } from './MSOfficeMetadata';

const errorCodesToIgnore = [
    'WCAG2AAA.Principle3.Guideline3_1.3_1_1.H57.3.Lang',
    'WCAG2AAA.Principle3.Guideline3_1.3_1_1.H57.3.XmlLang',
];

const pa11yOptions = {
    standard: 'WCAG2AAA', // You can change this to other standards like 'Section508' or 'WCAG21AA'
};

/**
 * Asynchronously checks the accessibility of a Word document by reading its custom properties XML.
 *
 * @param {string} filePath - The path to the Word document.
 * @return {Promise<AccessibilityStatus>} A Promise that resolves to an AccessibilityStatus enum value.
 */
export async function isAccessible(filePath: string, fileSource: string): Promise<AccessibilityStatus> {
    if (fileSource === 'GCDOCS') {
        let adapter = new GCDocsAdapter();
        filePath = await adapter.downloadDocumentContent(filePath);

    }
    // Read the custom properties XML
    const customProperties = await MSOfficeMetadata.readCustomPropertiesXml(filePath);
    if (!customProperties || !customProperties.Properties || !customProperties.Properties.property) {
        return AccessibilityStatus.Untested;
    }

    let accessibilityStatus: AccessibilityStatus = AccessibilityStatus.Untested;
    if (customProperties && customProperties.Properties && customProperties.Properties.property) {        
        customProperties.Properties.property.forEach((prop: any) => {
            if (prop.$.name === "isAccessible") {

              accessibilityStatus = prop["vt:bool"] == '1' ? AccessibilityStatus.Accessible : AccessibilityStatus.NotAccessible;
            }
        });
    } else {
        console.log("No custom properties found in this document. Run the cecker.", filePath);
        accessibilityStatus = AccessibilityStatus.Untested;
    }
    return accessibilityStatus;
}

/**
 * Creates a new collection of custom properties with one boolean property called isAccessible set to false.
 * Returns a properly formatted XML string representing the custom properties for a Word document.
 *
 * @returns { string } An XML string representing a collection of custom properties with isAccessible set to false.
 */
function createCustomPropertyCollectionWithIsAccessibleProperty(): string {
    const xml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/custom-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes"><property fmtid="{D5CDD505-2E9C-101B-9397-08002B2CF9AE}" pid="2" name="isAccessible"><vt:bool>0</vt:bool></property></Properties>`;

    return xml;
}

// /**
//  * Opens a Word document, adds a custom property 'isAccessible' set to false while preserving existing properties,
//  * and saves the document.
//  *
//  * @param {string} filePath - The path to the .docx file.
//  * @throws {Error} If the file is not a .docx file or if there's an error processing the file.
//  */
// async function addIsAccessiblePropertyToDocument(filePath: string): Promise<void> {

//     try {
      
//         // Read the .docx file
//         const zip = await readDocxFile(filePath);

//         // Check if custom properties already exist
//         const customPropsFile = zip.file('docProps/custom.xml');
//         let existingProperties: any = {};
//         if (customPropsFile) {
//             const content = await customPropsFile.async('string');
//             existingProperties = await parseStringPromise(content, { explicitArray: false });
//         }

//         // Prepare the new custom properties
//         let newProperties: any;
//         if (Object.keys(existingProperties).length === 0) {
//             // If no existing properties, create new XML
//             newProperties = await parseStringPromise(createCustomPropertyCollectionWithIsAccessibleProperty());
//         } else {
//             // If properties exist, add or update the isAccessible property
//             newProperties = existingProperties;
//             if (!Array.isArray(newProperties.Properties.property)) {
//                 newProperties.Properties.property = [newProperties.Properties.property];
//             }
//             const isAccessibleProp = newProperties.Properties.property.find((p: any) => p.$.name === 'isAccessible');
//             if (isAccessibleProp) {
//                 isAccessibleProp['vt:bool'] = '0'; // Update existing property
//             } else {
//                 newProperties.Properties.property.push({
//                     $: { fmtid: "{D5CDD505-2E9C-101B-9397-08002B2CF9AE}", pid: (newProperties.Properties.property.length + 2).toString(), name: "isAccessible" },
//                     'vt:bool': '0'
//                 });
//             }
//         }

//         // Convert the properties back to XML
//         const builder = new Builder();
//         const xmlString = builder.buildObject(newProperties);

//         // Add or replace the custom.xml file in the .docx
//         zip.file('docProps/custom.xml', xmlString);

//         // Generate the new .docx file content
//         const newContent = await zip.generateAsync({ type: 'nodebuffer' });

//         // Write the new content back to the file
//         await fs.promises.writeFile(filePath, newContent);

//         console.log('isAccessible property has been added or updated in the document.');
//     } catch (err) {
//         console.error('Error processing .docx file:', err);
//         throw err;
//     }
// }

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

        // Use pa11y to check the HTML file for accessibility issues
        const results = await pa11y(outputFilePath, pa11yOptions as any)
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