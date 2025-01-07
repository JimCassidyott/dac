/**
 * @fileoverview Test document generator for Document Accessibility Checker (DAC)
 * This script creates a suite of test Word documents that demonstrate various
 * WCAG accessibility violations for testing purposes.
 *
 * Created as part of the Document Accessibility Checker (DAC) project
 * Written for CSC Corporation
 *
 * @author Jim Cassidy
 * @copyright 2025 CSC GOC
 */

import * as fs from 'fs';
import * as path from 'path';
import { 
    Document, 
    Packer, 
    Paragraph, 
    ImageRun, 
    TextRun, 
    ExternalHyperlink,
    Table,
    TableRow,
    TableCell,
    BorderStyle,
    WidthType,
    ITableCellOptions,
    convertInchesToTwip,
    HeadingLevel
} from 'docx';

/**
 * Directory paths for test assets
 * Creates directories if they don't exist
 */
const imagesDir = path.join(__dirname, 'images');
const documentsDir = path.join(__dirname, 'documents');

[imagesDir, documentsDir].forEach(dir => {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
});

/**
 * Create a simple SVG test image
 * This image will be used in the image without alt text test
 */
const svgContent = `
<svg width="100" height="100" xmlns="http://www.w3.org/2000/svg">
    <rect x="20" y="20" width="60" height="60" fill="blue"/>
</svg>`;

const imagePath = path.join(imagesDir, 'test_shape.svg');
fs.writeFileSync(imagePath, svgContent);

/**
 * Interface defining the structure of a test document
 * @interface TestDocument
 * @property {string} filename - Name of the output Word document
 * @property {string} wcagCriterion - The WCAG criterion being tested
 * @property {string} testPurpose - Description of the accessibility issue being tested
 * @property {() => (Paragraph | Table)[]} content - Function that returns the document's content
 */
interface TestDocument {
    filename: string;
    wcagCriterion: string;
    testPurpose: string;
    content: () => (Paragraph | Table)[];
}

/**
 * Creates paragraphs containing the test purpose description
 * Adds three blank lines before the test purpose for visual separation
 *
 * @param {string} text - The test purpose description
 * @returns {Paragraph[]} Array of paragraphs for the test purpose section
 */
const createTestPurposeParagraph = (text: string): Paragraph[] => {
    return [
        new Paragraph({ children: [new TextRun("\n\n\n")] }),
        new Paragraph({
            children: [
                new TextRun({
                    text: "Test Purpose:\n",
                    bold: true
                }),
                new TextRun(text)
            ],
        })
    ];
};

/**
 * Creates a hyperlink with configurable styling
 * Used to demonstrate both accessible and inaccessible link styles
 *
 * @param {string} text - The link text
 * @param {string} url - The link URL
 * @param {Object} options - Styling options
 * @param {boolean} options.withUnderline - Whether to add an underline
 * @param {boolean} options.withStyle - Whether to apply the default hyperlink style
 * @returns {ExternalHyperlink} Configured hyperlink object
 */
const createHyperlink = (text: string, url: string, options?: { withUnderline?: boolean; withStyle?: boolean }): ExternalHyperlink => {
    return new ExternalHyperlink({
        children: [
            new TextRun({
                text,
                style: options?.withStyle !== false ? "Hyperlink" : undefined,
                underline: options?.withUnderline ? { type: "single" } : undefined,
                color: "0000FF" // Ensure color is always applied for the test
            })
        ],
        link: url
    });
};

/**
 * Creates a basic table with borders for better visibility
 * @param {TableRow[]} rows - The rows to include in the table
 * @returns {Table} A formatted table with borders
 */
const createBasicTable = (rows: TableRow[]): Table => {
    return new Table({
        width: {
            size: 100,
            type: WidthType.PERCENTAGE,
        },
        rows,
        borders: {
            top: { style: BorderStyle.SINGLE, size: 1 },
            bottom: { style: BorderStyle.SINGLE, size: 1 },
            left: { style: BorderStyle.SINGLE, size: 1 },
            right: { style: BorderStyle.SINGLE, size: 1 },
            insideHorizontal: { style: BorderStyle.SINGLE, size: 1 },
            insideVertical: { style: BorderStyle.SINGLE, size: 1 }
        }
    });
};

