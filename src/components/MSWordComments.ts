/**
 * This module provides functionality for managing comments in DOCX files using the Office Open XML format.
 * It allows adding comments to specific text and retrieving existing comments from DOCX documents.
 */

import * as JSZip from 'jszip';
import { DOMParser, XMLSerializer } from 'xmldom';
import * as fs from 'fs/promises';
import { parseString, Builder } from 'xml2js';

/**
 * A class that provides functionality for managing comments in DOCX files.
 */
export class MSWordComments {
    /**
     * Adds a comment to a specific text in a DOCX file.
     * @param docxFile - The path to the DOCX file
     * @param targetText - The text to which the comment should be attached
     * @param commentText - The content of the comment to add
     * @throws Error if the target text is not found or if document.xml is missing
     */
    async addComment(docxFile: string, targetText: string, commentText: string): Promise<void> {
        const data = await fs.readFile(docxFile);
        const zip = await JSZip.loadAsync(data);

        // Read and parse document.xml
        const documentXml = await zip.file('word/document.xml')?.async('text');
        if (!documentXml) {
            throw new Error('document.xml not found in the DOCX file');
        }
        const doc = new DOMParser().parseFromString(documentXml, 'text/xml');

        // Find the target text with improved search
        const textNodes = doc.getElementsByTagName('w:t');
        let targetNode: Node | null = null;
        let targetRunElement: Node | null = null;
        let targetParagraph: Node | null = null;

        // First try exact match
        for (const node of Array.from(textNodes)) {
            const text = node.textContent || '';
            if (text === targetText) {
                targetNode = node;
                const parent = node.parentNode;
                if (parent && parent.nodeType === 1) {
                    targetRunElement = parent;
                    const paragraphParent = parent.parentNode;
                    if (paragraphParent && paragraphParent.nodeType === 1) {
                        targetParagraph = paragraphParent;
                    }
                }
                break;
            }
        }

        // If no exact match, try partial match
        if (!targetNode) {
            for (const node of Array.from(textNodes)) {
                const text = node.textContent || '';
                if (text.includes(targetText)) {
                    targetNode = node;
                    const parent = node.parentNode;
                    if (parent && parent.nodeType === 1) {
                        targetRunElement = parent;
                        const paragraphParent = parent.parentNode;
                        if (paragraphParent && paragraphParent.nodeType === 1) {
                            targetParagraph = paragraphParent;
                        }
                    }
                    break;
                }
            }
        }

        // If still no match, try concatenating adjacent text nodes within the same paragraph
        if (!targetNode) {
            const paragraphs = doc.getElementsByTagName('w:p');
            for (const para of Array.from(paragraphs)) {
                const paraTextNodes = para.getElementsByTagName('w:t');
                let fullText = '';
                let lastNode: Node | null = null;

                // Build the full text of the paragraph
                for (const node of Array.from(paraTextNodes)) {
                    const text = node.textContent || '';
                    fullText += text;
                    if (fullText.includes(targetText) && !targetNode) {
                        targetNode = node;
                        const parent = node.parentNode;
                        if (parent && parent.nodeType === 1) {
                            targetRunElement = parent;
                            targetParagraph = para;
                        }
                        break;
                    }
                    lastNode = node;
                }

                if (targetNode) break;
            }
        }

        if (!targetNode || !targetRunElement || !targetParagraph) {
            throw new Error(`Target text "${targetText}" not found in the document`);
        }

        // Create the comment reference with the numeric ID
        const commentId = this.getNextCommentId(doc);

        // Create comment range start
        const commentRangeStart = doc.createElement('w:commentRangeStart');
        commentRangeStart.setAttribute('w:id', commentId);
        targetParagraph.insertBefore(commentRangeStart, targetRunElement);

        // Create comment range end
        const commentRangeEnd = doc.createElement('w:commentRangeEnd');
        commentRangeEnd.setAttribute('w:id', commentId);
        targetParagraph.insertBefore(commentRangeEnd, targetRunElement.nextSibling);

        // Create the comment reference
        const commentReference = doc.createElement('w:commentReference');
        commentReference.setAttribute('w:id', commentId);
        const commentRun = doc.createElement('w:r');
        commentRun.appendChild(commentReference);
        targetParagraph.insertBefore(commentRun, commentRangeEnd.nextSibling);

        // Add comment to comments.xml
        let commentsDoc: Document;
        const commentsXml = await zip.file('word/comments.xml')?.async('text');
        if (commentsXml) {
            commentsDoc = new DOMParser().parseFromString(commentsXml, 'text/xml');
        } else {
            // Create new comments.xml with proper namespace
            commentsDoc = new DOMParser().parseFromString(
                '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' +
                '<w:comments ' +
                'xmlns:o="urn:schemas-microsoft-com:office:office" ' +
                'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" ' +
                'xmlns:v="urn:schemas-microsoft-com:vml" ' +
                'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" ' +
                'xmlns:w10="urn:schemas-microsoft-com:office:word" ' +
                'xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" ' +
                'xmlns:wps="http://schemas.microsoft.com/office/word/2010/wordprocessingShape" ' +
                'xmlns:wpg="http://schemas.microsoft.com/office/word/2010/wordprocessingGroup" ' +
                'xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006" ' +
                'xmlns:wp14="http://schemas.microsoft.com/office/word/2010/wordprocessingDrawing" ' +
                'xmlns:w14="http://schemas.microsoft.com/office/word/2010/wordml" ' +
                'xmlns:w15="http://schemas.microsoft.com/office/word/2012/wordml" ' +
                'mc:Ignorable="w14 wp14 w15"/>',
                'text/xml'
            );
        }

        // Use the helper method to add the comment
        const newComment = this.addCommentToCollection(commentsDoc, commentText);
        if (!newComment) {
            throw new Error('Failed to create comment element');
        }

        // Update the ZIP with modified XMLs
        zip.file('word/document.xml', new XMLSerializer().serializeToString(doc));
        zip.file('word/comments.xml', new XMLSerializer().serializeToString(commentsDoc));

        // Ensure the document has a relationship to comments.xml
        const documentRelsPath = 'word/_rels/document.xml.rels';
        let relsXml = await zip.file(documentRelsPath)?.async('text');
        let relsDoc: Document;

        if (relsXml) {
            relsDoc = new DOMParser().parseFromString(relsXml, 'text/xml');
        } else {
            // Create new relationships file if it doesn't exist
            relsDoc = new DOMParser().parseFromString(
                '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' +
                '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"/>',
                'text/xml'
            );
        }

        // Check if comments relationship exists
        let hasCommentsRelationship = false;
        const relationships = relsDoc.getElementsByTagName('Relationship');
        for (const rel of Array.from(relationships)) {
            if (rel.getAttribute('Target') === 'comments.xml') {
                hasCommentsRelationship = true;
                break;
            }
        }

        // Add comments relationship if it doesn't exist
        if (!hasCommentsRelationship) {
            const newRel = relsDoc.createElement('Relationship');
            newRel.setAttribute('Id', 'rId' + (relationships.length + 1));
            newRel.setAttribute('Type', 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/comments');
            newRel.setAttribute('Target', 'comments.xml');
            relsDoc.documentElement.appendChild(newRel);
            zip.file(documentRelsPath, new XMLSerializer().serializeToString(relsDoc));
        }

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
    private getNextCommentId(commentsDoc: Document): string {
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
     * @param author - Optional author name. Defaults to 'DAC'
     * @returns The newly created comment element
     */
    private addCommentToCollection(
        commentsDoc: Document,
        commentText: string,
        author: string = 'DAC'
    ): Node {
        const nextId = this.getNextCommentId(commentsDoc);
        const commentElement = commentsDoc.createElement('w:comment');
        commentElement.setAttribute('w:id', nextId);
        commentElement.setAttribute('w:author', author);
        commentElement.setAttribute('w:date', new Date().toISOString());
        commentElement.setAttribute('w:initials', '');

        // Create paragraph element
        const commentPara = commentsDoc.createElement('w:p');

        // Create paragraph properties
        const commentParaPr = commentsDoc.createElement('w:pPr');
        const overflowPunct = commentsDoc.createElement('w:overflowPunct');
        overflowPunct.setAttribute('w:val', 'false');
        const bidi = commentsDoc.createElement('w:bidi');
        bidi.setAttribute('w:val', '0');
        const rPr = commentsDoc.createElement('w:rPr');
        commentParaPr.appendChild(overflowPunct);
        commentParaPr.appendChild(bidi);
        commentParaPr.appendChild(rPr);
        commentPara.appendChild(commentParaPr);

        // Create run element
        const commentRun = commentsDoc.createElement('w:r');
        const runProps = commentsDoc.createElement('w:rPr');
        const rFonts = commentsDoc.createElement('w:rFonts');
        rFonts.setAttribute('w:eastAsia', 'Segoe UI');
        rFonts.setAttribute('w:cs', 'Tahoma');
        const kern = commentsDoc.createElement('w:kern');
        kern.setAttribute('w:val', '0');
        const lang = commentsDoc.createElement('w:lang');
        lang.setAttribute('w:val', 'en-US');
        lang.setAttribute('w:eastAsia', 'en-US');
        lang.setAttribute('w:bidi', 'en-US');

        runProps.appendChild(rFonts);
        runProps.appendChild(kern);
        runProps.appendChild(lang);
        commentRun.appendChild(runProps);

        // Create text element with content and use the provided commentText
        const commentTextNode = commentsDoc.createElement('w:t');
        commentTextNode.textContent = commentText; // Use the provided commentText here
        commentRun.appendChild(commentTextNode);

        // Assemble the comment structure
        commentPara.appendChild(commentRun);
        commentElement.appendChild(commentPara);

        // Add to comments root
        const commentsRoot = commentsDoc.getElementsByTagName('w:comments')[0];
        if (!commentsRoot) {
            throw new Error('Comments root element not found');
        }
        commentsRoot.appendChild(commentElement);

        return commentElement;
    }

    /**
     * Retrieves all comments from a DOCX file.
     * @param docxFile - The path to the DOCX file
     * @returns An array of comment objects containing id and text
     */
    async getComments(docxFile: string): Promise<Array<{ id: string, text: string }>> {
        const data = await fs.readFile(docxFile);
        const zip = await JSZip.loadAsync(data);

        const commentsXml = await zip.file('word/comments.xml')?.async('text');

        if (!commentsXml) {
            console.log('No comments.xml found in the document');
            return [];
        } else {
            console.log('Comments.xml found in the document:', commentsXml);
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
    async printDocumentParagraphs(xmlContent: string): Promise<void> {
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
}

// Example usage and tests
async function test() {
    const filePath = 'D:\\projects\\dac\\demo_files\\accessible\\accessible.docx';
    const commenter = new MSWordComments();

    try {
        // Example 1: Add a comment to specific text
        console.log('Testing: Adding a comment...');
        await commenter.addComment(filePath, 'hero', ' a test comment from MSWordComments');
        console.log('✓ Comment added successfully\n');

        console.log('Testing: Adding a jimcomment...');
        await commenter.addComment(filePath, 'Jim', 'JIM a test comment from MSWordComments');
        console.log('✓ Comment added successfully\n');
        // Example 2: Get all comments from the document
        console.log('Testing: Retrieving all comments...');
        const comments = await commenter.getComments(filePath);
        console.log('Comments found:', comments.length);
        comments.forEach(comment => {
            console.log(`- Comment ID: ${comment.id}`);
            console.log(`  Content: ${comment.text}\n`);
        });

        // Example 3: Add multiple comments
        console.log('Testing: Adding multiple comments...');
        const textsToComment = [
            { target: 'hero', comment: 'Another comment about the hero' },
            { target: 'Yes', comment: 'Commenting Yes' }
        ];

        for (const item of textsToComment) {
            await commenter.addComment(filePath, item.target, item.comment);
            console.log(`✓ Added comment to "${item.target}" "${item.comment}"\n`);
        }

        // Example 4: Show final comment count
        const finalComments = await commenter.getComments(filePath);
        console.log(`\nFinal comment count: ${finalComments.length}`);

        console.log('\nAll tests completed successfully!');

    } catch (error) {
        console.error('Test failed:', error);
    }
}

// Run the tests if this file is executed directly
if (require.main === module) {
    test().catch(console.error);
}
