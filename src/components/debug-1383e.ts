import { PdfLoader } from './pdfAccessibilityChecker';
import * as path from 'path';

async function debug1383e() {
  try {
    console.log('='.repeat(50));
    console.log('DEBUGGING 1383e.pdf FORM DETECTION');
    console.log('='.repeat(50));
    
    const pdfPath = path.join(__dirname, '1383e.pdf');
    console.log(`Testing file: ${pdfPath}`);
    console.log('-'.repeat(50));
    
    // Check if the PDF is encrypted
    const isEncrypted = await PdfLoader.isEncrypted(pdfPath);
    console.log(`Is PDF encrypted: ${isEncrypted}`);
    
    // Try to load with pdf-lib
    console.log('\nAttempting to load with pdf-lib...');
    try {
      const pdfLibDoc = await PdfLoader.loadWithPdfLib(pdfPath);
      console.log('Successfully loaded with pdf-lib');
      
      // Check for form fields
      const form = pdfLibDoc.getForm();
      const fields = form.getFields();
      console.log(`Number of form fields detected: ${fields.length}`);
      
      if (fields.length > 0) {
        console.log('Field types:');
        const fieldTypes = new Set<string>();
        fields.forEach(field => fieldTypes.add(field.constructor.name));
        console.log(Array.from(fieldTypes).join(', '));
      }
    } catch (error) {
      console.log(`Error loading with pdf-lib: ${(error as Error).message}`);
    }
    
    // Try to load with pdf.js
    console.log('\nAttempting to load with pdf.js...');
    try {
      const pdfJsDoc = await PdfLoader.loadWithPdfJs(pdfPath);
      console.log(`Successfully loaded with pdf.js. Number of pages: ${pdfJsDoc.numPages}`);
      
      // Check for annotations
      console.log('\nChecking for form annotations...');
      let formAnnotationsFound = false;
      
      for (let i = 1; i <= pdfJsDoc.numPages; i++) {
        console.log(`Checking page ${i}...`);
        const page = await pdfJsDoc.getPage(i);
        const annotations = await page.getAnnotations();
        
        console.log(`Found ${annotations.length} annotations on page ${i}`);
        
        if (annotations.length > 0) {
          for (const annotation of annotations) {
            console.log(`Annotation: subtype=${annotation.subtype}, fieldType=${annotation.fieldType}`);
            
            if (annotation.subtype === 'Widget' || 
                annotation.subtype === 'Button' || 
                annotation.fieldType === 'Tx' || 
                annotation.fieldType === 'Btn' || 
                annotation.fieldType === 'Sig') {
              
              formAnnotationsFound = true;
              console.log(`FORM ANNOTATION FOUND: ${annotation.subtype || annotation.fieldType}`);
            }
          }
        }
      }
      
      console.log(`\nForm annotations found: ${formAnnotationsFound}`);
      
    } catch (error) {
      console.log(`Error loading with pdf.js: ${(error as Error).message}`);
    }
    
    console.log('\n' + '='.repeat(50));
  } catch (error) {
    console.error('Error:', error);
  }
}

debug1383e();
