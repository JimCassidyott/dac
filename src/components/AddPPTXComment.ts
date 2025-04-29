import { DOMParser, XMLSerializer } from 'xmldom';
import * as JSZip from 'jszip';
import * as fs from 'fs';
import { join } from 'path';

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

export async function addPptxComment(filePath: string, slideNumber: number, comment: {
    author: string,
    text: string,
    x: number,
    y: number,
    date?: string
}) {
    const buffer = fs.readFileSync(filePath);
    const zip = await JSZip.loadAsync(buffer);

    const serializer = new XMLSerializer();
    const parser = new DOMParser();

    // === 1. Add author ===
    const authorPath = 'ppt/commentAuthors.xml';
    let authorId = '0';
    if (!zip.files[authorPath]) {
        zip.file(authorPath, `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><p:commentAuthors xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"/>`);
    }
    const authorXml = await zip.files[authorPath].async('text');
    const authorDoc = parser.parseFromString(authorXml, 'text/xml');
    const existing = Array.from(authorDoc.getElementsByTagName('p:cmAuthor'))
        .find(a => a.getAttribute('name') === comment.author);
    if (existing) {
        authorId = existing.getAttribute('id')!;
    } else {
        authorId = `${authorDoc.getElementsByTagName('p:cmAuthor').length}`;
        const el = authorDoc.createElement('p:cmAuthor');
        el.setAttribute('id', authorId);
        el.setAttribute('name', comment.author);
        authorDoc.documentElement.appendChild(el);
        zip.file(authorPath, serializer.serializeToString(authorDoc));
    }

    // === 2. Map slideNumber to slideId ===
    const presentationXml = await zip.files['ppt/presentation.xml'].async('text');
    const presentationDoc = parser.parseFromString(presentationXml, 'text/xml');
    const sldId = presentationDoc.getElementsByTagName('p:sldId')[slideNumber - 1];
    const slideId = sldId.getAttribute('id');

    // === 3. Create or modify comment file ===
    const commentPath = `ppt/comments/comment${slideNumber}.xml`;
    if (!zip.files[commentPath]) {
        zip.file(commentPath, `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><p:cmLst xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"/>`);
    }
    const commentDoc = parser.parseFromString(await zip.files[commentPath].async('text'), 'text/xml');
    const cm = commentDoc.createElement('p:cm');
    cm.setAttribute('authorId', authorId);
    cm.setAttribute('dt', comment.date || new Date().toISOString());

    const pos = commentDoc.createElement('p:pos');
    pos.setAttribute('x', String(comment.x));
    pos.setAttribute('y', String(comment.y));
    pos.setAttribute('slideId', slideId!);
    cm.appendChild(pos);

    const text = commentDoc.createElement('p:text');
    text.textContent = comment.text;
    cm.appendChild(text);

    commentDoc.documentElement.appendChild(cm);
    zip.file(commentPath, serializer.serializeToString(commentDoc));

    // === 4. Add to slideN.xml.rels ===
    const relSlidePath = `ppt/slides/_rels/slide${slideNumber}.xml.rels`;
    if (!zip.files[relSlidePath]) {
        zip.file(relSlidePath, `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"/>`);
    }
    const slideRelDoc = parser.parseFromString(await zip.files[relSlidePath].async('text'), 'text/xml');
    ensureRelationship(slideRelDoc,
        'http://schemas.openxmlformats.org/officeDocument/2006/relationships/comments',
        `../comments/comment${slideNumber}.xml`
    );
    zip.file(relSlidePath, serializer.serializeToString(slideRelDoc));

    // === 5. Add to presentation.xml.rels ===
    const relPresPath = 'ppt/_rels/presentation.xml.rels';
    const presRelDoc = parser.parseFromString(await zip.files[relPresPath].async('text'), 'text/xml');
    ensureRelationship(presRelDoc,
        'http://schemas.openxmlformats.org/officeDocument/2006/relationships/comments',
        `comments/comment${slideNumber}.xml`
    );
    zip.file(relPresPath, serializer.serializeToString(presRelDoc));

    // === 6. Update [Content_Types].xml ===
    const ctDoc = parser.parseFromString(await zip.files['[Content_Types].xml'].async('text'), 'text/xml');
    ensureContentTypeOverride(ctDoc,
        `/ppt/comments/comment${slideNumber}.xml`,
        'application/vnd.openxmlformats-officedocument.presentationml.comments+xml'
    );
    zip.file('[Content_Types].xml', serializer.serializeToString(ctDoc));

    // === 7. Save back ===
    const output = await zip.generateAsync({ type: 'nodebuffer' });
    fs.writeFileSync(filePath, output);
    console.log(`Comment added on slide ${slideNumber}`);
}

addPptxComment('/path/to/file.pptx', 3, {
  author: 'Tharindu',
  text: 'Test comment from script!',
  x: 0,
  y: 0,
  date: '2025-04-24T13:00:00Z'
});