import * as path from 'path';
const AdmZip = require('adm-zip'); // Using require here is important. If you use import, it will throw an error.
import * as xml2js from 'xml2js';
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as pa11y from 'pa11y';

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

                isAccessibleFlag = prop["vt:bool"] == 'true' ? true : isAccessibleFlag;
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
 * Reads the .docx file and returns the zip object.
 *
 * @param {string} filePath - The path to the Word document.
 * @returns {AdmZip} The zip object representing the .docx file.
 */
function readDocxFile(filePath: string): typeof AdmZip {
    const fileExtension: string = path.extname(filePath).toLowerCase();
    if (fileExtension !== '.docx') {
        throw new Error('The provided file is not a Word document (.docx)');
    }
    return new AdmZip(filePath);
}

/**
 * Gets or creates the custom.xml content from the zip object.
 *
 * @param {AdmZip} zip - The zip object representing the .docx file.
 * @returns {Promise<string>} The custom.xml content.
 */
async function getOrCreateCustomXmlContent(zip: typeof AdmZip): Promise<string> {
    const customXml = zip.getEntry('docProps/custom.xml');
    if (!customXml) {
        return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/custom-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes"></Properties>';
    }
    return customXml.getData().toString('utf8'); //FIXME: this line throws error "ADM-ZIP: No descriptor present" with some .docx files
}

/**
 * Updates or creates the isAccessible property in the custom properties XML.
 *
 * @param {any} properties - The parsed custom properties XML.
 * @param {boolean} isAccessible - The value to set for the isAccessible property.
 */
function updateIsAccessibleProperty(properties: any, isAccessible: boolean): void {
    let isAccessibleProperty = properties['property']?.find((prop: any) => prop.$.name === 'isAccessible');
    if (isAccessibleProperty) {
        isAccessibleProperty['vt:bool'] = isAccessible.toString();
    } else {
        if (!properties['property']) {
            properties['property'] = [];
        }
        properties['property'].push({
            $: { name: 'isAccessible', fmtid: '{D5CDD505-2E9C-101B-9397-08002B2CF9AE}', pid: properties['property'].length + 2 },
            'vt:bool': isAccessible.toString()
        });
    }
}

/**
 * Writes the updated custom.xml content back to the zip object and saves the .docx file.
 *
 * @param {typeOf AdmZip} zip - The zip object representing the .docx file.
 * @param {string} filePath - The path to the Word document.
 * @param {string} updatedXmlContent - The updated custom.xml content.
 */
function saveUpdatedDocxFile(zip: typeof AdmZip, filePath: string, updatedXmlContent: string): void {
    zip.updateFile('docProps/custom.xml', Buffer.from(updatedXmlContent, 'utf8'));
    zip.writeZip(filePath);
}

/**
 * Updates the isAccessible property in the custom properties XML of a Word document.
 *
 * @param {string} filePath - The path to the Word document.
 * @param {boolean} isAccessible - The value to set for the isAccessible property.
 * @returns {Promise<void>} A Promise that resolves when the update is complete.
 * @throws {Error} If there is an error reading or parsing the custom properties XML.
 */
export async function changeIsAccessibleProperty(filePath: string, isAccessible: boolean): Promise<void> {
    try {
        const zip = readDocxFile(filePath);
        const customXmlContent = await getOrCreateCustomXmlContent(zip);

        const parser = new xml2js.Parser();
        const builder = new xml2js.Builder();
        const result = await parser.parseStringPromise(customXmlContent);

        updateIsAccessibleProperty(result['Properties'], isAccessible);

        const updatedXmlContent = builder.buildObject(result);
        saveUpdatedDocxFile(zip, filePath, updatedXmlContent);
    } catch (error) {
        throw new Error(`Error updating custom properties XML: ${error.message}`);
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
 * @return {Promise<boolean>} A promise that resolves to a boolean indicating
 * whether the input file is accessible.
 */
export async function testAccessiblity(inputFilePath: string): Promise<boolean> {
    let filteredResults = [];
    try {
        // Check if the input file exists
        if (!fs.existsSync(inputFilePath)) {
            throw new Error(`Input file does not exist: ${inputFilePath}`);
        }
        const outputFilePath = inputFilePath + '.html';
        // Run the Pandoc command synchronously
        convertDocxToHtml(inputFilePath, outputFilePath);

        // Use pa11y to check the HTML file for accessibility issues
        const results = await pa11y(outputFilePath, pa11yOptions as any)
        const filteredResults = results.issues.filter(issue => !errorCodesToIgnore.includes(issue.code));

        // console.log(results.issues, filteredResults.length);
        return filteredResults.length === 0
    } catch (error) {
        // console.error(`Error during conversion or accessibility check: ${error.message}`);
        throw error;
        
    } finally {
        // fs.unlinkSync(outputFilePath);
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

const inputFilePath = 'myfile.docx';

testAccessiblity(inputFilePath).then(isAccessible => {
    changeIsAccessibleProperty(inputFilePath, isAccessible === true);
    if (isAccessible) {
        console.log('The document is accessible.');
    } else {
        console.log('The document is not accessible.');
    }
}).catch(error => {
    console.error('An error occurred:', error);
});
