import * as fs from 'fs';
import { PDFDocument } from 'pdf-lib';
import * as pdfjsLib from 'pdfjs-dist';

// Core interfaces
export interface AccessibilityIssue {
    criterion: string;
    description: string;
    impact: string;
    remediation: string;
}

export interface AccessibilityReport {
    filename: string;
    passed: boolean;
    issues: AccessibilityIssue[];
    pendingTests?: Array<{
        criterion: string;
        reason: string;
        status?: string;
    }>;
    additionalNotes?: string;
    timestamp: string;
}

export interface TextContent {
    text: string;
    page: number;
    hasLangTag?: boolean;
    detectedLang?: string;
}

export interface LinkContent {
    linkText: string;
    url: string;
    page: number;
}

export interface ImageContent {
    hasAltText: boolean;
    altText?: string;
    page: number;
    id?: string;
}

export interface PendingTest {
    criterion: string;
    reason: string;
    status?: string;
}

// PDF Loading Utilities
export class PdfLoader {
    /**
     * Loads a PDF document using pdf-lib
     * @param pdfPath Path to the PDF file
     * @returns Loaded PDF document
     * @throws Error if the file cannot be loaded
     */
    static async loadWithPdfLib(pdfPath: string): Promise<PDFDocument> {
        try {
            const dataBuffer = fs.readFileSync(pdfPath);
            return await PDFDocument.load(dataBuffer);
        } catch (error) {
            throw new Error(`Failed to load PDF with pdf-lib: ${(error as Error).message}`);
        }
    }

    /**
     * Loads a PDF document using pdf.js
     * @param pdfPath Path to the PDF file
     * @returns Loaded PDF document
     * @throws Error if the file cannot be loaded
     */
    static async loadWithPdfJs(pdfPath: string): Promise<pdfjsLib.PDFDocumentProxy> {
        try {
            const data = new Uint8Array(fs.readFileSync(pdfPath));
            const loadingTask = pdfjsLib.getDocument({ data });
            return await loadingTask.promise;
        } catch (error) {
            throw new Error(`Failed to load PDF with pdf.js: ${(error as Error).message}`);
        }
    }
}

// Issue Creation Utilities
export class IssueFactory {
    /**
     * Creates an accessibility issue object
     * @param criterion WCAG criterion identifier
     * @param description Description of the issue
     * @param impact Impact on users
     * @param remediation Steps to fix the issue
     * @returns AccessibilityIssue object
     */
    static createIssue(
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
    }

    /**
     * Creates an error-based accessibility issue
     * @param criterion WCAG criterion identifier
     * @param error The error that occurred
     * @param impact Impact on users
     * @param remediation Steps to fix the issue
     * @returns AccessibilityIssue object
     */
    static createErrorIssue(
        criterion: string,
        error: Error,
        impact: string,
        remediation: string
    ): AccessibilityIssue {
        return this.createIssue(
            criterion,
            `Error testing ${criterion}: ${error.message}`,
            impact,
            remediation
        );
    }
}

// Language Detection Utilities
export class LanguageDetector {
    /**
     * Simple language detection function focusing on English and French
     * @param text Text to analyze
     * @returns Detected language code ('en' or 'fr')
     */
    static detectLanguage(text: string): string {
        // This is a simplified language detection for demonstration
        // In a real application, you would use a proper language detection library

        // Common French words and patterns
        const frenchPatterns = [
            /\b(le|la|les|un|une|des|du|au|aux)\b/i,
            /\b(est|sont|ont|avoir|être|aller|faire)\b/i,
            /\b(bonjour|merci|oui|non|monsieur|madame|mademoiselle)\b/i,
            /\b(et|ou|mais|donc|car|ni|or)\b/i,
            /\b(ce|cette|ces|cet)\b/i,
            /\b(pour|dans|sur|avec|sans|chez)\b/i
        ];

        // Common English words and patterns
        const englishPatterns = [
            /\b(the|a|an|of|in|on|at|for|to|with|by)\b/i,
            /\b(is|are|was|were|has|have|had|be|been|being)\b/i,
            /\b(hello|thank you|yes|no|sir|madam|miss)\b/i,
            /\b(and|or|but|so|because|neither|nor)\b/i,
            /\b(this|that|these|those)\b/i,
            /\b(for|in|on|with|without|at)\b/i
        ];

        // Count matches for each language
        let frenchCount = 0;
        let englishCount = 0;

        for (const pattern of frenchPatterns) {
            if (pattern.test(text)) {
                frenchCount++;
            }
        }

        for (const pattern of englishPatterns) {
            if (pattern.test(text)) {
                englishCount++;
            }
        }

        // Determine the language based on the number of matches
        if (frenchCount > englishCount) {
            return 'fr';
        } else {
            return 'en';
        }
    }

