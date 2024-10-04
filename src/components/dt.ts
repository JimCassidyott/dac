import * as fs from 'fs';
import * as JSZip from 'jszip';

async function setIsAccessibleProperty(filePath: string): Promise<void> {
    try {
        const content = await fs.promises.readFile(filePath);
        const zip = await JSZip.loadAsync(content);

        // Update [Content_Types].xml
        let contentTypesXml = await zip.file('[Content_Types].xml')?.async('string');
        if (contentTypesXml) {
            if (!contentTypesXml.includes('PartName="/docProps/custom.xml"')) {
                const insertIndex = contentTypesXml.lastIndexOf('</Types>');
                const newOverride = '<Override PartName="/docProps/custom.xml" ContentType="application/vnd.openxmlformats-officedocument.custom-properties+xml"/>';
                contentTypesXml = contentTypesXml.slice(0, insertIndex) + newOverride + contentTypesXml.slice(insertIndex);
                zip.file('[Content_Types].xml', contentTypesXml);
            }
        }

        // Update or create custom.xml
        let customXml = await zip.file('docProps/custom.xml')?.async('string');

        console.log(customXml);
        if (!customXml) {
            customXml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/custom-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes"></Properties>';
        }

        if (!customXml.includes('name="isAccessible"')) {
            const insertIndex = customXml.lastIndexOf('</Properties>');
            const newProperty = '<property fmtid="{D5CDD505-2E9C-101B-9397-08002B2CF9AE}" pid="2" name="isAccessible"><vt:bool>true</vt:bool></property>';
            customXml = customXml.slice(0, insertIndex) + newProperty + customXml.slice(insertIndex);
        } else {
            customXml = customXml.replace(/<vt:bool>.*?<\/vt:bool>/g, '<vt:bool>true</vt:bool>');
        }

        zip.file('docProps/custom.xml', customXml);

        const updatedContent = await zip.generateAsync({ type: 'nodebuffer' });
        await fs.promises.writeFile(filePath, updatedContent);

        console.log('isAccessible property set to true and document saved successfully.');
    } catch (error) {
        console.error('Error setting isAccessible property:', error);
    }
}

// Example usage
const filePath = 'C:\\Users\\jimca\\Documents\\code\\csc\\dac\\demofiles\\accessible\\accessible.docx';
setIsAccessibleProperty(filePath)
    .then(() => console.log('Process completed'))
    .catch(error => console.error('Error:', error));