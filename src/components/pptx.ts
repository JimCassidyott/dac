import * as fs from 'fs';
import * as unzipper from 'unzipper';
import { parseStringPromise } from "xml2js";
import { hex as contrastRatio } from "wcag-contrast";
import { PPTComments } from "./PPTComments";

export interface Issue {
  slideNumber: number,
  issueText: string,
  position: {
    x: number,
    y: number
  };
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
      const pos = extractPosition(null);
      issues.push({
        slideNumber: slideIndex,
        issueText: `Slide ${slideIndex}: Missing title placeholder (no heading).`,
        position: pos
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
              const pos = extractPosition(text);
                issues.push({
                  slideNumber: slideIndex,
                  issueText: `Slide ${slideIndex}, Text ${index + 1}: Low contrast (Ratio: ${contrast.toFixed(2)}).`,
                  position: pos
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
          const pos = extractPosition(null);
          issues.push({
            slideNumber: slideFiles.indexOf(slideFile) + 1,
            issueText: `Slide ${slideFiles.indexOf(slideFile) + 1} is empty.`,
            position: pos
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
        const pos = extractPosition(tbl);
        issues.push({
          slideNumber: slideIndex,
          issueText: `Slide ${slideIndex}: Table is missing a proper header row (firstRow flag not set).`,
          position: pos
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
              const pos = extractPosition(item);
              issues.push({
                slideNumber: slideIndex,
                issueText: `Slide ${slideIndex}, Image ${index + 1}: Missing alt text.`,
                position: pos
              });
          }
      });

      // Check <p:sp> (Shapes)
      const shapes = tree["p:sp"] || [];
      shapes.forEach((item: any, index: number) => {
          const alt = item["p:nvSpPr"]?.[0]["p:cNvPr"]?.[0]?.["$"]?.descr || "";
          if (!alt.trim()) {
              console.warn(`Slide ${slideIndex}, Shape ${index + 1}: Missing alt text.`);
              const pos = extractPosition(item);
              issues.push({
                slideNumber: slideIndex,
                issueText: `Slide ${slideIndex}, Shape ${index + 1}: Missing alt text.`,
                position: pos
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
              const pos = extractPosition(item);
              issues.push({
                slideNumber: slideIndex,
                issueText: `Slide ${slideIndex}, ${type} ${index + 1}: Missing alt text.`,
                position: pos
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
              const pos = extractPosition(shape);
              issues.push({
                slideNumber: slideIndex,
                issueText: `Slide ${slideIndex}: Link text is a raw URL -> "${text}". Use descriptive text instead.`,
                position: pos
              });
            }
          }
        }
      }
    }
  }
  return issues;
}




export async function testPPTXDoc(filePath: string){
  let issues = await checkAltTextAllVisuals(filePath);
  for (const issue of issues) {
    console.log(issue);
    await PPTComments.addComment(filePath, issue.slideNumber, {
      author: "thor",
      text: issue.issueText,
      x: 0,
      y: 0,
      date: '2024-01-01T15:00:00Z'
    });
    return;
  }
}

async function runPPTXTests() {
  await testPPTXDoc("/home/tharindu/Downloads/Versioning.pptx");
  // await checkAltText("/home/tharindu/Downloads/Versioning.pptx");
  // console.log(await checkSlideTitle("/home/tharindu/Downloads/Versioning.pptx"));
  // console.log(await checkContrast("/home/tharindu/Downloads/Versioning.pptx"));
  // // await checkReadingOrder("/home/tharindu/Downloads/Versioning.pptx");
  // console.log(await checkEmptySlides("/home/tharindu/Downloads/Versioning.pptx"));
  // console.log(await checkPowerPointTableHeaders("/home/tharindu/Downloads/Versioning.pptx"));
  // console.log(await checkAltTextAllVisuals("/home/tharindu/Downloads/Versioning.pptx"));
  // console.log(await checkRawURLLinks("/home/tharindu/Downloads/Versioning.pptx"));
}

runPPTXTests();
