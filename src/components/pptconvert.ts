import { PPTXtoHTMLConverter } from './PPTXtoHTMLConverter';
const officegen = require('officegen');
async function convertPresentation() {
    try {
        const converter = new PPTXtoHTMLConverter({
            embedImages: true,
            responsiveLayout: true,
            customCSS: '' // Optional custom styles
        });

        const outputPath = await converter.convert(
            'versioning.pptx',
            '.'
        );

        console.log(`Presentation converted successfully: ${outputPath}`);
    } catch (error) {
        console.error('Conversion failed:', error);
    }
}

convertPresentation();