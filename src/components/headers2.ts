class HeadingError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'HeadingError';
    }
}

class Heading {
    private text: string;
    private level: number;
    private children: Heading[];
    private parent: Heading | null;
    private activeHeading: Heading;
    private root: Heading | null;

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

    private validateLevel(level: number): void {
        if (level < 1) {
            throw new HeadingError(`Invalid heading level: ${level}. Level must be 1 or greater.`);
        }
    }

    addHeading(text: string, level: number): void {
        this.validateLevel(level);

        // Handle empty document case
        if (!this.root) {
            if (level !== 1) {
                throw new HeadingError('First heading in the document must be level 1');
            }
            this.text = text;
            this.level = level;
            this.root = this;
            this.activeHeading = this;
            return;
        }

        // Prevent multiple level 1 headings
        if (level === 1) {
            throw new HeadingError('Cannot add another level 1 heading');
        }

        // Create the new heading
        const newHeading = new Heading(text, level);
        newHeading.root = this.root;

        // Try to add the heading starting from active heading and moving up
        if (!this.tryAddHeadingToHierarchy(newHeading)) {
            throw new HeadingError(
                `Cannot add heading level ${level} at any valid position in hierarchy`
            );
        }
    }

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

    private addHeadingToParent(parent: Heading, child: Heading): void {
        child.parent = parent;
        parent.children.push(child);
    }

    getActiveHeading(): { text: string; level: number } {
        return {
            text: this.activeHeading.text,
            level: this.activeHeading.level
        };
    }

    toString(indent: string = ''): string {
        let result = `${indent}Level ${this.level}: ${this.text}\n`;
        for (const child of this.children) {
            result += child.toString(indent + '  ');
        }
        return result;
    }

    toStructure(): any {
        return {
            text: this.text,
            level: this.level,
            children: this.children.map(child => child.toStructure())
        };
    }
}

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
testHeadingHierarchy();