/**
 * Helper function to create table cells with consistent width
 * @param {string} content - The cell content
 * @param {Partial<ITableCellOptions>} options - Optional cell options
 * @returns {TableCell} A formatted table cell
 */
const createTableCell = (content: string, options: Partial<ITableCellOptions> = {}): TableCell => {
    return new TableCell({
        ...options,
        width: {
            size: convertInchesToTwip(2),
            type: WidthType.DXA,
        },
        children: [new Paragraph(content)]
    });
};

/**
 * Creates a heading with the specified level and text
 * @param {string} text - The heading text
 * @param {number} level - The heading level (1-6)
 * @returns {Paragraph} A paragraph formatted as a heading
 */
const createHeading = (text: string, level: number): Paragraph => {
    const headingMap = {
        1: HeadingLevel.HEADING_1,
        2: HeadingLevel.HEADING_2,
        3: HeadingLevel.HEADING_3,
        4: HeadingLevel.HEADING_4,
        5: HeadingLevel.HEADING_5,
        6: HeadingLevel.HEADING_6
    };
    return new Paragraph({
        text: text,
        heading: headingMap[level as keyof typeof headingMap],
        spacing: {
            before: 200,
            after: 100
        }
    });
};

/**
 * Array of test document definitions
 * Each object defines a specific accessibility test case
 */
