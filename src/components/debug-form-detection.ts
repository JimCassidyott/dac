import { WcagTests } from './pdfAccessibilityChecker';
import * as path from 'path';

// This script will debug the form detection for mydoc.pdf
async function debugFormDetection() {
  try {
    console.log('='.repeat(50));
    console.log('DEBUGGING FORM DETECTION FOR MYDOC.PDF');
    console.log('='.repeat(50));
    
    // Get the path to mydoc.pdf
    const mydocPath = path.join(__dirname, 'mydoc.pdf');
    console.log(`Testing file: ${mydocPath}`);
    console.log('-'.repeat(50));
    
    // Create a modified version of detectDocumentType with extra logging
    const originalDetectDocumentType = WcagTests.detectDocumentType;
    
    // Override the method with our debug version
    WcagTests.detectDocumentType = async function(pdfPath: string) {
      console.log(`DEBUG: Starting document type detection for ${pdfPath}`);
      
      try {
        // Default result structure
        const result = {
          isForm: false,
          isDocument: true,
          confidence: 0,
          details: [] as string[]
        };
        
        // Load the PDF document
        console.log("DEBUG: Loading PDF document...");
        const pdfLibDoc = await this.PdfLoader.loadWithPdfLib(pdfPath);
        const pdfJsDoc = await this.PdfLoader.loadWithPdfJs(pdfPath);
        
        // Evidence counters
        let formEvidence = 0;
        let documentEvidence = 0;
        
        console.log("DEBUG: Checking for form fields...");
        // 1. Check for form fields
        const form = pdfLibDoc.getForm();
        const fields = form.getFields();
        
        if (fields.length > 0) {
          formEvidence += 3;
          console.log(`DEBUG: Found ${fields.length} form fields (+3 form evidence)`);
          result.details.push(`Found ${fields.length} form fields`);
          
          const fieldTypes = new Set<string>();
          fields.forEach(field => fieldTypes.add(field.constructor.name));
          
          console.log(`DEBUG: Field types: ${Array.from(fieldTypes).join(', ')}`);
          result.details.push(`Field types: ${Array.from(fieldTypes).join(', ')}`);
        } else {
          documentEvidence += 1;
          console.log("DEBUG: No form fields detected (+1 document evidence)");
          result.details.push("No form fields detected");
        }
        
        console.log("DEBUG: Checking for annotations...");
        // 2. Check for annotations
        let buttonAnnotations = 0;
        let widgetAnnotations = 0;
        let checkBoxAnnotations = 0;
        let textBoxAnnotations = 0;
        let signatureAnnotations = 0;
        
        for (let i = 1; i <= pdfJsDoc.numPages; i++) {
          const page = await pdfJsDoc.getPage(i);
          const annotations = await page.getAnnotations();
          
          for (const annotation of annotations) {
            if (annotation.subtype === 'Widget') {
              widgetAnnotations++;
            }
            
            if (annotation.subtype === 'Button') {
              buttonAnnotations++;
            }
            
            if (annotation.fieldType === 'Tx') {
              textBoxAnnotations++;
            }
            
            if (annotation.fieldType === 'Btn' && annotation.checkBox) {
              checkBoxAnnotations++;
            }
            
            if (annotation.fieldType === 'Sig') {
              signatureAnnotations++;
            }
          }
        }
        
        if (widgetAnnotations > 0 || buttonAnnotations > 0 || textBoxAnnotations > 0 || 
            checkBoxAnnotations > 0 || signatureAnnotations > 0) {
          formEvidence += 3;
          console.log(`DEBUG: Found form-related annotations: ${widgetAnnotations} widget, ${buttonAnnotations} button, ` +
            `${textBoxAnnotations} text box, ${checkBoxAnnotations} checkbox, ${signatureAnnotations} signature (+3 form evidence)`);
          result.details.push(`Found form-related annotations: ${widgetAnnotations} widget, ${buttonAnnotations} button, ` +
            `${textBoxAnnotations} text box, ${checkBoxAnnotations} checkbox, ${signatureAnnotations} signature`);
        }
        
        console.log("DEBUG: Checking for keywords...");
        // 3. Check for keywords
        const formKeywords = [
          'form', 'submit', 'fill', 'complete', 'application', 'apply', 'field', 'required',
          'signature', 'sign here', 'date', 'print name', 'checkbox', 'check box', 'text box',
          'please complete', 'please fill', 'return to', 'applicant', 'questionnaire'
        ];
        
        let formKeywordCount = 0;
        let formKeywordMatches: string[] = [];
        
        for (let i = 1; i <= pdfJsDoc.numPages; i++) {
          const page = await pdfJsDoc.getPage(i);
          const textContent = await page.getTextContent();
          const pageText = textContent.items.map((item: any) => 'str' in item ? item.str : '').join(' ').toLowerCase();
          
          for (const keyword of formKeywords) {
            if (pageText.includes(keyword)) {
              formKeywordCount++;
              formKeywordMatches.push(keyword);
              console.log(`DEBUG: Found form keyword: "${keyword}" on page ${i}`);
            }
          }
        }
        
        if (formKeywordCount >= 2) {
          formEvidence += 1;
          console.log(`DEBUG: Found ${formKeywordCount} form-related keywords: ${formKeywordMatches.join(', ')} (+1 form evidence)`);
          result.details.push(`Found ${formKeywordCount} form-related keywords: ${formKeywordMatches.join(', ')}`);
        }
        
        console.log("DEBUG: Checking document characteristics...");
        // 4. Check for document characteristics
        if (pdfJsDoc.numPages > 5) {
          documentEvidence += 1;
          console.log(`DEBUG: Document has ${pdfJsDoc.numPages} pages, typical for a document (+1 document evidence)`);
          result.details.push(`Document has ${pdfJsDoc.numPages} pages, which is typical for a document rather than a form`);
        }
        
        // 5. Check for text patterns typical of documents
        try {
          console.log("DEBUG: Checking for long paragraphs...");
          const samplePages = Math.min(pdfJsDoc.numPages, 3);
          let longParagraphCount = 0;
          
          for (let i = 1; i <= samplePages; i++) {
            const page = await pdfJsDoc.getPage(i);
            const textContent = await page.getTextContent();
            const textItems = textContent.items;
            
            let currentParagraphLength = 0;
            let lastY = null;
            
            for (const item of textItems) {
              if ('transform' in item && 'str' in item) {
                if (lastY === null || Math.abs(item.transform[5] - lastY) < 2) {
                  currentParagraphLength += item.str.length;
                } else {
                  if (currentParagraphLength > 200) {
                    longParagraphCount++;
                    console.log(`DEBUG: Found long paragraph (${currentParagraphLength} chars) on page ${i}`);
                  }
                  currentParagraphLength = item.str.length;
                }
                lastY = item.transform[5];
              }
            }
            
            if (currentParagraphLength > 200) {
              longParagraphCount++;
              console.log(`DEBUG: Found long paragraph (${currentParagraphLength} chars) at end of page ${i}`);
            }
          }
          
          if (longParagraphCount > 0) {
            documentEvidence += 2;
            console.log(`DEBUG: Found ${longParagraphCount} long paragraphs (+2 document evidence)`);
            result.details.push(`Found ${longParagraphCount} long paragraphs, which is typical of documents rather than forms`);
          }
        } catch (error) {
          console.log("DEBUG: Error during text pattern analysis:", error);
        }
        
        console.log(`\nDEBUG SUMMARY:`);
        console.log(`Form evidence: ${formEvidence}`);
        console.log(`Document evidence: ${documentEvidence}`);
        
        // Make the determination based on evidence
        if (formEvidence > documentEvidence) {
          console.log(`DEBUG: Form evidence (${formEvidence}) > Document evidence (${documentEvidence})`);
          
          // Check for document-specific characteristics that would override form classification
          const hasLongParagraphs = result.details.some(detail => detail.includes("long paragraphs"));
          
          if (hasLongParagraphs) {
            console.log(`DEBUG: Document has long paragraphs, overriding form classification`);
            result.isForm = false;
            result.isDocument = true;
            result.confidence = 70;
            result.details.push("Document characteristics override form detection");
          } else {
            console.log(`DEBUG: Classifying as a form`);
            result.isForm = true;
            result.isDocument = false;
            result.confidence = Math.min(100, Math.round((formEvidence / (formEvidence + documentEvidence)) * 100));
          }
        } else if (formEvidence > 0) {
          console.log(`DEBUG: Some form evidence (${formEvidence}) but less than document evidence (${documentEvidence})`);
          
          if (formEvidence >= 2) {
            console.log(`DEBUG: Form evidence >= 2, classifying as a form`);
            result.isForm = true;
            result.isDocument = false;
            result.confidence = Math.min(100, Math.round((formEvidence / (formEvidence + documentEvidence)) * 100));
          } else {
            console.log(`DEBUG: Form evidence < 2, classifying as a document`);
            result.isForm = false;
            result.isDocument = true;
            result.confidence = Math.min(100, Math.round((documentEvidence / (formEvidence + documentEvidence)) * 100));
          }
        } else {
          console.log(`DEBUG: No form evidence, classifying as a document`);
          result.isForm = false;
          result.isDocument = true;
          result.confidence = Math.min(100, Math.round((documentEvidence / (formEvidence + documentEvidence)) * 100));
        }
        
        return result;
      } catch (error) {
        console.error("DEBUG ERROR:", error);
        return {
          isForm: false,
          isDocument: true,
          confidence: 30,
          details: [`Error during detection: ${(error as Error).message}`]
        };
      }
    };
    
    // Run the document type detection with our debug version
    const result = await WcagTests.detectDocumentType(mydocPath);
    
    // Restore the original method
    WcagTests.detectDocumentType = originalDetectDocumentType;
    
    // Print the result
    console.log('\nFINAL RESULT:');
    console.log('-'.repeat(20));
    console.log(`Is Form:      ${result.isForm}`);
    console.log(`Is Document:  ${result.isDocument}`);
    console.log(`Confidence:   ${result.confidence}%`);
    
    console.log('\nDetails:');
    result.details.forEach(detail => console.log(`  • ${detail}`));
    
    console.log('\n' + '='.repeat(50));
  } catch (error) {
    console.error('Error:', error);
  }
}

debugFormDetection();
