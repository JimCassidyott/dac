/**
 * Enum representing possible error codes for HeadingError.
 */
export enum HeadingErrorCode {
    /**
     * Error code 1001: Indicates an invalid heading level. Level must be 1 or greater.
     */
    INVALID_HEADING_LEVEL = 1001,

    /**
     * Error code 1002: Indicates invalid first heading. First heading in the document must be level 1.
     */
    INVALID_FIRST_HEADING_LEVEL = 1002,

    /**
     * Error code 1003: Indicates that another another level 1 heading cannot be added.
     */
    CANNOT_ADD_ANOTHER_LEVEL_1 = 1003,

    /**
     * Error code 1004: Indicates that current heading level cannot be added at any valid position in hierarchy.
     */
    NO_VALID_POSITION = 1004
}

/**
 * Custom error class for handling heading-related errors in the document hierarchy.
 * @param message - A description of the error.
 * @param errorCode - A numeric code representing the specific error type.
 *        errorCode 01: `Invalid heading level: ${level}. Level must be 1 or greater.`
 */
export class HeadingError extends Error {
    errorCode: HeadingErrorCode;

    constructor(message: string, code: HeadingErrorCode) {
        super(message);
        this.name = 'HeadingError';
        this.errorCode = code;
    }
}

/**
 * Represents a heading in a document hierarchy.
 * Manages a tree structure where each heading can have child headings of deeper levels.
 * For example, an H1 can have H2 children, H2 can have H3 children, etc.
 */
export class Heading {
    /** The text content of the heading */
    private text: string;
    /** The heading level (1 for H1, 2 for H2, etc.) */
    private level: number;
    /** Array of child headings under this heading */
    private children: Heading[];
    /** Reference to the parent heading (null for root) */
    private parent: Heading | null;
    /** Reference to the currently active heading in the hierarchy */
    private activeHeading: Heading;
    /** Reference to the root (H1) heading of the document */
    private root: Heading | null;

    /**
     * Creates a new heading with the specified text and level.
     * @param text The text content of the heading
     * @param level The heading level (must be >= 1)
     */
    constructor(text: string, level: number) {
        this.validateLevel(level);
        this.text = text;
        this.level = level;
        this.children = [];
        this.parent = null;
        this.activeHeading = this;
        this.root = null;

        if (level === 1) {
            this.root = this;
        }
    }

    /**
     * Validates that the heading level is valid (>= 1).
     * @param level The heading level to validate
     * @throws HeadingError if level is less than 1
     */
    private validateLevel(level: number): void {
        if (level < 1) {
            throw new HeadingError(`Invalid heading level: ${level}. Level must be 1 or greater.`, HeadingErrorCode.INVALID_HEADING_LEVEL);
        }
    }

    /**
     * Adds a new heading to the document hierarchy.
     * The heading will be placed in the appropriate position based on its level
     * and the current active heading.
     * 
     * @param text The text content of the new heading
     * @param level The level of the new heading
     * @throws HeadingError if:
     *  - Adding another H1 heading
     *  - First heading is not H1
     *  - Cannot find valid position in hierarchy
     */
    addHeading(text: string, level: number): void {
        this.validateLevel(level);

        // Handle empty document case
        if (!this.root) {
            if (level !== 1) {
                throw new HeadingError('First heading in the document must be level 1', HeadingErrorCode.INVALID_FIRST_HEADING_LEVEL);
            }
            this.text = text;
            this.level = level;
            this.root = this;
            this.activeHeading = this;
            return;
        }

        // Prevent multiple level 1 headings
        if (level === 1) {
            throw new HeadingError('Cannot add another level 1 heading', HeadingErrorCode.CANNOT_ADD_ANOTHER_LEVEL_1);
        }

        // Create the new heading
        const newHeading = new Heading(text, level);
        newHeading.root = this.root;

        // Try to add the heading starting from active heading and moving up
        if (!this.tryAddHeadingToHierarchy(newHeading)) {
            throw new HeadingError(
                `Cannot add heading level ${level} at any valid position in hierarchy`,
                HeadingErrorCode.NO_VALID_POSITION
            );
        }
    }

    /**
     * Attempts to add a new heading to the hierarchy by traversing up from the active heading.
     * The heading can be added either as a child of a heading (if level is parent + 1)
     * or as a sibling (if at same level).
     * 
     * @param newHeading The new heading to add to the hierarchy
     * @returns true if heading was successfully added, false otherwise
     */
    private tryAddHeadingToHierarchy(newHeading: Heading): boolean {
        let currentParent: Heading | null = this.activeHeading;

        while (currentParent) {
            // Try to add as child of current level
            if (newHeading.level === currentParent.level + 1) {
                this.addHeadingToParent(currentParent, newHeading);
                this.activeHeading = newHeading;
                return true;
            }
            // Try to add as sibling if we're at the same level
            else if (newHeading.level === currentParent.level && currentParent.parent) {
                this.addHeadingToParent(currentParent.parent, newHeading);
                this.activeHeading = newHeading;
                return true;
            }
            // Move up to parent and try again
            currentParent = currentParent.parent;
        }

        return false;
    }