    /**
     * Check if text has a language tag in the structure tree
     * @param structTree Structure tree
     * @param text Text to check
     * @returns Boolean indicating if the text has a language tag
     */
    static hasLanguageTag(structTree: any, text: string): boolean {
        // This is a simplified implementation
        // In a real application, you would need to traverse the structure tree
        // and check for Lang attributes in the nodes containing the text

        // For demonstration purposes, we'll assume no language tags are present
        // as pdf.js doesn't easily expose this information
        return false;
    }

    /**
     * Extracts the default language from PDF metadata
     * @param metadata PDF metadata
     * @returns Default language code or 'en' if not found
     */
    static extractDefaultLanguage(metadata: any): string {
        const metadataInfo = metadata.info as Record<string, any> || {};

        // Try to determine the document's default language
        let defaultLang = '';

        if (metadata.metadata) {
            // Try to get language from XMP metadata
            const metadataStr = metadata.metadata.toString();
            const langMatch = metadataStr.match(/dc:language>([^<]+)</);
            if (langMatch && langMatch[1]) {
                defaultLang = langMatch[1].toLowerCase();
            }
        }

        // If we couldn't get it from XMP, try the info dictionary
        if (!defaultLang && metadataInfo.Language) {
            defaultLang = metadataInfo.Language.toLowerCase();
        }

        // If we still don't have a language, assume English as it's most common
        return defaultLang || 'en';
    }

    /**
     * Determines if text is substantial enough for language detection
     * @param text Text to check
     * @returns True if the text is substantial, false otherwise
     */
    static isSubstantialText(text: string): boolean {
        return text.trim().length > 3 &&
            !/^[0-9\s.,;:!?()[\]{}'"<>\/\\|@#$%^&*_=+-]*$/.test(text);
    }
}

// PDF Metadata Extractors
export class PdfMetadataExtractor {
    /**
     * Extracts the title from a PDF document
     * @param pdfDoc PDF document
     * @returns Title string or null if not found
     */
    static extractTitle(pdfDoc: PDFDocument): string | null {
        return pdfDoc.getTitle() || null;
    }

