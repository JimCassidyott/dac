import * as JSZip from 'jszip';
import { DOMParser, XMLSerializer } from 'xmldom';
import * as fs from 'fs';
import { join } from 'path';

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

    static async addComment(
      filePath: string,
      slideNumber: number,
      comment: { author: string; text: string; x: number; y: number; date?: string }
  ): Promise<void> {
      const content = fs.readFileSync(filePath);
      const zip = new JSZip();
  
      try {
          // Load the PowerPoint file as a zip
          const zipContent = await zip.loadAsync(content);
  
          // Ensure `commentAuthors.xml` exists and add the author if necessary
          if (!zipContent.files['ppt/commentAuthors.xml']) {
              zipContent.file(
                  'ppt/commentAuthors.xml',
                  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
                  <p:commentAuthors xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"/>`
              );
          }
          const authorsXml = await zipContent.files['ppt/commentAuthors.xml'].async('text');
          const authorParser = new DOMParser();
          const authorsDoc = authorParser.parseFromString(authorsXml, 'text/xml');
          const authorElements = authorsDoc.getElementsByTagName('p:cmAuthor');
          let authorId = Array.from(authorElements).find(
              (el) => el.getAttribute('name') === comment.author
          )?.getAttribute('id');
  
          if (!authorId) {
              // Add a new author
              authorId = String(authorElements.length);
              const newAuthor = authorsDoc.createElement('p:cmAuthor');
              newAuthor.setAttribute('id', authorId);
              newAuthor.setAttribute('name', comment.author);
              authorsDoc.documentElement.appendChild(newAuthor);
  
              // Update the file
              const serializer = new XMLSerializer();
              const updatedAuthorsXml = serializer.serializeToString(authorsDoc);
              zipContent.file('ppt/commentAuthors.xml', updatedAuthorsXml);
          }
  
          // Map slide number to the corresponding slideId
          const slideMap = new Map<number, string>(); // Maps slide numbers to slide IDs
          if (zipContent.files['ppt/presentation.xml']) {
              const presentationXml = await zipContent.files['ppt/presentation.xml'].async('text');
              const parser = new DOMParser();
              const presentationDoc = parser.parseFromString(presentationXml, 'text/xml');
              const slideList = presentationDoc.getElementsByTagName('p:sldId');
  
              for (let i = 0; i < slideList.length; i++) {
                  const slide = slideList[i];
                  const slideId = slide.getAttribute('id');
                  if (slideId) {
                      slideMap.set(i + 1, slideId); // 1-based slide numbering
                  }
              }
          }
  
          const slideId = slideMap.get(slideNumber);
          if (!slideId) {
              throw new Error(`Invalid slide number: ${slideNumber}`);
          }
  
          // Ensure a `comments/comment*.xml` file exists for the slide
          const commentFileName = `ppt/comments/comment${slideNumber}.xml`;
          if (!zipContent.files[commentFileName]) {
              zipContent.file(
                  commentFileName,
                  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
                  <p:cmLst xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"/>`
              );
          }
  
          const commentXml = await zipContent.files[commentFileName].async('text');
          const commentParser = new DOMParser();
          const commentsDoc = commentParser.parseFromString(commentXml, 'text/xml');
  
          // Add the comment
          const newComment = commentsDoc.createElement('p:cm');
          newComment.setAttribute('authorId', authorId);
          newComment.setAttribute('dt', comment.date || new Date().toISOString());
  
          const posElement = commentsDoc.createElement('p:pos');
          posElement.setAttribute('x', comment.x.toString());
          posElement.setAttribute('y', comment.y.toString());
          posElement.setAttribute('slideId', slideId); // Ensure it references the correct slide ID
          newComment.appendChild(posElement);
  
          const textElement = commentsDoc.createElement('p:text');
          textElement.textContent = comment.text;
          newComment.appendChild(textElement);
  
          commentsDoc.documentElement.appendChild(newComment);
  
          // Update the file
          const serializer = new XMLSerializer();
          const updatedCommentsXml = serializer.serializeToString(commentsDoc);
          zipContent.file(commentFileName, updatedCommentsXml);
  
          // Save the updated `.pptx`
          const updatedContent = await zipContent.generateAsync({ type: 'nodebuffer' });
          fs.writeFileSync(filePath, updatedContent);
      } catch (error) {
          console.error('Error adding comment to PowerPoint file:', error);
          throw error;
      }
  }
  
}

// Example usage:
async function main() {
    try {
        const comments = await PPTComments.getComments(join(__dirname, 'Versioning.pptx'));
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

        await PPTComments.addComment(join(__dirname, 'Versioning.pptx'), 2, {
          author: 'Thor',
          text: 'adding comment test',
          x: 0, // Position in EMUs
          y: 0,
          date: '2024-01-01T15:00:00Z',
        });
      console.log('Comment added to slide 2.');
    } catch (error) {
        console.error('Failed to read comments:', error);
    }
}

if (require.main === module) {
    main();
}