    /**
     * Adds a child heading to a parent heading, establishing the parent-child relationship.
     * @param parent The parent heading
     * @param child The child heading to add
     */
    private addHeadingToParent(parent: Heading, child: Heading): void {
        child.parent = parent;
        parent.children.push(child);
    }

    /**
     * Returns information about the currently active heading.
     * @returns Object containing the text and level of the active heading
     */
    getActiveHeading(): { text: string; level: number } {
        return {
            text: this.activeHeading.text,
            level: this.activeHeading.level
        };
    }

    /**
     * Generates a string representation of the heading hierarchy.
     * Each level is indented to show the hierarchical structure.
     * @param indent The indentation string to use (default: '')
     * @returns A formatted string showing the heading hierarchy
     */
    toString(indent: string = ''): string {
        let result = `${indent}Level ${this.level}: ${this.text}\n`;
        for (const child of this.children) {
            result += child.toString(indent + '  ');
        }
        return result;
    }

    /**
     * Converts the heading hierarchy into a plain object structure.
     * Useful for serialization or data transfer.
     * @returns An object representing the heading and its children
     */
    toStructure(): any {
        return {
            text: this.text,
            level: this.level,
            children: this.children.map(child => child.toStructure())
        };
    }
}

/**
 * Test function that demonstrates and validates the heading hierarchy functionality.
 * Tests various scenarios including:
 * - Basic hierarchy construction
 * - Adding valid child headings
 * - Adding sibling headings
 * - Tree navigation
 * - Error cases
 * - Complex tree operations
 */
function testHeadingHierarchy(): void {
    try {
        console.log("Test 1: Basic Hierarchy Construction");
        const doc = new Heading("Document Title", 1);
        console.log("\nCreated level 1 heading:");
        console.log(doc.toString());

        console.log("\nTest 2: Adding Valid Child Headings");
        doc.addHeading("Section 1", 2);
        doc.addHeading("Subsection 1.1", 3);
        doc.addHeading("Subsection 1.2", 3);
        console.log("\nAfter adding nested sections:");
        console.log(doc.toString());
        console.log("Active heading:", doc.getActiveHeading());

        console.log("\nTest 3: Adding Sibling at Current Level");
        doc.addHeading("Subsection 1.3", 3);
        console.log("\nAfter adding sibling section:");
        console.log(doc.toString());
        console.log("Active heading:", doc.getActiveHeading());

        console.log("\nTest 4: Moving Up Tree and Adding");
        doc.addHeading("Section 2", 2);
        console.log("\nAfter adding new level 2 section:");
        console.log(doc.toString());
        console.log("Active heading:", doc.getActiveHeading());

        console.log("\nTest 5: Deep Nesting");
        doc.addHeading("Subsection 2.1", 3);
        doc.addHeading("Subsection 2.1.1", 4);
        doc.addHeading("Subsection 2.1.2", 4);
        console.log("\nAfter deep nesting:");
        console.log(doc.toString());
        console.log("Active heading:", doc.getActiveHeading());

        console.log("\nTest 6: Error Cases");

        console.log("\nTrying to add another level 1 heading:");
        try {
            doc.addHeading("Another Title", 1);
        } catch (e) {
            if (e instanceof HeadingError) {
                console.log("Expected error:", e.message);
            }
        }

        console.log("\nTrying to add invalid level (too deep):");
        try {
            doc.addHeading("Too Deep", 6);
        } catch (e) {
            if (e instanceof HeadingError) {
                console.log("Expected error:", e.message);
            }
        }

        console.log("\nTest 7: Complex Tree Navigation");
        // Current active heading is at level 4
        doc.addHeading("Section 3", 2);  // Should work by moving up tree
        doc.addHeading("Subsection 3.1", 3);
        doc.addHeading("Section 4", 2);
        doc.addHeading("Subsection 4.1", 3);
        doc.addHeading("Subsection 4.1.1", 4);
        doc.addHeading("Section 5", 2);
        doc.addHeading("Subsection 5.1", 3);
        doc.addHeading("Subsection 5.1.1", 4);
        doc.addHeading("Subsection 5.1.1.1", 5);
        doc.addHeading("Subsection 5.2", 3);
        doc.addHeading("Subsection 6", 2);
        doc.addHeading("Subsection 6.1", 3);
        doc.addHeading("Subsection 6.1.1", 4);
        console.log("\nAfter complex navigation:");
        console.log(doc.toString());
        console.log("Active heading:", doc.getActiveHeading());

        console.log("\nTest 8: Invalid Level Jump");
        try {
            // Try to add level 4 when active heading is level 2
            doc.addHeading("Invalid Jump", 4);
        } catch (e) {
            if (e instanceof HeadingError) {
                console.log("Expected error:", e.message);
            }
        }

        // Display final structure
        console.log("\nFinal Document Structure:");
        console.log(JSON.stringify(doc.toStructure(), null, 2));

    } catch (e) {
        if (e instanceof HeadingError) {
            console.log("Unexpected Heading Error:", e.message);
        } else {
            console.log("Unexpected Error:", e);
        }
    }
}

// Run all tests
// testHeadingHierarchy();

// Run the tests if this file is executed directly
if (require.main === module) {
  testHeadingHierarchy();
}
