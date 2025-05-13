import * as fs from 'fs';
import { PDFDocument } from 'pdf-lib';
import * as pdfjsLib from 'pdfjs-dist';
import { getHTMLReportPath } from './helpers';

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
    remediation: RemediationStep;
}

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
    // status: AccessibilityStatus;
}

/**
 * Utility class for loading PDF documents using different libraries.
 * Provides methods to load PDFs with both pdf-lib and pdf.js.
 */
export class PdfLoader {
  /**
   * Loads a PDF document using pdf-lib
   * @param pdfPath Path to the PDF file
   * @returns Promise resolving to a PDFDocument
   */
  static async loadWithPdfLib(pdfPath: string): Promise<PDFDocument> {
      try {
          const pdfBytes = fs.readFileSync(pdfPath);
          return await PDFDocument.load(pdfBytes);
      } catch (error) {
          console.error(`Error loading PDF with pdf-lib: ${(error as Error).message}`);
          throw error;
      }
  }

  /**
   * Loads a PDF document using pdf.js
   * @param pdfPath Path to the PDF file
   * @returns Promise resolving to a PDFDocumentProxy
   */
  static async loadWithPdfJs(pdfPath: string): Promise<pdfjsLib.PDFDocumentProxy> {
      try {
          const data = new Uint8Array(fs.readFileSync(pdfPath));
          return await pdfjsLib.getDocument({ enableXfa: true, data }).promise;
      } catch (error) {
          console.error(`Error loading PDF with pdf.js: ${(error as Error).message}`);
          throw error;
      }
  }

  /**
   * Checks if a PDF document is encrypted
   * @param pdfPath Path to the PDF file
   * @returns Promise resolving to a boolean indicating if the PDF is encrypted
   */
  static async isEncrypted(pdfPath: string): Promise<boolean> {
      try {
          const data = new Uint8Array(fs.readFileSync(pdfPath));
          const doc = await pdfjsLib.getDocument({ data }).promise;
          
          // Try to access a property that would be restricted if encrypted
          await doc.getPage(1);
          
          // If we got here, the document is not encrypted or we have the password
          return false;
      } catch (error) {
          const errorMessage = (error as Error).message || '';
          
          // Check if the error is related to encryption
          if (
              errorMessage.includes('encrypted') || 
              errorMessage.includes('password') ||
              errorMessage.includes('permission')
          ) {
              return true;
          }
          
          // Re-throw other errors
          throw error;
      }
  }
}

/**
 * Utility class for detecting languages in PDF documents.
 * This class provides methods to detect languages based on text content
 * and extract language information from PDF metadata.
 */
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

      if (!structTree || !structTree.children) {
          return false;
      }

      // Look for Figure elements with Alt attributes
      return this.searchStructTreeForAltText(structTree, text);
  }

  /**
   * Searches the structure tree for alt text for an image
   * @param node Structure tree node
   * @param text Text to search for
   * @returns True if alt text is found
   */
  private static searchStructTreeForAltText(node: any, text: string): boolean {
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
              if (this.searchStructTreeForAltText(child, text)) {
                  return true;
              }
          }
      }

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

/**
 * Utility class for extracting metadata from PDF documents.
 * This class provides methods to extract the title and other metadata
 * from a PDF document.
 */
export class PdfMetadataExtractor {
  /**
   * Extracts the title from a PDF document
   * @param pdfDoc PDF document (from either pdf-lib or pdf.js)
   * @returns Promise resolving to the document title or null if not found
   */
  static async extractTitle(pdfDoc: pdfjsLib.PDFDocumentProxy | PDFDocument): Promise<string | null> {
      try {
          if ('getMetadata' in pdfDoc) {
              // This is a pdf.js document
              const metadata = await pdfDoc.getMetadata();
              // Use type assertion to access Title property
              return (metadata?.info as any)?.Title || null;
          } else {
              // This is a pdf-lib document
              return pdfDoc.getTitle() || null;
          }
      } catch (error) {
          console.error("Error extracting PDF title:", error);
          return null;
      }
  }
  
