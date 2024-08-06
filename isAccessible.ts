import * as fs from 'fs';
import * as path from 'path';
// import AdmZip from 'adm-zip';
const AdmZip = require('adm-zip');
import * as xml2js from 'xml2js';

// Get the file path from command line arguments
const filePath: string = process.argv[2];

if (!filePath) {
    console.error('Please provide a file path as an argument.');
    process.exit(1);
}

// Check if the file is a Word document
const fileExtension: string = path.extname(filePath).toLowerCase();

if (fileExtension !== '.docx') {
    throw new Error('The provided file is not a Word document (.docx)');
}

/**
 * Reads the custom properties XML of a Word document.
 *
 * @param {string} filePath - The path to the Word document.
 * @return {Promise<Object | undefined>} A Promise that resolves to an object representing the custom properties.
 *                                       Returns undefined if no custom properties are found.
 * @throws {Error} If there is an error reading or parsing the custom properties XML.
 */
async function readCustomPropertiesXml(filePath: string): Promise<any | undefined> {
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
async function checkAccessibility(filePath: string): Promise<boolean> {
    // Read the custom properties XML
    const result = await readCustomPropertiesXml(filePath);
    let isAccessible: boolean = false;
    if (result && result.Properties && result.Properties.property) {
        result.Properties.property.forEach((prop: any) => {
            if (prop.$.name === "isAccessible") {
                isAccessible = prop["vt:bool"] == 1;
            }
        });
    } else {
        console.log("No custom properties found in this document.");
    }
    return isAccessible;
}

const r: Promise<boolean> = checkAccessibility(filePath);
r.then((a: boolean) => {
    console.log(a);
}).catch((e: Error) => {
    console.log(e);
});

