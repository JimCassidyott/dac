import * as path from 'path';
const AdmZip = require('adm-zip'); // Using require here is important. If you use import, it will throw an error.
import * as xml2js from 'xml2js';

/**
 * Reads the custom properties XML of a Word document.
 *
 * @param {string} filePath - The path to the Word document.
 * @returns {Promise<Object | undefined>} A Promise that resolves to an object representing the custom properties,
 * or undefined if no custom properties are found.
 * @throws {Error} If there is an error reading or parsing the custom properties XML.
 */
async function readCustomPropertiesXml(filePath: string): Promise<any | undefined> {
    const fileExtension: string = path.extname(filePath).toLowerCase();
    if (fileExtension !== '.docx') {
        throw new Error('The provided file is not a Word document (.docx)');
    }

    try {
        // Read the .docx file as a zip
        const zip = new AdmZip(filePath);

        // Get the custom.xml file
        const customXml = zip.getEntry('docProps/custom.xml');

        // If no custom.xml file is found, return undefined
        if (!customXml) {
            console.log('No custom properties found in this document.');
            return;
        }

        // Extract the XML content
        const xmlContent: string = customXml.getData().toString('utf8');

        // Parse the XML
        const parser = new xml2js.Parser();
        const Properties = await parser.parseStringPromise(xmlContent);

        // Return the custom properties object
        return Properties;

    } catch (error) {
        // If there is an error, throw an error with the message
        console.error('Error:', error.message);
        throw error;
    }
}
/**
 * Asynchronously checks the accessibility of a Word document by reading its custom properties XML.
 *
 * @param {string} filePath - The path to the Word document.
 * @return {Promise<boolean>} A Promise that resolves to a boolean indicating whether the document is accessible.
 */
export async function isAccessible(filePath: string): Promise<boolean> {
    // Read the custom properties XML
    const customProperties = await readCustomPropertiesXml(filePath);
    if (!customProperties || !customProperties.Properties || !customProperties.Properties.property) {
        return false;
    }

    let isAccessibleFlag: boolean = false;
    if (customProperties && customProperties.Properties && customProperties.Properties.property) {
        customProperties.Properties.property.forEach((prop: any) => {
            if (prop.$.name === "isAccessible") {
                isAccessibleFlag = prop["vt:bool"] == 1;
            }
        });
    } else {
        console.log("No custom properties found in this document. Run the cecker.", filePath);
        isAccessibleFlag = false;
    }
    return isAccessibleFlag;
}

/**
 * Asynchronously checks if a file is a Word document (.docx) by verifying its file extension.
 *
 * @param {string} filePath The path to the file to be checked.
 * @return {Promise<boolean>} A Promise that resolves to a boolean indicating whether the file is a Word document.
 */
async function isWordDOC(filePath: string): Promise<boolean> {
    const fileExtension: string = path.extname(filePath).toLowerCase();
    if (fileExtension !== '.docx') {
        throw new Error('The provided file is not a Word document (.docx)');
    }

    return true; // Add a return statement here
}

/**
 * Asynchronously checks if a file is a Word document (.docx) by verifying its file extension.
 *
 * @param {string} filePath - The path to the file to be checked.
 * @returns {Promise<boolean>} - A Promise that resolves to a boolean indicating whether the file is a Word document.
 */
async function isWordDocument(filePath: string): Promise<boolean> {
    const fileExtension: string = path.extname(filePath).toLowerCase();
    return fileExtension === '.docx';
}

// const r: Promise<boolean> = checkAccessibility(filePath);
// r.then((a: boolean) => {
//     console.log(a);
// }).catch((e: Error) => {
//     console.log(e);
// });

