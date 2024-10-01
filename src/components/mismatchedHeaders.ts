import * as fs from 'fs';
import * as mammoth from 'mammoth';

/**
 * Reads a Word document and finds mismatched headers.
 *
 * @param {string} filePath - The path to the Word document.
 * @returns {Promise<string[]>} - A list of error messages indicating mismatched headers.
 */
const findMismatchedHeaders = async (filePath: string): Promise<string[]> => {
    const buffer = fs.readFileSync(filePath);
    const result = await mammoth.extractRawText({ buffer });
    const text = result.value;
    const lines = text.split('\n');
    const errors: string[] = [];

    let lastHeaderLevel: number | null = null;

    lines.forEach(line => {
        const match = line.match(/^(#+)\s+(.*)$/);
        if (match) {
            const headingLevel = match[1].length;
            const headingText = match[2];

            if (lastHeaderLevel !== null && headingLevel > lastHeaderLevel + 1) {
                errors.push(`Mismatched header: "${headingText}" at level ${headingLevel} cannot follow a header at level ${lastHeaderLevel}`);
            }
            lastHeaderLevel = headingLevel;
        }
    });

    return errors;
};

// Example usage
const filePath = 'textdoc.docx';

findMismatchedHeaders(filePath).then(errors => {
    if (errors.length === 0) {
        console.log('No mismatched headers found.');
    } else {
        console.log('Mismatched headers found:');
        errors.forEach(error => {
            console.log(error);
        });
    }
}).catch(error => {
    console.error('An error occurred:', error);
});