import * as path from 'path';
const AdmZip = require('adm-zip'); // Using require here is important. If you use import, it will throw an error.
import * as xml2js from 'xml2js';
import * as fs from 'fs';


interface DiffPart {
    text: string;
    type: 'common' | 'added' | 'removed';
}

/**
 * Converts a JSON object to an XML string.
 *
 * @param {any} jsonObject - The JSON object to convert.
 * @returns {string} The XML string.
 */
function jsonToXml(jsonObject: any): string {
    const builder = new xml2js.Builder();
    return builder.buildObject(jsonObject);
}

function compareStrings(str1: string, str2: string): DiffPart[] {

    str1 = str1.trimEnd();
    str2 = str2.trimEnd();

    const result: DiffPart[] = [];
    let i = 0;
    let j = 0;

    while (i < str1.length || j < str2.length) {
        if (i < str1.length && j < str2.length && str1[i] === str2[j]) {
            // Characters are the same
            let commonPart = '';
            while (i < str1.length && j < str2.length && str1[i] === str2[j]) {
                commonPart += str1[i];
                i++;
                j++;
            }
            result.push({ text: commonPart, type: 'common' });
        } else {
            // Characters are different
            let removedPart = '';
            while (i < str1.length && (j >= str2.length || str1[i] !== str2[j])) {
                removedPart += str1[i];
                i++;
            }
            if (removedPart) {
                result.push({ text: removedPart, type: 'removed' });
            }

            let addedPart = '';
            while (j < str2.length && (i >= str1.length || str1[i] !== str2[j])) {
                addedPart += str2[j];
                j++;
            }
            if (addedPart) {
                result.push({ text: addedPart, type: 'added' });
            }
        }
    }

    return result;
}
/**
 * Extracts comments from a .docx file and modifies the first comment.
 *
 * @param {string} filePath - The path to the Word document.
 * @returns {Promise<{ comments: string[], xmlContent: string }>} A Promise that resolves to an object containing an array of comments and the XML content.
 * @throws {Error} If there is an error reading or parsing the comments XML.
 */
async function extractAndModifyComments(filePath: string): Promise<{ comments: string[], xmlContent: string }> {
    const fileExtension: string = path.extname(filePath).toLowerCase();
    if (fileExtension !== '.docx') {
        throw new Error('The provided file is not a Word document (.docx)');
    }

    try {
        // Read the .docx file as a zip
        const zip = new AdmZip(filePath);

        // Get the comments.xml file

        const commentsXml = zip.getEntry('word/comments.xml');
        if (!commentsXml) {
            throw new Error('No comments.xml file found in the .docx archive.');
        }

        const commentsXmlContent = commentsXml.getData().toString('utf8');
        console.log(commentsXmlContent)

        // Parse the XML content
        const parser = new xml2js.Parser();
        const result = await parser.parseStringPromise(commentsXmlContent);


        // Extract comments
        const comments = result['w:comments']['w:comment'].map((comment: any) => {
            if (Array.isArray(comment['w:t'])) {
                return comment['w:t'].join(' ');
            } else if (typeof comment['w:t'] === 'string') {
                return comment['w:t'];
            } else {
                return '';
            }
        });

        // Modify the first comment
        if (result['w:comments']['w:comment'][0] && result['w:comments']['w:comment'][0]['w:t']) {
            result['w:comments']['w:comment'][0]['w:t'] = ['fart'];
        }

        // Convert the modified XML back to a string
        const builder = new xml2js.Builder();
        const updatedXmlContent = builder.buildObject(result);

        // Update the comments.xml file in the zip
        zip.updateFile('word/comments.xml', Buffer.from(updatedXmlContent, 'utf8'));

        // Save the modified .docx file
        const updatedFilePath = path.join(path.dirname(filePath), 'modified_' + path.basename(filePath));
        zip.writeZip(updatedFilePath);

        return { comments, xmlContent: updatedXmlContent };
    } catch (error) {
        throw new Error(`Error extracting and modifying comments from .docx file: ${error.message}`);
    }
}

/**
 * Converts XML content to a JSON object.
 *
 * @param {string} xmlContent - The XML content as a string.
 * @returns {Promise<any>} A Promise that resolves to the JSON object.
 */
async function xmlToJson(xmlContent: string): Promise<any> {
    const parser = new xml2js.Parser();
    return parser.parseStringPromise(xmlContent);
}

// Example usage
async function exampleUsage(filePath: string) {
    try {
        const { comments, xmlContent } = await extractAndModifyComments(filePath);
        console.log(`Number of comments: ${comments.length}`);
        console.log('Extracted comments:');
        comments.forEach((comment, index) => {
            console.log("****************************")
            console.log(`Comment ${index + 1}: ${comment}`);
        });

        console.log(comments)
        // Convert XML content to JSON and print it
        // const jsonObject = await xmlToJson(xmlContent);
        // console.log(xmlContent, jsonToXml(jsonObject));


    } catch (error) {
        console.error('Error extracting and modifying comments:', error);
    }
}


// Replace 'path/to/your/document.docx' with the actual path to your .docx file
const filePath = 'textdoc.docx';
exampleUsage(filePath);