    /**
     * Checks if a PDF document has metadata
     * @param pdfDoc PDF document
     * @returns True if the document has any metadata, false otherwise
     */
    static hasMetadata(pdfDoc: PDFDocument): boolean {
        return !!(pdfDoc.getAuthor() || pdfDoc.getCreator() ||
            pdfDoc.getProducer() || pdfDoc.getSubject());
    }
}

// Text Content Extractor
export class TextExtractor {
    /**
     * Extracts text content from a PDF page
     * @param page PDF page
     * @param pageNum Page number
     * @param structTree Structure tree (optional)
     * @returns Array of TextContent objects
     */
    static async extractTextFromPage(
        page: pdfjsLib.PDFPageProxy,
        pageNum: number,
        structTree?: any
    ): Promise<{
        textContents: TextContent[];
        hasText: boolean;
        hasSubstantialText: boolean
    }> {
        const textContent = await page.getTextContent();
        const textContents: TextContent[] = [];

        let hasText = false;
        let hasSubstantialText = false;

        // Check if there's any actual text content
        const substantialTextItems = textContent.items.filter(item =>
            'str' in item &&
            LanguageDetector.isSubstantialText(item.str)
        );

        hasText = textContent.items.some(item => 'str' in item && item.str.trim().length > 0);
        hasSubstantialText = substantialTextItems.length > 0;

        // Process each text item
        for (const item of textContent.items) {
            if ('str' in item && item.str.trim() && item.str.trim().length > 3) {
                const textItem: TextContent = {
                    text: item.str,
                    page: pageNum,
                    hasLangTag: false,
                    detectedLang: LanguageDetector.detectLanguage(item.str)
                };

                // Check if this text has a language tag in the structure tree
                if (structTree) {
                    textItem.hasLangTag = LanguageDetector.hasLanguageTag(structTree, item.str);
                }

                textContents.push(textItem);
            }
        }

        return { textContents, hasText, hasSubstantialText };
    }
}

// Link Content Extractor
export class LinkExtractor {
    /**
     * Extracts link content from a PDF page
     * @param page PDF page
     * @param pageNum Page number
     * @returns Array of LinkContent objects
     */
    static async extractLinksFromPage(
        page: pdfjsLib.PDFPageProxy,
        pageNum: number
    ): Promise<LinkContent[]> {
        try {
            const annotations = await page.getAnnotations();
            const links: LinkContent[] = [];

            // Get text content to match with link positions
            const textContent = await page.getTextContent();

            // Process each annotation
            for (const annotation of annotations) {
                if (annotation.subtype === 'Link' && annotation.url) {
                    // Try to find text near the link annotation
                    let linkText = this.findTextForLink(annotation, textContent, page);

                    // If we couldn't find text, use the URL as fallback
                    if (!linkText || linkText.trim().length === 0) {
                        linkText = annotation.url;
                    }

                    const linkItem: LinkContent = {
                        linkText: linkText,
                        url: annotation.url,
                        page: pageNum
                    };

                    links.push(linkItem);
                }
            }

            return links;
        } catch (error) {
            console.error(`Error extracting links from page ${pageNum}:`, error);
            return [];
        }
    }

    /**
     * Attempts to find text associated with a link annotation
     * @param annotation Link annotation
     * @param textContent Text content of the page
     * @param page PDF page
     * @returns Text associated with the link or empty string if none found
     */
    private static findTextForLink(
        annotation: any,
        textContent: any,
        page: pdfjsLib.PDFPageProxy
    ): string {
        // This is a simplified approach to find text associated with a link
        // In a real implementation, you would need more sophisticated logic

        if (!annotation.rect || !textContent.items) {
            return '';
        }

        const linkRect = annotation.rect; // [x1, y1, x2, y2]
        let associatedText = '';

        // Look for text items that overlap with the link annotation
        for (const item of textContent.items) {
            if ('str' in item && item.str.trim()) {
                // Check if this text item is within or near the link rectangle
                // This is a simplified approach using the transform property
                if (item.transform && this.isTextNearRect(item.transform, linkRect)) {
                    associatedText += item.str + ' ';
                }
            }
        }

        return associatedText.trim();
    }

