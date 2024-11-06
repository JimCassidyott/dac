
import * as JSZip from 'jszip';
import { DOMParser, XMLSerializer } from 'xmldom';
import * as fs from 'fs/promises';
import { parseString, Builder } from 'xml2js';

async function addComment(docxFile: string, targetText: string, commentText: string): Promise<void> {
    const data = await fs.readFile(docxFile);
    const zip = await JSZip.loadAsync(data);

    // Read and parse document.xml
    const documentXml = await zip.file('word/document.xml')?.async('text');
    if (!documentXml) {
        throw new Error('document.xml not found in the DOCX file');
    }
    const doc = new DOMParser().parseFromString(documentXml, 'text/xml');

    // Find the target text
    const textNodes = doc.getElementsByTagName('w:t');
    let targetNode: Element | null = null;
    for (const node of Array.from(textNodes)) {
        if (node.textContent?.includes(targetText)) {
            targetNode = node;
            break;
        }
    }

    if (!targetNode) {
        throw new Error(`Target text "${targetText}" not found in the document`);
    }

    // Generate a new comment ID
    const commentId = Date.now().toString();

    // Insert comment reference
    const commentReference = doc.createElement('w:commentReference');
    commentReference.setAttribute('w:id', commentId);
    targetNode.parentNode?.appendChild(commentReference);

    // Add comment to comments.xml
    let commentsDoc: Document;
    const commentsXml = await zip.file('word/comments.xml')?.async('text');
    if (commentsXml) {
        commentsDoc = new DOMParser().parseFromString(commentsXml, 'text/xml');
    } else {
        commentsDoc = new DOMParser().parseFromString('<w:comments xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"/>', 'text/xml');
    }

    const commentElement = commentsDoc.createElement('w:comment');
    commentElement.setAttribute('w:id', commentId);
    commentElement.setAttribute('w:author', 'Script');
    commentElement.setAttribute('w:date', new Date().toISOString());
    const commentTextElement = commentsDoc.createElement('w:p');
    const commentRunElement = commentsDoc.createElement('w:r');
    const commentTextNode = commentsDoc.createElement('w:t');
    commentTextNode.textContent = commentText;
    commentRunElement.appendChild(commentTextNode);
    commentTextElement.appendChild(commentRunElement);
    commentElement.appendChild(commentTextElement);
    commentsDoc.documentElement.appendChild(commentElement);

    // Update the ZIP with modified XMLs
    zip.file('word/document.xml', new XMLSerializer().serializeToString(doc));
    zip.file('word/comments.xml', new XMLSerializer().serializeToString(commentsDoc));

    // Ensure the [Content_Types].xml file includes the comments part
    const contentTypesXml = await zip.file('[Content_Types].xml')?.async('text');
    if (contentTypesXml) {
        const contentTypesDoc = new DOMParser().parseFromString(contentTypesXml, 'text/xml');
        let hasCommentsContentType = false;
        const overrides = contentTypesDoc.getElementsByTagName('Override');
        for (const override of Array.from(overrides)) {
            if (override.getAttribute('PartName') === '/word/comments.xml') {
                hasCommentsContentType = true;
                break;
            }
        }
        if (!hasCommentsContentType) {
            const newOverride = contentTypesDoc.createElement('Override');
            newOverride.setAttribute('PartName', '/word/comments.xml');
            newOverride.setAttribute('ContentType', 'application/vnd.openxmlformats-officedocument.wordprocessingml.comments+xml');
            contentTypesDoc.documentElement.appendChild(newOverride);
            zip.file('[Content_Types].xml', new XMLSerializer().serializeToString(contentTypesDoc));
        }
    }

    // Generate the new DOCX file
    const newDocxData = await zip.generateAsync({ type: 'nodebuffer' });
    await fs.writeFile(docxFile, newDocxData);
}

async function getComments(docxFile: string): Promise<Array<{ id: string, text: string }>> {
    const data = await fs.readFile(docxFile);
    const zip = await JSZip.loadAsync(data);

    const commentsXml = await zip.file('word/comments.xml')?.async('text');

    console.log(commentsXml);
    if (!commentsXml) {
        console.log('No comments.xml found in the document');
        return [];
    }

    const doc = new DOMParser().parseFromString(commentsXml, 'text/xml');
    const commentNodes = doc.getElementsByTagName('w:comment');

    const comments = Array.from(commentNodes).map((node) => ({
        id: node.getAttribute('w:id') || '',
        text: node.textContent || ''
    }));

    return comments;
}

const filePath = 'C:\\Users\\jimca\\Documents\\code\\csc\\dac\\demofiles\\accessible\\accessible.docx';

async function main() {
    try {
        // Add a new comment
        // await addComment(filePath, 'Jim is a good guy', 'Yes he is');
        // console.log('Comment added successfully');

        // // Get and display all comments
        const comments = await getComments(filePath);
        console.log('Comments:');
        if (comments.length === 0) {
            console.log('No comments found in the document');
        } else {
            comments.forEach(comment => console.log(`ID: ${comment.id}, Text: ${comment.text}`));
        }

        // Log the content of document.xml for debugging
        const zip = await JSZip.loadAsync(await fs.readFile(filePath));
        const documentXml = await zip.file('word/document.xml')?.async('text');
        console.log('Content of document.xml:');
        console.log(documentXml);

    } catch (error) {
        console.error('Error:', error);
    }
}

main();