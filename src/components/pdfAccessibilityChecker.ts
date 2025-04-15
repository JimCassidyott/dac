import * as fs from 'fs';
import { PDFDocument } from 'pdf-lib';
import * as pdfjsLib from 'pdfjs-dist';

/**
 * Core interfaces for the PDF Accessibility Checker
 */

/**
 * Represents a single accessibility issue found in a PDF document.
 * Each issue is tied to a specific WCAG criterion and includes details
 * about the problem and how to fix it.
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
 * Represents a complete accessibility report for a PDF document.
 * Contains overall status and a list of all identified issues.
 */
export interface AccessibilityReport {
    /** Name of the PDF file that was analyzed */
    filename: string;
    
    /** Whether the document passed all accessibility checks */
    passed: boolean;
    
    /** List of all accessibility issues found in the document */
    issues: AccessibilityIssue[];
    
    /**
     * List of tests that are pending implementation or have not been run.
     * This is used to track progress on implementing additional accessibility checks.
     */
    pendingTests?: Array<{
        /** The WCAG criterion that this test covers (e.g., "2.4.5 Multiple Ways") */
        criterion: string;
        
        /** Reason why this test is pending (e.g., "In Progress - Requirements Gathering") */
        reason: string;
        
        /** Current status of the test implementation (e.g., "Planned", "In Progress", "Completed") */
        status?: string;
    }>;
    
    /**
     * Additional notes or comments about the accessibility of the document.
     * This can include explanations for pending tests or other relevant information.
     */
    additionalNotes?: string;
    
    /**
     * Information about the type of document (form or regular document) and the confidence level of this classification.
     */
    documentType?: {
        /** Whether the document is a form */
        isForm: boolean;
        
        /** Whether the document is a regular document (not a form) */
        isDocument: boolean;
        
        /** Confidence level (as a percentage) in the document type classification */
        confidence: number;
        
        /**
         * Additional details about the document type detection process.
         * This can include information about the algorithms used or any issues encountered.
         */
        details: string[];
    };
    
    /** Timestamp when the accessibility report was generated */
    timestamp: string;
}

/**
 * Represents the content of a text element in a PDF document.
 * Includes the text itself, the page number, and information about language tags.
 */
export interface TextContent {
    /** The actual text content */
    text: string;
    
    /** Page number where this text is located */
    page: number;
    
    /**
     * Whether this text has a language tag in the PDF structure tree.
     * This indicates that the text has been explicitly marked with a language.
     */
    hasLangTag?: boolean;
    
    /**
     * Detected language of the text content (e.g., "en" for English, "fr" for French).
     * This is automatically detected based on the text content.
     */
    detectedLang?: string;
}

/**
 * Represents a link in a PDF document.
 * Includes the link text, URL, and page number.
 */
export interface LinkContent {
    /** The text displayed for the link */
    linkText: string;
    
    /** The URL that the link points to */
    url: string;
    
    /** Page number where this link is located */
    page: number;
}

/**
 * Represents an image in a PDF document.
 * Includes information about the image's alt text and page number.
 */
export interface ImageContent {
    /**
     * Whether the image has alt text in the PDF structure tree.
     * This indicates that the image has been explicitly marked with alternative text.
     */
    hasAltText: boolean;
    
    /**
     * The actual alt text for the image, if available.
     * This is the text that screen readers will announce for the image.
     */
    altText?: string;
    
    /** Page number where this image is located */
    page: number;
    
    /**
     * Unique identifier for the image in the PDF document.
     * This can be used to reference the image in other parts of the document.
     */
    id?: string;
}

/**
 * Represents a pending test that has not been implemented or run yet.
 * This is used to track progress on implementing additional accessibility checks.
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
 * Represents the result of document type detection.
 * Includes flags indicating whether the document is a form or regular document,
 * along with a confidence level for this classification.
 */
export interface DocumentTypeResult {
    /** Whether the document is a form */
    isForm: boolean;
    
    /** Whether the document is a regular document (not a form) */
    isDocument: boolean;
    
    /** Confidence level (as a percentage) in the document type classification */
    confidence: number;
    
    /**
     * Additional details about the document type detection process.
     * This can include information about the algorithms used or any issues encountered.
     */
    details: string[];
}

