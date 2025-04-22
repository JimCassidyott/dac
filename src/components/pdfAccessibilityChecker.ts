import * as fs from 'fs';
import { PDFDocument } from 'pdf-lib';
import * as pdfjsLib from 'pdfjs-dist';

// Types for pdf.js annotations and links
interface PDFAnnotation {
    subtype: string;
    fieldType?: string;
    fieldName?: string;
    alternativeText?: string;
    fieldLabel?: string;
    rect?: number[];
    tabIndex?: number;
}

/**
 * Represents a pending test that has not been implemented or run yet
 */
export interface PendingTest {
    /** The WCAG criterion that this test covers (e.g., "2.4.5 Multiple Ways") */
    criterion: string;

    /** Reason why this test is pending (e.g., "In Progress - Requirements Gathering") */
    reason: string;

    /** Current status of the test implementation (e.g., "Planned", "In Progress", "Completed") */
    status?: string;
}

/**
 * Represents the result of document type detection
 */
export interface DocumentTypeResult {
    /** Whether the document is a form */
    isForm: boolean;

    /** Whether the document is a regular document (not a form) */
    isDocument: boolean;

    /** Confidence level (as a percentage) in the document type classification */
    confidence: number;

    /**
     * Additional details about the document type detection process
     */
    details: string[];
}

/**
 * Represents a single accessibility issue found in a PDF document
 */
export interface AccessibilityIssue {
    /** The WCAG criterion that this issue violates (e.g., "1.1.1 Non-text Content") */
    criterion: string;

    /** Detailed description of the accessibility issue */
    description: string;

    /** Severity of the issue's impact on users with disabilities (e.g., "Critical", "Serious", "Moderate") */
    impact: string;

    /** Suggested steps to fix the accessibility issue */
    remediation: string;
}

/**
 * Represents a complete accessibility report for a PDF document
 */
export interface AccessibilityReport {
    /** Name of the PDF file that was analyzed */
    filename: string;

    /** Whether the document passed all accessibility checks */
    passed: boolean;

    /** List of all accessibility issues found in the document */
    issues: AccessibilityIssue[];

    /**
     * List of tests that are pending implementation or have not been run
     */
    pendingTests?: PendingTest[];

    /**
     * Additional notes or comments about the accessibility of the document
     */
    additionalNotes?: string;

    /**
     * Information about the type of document (form or regular document) and the confidence level of this classification
     */
    documentType?: DocumentTypeResult;

    /** Timestamp when the accessibility report was generated */
    timestamp: string;
}

/**
 * Class containing implementations of WCAG tests for PDF documents
 */
export class WcagTests {
    /**
     * Helper class to create consistent accessibility issues
     */
    private static IssueFactory = {
        createIssue(
            criterion: string,
            description: string,
            impact: string,
            remediation: string
        ): AccessibilityIssue {
            return {
                criterion,
                description,
                impact,
                remediation
            };
        },

        createErrorIssue(
            criterion: string,
            error: Error,
            description: string,
            remediation: string
        ): AccessibilityIssue {
            return {
                criterion,
                description: `${description}: ${error.message}`,
                impact: "Critical",
                remediation
            };
        }
    };

    /**
     * Tests if all form fields in a PDF document have labels (WCAG 3.3.2)
     * @param pdfPath Path to the PDF file
     * @returns Promise resolving to an object with test result and optional issue
     */
    static async testFormFieldLabels(pdfPath: string): Promise<{ passed: boolean; issue?: AccessibilityIssue }> {
        try {
            // Load the PDF document using pdf.js
            const doc = await pdfjsLib.getDocument(pdfPath).promise;
            
            // Get form fields from all pages
            const formFields: Array<{
                name: string;
                type: string;
                page: number;
                hasLabel: boolean;
            }> = [];

            // Process each page
            for (let pageNum = 1; pageNum <= doc.numPages; pageNum++) {
                const page = await doc.getPage(pageNum);
                const annotations = await page.getAnnotations();
                
                // Filter for form field annotations
                const fields = annotations.filter((annot: PDFAnnotation) => 
                    annot.subtype === 'Widget' && // Widget annotations are form fields
                    annot.fieldType // Must have a field type
                );

                // Process each field
                for (const field of fields) {
                    formFields.push({
                        name: field.fieldName || '',
                        type: field.fieldType || '',
                        page: pageNum,
                        hasLabel: Boolean(field.alternativeText || field.fieldLabel)
                    });
                }
            }

            // If no form fields found, this criterion doesn't apply
            if (formFields.length === 0) {
                console.log('No form fields found, WCAG 3.3.2 criterion does not apply');
                return { passed: true };
            }

            // Check for fields without labels
            const fieldsWithoutLabels = formFields.filter((field) => !field.hasLabel);
            
            if (fieldsWithoutLabels.length > 0) {
                return {
                    passed: false,
                    issue: {
                        criterion: "WCAG 3.3.2 Labels or Instructions (Level A)",
                        description: `Found ${fieldsWithoutLabels.length} form fields without labels out of ${formFields.length} total fields.`,
                        impact: "Critical - Users may not understand the purpose or required input for form fields",
                        remediation: "Add descriptive labels to all form fields to ensure users understand their purpose"
                    }
                };
            }

            // All fields have labels
            return { passed: true };
        } catch (error) {
            console.error('Error testing form field labels:', error);
            return {
                passed: false,
                issue: {
                    criterion: "WCAG 3.3.2 Labels or Instructions (Level A)",
                    description: "Unable to check form field labels due to an error",
                    impact: "Critical",
                    remediation: "Ensure the PDF file is valid and accessible"
                }
            };
        }
    }

