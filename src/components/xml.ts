/**
 * Word Document Custom Property Parser
 * 
 * This module provides functionality to parse custom properties from Word documents (.docx files)
 * and XML strings. It includes functions to extract custom properties, check for their existence,
 * and specifically verify the 'isAccessible' property. It also allows creation of a new custom
 * property collection with an 'isAccessible' property.
 * 
 * @module WordDocumentCustomPropertyParser
 */

import { Builder, parseStringPromise } from 'xml2js';
import * as fs from 'fs';
import * as path from 'path';
import * as unzipper from 'unzipper';
import * as JSZip from 'jszip';

/**
 * Represents a custom property extracted from the document or XML.
 */
interface CustomProperty {
    name: string;
    value: string | boolean;
    type: string;
}

/**
 * Parses an XML string into an array of CustomProperty objects.
 *   
 * @param {string} xml - The XML string to parse.
 * @returns {Promise<CustomProperty[]>} A promise that resolves to an array of CustomProperty objects.
 * @throws {Error} If there's an error parsing the XML.
 */
async function parseXmlToObject(xml: string): Promise<CustomProperty[]> {
    try {
        const result = await parseStringPromise(xml, {
            explicitArray: false,
            ignoreAttrs: false,
        });

        if (!result.Properties || !result.Properties.property) {
            return []; // Return an empty array if no properties are found
        }

        const properties = Array.isArray(result.Properties.property)
            ? result.Properties.property
            : [result.Properties.property]; // Ensure properties is always an array

        return properties.map((prop: any) => ({
            name: prop.$.name,
            value: extractValue(prop),
            type: Object.keys(prop).find(key => key.startsWith('vt:')) || 'unknown'
        }));
    } catch (err) {
        console.error('Error parsing XML:', err);
        throw err;
    }
}

/**
 * Extracts the value from a property object based on its type.
 * 
 * @param {any} prop - The property object to extract the value from.
 * @returns {string | boolean} The extracted value.
 */
function extractValue(prop: any): string | boolean {
    if (prop['vt:lpwstr']) return prop['vt:lpwstr'];
    if (prop['vt:bool']) return prop['vt:bool'] === '1';
    // Add more type checks as needed
    return 'unknown';
}

/**
 * Checks if the given XML contains any custom properties.
 * 
 * @param {string} xml - The XML string to check.
 * @returns {Promise<boolean>} A promise that resolves to true if custom properties exist, false otherwise.
 * @throws {Error} If there's an error parsing the XML.
 */
async function hasCustomProperties(xml: string): Promise<boolean> {
    try {
        const result = await parseStringPromise(xml, {
            explicitArray: false,
            ignoreAttrs: false,
        });

        return !!(result.Properties && result.Properties.property);
    } catch (err) {
        console.error('Error parsing XML:', err);
        throw err;
    }
}

/**
 * Checks if the 'isAccessible' property exists in the XML and is set to true.
 * 
 * @param {string} xml - The XML string to check.
 * @returns {Promise<boolean>} A promise that resolves to true if 'isAccessible' is true, false otherwise.
 * @throws {Error} If there's an error parsing the XML or checking the property.
 */
async function isAccessible(xml: string): Promise<boolean> {
    try {
        const properties = await parseXmlToObject(xml);
        const accessibleProp = properties.find(prop => prop.name === 'isAccessible');
        return accessibleProp ? accessibleProp.value === true : false;
    } catch (err) {
        console.error('Error checking isAccessible:', err);
        throw err;
    }
}

/**
 * Opens a Word document (.docx) file and returns its custom properties.
 * 
 * @param {string} filePath - The path to the .docx file.
 * @returns {Promise<CustomProperty[] | undefined>} A promise that resolves to an array of CustomProperty objects or undefined if no properties are found.
 * @throws {Error} If the file is not a .docx file or if there's an error reading the file.
 */
