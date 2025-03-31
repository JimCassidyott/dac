import { WcagTests } from './pdfAccessibilityChecker';
import * as path from 'path';

async function testFormDetection() {
  try {
    console.log('='.repeat(50));
    console.log('TESTING FORM DETECTION ALGORITHM');
    console.log('='.repeat(50));
    
    // Test 1383e.pdf (should be detected as a form)
    const form1383ePath = path.join(__dirname, '1383e.pdf');
    console.log(`\nTesting file: ${form1383ePath}`);
    console.log('-'.repeat(50));
    const result1383e = await WcagTests.detectDocumentType(form1383ePath);
    
    // Print the result with better formatting
    console.log('\nRESULT FOR 1383e.pdf:');
    console.log('-'.repeat(20));
    console.log(`Is Form:      ${result1383e.isForm}`);
    console.log(`Is Document:  ${result1383e.isDocument}`);
    console.log(`Confidence:   ${result1383e.confidence}%`);
    console.log('\nDetails:');
    result1383e.details.forEach(detail => console.log(`  • ${detail}`));
    
    console.log('\n' + '='.repeat(50));
    
    // Test mydoc.pdf (should be detected as a document)
    const mydocPath = path.join(__dirname, 'mydoc.pdf');
    console.log(`\nTesting file: ${mydocPath}`);
    console.log('-'.repeat(50));
    const resultMyDoc = await WcagTests.detectDocumentType(mydocPath);
    
    // Print the result with better formatting
    console.log('\nRESULT FOR mydoc.pdf:');
    console.log('-'.repeat(20));
    console.log(`Is Form:      ${resultMyDoc.isForm}`);
    console.log(`Is Document:  ${resultMyDoc.isDocument}`);
    console.log(`Confidence:   ${resultMyDoc.confidence}%`);
    console.log('\nDetails:');
    resultMyDoc.details.forEach(detail => console.log(`  • ${detail}`));
    
    console.log('\n' + '='.repeat(50));
  } catch (error) {
    console.error('Error:', error);
  }
}

testFormDetection();