  /**
   * Checks if a PDF document has metadata
   * @param pdfDoc PDF document (from either pdf-lib or pdf.js)
   * @returns Promise resolving to a boolean indicating if metadata is present
   */
  static async hasMetadata(pdfDoc: pdfjsLib.PDFDocumentProxy | PDFDocument): Promise<boolean> {
      try {
          if ('getMetadata' in pdfDoc) {
              // This is a pdf.js document
              const metadata = await pdfDoc.getMetadata();
              return !!metadata && !!metadata.info;
          } else {
              // This is a pdf-lib document
              return !!pdfDoc.getAuthor() || !!pdfDoc.getCreator() || 
                     !!pdfDoc.getProducer() || !!pdfDoc.getSubject() || 
                     !!pdfDoc.getTitle();
          }
      } catch (error) {
          console.error("Error checking PDF metadata:", error);
          return false;
      }
  }

  /**
   * Checks if a PDF document has language metadata
   * @param pdfDoc PDF document (pdf.js)
   * @returns Promise resolving to a boolean indicating if language metadata is present
   */
  static async hasLanguageMetadata(pdfDoc: pdfjsLib.PDFDocumentProxy): Promise<boolean> {
    try {
        // This is a pdf.js document
        const metadata: any = (await pdfDoc.getMetadata()).info;
        return metadata.Language != null;

    } catch (error) {
        console.error("Error checking PDF metadata:", error);
        return false;
    }
  }
}


/**
 * Utility class for extracting text content from PDF documents.
 * This class provides methods to extract text from PDF pages and
 * detect language information.
 */
export class TextExtractor {
  /**
   * Extracts text content from a PDF page
   * @param page PDF page from pdf.js
   * @param pageNum Page number (1-based)
   * @returns Promise resolving to an array of TextContent objects
   */
  static async extractTextFromPage(page: pdfjsLib.PDFPageProxy, pageNum: number): Promise<TextContent[]> {
      try {
          // Get the text content from the page
          const textContent = await page.getTextContent();
          
          // Process each text item
          const textItems: TextContent[] = [];
          
          for (const item of textContent.items) {
              // Skip empty text
              if (!('str' in item) || !item.str.trim()) {
                  continue;
              }
              
              // Create a TextContent object
              const textItem: TextContent = {
                  text: item.str,
                  page: pageNum,
                  hasLangTag: false // Default value, would be updated with actual structure tree analysis
              };
              
              // Detect language for text items with sufficient content
              if (item.str.length > 10) {
                  textItem.detectedLang = LanguageDetector.detectLanguage(item.str);
              }
              
              textItems.push(textItem);
          }
          return textItems;
      } catch (error) {
          console.error(`Error extracting text from page ${pageNum}:`, error);
          return [];
      }
  }
  
  /**
   * Extracts all text content from a PDF document
   * @param pdfDocument PDF document from pdf.js
   * @returns Promise resolving to an array of TextContent objects
   */
  static async extractAllText(pdfDocument: pdfjsLib.PDFDocumentProxy): Promise<TextContent[]> {
      try {
          const allTextItems: TextContent[] = [];
          
          // Process each page
          for (let pageNum = 1; pageNum <= pdfDocument.numPages; pageNum++) {
              const page = await pdfDocument.getPage(pageNum);
              const pageTextItems = await this.extractTextFromPage(page, pageNum);
              allTextItems.push(...pageTextItems);
          }
          
          return allTextItems;
      } catch (error) {
          console.error("Error extracting all text:", error);
          return [];
      }
  }
}

/**
* Utility class for extracting link content from PDF documents.
* This class provides methods to extract links from PDF pages and
* detect link text.
*/
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