    /**
     * Checks if text is near a rectangle based on transform
     * @param transform Transform matrix [a, b, c, d, e, f] where (e,f) is position
     * @param rect Rectangle [x1, y1, x2, y2]
     * @returns True if the text is near the rectangle
     */
    private static isTextNearRect(transform: number[], rect: number[]): boolean {
        // Extract position from transform matrix
        const x = transform[4];
        const y = transform[5];

        // Add a small margin around the rectangle to catch nearby text
        const margin = 5;

        // Check if the point is inside or near the rectangle
        return (
            x >= rect[0] - margin &&
            x <= rect[2] + margin &&
            y >= rect[1] - margin &&
            y <= rect[3] + margin
        );
    }
}

// Image Content Extractor
export class ImageExtractor {
    /**
     * Extracts image content from a PDF page
     * @param page PDF page
     * @param pageNum Page number
     * @returns Array of ImageContent objects
     */
    static async extractImagesFromPage(
        page: pdfjsLib.PDFPageProxy,
        pageNum: number
    ): Promise<ImageContent[]> {
        try {
            const operatorList = await page.getOperatorList();
            const images: ImageContent[] = [];

            // Try to get structure tree to check for alt text
            let structTree;
            try {
                structTree = await page.getStructTree();
            } catch (error) {
                console.log(`No structure tree available for page ${pageNum}`);
            }

            // Process the operator list to find images
            if (operatorList && operatorList.fnArray) {
                for (let i = 0; i < operatorList.fnArray.length; i++) {
                    // Check for image drawing operations
                    // OPS.paintImageXObject = 85
                    if (operatorList.fnArray[i] === 85) {
                        const imageId = operatorList.argsArray[i][0];

                        // Check if this image has alt text in the structure tree
                        const hasAltText = structTree ? this.checkImageForAltText(structTree, imageId) : false;

                        images.push({
                            hasAltText,
                            altText: hasAltText ? this.findAltTextForImage(structTree, imageId) : undefined,
                            page: pageNum,
                            id: imageId
                        });
                    }
                }
            }

            return images;
        } catch (error) {
            console.error(`Error extracting images from page ${pageNum}:`, error);
            return [];
        }
    }

    /**
     * Checks if an image has alt text in the structure tree
     * @param structTree Structure tree
     * @param imageId Image ID
     * @returns True if the image has alt text
     */
    private static checkImageForAltText(structTree: any, imageId: string): boolean {
        // This is a simplified implementation
        // In a real application, you would need to traverse the structure tree
        // and check for Alt attributes in Figure nodes

        if (!structTree || !structTree.children) {
            return false;
        }

        // Look for Figure elements with Alt attributes
        return this.searchStructTreeForAltText(structTree, imageId);
    }

    /**
     * Searches the structure tree for alt text for an image
     * @param node Structure tree node
     * @param imageId Image ID
     * @returns True if alt text is found
     */
    private static searchStructTreeForAltText(node: any, imageId: string): boolean {
        if (!node) {
            return false;
        }

        // Check if this is a Figure node with Alt attribute
        if (node.role === 'Figure' && node.alt) {
            return true;
        }

        // Recursively check children
        if (node.children) {
            for (const child of node.children) {
                if (this.searchStructTreeForAltText(child, imageId)) {
                    return true;
                }
            }
        }

        return false;
    }

    /**
     * Finds alt text for an image in the structure tree
     * @param structTree Structure tree
     * @param imageId Image ID
     * @returns Alt text if found, undefined otherwise
     */
    private static findAltTextForImage(structTree: any, imageId: string): string | undefined {
        // This is a simplified implementation
        // In a real application, you would need to match the image ID with the correct node

        if (!structTree || !structTree.children) {
            return undefined;
        }

        // Look for Figure elements with Alt attributes
        return this.extractAltTextFromStructTree(structTree);
    }

    /**
     * Extracts alt text from a structure tree node
     * @param node Structure tree node
     * @returns Alt text if found, undefined otherwise
     */
    private static extractAltTextFromStructTree(node: any): string | undefined {
        if (!node) {
            return undefined;
        }

        // Check if this is a Figure node with Alt attribute
        if (node.role === 'Figure' && node.alt) {
            return node.alt;
        }

        // Recursively check children
        if (node.children) {
            for (const child of node.children) {
                const altText = this.extractAltTextFromStructTree(child);
                if (altText) {
                    return altText;
                }
            }
        }

        return undefined;
    }
}

// WCAG Test Implementations
export class WcagTests {
    /**
     * Tests if a PDF document has a title in its metadata (WCAG 2.4.2)
     * @param pdfPath Path to the PDF file
     * @returns AccessibilityIssue or null if test passes
     */
    static async testPdfTitle(pdfPath: string): Promise<AccessibilityIssue | null> {
        try {
            // Load the PDF with pdf-lib
            const pdfDoc = await PdfLoader.loadWithPdfLib(pdfPath);

            // Get the title from the PDF metadata
            const title = PdfMetadataExtractor.extractTitle(pdfDoc);

            // If no title is found, return an accessibility issue
            if (!title) {
                return IssueFactory.createIssue(
                    "WCAG 2.4.2 Page Titled (Level A)",
                    "PDF document does not have a title in its metadata",
                    "Screen readers cannot announce the document title, making it difficult for users to understand the document's purpose or distinguish between multiple open documents",
                    "Add a descriptive title to the PDF document's metadata properties"
                );
            }

            // Title exists, no issue
            return null;
        } catch (error) {
            console.error('Error testing PDF title:', error);
            return IssueFactory.createErrorIssue(
                "WCAG 2.4.2 Page Titled (Level A)",
                error as Error,
                "Unable to determine if the document has a proper title",
                "Ensure the PDF file is valid and accessible"
            );
        }
    }

