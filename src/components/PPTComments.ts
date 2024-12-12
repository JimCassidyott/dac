import * as JSZip from 'jszip';
import { DOMParser } from 'xmldom';
import * as fs from 'fs';

export interface PowerPointComment {
    author: string;
    text: string;
    date: string;
    slideNumber: number;  // The actual slide number (1-based)
    position: {
        slideId: string;  // Internal PowerPoint slide ID
        x: number;       // Horizontal position in EMUs (English Metric Units)
        y: number;       // Vertical position in EMUs
    };
}

export class PPTComments {
    static async getComments(filePath: string): Promise<PowerPointComment[]> {
        const content = fs.readFileSync(filePath);
        const zip = new JSZip();

        try {
            // Load the PowerPoint file as a zip
            const zipContent = await zip.loadAsync(content);
            const comments: PowerPointComment[] = [];

            // First, get the comment authors
            const authorMap = new Map<string, string>();
            if (zipContent.files['ppt/commentAuthors.xml']) {
                const authorsXml = await zipContent.files['ppt/commentAuthors.xml'].async('text');
                const parser = new DOMParser();
                const authorsDoc = parser.parseFromString(authorsXml, 'text/xml');
                const authorElements = authorsDoc.getElementsByTagName('p:cmAuthor');

                for (let i = 0; i < authorElements.length; i++) {
                    const author = authorElements[i];
                    const id = author.getAttribute('id');
                    const name = author.getAttribute('name');
                    if (id !== null && name !== null) {
                        authorMap.set(id, name);
                    }
                }
            }

            // Get slide information from presentation.xml
            const slideMap = new Map<string, number>(); // Maps slide IDs to slide numbers
            if (zipContent.files['ppt/presentation.xml']) {
                const presentationXml = await zipContent.files['ppt/presentation.xml'].async('text');
                const parser = new DOMParser();
                const presentationDoc = parser.parseFromString(presentationXml, 'text/xml');
                const slideList = presentationDoc.getElementsByTagName('p:sldId');
                
                // Build map of slide IDs to slide numbers (1-based)
                for (let i = 0; i < slideList.length; i++) {
                    const slide = slideList[i];
                    const slideId = slide.getAttribute('id');
                    if (slideId) {
                        slideMap.set(slideId, i + 1); // 1-based slide numbering
                    }
                }
            }

            // Process all comment files
            for (const fileName in zipContent.files) {
                if (fileName.match(/ppt\/comments\/comment\d*\.xml$/i)) {
                    const commentXml = await zipContent.files[fileName].async('text');
                    const parser = new DOMParser();
                    const xmlDoc = parser.parseFromString(commentXml, 'text/xml');

                    // Extract the slide number from the filename (comment1.xml -> slide 1)
                    const slideMatch = fileName.match(/comment(\d+)\.xml$/i);
                    const slideNumber = slideMatch ? parseInt(slideMatch[1]) : 0;

                    // Get all comment elements
                    const commentElements = xmlDoc.getElementsByTagName('p:cm');

                    for (let i = 0; i < commentElements.length; i++) {
                        const comment = commentElements[i];
                        
                        // Get author
                        const authorId = comment.getAttribute('authorId');
                        const authorName = authorId ? authorMap.get(authorId) || '' : '';

                        // Get text from p:text element
                        const textElement = comment.getElementsByTagName('p:text')[0];
                        const commentText = textElement ? textElement.textContent?.trim() : '';

                        // Get date
                        const date = comment.getAttribute('dt') || '';

                        // Get position and slide reference
                        const posElement = comment.getElementsByTagName('p:pos')[0];
                        const x = posElement ? parseInt(posElement.getAttribute('x') || '0') : 0;
                        const y = posElement ? parseInt(posElement.getAttribute('y') || '0') : 0;
                        const slideId = posElement ? posElement.getAttribute('slideId') || '' : '';

                        comments.push({
                            author: authorName,
                            text: commentText || '',
                            date: date,
                            slideNumber: slideNumber,
                            position: {
                                slideId: slideId,
                                x: x,  // Position in EMUs (1 EMU = 1/914400 inch)
                                y: y
                            }
                        });
                    }
                }
            }

            return comments;
        } catch (error) {
            console.error('Error reading PowerPoint comments:', error);
            throw error;
        }
    }
}

// Example usage:
async function main() {
    try {
        const comments = await PPTComments.getComments('versioning.Pptx');
        console.log('PowerPoint Comments:');
        console.log(comments);
        comments.forEach((comment, index) => {
            console.log(`\nComment ${index + 1}:`);
            console.log(`Author: ${comment.author}`);
            console.log(`Text: ${comment.text}`);
            console.log(`Date: ${comment.date}`);
            console.log(`Slide: ${comment.slideNumber}`);
            console.log(`Position: (${comment.position.x}, ${comment.position.y})`);
        });
    } catch (error) {
        console.error('Failed to read comments:', error);
    }
}

if (require.main === module) {
    main();
}
