import * as fs from 'fs';
import * as mammoth from 'mammoth';
import * as cheerio from 'cheerio';

/**
 * Checks if a table has an accessible header row.
 *
 * @param {CheerioStatic} $ - The cheerio instance.
 * @param {CheerioElement} table - The table element.
 * @returns {boolean} - True if the table has an accessible header row, false otherwise.
 */
const hasAccessibleHeaderRow = ($: cheerio.CheerioAPI, table: cheerio.Element): boolean => {
    const headerRow = $(table).find('tr').first();
    const headers = headerRow.find('th');

    if (headers.length === 0) {
        return false;
    }

    let accessible = true;
    headers.each((index, header) => {
        if (!$(header).attr('scope')) {
            accessible = false;
        }
    });

    return accessible;
};

/**
 * Reads a DOCX file and checks the first table for an accessible header row.
 *
 * @param {string} filePath - The path to the DOCX file.
 * @returns {Promise<void>} - A promise that resolves when the check is complete.
 */
const checkFirstTableHeader = async (filePath: string): Promise<void> => {
    const buffer = fs.readFileSync(filePath);
    const result = await mammoth.convertToHtml({ buffer });
    const html = result.value;
    const $ = cheerio.load(html);

    const firstTable = $('table').first();

    if (firstTable.length === 0) {
        console.log('No table found in the document.');
        return;
    }

    if (hasAccessibleHeaderRow($, firstTable[0])) {
        console.log('The first table has an accessible header row.');
    } else {
        console.log('The first table does not have an accessible header row.');
    }
};

// Example usage
const filePath = 'textdoc.docx';

checkFirstTableHeader(filePath).catch(error => {
    console.error('An error occurred:', error);
});