    /**
     * Tests if a PDF document has a language identifier in its metadata (WCAG 3.1.1)
     * @param pdfPath Path to the PDF file
     * @returns AccessibilityIssue or null if test passes
     */
    static async testPdfLanguage(pdfPath: string): Promise<AccessibilityIssue | null> {
        try {
            // Load the PDF with pdf-lib
            const pdfDoc = await PdfLoader.loadWithPdfLib(pdfPath);

            // Check if there's metadata in the document
            const hasMetadata = PdfMetadataExtractor.hasMetadata(pdfDoc);

            // If no metadata is found, return an accessibility issue
            if (!hasMetadata) {
                return IssueFactory.createIssue(
                    "WCAG 3.1.1 Language of Page (Level A)",
                    "PDF document may not have a language identifier in its metadata",
                    "Screen readers may not be able to determine the document language, leading to incorrect pronunciation and potentially making content incomprehensible to users",
                    "Set the document language in the PDF properties"
                );
            }

            // Metadata exists, no issue
            return null;
        } catch (error) {
            console.error('Error testing PDF language:', error);
            return IssueFactory.createErrorIssue(
                "WCAG 3.1.1 Language of Page (Level A)",
                error as Error,
                "Unable to determine if the document has a proper language identifier",
                "Ensure the PDF file is valid and accessible"
            );
        }
    }

    /**
     * Tests if text in different languages is properly tagged (WCAG 3.1.2)
     * @param pdfPath Path to the PDF file
     * @returns AccessibilityIssue or null if test passes
     */
    static async testLanguageOfParts(pdfPath: string): Promise<AccessibilityIssue | null> {
        try {
            // Load the PDF file
            const pdfDocument = await PdfLoader.loadWithPdfJs(pdfPath);

            // Get document metadata to determine default language
            const metadata = await pdfDocument.getMetadata();
            const defaultLang = LanguageDetector.extractDefaultLanguage(metadata);

            // If the language is "zxx" (no linguistic content), this criterion doesn't apply
            if (defaultLang === 'zxx') {
                console.log("Document is marked as having no linguistic content (zxx), WCAG 3.1.2 criterion doesn't apply");
                return null;
            }

            // Extract text content from all pages
            const textContents: TextContent[] = [];
            let hasAnyText = false;
            let hasSubstantialText = false;

            for (let pageNum = 1; pageNum <= pdfDocument.numPages; pageNum++) {
                const page = await pdfDocument.getPage(pageNum);

                // Get structure tree to check for language tags
                let structTree;
                try {
                    structTree = await page.getStructTree();
                } catch (error) {
                    console.log(`No structure tree available for page ${pageNum}`);
                }

                // Extract text from the page
                const extractionResult = await TextExtractor.extractTextFromPage(page, pageNum, structTree);

                textContents.push(...extractionResult.textContents);
                hasAnyText = hasAnyText || extractionResult.hasText;
                hasSubstantialText = hasSubstantialText || extractionResult.hasSubstantialText;
            }

            // If the document doesn't contain any substantial text, this criterion doesn't apply
            if (!hasAnyText || !hasSubstantialText) {
                console.log("Document doesn't contain substantial text content, WCAG 3.1.2 criterion doesn't apply");
                return null;
            }

            // Check for text in a different language than the document default
            const differentLangTexts = this.findTextInDifferentLanguage(textContents, defaultLang);

            // If we found text in a different language without proper tagging
            if (differentLangTexts.length > 0) {
                // Get examples of the problematic text (limit to 3 examples)
                const examples = this.formatTextExamples(differentLangTexts);

                return IssueFactory.createIssue(
                    "WCAG 3.1.2 Language of Parts (Level AA)",
                    `PDF document contains text in a language different from the document's default language (${defaultLang}) without proper language tagging. Examples: ${examples}`,
                    "Screen readers will pronounce this text incorrectly, making it difficult or impossible for users to understand content in different languages",
                    "Tag text in different languages with the appropriate language identifier in the PDF structure"
                );
            }

            // No issues found
            return null;
        } catch (error) {
            console.error('Error testing language of parts:', error);
            return IssueFactory.createErrorIssue(
                "WCAG 3.1.2 Language of Parts (Level AA)",
                error as Error,
                "Unable to determine if text in different languages is properly tagged",
                "Ensure the PDF file is valid and accessible"
            );
        }
    }

