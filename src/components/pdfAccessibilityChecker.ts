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

    /** Accessibility status of the document */
    status: AccessibilityStatus;
}

/**
 * Represents a complete accessibility report for multiple PDF documents
 */
export interface BatchAccessibilityReport {
    /** Timestamp when the batch report was generated */
    timestamp: string;

    /** Total number of files processed */
    totalFiles: number;

    /** Number of files that passed all tests */
    passedFiles: number;

    /** Number of files that failed at least one test */
    failedFiles: number;

    /** Detailed reports for each file */
    fileReports: AccessibilityReport[];

    /** Summary of most common issues across all files */
    commonIssues: {
        criterion: string;
        count: number;
        description: string;
    }[];
}

/**
 * Represents detailed remediation steps for a specific issue
 */
interface RemediationStep {
    /** The specific element or location where the issue occurs */
    location: string;
    /** Step-by-step instructions to fix the issue */
    steps: string[];
    /** Tools or techniques recommended for fixing the issue */
    tools?: string[];
    /** Priority level for fixing (Critical, High, Medium, Low) */
    priority: string;
}

/**
 * Represents a detailed remediation plan for a single file
 */
interface FileRemediationPlan {
    /** Name of the PDF file */
    filename: string;
    /** Type of document (form/regular) and confidence */
    documentType: DocumentTypeResult;
    /** List of issues that need remediation */
    issues: Array<{
        criterion: string;
        description: string;
        impact: string;
        remediation: RemediationStep[];
    }>;
    /** Estimated time to fix all issues (in minutes) */
    estimatedFixTime: number;
}

/**
 * Represents the accessibility status of a document
 */
export enum AccessibilityStatus {
    Accessible = "Accessible",
    NotAccessible = "Not Accessible",
    NeedsManualTesting = "Needs Manual Testing"
}

/**
 * Represents a JSON-serializable remediation report
 */
