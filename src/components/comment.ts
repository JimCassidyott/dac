import * as fs from 'fs';
import * as path from 'path';
const AdmZip = require('adm-zip'); // Using require here is important. If you use import, it will throw an error.
import * as xml2js from 'xml2js';

/**
 * Extracts comments from a .docx file.
 *
 * @param {string} filePath - The path to the Word document.
 * @returns {Promise<string[]>} A Promise that resolves to an array of comments.
 * @throws {Error} If there is an error reading or parsing the comments XML.
 */
export async function extractCommentsFromDocx(filePath: string): Promise<string[]> {
    const fileExtension: string = path.extname(filePath).toLowerCase();
    if (fileExtension !== '.docx') {
        throw new Error('The provided file is not a Word document (.docx)');
    }

    try {
        // Read the .docx file as a zip
        const zip = new AdmZip(filePath);
        console.log(zip.getZipComment());
        // Get the comments.xml file
        const commentsXml = zip.getEntry('word/comments.xml');
        if (!commentsXml) {
            throw new Error('No comments.xml file found in the .docx archive.');
        }

        const commentsXmlContent = commentsXml.getData().toString('utf8');

        // Parse the XML content
        const parser = new xml2js.Parser();
        const result = await parser.parseStringPromise(commentsXmlContent);

        // Extract comments
        const comments = result['w:comments']['w:comment'].map((comment: any) => comment['w:t'].join(' '));

        return comments;
    } catch (error) {
        throw new Error(`Error extracting comments from .docx file: ${error.message}`);
    }
}

// Example usage
async function exampleUsage() {
    const filePath = 'jim.docx';

    try {
        const comments = await extractCommentsFromDocx(filePath);
        console.log('Extracted comments:', comments);
    } catch (error) {
        console.error('Error extracting comments:', error);
    }
}

exampleUsage();