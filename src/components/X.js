const { Document, Packer, Paragraph, TextRun, LegacyTextFormField } = require('docx');
const fs = require('fs');

// Create a Word document with three legacy text form fields
const doc = new Document({
    sections: [
        {
            children: [
                new Paragraph({
                    children: [
                        new TextRun({ text: 'First Name: ', bold: true }),
                        new LegacyTextFormField({ name: 'FirstName' }),
                    ],
                }),
                new Paragraph({
                    children: [
                        new TextRun({ text: 'Date of Birth: ', bold: true }),
                        new LegacyTextFormField({ name: 'DOB' }),
                    ],
                }),
                new Paragraph({
                    children: [
                        new TextRun({ text: 'Last Name: ', bold: true }),
                        new LegacyTextFormField({ name: 'LastName' }),
                    ],
                }),
            ],
        },
    ],
});

// Save the document as X.docx
Packer.toBuffer(doc).then((buffer) => {
    fs.writeFileSync('X.docx', buffer);
    console.log('Word document X.docx created with three fillable fields (First Name, Date of Birth, Last Name).');
});