/**
 * Class containing implementations of WCAG tests for PDF documents.
 * These tests cover various aspects of accessibility, including
 * title, language, link purpose, and image alt text.
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
     * Tests if a PDF document has a title in its metadata (WCAG 2.4.2)
     * @param pdfPath Path to the PDF file
     * @returns Promise resolving to an object with test result and optional issue
     */
    static async testDocumentTitle(pdfPath: string): Promise<{ passed: boolean; issue?: AccessibilityIssue }> {
        try {
            const doc = await pdfjsLib.getDocument(pdfPath).promise;
            const metadata = await doc.getMetadata();
            const info = metadata?.info as { Title?: string } | undefined;
            const title = info?.Title || null;

            // If no title is found, return an accessibility issue
            if (!title) {
                return {
                    passed: false,
                    issue: this.IssueFactory.createIssue(
                        "WCAG 2.4.2 Page Titled (Level A)",
                        "PDF document does not have a title in its metadata",
                        "Screen readers cannot announce the document title, making it difficult for users to understand the document's purpose or distinguish between multiple open documents",
                        "Add a descriptive title to the PDF document's metadata properties"
                    )
                };
            }

            // Title exists
            return { passed: true };
        } catch (error) {
            console.error('Error testing PDF title:', error);
            return {
                passed: false,
                issue: this.IssueFactory.createErrorIssue(
                    "WCAG 2.4.2 Page Titled (Level A)",
                    error as Error,
                    "Unable to determine if the document has a proper title",
                    "Ensure the PDF file is valid and accessible"
                )
            };
        }
    }

    /**
     * Tests if a PDF document has a language identifier in its metadata (WCAG 3.1.1)
     * @param pdfPath Path to the PDF file
     * @returns Promise resolving to an object with test result and optional issue
     */
    static async testDocumentLanguage(pdfPath: string): Promise<{ passed: boolean; issue?: AccessibilityIssue }> {
        try {
            const doc = await pdfjsLib.getDocument(pdfPath).promise;
            const metadata = await doc.getMetadata();
            const info = metadata?.info as { Language?: string } | undefined;
            const language = info?.Language || null;

            // Check for language identifier in metadata
            const hasMetadata = Boolean(language);

            if (!hasMetadata) {
                return {
                    passed: false,
                    issue: this.IssueFactory.createIssue(
                        "WCAG 3.1.1 Language of Page (Level A)",
                        "PDF document may not have a language identifier in its metadata",
                        "Screen readers may not be able to determine the document language, leading to incorrect pronunciation and potentially making content incomprehensible to users",
                        "Add a language identifier to the PDF document's metadata properties"
                    )
                };
            }

            // Language exists
            return { passed: true };
        } catch (error) {
            console.error('Error testing PDF language:', error);
            return {
                passed: false,
                issue: this.IssueFactory.createErrorIssue(
                    "WCAG 3.1.1 Language of Page (Level A)",
                    error as Error,
                    "Unable to determine if the document has a proper language identifier",
                    "Ensure the PDF file is valid and accessible"
                )
            };
        }
    }

    /**
     * Tests if links in a PDF document have a clear purpose (WCAG 2.4.4)
     * @param pdfPath Path to the PDF file
     * @returns Promise resolving to an object with test result and optional issue
     */
    static async testLinkPurpose(pdfPath: string): Promise<{ passed: boolean; issue?: AccessibilityIssue }> {
        try {
            // Extract link content from all pages
            const links: LinkContent[] = [];

            const doc = await pdfjsLib.getDocument(pdfPath).promise;
            for (let pageNum = 1; pageNum <= doc.numPages; pageNum++) {
                const page = await doc.getPage(pageNum);

                // Extract links from the page
                const linkExtractionResult = await LinkExtractor.extractLinksFromPage(page, pageNum);

                links.push(...linkExtractionResult);
            }

            // Check for links with unclear purpose
            const unclearLinks = links.filter(link =>
                !link.linkText ||
                link.linkText.trim().length < 5 ||
                link.linkText.toLowerCase().includes('http') ||
                link.linkText.toLowerCase().includes('www')
            );

            // If we found links with unclear purpose
            if (unclearLinks.length > 0) {
                // Get examples of the problematic links (limit to 3 examples)
                const examples = unclearLinks.slice(0, 3).map(link => `"${link.linkText || 'No text'}" (page ${link.page})`).join('; ');

                return {
                    passed: false,
                    issue: this.IssueFactory.createIssue(
                        "WCAG 2.4.4 Link Purpose (In Context) (Level A)",
                        `PDF document contains hyperlinks that lack meaningful descriptive text. Examples: ${examples}`,
                        "Screen readers announce link text to blind users. When links display raw URLs or generic text like 'click here', blind users cannot determine the link's purpose or destination without exploring it, making navigation inefficient and potentially confusing.",
                        "Associate each hyperlink with descriptive text that clearly indicates its purpose or destination. Avoid using raw URLs, page numbers, or generic phrases like 'click here' as link text."
                    )
                };
            }

            // No issues found
            return { passed: true };
        } catch (error) {
            console.error('Error testing link purpose:', error);
            return {
                passed: false,
                issue: this.IssueFactory.createErrorIssue(
                    "WCAG 2.4.4 Link Purpose (In Context) (Level A)",
                    error as Error,
                    "Unable to determine if hyperlinks have meaningful descriptive text",
                    "Ensure the PDF file is valid and accessible, with proper tagging of hyperlinks and associated text"
                )
            };
        }
    }

    /**
     * Tests if images in a PDF document have alternative text (WCAG 1.1.1)
     * @param pdfPath Path to the PDF file
     * @returns Promise resolving to an object with test result and optional issue
     */
    static async testImageAltText(pdfPath: string): Promise<{ passed: boolean; issue?: AccessibilityIssue }> {
        try {
            const doc = await pdfjsLib.getDocument(pdfPath).promise;
            const imagesWithoutAlt: Array<{ page: number }> = [];

            // Process each page
            for (let pageNum = 1; pageNum <= doc.numPages; pageNum++) {
                const page = await doc.getPage(pageNum);
                const structTree = await page.getStructTree();
                
                if (!structTree) {
                    throw new Error(`No structure tree available for page ${pageNum}`);
                }

                // Find all image nodes in the structure tree
                const processNode = (node: any) => {
                    if (node.role === 'Figure' || node.role === 'Image') {
                        // Check for alt text in various possible locations
                        const hasAlt = Boolean(
                            node.alt || // Direct alt text
                            (node.attributes && node.attributes.Alt) || // Alt in attributes
                            node.actualText // Actual text content
                        );

                        if (!hasAlt) {
                            imagesWithoutAlt.push({ page: pageNum });
                        }
                    }

                    // Process child nodes
                    if (node.children) {
                        node.children.forEach(processNode);
                    }
                };

                processNode(structTree);
            }

            // Report if any images lack alt text
            if (imagesWithoutAlt.length > 0) {
                return {
                    passed: false,
                    issue: this.IssueFactory.createIssue(
                        "WCAG 1.1.1 Non-text Content (Level A)",
                        `Found ${imagesWithoutAlt.length} images without alternative text`,
                        "Critical - Screen readers cannot convey image content to users",
                        "Add appropriate alternative text to all images in the PDF structure. The alt text should convey the purpose and content of each image in a concise manner."
                    )
                };
            }

            // No issues found
            return { passed: true };
        } catch (error) {
            console.error('Error testing image alt text:', error);
            return {
                passed: false,
                issue: this.IssueFactory.createErrorIssue(
                    "WCAG 1.1.1 Non-text Content (Level A)",
                    error as Error,
                    "Unable to determine if images have alternative text",
                    "Ensure the PDF file is valid and accessible, with proper tagging of images and alternative text"
                )
            };
        }
    }

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
                const fields = annotations.filter(annot => 
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
            const fieldsWithoutLabels = formFields.filter(field => !field.hasLabel);
            
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
                const fields = annotations.filter(annot => 
                    annot.subtype === 'Widget' && // Widget annotations are form fields
                    annot.fieldType // Must have a field type
                );

                // Process each field
                for (const field of fields) {
                    const rect = field.rect || { x: 0, y: 0, width: 0, height: 0 };
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
     * Helper function to extract form fields in their physical order on the page
     * This is useful for analyzing focus order and meaningful sequence
     * @param pdfPath Path to the PDF file
     * @returns Promise resolving to an array of objects containing field info and position
     */
    static async extractFormFieldsInPhysicalOrder(pdfPath: string): Promise<Array<{
        name: string;
        type: string;
        page: number;
        rect: { x: number; y: number; width: number; height: number };
        hasLabel: boolean;
    }>> {
        try {
            const doc = await pdfjsLib.getDocument(pdfPath).promise;
            const fieldPositions: Array<{
                name: string;
                type: string;
                page: number;
                rect: { x: number; y: number; width: number; height: number };
                hasLabel: boolean;
            }> = [];

            // Process each page
            for (let pageNum = 1; pageNum <= doc.numPages; pageNum++) {
                const page = await doc.getPage(pageNum);
                const annotations = await page.getAnnotations();
                
                // Filter for form field annotations
                const fields = annotations.filter(annot => 
                    annot.subtype === 'Widget' && // Widget annotations are form fields
                    annot.fieldType // Must have a field type
                );

                // Process each field
                for (const field of fields) {
                    const rect = field.rect || { x: 0, y: 0, width: 0, height: 0 };
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
                        hasLabel: Boolean(field.alternativeText || field.fieldLabel)
                    });
                }
            }

            // Sort fields by position
            return fieldPositions.sort((a, b) => {
                // First sort by page
                if (a.page !== b.page) return a.page - b.page;
                
                // Then sort by vertical position (top to bottom)
                if (Math.abs(a.rect.y - b.rect.y) > 10) return b.rect.y - a.rect.y;
                
                // Finally sort by horizontal position (left to right)
                return a.rect.x - b.rect.x;
            });
        } catch (error) {
            console.error('Error extracting form fields in physical order:', error);
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
                const formFields = annotations.filter(annot => 
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

    /**
     * Helper method to extract headings with tab order information from structure tree
     * @param node Structure tree node
     * @param headings Array to collect heading information
     * @param pageNum Current page number
     * @param level Current heading level
     * @param tabIndex Current tab index counter
     * @returns Updated tab index counter
     */
    private static extractHeadingsWithTabOrder(
        node: any,
        headings: Array<{ text: string; level: number; page: number; tabIndex?: number }>,
        pageNum: number,
        level: number,
        tabIndex: number
    ): number {
        if (!node) return tabIndex;
        
        // Check if this node is a heading
        if (node.role === 'heading' || (node.role === 'H' && node.children)) {
            // Try to determine heading level
            let headingLevel = level;
            
            // Check if there's an explicit heading level
            if (node.attributes && node.attributes.Level) {
                headingLevel = parseInt(node.attributes.Level, 10);
            } else if (node.role && node.role.length > 1 && node.role.startsWith('H')) {
                // Handle cases like H1, H2, etc.
                const levelMatch = node.role.match(/H(\d+)/);
                if (levelMatch && levelMatch[1]) {
                    headingLevel = parseInt(levelMatch[1], 10);
                }
            }
            
            // Try to get tab order information
            let headingTabIndex: number | undefined = undefined;
            
            // Check for explicit tab index in node attributes
            if (node.attributes && node.attributes.TI) {
                headingTabIndex = parseInt(node.attributes.TI, 10);
            } else if (node.attributes && node.attributes.TabIndex) {
                headingTabIndex = parseInt(node.attributes.TabIndex, 10);
            } else {
                // If no explicit tab index, use the current counter
                headingTabIndex = tabIndex++;
            }
            
            // Extract text content from this heading node
            const headingText = this.extractTextFromStructNode(node);
            
            // Only add non-empty headings
            if (headingText.trim()) {
                headings.push({
                    text: headingText.trim(),
                    level: headingLevel,
                    page: pageNum,
                    tabIndex: headingTabIndex
                });
            }
        }
        
        // Process child nodes recursively
        if (node.children && Array.isArray(node.children)) {
            for (const child of node.children) {
                tabIndex = this.extractHeadingsWithTabOrder(child, headings, pageNum, level, tabIndex);
            }
        }
        
        return tabIndex;
    }

    /**
     * Helper function to extract text from a structure tree node
     * @param node Structure tree node
     * @returns Text content from the node
     */
    private static extractTextFromStructNode(node: any): string {
        if (!node) return '';
        
        // If this is a text node, return its content
        if (typeof node === 'string') return node;
        
        // If this node has children, process them recursively
        if (node.children && Array.isArray(node.children)) {
            return node.children.map(child => this.extractTextFromStructNode(child)).join(' ');
        }
        
        return '';
    }

    /**
     * Helper method to process a structure tree node and extract headings
     * @param node Structure tree node
     * @param headings Array to collect heading information
     * @param pageNum Current page number
     * @param level Current heading level
     */
    private static processStructNode(
        node: any,
        headings: Array<{ text: string; level: number; page: number; rect?: { x: number; y: number; width: number; height: number } }>,
        pageNum: number,
        level: number
    ): void {
        if (!node) return;
        
        // Check if this node is a heading
        if (node.role === 'heading' || (node.role === 'H' && node.children)) {
            // Try to determine heading level
            let headingLevel = level;
            
            // Check if there's an explicit heading level
            if (node.attributes && node.attributes.Level) {
                headingLevel = parseInt(node.attributes.Level, 10);
            } else if (node.role && node.role.length > 1 && node.role.startsWith('H')) {
                // Handle cases like H1, H2, etc.
                const levelMatch = node.role.match(/H(\d+)/);
                if (levelMatch && levelMatch[1]) {
                    headingLevel = parseInt(levelMatch[1], 10);
                }
            }
            
            // Extract text content from this heading node
            const headingText = this.extractTextFromStructNode(node);
            
            // Only add non-empty headings
            if (headingText.trim()) {
                const heading = {
                    text: headingText.trim(),
                    level: headingLevel,
                    page: pageNum
                } as { text: string; level: number; page: number; rect?: { x: number; y: number; width: number; height: number } };
                
                // Add rect information if available
                if (node.rect) {
                    heading.rect = {
                        x: node.rect.x || 0,
                        y: node.rect.y || 0,
                        width: node.rect.width || 0,
                        height: node.rect.height || 0
                    };
                }
                
                headings.push(heading);
            }
        }
        
        // Process child nodes recursively
        if (node.children && Array.isArray(node.children)) {
            for (const child of node.children) {
                this.processStructNode(child, headings, pageNum, level);
            }
        }
    }

    /**
     * Helper function to extract headings from a PDF document
     * @param pdfPath Path to the PDF file
     * @returns Promise resolving to an array of heading objects
     */
    private static async extractHeadingsFromDocument(pdfPath: string): Promise<Array<{
        text: string;
        level: number;
        page: number;
        rect?: { x: number; y: number; width: number; height: number };
    }>> {
        const doc = await pdfjsLib.getDocument(pdfPath).promise;
        const allHeadings: Array<{
            text: string;
            level: number;
            page: number;
            rect?: { x: number; y: number; width: number; height: number };
        }> = [];
        
        // Process each page
        for (let i = 1; i <= doc.numPages; i++) {
            const page = await doc.getPage(i);
            const structTreeRoot = await page.getStructTree();
            
            if (structTreeRoot) {
                // Extract headings from the structure tree
                const pageHeadings: Array<{ text: string; level: number; page: number; rect?: { x: number; y: number; width: number; height: number } }> = [];
                this.processStructNode(structTreeRoot, pageHeadings, i, 1);
                allHeadings.push(...pageHeadings);
            } else {
                // No structure tree available for this page
                console.warn(`No structure tree available for page ${i}`);
            }
        }
        
        // Sort headings by page number first, then by y-coordinate (top to bottom),
        // and finally by x-coordinate (left to right)
        return allHeadings.sort((a, b) => {
            if (a.page !== b.page) return a.page - b.page;
            if (a.rect && b.rect && Math.abs(a.rect.y - b.rect.y) > 10) return b.rect.y - a.rect.y;
            return a.rect && b.rect ? a.rect.x - b.rect.x : 0;
        });
    }

    /**
     * Tests if all text in a PDF document has a language identifier (WCAG 3.1.2)
     * @param pdfPath Path to the PDF file
     * @returns Promise resolving to an object with test result and optional issue
     */
    static async testLanguageOfParts(pdfPath: string): Promise<{
        passed: boolean;
        issue?: AccessibilityIssue;
    }> {
        try {
            // Load the PDF document
            const doc = await pdfjsLib.getDocument(pdfPath).promise;
            
            // Extract all text content from the document
            const textContents: TextContent[] = [];
            let hasAnyText = false;
            let hasSubstantialText = false;

            // Process each page
            for (let pageNum = 1; pageNum <= doc.numPages; pageNum++) {
                const page = await doc.getPage(pageNum);
                const content = await page.getTextContent();
                
                // Process each text item
                for (const item of content.items) {
                    const text = (item as any).str || '';
                    if (text.trim()) {
                        textContents.push({
                            text,
                            page: pageNum,
                            hasLangTag: false, // We'll update this when we check for language tags
                            detectedLang: undefined // We'll detect language later if needed
                        });
                        hasAnyText = true;
                        hasSubstantialText = hasSubstantialText || text.length > 10;
                    }
                }
            }

            // If the document doesn't contain any substantial text, this criterion doesn't apply
            if (!hasSubstantialText) {
                console.log("Document doesn't contain substantial text, WCAG 3.1.2 criterion doesn't apply");
                return { passed: true };
            }

            // Check for text without language tags
            const textWithoutLangTags = textContents.filter(item =>
                item.text.length > 10 && !item.hasLangTag
            );

            // If we found text without language tags
            if (textWithoutLangTags.length > 0) {
                return {
                    passed: false,
                    issue: {
                        criterion: "WCAG 3.1.2 Language of Parts (Level AA)",
                        description: `PDF document contains text that may not have language tags. Found ${textWithoutLangTags.length} instances of substantial text without explicit language identification.`,
                        impact: "Screen readers may not be able to determine the language of specific parts of the document, leading to incorrect pronunciation and potentially making content incomprehensible to users",
                        remediation: "Ensure that all text in the PDF has appropriate language tags, especially when the language changes within the document"
                    }
                };
            }

            // No issues found
            return { passed: true };
        } catch (error) {
            console.error('Error testing language of parts:', error);
            return {
                passed: false,
                issue: {
                    criterion: "WCAG 3.1.2 Language of Parts (Level AA)",
                    description: "Unable to determine if all parts of the document have proper language identifiers",
                    impact: "Critical",
                    remediation: "Ensure the PDF file is valid and accessible, with proper language tagging throughout"
                }
            };
        }
    }

    /**
     * Extracts headings from PDF documents ordered by tab order as specified in PDF metadata
     * This is useful for analyzing keyboard navigation through document structure
     * @param pdfPath Path to the PDF file
     * @returns Promise resolving to an array of heading objects ordered by tab sequence
     */
    static async extractDocumentHeadingsInTabOrder(pdfPath: string): Promise<Array<{
        text: string;
        level: number;
        page: number;
        tabIndex?: number;
    }>> {
        try {
            // First check if this is a form - we only want to extract headings from non-form documents
            const docType = await this.detectDocumentType(pdfPath);
            if (docType.isForm) {
                console.log('Document is a form, skipping heading extraction');
                return [];
            }

            const doc = await pdfjsLib.getDocument(pdfPath).promise;
            const allHeadings: Array<{
                text: string;
                level: number;
                page: number;
                tabIndex?: number;
            }> = [];
            
            // Process each page
            for (let i = 1; i <= doc.numPages; i++) {
                const page = await doc.getPage(i);
                const structTreeRoot = await page.getStructTree();
                
                if (structTreeRoot) {
                    // Extract headings from the structure tree with tab order
                    this.extractHeadingsWithTabOrder(structTreeRoot, allHeadings, i, 1, 0);
                } else {
                    // No structure tree available for this page
                    console.warn(`No structure tree available for page ${i}`);
                }
            }
            
            // Sort headings by tab index
            return allHeadings.sort((a, b) => {
                if (a.tabIndex === undefined && b.tabIndex === undefined) return 0;
                if (a.tabIndex === undefined) return 1;
                if (b.tabIndex === undefined) return -1;
                return a.tabIndex - b.tabIndex;
            });
        } catch (error) {
            console.error('Error extracting document headings in tab order:', error);
            return [];
        }
    }

    /**
     * Extracts headings from PDF documents that are not forms
     * Returns an array of headings with their text content, level, and page number
     * @param pdfPath Path to the PDF file
     * @returns Promise resolving to an array of heading objects
     */
    static async extractDocumentHeadings(pdfPath: string): Promise<Array<{
        text: string;
        level: number;
        page: number;
        rect?: { x: number; y: number; width: number; height: number };
    }>> {
        try {
            // First check if this is a form - we only want to extract headings from non-form documents
            const docType = await this.detectDocumentType(pdfPath);
            if (docType.isForm) {
                console.log('Document is a form, skipping heading extraction');
                return [];
            }

            return this.extractHeadingsFromDocument(pdfPath);
        } catch (error) {
            console.error('Error extracting document headings:', error);
            return [];
        }
    }

    /**
     * Placeholder function for testing WCAG 2.4.3 Focus Order compliance
     * This criterion ensures that the order of focus when navigating through interactive elements
     * is logical and intuitive for keyboard and screen reader users
     * @returns Information about the pending test
     */
    static getPendingFocusOrderTest(): PendingTest {
        return {
            criterion: "WCAG 2.4.3 Focus Order (Level A)",
            reason: "We are planning to implement this test. This criterion ensures that the order of focus when navigating through interactive elements in a PDF (like form fields and links) follows a sequence that preserves meaning and operability. This is essential for blind users who navigate documents using keyboard commands with screen readers.",
            status: "Planned - Requirements Analysis"
        };
    }

    /**
     * Placeholder function for testing WCAG 1.3.2 Meaningful Sequence compliance
     * This criterion ensures that the reading order of content is logical and matches
     * the visual presentation, which is critical for screen reader users
     * @returns Information about the pending test
     */
    static getPendingMeaningfulSequenceTest(): PendingTest {
        return {
            criterion: "WCAG 1.3.2 Meaningful Sequence (Level A)",
            reason: "We are planning to implement this test. This criterion ensures that when the sequence in which content is presented affects its meaning, a correct reading sequence can be programmatically determined. For PDFs, this involves checking the document's structure tree and reading order.",
            status: "Planned - Requirements Analysis"
        };
    }

    /**
     * Placeholder function for testing WCAG 2.4.5 Multiple Ways compliance
     * This criterion requires that there is more than one way to locate a webpage within a set of webpages
     * For PDFs, this would involve checking for the presence of bookmarks, a table of contents, or other navigation aids
     * @returns Information about the pending test
     */
    static getPendingMultipleWaysTest(): PendingTest {
        return {
            criterion: "WCAG 2.4.5 Multiple Ways (Level AA)",
            reason: "We are planning to implement this test. This criterion requires that there is more than one way to locate a webpage within a set of webpages. For PDFs, this would involve checking for the presence of bookmarks, a table of contents, or other navigation aids.",
            status: "Planned - Requirements Analysis"
        };
    }

    /**
     * Finds text in a different language than the document default
     * @param textContents Array of TextContent objects
     * @param defaultLang Default language code
     * @returns Array of TextContent objects in a different language
     */
    static findTextInDifferentLanguage(textContents: TextContent[], defaultLang: string): TextContent[] {
        return textContents.filter(content => {
            // Skip empty or very short text
            if (!content.text || content.text.trim().length < 10) {
                return false;
            }
            
            // If the text has a language tag, check if it's different from the default
            if (content.detectedLang && content.detectedLang !== defaultLang) {
                return true;
            }
            
            return false;
        });
    }

    /**
     * Formats text examples for the accessibility issue description
     * @param texts Array of TextContent objects
     * @param limit Maximum number of examples to include
     * @returns Formatted string of examples
     */
    static formatTextExamples(texts: TextContent[], limit: number = 3): string {
        return texts.slice(0, limit).map(content => {
            // Truncate long text
            let text = content.text;
            if (text.length > 50) {
                text = text.substring(0, 47) + '...';
            }
            
            return `"${text}" (page ${content.page}, detected language: ${content.detectedLang || 'unknown'})`;
        }).join(', ');
    }
}
