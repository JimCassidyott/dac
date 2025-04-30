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
                  console.log(fileName)
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

    static async addComment(filePath: string, slideNumber: number, comment: {
      author: string;
      text: string;
      x: number;
      y: number;
      date?: string;
  }): Promise<void> {
      const content = fs.readFileSync(filePath);
      const zip = await JSZip.loadAsync(content);

      const serializer = new XMLSerializer();
      const parser = new DOMParser();

      function ensureRelationship(doc: Document, type: string, target: string): string {
          const existing = Array.from(doc.getElementsByTagName('Relationship'))
              .find(el => el.getAttribute('Type') === type && el.getAttribute('Target') === target);
          if (existing) return existing.getAttribute('Id')!;
          const rId = `rId${Math.floor(Math.random() * 100000)}`;
          const rel = doc.createElement('Relationship');
          rel.setAttribute('Id', rId);
          rel.setAttribute('Type', type);
          rel.setAttribute('Target', target);
          doc.documentElement.appendChild(rel);
          return rId;
      }

      function ensureContentTypeOverride(doc: Document, partName: string, contentType: string) {
          const existing = Array.from(doc.getElementsByTagName('Override'))
              .find(el => el.getAttribute('PartName') === partName);
          if (!existing) {
              const override = doc.createElement('Override');
              override.setAttribute('PartName', partName);
              override.setAttribute('ContentType', contentType);
              doc.documentElement.appendChild(override);
          }
      }

      // Step 1: Ensure commentAuthors.xml
      const authorPath = 'ppt/commentAuthors.xml';
      let authorId = '0';
      if (!zip.files[authorPath]) {
          zip.file(authorPath, `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><p:commentAuthors xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"/>`);
      }
      const authorXml = await zip.files[authorPath].async('text');
      const authorDoc = parser.parseFromString(authorXml, 'text/xml');
      const existingAuthor = Array.from(authorDoc.getElementsByTagName('p:cmAuthor'))
          .find(a => a.getAttribute('name') === comment.author);
      if (existingAuthor) {
          authorId = existingAuthor.getAttribute('id')!;
      } else {
          authorId = `${authorDoc.getElementsByTagName('p:cmAuthor').length}`;
          const el = authorDoc.createElement('p:cmAuthor');
          el.setAttribute('clrIdx', '3');
          el.setAttribute('id', authorId);
          el.setAttribute('initials', '');
          el.setAttribute('lastIdx', '0');
          el.setAttribute('name', comment.author);
          authorDoc.documentElement.appendChild(el);
          zip.file(authorPath, serializer.serializeToString(authorDoc));
      }

      // Step 2: Find slide ID
      const presentationXml = await zip.files['ppt/presentation.xml'].async('text');
      const presentationDoc = parser.parseFromString(presentationXml, 'text/xml');
      const sldId = presentationDoc.getElementsByTagName('p:sldId')[slideNumber - 1];
      const slideId = sldId.getAttribute('id');

      // Step 3: Create or update commentN.xml
      const commentPath = `ppt/comments/comment${slideNumber}.xml`;
      if (!zip.files[commentPath]) {
          zip.file(commentPath, `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><p:cmLst xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"/>`);
      }
      const commentDoc = parser.parseFromString(await zip.files[commentPath].async('text'), 'text/xml');
      const cm = commentDoc.createElement('p:cm');
      cm.setAttribute('authorId', authorId);
      cm.setAttribute('dt', comment.date || new Date().toISOString());
      const existingCmForAuthor = Array.from(commentDoc.getElementsByTagName('p:cm'))
        .filter(el => el.getAttribute('authorId') === authorId);
      const nextIdx = existingCmForAuthor.length + 1;
      cm.setAttribute('idx', nextIdx.toString());
      const pos = commentDoc.createElement('p:pos');
      pos.setAttribute('x', String(comment.x));
      pos.setAttribute('y', String(comment.y));
      // pos.setAttribute('slideId', slideId!);
      cm.appendChild(pos);
      const text = commentDoc.createElement('p:text');
      text.textContent = comment.text;
      cm.appendChild(text);
      commentDoc.documentElement.appendChild(cm);
      console.log(`${commentDoc}`)
      zip.file(commentPath, serializer.serializeToString(commentDoc));

      // Step 4: Update slideN.xml.rels
      const relSlidePath = `ppt/slides/_rels/slide${slideNumber}.xml.rels`;
      if (!zip.files[relSlidePath]) {
          zip.file(relSlidePath, `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"/>`);
      }
      const slideRelDoc = parser.parseFromString(await zip.files[relSlidePath].async('text'), 'text/xml');
      ensureRelationship(slideRelDoc, 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/comments', `../comments/comment${slideNumber}.xml`);
      zip.file(relSlidePath, serializer.serializeToString(slideRelDoc));

      // Step 5: Update presentation.xml.rels
      const relPresPath = 'ppt/_rels/presentation.xml.rels';
      const presRelDoc = parser.parseFromString(await zip.files[relPresPath].async('text'), 'text/xml');
      ensureRelationship(presRelDoc, 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/comments', `comments/comment${slideNumber}.xml`);
      zip.file(relPresPath, serializer.serializeToString(presRelDoc));

      // Step 6: Update [Content_Types].xml
      const ctDoc = parser.parseFromString(await zip.files['[Content_Types].xml'].async('text'), 'text/xml');
      ensureContentTypeOverride(ctDoc, `/ppt/comments/comment${slideNumber}.xml`, 'application/vnd.openxmlformats-officedocument.presentationml.comments+xml');
      zip.file('[Content_Types].xml', serializer.serializeToString(ctDoc));

      // Step 7: Update slideX.xml to reference comments correctly
      const slidePath = `ppt/slides/slide${slideNumber}.xml`;
      const slideXml = await zip.files[slidePath].async('text');
      const slideDoc = parser.parseFromString(slideXml, 'text/xml');

      let extLst = slideDoc.getElementsByTagName('p:extLst')[0];
      if (!extLst) {
          extLst = slideDoc.createElement('p:extLst');
          slideDoc.documentElement.appendChild(extLst);
      }

      const ext = slideDoc.createElement('p:ext');
      ext.setAttribute('uri', '{DD69B6F5-5D5E-400C-BEBA-6132DE92A312}');

      const creationId = slideDoc.createElementNS('http://schemas.microsoft.com/office/powerpoint/2012/main', 'p15:creationId');
      creationId.setAttribute('id', '{00000000-0008-0000-0000-000000000000}');
      ext.appendChild(creationId);

      extLst.appendChild(ext);
      zip.file(slidePath, serializer.serializeToString(slideDoc));

      // Step 8: Save back
      const output = await zip.generateAsync({ type: 'nodebuffer' });
      fs.writeFileSync(filePath, output);
  }
}

// Example usage:
async function main() {
    try {
        const comments = await PPTComments.getComments("/home/tharindu/Downloads/Versioning.pptx");
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

        await PPTComments.addComment("/home/tharindu/Downloads/Versioning.pptx", 1, {
          author: 'Thor',
          text: 'adding comment test new code',
          x: 0, // Position in EMUs
          y: 0,
          date: '2024-01-01T15:00:00Z',
        });
      console.log('Comment added to slide 4.');
    } catch (error) {
        console.error('Failed to read comments:', error);
    }
}

if (require.main === module) {
    main();
}
