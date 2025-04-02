import * as fs from 'fs';
import * as unzipper from 'unzipper';
import { parseStringPromise } from "xml2js";
import { hex as contrastRatio } from "wcag-contrast";


async function checkAltText(filePath: string) {
    const zip = await unzipper.Open.file(filePath);
    const slideFiles = zip.files.filter(f => f.path.startsWith("ppt/slides/slide") && f.path.endsWith(".xml"));

    for (const slideFile of slideFiles) {
        const content = await slideFile.buffer();
        const xml = await parseStringPromise(content.toString());
        
        const images = xml["p:sld"]["p:cSld"][0]["p:spTree"][0]["p:pic"] || [];
        
        images.forEach((image: any, index: number) => {
            const altText = image["p:nvPicPr"]?.[0]["p:cNvPr"]?.[0]?.["$"]?.descr || "";
            if (!altText.trim()) {
                console.warn(`Slide ${slideFiles.indexOf(slideFile) + 1}, Image ${index + 1}: Missing alt text.`);
            }
        });
    }
}

async function checkHeadingStructure(filePath: string) {
  const zip = await unzipper.Open.file(filePath);
  const slideFiles = zip.files.filter(f => f.path.startsWith("ppt/slides/slide") && f.path.endsWith(".xml"));

  for (const slideFile of slideFiles) {
      const content = await slideFile.buffer();
      const xml = await parseStringPromise(content.toString());

      const texts = xml["p:sld"]["p:cSld"][0]["p:spTree"][0]["p:sp"] || [];

      const headings = texts.filter((text: any) => {
          const size = text["p:txBody"]?.[0]["a:p"]?.[0]["a:r"]?.[0]["a:rPr"]?.[0]?.["$"]?.sz || 0;
          return parseInt(size) >= 3200; // PowerPoint stores sizes in 1/100 pt, so 3200 = 32px
      });

      if (headings.length === 0) {
          console.warn(`Slide ${slideFiles.indexOf(slideFile) + 1}: Might be missing a heading.`);
      }
  }
}

async function checkContrast(filePath: string) {
    const zip = await unzipper.Open.file(filePath);
    const slideFiles = zip.files.filter(f => f.path.startsWith("ppt/slides/slide") && f.path.endsWith(".xml"));

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
            }
        });
    }
}

async function checkReadingOrder(filePath: string) {
  const zip = await unzipper.Open.file(filePath);
  const slideFiles = zip.files.filter(f => f.path.startsWith("ppt/slides/slide") && f.path.endsWith(".xml"));

  for (const slideFile of slideFiles) {
      const content = await slideFile.buffer();
      const xml = await parseStringPromise(content.toString());

      const elements = xml["p:sld"]["p:cSld"][0]["p:spTree"][0]["p:sp"] || [];
      const order = elements.map((el: any) => el["p:nvSpPr"]?.[0]["p:cNvPr"]?.[0]?.["$"].id);

      console.log(`Slide ${slideFiles.indexOf(slideFile) + 1} reading order:`, order);
  }
}

async function checkEmptySlides(filePath: string) {
  const zip = await unzipper.Open.file(filePath);
  const slideFiles = zip.files.filter(f => f.path.startsWith("ppt/slides/slide") && f.path.endsWith(".xml"));

  for (const slideFile of slideFiles) {
      const content = await slideFile.buffer();
      const xml = await parseStringPromise(content.toString());

      const hasText = xml["p:sld"]["p:cSld"][0]["p:spTree"][0]["p:sp"]?.length > 0;
      const hasImages = xml["p:sld"]["p:cSld"][0]["p:spTree"][0]["p:pic"]?.length > 0;

      if (!hasText && !hasImages) {
          console.warn(`Slide ${slideFiles.indexOf(slideFile) + 1} is empty.`);
      }
  }
}



async function runPPTXTests() {
  await checkAltText("/home/tharindu/Documents/work/test_dac/dac/src/components/Versioning.pptx");
  await checkHeadingStructure("/home/tharindu/Documents/work/test_dac/dac/src/components/Versioning.pptx");
  await checkContrast("/home/tharindu/Documents/work/test_dac/dac/src/components/Versioning.pptx");
  await checkReadingOrder("/home/tharindu/Documents/work/test_dac/dac/src/components/Versioning.pptx");
  await checkEmptySlides("/home/tharindu/Documents/work/test_dac/dac/src/components/Versioning.pptx");
}

runPPTXTests();