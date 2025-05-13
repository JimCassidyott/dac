import * as fs from 'fs';
import * as unzipper from 'unzipper';
import { parseStringPromise } from "xml2js";
import { hex as contrastRatio } from "wcag-contrast";
import * as path from 'path';
import { AccessibilityStatus, getHTMLReportPath } from './helpers';
import { GCDocsAdapter } from './GCDocsAdaptor';
import { MSOfficeMetadata } from './MSOfficeMetadata';

export interface Issue {
  slideNumber: number,
  issueText: string,
};

function extractPosition(item: any): { x: number, y: number } {
  const xfrm = item["p:spPr"]?.[0]["a:xfrm"]?.[0]
            || item["p:grpSpPr"]?.[0]["a:xfrm"]?.[0]
            || item["p:graphicFramePr"]?.[0]["a:xfrm"]?.[0];

  const x = parseInt(xfrm?.["a:off"]?.[0]?.["$"]?.x || "1000000"); // default x ~1 inch
  const y = parseInt(xfrm?.["a:off"]?.[0]?.["$"]?.y || "1000000"); // default y ~1 inch

  return { x, y };
}

// async function checkAltText(filePath: string): Promise<Issue[]> {
//     const zip = await unzipper.Open.file(filePath);
//     const slideFiles = zip.files.filter(f => f.path.startsWith("ppt/slides/slide") && f.path.endsWith(".xml"));
//     let issues: Issue[] = [];

//     for (const slideFile of slideFiles) {
//         const content = await slideFile.buffer();
//         const xml = await parseStringPromise(content.toString());
        
//         const images = xml["p:sld"]["p:cSld"][0]["p:spTree"][0]["p:pic"] || [];
        
//         images.forEach((image: any, index: number) => {
//             const altText = image["p:nvPicPr"]?.[0]["p:cNvPr"]?.[0]?.["$"]?.descr || "";
//             if (!altText.trim()) {
//                 console.warn(`Slide ${slideFiles.indexOf(slideFile) + 1}, Image ${index + 1}: Missing alt text.`);
//                 issues.push({
//                   slideNumber: slideFiles.indexOf(slideFile) + 1,
//                   issueText: "jksahfkjah"
//                 });
//             }
//         });
//     }
//     return issues;
// }

// check that each slide has a title.
async function checkSlideTitle(filePath: string): Promise<Issue[]> {
  const zip = await unzipper.Open.file(filePath);
  const slideFiles = zip.files.filter(f => f.path.startsWith("ppt/slides/slide") && f.path.endsWith(".xml"));
  let issues: Issue[] = [];

  for (const slideFile of slideFiles) {
    const content = await slideFile.buffer();
    const xml = await parseStringPromise(content.toString());

    const slideIndex = slideFiles.indexOf(slideFile) + 1;
    const shapes = xml["p:sld"]["p:cSld"][0]["p:spTree"][0]["p:sp"] || [];

    const headings = shapes.filter((shape: any) => {
      const placeholderType = shape["p:nvSpPr"]?.[0]["p:nvPr"]?.[0]["p:ph"]?.[0]?.["$"]?.type;
      return placeholderType === "title";
    });

    if (headings.length === 0) {
      console.warn(`Slide ${slideIndex}: Missing title placeholder (no heading).`);
      issues.push({
        slideNumber: slideIndex,
        issueText: `Slide ${slideIndex}: Missing title placeholder (no heading).`,
      });
    } else {
      console.log(`Slide ${slideIndex}: Found ${headings.length} title placeholder(s).`);
    }
  }
  return issues;
}

async function checkContrast(filePath: string): Promise<Issue[]> {
    const zip = await unzipper.Open.file(filePath);
    const slideFiles = zip.files.filter(f => f.path.startsWith("ppt/slides/slide") && f.path.endsWith(".xml"));
    let issues: Issue[] = [];

    for (const slideFile of slideFiles) {
        const content = await slideFile.buffer();
        const xml = await parseStringPromise(content.toString());

        const slideIndex = slideFiles.indexOf(slideFile) + 1;
        const texts = xml["p:sld"]["p:cSld"][0]["p:spTree"][0]["p:sp"] || [];

        texts.forEach((text: any, index: number) => {
            const textColor = text["p:txBody"]?.[0]["a:p"]?.[0]["a:r"]?.[0]["a:rPr"]?.[0]["a:solidFill"]?.[0]["a:srgbClr"]?.[0]["$"].val || "000000";
            const bgColor = "FFFFFF"; // Default background color

            const contrast = contrastRatio(`#${textColor}`, `#${bgColor}`);
            if (contrast < 4.5) { // WCAG AA threshold
                console.warn(`Slide ${slideIndex}, Text ${index + 1}: Low contrast (Ratio: ${contrast.toFixed(2)}).`);
                issues.push({
                slideNumber: slideIndex,
                  issueText: `Slide ${slideIndex}, Text ${index + 1}: Low contrast (Ratio: ${contrast.toFixed(2)}).`,
                });
            }
        });
    }
    return issues;
}

