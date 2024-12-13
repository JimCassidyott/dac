import * as JSZip from 'jszip';
import { readFileSync } from 'fs';
import { join } from 'path';

async function printPowerPointXML(filePath: string) {
    const zip = new JSZip();

    try {
        // Load the PowerPoint file
        const content = readFileSync(filePath);
        const zipContent = await zip.loadAsync(content);

        // Iterate through all files in the PowerPoint
        for (const fileName in zipContent.files) {
            if (fileName.endsWith('.xml') || fileName.endsWith('.rels')) {
                console.log(`\n=== File: ${fileName} ===`);
                try {
                    const xmlContent = await zipContent.files[fileName].async('text');
                    console.log(xmlContent);
                } catch (err) {
                    console.error(`Error reading ${fileName}:`, err);
                }
            }
        }
    } catch (error) {
        console.error('Error reading the presentation:', error);
    }
}

// Example usage
async function main() {
    // Specify the path to your PowerPoint file
    const pptxFilePath = join(__dirname, 'Versioning.pptx');
    console.log('Opening PowerPoint file:', pptxFilePath);
    
    try {
        await printPowerPointXML(pptxFilePath);
    } catch (error) {
        console.error('Error in main:', error);
    }
}

// Run the main function
if (require.main === module) {
    main().catch(console.error);
}