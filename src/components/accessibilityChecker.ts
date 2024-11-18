import * as path from 'path';
const AdmZip = require('adm-zip'); // Using require here is important. If you use import, it will throw an error.
import * as xml2js from 'xml2js';
import { Builder, parseStringPromise } from 'xml2js';
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as pa11y from 'pa11y';
import * as JSZip from 'jszip';
import { create } from 'xmlbuilder2';
import { GCDocsAdapter } from './GCDocsAdaptor';

const errorCodesToIgnore = [
    'WCAG2AAA.Principle3.Guideline3_1.3_1_1.H57.3.Lang',
    'WCAG2AAA.Principle3.Guideline3_1.3_1_1.H57.3.XmlLang',
];

const pa11yOptions = {
    standard: 'WCAG2AAA', // You can change this to other standards like 'Section508' or 'WCAG21AA'
};


/**
 * Reads the custom properties XML of a Word document.
 *
 * @param {string} filePath - The path to the Word document.
 * @returns {Promise<Object | undefined>} A Promise that resolves to an object representing the custom properties,
 * or undefined if no custom properties are found.
 * @throws {Error} If there is an error reading or parsing the custom properties XML.
 */
export async function readCustomPropertiesXml(filePath: string): Promise<any | undefined> {
    const fileExtension: string = path.extname(filePath).toLowerCase();
    if (fileExtension !== '.docx') {
        console.log('The provided file is not a Word document (.docx)');
        return false

    }

    try {
        // Read the .docx file as a zip
        const zip = new AdmZip(filePath);

        // Get the custom.xml file
        const customXml = zip.getEntry('docProps/custom.xml');

        // If no custom.xml file is found, return undefined
        if (!customXml) {
            console.log('No custom properties found in this document.');
            return false;
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
        return false
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

                isAccessibleFlag = prop["vt:bool"] == '1' ? true : isAccessibleFlag;
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
export async function isWordDOC(filePath: string): Promise<boolean> {
    const fileExtension: string = path.extname(filePath).toLowerCase();
    if (fileExtension !== '.docx') {
        return false
    }

    return true; // Add a return statement here
}

/**
 * Reads the contents of a DOCX file and returns a JSZip object.
 * 
 * @param filePath - The path to the DOCX file.
 * @returns A promise that resolves to a JSZip object representing the contents of the DOCX file.
 * @throws Will throw an error if the file does not exist, if the file is not a valid DOCX file, or if there is an error reading the file.
 * 
 * @note This function assumes that the file exists and that it is a valid DOCX file.
 */
async function readDocxFile(filePath: string): Promise<JSZip> {
    // Check if the file exists
    if (!fs.existsSync(filePath)) {
        throw new Error('The file does not exist');
    }

    // Check if the file is a valid DOCX file
    if (!isValidDOCXFile(filePath)) {
        throw new Error('The file is not a valid DOCX file');
    }

    try {
        // Read the contents of the DOCX file
        const data = await fs.promises.readFile(filePath);
        // Load the contents into a JSZip object
        const zip = await JSZip.loadAsync(data);
        return zip;
    } catch (err) {
        throw new Error('Error reading the DOCX file: ' + err.message);
    }
}

/**
 * Checks if the given file path is a .docx file.
 * 
 * @param {string} filePath - The path to the file to check.
 * @throws {Error} If the file is not a .docx file. (may become a more robust check later
 *                - including mime file type check)
 * @returns {boolean} True if the file is a .docx file, false otherwise.    
 * 
 */
function isValidDOCXFile(filePath: string): boolean {
    return path.extname(filePath).toLowerCase() === '.docx';
}

/* Creates a new collection of custom properties with one boolean property called isAccessible set to false.
 * Returns a properly formatted XML string representing the custom properties for a Word document.
 * 
 * @returns { string } An XML string representing a collection of custom properties with isAccessible set to false.
 */
function createCustomPropertyCollectionWithIsAccessibleProperty(): string {
    const xml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/custom-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes"><property fmtid="{D5CDD505-2E9C-101B-9397-08002B2CF9AE}" pid="2" name="isAccessible"><vt:bool>0</vt:bool></property></Properties>`;

    return xml;
}

/**
 * Opens a Word document, adds a custom property 'isAccessible' set to false while preserving existing properties,
 * and saves the document.
 * 
 * @param {string} filePath - The path to the .docx file.
 * @throws {Error} If the file is not a .docx file or if there's an error processing the file.
 */
async function addIsAccessiblePropertyToDocument(filePath: string): Promise<void> {

    try {
        // Read the .docx file
        const zip = await readDocxFile(filePath);

        // Check if custom properties already exist
        const customPropsFile = zip.file('docProps/custom.xml');
        let existingProperties: any = {};
        if (customPropsFile) {
            const content = await customPropsFile.async('string');
            existingProperties = await parseStringPromise(content, { explicitArray: false });
        }

        // Prepare the new custom properties
        let newProperties: any;
        if (Object.keys(existingProperties).length === 0) {
            // If no existing properties, create new XML
            newProperties = await parseStringPromise(createCustomPropertyCollectionWithIsAccessibleProperty());
        } else {
            // If properties exist, add or update the isAccessible property
            newProperties = existingProperties;
            if (!Array.isArray(newProperties.Properties.property)) {
                newProperties.Properties.property = [newProperties.Properties.property];
            }
            const isAccessibleProp = newProperties.Properties.property.find((p: any) => p.$.name === 'isAccessible');
            if (isAccessibleProp) {
                isAccessibleProp['vt:bool'] = '0'; // Update existing property
            } else {
                newProperties.Properties.property.push({
                    $: { fmtid: "{D5CDD505-2E9C-101B-9397-08002B2CF9AE}", pid: (newProperties.Properties.property.length + 2).toString(), name: "isAccessible" },
                    'vt:bool': '0'
                });
            }
        }

        // Convert the properties back to XML
        const builder = new Builder();
        const xmlString = builder.buildObject(newProperties);

        // Add or replace the custom.xml file in the .docx
        zip.file('docProps/custom.xml', xmlString);

        // Generate the new .docx file content
        const newContent = await zip.generateAsync({ type: 'nodebuffer' });

        // Write the new content back to the file
        await fs.promises.writeFile(filePath, newContent);

        console.log('isAccessible property has been added or updated in the document.');
    } catch (err) {
        console.error('Error processing .docx file:', err);
        throw err;
    }
}

async function ensureThedocPropsCustomXmlExists(fileName: string): Promise<void> {
    const filePath = path.resolve(fileName);
    const zip = await JSZip.loadAsync(fs.readFileSync(filePath));

    // Extract or create custom.xml
    const customXmlPath = 'docProps/custom.xml';
    let customXml = await zip.file(customXmlPath)?.async('string');

    if (!customXml) {
        // If custom.xml doesn't exist, create a new one
        customXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
        <Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/custom-properties"
                    xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">
        </Properties>`;
    }

    // Parse the XML
    const customXmlObj = await parseStringPromise(customXml);

    // Add new custom properties
    const newProperties = [
        {
            '$': {
                'fmtid': '{D5CDD505-2E9C-101B-9397-08002B2CF9AE}',
                'pid': (customXmlObj.Properties.property?.length || 0) + 3,
                'name': 'isAccessible'
            },
            'vt:bool': [0]
        }
    ];

    customXmlObj.Properties.property = customXmlObj.Properties.property || [];
    // Check if the property already exists
    const existingPropertyIndex = customXmlObj.Properties.property.findIndex(
        (prop: any) => prop.$.name === 'isAccessible'
    );

    if (existingPropertyIndex === -1) {

        customXmlObj.Properties.property.push(...newProperties);
    }

    // Build the updated XML
    const builder = new Builder();
    const updatedCustomXml = builder.buildObject(customXmlObj);

    // Update the zip with the new custom.xml
    zip.file(customXmlPath, updatedCustomXml);

    // Save the updated document
    const updatedContent = await zip.generateAsync({ type: 'nodebuffer' });
    fs.writeFileSync(filePath, updatedContent);
    await new Promise(resolve => setTimeout(resolve, 1000));
}

/**
 * Updates the 'isAccessible' custom property in a Word document (.docx file)
 * 
 * @param {string} filePath - The path to the .docx file.
 * @returns {Promise<void>} A Promise that resolves when the update is complete.
 * @throws {Error} If the file is not a .docx file or if there's an error during the process.
 */
export async function changeIsAccessibleProperty(filePath: string, isAccessible: boolean): Promise<void> {
    try {
        ensureThedocPropsCustomXmlExists(filePath)
        const zip = await readDocxFile(filePath);
        const customPropsFile = zip.file('docProps/custom.xml');
        let content = await customPropsFile.async('string');
        const updatedContent = await updateIsAccessibleProperty(content, isAccessible);

        zip.file('docProps/custom.xml', updatedContent);
        const newContent = await zip.generateAsync({ type: 'nodebuffer' });
        await fs.promises.writeFile(filePath, newContent);

    } catch (err) {
        console.error('Error processing .docx file:', err);
        throw err;
    }
}

/**
 * Updates the 'isAccessible' property in the given XML string based on the provided boolean value.
 * 
 * @param xmlString - The XML string representing the custom properties collection from a Word document.
 * @param isAccessible - A boolean flag indicating the value for the 'isAccessible' property.
 * @returns A promise that resolves to the updated XML string with the 'isAccessible' property set.
 * @throws Will throw an error if the XML parsing or building fails.
 */
async function updateIsAccessibleProperty(xmlString: string, isAccessible: boolean): Promise<string> {
    try {
        // Parse the XML string into a JavaScript object
        const result = await parseStringPromise(xmlString);

        // Define the isAccessible property value
        const isAccessibleValue = isAccessible ? '1' : '0';

        // Find the isAccessible property and update its value
        if (result.Properties && result.Properties.property) {
            const properties = result.Properties.property;
            let isAccessibleProp = properties.find((prop: any) => prop.$.name === 'isAccessible');

            if (isAccessibleProp) {
                // Update existing property
                isAccessibleProp['vt:bool'] = isAccessibleValue;
            } else {
                // Add new property if it doesn't exist
                properties.push({
                    $: { fmtid: "{D5CDD505-2E9C-101B-9397-08002B2CF9AE}", pid: (properties.length + 2).toString(), name: "isAccessible" },
                    'vt:bool': isAccessibleValue
                });
            }
        } else {
            // Add Properties and property if they don't exist
            result.Properties = {
                property: [{
                    $: { fmtid: "{D5CDD505-2E9C-101B-9397-08002B2CF9AE}", pid: "2", name: "isAccessible" },
                    'vt:bool': isAccessibleValue
                }]
            };
        }

        // Convert the JavaScript object back to an XML string
        const builder = new Builder();
        const updatedXmlString = builder.buildObject(result);

        return updatedXmlString;
    } catch (err) {
        console.error('Error processing XML:', err);
        throw err;
    }
}

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
 * @return {Promise<{filePath: string, fileIsAccessible: boolean}>} A promise that resolves to an object containing a boolean indicating
 * whether the input file is accessible and a string indicating the path to the file that was tested.
 */
export async function testAccessiblity(filePath: string, fileSource: string): Promise<{filePath: string, fileIsAccessible: boolean}> {
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

        let fileIsAccessible = filteredResults.length === 0;
        return {filePath, fileIsAccessible};
    } catch (error) {
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