async function getWordDocumentCustomProperties(filePath: string): Promise<CustomProperty[] | undefined> {
    // Check if the file is a .docx file
    if (path.extname(filePath).toLowerCase() !== '.docx') {
        throw new Error('The file is not a .docx file');
    }

    try {
        const directory = await unzipper.Open.file(filePath);
        const customPropsFile = directory.files.find((d: unzipper.File) => d.path === 'docProps/custom.xml');

        if (!customPropsFile) {
            return undefined; // No custom properties found
        }

        const content = await customPropsFile.buffer();
        const xml = content.toString();
        const properties = await parseXmlToObject(xml);

        return properties.length > 0 ? properties : undefined;
    } catch (err) {
        console.error('Error reading .docx file:', err);
        throw err;
    }
}

/* Creates a new collection of custom properties with one boolean property called isAccessible set to false.
 * Returns a properly formatted XML string representing the custom properties for a Word document.
 * 
 * @returns { string } An XML string representing a collection of custom properties with isAccessible set to false.
 */
function createCustomPropertyCollectionWithIsAccessibleProperty(): string {
    const xml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/custom-properties" 
            xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">
    <property fmtid="{D5CDD505-2E9C-101B-9397-08002B2CF9AE}" pid="2" name="isAccessible">
        <vt:bool>0</vt:bool>
    </property>
</Properties>`;

    return xml;
}


/**
 * Opens a .docx file, removes all custom properties, and saves the file back to the drive.
 * 
 * @param {string} filePath - The path to the .docx file.
 * @throws {Error} If the file is not a .docx file or if there's an error processing the file.
 */
async function deleteCustomProperties(filePath: string): Promise<void> {
    // Check if the file is a .docx file
    if (path.extname(filePath).toLowerCase() !== '.docx') {
        throw new Error('The file is not a .docx file');
    }

    try {
        // Read the .docx file
        const data = await fs.promises.readFile(filePath);
        const zip = await JSZip.loadAsync(data);

        // Remove the custom.xml file if it exists
        if (zip.file('docProps/custom.xml')) {
            zip.remove('docProps/custom.xml');
        }

        // Generate the new .docx file content
        const newContent = await zip.generateAsync({ type: 'nodebuffer' });

        // Write the new content back to the file
        await fs.promises.writeFile(filePath, newContent);

        console.log('Custom properties have been deleted from the file.');
    } catch (err) {
        console.error('Error processing .docx file:', err);
        throw err;
    }
}

/**
 * Opens a Word document, adds a custom property 'isAccessible' set to false while preserving existing properties,
 * and saves the document.
 * 
 * @param {string} filePath - The path to the .docx file.
 * @throws {Error} If the file is not a .docx file or if there's an error processing the file.
 */
async function addIsAccessiblePropertyToDocument(filePath: string): Promise<void> {
    // Check if the file is a .docx file
    if (path.extname(filePath).toLowerCase() !== '.docx') {
        throw new Error('The file is not a .docx file');
    }

    try {
        // Read the .docx file
        const data = await fs.promises.readFile(filePath);
        const zip = await JSZip.loadAsync(data);

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


/**
 * Runs a series of tests to demonstrate the functionality of the XML parsing functions.
 */
async function runTests() {
    try {
        const filePath = 'C:\\Users\\jimca\\Documents\\code\\csc\\dac\\demofiles\\accessible\\accessible.docx';
        // Example XML string containing custom properties
        const xmlString = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
        <Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/custom-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes"><property fmtid="{D5CDD505-2E9C-101B-9397-08002B2CF9AE}" pid="2" name="MyNum"><vt:lpwstr>One</vt:lpwstr></property><property fmtid="{D5CDD505-2E9C-101B-9397-08002B2CF9AE}" pid="3" name="isAccessible"><vt:bool>1</vt:bool></property><property fmtid="{D5CDD505-2E9C-101B-9397-08002B2CF9AE}" pid="4" name="someProp"><vt:bool>1</vt:bool></property></Properties>`;

        // Test 1: Parse and display all custom properties
        console.log('Test 1: Parsing all custom properties');
        const properties = await parseXmlToObject(xmlString);
        console.log('Parsed Custom Properties:');
        properties.forEach(prop => {
            console.log(`${prop.name}: ${prop.value} (${prop.type})`);
        });

        // Test 2: Check if XML contains any custom properties
        console.log('\nTest 2: Checking for custom properties');
        const hasProperties = await hasCustomProperties(xmlString);
        console.log(`Does the XML contain any custom properties? ${hasProperties}`);

        // Test 3: Check XML without any custom properties
        console.log('\nTest 3: Checking XML without custom properties');
        const xmlWithoutProperties = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
        <Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/custom-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes"></Properties>`;
        const hasPropertiesInSecondXml = await hasCustomProperties(xmlWithoutProperties);
        console.log(`Does the second XML contain any custom properties? ${hasPropertiesInSecondXml}`);

        // Test 4: Check isAccessible property
        console.log('\nTest 4: Checking isAccessible property');
        const accessible = await isAccessible(xmlString);
        console.log(`Is the document accessible? ${accessible}`);

        // Test 5: Check isAccessible on XML without the property
        console.log('\nTest 5: Checking isAccessible on XML without the property');
        const xmlWithoutAccessible = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
        <Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/custom-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes"><property fmtid="{D5CDD505-2E9C-101B-9397-08002B2CF9AE}" pid="2" name="MyNum"><vt:lpwstr>One</vt:lpwstr></property></Properties>`;
        const accessibleInSecondXml = await isAccessible(xmlWithoutAccessible);
        console.log(`Is the second document accessible? ${accessibleInSecondXml}`);

        // Test 6: Parse XML with a single property
        console.log('\nTest 6: Parsing XML with a single property');
        const xmlSingleProperty = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
        <Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/custom-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes"><property fmtid="{D5CDD505-2E9C-101B-9397-08002B2CF9AE}" pid="2" name="SingleProp"><vt:lpwstr>SingleValue</vt:lpwstr></property></Properties>`;
        const singleProperty = await parseXmlToObject(xmlSingleProperty);
        console.log('Parsed Single Property:');
        console.log(singleProperty);

        // Test 7: Read custom properties from a .docx file
        console.log('\nTest 7: Reading custom properties from a .docx file');

        try {
            const docxProperties = await getWordDocumentCustomProperties(filePath);
            if (docxProperties) {
                console.log('Custom properties found in the .docx file:');
                docxProperties.forEach(prop => {
                    console.log(`${prop.name}: ${prop.value} (${prop.type})`);
                });
            } else {
                console.log('No custom properties found in the .docx file.');
            }
        } catch (error) {
            console.error('Error reading .docx file:', (error as Error).message);
        }

        // Test 8: Attempt to read properties from a non-.docx file
        console.log('\nTest 8: Attempting to read properties from a non-.docx file');
        const nonDocxFilePath = 'xml.ts'; // Replace with an actual non-.docx file path
        try {
            await getWordDocumentCustomProperties(nonDocxFilePath);
        } catch (error) {
            console.error('Expected error:', (error as Error).message);
        }

        // Test 9: Create a new custom property collection with isAccessible property
        console.log('\nTest 9: Creating a new custom property collection with isAccessible property');
        const newPropertyCollection = createCustomPropertyCollectionWithIsAccessibleProperty();
        console.log('New Custom Property Collection:');
        console.log(newPropertyCollection);

        // Test 10: test deleteCustomProperties - see that I can remove all custom properties
        console.log('\nTest 10: test deleteCustomProperties - see that I can remove all custom properties');
        await deleteCustomProperties(filePath);

        // Test 11: test addIsAccessiblePropertyToDocument - see that I can add the isAccessible property
        console.log('\nTest 11: test addIsAccessiblePropertyToDocument - see that I can add the isAccessible property');
        await addIsAccessiblePropertyToDocument(filePath);

    } catch (err) {
        console.error('Error in runTests:', (err as Error).message);
    }
}

// Execute the test suite
runTests();