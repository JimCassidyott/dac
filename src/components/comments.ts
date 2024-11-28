/**
 * This module provides functionality for managing comments in DOCX files using the Office Open XML format.
 * It allows adding comments to specific text and retrieving existing comments from DOCX documents.
 */

import * as JSZip from 'jszip';
import { DOMParser, XMLSerializer } from 'xmldom';
import * as fs from 'fs/promises';
import { parseString, Builder } from 'xml2js';

/**
 * Adds a comment to a specific text in a DOCX file.
 * @param docxFile - The path to the DOCX file
 * @param targetText - The text to which the comment should be attached
 * @param commentText - The content of the comment to add
 * @throws Error if the target text is not found or if document.xml is missing
 */
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

    // Create the comment reference with the numeric ID
    const commentReference = doc.createElement('w:commentReference');
    commentReference.setAttribute('w:id', getNextCommentId(doc));
    targetNode.parentNode?.appendChild(commentReference);

    // Add comment to comments.xml
    let commentsDoc: Document;
    const commentsXml = await zip.file('word/comments.xml')?.async('text');
    if (commentsXml) {
        commentsDoc = new DOMParser().parseFromString(commentsXml, 'text/xml');
    } else {
        commentsDoc = new DOMParser().parseFromString('<w:comments xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"/>', 'text/xml');
    }

    // Use the new function to add the comment
    // console.log("commentsDoc:", commentsDoc);
    console.log("commentsDoc:", new XMLSerializer().serializeToString(commentsDoc));
    console.log(typeof addCommentToCollection(commentsDoc, commentText));

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

/**
 * Finds the highest comment ID in the comments document and returns the next available ID.
 * @param commentsDoc - The XML document containing comments
 * @returns The next available comment ID as a string
 */
function getNextCommentId(commentsDoc: Document): string {
    const comments = commentsDoc.getElementsByTagName('w:comment');
    let highestId = 0;

    for (const comment of Array.from(comments)) {
        const currentId = parseInt(comment.getAttribute('w:id') || '0', 10);
        if (currentId > highestId) {
            highestId = currentId;
        }
    }

    return (highestId + 1).toString();
}

/**
 * Creates and adds a new comment to a comments document.
 * @param commentsDoc - The XML document containing comments
 * @param commentText - The text content of the comment
 * @param author - Optional author name. Defaults to 'Script'
 * @returns The newly created comment element
 */
function addCommentToCollection(
    commentsDoc: Document,
    commentText: string,
    author: string = 'Script'
): Element {
    const nextId = getNextCommentId(commentsDoc);
    const commentElement = commentsDoc.createElement('w:comment');
    commentElement.setAttribute('w:id', nextId);
    commentElement.setAttribute('w:author', author);
    commentElement.setAttribute('w:date', new Date().toISOString());

    const commentTextElement = commentsDoc.createElement('w:p');
    const commentRunElement = commentsDoc.createElement('w:r');
    const commentTextNode = commentsDoc.createElement('w:t');
    commentTextNode.textContent = commentText;

    commentRunElement.appendChild(commentTextNode);
    commentTextElement.appendChild(commentRunElement);
    commentElement.appendChild(commentTextElement);
    commentsDoc.documentElement.appendChild(commentElement);
    console.log("commentElement:", commentElement);
    return commentElement;
}

/**
 * Retrieves all comments from a DOCX file.
 * @param docxFile - The path to the DOCX file
 * @returns An array of comment objects containing id and text
 */
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

/**
 * Prints all paragraphs from a Word document XML content.
 * Useful for debugging and viewing the document structure.
 * @param xmlContent - The XML content from document.xml
 */
function printDocumentParagraphs(xmlContent: string) {
    try {
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(xmlContent, 'text/xml');

        // Get all paragraph elements
        const paragraphs = xmlDoc.getElementsByTagName('w:p');

        console.log('Document Paragraphs:');
        for (let i = 0; i < paragraphs.length; i++) {
            const paragraph = paragraphs[i];

            // Create a new XMLSerializer to convert the paragraph back to string
            const serializer = new XMLSerializer();
            const paragraphXml = serializer.serializeToString(paragraph);

            console.log(`\nParagraph ${i + 1}:`);
            console.log(paragraphXml);
        }
    } catch (error) {
        console.error('Error parsing document:', error);
    }
}

/** Path to the demo DOCX file */
const filePath = 'E:\\projects\\dac\\demo_files\\accessible\\accessible.docx';

/**
 * Main function that demonstrates the usage of comment manipulation functions.
 * - Can add new comments (currently commented out)
 * - Retrieves and displays existing comments
 * - Prints document content for debugging purposes
 */
async function main() {
    try {
        // Add a new comment
        await addComment(filePath, 'hero', 'Yes he is');
        console.log('Comment added successfully');

        // Get and display all comments
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

        // printDocumentParagraphs(documentXml);

    } catch (error) {
        console.error('Error:', error);
    }
}

// @ai: Write a function that takes a document.xml and iterates through all the paragraphs printing them to the screen as XML

main();