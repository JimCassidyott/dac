import * as path from 'path';
const AdmZip = require('adm-zip'); 
import * as xml2js from 'xml2js';
import * as JSZip from 'jszip';
import * as fs from 'fs';
import { AccessibilityStatus } from './helpers';
import { GCDocsAdapter } from './GCDocsAdaptor';

export class MSOfficeMetadata {
  /**
   * Reads the custom properties XML of a MS Office document.
   *
   * @param {string} filePath - The path to the MS Office document.
   * @returns {Promise<Object | undefined>} A Promise that resolves to an object representing the custom properties,
   * or undefined if no custom properties are found.
   * @throws {Error} If there is an error reading or parsing the custom properties XML.
   */
  public static async readCustomPropertiesXml(filePath: string): Promise<any | undefined> {
    const fileExtension: string = path.extname(filePath).toLowerCase();
    // if (fileExtension !== '.docx') {
    //     console.log('The provided file is not a Word document (.docx)');
    //     return false

    // }

    try {
        // Read the file as a zip
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
   * Reads the contents of a DOCX file and returns a JSZip object.
   *
   * @param filePath - The path to the DOCX file.
   * @returns A promise that resolves to a JSZip object representing the contents of the DOCX file.
   * @throws Will throw an error if the file does not exist, if the file is not a valid DOCX file, or if there is an error reading the file.
   *
   * @note This function assumes that the file exists and that it is a valid DOCX file.
   */
  public static async readMSOfficeFile(filePath: string): Promise<JSZip> {
    // Check if the file exists
    if (!fs.existsSync(filePath)) {
        throw new Error('The file does not exist');
    }

    // Check if the file is a valid DOCX file
    // if (!isWordDOC(filePath, "SYSTEM")) {
    //     throw new Error('The file is not a valid DOCX file');
    // }

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

  private static async ensureThedocPropsCustomXmlExists(fileName: string): Promise<void> {
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
    const customXmlObj = await xml2js.parseStringPromise(customXml);

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
    const builder = new xml2js.Builder();
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
  public static async changeIsAccessibleProperty(filePath: string, isAccessible: boolean): Promise<void> {
    try {
        this.ensureThedocPropsCustomXmlExists(filePath)
        const zip = await this.readMSOfficeFile(filePath);
        const customPropsFile = zip.file('docProps/custom.xml');
        let content = await customPropsFile.async('string');
        const updatedContent = await this.updateIsAccessibleProperty(content, isAccessible);

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
  public static async updateIsAccessibleProperty(xmlString: string, isAccessible: boolean): Promise<string> {
    try {
        // Parse the XML string into a JavaScript object
        const result = await xml2js.parseStringPromise(xmlString);

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
        const builder = new xml2js.Builder();
        const updatedXmlString = builder.buildObject(result);

        return updatedXmlString;
    } catch (err) {
        console.error('Error processing XML:', err);
        throw err;
    }
  }

  /**
   * Asynchronously checks the accessibility of a Word document by reading its custom properties XML.
   *
   * @param {string} filePath - The path to the Word document.
   * @return {Promise<AccessibilityStatus>} A Promise that resolves to an AccessibilityStatus enum value.
   */
  public static async isAccessible(filePath: string, fileSource: string): Promise<AccessibilityStatus> {
    if (fileSource === 'GCDOCS') {
        let adapter = new GCDocsAdapter();
        filePath = await adapter.downloadDocumentContent(filePath);

    }
    // Read the custom properties XML
    const customProperties = await this.readCustomPropertiesXml(filePath);
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
}