// async function checkReadingOrder(filePath: string) {
//   const zip = await unzipper.Open.file(filePath);
//   const slideFiles = zip.files.filter(f => f.path.startsWith("ppt/slides/slide") && f.path.endsWith(".xml"));

//   for (const slideFile of slideFiles) {
//       const content = await slideFile.buffer();
//       const xml = await parseStringPromise(content.toString());

//       const elements = xml["p:sld"]["p:cSld"][0]["p:spTree"][0]["p:sp"] || [];
//       const order = elements.map((el: any) => el["p:nvSpPr"]?.[0]["p:cNvPr"]?.[0]?.["$"].id);

//       console.log(`Slide ${slideFiles.indexOf(slideFile) + 1} reading order:`, order);
//   }
// }

/**
 * 
 * @param filePath 
  async function checkReadingOrder(filePath: string) {
    const zip = await unzipper.Open.file(filePath);
    const slideFiles = zip.files.filter(f => f.path.startsWith("ppt/slides/slide") && f.path.endsWith(".xml"));

    for (const slideFile of slideFiles) {
      const content = await slideFile.buffer();
      const xml = await parseStringPromise(content.toString());

      const slideIndex = slideFiles.indexOf(slideFile) + 1;
      const tree = xml["p:sld"]["p:cSld"][0]["p:spTree"][0];

      const spElements = tree["p:sp"] || [];
      const picElements = tree["p:pic"] || [];
      const tableElements = tree["p:graphicFrame"] || [];
      const groupElements = tree["p:grpSp"] || [];

      const allElements = [...spElements, ...picElements, ...tableElements, ...groupElements];

      const order = allElements.map((el: any) => el["p:nvSpPr"]?.[0]["p:cNvPr"]?.[0]?.["$"].id || "unknown");

      console.log(`Slide ${slideIndex} reading order:`, order);
    }
}

 */

async function checkEmptySlides(filePath: string): Promise<Issue[]> {
  const zip = await unzipper.Open.file(filePath);
  const slideFiles = zip.files.filter(f => f.path.startsWith("ppt/slides/slide") && f.path.endsWith(".xml"));
  let issues: Issue[] = []; 

  for (const slideFile of slideFiles) {
      const content = await slideFile.buffer();
      const xml = await parseStringPromise(content.toString());

      const hasText = xml["p:sld"]["p:cSld"][0]["p:spTree"][0]["p:sp"]?.length > 0;
      const hasImages = xml["p:sld"]["p:cSld"][0]["p:spTree"][0]["p:pic"]?.length > 0;

      if (!hasText && !hasImages) {
          console.warn(`Slide ${slideFiles.indexOf(slideFile) + 1} is empty.`);
          issues.push({
            slideNumber: slideFiles.indexOf(slideFile) + 1,
            issueText: `Slide ${slideFiles.indexOf(slideFile) + 1} is empty.`,
          });
      }
  }
  return issues;
}

// Check that the "Table Row" checkbox is selected in Table Tools -> Design 
// this tells the reader that first row of the table is table header
async function checkPowerPointTableHeaders(filePath: string): Promise<Issue[]> {
  const zip = await unzipper.Open.file(filePath);
  const slideFiles = zip.files.filter(f => f.path.startsWith("ppt/slides/slide") && f.path.endsWith(".xml"));
  let issues: Issue[] = [];

  for (const slideFile of slideFiles) {
    const content = await slideFile.buffer();
    const xml = await parseStringPromise(content.toString());

    const slideIndex = slideFiles.indexOf(slideFile) + 1;
    const graphicFrames = xml["p:sld"]["p:cSld"][0]["p:spTree"][0]["p:graphicFrame"] || [];

    for (const frame of graphicFrames) {
      const tbl = frame["a:graphic"]?.[0]["a:graphicData"]?.[0]["a:tbl"];
      if (!tbl) continue;

      const tblPr = tbl[0]["a:tblPr"]?.[0]?.["$"];
      const hasHeaderRow = tblPr?.firstRow === "1";

      if (!hasHeaderRow) {
        console.warn(`Slide ${slideIndex}: Table is missing a proper header row (firstRow flag not set).`);
        issues.push({
          slideNumber: slideIndex,
          issueText: `Slide ${slideIndex}: Table is missing a proper header row (firstRow flag not set).`,
        });
      } else {
        console.log(`Slide ${slideIndex}: Table has header row enabled.`);
      }
    }
  }
  return issues;
}