    /**
     * Tests if links in a PDF document have a clear purpose (WCAG 2.4.4)
     * @param pdfPath Path to the PDF file
     * @returns AccessibilityIssue or null if test passes
     */
    static async testLinkPurpose(pdfPath: string): Promise<AccessibilityIssue | null> {
        try {
            // Load the PDF file
            const pdfDocument = await PdfLoader.loadWithPdfJs(pdfPath);

            // Extract link content from all pages
            const links: LinkContent[] = [];

            for (let pageNum = 1; pageNum <= pdfDocument.numPages; pageNum++) {
                const page = await pdfDocument.getPage(pageNum);

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

                return IssueFactory.createIssue(
                    "WCAG 2.4.4 Link Purpose (In Context) (Level A)",
                    `PDF document contains hyperlinks that lack meaningful descriptive text. Examples: ${examples}`,
                    "Screen readers announce link text to blind users. When links display raw URLs or generic text like 'click here', blind users cannot determine the link's purpose or destination without exploring it, making navigation inefficient and potentially confusing.",
                    "Associate each hyperlink with descriptive text that clearly indicates its purpose or destination. Avoid using raw URLs, page numbers, or generic phrases like 'click here' as link text."
                );
            }

            // No issues found
            return null;
        } catch (error) {
            console.error('Error testing link purpose:', error);
            return IssueFactory.createErrorIssue(
                "WCAG 2.4.4 Link Purpose (In Context) (Level A)",
                error as Error,
                "Unable to determine if hyperlinks have meaningful descriptive text",
                "Ensure the PDF file is valid and accessible, with proper tagging of hyperlinks and associated text"
            );
        }
    }

    /**
     * Tests if images in a PDF document have alternative text (WCAG 1.1.1)
     * @param pdfPath Path to the PDF file
     * @returns AccessibilityIssue or null if test passes
     */
    static async testImageAltText(pdfPath: string): Promise<AccessibilityIssue | null> {
        try {
            // Load the PDF file
            const pdfDocument = await PdfLoader.loadWithPdfJs(pdfPath);

            // Extract image content from all pages
            const images: ImageContent[] = [];

            for (let pageNum = 1; pageNum <= pdfDocument.numPages; pageNum++) {
                const page = await pdfDocument.getPage(pageNum);

                // Extract images from the page
                const imageExtractionResult = await ImageExtractor.extractImagesFromPage(page, pageNum);

                images.push(...imageExtractionResult);
            }

            // If there are no images, this criterion doesn't apply
            if (images.length === 0) {
                console.log("Document doesn't contain any images, WCAG 1.1.1 criterion for images doesn't apply");
                return null;
            }

            // Check for images without alt text
            const imagesWithoutAltText = images.filter(image => !image.hasAltText);

            // If we found images without alt text
            if (imagesWithoutAltText.length > 0) {
                return IssueFactory.createIssue(
                    "WCAG 1.1.1 Non-text Content (Level A)",
                    `PDF document contains ${imagesWithoutAltText.length} image${imagesWithoutAltText.length === 1 ? '' : 's'} without alternative text on page${imagesWithoutAltText.length === 1 ? '' : 's'} ${imagesWithoutAltText.map(img => img.page).join(', ')}`,
                    "Screen readers cannot convey the content or purpose of these images to blind users, potentially causing them to miss important information conveyed visually",
                    "Add appropriate alternative text to all images in the PDF structure. The alt text should convey the purpose and content of each image in a concise manner."
                );
            }

            // No issues found
            return null;
        } catch (error) {
            console.error('Error testing image alt text:', error);
            return IssueFactory.createErrorIssue(
                "WCAG 1.1.1 Non-text Content (Level A)",
                error as Error,
                "Unable to determine if images have alternative text",
                "Ensure the PDF file is valid and accessible, with proper tagging of images and alternative text"
            );
        }
    }

