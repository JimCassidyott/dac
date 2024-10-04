import * as fs from 'fs';
import * as path from 'path';
import * as JSZip from 'jszip';
import { XMLParser, XMLBuilder } from 'fast-xml-parser';

interface CustomProperty {
    '@_fmtid': string;
    '@_pid': string;
    '@_name': string;
    'vt:bool': string;
}

interface Properties {
    '@_xmlns': string;
    '@_xmlns:vt': string;
    property: CustomProperty[];
}

/**
 * Sets the "isAccessible" custom property in a Word document.
 * @param filePath - The full path to the Word document, including the filename.
 * @param value - The boolean value to set for the "isAccessible" property.
 * @throws Will throw an error if the file is not a .docx file or if any other error occurs during the process.
 */
async function setIsAccessible(filePath: string, value: boolean): Promise<void> {
    try {
        // Verify that the file has a .docx extension
        if (path.extname(filePath).toLowerCase() !== '.docx') {
            throw new Error('The provided file is not a Word document (.docx)');
        }

        // Read the file
        const content = await fs.promises.readFile(filePath);

        // Load the document as a zip file
        const zip = await JSZip.loadAsync(content);

        // Read the custom properties XML
        const customPropsXml = await zip.file('docProps/custom.xml')?.async('string');
        if (!customPropsXml) {
            throw new Error('Custom properties file not found in the document');
        }

        // Parse the custom properties XML
        const parser = new XMLParser({
            ignoreAttributes: false,
            attributeNamePrefix: "@_",
            allowBooleanAttributes: true
        });
        const result = parser.parse(customPropsXml);

        // Get the properties object
        const properties = result.Properties as Properties;
        if (!Array.isArray(properties.property)) {
            properties.property = [properties.property];
        }

        // Find or create the "isAccessible" property
        let isAccessibleProperty = properties.property.find(p => p['@_name'] === 'isAccessible');
        if (!isAccessibleProperty) {
            // If the property doesn't exist, create it
            isAccessibleProperty = {
                '@_fmtid': '{D5CDD505-2E9C-101B-9397-08002B2CF9AE}',
                '@_pid': '2',
                '@_name': 'isAccessible',
                'vt:bool': value.toString()
            };
            properties.property.push(isAccessibleProperty);
        } else {
            // If the property exists, update its value
            isAccessibleProperty['vt:bool'] = value.toString();
        }

        // Convert the modified object back to XML
        const builder = new XMLBuilder({
            ignoreAttributes: false,
            attributeNamePrefix: "@_",
            format: true
        });
        const modifiedCustomPropsXml = builder.build(result);

        // Update the zip file with the modified custom properties XML
        zip.file('docProps/custom.xml', modifiedCustomPropsXml);

        // Generate the modified document
        const modifiedContent = await zip.generateAsync({ type: 'nodebuffer' });

        // Save the modified document
        await fs.promises.writeFile(filePath, modifiedContent);

        console.log(`Successfully set "isAccessible" property to ${value} in ${filePath}`);
    } catch (error) {
        console.error('Error modifying the document:', error);
        throw error; // Re-throw the error to be handled by the caller
    }
}

// Example usage:

const inputFilePath = '..\\..\\demofiles\\accessible\\accessible.docx';

setIsAccessible(inputFilePath, true)
    .then(() => console.log('Operation completed successfully'))
    .catch(error => console.error('An error occurred:', error));