async function checkAltTextAllVisuals(filePath: string): Promise<Issue[]> {
  const zip = await unzipper.Open.file(filePath);
  const slideFiles = zip.files.filter(f => f.path.startsWith("ppt/slides/slide") && f.path.endsWith(".xml"));
  let issues: Issue[] = [];

  for (const slideFile of slideFiles) {
      const content = await slideFile.buffer();
      const xml = await parseStringPromise(content.toString());
      const slideIndex = slideFiles.indexOf(slideFile) + 1;

      const tree = xml["p:sld"]["p:cSld"][0]["p:spTree"][0];

      // Check <p:pic> (Images)
      const pics = tree["p:pic"] || [];
      pics.forEach((item: any, index: number) => {
          const alt = item["p:nvPicPr"]?.[0]["p:cNvPr"]?.[0]?.["$"]?.descr || "";
          if (!alt.trim()) {
              console.warn(`Slide ${slideIndex}, Image ${index + 1}: Missing alt text.`);
              issues.push({
                slideNumber: slideIndex,
                issueText: `Slide ${slideIndex}, Image ${index + 1}: Missing alt text.`,
              });
          }
      });

      // Check <p:sp> (Shapes)
      const shapes = tree["p:sp"] || [];
      shapes.forEach((item: any, index: number) => {
          const alt = item["p:nvSpPr"]?.[0]["p:cNvPr"]?.[0]?.["$"]?.descr || "";
          if (!alt.trim()) {
              console.warn(`Slide ${slideIndex}, Shape ${index + 1}: Missing alt text.`);
              issues.push({
                slideNumber: slideIndex,
                issueText: `Slide ${slideIndex}, Shape ${index + 1}: Missing alt text.`,
              });
          }
      });

      // Check <p:graphicFrame> (SmartArt, Tables, Charts)
      const frames = tree["p:graphicFrame"] || [];
      frames.forEach((item: any, index: number) => {
          const alt = item["p:nvGraphicFramePr"]?.[0]["p:cNvPr"]?.[0]?.["$"]?.descr || "";
          const graphicDataUri = item["a:graphic"]?.[0]["a:graphicData"]?.[0]["$"]?.uri || "";

          let type = "Graphic";
          if (graphicDataUri.includes("chart")) type = "Chart";
          else if (graphicDataUri.includes("table")) type = "Table";
          else if (graphicDataUri.includes("diagram")) type = "SmartArt";

          if (!alt.trim()) {
              console.warn(`Slide ${slideIndex}, ${type} ${index + 1}: Missing alt text.`);
              issues.push({
                slideNumber: slideIndex,
                issueText: `Slide ${slideIndex}, ${type} ${index + 1}: Missing alt text.`,
              });
          }
      });
  }
  return issues;
}

async function checkRawURLLinks(filePath: string): Promise<Issue[]> {
  const zip = await unzipper.Open.file(filePath);

  const slideFiles = zip.files.filter(f => f.path.startsWith("ppt/slides/slide") && f.path.endsWith(".xml"));
  const relsFiles = zip.files.filter(f => f.path.startsWith("ppt/slides/_rels/") && f.path.endsWith(".xml.rels"));
  let issues: Issue[] = [];

  for (const slideFile of slideFiles) {
    const slideIndex = slideFiles.indexOf(slideFile) + 1;
    const relsFile = relsFiles.find(r => r.path.includes(`slide${slideIndex}.xml.rels`));

    // Parse .rels file for hyperlink mappings
    let relMap: Record<string, string> = {};
    if (relsFile) {
      const relContent = await relsFile.buffer();
      const relXml = await parseStringPromise(relContent.toString());
      const relationships = relXml.Relationships?.Relationship || [];

      relMap = Object.fromEntries(
        relationships
          .filter((r: any) => r.$.Type.includes("hyperlink"))
          .map((r: any) => [r.$.Id, r.$.Target])
      );
    }

    // Parse slide XML and look for hyperlinks
    const content = await slideFile.buffer();
    const xml = await parseStringPromise(content.toString());
    const shapes = xml["p:sld"]["p:cSld"][0]["p:spTree"][0]["p:sp"] || [];

    for (const shape of shapes) {
      const paragraphs = shape["p:txBody"]?.[0]["a:p"] || [];
      for (const para of paragraphs) {
        const runs = para["a:r"] || [];
        for (const run of runs) {
          const text = run["a:t"]?.[0]?.trim();
          const linkId = run["a:rPr"]?.[0]["a:hlinkClick"]?.[0]?.["$"]?.["r:id"];
          const target = linkId ? relMap[linkId] : null;

          if (text && target) {
            if (text === target || text.startsWith("http")) {
              console.warn(`Slide ${slideIndex}: Link text is a raw URL -> "${text}". Use descriptive text instead.`);
              issues.push({
                slideNumber: slideIndex,
                issueText: `Slide ${slideIndex}: Link text is a raw URL -> "${text}". Use descriptive text instead.`,
              });
            }
          }
        }
      }
    }
  }
  return issues;
}