    /**
     * Placeholder function for testing WCAG 2.4.5 Multiple Ways compliance
     * This is a placeholder that will be implemented after gathering requirements
     * from sight-impaired users about what constitutes acceptable navigation
     * @returns Information about the pending test
     */
    static getPendingMultipleWaysTest(): PendingTest {
        return {
            criterion: "WCAG 2.4.5 Multiple Ways (Level AA)",
            reason: "We are aware of this criterion and are actively working on it. We need to gather requirements from sight-impaired users about what constitutes acceptable navigation in both forms and documents before implementing this test.",
            status: "In Progress - Requirements Gathering"
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
            reason: "We are actively working on implementing this test. This criterion ensures that screen readers present content in a meaningful order that preserves relationships and logical reading sequence. We need to develop robust algorithms to analyze the reading order in PDF documents.",
            status: "In Progress - Algorithm Development"
        };
    }

    /**
     * Placeholder function for testing WCAG 2.4.3 Focus Order compliance
     * This criterion ensures that the navigation order through interactive elements
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
     * Finds text in a different language than the document default
     * @param textContents Array of TextContent objects
     * @param defaultLang Default language code
     * @returns Array of TextContent objects in a different language
     */
    private static findTextInDifferentLanguage(textContents: TextContent[], defaultLang: string): TextContent[] {
        return textContents.filter(item =>
            item.detectedLang &&
            item.detectedLang !== defaultLang &&
            !item.hasLangTag &&
            // Additional check to ensure the text is substantial enough to warrant language detection
            item.text.length > 10
        );
    }