/**
* Utility class for extracting image content from PDF documents.
* This class provides methods to extract images from PDF pages and
* detect alt text.
*/
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
            remediation: RemediationStep
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
            remediation: RemediationStep
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
     * @param pdfDoc PDF document
     * @returns Promise resolving to an object with test result and optional issue
     */
      static async testDocumentTitle(pdfDoc: pdfjsLib.PDFDocumentProxy): Promise<{ passed: boolean; issue?: AccessibilityIssue }> {
        try {
            // Get the title from the PDF metadata
            const title = await PdfMetadataExtractor.extractTitle(pdfDoc);

            // If no title is found, return an accessibility issue
            if (!title) {
                return {
                    passed: false,
                    issue: WcagTests.IssueFactory.createIssue(
                        "WCAG 2.4.2 Page Titled (Level A)",
                        "PDF document does not have a title in its metadata",
                        "Screen readers cannot announce the document title, making it difficult for users to understand the document's purpose or distinguish between multiple open documents",
                        AccessibilityReportGenerator.generateRemediationSteps("WCAG 2.4.2 Page Titled (Level A)")
                        // "Add a descriptive title to the PDF document's metadata properties"
                    )
                };
            }

            // Title exists, no issue
            return { passed: true };
        } catch (error) {
            console.error('Error testing PDF title:', error);
            return {
                passed: false,
                issue: WcagTests.IssueFactory.createErrorIssue(
                    "WCAG 2.4.2 Page Titled (Level A)",
                    error as Error,
                    "Unable to determine if the document has a proper title",
                    AccessibilityReportGenerator.generateRemediationSteps("WCAG 2.4.2 Page Titled (Level A)")
                    //"Ensure the PDF file is valid and accessible"
                )
            };
        }
    }
  
    /**
     * Tests if a PDF document has a language identifier in its metadata (WCAG 3.1.1)
     * @param pdfDoc PDF document
     * @returns Promise resolving to an object with test result and optional issue
     */
    static async testDocumentLanguage(pdfDoc: pdfjsLib.PDFDocumentProxy): Promise<{ passed: boolean; issue?: AccessibilityIssue }> {
        try {
            // Check if there's metadata in the document
            const hasLanguageMetadata = await PdfMetadataExtractor.hasLanguageMetadata(pdfDoc);

            // If no Language metadata is found, return an accessibility issue
            if (!hasLanguageMetadata) {
                return {
                    passed: false,
                    issue: WcagTests.IssueFactory.createIssue(
                        "WCAG 3.1.1 Language of Page (Level A)",
                        "PDF document may not have a language identifier in its metadata",
                        "Screen readers may not be able to determine the document language, leading to incorrect pronunciation and potentially making content incomprehensible to users",
                        AccessibilityReportGenerator.generateRemediationSteps("WCAG 3.1.1 Language of Page (Level A)")
                        //"Set the document language in the PDF properties"
                    )
                };
            }

            // Metadata exists, no issue
            return { passed: true };
        } catch (error) {
            console.error('Error testing PDF language:', error);
            return {
                passed: false,
                issue: WcagTests.IssueFactory.createErrorIssue(
                    "WCAG 3.1.1 Language of Page (Level A)",
                    error as Error,
                    "Unable to determine if the document has a proper language identifier",
                    AccessibilityReportGenerator.generateRemediationSteps("WCAG 3.1.1 Language of Page (Level A)")
                    // "Ensure the PDF file is valid and accessible"
                )
            };
        }
    }
  
    /**
     * Tests if all text in a PDF document has a language identifier (WCAG 3.1.2)
     * @param pdfPath Path to the PDF file
     * @returns Promise resolving to an object with test result and optional issue
     */
    static async testLanguageOfParts(pdfPath: string): Promise<{ passed: boolean; issue?: AccessibilityIssue }> {
        try {
            // Load the PDF document
            const pdfDoc = await PdfLoader.loadWithPdfJs(pdfPath);
            
            // Extract all text content from the document
            const textContents: TextContent[] = [];
            let hasAnyText = false;
            let hasSubstantialText = false;

            // Process each page
            for (let pageNum = 1; pageNum <= pdfDoc.numPages; pageNum++) {
                const page = await pdfDoc.getPage(pageNum);
                
                // Extract text from the page
                const extractionResult = await TextExtractor.extractTextFromPage(page, pageNum);

                textContents.push(...extractionResult);
                hasAnyText = hasAnyText || extractionResult.some(item => item.text.trim());
                hasSubstantialText = hasSubstantialText || extractionResult.some(item => item.text.length > 10);
            }

            // If the document doesn't contain any substantial text, this criterion doesn't apply
            if (!hasSubstantialText) {
                console.log("Document doesn't contain substantial text, WCAG 3.1.2 criterion doesn't apply");
                return { passed: true };
            }

            // Check for text without language tags
            const textWithoutLangTags = textContents.filter(item => !item.hasLangTag && item.text.length > 10);

            // If we found text without language tags
            if (textWithoutLangTags.length > 0) {
                return {
                    passed: false,
                    issue: WcagTests.IssueFactory.createIssue(
                        "WCAG 3.1.2 Language of Parts (Level AA)",
                        `PDF document contains text that may not have language tags. Found ${textWithoutLangTags.length} instances of substantial text without explicit language identification.`,
                        "Screen readers may not be able to determine the language of specific parts of the document, leading to incorrect pronunciation and potentially making content incomprehensible to users",
                        AccessibilityReportGenerator.generateRemediationSteps("WCAG 3.1.2 Language of Parts (Level AA)")
                        // "Ensure that all text in the PDF has appropriate language tags, especially when the language changes within the document"
                    )
                };
            }

            // No issues found
            return { passed: true };
        } catch (error) {
            console.error('Error testing language of parts:', error);
            return {
                passed: false,
                issue: WcagTests.IssueFactory.createErrorIssue(
                    "WCAG 3.1.2 Language of Parts (Level AA)",
                    error as Error,
                    "Unable to determine if all parts of the document have proper language identifiers",
                    AccessibilityReportGenerator.generateRemediationSteps("WCAG 3.1.2 Language of Parts (Level AA)")
                    //"Ensure the PDF file is valid and accessible, with proper language tagging throughout"
                )
            };
        }
    }
  
    /**
     * Tests if links in a PDF document have a clear purpose (WCAG 2.4.4)
     * @param pdfDoc PDF document
     * @returns Promise resolving to an object with test result and optional issue
     */
    static async testLinkPurpose(pdfDoc: pdfjsLib.PDFDocumentProxy): Promise<{ passed: boolean; issue?: AccessibilityIssue }> {
        try {
            // Extract link content from all pages
            const links: LinkContent[] = [];

            for (let pageNum = 1; pageNum <= pdfDoc.numPages; pageNum++) {
                const page = await pdfDoc.getPage(pageNum);

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
                    issue: WcagTests.IssueFactory.createIssue(
                        "WCAG 2.4.4 Link Purpose (In Context) (Level A)",
                        `PDF document contains hyperlinks that lack meaningful descriptive text. Examples: ${examples}`,
                        "Screen readers announce link text to blind users. When links display raw URLs or generic text like 'click here', blind users cannot determine the link's purpose or destination without exploring it, making navigation inefficient and potentially confusing.",
                        AccessibilityReportGenerator.generateRemediationSteps("WCAG 2.4.4 Link Purpose (In Context) (Level A)")
                        //"Associate each hyperlink with descriptive text that clearly indicates its purpose or destination. Avoid using raw URLs, page numbers, or generic phrases like 'click here' as link text."
                    )
                };
            }

            // No issues found
            return { passed: true };
        } catch (error) {
            console.error('Error testing link purpose:', error);
            return {
                passed: false,
                issue: WcagTests.IssueFactory.createErrorIssue(
                    "WCAG 2.4.4 Link Purpose (In Context) (Level A)",
                    error as Error,
                    "Unable to determine if hyperlinks have meaningful descriptive text",
                    AccessibilityReportGenerator.generateRemediationSteps("WCAG 2.4.4 Link Purpose (In Context) (Level A)")
                    // "Ensure the PDF file is valid and accessible, with proper tagging of hyperlinks and associated text"
                )
            };
        }
    }
  
    /**
     * Tests if images in a PDF document have alternative text (WCAG 1.1.1)
     * @param pdfDoc PDF document
     * @returns Promise resolving to an object with test result and optional issue
     */
    static async testImageAltText(pdfDoc: pdfjsLib.PDFDocumentProxy): Promise<{ passed: boolean; issue?: AccessibilityIssue }> {
        try {
            // Extract image content from all pages
            const images: ImageContent[] = [];

            for (let pageNum = 1; pageNum <= pdfDoc.numPages; pageNum++) {
                const page = await pdfDoc.getPage(pageNum);

                // Extract images from the page
                const imageExtractionResult = await ImageExtractor.extractImagesFromPage(page, pageNum);

                images.push(...imageExtractionResult);
            }

            // If there are no images, this criterion doesn't apply
            if (images.length === 0) {
                console.log("Document doesn't contain any images, WCAG 1.1.1 criterion for images doesn't apply");
                return { passed: true };
            }

            // Check for images without alt text
            const imagesWithoutAltText = images.filter(image => !image.hasAltText);

            // If we found images without alt text
            if (imagesWithoutAltText.length > 0) {
                return {
                    passed: false,
                    issue: WcagTests.IssueFactory.createIssue(
                        "WCAG 1.1.1 Non-text Content (Level A)",
                        `PDF document contains ${imagesWithoutAltText.length} image${imagesWithoutAltText.length === 1 ? '' : 's'} without alternative text on page${imagesWithoutAltText.length === 1 ? '' : 's'} ${imagesWithoutAltText.map(img => img.page).join(', ')}`,
                        "Screen readers cannot convey the content or purpose of these images to blind users, potentially causing them to miss important information conveyed visually",
                        AccessibilityReportGenerator.generateRemediationSteps("WCAG 1.1.1 Non-text Content (Level A)")
                        //"Add appropriate alternative text to all images in the PDF structure. The alt text should convey the purpose and content of each image in a concise manner."
                    )
                };
            }

            // No issues found
            return { passed: true };
        } catch (error) {
            console.error('Error testing image alt text:', error);
            return {
                passed: false,
                issue: WcagTests.IssueFactory.createErrorIssue(
                    "WCAG 1.1.1 Non-text Content (Level A)",
                    error as Error,
                    "Unable to determine if images have alternative text",
                    AccessibilityReportGenerator.generateRemediationSteps("WCAG 1.1.1 Non-text Content (Level A)")
                    // "Ensure the PDF file is valid and accessible, with proper tagging of images and alternative text"
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
                        remediation: AccessibilityReportGenerator.generateRemediationSteps("WCAG 3.3.2 Labels or Instructions (Level A)")//"Add descriptive labels to all form fields to ensure users understand their purpose"
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
                    remediation: AccessibilityReportGenerator.generateRemediationSteps("WCAG 3.3.2 Labels or Instructions (Level A)")//"Ensure the PDF file is valid and accessible"
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
                        AccessibilityReportGenerator.generateRemediationSteps("WCAG 2.4.7 Focus Visible (Level AA)")
                        // "Ensure all interactive form fields have a clear visual focus indicator when receiving keyboard focus. " +
                        // "Add appropriate focus styles to fields that lack them. Consider using highlighting, borders, or other " +
                        // "visual indicators that meet contrast requirements."
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
                    AccessibilityReportGenerator.generateRemediationSteps("WCAG 2.4.7 Focus Visible (Level AA)")
                    //"Ensure the PDF file is valid and accessible, then try the test again"
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


export class PdfAccessibilityChecker {
  /**
   * Checks the accessibility of a PDF document and generates a report
   * @param pdfPath Path to the PDF file
   * @returns Promise resolving to an accessibility report
   */
  static async checkAccessibility(pdfPath: string): Promise<AccessibilityReport> {
      try {
          // Extract filename from path
          const filename = pdfPath.split(/[\\/]/).pop() || '';
          
          // Initialize the report
          const report: AccessibilityReport = {
              filename,
              passed: true,
              issues: [],
              pendingTests: [],
              timestamp: new Date().toISOString(),
          };
          
          // Detect document type (form or regular document)
          const documentType = await WcagTests.detectDocumentType(pdfPath);
          report.documentType = documentType;
          
          // Load the PDF document
          const pdfDoc = await PdfLoader.loadWithPdfJs(pdfPath);
          
          // Run the implemented WCAG tests
          
          // Test for document title (WCAG 2.4.2)
          const titleResult = await WcagTests.testDocumentTitle(pdfDoc);
          if (!titleResult.passed && titleResult.issue) {
              report.issues.push(titleResult.issue);
              report.passed = false;
          }
          
          // Test for document language (WCAG 3.1.1)
          const languageResult = await WcagTests.testDocumentLanguage(pdfDoc);
          if (!languageResult.passed && languageResult.issue) {
              report.issues.push(languageResult.issue);
              report.passed = false;
          }
          const languageOfPartsResult = await WcagTests.testLanguageOfParts(pdfPath);
          if (!languageOfPartsResult.passed && languageOfPartsResult.issue) {
              report.issues.push(languageOfPartsResult.issue);
              report.passed = false;
          }

          // Test for link purpose (WCAG 2.4.4)
          const linkPurposeResult = await WcagTests.testLinkPurpose(pdfDoc);
          if (!linkPurposeResult.passed && linkPurposeResult.issue) {
              report.issues.push(linkPurposeResult.issue);
              report.passed = false;
          }
          
          // Test for image alt text (WCAG 1.1.1)
          const imageAltTextResult = await WcagTests.testImageAltText(pdfDoc);
          if (!imageAltTextResult.passed && imageAltTextResult.issue) {
              report.issues.push(imageAltTextResult.issue);
              report.passed = false;
          }

          if (documentType.isForm) {
            const formFieldLabelsResult = await WcagTests.testFormFieldLabels(pdfPath);
            if (!formFieldLabelsResult.passed && formFieldLabelsResult.issue) {
              report.issues.push(formFieldLabelsResult.issue);
              report.passed = false;
            }

            const focusVisibleResult = await WcagTests.testFocusVisible(pdfPath);
            if (!focusVisibleResult.passed && focusVisibleResult.issue) {
              report.issues.push(focusVisibleResult.issue);
              report.passed = false;
            }
          }


          
          // Add pending tests
          report.pendingTests = [
              {
                  criterion: "WCAG 2.4.5 Multiple Ways",
                  reason: "We are planning to implement this test. This criterion requires that there is more than one way to locate a webpage within a set of webpages. For PDFs, this would involve checking for the presence of bookmarks, a table of contents, or other navigation aids.",
                  status: "Planned - Requirements Analysis"
              },
              {
                  criterion: "WCAG 1.3.2 Meaningful Sequence",
                  reason: "We are planning to implement this test. This criterion ensures that when the sequence in which content is presented affects its meaning, a correct reading sequence can be programmatically determined. For PDFs, this involves checking the document's structure tree and reading order.",
                  status: "Planned - Requirements Analysis"
              },
              {
                  criterion: "WCAG 2.4.3 Focus Order",
                  reason: "We are planning to implement this test. This criterion ensures that the order of focus when navigating through interactive elements in a PDF (like form fields and links) follows a sequence that preserves meaning and operability. This is essential for blind users who navigate documents using keyboard commands with screen readers.",
                  status: "Planned - Requirements Analysis"
              }
          ];
          
          // Add additional notes
          report.additionalNotes = "Note: We are actively working on implementing tests for WCAG 2.4.5 Multiple Ways, WCAG 1.3.2 Meaningful Sequence, and WCAG 2.4.3 Focus Order. For Multiple Ways, we need to gather requirements from sight-impaired users to determine acceptable navigation methods. For Meaningful Sequence, we're developing algorithms to verify that the reading order in PDF documents is logical. For Focus Order, we're analyzing how to test that interactive elements follow a sequence that preserves meaning and operability for screen reader users.";
          
          // Save the report to a file
          // const reportPath = pdfPath.replace(/\.pdf$/i, '-accessibility-report.json');
          // AccessibilityReportGenerator.saveReport(report, reportPath);
          const htmlReportPath = getHTMLReportPath(filename);
          AccessibilityReportGenerator.saveHTMLReport(AccessibilityReportGenerator.generateHtml(report), 
            htmlReportPath.replace(/\.pdf$/i, '-accessibility-report.html'));
          
          return report;
      } catch (error) {
          console.error("Error checking PDF accessibility:", error);
          throw error;
      }
  }
}


/**
 * Class responsible for generating accessibility reports for PDF documents.
 * This class takes the results of various accessibility tests and
 * generates a comprehensive report in JSON format.
 */
export class AccessibilityReportGenerator {
  /**
   * Generates a HTML accessibility report for a PDF document
   * @param report JSON AccessibilityReport
   * @param outputPath Path to save the report
   */
  static generateHtml(report: AccessibilityReport): string {
    const issueHtml = report.issues.map(issue => `
      <div class="issue">
        <strong>Criterion:</strong> ${issue.criterion}<br/>
        <strong>Description:</strong> ${issue.description}<br/>
        <strong>Impact:</strong> ${issue.impact}<br/>
        <strong>Remediation:</strong>
        <ul>
          <li><strong>Location:</strong> ${issue.remediation.location}</li>
          <li><strong>Steps:</strong> <ul>${issue.remediation.steps.map(s => `<li>${s}</li>`).join('')}</ul></li>
          <li><strong>Tools:</strong> <ul>${issue.remediation.tools.map(t => `<li>${t}</li>`).join('')}</ul></li>
          <li><strong>Priority:</strong> ${issue.remediation.priority}</li>
        </ul>
      </div>
    `).join('');
  
    const pendingHtml = report.pendingTests.map(test => `
      <div class="pending">
        <strong>Criterion:</strong> ${test.criterion}<br/>
        <strong>Status:</strong> <span class="tag">${test.status}</span><br/>
        <strong>Reason:</strong> ${test.reason}
      </div>
    `).join('');
  
    const docDetails = report.documentType.details.map(d => `<li>${d}</li>`).join('');
  
    return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8" />
      <title>Accessibility Compliance Report for ${report.filename}</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 2em; line-height: 1.6; }
        h1 { border-bottom: 2px solid #333; }
        .issue, .pending { border: 1px solid #ccc; border-left: 4px solid #e74c3c; padding: 1em; margin-top: 1em; }
        .pending { border-left-color: #f39c12; }
        .tag { display: inline-block; background: #eee; padding: 2px 6px; border-radius: 4px; font-size: 0.9em; }
      </style>
    </head>
    <body>
      <h1>Accessibility Compliance Report for ${report.filename}</h1>
  
      <section><strong>Passed:</strong> ${report.passed ? '✅ Yes' : '❌ No'}</section>
  
      <section><h2>Detected Issues</h2>${issueHtml}</section>
  
      <section><h2>Pending Tests</h2>${pendingHtml}</section>
  
      <section><h2>Document Type</h2>
        <p><strong>Is Form:</strong> ${report.documentType.isForm}</p>
        <p><strong>Is Document:</strong> ${report.documentType.isDocument}</p>
        <p><strong>Confidence:</strong> ${report.documentType.confidence}%</p>
        <ul>${docDetails}</ul>
      </section>
  
      <section><h2>Additional Notes</h2><p>${report.additionalNotes}</p></section>
  
      <footer><em>Report generated at: ${new Date(report.timestamp).toLocaleString()}</em></footer>
    </body>
    </html>
    `;
  }
  
  /**
   * Saves a HTML report to a file
   * @param htmlReport Accessibility report
   * @param outputPath Path to save the report
   */
  static saveHTMLReport(htmlReport: string, outputPath: string) {
    fs.writeFileSync(outputPath, htmlReport, 'utf-8');
    console.log(`HTML Accessibility report saved to: ${outputPath}`);
  }
  
  /**
   * Generates an accessibility report for a PDF document
   * @param pdfPath Path to the PDF file
   * @param outputPath Path to save the report
   */
  static async generateReport(pdfPath: string, outputPath: string): Promise<AccessibilityReport> {
      try {
          console.log(`Generating accessibility report for: ${pdfPath}`);
          
          // Extract filename from path
          const filename = pdfPath.split(/[\\/]/).pop() || '';
          
          // Detect document type (form or regular document)
          const documentType = await WcagTests.detectDocumentType(pdfPath);
          console.log(`Document type: ${documentType.isForm ? 'Form' : 'Document'} (${documentType.confidence}% confidence)`);
          console.log('Detection details:');
          documentType.details.forEach(detail => console.log(`- ${detail}`));
          
          // Load the PDF document for testing
          const pdfDoc = await PdfLoader.loadWithPdfJs(pdfPath);
          
          // Run the tests
          const titleResult = await WcagTests.testDocumentTitle(pdfDoc);
          const languageResult = await WcagTests.testDocumentLanguage(pdfDoc);
          const languageOfPartsResult = await WcagTests.testLanguageOfParts(pdfPath);
          const linkPurposeResult = await WcagTests.testLinkPurpose(pdfDoc);
          const imageAltTextResult = await WcagTests.testImageAltText(pdfDoc);
          
          // Check if all tests passed
          const passed = [
              titleResult, languageResult, languageOfPartsResult, 
              linkPurposeResult, imageAltTextResult
          ].every(result => result.passed);
          
          // Collect all issues
          const issues: AccessibilityIssue[] = [];
          [titleResult, languageResult, languageOfPartsResult, linkPurposeResult, imageAltTextResult].forEach(result => {
              if (result && !result.passed && result.issue) issues.push(result.issue);
          });
          
          // Create the report
          const report: AccessibilityReport = {
              filename,
              passed,
              issues,
              documentType: {
                  isForm: documentType.isForm,
                  isDocument: documentType.isDocument,
                  confidence: documentType.confidence,
                  details: documentType.details
              },
              pendingTests: [],
              timestamp: new Date().toISOString()
          };
          
          // Write the report to file
          this.saveReport(report, outputPath);
          
          // Print summary to console
          this.printReportSummary(report);
          return report;
          
      } catch (error) {
          console.error("Error generating accessibility report:", error);
          throw error;
      }
  }
  
  /**
   * Saves a report to a file
   * @param report Accessibility report
   * @param outputPath Path to save the report
   */
  static saveReport(report: AccessibilityReport, outputPath: string): void {
      fs.writeFileSync(outputPath, JSON.stringify(report, null, 2));
      console.log(`Accessibility report saved to: ${outputPath}`);
  }
  
  /**
   * Prints a summary of the report to the console
   * @param report Accessibility report
   */
  static printReportSummary(report: AccessibilityReport): void {
      console.log(`\nAccessibility Test Summary for ${report.filename}:`);
      console.log(`Status: ${report.passed ? 'PASSED' : 'FAILED'}`);
      
      if (report.issues.length > 0) {
          console.log(`\nIssues found (${report.issues.length}):`);
          report.issues.forEach((issue, index) => {
              console.log(`${index + 1}. ${issue.criterion}: ${issue.description}`);
          });
      } else {
          console.log('\nNo accessibility issues found!');
      }
      
      if (report.documentType) {
          console.log(`\nDocument Type: ${report.documentType.isForm ? 'Form' : 'Document'} (${report.documentType.confidence}% confidence)`);
      }
      
      console.log(`\nReport generated at: ${report.timestamp}`);
  }

  /**
   * Generates detailed remediation steps for a specific issue
   */
  static generateRemediationSteps(issue: string): RemediationStep {  
    if (issue.includes('3.3.2')) { // Form Field Labels
        return {
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
        };
    }
    else if (issue.includes('2.4.7')) { // Focus Visibility
        return {
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
        };
    }
    else if (issue.includes('1.1.1')) {
      return {
        location: "Image without Alternative Text",
        steps: [
          'Open the PDF in Foxit PDF Editor',
          'Click on Accessibilty > Full Check > Start Checking',
          'From the left side menu click on "View the Accessibility Checker results and fix errors"',
          'Right click on "Accessibilty Check" and Select "Tags"',
          'Confirm the image is correctly tagged as a Figure',
          'Right click on the Figure tag and select Properties',
          'Add alt text to the figure'
        ],
        tools: ['Foxit PDF Editor', 'Foxit Accessibility Checker'],
        priority: 'High'
      };
    }
    else if (issue.includes('2.4.2')) {
      return {
        location: "Page Title",
        steps: [
          'Open the PDF in Foxit PDF Editor',
          'Click on File > Properties',
          'Add Title'
        ],
        tools: ['Foxit PDF Editor'],
        priority: 'High'
      };
    }
    else if (issue.includes('2.4.4')) {
      return {
        location: "Links",
        steps: [
          'Open the PDF in Foxit PDF Editor',
          ''
        ],
        tools: ['Foxit PDF Editor'],
        priority: 'High'
      };
    }
    else if (issue.includes('3.1.1')) {
        return {
          location: "Language of Page",
          steps: [
            'Open the PDF in Foxit PDF Editor',
            'Click on File > Properties > Advanced',
            'Select the language from the Language dropdown menu under Reading Options section'
          ],
          tools: ['Foxit PDF Editor'],
          priority: 'High'
        };
    }
    else if (issue.includes('3.1.2')) {
      return {
        location: "Paragrapghs",
        steps: [
            'Open the PDF in Foxit PDF Editor',
            'Click on Accessibilty > Full Check > Start Checking',
            'From the left side menu click on "View the Accessibility Checker results and fix errors"',
            'Right click on "Accessibilty Check" and Select "Tags"',
            'Find the <p> Tag realated to the paragrapgh',
            'Right click on the <p> tag and click Properties',
            'Select the language from the Language dropdown menu'
        ],
        tools: ['Foxit PDF Editor'],
        priority: 'Low'
      };
    }
    
    return null;
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


async function main() {
  const pdfPath = process.argv[2];
  if (!pdfPath) {
      console.error('Please provide a PDF file path');
      process.exit(1);
  }

  try {
    PdfAccessibilityChecker.checkAccessibility(pdfPath);

  } catch (error) {
      console.error('Error processing PDF:', error);
      process.exit(1);
  }
}

// Run the main function if this script is run directly
if (require.main === module) {
    main().catch(console.error);
}