export async function runPPTXTests(filePath: string): Promise<Issue[]>{
  let issues: Issue[] = await checkAltTextAllVisuals(filePath);
  issues.push(...await checkSlideTitle(filePath));
  issues.push(...await checkContrast(filePath));
  issues.push(...await checkPowerPointTableHeaders(filePath));
  issues.push(...await checkRawURLLinks(filePath));
  return issues;
}

export function generatePPTXAccessibilityReport(filePath: string, issues: Issue[]): void {
  const fileName = path.basename(filePath);
  const passed = issues.length === 0;

  const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <title>Accessibility Report for ${fileName}</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 2em; line-height: 1.6; }
        h1 { border-bottom: 2px solid #333; }
        .status { font-size: 1.2em; font-weight: bold; margin: 1em 0; }
        .pass { color: green; }
        .fail { color: red; }
        .issue { border: 1px solid #ccc; border-left: 4px solid #e74c3c; padding: 1em; margin: 1em 0; }
        .slide-num { font-weight: bold; }
        footer { margin-top: 3em; font-style: italic; }
      </style>
    </head>
    <body>
      <h1>Accessibility Compliance Report for ${fileName}</h1>

      <div class="status ${passed ? 'pass' : 'fail'}">
        ${passed ? '✅ Passed: No accessibility issues found.' : '❌ Failed: Accessibility issues detected.'}
      </div>

      ${passed
        ? ''
        : issues.map(issue => `
            <div class="issue">
              <div class="slide-num">Slide ${issue.slideNumber}</div>
              <div class="issue-text">${issue.issueText}</div>
            </div>
          `).join('')
      }

      <footer>Report generated at ${new Date().toLocaleString()}</footer>
    </body>
    </html>
  `;

  const outputPath = getHTMLReportPath(fileName).replace(/\.pptx$/i, '-accessibility-report.html');
  fs.writeFileSync(outputPath, html, 'utf-8');
  console.log(`file saved to: ${outputPath}`);
}

export async function testPPTXAccessiblity(filePath: string, fileSource: string): Promise<{filePath: string, accessibilityStatus: AccessibilityStatus}> {
  if (fileSource === "GCDOCS") {
    const adapter = new GCDocsAdapter();
    filePath = await adapter.downloadDocumentContent(filePath);
  }
  if (!fs.existsSync(filePath)) {
    throw new Error(`Input file does not exist: ${filePath}`);
  }

  const issues: Issue[] = await runPPTXTests(filePath);
  generatePPTXAccessibilityReport(filePath, issues);
  const accessibilityStatus = issues.length === 0 ? AccessibilityStatus.Accessible : AccessibilityStatus.NotAccessible;
  await MSOfficeMetadata.changeIsAccessibleProperty(filePath, issues.length === 0);

  return {filePath, accessibilityStatus};
} 

async function main() {
  console.log(`before: ${await MSOfficeMetadata.isAccessible("C:\\Users\\hatharasinghageth\\Documents\\Test\\dac\\demo_files\\untested\\Versioning.pptx", "SYSTEM")}`);
  console.log(await testPPTXAccessiblity("C:\\Users\\hatharasinghageth\\Documents\\Test\\dac\\demo_files\\untested\\Versioning.pptx", "SYSTEM"));
  console.log(`after: ${await MSOfficeMetadata.isAccessible("C:\\Users\\hatharasinghageth\\Documents\\Test\\dac\\demo_files\\untested\\Versioning.pptx", "SYSTEM")}`);
}

if (require.main === module) {
  main();
}