import * as fs from 'fs';
import * as JSZip from 'jszip';
import { DOMParser } from 'xmldom';
import { XMLSerializer } from 'xmldom';
import { Heading } from './Headings';

interface Header {
    level: number;
    text: string;
    position: number;
}

async function extractDocxHeaders(filePath: string): Promise<Header[]> {
    try {
        // Read the DOCX file
        const data = await fs.promises.readFile(filePath);
        const zip = new JSZip();

        // Load the DOCX as a ZIP archive
        const content = await zip.loadAsync(data);

        // Get the main document content
        const documentXml = await content.file('word/document.xml')?.async('text');
        if (!documentXml) {
            throw new Error('Could not find document.xml in the DOCX file');
        }

        // Parse the XML content
        const parser = new DOMParser();
        const doc = parser.parseFromString(documentXml, 'text/xml');

        // Find all paragraph elements
        const paragraphs = doc.getElementsByTagName('w:p');
        const headers: Header[] = [];
        let position = 0;

        // Iterate through paragraphs to find headers
        for (let i = 0; i < paragraphs.length; i++) {
            const paragraph = paragraphs[i];
            const styleElement = paragraph.getElementsByTagName('w:pStyle')[0];

            if (styleElement) {
                const styleId = styleElement.getAttribute('w:val') || '';
                console.log(styleId);

                // Check if the paragraph style is a heading
                if (styleId.toLowerCase().startsWith('heading')) {
                    const level = parseInt(styleId.replace(/\D/g, ''), 10);

                    // Get the text content
                    const textElements = paragraph.getElementsByTagName('w:t');
                    let text = '';
                    for (let j = 0; j < textElements.length; j++) {
                        text += textElements[j].textContent;
                    }

                    if (text.trim()) {
                        headers.push({
                            level,
                            text: text.trim(),
                            position: position++
                        });
                    }
                }
            }
        }

        return headers;
    } catch (error) {
        if (error instanceof Error) {
            throw new Error(`Failed to parse DOCX file: ${error.message}`);
        }
        throw new Error('An unknown error occurred while parsing the DOCX file');
    }
}

export async function testHeadings(filePath: string) {
  try{
    const headers = await extractDocxHeaders(filePath);
    let headings: Heading = null;
    headers.forEach(async header => {
      if (headings === null) {
        headings = new Heading(header.text, header.level);
      }
      else {
        await headings.addHeading(header.text, header.level);
      }
      // console.log(`Level ${header.level}: ${header.text}`);
    });
  }
  catch (error) {
    throw error;
    // console.error('Error testing Headings', error);
  }
}
 
// testHeadings();

// Example usage
async function main() {
    try {
        const headers = await extractDocxHeaders('textdoc.docx');
        console.log('Found headers:');
        headers.forEach(header => {
            console.log(`Level ${header.level}: ${header.text}`);
        });
    } catch (error) {
        console.error('Error:', error);
    }
}


// class Header {
//     text: string;
//     level: number;
//     children: Header[];
//     parent: Header | null;

//     constructor(text: string, level: number) {
//         this.text = text;
//         this.level = level;
//         this.children = [];
//         this.parent = null;
//     }

//     addChild(child: Header): void {
//         child.parent = this;
//         this.children.push(child);
//     }    
// }

// main(); 

// Run the tests if this file is executed directly
if (require.main === module) {
  main();
}