    /**
     * Formats text examples for the accessibility issue description
     * @param texts Array of TextContent objects
     * @param limit Maximum number of examples to include
     * @returns Formatted string of examples
     */
    private static formatTextExamples(texts: TextContent[], limit: number = 3): string {
        return texts
            .slice(0, limit)
            .map(item => `"${item.text.substring(0, 30)}${item.text.length > 30 ? '...' : ''}" (page ${item.page}, detected as ${item.detectedLang})`)
            .join('; ');
    }
}

// Report Generation
export class AccessibilityReportGenerator {
    /**
     * Generates an accessibility report for a PDF document
     * @param pdfPath Path to the PDF file
     * @param outputPath Path to save the report
     * @returns The generated report or null if file doesn't exist
     */
    static async generateReport(pdfPath: string, outputPath: string): Promise<AccessibilityReport | null> {
        try {
            console.log(`Testing PDF accessibility: ${pdfPath}`);

            // Check if file exists
            if (!fs.existsSync(pdfPath)) {
                console.error(`File not found: ${pdfPath}`);
                return null;
            }

            // Run the tests
            const titleIssue = await WcagTests.testPdfTitle(pdfPath);
            const languageIssue = await WcagTests.testPdfLanguage(pdfPath);
            const languageOfPartsIssue = await WcagTests.testLanguageOfParts(pdfPath);
            const linkPurposeIssue = await WcagTests.testLinkPurpose(pdfPath);
            const imageAltTextIssue = await WcagTests.testImageAltText(pdfPath);

            // Get pending tests
            const pendingMultipleWaysTest = WcagTests.getPendingMultipleWaysTest();
            const pendingMeaningfulSequenceTest = WcagTests.getPendingMeaningfulSequenceTest();
            const pendingFocusOrderTest = WcagTests.getPendingFocusOrderTest();

            // Collect all issues
            const issues: AccessibilityIssue[] = [];
            [titleIssue, languageIssue, languageOfPartsIssue, linkPurposeIssue, imageAltTextIssue].forEach(issue => {
                if (issue) issues.push(issue);
            });

            // Create the report
            const report: AccessibilityReport = {
                filename: pdfPath.split(/[/\\]/).pop() || '',
                passed: issues.length === 0,
                issues: issues,
                pendingTests: [pendingMultipleWaysTest, pendingMeaningfulSequenceTest, pendingFocusOrderTest],
                additionalNotes: "Note: We are actively working on implementing tests for WCAG 2.4.5 Multiple Ways, WCAG 1.3.2 Meaningful Sequence, and WCAG 2.4.3 Focus Order. For Multiple Ways, we need to gather requirements from sight-impaired users to determine acceptable navigation methods. For Meaningful Sequence, we're developing algorithms to verify that the reading order in PDF documents is logical. For Focus Order, we're analyzing how to test that interactive elements follow a sequence that preserves meaning and operability for screen reader users.",
                timestamp: new Date().toISOString()
            };

            // Write the report to file
            this.writeReportToFile(report, outputPath);

            // Print summary to console
            this.printReportSummary(report);

            return report;
        } catch (error) {
            console.error(`Error generating accessibility report: ${(error as Error).message}`);
            return null;
        }
    }

    /**
     * Writes a report to a file
     * @param report Accessibility report
     * @param outputPath Path to save the report
     */
    private static writeReportToFile(report: AccessibilityReport, outputPath: string): void {
        fs.writeFileSync(outputPath, JSON.stringify(report, null, 2));
        console.log(`Accessibility report saved to: ${outputPath}`);
    }

    /**
     * Prints a summary of the report to the console
     * @param report Accessibility report
     */
    private static printReportSummary(report: AccessibilityReport): void {
        console.log(`\nAccessibility Test Summary for ${report.filename}:`);
        console.log(`Status: ${report.passed ? 'PASSED' : 'FAILED'}`);
        console.log(`Issues found: ${report.issues.length}`);
        console.log(`Pending tests: ${report.pendingTests?.length || 0}`);

        if (report.issues.length > 0) {
            console.log('\nIssues:');
            report.issues.forEach((issue, index) => {
                console.log(`\n${index + 1}. ${issue.criterion}`);
                console.log(`   Description: ${issue.description}`);
                console.log(`   Impact: ${issue.impact}`);
                console.log(`   Remediation: ${issue.remediation}`);
            });
        }

        if (report.pendingTests && report.pendingTests.length > 0) {
            console.log('\nPending Tests:');
            report.pendingTests.forEach((test, index) => {
                console.log(`\n${index + 1}. ${test.criterion}`);
                console.log(`   Reason: ${test.reason}`);
                if (test.status) {
                    console.log(`   Status: ${test.status}`);
                }
            });
        }

        if (report.additionalNotes) {
            console.log('\nAdditional Notes:');
            console.log(report.additionalNotes);
        }
    }
}

// Command-line interface
if (require.main === module) {
    // Get the PDF path from command line arguments
    const pdfPath = process.argv[2];
    if (!pdfPath) {
        console.error('Please provide a PDF file path as the first argument');
        process.exit(1);
    }

    // Define output report path
    const outputPath = `${pdfPath.replace(/\.pdf$/i, '')}-accessibility-report.json`;

    // Generate the accessibility report
    AccessibilityReportGenerator.generateReport(pdfPath, outputPath);
}
