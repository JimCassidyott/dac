import * as JSZip from 'jszip';
import { readFileSync } from 'fs';
import { join } from 'path';
import { DOMParser } from 'xmldom';
import * as fs from 'fs';

interface SlideContent {
    text: string[];
    images: Array<{
        name: string;
        data: string;
    }>;
}

async function convertSlideToHtml(xmlContent: string): Promise<string> {
    // Parse the XML content using xmldom
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlContent, 'text/xml');

    const slideContent: SlideContent = {
        text: [],
        images: []
    };

    // Extract text content from paragraphs (a:t elements)
    const textElements = xmlDoc.getElementsByTagName('a:t');
    for (let i = 0; i < textElements.length; i++) {
        const text = textElements[i].textContent?.trim();
        if (text) {
            slideContent.text.push(text);
        }
    }

    // Convert content to HTML
    let html = '<div class="slide">\n';

    // Add text elements
    slideContent.text.forEach(text => {
        html += `    <p>${escapeHtml(text)}</p>\n`;
    });

    // Add images if any
    slideContent.images.forEach(image => {
        html += `    <img src="data:image/png;base64,${image.data}" alt="${escapeHtml(image.name)}" />\n`;
    });

    html += '</div>';
    return html;
}

function escapeHtml(unsafe: string): string {
    return unsafe
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

async function convertPowerPointToHtml(filePath: string): Promise<string[]> {
    const zip = new JSZip();
    const slideHtmls: string[] = [];

    try {
        // Load the PowerPoint file
        const content = readFileSync(filePath);
        const zipContent = await zip.loadAsync(content);

        // Process each slide XML file
        for (const fileName in zipContent.files) {
            if (fileName.startsWith('ppt/slides/slide') && fileName.endsWith('.xml')) {
                const xmlContent = await zipContent.files[fileName].async('text');
                const html = await convertSlideToHtml(xmlContent);
                slideHtmls.push(html);
            }
        }
    } catch (error) {
        console.error('Error converting presentation:', error);
        throw error;
    }

    return slideHtmls;
}

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
        const htmlSlides = await convertPowerPointToHtml(pptxFilePath);
        // Save the HTML to a file
        const htmlOutputPath = join(__dirname, 'X.html');
        console.log('Saving HTML to file:', htmlOutputPath);
        try {
            await fs.promises.writeFile(htmlOutputPath, htmlSlides.join('\n'));
        } catch (error) {
            console.error('Error saving HTML to file:', error);
        }

        console.log('Converted slides to HTML:', htmlSlides);
    } catch (error) {
        console.error('Error in main:', error);
    }
}

// Run the main function
if (require.main === module) {
    main().catch(console.error);
}