    /**
     * Extracts form fields in the tab order specified in the PDF metadata
     * This is useful for analyzing keyboard navigation and focus order
     * @param pdfPath Path to the PDF file
     * @returns Promise resolving to an array of objects containing field info and position
     */
    static async extractFormFieldsInTabOrder(pdfPath: string): Promise<Array<{
        name: string;
        type: string;
        page: number;
        rect: { x: number; y: number; width: number; height: number };
        hasLabel: boolean;
        tabIndex?: number;
    }>> {
        try {
            const doc = await pdfjsLib.getDocument(pdfPath).promise;
            const fieldPositions: Array<{
                name: string;
                type: string;
                page: number;
                rect: { x: number; y: number; width: number; height: number };
                hasLabel: boolean;
                tabIndex?: number;
            }> = [];

            // Process each page
            for (let pageNum = 1; pageNum <= doc.numPages; pageNum++) {
                const page = await doc.getPage(pageNum);
                const annotations = await page.getAnnotations();
                
                // Filter for form field annotations
                const fields = annotations.filter((annot: PDFAnnotation) => 
                    annot.subtype === 'Widget' && // Widget annotations are form fields
                    annot.fieldType // Must have a field type
                );

                // Process each field
                for (const field of fields) {
                    const rect = field.rect || [0, 0, 0, 0];
                    fieldPositions.push({
                        name: field.fieldName || '',
                        type: field.fieldType || '',
                        page: pageNum,
                        rect: {
                            x: rect[0],
                            y: rect[1],
                            width: rect[2] - rect[0],
                            height: rect[3] - rect[1]
                        },
                        hasLabel: Boolean(field.alternativeText || field.fieldLabel),
                        tabIndex: field.tabIndex
                    });
                }
            }

            // Sort fields by tab index
            return fieldPositions.sort((a, b) => {
                if (a.tabIndex === undefined && b.tabIndex === undefined) return 0;
                if (a.tabIndex === undefined) return 1;
                if (b.tabIndex === undefined) return -1;
                return a.tabIndex - b.tabIndex;
            });
        } catch (error) {
            console.error('Error extracting form fields in tab order:', error);
            return [];
        }
    }

    /**
     * Determines whether a PDF file is a form or a regular document
     * @param pdfPath Path to the PDF file
     * @returns Object containing isForm, isDocument flags, confidence level, and details
     */
    static async detectDocumentType(pdfPath: string): Promise<{
        isForm: boolean;
        isDocument: boolean;
        confidence: number;
        details: string[];
    }> {
        try {
            // Load the document with pdf.js
            const doc = await pdfjsLib.getDocument(pdfPath).promise;
            const details: string[] = [];
            
            // Check for form annotations on each page
            let hasFormFields = false;
            for (let i = 1; i <= doc.numPages; i++) {
                const page = await doc.getPage(i);
                const annotations = await page.getAnnotations();
                
                // Look for Widget annotations (form fields)
                const formFields = annotations.filter((annot: PDFAnnotation) => 
                    annot.subtype === 'Widget' && // Widget annotations are form fields
                    annot.fieldType // Must have a field type
                );
                
                if (formFields.length > 0) {
                    hasFormFields = true;
                    details.push(`Found ${formFields.length} form fields on page ${i}`);
                    break; // Stop once we find form fields
                }
            }
            
            // If we found form fields, this is definitely a form
            if (hasFormFields) {
                // Extract and print form fields in both orders
                console.log("\n=== Form Fields in Tab Order ===");
                const tabOrderFields = await this.extractFormFieldsInTabOrder(pdfPath);
                tabOrderFields.forEach((field, index) => {
                    console.log(`${index + 1}. ${field.name} (Type: ${field.type}, Page: ${field.page + 1}, Tab Index: ${field.tabIndex ?? 'N/A'})`);
                });

                return {
                    isForm: true,
                    isDocument: false,
                    confidence: 100,
                    details
                };
            }
            
            // If we get here, no form fields were found
            details.push('No form fields found in the document');
            return {
                isForm: false,
                isDocument: true,
                confidence: 100,
                details
            };
        } catch (error) {
            console.error('Error detecting document type:', error);
            // Default to document if we can't determine type
            return {
                isForm: false,
                isDocument: true,
                confidence: 50,
                details: ['Error detecting document type, defaulting to document']
            };
        }
    }
}

// Main function to run accessibility checks
async function main() {
    const pdfPath = process.argv[2];
    if (!pdfPath) {
        console.error('Please provide a PDF file path');
        process.exit(1);
    }

    try {
        // First detect if it's a form or document
        const docType = await WcagTests.detectDocumentType(pdfPath);
        console.log('\nDocument Type:', docType.isForm ? 'Form' : 'Document');
        console.log('Confidence:', docType.confidence + '%');
        console.log('Details:', docType.details.join('\n  - '));

        // Run accessibility checks
        const doc = await pdfjsLib.getDocument(pdfPath).promise;
        
        // Check form field labels
        const labelResult = await WcagTests.testFormFieldLabels(pdfPath);
        console.log('\nForm Field Labels Check:', labelResult.passed ? 'Passed' : 'Failed');
        if (labelResult.issue) console.log(labelResult.issue);

    } catch (error) {
        console.error('Error processing PDF:', error);
        process.exit(1);
    }
}

// Run the main function if this script is run directly
if (require.main === module) {
    main().catch(console.error);
}
