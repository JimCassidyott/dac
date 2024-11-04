import { parseString, Builder } from 'xml2js';
import { decode } from 'html-entities';

/**
 * Interface representing a single comment.
 */
interface Comment {
    $: {
        id: string;
        author: string;
        date: string;
        initials: string;
    };
    "w:p": Array<{
        "w:r": Array<{
            "w:t": string;
        }>;
    }>;
}

/**
 * Interface representing a collection of comments.
 */
interface CommentsCollection {
    "w:comments": {
        "w:comment": Comment[];
    };
}

/**
 * Class to manage a collection of comments in XML format.
 */
class Comments {
    private commentsXML: string;
    private commentsJSON: CommentsCollection;

    constructor(commentsXML?: string) {
        this.commentsXML = commentsXML || this.newCollectionOfComments();
    }

    /**
     * Generates a new empty collection of comments in XML format.
     * @returns {string} XML string representing an empty collection of comments.
     */
    private newCollectionOfComments(): string {
        return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:comments xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"
    xmlns:w14="http://schemas.microsoft.com/office/word/2010/wordml"
    xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing">
</w:comments>`;
    }

    /**
     * Converts XML to JSON using a Promise.
     * @param {string} xml - The XML string to convert.
     * @returns {Promise<CommentsCollection>} A promise that resolves to the JSON representation of the XML.
     */
    private xmlToJson(xml: string): Promise<CommentsCollection> {
        return new Promise((resolve, reject) => {
            parseString(xml, (err, result) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(result as CommentsCollection);
                }
            });
        });
    }

    /**
     * Converts JSON to XML.
     * @param {CommentsCollection} json - The JSON object to convert.
     * @returns {string} The XML string representation of the JSON object.
     */
    private jsonToXml(json: CommentsCollection): string {
        const builder = new Builder();
        return builder.buildObject(json);
    }

    /**
     * Gets the next available ID for a new comment.
     * @param {Comment[]} comments - The array of existing comments.
     * @returns {number} The next available ID.
     */
    private getNextId(comments: Comment[]): number {
        if (!comments || comments.length === 0) return 1;
        const ids = comments.map(comment => parseInt(comment.$.id, 10));
        return Math.max(...ids) + 1;
    }

    /**
     * Adds a new comment to the collection.
     * @param {string} comment - The comment text to add.
     * @returns {Promise<string>} A promise that resolves to the updated XML string of comments.
     */
    public async addComment(comment: string): Promise<string> {
        const today = new Date();
        const isoString = today.toISOString();
        const isoStringWithoutMillis = isoString.split('.')[0] + 'Z';

        const author = 'DAC ApplicAtion';
        const initials = 'DAC';

        try {
            // Parse the collection of comments XML
            this.commentsJSON = await this.xmlToJson(this.commentsXML);

            // Add the new comment to the parsed JSON object
            if (!this.commentsJSON["w:comments"]["w:comment"]) {
                this.commentsJSON["w:comments"]["w:comment"] = [];
            }

            const id = this.getNextId(this.commentsJSON["w:comments"]["w:comment"]);

            this.commentsJSON["w:comments"]["w:comment"].push({
                $: {
                    id: id.toString(),
                    author: author,
                    date: isoStringWithoutMillis,
                    initials: initials
                },
                "w:p": [
                    {
                        "w:r": [
                            {
                                "w:t": comment
                            }
                        ]
                    }
                ]
            });

            // Convert the modified JSON object back to XML
            this.commentsXML = decode(this.jsonToXml(this.commentsJSON));
            return this.commentsXML;

        } catch (error) {
            console.error('Error:', error);
            throw error;
        }
    }
}

// Example usage with async/await
async function testAll() {
    const commentsManager = new Comments();
    let comments = await commentsManager.addComment('1st comment');
    let c = `
        <w:p>
            <w:pPr>
                <w:spacing w:line="240" w:lineRule="auto"/>
            </w:pPr>
            <w:r>
                <w:rPr>
                    <w:rStyle w:val="CommentText"/>
                    <w:sz w:val="20"/>
                </w:rPr>
                <w:t>First paragraph of comment</w:t>
            </w:r>
        </w:p>
        <w:p>
            <w:pPr>
                <w:spacing w:line="240" w:lineRule="auto"/>
            </w:pPr>
            <w:r>
                <w:rPr>
                    <w:rStyle w:val="CommentText"/>
                    <w:i/>
                    <w:sz w:val="20"/>
                </w:rPr>
                <w:t>Second paragraph with italic text</w:t>
            </w:r>
        </w:p>`;

    comments = await commentsManager.addComment(c);
    comments = await commentsManager.addComment("3rd comment");
    console.log(comments);
}

// testAll();

