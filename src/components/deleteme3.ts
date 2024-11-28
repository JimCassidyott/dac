import * as JSZip from 'jszip';
import * as fs from 'fs';
import * as xml2js from 'xml2js';

interface WordParagraph {
    'w:r': Array<any>;
}

interface WordDocument {
    'w:document': {
        'w:body': [{
            'w:p': WordParagraph[];
        }];
    };
}

interface WordComment {
    'w:comment': [{
        '$': {
            'w:id': string,
            'w:author': string,
            'w:date': string
        },
        'w:p': [{
            'w:r': [{
                'w:t': [string]
            }]
        }]
    }]
}

// @ai: Make the comment ID a random number from one to 10,000.
const commentId = Math.floor(Math.random() * 10000) + 1;
const commentAuthor = 'Author Name';
const commentText = 'This is my comment about Fred.';
const searchText = 'fred';

async function addCommentToWord(filePath: string) {
    // Read the Word document
    const data = fs.readFileSync(filePath);
    const zip = await JSZip.loadAsync(data);

    // Read the document.xml
    const docXml = await zip.file('word/document.xml').async('string');
    const docXmlObj = await xml2js.parseStringPromise(docXml) as WordDocument;

    // Find the paragraph containing the search text
    let paragraph: WordParagraph | undefined;
    docXmlObj['w:document']['w:body'][0]['w:p'].forEach((p: WordParagraph) => {
        // Check all text content in the paragraph
        const paragraphText = p['w:r']?.reduce((text: string, run: any) => {
            return text + (run['w:t']?.[0] || '');
        }, '');
        
        if (paragraphText?.toLowerCase().includes(searchText.toLowerCase())) {
            paragraph = p;
        }
    });

    // @ai: Find out why the paragraph is undefined at this point but the text Fred does appear in the document    //@ai: Turn the document body into regular XML before printing it
    const builder = new xml2js.Builder();
    const docXmlStr = builder.buildObject(docXmlObj);
    console.log(docXmlStr, '\n', paragraph);

    if (!paragraph) {
        console.log('Text not found.');
        return;
    }

    // Add the comment reference to the paragraph
    const commentRangeStart = {
        'w:commentRangeStart': [{ '$': { 'w:id': commentId.toString() } }]
    };
    const commentRangeEnd = {
        'w:commentRangeEnd': [{ '$': { 'w:id': commentId.toString() } }]
    };
    const commentReference = {
        'w:r': [{ 'w:rPr': [{}], 'w:commentReference': [{ '$': { 'w:id': commentId.toString() } }] }]
    };

    paragraph['w:r'].unshift(commentRangeStart);
    paragraph['w:r'].push(commentRangeEnd);
    paragraph['w:r'].push(commentReference);

    // Read the comments.xml
    let commentsXml = await zip.file('word/comments.xml').async('string');
    let commentsXmlObj = await xml2js.parseStringPromise(commentsXml);

    // Add the comment
    const comment: WordComment = {
        'w:comment': [{
            '$': {
                'w:id': commentId.toString(),
                'w:author': commentAuthor,
                'w:date': new Date().toISOString()
            },
            'w:p': [{ 'w:r': [{ 'w:t': [commentText] }] }]
        }]
    };

    if (!commentsXmlObj['w:comments']) {
        commentsXmlObj['w:comments'] = {};
    }
    if (!commentsXmlObj['w:comments']['w:comment']) {
        commentsXmlObj['w:comments']['w:comment'] = [];
    }
    commentsXmlObj['w:comments']['w:comment'].push(comment['w:comment'][0]);

    // Convert XML objects back to strings
    const newDocXml = builder.buildObject(docXmlObj);
    const newCommentsXml = builder.buildObject(commentsXmlObj);

    // Update the zip with modified XML
    zip.file('word/document.xml', newDocXml);
    zip.file('word/comments.xml', newCommentsXml);

    // Save the updated Word document
    const content = await zip.generateAsync({ type: 'nodebuffer' });
    fs.writeFileSync('updated_' + filePath, content);

    console.log('Comment added and document saved as updated_' + filePath);
}

// Example usage
addCommentToWord('textdoc.docx');
