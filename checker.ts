import { execSync } from 'child_process';
import * as fs from 'fs';
import * as pa11y from 'pa11y';

const errorCodesToIgnore = [
    'WCAG2AAA.Principle3.Guideline3_1.3_1_1.H57.3.Lang',
    'WCAG2AAA.Principle3.Guideline3_1.3_1_1.H57.3.XmlLang',
];

const pa11yOptions = {
    standard: 'WCAG2AAA', // You can change this to other standards like 'Section508' or 'WCAG21AA'
};

/**
 * A class that checks the accessibility of a given input file.
 */
class AccessibilityChecker {
    /**
     * Checks if a given input file is accessible by converting it to HTML and
     * running accessibility checks on the resulting HTML.
     *
     * @param {string} inputFilePath - The path to the input file.
     * @param {string} outputFilePath - The path to the output file.
     * @return {Promise<Boolean>} A promise that resolves to a boolean indicating
     * whether the input file is accessible.
     */
    async isAccessible(inputFilePath: string, outputFilePath: string): Promise<Boolean> {
        let filteredResults = [];
        try {
            // Check if the input file exists
            if (!fs.existsSync(inputFilePath)) {
                throw new Error(`Input file does not exist: ${inputFilePath}`);
            }


            // Run the Pandoc command synchronously
            this.convertDocxToHtml(inputFilePath);

            // Use pa11y to check the HTML file for accessibility issues
            const results = await pa11y(outputFilePath, pa11yOptions as any)
            const filteredResults = results.issues.filter(issue => !errorCodesToIgnore.includes(issue.code));
            return filteredResults.length === 0
        } catch (error) {
            console.error(`Error during conversion or accessibility check: ${error.message}`);
        } finally {
            // fs.unlinkSync(outputFilePath);
        }
    }

    /**
     * Runs a Pandoc command synchronously. Throws an exception if the command
     * doesn't run successfully.
     *
     * @param {string} command - The Pandoc command to run.
     */
    private convertDocxToHtml(inputFilePath: string): void {
        const command = `pandoc "${inputFilePath}" -f docx -t html -o "${outputFilePath}" --standalone --metadata title=deleteme`;
        try {
            execSync(command);
        } catch (error) {
            throw new Error(`Error running Pandoc command: ${error.message}`);
        }
    }
}

// Example usage
const checker = new AccessibilityChecker();
const inputFilePath = 'document.docx';
const outputFilePath = 'deleteme.html';

checker.isAccessible(inputFilePath, outputFilePath)
    .then(result => console.log(`Accessibility check result: ${result}`))
    .catch(error => console.error(`Error during accessibility check: ${error.message}`));