interface JsonRemediationReport {
    metadata: {
        generated: string;
        version: string;
    };
    summary: {
        totalFiles: number;
        needsRemediation: number;
        needsManualTesting: number;
    };
    commonIssues: Array<{
        criterion: string;
        frequency: number;
        description: string;
    }>;
    files: Array<{
        filename: string;
        type: 'Form' | 'Document';
        status: AccessibilityStatus;
        issues?: Array<{
            criterion: string;
            impact: string;
            description: string;
            remediation: Array<{
                location: string;
                priority: string;
                steps: string[];
                tools?: string[];
                estimatedMinutes: number;
            }>;
        }>;
        manualTestingSteps?: string[];
        estimatedFixTime?: number;
    }>;
    additionalNotes: string[];
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
     * Tests if form fields have visible focus indicators (WCAG 2.4.7)
     * @param pdfPath Path to the PDF file
     * @returns Promise resolving to an object with test result and optional issue
     */
    static async testFocusVisible(pdfPath: string): Promise<{ passed: boolean; issue?: AccessibilityIssue }> {
        try {
            const doc = await pdfjsLib.getDocument(pdfPath).promise;
            const formFields: Array<{
                name: string;
                hasFocusStyle: boolean;
                page: number;
            }> = [];

            // Process each page
            for (let pageNum = 1; pageNum <= doc.numPages; pageNum++) {
                const page = await doc.getPage(pageNum);
                const annotations = await page.getAnnotations();
                
                // Filter for form field annotations
                const fields = annotations.filter((annot: PDFAnnotation) => 
                    annot.subtype === 'Widget' && 
                    annot.fieldType
                );

                // Process each field to check for focus styles
                for (const field of fields) {
                    // Check if the field has any focus-related properties
                    // This includes checking for /F (normal appearance), /Ff (field flags),
                    // and any style dictionaries that might affect focus visibility
                    const hasFocusStyle = Boolean(
                        field.rect && // Must have a visible area
                        (!field.fieldFlags || !(field.fieldFlags & 0x0001)) // Not invisible
                    );

                    formFields.push({
                        name: field.fieldName || '',
                        hasFocusStyle,
                        page: pageNum
                    });
                }
            }

            // If no form fields found, this criterion doesn't apply
            if (formFields.length === 0) {
                console.log('No form fields found, WCAG 2.4.7 criterion does not apply');
                return { passed: true };
            }

            // Check for fields without focus styles
            const fieldsWithoutFocus = formFields.filter(field => !field.hasFocusStyle);
            
            if (fieldsWithoutFocus.length > 0) {
                return {
                    passed: false,
                    issue: WcagTests.IssueFactory.createIssue(
                        "WCAG 2.4.7 Focus Visible (Level AA)",
                        `Found ${fieldsWithoutFocus.length} form fields that may lack visible focus indicators out of ${formFields.length} total fields.`,
                        "Serious",
                        "Ensure all interactive form fields have a clear visual focus indicator when receiving keyboard focus. " +
                        "Add appropriate focus styles to fields that lack them. Consider using highlighting, borders, or other " +
                        "visual indicators that meet contrast requirements."
                    )
                };
            }

            // All fields appear to have focus styles
            return { passed: true };
        } catch (error) {
            console.error('Error testing focus visibility:', error);
            return {
                passed: false,
                issue: WcagTests.IssueFactory.createErrorIssue(
                    "WCAG 2.4.7 Focus Visible (Level AA)",
                    error as Error,
                    "Unable to check focus visibility",
                    "Ensure the PDF file is valid and accessible, then try the test again"
                )
            };
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

/**
 * Generates detailed remediation steps for a specific issue
 */
function generateRemediationSteps(issue: AccessibilityIssue, documentType: DocumentTypeResult): RemediationStep[] {
    const steps: RemediationStep[] = [];
    
    if (issue.criterion.includes('3.3.2')) { // Form Field Labels
        steps.push({
            location: 'Form Fields without Labels',
            steps: [
                'Open the PDF in Adobe Acrobat Pro DC',
                'Go to Tools > Accessibility > Reading Order',
                'Identify unlabeled form fields',
                'Right-click each field and select "Properties"',
                'Add appropriate label text in the "Tooltip" field'
            ],
            tools: ['Adobe Acrobat Pro DC', 'Form Field Properties Editor'],
            priority: 'Critical'
        });
    }
    else if (issue.criterion.includes('2.4.7')) { // Focus Visibility
        steps.push({
            location: 'Form Fields without Focus Indicators',
            steps: [
                'Open the PDF in Adobe Acrobat Pro DC',
                'Go to Tools > Prepare Form',
                'Select all form fields without focus indicators',
                'Right-click and select "Properties"',
                'In the Appearance tab, set border color and thickness',
                'Enable "Show border hover color for fields"'
            ],
            tools: ['Adobe Acrobat Pro DC', 'Form Field Properties Editor'],
            priority: 'High'
        });
    }
    
    return steps;
}

/**
 * Generates a developer-focused remediation report
 */
function generateRemediationReport(batchReport: BatchAccessibilityReport): string {
    let report = '=== PDF Accessibility Remediation Guide ===\n';
    report += `Generated: ${new Date().toISOString()}\n\n`;

    // Overall statistics
    report += '=== Summary ===\n';
    report += `Total Files: ${batchReport.totalFiles}\n`;
    report += `Files Needing Remediation: ${batchReport.failedFiles}\n`;
    report += `Files Needing Manual Testing: ${batchReport.fileReports.filter(r => r.status === AccessibilityStatus.NeedsManualTesting).length}\n\n`;

    // Common issues and general remediation strategies
    report += '=== Common Issues and Solutions ===\n';
    batchReport.commonIssues.forEach(issue => {
        report += `\nIssue: ${issue.criterion}\n`;
        report += `Frequency: ${issue.count} occurrences\n`;
        report += `Description: ${issue.description}\n`;
    });

    // Detailed remediation plans for each file
    report += '\n=== File-Specific Remediation Plans ===\n';
    batchReport.fileReports.forEach(fileReport => {
        report += `\nFile: ${fileReport.filename}\n`;
        report += `Type: ${fileReport.documentType?.isForm ? 'Form' : 'Document'}\n`;
        report += `Status: ${fileReport.status}\n`;
        
        if (fileReport.status === AccessibilityStatus.NotAccessible) {
            let totalEstimatedTime = 0;
            if (fileReport.issues.length > 0) {
                report += 'Required Fixes:\n';
                fileReport.issues.forEach(issue => {
                    const remediationSteps = generateRemediationSteps(issue, fileReport.documentType!);
                    report += `\n  [${issue.criterion}]\n`;
                    report += `  Impact: ${issue.impact}\n`;
                    report += `  Description: ${issue.description}\n`;
                    
                    remediationSteps.forEach(step => {
                        report += `\n  Location: ${step.location}\n`;
                        report += `  Priority: ${step.priority}\n`;
                        report += '  Steps to Fix:\n';
                        step.steps.forEach((s, i) => report += `    ${i + 1}. ${s}\n`);
                        if (step.tools) {
                            report += '  Required Tools:\n';
                            step.tools.forEach(tool => report += `    - ${tool}\n`);
                        }
                    });
                    
                    const estimatedTime = issue.impact === 'Critical' ? 15 : 10;
                    totalEstimatedTime += estimatedTime;
                });
                
                report += `\n  Estimated Fix Time: ${totalEstimatedTime} minutes\n`;
            }
        } else if (fileReport.status === AccessibilityStatus.NeedsManualTesting) {
            report += '\nManual Testing Required:\n';
            report += '  - Verify proper reading order\n';
            report += '  - Check color contrast ratios\n';
            report += '  - Verify meaningful link text\n';
            report += '  - Test with screen readers\n';
        }
        
        report += '\n' + '='.repeat(50) + '\n';
    });

    return report;
}

/**
 * Converts the batch report to a JSON format
 */
function generateJsonReport(batchReport: BatchAccessibilityReport): JsonRemediationReport {
    const jsonReport: JsonRemediationReport = {
        metadata: {
            generated: new Date().toISOString(),
            version: '1.0.0'
        },
        summary: {
            totalFiles: batchReport.totalFiles,
            needsRemediation: batchReport.failedFiles,
            needsManualTesting: batchReport.fileReports.filter(r => 
                r.status === AccessibilityStatus.NeedsManualTesting).length
        },
        commonIssues: batchReport.commonIssues.map(issue => ({
            criterion: issue.criterion,
            frequency: issue.count,
            description: issue.description
        })),
        files: batchReport.fileReports.map(report => {
            const fileReport: JsonRemediationReport['files'][0] = {
                filename: report.filename,
                type: report.documentType?.isForm ? 'Form' : 'Document',
                status: report.status
            };

            if (report.status === AccessibilityStatus.NotAccessible) {
                fileReport.issues = report.issues.map(issue => {
                    const remediationSteps = generateRemediationSteps(issue, report.documentType!);
                    return {
                        criterion: issue.criterion,
                        impact: issue.impact,
                        description: issue.description,
                        remediation: remediationSteps.map(step => ({
                            location: step.location,
                            priority: step.priority,
                            steps: step.steps,
                            tools: step.tools,
                            estimatedMinutes: issue.impact === 'Critical' ? 15 : 10
                        }))
                    };
                });
                
                fileReport.estimatedFixTime = fileReport.issues?.reduce((total, issue) => 
                    total + issue.remediation.reduce((stepTotal, step) => 
                        stepTotal + step.estimatedMinutes, 0), 0);
            }

            if (report.status === AccessibilityStatus.NeedsManualTesting) {
                fileReport.manualTestingSteps = [
                    'Verify proper reading order',
                    'Check color contrast ratios',
                    'Verify meaningful link text',
                    'Test with screen readers'
                ];
            }

            return fileReport;
        }),
        additionalNotes: [
            'Always test the form after making accessibility improvements',
            'Verify focus visibility in different PDF readers',
            'Consider using the "Tab Order" tool to ensure logical navigation',
            'Save a backup copy before making modifications'
        ]
    };

    return jsonReport;
}

/**
 * Main function to run accessibility checks on multiple PDF files
 * @param pdfPaths Array of paths to PDF files to check
 * @returns Promise resolving to a BatchAccessibilityReport
 */
async function batchTestAccessibility(pdfPaths: string[]): Promise<BatchAccessibilityReport> {
    const fileReports: AccessibilityReport[] = [];
    const issueTracker = new Map<string, { count: number; description: string }>();

    for (const pdfPath of pdfPaths) {
        try {
            // First detect if it's a form or document
            const docType = await WcagTests.detectDocumentType(pdfPath);
            const issues: AccessibilityIssue[] = [];
            
            // Run form-specific tests if it's a form
            if (docType.isForm) {
                // Check form field labels
                const labelResult = await WcagTests.testFormFieldLabels(pdfPath);
                if (!labelResult.passed && labelResult.issue) {
                    issues.push(labelResult.issue);
                    // Track issue frequency
                    const key = labelResult.issue.criterion;
                    const current = issueTracker.get(key) || { count: 0, description: labelResult.issue.description };
                    issueTracker.set(key, { count: current.count + 1, description: current.description });
                }

                // Check form field focus visibility
                const focusResult = await WcagTests.testFocusVisible(pdfPath);
                if (!focusResult.passed && focusResult.issue) {
                    issues.push(focusResult.issue);
                    // Track issue frequency
                    const key = focusResult.issue.criterion;
                    const current = issueTracker.get(key) || { count: 0, description: focusResult.issue.description };
                    issueTracker.set(key, { count: current.count + 1, description: current.description });
                }
            }

            // Create report for this file
            let status: AccessibilityStatus;
            if (issues.length > 0) {
                status = AccessibilityStatus.NotAccessible;
            } else if (docType.isForm) {
                status = AccessibilityStatus.NeedsManualTesting;
            } else {
                status = AccessibilityStatus.Accessible;
            }

            const report: AccessibilityReport = {
                filename: pdfPath,
                passed: issues.length === 0,
                issues: issues,
                documentType: docType,
                timestamp: new Date().toISOString(),
                status
            };

            fileReports.push(report);

        } catch (error) {
            console.error(`Error processing ${pdfPath}:`, error);
            fileReports.push({
                filename: pdfPath,
                passed: false,
                issues: [{
                    criterion: "Processing Error",
                    description: `Failed to process file: ${error.message}`,
                    impact: "Critical",
                    remediation: "Ensure the PDF file is valid and accessible"
                }],
                timestamp: new Date().toISOString(),
                status: AccessibilityStatus.NotAccessible
            });
        }
    }

    // Calculate statistics
    const passedFiles = fileReports.filter(report => report.passed).length;
    
    // Sort common issues by frequency
    const commonIssues = Array.from(issueTracker.entries())
        .map(([criterion, { count, description }]) => ({ criterion, count, description }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5); // Top 5 most common issues

    return {
        timestamp: new Date().toISOString(),
        totalFiles: fileReports.length,
        passedFiles,
        failedFiles: fileReports.length - passedFiles,
        fileReports,
        commonIssues
    };
}

/**
 * Main function to run accessibility checks
 */
async function main() {
    const pdfPaths = process.argv.slice(2);
    if (pdfPaths.length === 0) {
        console.error('Please provide one or more PDF file paths');
        process.exit(1);
    }

    try {
        const batchReport = await batchTestAccessibility(pdfPaths);
        
        // Generate and save the text report
        const textReport = generateRemediationReport(batchReport);
        const textReportPath = 'pdf_accessibility_remediation_guide.txt';
        fs.writeFileSync(textReportPath, textReport);
        
        // Generate and save the JSON report
        const jsonReport = generateJsonReport(batchReport);
        const jsonReportPath = 'pdf_accessibility_report.json';
        fs.writeFileSync(jsonReportPath, JSON.stringify(jsonReport, null, 2));
        
        // Print summary to console
        console.log('\n=== PDF Accessibility Batch Report ===');
        console.log(`Text report saved to: ${textReportPath}`);
        console.log(`JSON report saved to: ${jsonReportPath}`);
        console.log(`\nSummary:`);
        console.log(`Total Files: ${batchReport.totalFiles}`);
        console.log(`Files Needing Remediation: ${batchReport.failedFiles}`);
        console.log(`Files Needing Manual Testing: ${batchReport.fileReports.filter(r => 
            r.status === AccessibilityStatus.NeedsManualTesting).length}`);
    } catch (error) {
        console.error('Error processing batch:', error);
        process.exit(1);
    }
}

// Run the main function if this script is run directly
if (require.main === module) {
    main().catch(console.error);
}