const testDocuments: TestDocument[] = [
    {
        filename: 'WCAG_1.1.1_Non-text_Content_Fail.docx',
        wcagCriterion: '1.1.1',
        testPurpose: "This document tests for WCAG 1.1.1 Non-text Content violation. The image above lacks alternative text, making it inaccessible to screen readers and failing to provide a text alternative for non-text content. In an accessible document, every image should have appropriate alternative text describing its content or purpose.",
        content: () => [
            new Paragraph({
                children: [
                    new ImageRun({
                        data: fs.readFileSync(imagePath),
                        transformation: {
                            width: 200,
                            height: 200,
                        },
                    })
                ],
            })
        ]
    },
    {
        filename: 'WCAG_2.4.4_Link_Purpose_In_Context_Fail.docx',
        wcagCriterion: '2.4.4',
        testPurpose: "This document tests for WCAG 2.4.4 Link Purpose (In Context) violation. The link above uses generic text 'Click here' which provides no indication of its destination or purpose. Links should use descriptive text that makes sense within their context.",
        content: () => [
            new Paragraph({
                children: [
                    new TextRun("This document contains a link that lacks descriptive text: "),
                    createHyperlink("Click here", "https://www.w3.org/WAI/WCAG21/Understanding/link-purpose-in-context.html")
                ],
            })
        ]
    },
    {
        filename: 'WCAG_2.4.9_Link_Purpose_Link_Only_Fail.docx',
        wcagCriterion: '2.4.9',
        testPurpose: "This document tests for WCAG 2.4.9 Link Purpose (Link Only) violation. The link above uses 'read more' text which only makes sense with surrounding context. At Level AAA, link text should be meaningful on its own, without requiring additional context.",
        content: () => [
            new Paragraph({
                children: [
                    new TextRun("To learn more about web accessibility standards "),
                    createHyperlink("read more", "https://www.w3.org/WAI/standards-guidelines/"),
                    new TextRun(" in the W3C Web Accessibility Initiative guidelines.")
                ],
            })
        ]
    },
    {
        filename: 'WCAG_2.4.4_URL_As_Link_Text_Fail.docx',
        wcagCriterion: '2.4.4',
        testPurpose: "This document tests for WCAG 2.4.4 Link Purpose (In Context) violation. The link above uses a raw URL as link text, which is not user-friendly and can be particularly challenging for screen reader users. Instead, descriptive text like 'Web Accessibility Introduction' should be used.",
        content: () => [
            new Paragraph({
                children: [
                    new TextRun("For information about web accessibility, visit "),
                    createHyperlink(
                        "https://www.w3.org/WAI/fundamentals/accessibility-intro/",
                        "https://www.w3.org/WAI/fundamentals/accessibility-intro/",
                        { withStyle: true }
                    )
                ],
            })
        ]
    },
    {
        filename: 'WCAG_1.4.1_Use_Of_Color_Fail.docx',
        wcagCriterion: '1.4.1',
        testPurpose: "This document tests for WCAG 1.4.1 Use of Color violation. The links above use inconsistent styling - the first link has both color and underline, while the second link is only distinguished by color. This inconsistency not only creates a poor user experience but also fails to ensure that color is not the only visual means of conveying information. Users who are colorblind or have other visual impairments may have difficulty identifying the second link. All links should maintain consistent styling and use multiple visual indicators (such as both color and underline) to identify them as interactive elements.",
        content: () => [
            new Paragraph({
                children: [
                    new TextRun("Here are two links with inconsistent styling:\n\n"),
                    createHyperlink(
                        "First accessibility resource",
                        "https://www.w3.org/WAI/WCAG21/quickref/",
                        { withUnderline: true, withStyle: true }
                    ),
                    new TextRun("\n\n"),
                    createHyperlink(
                        "Second accessibility resource",
                        "https://www.w3.org/WAI/standards-guidelines/",
                        { withUnderline: false, withStyle: false }
                    )
                ],
            })
        ]
    },
    {
        filename: 'WCAG_1.3.1_Info_And_Relationships_Table_Headers_Fail.docx',
        wcagCriterion: '1.3.1',
        testPurpose: "This document tests for WCAG 1.3.1 Info and Relationships violation in tables. The table below lacks properly marked header cells, making it difficult for screen readers to understand the relationship between headers and data cells. In Word, table headers should be marked using the 'Repeat Header Rows' feature and proper table styles.",
        content: () => [
            new Paragraph({
                children: [
                    new TextRun("Employee Schedule"),
                ],
            }),
            createBasicTable([
                new TableRow({
                    children: [
                        createTableCell("Name"),
                        createTableCell("Monday"),
                        createTableCell("Tuesday")
                    ]
                }),
                new TableRow({
                    children: [
                        createTableCell("John Smith"),
                        createTableCell("9:00-5:00"),
                        createTableCell("10:00-6:00")
                    ]
                })
            ])
        ]
    },
    {
        filename: 'WCAG_1.3.1_Info_And_Relationships_Table_Structure_Fail.docx',
        wcagCriterion: '1.3.1',
        testPurpose: "This document tests for WCAG 1.3.1 Info and Relationships violation in table structure. The table below uses merged cells incorrectly, making it difficult for screen readers to understand the relationships between cells. Complex tables should maintain clear cell relationships and avoid unnecessary merging.",
        content: () => [
            new Paragraph({
                children: [
                    new TextRun("Quarterly Sales Report"),
                ],
            }),
            createBasicTable([
                new TableRow({
                    children: [
                        createTableCell("Region", { columnSpan: 2 }),
                        createTableCell("Q1")
                    ]
                }),
                new TableRow({
                    children: [
                        createTableCell("North"),
                        createTableCell("South"),
                        createTableCell("$50,000")
                    ]
                })
            ])
        ]
    },
    {
        filename: 'WCAG_1.3.2_Meaningful_Sequence_Table_Order_Fail.docx',
        wcagCriterion: '1.3.2',
        testPurpose: "This document tests for WCAG 1.3.2 Meaningful Sequence violation in tables. The table below has a complex layout that doesn't follow a logical reading order, making it difficult for screen readers to present the information in a meaningful sequence. Tables should be structured with a clear left-to-right, top-to-bottom reading order.",
        content: () => [
            new Paragraph({
                children: [
                    new TextRun("Product Comparison"),
                ],
            }),
            createBasicTable([
                new TableRow({
                    children: [
                        createTableCell("Price"),
                        createTableCell("Product A"),
                        createTableCell("Features")
                    ]
                }),
                new TableRow({
                    children: [
                        createTableCell("$99"),
                        createTableCell("Basic Model"),
                        createTableCell("Standard")
                    ]
                })
            ])
        ]
    },
    {
        filename: 'WCAG_2.4.3_Focus_Order_Table_Navigation_Fail.docx',
        wcagCriterion: '2.4.3',
        testPurpose: "This document tests for WCAG 2.4.3 Focus Order violation in tables. The table below contains interactive elements (links) in an order that doesn't match the visual layout, creating confusion for keyboard users. Interactive elements in tables should follow a logical tab order that matches the visual presentation.",
        content: () => [
            new Paragraph({
                children: [
                    new TextRun("Document Links"),
                ],
            }),
            createBasicTable([
                new TableRow({
                    children: [
                        new TableCell({
                            width: {
                                size: convertInchesToTwip(2),
                                type: WidthType.DXA,
                            },
                            children: [
                                new Paragraph({ 
                                    children: [
                                        createHyperlink(
                                            "Third Link",
                                            "https://example.com/3",
                                            { withUnderline: true, withStyle: true }
                                        )
                                    ]
                                })
                            ]
                        }),
                        new TableCell({
                            width: {
                                size: convertInchesToTwip(2),
                                type: WidthType.DXA,
                            },
                            children: [
                                new Paragraph({ 
                                    children: [
                                        createHyperlink(
                                            "First Link",
                                            "https://example.com/1",
                                            { withUnderline: true, withStyle: true }
                                        )
                                    ]
                                })
                            ]
                        })
                    ]
                }),
                new TableRow({
                    children: [
                        new TableCell({
                            width: {
                                size: convertInchesToTwip(2),
                                type: WidthType.DXA,
                            },
                            children: [
                                new Paragraph({ 
                                    children: [
                                        createHyperlink(
                                            "Second Link",
                                            "https://example.com/2",
                                            { withUnderline: true, withStyle: true }
                                        )
                                    ]
                                })
                            ]
                        }),
                        new TableCell({
                            width: {
                                size: convertInchesToTwip(2),
                                type: WidthType.DXA,
                            },
                            children: [
                                new Paragraph({ 
                                    children: [
                                        createHyperlink(
                                            "Fourth Link",
                                            "https://example.com/4",
                                            { withUnderline: true, withStyle: true }
                                        )
                                    ]
                                })
                            ]
                        })
                    ]
                })
            ])
        ]
    },
    {
        filename: 'WCAG_2.4.10_Section_Headings_Fail.docx',
        wcagCriterion: '2.4.10',
        testPurpose: "This document demonstrates a violation of WCAG 2.4.10 (Section Headings) and WCAG 1.3.1 (Info and Relationships) by using headings that are not properly sequenced. The document skips heading levels and uses them out of order, making it difficult for screen reader users to understand the document's structure. Headings should follow a logical sequence (H1 -> H2 -> H3) without skipping levels.",
        content: () => [
            createHeading("Company Overview", 1),
            new Paragraph("Welcome to our company's annual report."),
            
            // Incorrectly skip from H1 to H3
            createHeading("Financial Performance", 3),
            new Paragraph("Our financial performance this year has been exceptional."),
            
            // Incorrectly go back to H2 after H3
            createHeading("Revenue Growth", 2),
            new Paragraph("Revenue has grown by 25% year over year."),
            
            // Incorrectly skip from H2 to H4
            createHeading("Regional Performance", 4),
            new Paragraph("Performance varied by region."),
            
            // Incorrectly use H6 after H4
            createHeading("North America", 6),
            new Paragraph("North America showed strong growth."),
            
            // Incorrectly go back to H3
            createHeading("Future Outlook", 3),
            new Paragraph("We expect continued growth in the coming year."),
            
            // Add a note about proper heading structure
            new Paragraph({
                children: [
                    new TextRun({
                        text: "\n\nNote: The correct heading structure should be:\n",
                        bold: true
                    }),
                    new TextRun("H1: Company Overview\n"),
                    new TextRun("  H2: Financial Performance\n"),
                    new TextRun("    H3: Revenue Growth\n"),
                    new TextRun("    H3: Regional Performance\n"),
                    new TextRun("      H4: North America\n"),
                    new TextRun("  H2: Future Outlook")
                ]
            })
        ]
    },
    {
        filename: 'WCAG_1.3.1_Info_And_Relationships_Heading_Style_Fail.docx',
        wcagCriterion: '1.3.1',
        testPurpose: "This document demonstrates a violation of WCAG 1.3.1 (Info and Relationships) by using visual formatting (bold, italics, larger text) instead of proper heading styles to indicate section headers. Screen readers rely on proper heading markup to understand document structure and cannot interpret visual formatting alone. Headers should be marked up using Word's built-in heading styles rather than manual formatting.",
        content: () => [
            // Incorrect: Using bold and large text instead of H1 style
            new Paragraph({
                children: [
                    new TextRun({
                        text: "Company Overview",
                        bold: true,
                        size: 36  // 18pt
                    })
                ],
                spacing: { after: 200 }
            }),
            new Paragraph("Welcome to our company's annual report."),
            
            // Incorrect: Using italics and medium text instead of H2 style
            new Paragraph({
                children: [
                    new TextRun({
                        text: "Financial Performance",
                        italics: true,
                        size: 32  // 16pt
                    })
                ],
                spacing: { before: 200, after: 200 }
            }),
            new Paragraph("Our financial performance this year has been exceptional."),
            
            // Incorrect: Using underline and slightly larger text instead of H3 style
            new Paragraph({
                children: [
                    new TextRun({
                        text: "Revenue Growth",
                        underline: {},
                        size: 28  // 14pt
                    })
                ],
                spacing: { before: 200, after: 200 }
            }),
            new Paragraph("Revenue has grown by 25% year over year."),
            
            // Add a note about proper heading usage
            new Paragraph({
                children: [
                    new TextRun({
                        text: "\n\nNote: Instead of using visual formatting, the document should use proper heading styles:\n",
                        bold: true
                    }),
                    new TextRun("• 'Company Overview' should use Heading 1 style\n"),
                    new TextRun("• 'Financial Performance' should use Heading 2 style\n"),
                    new TextRun("• 'Revenue Growth' should use Heading 3 style\n\n"),
                    new TextRun("Using proper heading styles ensures that:\n"),
                    new TextRun("1. Screen readers can identify and announce headings correctly\n"),
                    new TextRun("2. Document structure is programmatically determinable\n"),
                    new TextRun("3. Navigation features like the Document Map work properly\n"),
                    new TextRun("4. Styles can be consistently updated throughout the document")
                ]
            }),
            
            // Show correct example using proper heading styles
            new Paragraph({
                children: [
                    new TextRun({
                        text: "\nCorrect Example (using proper heading styles):\n",
                        bold: true
                    })
                ]
            }),
            createHeading("Company Overview", 1),
            createHeading("Financial Performance", 2),
            createHeading("Revenue Growth", 3)
        ]
    }
];

/**
 * Creates a single test document with the specified content and purpose
 *
 * @param {TestDocument} doc - The test document definition
 * @returns {Promise<void>} Promise that resolves when the document is created
 */
async function createTestDocument(doc: TestDocument): Promise<void> {
    const document = new Document({
        sections: [{
            properties: {},
            children: [
                ...doc.content(),
                ...createTestPurposeParagraph(doc.testPurpose)
            ],
        }],
    });

    const buffer = await Packer.toBuffer(document);
    fs.writeFileSync(
        path.join(documentsDir, doc.filename),
        buffer
    );
}

/**
 * Creates all test documents in parallel
 * Each document demonstrates a specific WCAG accessibility violation
 *
 * @returns {Promise<void>} Promise that resolves when all documents are created
 */
async function createAllTestFiles(): Promise<void> {
    await Promise.all(testDocuments.map(createTestDocument));
}

// Execute the document creation
createAllTestFiles().catch(console.error);
