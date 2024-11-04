import * as JSZip from 'jszip';
import { readFile } from 'fs/promises';
import { parseString } from 'xml2js';

/**
 * Interface for search result locations within the document
 */
interface SearchResult {
    paragraph: string;
    matchStart: number;
    matchEnd: number;
    fullText: string;
}

/**
 * Options for the search function
 */
interface SearchOptions {
    caseSensitive?: boolean;
    wholeWord?: boolean;
}

/**
 * Searches for a string within a Word document
 * @param filename - Path to the Word document
 * @param searchText - Text to search for
 * @param options - Search options (optional)
 * @returns Promise resolving to array of search results
 * @throws Error if document cannot be opened or parsed
 */
export async function searchWordDocument(
    filename: string,
    searchText: string,
    options: SearchOptions = {}
): Promise<SearchResult[]> {
    // Set default options
    const {
        caseSensitive = false,
        wholeWord = false
    } = options;

    try {
        // Read the .docx file
        const data = await readFile(filename);
        const zip = new JSZip();

        // Load the document
        const document = await zip.loadAsync(data);

        // Get the main document content
        const documentXml = await document.file('word/document.xml')?.async('string');
        if (!documentXml) {
            throw new Error('Could not find document.xml in the Word file');
        }

        // Parse the XML content
        const results: SearchResult[] = [];
        await new Promise((resolve, reject) => {
            parseString(documentXml, (err, result) => {
                if (err) {
                    reject(new Error(`Failed to parse document XML: ${err.message}`));
                    return;
                }

                try {
                    // Get all paragraphs from the document
                    const paragraphs = result?.['w:document']?.['w:body']?.[0]?.['w:p'] || [];

                    // Process each paragraph
                    for (const paragraph of paragraphs) {
                        let paragraphText = '';
                        const runs = paragraph?.['w:r'] || [];

                        // Combine all text runs in the paragraph
                        for (const run of runs) {
                            const texts = run?.['w:t'] || [];
                            for (const text of texts) {
                                paragraphText += text?._ || text || '';
                            }
                        }

                        // Prepare text for search based on options
                        let searchIn = caseSensitive ? paragraphText : paragraphText.toLowerCase();
                        let searchFor = caseSensitive ? searchText : searchText.toLowerCase();

                        // Handle whole word search
                        if (wholeWord) {
                            const wordBoundary = '\\b';
                            const regex = new RegExp(wordBoundary + searchFor + wordBoundary, caseSensitive ? 'g' : 'gi');
                            let match;

                            while ((match = regex.exec(searchIn)) !== null) {
                                results.push({
                                    paragraph: paragraphText,
                                    matchStart: match.index,
                                    matchEnd: match.index + searchText.length,
                                    fullText: match[0]
                                });
                            }
                        } else {
                            // Regular substring search
                            let position = -1;
                            while ((position = searchIn.indexOf(searchFor, position + 1)) !== -1) {
                                results.push({
                                    paragraph: paragraphText,
                                    matchStart: position,
                                    matchEnd: position + searchText.length,
                                    fullText: paragraphText.slice(position, position + searchText.length)
                                });
                            }
                        }
                    }

                    resolve(null);
                } catch (error) {
                    reject(new Error(`Failed to process document content: ${error.message}`));
                }
            });
        });

        return results;

    } catch (error) {
        throw new Error(`Failed to search document: ${error.message}`);
    }
}

/**
 * Example usage of the search function
 */
async function example() {
    try {
        // Basic search
        const basicResults = await searchWordDocument('textdoc.docx', 'fred');
        console.log('Basic search results:', basicResults);

        // // Case-sensitive whole word search
        // const advancedResults = await searchWordDocument(
        //     'example.docx',
        //     'search text',
        //     {
        //         caseSensitive: true,
        //         wholeWord: true
        //     }
        // );

        // // Process results
        // advancedResults.forEach((result, index) => {
        //     console.log(`\nMatch ${index + 1}:`);
        //     console.log('Paragraph:', result.paragraph);
        //     console.log('Matched text:', result.fullText);
        //     console.log('Position:', result.matchStart, 'to', result.matchEnd);
        // });

    } catch (error) {
        console.error('Search failed:', error.message);
    }
}

example();